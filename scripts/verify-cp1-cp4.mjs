// SPDX-License-Identifier: BSD-3-Clause
// Exercise the gallery wiring and original teaching program on one board clock.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {parseCp1Program} from '../overlay/scratch-gui/src/lib/cp1-program.js';

const {values: args} = parseArgs({options: {
    board: {type: 'string'}, circuit: {type: 'string'}, rom: {type: 'string'}, bank: {type: 'boolean'}, capstone: {type: 'boolean'}
}});
assert.ok(args.board && args.circuit && args.rom, 'Pass --board, --circuit and --rom');
const load = (directory, file) => import(pathToFileURL(resolve(directory, file)).href);
const engine = await load(args.board, 'src/index.js');
const {createCp1Adapter} = await load(args.board, 'src/cp1-adapter.js');
const {setEngine} = await load(args.circuit, 'src/engine.js');
const {Circuit} = await load(args.circuit, 'src/model/circuit.js');
engine.registerAllDevices();
setEngine(engine);

assert.ok(!(args.bank && args.capstone), 'Choose either --bank or --capstone');
const example = args.capstone ? 'cp1-cp3-cp4-relay-sequence' :
    (args.bank ? 'cp1-cp4-relay-bank' : 'cp1-cp4-relay-signals');
const gallery = new URL(`../overlay/scratch-gui/examples/${example}/`, import.meta.url);
const json = JSON.parse(readFileSync(new URL('circuit.json', gallery), 'utf8'));
const source = readFileSync(new URL('program.cp1', gallery), 'utf8');
const program = parseCp1Program(source, {expansion: Boolean(args.capstone)});
assert.ok(program.ok, JSON.stringify(program.errors));
const circuit = Circuit.fromJSON(json);
const board = circuit.board;
const adapter = createCp1Adapter({rom: readFileSync(args.rom), partId: 'cp1', expansion: Boolean(args.capstone)});
adapter.attachBoard(board);
const {machine} = adapter;
const advance = ms => adapter.advanceNs(ms * 1e6);
const key = name => {
    machine.setKey(name, true);
    advance(40);
    machine.setKey(name, false);
    advance(40);
};

const netFor = (part, terminal) => {
    const net = board.getNets().find(item => item.terminals.some(pin => pin.part === part && pin.terminal === terminal));
    assert.ok(net, `${part}.${terminal} must be wired`);
    return net.id;
};
const channels = args.bank
    ? Array.from({length: 8}, (_, bit) => ({relay: `relay${bit + 1}`, load: `load${bit + 1}`, feed: 'a', returnPin: 'b'}))
    : ['entry', 'exit'].map(name => ({relay: `${name}-relay`, load: `${name}-lamp`, feed: 'anode', returnPin: 'cathode'}));
const logicGround = netFor(args.bank ? 'ground' : 'logic-ground', 'gnd');
const lampReturn = netFor('load-supply', 'neg');
const lampFeed = netFor('load-supply', 'pos');
assert.notEqual(lampReturn, logicGround);
assert.notEqual(lampFeed, logicGround);
for (const {relay, load, returnPin} of channels) {
    assert.equal(netFor(load, returnPin), lampReturn);
    assert.equal(netFor(relay, 'com'), lampFeed);
}

const observations = [];
const outputPort = args.capstone ? 4 : 2;
function expectSignals(expected, label) {
    const ports = machine.getPortState(outputPort);
    assert.equal(ports.latch, expected, label);
    const currents = channels.map(({relay, load, feed}, bit) => {
        const energized = Boolean(expected & (1 << bit));
        const current = -board.branchCurrent(load, feed);
        assert.equal(board.getDeviceState(relay).energized, energized, `${label}: ${relay} contact`);
        if (energized) {
            assert.ok(current > 0.002 && current < 0.004, `${label}: ${load} carries ${current} A`);
        } else {
            assert.ok(Math.abs(current) < 1e-6, `${label}: ${load} leakage ${current} A`);
        }
        return current;
    });
    assert.equal(board.transientAnalysisStatus().failure, null);
    observations.push({label, latch: ports.latch, [args.bank ? 'loadAmps' : 'lampAmps']: currents});
    if (args.bank) console.error(`CP4 passed ${label}`);
}

