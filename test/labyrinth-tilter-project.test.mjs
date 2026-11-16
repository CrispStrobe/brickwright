// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createLabyrinthTilterProject,
    CAD_LABYRINTH_TILTER_PROGRAM
} from '../scripts/create-labyrinth-tilter-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function labyrinthTilterDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#10b981'
    });
    const doc = createDocument('Labyrinth 2-axis tilt maze');
    doc.version = 8;
    doc.id = 'robot-labyrinth-tilter';
    doc.roots = ['stand', 'outer-ring', 'maze-tray', 'diverter'];
    doc.nodes = {
        stand: body('stand'),
        'outer-ring': body('outer-ring'),
        'maze-tray': body('maze-tray'),
        diverter: body('diverter')
    };
    doc.joints = [
        {
            id: 'outer-a',
            kind: 'hinge',
            bodyA: 'stand',
            bodyB: 'outer-ring',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-0.436, 0.436],
            control: {port: 'A'}
        },
        {
            id: 'inner-b',
            kind: 'hinge',
            bodyA: 'outer-ring',
            bodyB: 'maze-tray',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.436, 0.436],
            control: {port: 'B'}
        },
        {
            id: 'gate-c',
            kind: 'hinge',
            bodyA: 'maze-tray',
            bodyB: 'diverter',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-1.05, 1.05],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createLabyrinthTilterProject embeds the authored CAD project and A/B/C gimbal blocks', async () => {
    const text = JSON.stringify(labyrinthTilterDoc(), null, 2);
    const bytes = await createLabyrinthTilterProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/labyrinth-tilter-program.txt').async('string'),
        CAD_LABYRINTH_TILTER_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const stop = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    assert.equal(moves.length, 5);
    assert.deepEqual(moves.map(portOf), ['A', 'B', 'C', 'A', 'B']);
    assert.equal(stop.length, 3);
    assert.deepEqual(stop.map(portOf), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createLabyrinthTilterProject validates A/B/C servo hinges and limits', async () => {
    const missingA = labyrinthTilterDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createLabyrinthTilterProject(JSON.stringify(missingA)), /port A/);

    const unlimitedB = labyrinthTilterDoc();
    delete unlimitedB.joints.find(joint => joint.control?.port === 'B').limits;
    await assert.rejects(createLabyrinthTilterProject(JSON.stringify(unlimitedB)), /limits at servo port B/);

    const invalid = labyrinthTilterDoc();
    invalid.version = 999;
    await assert.rejects(createLabyrinthTilterProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
