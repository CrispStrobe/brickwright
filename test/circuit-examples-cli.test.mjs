import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const cli = join(import.meta.dirname, '../bin/bwlite.mjs');
const invoke = (...args) => spawnSync(process.execPath, [cli, 'circuit', 'test', ...args],
    {encoding: 'utf8', timeout: 60_000});

test('circuit CLI drives the loaded button and measures one and two blinks', () => {
    const result = invoke('05-counter', '--device', 'stc12c5a60s2', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows} = JSON.parse(result.stdout);
    assert.equal(rows.length, 1);
    const [{smoke, behavior}] = rows;
    assert.equal(smoke, 'pass');
    assert.equal(behavior.status, 'pass');
    assert.deepEqual(behavior.checks.map(check => check.observed), [
        {rises: 0, falls: 0}, {rises: 1, falls: 1}, {rises: 2, falls: 2}
    ]);
});

test('the circuit CLI measures all eight shift-register outputs on retargeted lessons', () => {
    const benches = [
        ['08-led-chaser-595', 'pico', 16],
        ['20-shift-register-binary', 'stc89c52rc', 17]
    ];
    for (const [id, device, patterns] of benches) {
        const result = invoke(id, '--device', device, '--timeout-ms', '45000', '--json');
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const {rows: [{behavior}]} = JSON.parse(result.stdout);
        assert.equal(behavior.status, 'pass');
        assert.deepEqual(behavior.checks[0], {check: 'LED patterns', expected: patterns, observed: patterns, ok: true});
        assert.equal(behavior.checks[1].ok, true);
    }
});

test('circuit CLI distinguishes smoke from functional coverage', () => {
    const result = invoke('05-counter', '--device', 'stm32f030', '--smoke-only', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows} = JSON.parse(result.stdout);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].device, 'stm32f030');
    assert.equal(rows[0].smoke, 'pass');
    assert.equal(rows[0].behavior.status, 'unverified');
});

test('circuit CLI checks motor input, direction and coast on retargeted benches', () => {
    const variants = [
        ['arduino-sk-p09-motorized-pinwheel', 'arduino-nano', 3],
        ['arduino-sk-p10-zoetrope', 'stc12c5a60s2', 4]
    ];
    for (const [id, device, count] of variants) {
        const result = invoke(id, '--device', device, '--json');
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const {rows: [{smoke, behavior}]} = JSON.parse(result.stdout);
        assert.equal(smoke, 'pass');
        assert.equal(behavior.status, 'pass');
        assert.equal(behavior.checks.length, count);
    }
});

test('the authored physics tier verifies a circuit output without counting its supply rail', () => {
    const result = invoke('23-voltage-regulator', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}], summary} = JSON.parse(result.stdout);
    assert.deepEqual(summary.functionalCoverage, {'documented-physics': 1});
    assert.deepEqual(behavior.checks.map(check => [check.assertion, check.ok]), [
        ['net r1.b V 5.13 +-0.05', true]
    ]);
});

test('retargeted electrical I/O is measured on the exact bench and does not inherit authored assertions', () => {
    const result = invoke('02-dimmer', '--device', 'arduino-uno', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}], summary} = JSON.parse(result.stdout);
    assert.deepEqual(summary.functionalCoverage, {'electrical-io': 1});
    assert.deepEqual(behavior.checks.map(check => [check.part, check.pin, check.ok]), [
        ['LED_led1', 'D13', true], ['POT_pot', 'A0', true]
    ]);
});

test('the analog-write lesson bench follows the retargeted PWM assignments', () => {
    const result = invoke('arduino-03-analog-write-mega', '--device', 'arduino-uno', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.deepEqual(behavior.checks.map(check => [check.part, check.pin, check.ok]), [
        ['led1', 'D3', true], ['led2', 'D11', true], ['led3', 'D9', true]
    ]);
});

test('an authored LED role checks the correctly mapped Nano PWM output', () => {
    const result = invoke('arduino-01-fade', '--device', 'arduino-nano', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.deepEqual(behavior.checks.map(check => [check.part, check.pin, check.ok]), [['led1', 'D3', true]]);
});

test('8051 relay and LED energize and release in the documented sequence', () => {
    const result = invoke('09-relay-clicker', '--device', 'stc12c5a60s2', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.deepEqual(behavior.checks.map(check => check.observed), [
        {lit: true, energized: true}, {lit: false, energized: false}, {lit: true, energized: true}
    ]);
});

test('the bundled CP1 monitor drives the actual CP5 LEDs and saves the sampled byte', () => {
    const result = invoke('cp1-cp5-binary', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.equal(behavior.checks.length, 18);
    assert.deepEqual(behavior.checks.find(check => check.label === 'CP5 indicator pattern 165').observed,
        [true, false, true, false, false, true, false, true]);
});

test('Arduino lessons verify a retargeted pull-up, switch debounce and the VM timer', () => {
    const scenarios = [
        ['arduino-02-digital-input-pullup', 'stm32f030', [false, true, false]],
        ['arduino-02-debounce', 'stc12c5a60s2', [true, true, false, false, true]],
        ['arduino-02-blink-without-delay', 'arduino-nano', [false, true, false]]
    ];
    for (const [lesson, device, sequence] of scenarios) {
        const result = invoke(lesson, '--device', device, '--json');
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const {rows: [{behavior}]} = JSON.parse(result.stdout);
        assert.deepEqual(behavior.checks.map(check => check.observed), sequence);
    }
});

test('circuit CLI fails the coverage gate when a powered bench has no functional assertion', () => {
    const result = invoke('arduino-08-string-append', '--device', 'arduino-nano', '--json');
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const {rows: [{smoke, behavior}]} = JSON.parse(result.stdout);
    assert.equal(smoke, 'pass');
    assert.equal(behavior.status, 'unverified');
});

test('CP1 voltmeter replays three authored verification scenarios through its wired switches', () => {
    const result = invoke('cp1-bench-voltmeter', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    const readings = behavior.checks.filter(check => check.label === 'Cell Reading');
    assert.deepEqual(readings.map(({scenario, observed}) => [scenario, observed.operand]), [[1, 0], [2, 10], [3, 50]]);
    assert.equal(behavior.checks.filter(check => check.label === 'Switch levels reach their CP1 pins').length, 3);
});

test('circuit CLI rejects an unknown gallery ID', () => {
    const result = invoke('missing-example', '--json');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No matching gallery circuit benches/);
});
