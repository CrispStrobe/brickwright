import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';
import {REFUSED} from '../overlay/scratch-gui/src/lib/bw-parts/profiles.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(
    path.join(root, 'test/fixtures/lt1763-fixed-regulator.json'), 'utf8'));
const terminals = ['out', 'sense_adj', 'gnd_3', 'byp', 'shdn', 'gnd_6', 'gnd_7', 'in'];

test('the exact installed packages expose and solve the physical LT1763', async () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'));
    assert.equal(pins['bw-board'], '818e0263fecd320d39737a580b7a73d562603c2e');
    assert.equal(pins['bw-circuit-ui'], '659431ce46a7b6d4ae472182b069ec301aee0df3');

    const sidecar = JSON.parse(readFileSync(
        path.join(root, 'node_modules/bw-circuit-ui/src/parts-data/lt1763.json'), 'utf8'));
    assert.equal(sidecar.kind, 'lt1763');
    assert.deepEqual(sidecar.terminals.map(pin => pin.name), terminals);
    assert.equal(Object.hasOwn(sidecar, 'footprint'), false,
        'the SMT-only package must not acquire invented breadboard seating');
    assert.ok(REFUSED.passive.includes('lt1763'),
        'the circuit-driven regulator must not be presented as a programmable Code-tab part');

    const {Circuit} = await loadCircuitModel(root);
    const circuit = Circuit.fromJSON(structuredClone(fixture));
    assert.equal(circuit.netlistError, null);
    circuit.board.advanceTo(10_000n);
    const output = circuit.board.nets.find(item => item.terminals.some(endpoint =>
        endpoint.part === 'u1' && endpoint.terminal === 'out'));
    assert.ok(output, 'LT1763 output must belong to a solved net');
    assert.ok(Math.abs(circuit.board.nodeVoltage(output.id) - 5) < 0.003,
        `physical LT1763 output was ${circuit.board.nodeVoltage(output.id)} V`);
});

test('the production browser gate requires the LT1763 face, pins and live solve', () => {
    const source = readFileSync(path.join(root, 'scripts/verify-circuit-rendering.mjs'), 'utf8');
    assert.match(source, /data-part-face="lt1763"/);
    assert.match(source, /lt1763\.terminals === 8/);
    assert.match(source, /Math\.abs\(lt1763\.output - 5\) < 0\.003/);
});
