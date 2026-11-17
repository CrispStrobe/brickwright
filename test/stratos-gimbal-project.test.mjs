// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createStratosGimbalProject,
    CAD_STRATOS_GIMBAL_PROGRAM
} from '../scripts/create-stratos-gimbal-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function stratosGimbalDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#0284c7'
    });
    const doc = createDocument('Stratos 3-axis gimbal stage');
    doc.version = 8;
    doc.id = 'robot-stratos-gimbal';
    doc.roots = ['base', 'yaw-yoke', 'pitch-frame', 'sensor-pod'];
    doc.nodes = {
        base: body('base'),
        'yaw-yoke': body('yaw-yoke'),
        'pitch-frame': body('pitch-frame'),
        'sensor-pod': body('sensor-pod')
    };
    doc.joints = [
        {
            id: 'yaw-a',
            kind: 'hinge',
            bodyA: 'base',
            bodyB: 'yaw-yoke',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-2.09, 2.09],
            control: {port: 'A'}
        },
        {
            id: 'pitch-b',
            kind: 'hinge',
            bodyA: 'yaw-yoke',
            bodyB: 'pitch-frame',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-1.31, 1.31],
            control: {port: 'B'}
        },
        {
            id: 'roll-c',
            kind: 'hinge',
            bodyA: 'pitch-frame',
            bodyB: 'sensor-pod',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-1.57, 1.57],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createStratosGimbalProject embeds the authored CAD project and A/B/C gimbal blocks', async () => {
    const serialized = JSON.stringify(stratosGimbalDoc());
    const sb3 = await createStratosGimbalProject(serialized);
    const zip = await JSZip.loadAsync(sb3);
    const embeddedCad = await zip.file(CAD_PROJECT_PATH)?.async('string');
    assert.equal(embeddedCad, serialized);
    const project = JSON.parse(await zip.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    assert.equal(moves.length, 4);
    assert.deepEqual(moves.map(portOf), ['A', 'B', 'C', 'A']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
    const embeddedProgram = await zip.file('brickwright/stratos-gimbal-program.txt')?.async('string');
    assert.equal(embeddedProgram, CAD_STRATOS_GIMBAL_PROGRAM);
});

test('createStratosGimbalProject validates A/B/C servo hinges', async () => {
    const doc = stratosGimbalDoc();
    doc.joints = doc.joints.filter(joint => joint.control.port !== 'C');
    await assert.rejects(
        createStratosGimbalProject(JSON.stringify(doc)),
        /angular servo hinge with limits at port C/
    );
});
