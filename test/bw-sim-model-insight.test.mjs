// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Making a Robot Lab model understandable (mech/insight.js, the pane's
// sim-lab-insight-text.js): every issue code the model reader, the compiler and
// the session can produce has a child's sentence in English and German; issues
// name the parts they are about, so the pane can show them; the body tints tell
// apart what moves separately and agree on what moves together; the hinge-axis
// overlay is the compiled joints, in world metres; gear pairs carry their tooth
// ratio; and compiling a ~70-part model for the Build overlay is quick.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareModel, catalogFrom} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {parseModel, serializeModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {compile} from '../overlay/scratch-gui/src/lib/bw-sim/mech/compile.js';
import {
    AXIS_HALF_LENGTH_M, bodyTints, gearOverlay, jointOverlay, modelInsight, partBodyMap, portItems, runBlockers
} from '../overlay/scratch-gui/src/lib/bw-sim/mech/insight.js';
import {LDU_M, lduToWorld} from '../overlay/scratch-gui/src/lib/bw-sim/contracts.js';
import {INSIGHT_TEXT, issueSentence} from '../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-insight-text.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM = path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-sim');
const CATALOG = catalogFrom(JSON.parse(readFileSync(path.join(SIM, 'part-meta/parts.json'), 'utf8')));
const DRIVING_BASE = readFileSync(path.join(ROOT, 'overlay/scratch-gui/static/sim-lab/models/driving-base.ldr'), 'utf8');
const gearFixture = name => JSON.parse(readFileSync(path.join(ROOT, `test/fixtures/bw-sim/gears/${name}.json`), 'utf8'));

/** Every `code: '…'` an issue producer writes, read from the sources (not from a list kept here). */
const producedCodes = () => {
    const files = [
        // kinds/: the coupling detectors write diagnostics too (worm, rack); world/: the world objects.
        ...['mech', 'model', 'kinds', 'world'].flatMap(dir => readdirSync(path.join(SIM, dir)).filter(f => f.endsWith('.js')).map(f => path.join(SIM, dir, f))),
        path.join(SIM, 'sim-session.js')
    ];
    const codes = new Map(); // code -> files
    for (const file of files) {
        for (const m of readFileSync(file, 'utf8').matchAll(/\bcode(?::|\s*=)\s*'([a-z][a-z-]*)'/g)) {
            codes.set(m[1], [...(codes.get(m[1]) || []), path.relative(SIM, file)]);
        }
        // A computed code (`const code = cond ? 'a' : 'b'`) names its choices in one expression.
        for (const m of readFileSync(file, 'utf8').matchAll(/\bconst code = [^;]*;/g)) {
            for (const c of m[0].matchAll(/'([a-z][a-z-]*)'/g)) codes.set(c[1], [...(codes.get(c[1]) || []), path.relative(SIM, file)]);
        }
    }
    return codes;
};

test('every issue code in the sources has a child\'s sentence in English and German', () => {
    const codes = producedCodes();
    // The scan works: it finds codes from the compiler, the gear pass, the reader and the session.
    for (const known of ['motor-without-port', 'gear-on-frame', 'loose-part', 'bad-matrix', 'no-motor', 'empty-model', 'falls-apart']) {
        assert.ok(codes.has(known), `the source scan did not find '${known}': ${[...codes.keys()].join(', ')}`);
    }
    assert.ok(codes.size >= 20, `only ${codes.size} codes found`);
    for (const locale of ['en', 'de']) {
        const missing = [...codes.keys()].filter(c => !INSIGHT_TEXT[locale].issues[c]);
        assert.deepEqual(missing, [], `${locale}: no sentence for ${missing.map(c => `${c} (${codes.get(c).join(', ')})`).join('; ')}`);
    }
    for (const code of codes.keys()) {
        const en = INSIGHT_TEXT.en.issues[code];
        const de = INSIGHT_TEXT.de.issues[code];
        assert.notEqual(en, de, `${code}: the German sentence is a copy of the English one`);
        // Same placeholders in both languages, so neither drops the part names or the line.
        const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
        assert.deepEqual(holes(de), holes(en), `${code}: placeholders differ`);
        // No technical code leaks into a sentence for children.
        assert.doesNotMatch(en, /[a-z]+-[a-z]+-[a-z]+/, `${code}: '${en}'`);
    }
    // Every table entry is a code something produces: a renamed code leaves no dead sentence behind.
    const stale = Object.keys(INSIGHT_TEXT.en.issues).filter(c => !codes.has(c));
    assert.deepEqual(stale, [], 'sentences for codes nothing produces');
});

