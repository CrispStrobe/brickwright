// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {availableActuatorJoints, availableCircuitParts, connectionDocumentMismatch, connectionsForDocument,
    createCircuitCadCatalogReader, emptyConnections, nextActuatorConnection, hasDirectCadProgram}
    from '../overlay/scratch-gui/src/lib/bw-cad-circuit/panel-model.js';
import {observeCircuitCadPanel} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/panel-observer.js';
import {validateConnections} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
import {STATUS_EVENT} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/bridge.js';
import {CAD_READY_EVENT} from '../overlay/scratch-gui/src/lib/bw-cad-program.js';

const catalog = {
    documentId: 'rover', motors: [{id: 'left'}, {id: 'lift'}], servos: [{id: 'steer'}], sensors: [{id: 'distance'}],
    joints: [{id: 'steering', kind: 'hinge'}, {id: 'wheel', kind: 'hinge'}, {id: 'carriage', kind: 'slider'}]
};
const connect = (config, kind) => {
    const {part, joint} = nextActuatorConnection(catalog, config, kind);
    const key = kind === 'servo' ? 'servos' : 'drives';
    return validateConnections({...config, [key]: [...config[key], {partId: part.id, jointId: joint.id, kind: joint.kind}]});
};

test('a steering servo leaves the other hinge and slider available to DC motors', () => {
    let config = connect(emptyConnections('rover'), 'servo');
    config = connect(config, 'motor');
    config = connect(config, 'motor');
    assert.deepEqual(config.servos.map(row => [row.partId, row.jointId]), [['steer', 'steering']]);
    assert.deepEqual(config.drives.map(row => [row.partId, row.jointId, row.kind]),
        [['left', 'wheel', 'hinge'], ['lift', 'carriage', 'slider']]);
    assert.equal(nextActuatorConnection(catalog, config), null);
    assert.equal(nextActuatorConnection(catalog, config, 'servo'), null);
    config = {...config, drives: config.drives.slice(1)};
    assert.deepEqual(nextActuatorConnection(catalog, config), {part: catalog.motors[0], joint: catalog.joints[1]});
});

test('motor-first and existing-row choices respect shared actuator occupancy', () => {
    let config = connect(emptyConnections('rover'), 'motor');
    config = connect(config, 'servo');
    assert.equal(config.servos[0].jointId, 'wheel');
    assert.deepEqual(availableActuatorJoints(catalog.joints, config, 'left').map(row => row.id), ['steering', 'carriage']);
    assert.deepEqual(availableActuatorJoints(catalog.joints, config, 'steer', 'hinge').map(row => row.id), ['wheel']);
    assert.deepEqual(availableCircuitParts(catalog.motors, config, 'left'), catalog.motors);
    assert.deepEqual(availableCircuitParts(catalog.motors, config), [catalog.motors[1]]);
    assert.equal(nextActuatorConnection({...catalog, joints: [catalog.joints[2]]}, emptyConnections('rover'), 'servo'), null,
        'a servo never claims a slider');
});

test('a replacement document cannot inherit old bindings even when joint IDs coincide', () => {
    const saved = connect(emptyConnections('old-design'), 'servo');
    const before = JSON.stringify(saved);
    assert.equal(connectionDocumentMismatch(saved, 'rover'), true);
    assert.throws(() => connectionsForDocument(saved, 'rover'), /Clear the saved connections/);
    assert.equal(JSON.stringify(saved), before, 'refusing an edit preserves the previous binding set');
    assert.equal(connectionsForDocument(saved, 'old-design'), saved);
    assert.throws(() => connectionsForDocument(saved, ''), /Open a CAD design/);
    const cleared = emptyConnections('rover');
    assert.equal(cleared.enabled, false);
    assert.equal(connectionDocumentMismatch(cleared, 'rover'), false);
    assert.deepEqual(connect(connectionsForDocument(cleared, 'rover'), 'servo').servos.map(row => row.jointId), ['steering']);
    assert.deepEqual(connectionsForDocument(null, 'rover'), emptyConnections('rover'));
});

