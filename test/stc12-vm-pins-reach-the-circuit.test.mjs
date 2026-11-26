/**
 * The stc12 extension's pin blocks reach the circuit (task B5 gap 1,
 * docs/OPEN-TASKS-2026-09-29.md).
 *
 * WHY. `turn on LED`, `toggle`, `set LED to 1`, `set LED to 25 percent` and
 * `set BUZ to 440 hz` wrote `runtime._stc12Pins`, a map NOTHING read: not the
 * Circuit tab, not bw-board, not the designer. So a Scratch-VM run of an
 * 8051/Arduino/Pico project lit nothing on a correctly wired bench, digital
 * writes included — the same defect the micro:bit+ `digitalwrite` had before it
 * was wired to `vm.runtime.circuitBoard`. The intended reader is that board:
 * the stc12 JS/Python drivers sb3-creator emits already drive it with
 * `setPin`/`setPwm`/`setTone` on the terminal a PIN declaration names, and the
 * designer clocks it (CircuitDesigner: "MCU-backed circuits ... receive the
 * VM's pin writes").
 *
 * WHAT THIS HOLDS, with the REAL bw-board and the bench bw-board infers from
 * the declarations (the one the Run button builds):
 *  1. an active-low LED on P1.0 lights on `turn on`, goes dark on `turn off`,
 *     and `toggle`/`set to` agree;
 *  2. `set LED to 25 percent` gives the LED 25 % of its full-on current (the
 *     board switches the pin; B1's setPwm), a digital write takes it back;
 *  3. `read KEY` and the `when KEY pressed` hat read the CIRCUIT — the button
 *     part pressed on the board — not the program's own last write;
 *  4. a board-class pin (Arduino D9) is addressed by its `where`, and
 *     `set BUZ to 440 hz` starts the board's tone on the buzzer's pin;
 *  5. with no circuit attached the blocks still work against the extension's
 *     own record (the pre-existing behaviour, kept).
 *
 * MEASURED before the fix: every assertion in 1-4 read the LED at 0 mA and
 * the key as whatever the program last wrote (the map was the only store).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {importPackageSource} from './helpers/package-source.mjs';

import {loadExtensionClass, stubRuntime} from './helpers/bw-extensions.mjs';

const {BoardImpl} = await importPackageSource('bw-board/board.js');
(await importPackageSource('bw-board/register-all.js')).registerAllDevices();
const {inferNetlist} = await importPackageSource('bw-board/infer-netlist.js');

const MS = 1_000_000n;

/** An 8051 project: active-low LED on P1.0, active-low key on P3.2. */
const STC = () => ({
    device: 'stc12c5a60s2',
    pins: [
        {name: 'LED', port: 1, bit: 0, direction: 'output', activeLow: true},
        {name: 'KEY', port: 3, bit: 2, direction: 'input', activeLow: true}
    ],
    ports: [], parts: [], tables: []
});

/** The extension on a runtime whose Circuit tab holds the bench inferred from `stc`. */
function rig (stc, {attach = true} = {}) {
    const runtime = stubRuntime(stc);
    let board = null;
    if (attach) {
        const {parts, nets} = inferNetlist(stc);
        board = new BoardImpl();
        board.setNetlist(parts, nets);
        board.setPower(true);
        runtime.circuitBoard = board;
    }
    const Ext = loadExtensionClass('stc12');
    return {ext: new Ext(runtime), board, runtime, t: 0n};
}

/** Advance the board by `ms` of the designer's 50 ms clock; return the LED's mean mA. */
function run (r, led, ms = 200) {
    for (let i = 0; i < ms / 50; i++) { r.t += 50n * MS; r.board.advanceTo(r.t); }
    return r.board.ledBrightness(led) * 20;
}

test('turn on / off / toggle / set drive the LED the declaration names', () => {
    const r = rig(STC());
    r.ext.setpin({PIN: 'LED', STATE: 'on'});
    const on = run(r, 'LED_LED');
    assert.ok(on > 2, `turn on LED (active low) lights it: ${on.toFixed(3)} mA`);
    assert.equal(r.ext.read({PIN: 'LED'}), 1, 'read reports an active-low output as on');
    r.ext.setpin({PIN: 'LED', STATE: 'off'});
    assert.ok(run(r, 'LED_LED') < 0.01, 'turn off LED darkens it');
    r.ext.toggle({PIN: 'LED'});
    assert.ok(run(r, 'LED_LED') > 2, 'toggle from off lights it');
    r.ext.writepin({PIN: 'LED', VALUE: 1});
    assert.ok(run(r, 'LED_LED') < 0.01, 'set LED to 1 drives the pin HIGH: an active-low LED is dark');
    r.ext.setpin({PIN: 'LED', STATE: 'low'});
    assert.ok(run(r, 'LED_LED') > 2, 'turn low LED is a LEVEL, not a state');
});

test('set LED to N percent dims it to N % of full-on', () => {
    const full = (() => {
        const r = rig(STC());
        r.ext.setpin({PIN: 'LED', STATE: 'low'});
        return run(r, 'LED_LED');
    })();
    for (const pct of [25, 50, 75]) {
        const r = rig(STC());
        r.ext.setpwm({PIN: 'LED', VALUE: pct});
        const ma = run(r, 'LED_LED');
        // Duty is the fraction HIGH (the C pwm_set and bw-board's setPwm);
        // an active-low LED is lit for the LOW part.
        const want = full * (100 - pct) / 100;
        assert.ok(Math.abs(ma - want) <= 0.01 * full,
            `${pct} %: ${ma.toFixed(4)} mA, want ${want.toFixed(4)} mA of ${full.toFixed(4)}`);
    }
    const r = rig(STC());
    r.ext.setpwm({PIN: 'LED', VALUE: 25});
    run(r, 'LED_LED');
    assert.deepEqual(r.board.getPwm('P1.0'), {duty: 0.25, hz: 500});
    r.ext.setpin({PIN: 'LED', STATE: 'off'});
    assert.equal(r.board.getPwm('P1.0'), null, 'a digital write takes the pin back from the PWM');
    run(r, 'LED_LED');
    assert.ok(run(r, 'LED_LED') < 0.01);
});

