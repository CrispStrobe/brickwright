// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createBorealLauncherProject,
    CAD_BOREAL_LAUNCHER_PROGRAM
} from '../scripts/create-boreal-launcher-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function borealLauncherDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#16a34a'
    });
    const doc = createDocument('Boreal 3-axis ball launcher');
    doc.version = 8;
    doc.id = 'robot-boreal-launcher';
    doc.roots = ['base', 'turret', 'flywheel', 'feeder'];
    doc.nodes = {
        base: body('base'),
        turret: body('turret'),
        flywheel: body('flywheel'),
        feeder: body('feeder')
    };
    doc.joints = [
        {
            id: 'yaw-a',
            kind: 'hinge',
            bodyA: 'base',
            bodyB: 'turret',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-1.05, 1.05],
            control: {port: 'A'}
        },
        {
            id: 'roller-b',
            kind: 'hinge',
            bodyA: 'turret',
            bodyB: 'flywheel',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            control: {port: 'B'}
        },
        {
            id: 'feeder-c',
            kind: 'slider',
            bodyA: 'base',
            bodyB: 'feeder',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [0, 32],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createBorealLauncherProject embeds the authored CAD project and A/B/C launcher blocks', async () => {
    const text = JSON.stringify(borealLauncherDoc(), null, 2);
    const bytes = await createBorealLauncherProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/boreal-launcher-program.txt').async('string'),
        CAD_BOREAL_LAUNCHER_PROGRAM
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
    assert.deepEqual(moves.map(portOf), ['A', 'B']);
    assert.equal(sliderMoves.length, 2);
    assert.deepEqual(sliderMoves.map(sliderPortOf), ['C', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createBorealLauncherProject validates A yaw hinge, B continuous roller, and C feeder slider', async () => {
    const missingA = borealLauncherDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createBorealLauncherProject(JSON.stringify(missingA)), /port A/);

    const missingB = borealLauncherDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createBorealLauncherProject(JSON.stringify(missingB)), /port B/);

    const missingC = borealLauncherDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createBorealLauncherProject(JSON.stringify(missingC)), /port C/);
});
