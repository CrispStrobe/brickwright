#!/usr/bin/env node
// Boot the shipped MS-DOS 2.0 FAT12 image with the exact compiled Cowgol MZ.
// The GUI's actual DOS bench supplies BIOS services; the kernel and shell run
// on the CPU and handle program loading, INT 21h, exit and the live prompt.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {register} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {COWGOL_DOS_DISK_VARIANTS, COWGOL_DOS_BASE_IMAGE, COWGOL_DOS_PROGRAM,
    prepareCowgolDosDisk, cowgolDosDiskConfig} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-dos-disk.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';

const {values} = parseArgs({options: {
    exe: {type: 'string'}, board: {type: 'string'},
    expect: {type: 'string', multiple: true}, 'expect-output': {type: 'string'},
    out: {type: 'string'}, help: {type: 'boolean'}
}});
if (values.help) {
    console.log(`Verify a compiled Cowgol DOS program under booted MS-DOS 2.0.

  node scripts/verify-cowgol-dos-disk.mjs --exe program.exe --expect "42"
    [--expect "another line"] [--expect-output EXACT_PROGRAM_TEXT]
    [--board ../bw-board] [--out report.json]

All four qualified CPUs (8086, 80186, real-mode 80286/80386) boot a fresh copy of the
shipped 360 KiB FAT12 disk on both console and Controller display surfaces.
COMMAND.COM runs COWGOL.EXE from AUTOEXEC.BAT; a live shell command verifies
return to DOS and ERRORLEVEL. BIOS services remain supplied by the machine
adapter. This does not qualify a ROM BIOS boot, hardware disk controller,
protected mode, or a physical machine.
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
// gate-shapes-allow: provenance-only Git read; missing Git throws and the exact package pin is asserted below.
const actual = execFileSync('git', ['-C', board, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
assert.equal(actual, pin, 'the machine must match the exact Brickwright bw-board pin');
// gate-shapes-allow: reject edits to tracked machine inputs before importing them; missing Git or a nonzero diff throws.
execFileSync('git', ['-C', board, 'diff', '--quiet', 'HEAD', '--', 'src', 'package.json'], {stdio: 'pipe'});
const boardImports = Object.fromEntries([
    ['bw-board/i8086-machine.js', 'i8086-machine.js'],
    ['bw-board/i8086-dos.js', 'i8086-dos.js'],
    ['bw-board/i8086-debug.js', 'i8086-debug.js'],
    ['bw-board/i80386-debug.js', 'i80386-debug.js'],
    ['bw-board/i8086-cga.js', 'i8086-cga.js'],
    ['bw-board/experimental/i80386-at-machine.js', 'experimental/i80386-at-machine.js'],
    ['bw-board/dos-fat-inject.js', 'dos-fat-inject.js'],
    ['bw-board/execution-policy', 'execution-policy.js']
].map(([specifier, file]) => [specifier, pathToFileURL(join(board, 'src', file)).href]));
register(`data:text/javascript,${encodeURIComponent(`
let paths;
export function initialize(data) { paths = data; }
export function resolve(specifier, context, nextResolve) {
    return nextResolve(Object.prototype.hasOwnProperty.call(paths, specifier) ? paths[specifier] : specifier, context);
}`)}`, {data: boardImports});
const {createI8086DosBench} = await import('../overlay/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js');
const {createI80386DosBootBench} = await import('../overlay/scratch-gui/src/lib/bw-debug/i80386-dos-bench.js');
const {i8086Execution} = await import('../overlay/scratch-gui/src/lib/bw-i8086-execution.js');
const fat = await import(pathToFileURL(join(board, 'src/dos-fat-inject.js')).href);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const image = new Uint8Array(await readFile(resolve(values.exe)));
const base = new Uint8Array(await readFile(join(root, 'overlay/scratch-gui', COWGOL_DOS_BASE_IMAGE.url)));
const baseHash = sha256(base);
assert.equal(baseHash, COWGOL_DOS_BASE_IMAGE.sha256);
const disk = await prepareCowgolDosDisk(image, {fetcher: async url => {
    assert.equal(url, COWGOL_DOS_BASE_IMAGE.url, 'OS boot uses only the shipped local disk asset');
    return {ok: true, arrayBuffer: async () => base.slice().buffer};
}});
assert.equal(sha256(base), baseHash, 'the shipped OS image remains unchanged');
assert.deepEqual(fat.readFile(disk, COWGOL_DOS_PROGRAM), image);
assert.equal(new TextDecoder().decode(fat.readFile(disk, 'AUTOEXEC.BAT')), 'COWGOL\r\n');
const systemFiles = {};
for (const name of ['IO.SYS', 'MSDOS.SYS', 'COMMAND.COM']) {
    const original = fat.readFile(base, name);
    assert.ok(original?.length, `${name} must exist in the actual boot disk`);
    assert.deepEqual(fat.readFile(disk, name), original, `${name} must not be changed by program injection`);
    systemFiles[name] = {bytes: original.length, sha256: sha256(original)};
}
const intVector = (machine, number) => {
    const at = number * 4;
    const read = address => machine.variant === '80386' ? machine._read386(address) : machine._read(address);
    return {offset: read(at) | read(at + 1) << 8,
        segment: read(at + 2) | read(at + 3) << 8};
};
function runUntil (bench, accept, label) {
    const deadline = performance.now() + 20_000;
    const start = bench.machine.cycles;
    while (!accept()) {
        assert.ok(performance.now() < deadline && bench.machine.cycles - start < 150_000_000, label);
        const state = bench.target.runFor(2_000_000);
        assert.ok(state === 'budget' || (state === 'halted' && accept()),
            `${label}: debug execution stopped before the DOS prompt`);
    }
}

// Prove the boot entry uses 386 instructions and preserves caller state
// across BIOS services. Then execute a real CR0 transition to witness the
// ordinary-real-mode boundary before the next guest instruction can run.
const boundaryDisk = new Uint8Array(COWGOL_DOS_BASE_IMAGE.bytes);
boundaryDisk.set(Uint8Array.of(
    0x66, 0xb8, 0x78, 0x56, 0x34, 0x12, // MOV EAX,12345678h
    0x66, 0x05, 1, 0, 0, 0,             // ADD EAX,1
    0x66, 0x89, 0xc6,                   // MOV ESI,EAX
    0x68, 0x02, 0x32, 0x9d,             // PUSH 3202h; POPF
    0xb4, 0x0e, 0xb0, 0x33, 0xcd, 0x10, // BIOS teletype '3'
    0x66, 0x89, 0xc3,                   // MOV EBX,EAX after BIOS
    0x9c, 0x5a,                         // PUSHF; POP DX
    0x0f, 0x20, 0xc0,                   // MOV EAX,CR0
    0x66, 0x83, 0xc8, 1,               // OR EAX,1
    0x0f, 0x22, 0xc0, 0xf4));           // MOV CR0,EAX; HLT
boundaryDisk[510] = 0x55; boundaryDisk[511] = 0xaa;
let boundaryOutput = '';
const boundary = await createI80386DosBootBench({bytes: boundaryDisk, format: 'disk', variant: '80386',
    onChar: char => { boundaryOutput += char; }});
try {
    for (let step = 0; step < 32 && !boundary.machine.cpu.protectedMode; step++) boundary.step();
    assert.equal(boundary.machine.cpu.constructor.name, 'ExperimentalI80386');
    assert.equal(boundary.machine.cpu.esi, 0x12345679);
    assert.equal(boundary.machine.cpu.ebx, 0x12340e33, 'BIOS services must retain upper EAX');
    assert.equal(boundary.machine.cpu.dx & 0xf000, 0x3000, 'BIOS services must retain 386 IOPL');
    assert.equal(boundaryOutput, '3');
    assert.equal(boundary.machine.cpu.protectedMode, true);
    assert.throws(() => boundary.step(), /ordinary 16-bit real mode only/);
} finally { boundary.target.halt(); }
const bootBoundary = {core: boundary.machine.cpu.constructor.name,
    operand32Result: boundary.machine.cpu.esi, eaxAfterBios: boundary.machine.cpu.ebx,
    flagsHighAfterBios: boundary.machine.cpu.dx & 0xf000,
    output: boundaryOutput, protectedModeRefused: true};

const runs = [];
for (const variant of COWGOL_DOS_DISK_VARIANTS) for (const display of [false, true]) {
    const {detail} = await runMachineConfig(cowgolDosDiskConfig({variant, display}), {
        fetcher: async ref => {
            assert.equal(ref.url, 'local-media:cowgol-dos.img');
            return {bytes: disk.slice()};
        }, dispatch () {}
    });
    assert.equal(detail.kind, variant === '80386' ? 'i80386' : 'i8086');
    if (variant === '80386') assert.equal(detail.machinePreset, 'dos-boot');
    assert.equal(detail.slotId, 'disk');
    assert.equal(detail.profile, 'dos');
    assert.equal(detail.x86Variant, variant);
    assert.equal(detail.dosVariant, variant);
    assert.equal(detail.widgets.length, display ? 1 : 0);
    assert.deepEqual(detail.bytes, disk);
    let output = '';
    const exits = [];
    const createBench = variant === '80386' ? createI80386DosBootBench : createI8086DosBench;
    const bench = await createBench({bytes: detail.bytes, format: detail.slotId,
        variant: detail.x86Variant, onChar: char => { output += char; }, onExit: code => exits.push(code)});
    assert.equal(bench.machine.variant, variant);
    if (variant === '80386') {
        assert.equal(bench.machine.cpu.constructor.name, 'ExperimentalI80386');
        assert.equal(bench.machine.cpu.cr0 & 0x80000001, 0);
        assert.equal(bench.target.regs().pcSpace, 'linear');
        assert.ok(Object.hasOwn(bench.target.regs(), 'eax'));
    } else assert.equal(bench.machine.cpu.variant, variant);
    const initialInt21 = intVector(bench.machine, 0x21);
    bench.target.run();
    try {
        const normalize = text => text.replace(/\r/g, '');
        const launch = '\nA>COWGOL\n';
        runUntil(bench, () => {
            const text = normalize(output);
            return text.includes(launch) && text.slice(text.indexOf(launch) + launch.length).endsWith('\nA>');
        }, `${variant}: the real kernel must load the EXE and return to COMMAND.COM`);
        const text = normalize(output);
        assert.ok(text.includes('MS-DOS version 2.00') && text.includes('Command v. 2.02'));
        const start = text.indexOf(launch) + launch.length;
        const programOutput = text.slice(start, text.indexOf('\nA>', start));
        for (const expected of values.expect) assert.ok(programOutput.includes(expected),
            `compiled program output missing ${JSON.stringify(expected)}`);
        if (values['expect-output'] !== undefined) assert.equal(programOutput,
            normalize(values['expect-output']), 'the whole program output must match without boot or command echoes');
        const kernelInt21 = intVector(bench.machine, 0x21);
        assert.notDeepEqual(kernelInt21, initialInt21, 'real DOS must replace the service-layer INT 21h vector');
        assert.notEqual(kernelInt21.segment, initialInt21.segment, 'INT 21h must point outside the host trap page');
        assert.ok(kernelInt21.segment > 0 && kernelInt21.segment < 0xa000, 'the DOS handler must reside in guest RAM');
        assert.equal(bench.terminated, false, 'program exit returns to the living operating system');
        assert.deepEqual(exits, [], 'the service bench must not pretend the OS session terminated');
        const programScreen = bench.screenText().join('\n');
        for (const expected of values.expect) assert.ok(programScreen.includes(expected),
            `real text memory missing ${JSON.stringify(expected)}`);
        const frame = bench.target.video();
        assert.equal(frame.mode, 3);
        assert.equal(frame.width, 720);
        assert.equal(frame.height, 400);
        assert.equal(frame.rgba.length, 720 * 400 * 4);
        assert.ok(frame.rgba.some((byte, index) => byte !== frame.rgba[index % 4]), 'DOS text must render actual pixels');
        if (display) assert.deepEqual(detail.widgets[0].config, {width: frame.width, height: frame.height});
        // Enter after the shell is waiting. Test exact output lines so an
        // echoed command containing a marker cannot count as its execution.
        const afterProgram = output.length;
        bench.sendKeys('IF ERRORLEVEL 1 ECHO COWGOL-EXIT-ERROR\rECHO COWGOL-SHELL-OK\r');
        runUntil(bench, () => normalize(output.slice(afterProgram)).includes('\nCOWGOL-SHELL-OK\n\nA>'),
            `${variant}: a live keyboard command must execute on COMMAND.COM`);
        const shellOutput = normalize(output.slice(afterProgram));
        assert.ok(!shellOutput.includes('\nCOWGOL-EXIT-ERROR\n'), 'DOS ERRORLEVEL must report program success');
        assert.equal(bench.report().stdoutTruncated, false);
        assert.deepEqual(bench.report().unsupported, []);
        runs.push({variant, surface: display ? 'controller-msdos-text' : 'msdos-console',
            operatingSystem: 'MS-DOS 2.0', cpuCore: bench.machine.cpu.constructor.name,
            program: COWGOL_DOS_PROGRAM, programOutput,
            initialInt21, kernelInt21, returnedToShell: true, errorLevelZero: true,
            shellOutput, cycles: bench.machine.cycles,
            video: {mode: frame.mode, width: frame.width, height: frame.height,
                rgbaSha256: sha256(frame.rgba), text: programScreen}});
    } finally {
        bench.target.halt();
        if (variant !== '80386') i8086Execution.release(bench);
    }
}
for (const run of runs) assert.equal(run.programOutput, runs[0].programOutput,
    'all four CPU variants and both display choices must execute the same program output');
const sourcePaths = [
    'overlay/scratch-gui/src/lib/bw-lang/cowgol-dos-disk.js',
    'overlay/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js',
    'overlay/scratch-gui/src/lib/bw-debug/i80386-dos-bench.js',
    'overlay/scratch-gui/src/lib/bw-debug/debug-runner.js',
    'overlay/scratch-gui/src/lib/bw-machines/machine-config.js',
    'overlay/scratch-gui/src/lib/bw-machines/activate.js',
    'overlay/scratch-gui/src/lib/bw-machines/run-machine.js'
];
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, sha256(await readFile(join(root, file)))])));
const report = {schema: 'bw.cowgol-msdos-boot-witness.v1', boardCommit: actual, compilerTarget: 'dos',
    artifact: {path: resolve(values.exe), bytes: image.length, sha256: sha256(image)},
    baseImage: {...COWGOL_DOS_BASE_IMAGE, systemFiles}, diskSha256: sha256(disk),
    bios: 'machine adapter services', expected: values.expect, sources, bootBoundary, runs};
if (values.out) {
    const file = resolve(values.out);
    await mkdir(dirname(file), {recursive: true});
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
