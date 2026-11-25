import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {ControllerPanel} from 'bw-board/controller.js';
import {ControllerExtension} from 'bw-board/controller-extension.js';
import {createWorkspace, validateWorkspace, LOGIKUS_STORAGE_KEY} from
    '../overlay/scratch-gui/src/lib/logikus/workspace.js';
import {connectLogikusController} from '../overlay/scratch-gui/src/lib/logikus/controller-bridge.js';
import {getPreset} from '../overlay/scratch-gui/src/lib/logikus/presets.js';
import {BUNDLE_PATH, BUNDLE_FORMAT, BUNDLE_VERSION, attachBrickwrightState, extractBrickwrightState,
    encodeProjectState, decodeProjectState, isContentKey, parseBundleDocument} from
    '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const workspaceFor = (id = 'half-adder', switches = Array(10).fill(0)) =>
    createWorkspace({program: getPreset(id).program, presetId: id, switches, controller: true});
const storage = initial => {
    const values = new Map(Object.entries(initial));
    return {
        get length () { return values.size; },
        key: index => [...values.keys()][index] ?? null,
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        dump: () => Object.fromEntries(values)
    };
};
const archive = async state => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify({targets: [{isStage: true, name: 'Stage', blocks: {},
        costumes: [], sounds: []}], meta: {semver: '3.0.0'}}));
    if (state !== undefined) zip.file(BUNDLE_PATH, JSON.stringify({format: BUNDLE_FORMAT,
        version: BUNDLE_VERSION, state}));
    return zip.generateAsync({type: 'nodebuffer'});
};
const withStorage = async (initial, run) => {
    const previous = Object.fromEntries(['localStorage', 'window', 'CustomEvent'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    globalThis.localStorage = storage(initial);
    globalThis.window = {dispatchEvent: () => {}};
    globalThis.CustomEvent = class { constructor (type, options) { this.type = type; this.detail = options?.detail; } };
    try { await run(globalThis.localStorage); } finally {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
};
const controller = (initial, panel = new ControllerPanel()) => {
    let workspace = initial;
    const events = [];
    const bridge = connectLogikusController(panel, {
        getWorkspace: () => workspace,
        onInputs: inputs => {
            events.push(inputs);
            workspace = createWorkspace({...workspace, switches: inputs.switches});
        }
    });
    return {panel, bridge, events, get workspace () { return workspace; },
        set workspace (next) { workspace = next; }};
};

test('workspace validation clones stable state, bounds input and excludes the held button', () => {
    const input = workspaceFor();
    const copy = validateWorkspace(input);
    assert.deepEqual(copy, input);
    copy.switches[0] = 1;
    copy.program.wires[0].from = 'L9';
    assert.equal(input.switches[0], 0);
    assert.notEqual(copy.program.wires[0].from, input.program.wires[0].from);
    for (const change of [{version: 2}, {format: 'different'}, {switches: [1]},
        {switches: Array(10).fill(true)}, {switches: Array(10)}, {controller: 'yes'},
        {presetId: 'x'.repeat(129)}, {presetId: 'bad\nname'}, {button: true}, {lamps: []},
        {program: {...input.program, wires: [{id: 'broken', from: 'Q', to: 'missing'}]}}]) {
        assert.throws(() => validateWorkspace({...input, ...change}));
    }
    assert.equal(Object.hasOwn(createWorkspace({...input, button: true}), 'button'), false);
});

test('the optional typed section validates before producing storage writes', () => {
    const workspace = workspaceFor();
    const raw = {[LOGIKUS_STORAGE_KEY]: JSON.stringify(workspace)};
    assert.equal(isContentKey(LOGIKUS_STORAGE_KEY), true);
    assert.equal(isContentKey('bw-logikus-help-dismissed'), false);
    assert.deepEqual(encodeProjectState(raw), {logikus: workspace});
    assert.deepEqual(decodeProjectState({logikus: workspace}), raw);
    const parsed = parseBundleDocument(JSON.stringify({format: BUNDLE_FORMAT, version: BUNDLE_VERSION,
        state: {logikus: workspace}}));
    assert.equal(parsed.outcome, 'loaded');
    assert.deepEqual(parsed.report.unknownSections, []);
    assert.throws(() => decodeProjectState({code: {lang: 'js', code: 'hello'},
        logikus: {...workspace, switches: [2]}}));
});

test('SB3 attach/extract preserves wiring, labels, switches and controller identity while releasing Test', async () => {
    const initial = workspaceFor('code-lock', [...'1011101101'].map(Number));
    initial.program.switchLabels[0] = 'First digit';
    const harness = controller(initial);
    const installed = harness.bridge.install(initial);
    harness.workspace = installed;
    harness.panel.setButtonInput('logikus_test', true);
    assert.equal(harness.panel.getValue('logikus_L0'), 1);
    const panelData = harness.panel.toJSON();
    assert.equal(panelData.widgets.find(widget => widget.name === 'logikus_test').config.pressed, false);
    const raw = {[LOGIKUS_STORAGE_KEY]: JSON.stringify(harness.workspace), 'bw-ctl-widgets': JSON.stringify(panelData)};
    await withStorage(raw, async store => {
        const saved = await attachBrickwrightState(new Blob([await archive()]),
            {now: () => new Date('2026-11-25T00:00:00.000Z')});
        const zip = await JSZip.loadAsync(await saved.arrayBuffer());
        const document = JSON.parse(await zip.file(BUNDLE_PATH).async('text'));
        assert.deepEqual(document.state.logikus, installed);
        assert.equal(Object.hasOwn(document.state.logikus, 'button'), false);
        assert.deepEqual(JSON.parse(await zip.file('project.json').async('text')).targets[0].blocks, {});
        store.setItem(LOGIKUS_STORAGE_KEY, JSON.stringify(workspaceFor()));
        const result = await extractBrickwrightState(await saved.arrayBuffer());
        assert.equal(result.outcome, 'loaded');
        assert.deepEqual(JSON.parse(store.getItem(LOGIKUS_STORAGE_KEY)), installed);
        const restored = controller(validateWorkspace(JSON.parse(store.getItem(LOGIKUS_STORAGE_KEY))),
            ControllerPanel.fromJSON(JSON.parse(store.getItem('bw-ctl-widgets'))));
        restored.bridge.sync(restored.workspace);
        assert.equal(restored.panel.getValue('logikus_S0'), 1);
        assert.equal(restored.panel.getWidget('logikus_S0').layout.label, 'First digit');
        assert.equal(restored.panel.getWidget('logikus_test').state.pressed, false);
        assert.equal(restored.panel.getValue('logikus_L0'), 0, 'a reopened project cannot keep Test held');
        restored.panel.setButtonInput('logikus_test', true);
        assert.equal(restored.panel.getValue('logikus_L0'), 1, 'restored controller still evaluates the saved wiring');
        restored.bridge.dispose();
    });
    harness.bridge.dispose();
});

test('malformed Logikus archive refuses all writes; legacy or absent sections clear stale state', async () => {
    const raw = {[LOGIKUS_STORAGE_KEY]: JSON.stringify(workspaceFor()),
        'bw-code-autosave': JSON.stringify({lang: 'js', code: 'keep me'}), 'bw-theme': 'dark'};
    await withStorage(raw, async store => {
        const bad = await archive({code: {lang: 'js', code: 'must not apply'},
            logikus: {...workspaceFor(), controller: 1}});
        assert.equal((await extractBrickwrightState(bad)).outcome, 'invalid');
        assert.deepEqual(store.dump(), raw, 'validation failure leaves the complete previous project alone');
        assert.equal((await extractBrickwrightState(await archive())).outcome, 'legacy');
        assert.deepEqual(store.dump(), {'bw-theme': 'dark'});
        store.setItem(LOGIKUS_STORAGE_KEY, raw[LOGIKUS_STORAGE_KEY]);
        assert.equal((await extractBrickwrightState(await archive({}))).outcome, 'loaded');
        assert.equal(store.getItem(LOGIKUS_STORAGE_KEY), null);
    });
});

test('install appends a complete panel once and preserves existing controls and custom layout', () => {
    const harness = controller(workspaceFor());
    harness.panel.addWidget('existing', 'slider', {min: -5, max: 5}, {x: 20, y: 50, w: 120, h: 80});
    harness.panel.bindToVariable('existing', 'motorSpeed');
    const original = structuredClone(harness.panel.getWidget('existing'));
    harness.bridge.install(harness.workspace);
    assert.equal(harness.panel.getWidgets().length, 22);
    assert.equal(harness.panel.mode, 'play');
    assert.deepEqual(harness.panel.getWidget('existing'), original);
    assert.ok(harness.panel.getWidget('logikus_L0').layout.y >= 154);
    assert.equal(harness.panel.getWidget('logikus_L0').config.segments, 1);
    harness.panel.setWidgetLayout('logikus_S0', {x: 900, y: 800});
    harness.panel.bindToVariable('logikus_S0', 'inputA');
    harness.bridge.install(harness.workspace);
    assert.equal(harness.panel.getWidgets().length, 22);
    assert.equal(harness.panel.getWidget('logikus_S0').layout.x, 900);
    assert.deepEqual(harness.panel.getWidget('logikus_S0').binding, {target: 'variable', variableName: 'inputA'});
    harness.bridge.dispose();
});

test('install checks every reserved name before touching the existing panel', () => {
    for (const [type, config] of [['bargraph', {}], ['button', {logikus: true}]]) {
        const harness = controller(workspaceFor());
        harness.panel.addWidget('logikus_L9', type, config, {x: 17, y: 29});
        const before = harness.panel.toJSON();
        assert.throws(() => harness.bridge.install(harness.workspace), /logikus_L9/);
        assert.deepEqual(harness.panel.toJSON(), before);
        harness.bridge.dispose();
    }
});

test('real controller inputs evaluate the circuit and are readable by the program extension', () => {
    const harness = controller(workspaceFor());
    harness.bridge.install(harness.workspace);
    const extension = new ControllerExtension();
    extension.setPanel(harness.panel);
    harness.panel.setSliderInput('logikus_S0', 1);
    assert.equal(extension.controllerValue({NAME: 'logikus_S0'}), 1);
    assert.equal(extension.controllerValue({NAME: 'logikus_L0'}), 1);
    assert.equal(extension.controllerValue({NAME: 'logikus_L1'}), 0);
    harness.panel.setSliderInput('logikus_S1', 1);
    assert.equal(extension.controllerValue({NAME: 'logikus_L0'}), 0);
    assert.equal(extension.controllerValue({NAME: 'logikus_L1'}), 1);
    assert.equal(harness.events.length, 2, 'lamp feedback cannot recurse into input callbacks');
    const emitted = [];
    harness.panel.addListener((kind, detail) => emitted.push([kind, detail]));
    harness.bridge.sync(harness.workspace);
    harness.bridge.sync(harness.workspace);
    assert.deepEqual(emitted, [], 'unchanged sync does not emit widget writes');
    harness.workspace.program.lampLabels[0] = 'Sum bit';
    harness.bridge.sync(harness.workspace);
    assert.equal(harness.panel.getWidget('logikus_L0').layout.label, 'Sum bit');
    assert.equal(harness.panel.getWidget('logikus_L0').config.label, 'Sum bit');
    harness.panel.addWidget('unrelated', 'button');
    harness.panel.setButtonInput('unrelated', true);
    assert.equal(harness.events.length, 2);
    harness.bridge.dispose();
});

test('momentary Test controls outputs, releases on edit mode or deletion, and dispose detaches', () => {
    const harness = controller(workspaceFor('code-lock', [...'1011101101'].map(Number)));
    harness.bridge.install(harness.workspace);
    harness.panel.setButtonInput('logikus_test', true);
    assert.equal(harness.panel.getValue('logikus_L0'), 1);
    harness.panel.setMode('edit');
    assert.equal(harness.panel.getWidget('logikus_test').state.pressed, false);
    assert.equal(harness.panel.getValue('logikus_L0'), 0);
    assert.equal(harness.events.at(-1).button, false);
    harness.panel.setMode('play');
    harness.panel.setButtonInput('logikus_test', true);
    harness.panel.removeWidget('logikus_test');
    assert.equal(harness.panel.getValue('logikus_L0'), 0);
    assert.equal(harness.events.at(-1).button, false);
    assert.equal(harness.panel.getWidget('logikus_test'), null, 'sync does not recreate a deleted button');
    harness.bridge.install(harness.workspace);
    harness.panel.setButtonInput('logikus_test', true);
    harness.bridge.dispose();
    assert.equal(harness.panel.getValue('logikus_L0'), 0);
    assert.equal(harness.panel.getWidget('logikus_test').state.pressed, false);
    const count = harness.events.length;
    harness.panel.setSliderInput('logikus_S0', 0);
    assert.equal(harness.events.length, count);
    harness.bridge.dispose();
});

test('a long-lived bridge synchronizes restored widgets without a mounted Lab or creating missing widgets', () => {
    const initial = workspaceFor('half-adder', [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    const original = controller(initial);
    original.bridge.install(initial);
    const saved = original.panel.toJSON();
    original.bridge.dispose();
    const restored = controller(initial);
    restored.bridge.sync(initial);
    assert.deepEqual(restored.panel.getWidgetNames(), [], 'controller:true is not permission to reconstruct a removed layout');
    for (const widget of saved.widgets) restored.panel.addWidget(widget.name, widget.type, widget.config, widget.layout);
    restored.panel.setMode('play');
    assert.equal(restored.panel.getValue('logikus_L1'), 1, 'the final added output receives its computed value');
    restored.panel.setSliderInput('logikus_S0', 0);
    assert.equal(restored.panel.getValue('logikus_L0'), 1);
    assert.equal(restored.panel.getValue('logikus_L1'), 0);
    assert.equal(restored.workspace.switches[0], 0);
    restored.bridge.dispose();
});
