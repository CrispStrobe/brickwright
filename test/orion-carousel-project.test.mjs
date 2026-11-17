// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createOrionCarouselProject,
    CAD_ORION_CAROUSEL_PROGRAM
} from '../scripts/create-orion-carousel-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function orionCarouselDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#7c3aed'
    });
    const doc = createDocument('Orion 3-axis sorting carousel');
    doc.version = 8;
    doc.id = 'robot-orion-carousel';
    doc.roots = ['base', 'turntable', 'pusher', 'diverter'];
    doc.nodes = {
        base: body('base'),
        turntable: body('turntable'),
        pusher: body('pusher'),
        diverter: body('diverter')
    };
    doc.joints = [
        {
            id: 'carousel-a',
            kind: 'hinge',
            bodyA: 'base',
            bodyB: 'turntable',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-2.09, 2.09],
            control: {port: 'A'}
        },
        {
            id: 'pusher-b',
            kind: 'slider',
            bodyA: 'base',
            bodyB: 'pusher',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [0, 48],
            control: {port: 'B'}
        },
        {
            id: 'gate-c',
            kind: 'hinge',
            bodyA: 'base',
            bodyB: 'diverter',
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

test('createOrionCarouselProject embeds the authored CAD project and A/B/C sorting blocks', async () => {
    const text = JSON.stringify(orionCarouselDoc(), null, 2);
    const bytes = await createOrionCarouselProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/orion-carousel-program.txt').async('string'),
        CAD_ORION_CAROUSEL_PROGRAM
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
    assert.deepEqual(moves.map(portOf), ['A', 'C']);
    assert.equal(sliderMoves.length, 2);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['B', 'B']);
    assert.equal(stopMotors.length, 2);
    assert.deepEqual(stopMotors.map(portOf), ['A', 'C']);
    assert.equal(stopSliders.length, 1);
    assert.deepEqual(stopSliders.map(sliderPortOf), ['B']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createOrionCarouselProject validates A/C servo hinges and B pusher slider', async () => {
    const missingA = orionCarouselDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createOrionCarouselProject(JSON.stringify(missingA)), /port A/);

    const missingB = orionCarouselDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createOrionCarouselProject(JSON.stringify(missingB)), /port B/);
});
