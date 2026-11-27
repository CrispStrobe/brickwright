/**
 * N4: hosted ARM assembly for the Pico, the STM32F030 and the micro:bit.
 *
 * /assemble returns Intel HEX; lib/bw-asm/arm-image.js lays it out as the
 * image each engine runs (STM32F030 flash at 0x08000000, rp2040 SRAM at
 * 0x20000000), and the ASM tab's ▶ hands it to the debug panel's firmware
 * path. The DoD's proof: an .s that toggles a GPIO, assembled by the service
 * (fixture), RUNS -- PA5 on the STM32F030 light tier, GP25 on rp2040js.
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
const fx = JSON.parse(readFileSync(path.join(REPO, 'test/fixtures/matrix-n1-n4-images.json'), 'utf8')).images;
const arm = await import(pathToFileURL(path.join(SRC, 'lib/bw-asm/arm-image.js')).href);
const route = await import(pathToFileURL(path.join(SRC, 'lib/bw-asm/assemble-route.js')).href);

test('the ARM devices reach their chips; the simulated ones have an engine', () => {
    assert.equal(route.asmTargetForDevice('pico'), 'rp2040');
    assert.equal(route.asmTargetForDevice('stm32f030'), 'stm32f030');
    assert.equal(route.asmTargetForDevice('stm32g030'), 'stm32g030');
    assert.equal(route.asmTargetForDevice('stm32f103'), 'stm32f103');
    assert.equal(route.asmTargetForDevice('microbit'), 'nrf52833');
    assert.equal(route.asmTargetForDevice('calliopemini'), 'nrf52833');
    assert.equal(route.asmRouteFor('pico'), 'hosted');
    assert.equal(route.asmRouteFor('stm32g030'), 'hosted');
    assert.equal(route.asmRouteFor('stm32f103'), 'hosted');
    assert.deepEqual(arm.armRunFor('stm32f030'), {kind: 'stm32f0', origin: 0x08000000});
    assert.deepEqual(arm.armRunFor('stm32g030'), {kind: 'stm32g0', origin: 0x08000000});
    assert.deepEqual(arm.armRunFor('rp2040'), {kind: 'rp2040js', origin: 0x20000000});
    assert.equal(arm.armRunFor('stm32f103'), null, 'stm32f103 has no local simulation engine');
    assert.equal(arm.armRunFor('nrf52833'), null, 'nothing here runs nRF52 machine code');
});

test('Intel HEX becomes one image at the origin; bad input is refused, not guessed', () => {
    const img = arm.imageFromIntelHex(':020000040800F2\n:0400000001020304F2\n:020008000506EB\n:00000001FF\n', 0x08000000);
    assert.deepEqual([...img], [1, 2, 3, 4, 0xff, 0xff, 0xff, 0xff, 5, 6], 'gaps read as erased flash');
    assert.throws(() => arm.imageFromIntelHex(':0400000001020304F3\n', 0), /checksum/);
    assert.throws(() => arm.imageFromIntelHex(':0400000001020304F2\n', 0x08000000), /below the image origin/);
});

const BW = packageSourceRoot('bw-board');
const bw = await import(pathToFileURL(path.join(BW, 'index.js')).href);
(await import(pathToFileURL(path.join(BW, 'register-all.js')).href)).registerAllDevices();

async function edgesOf (fixtureId, target, clockHz) {
    const run = arm.armRunFor(target);
    let program = arm.imageFromIntelHex(fx[fixtureId].hex, run.origin);
    if (run.kind === 'rp2040js') {           // what builtFromUserFirmware does for rp2040js
        const padded = program.length & 1 ? Uint8Array.of(...program, 0) : program;
        program = new Uint16Array(padded.buffer, padded.byteOffset, padded.length / 2);
    }
    const board = new bw.BoardImpl();
    board.setNetlist([{id: 'u1', kind: 'mcu', terminals: ['gnd']}, {id: 'g1', kind: 'gnd', terminals: ['gnd']}],
        [{id: 'n1', terminals: [{part: 'u1', terminal: 'gnd'}, {part: 'g1', terminal: 'gnd'}]}]);
    board.setPower(true);
    const edges = {};
    const setPin = board.setPin.bind(board);
    board.setPin = (pin, mode, level) => { edges[pin] = (edges[pin] || 0) + 1; return setPin(pin, mode, level); };
    // STM32 targets take their clock from the firmware's RCC setup and refuse
    // a `clockHz` (bw-board #600); only rp2040js is still told its clock.
    const {target: t, adapter} = await bw.createDebugTarget(run.kind,
        {board, program, symbols: null, ...(clockHz !== undefined ? {clockHz} : {})});
    bw.createDebugSession(t, {onChange: () => {}}).start();
    for (let i = 0; i < 20; i++) adapter.advanceNs(10_000_000);     // 200 ms
    return edges;
}

test('the STM32F030 program toggles PA5 on the light tier', async () => {
    const edges = await edgesOf('stm32f030-blink', 'stm32f030');
    assert.ok(edges.PA5 >= 10, `PA5 changed ${edges.PA5 || 0} times in 200 ms`);
    assert.ok(!edges.PA6 || edges.PA6 <= 1, 'only PA5 is driven');
});

test('the Pico program toggles GP25 on rp2040js', async () => {
    const edges = await edgesOf('rp2040-blink', 'rp2040', 125_000_000);
    assert.ok(edges.GP25 >= 10, `GP25 changed ${edges.GP25 || 0} times in 200 ms`);
});

test('the ASM ▶ hands an ARM image to the debug panel as firmware', () => {
    const src = read('components/tw-pseudocode/pseudocode-importer.jsx');
    const body = src.slice(src.indexOf('async assembleAndRun ('));
    const fn = body.slice(0, body.indexOf('\n    /**'));
    assert.match(fn, /\} else if \(armRunFor\(out\.target\)\) \{/);
    assert.match(fn, /imageFromIntelHex\(new TextDecoder\(\)\.decode\(out\.bytes\), run\.origin\)/);
    assert.match(fn, /format: 'firmware', kind: run\.kind/);
    assert.equal(src.split('asmBuiltArm:').length - 1, 2, 'asmBuiltArm is not in both locales');
    const panel = read('components/tw-pseudocode/debug-panel.jsx');
    assert.match(panel, /if \(format === 'avr-sketch' \|\| format === 'firmware'\) \{\s*if \(!e\.detail\?\.asmBlink\) return this\._runSketch\(e\.detail\);/);
    const runner = read('lib/bw-debug/debug-runner.js');
    for (const fn2 of ['attachRp2040js(built)', 'attachStm32F0Target(built)']) {
        const start = runner.indexOf(`async function ${fn2}`);
        assert.ok(start >= 0, `${fn2} moved`);
        assert.match(functionBody(runner, start), /pins: \(declared && declared\.pins\) \|\| \[\]/,
            `${fn2} must survive a project with no pins`);
    }
});

/** The function starting at `start`, through its matching closing brace. */
function functionBody (src, start) {
    const open = src.indexOf('{', src.indexOf(')', start));
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error('unbalanced braces after ' + src.slice(start, start + 40));
}
