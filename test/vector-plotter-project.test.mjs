// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createVectorPlotterProject,
    CAD_VECTOR_PLOTTER_PROGRAM
} from '../scripts/create-vector-plotter-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function vectorPlotterDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#6366f1'
    });
    const doc = createDocument('Vector 3-axis XY plotter');
    doc.version = 8;
    doc.id = 'robot-vector-plotter';
    doc.roots = ['frame', 'bridge', 'carriage', 'pen-arm'];
    doc.nodes = {
        frame: body('frame'),
        bridge: body('bridge'),
        carriage: body('carriage'),
        'pen-arm': body('pen-arm')
    };
    doc.joints = [
        {
            id: 'y-axis-a',
            kind: 'slider',
            bodyA: 'frame',
            bodyB: 'bridge',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-35, 35],
            control: {port: 'A'}
        },
        {
            id: 'x-axis-b',
            kind: 'slider',
            bodyA: 'bridge',
            bodyB: 'carriage',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-30, 30],
            control: {port: 'B'}
        },
        {
            id: 'pen-c',
            kind: 'hinge',
            bodyA: 'carriage',
            bodyB: 'pen-arm',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-0.96, 0.96],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createVectorPlotterProject embeds the authored CAD project and A/B/C plotter blocks', async () => {
    const text = JSON.stringify(vectorPlotterDoc(), null, 2);
    const bytes = await createVectorPlotterProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/vector-plotter-program.txt').async('string'),
        CAD_VECTOR_PLOTTER_PROGRAM
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
    assert.deepEqual(moves.map(portOf), ['C', 'C']);
    assert.equal(sliderMoves.length, 2);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['A', 'B']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createVectorPlotterProject validates A/B gantry sliders and C stylus servo', async () => {
    const missingA = vectorPlotterDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createVectorPlotterProject(JSON.stringify(missingA)), /port A/);

    const missingB = vectorPlotterDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createVectorPlotterProject(JSON.stringify(missingB)), /port B/);

    const missingC = vectorPlotterDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createVectorPlotterProject(JSON.stringify(missingC)), /port C/);
});
