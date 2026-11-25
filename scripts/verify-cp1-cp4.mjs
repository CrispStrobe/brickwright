// SPDX-License-Identifier: BSD-3-Clause
// Exercise the gallery wiring and original teaching program on one board clock.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {parseCp1Program} from '../overlay/scratch-gui/src/lib/cp1-program.js';

const {values: args} = parseArgs({options: {
    board: {type: 'string'}, circuit: {type: 'string'}, rom: {type: 'string'}
}});
assert.ok(args.board && args.circuit && args.rom, 'Pass --board, --circuit and --rom');
const load = (directory, file) => import(pathToFileURL(resolve(directory, file)).href);
const engine = await load(args.board, 'src/index.js');
const {createCp1Adapter} = await load(args.board, 'src/cp1-adapter.js');
const {setEngine} = await load(args.circuit, 'src/engine.js');
const {Circuit} = await load(args.circuit, 'src/model/circuit.js');
engine.registerAllDevices();
setEngine(engine);

const gallery = new URL('../overlay/scratch-gui/examples/cp1-cp4-relay-signals/', import.meta.url);
const json = JSON.parse(readFileSync(new URL('circuit.json', gallery), 'utf8'));
const source = readFileSync(new URL('program.cp1', gallery), 'utf8');
const program = parseCp1Program(source);
assert.ok(program.ok, JSON.stringify(program.errors));
const circuit = Circuit.fromJSON(json);
const board = circuit.board;
const adapter = createCp1Adapter({rom: readFileSync(args.rom), partId: 'cp1'});
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
const logicGround = netFor('logic-ground', 'gnd');
const lampReturn = netFor('load-supply', 'neg');
assert.notEqual(lampReturn, logicGround);
for (const name of ['entry', 'exit']) {
    assert.equal(netFor(`${name}-lamp`, 'cathode'), lampReturn);
    assert.equal(netFor(`${name}-relay`, 'com'), netFor('load-supply', 'pos'));
}

const observations = [];
function expectSignals(expected, label) {
    const ports = machine.getPortState(2);
    assert.equal(ports.latch, expected, label);
    const currents = ['entry', 'exit'].map((name, bit) => {
        const energized = Boolean(expected & (1 << bit));
        const current = -board.branchCurrent(`${name}-lamp`, 'anode');
        assert.equal(board.getDeviceState(`${name}-relay`).energized, energized, `${label}: ${name} contact`);
        if (energized) {
            assert.ok(current > 0.002 && current < 0.004, `${label}: ${name} lamp carries ${current} A`);
        } else {
            assert.ok(Math.abs(current) < 1e-6, `${label}: ${name} lamp leakage ${current} A`);
        }
        return current;
    });
    assert.equal(board.transientAnalysisStatus().failure, null);
    observations.push({label, latch: ports.latch, lampAmps: currents});
}

advance(300);
expectSignals(255, 'startup');
const transitions = [];
let latch = machine.getPortState(2).latch;
const stopRecording = machine.addPortListener((port, state) => {
    if (port !== 2 || state.latch === latch) return;
    latch = state.latch;
    transitions.push(latch);
});
for (const {address, opcode, operand} of program.words) machine.writeCell(address, opcode, operand);
for (const name of ['0', '0', '0', 'PC', 'RUN']) key(name);
expectSignals(0, 'idle');
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
