// Browser consumer of the owned media-lab native DOS startup protocol.
import catalog from './catalog.json';
import provenance from './provenance.json';
import {initializeNativeDosClock, adaptNativeDosService, validateNativeCgaQueries} from './native-dos.mjs';
import {collectBenchmarkOutput} from './benchmark-output.mjs';
import {whetstoneResult} from './whetstone-result.mjs';

export const mediaCommit = provenance.assetsCommit || provenance.commit;
export {catalog, provenance};
const base = `https://raw.githubusercontent.com/${provenance.repository}/${mediaCommit}/${provenance.base}/`;
const decoder = new TextDecoder();
const cancelled = signal => { if (signal?.aborted) throw new Error('Stopped; no accepted result.'); };
export async function verifyBytes (bytes, expected, name) {
    if (bytes.byteLength !== expected.bytes) throw new Error(`Byte count mismatch: ${name}`);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        byte => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== expected.sha256) throw new Error(`SHA-256 mismatch: ${name}`);
    return bytes;
}

// Rehash cached bytes on every read; corrupt entries are discarded. A failed
// optional browser cache never disables exact payload verification.
export async function fetchAssets (project, {signal, onNotice = () => {}, fetcher = fetch,
    cacheStorage = globalThis.caches} = {}) {
    if (!Object.hasOwn(catalog, project)) throw new Error('Unknown benchmark');
    let cache;
    try { cache = await cacheStorage?.open('brickwright-native-benchmarks-v1'); } catch (_) { /* memory only */ }
    const files = {}, notices = [];
    for (const [name, proof] of Object.entries(catalog[project].files)) {
        cancelled(signal);
        const url = `${base}${catalog[project].directory || project}/${name}`;
        let bytes;
        try {
            const saved = await cache?.match(url);
            if (saved) bytes = await verifyBytes(new Uint8Array(await saved.arrayBuffer()), proof, name);
        } catch (_) { try { await cache?.delete(url); } catch (_) { /* optional cache */ } }
        if (!bytes) {
            const response = await fetcher(url, {signal, credentials: 'omit', referrerPolicy: 'no-referrer'});
            if (!response.ok) throw new Error(`Download ${name}: HTTP ${response.status}`);
            bytes = await verifyBytes(new Uint8Array(await response.arrayBuffer()), proof, name);
            try { await cache?.put(url, new Response(bytes)); } catch (_) { /* memory only */ }
        }
        cancelled(signal);
        files[name] = bytes;
        if (name === 'LICENSE' || name === 'RUNTIME-NOTICES.txt' || name.startsWith('licenses/')) {
            notices.push(decoder.decode(bytes)); onNotice(notices.join('\n\n'));
        }
    }
    return {project, files, manifest: JSON.parse(decoder.decode(files['brickwright-media.json'])),
        mediaCommit};
}

const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

async function runSlices(machine, {signal, max, terminated, step, snapshot, onProgress}) {
    const start = machine.cpu.cycles;
    let steps = 0;
    while (!terminated() && steps < max) {
        cancelled(signal);
        for (let slice = 0; slice < 5000 && !terminated() && steps < max; slice++, steps++) {
            step();
            if (machine.cpu.shutdown) throw new Error('Native core shutdown');
        }
        onProgress({status: 'running', steps, retired: machine.cpu.cycles - start, ...snapshot()});
        await yieldToUI();
    }
    cancelled(signal);
    return {steps, retired: machine.cpu.cycles - start};
}

async function runRawBenchmark({manifest, program, machine, serial, signal, onProgress}) {
    const {loadAddress, entry, stack} = manifest;
    const end = loadAddress + program.length;
    if (manifest.format !== 'raw32' || ![loadAddress, entry, stack].every(Number.isSafeInteger) ||
        loadAddress < 0 || entry < loadAddress || entry >= end || stack <= end || stack > 0xa0000) {
        throw new Error('Raw 386 benchmark does not fit conventional RAM');
    }
    for (let i = 0; i < program.length; i++) machine._write386(loadAddress + i, program[i]);
    const cpu = machine.cpu;
    cpu.cr0 = 1;
    cpu.cs = 8;
    cpu.ss = cpu.ds = cpu.es = cpu.fs = cpu.gs = 16;
    for (let i = 0; i < 6; i++) {
        cpu.segmentCaches[i] = {base: 0, limit: 0xffffffff, default32: true, present: true,
            code: i === 1, readable: true, writable: i !== 1};
    }
    cpu.eip = entry;
    cpu.esp = stack;
    cpu.eflags = 2;
    const snapshot = () => ({stdout: serial.text, screen: []});
    const progress = await runSlices(machine, {signal, max: 10000000, terminated: () => cpu.halted,
        step: () => machine.step(), snapshot, onProgress});
    const accepted = cpu.halted && serial.text === manifest.expectedOutput;
    return {...progress, ...snapshot(), accepted, terminated: cpu.halted, exitCode: null, unsupported: [],
        status: accepted ? 'complete' : cpu.halted ? 'terminal-unqualified' : 'budget-exhausted'};
}

