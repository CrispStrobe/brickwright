// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import JSZip from 'jszip';
import {createCadRoverProject, CAD_ROVER_PROGRAM} from '../scripts/create-cad-rover-project.mjs';
import {parseCadRoverDocument, assertCadRoverProgram} from '../scripts/lib/cad-rover-contract.mjs';
import {inspectBrickwrightState} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const node = id => ({id, name: id, color: '#0088aa', kind: 'box', size: [10, 10, 10],
    transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]}});
const fixture = () => ({format: 'brickwright-cad', version: 8, units: 'mm', id: 'rover-fixture',
    title: 'Packaging fixture', roots: ['base', 'left', 'right'],
    simulation: {gravity: [0, 0, -9.81], ground: true, groundFriction: 0.8, groundRestitution: 0.02, fixBase: false},
    nodes: Object.fromEntries(['base', 'left', 'right'].map(id => [id, node(id)])),
    joints: ['A', 'B'].map((port, i) => ({id: `joint-${port}`, kind: 'hinge', bodyA: 'base', bodyB: i ? 'right' : 'left',
        anchorA: [0, 0, 0], anchorB: [0, 0, 0], axisA: [1, 0, 0], axisB: [1, 0, 0], control: {port}}))});

test('rover SB3 preserves the exact CAD document and compiles concurrent two-wheel commands', async () => {
    const text = JSON.stringify(fixture(), null, 2) + '\n';
    const bytes = await createCadRoverProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file('brickwright/cad.json').async('text'), text);
    assert.equal(await archive.file('brickwright/tt-rover-program.txt').async('text'), CAD_ROVER_PROGRAM);
    assert.equal(await archive.file('brickwright/licenses/ADAFRUIT-MIT-LICENSE.txt').async('text'),
        await readFile(new URL('../licenses/adafruit-cad-parts-MIT.txt', import.meta.url), 'utf8'));
    assert.equal(await archive.file('brickwright/licenses/BRICKWRIGHT-BSD-3-CLAUSE.txt').async('text'),
        await readFile(new URL('../LICENSE', import.meta.url), 'utf8'));
    const project = JSON.parse(await archive.file('project.json').async('text'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const speed = blocks.filter(block => block.opcode === 'cadlab_setMotorSpeed');
    assert.equal(speed.length, 6);
    assert.deepEqual(speed.map(block => [byId[block.inputs.MOTOR[1]].fields.motors[0], Number(block.inputs.SPEED[1][1])]),
        [['A', 120], ['B', 120], ['A', 90], ['B', -90], ['A', -120], ['B', -120]]);
    for (const index of [0, 2, 4]) assert.equal(byId[speed[index].next], speed[index + 1], 'both drives start before the wait');
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopMotor').length, 6);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees').length, 0);
    assert.equal(blocks.filter(block => block.opcode === 'control_wait').length, 5);
    assertCadRoverProgram(project);
    const inspection = await inspectBrickwrightState(bytes);
    assert.notEqual(inspection.outcome, 'invalid', 'the ordinary project loader accepts the sidecar');
});

test('rover control contract refuses an anchored base, fixed drive loops, shared wheels and disconnected chassis', () => {
    const check = document => parseCadRoverDocument(JSON.stringify(document));
    for (const value of [true, undefined]) {
        const anchored = fixture();
        anchored.simulation.fixBase = value;
        assert.throws(() => check(anchored), /explicit free base/);
    }
    const noSettings = fixture();
    delete noSettings.simulation;
    assert.throws(() => check(noSettings), /explicit free base/);
    const staticBody = fixture();
    staticBody.nodes.base.physics = {version: 1, motion: 'static', densityKgM3: 1050,
        friction: 0.4, restitution: 0.05, intent: 'rigid'};
    assert.throws(() => check(staticBody), /dynamic chassis/);
    const locked = fixture();
    locked.joints.push({...structuredClone(locked.joints[0]), id: 'locked', kind: 'fixed', control: undefined});
    assert.throws(() => check(locked), /locked by fixed joints/);
    const shared = fixture();
    shared.joints[1].bodyB = 'left';
    assert.throws(() => check(shared), /independent wheel assemblies/);
    const disconnected = fixture();
    disconnected.nodes.other = node('other');
    disconnected.roots.push('other');
    disconnected.joints[1].bodyA = 'other';
    assert.throws(() => check(disconnected), /one chassis assembly/);
});

