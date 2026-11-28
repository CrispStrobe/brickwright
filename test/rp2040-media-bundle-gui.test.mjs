// The RP2040 media bundle in the GUI: a pico-sdk .uf2 (PicoBB — BBC BASIC for
// the Pico) declared as a `flash` slot on an `rp2040js` machine boots from flash
// and talks a UART0 REPL on the debug panel's serial terminal.
//
// Two legs, mirroring linux-riscv-lesson.test.mjs:
//   - ACTIVATE (always runs): the config validates and activate() hands the GUI
//     the right targetKind ('rp2040js') and bootMedia.profile ('uf2'), so the
//     debug-runner dispatch reaches attachRp2040jsBundle. No firmware needed.
//   - BOOT MECHANISM (skip-guarded on PICOBB_UF2): the exact bw-board primitives
//     attachRp2040jsBundle drives — parseUF2 → createRp2040jsAdapter →
//     bootFromFlash → UART0 onSerial, the VT100 DSR auto-answer, and
//     uart[0].feedByte for typed input — boot the REAL firmware to its '>'
//     prompt and run a one-liner. The UF2 is a built Zlib artifact that lives in
//     brickwright-media-lab, never vendored here, so CI without it skips HONESTLY
//     (the live GUI end-to-end "type into PicoBB" is a browser gate, not a unit).

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {newMachineConfig, validateMachineConfig, MACHINE_KINDS} from
    '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {PICOBB_FLASH} from '../overlay/scratch-gui/src/lib/bw-machines/pico-basic-flash.js';

test('an rp2040js + flash-slot config validates and activates to the rp2040js uf2 boot', async () => {
    assert.ok(MACHINE_KINDS.includes('rp2040js'), 'rp2040js is a known machine kind');
    const config = newMachineConfig({
        executionMode: 'functional',
        machine: 'rp2040js',
        slots: {flash: 'bbcbasic_console_pico.uf2'}
    });
    // cpu.variant is filled from DEFAULT_VARIANT (cortex-m0plus); the flash slot
    // is a bootable slot; no BIOS rule applies (that is x86-only).
    const v = validateMachineConfig(config);
    assert.deepEqual(v.errors, [], 'config is valid');
    assert.equal(config.cpu.variant, 'cortex-m0plus');

    const events = [];
    const fetcher = async () => ({bytes: new TextEncoder().encode('fake-uf2-bytes')});
    const {activated, detail} = await runMachineConfig(config, {fetcher, dispatch: d => events.push(d)});
    assert.equal(activated.targetKind, 'rp2040js', 'activate selects the rp2040js target');
    assert.equal(activated.bootMedia.profile, 'uf2', 'a flash slot selects the uf2 boot');
    assert.equal(detail.kind, 'rp2040js');
    assert.equal(new TextDecoder().decode(detail.bytes), 'fake-uf2-bytes', 'the flash bytes are handed on');
    assert.equal(events.length, 1);
});

test('Pico BASIC source is dispatched using the selected firmware dialect', async () => {
    const events = [];
    const opts = {
        fetcher: async () => ({bytes: Uint8Array.of(1, 2, 3)}),
        dispatch: detail => events.push(detail),
        picoBasicSource: 'print 6*7'
    };
    const config = program => newMachineConfig({
        executionMode: 'functional', machine: 'rp2040js', slots: {flash: 'console.uf2'},
        provenance: {program}
    });

    await runMachineConfig(config({basicConsole: 'piccolo'}), opts);
    assert.equal(events[0].picoBasicConsole, 'piccolo');
    assert.equal(events[0].picoWakeOnPrompt, undefined);
    assert.deepEqual(events[0].picoBasicCommands, ['print 6*7', 'RUN']);

    await runMachineConfig(config({startKey: '\r'}), opts);
    assert.equal(events[1].picoBasicConsole, 'bbc');
    assert.equal(events[1].picoWakeOnPrompt, true);
    assert.deepEqual(events[1].picoBasicCommands, ['10 print 6*7', 'RUN']);

    await runMachineConfig(config({basicConsole: 'stefan'}), opts);
    assert.equal(events[2].picoBasicConsole, 'stefan');
    assert.equal(events[2].picoWakeOnPrompt, undefined);
    assert.deepEqual(events[2].picoBasicCommands, ['10 print 6*7', 'RUN']);

    await assert.rejects(runMachineConfig(config({}), opts), /compatible Pico UART firmware/);
    assert.equal(events.length, 3);
});

