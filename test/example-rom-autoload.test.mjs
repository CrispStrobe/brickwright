/* An example that ships a ROM boots it — the lite half of D7.
 *
 * sb3-creator's three machine benches used to extract a machine cleanly and
 * then boot with ZERO ROM bytes: the bus extract was never the problem, there
 * was simply no image. sb3-creator now builds and declares them
 * (`files.rom` in examples/index.json). This gate covers the other end: when
 * such an example loads, the tab must actually fetch that image and put it on
 * the established media path, instead of leaving the learner to pick a
 * generic preset out of the loader.
 *
 * WHAT THIS FILE DOES NOT DO is restate the rule. An earlier gate in this
 * campaign passed its own rule into the sweep it was auditing, so reverting
 * the code under test left it green. Here the dispatch block is EXTRACTED
 * FROM THE SHIPPED SOURCE and EXECUTED, with fetch and window faked. Delete
 * the block and this file goes red because there is nothing left to run.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TAB = join(ROOT, 'overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');

/** The ROM-load block, lifted verbatim out of circuit-tab.jsx. */
function extractBlock () {
    const src = readFileSync(TAB, 'utf8');
    const anchor = src.indexOf('const romPath = ex.files && ex.files.rom;');
    assert.ok(anchor > 0, 'the ROM autoload block is gone from circuit-tab.jsx');
    // Take the WHOLE try/catch, not just the body: the catch is what makes a
    // missing image non-fatal, and a harness that supplied its own would be
    // testing the harness.
    const setupStart = src.indexOf('const circuitFirmware = opts?.circuitFirmware;');
    const setupEnd = src.indexOf('const microtronicPart', setupStart);
    const start = src.lastIndexOf('let wiredMedia = circuitFirmware || null;', anchor);
    const tryStart = src.lastIndexOf('try {', anchor);
    const warn = src.indexOf("console.warn('[brickwright] example ROM load failed'", anchor);
    assert.ok(start > 0 && tryStart > start && warn > anchor, 'the block no longer sits in its own try/catch');
    const end = src.indexOf('}', src.indexOf('\n', warn)) + 1;
    assert.ok(setupStart > 0 && setupEnd > setupStart, 'the wired boot decision is missing');
    return src.slice(setupStart, setupEnd) + src.slice(start, end);
}

/** Run the block against a fake example, circuit and window. */
async function runBlock ({ex, parts, romBytes, romOk = true, supportsWiredExampleBoot = false, circuitFirmware}) {
    const events = [];
    const win = {
        dispatchEvent: (e) => events.push(e),
        CustomEvent: class { constructor (type, init) { this.type = type; this.detail = init && init.detail; } },
    };
    const fetched = [];
    const fetch = async (url) => {
        fetched.push(url);
        return {ok: romOk, status: romOk ? 200 : 404,
            arrayBuffer: async () => Uint8Array.from(romBytes || []).buffer};
    };
    const body = extractBlock();
    // eslint-disable-next-line no-new-func
    const warnings = [];
    const fakeConsole = {warn: (...a) => warnings.push(a.join(' '))};
    const fn = new Function('ex', 'data', 'fetch', 'window', 'CustomEvent', 'console', 'supportsWiredExampleBoot', 'opts',
        `return (async function () { ${body}; return wiredMedia; }).call({state: {Designer: {supportsWiredExampleBoot}}});`);
    const wiredMedia = await fn(ex, {parts}, fetch, win, win.CustomEvent, fakeConsole, supportsWiredExampleBoot, {circuitFirmware});
    return {events, fetched, warnings, wiredMedia};
}

