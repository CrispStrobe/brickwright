#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {createNativeSession, createWasmSession, SourceError, VERSION} from '../index.mjs';
import {prepareCliSimulation} from '../src/cli-simulation.mjs';
import {listBoardTargets, prepareTargetSimulation} from '../src/board-targets.mjs';

let activeSession;
let outputFailure;
const closedStreams = new Set();
for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', error => {
        closedStreams.add(stream);
        outputFailure ||= error;
        // A detached interpreter must not outlive a CLI whose output pipe has
        // closed. Keep these handlers installed until Node has flushed output.
        activeSession?.cancel();
        process.exitCode = outputFailure.code === 'EPIPE' ? 141 : 1;
    });
}
const writeOut = bytes => { if (!closedStreams.has(process.stdout)) process.stdout.write(bytes); };
const writeError = text => { if (!closedStreams.has(process.stderr)) process.stderr.write(text); };

const HELP = `CrispBASIC ${VERSION} — BBC BASIC-compatible runtime

Usage: crispbasic [options] program.bas
       crispbasic bundle program.bas [--target linux-x64|linux-arm64|linux-armv7|web]
       crispbasic compile program.bas [--target native|pico|arduino-uno] [--emit-c]
       crispbasic serve program.html [--port 8080]
       crispbasic --list-targets
       crispbasic --backend wasm --target NAME [--simulation FILE] program.bas
       crispbasic [--backend native|wasm] [--target NAME] [--simulation FILE] --capabilities

  --backend NAME      native (default, Linux x64/ARM64/ARMv7) or wasm (Node worker)
  --native-executable PATH  Select a built native interpreter, including a cross build
  --native-runner PATH      Run it through an emulator such as qemu-arm
  --native-runner-arg ARG   Emulator argument; may be repeated (no shell expansion)
  --capabilities      Print the selected runtime's capabilities as JSON
  --list-targets      List the admitted board targets and terminal maps as JSON
  --target NAME       Use a board's admitted logical pins (WASM only)
  --simulation FILE   Supply logical input stimuli and limits (WASM only)
  --input FILE        Supply runtime input bytes from a file (otherwise stdin)
  --timeout MS        Wall-clock limit, including input waits (default: 5000)
  --max-output BYTES  Raw output limit (default: 1048576)
  --json              Print one result object, including outputBase64
  --version           Print the CrispBASIC version
  --help              Show this help

Build the selected core first: npm run build:native or npm run build:wasm
Source files are UTF-8 text restricted to Latin-1 characters.
Output is the raw VDU byte stream; --json includes a Latin-1 text view.
WASM uses the restricted host; native executes trusted local programs with host access.
Simulation uses deterministic logical pins, without circuit physics or real hardware.
Board targets do not execute firmware or emulate the board CPU. STM32 selects
STM32F030; Nano selects the classic AVR Nano. Pico and RP2040 select the same profile.
With --target, fixture pins may restrict the profile but cannot add unsupported pins.
With --json, simulation results include the final bounded pin/time trace.
`;

function numberOption(value, name) {
    if (value === undefined) return undefined;
    if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) ||
        Number(value) < 1 || Number(value) > 0x7fffffff) {
        throw new Error(`${name} must be an integer from 1 to 2147483647`);
    }
    return Number(value);
}

const EXIT = {completed: 0, error: 1, 'host-error': 1, timeout: 124,
    'output-limit': 125, 'simulation-limit': 125, cancelled: 130};