function model () {
    const state = {revision: 0, document: {id: 'rover', roots: ['chassis', 'reference', 'cutout'], nodes: {
        chassis: {name: 'Body'}, reference: {reference: true}, cutout: {role: 'hole'}
    }}};
    const listeners = new Set(), counts = {motors: 0, sliders: 0, subscriptions: 0, releases: 0};
    const motor = {id: 'wheel', name: 'Drive axle', port: 'A'};
    const editor = {session: {state, subscribe (fn) {
        counts.subscriptions++; listeners.add(fn); fn(state);
        return () => {counts.releases++; listeners.delete(fn);};
    }}, simulation: {
        motors () {counts.motors++; return [motor];},
        sliders () {counts.sliders++; return [{id: 'lift', name: 'Lift', port: 'B'}];}
    }};
    const board = {parts: [{id: 'motor', kind: 'dc_motor', name: 'Drive', params: {power: 0}},
        {id: 'vcc', kind: 'vcc', name: 'Power'}, {id: 'distance', kind: 'ultrasonic', name: 'Front'}]};
    return {editor, board, state, motor, counts, changed () {state.revision++; for (const fn of listeners) fn(state);}};
}

test('catalogue ignores live electrical readings and unchanged polls but observes in-place metadata edits', () => {
    const m = model(), read = createCircuitCadCatalogReader();
    const first = read(m.board, m.editor);
    assert.deepEqual(first.bodies, [{id: 'chassis', name: 'Body'}]);
    assert.deepEqual(first.joints.map(row => row.kind), ['hinge', 'slider']);
    for (let i = 0; i < 100; i++) {
        m.board.parts[0].params.power = i;
        assert.equal(read(m.board, m.editor), first);
    }
    assert.equal(m.counts.motors, 1);
    assert.equal(m.counts.sliders, 1);
    m.board.parts[1].name = 'Battery';
    assert.equal(read(m.board, m.editor), first, 'irrelevant part metadata does not repaint the catalogue');
    m.board.parts[0].name = 'Left drive';
    const renamed = read(m.board, m.editor);
    assert.notEqual(renamed, first);
    assert.equal(renamed.motors[0].name, 'Left drive');
    assert.equal(first.motors[0].name, 'Drive', 'cached metadata is detached from mutable board parts');
    assert.equal(m.counts.motors, 1, 'circuit edits do not enumerate CAD joints');
    m.board.parts.push({id: 'servo', kind: 'servo', name: 'Steering'});
    assert.equal(read(m.board, m.editor).servos[0].id, 'servo');
});

test('document revisions refresh names and ports, and model replacement clears stale choices', () => {
    const m = model(), read = createCircuitCadCatalogReader(), first = read(m.board, m.editor);
    m.changed();
    assert.equal(read(m.board, m.editor), first, 'a geometry-only edit keeps equal menu metadata stable');
    m.state.document.nodes.chassis.name = 'Chassis'; m.motor.port = 'C'; m.changed();
    const edited = read(m.board, m.editor);
    assert.equal(edited.bodies[0].name, 'Chassis');
    assert.equal(edited.joints[0].port, 'C');
    const next = model(); next.state.document.id = 'arm';
    assert.equal(read(m.board, next.editor).documentId, 'arm');
    const closed = read(null, null);
    assert.equal(closed.documentId, '');
    assert.deepEqual(closed.joints, []);
    assert.deepEqual(closed.motors, []);
});

function observed (options = {}) {
    const m = model(), events = new EventTarget(), scheduled = new Set();
    const outputs = {catalogs: [], statuses: [], configs: [], errors: []};
    let editor = m.editor, wallMs = 0, connections = emptyConnections('rover');
    let status = {phase: 'running', time: 12, readings: [], error: ''}, reads = 0;
    const runtime = {circuitBoard: m.board, cadCircuitSimulation: {state: () => status}};
    const observe = (overrides = {}) => observeCircuitCadPanel({
        runtime, isVisible: true, expanded: true, events,
        readEditor: () => {reads++; return editor;}, readSavedConnections: () => connections,
        now: () => wallMs, schedule: fn => {scheduled.add(fn); return fn;}, cancel: fn => scheduled.delete(fn),
        onCatalog: value => outputs.catalogs.push(value), onStatus: value => outputs.statuses.push(value),
        onConnections: value => outputs.configs.push(value), onError: value => outputs.errors.push(value),
        ...options, ...overrides
    });
    return {m, outputs, scheduled, observe, setEditor: next => {editor = next;},
        setConnections: next => {connections = next;}, get reads () {return reads;},
        pulse: () => {for (const fn of scheduled) fn();}, event: type => events.dispatchEvent(new Event(type)),
        progress (phase, time, at) {wallMs = at; status = {phase, time, readings: [], error: ''};
            events.dispatchEvent(new CustomEvent(STATUS_EVENT, {detail: status}));}
    };
}

