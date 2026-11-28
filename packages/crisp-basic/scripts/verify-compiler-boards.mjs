#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Execute independently compiled firmware in Brickwright's actual MCU adapters.
// A missing simulator is a build-only result, never a simulated pass.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {compileSource} from '../src/compiler/index.mjs';
import {buildCompiledC, resolveCompilerTarget} from '../src/compiler-targets.mjs';
import {createWasmSession} from '../src/wasm-session.mjs';
import {createSimulationHost} from '../src/simulation-host.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtureNames = ['pins', 'console', 'decimal', 'overflow'];

async function referenceTrace(source, filename, expectedError) {
    let host;
    const session = createWasmSession({simulation: {createHost() {
        host = createSimulationHost({pins: [13]}); return host;
    }}});
    try {
        const result = await session.run(source, {filename});
        assert.equal(result.status, expectedError ? 'error' : 'completed', JSON.stringify(result.error));
        if (expectedError) {
            assert.equal(result.error?.code, expectedError.code, 'BBCSDL must reject the known overflowing decimal');
            assert.equal(result.error?.line, expectedError.line, 'BBCSDL error source line differs');
        }
        return {trace: host.trace, output: Buffer.from(result.output).toString('latin1'),
            status: result.status, ...(result.error ? {error: result.error} : {})};
    } finally { await session.dispose(); }
}

async function simulatorModules(boardRoot, target) {
    if (!boardRoot) return null;
    const src = path.join(path.resolve(boardRoot), 'src');
    const load = name => import(pathToFileURL(path.join(src, name)).href);
    const names = target === 'arduino-uno' ? ['avr8js-adapter.js', 'intel-hex.js'] : ['rp2040js-adapter.js', 'uf2.js'];
    try {
        const modules = await Promise.all(names.map(load));
        return {modules, sourceHashes: Object.fromEntries(await Promise.all(names.map(async name =>
            [name, digest(await readFile(path.join(src, name)))])))};
    } catch (error) {
        return {unavailable: error.message};
    }
}

function simulate(modules, target, firmware, expected, referenceOutput, expectedError) {
    const [engine, loader] = modules;
    const adapter = target === 'arduino-uno'
        ? engine.createAvr8jsAdapter({chip: 'atmega328p', clockHz: 16000000,
            program: loader.parseIntelHex(firmware.toString('utf8'))})
        : engine.createRp2040jsAdapter({clockHz: 125000000});
    if (target === 'pico') {
        const {base, image} = loader.parseUF2(firmware);
        assert.equal(base, 0x10000000, 'Pico SDK firmware must boot from flash');
        adapter.bootFromFlash(image);
    }
    const pinName = target === 'arduino-uno' ? 'D13' : 'GP13';
    let timeNs = 0n, previous, output = '', lastOutputMs = 0;
    const edges = [];
    const runtimeError = expectedError ? new RegExp(`^BASIC line ${expectedError.line}: numeric overflow or domain error\\r?\\n$`) : null;
    const outputMatches = () => expectedError ? output.startsWith(referenceOutput) &&
        runtimeError.test(output.slice(referenceOutput.length)) : output === referenceOutput;
    adapter.onSerial(byte => { output += String.fromCharCode(byte); lastOutputMs = Number(timeNs) / 1e6; });
    adapter.attachBoard({
        advanceTo(ns) { timeNs = ns; },
        setPin(pin, mode, high) {
            if (pin === pinName && mode === 'pushpull' && high !== previous) {
                edges.push({atMs: Number(timeNs) / 1e6, value: Number(high)}); previous = high;
            }
        },
        readPin() { return 0; }
    });
    // Include real SDK startup and enough AVR cycles for decimal conversions
    // and 9600-baud UART. No PC/register/timer is patched. Once every expected
    // byte/edge has arrived, retain at least 20 ms of quiet after the UART and
    // a minimum total observation of 100 ms; every fixture ends immediately
    // after its last expected output/edge.
    const budgetMs = target === 'arduino-uno' ? 5000 : 1000;
    for (let i = 0; i < budgetMs; i++) {
        adapter.advanceNs(1000000);
        const start = expected.length ? edges.findIndex(edge => edge.value === expected[0].value) : 0;
        const observed = start >= 0 ? edges.slice(start) : [];
        const complete = observed.length === expected.length && observed.every((edge, j) => edge.value === expected[j].value);
        if (i >= 99 && complete && outputMatches() && Number(timeNs) / 1e6 - lastOutputMs >= 20) break;
    }
    const first = expected.length ? edges.findIndex(edge => edge.value === expected[0].value) : 0;
    assert.ok(first >= 0, `${target}: no first authored output edge; serial=${JSON.stringify(output)}`);
    const authored = edges.slice(first);
    assert.deepEqual(authored.map(edge => edge.value), expected.map(edge => edge.value), `${target}: output transitions differ`);
    const intervals = [];
    for (let i = 1; i < authored.length; i++) {
        const observedMs = authored[i].atMs - authored[i - 1].atMs;
        const expectedMs = expected[i].atMs - expected[i - 1].atMs;
        // Timer0's 1 ms tick and instructions around a call differ from the
        // interpreter's instantaneous logical API. State and edge count are exact.
        const errorMs = Math.abs(observedMs - expectedMs);
        assert.ok(errorMs <= 1, `${target}: ${observedMs} ms interval differs from ${expectedMs} ms by more than 1 ms`);
        intervals.push({expectedMs, observedMs, errorMs});
    }
    if (expectedError) assert.ok(outputMatches(), `${target}: overflow UART prefix/diagnostic differs: ${JSON.stringify(output)}`);
    else assert.equal(output, referenceOutput, `${target}: UART output differs from the interpreter`);
    return {pin: pinName, edges, authoredEdges: authored, intervals, output,
        ...(expectedError ? {programOutput: referenceOutput, runtimeDiagnostic: output.slice(referenceOutput.length)} : {}),
        simulatedMs: Number(adapter.timeNs()) / 1e6, stats: adapter.stats};
}

