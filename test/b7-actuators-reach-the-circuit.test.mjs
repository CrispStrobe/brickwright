/**
 * The actuator and part blocks B1/B5 left short of the circuit, at the pinned
 * bw-board (task B7 of docs/OPEN-TASKS-2026-09-29.md).
 *
 * WHAT WAS MEASURED, at the previous pins (bw-board 31c6499a, extensions
 * e82ebcdc, sb3-creator 3250c2ca):
 *  1. devices `set motor direction` was refused by the board ("has no
 *     simulator action for this"), and could not have worked: the dc_motor
 *     model clamped omega at 0, so a motor driven backwards through an L293D
 *     sat still, and `direction of motor` said "stopped" for every motor.
 *  2. the stc12 PORT, 74HC595 PART, SEVENSEG8, LEDBANK8 and KEYPAD4X4 blocks
 *     wrote buffers nothing read: on the Prechin A2 wiring the display stayed
 *     blank, the LEDs off, a held key read -1, the 595 latched 0 and the port
 *     pins were never driven (16 of 19 checks red).
 *  3. the JS/Python simulator drivers' setServo/setMotor/setDirection were
 *     empty, and readKeypad read a store nothing writes.
 *
 * Each is held here against the REAL engine Lite ships (node_modules/bw-board
 * at vendor-pins.json), through the shipped bundles and the vendored compiler.
 * MATRIX8X8 stays a named gap (stc12.js says why): no row of it is asserted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

import {loadExtensionClass, stubRuntime} from './helpers/bw-extensions.mjs';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BWB = path.join(ROOT, 'node_modules/bw-board/src');
const {BoardImpl} = await import(path.join(BWB, 'board.js'));
(await import(path.join(BWB, 'register-all.js'))).registerAllDevices();

const MS = 1_000_000n;
const T = (part, terminal) => ({part, terminal});
const run = (b, ms) => {
    const end = b.timeNs + BigInt(ms) * MS;
    for (let t = b.timeNs + 10n * MS; t <= end; t += 10n * MS) b.advanceTo(t);
};
const refusals = b => b.getWarnings().map(w => w.message).join('\n');
const withBoard = (id, board, stc = {pins: [], ports: [], parts: [], tables: []}) => {
    const runtime = stubRuntime(stc);
    runtime.circuitBoard = board;
    const Ext = loadExtensionClass(id);
    return new Ext(runtime);
};

// A small fast motor, so a few hundred ms reach its speed.
const MOTOR = {kV: 0.05, J: 1e-5, windingR: 5};

/** MCU -> L293D (h_bridge) channel 1 -> motor; EN P1.4, IN1 P3.4, IN2 P3.5. */
function l293dBench () {
    const b = new BoardImpl(5);
    b.setNetlist([
        {id: 'mcu', kind: 'mcu', params: {}, terminals: ['P1.4', 'P3.4', 'P3.5']},
        {id: 'v', kind: 'vcc', params: {}, terminals: ['vcc']},
        {id: 'g', kind: 'gnd', params: {}, terminals: ['gnd']},
        {id: 'u1', kind: 'h_bridge', params: {}, terminals: ['vcc', 'gnd', 'en1', 'in1', 'in2', 'out1', 'out2', 'en2', 'in3', 'in4', 'out3', 'out4']},
        {id: 'm1', kind: 'dc_motor', params: {...MOTOR}, terminals: ['a', 'b']}
    ], [
        {id: 'nv', terminals: [T('v', 'vcc'), T('u1', 'vcc')]},
        {id: 'ng', terminals: [T('g', 'gnd'), T('u1', 'gnd')]},
        {id: 'nen', terminals: [T('mcu', 'P1.4'), T('u1', 'en1')]},
        {id: 'ni1', terminals: [T('mcu', 'P3.4'), T('u1', 'in1')]},
        {id: 'ni2', terminals: [T('mcu', 'P3.5'), T('u1', 'in2')]},
        {id: 'na', terminals: [T('u1', 'out1'), T('m1', 'a')]},
        {id: 'nb', terminals: [T('u1', 'out2'), T('m1', 'b')]}
    ]);
    b.setPower(true);
    return b;
}

