// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createAtlasForkliftProject,
    CAD_ATLAS_FORKLIFT_PROGRAM
} from '../scripts/create-atlas-forklift-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function atlasForkliftDoc() {
    const body = (id, x, y, z) => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [x, y, z], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#e09f3e'
    });
    const doc = createDocument('Atlas forklift rover');
    doc.version = 8;
    doc.id = 'robot-atlas-forklift';
    doc.roots = ['chassis', 'left-wheel', 'right-wheel', 'carriage', 'forks'];
    doc.nodes = {
        chassis: body('chassis', 0, 0, 0),
        'left-wheel': body('left-wheel', 0, 0, 0),
        'right-wheel': body('right-wheel', 0, 0, 0),
        carriage: body('carriage', 0, 0, 0),
        forks: body('forks', 0, 0, 0)
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
            id: 'lift-d',
            kind: 'slider',
            bodyA: 'chassis',
            bodyB: 'carriage',
            anchorA: [60, 0, 26],
            anchorB: [60, 0, 26],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [0, 48],
            control: {port: 'D'}
        },
        {
            id: 'tilt-c',
            kind: 'hinge',
            bodyA: 'carriage',
            bodyB: 'forks',
            anchorA: [65, -16, 26],
            anchorB: [65, -16, 26],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.436, 0.436],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createAtlasForkliftProject embeds the authored CAD project and A/B/C/D slider+servo+drive blocks', async () => {
    const text = JSON.stringify(atlasForkliftDoc(), null, 2);
    const bytes = await createAtlasForkliftProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/atlas-forklift-program.txt').async('string'),
        CAD_ATLAS_FORKLIFT_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const motorPort = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const sliderPort = block => byId[block.inputs.SLIDER[1]].fields.sliders[0];

    const sliderMoves = blocks.filter(block => block.opcode === 'cadlab_runSliderDistance');
    const sliderStops = blocks.filter(block => block.opcode === 'cadlab_stopSlider');
    const servoMoves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const speedDrives = blocks.filter(block => block.opcode === 'cadlab_setMotorSpeed');
    const motorStops = blocks.filter(block => block.opcode === 'cadlab_stopMotor');

    assert.equal(sliderMoves.length, 1);
    assert.equal(sliderPort(sliderMoves[0]), 'D');
    assert.equal(sliderStops.length, 1);
    assert.equal(sliderPort(sliderStops[0]), 'D');
    assert.equal(servoMoves.length, 1);
    assert.equal(motorPort(servoMoves[0]), 'C');
    assert.equal(speedDrives.length, 2);
    assert.deepEqual(speedDrives.map(motorPort), ['A', 'B']);
    assert.equal(motorStops.length, 3);
    assert.deepEqual(motorStops.map(motorPort), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createAtlasForkliftProject validates drive hinges, servo limits, and slider D', async () => {
    const missingSlider = atlasForkliftDoc();
    missingSlider.joints = missingSlider.joints.filter(joint => joint.control?.port !== 'D');
    await assert.rejects(createAtlasForkliftProject(JSON.stringify(missingSlider)), /slider at port D/);

    const unlimitedTilt = atlasForkliftDoc();
    delete unlimitedTilt.joints.find(joint => joint.control?.port === 'C').limits;
    await assert.rejects(createAtlasForkliftProject(JSON.stringify(unlimitedTilt)), /limits at servo port C/);

    const invalid = atlasForkliftDoc();
    invalid.version = 999;
    await assert.rejects(createAtlasForkliftProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