test('invalid solver preset identifies the line and remedy in both languages', () => {
    const issue = {code: 'bad-solver-preset', line: 12};
    assert.match(issueSentence(INSIGHT_TEXT.en, issue, () => ''), /line 12.*light-links/);
    assert.match(issueSentence(INSIGHT_TEXT.de, issue, () => ''), /Zeile 12.*light-links/);
});

test('a motor with no port in its file is plugged into a free port, and the note says so (hubs/auto-ports.js)', () => {
    // The shipped driving base with motor A's port line taken out, as a file from elsewhere (not ours: no
    // `0 Author: Brickwright`): A is free, so motorL goes there — in the model, so Build shows it.
    const unplugged = DRIVING_BASE.replace(/0 !BW PORT A\r?\n(1 [^\n]*54696p01\.dat)/, '$1').replace(/^0 Author: Brickwright\r?\n/m, '');
    assert.notEqual(unplugged, DRIVING_BASE, 'the port line was removed');
    const auto = prepareModel(unplugged, CATALOG);
    assert.equal(auto.model.parts.find(p => p.id === 'motorL').port, 'A', 'plugged into A, in the model');
    assert.equal(auto.runModel.parts.find(p => p.id === 'motorL').port, 'A', 'and in the run model');
    // Our own file (the builder took the port out in Build): it stays out.
    const own = prepareModel(DRIVING_BASE.replace(/0 !BW PORT A\r?\n(1 [^\n]*54696p01\.dat)/, '$1'), CATALOG);
    assert.equal(own.model.parts.find(p => p.id === 'motorL').port, undefined, 'a port taken out in Build stays out');
    const note = auto.issues.find(i => i.code === 'ports-plugged');
    assert.deepEqual([note.severity, note.parts], ['info', ['motorL']]);
    assert.equal(auto.mechanism.joints.filter(j => j.motor).length, 2, 'both motors drive');
    assert.match(issueSentence(INSIGHT_TEXT.en, note, () => 'SPIKE medium angular motor'), /plugged into the hub's free ports/);
});

test('a motor without a port: the issue names it, the sentence says so, Run is warned', () => {
    // The shipped driving base with motor A's port line taken out, opened as written (no ports plugged in for it).
    const text = DRIVING_BASE.replace(/0 !BW PORT A\r?\n(1 [^\n]*54696p01\.dat)/, '$1');
    const {model, mechanism, issues} = prepareModel(text, CATALOG, {autoPorts: false});
    const motorL = model.parts.find(p => p.id === 'motorL');
    assert.equal(motorL.port, undefined, 'motorL has no port now');
    const issue = issues.find(i => i.code === 'motor-without-port');
    assert.ok(issue, JSON.stringify(issues));
    assert.deepEqual(issue.parts, ['motorL']);
    const name = id => {
        const pl = model.parts.find(p => p.id === id);
        return CATALOG.get(pl.part).name;
    };
    assert.match(issueSentence(INSIGHT_TEXT.en, issue, name), /^SPIKE medium angular motor is not plugged into the hub yet/);
    assert.match(issueSentence(INSIGHT_TEXT.de, issue, id => CATALOG.get(model.parts.find(p => p.id === id).part).nameDe || name(id)),
        /steckt noch nicht im Hub/);
    // One motor is still on B: the robot can move, so this is not a blocker, but the port badge shows "?".
    assert.equal(mechanism.joints.filter(j => j.motor).length, 1);
    assert.deepEqual(runBlockers(issues, model, CATALOG), []);
    const items = portItems(model, CATALOG);
    const ports = Object.fromEntries(items.map(p => [p.id, p.port]));
    assert.deepEqual(ports, {motorL: null, motorR: 'B'});
    // The plugged-in motor's cable goes to the model's hub; the unplugged one has none.
    const hub = model.parts.find(p => CATALOG.get(p.part).hubProfile).id;
    assert.deepEqual(Object.fromEntries(items.map(p => [p.id, p.hub])), {motorL: null, motorR: hub});

    // Both ports gone: nothing can move by itself, and Run is warned, naming both motors.
    const none = text.replace(/0 !BW PORT B\r?\n/, '');
    const both = prepareModel(none, CATALOG, {autoPorts: false});
    const blockers = runBlockers(both.issues, both.model, CATALOG);
    assert.deepEqual(blockers.map(b => b.code), ['no-motor']);
    assert.deepEqual(blockers[0].parts.slice().sort(), ['motorL', 'motorR']);
});

test('gear-on-frame (the 8-24 gearbox with its beam moved onto the motor output) names both gears', () => {
    // test/fixtures/bw-sim/gears/8-24.json holds the 24T's axle in a beam pinned to the motor
    // HOUSING (a working gearbox). Pin that beam to the motor's turning OUTPUT instead (its pin
    // holes out2/out3, the beam level with the 8T) and the 8T is fixed to the frame the 24T turns in.
    const AX = [0, 1, 0, 1, 0, 0, 0, 0, -1];
    const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const fixture = gearFixture('8-24');
    const clean = compile(fixture, CATALOG, {ground: false});
    assert.ok(!clean.diagnostics.some(d => d.code === 'gear-on-frame'), 'the fixture as shipped works');
    const moved = {version: 1, parts: fixture.parts.map(p => {
        if (p.id === 'beam') return {...p, position: [0, -40, 0], rotation: I3};
        if (p.id === 'pin1') return {...p, position: [0, -40, 20], rotation: AX};
        if (p.id === 'pin2') return {...p, position: [0, -40, -20], rotation: AX};
        if (p.id === 'a8') return {...p, part: '3705.dat', position: [0, -40, 0]};
        if (p.id === 'g8') return {...p, position: [0, -40, 0]};
        if (p.id === 'a24') return {...p, part: '3705.dat', position: [0, -40, 40]};
        if (p.id === 'g24') return {...p, position: [0, -40, 40]};
        return p;
    })};
    const text = serializeModel(moved, {name: 'gear-on-frame.ldr'});
    const {model, issues, mechanism} = prepareModel(text, CATALOG);
    const lock = issues.filter(i => i.code === 'gear-on-frame');
    assert.equal(lock.length, 1, JSON.stringify(issues.map(i => i.code)));
    assert.deepEqual(lock[0].parts.slice().sort(), ['g24', 'g8']);
    for (const id of lock[0].parts) assert.ok(model.parts.some(p => p.id === id), `${id} is a part of the model`);
    assert.deepEqual(gearOverlay(mechanism, model, CATALOG), [], 'a locked pair is not drawn as a coupling');
    const en = issueSentence(INSIGHT_TEXT.en, lock[0], id => CATALOG.get(model.parts.find(p => p.id === id).part).name);
    assert.match(en, /Technic gear (8|24) tooth and Technic gear (8|24) tooth are stuck/);
});

test('a loose part is named; a model that falls apart blocks Run', () => {
    const {model} = parseModel(DRIVING_BASE, {catalog: CATALOG});
    // A beam lying on the floor 40 cm away, touching nothing.
    const stray = {id: 'stray', part: '32524.dat', color: 71, position: [1000, 0, 0], rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1]};
    const one = prepareModel(serializeModel({...model, parts: [...model.parts, stray]}), CATALOG);
    const loose = one.issues.filter(i => i.code === 'loose-part');
    assert.equal(loose.length, 1, JSON.stringify(one.issues));
    assert.deepEqual(loose[0].parts, ['stray']);
    assert.deepEqual(runBlockers(one.issues, one.model, CATALOG), [], 'one stray beam on a 14-part robot does not stop a run');
    // The robot as shipped has no loose part.
    assert.ok(!prepareModel(DRIVING_BASE, CATALOG).issues.some(i => i.code === 'loose-part'));

    // Two separate strays: the model falls apart, Run is warned and the parts are named.
    const stray2 = {...stray, id: 'stray2', position: [-1000, 0, 0]};
    const two = prepareModel(serializeModel({...model, parts: [...model.parts, stray, stray2]}), CATALOG);
    const blockers = runBlockers(two.issues, two.model, CATALOG);
    assert.deepEqual(blockers.map(b => b.code), ['falls-apart']);
    assert.deepEqual(blockers[0].parts.slice().sort(), ['stray', 'stray2']);

    // The hub's own body is the robot: taking out the two 3L pins (through hub, front beam and castor)
    // leaves the front beam and the castor assembly loose, not the hub.
    const unpinned = model.parts.filter(p => !['frontPin1', 'frontPin2'].includes(p.id));
    const castorOff = prepareModel(serializeModel({...model, parts: unpinned}), CATALOG);
    const off = castorOff.issues.filter(i => i.code === 'loose-part');
    assert.deepEqual(off.map(i => i.parts.slice().sort()).sort(), [['ball', 'castor'], ['frontBeam']], JSON.stringify(castorOff.issues));
});