test('hidden views do no work; collapsed views hydrate document identity without enumerating parts', () => {
    const h = observed();
    const hidden = h.observe({isVisible: false});
    h.event(CAD_READY_EVENT); h.progress('running', 13, 1000); h.pulse(); hidden();
    assert.equal(h.reads, 0); assert.equal(h.scheduled.size, 0);
    assert.deepEqual(h.outputs, {catalogs: [], statuses: [], configs: [], errors: []});
    const collapsed = h.observe({expanded: false});
    assert.equal(h.outputs.statuses.at(-1).time, 13, 'returning to a tab hydrates the actual running status');
    h.progress('running', 13.1, 1100); h.progress('running', 13.9, 1900);
    assert.equal(h.outputs.statuses.length, 1);
    h.progress('running', 14, 2000);
    assert.equal(h.outputs.statuses.length, 2);
    h.progress('error', 14, 2001);
    assert.equal(h.outputs.statuses.at(-1).phase, 'error', 'phase transitions bypass progress throttling');
    assert.equal(h.reads, 1); assert.equal(h.scheduled.size, 0);
    assert.equal(h.outputs.catalogs.at(-1).documentId, 'rover');
    assert.equal(h.m.counts.motors, 0); collapsed();
});

test('expanded view reacts to model and board changes, never rebuilds for progress, and cleans up', () => {
    const h = observed(), close = h.observe();
    assert.equal(h.scheduled.size, 1); assert.equal(h.outputs.catalogs.length, 1);
    assert.equal(h.m.counts.subscriptions, 1);
    for (let i = 0; i < 50; i++) {h.progress('running', 12 + i / 10, i * 100); h.pulse();}
    assert.equal(h.outputs.catalogs.length, 1);
    assert.equal(h.m.counts.motors, 1);
    h.m.board.parts[0].name = 'Updated motor'; h.pulse();
    assert.equal(h.outputs.catalogs.at(-1).motors[0].name, 'Updated motor');
    h.m.state.document.nodes.chassis.name = 'Updated chassis'; h.m.changed();
    assert.equal(h.outputs.catalogs.at(-1).bodies[0].name, 'Updated chassis');
    const replacement = model(); replacement.state.document.id = 'replacement'; h.setEditor(replacement.editor);
    h.event(CAD_READY_EVENT);
    assert.equal(h.m.counts.releases, 1); assert.equal(replacement.counts.subscriptions, 1);
    assert.equal(h.outputs.catalogs.at(-1).documentId, 'replacement');
    close();
    const counts = Object.fromEntries(Object.entries(h.outputs).map(([key, values]) => [key, values.length]));
    replacement.changed(); h.event(CAD_READY_EVENT); h.progress('idle', 0, 10000); h.pulse();
    assert.deepEqual(Object.fromEntries(Object.entries(h.outputs).map(([key, values]) => [key, values.length])), counts);
    assert.equal(h.scheduled.size, 0); assert.equal(replacement.counts.releases, 1);
});

test('late CAD readiness and bindings replaced while hidden are observed on reopening', () => {
    const h = observed(); h.setEditor(null);
    const first = h.observe();
    assert.equal(h.outputs.catalogs.at(-1).documentId, '');
    h.setEditor(h.m.editor); h.event(CAD_READY_EVENT);
    assert.equal(h.outputs.catalogs.at(-1).documentId, 'rover'); first();
    const updated = {...emptyConnections('new-design'), enabled: true}; h.setConnections(updated);
    h.progress('running', 25, 10000);
    const reopened = h.observe();
    assert.equal(h.outputs.statuses.at(-1).time, 25);
    assert.equal(h.outputs.configs.at(-1), updated);
    reopened();
});


test('the shared Run control recognizes existing direct CAD motor and slider programs',()=>{
    assert.equal(hasDirectCadProgram({targets:[{blocks:{_blocks:{motor:{opcode:'cadlab_setMotorSpeed'}}}}]}),true);
    assert.equal(hasDirectCadProgram({targets:[{blocks:{_blocks:{slider:{opcode:'cadlab_runSliderDistance'}}}}]}),true);
    assert.equal(hasDirectCadProgram({targets:[{blocks:{_blocks:{motor:{opcode:'robotlab_setMotorSpeed'},pin:{opcode:'stc12_digitalWrite'}}}}]}),false);
    assert.equal(hasDirectCadProgram({targets:[{}, {blocks:{_blocks:{}}}]}),false);
});
