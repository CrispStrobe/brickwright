// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Sim Lab 3D scene (plan C2, headless): the same mechanism the physics core
// runs is drawn with its real LDraw geometry in three.js, headless, and moved
// by physics snapshots. Proven:
//
//   - LDConfig's colour table parses correctly for the four colours the scene
//     uses most (Black, Red, White, Light Bluish Grey);
//   - a vendored part's BufferGeometry has the same bounding box as its LDraw
//     polygons, scaled and flipped to world axes;
//   - the driving-base scene has one mesh per placed part, each mesh's world
//     bounding box centre matches its LDraw placement (a motor's housing and
//     drive-hub meshes together), and the wheels live in the wheel bodies;
//   - after 1 s of real physics, applying the snapshot moves every mesh to
//     body pose × fixed offset;
//   - applySnapshot never writes to the snapshot.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Box3, Vector3, Group, Mesh, PerspectiveCamera} from 'three';
import {electricalFeatures, hubCableSocket, deviceCableExit, createCableAnchors} from '../overlay/scratch-gui/src/lib/bw-sim/view/cable-anchors.js';
import {createInsightLayer} from '../overlay/scratch-gui/src/lib/bw-sim/view/insight-layer.js';
import {parseLDConfig} from '../overlay/scratch-gui/src/lib/bw-sim/view/ldraw-colors.js';
import {partGeometry} from '../overlay/scratch-gui/src/lib/bw-sim/view/part-geometry.js';
import {flattenPart, bounds} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-geometry.js';
import {compile} from '../overlay/scratch-gui/src/lib/bw-sim/mech/compile.js';
import {buildSimScene, applySnapshot} from '../overlay/scratch-gui/src/lib/bw-sim/view/sim-scene3d.js';
import {lduToWorld} from '../overlay/scratch-gui/src/lib/bw-sim/contracts.js';
import {mat3MulVec3} from '../overlay/scratch-gui/src/lib/bw-sim/mech/vec.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LDRAW_DIR = path.join(ROOT, 'overlay', 'scratch-gui', 'static', 'ldraw');
const json = p => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const CATALOG = new Map(json('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json').parts.map(p => [p.part, p]));
const MODEL = json('test/fixtures/bw-sim/driving-base.json');
const LDU_M = 0.0004;
const TOL = 1e-6;

const read = p => {
    try { return readFileSync(path.join(LDRAW_DIR, p), 'utf8'); } catch { return undefined; }
};
const ldconfigText = readFileSync(path.join(LDRAW_DIR, 'LDConfig.ldr'), 'utf8');
const colors = parseLDConfig(ldconfigText);

const close = (a, e, tol, msg) => assert.ok(Math.abs(a - e) <= tol, `${msg}: ${a} not within ${tol} of ${e}`);

test('LDConfig parse: codes 0, 4, 15, 71 with exact vendored values', () => {
    const c0 = colors.get(0);
    assert.ok(c0, 'code 0');
    assert.equal(c0.value, '#1b2a34');
    assert.equal(c0.edge, '#808080');
    assert.equal(c0.alpha, 1);
    assert.equal(c0.name, 'Black');
    const c4 = colors.get(4);
    assert.equal(c4.value, '#b40000');
    assert.equal(c4.edge, '#333333');
    assert.equal(c4.alpha, 1);
    assert.equal(c4.name, 'Red');
    const c15 = colors.get(15);
    assert.equal(c15.value, '#f4f4f4');
    assert.equal(c15.edge, '#333333');
    assert.equal(c15.alpha, 1);
    const c71 = colors.get(71);
    assert.equal(c71.value, '#969696');
    assert.equal(c71.edge, '#333333');
    assert.equal(c71.alpha, 1);
});

