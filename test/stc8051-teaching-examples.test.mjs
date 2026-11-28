import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {STC8051_TEACHING_EXAMPLES, ASHRITH_SAGAR}
    from '../overlay/scratch-gui/src/lib/bw-asm/examples-stc8051.js';
import {asmExamplesFor} from '../overlay/scratch-gui/src/lib/bw-asm/examples.js';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = path.join(root, 'test/fixtures/bw8051-1');
const manifest = JSON.parse(readFileSync(path.join(fixtures, 'compiled/manifest.json'), 'utf8'));
const hash = (text, algorithm = 'sha256') => createHash(algorithm).update(text).digest('hex');
const wasmPath = path.join(root, 'overlay/scratch-gui/src/lib/emu8051/emu8051.js');
const profiles = [
    ['STC12C5A60S2', 0],
    ['STC15F2K60S2', 1],
    ['STC89C52RC', 2],
    ['STC15W408AS', 3],
    ['STC12C5A16S2', 4]
];

test('the six curated programs appear in each STC ASM picker with intact provenance', () => {
    assert.equal(STC8051_TEACHING_EXAMPLES.length, 6);
    assert.equal(manifest.examples.length, 6);
    for (const device of ['stc12c5a60s2', 'stc12c5a16s2', 'stc15f2k60s2', 'stc15w408as',
        'stc89c52', 'stc89c52rc']) {
        for (const example of STC8051_TEACHING_EXAMPLES) assert.ok(asmExamplesFor(device).includes(example));
    }
    for (const example of STC8051_TEACHING_EXAMPLES) {
        assert.equal(example.attribution, ASHRITH_SAGAR);
        assert.match(example.source, /Copyright \(c\) 2022 Ashrith Sagar/);
        assert.match(example.source, /Permission is hereby granted/);
        const original = readFileSync(path.join(fixtures, 'upstream/microcontroller-lab', example.file));
        const gitBlob = Buffer.concat([Buffer.from(`blob ${original.length}\0`), original]);
        assert.equal(hash(gitBlob, 'sha1'), example.upstream.blob, `${example.id}: original source changed`);
        const built = manifest.examples.find(entry => entry.id === example.id);
        assert.equal(hash(example.source), built.sourceSha256, `${example.id}: rebuild its changed source`);
        assert.equal(readFileSync(path.join(fixtures, 'compiled', `${example.id}.asm`), 'utf8'), example.source);
        assert.equal(hash(readFileSync(path.join(fixtures, 'compiled', `${example.id}.ihx`))), built.hexSha256);
    }
});

async function boot (hex, part) {
    const {default: createEmu8051} = await import(pathToFileURL(wasmPath).href);
    const wasm = await createEmu8051();
    wasm._emu_init(1);
    assert.equal(typeof wasm._emu_set_part, 'function', 'this proof needs explicit part selection');
    wasm._emu_set_part(part);
    wasm._emu_set_fosc(12000000);
    assert.equal(wasm.ccall('emu_load_hex', 'number', ['string', 'number'], [hex, hex.length]), 0);
    wasm._emu_reset(0);
    const expectedPart = profiles.find(([_name, id]) => id === part)[0].toLowerCase();
    assert.equal(JSON.parse(wasm.ccall('emu_capabilities', 'string', [], [])).part, expectedPart,
        'the shipped emulator must execute this native profile, not silently fall back to another part');
    return wasm;
}

function readRegister (wasm, name) {
    if (/^r[0-7]$/.test(name)) return wasm._emu_dbg_rn(Number(name[1]));
    const address = {a: 0xe0, b: 0xf0, psw: 0xd0, sp: 0x81}[name];
    assert.notEqual(address, undefined, `unknown expected register ${name}`);
    return wasm._emu_get_sfr(address);
}

function checkState (wasm, example) {
    assert.equal(wasm._emu_dbg_pc(), example.stop.address, `${example.id}: explicit finish address`);
    for (const [name, value] of Object.entries(example.expect.registers)) {
        assert.equal(readRegister(wasm, name), value, `${example.id}: ${name}`);
    }
    for (const space of ['iram', 'sfr']) {
        for (const range of example.expect[space]) {
            const actual = range.bytes.map((_value, index) => wasm[`_emu_get_${space}`](range.address + index));
            assert.deepEqual(actual, range.bytes, `${example.id}: ${space} at ${range.address.toString(16)}`);
        }
    }
}

for (const [profile, part] of profiles) {
    for (const example of STC8051_TEACHING_EXAMPLES) {
        test(`${profile}: ${example.id} reaches its independently specified result`, async () => {
            const hex = readFileSync(path.join(fixtures, 'compiled', `${example.id}.ihx`), 'utf8');
            const wasm = await boot(hex, part);
            let ticks = 0;
            while (wasm._emu_dbg_pc() !== example.stop.address && ticks++ < example.stop.maxTicks) wasm._emu_run(1);
            checkState(wasm, example);
        });
    }
}

test('a corrupt result fails the lesson check even after reaching the stop address', async () => {
    const example = STC8051_TEACHING_EXAMPLES.find(entry => entry.id === 'lab-add16');
    const wasm = await boot(readFileSync(path.join(fixtures, 'compiled', `${example.id}.ihx`), 'utf8'), 0);
    for (let ticks = 0; wasm._emu_dbg_pc() !== example.stop.address && ticks < example.stop.maxTicks; ticks++) {
        wasm._emu_run(1);
    }
    checkState(wasm, example);
    wasm._emu_set_iram(6, 0);
    assert.throws(() => checkState(wasm, example), /lab-add16: r6/);
});

test('Timer0 cute-os guest wakes from idle, keeps task ratios and removes one task', async () => {
    const source = readFileSync(path.join(root,
        'overlay/scratch-gui/static/teaching/bw8051-1/cute-os-timer0.c'), 'utf8');
    assert.equal(hash(source), manifest.cuteOS.sourceSha256);
    assert.equal(readFileSync(path.join(fixtures, 'compiled/cute-os-timer0.c'), 'utf8'), source);
    const hex = readFileSync(path.join(fixtures, 'compiled/cute-os-timer0.ihx'), 'utf8');
    assert.equal(hash(hex), manifest.cuteOS.hexSha256);
    assert.equal(readFileSync(path.join(root,
        'overlay/scratch-gui/static/teaching/bw8051-1/cute-os-timer0.ihx'), 'utf8'), hex,
    'the downloadable guest is the same firmware executed by this test');
    const wasm = await boot(hex, 2);
    let batches = 0;
    while (wasm._emu_get_iram(0x36) !== 0xa5 && batches++ < 2500) wasm._emu_run(10000);
    const expected = manifest.cuteOS.expectedIram;
    assert.deepEqual(expected.bytes.map((_value, index) => wasm._emu_get_iram(expected.address + index)),
        expected.bytes, 'guest completion/counters/errors; a missing idle wake or callback must fail');
    assert.equal(wasm._emu_get_sfr(0x90), manifest.cuteOS.expectedP1);
    assert.equal(wasm._emu_get_sfr(0x88) & 0x10, 0, 'Timer0 stops at the stated finish tick');
});
