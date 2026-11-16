// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createTitanViseProject,
    CAD_TITAN_VISE_PROGRAM
} from '../scripts/create-titan-vise-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function titanViseDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#ea580c'
    });
    const doc = createDocument('Titan 3-axis rotary vise');
    doc.version = 8;
    doc.id = 'robot-titan-vise';
    doc.roots = ['base', 'rotary-bed', 'jaw-left', 'jaw-right'];
    doc.nodes = {
        base: body('base'),
        'rotary-bed': body('rotary-bed'),
        'jaw-left': body('jaw-left'),
        'jaw-right': body('jaw-right')
    };
    doc.joints = [
        {
            id: 'indexer-a',
            kind: 'hinge',
            bodyA: 'base',
            bodyB: 'rotary-bed',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-2.09, 2.09],
            control: {port: 'A'}
        },
        {
            id: 'jaw-left-b',
            kind: 'slider',
            bodyA: 'base',
            bodyB: 'jaw-left',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [0, 16],
            control: {port: 'B'}
        },
        {
            id: 'jaw-right-c',
            kind: 'slider',
            bodyA: 'base',
            bodyB: 'jaw-right',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [-1, 0, 0],
            axisB: [-1, 0, 0],
            limits: [0, 16],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createTitanViseProject embeds the authored CAD project and A/B/C vise blocks', async () => {
    const text = JSON.stringify(titanViseDoc(), null, 2);
    const bytes = await createTitanViseProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/titan-vise-program.txt').async('string'),
        CAD_TITAN_VISE_PROGRAM
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
    assert.equal(moves.length, 1);
    assert.deepEqual(moves.map(portOf), ['A']);
    assert.equal(sliderMoves.length, 4);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['B', 'C', 'B', 'C']);
    assert.equal(stopMotors.length, 1);
    assert.deepEqual(stopMotors.map(portOf), ['A']);
    assert.equal(stopSliders.length, 2);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createTitanViseProject validates A indexer hinge and B/C jaw sliders', async () => {
    const missingA = titanViseDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createTitanViseProject(JSON.stringify(missingA)), /port A/);

    const missingB = titanViseDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createTitanViseProject(JSON.stringify(missingB)), /port B/);
});