test('Pico media hands a pinned sector-aligned storage partition to the runner', async () => {
    const sha256 = 'f'.repeat(64);
    for (const [basicConsole, offset] of [['stefan', 0x1df000], ['piccolo', 0xa0000]]) {
        const flashStorage = {offset, length: 0x20000};
        const config = newMachineConfig({
            executionMode: 'functional', machine: 'rp2040js',
            slots: {flash: {url: basicConsole + '.uf2', sha256}},
            provenance: {program: {basicConsole, flashStorage}}
        });
        const result = await runMachineConfig(config, {
            fetcher: async () => ({bytes: Uint8Array.of(1, 2, 3)}),
            dispatch () {}
        });
        assert.deepEqual(result.detail.picoFlashStorage, {...flashStorage, sha256});
    }
});

test('only the pinned PicoBB console image supplies the preformatted flash partition', async () => {
    const boot = sha256 => runMachineConfig(newMachineConfig({
        executionMode: 'functional', machine: 'rp2040js',
        slots: {flash: {url: 'bbcbasic_console_pico_filesystem.uf2', sha256}},
        provenance: {program: {startKey: '\r'}}
    }), {fetcher: async () => ({bytes: Uint8Array.of(1, 2, 3)}), dispatch () {}});
    const {detail} = await boot(PICOBB_FLASH.sha256);
    assert.deepEqual(detail.picoFlashStorage, PICOBB_FLASH);
    assert.equal(detail.picoWakeOnPrompt, true);
    const unrecognized = await boot('f'.repeat(64));
    assert.equal(unrecognized.detail.picoFlashStorage, undefined);
});

const picoUf2 = process.env.PICOBB_UF2;
const havePico = picoUf2 && existsSync(picoUf2);

test('the PicoBB uf2 boots from flash and runs a REPL one-liner (the attach mechanism)',
    {skip: havePico ? false : 'PICOBB_UF2 unset (built Zlib firmware, never vendored)'}, async () => {
        const [{parseUF2, FLASH_BASE}, {createRp2040jsAdapter}] = await Promise.all([
            import('bw-board/uf2.js'),
            import('bw-board/rp2040js-adapter.js')
        ]);
        const {base, image} = parseUF2(new Uint8Array(readFileSync(picoUf2)));
        assert.equal(base, FLASH_BASE, 'a pico-sdk flash image');

        const adapter = createRp2040jsAdapter({clockHz: 125_000_000, vcc: 3.3});
        const feedByte = (b) => adapter.rp2040.uart[0].feedByte(b & 0xff);
        let out = '';
        let probe = '';
        adapter.onSerial((byte) => {
            // the SAME VT100 DSR auto-answer attachRp2040jsBundle wires
            probe = (probe + String.fromCharCode(byte)).slice(-4);
            if (probe === '\x1b[6n') { for (const c of '\x1b[24;80R') feedByte(c.charCodeAt(0)); probe = ''; }
            out += String.fromCharCode(byte);
        });
        adapter.bootFromFlash(image);

        const advance = (ms) => { for (let i = 0; i < ms; i += 2) adapter.advanceNs(2e6); };
        advance(400);
        if (out.includes('Waiting for connection')) { feedByte(13); advance(2400); }
        assert.ok(out.includes('BBC BASIC for Pico Console'), 'the PicoBB banner printed');
        assert.ok(out.includes('>'), 'the REPL prompt is up');

        const before = out.length;
        for (const ch of 'PRINT 2+2\r') feedByte(ch.charCodeAt(0));
        advance(600);
        const slice = out.slice(before);
        assert.ok(slice.includes('4'), 'PRINT 2+2 evaluated over the UART0 REPL');
    });