advance(300);
expectSignals(255, 'startup');
function startProgram() {
    for (const {address, opcode, operand} of program.words) machine.writeCell(address, opcode, operand);
    for (const name of ['0', '0', '0', 'PC', 'RUN']) key(name);
    if (!args.capstone) expectSignals(0, 'idle');
}

if (args.capstone) {
    assert.equal(netFor('cp1', 'P4.0'), netFor('entry-base', 'a'));
    assert.equal(netFor('cp1', 'P4.1'), netFor('exit-base', 'a'));
    assert.equal(machine.capacity, 256);
    const baseLatch = machine.getPortState(2).latch;
    startProgram();
    assert.deepEqual(machine.readCell(128), {opcode: 0, operand: 1});
    assert.deepEqual(machine.readCell(255), {opcode: 0, operand: 2});
    function waitForSignals(expected, label) {
        for (let elapsed = 0; elapsed < 1000 && machine.getPortState(4).latch !== expected; elapsed += 25) {
            advance(25);
        }
        advance(20); // Let the electrical outputs settle after the latch changes.
        expectSignals(expected, label);
    }
    waitForSignals(1, 'read first expansion cell');
    waitForSignals(2, 'read last expansion cell');
    machine.writeCell(255, 0, 3);
    waitForSignals(0, 'dark phase');
    waitForSignals(1, 'first expansion cell unaffected');
    waitForSignals(3, 'edit takes effect on the next pass');
    assert.equal(machine.getPortState(2).latch, baseLatch);
    console.log(JSON.stringify({observations}, null, 2));
} else if (args.bank) {
    startProgram();
    let previous = 0;
    for (const value of [1, 2, 4, 8, 16, 32, 64, 128, 85, 170, 255, 0]) {
        for (let bit = 0; bit < 8; bit++) {
            if ((previous ^ value) & (1 << bit)) {
                circuit.setControl(`switch${bit + 1}`, (value >> bit) & 1);
            }
        }
        previous = value;
        advance(100);
        assert.equal(machine.getPortState(1).value, 255 - value);
        assert.deepEqual(machine.readCell(program.symbols.INPUTS), {opcode: 0, operand: 255 - value});
        expectSignals(value, `request byte ${value}`);
    }
    // The released input must charge through the documented bias network.
    const input = netFor('cp1', 'P1.0');
    circuit.setControl('switch1', 1);
    advance(1);
    const closed = board.nodeVoltage(input);
    circuit.setControl('switch1', 0);
    advance(0.010);
    const early = board.nodeVoltage(input);
    advance(0.190);
    const settled = board.nodeVoltage(input);
    assert.ok(closed >= -0.01 && closed < 0.1, `closed: ${closed}`);
    assert.ok(early > closed + 0.2 && early < 1.5, `early: ${early}`);
    assert.ok(settled > 3.3 && settled < 3.7, `settled: ${settled}`);
    assert.equal(board.transientAnalysisStatus().failure, null);
    console.log(JSON.stringify({observations, inputFilterVolts: {closed, early, settled}}, null, 2));
} else {
    const transitions = [];
    let latch = machine.getPortState(2).latch;
    const stopRecording = machine.addPortListener((port, state) => {
        if (port !== 2 || state.latch === latch) return;
        latch = state.latch;
        transitions.push(latch);
    });
    startProgram();
    for (let request = 1; request <= 2; request++) {
        circuit.setControl('request', 1);
        advance(80);
        expectSignals(1, `request ${request}, entry`);
        advance(220);
        expectSignals(2, `request ${request}, exit`);
        advance(300);
        expectSignals(0, `request ${request}, held closed`);
        if (request === 1) {
            circuit.setControl('request', 0);
            advance(80);
            expectSignals(0, 'rearmed');
        }
    }
    stopRecording();
    assert.deepEqual(transitions, [0, 1, 2, 0, 1, 2, 0]);
    console.log(JSON.stringify({transitions, observations}, null, 2));
}
