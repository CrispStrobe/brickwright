// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createZephyrConveyorProject,
    CAD_ZEPHYR_CONVEYOR_PROGRAM
} from '../scripts/create-zephyr-conveyor-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function zephyrConveyorDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#0ea5e9'
    });
    const doc = createDocument('Zephyr 3-axis sorting conveyor');
    doc.version = 8;
    doc.id = 'robot-zephyr-conveyor';
    doc.roots = ['frame', 'pusher', 'paddle-wheel', 'diverter'];
    doc.nodes = {
        frame: body('frame'),
        pusher: body('pusher'),
        'paddle-wheel': body('paddle-wheel'),
        diverter: body('diverter')
    };
    doc.joints = [
        {
            id: 'feed-a',
            kind: 'slider',
            bodyA: 'frame',
            bodyB: 'pusher',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [0, 44],
            control: {port: 'A'}
        },
        {
            id: 'roller-b',
            kind: 'hinge',
            bodyA: 'frame',
            bodyB: 'paddle-wheel',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            control: {port: 'B'}
        },
        {
            id: 'gate-c',
            kind: 'hinge',
            bodyA: 'frame',
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

test('createZephyrConveyorProject embeds the authored CAD project and A/B/C conveyor blocks', async () => {
    const text = JSON.stringify(zephyrConveyorDoc(), null, 2);
    const bytes = await createZephyrConveyorProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/zephyr-conveyor-program.txt').async('string'),
        CAD_ZEPHYR_CONVEYOR_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const sliderPortOf = block => byId[block.inputs.SLIDER[1]].fields.sliders[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const sliderMoves = blocks.filter(block => block.opcode === 'cadlab_runSliderDistance');
    assert.equal(moves.length, 2);
    assert.deepEqual(moves.map(portOf), ['B', 'C']);
    assert.equal(sliderMoves.length, 2);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['A', 'A']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createZephyrConveyorProject validates A feed slider, B paddle wheel, and C gate servo', async () => {
    const missingA = zephyrConveyorDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createZephyrConveyorProject(JSON.stringify(missingA)), /port A/);

    const missingB = zephyrConveyorDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createZephyrConveyorProject(JSON.stringify(missingB)), /port B/);

    const missingC = zephyrConveyorDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createZephyrConveyorProject(JSON.stringify(missingC)), /port C/);
});
