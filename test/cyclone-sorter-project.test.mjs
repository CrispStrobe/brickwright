// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createCycloneSorterProject,
    CAD_CYCLONE_SORTER_PROGRAM
} from '../scripts/create-cyclone-sorter-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function cycloneSorterDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#0ea5e9'
    });
    const doc = createDocument('Cyclone 2-axis gantry sorter');
    doc.version = 8;
    doc.id = 'robot-cyclone-sorter';
    doc.roots = ['frame', 'bridge', 'shuttle', 'paddle'];
    doc.nodes = {
        frame: body('frame'),
        bridge: body('bridge'),
        shuttle: body('shuttle'),
        paddle: body('paddle')
    };
    doc.joints = [
        {
            id: 'gantry-a',
            kind: 'slider',
            bodyA: 'frame',
            bodyB: 'bridge',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-40, 40],
            control: {port: 'A'}
        },
        {
            id: 'gantry-b',
            kind: 'slider',
            bodyA: 'bridge',
            bodyB: 'shuttle',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-35, 35],
            control: {port: 'B'}
        },
        {
            id: 'sweeper-c',
            kind: 'hinge',
            bodyA: 'shuttle',
            bodyB: 'paddle',
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

test('createCycloneSorterProject embeds the authored CAD project and A/B slider + C servo blocks', async () => {
    const text = JSON.stringify(cycloneSorterDoc(), null, 2);
    const bytes = await createCycloneSorterProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/cyclone-sorter-program.txt').async('string'),
        CAD_CYCLONE_SORTER_PROGRAM
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
    const motorStops = blocks.filter(block => block.opcode === 'cadlab_stopMotor');

    assert.equal(sliderMoves.length, 3);
    assert.deepEqual(sliderMoves.map(sliderPort), ['A', 'B', 'B']);
    assert.equal(sliderStops.length, 2);
    assert.deepEqual(sliderStops.map(sliderPort), ['A', 'B']);
    assert.equal(servoMoves.length, 3);
    assert.deepEqual(servoMoves.map(motorPort), ['C', 'C', 'C']);
    assert.equal(motorStops.length, 1);
    assert.equal(motorPort(motorStops[0]), 'C');
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createCycloneSorterProject validates A/B sliders and servo C limits', async () => {
    const missingB = cycloneSorterDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createCycloneSorterProject(JSON.stringify(missingB)), /slider at port B/);

    const unlimitedC = cycloneSorterDoc();
    delete unlimitedC.joints.find(joint => joint.control?.port === 'C').limits;
    await assert.rejects(createCycloneSorterProject(JSON.stringify(unlimitedC)), /servo hinge at port C/);

    const invalid = cycloneSorterDoc();
    invalid.version = 999;
    await assert.rejects(createCycloneSorterProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
