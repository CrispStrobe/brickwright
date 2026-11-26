/**
 * The C tab's ▶ Run sketch on the AVR boards — a hand-written Arduino sketch,
 * compiled as real C++ by stc-compiler's `arduino` route and booted on the
 * board's own engine through the debug panel's firmware path.
 *
 * Three layers, each with its own evidence:
 *
 *   1. THE ROUTE (lib/bw-debug/arduino-sketch.js), driven with a fake compile:
 *      which boards it serves and on which engine, what it sends, how a
 *      refusal is told apart from a dead network, and which clock the image is
 *      simulated at.
 *
 *   2. THE ENGINES. Real sketch images, compiled by the service and kept in
 *      test/fixtures/arduino-sketch-images.json, run on the PINNED bw-board
 *      exactly as attachAvr8js runs a firmware image: createDebugTarget(kind,
 *      {hex, symbols: null, clockHz}). The Uno must print what its C++ says
 *      over the USART; the ATtinys have no USART, so their LED must blink at
 *      the rate the sketch asks for -- at their 8 MHz crystal, which is why the
 *      firmware carries its clock.
 *
 *   3. THE WIRING, by source: the button is gated by the route's own table,
 *      the compile is the component's one hosted compile, the panel boots the
 *      image as firmware on the named engine, and a firmware image with no
 *      symbols and a project with no pins reach the AVR attach without
 *      throwing.
 *
 * The Mega was held out of the route until bw-board #41 fixed its data space;
 * it now runs the same C++ sketch the Uno does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {packageSourceRoot} from './helpers/package-source.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(REPO, 'overlay/scratch-gui/src');
const read = rel => readFileSync(path.join(SRC, rel), 'utf8');

const route = await import(pathToFileURL(path.join(SRC, 'lib/bw-debug/arduino-sketch.js')).href);
const {arduinoSketchExamplesFor} =
    await import(pathToFileURL(path.join(SRC, 'lib/bw-asm/examples.js')).href);
const fixtures = JSON.parse(readFileSync(
    path.join(REPO, 'test/fixtures/arduino-sketch-images.json'), 'utf8')).images;

const b64 = s => Buffer.from(s, 'latin1').toString('base64');

// --------------------------------------------------------------- the route

test('the route serves the Uno/Nano family, the Mega and the ATtinys, each on its own engine', () => {
    const table = Object.fromEntries(Object.entries(route.ARDUINO_SKETCH_BOARDS)
        .map(([id, b]) => [id, `${b.target}|${b.kind}|${b.clockHz}`]));
    assert.deepEqual(table, {
        'arduino-uno': 'arduino-uno|avr8js|16000000',
        'arduino-nano': 'arduino-nano|avr8js|16000000',
        atmega328p: 'atmega328p|avr8js|16000000',
        atmega168p: 'atmega168p|avr8js|16000000',
        'arduino-mega': 'arduino-mega|atmega2560|16000000',
        atmega2560: 'atmega2560|atmega2560|16000000',
        arduboy: 'arduboy|arduboy|16000000',
        attiny85: 'attiny85|attiny85|8000000',
        attiny88: 'attiny88|attiny88|8000000'
    });
    assert.equal(route.sketchBoardFor('ARDUINO-UNO').kind, 'avr8js', 'lookup is case-insensitive');
    for (const other of ['stc12c5a60s2', 'pico', 'riscv32', 'i8086', '', null]) {
        assert.equal(route.sketchBoardFor(other), null, `${other} must not get a sketch button`);
    }
});

test('the engine for each board is the one the debug panel picks for that device', () => {
    // debug-panel's syncDeviceKind: device-specific kinds first, else the
    // 'arduino' core's avr8js. A sketch must land where a blocks program for
    // the same board would, not on whatever the panel was last left on.
    const panel = read('components/tw-pseudocode/debug-panel.jsx');
    for (const [id, b] of Object.entries(route.ARDUINO_SKETCH_BOARDS)) {
        if (b.kind === 'arduboy') continue;          // the console, not the debugger
        const specific = new RegExp(`['"]?${id}['"]?: '([a-z0-9]+)'`).exec(
            panel.slice(panel.indexOf('const DEVICE_TO_KIND'), panel.indexOf('const CORE_TO_KIND')));
        assert.equal(b.kind, specific ? specific[1] : 'avr8js', `${id}: route and panel disagree`);
    }
});

test('a build asks the one hosted compile for an arduino-language hex', async () => {
    const calls = [];
    const hex = ':00000001FF\n';
    const built = await route.requestSketchBuild({
        source: 'void setup(){}\nvoid loop(){}\n', device: 'arduino-nano',
        compile: async (...args) => {
            calls.push(args);
            return {base64: b64(':020000000C94FF\n' + hex), f_cpu: 16000000,
                prototypes: ['void setup();', 'void loop();'], libraries: ['Wire'], log: ''};
        }
    });
    assert.deepEqual(calls, [['void setup(){}\nvoid loop(){}\n', 'arduino-nano', 'hex', 'arduino',
        {symbols: true}]]);
    assert.equal(built.kind, 'avr8js');
    assert.equal(built.bytes, 2, 'bytes counts data records, not text');
    assert.deepEqual(built.libraries, ['Wire']);
    assert.deepEqual(route.sketchFirmware(built),
        {name: 'sketch.hex', bytes: null, text: built.hex, fCpu: 16000000, symbols: null, device: 'arduino-nano'});
});

test('the board\'s crystal wins over the clock the image reports, and a mismatch is kept', async () => {
    // Simulating at the image's own F_CPU makes a mis-built image look right:
    // built for 11 MHz, run at 11 MHz, every delay exact. The board's crystal
    // is what the silicon would run it at.
    const built = await route.requestSketchBuild({
        source: 'x', device: 'attiny85',
        compile: async () => ({base64: b64(':00000001FF\n'), f_cpu: 11059200})
    });
    assert.equal(built.clockHz, 8000000);
    assert.equal(built.builtForHz, 11059200);
    assert.equal(route.sketchFirmware(built).fCpu, 8000000);
});

test('a refusal is the sketch\'s; a dead network is not', async () => {
    const refused = new Error('main.ino:4:3: error: \'nope\' was not declared in this scope');
    refused.log = 'full compiler log';
    await assert.rejects(
        route.requestSketchBuild({source: 'x', device: 'atmega328p', compile: async () => { throw refused; }}),
        e => e.reason === 'source' && /main\.ino:4/.test(e.message) && e.log === 'full compiler log');
    await assert.rejects(
        route.requestSketchBuild({source: 'x', device: 'atmega328p',
            compile: async () => { throw new TypeError('Failed to fetch'); }}),
        e => e.reason === 'transport');
    await assert.rejects(
        route.requestSketchBuild({source: 'x', device: 'atmega328p',
            compile: async () => ({base64: b64('not hex')})}),
        e => e.reason === 'transport' && /not Intel HEX/.test(e.message));
    await assert.rejects(
        route.requestSketchBuild({source: 'x', device: 'pico', compile: async () => ({})}),
        e => e.reason === 'transport');
});

test('the starters: Serial sketches only where there is a USART', () => {
    const uno = arduinoSketchExamplesFor('arduino-uno');
    assert.ok(uno.length >= 4 && uno.some(e => e.serial));
    for (const ex of uno) {
        assert.match(ex.source, /void setup\s*\(/, `${ex.id} has no setup()`);
        assert.match(ex.source, /void loop\s*\(/, `${ex.id} has no loop()`);
        assert.ok(ex.label && ex.labelDe, `${ex.id} is not in both locales`);
    }
    const tiny = arduinoSketchExamplesFor('attiny85');
    assert.ok(tiny.length >= 1 && tiny.every(e => !e.serial && !/Serial\./.test(e.source)),
        'an ATtiny has no hardware USART; its starters must not print');
    assert.deepEqual(arduinoSketchExamplesFor('stc12c5a60s2'), []);
    assert.ok(arduinoSketchExamplesFor('arduino-mega').some(e => e.serial),
        'the Mega has a USART; it gets the Serial starters');
});

// ------------------------------------------------------------- the engines

const BW_BOARD = packageSourceRoot('bw-board');
const bw = await import(pathToFileURL(path.join(BW_BOARD, 'index.js')).href);
(await import(pathToFileURL(path.join(BW_BOARD, 'register-all.js')).href)).registerAllDevices();

/** Boot a fixture image exactly as attachAvr8js boots firmware: no symbols. */
async function boot (fixtureId, kind, clockHz) {
    const board = new bw.BoardImpl();
    board.setNetlist([{id: 'u1', kind: 'mcu', terminals: ['gnd']}, {id: 'g1', kind: 'gnd', terminals: ['gnd']}],
        [{id: 'n1', terminals: [{part: 'u1', terminal: 'gnd'}, {part: 'g1', terminal: 'gnd'}]}]);
    board.setPower(true);
    const {target, adapter} = await bw.createDebugTarget(kind,
        {board, hex: fixtures[fixtureId].hex, symbols: null, clockHz});
    let serial = '';
    if (adapter.onSerial) adapter.onSerial(byte => { serial += String.fromCharCode(byte); });
    bw.createDebugSession(target, {onChange: () => {}}).start();
    return {adapter, serial: () => serial};
}

