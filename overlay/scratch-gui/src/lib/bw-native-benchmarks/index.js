// Browser consumer of the owned media-lab native DOS startup protocol.
import catalog from './catalog.json';
import provenance from './provenance.json';
import {initializeNativeDosClock, adaptNativeDosService, validateNativeCgaQueries} from './native-dos.mjs';
import {collectBenchmarkOutput} from './benchmark-output.mjs';
import {whetstoneResult} from './whetstone-result.mjs';

export {catalog, provenance};
const base = `https://raw.githubusercontent.com/${provenance.repository}/${provenance.commit}/${provenance.base}/`;
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
    const files = {};
    for (const [name, proof] of Object.entries(catalog[project].files)) {
        cancelled(signal);
        const url = `${base}${project}/${name}`;
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
        if (name === 'LICENSE') onNotice(decoder.decode(bytes));
    }
    return {project, files, manifest: JSON.parse(decoder.decode(files['brickwright-media.json'])),
        mediaCommit: provenance.commit};
}

export async function acceptValidationImage (assets, bytes) {
    if (assets.project !== 'whetstone') throw new Error('Validation image belongs to Whetstone');
    await verifyBytes(bytes, catalog.whetstone.validationImage, 'Whetstone validation executable');
    return {...assets, validationImage: bytes};
}

const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));
// Ordinary native stepping, same loader, devices, DOS bridge and terminal
// predicates as media-lab run.mjs. UI slices are not timing measurements.
export async function runNativeBenchmark (assets, {signal, onProgress = () => {}} = {}) {
    const {project, manifest, files} = assets;
    if (!Object.hasOwn(catalog, project)) throw new Error('Unknown benchmark');
    const imageName = manifest.slots.exe;
    const program = project === 'whetstone' ? assets.validationImage : files[imageName];
    if (!program) throw new Error('Whetstone executable is not hosted in the pinned source package. Select the qualified validation build.');
    await verifyBytes(program, project === 'whetstone' ? catalog.whetstone.validationImage : catalog[project].files[imageName], imageName);
    cancelled(signal);
    const [{ExperimentalI80386ATMachine, PCAT80386_EXPERIMENTAL}, {createDos8086, trapRegion}] = await Promise.all([
        import(/* webpackChunkName: "bw-board-i80386" */ 'bw-board/experimental/i80386-at-machine.js'),
        import(/* webpackChunkName: "bw-native-benchmark-dos" */ 'bw-board/i8086-dos.js')
    ]);
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
    const start = machine.cpu.cycles;
    let steps = 0;
    const max = project === 'whetstone' ? 30000000 : 20000000;
    while (!dos.terminated && steps < max) {
        cancelled(signal);
        for (let slice = 0; slice < 5000 && !dos.terminated && steps < max; slice++, steps++) {
            dos.step();
            if (machine.cpu.shutdown) throw new Error('Native core shutdown');
        }
        onProgress({status: 'running', steps, retired: machine.cpu.cycles - start,
            stdout: dos.stdout, screen: dos.screenText()});
        await yieldToUI();
    }
    cancelled(signal);
    const report = dos.report();
    const output = collectBenchmarkOutput(manifest, dos.stdout, dos.screenText());
    const videoQueriesValid = !manifest.nativeVideoQueryContract || validateNativeCgaQueries(bridge.handled);
    const whetstone = project === 'whetstone' ? whetstoneResult(dos.stdout) : null;
    const accepted = dos.terminated && manifest.expectedExitCodes.includes(dos.exitCode) &&
        !report.stdoutTruncated && !report.unsupported.length && videoQueriesValid &&
        (manifest.resultOutput !== 'screen' || output.scoresValid) && (!whetstone || whetstone.valid) &&
        manifest.expect.every(text => output.text.includes(text));
    return {status: accepted ? 'complete' : dos.terminated ? 'terminal-unqualified' : 'budget-exhausted',
        accepted, backend: 'ExperimentalI80386ATMachine', mediaCommit: assets.mediaCommit,
        imageSha256: project === 'whetstone' ? catalog.whetstone.validationImage.sha256 : catalog[project].files[imageName].sha256,
        steps, retired: machine.cpu.cycles - start, exitCode: dos.exitCode, terminated: dos.terminated,
        stdout: dos.stdout, screen: dos.screenText(), unsupported: report.unsupported, videoQueriesValid, whetstone};
}
