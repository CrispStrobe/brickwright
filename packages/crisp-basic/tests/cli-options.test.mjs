import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {prepareCliSimulation} from '../src/cli-simulation.mjs';
import {VERSION} from '../index.mjs';

const cli = fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url));
const capabilities = (...args) => JSON.parse(execFileSync(process.execPath,
    [cli, ...args, '--capabilities'], {encoding: 'utf8', timeout: 10000}));

test('CLI capability discovery requires no program or built interpreter artifact', () => {
    const native = capabilities();
    assert.equal(native.backend, 'bbcsdl-native');
    assert.deepEqual(native.platforms, ['linux-x64', 'linux-arm64']);
    assert.equal(native.sandboxed, false);
    const wasm = capabilities('--backend', 'wasm');
    assert.equal(wasm.backend, 'bbcsdl-wasm');
    assert.equal(wasm.simulation.enabled, false);
    assert.equal(wasm.host.filesystem, false);
    assert.equal(wasm.host.nativeCalls, false);
});

test('CLI and package version describe the same runtime revision', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(VERSION, manifest.version);
});

test('CLI rejects ambiguous backend and discovery arguments before source access', () => {
    for (const args of [
        ['--backend', 'arm64', 'missing.bas'],
        ['--simulation', 'missing.json', 'missing.bas'],
        ['--backend', 'native', '--simulation', 'missing.json', '--capabilities'],
        ['--capabilities', 'missing.bas'],
        ['--capabilities', '--input', 'missing.txt']
    ]) {
        const result = spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8', timeout: 10000});
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /CrispBASIC: --/);
        assert.doesNotMatch(result.stderr, /ENOENT|at file:/);
    }
});

test('fixture discovery reports the selected pins and limits without connecting hardware', t => {
    const directory = mkdtempSync(join(tmpdir(), 'crispbasic-fixture-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const file = join(directory, 'pins.json');
    writeFileSync(file, JSON.stringify({schemaVersion: 1, pins: [13, 2], maxRequests: 20,
        maxTimeMs: 100, inputs: [{pin: 2, value: 0, atMs: 25}]}));
    const result = capabilities('--backend', 'wasm', '--simulation', file);
    assert.equal(result.simulation.enabled, true);
    assert.equal(result.simulation.maxRequests, 20);
    assert.deepEqual(result.simulationHost.pins, [13, 2]);
    assert.equal(result.simulationHost.limits.maxTimeMs, 100);
    assert.equal(result.simulationHost.hardware, false);
    assert.equal(result.simulationHost.circuitPhysics, false);
});

test('fixtures create isolated repeatable hosts and preserve equal-time stimulus order', () => {
    const fixture = {schemaVersion: 1, pins: [0, 1], inputs: [
        {pin: 1, value: 0, atMs: 0}, {pin: 1, value: 1, atMs: 25}, {pin: 1, value: null, atMs: 25}
    ]};
    const prepared = prepareCliSimulation(fixture);
    fixture.pins[0] = 2;
    fixture.inputs[0].value = 1;
    const first = prepared.createHost(), second = prepared.createHost();
    try {
        assert.equal(first.pendingInputs, 3);
        assert.equal(first.trace.length, 0, 'even a zero-time stimulus waits for explicit delay');
        first.delay(0);
        assert.equal(first.digitalRead(1), 0);
        first.pinMode(1, 'input-pullup');
        first.delay(25);
        assert.equal(first.digitalRead(1), 1, 'release restores the pull-up at the same timestamp');
        assert.deepEqual(first.trace.filter(event => event.type === 'input').map(({value}) => value), [0, 1, null]);
        assert.equal(second.millis(), 0);
        assert.equal(second.trace.length, 0);
        assert.equal(second.pendingInputs, 3);
        assert.deepEqual(second.capabilities.pins, [0, 1]);
    } finally { first.dispose(); second.dispose(); }
});

test('invalid fixture shapes, unsupported fields and out-of-domain stimuli fail before execution', () => {
    for (const fixture of [
        null, [], {}, {schemaVersion: 2}, {schemaVersion: 1, code: 'process.exit()'},
        {schemaVersion: 1, pins: []}, {schemaVersion: 1, pins: [0, 0]},
        {schemaVersion: 1, maxRequests: null}, {schemaVersion: 1, maxRequests: 0},
        {schemaVersion: 1, maxRequests: 1000001}, {schemaVersion: 1, maxTimeMs: -1},
        {schemaVersion: 1, inputs: null}, {schemaVersion: 1, inputs: {}},
        {schemaVersion: 1, inputs: [null]}, {schemaVersion: 1, inputs: [{pin: 0, value: 0}]},
        {schemaVersion: 1, inputs: [{pin: 0, value: 0, atMs: 0, operation: 'write'}]},
        {schemaVersion: 1, inputs: [{pin: 8, value: 0, atMs: 0}]},
        {schemaVersion: 1, inputs: [{pin: 0, value: true, atMs: 0}]},
        {schemaVersion: 1, inputs: [{pin: 0, value: 0, atMs: 0.5}]},
        {schemaVersion: 1, maxTimeMs: 10, inputs: [{pin: 0, value: 0, atMs: 11}]},
        {schemaVersion: 1, maxScheduledInputs: 1, inputs: [{pin: 0, value: 0, atMs: 0}, {pin: 0, value: 1, atMs: 1}]}
    ]) assert.throws(() => prepareCliSimulation(fixture), undefined, JSON.stringify(fixture));
});