/** The gallery's single-transistor motor: D6 -> 1 k -> NPN -> motor -> 5 V. */
function npnBench () {
    const b = new BoardImpl(5);
    b.setNetlist([
        {id: 'mcu', kind: 'mcu', params: {}, terminals: ['D6']},
        {id: 'v', kind: 'vcc', params: {}, terminals: ['vcc']},
        {id: 'g', kind: 'gnd', params: {}, terminals: ['gnd']},
        {id: 'rb', kind: 'resistor', params: {ohms: 1000}, terminals: ['a', 'b']},
        {id: 'q', kind: 'npn', params: {}, terminals: ['base', 'collector', 'emitter']},
        {id: 'm1', kind: 'dc_motor', params: {}, terminals: ['a', 'b']}
    ], [
        {id: 'pin6', terminals: [T('mcu', 'D6'), T('rb', 'a')]},
        {id: 'base', terminals: [T('rb', 'b'), T('q', 'base')]},
        {id: 'col', terminals: [T('q', 'collector'), T('m1', 'b')]},
        {id: 'vcc', terminals: [T('v', 'vcc'), T('m1', 'a')]},
        {id: 'gnd', terminals: [T('g', 'gnd'), T('q', 'emitter')]}
    ]);
    b.setPower(true);
    return b;
}

test('devices: set motor direction turns a motor both ways through an L293D', () => {
    const b = l293dBench();
    const ext = withBoard('devices', b);
    ext.setmotor({MOTOR: '1', SPEED: 100});
    ext.setdirection({MOTOR: '1', DIR: 'forward'});
    run(b, 200);
    assert.equal(ext.motordirection({MOTOR: '1'}), 'forward');
    ext.setdirection({MOTOR: '1', DIR: 'reverse'});
    assert.deepEqual([b.pinStates.get('p3.4').driveHigh, b.getPwm('P3.5')], [false, {duty: 1, hz: 500}],
        'reverse: IN1 low, IN2 carries the speed');
    run(b, 400);
    assert.equal(ext.motordirection({MOTOR: '1'}), 'reverse', `velocity ${b.getDeviceState('m1').velocity}`);
    assert.ok(ext.motorspeed({MOTOR: '1'}) > 1, 'the speed reporter is the magnitude');
    const before = ext.motorspeed({MOTOR: '1'});
    ext.setdirection({MOTOR: '1', DIR: 'brake'});
    run(b, 300);
    assert.ok(ext.motorspeed({MOTOR: '1'}) < 0.5 * before, `brake slows it: ${ext.motorspeed({MOTOR: '1'})} from ${before}`);
    assert.doesNotMatch(refusals(b), /m1/);
});

test('devices: a single-transistor motor turns one way, and reverse is refused by name', () => {
    const b = npnBench();
    const ext = withBoard('devices', b);
    ext.setdirection({MOTOR: '1', DIR: 'forward'});
    assert.doesNotMatch(refusals(b), /m1/, 'forward is what it already does');
    ext.setdirection({MOTOR: '1', DIR: 'reverse'});
    assert.match(refusals(b), /driven by one MCU pin \(D6\) through a single switch, which turns it one way only; reverse needs an H-bridge/);
});

/** The Prechin A2's own wiring for the stc12 PARTs (examples/board-prechin-a2-learning-board). */
function a2Bench () {
    const seg = ['seg_a', 'seg_b', 'seg_c', 'seg_d', 'seg_e', 'seg_f', 'seg_g', 'seg_dp'];
    const rows = ['P1.7', 'P1.6', 'P1.5', 'P1.4'];
    const cols = ['P1.3', 'P1.2', 'P1.1', 'P1.0'];
    const b = new BoardImpl(5);
    b.setNetlist([
        {id: 'v', kind: 'vcc', params: {}, terminals: ['vcc']},
        {id: 'g', kind: 'gnd', params: {}, terminals: ['gnd']},
        {id: 'mcu', kind: 'mcu', params: {}, terminals: [...seg.map((_, i) => `P0.${i}`),
            ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => `P2.${i}`), ...rows, ...cols, 'P3.4', 'P3.5', 'P3.6']},
        {id: 'sevenseg', kind: 'sevenseg8', params: {}, terminals: ['vcc', 'gnd', ...seg, 'sel_a', 'sel_b', 'sel_c']},
        {id: 'leds', kind: 'ledbank8', params: {activeLow: true}, terminals: ['vcc', 'gnd', 'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']},
        {id: 'keypad', kind: 'keypad_4x4', params: {pressed: -1}, terminals: ['r0', 'r1', 'r2', 'r3', 'c0', 'c1', 'c2', 'c3']},
        {id: 'sr1', kind: '74hc595', params: {}, terminals: ['vcc', 'gnd', 'ser', 'srclk', 'rclk', 'qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg', 'qh']}
    ], [
        {id: 'nv', terminals: [T('v', 'vcc'), T('sevenseg', 'vcc'), T('leds', 'vcc'), T('sr1', 'vcc')]},
        {id: 'ng', terminals: [T('g', 'gnd'), T('sevenseg', 'gnd'), T('leds', 'gnd'), T('sr1', 'gnd')]},
        ...seg.map((t, i) => ({id: `s${i}`, terminals: [T('mcu', `P0.${i}`), T('sevenseg', t)]})),
        // P2.2-P2.4 carry both the 138 select and LEDs D2-D4, as on the board.
        ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({id: `p2_${i}`, terminals: [T('mcu', `P2.${i}`), T('leds', `d${i}`),
            ...(i >= 2 && i <= 4 ? [T('sevenseg', ['sel_a', 'sel_b', 'sel_c'][i - 2])] : [])]})),
        ...rows.map((p, i) => ({id: `r${i}`, terminals: [T('mcu', p), T('keypad', `r${i}`)]})),
        ...cols.map((p, i) => ({id: `c${i}`, terminals: [T('mcu', p), T('keypad', `c${i}`)]})),
        {id: 'ser', terminals: [T('mcu', 'P3.4'), T('sr1', 'ser')]},
        {id: 'srclk', terminals: [T('mcu', 'P3.6'), T('sr1', 'srclk')]},
        {id: 'rclk', terminals: [T('mcu', 'P3.5'), T('sr1', 'rclk')]}
    ]);
    b.setPower(true);
    return b;
}

