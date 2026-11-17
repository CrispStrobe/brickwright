// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createApexScaraProject,
    CAD_APEX_SCARA_PROGRAM
} from '../scripts/create-apex-scara-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function apexScaraDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#0284c7'
    });
    const doc = createDocument('Apex SCARA 3-axis arm');
    doc.version = 8;
    doc.id = 'robot-apex-scara';
    doc.roots = ['pedestal', 'upper-arm', 'forearm', 'quill'];
    doc.nodes = {
        pedestal: body('pedestal'),
        'upper-arm': body('upper-arm'),
        forearm: body('forearm'),
        quill: body('quill')
    };
    doc.joints = [
        {
            id: 'shoulder-a',
            kind: 'hinge',
            bodyA: 'pedestal',
            bodyB: 'upper-arm',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-1.57, 1.57],
            control: {port: 'A'}
        },
        {
            id: 'elbow-b',
            kind: 'hinge',
            bodyA: 'upper-arm',
            bodyB: 'forearm',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-1.92, 1.92],
            control: {port: 'B'}
        },
        {
            id: 'quill-c',
            kind: 'slider',
            bodyA: 'forearm',
            bodyB: 'quill',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-17, 10],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createApexScaraProject embeds the authored CAD project and A/B/C SCARA blocks', async () => {
    const text = JSON.stringify(apexScaraDoc(), null, 2);
    const bytes = await createApexScaraProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/apex-scara-program.txt').async('string'),
        CAD_APEX_SCARA_PROGRAM
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
    assert.equal(moves.length, 2);
    assert.deepEqual(moves.map(portOf), ['A', 'B']);
    assert.equal(sliderMoves.length, 2);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['C', 'C']);
    assert.equal(stopMotors.length, 2);
    assert.deepEqual(stopMotors.map(portOf), ['A', 'B']);
    assert.equal(stopSliders.length, 1);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createApexScaraProject validates A/B servo hinges and C quill slider', async () => {
    const missingA = apexScaraDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createApexScaraProject(JSON.stringify(missingA)), /port A/);

    const missingC = apexScaraDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createApexScaraProject(JSON.stringify(missingC)), /port C/);
});
