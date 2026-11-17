// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createPolarisTrackerProject,
    CAD_POLARIS_TRACKER_PROGRAM
} from '../scripts/create-polaris-tracker-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function polarisTrackerDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#0891b2'
    });
    const doc = createDocument('Polaris 3-axis pan-tilt tracker');
    doc.version = 8;
    doc.id = 'robot-polaris-tracker';
    doc.roots = ['rail-base', 'carriage', 'yoke', 'sensor-head'];
    doc.nodes = {
        'rail-base': body('rail-base'),
        carriage: body('carriage'),
        yoke: body('yoke'),
        'sensor-head': body('sensor-head')
    };
    doc.joints = [
        {
            id: 'rail-a',
            kind: 'slider',
            bodyA: 'rail-base',
            bodyB: 'carriage',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-35, 35],
            control: {port: 'A'}
        },
        {
            id: 'pan-b',
            kind: 'hinge',
            bodyA: 'carriage',
            bodyB: 'yoke',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-2.09, 2.09],
            control: {port: 'B'}
        },
        {
            id: 'tilt-c',
            kind: 'hinge',
            bodyA: 'yoke',
            bodyB: 'sensor-head',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-1.13, 1.13],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createPolarisTrackerProject embeds the authored CAD project and A/B/C tracker blocks', async () => {
    const text = JSON.stringify(polarisTrackerDoc(), null, 2);
    const bytes = await createPolarisTrackerProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/polaris-tracker-program.txt').async('string'),
        CAD_POLARIS_TRACKER_PROGRAM
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
    assert.deepEqual(moves.map(portOf), ['B', 'C', 'B', 'C']);
    assert.equal(sliderMoves.length, 1);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['A']);
    assert.equal(stopMotors.length, 2);
    assert.deepEqual(stopMotors.map(portOf), ['B', 'C']);
    assert.equal(stopSliders.length, 1);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['A']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createPolarisTrackerProject validates A rail slider and B/C servo hinges', async () => {
    const missingA = polarisTrackerDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createPolarisTrackerProject(JSON.stringify(missingA)), /port A/);

    const missingC = polarisTrackerDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createPolarisTrackerProject(JSON.stringify(missingC)), /port C/);
});