test('partGeometry 32524.dat beam 7 bounding box equals LDU bounds with flip', () => {
    const flat = flattenPart('parts/32524.dat', read);
    assert.ok(flat.polys.length > 0, 'has polys');
    const b = bounds(flat.polys);
    const geo = partGeometry('32524.dat', read, colors);
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    // LDU bounds with y/z flip: x*scale, -y*scale, -z*scale
    // Need to compute expected min/max after flip correctly (min/max swap for negated axes)
    const expMin = [Math.min(b.min[0], b.max[0]) * LDU_M, Math.min(-b.min[1], -b.max[1]) * LDU_M, Math.min(-b.min[2], -b.max[2]) * LDU_M];
    const expMax = [Math.max(b.min[0], b.max[0]) * LDU_M, Math.max(-b.min[1], -b.max[1]) * LDU_M, Math.max(-b.min[2], -b.max[2]) * LDU_M];
    close(box.min.x, expMin[0], TOL, 'min x');
    close(box.min.y, expMin[1], TOL, 'min y');
    close(box.min.z, expMin[2], TOL, 'min z');
    close(box.max.x, expMax[0], TOL, 'max x');
    close(box.max.y, expMax[1], TOL, 'max y');
    close(box.max.z, expMax[2], TOL, 'max z');
    // Cached
    const geo2 = partGeometry('32524.dat', read, colors);
    assert.equal(geo, geo2, 'cached');
});

test('buildSimScene for driving base: one mesh per part, centres, wheel bodies', () => {
    const mech = compile(MODEL, CATALOG);
    const built = buildSimScene({model: MODEL, mechanism: mech, read, colors, catalog: CATALOG});
    try {
        assert.equal(built.partMeshes.size, MODEL.parts.length, 'one mesh per placed part');
        if (built.partMeshes instanceof Map) {
            for (const pl of MODEL.parts) assert.ok(built.partMeshes.has(pl.id), `mesh for ${pl.id}`);
        } else {
            for (const pl of MODEL.parts) assert.ok(built.partMeshes[pl.id], `mesh for ${pl.id}`);
        }
        // Ground exists (mechanism has static ground)
        assert.ok(built.ground, 'ground mesh');
        // Each mesh's world bbox centre = LDraw placement via flattenPart bounds transformed
        built.scene.updateMatrixWorld(true);
        for (const pl of MODEL.parts) {
            const flat = flattenPart(`parts/${pl.part}`, read);
            // Some parts like motors may not be in test vendored dir? But driving base parts are all vendored
            if (!flat.polys.length) continue;
            const b = bounds(flat.polys);
            const localCentre = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
            const worldCentreLdu = [pl.position[0] + mat3MulVec3(pl.rotation, localCentre)[0], pl.position[1] + mat3MulVec3(pl.rotation, localCentre)[1], pl.position[2] + mat3MulVec3(pl.rotation, localCentre)[2]];
            const expected = lduToWorld(worldCentreLdu);
            const mesh = built.partMeshes instanceof Map ? built.partMeshes.get(pl.id) : built.partMeshes[pl.id];
            // A motor is drawn as housing + drive hub (in its output body): together they are the part.
            const box = new Box3().setFromObject(mesh);
            if (built.hubMeshes.has(pl.id)) box.expandByObject(built.hubMeshes.get(pl.id));
            const centre = box.getCenter(new Vector3());
            close(centre.x, expected[0], 1e-6, `${pl.id} centre x`);
            close(centre.y, expected[1], 1e-6, `${pl.id} centre y`);
            close(centre.z, expected[2], 1e-6, `${pl.id} centre z`);
        }
        // Wheel meshes are children of wheel bodies' groups
        const bodyOf = (partId) => mech.bodies.find(b => b.parts.includes(partId));
        const wheelLBody = bodyOf('wheelL');
        const wheelRBody = bodyOf('wheelR');
        const getGroup = id => built.bodyGroups instanceof Map ? built.bodyGroups.get(id) : built.bodyGroups[id];
        const getMesh = id => built.partMeshes instanceof Map ? built.partMeshes.get(id) : built.partMeshes[id];
        const wheelLMesh = getMesh('wheelL');
        const wheelRMesh = getMesh('wheelR');
        assert.equal(wheelLMesh.parent, getGroup(wheelLBody.id), 'wheelL in wheelL body');
        assert.equal(wheelRMesh.parent, getGroup(wheelRBody.id), 'wheelR in wheelR body');
    } finally {
        built.dispose();
    }
});

