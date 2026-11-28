#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Real frontend client -> local HTTP service -> actual compiler -> pinned guest.
// Starts the server as a child so loopback also works in isolated exec sandboxes.
// Requires the service's Python requirements, a built Cowgol bundle, and cc for
// C export. No packages are installed and no remote compiler endpoint is used.
//
// node scripts/verify-cowgol-platforms.mjs \
//   --service ../stc-compiler --bundle ../cowgol-bundle --board ../bw-board \
//   --riscv-gcc-stage ../riscv-gcc-stage --tmpdir ../validation
// Add DOS, Eater, Uno or Nano to --targets when those native profiles are installed.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {compileCowgol, COWGOL_COMPILE_TARGETS} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {AVR8JS_SPEC} from './lib/avr8js-spec.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const {values} = parseArgs({options: {
    service: {type: 'string'}, bundle: {type: 'string'}, board: {type: 'string'},
    'riscv-gcc-stage': {type: 'string'}, 'avr-gcc-stage': {type: 'string'},
    'avr-runner': {type: 'string'}, 'avr8js-root': {type: 'string'}, tmpdir: {type: 'string'},
    targets: {type: 'string'}, python: {type: 'string'}, cc: {type: 'string'},
    cli: {type: 'boolean'}, help: {type: 'boolean', short: 'h'}
}});
if (values.help) {
    console.log(`Usage: node scripts/verify-cowgol-platforms.mjs [options]
  --service PATH           stc-compiler checkout (COWGOL_STC_COMPILER; default ../stc-compiler)
  --bundle PATH            Built bundle (COWGOL_BUNDLE; default SERVICE/vendor/cowgol)
  --board PATH             Exact pinned bw-board checkout (COWGOL_BW_BOARD; default ../bw-board)
  --riscv-gcc-stage PATH   Existing executable GCC stage (COWGOL_RISCV_GCC_STAGE)
  --avr-gcc-stage PATH     Existing executable AVR stage (COWGOL_AVR_GCC_STAGE)
  --avr-runner PATH        Cowgol tests/avr-run.mjs (COWGOL_AVR_RUNNER; default ../cowgol/tests/avr-run.mjs)
  --avr8js-root PATH       Exact GUI-pinned avr8js checkout (AVR8JS_ROOT; default ../avr8js-oracle)
  --tmpdir PATH            Temporary parent directory (TMPDIR; default this repository)
  --targets LIST          Comma-separated riscv32,cowgol-cgen,eater6502,atmega328p,arduino-nano,z80-cpm,i8080-cpm,dos (default first two)
  --cli                   Also build through bwlite cowgol and execute its exact saved artifact
  --python COMMAND        Python executable (PYTHON; default python3)
  --cc COMMAND            Host C compiler executable (CC; default cc)

The service binds an ephemeral 127.0.0.1 port. Every compiler request uses that
local endpoint through Brickwright's real compileCowgol client. Temporary
artifacts and the child server are removed on success and on ordinary failure.
C export is compiled with the bundle's real portable console binding. Eater6502
and the Uno/Nano AVR profiles are explicit opt-ins and fail if their bundle/runtime is absent.
The AVR test also requires the exact pinned GUI engine and compiler checkout.
CP/M programs run under the actual CP/M 2.2 OS on both serial and Controller
surfaces; both compiler targets execute on the pinned Z80 CPU. DOS executes on
8086, 80186 and real-mode 80286 with console and Controller text output.`);
    process.exit(0);
}

const service = path.resolve(values.service || process.env.COWGOL_STC_COMPILER || path.join(root, '../stc-compiler'));
const bundle = path.resolve(values.bundle || process.env.COWGOL_BUNDLE || path.join(service, 'vendor/cowgol'));
const board = path.resolve(values.board || process.env.COWGOL_BW_BOARD || path.join(root, '../bw-board'));
const temporaryParent = path.resolve(values.tmpdir || process.env.TMPDIR || root);
const python = values.python || process.env.PYTHON || 'python3';
const compiler = values.cc || process.env.CC || 'cc';
const targets = [...new Set((values.targets || 'riscv32,cowgol-cgen').split(',').map(item => item.trim()).filter(Boolean))];
assert.ok(targets.length, 'Select at least one platform');
for (const target of targets) {
    assert.ok(Object.hasOwn(COWGOL_COMPILE_TARGETS, target), `Unsupported verification target: ${target}`);
    assert.ok(COWGOL_COMPILE_TARGETS[target], `The frontend does not yet expose ${target}`);
}
for (const filename of [path.join(service, 'app.py'), path.join(bundle, 'manifest.json')]) {
    assert.ok(existsSync(filename), `Required input is missing: ${filename}`);
}

