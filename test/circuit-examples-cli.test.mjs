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

test('circuit CLI reports a functional timeout separately from startup', () => {
    const result = invoke('eater6502-vdp-hello', '--behavior-timeout-ms', '1', '--json');
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const {rows: [{smoke, behavior}]} = JSON.parse(result.stdout);
    assert.equal(smoke, 'pass');
    assert.equal(behavior.status, 'incomplete');
});

test('CP1 voltmeter replays three authored verification scenarios through its wired switches', () => {
    const result = invoke('cp1-bench-voltmeter', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    const readings = behavior.checks.filter(check => check.label === 'Cell Reading');
    assert.deepEqual(readings.map(({scenario, observed}) => [scenario, observed.operand]), [[1, 0], [2, 10], [3, 50]]);
    assert.equal(behavior.checks.filter(check => check.label === 'Switch levels reach their CP1 pins').length, 3);
});

test('the circuit CLI verifies intentional bus contention, real VDP output and wired CARDIAC I/O', () => {
    const cases = ['eater6502-contention-bug', 'eater6502-vdp-hello', 'cardiac-night-light'];
    for (const id of cases) {
        const result = invoke(id, '--json');
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const {rows: [{smoke, behavior}]} = JSON.parse(result.stdout);
        assert.equal(smoke, 'pass');
        assert.equal(behavior.status, 'pass');
        assert.ok(behavior.checks.length > 0);
    }
});

test('circuit CLI rejects an unknown gallery ID', () => {
    const result = invoke('missing-example', '--json');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No matching gallery circuit benches/);
});

test('meter lessons show readable, calibrated values at three pot positions', () => {
    for (const [lesson, units, expected] of [
        ['73-voltmeter', 'mV', ['0 mV', '2502 mV', '5000 mV']],
        ['74-ammeter', 'mA', ['4.9 mA', '9.8 mA', '454.5 mA']]
    ]) {
        const result = invoke(lesson, '--device', 'arduino-uno', '--json');
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const {rows: [{behavior}]} = JSON.parse(result.stdout);
        const readings = behavior.checks.filter(check => check.check.startsWith(`visible ${units}`));
        assert.deepEqual(readings.map(check => check.observed), expected);
    }
});

test('Pico Ping measures its real GPIO echo through a voltage divider', () => {
    const result = invoke('arduino-06-ping', '--device', 'pico', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    const inputs = behavior.checks.find(check => check.check.startsWith('echo reaches MCU')).observed;
    const outputs = behavior.checks.find(check => check.check.startsWith('reported whole centimetres')).observed;
    assert.ok(inputs[0].gpioUs.every(pulse => pulse === 2320));
    assert.ok(inputs[1].gpioUs.every(pulse => pulse === 6960));
    assert.ok(inputs.every(input => input.gpioPeak > 3 && input.gpioPeak < 3.3));
    assert.deepEqual(outputs.map(readings => [...new Set(readings)]), [[40], [120]]);
});

test('retargeted flyback lesson opens the original unclamped winding circuit', () => {
    const result = invoke('33-inductive-no-flyback', '--device', 'pico', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    const measured = new Map(behavior.checks.map(({check, observed}) => [check, observed]));
    assert.deepEqual(measured.get('explicit winding inductance'), ['l1']);
    assert.deepEqual(measured.get('no flyback diode'), []);
    assert.deepEqual(measured.get('program switches the motor at the mapped GPIO'), [true, false]);
    assert.ok(measured.get('unprotected collector transient') > 60);
});

test('retargeted retro console drives both matrices and silences its PNP buzzer on release', () => {
    const result = invoke('60-retro-console', '--device', 'arduino-mega', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.deepEqual(behavior.checks.map(check => check.observed), [[64, 64], [0, 1, 2], true, true]);
});

test('the 555 retrigger actually discharges its timing capacitor and extends the pulse', () => {
    const result = invoke('pc64-555-retrigger', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.deepEqual(behavior.checks.slice(0, 3).map(check => check.observed), [true, true, false]);
    const discharge = behavior.checks[3].observed;
    assert.ok(discharge.before > 1 && discharge.after < 0.3);
});

test('hourglass diode matrix accumulates six lit LEDs and its tilt reset clears them', () => {
    const result = invoke('pc86-led-sanduhr', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows: [{behavior}]} = JSON.parse(result.stdout);
    assert.deepEqual(behavior.checks[0].observed.slice(0, 8), [0, 1, 3, 7, 15, 31, 63, 0]);
    assert.equal(behavior.checks[1].observed, 0);
});