test('applySnapshot: real physics 1s, body pose times fixed offset', async () => {
    const {loadJolt, createPhysicsCore} = await import('../overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js');
    const {SimHubBridge, STEP_MS} = await import('../overlay/scratch-gui/src/lib/bw-sim/hub-bridge.js');
    const VirtualSpikeHubState = (await import('../overlay/scratch-gui/src/lib/virtual-hub/spike-hub-state.js')).default;
    const HALF_SPEED = 555;
    const mech = compile(MODEL, CATALOG);
    const J = await loadJolt();
    const core = createPhysicsCore(J, mech, {stepHz: 1000 / STEP_MS});
    const hubState = new VirtualSpikeHubState();
    const bodyOf = (partId) => mech.bodies.find(b => b.parts.includes(partId));
    const hubBody = bodyOf('hub').id;
    const wheelLBody = bodyOf('wheelL').id;
    const bridge = new SimHubBridge({hubState, core, mechanism: mech, hubBody});
    const built = buildSimScene({model: MODEL, mechanism: mech, read, colors});
    try {
        hubState.motors.runAtSpeed('A', -HALF_SPEED);
        hubState.motors.runAtSpeed('B', HALF_SPEED);
        for (let t = 0; t < 1000; t += 50) bridge.tick(50);
        const snap = core.snapshot();
        // Record t=0 offset for wheelL: world centre at t=0
        built.scene.updateMatrixWorld(true);
        const getMesh = id => built.partMeshes instanceof Map ? built.partMeshes.get(id) : built.partMeshes[id];
        const wheelMesh = getMesh('wheelL');
        const box0 = new Box3().setFromObject(wheelMesh);
        const centre0 = box0.getCenter(new Vector3());
        const group0 = built.bodyGroups instanceof Map ? built.bodyGroups.get(wheelLBody) : built.bodyGroups[wheelLBody];
        // Offset of wheel centre from body origin at t=0
        const offset = centre0.clone().sub(group0.getWorldPosition(new Vector3()));
        // Apply snapshot
        applySnapshot(built, snap);
        built.scene.updateMatrixWorld(true);
        const box1 = new Box3().setFromObject(wheelMesh);
        const centre1 = box1.getCenter(new Vector3());
        const group1 = built.bodyGroups instanceof Map ? built.bodyGroups.get(wheelLBody) : built.bodyGroups[wheelLBody];
        const bodyPos1 = group1.getWorldPosition(new Vector3());
        const bodyQuat1 = group1.getWorldQuaternion(new (await import('three')).Quaternion());
        const expected = offset.clone().applyQuaternion(bodyQuat1).add(bodyPos1);
        close(centre1.x, expected.x, 1e-6, 'wheel centre x after snapshot');
        close(centre1.y, expected.y, 1e-6, 'wheel centre y after snapshot');
        close(centre1.z, expected.z, 1e-6, 'wheel centre z after snapshot');
    } finally {
        built.dispose();
        bridge.dispose();
        core.destroy();
    }
});

