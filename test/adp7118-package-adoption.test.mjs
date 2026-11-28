import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';
import {REFUSED} from '../overlay/scratch-gui/src/lib/bw-parts/profiles.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(
    path.join(root, 'test/fixtures/adp7118-fixed-regulator.json'), 'utf8'));
const terminals = ['vout_1', 'vout_2', 'sense_adj', 'gnd', 'en', 'ss', 'vin_7', 'vin_8'];

test('the exact installed packages expose and solve the physical ADP7118', async () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'));
    assert.equal(pins['bw-board'], '818e0263fecd320d39737a580b7a73d562603c2e');
    assert.equal(pins['bw-circuit-ui'], '659431ce46a7b6d4ae472182b069ec301aee0df3');

    const sidecar = JSON.parse(readFileSync(
        path.join(root, 'node_modules/bw-circuit-ui/src/parts-data/adp7118.json'), 'utf8'));
    assert.equal(sidecar.kind, 'adp7118');
    assert.deepEqual(sidecar.terminals.map(pin => pin.name), terminals);
    assert.equal(Object.hasOwn(sidecar, 'footprint'), false,
        'the SMT-only package must not acquire an invented breadboard seating');
    assert.ok(REFUSED.passive.includes('adp7118'),
        'the circuit-driven regulator must not be presented as a programmable Code-tab part');

    const {Circuit} = await loadCircuitModel(root);
    const circuit = Circuit.fromJSON(structuredClone(fixture));
    assert.equal(circuit.netlistError, null);
    circuit.board.advanceTo(10_000n);
    const output = circuit.board.nets.find(item => item.terminals.some(endpoint =>
        endpoint.part === 'u1' && endpoint.terminal === 'vout_1'));
    assert.ok(output, 'ADP7118 output must belong to a solved net');
    assert.ok(Math.abs(circuit.board.nodeVoltage(output.id) - 5) < 0.002,
        `physical ADP7118 output was ${circuit.board.nodeVoltage(output.id)} V`);
});

function startupFixture(ohms = 500, farads = 2.2e-6) {
    const data = structuredClone(fixture);
    data.parts.find(part => part.id === 'u1').params.startupModel = 'datasheet-envelope';
    data.parts.find(part => part.id === 'load').params.ohms = ohms;
    data.parts.push({id: 'cout', kind: 'capacitor', params: {farads}, x: 800, y: 400});
    data.wires.push(
        {from: 'cout', fromTerminal: 'a', to: 'u1', toTerminal: 'vout_1'},
        {from: 'cout', fromTerminal: 'b', to: 'gnd', toTerminal: 'gnd'});
    return data;
}

test('installed Lite packages CLI measures every startup sample and the independent window mean', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-startup-cli-'));
    const env = {...process.env}; delete env.BW_BOARD;
    try {
        const input = path.join(dir, 'startup.json'), csv = path.join(dir, 'startup.csv');
        const receiptPath = path.join(dir, 'receipt.json');
        writeFileSync(input, JSON.stringify(startupFixture()));
        const result = spawnSync(process.execPath, [path.join(root, 'node_modules/bw-circuit-ui/bin/bwc.mjs'),
            'measure', input, '--scope', 'u1.vout_1,gnd.gnd', '--meter', 'voltage:u1.vout_1,gnd.gnd',
            '--duration', '1200us', '--rate', '100kHz', '--csv', csv, '--receipt', receiptPath, '--json'],
        {encoding: 'utf8', env, timeout: 30000});
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.transient.accuracyMet, true);
        assert.equal(report.transient.failure, null);
        assert.equal(report.scope[0].summary.samples, 120);
        const tau = 300e-6 / Math.log(9);
        const delay = Math.round((80e-6 + tau * Math.log(.9)) * 1e9) / 1e9;
        const gain = 500 / 500.05, rc = (.05 * 500 / 500.05) * 2.2e-6;
        const expected = time => {
            const x = time - delay;
            return x <= 0 ? 0 : 5 * gain * (1 -
                (tau * Math.exp(-x / tau) - rc * Math.exp(-x / rc)) / (tau - rc));
        };
        const rows = readFileSync(csv, 'utf8').trim().split('\n');
        assert.equal(rows.length, 122);
        assert.match(rows[0], /startTimeNs=10000/);
        for (const [index, row] of rows.slice(2).entries()) {
            const [elapsed, volts] = row.split(',').map(Number);
            assert.equal(elapsed, index * 10000 / 1e9);
            assert.ok(Number.isFinite(volts));
            assert.ok(Math.abs(volts - expected(10e-6 + elapsed)) < .001, `sample ${index}`);
        }
        const duration = .0012, x = duration - delay;
        const mean = 5 * gain * (x - (tau * tau * (1 - Math.exp(-x / tau)) -
            rc * rc * (1 - Math.exp(-x / rc))) / (tau - rc)) / duration;
        assert.equal(report.meters[0].quantity, 'observed-dc-mean');
        assert.ok(Math.abs(report.meters[0].reading.siValue - mean) < .0001);
        assert.ok(Math.abs(report.meters[0].reading.siValue - report.scope[0].summary.lastVolts) > .5);
        const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
        const cuiPackage = JSON.parse(readFileSync(path.join(root, 'node_modules/bw-circuit-ui/package.json'), 'utf8'));
        assert.equal(receipt.engine.selection, 'installed package');
        assert.equal(receipt.invocation.BW_BOARD, null);
        // The CLI reports its own development declaration separately from the
        // observed installed engine; a consumer pin bump does not rewrite CUI.
        assert.equal(receipt.engine.declaredPackageSpec, cuiPackage.devDependencies['bw-board']);
        assert.deepEqual(receipt.report, report);
    } finally {rmSync(dir, {recursive: true, force: true});}
});

