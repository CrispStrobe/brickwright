import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';
import {REFUSED} from '../overlay/scratch-gui/src/lib/bw-parts/profiles.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(
    path.join(root, 'test/fixtures/lt1001-precision-follower.json'), 'utf8'));
const terminals = ['offset_1', 'inn', 'inp', 'vneg', 'offset_5', 'out', 'vpos', 'nc'];

test('the exact installed packages expose and solve the physical LT1001', async () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'));
    assert.equal(pins['bw-board'], '489ca7c675a9af03cb066026ec59801b8ba3d0bb');
    assert.equal(pins['bw-circuit-ui'], '7f98562fe515ec47b7e438bdd9dbb4ad1f2bcd43');

    const sidecar = JSON.parse(readFileSync(
        path.join(root, 'node_modules/bw-circuit-ui/src/parts-data/lt1001.json'), 'utf8'));
    assert.equal(sidecar.kind, 'lt1001');
    assert.deepEqual(sidecar.terminals.map(pin => pin.name), terminals);
    assert.deepEqual(sidecar.footprint.leads.out, {dRow: 5, dCol: 2});
    assert.deepEqual(sidecar.footprint.leads.vpos, {dRow: 5, dCol: 1});
    assert.ok(REFUSED['analog-only'].includes('lt1001'),
        'the real analog IC must be catalogued without inventing a programmable-part profile');

    const {Circuit} = await loadCircuitModel(root);
    const circuit = Circuit.fromJSON(structuredClone(fixture));
    assert.equal(circuit.netlistError, null);
    circuit.board.advanceTo(40_000n);
    const output = circuit.board.nets.find(item => item.terminals.some(endpoint =>
        endpoint.part === 'u1' && endpoint.terminal === 'out'));
    assert.ok(output, 'LT1001 output must belong to a solved net');
    assert.ok(Math.abs(circuit.board.nodeVoltage(output.id) - 1.00001) < 0.00001,
        `physical LT1001 precision follower output was ${circuit.board.nodeVoltage(output.id)} V`);
});

test('the production browser gate requires the LT1001 face, pins and live solve', () => {
    const source = readFileSync(path.join(root, 'scripts/verify-circuit-rendering.mjs'), 'utf8');
    assert.match(source, /data-dip-body="lt1001"/);
    assert.match(source, /lt1001\.terminals === 8/);
    assert.match(source, /Math\.abs\(lt1001\.output - 1\.00001\) < 0\.00001/);
});
