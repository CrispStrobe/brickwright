// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createQuasarPressProject,
    CAD_QUASAR_PRESS_PROGRAM
} from '../scripts/create-quasar-press-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function quasarPressDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#dc2626'
    });
    const doc = createDocument('Quasar 3-axis rotary press');
    doc.version = 8;
    doc.id = 'robot-quasar-press';
    doc.roots = ['stand', 'dial-plate', 'ram', 'wiper'];
    doc.nodes = {
        stand: body('stand'),
        'dial-plate': body('dial-plate'),
        ram: body('ram'),
        wiper: body('wiper')
    };
    doc.joints = [
        {
            id: 'dial-a',
            kind: 'hinge',
            bodyA: 'stand',
            bodyB: 'dial-plate',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-2.09, 2.09],
            control: {port: 'A'}
        },
        {
            id: 'ram-b',
            kind: 'slider',
            bodyA: 'stand',
            bodyB: 'ram',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-14, 4],
            control: {port: 'B'}
        },
        {
            id: 'eject-c',
            kind: 'slider',
            bodyA: 'stand',
            bodyB: 'wiper',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [0, 26],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createQuasarPressProject embeds the authored CAD project and A/B/C press blocks', async () => {
    const text = JSON.stringify(quasarPressDoc(), null, 2);
    const bytes = await createQuasarPressProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/quasar-press-program.txt').async('string'),
        CAD_QUASAR_PRESS_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const sliderPortOf = block => byId[block.inputs.SLIDER[1]].fields.sliders[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const sliderMoves = blocks.filter(block => block.opcode === 'cadlab_runSliderDistance');
    assert.equal(moves.length, 1);
    assert.deepEqual(moves.map(portOf), ['A']);
    assert.equal(sliderMoves.length, 4);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['B', 'B', 'C', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createQuasarPressProject validates A dial hinge and B/C ram & ejector sliders', async () => {
    const missingA = quasarPressDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createQuasarPressProject(JSON.stringify(missingA)), /port A/);

    const missingB = quasarPressDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createQuasarPressProject(JSON.stringify(missingB)), /port B/);

    const missingC = quasarPressDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createQuasarPressProject(JSON.stringify(missingC)), /port C/);
});