const git = (directory, ...args) => execFileSync('git', ['-C', directory, ...args], {encoding: 'utf8', timeout: 10_000}).trim();
const manifest = JSON.parse(readFileSync(path.join(bundle, 'manifest.json'), 'utf8'));
const needsBoard = targets.some(target => ['riscv32', 'eater6502', 'z80-cpm', 'i8080-cpm', 'dos'].includes(target));
const boardPin = needsBoard ? JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'))['bw-board'] : null;
if (needsBoard) {
    assert.equal(git(board, 'rev-parse', 'HEAD'), boardPin, 'The machine checkout must match vendor-pins.json');
    assert.equal(git(board, 'status', '--porcelain', '--untracked-files=no'), '', 'The pinned machine must have no tracked edits');
}
mkdirSync(temporaryParent, {recursive: true});
const work = mkdtempSync(path.join(temporaryParent, 'bw-cowgol-platforms-'));
const riscvStage = path.resolve(values['riscv-gcc-stage'] || process.env.COWGOL_RISCV_GCC_STAGE || path.join(work, 'riscv-gcc'));
const avrStage = path.resolve(values['avr-gcc-stage'] || process.env.COWGOL_AVR_GCC_STAGE || path.join(work, 'avr'));
const avrRunner = path.resolve(values['avr-runner'] || process.env.COWGOL_AVR_RUNNER || path.join(root, '../cowgol/tests/avr-run.mjs'));
const avrRoot = path.resolve(values['avr8js-root'] || process.env.AVR8JS_ROOT || path.join(root, '../avr8js-oracle'));
const avrPin = AVR8JS_SPEC.split('#')[1];

// Staging may replace a stale directory. Resolve existing ancestors even when
// the requested stage does not exist yet, so a symlink cannot hide an overlap
// with a compiler source prefix. Check before starting Python or staging tools.
const canonicalPath = filename => {
    let ancestor = path.resolve(filename);
    const suffix = [];
    for (;;) {
        try { return path.join(realpathSync(ancestor), ...suffix); } catch (error) {
            if (error.code !== 'ENOENT' || ancestor === path.dirname(ancestor)) throw error;
            suffix.unshift(path.basename(ancestor));
            ancestor = path.dirname(ancestor);
        }
    }
};
const containsPath = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};

const fullSource = `include "cowgol.coh";
include "brickwright.coh";
include "strings.coh";
include "malloc.coh";
var values: int32[3];
values[0] := 20;
values[1] := 22;
values[2] := values[0] + values[1];
var quotient: uint32;
var remainder: uint32;
var dividend: uint32 := 85;
var divisor: uint32 := 2;
quotient := dividend / divisor;
remainder := dividend % divisor;
var memory := Alloc(8);
[memory] := 17;
bw_print_text("HTTP Cowgol");
bw_print_number(values[2]);
bw_print_number(quotient as int32);
bw_print_number(remainder as int32);
bw_print_number([memory] as int32);
Free(memory);
bw_print_number(-2147483647 as int32 - 1);
bw_print_number(2147483647 as int32);
`;
const fullOutput = 'HTTP Cowgol\n42\n42\n1\n17\n-2147483648\n2147483647\n';
const romSource = `include "cowgol.coh";
include "brickwright.coh";
bw_print_text("HTTP Cowgol 6502");
bw_print_number(42 as int32);
bw_print_number(-2147483647 as int32 - 1);
bw_print_number(2147483647 as int32);
`;
const romOutput = 'HTTP Cowgol 6502\n42\n-2147483648\n2147483647\n';

