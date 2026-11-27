/**
 * Task B11: a typed line reaches an 8051 program intact, through exactly what
 * Lite ships -- the vendored emu8051 WASM at the shipping pin, driven by the
 * pinned bw-board's emu8051 adapter -- and the debugger still accepts that
 * build's checkpoints.
 *
 * Before B11 three things stood in the way of `ask ... and wait` on the 8051
 * in the app: the emulator wrote every received byte straight into SBUF (a
 * line sent in one go left the program only its last byte), the adapter had
 * no sendSerial/onSerial, and the debug runner wired neither for the 8051.
 * Two programs: a hand-assembled echo loop, which needs no compiler (whatever
 * it reads it writes back), and the gallery's guess-the-number, a program that
 * asks for a name and then for guesses, taken through the app's own route:
 * sb3-creator's 8051 C, the SDCC WASM toolchain, the vendored emulator. With
 * the pre-B11 emulator build (63b4d4bc) that game never gets past its first
 * question. SDCC is GPL and not tracked here; CI fetches it, and without it
 * that test skips by name (as test/wasm-compiler-integration.test.mjs does).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {compileWithToolchain} from '../overlay/scratch-gui/src/lib/sdcc-wasm/compiler.js';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const WASM_JS = path.join(ROOT, 'overlay/scratch-gui/src/lib/emu8051/emu8051.js');
const ADAPTER = path.join(ROOT, 'node_modules/bw-board/src/emu8051-adapter.js');
const DEBUG = path.join(ROOT, 'node_modules/bw-board/src/emu8051-debug.js');
const RUNNER = path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-debug/debug-runner.js');
const GAME = path.join(ROOT, 'overlay/scratch-gui/examples/guess-the-number/program.bw');
const distUrl = new URL('../overlay/scratch-gui/src/lib/sdcc-wasm/dist/', import.meta.url);
const skipIfNoSdcc = fs.existsSync(fileURLToPath(new URL('sdcc.js', distUrl)))
    ? false
    : 'the GPL SDCC toolchain is not present (not tracked here; fetched from its own origin)';
const require = createRequire(import.meta.url);

// The Emscripten glue's Node branch, as in test/wasm-compiler-integration.test.mjs.
async function importFactory(name) {
    const source = await readFile(new URL(`${name}.js`, distUrl), 'utf8');
    const module = {exports: {}};
    const filename = fileURLToPath(new URL(`${name}.js`, distUrl));
    Function('module', 'exports', 'require', '__filename', '__dirname',
        source.replace(/export default createSDCC;\s*$/, ''))(
        module, module.exports, require, filename, path.dirname(filename));
    return module.exports;
}

async function sdccToolchain() {
    const packed = JSON.parse(await readFile(new URL('runtime.json', distUrl), 'utf8'));
    return {
        factories: await Promise.all(['cc1', 'sdcc', 'sdas8051', 'sdld'].map(importFactory)),
        runtime: new Map(Object.entries(packed.files).map(([name, data]) =>
            [name, Uint8Array.from(Buffer.from(data, 'base64'))])),
        resolve: (name) => pathToFileURL(fileURLToPath(new URL(name, distUrl))).href
    };
}

// SCON=50h (mode 1, REN); Timer 1 mode 2 (the baud clock); then forever:
// wait RI, A=SBUF, clear RI, SBUF=A, wait TI, clear TI.
const ECHO = [
    0x75, 0x98, 0x50,       // 0000 MOV SCON,#50h
    0x75, 0x89, 0x20,       // 0003 MOV TMOD,#20h
    0x75, 0x8d, 0xfd,       // 0006 MOV TH1,#0FDh
    0xd2, 0x8e,             // 0009 SETB TR1
    0x30, 0x98, 0xfd,       // 000B JNB RI,$
    0xe5, 0x99,             // 000E MOV A,SBUF
    0xc2, 0x98,             // 0010 CLR RI
    0xf5, 0x99,             // 0012 MOV SBUF,A
    0x30, 0x99, 0xfd,       // 0014 JNB TI,$
    0xc2, 0x99,             // 0017 CLR TI
    0x80, 0xf0              // 0019 SJMP 000B
];

function intelHex(bytes) {
    const hex = (n) => n.toString(16).toUpperCase().padStart(2, '0');
    const sum = bytes.length + bytes.reduce((a, b) => a + b, 0);
    const data = `${hex(bytes.length)}0000` + `00${bytes.map(hex).join('')}`;
    return `:${data}${hex((-sum) & 0xff)}\n:00000001FF\n`;
}

async function boot(hex = intelHex(ECHO)) {
    const {default: createEmu8051} = await import(pathToFileURL(WASM_JS));
    const {createEmu8051Adapter} = await import(pathToFileURL(ADAPTER));
    const wasm = await createEmu8051();
    const adapter = createEmu8051Adapter(wasm, {part: 'stc12c5a60s2', fosc: 11059200, ports: [0, 1, 2, 3]});
    adapter.loadHex(hex);
    return {wasm, adapter};
}

test('a line typed in one go reaches the 8051 program byte by byte, and comes back', async () => {
    const {adapter} = await boot();
    assert.equal(typeof adapter.sendSerial, 'function', 'the pinned adapter carries sendSerial (bw-board #409)');
    let out = '';
    assert.equal(adapter.onSerial((byte) => { out += String.fromCharCode(byte); }), true);
    adapter.runNs(2_000_000);
    adapter.sendSerial(Array.from('Ada\r', (ch) => ch.charCodeAt(0)));
    adapter.runNs(20_000_000);   // four characters at 9600 baud: ~4.2 ms
    assert.equal(out, 'Ada\r', 'the whole line, in order -- not only its last byte');
});

test('the gallery\'s guess-the-number, compiled by the app\'s 8051 route, plays a whole game over serial',
    {skip: skipIfNoSdcc, timeout: 120000}, async () => {
        const creator = new SB3Creator();
        creator.parse(fs.readFileSync(GAME, 'utf8'));
        const generated = creator.generateC();
        const code = typeof generated === 'string' ? generated : generated.code;
        const built = await compileWithToolchain(code, {target: 'stc12c5a60s2'}, await sdccToolchain());
        assert.equal(built.success, true, 'SDCC built the generated C');
        const {adapter} = await boot(built.hex);
        let out = '';
        adapter.onSerial((byte) => { out += String.fromCharCode(byte); });
        const type = (line) => adapter.sendSerial(Array.from(`${line}\r`, (ch) => ch.charCodeAt(0)));

        adapter.runNs(200_000_000);
        assert.equal(out, 'What is your name?\r\n');
        type('Ada');
        adapter.runNs(300_000_000);
        assert.match(out, /Hello Ada, I am thinking of a number from 1 to 100\.\r\nYour guess\?\r\n$/,
            'the typed name came back whole');

        // Halve the range on each answer: at most seven guesses for 1..100.
        let low = 1;
        let high = 100;
        let guesses = 0;
        while (!/Got it/.test(out)) {
            assert.ok(guesses < 7 && low <= high, `the game stopped making sense: ${JSON.stringify(out)}`);
            const guess = Math.floor((low + high) / 2);
            const mark = out.length;
            type(String(guess));
            guesses += 1;
            adapter.runNs(300_000_000);
            const reply = out.slice(mark);
            if (/Higher!/.test(reply)) low = guess + 1;
            else if (/Lower!/.test(reply)) high = guess - 1;
            else assert.match(reply, /^Got it in \d+ tries!\r\n$/, `unexpected reply to ${guess}`);
        }
        assert.match(out, new RegExp(`Got it in ${guesses} tries!\\r\\n$`), 'the program counted every guess');
    });

test('the debugger accepts this build\'s checkpoint layout (shipping native and adapter pins agree)', async () => {
    const {wasm} = await boot();
    const {createEmu8051DebugTarget} = await import(pathToFileURL(DEBUG));
    assert.equal(wasm._emu_checkpoint_build_id() >>> 0, 0x80510103);
    const target = createEmu8051DebugTarget(wasm);
    const checkpoint = target.capabilities().extensions?.checkpoint;
    assert.ok(checkpoint && checkpoint.supported !== false, JSON.stringify(checkpoint));
    assert.equal(checkpoint.buildId, 0x80510103);
    assert.equal(checkpoint.size, 443561);
});

test('the debug runner wires serial both ways for the 8051 and input for the Pico', () => {
    const src = fs.readFileSync(RUNNER, 'utf8');
    const at = src.indexOf('Serial, both ways, as on the AVR (task B11)');
    assert.ok(at > 0, 'the 8051 block wires serial');
    const block = src.slice(at, at + 1500);
    assert.match(block, /adapter\.onSerial\(/);
    assert.match(block, /runner\.sendSerial = \(data\) => adapter\.sendSerial\(/);
    assert.match(src, /runner\.sendSerial = \(data\) => picoAdapter\.sendSerial\(/);
});
