// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createAegisSentryProject,
    CAD_AEGIS_SENTRY_PROGRAM
} from '../scripts/create-aegis-sentry-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function aegisSentryDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#be123c'
    });
    const doc = createDocument('Aegis 3-axis sentry gate');
    doc.version = 8;
    doc.id = 'robot-aegis-sentry';
    doc.roots = ['outpost', 'sweep-boom', 'gate-bar', 'latch'];
    doc.nodes = {
        outpost: body('outpost'),
        'sweep-boom': body('sweep-boom'),
        'gate-bar': body('gate-bar'),
        latch: body('latch')
    };
    doc.joints = [
        {
            id: 'sweep-a',
            kind: 'hinge',
            bodyA: 'outpost',
            bodyB: 'sweep-boom',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-2.09, 2.09],
            control: {port: 'A'}
        },
        {
            id: 'gate-b',
            kind: 'slider',
            bodyA: 'outpost',
            bodyB: 'gate-bar',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-26, 26],
            control: {port: 'B'}
        },
        {
            id: 'latch-c',
            kind: 'hinge',
            bodyA: 'outpost',
            bodyB: 'latch',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-1.13, 1.13],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createAegisSentryProject embeds the authored CAD project and A/B/C sentry blocks', async () => {
    const text = JSON.stringify(aegisSentryDoc(), null, 2);
    const bytes = await createAegisSentryProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/aegis-sentry-program.txt').async('string'),
        CAD_AEGIS_SENTRY_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const sliderPortOf = block => byId[block.inputs.SLIDER[1]].fields.sliders[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const sliderMoves = blocks.filter(block => block.opcode === 'cadlab_runSliderDistance');
    assert.equal(moves.length, 3);
    assert.deepEqual(moves.map(portOf), ['C', 'A', 'A']);
    assert.equal(sliderMoves.length, 1);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['B']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createAegisSentryProject validates A/C servo hinges and B gate slider', async () => {
    const missingA = aegisSentryDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createAegisSentryProject(JSON.stringify(missingA)), /port A/);

    const missingB = aegisSentryDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createAegisSentryProject(JSON.stringify(missingB)), /port B/);

    const missingC = aegisSentryDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createAegisSentryProject(JSON.stringify(missingC)), /port C/);
});