test('an Uno sketch using a class, String, F() and a late-defined function prints over Serial', async () => {
    const fx = fixtures['arduino-uno'];
    assert.match(fx.source, /class Counter/);
    assert.ok(fx.prototypes.includes('void report(int v);'), 'the fixture no longer exercises prototypes');
    const b = route.sketchBoardFor('arduino-uno');
    const {adapter, serial} = await boot('arduino-uno', b.kind, b.clockHz);
    for (let i = 0; i < 25; i++) adapter.advanceNs(10_000_000);   // 250 ms
    const lines = serial().split('\r\n');
    assert.deepEqual(lines.slice(0, 3), ['hello from C++', 'n=20 pi=3.142', 'n=21 pi=3.142'],
        `the Uno said ${JSON.stringify(serial().slice(0, 80))}`);
});

for (const [id, portB, ledBit] of [['attiny85', 0x38, 1], ['attiny88', 0x25, 5]]) {
    test(`an ${id} sketch blinks at its 8 MHz crystal, and would run double-speed at the default`, async () => {
        const edges = async clockHz => {
            const {adapter} = await boot(id, route.sketchBoardFor(id).kind, clockHz);
            let last = null;
            let n = 0;
            for (let i = 0; i < 100; i++) {                            // 1 s
                adapter.advanceNs(10_000_000);
                const bit = (adapter.cpu.data[portB] >> ledBit) & 1;
                if (last !== null && bit !== last) n++;
                last = bit;
            }
            return n;
        };
        // delay(100) on, delay(100) off: ten edges a second.
        const atCrystal = await edges(route.sketchBoardFor(id).clockHz);
        assert.ok(atCrystal >= 8 && atCrystal <= 11, `${atCrystal} edges in 1 s at 8 MHz`);
        // The control: the runner's 16 MHz default. This is the timing the
        // firmware's fCpu exists to prevent.
        const atDefault = await edges(16000000);
        assert.ok(atDefault >= 17, `${atDefault} edges at 16 MHz -- the control did not separate`);
    });
}

