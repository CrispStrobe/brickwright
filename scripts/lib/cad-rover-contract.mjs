// SPDX-License-Identifier: BSD-3-Clause
// The Scout demonstration's nominal control contract. This is not a collision,
// traction or manufactured-fit qualification; those remain with the CAD kit.
import assert from 'node:assert/strict';
import {parseDocument} from '../../overlay/scratch-gui/static/cad-sdk/sdk.js';

const requireRover = (condition, message) => {
    if (!condition) throw new Error(`Rover requires ${message}`);
};

// CAD body rotations are degrees, with local X then Y then Z applied (ZYX
// Euler composition). Joint axes use rotation only, never body scale. Keep
// this small adapter consistent with cad-core's documented connector frames.
const worldAxis = (axis, rotation) => {
    const [rx, ry, rz] = rotation.map(value => value * Math.PI / 180);
    const [x, y, z] = axis;
    const y1 = y * Math.cos(rx) - z * Math.sin(rx);
    const z1 = y * Math.sin(rx) + z * Math.cos(rx);
    const x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
    const z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
    const vector = [x2 * Math.cos(rz) - y1 * Math.sin(rz),
        x2 * Math.sin(rz) + y1 * Math.cos(rz), z2];
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
};
const aligned = (a, b) => Math.hypot(...a.map((value, index) => value - b[index])) <= 1e-5;

/** Validate with the shipped SDK, then check the two-drive demo's assumptions. */
export function parseCadRoverDocument (text) {
    const document = parseDocument(text);
    requireRover(document.version >= 8 && document.simulation?.fixBase === false,
        'an explicit free base (simulation.fixBase: false)');
    const drives = ['A', 'B'].map(port => {
        const matching = document.joints?.filter(joint => joint.control?.port === port) || [];
        requireRover(matching.length === 1 && matching[0].kind === 'hinge', `an angular drive at port ${port}`);
        return matching[0];
    });

    // Fixed parts share one rigid assembly in the actual SDK. Work with that
    // topology so separate motor casings, shafts and wheel parts remain valid.
    const parents = new Map(document.roots.map(id => [id, id]));
    const group = id => {
        let root = id;
        while (parents.get(root) !== root) root = parents.get(root);
        while (id !== root) {
            const parent = parents.get(id);
            parents.set(id, root);
            id = parent;
        }
        return root;
    };
    for (const joint of document.joints || []) {
        if (joint.kind === 'fixed') parents.set(group(joint.bodyB), group(joint.bodyA));
    }
    const groups = drives.map(joint => [group(joint.bodyA), group(joint.bodyB)]);
    requireRover(groups.every(pair => pair[0] !== pair[1]), 'wheel hinges that are not locked by fixed joints');
    const common = groups[0].filter(id => groups[1].includes(id));
    requireRover(common.length === 1, 'two independent wheel assemblies connected to one chassis assembly');
    const chassis = common[0];
    const moving = groups.map(pair => pair.find(id => id !== chassis));
    requireRover(moving[0] !== moving[1], 'two independent wheel assemblies');
    const drivenGroups = new Set([chassis, ...moving]);
    requireRover(document.roots.every(id => !drivenGroups.has(group(id)) ||
        document.nodes[id].physics?.motion !== 'static'), 'a dynamic chassis and dynamic wheel assemblies');

    const axes = drives.map((joint, index) => {
        const a = worldAxis(joint.axisA, document.nodes[joint.bodyA].transform.rotation);
        const b = worldAxis(joint.axisB, document.nodes[joint.bodyB].transform.rotation);
        requireRover(aligned(a, b), `matching world-space hinge axes at port ${joint.control.port}`);
        // Positive motor rotation moves bodyB relative to bodyA. Reversing the
        // connector's body order reverses the driven wheel's signed direction.
        return groups[index][0] === chassis ? a : a.map(value => -value);
    });
    requireRover(aligned(axes[0], axes[1]), 'the same signed world-space wheel axis at ports A and B');
    return document;
}

const demoSteps = [
    ['event_whenflagclicked'], ['cadlab_resetSimulation'], ['cadlab_startSimulation'],
    ['cadlab_setMotorSpeed', 'A', 120], ['cadlab_setMotorSpeed', 'B', 120], ['control_wait', 2],
    ['cadlab_stopMotor', 'A'], ['cadlab_stopMotor', 'B'], ['control_wait', 0.5],
    ['cadlab_setMotorSpeed', 'A', 90], ['cadlab_setMotorSpeed', 'B', -90], ['control_wait', 1],
    ['cadlab_stopMotor', 'A'], ['cadlab_stopMotor', 'B'], ['control_wait', 0.5],
    ['cadlab_setMotorSpeed', 'A', -120], ['cadlab_setMotorSpeed', 'B', -120], ['control_wait', 1],
    ['cadlab_stopMotor', 'A'], ['cadlab_stopMotor', 'B'],
    ['looks_say', 'TT rover demo complete'], ['cadlab_stopSimulation']
];

