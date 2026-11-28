#!/usr/bin/env node
// Execute an already-built Cowgol .COM on the exact CP/M 2.2 machine used by
// the editor. Missing compiler output, ROMs, or the pinned board are failures.
// This verifies the actual OS/CPU/VDP path; it does not replace browser UI QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {COWGOL_COMPILE_TARGETS, cowgolCpmSystemConfig} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';

const {values} = parseArgs({options: {
    com: {type: 'string'}, board: {type: 'string'}, target: {type: 'string', default: 'z80-cpm'},
    expect: {type: 'string', multiple: true}, input: {type: 'string', default: ''},
    out: {type: 'string'}, help: {type: 'boolean'}
}});
if (values.help) {
    console.log(`Verify native Cowgol under real CP/M 2.2 and its TMS9918 display.

  node scripts/verify-cowgol-cpm-system.mjs --com program.com --expect "42"
    [--expect "another line"] [--input TEXT] [--target z80-cpm|i8080-cpm]
    [--board ../bw-board] [--out report.json]

The .COM must be built separately with the qualified Cowgol compiler. Both
compiler targets execute on the pinned Z80 machine; neither claims an 8080 CPU.
The program must print every expected string and return to the CP/M prompt.
`);
    process.exit(0);
}
assert.ok(values.com && values.expect?.length && values.expect.every(text => text.trim()),
    '--com FILE and at least one nonempty --expect TEXT are required');
assert.ok(['z80-cpm', 'i8080-cpm'].includes(values.target), 'target must be z80-cpm or i8080-cpm');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const board = resolve(values.board || process.env.COWGOL_BW_BOARD || join(root, '../bw-board'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const pin = pkg.devDependencies['bw-board'].split('#')[1];
assert.match(pin, /^[a-f0-9]{40}$/);
// gate-shapes-allow: provenance-only Git read; missing Git throws and the exact package pin is asserted below.
const actual = execFileSync('git', ['-C', board, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
assert.equal(actual, pin, 'machine checkout must match Brickwright\'s exact bw-board pin');
// gate-shapes-allow: reject edits to tracked machine inputs before importing them; missing Git or a nonzero diff throws.
execFileSync('git', ['-C', board, 'diff', '--quiet', 'HEAD', '--', 'src'], {stdio: 'pipe'});
const image = new Uint8Array(await readFile(resolve(values.com)));
assert.ok(image.length > 0 && image.length <= COWGOL_COMPILE_TARGETS[values.target].maxBytes,
    'compiled program must fit the CP/M transient area');
const [{createZ80Target}, {CPM64K}] = await Promise.all([
    import(pathToFileURL(join(board, 'src/z80-target-factory.js'))),
    import(pathToFileURL(join(board, 'src/z80-machine.js')))
]);
const roms = join(root, 'overlay/scratch-gui/static/roms');
const ccpBdos = new Uint8Array(await readFile(join(roms, 'cpm22-64k.bin')));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const runs = [];

for (const display of [false, true]) {
    const config = cowgolCpmSystemConfig({display, target: values.target});
    const activated = await runMachineConfig(config, {
        fetcher: async ref => {
            assert.equal(ref.url, 'local-media:cowgol.com');
            return {bytes: image};
        }, dispatch () {}
    });
    const detail = activated.detail;
    assert.equal(detail.profile, 'cpm-system');
    const bios = new Uint8Array(await readFile(join(roms, display ? 'cpm-bios-vdp.bin' : 'cpm-bios.bin')));
    const opts = {cpmSystem: {ccpBdos, bios, files: {[detail.name]: detail.bytes}}};
    if (detail.machinePreset === 'CPM64K_TMS9918') {
        opts.config = {...CPM64K, ports: [...CPM64K.ports, {kind: 'vdp', name: 'vdp1', at: 0x98}]};
    }
    const {adapter, target} = await createZ80Target(opts);
    assert.ok(target, 'the actual GUI Z80 debug target must be available');
    const machine = adapter.machine;
    let output = '';
    adapter.onSerial(byte => { output += String.fromCharCode(byte); });
    target.run();
    const until = (accept, label) => {
        const deadline = performance.now() + 15_000;
        const start = machine.cycles;
        while (!accept()) {
            assert.ok(performance.now() < deadline && machine.cycles - start < 150_000_000,
                `${display ? 'VDP' : 'console'}: ${label}; output ${JSON.stringify(output.slice(-500))}`);
            assert.equal(target.runFor(2_000_000), 'budget', 'CP/M must remain runnable');
        }
    };
    const send = text => {
        for (const char of text) assert.equal(adapter.sendSerial(char.charCodeAt(0)), true);
    };
    // The editor launches only after this exact serial prompt. The VDP BIOS
    // also emits the serial copy, so it follows the same ownership and input path.
    until(() => /(?:^|\n)A>(?![\s\S])/.test(output.replace(/\r/g, '')), 'cold boot to A>');
    const runStart = output.length;
    send(`${detail.cpmLaunch}\r${values.input}`);
    until(() => values.expect.every(text => output.slice(runStart).includes(text)) &&
        output.slice(runStart).endsWith('A>'), 'program output and return to A>');
    const programOutput = output.slice(runStart);
    let video = null;
    if (display) {
        const vdp = machine.chips.vdp1;
        assert.equal(vdp.mode, 'text');
        const text = Array.from({length: 24}, (_, row) => String.fromCharCode(
            ...vdp.vram.subarray(vdp.nameBase + row * 40, vdp.nameBase + (row + 1) * 40))).join('\n');
        for (const expected of values.expect) assert.ok(text.includes(expected), `VDP text must contain ${JSON.stringify(expected)}`);
        vdp.renderFrame();
        const frame = target.video();
        assert.equal(frame.width, 256);
        assert.equal(frame.height, 192);
        assert.ok(frame.rgba.some((byte, index) => byte !== frame.rgba[index % 4]), 'display must contain visible text pixels');
        video = {mode: frame.mode, width: frame.width, height: frame.height,
            rgbaSha256: sha256(frame.rgba), text};
    }
    const dirStart = output.length;
    send('DIR\r');
    until(() => /COWGOL\s+COM/.test(output.slice(dirStart)) && output.slice(dirStart).endsWith('A>'),
        'mounted program in DIR and second command prompt');
    target.halt();
    runs.push({surface: display ? 'controller-tms9918' : 'serial-console', machine: 'Z80',
        profile: detail.profile, programOutput, directoryOutput: output.slice(dirStart),
        cycles: machine.cycles, biosSha256: sha256(bios), video});
}
const report = {schema: 'bw.cowgol-cpm22-witness.v1', boardCommit: actual, compilerTarget: values.target,
    artifact: {path: resolve(values.com), bytes: image.length, sha256: sha256(image)},
    ccpBdosSha256: sha256(ccpBdos), expected: values.expect, runs};
if (values.out) {
    const path = resolve(values.out);
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
