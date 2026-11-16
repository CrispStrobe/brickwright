// SPDX-License-Identifier: GPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
    createHeliosCatapultProject,
    CAD_HELIOS_CATAPULT_PROGRAM
} from '../scripts/create-helios-catapult-project.mjs';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {createDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

function heliosCatapultDoc() {
    const body = id => ({
        id,
        name: id,
        kind: 'box',
        size: [10, 10, 10],
        transform: {position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1]},
        color: '#ef4444'
    });
    const doc = createDocument('Helios turret catapult');
    doc.version = 8;
    doc.id = 'robot-helios-catapult';
    doc.roots = ['pedestal', 'turret', 'arm', 'gate-base', 'goalie'];
    doc.nodes = {
        pedestal: body('pedestal'),
        turret: body('turret'),
        arm: body('arm'),
        'gate-base': body('gate-base'),
        goalie: body('goalie')
    };
    doc.joints = [
        {
            id: 'pan-a',
            kind: 'hinge',
            bodyA: 'pedestal',
            bodyB: 'turret',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 0, 1],
            axisB: [0, 0, 1],
            limits: [-1.57, 1.57],
            control: {port: 'A'}
        },
        {
            id: 'throw-b',
            kind: 'hinge',
            bodyA: 'turret',
            bodyB: 'arm',
            anchorA: [0, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [0, 1, 0],
            axisB: [0, 1, 0],
            limits: [-0.78, 1.48],
            control: {port: 'B'}
        },
        {
            id: 'gate-c',
            kind: 'hinge',
            bodyA: 'gate-base',
            bodyB: 'goalie',
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

test('createHeliosCatapultProject embeds the authored CAD project and A/B/C catapult blocks', async () => {
    const text = JSON.stringify(heliosCatapultDoc(), null, 2);
    const bytes = await createHeliosCatapultProject(text);
    const archive = await JSZip.loadAsync(bytes);
    assert.equal(await archive.file(CAD_PROJECT_PATH).async('string'), text);
    assert.equal(
        await archive.file('brickwright/helios-catapult-program.txt').async('string'),
        CAD_HELIOS_CATAPULT_PROGRAM
    );
    const project = JSON.parse(await archive.file('project.json').async('string'));
    assert.deepEqual(project.extensions, ['cadlab']);
    const byId = Object.assign({}, ...project.targets.map(target => target.blocks));
    const blocks = project.targets.flatMap(target => Object.values(target.blocks));
    const portOf = block => byId[block.inputs.MOTOR[1]].fields.motors[0];
    const moves = blocks.filter(block => block.opcode === 'cadlab_runMotorDegrees');
    const stop = blocks.filter(block => block.opcode === 'cadlab_stopMotor');
    assert.equal(moves.length, 4);
    assert.deepEqual(moves.map(portOf), ['A', 'C', 'B', 'B']);
    assert.equal(stop.length, 3);
    assert.deepEqual(stop.map(portOf), ['A', 'B', 'C']);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_startSimulation').length, 1);
    assert.equal(blocks.filter(block => block.opcode === 'cadlab_stopSimulation').length, 1);
});

test('createHeliosCatapultProject validates A/B/C servo hinges and limits', async () => {
    const missingB = heliosCatapultDoc();
    missingB.joints = missingB.joints.filter(joint => joint.control?.port !== 'B');
    await assert.rejects(createHeliosCatapultProject(JSON.stringify(missingB)), /port B/);

    const unlimitedC = heliosCatapultDoc();
    delete unlimitedC.joints.find(joint => joint.control?.port === 'C').limits;
    await assert.rejects(createHeliosCatapultProject(JSON.stringify(unlimitedC)), /limits at servo port C/);

    const invalid = heliosCatapultDoc();
    invalid.version = 999;
    await assert.rejects(createHeliosCatapultProject(JSON.stringify(invalid)), /Invalid CAD project/);
});
