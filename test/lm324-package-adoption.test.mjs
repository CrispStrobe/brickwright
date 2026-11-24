import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(
    path.join(root, 'test/fixtures/lm324-quad-follower.json'), 'utf8'));

const outputVoltage = (circuit, channel) => {
    const terminal = `${channel}_out`;
    const net = circuit.board.nets.find(item => item.terminals.some(endpoint =>
        endpoint.part === 'u1' && endpoint.terminal === terminal));
    assert.ok(net, `LM324 ${terminal} must belong to a solved net`);
    return circuit.board.nodeVoltage(net.id);
};

test('the pinned packages expose a truthful LM324 face and four live channels', async () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'));
    assert.equal(pins['bw-board'], '489ca7c675a9af03cb066026ec59801b8ba3d0bb');
    assert.equal(pins['bw-circuit-ui'], 'a82d70032f0173f0597e1ba1c02f507b9d474642');

    const sidecar = JSON.parse(readFileSync(
        path.join(root, 'node_modules/bw-circuit-ui/src/parts-data/lm324.json'), 'utf8'));
    assert.equal(sidecar.kind, 'lm324');
    assert.equal(sidecar.terminals.length, 14);
    assert.deepEqual(sidecar.terminals.map(pin => pin.name), [
        '1_out', '1_neg', '1_pos', 'vcc', '2_pos', '2_neg', '2_out',
        '3_out', '3_neg', '3_pos', 'gnd', '4_pos', '4_neg', '4_out'
    ]);
    assert.deepEqual(sidecar.footprint.leads['1_out'], {dRow: 0, dCol: 0});
    assert.deepEqual(sidecar.footprint.leads['4_out'], {dRow: 5, dCol: 0});
    assert.deepEqual(sidecar.footprint.leads.gnd, {dRow: 5, dCol: 3});

    const {Circuit} = await loadCircuitModel(root);
    const circuit = Circuit.fromJSON(structuredClone(fixture));
    assert.equal(circuit.netlistError, null);
    circuit.board.advanceTo(1n);
    const observed = [1, 2, 3, 4].map(channel => outputVoltage(circuit, channel));
    assert.deepEqual(observed.map(value => Number(value.toFixed(3))), [0.5, 1, 2, 3]);
});