const pin = w => ({port: Number(w[1]), bit: Number(w[3])});
const A2_STC = () => ({
    device: 'stc89c52rc', pins: [], tables: [],
    ports: [],
    parts: [
        {name: 'display', type: 'sevenseg8', segPort: 0, selPins: [pin('P2.2'), pin('P2.3'), pin('P2.4')], claims: [], commonAnode: false},
        {name: 'keys', type: 'keypad4x4', claims: [], rows: ['P1.7', 'P1.6', 'P1.5', 'P1.4'].map(pin), cols: ['P1.3', 'P1.2', 'P1.1', 'P1.0'].map(pin)},
        {name: 'sr', type: '74hc595', claims: [], data: pin('P3.4'), clock: pin('P3.6'), latch: pin('P3.5'), activeLow: false}
    ]
});

test('stc12: SEVENSEG8 shows the number on the A2 display', () => {
    const b = a2Bench();
    const ext = withBoard('stc12', b, A2_STC());
    ext.seg_shownum({NUM: 12345678, PART: 'display'});
    assert.equal(b.getDeviceState('sevenseg').text.join(''), '12345678');
    ext.seg_showdigit({DIGIT: 0, VALUE: 15, PART: 'display'});
    assert.equal(b.getDeviceState('sevenseg').text.join(''), 'F2345678');
    ext.seg_clear({PART: 'display'});
    assert.equal(b.getDeviceState('sevenseg').text.join(''), '        ');
});

test('stc12: KEYPAD4X4 is scanned on the circuit, and the hat fires on the held key', () => {
    const b = a2Bench();
    const ext = withBoard('stc12', b, A2_STC());
    assert.equal(ext.keypad({PART: 'keys'}), -1);
    for (const k of [0, 6, 9, 15]) {
        b.setPartParam('keypad', 'pressed', k);
        b.advanceTo(b.timeNs + MS);
        assert.equal(ext.keypad({PART: 'keys'}), k, `key ${k}`);
    }
    assert.equal(ext.whenkey({KEY: 15, EDGE: 'pressed'}), true);
});

test('stc12: a 74HC595 PART latches the value, MSB first', () => {
    const b = a2Bench();
    const ext = withBoard('stc12', b, A2_STC());
    ext.setpart({PART: 'sr', VALUE: 0xA6});
    assert.equal(b.getDeviceState('sr1').latchReg, 0xA6);
});

test('stc12: LEDBANK8 and a PORT drive their pins', () => {
    const b = a2Bench();
    const stc = A2_STC();
    stc.parts = stc.parts.filter(p => p.type !== 'sevenseg8');
    stc.parts.push({name: 'leds', type: 'ledbank8', ledPort: 2, claims: [], activeLow: true});
    stc.ports.push({name: 'segs', port: 0, direction: 'output', activeLow: false});
    const ext = withBoard('stc12', b, stc);
    ext.led_set({VALUE: 0b10000011, PART: 'leds'});
    assert.equal(Array.from(b.getDeviceState('leds').leds).join(''), '11000001');
    ext.led_only({N: 4, PART: 'leds'});
    assert.equal(Array.from(b.getDeviceState('leds').leds).join(''), '00001000');
    ext.setport({PORT: 'segs', VALUE: 0x5A});
    const v = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, i) => a | ((b.pinStates.get(`p0.${i}`).driveHigh ? 1 : 0) << i), 0);
    assert.equal(v, 0x5A);
    assert.equal(ext.readport({PORT: 'segs'}), 0x5A);
});

