// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createNovaLoaderProject,
    CAD_NOVA_LOADER_PROGRAM
} from '../scripts/create-nova-loader-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function novaLoaderDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#d97706'
    });
    const doc = createDocument('Nova 3-axis wheeled loader');
    doc.version = 8;
    doc.id = 'robot-nova-loader';
    doc.roots = ['chassis', 'left-wheel', 'right-wheel', 'bucket'];
    doc.nodes = {
        chassis: body('chassis'),
        'left-wheel': body('left-wheel'),
        'right-wheel': body('right-wheel'),
        bucket: body('bucket')
    };
    doc.joints = [
        {
            id: 'drive-left-a',
            kind: 'hinge',
            bodyA: 'chassis',
            bodyB: 'left-wheel',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            control: {port: 'A'}
        },
        {
            id: 'drive-right-b',
            kind: 'hinge',
            bodyA: 'chassis',
            bodyB: 'right-wheel',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            control: {port: 'B'}
        },
        {
            id: 'bucket-c',
            kind: 'hinge',
            bodyA: 'chassis',
            bodyB: 'bucket',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.96, 0.96],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createNovaLoaderProject embeds the authored CAD project and A/B/C loader blocks', async () => {
    const text = JSON.stringify(novaLoaderDoc(), null, 2);
    const bytes = await createNovaLoaderProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/nova-loader-program.txt').async('string'),
        CAD_NOVA_LOADER_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const stopMotors = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    assert.equal(moves.length, 4);
    assert.deepEqual(moves.map(portOf), ['A', 'B', 'C', 'C']);
    assert.equal(stopMotors.length, 3);
    assert.deepEqual(stopMotors.map(portOf), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createNovaLoaderProject validates A/B drive wheels and C bucket servo', async () => {
    const missingA = novaLoaderDoc();
    missingA.joints = missingA.joints.filter(joint => joint.control?.port !== 'A');
    await assert.rejects(createNovaLoaderProject(JSON.stringify(missingA)), /port A/);

    const missingB = novaLoaderDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createNovaLoaderProject(JSON.stringify(missingB)), /port B/);

    const missingC = novaLoaderDoc();
    missingC.joints = missingC.joints.filter(joint => joint.control?.port !== 'C');
    await assert.rejects(createNovaLoaderProject(JSON.stringify(missingC)), /port C/);
});
