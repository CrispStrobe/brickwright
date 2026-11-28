import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync, realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';
import {REFUSED} from '../overlay/scratch-gui/src/lib/bw-parts/profiles.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(
    path.join(root, 'test/fixtures/lm741-voltage-follower.json'), 'utf8'));
const terminals = ['offset_1', 'inn', 'inp', 'vneg', 'offset_5', 'out', 'vpos', 'nc'];

test('the exact installed packages expose and solve the physical LM741', async () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'));
    assert.equal(pins['bw-board'], '818e0263fecd320d39737a580b7a73d562603c2e');
    assert.equal(pins['bw-circuit-ui'], '659431ce46a7b6d4ae472182b069ec301aee0df3');

    const sidecar = JSON.parse(readFileSync(
        path.join(root, 'node_modules/bw-circuit-ui/src/parts-data/lm741.json'), 'utf8'));
    assert.equal(sidecar.kind, 'lm741');
    assert.deepEqual(sidecar.terminals.map(pin => pin.name), terminals);
    // bw-circuit-ui 04f8ce8 (#155, breadboard-pitch DIPs) seats the package pin-1 corner on
    // the other breadboard row (datasheet top view): the leads' rows flip.
    assert.deepEqual(sidecar.footprint.leads.out, {dRow: 0, dCol: 2});
    assert.deepEqual(sidecar.footprint.leads.vpos, {dRow: 0, dCol: 1});
    assert.ok(REFUSED['analog-only'].includes('lm741'),
        'the real analog IC must be catalogued without inventing a programmable-part profile');

    const {Circuit} = await loadCircuitModel(root);
    const circuit = Circuit.fromJSON(structuredClone(fixture));
    assert.equal(circuit.netlistError, null);
    circuit.board.advanceTo(10_000n);
    const output = circuit.board.nets.find(item => item.terminals.some(endpoint =>
        endpoint.part === 'u1' && endpoint.terminal === 'out'));
    assert.ok(output, 'LM741 output must belong to a solved net');
    assert.ok(Math.abs(circuit.board.nodeVoltage(output.id) - 1.001) < 0.02,
        `physical LM741 follower output was ${circuit.board.nodeVoltage(output.id)} V`);
});

test('the production browser gate requires the LM741 face, pins and live solve', () => {
    const source = readFileSync(path.join(root, 'scripts/verify-circuit-rendering.mjs'), 'utf8');
    assert.match(source, /data-dip-body="lm741"/);
    assert.match(source, /lm741\.terminals === 8/);
    assert.match(source, /Math\.abs\(lm741\.output - 1\.001\) < 0\.02/);
});

test('installed LM741 refuses unmodelled rail current while real zero and signed currents remain valid', async () => {
    const {Circuit} = await loadCircuitModel(root);
    const {readMeter, createMeterState} = await import(path.join(root,
        'node_modules/bw-circuit-ui/src/model/multimeter.js'));
    const circuit = Circuit.fromJSON(structuredClone(fixture));
    circuit.setPower(true);
    circuit.board.advanceTo(10_000n);
    assert.throws(() => circuit.board.meterCurrent('u1', 'vpos'),
        error => error.code === 'MISSING_BRANCH_CURRENT' && /u1\.vpos/.test(error.message),
        'a connected supply terminal is not a modelled quiescent-current law');
    const railReading = readMeter({...createMeterState(), mode: 'current',
        probeA: {partId: 'u1', terminal: 'vpos'}}, circuit);
    assert.equal(railReading.siValue, null);
    assert.equal(railReading.value, '---');
    assert.equal(railReading.note, 'Cannot read current', 'the actual display model must not fabricate zero');
    assert.ok(circuit.board.meterCurrent('u1', 'out') > 0);
    assert.ok(circuit.board.meterCurrent('load', 'a') < 0);
    for (const volts of [0, 1, -1]) {
        const bench = Circuit.fromJSON({parts: [
            {id: 'V', kind: 'vsource', params: {volts}, x: 0, y: 0},
            {id: 'R', kind: 'resistor', params: {ohms: 1000}, x: 100, y: 0},
            {id: 'G', kind: 'gnd', params: {}, x: 0, y: 100}
        ], wires: [
            {from: 'V', fromTerminal: 'pos', to: 'R', toTerminal: 'a'},
            {from: 'V', fromTerminal: 'neg', to: 'G', toTerminal: 'gnd'},
            {from: 'R', fromTerminal: 'b', to: 'G', toTerminal: 'gnd'}
        ]});
        bench.setPower(true);
        bench.board.advanceTo(1000n);
        assert.equal(bench.board.meterCurrent('R', 'a'), volts === 0 ? 0 : -volts / 1000);
        assert.equal(bench.board.meterCurrent('R', 'b'), volts / 1000);
        const reading = readMeter({...createMeterState(), mode: 'current',
            probeA: {partId: 'R', terminal: 'a'}}, bench);
        assert.equal(reading.siValue, volts === 0 ? 0 : -volts / 1000);
        assert.equal(reading.note, null);
    }
});

