#!/usr/bin/env node
// Execute a real compiled Cowgol MZ through the GUI's DOS bench and debug
// stepping loop. This is DOS-service execution, not an operating-system boot.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {register} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {COWGOL_DOS_VARIANTS, cowgolDosConfig} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-dos.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';

const {values} = parseArgs({options: {
    exe: {type: 'string'}, board: {type: 'string'},
    expect: {type: 'string', multiple: true}, 'expect-output': {type: 'string'},
    input: {type: 'string', default: ''}, out: {type: 'string'}, help: {type: 'boolean'}
}});
if (values.help) {
    console.log(`Verify native Cowgol DOS on the real 8086, 80186 and real-mode 80286 variants.

  node scripts/verify-cowgol-dos.mjs --exe program.exe --expect "42"
    [--expect "another line"] [--expect-output EXACT_CONSOLE_TEXT] [--input TEXT]
    [--board ../bw-board] [--out report.json]

Build the MZ executable separately with the qualified Cowgol DOS compiler.
All three CPU variants run the exact artifact on both console and Controller
display configurations. Expected strings must fit the final 80x25 text screen.
The witness also checks CPU variant semantics and live DOS keyboard input.
No BIOS, DOS disk, protected-mode 286 or 386 execution is claimed.
`);
    process.exit(0);
}
assert.ok(values.exe && values.expect?.length && values.expect.every(text => text.trim()),
    '--exe FILE and at least one nonempty --expect TEXT are required');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const board = resolve(values.board || process.env.COWGOL_BW_BOARD || join(root, '../bw-board'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const pin = pkg.devDependencies['bw-board'].split('#')[1];
assert.match(pin, /^[a-f0-9]{40}$/);
const actual = execFileSync('git', ['-C', board, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
assert.equal(actual, pin, 'the machine checkout must match the exact Brickwright bw-board pin');
execFileSync('git', ['-C', board, 'diff', '--quiet', 'HEAD', '--', 'src', 'package.json'], {stdio: 'pipe'});

// Resolve the GUI bench's four package imports from the verified checkout.
// This keeps the actual application module intact and needs no dependency
// installation, mutation of node_modules, or alternate machine implementation.
const boardImports = Object.fromEntries([
    ['bw-board/i8086-machine.js', 'i8086-machine.js'],
    ['bw-board/i8086-dos.js', 'i8086-dos.js'],
    ['bw-board/i8086-debug.js', 'i8086-debug.js'],
    ['bw-board/execution-policy', 'execution-policy.js']
].map(([specifier, file]) => [specifier, pathToFileURL(join(board, 'src', file)).href]));
register(`data:text/javascript,${encodeURIComponent(`
let paths;
export function initialize(data) { paths = data; }
export function resolve(specifier, context, nextResolve) {
    return nextResolve(Object.prototype.hasOwnProperty.call(paths, specifier) ? paths[specifier] : specifier, context);
}`)}`, {data: boardImports});
const {createI8086DosBench} = await import('../overlay/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js');
const {i8086Execution} = await import('../overlay/scratch-gui/src/lib/bw-i8086-execution.js');
const image = new Uint8Array(await readFile(resolve(values.exe)));
assert.ok(image.length >= 28 && image.length <= 1024 * 1024 && image[0] === 0x4d && image[1] === 0x5a,
    'a nonempty DOS MZ executable from the compiler is required');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function runUntil (bench, accept, label) {
    const deadline = performance.now() + 20_000;
    const start = bench.machine.cycles;
    while (!accept()) {
        assert.ok(performance.now() < deadline && bench.machine.cycles - start < 150_000_000, label);
        const state = bench.target.runFor(2_000_000);
        assert.ok(state === 'budget' || (state === 'halted' && accept()),
            `${label}: the debug target stopped before completing execution`);
    }
}

const probes = [];
const runs = [];
for (const variant of COWGOL_DOS_VARIANTS) {
    // An 8086 shifts 33 times; the later CPUs mask the count to five bits.
    // PUSHF then distinguishes the real-mode 286's upper flag bits from 186.
    const discriminator = Uint8Array.of(0xb8, 1, 0, 0xb1, 33, 0xd3, 0xe0, 0x89, 0xc3,
        0x9c, 0x5a, 0xb8, 0, 0x4c, 0xcd, 0x21);
    const probe = await createI8086DosBench({variant, format: 'com', bytes: discriminator});
    assert.equal(probe.machine.variant, variant);
    assert.equal(probe.machine.cpu.variant, variant);
    probe.target.run();
    runUntil(probe, () => probe.terminated, `${variant}: CPU discriminator must exit`);
    assert.equal(probe.exitCode, 0);
    const shifted = probe.machine.cpu.bx;
    const flagHigh = probe.machine.cpu.dx & 0xf000;
    assert.equal(shifted, variant === '8086' ? 0 : 2, `${variant}: actual shift-count semantics`);
    assert.equal(flagHigh, variant === '80286' ? 0 : 0xf000, `${variant}: actual PUSHF semantics`);
    probe.target.halt();
    i8086Execution.release(probe);

    // Enter through the live ASCII queue after the DOS program has started
    // waiting. The AH=01h read echoes once; AH=02h prints the received byte.
    let keyOutput = '';
    const keyboard = await createI8086DosBench({variant, format: 'com',
        bytes: Uint8Array.of(0xb4, 1, 0xcd, 0x21, 0x88, 0xc2, 0xb4, 2, 0xcd, 0x21,
            0xb8, 0, 0x4c, 0xcd, 0x21), onChar: char => { keyOutput += char; }});
    keyboard.target.run();
    assert.equal(keyboard.target.runFor(2_000_000), 'budget');
    assert.equal(keyboard.terminated, false, 'a waiting program must not receive an invented NUL');
    assert.equal(keyOutput, '');
    keyboard.sendKeys('K');
    runUntil(keyboard, () => keyboard.terminated, `${variant}: live key input must reach DOS`);
    assert.equal(keyboard.exitCode, 0);
    assert.equal(keyOutput, 'KK');
    keyboard.target.halt();
    i8086Execution.release(keyboard);
    probes.push({variant, shifted, flagHigh, liveKeyboardOutput: keyOutput});

    for (const display of [false, true]) {
        const activated = await runMachineConfig(cowgolDosConfig({variant, display}), {
            fetcher: async ref => {
                assert.equal(ref.url, 'local-media:cowgol.exe');
                return {bytes: image};
            }, dispatch () {}
        });
        const detail = activated.detail;
        assert.equal(detail.kind, 'i8086');
        assert.equal(detail.profile, 'dos');
        assert.equal(detail.slotId, 'exe');
        assert.equal(detail.dosVariant, variant);
        assert.equal(detail.x86Variant, variant);
        assert.deepEqual(detail.bytes, image);
        assert.equal(detail.widgets.length, display ? 1 : 0);
        let output = '';
        const exits = [];
        const bench = await createI8086DosBench({bytes: detail.bytes, format: 'exe',
            variant: detail.x86Variant, onChar: char => { output += char; },
            onExit: code => { exits.push(code); }});
        assert.equal(bench.machine.variant, variant);
        assert.equal(bench.machine.cpu.variant, variant);
        if (values.input) bench.sendKeys(values.input);
        bench.target.run();
        runUntil(bench, () => bench.terminated, `${variant}/${display ? 'display' : 'console'}: compiled program must exit`);
        assert.equal(bench.exitCode, 0);
        assert.deepEqual(exits, [0], 'the GUI exit notification must fire exactly once');
        const normalized = output.replace(/\r/g, '');
        for (const expected of values.expect) assert.ok(normalized.includes(expected), `console missing ${JSON.stringify(expected)}`);
        if (values['expect-output'] !== undefined) assert.equal(normalized, values['expect-output'].replace(/\r/g, ''),
            'the complete DOS output must match, without extra or missing text');
        const screenText = bench.screenText().join('\n');
        for (const expected of values.expect) assert.ok(screenText.includes(expected), `screen missing ${JSON.stringify(expected)}`);
        const frame = bench.target.video();
        assert.equal(frame.mode, 3);
        assert.equal(frame.width, 720);
        assert.equal(frame.height, 400);
        assert.equal(frame.rgba.length, 720 * 400 * 4);
        assert.ok(frame.rgba.some((byte, index) => byte !== frame.rgba[index % 4]), 'text must produce actual visible pixels');
        if (display) assert.deepEqual(detail.widgets[0].config, {width: frame.width, height: frame.height});
        bench.target.halt();
        runs.push({variant, surface: display ? 'controller-dos-text' : 'dos-console',
            profile: detail.profile, exitCode: bench.exitCode, output, cycles: bench.machine.cycles,
            video: {mode: frame.mode, width: frame.width, height: frame.height,
                rgbaSha256: sha256(frame.rgba), text: screenText}});
        i8086Execution.release(bench);
    }
}
for (const run of runs) assert.equal(run.output, runs[0].output, 'all CPU/display choices must preserve program output');
const sourcePaths = [
    'overlay/scratch-gui/src/lib/bw-lang/cowgol-dos.js',
    'overlay/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js',
    'overlay/scratch-gui/src/lib/bw-i8086-execution.js',
    'overlay/scratch-gui/src/lib/bw-machines/activate.js',
    'overlay/scratch-gui/src/lib/bw-machines/run-machine.js'
];
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, sha256(await readFile(join(root, file)))])));
const report = {schema: 'bw.cowgol-dos-witness.v1', boardCommit: actual, compilerTarget: 'dos',
    artifact: {path: resolve(values.exe), bytes: image.length, sha256: sha256(image)},
    expected: values.expect, sources, probes, runs};
if (values.out) {
    const path = resolve(values.out);
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
