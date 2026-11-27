// SPDX-License-Identifier: BSD-3-Clause
// Exercise the installed supplier packages together, through the same engine
// injection and circuit serialization boundary used by Brickwright's Circuits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {BoardImpl} from 'bw-board/board.js';
import {getDevice} from 'bw-board/devices.js';
import {registerAllDevices} from 'bw-board/register-all.js';
import {inferNetlist, checkWiring} from 'bw-board/infer-netlist.js';
import {setEngine} from 'bw-circuit-ui/engine.js';
import {Circuit} from 'bw-circuit-ui/model/circuit.js';
import {registerSidecar} from 'bw-circuit-ui/model/parts-registry.js';
import {classifyRunPins} from 'bw-circuit-ui/model/simulation.js';

const require = createRequire(import.meta.url);
const kind = 'busch-microtronic';
const MS = 1_000_000n;
const terminals = ['IN1', 'IN2', 'IN3', 'IN4', 'OUT1', 'OUT2', 'OUT3', 'OUT4', 'CLOCK', '5v', 'gnd'];
const echo = 'FD0 FE0 C00'; // Busch quick reference: DIN R0; DOT R0; GOTO 00.

registerAllDevices();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice});

test('installed Board and Circuits packages agree on the Microtronic connector', () => {
    const device = getDevice(kind);
    assert.ok(device, 'the pinned engine must register the Microtronic');
    assert.deepEqual(device.terminals, terminals);
    const sidecarPath = require.resolve(`bw-circuit-ui/parts-data/${kind}.json`);
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
    assert.deepEqual(sidecar.terminals.map(terminal => terminal.name), terminals);
    registerSidecar(sidecar);
    const circuit = new Circuit(5);
    const computer = circuit.addPart(kind, {program: echo, instructionHz: 20}, 260, 240);
    assert.deepEqual(computer.terminals, terminals);
    assert.deepEqual(classifyRunPins({parts: circuit.parts, wires: []}),
        {mcu: null, outputPins: [], inputPins: [], analogPins: []},
        'the illustrative MCU driver must never override the Microtronic program');
});

function echoCircuit() {
    const circuit = new Circuit(5);
    const computer = circuit.addPart(kind, {program: echo, instructionHz: 20}, 260, 240);
    const button = circuit.addPart('switch', {}, 100, 140);
    const resistor = circuit.addPart('resistor', {ohms: 1000}, 510, 180);
    const led = circuit.addPart('led', {vf: 2, color: 'red'}, 620, 180);
    for (const [from, terminal, to, target] of [
        [computer, '5v', button, 'a'], [button, 'b', computer, 'IN1'],
        [computer, 'OUT1', resistor, 'a'], [resistor, 'b', led, 'anode'],
        [led, 'cathode', computer, 'gnd']
    ]) assert.ok(circuit.addWire(from.id, terminal, to.id, target));
    return {circuit, computer, button, led};
}

test('a saved Microtronic circuit executes input echo through actual switch and LED nets', () => {
    const {circuit: original, computer, button, led} = echoCircuit();
    const saved = JSON.parse(JSON.stringify(original.toJSON()));
    const circuit = Circuit.fromJSON(saved);
    assert.equal(circuit.parts.find(part => part.id === computer.id).params.program, echo);
    assert.equal(circuit.wires.length, 5);
    const board = circuit.board;
    const state = () => board.getDeviceState(computer.id);
    assert.equal(state().running, false, 'opening a saved circuit does not start its program');
    board.setDeviceControl(computer.id, 'run', 0);
    circuit.advanceTo(200n * MS);
    assert.equal(state().output, 0);
    assert.ok(circuit.ledBrightness(led.id) < 0.01);

    circuit.setControl(button.id, 1);
    circuit.advanceTo(450n * MS);
    assert.equal(state().input, 1);
    assert.equal(state().output, 1, 'DIN and DOT must carry the solved input to the output');
    assert.ok(circuit.ledBrightness(led.id) > 0.01, 'the output must supply actual LED current');

    board.setDeviceControl(computer.id, 'halt');
    const stoppedPc = state().pc;
    circuit.setControl(button.id, 0);
    circuit.advanceTo(700n * MS);
    assert.equal(state().pc, stoppedPc);
    assert.equal(state().output, 1, 'halt retains the output latch');

    board.setDeviceControl(computer.id, 'run');
    circuit.advanceTo(950n * MS);
    assert.equal(state().output, 0);
    assert.ok(circuit.ledBrightness(led.id) < 0.01);
    board.setDeviceControl(computer.id, 'reset');
    assert.deepEqual(state().program.slice(0, 3), [0xFD0, 0xFE0, 0xC00]);
    assert.equal(state().running, false);
});

test('the one-hertz terminal reaches the program only through an authored wire', () => {
    for (const wired of [false, true]) {
        const circuit = new Circuit(5);
        const computer = circuit.addPart(kind, {program: echo, instructionHz: 20}, 200, 200);
        if (wired) assert.ok(circuit.addWire(computer.id, 'CLOCK', computer.id, 'IN4'));
        const board = circuit.board;
        board.setDeviceControl(computer.id, 'run', 0);
        const observed = new Set();
        for (let ms = 200; ms <= 1600; ms += 100) {
            circuit.advanceTo(BigInt(ms) * MS);
            observed.add(board.getDeviceState(computer.id).output);
        }
        assert.deepEqual([...observed].sort((a, b) => a - b), wired ? [0, 8] : [0],
            'CLOCK is an independent terminal, with IN4 representing bit weight 8');
    }
});