test('rover drive qualification uses transformed axes, fixed casings and signed connector body order', () => {
    const rotated = fixture();
    rotated.nodes.base.transform.rotation = [90, 90, 90];
    rotated.nodes.base.transform.scale = [2, 3, 4];
    rotated.nodes.left.transform.rotation = [0, 0, 90];
    rotated.nodes.right.transform.rotation = [0, 90, 0];
    for (const joint of rotated.joints) joint.axisA = [0, 0, 1];
    rotated.joints[0].axisB = [0, -1, 0];
    rotated.joints[1].axisB = [0, 0, 1];
    const text = JSON.stringify(rotated);
    assert.equal(JSON.stringify(parseCadRoverDocument(text)), text, 'qualification preserves authored bytes and frames');
    const mismatched = structuredClone(rotated);
    mismatched.joints[1].axisB = [1, 0, 0];
    assert.throws(() => parseCadRoverDocument(JSON.stringify(mismatched)), /matching world-space hinge axes at port B/);
    const mirrored = fixture();
    mirrored.joints[1].axisA = [-1, 0, 0];
    mirrored.joints[1].axisB = [-1, 0, 0];
    assert.throws(() => parseCadRoverDocument(JSON.stringify(mirrored)), /same signed world-space wheel axis/);

    const casings = fixture();
    for (const [index, port] of ['A', 'B'].entries()) {
        const id = `casing-${port}`;
        casings.nodes[id] = node(id);
        casings.roots.push(id);
        casings.joints[index].bodyA = id;
        casings.joints.push({id: `fixed-${port}`, kind: 'fixed', bodyA: 'base', bodyB: id,
            anchorA: [0, 0, 0], anchorB: [0, 0, 0], axisA: [1, 0, 0], axisB: [1, 0, 0]});
    }
    assert.doesNotThrow(() => parseCadRoverDocument(JSON.stringify(casings)));
    const reversed = casings.joints[1];
    [reversed.bodyA, reversed.bodyB] = [reversed.bodyB, reversed.bodyA];
    assert.throws(() => parseCadRoverDocument(JSON.stringify(casings)), /same signed world-space wheel axis/);
    reversed.axisA = [-1, 0, 0];
    reversed.axisB = [-1, 0, 0];
    assert.doesNotThrow(() => parseCadRoverDocument(JSON.stringify(casings)), 'equivalent reversed connector remains usable');
});

test('rover requires continuous wheel hinges and coincident transformed anchors at the solver tolerance', () => {
    const check = document => parseCadRoverDocument(JSON.stringify(document));
    for (const limits of [[0, 0], [-Math.PI, Math.PI], [-2 * Math.PI, 2 * Math.PI]]) {
        const limited = fixture();
        limited.joints[0].limits = limits;
        assert.throws(() => check(limited), /unlimited continuous wheel hinge at port A/);
    }
    const transformed = fixture();
    transformed.nodes.base.transform = {position: [10, 20, 30], rotation: [90, 90, 90], scale: [2, 3, 4]};
    transformed.nodes.left.transform = {position: [13, 28, 32], rotation: [0, 0, 90], scale: [2, 3, 4]};
    transformed.nodes.right.transform = {position: [12, 26, 28], rotation: [0, 90, 0], scale: [2, 3, 4]};
    // Each local anchor transforms to [22, 26, 28] mm. Local values differ,
    // proving scale/rotation/translation participate in the admission check.
    for (const joint of transformed.joints) {joint.anchorA = [1, 2, 3]; joint.axisA = [0, 0, 1];}
    transformed.joints[0].anchorB = [-1, -3, -1];
    transformed.joints[0].axisB = [0, -1, 0];
    transformed.joints[1].anchorB = [0, 0, 2.5];
    transformed.joints[1].axisB = [0, 0, 1];
    assert.doesNotThrow(() => check(transformed));
    const shifted = structuredClone(transformed);
    shifted.joints[0].anchorB[0] += 10;
    assert.throws(() => check(shifted), /matching world-space joint anchors within 0.1 mm at A/);
    for (const [offset, accepted] of [[0.099, true], [0.1, true], [0.101, false]]) {
        const near = fixture();
        near.joints[1].anchorB[0] = offset;
        if (accepted) assert.doesNotThrow(() => check(near));
        else assert.throws(() => check(near), /joint anchors within 0.1 mm at B/);
    }
    const fixed = fixture();
    fixed.nodes.casing = node('casing'); fixed.roots.push('casing');
    fixed.joints.push({id: 'fixed-casing', kind: 'fixed', bodyA: 'base', bodyB: 'casing',
        anchorA: [0, 0, 0], anchorB: [1, 0, 0], axisA: [1, 0, 0], axisB: [1, 0, 0]});
    assert.throws(() => check(fixed), /joint anchors within 0.1 mm at fixed-casing/);
});