/** Check the executable saved block graph, independently of its source-text sidecar. */
export function assertCadRoverProgram (project) {
    const check = (condition, message) => assert.ok(condition, `Invalid Scout TT demo: ${message}`);
    const exactKeys = (object, names) => object && typeof object === 'object' &&
        !Array.isArray(object) && Object.keys(object).length === names.length &&
        names.every(name => Object.hasOwn(object, name));
    check(Array.isArray(project.targets), 'missing targets');
    assert.deepEqual(project.extensions, ['cadlab'], 'Invalid Scout TT demo: expected only the CAD models extension');
    const entries = project.targets.flatMap(target => Object.entries(target.blocks || {})
        .map(([id, block]) => ({id, block, blocks: target.blocks})));
    const hats = entries.filter(({block}) => block?.topLevel === true);
    check(hats.length === 1 && hats[0].block.opcode === 'event_whenflagclicked', 'expected one green-flag script');
    const blocks = hats[0].blocks;
    const visited = new Set();
    let id = hats[0].id;
    let parent = null;
    const literal = (block, input, type, expected) => {
        const slot = block.inputs[input];
        check(Array.isArray(slot) && slot.length === 2 && slot[0] === 1 &&
            Array.isArray(slot[1]) && slot[1].length === 2 && slot[1][0] === type,
        `${input} must be a literal`);
        check(type === 4 ? Number.isFinite(Number(slot[1][1])) && Number(slot[1][1]) === expected :
            slot[1][1] === expected, `${input} differs from the demo`);
    };
    const motor = (block, owner, port) => {
        const slot = block.inputs.MOTOR;
        check(Array.isArray(slot) && slot.length === 2 && slot[0] === 1 && typeof slot[1] === 'string',
            'motor must use its native menu shadow');
        const menu = blocks[slot[1]];
        check(menu && !visited.has(slot[1]) && menu.opcode === 'cadlab_menu_motors' &&
            menu.parent === owner && menu.next === null && menu.shadow === true && menu.topLevel === false &&
            exactKeys(menu.inputs, []) && exactKeys(menu.fields, ['motors']) &&
            Array.isArray(menu.fields.motors) && menu.fields.motors[0] === port,
        `invalid or changed motor ${port} menu`);
        visited.add(slot[1]);
    };
    for (const [index, step] of demoSteps.entries()) {
        const block = blocks[id];
        check(typeof id === 'string' && block && !visited.has(id), 'missing, cyclic or shared command');
        check(block.opcode === step[0], `command ${index + 1} must be ${step[0]}`);
        check(block.parent === parent && block.shadow === false && block.topLevel === (index === 0),
            'command ownership or linkage differs');
        check(block.mutation === undefined, 'unexpected command mutation');
        visited.add(id);
        const inputs = step[0] === 'cadlab_setMotorSpeed' ? ['MOTOR', 'SPEED'] :
            step[0] === 'cadlab_stopMotor' ? ['MOTOR'] : step[0] === 'control_wait' ? ['DURATION'] :
                step[0] === 'looks_say' ? ['MESSAGE'] : [];
        check(exactKeys(block.inputs, inputs), 'command inputs differ');
        check(exactKeys(block.fields, step[0] === 'cadlab_stopMotor' ? ['ACTION'] : []), 'command fields differ');
        if (step[0] === 'cadlab_setMotorSpeed') {
            motor(block, id, step[1]);
            literal(block, 'SPEED', 4, step[2]);
        } else if (step[0] === 'cadlab_stopMotor') {
            motor(block, id, step[1]);
            check(Array.isArray(block.fields.ACTION) && block.fields.ACTION[0] === 'brake', 'both wheels must brake');
        } else if (step[0] === 'control_wait') literal(block, 'DURATION', 4, step[1]);
        else if (step[0] === 'looks_say') literal(block, 'MESSAGE', 10, step[1]);
        parent = id;
        id = block.next;
    }
    check(id === null, 'commands follow the final simulation stop');
    check(entries.length === visited.size, 'unexpected detached blocks or additional scripts');
    return project;
}