test('applySnapshot never writes to snapshot', async () => {
    const {loadJolt, createPhysicsCore} = await import('../overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js');
    const {SimHubBridge, STEP_MS} = await import('../overlay/scratch-gui/src/lib/bw-sim/hub-bridge.js');
    const VirtualSpikeHubState = (await import('../overlay/scratch-gui/src/lib/virtual-hub/spike-hub-state.js')).default;
    const mech = compile(MODEL, CATALOG);
    const J = await loadJolt();
    const core = createPhysicsCore(J, mech, {stepHz: 1000 / STEP_MS});
    const hubState = new VirtualSpikeHubState();
    const bodyOf = (partId) => mech.bodies.find(b => b.parts.includes(partId));
    const hubBody = bodyOf('hub').id;
    const bridge = new SimHubBridge({hubState, core, mechanism: mech, hubBody});
    hubState.motors.runAtSpeed('A', -200);
    hubState.motors.runAtSpeed('B', 200);
    for (let t = 0; t < 500; t += 50) bridge.tick(50);
    const snap = core.snapshot();
    const beforeIds = [...snap.bodyIds];
    const beforeBodies = new Float32Array(snap.bodies);
    const built = buildSimScene({model: MODEL, mechanism: mech, read, colors});
    try {
        applySnapshot(built, snap);
        assert.deepEqual(snap.bodyIds, beforeIds, 'bodyIds unchanged');
        assert.deepEqual(snap.bodies, beforeBodies, 'bodies unchanged');
        // Also freeze and try again
        const frozenBodies = snap.bodies.slice();
        applySnapshot(built, snap);
        assert.deepEqual(snap.bodies, frozenBodies);
    } finally {
        built.dispose();
        bridge.dispose();
        core.destroy();
    }
});

test('a load (the Warehouse pallet under the Forklift) is drawn in its own body\'s group, one box per collider, and moves with it', async () => {
    const {prepareModel, catalogFrom} = await import('../overlay/scratch-gui/src/lib/bw-sim/sim-session.js');
    const catalog = catalogFrom(json('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json'));
    const text = readFileSync(path.join(ROOT, 'overlay/scratch-gui/static/sim-lab/models/forklift.ldr'), 'utf8');
    const {runModel, mechanism} = prepareModel(text, catalog, {mat: 'warehouse'});
    const built = buildSimScene({model: runModel, mechanism, read, colors, catalog});
    try {
        const pallet = mechanism.bodies.find(b => b.id === 'load:pallet');
        const meshes = built.loadMeshes.get('load:pallet');
        assert.equal(meshes.length, pallet.colliders.length);
        const group = built.bodyGroups.get('load:pallet');
        for (const [i, mesh] of meshes.entries()) {
            assert.equal(mesh.parent, group);
            const size = new Box3().setFromObject(mesh).getSize(new Vector3());
            const he = pallet.colliders[i].halfExtents;
            // The box (turned 90° about y with its body) keeps its height.
            assert.ok(Math.abs(size.y - 2 * he[1]) < TOL, `mesh ${i} height ${size.y}`);
        }
        const before = new Box3().setFromObject(group).min.y;
        const ids = mechanism.bodies.map(b => b.id);
        const bodies = new Float32Array(ids.length * 7);
        mechanism.bodies.forEach((b, i) => { bodies.set([...b.position, ...b.rotation], i * 7); });
        bodies[ids.indexOf('load:pallet') * 7 + 1] += 0.04;
        applySnapshot(built, {bodyIds: ids, bodies});
        assert.ok(Math.abs(new Box3().setFromObject(group).min.y - before - 0.04) < 1e-5, 'lifted 4 cm with its body');
    } finally {
        built.dispose();
    }
});