// Import the real application, redirect its writable staging directories, and
// leave unrelated cross compilers unavailable. Enumerating a full bundle must
// not unpack AVR/RV32 toolchains during a CP/M-only verification.
// /health stages unrelated toolchains, so readiness uses the ordinary OpenAPI
// route instead. The Cowgol request still crosses the actual /compile guard.
const serverCode = `
import os, pathlib, socket, sys
sys.path.insert(0, sys.argv[1])
import app, uvicorn
app.RISCV_GCC_STAGE = sys.argv[2]
app.RISCV_GCC_STAGE_BIN = str(pathlib.Path(sys.argv[2]) / "bin")
app.AVR_STAGE = sys.argv[3]
app.AVR_STAGE_BIN = str(pathlib.Path(sys.argv[3]) / "bin")
app._AVR_STAMP = str(pathlib.Path(sys.argv[3]) / ".bundle-fingerprint")
requested = set(sys.argv[4].split(","))
if "riscv32" not in requested:
    app.stage_riscv_gcc = lambda: None
if not requested.intersection({"atmega328p", "arduino-nano"}):
    app.stage_avr = lambda: None
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))
print("BW_COWGOL_ENDPOINT=http://127.0.0.1:%d/compile" % sock.getsockname()[1], flush=True)
uvicorn.Server(uvicorn.Config(app.app, log_level="warning", access_log=False)).run(sockets=[sock])
`;
let server;
let closed;
let exitResult;
let serviceLog = '';
let endpoint;
const results = [];
try {
    const sourcePrefixes = ['avr', 'riscv-gcc'].map(name => canonicalPath(path.join(service, name)));
    for (const stage of [riscvStage, avrStage]) {
        const physicalStage = canonicalPath(stage);
        for (const sourcePrefix of sourcePrefixes) {
            assert.ok(!containsPath(sourcePrefix, physicalStage) && !containsPath(physicalStage, sourcePrefix),
                `Compiler staging directory ${stage} overlaps service source prefix ${sourcePrefix}; choose a separate stage directory`);
        }
    }
    server = spawn(python, ['-u', '-c', serverCode, service, riscvStage, avrStage, targets.join(',')], {
        cwd: service, env: {...process.env, TMPDIR: work, COWGOL_BUNDLE: bundle, PYTHONDONTWRITEBYTECODE: '1'},
        stdio: ['ignore', 'pipe', 'pipe']
    });
    closed = new Promise(resolve => {
        server.once('error', error => { exitResult = {error}; });
        server.once('close', (code, signal) => { exitResult ||= {code, signal}; resolve(exitResult); });
    });
    server.stdout.setEncoding('utf8'); server.stderr.setEncoding('utf8');
    const collect = chunk => {
        serviceLog = (serviceLog + chunk).slice(-16_384);
        endpoint ||= serviceLog.match(/^BW_COWGOL_ENDPOINT=(http:\/\/127\.0\.0\.1:\d+\/compile)$/m)?.[1];
    };
    server.stdout.on('data', collect); server.stderr.on('data', collect);
    const startDeadline = Date.now() + 30_000;
    let ready = false;
    while (!ready && Date.now() < startDeadline) {
        if (exitResult) throw new Error(`Local compiler server exited: ${JSON.stringify(exitResult)}`);
        if (endpoint) {
            try {
                const response = await fetch(endpoint.replace(/\/compile$/, '/openapi.json'), {
                    redirect: 'error', signal: AbortSignal.timeout(1_000)
                });
                ready = response.ok;
                await response.arrayBuffer();
            } catch { /* The listening socket may precede ASGI startup. */ }
        }
        if (!ready) await delay(50);
    }
    assert.ok(ready, 'Local compiler server did not start within 30 seconds');
    const localFetch = (url, options) => {
        assert.equal(url, endpoint, 'Verification must not send source outside its local compiler server');
        return fetch(url, {...options, redirect: 'error', signal: AbortSignal.timeout(120_000)});
    };
    for (const target of targets) {
        const code = target === 'eater6502' ? romSource : fullSource;
        const out = await compileCowgol(code, target, {endpoint, fetcher: localFetch});
        assert.equal(out.compiler_commit, manifest.source_commit, 'HTTP response must identify the supplied compiler bundle');
        if (values.cli) {
            const source = path.join(work, 'program.cow');
            const artifact = path.join(work, out.filename);
            writeFileSync(source, code);
            execFileSync(process.execPath, [path.join(root, 'bin/bwlite.mjs'), 'cowgol', 'build', source,
                '--target', target, '--out', artifact, '--endpoint', endpoint], {
                encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024,
                env: {...process.env, TMPDIR: work}
            });
            const saved = new Uint8Array(readFileSync(artifact));
            assert.deepEqual(saved, out.bytes, 'The native CLI must save the exact validated HTTP artifact');
            out.bytes = saved;
        }
        let output;
        let execution;
        if (target.endsWith('-cpm')) {
            const artifact = path.join(work, `${target}.com`);
            writeFileSync(artifact, out.bytes);
            const expected = fullOutput.trimEnd().split('\n');
            const report = JSON.parse(execFileSync(process.execPath,
                [path.join(root, 'scripts/verify-cowgol-cpm-system.mjs'), '--com', artifact,
                    '--board', board, '--target', target, ...expected.map(text => `--expect=${text}`)], {
                    encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024,
                    env: {...process.env, TMPDIR: work}
                }));
            for (const run of report.runs) {
                assert.ok(run.programOutput.replace(/\r/g, '').includes(fullOutput),
                    `${run.surface} must execute the complete full-source output in order`);
            }
            const actual = report.runs[0].programOutput.replace(/\r/g, '');
            output = actual.slice(actual.indexOf(fullOutput), actual.indexOf(fullOutput) + fullOutput.length);
            execution = {machine: 'Z80', boots: report.runs.length,
                surfaces: report.runs.map(run => run.surface), ccpBdosSha256: report.ccpBdosSha256,
                displaySha256: report.runs.find(run => run.video)?.video.rgbaSha256, exitCode: 0};
        } else if (target === 'dos') {
            const artifact = path.join(work, 'program.exe');
            writeFileSync(artifact, out.bytes);
            const report = JSON.parse(execFileSync(process.execPath,
                [path.join(root, 'scripts/verify-cowgol-dos.mjs'), '--exe', artifact, '--board', board,
                    '--expect-output', fullOutput, ...fullOutput.trimEnd().split('\n').map(text => `--expect=${text}`)], {
                    encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024,
                    env: {...process.env, TMPDIR: work}
                }));
            assert.equal(report.runs.length, 6, 'Execute three DOS CPUs on both console and Controller surfaces');
            output = report.runs[0].output.replace(/\r/g, '');
            execution = {machine: 'PC DOS services', boots: report.runs.length, exitCode: 0,
                artifactSha256: report.artifact.sha256, sources: report.sources, probes: report.probes,
                runs: report.runs};
        } else if (target === 'riscv32') {
            const {RiscV32Machine} = await import(pathToFileURL(path.join(board, 'src/riscv32-machine.js')).href);
            const machine = new RiscV32Machine({memSize: 1 << 22, resetPc: out.image.entry});
            for (const segment of out.image.segments) machine.load(segment.bytes, segment.addr);
            machine.run(50_000_000);
            assert.equal(machine.halted, true, 'RV32 program must halt within the instruction budget');
            assert.equal(machine.exitCode, 0, 'RV32 program must exit successfully');
            output = machine.output;
            execution = {entry: out.image.entry, segments: out.image.segments.length, exitCode: machine.exitCode};
        } else if (target === 'atmega328p' || target === 'arduino-nano') {
            assert.ok(existsSync(avrRunner), 'The real AVR machine runner must exist');
            assert.equal(git(avrRoot, 'rev-parse', 'HEAD'), avrPin, 'Use exactly the AVR engine pinned by the GUI');
            assert.equal(git(avrRoot, 'status', '--porcelain', '--untracked-files=no'), '', 'The AVR engine must have no tracked edits');
            const runnerCheckout = path.dirname(path.dirname(avrRunner));
            assert.equal(git(runnerCheckout, 'rev-parse', 'HEAD'), manifest.source_commit,
                'The AVR runner must match the compiled Cowgol runtime revision');
            assert.equal(git(runnerCheckout, 'status', '--porcelain', '--untracked-files=no'), '',
                'The AVR runner checkout must have no tracked edits');
            const firmware = path.join(work, `${target}.hex`);
            const layout = path.join(work, `${target}-layout.json`);
            writeFileSync(firmware, out.bytes);
            writeFileSync(layout, JSON.stringify(out.memory_layout));
            const observed = JSON.parse(execFileSync(process.execPath,
                [avrRunner, firmware, layout, JSON.stringify({runs: 2})], {
                    encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024,
                    env: {...process.env, AVR8JS_ROOT: avrRoot}
                }));
            assert.equal(observed.runs.length, 2, 'Execute two cold-SRAM boots');
            for (const run of observed.runs) {
                assert.equal(run.stopped, true, 'AVR program must halt within the cycle budget');
                assert.equal(run.status, 0, 'AVR program must exit successfully');
                assert.equal(run.flashUnchanged, true, 'AVR execution must preserve flash');
                assert.ok(run.minSP >= out.memory_layout.stack_start, 'Observed stack must stay inside its reservation');
                assert.equal(run.text, fullOutput);
            }
            output = observed.runs[0].text;
            execution = {board: out.board, flashLimit: out.memory_layout.flash_limit,
                flashBytes: out.memory_layout.flash_end, sramBytes: out.memory_end - 0x100,
                cycles: observed.runs[0].cycles, minSP: observed.runs[0].minSP, boots: 2, exitCode: 0};
        } else if (target === 'cowgol-cgen') {
            assert.equal(out.artifact_kind, 'source');
            assert.equal(out.c, new TextDecoder().decode(out.bytes), 'Downloaded C and response text must agree');
            const relative = 'rt/cgen/brickwright-console.h';
            const host = readFileSync(path.join(bundle, relative));
            assert.equal(createHash('sha256').update(host).digest('hex'), manifest.sha256[relative], 'Use the pinned console binding');
            const source = path.join(work, 'export.c');
            const executable = path.join(work, 'export');
            writeFileSync(source, Buffer.concat([out.bytes, Buffer.from('\n'), host]));
            execFileSync(compiler, ['-std=gnu99', '-fwrapv', '-fno-strict-aliasing', source, '-o', executable], {
                encoding: 'utf8', timeout: 30_000, env: {...process.env, TMPDIR: work}, maxBuffer: 1024 * 1024
            });
            output = execFileSync(executable, [], {encoding: 'utf8', timeout: 10_000});
            execution = {compiler, exitCode: 0, binding: relative};
        } else {
            const {M6502Machine, EATER6502} = await import(pathToFileURL(path.join(board, 'src/m6502-machine.js')).href);
            assert.equal(out.bytes.length, 0x8000, 'Eater6502 must be a complete 32 KiB ROM');
            const serial = [], romWrites = [];
            const machine = new M6502Machine(EATER6502, {onSerial: byte => serial.push(byte)});
            machine.mem.fill(0xa5, 0, 0x4000);
            machine.loadRom(out.bytes);
            const write = machine.cpu.write;
            machine.cpu.write = (address, byte) => {
                if (address >= 0x8000) romWrites.push(address);
                write(address, byte);
            };
            machine.reset();
            let steps = 0;
            for (; steps < 4_000_000 && !machine.cpu.stopped; steps++) machine.step();
            assert.equal(machine.cpu.stopped, true, '6502 program must stop within the instruction budget');
            assert.equal(machine.cpu.a, 0, '6502 program must exit successfully');
            assert.deepEqual(romWrites, [], '6502 program must not attempt to use ROM as workspace');
            assert.deepEqual(machine.mem.subarray(0x8000), out.bytes, 'ROM must remain unchanged');
            output = Buffer.from(serial).toString('utf8');
            execution = {entry: out.entry, steps, exitCode: machine.cpu.a};
        }
        assert.equal(output, target === 'eater6502' ? romOutput : fullOutput, `${target} console output must include both int32 limits`);
        results.push({target, toolchain: out.toolchain, artifactBytes: out.bytes.length,
            cli: Boolean(values.cli), ...execution, output});
        console.error(`PASS ${target}: real HTTP artifact executed with the expected console and signed int32 limits`);
    }
    console.log(JSON.stringify({
        serviceCommit: git(service, 'rev-parse', 'HEAD'),
        serviceTrackedEdits: git(service, 'status', '--porcelain', '--untracked-files=no') !== '',
        cowgolCommit: manifest.source_commit,
        boardCommit: needsBoard ? boardPin : null,
        avrCommit: targets.some(target => ['atmega328p', 'arduino-nano'].includes(target)) ? avrPin : null,
        results
    }, null, 2));
} catch (error) {
    if (error.log) console.error(error.log);
    if (serviceLog) console.error(`Local compiler log:\n${serviceLog}`);
    throw error;
} finally {
    if (server && !exitResult) {
        server.kill('SIGTERM');
        await Promise.race([closed, delay(5_000, undefined, {ref: false})]);
        if (!exitResult) server.kill('SIGKILL');
    }
    if (closed) await closed;
    rmSync(work, {recursive: true, force: true});
}
