// SPDX-License-Identifier: BSD-3-Clause
// Node qualification fixture: load the same saved Circuit that a user opens.
import {readFileSync} from 'node:fs';
import {BoardImpl} from 'bw-board/board.js';
import {inferNetlist, checkWiring} from 'bw-board/infer-netlist.js';
import {getDevice} from 'bw-board/devices.js';
import {registerAllDevices} from 'bw-board/register-all.js';
import {Circuit} from 'bw-circuit-ui/model/circuit.js';
import {setEngine} from 'bw-circuit-ui/engine.js';

registerAllDevices();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice});

export const ROBOT_MOTOR_EXAMPLE = new URL('../../packages/crisp-basic/examples/robot-motor/', import.meta.url);

export function createCrispBasicRobotFixture({swapMotorLeads = false, powered = false} = {}) {
    const saved = JSON.parse(readFileSync(new URL('circuit.json', ROBOT_MOTOR_EXAMPLE), 'utf8'));
    if (swapMotorLeads) {
        for (const wire of saved.wires) {
            for (const end of [wire.from, wire.to]) {
                if (end.part === 'motor') end.terminal = end.terminal === 'a' ? 'b' : 'a';
            }
        }
    }
    const model = Circuit.fromJSON(saved);
    if (model.netlistError) throw new Error(`Robot Circuit was rejected: ${model.netlistError}`);
    if (model.wires.length !== saved.wires.length) throw new Error('Robot Circuit lost a saved wire');
    const board = model.board;
    board.setPower(powered);
    return {board, model, source: readFileSync(new URL('source.bas', ROBOT_MOTOR_EXAMPLE), 'utf8')};
}

export function observeCrispBasicRobotMotor(board) {
    const motor = board.getDeviceState('motor');
    const bridge = board.getDeviceState('driver');
    return {
        atMs: Number(board.getTime()) / 1000000,
        velocity: motor.velocity,
        speed: motor.omega,
        direction: motor.direction,
        angle: motor.angle,
        current: -board.branchCurrent('motor', 'a'),
        enable: board.readAnalog('d3'),
        forward: board.readAnalog('d7'),
        reverse: board.readAnalog('d8'),
        drives: structuredClone(bridge.drives)
    };
}