test('stc12: on the A2, an LED-bank write keeps the display (D2-D4 are its select pins, as on silicon)', () => {
    const b = a2Bench();
    const stc = A2_STC();
    stc.parts.push({name: 'leds', type: 'ledbank8', ledPort: 2, claims: [], activeLow: true});
    const ext = withBoard('stc12', b, stc);
    ext.seg_shownum({NUM: 87654321, PART: 'display'});
    ext.led_set({VALUE: 0b11100011, PART: 'leds'});
    assert.equal(b.getDeviceState('sevenseg').text.join(''), '87654321', 'the display survived the port write');
    const leds = Array.from(b.getDeviceState('leds').leds);
    assert.deepEqual([leds[0], leds[1], leds[5], leds[6], leds[7]], [1, 1, 1, 1, 1], 'the unshared LEDs show the byte');
});

/** The vendored compiler's simulator-driver JavaScript, run against `board`. */
function runGenerated (source, board) {
    const creator = new SB3Creator();
    creator.parse(source);
    const js = creator.generateJavaScript(undefined, {driver: 'simulator'});
    vm.runInNewContext(js, {bwBoard: board, console: {log () {}, warn () {}, error () {}, info () {}}, prompt: () => ''},
        {timeout: 8000});
}

test('JS driver: a devices program steers the L293D motor like the blocks do', () => {
    const b = l293dBench();
    runGenerated([
        'DEVICE STC12C5A60S2', 'CLOCK 11059200', 'PART mymotor = MOTOR 1', '',
        'WHEN flag clicked:', '  set mymotor speed to 100', '  set mymotor direction reverse', ''
    ].join('\n'), b);
    assert.deepEqual(b.getPwm('P3.5'), {duty: 1, hz: 500});
    run(b, 400);
    assert.equal(b.getDeviceState('m1').direction, 'reverse');
});

test('JS driver: a keypad read reaches the circuit and comes back out on a port', () => {
    const b = a2Bench();
    b.setPartParam('keypad', 'pressed', 6);
    b.advanceTo(b.timeNs + MS);
    runGenerated([
        'DEVICE STC89C52RC', 'CLOCK 11059200',
        'PORT segs = P0 OUTPUT',
        'PART keys = KEYPAD4X4 ROWS P1.7 P1.6 P1.5 P1.4 COLS P1.3 P1.2 P1.1 P1.0', '',
        'WHEN flag clicked:', '  set k to keys', '  set segs to k', ''
    ].join('\n'), b);
    const v = [0, 1, 2, 3, 4, 5, 6, 7].reduce((a, i) => a | ((b.pinStates.get(`p0.${i}`)?.driveHigh ? 1 : 0) << i), 0);
    assert.equal(v, 6, 'key 6 scanned and written to P0');
});

test('devices: NeoPixel strip indices follow DOUT to DIN across wired packages', () => {
    const board = new BoardImpl(5);
    const packages = [
        {id: 'tail', pixels: 1},
        {id: 'head', pixels: 2},
        {id: 'independent', pixels: 1}
    ].map(({id, pixels}) => ({
        id,
        kind: 'neopixel',
        params: {pixels},
        terminals: ['din', 'dout', 'vcc', 'gnd']
    }));
    const wired = [{id: 'data', terminals: [T('head', 'dout'), T('tail', 'din')]}];
    board.setNetlist(packages, wired);
    board.setPower(true);
    const ext = withBoard('devices', board);
    const write = (strip, index, red) => ext.setneopixel({STRIP: strip, INDEX: index, R: red, G: 0, B: 0});
    const colors = id => board.getDeviceState(id).pixels;

    write('1', 1, 11);
    write('1', 2, 22);
    write('2', 0, 33);
    assert.deepEqual(colors('head'), [0, 0x0B0000]);
    assert.deepEqual(colors('tail'), [0x160000]);
    assert.deepEqual(colors('independent'), [0x210000]);

    write('tail', 0, 44);
    assert.deepEqual(colors('tail'), [0x2C0000]);
    ext.clearneopixels({STRIP: 'head'});
    assert.deepEqual(colors('head'), [0, 0]);
    assert.deepEqual(colors('tail'), [0]);
    assert.deepEqual(colors('independent'), [0x210000]);

    board.setNetlist(packages, []);
    write('head', 2, 55);
    assert.deepEqual(colors('tail'), [0]);
});