// Independent nominal loaded-follower response, not an engine helper or a fit
// to captured values. Includes the one-nanosecond source ramp and its integral.
function followerReference(sign, phaseNs, timeNs) {
    const conductance = 1 / 600 + 1 / 2e6 + 1 / 10000;
    const k = (1 / 600) / conductance, d = (1 / 2e6) / conductance;
    const gain = (200000 * k + d) / (1 + 200000 * k);
    const w = 2 * Math.PI * 1e6 * (k + 1 / 200000) * 1e-9;
    const a = sign * 0.01, t = timeNs - 10000 - phaseNs;
    if (t <= 0) return {input: 0, output: 0, mean: 0};
    const rise = x => -Math.expm1(-w * x);
    const rampIntegral = x => a * (gain * x * x / 2 -
        (gain - d) * (x / w - rise(x) / (w * w)));
    const attenuation = (gain - d) * rise(1) / w;
    const output = t <= 1 ? a * (gain * t - (gain - d) * rise(t) / w) :
        a * (gain - attenuation * Math.exp(-w * (t - 1)));
    const integral = t <= 1 ? rampIntegral(t) : rampIntegral(1) +
        a * (gain * (t - 1) - attenuation * rise(t - 1) / w);
    return {input: a * Math.min(1, t), output, mean: integral / timeNs};
}