export async function verifyCompilerBoard({target: targetName, boardRoot,
    outputDirectory = path.join(root, '.build/compiler-board-proof'), picoSdkPath,
    cc, cmake, objcopy, size, buildDirectory, fixture: fixtureName = 'all'} = {}) {
    const target = resolveCompilerTarget(targetName).id;
    if (target === 'native') throw new Error('Board verification requires pico or arduino-uno');
    if (fixtureName === 'all') {
        const reports = [];
        for (const fixture of fixtureNames) reports.push(await verifyCompilerBoard({target, boardRoot,
            outputDirectory, picoSdkPath, cc, cmake, objcopy, size, buildDirectory, fixture}));
        const passed = reports.every(report => report.validation.status === 'simulator-pin-trace-passed');
        const report = {schemaVersion: 2, target, fixtures: reports,
            validation: {status: passed ? 'simulator-pin-trace-passed' : 'build-only',
                simulator: passed ? reports[0].validation.simulator : 'unavailable',
                hardware: 'not-run', circuitPhysics: false, fixtures: reports.length,
                ...(passed ? {coldBootsPerFixture: 2, timingToleranceMs: 1} :
                    {reason: reports.find(item => item.validation.reason)?.validation.reason})}};
        await writeFile(path.join(path.resolve(outputDirectory), `${target}.json`), JSON.stringify(report, null, 2) + '\n');
        return report;
    }
    if (!fixtureNames.includes(fixtureName)) throw new Error(`Unknown board fixture ${fixtureName}; choose all, ${fixtureNames.join(', ')}`);
    const filename = fixtureName + '.bas';
    const source = await readFile(new URL(`../examples/compiler/${filename}`, import.meta.url), 'utf8');
    const expectedError = fixtureName === 'overflow' ? {code: 20, line: 3} : null;
    const reference = await referenceTrace(source, filename, expectedError);
    const expected = reference.trace.filter(event => event.type === 'digital-write' || event.type === 'digital-toggle');
    const dir = path.resolve(outputDirectory);
    await mkdir(dir, {recursive: true});
    const generated = compileSource(source, {target, filename});
    const stem = `${target}-${fixtureName}`;
    const sourcePath = path.join(dir, stem + '.c');
    await writeFile(sourcePath, generated.c);
    const built = await buildCompiledC({sourcePath, target,
        output: path.join(dir, stem + (target === 'pico' ? '.uf2' : '.hex')),
        picoSdkPath, cc, ...(cmake ? {cmake} : {}), ...(objcopy ? {objcopy} : {}), ...(size ? {size} : {}), buildDirectory});
    const loaded = await simulatorModules(boardRoot, target);
    const report = {schemaVersion: 1, fixture: 'examples/compiler/' + filename,
        sourceSha256: digest(source), generatedCSha256: digest(generated.c), target,
        build: built, reference: {backend: 'BBCSDL-WASM', ...reference},
        validation: {status: 'build-only', simulator: 'unavailable', hardware: 'not-run', circuitPhysics: false}};
    if (!loaded || loaded.unavailable) report.validation.reason = loaded?.unavailable || 'No --board-root supplied';
    else {
        const firmware = await readFile(built.artifacts[0].path);
        report.simulatorSourceHashes = loaded.sourceHashes;
        report.coldBoots = [simulate(loaded.modules, target, firmware, expected, reference.output, expectedError),
            simulate(loaded.modules, target, firmware, expected, reference.output, expectedError)];
        report.validation = {status: 'simulator-pin-trace-passed', simulator: target === 'pico' ? 'Brickwright/rp2040js' : 'Brickwright/avr8js',
            hardware: 'not-run', circuitPhysics: false, coldBoots: 2, timingToleranceMs: 1,
            uartComparison: expectedError ? 'exact-prefix-and-runtime-error' : 'exact-bytes'};
    }
    await writeFile(path.join(dir, stem + '.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const fields = {'--target': 'target', '--board-root': 'boardRoot', '--output-directory': 'outputDirectory',
        '--pico-sdk': 'picoSdkPath', '--cc': 'cc', '--cmake': 'cmake', '--build-directory': 'buildDirectory',
        '--objcopy': 'objcopy', '--size': 'size', '--fixture': 'fixture'};
    const options = {}, args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
        if (!fields[args[i]] || !args[i + 1]) throw new Error(`Unknown or incomplete option ${args[i]}`);
        options[fields[args[i]]] = args[i + 1];
    }
    if (!options.target) throw new Error('Usage: verify-compiler-boards.mjs --target pico|uno [--fixture all|pins|console|decimal|overflow] [--board-root PATH] [toolchain options]');
    verifyCompilerBoard(options).then(report => console.log(JSON.stringify(report.validation)))
        .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}