async function main() {
    const args = process.argv.slice(2);
    if (args[0] === 'serve') {
        const {runServeCli} = await import('../src/serve-bundle.mjs');
        return runServeCli(args.slice(1), {writeOut, onServer: server => {
            activeSession = {cancel: () => { void server.close(); }};
        }});
    }
    if (args[0] === 'bundle') {
        const {runBundleCli} = await import('../src/bundle-cli.mjs');
        return runBundleCli(args.slice(1), {writeOut, writeError});
    }
    if (args[0] === 'compile') {
        const {runCompileCli} = await import('../src/compile-cli.mjs');
        return runCompileCli(args.slice(1), {writeOut, writeError});
    }
    const {values, positionals, tokens} = parseArgs({
        options: {
            backend: {type: 'string'}, capabilities: {type: 'boolean'}, simulation: {type: 'string'},
            target: {type: 'string'}, 'list-targets': {type: 'boolean'},
            'native-executable': {type: 'string'}, 'native-runner': {type: 'string'},
            'native-runner-arg': {type: 'string', multiple: true},
            input: {type: 'string'}, timeout: {type: 'string'},
            'max-output': {type: 'string'}, json: {type: 'boolean'},
            version: {type: 'boolean'}, help: {type: 'boolean'}
        },
        allowPositionals: true,
        strict: true,
        tokens: true
    });
    if (values.help) { writeOut(HELP); return; }
    if (values.version) { writeOut(`CrispBASIC ${VERSION}\n`); return; }
    if (tokens.filter(token => token.kind === 'option' && token.name === 'target').length > 1) {
        throw new Error('--target may be specified only once');
    }
    if (values['list-targets']) {
        if (positionals.length || Object.keys(values).some(key => !['list-targets', 'json'].includes(key))) {
            throw new Error('--list-targets takes no source file or execution options');
        }
        writeOut(`${JSON.stringify({schemaVersion: 1, targets: listBoardTargets()}, null, 2)}\n`);
        return;
    }
    const backend = values.backend ?? 'native';
    if (!['native', 'wasm'].includes(backend)) throw new Error('--backend must be native or wasm');
    if (backend !== 'native' && ['native-executable', 'native-runner', 'native-runner-arg'].some(key => values[key] !== undefined)) {
        throw new Error('--native-executable and --native-runner options require --backend native');
    }
    if (values['native-runner-arg'] !== undefined && values['native-runner'] === undefined) {
        throw new Error('--native-runner-arg requires --native-runner');
    }
    if (values.simulation !== undefined && backend !== 'wasm') {
        throw new Error('--simulation requires --backend wasm');
    }
    if (values.target !== undefined && backend !== 'wasm') {
        throw new Error('--target requires --backend wasm; board targets use host-driven logical simulation');
    }
    if (positionals.length !== (values.capabilities ? 0 : 1)) {
        throw new Error(values.capabilities ? '--capabilities takes no source file' :
            'Expected one .bas source file. Use --help for usage.');
    }
    if (values.capabilities && values.input !== undefined) throw new Error('--capabilities does not consume --input');
    const timeoutMs = numberOption(values.timeout, '--timeout');
    const maxOutputBytes = numberOption(values['max-output'], '--max-output');
    let fixture, simulationHost;
    // Resolve the selected target before touching a fixture or source file.
    // A second prepared factory adds optional stimuli without expanding its pins.
    if (values.target !== undefined) fixture = prepareTargetSimulation(values.target);
    if (values.simulation !== undefined) {
        const value = JSON.parse(await readFile(values.simulation, 'utf8'));
        fixture = values.target === undefined ? prepareCliSimulation(value) : prepareTargetSimulation(values.target, value);
    }
    const session = (backend === 'wasm' ? createWasmSession : createNativeSession)({
        ...(values['native-executable'] === undefined ? {} : {executable: values['native-executable']}),
        ...(values['native-runner'] === undefined ? {} : {runner: {
            executable: values['native-runner'], args: values['native-runner-arg'] || []
        }}),
        ...(timeoutMs === undefined ? {} : {timeoutMs}),
        ...(maxOutputBytes === undefined ? {} : {maxOutputBytes}),
        ...(fixture ? {simulation: {maxRequests: fixture.maxRequests, createHost() {
            simulationHost = fixture.createHost();
            return simulationHost;
        }}} : {}),
        onEvent(event) {
            if (event.type === 'output' && !values.json) writeOut(Buffer.from(event.bytes));
        }
    });
    if (values.capabilities) {
        try {
            writeOut(`${JSON.stringify({...session.capabilities,
                ...(fixture ? {simulationHost: fixture.capabilities} : {})})}\n`);
        } finally { await session.dispose(); }
        return;
    }
    const filename = positionals[0];
    activeSession = session;
    const cancellation = new AbortController();
    const interrupt = () => { cancellation.abort(); session.cancel(); };
    const sendInput = bytes => {
        try { session.writeInput(bytes); } catch (error) {
            writeError(`CrispBASIC: ${error.message}\n`);
            session.cancel();
        }
    };
    const endInput = () => session.endInput();
    const inputError = error => {
        writeError(`CrispBASIC input: ${error.message}\n`);
        session.cancel();
    };
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    try {
        const source = await readFile(filename, 'utf8');
        const input = values.input === undefined ? '' : await readFile(values.input);
        const pending = session.run(source, {filename, input, interactive: values.input === undefined,
            signal: cancellation.signal});
        if (values.input === undefined) {
            process.stdin.on('data', sendInput);
            process.stdin.once('end', endInput);
            process.stdin.once('error', inputError);
            if (process.stdin.readableEnded) endInput();
        }
        const result = await pending;
        if (outputFailure) {
            process.exitCode = outputFailure.code === 'EPIPE' ? 141 : 1;
            return;
        } else if (values.json) {
            const {output, ...rest} = result;
            const trace = simulationHost?.trace;
            writeOut(`${JSON.stringify({...rest, outputBase64: Buffer.from(output).toString('base64'),
                ...(simulationHost ? {simulation: {capabilities: simulationHost.capabilities,
                    elapsedMs: trace.at(-1)?.atMs ?? 0, trace}} : {})})}\n`);
        } else if (result.status !== 'completed') {
            const where = result.error?.filename ?
                `${result.error.filename}${result.error.line ? `:${result.error.line}` : ''}: ` : '';
            writeError(`CrispBASIC: ${where}${result.error?.message || result.status}\n`);
            if (result.diagnostics) writeError(result.diagnostics);
        }
        process.exitCode = result.status === 'completed' ? result.exitCode : (EXIT[result.status] ?? 1);
    } catch (error) {
        if (values.json && error instanceof SourceError) {
            writeOut(`${JSON.stringify({status: 'source-error', error: {
                kind: 'source', code: error.code, message: error.message,
                filename: error.filename, line: error.line, column: error.column
            }})}\n`);
            process.exitCode = 1;
        } else throw error;
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        process.stdin.removeListener('data', sendInput);
        process.stdin.removeListener('end', endInput);
        process.stdin.removeListener('error', inputError);
        process.stdin.pause();
        await session.dispose();
        activeSession = null;
    }
}

main().catch(error => {
    writeError(`CrispBASIC: ${error.message || error}\n`);
    process.exitCode = outputFailure?.code === 'EPIPE' ? 141 : 1;
});
