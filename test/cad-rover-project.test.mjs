// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {createCadRoverProject, CAD_ROVER_PROGRAM} from '../scripts/create-cad-rover-project.mjs';
import {inspectBrickwrightState} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const node = id => ({id, name: id, color: '#0088aa', kind: 'box', size: [10, 10, 10],
    transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]}});
const fixture = () => ({format: 'brickwright-cad', version: 8, units: 'mm', id: 'rover-fixture',
    title: 'Packaging fixture', roots: ['base', 'left', 'right'],
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
    const inspection = await inspectBrickwrightState(bytes);
    assert.notEqual(inspection.outcome, 'invalid', 'the ordinary project loader accepts the sidecar');
});

test('rover packaging rejects missing drive ports and invalid SDK geometry', async () => {
    const missing = fixture();
    missing.joints[1].control.port = 'C';
    await assert.rejects(createCadRoverProject(JSON.stringify(missing)), /port B/);
    const invalid = fixture();
    invalid.nodes.base.size[0] = -1;
    await assert.rejects(createCadRoverProject(JSON.stringify(invalid)), /Invalid CAD project/);
});