test('installed LM741 CLI qualifies six signed phase captures, finite watch and whole-capture work', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-lm741-cli-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const cliRoot = realpathSync(path.join(root, 'node_modules/bw-circuit-ui'));
    const engineRoot = realpathSync(path.join(root, 'node_modules/bw-board'));
    const cli = path.join(cliRoot, 'bin/bwc.mjs');
    const env = {...process.env}; delete env.BW_BOARD;
    const close = (actual, expected, bound, label) => {
        assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= bound,
            `${label}: ${actual} vs ${expected} (bound ${bound})`);
    };
    const wholeWork = receipt => {
        assert.equal(receipt.completed, true);
        assert.equal(receipt.failure, null);
        assert.equal(receipt.requestedTimeNs, '20000');
        assert.deepEqual(receipt.limits, {maxAttempts: 20000, maxSolves: 60001, maxAdvances: 200});
        for (const [key, bound] of [['attempts', 20000], ['solves', 60001], ['advances', 200]]) {
            assert.ok(Number.isSafeInteger(receipt.work[key]) && receipt.work[key] >= 0 &&
                receipt.work[key] <= bound, `${key} must be cumulative, finite and bounded`);
        }
    };
    const metersAt = (meters, sign, phaseNs, timeNs) => {
        assert.deepEqual(meters.map(m => [m.mode, m.probes]), [
            ['voltage', ['u1.out', 'gnd.gnd']], ['current', ['load.a']], ['current', ['load.b']]
        ]);
        for (const meter of meters) assert.equal(meter.reading.note, null);
        const expected = followerReference(sign, phaseNs, timeNs).mean;
        close(meters[0].reading.siValue, expected, 2e-6, 'voltage mean');
        close(meters[1].reading.siValue, -expected / 10000, 2e-10, 'signed load.a mean');
        close(meters[2].reading.siValue, expected / 10000, 2e-10, 'signed load.b mean');
        close(meters[1].reading.siValue + meters[2].reading.siValue, 0, 1e-12, 'terminal KCL');
    };
    for (const sign of [1, -1]) for (const phaseNs of [0, 33, 67]) {
        const circuit = structuredClone(fixture);
        circuit.vcc = 5;
        circuit.parts.find(p => p.id === 'vin').params = {wave: 'spice-pulse', v1: 0,
            v2: sign * 0.01, td: (10000 + phaseNs) * 1e-9, tr: 1e-9, tf: 1e-9,
            pw: 20e-6, per: 100e-6};
        circuit.parts.find(p => p.id === 'u1').params = {transientModel: 'linear-pole',
            inputOffsetV: 0, supplyPositiveV: 15, supplyNegativeV: -15};
        circuit.parts.find(p => p.id === 'load').params.ohms = 10000;
        const file = path.join(dir, 'follower.json');
        const csv = path.join(dir, 'trace.csv');
        const saved = path.join(dir, `receipt-${sign}-${phaseNs}.json`);
        writeFileSync(file, JSON.stringify(circuit));
        const args = ['measure', file, '--profile', 'precision-v1', '--initial', 'zero-state',
            '--scope', 'u1.out,gnd.gnd', '--scope', 'vin.pos,gnd.gnd',
            '--meter', 'voltage:u1.out,gnd.gnd', '--meter', 'current:load.a',
            '--meter', 'current:load.b', '--duration', '20us', '--rate', '2MHz'];
        const run = extra => spawnSync(process.execPath, [cli, ...args, ...extra],
            {cwd: root, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024});
        const batch = run(['--csv', csv, '--receipt', saved, '--json']);
        assert.equal(batch.status, 0, batch.stderr);
        const report = JSON.parse(batch.stdout), acquired = JSON.parse(readFileSync(saved, 'utf8'));
        assert.equal(acquired.kind, 'bwc-measurement-receipt');
        assert.equal(acquired.schemaVersion, 1);
        assert.equal(acquired.engine.selection, 'installed package');
        assert.equal(acquired.invocation.BW_BOARD, null);
        assert.equal(acquired.engine.observed.root, engineRoot);
        assert.equal(acquired.cli.root, cliRoot);
        for (const observed of [acquired.engine.observed, acquired.cli]) {
            assert.match(observed.jsJsonTreeSha256, /^[a-f0-9]{64}$/);
            assert.ok(observed.files > 0);
        }
        assert.deepEqual(acquired.clock, {startNs: '0', durationNs: '20000', intervalNs: '500'});
        assert.deepEqual(acquired.report, report);
        assert.equal(report.plannedSamples, 40);
        assert.equal(report.transient.accuracyMet, true);
        assert.equal(report.precisionCapture.basis, 'engine-whole-advance-lm741-linear-pole');
        wholeWork(report.transient.boundedAdvance);
        assert.equal(report.transient.boundedAdvance.work.advances, 1);
        metersAt(report.meters, sign, phaseNs, 20000);
        const sections = readFileSync(csv, 'utf8').trim().split('\n\n');
        assert.equal(sections.length, 2);
        for (const [channel, section] of sections.entries()) {
            const lines = section.split('\n');
            assert.match(lines[0], /sampleIntervalNs=500 points=40/);
            assert.match(lines[0], /startTimeNs=500(?:\s|$)/);
            assert.equal(lines.length, 42);
            for (const [i, line] of lines.slice(2).entries()) {
                const [elapsed, volts] = line.split(',').map(Number);
                const expected = followerReference(sign, phaseNs, (i + 1) * 500);
                close(elapsed, i * 500e-9, 1e-15, 'CSV elapsed clock');
                close(volts, channel === 0 ? expected.output : expected.input,
                    channel === 0 ? 1e-4 : 1e-10, 'CSV waveform');
            }
        }
        const watched = run(['--watch']);
        assert.equal(watched.status, 0, watched.stderr);
        const records = watched.stdout.trim().split('\n').map(line => JSON.parse(line));
        assert.equal(records.length, 41);
        for (const [i, record] of records.slice(0, -1).entries()) {
            assert.equal(record.recordType, 'sample'); assert.equal(record.qualified, false);
            const timeNs = (i + 1) * 500, expected = followerReference(sign, phaseNs, timeNs);
            close(record.timeSeconds, timeNs * 1e-9, 1e-15, 'watch clock');
            assert.equal(record.scope.length, 2);
            close(record.scope[0].volts, expected.output, 1e-4, 'watch output');
            close(record.scope[1].volts, expected.input, 1e-10, 'watch input');
            metersAt(record.meters, sign, phaseNs, timeNs);
        }
        const terminal = records.at(-1);
        assert.equal(terminal.recordType, 'summary'); assert.equal(terminal.qualified, true);
        wholeWork(terminal.report.transient.boundedAdvance);
        assert.equal(terminal.report.transient.boundedAdvance.work.advances, 40);
        assert.deepEqual(terminal.report.transient.boundedAdvance.stream,
            {stepNs: '500', observerCalls: 40});
        metersAt(terminal.report.meters, sign, phaseNs, 20000);
        const refused = run(['--current', 'load.a', '--json']);
        assert.equal(refused.status, 2, '--current must not silently produce an unrequested measurement');
        assert.equal(refused.stdout, '');
        assert.match(refused.stderr, /--current/);
    }
    // Change only the observed engine receipt in an isolated child process.
    // The completed ordinary acquisition above must not become qualified when
    // its whole-capture authority is missing; installed bytes stay untouched.
    const preload = `import {BoardImpl} from ${JSON.stringify(import.meta.resolve('bw-board/board.js'))};
        const original=BoardImpl.prototype.transientAnalysisStatus;
        BoardImpl.prototype.transientAnalysisStatus=function(...args){
            const status=original.apply(this,args);return {...status,boundedAdvance:undefined};};`;
    const args = [cli, 'measure', path.join(dir, 'follower.json'), '--scope', 'u1.out,gnd.gnd',
        '--duration', '20us', '--rate', '2MHz', '--profile', 'precision-v1',
        '--initial', 'zero-state', '--json'];
    const childOptions = {cwd: root, env, encoding: 'utf8', timeout: 30000};
    const missing = spawnSync(process.execPath,
        ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, ...args], childOptions);
    assert.equal(missing.status, 2, missing.stderr);
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /whole-advance receipt/);
    const restored = spawnSync(process.execPath, args, childOptions);
    assert.equal(restored.status, 0, restored.stderr);
    wholeWork(JSON.parse(restored.stdout).transient.boundedAdvance);
});