test('body tints: the S1 driving base\'s hub body and its wheels differ; parts in one body share one tint', () => {
    const {mechanism} = prepareModel(DRIVING_BASE, CATALOG);
    const {bodies, parts} = bodyTints(mechanism);
    const bodyOf = partBodyMap(mechanism);
    // Distinct bodies, distinct colours (the model's own bodies; the ground is not tinted).
    const own = mechanism.bodies.filter(b => b.id !== 'ground');
    assert.equal(bodies.size, own.length);
    assert.equal(new Set(bodies.values()).size, own.length, `colours ${[...bodies.values()]}`);
    for (const c of bodies.values()) assert.match(c, /^#[0-9a-f]{6}$/);
    // The hub, the front beam and the castor beam are pinned together: one body, one tint.
    assert.equal(parts.get('hub'), parts.get('frontBeam'));
    assert.equal(parts.get('hub'), parts.get('castor'));
    // Each wheel turns with its axle, on its own: one tint each, not the hub's, not each other's.
    assert.equal(parts.get('wheelL'), parts.get('axleL'));
    assert.equal(parts.get('wheelR'), parts.get('axleR'));
    assert.notEqual(parts.get('wheelL'), parts.get('hub'));
    assert.notEqual(parts.get('wheelR'), parts.get('hub'));
    assert.notEqual(parts.get('wheelL'), parts.get('wheelR'));
    // A motor is drawn with its housing, which is bolted to the hub.
    assert.equal(parts.get('motorL'), parts.get('hub'));
    // Every part gets the tint of the body that carries it.
    for (const [pid, bid] of bodyOf) {
        assert.ok(mechanism.bodies.find(b => b.id === bid).parts.includes(pid));
        assert.equal(parts.get(pid), bodies.get(bid));
    }
    // More bodies than the hand-picked pastels still get distinct colours.
    const many = {bodies: Array.from({length: 40}, (_, i) => ({id: `b${i}`, parts: [`p${i}`]})), joints: []};
    assert.equal(new Set(bodyTints(many).bodies.values()).size, 40);
});

test('the hinge-axis overlay is the compiled joints, in world metres', () => {
    const {model, mechanism} = prepareModel(DRIVING_BASE, CATALOG);
    const overlay = jointOverlay(mechanism);
    assert.equal(overlay.length, mechanism.joints.length);
    for (const [i, j] of mechanism.joints.entries()) {
        const o = overlay[i];
        assert.equal(o.id, j.id);
        assert.equal(o.motor, Boolean(j.motor));
        assert.equal(o.body1, j.body1);
        if (j.type !== 'hinge') {
            assert.equal(o.from, null);
            assert.deepEqual(o.point, j.point);
            continue;
        }
        // Centred on the hinge point, along the hinge axis, AXIS_HALF_LENGTH_M each way.
        for (let k = 0; k < 3; k++) {
            assert.ok(Math.abs((o.from[k] + o.to[k]) / 2 - j.point[k]) < 1e-12);
            assert.ok(Math.abs((o.to[k] - o.from[k]) - 2 * AXIS_HALF_LENGTH_M * j.axis[k]) < 1e-12);
        }
    }
    // Independently of the compiler: the two motor axes run through the wheel centres the model
    // places (wheel origins at x = ±170 LDU on the axles), i.e. along world x, 80 LDU behind the hub.
    const motorAxes = overlay.filter(o => o.motor);
    assert.deepEqual(motorAxes.map(o => o.port).sort(), ['A', 'B']);
    for (const o of motorAxes) {
        const wheel = model.parts.find(p => p.id === (o.port === 'A' ? 'wheelL' : 'wheelR'));
        const w = lduToWorld(wheel.position);
        const d = o.to.map((v, k) => v - o.from[k]);
        const len = Math.hypot(...d);
        const u = d.map(v => v / len);
        const rel = w.map((v, k) => v - o.from[k]);
        const along = rel.reduce((s, v, k) => s + v * u[k], 0);
        const perp = Math.hypot(...rel.map((v, k) => v - along * u[k]));
        assert.ok(perp < 0.5 * LDU_M, `${o.port}: the wheel centre is ${(perp * 1000).toFixed(2)} mm off the drawn axis`);
        assert.ok(Math.abs(Math.abs(u[0]) - 1) < 1e-9, `${o.port}: the drive axis is world x`);
    }
    // The castor ball is a ball joint: a point, no axis.
    assert.equal(overlay.filter(o => o.type === 'ball').length, 1);
});

test('gear pairs: the working 8-24 gearbox draws one coupling, centre to centre, "1:3"', () => {
    const fixture = gearFixture('8-24');
    const mechanism = compile(fixture, CATALOG, {ground: false});
    const gears = gearOverlay(mechanism, fixture, CATALOG);
    assert.equal(gears.length, 1);
    const g = gears[0];
    assert.deepEqual(g.parts.slice().sort(), ['g24', 'g8']);
    assert.equal(g.text, g.parts[0] === 'g8' ? '1:3' : '3:1');
    // The ratio text agrees with the coupling the physics uses: |ω2/ω1| = 8/24.
    const [n1, n2] = g.text.split(':').map(Number);
    assert.ok(Math.abs(Math.abs(g.ratio) - n1 / n2) < 1e-9, `ratio ${g.ratio} vs ${g.text}`);
    // Ends at the gears' centres: the fixture puts both at y = -60 LDU, 40 LDU apart (8T at x 0, 24T at x 40).
    const at = id => (g.parts[0] === id ? g.from : g.to);
    assert.deepEqual(at('g8').map(v => +v.toFixed(9)), lduToWorld([0, -60, 0]).map(v => +v.toFixed(9)));
    assert.deepEqual(at('g24').map(v => +v.toFixed(9)), lduToWorld([40, -60, 0]).map(v => +v.toFixed(9)));
    // Each end rides on its gear's body.
    const bodyOf = partBodyMap(mechanism);
    assert.deepEqual(g.bodies, g.parts.map(id => bodyOf.get(id)));
    // A bevel pair says its own ratio.
    const bevel = gearFixture('bevel-12-20');
    const bev = gearOverlay(compile(bevel, CATALOG, {ground: false}), bevel, CATALOG);
    assert.equal(bev.length, 1);
    assert.ok(['3:5', '5:3'].includes(bev[0].text), bev[0].text);
});

test('the Build overlay compile is quick on a ~70-part model', t => {
    // Four driving bases side by side plus a few loose beams: 64 parts, every kind of joint.
    const {model} = parseModel(DRIVING_BASE, {catalog: CATALOG});
    const parts = [];
    for (let k = 0; k < 4; k++) {
        for (const p of model.parts) parts.push({...p, id: `${p.id}_${k}`, position: [p.position[0] + k * 600, p.position[1], p.position[2]]});
    }
    for (let k = 0; k < 8; k++) parts.push({id: `beam_${k}`, part: '32524.dat', color: 71, position: [k * 200, 0, 600], rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1]});
    const big = {version: 1, parts};
    assert.equal(big.parts.length, 64);
    modelInsight(big, CATALOG); // warm up the JIT
    const runs = [];
    let result;
    for (let k = 0; k < 5; k++) {
        result = modelInsight(big, CATALOG);
        runs.push(result.ms);
    }
    runs.sort((a, b) => a - b);
    const median = runs[2];
    t.diagnostic(`modelInsight on ${big.parts.length} parts: median ${median.toFixed(1)} ms (runs ${runs.map(r => r.toFixed(1)).join(', ')})`);
    // What it found is the four robots: 4 bodies with a hub each → the strays and three robots are loose.
    assert.equal(result.joints.filter(j => j.motor).length, 8);
    assert.equal(result.ports.length, 8);
    assert.equal(result.issues.filter(i => i.code === 'loose-part').length, 3 + 8);
    // A debounced recompile after an edit must not be felt: well under a frame budget of a few frames.
    assert.ok(median < 250, `compiling ${big.parts.length} parts took ${median.toFixed(1)} ms`);
});


test('rigid assembly notes group repeated names and distinguish other moving joints in EN/DE', () => {
    const issue = {code: 'locked-hinges', parts: ['a','b','c','d','table']};
    const en = issueSentence(INSIGHT_TEXT.en, issue, id => id === 'table' ? 'turntable bottom' : 'free pin');
    assert.match(en, /4 × free pin and turntable bottom/);
    assert.match(en, /this assembly rigid.*other joints can still turn/);
    const de = issueSentence(INSIGHT_TEXT.de, issue, id => id === 'table' ? 'Drehteller unten' : 'Pin');
    assert.match(de, /4 × Pin/); assert.match(de, /andere Gelenke können sich weiter drehen/);
});