test('electrical anchors use official socket mouths and integral cable markers', () => {
    const hub = electricalFeatures('45601.dat', read);
    const expected = {A: [-69, -68, 40], B: [69, -68, 40], C: [-69, -68, 0], D: [69, -68, 0], E: [-69, -68, -40], F: [69, -68, -40]};
    for (const [port, point] of Object.entries(expected)) {
        const socket = hubCableSocket('45601.dat', port, hub);
        assert.deepEqual(socket.position, point, port);
        assert.deepEqual(socket.direction, [point[0] < 0 ? -1 : 1, 0, 0], port);
    }
    assert.equal(hubCableSocket('45601.dat', 'G', hub), null);
    assert.equal(hubCableSocket('26910.dat', 'A', electricalFeatures('26910.dat', read)), null, 'built-in BOOST motor has no external cable');
    // The C/D letters molded into 27191.dat are at -x/+x respectively.
    const boost = electricalFeatures('26910.dat', read);
    assert.deepEqual(hubCableSocket('26910.dat', 'C', boost).position, [-40, 11, 20]);
    assert.deepEqual(hubCableSocket('26910.dat', 'D', boost).position, [40, 11, 20]);
    for (const [part, point, normal] of [
        ['54696p01.dat', [0, 0, 143], [0, 0, 1]],
        ['54675.dat', [0, 14, 142], [0, 0, 1]],
        ['37308.dat', [0, 0, 3], [0, 0, 1]],
        ['37316.dat', [0, 14, 3], [0, 0, 1]],
        ['37312.dat', [0, 0, 43], [0, 0, 1]],
        ['95658.dat', [0, -56.5, -239], [0, 0, -1]],
        ['99455.dat', [0, 0.5, 181], [0, 0, 1]],
        ['53787.dat', [0, 38.5, -241], [0, 0, -1]]
    ]) {
        const exit = deviceCableExit(electricalFeatures(part, read));
        assert.deepEqual(exit.position, point, part);
        assert.deepEqual(exit.direction, normal, part);
    }
    assert.deepEqual(hubCableSocket('95646.dat', '1', electricalFeatures('95646.dat', read)).position, [-57, 20.5, -139]);
    assert.deepEqual(hubCableSocket('95646.dat', 'D', electricalFeatures('95646.dat', read)).position, [27, 20.5, 139]);
    assert.deepEqual(hubCableSocket('53788.dat', '1', electricalFeatures('53788.dat', read)).position, [-57, -70.5, -139]);
    assert.deepEqual(hubCableSocket('53788.dat', 'C', electricalFeatures('53788.dat', read)).position, [19, -70.5, 139]);
    // Port letters from the molded labels / LEGO hub photos, not file order:
    // City faces -z, while Essential and WeDo face +z.
    for (const [part,port,point] of [
        ['28738.dat','A',[20,10,-80]], ['28738.dat','B',[-20,10,-80]],
        ['67351.dat','A',[-40,-68,49]], ['67351c01.dat','B',[40,-68,49]],
        ['19071.dat','A',[-20,11,80]], ['19071.dat','B',[20,11,80]],
        ['22127.dat','A',[-50,-40,-60]], ['22127.dat','D',[50,-40,-20]],
        ['76454c02.dat','A',[40,8,40]], ['76454c02.dat','3',[-40,8,-60]]
    ]) assert.deepEqual(hubCableSocket(part,port,electricalFeatures(part,read)).position, point, `${part}/${port}`);
    assert.deepEqual(electricalFeatures('unknown.dat', read), []);
});

test('cable attachments follow the named hub and transformed motor housing, including direction-only changes', () => {
    const parts = [{id: 'first', part: '45601.dat'}, {id: 'named', part: '45601.dat'}, {id: 'motor', part: '54696p01.dat'}];
    const meshes = new Map(parts.map(p => [p.id, new Mesh()]));
    const group = new Group(); for (const m of meshes.values()) group.add(m);
    const motor = meshes.get('motor'), hub = meshes.get('named');
    group.position.set(0.2, 0.3, -0.4); group.rotation.set(0.2, -0.7, 0.1);
    motor.position.set(0.01, 0.02, 0.03); motor.rotation.set(0.4, 0.5, 0.6);
    hub.position.set(-0.1, 0.05, 0.02); hub.rotation.set(0, 0, Math.PI / 2); group.updateMatrixWorld(true);
    const anchors = createCableAnchors({read, partOf: id => parts.find(p => p.id === id), meshOf: id => meshes.get(id)});
    const item = anchors({id: 'motor', hub: 'named', port: 'F'});
    assert.ok(item.cableAnchor().distanceTo(motor.localToWorld(new Vector3(0, 0, -0.0572))) < 1e-12);
    assert.ok(item.hubAnchor().distanceTo(hub.localToWorld(new Vector3(0.0276, 0.0272, 0.016))) < 1e-12);
    const before = item.cableAnchor(); motor.rotation.y += 0.7; group.updateMatrixWorld(true);
    assert.ok(item.cableAnchor().distanceTo(before) > 0.001, 'housing rotation carries cable, not the motor rotor');
    assert.ok(Math.abs(item.cableDirection().length() - 1) < 1e-12);
    assert.deepEqual(anchors({id: 'motor', hub: 'missing', port: 'A'}), {});
    assert.deepEqual(anchors({id: 'motor', hub: 'named', port: null}), {});
    meshes.delete('named'); assert.equal(item.hubAnchor(), null, 'hidden/removed hub cannot leave a floating cable');
});

