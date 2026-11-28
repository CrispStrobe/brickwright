import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8', timeout: 10000, input: ''
});
const json = (...args) => {
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    return JSON.parse(result.stdout);
};

test('target discovery reports every admitted board without loading an interpreter', () => {
    const result = json('--list-targets');
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.targets.length, 18);
    assert.equal(new Set(result.targets.map(target => target.id)).size, 18);
    for (const target of result.targets) {
        assert.equal(target.execution, 'host-driven-logical-simulation');
        assert.equal(target.hardware, false);
        assert.equal(target.nativeInterpreter, false);
        assert.equal(target.circuitPhysics, false);
        assert.ok(target.pins.length > 0);
    }
    assert.deepEqual(json('--list-targets', '--json'), result);
});

const requested = [
    ['8051', 'mcu', 8], ['stc15', 'stc15_mcu', 33],
    ['stm32', 'stm32f030', 17], ['pico', 'pi_pico', 25],
    ['rp2040', 'pi_pico', 25], ['nano', 'arduino_nano', 13],
    ['8266', 'esp8266', 12], ['esp8266', 'esp8266', 12],
    ['microbit', 'microbit', 2], ['micro:bit', 'microbit', 2],
    ['microbit-breakout', 'microbit_breakout', 8]
];
for (const [alias, id, pin] of requested) {
    test('CLI selects ' + alias + ' as the explicit ' + id + ' logical target', () => {
        const result = json('--backend', 'wasm', '--target', alias, '--capabilities');
        assert.equal(result.backend, 'bbcsdl-wasm');
        assert.equal(result.simulation.enabled, true);
        assert.equal(result.simulationHost.target.id, id);
        assert.equal(result.simulationHost.target.nativeInterpreter, false);
        assert.equal(result.simulationHost.hardware, false);
        assert.equal(result.simulationHost.circuitPhysics, false);
        assert.ok(result.simulationHost.pins.includes(pin));
    });
}

test('CLI validates target and option conflicts before opening files or creating a worker', () => {
    for (const args of [
        ['--target', 'pico', 'missing.bas'],
        ['--backend', 'native', '--target', 'nano', '--capabilities'],
        ['--backend', 'wasm', '--target', 'pico', '--target', 'nano', '--capabilities'],
        ['--backend', 'wasm', '--target', 'not-a-board', '--simulation', 'missing.json', '--capabilities'],
        ['--backend', 'wasm', '--target', '', '--capabilities'],
        ['--list-targets', 'missing.bas'],
        ['--list-targets', '--target', 'pico'],
        ['--list-targets', '--backend', 'wasm'],
        ['--list-targets', '--capabilities'],
        ['--list-targets', '--simulation', 'missing.json'],
        ['--list-targets', '--input', 'missing.txt'],
        ['--list-targets', '--timeout', '50']
    ]) {
        const result = run(...args);
        assert.equal(result.status, 1, JSON.stringify(args));
        assert.equal(result.stdout, '', JSON.stringify(args));
        assert.match(result.stderr, /CrispBASIC:/);
        assert.doesNotMatch(result.stderr, /ENOENT|ERR_MODULE_NOT_FOUND|at file:/);
    }
});

test('target fixtures admit exact terminal names and can narrow the pin set', t => {
    const directory = mkdtempSync(join(tmpdir(), 'crispbasic-target-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const file = join(directory, 'input.json');
    writeFileSync(file, JSON.stringify({schemaVersion: 1, pins: ['D13', 'D2'],
        maxRequests: 20, maxTimeMs: 30, inputs: [{pin: 'd2', value: 0, atMs: 25}]}));
    const result = json('--backend', 'wasm', '--target', 'nano', '--simulation', file, '--capabilities');
    assert.equal(result.simulationHost.target.id, 'arduino_nano');
    assert.deepEqual(result.simulationHost.pins, [13, 2]);
    assert.equal(result.simulation.maxRequests, 20);
    assert.equal(result.simulationHost.limits.maxTimeMs, 30);
});

test('target fixtures cannot expand the target, duplicate terminals, or hide malformed fields', t => {
    const directory = mkdtempSync(join(tmpdir(), 'crispbasic-target-invalid-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const file = join(directory, 'input.json');
    for (const fixture of [
        {schemaVersion: 1, pins: ['A6']},
        {schemaVersion: 1, pins: [20]},
        {schemaVersion: 1, pins: ['D13', 13]},
        {schemaVersion: 1, pins: ['D13'], inputs: [{pin: 'D2', value: 0, atMs: 0}]},
        {schemaVersion: 1, inputs: [{pin: 'A7', value: 0, atMs: 0}]},
        {schemaVersion: 1, target: 'pico'},
        {schemaVersion: 2}
    ]) {
        writeFileSync(file, JSON.stringify(fixture));
        const result = run('--backend', 'wasm', '--target', 'nano', '--simulation', file, '--capabilities');
        assert.equal(result.status, 1, JSON.stringify(fixture));
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /CrispBASIC:/);
        assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|at file:/);
    }
});

test('help identifies logical targets and the classic Nano/STM32 scope', () => {
    const result = run('--help');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--list-targets/);
    assert.match(result.stdout, /--target NAME/);
    assert.match(result.stdout, /do not execute firmware or emulate the board CPU/);
    assert.match(result.stdout, /STM32F030/);
    assert.match(result.stdout, /classic AVR Nano/);
});
