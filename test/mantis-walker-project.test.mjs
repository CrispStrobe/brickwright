// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createMantisWalkerProject,
    CAD_MANTIS_WALKER_PROGRAM
} from '../scripts/create-mantis-walker-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function mantisWalkerDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#8b5cf6'
    });
    const doc = createDocument('Mantis 3-servo walker');
    doc.version = 8;
    doc.id = 'robot-mantis-walker';
    doc.roots = ['torso', 'left-leg', 'right-leg', 'pendulum'];
    doc.nodes = {
        torso: body('torso'),
        'left-leg': body('left-leg'),
        'right-leg': body('right-leg'),
        pendulum: body('pendulum')
    };
    doc.joints = [
        {
            id: 'left-hip-a',
            kind: 'hinge',
            bodyA: 'torso',
            bodyB: 'left-leg',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.61, 0.61],
            control: {port: 'A'}
        },
        {
            id: 'right-hip-b',
            kind: 'hinge',
            bodyA: 'torso',
            bodyB: 'right-leg',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.61, 0.61],
            control: {port: 'B'}
        },
        {
            id: 'roll-c',
            kind: 'hinge',
            bodyA: 'torso',
            bodyB: 'pendulum',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-0.7, 0.7],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createMantisWalkerProject embeds the authored CAD project and A/B/C walking gait blocks', async () => {
    const text = JSON.stringify(mantisWalkerDoc(), null, 2);
    const bytes = await createMantisWalkerProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/mantis-walker-program.txt').async('string'),
        CAD_MANTIS_WALKER_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const stop = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    assert.equal(moves.length, 7);
    assert.deepEqual(moves.map(portOf), ['C', 'A', 'B', 'C', 'A', 'B', 'C']);
    assert.equal(stop.length, 3);
    assert.deepEqual(stop.map(portOf), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createMantisWalkerProject validates A/B/C servo hinges and limits', async () => {
    const missingA = mantisWalkerDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createMantisWalkerProject(JSON.stringify(missingA)), /port A/);

    const unlimitedC = mantisWalkerDoc();
    delete unlimitedC.joints.find(joint => joint.control?.port === 'C').limits;
    await assert.rejects(createMantisWalkerProject(JSON.stringify(unlimitedC)), /limits at servo port C/);

    const invalid = mantisWalkerDoc();
    invalid.version = 999;
    await assert.rejects(createMantisWalkerProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