test('a Mega sketch prints over Serial on the atmega2560 engine', async () => {
    // Held as a GAP until bw-board #41: the pinned engine ended the 2560's
    // data space below RAMEND, so this image reset-looped and printed
    // nothing. The pin that fixed it is the one this test runs on.
    const b = route.sketchBoardFor('arduino-mega');
    const {adapter, serial} = await boot('arduino-mega', b.kind, b.clockHz);
    for (let i = 0; i < 25; i++) adapter.advanceNs(10_000_000);
    assert.deepEqual(serial().split('\r\n').slice(0, 3),
        ['hello from C++', 'n=20 pi=3.142', 'n=21 pi=3.142'],
        `the Mega said ${JSON.stringify(serial().slice(0, 80))}`);
});

// ------------------------------------------------------------- the wiring

test('the C tab ▶ is gated by the route table and uses the one hosted compile', () => {
    const src = read('components/tw-pseudocode/pseudocode-importer.jsx');
    assert.match(src, /this\.state\.lang === 'c' && sketchBoardFor\(this\.currentDevice\(\)\) \?/,
        'the button must be gated by the route\'s own table, not a device list in the JSX');
    assert.match(src, /data-testid=\{menu \? "bw-run-arduino-sketch-menu" : "bw-run-arduino-sketch"\}/);
    assert.match(src, /data-testid=\{menu \? "bw-arduino-sketch-examples-menu" : "bw-arduino-sketch-examples"\}/);
    const handler = src.slice(src.indexOf('async runSketchOnAvr ()'));
    const body = handler.slice(0, handler.indexOf('\n    /**'));
    assert.match(body, /await this\.hostedCompileC\(code, target, format, language, extra\)/,
        'the sketch must compile through hostedCompileC, not a fetch of its own');
    assert.doesNotMatch(body, /fetch\(/);
    assert.match(body, /format: 'avr-sketch'/);
    assert.match(body, /firmware: sketchFirmware\(built\)/);
    assert.match(body, /kind: built\.kind/);
    assert.match(src, /async hostedCompileC \(code, target, format, language = 'c', extra = \{\}\)/);
    assert.match(src, /body: JSON\.stringify\(\{code, language, target, format, \.\.\.extra\}\)/);
    for (const key of ['runSketch', 'runSketchTitle', 'runSketchBuilding', 'runSketchBuilt',
        'runSketchRefused', 'runSketchUnavailable', 'runSketchEmpty', 'runSketchClockMismatch']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
});

test('the debug panel boots a sketch as firmware, on the engine the route named', () => {
    const src = read('components/tw-pseudocode/debug-panel.jsx');
    // N4 routes an assembled ARM image ('firmware') through the same boot.
    assert.match(src, /if \(format === 'avr-sketch' \|\| format === 'firmware'\) return this\._runSketch\(e\.detail\);/);
    const body = src.slice(src.indexOf('    _runSketch (detail) {'));
    const fn = body.slice(0, body.indexOf('\n    }\n') + 6);
    assert.match(fn, /this\._userFirmware = firmware;/);
    assert.match(fn, /kind: kind \|\| this\.state\.kind/);
    assert.match(fn, /this\.onStart\(\)/);
});

test('the AVR attach survives firmware with no symbols and a project with no pins', () => {
    const src = read('lib/bw-debug/debug-runner.js');
    assert.match(src, /f_cpu: fw\.fCpu \|\| null, format: 'ihx'/,
        'a firmware image\'s own clock must reach the engine');
    const attach = src.slice(src.indexOf('async function attachAvr8js('),
        src.indexOf('async function attachRp2040js('));
    assert.match(attach, /pins: \(declared && declared\.pins\) \|\| \[\]/,
        'inferNetlist reads stc.pins unguarded');
    assert.match(attach, /\(symbols && symbols\.variables \|\| \[\]\)/,
        'symbols.variables threw on every firmware image');
    assert.doesNotMatch(attach, /\(symbols\.variables \|\| \[\]\)/);
});

test('a sketch on the bare chip gets a calm note, not the red improvised-board alert', () => {
    const src = read('components/tw-pseudocode/debug-panel.jsx');
    // The alert is for a BLOCKS program whose example circuit the inferred
    // bench could be mistaken for; firmware has no example to be mistaken for.
    assert.match(src, /const inferredBoard = this\.state\.boardSource === 'inferred' && !this\.state\.firmwareName;/);
    assert.match(src, /const bareChipFirmware = this\.state\.boardSource === 'inferred' && !!this\.state\.firmwareName;/);
    assert.match(src, /\{bareChipFirmware \? \(\s*<div data-bare-chip-note role="note"/);
    assert.equal(src.split('firmwareBareChip:').length - 1, 2, 'the note is not in both locales');
});

test('the way back from a running image is a labelled button, in both locales', () => {
    const src = read('components/tw-pseudocode/debug-panel.jsx');
    const chip = src.slice(src.indexOf('<span data-firmware-chip'));
    const block = chip.slice(0, chip.indexOf('</span>'));
    assert.match(block, /data-firmware-back/);
    assert.match(block, /onClick=\{\(\) => this\.onFirmwareClear\(\)\}/);
    assert.match(block, /\{this\.tx\('firmwareBack'\)\}/, 'the button says where it goes, not just ✕');
    assert.doesNotMatch(block, /title=\{'/, 'no hard-coded English tooltip');
    for (const key of ['firmwareRunning', 'firmwareBack', 'firmwareBackTitle']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
});

test('a sketch\'s symbol table travels with its image into the debugger', async () => {
    const table = {source: 'main.ino', variables: [{name: 'ticks', space: 'sram', addr: 0x10b, size: 2}],
        functions: [{name: 'loop', addr: 0x200, size: 20}], lines: [{line: 6, addr: 0x204}]};
    const built = await route.requestSketchBuild({source: 'x', device: 'arduino-uno',
        compile: async () => ({base64: b64(':00000001FF\n'), f_cpu: 16000000, symbols: table})});
    assert.equal(route.sketchFirmware(built).symbols, table, 'the firmware must carry its own table');
    const runner = read('lib/bw-debug/debug-runner.js');
    assert.match(runner, /symbols: fw\.symbols \|\| null, c: null,/,
        'builtFromUserFirmware must pass the firmware\'s table to the engine');
});

test('with its table loaded, the engine reads a sketch global where the table says', async () => {
    // What the variables view does: target.readMem at each variable's
    // address. From 1000, `ticks++; delay(10)` for 200 ms is about 1019.
    const fx = fixtures['arduino-uno-symbols'];
    const ticks = fx.symbols.variables.find(v => v.name === 'ticks');
    assert.ok(ticks, 'the fixture table no longer lists ticks');
    const board = new bw.BoardImpl();
    board.setNetlist([{id: 'u1', kind: 'mcu', terminals: ['gnd']}, {id: 'g1', kind: 'gnd', terminals: ['gnd']}],
        [{id: 'n1', terminals: [{part: 'u1', terminal: 'gnd'}, {part: 'g1', terminal: 'gnd'}]}]);
    board.setPower(true);
    const {target, adapter} = await bw.createDebugTarget('avr8js',
        {board, hex: fx.hex, symbols: fx.symbols, clockHz: 16000000});
    bw.createDebugSession(target, {onChange: () => {}}).start();
    for (let i = 0; i < 20; i++) adapter.advanceNs(10_000_000);
    const bytes = target.readMem(ticks.space, ticks.addr, ticks.size);
    const value = bytes[0] | (bytes[1] << 8);
    assert.ok(value >= 1010 && value <= 1025, `read ${value} at 0x${ticks.addr.toString(16)}`);
});

test('serial INPUT: the echo starter hears what is typed and answers', async () => {
    const fx = fixtures['arduino-uno-echo'];
    const starter = arduinoSketchExamplesFor('arduino-uno').find(e => e.id === 'ino-echo');
    assert.equal(fx.source, starter.source,
        'the echo starter changed: rebuild its fixture (see the fixture file\'s "about")');
    const {adapter, serial} = await boot('arduino-uno-echo', 'avr8js', 16000000);
    for (let i = 0; i < 20; i++) adapter.advanceNs(10_000_000);
    // What the panel's serial input sends: the typed line, CR-terminated.
    assert.equal(typeof adapter.sendSerial, 'function', 'the pinned engine has no serial input');
    adapter.sendSerial(Array.from('hello Uno\r', ch => ch.charCodeAt(0)));
    for (let i = 0; i < 30; i++) adapter.advanceNs(10_000_000);
    assert.match(serial(), /You said: HELLO UNO \(9 characters\)/, JSON.stringify(serial()));
});

test('the runner offers serial input only where the chip can receive', () => {
    const src = read('lib/bw-debug/debug-runner.js');
    const attach = src.slice(src.indexOf('async function attachAvr8js('),
        src.indexOf('async function attachRp2040js('));
    assert.match(attach, /avrAdapter\.chip && avrAdapter\.chip\.usart\) \{\s*runner\.sendSerial = /,
        'an ATtiny (no USART) must get no input line rather than a dead one');
});

test('an Arduboy sketch goes to the console, and the console runs it: picture and D-pad', async () => {
    const src = read('components/tw-pseudocode/pseudocode-importer.jsx');
    const handler = src.slice(src.indexOf('async runSketchOnAvr ()'));
    const body = handler.slice(0, handler.indexOf('\n    /**'));
    assert.match(body, /if \(built\.kind === 'arduboy'\) \{\s*[^]*?this\.runArduboyProgram\(built\.hex, 'sketch\.hex'\);/,
        'the Arduboy image must take the console hand-off, not the debugger');
    const fx = fixtures['arduboy-hello'];
    assert.equal(fx.source, arduinoSketchExamplesFor('arduboy')[0].source,
        'the Arduboy starter changed: rebuild its fixture');
    const arduboy = await import(pathToFileURL(path.join(SRC, 'lib/bw-arduboy/index.js')).href);
    const game = arduboy.createArduboy(fx.hex);
    game.advance(500);
    assert.ok(game.display.displayOn, 'the display never came on');
    const px = () => arduboy.framebufferToPixels(game.framebuffer);
    const lit = px().reduce((n, v) => n + (v ? 1 : 0), 0);
    assert.ok(lit > 100 && lit < 4000, `${lit} pixels lit: expected text and a square`);
    // The square's left edge, on a row it covers (y 28..35 at start).
    const left = () => { const p = px(); for (let x = 0; x < 128; x++) if (p[30 * 128 + x]) return x; return -1; };
    const before = left();
    game.press('right'); game.advance(500); game.release('right'); game.advance(100);
    const after = left();
    assert.ok(after - before >= 10, `RIGHT moved the square from x=${before} to x=${after}`);
});

test('the Arduboy asks for no symbols (its 28 KB is tight, and the console has no variables view)', async () => {
    let extra = null;
    await route.requestSketchBuild({source: 'x', device: 'arduboy',
        compile: async (c, t, f, l, e) => { extra = e; return {base64: b64(':00000001FF\n')}; }});
    assert.deepEqual(extra, {});
});

test('the EEPROM starter completes: a write finishes and the count prints', async () => {
    // Before bw-board e8b927b the engine had no EEPROM peripheral: EEPE never
    // cleared, EEPROM.write() waited forever and this printed nothing at all.
    const fx = fixtures['arduino-uno-eeprom'];
    assert.equal(fx.source, arduinoSketchExamplesFor('arduino-uno').find(e => e.id === 'ino-eeprom').source,
        'the EEPROM starter changed: rebuild its fixture');
    const {adapter, serial} = await boot('arduino-uno-eeprom', 'avr8js', 16000000);
    for (let i = 0; i < 30; i++) adapter.advanceNs(10_000_000);
    assert.equal(serial(), 'This sketch has started 1 time(s).\r\n', JSON.stringify(serial()));
    assert.equal(adapter.eepromBackend.memory[0], 1, 'the count is not in EEPROM cell 0');
});

test('the Wire starter finds an SSD1306 on A4/A5, and nothing on an empty board', async () => {
    const fx = fixtures['arduino-uno-i2c-scan'];
    assert.equal(fx.source, arduinoSketchExamplesFor('arduino-uno').find(e => e.id === 'ino-i2c-scan').source,
        'the Wire starter changed: rebuild its fixture');
    const scan = async (withOled) => {
        const n = (id, ...t) => ({id, terminals: t.map(([part, terminal]) => ({part, terminal}))});
        const parts = [{id: 'GND', kind: 'gnd', terminals: ['gnd']}, {id: 'u1', kind: 'mcu', terminals: ['A4', 'A5', 'gnd']}];
        const nets = [n('gnd', ['GND', 'gnd'], ['u1', 'gnd'])];
        if (withOled) {
            parts.push({id: 'VCC', kind: 'vcc', terminals: ['vcc']},
                {id: 'OLED', kind: 'ssd1306', terminals: ['vcc', 'gnd', 'sda', 'scl']});
            nets[0].terminals.push({part: 'OLED', terminal: 'gnd'});
            nets.push(n('vcc', ['VCC', 'vcc'], ['OLED', 'vcc']), n('sda', ['u1', 'A4'], ['OLED', 'sda']),
                n('scl', ['u1', 'A5'], ['OLED', 'scl']));
        }
        const board = new bw.BoardImpl(5.0);
        board.setNetlist(parts, nets);
        board.setPower(true);
        const {target, adapter} = await bw.createDebugTarget('avr8js', {board, hex: fx.hex, symbols: null, clockHz: 16000000});
        let out = '';
        adapter.onSerial(byte => { out += String.fromCharCode(byte); });
        bw.createDebugSession(target, {onChange: () => {}}).start();
        for (let i = 0; i < 100 && !out.includes('found.'); i++) adapter.advanceNs(10_000_000);
        return out;
    };
    assert.equal(await scan(true), 'I2C part at 0x3C\r\n1 part(s) found.\r\n');
    assert.equal(await scan(false), '0 part(s) found.\r\n');
});
