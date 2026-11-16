// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createVortexPinballProject,
    CAD_VORTEX_PINBALL_PROGRAM
} from '../scripts/create-vortex-pinball-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function vortexPinballDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#ec4899'
    });
    const doc = createDocument('Vortex 3-axis pinball arena');
    doc.version = 8;
    doc.id = 'robot-vortex-pinball';
    doc.roots = ['arena', 'left-flipper', 'right-flipper', 'plunger'];
    doc.nodes = {
        arena: body('arena'),
        'left-flipper': body('left-flipper'),
        'right-flipper': body('right-flipper'),
        plunger: body('plunger')
    };
    doc.joints = [
        {
            id: 'flip-left-a',
            kind: 'hinge',
            bodyA: 'arena',
            bodyB: 'left-flipper',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-0.96, 0.96],
            control: {port: 'A'}
        },
        {
            id: 'flip-right-b',
            kind: 'hinge',
            bodyA: 'arena',
            bodyB: 'right-flipper',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-0.96, 0.96],
            control: {port: 'B'}
        },
        {
            id: 'plunger-c',
            kind: 'slider',
            bodyA: 'arena',
            bodyB: 'plunger',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [0, 36],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createVortexPinballProject embeds the authored CAD project and A/B/C pinball blocks', async () => {
    const text = JSON.stringify(vortexPinballDoc(), null, 2);
    const bytes = await createVortexPinballProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/vortex-pinball-program.txt').async('string'),
        CAD_VORTEX_PINBALL_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const sliderPortOf = block => byId[block.inputs.SLIDER[1]].fields.sliders[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const sliderMoves = blocks.filter(block => block.opcode === 'cadlab_runSliderDistance');
    const stopMotors = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    const stopSliders = blocks.filter(block => block.opcode === 'cadlab_stopSlider');
    assert.equal(moves.length, 4);
    assert.deepEqual(moves.map(portOf), ['A', 'B', 'A', 'B']);
    assert.equal(sliderMoves.length, 1);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['C']);
    assert.equal(stopMotors.length, 2);
    assert.deepEqual(stopMotors.map(portOf), ['A', 'B']);
    assert.equal(stopSliders.length, 1);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createVortexPinballProject validates A/B flipper hinges and C plunger slider', async () => {
    const missingA = vortexPinballDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createVortexPinballProject(JSON.stringify(missingA)), /port A/);

    const missingC = vortexPinballDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createVortexPinballProject(JSON.stringify(missingC)), /port C/);
});