// Ordinary native stepping, same loader, devices, DOS bridge and terminal
// predicates as media-lab run.mjs. UI slices are not timing measurements.
export async function runNativeBenchmark (assets, {signal, onProgress = () => {}} = {}) {
    const {project, files} = assets;
    if (!Object.hasOwn(catalog, project)) throw new Error('Unknown benchmark');
    const {manifest} = catalog[project];
    const raw = manifest.kind === 'native-i80386-raw';
    const imageName = raw ? manifest.slots.raw : manifest.slots.exe;
    const program = files[imageName];
    if (!program) throw new Error('Verified benchmark executable unavailable.');
    await verifyBytes(program, catalog[project].files[imageName], imageName);
    cancelled(signal);
    const {ExperimentalI80386ATMachine, PCAT80386_EXPERIMENTAL} =
        await import(/* webpackChunkName: "bw-board-i80386" */ 'bw-board/experimental/i80386-at-machine.js');
    cancelled(signal);
    const identity = {backend: 'ExperimentalI80386ATMachine', mediaCommit: assets.mediaCommit,
        imageSha256: catalog[project].files[imageName].sha256};
    if (raw) {
        const serial = {text: ''};
        const machine = new ExperimentalI80386ATMachine(PCAT80386_EXPERIMENTAL, {onSerial: byte => {
            if (serial.text.length < 4096) serial.text += String.fromCharCode(byte);
        }});
        machine.cpu.reset();
        return {...identity, ...await runRawBenchmark({manifest, program, machine, serial, signal, onProgress})};
    }
    const {createDos8086, trapRegion} =
        await import(/* webpackChunkName: "bw-native-benchmark-dos" */ 'bw-board/i8086-dos.js');
    cancelled(signal);
    const machine = new ExperimentalI80386ATMachine({...PCAT80386_EXPERIMENTAL,
        regions: [...PCAT80386_EXPERIMENTAL.regions, trapRegion()]});
    machine.cpu.reset();
    const dos = createDos8086(machine, {files: new Map(Object.entries(manifest.mount || {})
        .map(([name, file]) => [name, files[file]]))}).install();
    initializeNativeDosClock(machine);
    const bridge = adaptNativeDosService(machine, dos);
    dos.loadExe(program, {at: 0x0800, args: manifest.program.args || ''});
    bridge.syncSegments();
    const progress = await runSlices(machine, {signal, max: project === 'whetstone' ? 30000000 : 20000000,
        terminated: () => dos.terminated, step: () => dos.step(),
        snapshot: () => ({stdout: dos.stdout, screen: dos.screenText()}), onProgress});
    const report = dos.report();
    const output = collectBenchmarkOutput(manifest, dos.stdout, dos.screenText());
    const videoQueriesValid = !manifest.nativeVideoQueryContract || validateNativeCgaQueries(bridge.handled);
    const whetstone = project === 'whetstone' ? whetstoneResult(dos.stdout) : null;
    const accepted = dos.terminated && manifest.expectedExitCodes.includes(dos.exitCode) &&
        !report.stdoutTruncated && !report.unsupported.length && videoQueriesValid &&
        (manifest.resultOutput !== 'screen' || output.scoresValid) && (!whetstone || whetstone.valid) &&
        manifest.expect.every(text => output.text.includes(text));
    return {status: accepted ? 'complete' : dos.terminated ? 'terminal-unqualified' : 'budget-exhausted',
        ...identity, ...progress, accepted, exitCode: dos.exitCode, terminated: dos.terminated,
        stdout: dos.stdout, screen: dos.screenText(), unsupported: report.unsupported, videoQueriesValid, whetstone};
}
