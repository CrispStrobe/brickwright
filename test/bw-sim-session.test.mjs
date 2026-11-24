// SPDX-License-Identifier: BSD-3-Clause
/**
 * The Sim Lab session as the pane uses it, headless: the shipped reference
 * model (static/sim-lab/models/driving-base.ldr) is fetched the way the
 * browser fetches it, its LDraw closure is loaded from the vendored
 * static/ldraw/ through the same fetch, and SimSession drives it from the
 * virtual SPIKE hub.
 *
 *   - fetchLDrawClosure finds exactly the files flattenPart needs, with none missing;
 *   - prepareModel lists problems instead of throwing: an unknown part and a
 *     mirrored part come back as named issues while the rest compiles;
 *   - a session built from the shipped model drives forward under the S1
 *     motor commands and reads physical encoders;
 *   - a model with no hub still runs (it settles under gravity) and says why
 *     nothing moves.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchLDrawClosure} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-fetch.js';
import {flattenPart} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-geometry.js';
import {visualAssembly} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/visual-assemblies.js';
import {SimSession, prepareModel, catalogFrom, MODELS, MODELS_BASE} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import VirtualSpikeHubState from '../overlay/scratch-gui/src/lib/virtual-hub/spike-hub-state.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = path.join(ROOT, 'overlay/scratch-gui');
const CATALOG = catalogFrom(JSON.parse(readFileSync(path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json'), 'utf8')));

/** fetch() over the overlay's static folder, as the app serves it. */
const fetchImpl = async url => {
    const file = path.join(STATIC, url);
    if (!existsSync(file)) return {ok: false, status: 404, text: async () => ''};
    const text = readFileSync(file, 'latin1');
    return {ok: true, status: 200, text: async () => text};
};
const shippedModel = async () => (await fetchImpl(`${MODELS_BASE}${MODELS[0].file}`)).text();

test('the LDraw closure fetch finds exactly what the geometry reader needs', async () => {
    const parts = ['45601.dat', '54696p01.dat', '39367p01.dat'];
    const {read, files, missing} = await fetchLDrawClosure(parts, {fetchImpl});
    assert.deepEqual(missing, []);
    // The renderer loads the original device and its complete visual assembly.
    assert.equal(visualAssembly('45601.dat'), '45601c01.dat');
    const needed = new Set(parts.flatMap(p => [p, visualAssembly(p)].flatMap(name => flattenPart(name, read).files)));
    assert.deepEqual([...files.keys()].sort(), [...needed].sort());
});

test('prepareModel lists problems instead of throwing', () => {
    const text = [
        '1 71 0 0 0 1 0 0 0 1 0 0 0 1 45601.dat',
        '1 4 0 0 0 1 0 0 0 1 0 0 0 1 not-a-part.dat',
        '1 4 0 0 0 0 0 0 0 1 0 0 0 1 32524.dat' // flat: a mirrored or stretched line is decoration now
    ].join('\n');
    const {mechanism, issues} = prepareModel(text, CATALOG);
    assert.ok(mechanism, 'the hub alone still compiles');
    const codes = issues.map(i => i.code);
    for (const code of ['unknown-part', 'bad-matrix', 'no-motor']) assert.ok(codes.includes(code), `${code} in ${codes}`);
});

test('an empty model is an error, not a crash', () => {
    const {mechanism, issues} = prepareModel('0 nothing here\n', CATALOG);
    assert.equal(mechanism, null);
    assert.equal(issues.at(-1).code, 'empty-model');
});