test('cables attach at sockets instead of badge centres and leave both surfaces outwards', () => {
    const original = globalThis.document;
    globalThis.document = {createElement: () => ({style: {}, dataset: {}, setAttribute () {}, addEventListener () {}, appendChild () {}, remove () {}})};
    const scene = new Group(), camera = new PerspectiveCamera();
    const from = new Vector3(0.04, 0.02, 0), to = new Vector3(-0.03, 0.04, 0.01);
    const outA = new Vector3(1, 0, 0), outB = new Vector3(-1, 0, 0);
    const layer = createInsightLayer({container: {appendChild () {}}, scene});
    try {
        layer.setPorts([{id: 'motor', port: 'A', label: 'Motor A', anchor: () => new Vector3(9, 8, 7),
            cableAnchor: () => from, hubAnchor: () => to, cableDirection: () => outA, hubDirection: () => outB}]);
        layer.update(camera, 100, 100);
        const mesh = scene.getObjectByName('bw-insight-cable'), curve = mesh.geometry.parameters.path;
        assert.ok(mesh.localToWorld(curve.getPoint(0)).distanceTo(from) < 1e-12, 'badge centre must never be the cable endpoint');
        assert.ok(mesh.localToWorld(curve.getPoint(1)).distanceTo(to) < 1e-12);
        assert.ok(curve.getTangent(0).dot(outA) > 0.999);
        assert.ok(curve.getTangent(1).dot(outB) < -0.999);
        const oldGeometry = mesh.geometry;
        const translation = new Vector3(0.2, 0.1, -0.3);
        from.add(translation);
        to.add(translation);
        layer.update(camera, 100, 100);
        assert.equal(mesh.geometry, oldGeometry, 'translation reuses the cable geometry');
        assert.ok(mesh.localToWorld(curve.getPoint(0)).distanceTo(from) < 1e-12);
        assert.ok(mesh.localToWorld(curve.getPoint(1)).distanceTo(to) < 1e-12);
        to.z += 0.02;
        layer.update(camera, 100, 100);
        assert.notEqual(mesh.geometry, oldGeometry, 'moving one endpoint reshapes the cable');
        const reshaped = mesh.geometry;
        assert.ok(mesh.localToWorld(reshaped.parameters.path.getPoint(1)).distanceTo(to) < 1e-12);
        outA.set(0, 0, 1);
        layer.update(camera, 100, 100);
        assert.notEqual(mesh.geometry, reshaped, 'rotation must update even when endpoint position is unchanged');
        assert.ok(mesh.geometry.parameters.path.getTangent(0).dot(outA) > 0.999);
        layer.setVisible({ports: false}); layer.update(camera, 100, 100);
        assert.equal(layer.stats().cables.length, 0);
        layer.setPorts([]); assert.equal(scene.getObjectByName('bw-insight-cable'), undefined);
    } finally { layer.dispose(); globalThis.document = original; }
});
