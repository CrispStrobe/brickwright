// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createChronosDrawbridgeProject,
    CAD_CHRONOS_DRAWBRIDGE_PROGRAM
} from '../scripts/create-chronos-drawbridge-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function chronosDrawbridgeDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#2563eb'
    });
    const doc = createDocument('Chronos 3-axis bascule drawbridge');
    doc.version = 8;
    doc.id = 'robot-chronos-drawbridge';
    doc.roots = ['deck', 'west-leaf', 'east-leaf', 'barrier'];
    doc.nodes = {
        deck: body('deck'),
        'west-leaf': body('west-leaf'),
        'east-leaf': body('east-leaf'),
        barrier: body('barrier')
    };
    doc.joints = [
        {
            id: 'west-a',
            kind: 'hinge',
            bodyA: 'deck',
            bodyB: 'west-leaf',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-1.22, 1.22],
            control: {port: 'A'}
        },
        {
            id: 'east-b',
            kind: 'hinge',
            bodyA: 'deck',
            bodyB: 'east-leaf',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-1.22, 1.22],
            control: {port: 'B'}
        },
        {
            id: 'barrier-c',
            kind: 'slider',
            bodyA: 'deck',
            bodyB: 'barrier',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [0, 24],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createChronosDrawbridgeProject embeds the authored CAD project and A/B/C drawbridge blocks', async () => {
    const text = JSON.stringify(chronosDrawbridgeDoc(), null, 2);
    const bytes = await createChronosDrawbridgeProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/chronos-drawbridge-program.txt').async('string'),
        CAD_CHRONOS_DRAWBRIDGE_PROGRAM
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
    assert.equal(sliderMoves.length, 2);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['C', 'C']);
    assert.equal(stopMotors.length, 2);
    assert.deepEqual(stopMotors.map(portOf), ['A', 'B']);
    assert.equal(stopSliders.length, 1);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createChronosDrawbridgeProject validates A/B leaf hinges and C barrier slider', async () => {
    const missingA = chronosDrawbridgeDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createChronosDrawbridgeProject(JSON.stringify(missingA)), /port A/);

    const missingC = chronosDrawbridgeDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createChronosDrawbridgeProject(JSON.stringify(missingC)), /port C/);
});