test('installed startup refusals suppress CLI publication and invalidate caught partial GUI observations', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-startup-refusal-'));
    const env = {...process.env}; delete env.BW_BOARD;
    try {
        for (const [ohms, farads] of [[10, 2.2e-6], [500, 22e-6]]) {
            const input = path.join(dir, 'refused.json'), csv = path.join(dir, 'refused.csv');
            writeFileSync(input, JSON.stringify(startupFixture(ohms, farads)));
            const result = spawnSync(process.execPath, [path.join(root, 'node_modules/bw-circuit-ui/bin/bwc.mjs'),
                'measure', input, '--scope', 'u1.vout_1,gnd.gnd', '--duration', '1200us',
                '--rate', '100kHz', '--csv', csv, '--json'], {encoding: 'utf8', env, timeout: 30000});
            assert.equal(result.status, 2, result.stderr);
            assert.match(result.stderr, /ADP7118.*current-limited startup transient is unqualified/);
            assert.equal(result.stdout, '');
            assert.equal(existsSync(csv), false);
        }
        const {Circuit} = await loadCircuitModel(root);
        const c = Circuit.fromJSON(startupFixture(10));
        assert.equal(c.netlistError, null);
        const net = endpoint => c.board.nets.find(n => n.terminals.some(t =>
            t.part === endpoint[0] && t.terminal === endpoint[1])).id;
        const out = net(['u1', 'vout_1']), ground = net(['gnd', 'gnd']);
        c.board.meterVoltage(out, ground);
        const h = c.board.addScopeChannel({type: 'voltage', netId: out, referenceNetId: ground,
            sampleRateHz: 100000, capture: 'sample'});
        assert.throws(() => c.board.advanceTo(1200000n), /current-limited startup transient is unqualified/);
        assert.throws(() => c.board.meterVoltage(out, ground), /measurement unavailable: circuit solve failed/);
        assert.throws(() => c.board.getScopeData(h), /measurement unavailable: circuit solve failed/);
        const status = c.board.transientAnalysisStatus();
        assert.equal(status.accuracyMet, false);
        assert.equal(status.failure.code, 'device-update-refused');
        assert.equal(status.failure.partId, 'u1');
    } finally {rmSync(dir, {recursive: true, force: true});}
});

test('the production browser gate requires the ADP7118 face, pins and live solve', () => {
    const source = readFileSync(path.join(root, 'scripts/verify-circuit-rendering.mjs'), 'utf8');
    assert.match(source, /data-part-face="adp7118"/);
    assert.match(source, /adp7118\.terminals === 8/);
    assert.match(source, /Math\.abs\(adp7118\.output - 5\) < 0\.002/);
});