test('saved executable demo rejects changed speed, reordered drives, broken ownership and hidden scripts', async () => {
    const archive = await JSZip.loadAsync(await createCadRoverProject(JSON.stringify(fixture())));
    const original = JSON.parse(await archive.file('project.json').async('text'));
    const mutate = change => {
        const project = structuredClone(original);
        change(project, project.targets[0].blocks);
        assert.throws(() => assertCadRoverProgram(project), /Invalid Scout TT demo/);
    };
    const speedEntry = blocks => Object.entries(blocks).find(([, block]) => block.opcode === 'cadlab_setMotorSpeed');
    mutate((_, blocks) => { speedEntry(blocks)[1].inputs.SPEED[1][1] = '121'; });
    mutate((_, blocks) => {
        const [aId, a] = speedEntry(blocks);
        const bId = a.next, b = blocks[bId], waitId = b.next, wait = blocks[waitId], afterWait = wait.next;
        // Preserve a coherent chain, but insert a wait before starting wheel B.
        a.next = waitId; wait.parent = aId; wait.next = bId; b.parent = waitId; b.next = afterWait;
        blocks[afterWait].parent = bId;
    });
    mutate((_, blocks) => { speedEntry(blocks)[1].parent = null; });
    mutate((_, blocks) => {
        const [id, block] = speedEntry(blocks);
        block.next = id;
    });
    mutate((project, blocks) => {
        const hat = Object.values(blocks).find(block => block.topLevel);
        project.targets.push({name: 'Other', blocks: {extra: {...hat, next: null}}});
    });
    mutate((_, blocks) => { blocks.detached = {...structuredClone(speedEntry(blocks)[1]), parent: null, next: null}; });
    mutate((_, blocks) => {
        const stop = Object.values(blocks).find(block => block.opcode === 'cadlab_stopMotor');
        stop.fields.ACTION[0] = 'coast';
    });
    mutate((_, blocks) => {
        const speed = speedEntry(blocks)[1];
        speed.inputs.SPEED = [3, speed.inputs.MOTOR[1], [4, '120']];
    });
    for (const visible of [true, false]) mutate(project => {
        project.monitors = [{id: 'rogue-motor', mode: 'default', opcode: 'cadlab_setMotorSpeed',
            params: {MOTOR: 'A', SPEED: 720}, spriteName: null, value: '', width: 0, height: 0,
            x: 0, y: 0, visible}];
    });
    assert.equal(await archive.file('brickwright/tt-rover-program.txt').async('text'), CAD_ROVER_PROGRAM,
        'none of these executable corruptions needs to change the text sidecar');
});

test('saved-file CLI rejects executable edits and monitors even when artifact hashes have been refreshed', async () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    await mkdir(resolve(root, 'artifacts'), {recursive: true});
    const output = await mkdtemp(resolve(root, 'artifacts/cad-rover-verifier-'));
    try {
        const document = fixture();
        const text = JSON.stringify(document);
        const bytes = await createCadRoverProject(text);
        const archive = await JSZip.loadAsync(bytes);
        const files = {'tt-rover.bcad': text, 'tt-rover.sb3': bytes, 'tt-rover-program.txt': CAD_ROVER_PROGRAM};
        for (const name of ['ADAFRUIT-MIT-LICENSE.txt', 'BRICKWRIGHT-BSD-3-CLAUSE.txt']) {
            files[name] = await archive.file(`brickwright/licenses/${name}`).async('uint8array');
        }
        for (const [name, value] of Object.entries(files)) await writeFile(resolve(output, name), value);
        const manifest = {format: 'brickwright-cad-rover-example', version: 1,
            cadDocument: {format: document.format, version: document.version, units: document.units, id: document.id},
            program: {format: 'brickwright-pseudocode', entry: 'green-flag'},
            files: Object.fromEntries(Object.entries(files).map(([name, value]) =>
                [name, createHash('sha256').update(value).digest('hex')]))};
        const saveManifest = () => writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest));
        await saveManifest();
        const verify = () => promisify(execFile)(process.execPath,
            ['--import', './scripts/lib/register-gui-scope.mjs', 'scripts/verify-cad-rover-project.mjs', output],
            {cwd: root, timeout: 30000});
        assert.match((await verify()).stdout, /PASS complete Scout TT project/);
        const originalProject = JSON.parse(await archive.file('project.json').async('text'));
        const changedSpeed = structuredClone(originalProject);
        Object.values(changedSpeed.targets[0].blocks).find(block => block.opcode === 'cadlab_setMotorSpeed')
            .inputs.SPEED[1][1] = '121';
        const changedMonitor = structuredClone(originalProject);
        changedMonitor.monitors = [{id: 'rogue-motor', mode: 'default', opcode: 'cadlab_setMotorSpeed',
            params: {MOTOR: 'A', SPEED: 720}, spriteName: null, value: '', width: 0, height: 0,
            x: 0, y: 0, visible: true}];
        for (const [project, diagnostic] of [[changedSpeed, /SPEED differs from the demo/],
            [changedMonitor, /the demo must have no monitors/]]) {
            archive.file('project.json', JSON.stringify(project));
            const changed = await archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
            await writeFile(resolve(output, 'tt-rover.sb3'), changed);
            manifest.files['tt-rover.sb3'] = createHash('sha256').update(changed).digest('hex');
            await saveManifest();
            await assert.rejects(verify(), error => diagnostic.test(error.stderr));
        }
    } finally {
        await rm(output, {recursive: true, force: true});
    }
});

test('rover packaging rejects missing drive ports and invalid SDK geometry', async () => {
    const missing = fixture();
    missing.joints[1].control.port = 'C';
    await assert.rejects(createCadRoverProject(JSON.stringify(missing)), /port B/);
    const invalid = fixture();
    invalid.nodes.base.size[0] = -1;
    await assert.rejects(createCadRoverProject(JSON.stringify(invalid)), /Invalid CAD project/);
});

