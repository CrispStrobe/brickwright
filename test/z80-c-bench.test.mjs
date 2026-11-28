/**
 * N1: C on the Z80 bench. The hosted service compiles `sdcc -mz80` for the
 * bench's measured map; the C tab's ▶ Run C on Z80 boots the ROM through the
 * same path an assembled Z80 program takes.
 *
 * The DoD's proof, in Node: the z80-pd-bench example's OWN program, emitted as
 * C by the runner's generateC and compiled by the service (fixture), boots on
 * a machine extracted from the example's OWN circuit -- `jp` at the reset
 * vector ($0000 == 0xC3) -- and walks its light across latch1.Q0..Q7.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {packageSourceRoot} from './helpers/package-source.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(REPO, 'overlay/scratch-gui/src');
const EX = path.join(REPO, 'overlay/scratch-gui/examples/z80-pd-bench');
const fx = JSON.parse(readFileSync(path.join(REPO, 'test/fixtures/matrix-n1-n4-images.json'), 'utf8'))
    .images['z80-pd-bench'];
const BW = packageSourceRoot('bw-board');

test('the fixture is still what the example\'s program emits', async () => {
    const {default: SB3Creator} = await import(pathToFileURL(path.join(SRC, 'lib/sb3-creator.js')).href);
    const creator = new SB3Creator();
    creator.parse(readFileSync(path.join(EX, 'program.bw'), 'utf8'));
    assert.equal(creator.generateC(creator.project, {debug: false}), fx.c,
        'z80-pd-bench/program.bw no longer emits the fixture\'s C: recompile it (see the fixture\'s "about")');
});

test('the compiled ROM boots on the extracted bench and walks the latch', async () => {
    const rom = Uint8Array.from(Buffer.from(fx.rom_base64, 'base64'));
    assert.equal(rom[0], 0xc3, 'no `jp` at the Z80 reset vector');
    const {extractZ80Machine} = await import(pathToFileURL(path.join(BW, 'z80-extract.js')).href);
    const {createZ80Adapter} = await import(pathToFileURL(path.join(BW, 'z80-adapter.js')).href);
    const ex = extractZ80Machine(JSON.parse(readFileSync(path.join(EX, 'circuit.json'), 'utf8')));
    assert.ok(ex.ok, ex.reasons.join('; '));
    const adapter = createZ80Adapter({config: {clockHz: 7_372_800, regions: ex.regions, ports: ex.ports}, rom});
    const edges = {};
    adapter.attachBoard({advanceTo () {}, setPin (pin) { edges[pin] = (edges[pin] || 0) + 1; }});
    for (let i = 0; i < 100; i++) adapter.advanceNs(10_000_000);          // 1 s
    // `wait 0.1 seconds` per step, eight steps a lap: Q0 lights, goes dark,
    // and lights again within the second; every latch bit is visited.
    assert.ok(edges['latch1.Q0'] >= 3, `latch1.Q0 changed ${edges['latch1.Q0'] || 0} times in 1 s`);
    for (let q = 0; q < 8; q++) assert.ok(edges[`latch1.Q${q}`] >= 1, `latch1.Q${q} never changed`);
});

test('the C tab offers ▶ Run C on Z80, compiled by the one hosted compile', () => {
    const src = readFileSync(path.join(SRC, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    assert.match(src, /this\.state\.lang === 'c' && !this\.state\.libraryProgram && asmTargetForDevice\(this\.currentDevice\(\)\) === 'z80' \?/);
    assert.match(src, /data-testid=\{menu \? "bw-run-c-z80-menu" : "bw-run-c-z80"\}/);
    const body = src.slice(src.indexOf('async runCOnZ80 ()'));
    const fn = body.slice(0, body.indexOf('\n    /**'));
    assert.match(fn, /await this\.hostedCompileC\(source, 'z80', 'bin'\)/);
    assert.match(fn, /target: 'z80', slotId: 'rom'/, 'the ROM must take the assembled-Z80 path');
    assert.doesNotMatch(fn, /fetch\(/);
    for (const key of ['runCZ80', 'runCZ80Title', 'runCZ80Building', 'runCZ80Built',
        'runCZ80Refused', 'runCZ80Unavailable']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
});