test('the shipped driving base drives from the virtual hub', async () => {
    const hubState = new VirtualSpikeHubState();
    const {session, issues} = await SimSession.fromText(await shippedModel(), {hubState, catalog: CATALOG});
    assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
    const hubBody = session.bridge.hubBody;
    const start = session.core.bodyPose(hubBody).position;
    const viewAtStart = session.viewSnapshot();
    const initialPoses = viewAtStart.bodies.slice();
    assert.equal(session.viewSnapshot(), viewAtStart, 'view consumers share the current snapshot');
    assert.notEqual(session.snapshot().bodies, viewAtStart.bodies, 'ordinary snapshots remain independent');
    let viewAfterStep;
    const unsubscribe = session.onAdvance(() => { viewAfterStep = session.viewSnapshot(); });
    hubState.motors.runAtSpeed('A', -555);
    hubState.motors.runAtSpeed('B', 555);
    for (let t = 0; t < 2000; t += 16) session.tick(16);
    unsubscribe();
    const end = session.core.bodyPose(hubBody).position;
    assert.equal(viewAfterStep, session.viewSnapshot(), 'advance listeners can share the new snapshot with the renderer');
    assert.notEqual(viewAfterStep, viewAtStart);
    assert.deepEqual(viewAfterStep.bodies, session.snapshot().bodies);
    assert.deepEqual(viewAtStart.bodies, initialPoses, 'retained snapshots keep their original poses for replay');
    assert.ok(end[2] - start[2] < -0.3, `moved ${(end[2] - start[2]).toFixed(3)} m along z`);
    assert.ok(hubState.data.motors[1].position > 600, `B encoder ${hubState.data.motors[1].position}`);
    session.dispose();
});

test('a model without a hub settles and says nothing will move', async () => {
    const hubState = new VirtualSpikeHubState();
    const {session, issues} = await SimSession.fromText('1 71 0 -200 0 1 0 0 0 1 0 0 0 1 32524.dat\n', {hubState, catalog: CATALOG});
    assert.equal(session.bridge, null);
    assert.ok(issues.some(i => i.code === 'no-motor'));
    session.tick(1000);
    session.dispose();
});

test('a mat with a start pose puts the drive axle on it, facing along the line', async () => {
    const {createMat} = await import('../overlay/scratch-gui/src/lib/bw-sim/world/mats.js');
    const text = await shippedModel();
    const {model, runModel, mechanism} = prepareModel(text, CATALOG, {mat: 'line-oval'});
    const start = createMat('line-oval').startPose;
    assert.equal(mechanism.bodies.find(b => b.id === 'ground').mat, 'line-oval', 'the floor carries the mat');
    const hinges = mechanism.joints.filter(j => j.motor);
    const mid = [0, 2].map(i => (hinges[0].point[i] + hinges[1].point[i]) / 2);
    assert.ok(Math.hypot(mid[0] - start.x, mid[1] - start.z) < 1e-6, `drive axle midpoint ${mid} vs start ${start.x},${start.z}`);
    // Forward (LDraw +z of the authored model) now points along the start heading (+x): the axle runs across it, along z.
    assert.ok(Math.abs(Math.abs(hinges[0].axis[2]) - 1) < 1e-9, `axle along world z: ${hinges[0].axis}`);
    assert.notDeepEqual(runModel.parts[0].position, model.parts[0].position, 'the run model moved');
    assert.deepEqual(prepareModel(text, CATALOG).model, model, 'the authored model is untouched (what Build edits and the project saves)');
});


test('cold Axis Plotter closure resolves every primitive directly without speculative 404s', async () => {
    const asked = [], failures = [];
    const fetch = async url => { asked.push(url); const r = await fetchImpl(url); if (!r.ok) failures.push(url); return r; };
    const text = readFileSync(path.join(STATIC, 'static/sim-lab/models/axis-plotter.ldr'), 'utf8');
    const model = prepareModel(text, CATALOG).model;
    const closure = await fetchLDrawClosure(model.parts.map(p => p.part), {fetchImpl: fetch, withConfig: true, fallback: null});
    assert.deepEqual(closure.missing, []);
    assert.deepEqual(failures, [], 'the shipped lock resolves parts/ versus p/ without failed probes');
    assert.ok(asked.includes('static/ldraw/ldraw-lock.json'));
    for (const part of model.parts) assert.ok(flattenPart(part.part, closure.read).files.length);
});
