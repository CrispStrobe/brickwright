import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';

const root = path.resolve(import.meta.dirname, '..');
const boardPin = '818e0263fecd320d39737a580b7a73d562603c2e';
const cuiPin = '659431ce46a7b6d4ae472182b069ec301aee0df3';
async function bench(sine = false) {
    const {Circuit} = await loadCircuitModel(root);
    const circuit = Circuit.fromJSON({parts: [
        {id: 'V', kind: 'vsource', params: sine ?
            {volts: 2, wave: 'spice-sine', offset: 2, amplitude: 1, freq: 1000, td: 0, theta: 0, phase: 0} :
            {volts: 1}, x: 100, y: 100},
        {id: 'R', kind: 'resistor', params: {ohms: 1000}, x: 250, y: 100},
        {id: 'G', kind: 'gnd', params: {}, x: 100, y: 230}
    ], wires: [
        {from: {part: 'V', terminal: 'pos'}, to: {part: 'R', terminal: 'a'}},
        {from: {part: 'V', terminal: 'neg'}, to: {part: 'G', terminal: 'gnd'}},
        {from: {part: 'R', terminal: 'b'}, to: {part: 'G', terminal: 'gnd'}}
    ]});
    assert.ok(!circuit.netlistError, circuit.netlistError || 'motor netlist loads');
    circuit.setPower(true);
    const board = circuit.board;
    const signal = board.nets.find(n => n.terminals.some(t => t.part === 'V' && t.terminal === 'pos')).id;
    const {armBoardForRun} = await import(path.join(root, 'node_modules/bw-circuit-ui/src/model/simulation.js'));
    const reset = () => armBoardForRun({board, parts: circuit.parts, wires: circuit.wires,
        setPin: () => assert.fail('passive circuit must not invent MCU pins')});
    return {board, signal, reset};
}

test('scope adoption pins the qualified engine and UI in both package scopes', () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json')));
    assert.equal(pins['bw-board'], boardPin);
    assert.equal(pins['bw-circuit-ui'], cuiPin);
    for (const dir of ['', 'packages/scratch-gui']) {
        const pkg = JSON.parse(readFileSync(path.join(root, dir, 'package.json')));
        const lock = JSON.parse(readFileSync(path.join(root, dir, 'package-lock.json')));
        for (const [name, sha] of [['bw-board', boardPin], ['bw-circuit-ui', cuiPin]]) {
            assert.equal(pkg.devDependencies?.[name] ?? pkg.dependencies?.[name], `github:CrispStrobe/${name}#${sha}`);
            assert.ok(lock.packages[`node_modules/${name}`].resolved.endsWith(`#${sha}`));
        }
    }
});

test('installed Circuit and shared Sim arming capture every first post-reset envelope', async () => {
    const {board, signal, reset} = await bench();
    board.advanceTo(20000n);
    const handle = board.addScopeChannel({type: 'voltage', netId: signal, sampleRateHz: 100000, depth: 8192});
    board.advanceTo(55000n);
    assert.equal(board.getScopeData(handle).count, 3, 'real nonempty late capture');
    reset();
    assert.equal(board.getTime(), 0n);
    assert.deepEqual(board.getScopeChannels(), [handle]);
    const empty = board.getScopeData(handle);
    assert.equal(empty.count, 0); assert.equal(empty.writeIndex, 0);
    assert.ok([...empty.samples].every(Number.isNaN));
    board.advanceTo(50000000n);
    const complete = board.getScopeData(handle);
    assert.equal(complete.count, 5000); assert.equal(complete.startTNs, 0n);
    assert.ok([...complete.samples.slice(0, 10000)].every(v => v === 1));
});

test('installed Sim reset preserves genuine finite-analysis refusal', async () => {
    const {board, signal, reset} = await bench(true);
    const handle = board.addScopeChannel({type: 'voltage', netId: signal});
    assert.throws(() => board.advanceToBounded(500000n, {maxAttempts: 1, maxSolves: 1, maxAdvances: 1}));
    assert.throws(() => board.getScopeData(handle), e => e.code === 'SOLVE_FAILED_MEASUREMENT');
    reset();
    assert.throws(() => board.getScopeData(handle), e => e.code === 'SOLVE_FAILED_MEASUREMENT');
    const fresh = await bench();
    const other = fresh.board.addScopeChannel({type: 'voltage', netId: fresh.signal});
    fresh.board.advanceTo(10000n);
    assert.equal(fresh.board.getScopeData(other).count, 1, 'fresh valid acquisition positive control');
});

test('installed motor fixture completes startup, off and restart with the public interactive policy', async () => {
    const {Circuit} = await loadCircuitModel(root);
    const fixture = JSON.parse(readFileSync(path.join(root,
        'overlay/scratch-gui/examples/54-motor-driver/circuit.stc12c5a60s2.json')));
    const circuit = Circuit.fromJSON(fixture);
    assert.equal(circuit.netlistError, null);
    circuit.setPower(true);
    const board = circuit.board;
    const {armBoardForRun} = await import(path.join(root, 'node_modules/bw-circuit-ui/src/model/simulation.js'));
    armBoardForRun({board, parts: circuit.parts, wires: circuit.wires,
        setPin: (...args) => board.setPin(...args)});
    board.setPin('P1.0', 'pushpull', false);
    assert.equal(board.transientAnalysisStatus().profile.id, 'interactive-v2');
    for (const [end, on] of [[1000000n, true], [2000000n, false],
        [3000000n, true], [10000000n, true]]) {
        board.setPin('P1.4', 'quasi', on);
        let receipt;
        for (let calls = 0; calls < 100; calls++) {
            receipt = board.advanceToLive(end, {maxSteps: 16});
            if (receipt.completed) break;
        }
        assert.equal(receipt.completed, true, `motor reaches ${end} ns`);
        assert.equal(board.getTime(), end);
        assert.equal(board.transientAnalysisStatus().accuracyMet, true);
        assert.equal(board.transientAnalysisStatus().failure, null);
    }
});
