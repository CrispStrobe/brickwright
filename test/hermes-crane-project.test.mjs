// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createHermesCraneProject,
    CAD_HERMES_CRANE_PROGRAM
} from '../scripts/create-hermes-crane-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function hermesCraneDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#0d9488'
    });
    const doc = createDocument('Hermes 3-axis bridge crane');
    doc.version = 8;
    doc.id = 'robot-hermes-crane';
    doc.roots = ['gantry', 'trolley', 'hook-bar', 'spreader'];
    doc.nodes = {
        gantry: body('gantry'),
        trolley: body('trolley'),
        'hook-bar': body('hook-bar'),
        spreader: body('spreader')
    };
    doc.joints = [
        {
            id: 'bridge-a',
            kind: 'slider',
            bodyA: 'gantry',
            bodyB: 'trolley',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-32, 32],
            control: {port: 'A'}
        },
        {
            id: 'hoist-b',
            kind: 'slider',
            bodyA: 'trolley',
            bodyB: 'hook-bar',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-16, 0],
            control: {port: 'B'}
        },
        {
            id: 'swivel-c',
            kind: 'hinge',
            bodyA: 'hook-bar',
            bodyB: 'spreader',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, -1],
            axisB: [0, 0, -1],
            limits: [-2.09, 2.09],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createHermesCraneProject embeds the authored CAD project and A/B/C crane blocks', async () => {
    const text = JSON.stringify(hermesCraneDoc(), null, 2);
    const bytes = await createHermesCraneProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/hermes-crane-program.txt').async('string'),
        CAD_HERMES_CRANE_PROGRAM
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
    assert.deepEqual(moves.map(portOf), ['C']);
    assert.equal(sliderMoves.length, 3);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['B', 'A', 'B']);
    assert.equal(stopMotors.length, 1);
    assert.deepEqual(stopMotors.map(portOf), ['C']);
    assert.equal(stopSliders.length, 2);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['A', 'B']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createHermesCraneProject validates A/B sliders and C swivel hinge', async () => {
    const missingA = hermesCraneDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createHermesCraneProject(JSON.stringify(missingA)), /port A/);

    const missingC = hermesCraneDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createHermesCraneProject(JSON.stringify(missingC)), /port C/);
});
