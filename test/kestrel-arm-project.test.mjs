// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createKestrelArmProject,
    CAD_KESTREL_ARM_PROGRAM
} from '../scripts/create-kestrel-arm-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function kestrelArmDoc() {
    const body = (id, x, y, z) => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [x, y, z], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#d97736'
    });
    const doc = createDocument('Kestrel 3-servo arm');
    doc.id = 'robot-kestrel-arm';
    doc.roots = ['pedestal', 'turret', 'boom', 'jaw'];
    doc.nodes = {
        pedestal: body('pedestal', 0, 0, 0),
        turret: body('turret', 0, 0, 33.5),
        boom: body('boom', 0, -5, 62),
        jaw: body('jaw', 110, -15.5, 74)
    };
    doc.joints = [
        {
            id: 'yaw-a',
            kind: 'hinge',
            bodyA: 'pedestal',
            bodyB: 'turret',
            anchorA: [0, 0, 31.98],
            anchorB: [0, 0, 31.98],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-Math.PI / 2, Math.PI / 2],
            control: {port: 'A'}
        },
        {
            id: 'lift-b',
            kind: 'hinge',
            bodyA: 'turret',
            bodyB: 'boom',
            anchorA: [0, -8.18, 62],
            anchorB: [0, -8.18, 62],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-Math.PI / 4, Math.PI / 4],
            control: {port: 'B'}
        },
        {
            id: 'grip-c',
            kind: 'hinge',
            bodyA: 'boom',
            bodyB: 'jaw',
            anchorA: [110, -15, 74],
            anchorB: [110, -15, 74],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.26, 0.79],
            control: {port: 'C'}
        }
    ];
    return doc;
}

test('createKestrelArmProject embeds the authored CAD project and A/B/C pick-and-place blocks', async () => {
    const text = JSON.stringify(kestrelArmDoc(), null, 2);
    const bytes = await createKestrelArmProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/kestrel-arm-program.txt').async('string'),
        CAD_KESTREL_ARM_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const stop = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    assert.equal(moves.length, 6);
    assert.deepEqual(moves.map(portOf), ['B', 'C', 'B', 'A', 'B', 'C']);
    assert.equal(stop.length, 3);
    assert.deepEqual(stop.map(portOf), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createKestrelArmProject validates A/B/C servo ports and limits', async () => {
    const missingB = kestrelArmDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createKestrelArmProject(JSON.stringify(missingB)), /port B/);

    const unlimitedA = kestrelArmDoc();
    delete unlimitedA.joints.find(joint => joint.control?.port === 'A').limits;
    await assert.rejects(createKestrelArmProject(JSON.stringify(unlimitedA)), /limits at port A/);

    const invalid = kestrelArmDoc();
    invalid.version = 999;
    await assert.rejects(createKestrelArmProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
