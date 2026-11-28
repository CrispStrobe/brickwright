import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'node_modules/bw-circuit-ui/bin/bwc.mjs');
const flags = ['--adc-bits', '2', '--adc-low', '0', '--adc-high', '3'];
const env = {...process.env};
delete env.BW_BOARD;
const run = args => spawnSync(process.execPath, [cli, ...args],
    {cwd: root, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024});

test('installed ideal ADC helper has the selected supplier and exact threshold/zero authority', async () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'));
    assert.equal(pins['bw-board'], '818e0263fecd320d39737a580b7a73d562603c2e');
    assert.equal(pins['bw-circuit-ui'], '659431ce46a7b6d4ae472182b069ec301aee0df3');
    const {createScopeDigitizer} = await import(path.join(root,
        'node_modules/bw-circuit-ui/src/model/scope-digitizer.js'));
    const model = createScopeDigitizer({bits: 2, lowVolts: 0, highVolts: 3});
    for (const [input, code, volts, clipping] of [[0, 0, 0, 'none'],
        [0.49, 0, 0, 'none'], [1.5, 2, 2, 'none'], [-0.01, 0, 0, 'below'],
        [3.01, 3, 3, 'above']]) {
        const result = model.quantize(input);
        assert.equal(result.code, code);
        assert.equal(result.volts, volts);
        assert.equal(result.clipping, clipping);
    }
});

test('installed CLI adds paired ADC samples while preserving raw comparisons and meters', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-adc-adoption-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const input = path.join(dir, 'input.cir'), rawCsv = path.join(dir, 'raw.csv');
    const csv = path.join(dir, 'adc.csv'), receipt = path.join(dir, 'receipt.json');
    const expected = path.join(dir, 'expected.json');
    writeFileSync(input, 'Authored ADC consumer control\nV1 in 0 1.49\nR1 in 0 1k\n.end\n');
    writeFileSync(expected, JSON.stringify({schemaVersion: 1, traces: [{
        tip: 'V1.pos', reference: 'V1.neg', samples: [1, 2, 3, 4].map(i =>
            ({timeSeconds: i / 1e6, volts: 1.49}))}]}));
    const base = ['measure', input, '--scope', 'V1.pos,V1.neg',
        '--meter', 'voltage:V1.pos,V1.neg', '--duration', '4us', '--rate', '1MHz'];
    const rawResult = run([...base, '--csv', rawCsv, '--json']);
    assert.equal(rawResult.status, 0, rawResult.stderr);
    const raw = JSON.parse(rawResult.stdout);
    assert.equal(Object.hasOwn(raw, 'scopeDigitizer'), false);
    assert.equal(Object.hasOwn(raw.scope[0], 'adc'), false);
    assert.match(readFileSync(rawCsv, 'utf8'), /\nelapsed_seconds,volts\n/);
    const modeled = run([...base, ...flags, '--csv', csv, '--receipt', receipt,
        '--expect', expected, '--abs-volts', '1e-12', '--rel', '0', '--json']);
    assert.equal(modeled.status, 0, modeled.stderr);
    const report = JSON.parse(modeled.stdout);
    assert.deepEqual(report.scope[0].summary, raw.scope[0].summary);
    assert.deepEqual(report.meters, raw.meters);
    assert.equal(report.comparison.status, 'pass');
    assert.equal(report.comparisonDomain, 'raw-voltage');
    assert.equal(report.scope[0].summary.lastVolts, 1.49);
    assert.equal(report.scope[0].adc.summary.lastVolts, 1);
    const rows = readFileSync(csv, 'utf8').trim().split('\n');
    assert.equal(rows[1], 'elapsed_seconds,input_volts,adc_code,volts,clipping');
    assert.deepEqual(rows.slice(2).map(row => row.split(',').slice(1)),
        Array.from({length: 4}, () => ['1.49', '1', '1', 'none']));
    const verify = adc => run(['verify-receipt', receipt, '--input', input,
        '--csv', csv, '--expect', expected, ...adc, '--json']);
    const accepted = verify(flags);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).limits.numericalAgreement, false);
    assert.equal(verify([]).status, 1, 'a receipt cannot authorize its own ADC settings');
    assert.equal(verify(['--adc-bits', '3', '--adc-low', '0', '--adc-high', '3']).status, 1);
    const absent = path.join(dir, 'absent.csv');
    const refused = run(['measure', input, '--meter', 'voltage:V1.pos,V1.neg',
        '--duration', '4us', '--rate', '1MHz', ...flags, '--csv', absent, '--json']);
    assert.equal(refused.status, 2);
    assert.equal(refused.stdout, '');
    assert.match(refused.stderr, /ADC view needs at least one --scope/);
    assert.equal(existsSync(absent), false, 'refusal must precede artifact creation');
});
