// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createSteerableRoverProject,
    CAD_STEERABLE_ROVER_PROGRAM
} from '../scripts/create-steerable-rover-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function steerableRoverDoc() {
    const body = (id, x, y, z) => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [x, y, z], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#2d3748'
    });
    const doc = createDocument('Trident steerable rover');
    doc.id = 'robot-steerable-rover';
    doc.roots = ['chassis', 'left-wheel', 'right-wheel', 'steering-fork'];
    doc.nodes = {
        chassis: body('chassis', 0, 0, 13.5),
        'left-wheel': body('left-wheel', -35, 74.5, 31.5),
        'right-wheel': body('right-wheel', -35, -74.5, 31.5),
        'steering-fork': body('steering-fork', 75, 0, 31.5)
    };
    doc.joints = [
            {
                id: 'drive-a',
                kind: 'hinge',
                bodyA: 'chassis',
                bodyB: 'left-wheel',
                anchorA: [-35, 44, 31.5],
                anchorB: [-35, 44, 31.5],
                axisA: [0, 1, 0],
                axisB: [0, 1, 0],
                control: {port: 'A'}
            },
            {
                id: 'drive-b',
                kind: 'hinge',
                bodyA: 'chassis',
                bodyB: 'right-wheel',
                anchorA: [-35, -44, 31.5],
                anchorB: [-35, -44, 31.5],
                axisA: [0, 1, 0],
                axisB: [0, 1, 0],
                control: {port: 'B'}
            },
            {
                id: 'steer-c',
                kind: 'hinge',
                bodyA: 'chassis',
                bodyB: 'steering-fork',
                anchorA: [75, 0, 69.12],
                anchorB: [75, 0, 69.12],
                axisA: [0, 0, 1],
                axisB: [0, 0, 1],
                limits: [-0.6981317, 0.6981317],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createSteerableRoverProject embeds the authored CAD project and A/B/C steering blocks', async () => {
    const text = JSON.stringify(steerableRoverDoc(), null, 2);
    const bytes = await createSteerableRoverProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/trident-steerable-rover-program.txt').async('string'),
        CAD_STEERABLE_ROVER_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const speed = blocks.filter(block => block.opcode === 'cadlab_setMotorSpeed');
    const steer = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const stop = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    assert.equal(speed.length, 2);
    assert.deepEqual(speed.map(portOf), ['A', 'B']);
    assert.equal(steer.length, 3);
    assert.deepEqual(steer.map(portOf), ['C', 'C', 'C']);
    assert.equal(stop.length, 3);
    assert.deepEqual(stop.map(portOf), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createSteerableRoverProject validates A/B/C drive and servo ports', async () => {
    const missingC = steerableRoverDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createSteerableRoverProject(JSON.stringify(missingC)), /port C/);

    const unlimitedC = steerableRoverDoc();
    delete unlimitedC.joints.find(joint => joint.control?.port === 'C').limits;
    await assert.rejects(createSteerableRoverProject(JSON.stringify(unlimitedC)), /limits at port C/);

    const invalid = steerableRoverDoc();
    invalid.version = 999;
    await assert.rejects(createSteerableRoverProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