describe('an example that declares a ROM loads it', () => {
    test('a 6502 bench dispatches its own image on the media path', async () => {
        const {events, fetched} = await runBlock({
            ex: {id: 'eater6502-blink', files: {rom: 'eater6502-blink/rom.bin'}},
            parts: [{kind: 'w65c02'}, {kind: '6522'}],
            romBytes: [0xA9, 0x01, 0x8D],
        });
        assert.deepEqual(fetched, ['examples/eater6502-blink/rom.bin'],
            'the path must come from files.rom, not be rebuilt from the id');
        assert.equal(events.length, 1, 'exactly one media event');
        const d = events[0].detail;
        assert.equal(events[0].type, 'bw-machine-media-load',
            'it must ride the SAME event the preset buttons dispatch');
        assert.equal(d.slotId, 'rom');
        assert.equal(d.kind, 'eater6502');
        assert.equal(d.name, 'rom.bin');
        assert.deepEqual([...d.bytes], [0xA9, 0x01, 0x8D], 'the fetched bytes, unaltered');
    });

    test('a z80 bench is recognised as a z80, off the parts and not the id', async () => {
        const {events} = await runBlock({
            ex: {id: 'z80-pd-bench', files: {rom: 'z80-pd-bench/rom.bin'}},
            parts: [{kind: '74hc374'}, {kind: 'z80'}, {kind: '62256'}],
            romBytes: [0x3E, 0x01],
        });
        assert.equal(events[0].detail.kind, 'z80');
    });

    test('a wired 6502 boot hands the declared ROM to the designer without dispatching a second boot', async () => {
        const {events, fetched, wiredMedia, warnings} = await runBlock({
            ex: {id: 'eater6502-blink', files: {rom: 'eater6502-blink/rom.bin'}},
            parts: [{kind: 'w65c02'}],
            romBytes: [0xA9, 0x01, 0x8D],
            supportsWiredExampleBoot: true
        });
        assert.deepEqual(fetched, ['examples/eater6502-blink/rom.bin']);
        assert.deepEqual(events, []);
        assert.deepEqual(warnings, []);
        assert.deepEqual(wiredMedia, {slotId: 'rom', bytes: Uint8Array.of(0xA9, 0x01, 0x8D),
            kind: 'eater6502', profile: null, name: 'rom.bin'});
    });

    test('a paired Z80 lesson passes its selected ROM to the designer without fetching a second image', async () => {
        const circuitFirmware = {kind: 'z80', slotId: 'rom', bytes: Uint8Array.of(0x3e, 3)};
        const {events, fetched, wiredMedia, warnings} = await runBlock({
            ex: {id: 'z80-pd-bench', files: {rom: 'z80-pd-bench/rom.bin'}},
            parts: [{kind: 'z80'}],
            supportsWiredExampleBoot: true,
            circuitFirmware
        });
        assert.deepEqual(events, []);
        assert.deepEqual(fetched, []);
        assert.deepEqual(warnings, []);
        assert.equal(wiredMedia, circuitFirmware);
    });

    test('an example with no ROM dispatches nothing', async () => {
        const {events, fetched} = await runBlock({
            ex: {id: 'z80-bench', files: {circuit: 'z80-bench/circuit.json'}},
            parts: [{kind: 'z80'}],
        });
        assert.deepEqual(fetched, [], 'nothing to fetch');
        assert.deepEqual(events, [], 'and nothing to dispatch');
    });

    test('a board with no retro CPU is left alone', async () => {
        // The kind is decided by the silicon. A ROM declared on a board with
        // no 6502 and no Z80 has no machine to boot on, and guessing one
        // would put an image somewhere it cannot run.
        const {events, fetched} = await runBlock({
            ex: {id: 'made-up', files: {rom: 'made-up/rom.bin'}},
            parts: [{kind: 'atmega328p'}, {kind: 'led'}],
            romBytes: [1, 2, 3],
        });
        assert.deepEqual(fetched, []);
        assert.deepEqual(events, []);
    });

    test('a missing image is non-fatal and silent on the media path', async () => {
        // Non-fatal on purpose: a machine with no image is still the machine
        // the example wires, and the preset loader stays available.
        const {events, warnings} = await runBlock({
            ex: {id: 'eater6502-blink', files: {rom: 'eater6502-blink/rom.bin'}},
            parts: [{kind: 'w65c02'}],
            romOk: false,
        });
        assert.deepEqual(events, [], 'a 404 must not put an empty image on the bench');
        assert.equal(warnings.length, 1, 'and it must say so rather than failing silently');
        assert.match(warnings[0], /HTTP 404/, 'the reason must survive into the warning');
    });
});