test('read and the when-pressed hat read the circuit, not the last write', () => {
    const r = rig(STC());
    run(r, 'LED_LED', 50);
    assert.equal(Number(r.board.readPin('P3.2')), 1, 'released: the pull-up holds P3.2 high');
    assert.equal(r.ext.read({PIN: 'KEY'}), 0, 'released: an active-low button is logically off');
    assert.equal(r.ext.whenpin({PIN: 'KEY', EDGE: 'pressed'}), false);
    r.board.setControl('BTN_KEY', 1);
    run(r, 'LED_LED', 50);
    assert.equal(Number(r.board.readPin('P3.2')), 0, 'pressed: the button pulls P3.2 low');
    assert.equal(r.ext.read({PIN: 'KEY'}), 1, 'pressed: an active-low button is logically on');
    assert.equal(r.ext.whenpin({PIN: 'KEY', EDGE: 'pressed'}), true, 'active-low key reads pressed');
    assert.equal(r.ext.whenpin({PIN: 'KEY', EDGE: 'released'}), false);
});

test('an input with no external pull reads its programmed pull, as the drivers arm it', () => {
    // A user-drawn bench: the key straight to GND, relying on the pin's own
    // pull-up (active-low input -> input-pullup, the drivers' rule). Nothing
    // else ever calls setPin on a read-only pin, so unarmed it has no pin
    // state and its net floats.
    const stc = {device: 'pico', pins: [{name: 'KEY', where: 'GP15', direction: 'input', activeLow: true}],
        ports: [], parts: [], tables: []};
    const runtime = stubRuntime(stc);
    const board = new BoardImpl(3.3);
    board.setNetlist([
        {id: 'MCU', kind: 'mcu', params: {}, terminals: ['GP15', 'GND']},
        {id: 'BTN', kind: 'button', params: {}, terminals: ['a', 'b']},
        {id: 'GND', kind: 'gnd', params: {}, terminals: ['gnd']}
    ], [
        {id: 'n1', terminals: [{part: 'MCU', terminal: 'GP15'}, {part: 'BTN', terminal: 'a'}]},
        {id: 'n2', terminals: [{part: 'BTN', terminal: 'b'}, {part: 'GND', terminal: 'gnd'}]}
    ]);
    board.setPower(true);
    runtime.circuitBoard = board;
    const ext = new (loadExtensionClass('stc12'))(runtime);
    assert.equal(ext.read({PIN: 'KEY'}), 0, 'the programmed pull-up holds an active-low key inactive');
    board.setControl('BTN', 1);
    board.advanceTo(10n * MS);
    assert.equal(ext.read({PIN: 'KEY'}), 1, 'grounding an active-low input asserts it');
});

test('a board-class pin is addressed by its terminal name', () => {
    const stc = {device: 'arduino-nano', pins: [{name: 'led1', where: 'D9', direction: 'output', activeLow: false}],
        ports: [], parts: [], tables: []};
    const r = rig(stc);
    const led = r.board.parts.find(p => p.kind === 'led').id;
    r.ext.setpin({PIN: 'led1', STATE: 'on'});
    const full = run(r, led);
    assert.ok(full > 2, `D9 high lights ${led}: ${full.toFixed(3)} mA`);
    r.ext.setpwm({PIN: 'led1', VALUE: 25});
    const quarter = run(r, led);
    assert.ok(Math.abs(quarter - full / 4) <= 0.01 * full, `25 % on D9: ${quarter.toFixed(4)} of ${full.toFixed(4)} mA`);
});

test('set BUZ to N hz sounds the buzzer on that pin', () => {
    const stc = {device: 'stc12c5a60s2', pins: [{name: 'BUZZER', port: 2, bit: 3, direction: 'output', activeLow: false}],
        ports: [], parts: [], tables: []};
    const r = rig(stc);
    const buz = r.board.parts.find(p => p.kind === 'buzzer');
    assert.ok(buz, 'the inferred bench carries a buzzer on the BUZZER pin');
    r.ext.settone({PIN: 'BUZZER', VALUE: 440});
    assert.equal(r.board.drivenTones.get(buz.id)?.hz, 440);
    r.ext.settone({PIN: 'BUZZER', VALUE: 0});
    assert.equal(r.board.drivenTones.has(buz.id), false, '0 hz stops it');
});

test('with no circuit attached the blocks keep their own record', () => {
    const r = rig(STC(), {attach: false});
    assert.equal(r.ext.read({PIN: 'LED'}), 0);
    r.ext.setpin({PIN: 'LED', STATE: 'on'});
    assert.equal(r.ext.read({PIN: 'LED'}), 0, 'active low: on writes 0');
    r.ext.toggle({PIN: 'LED'});
    assert.equal(r.ext.read({PIN: 'LED'}), 1);
    r.ext.setpwm({PIN: 'LED', VALUE: 30});
    assert.equal(r.runtime._stc12Pins.LED_pwm, 30);
});
