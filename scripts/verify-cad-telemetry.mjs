// SPDX-License-Identifier: BSD-3-Clause
// Exercise the exact shipped CAD/Jolt worker locally, without a browser/compiler.
// Usage: node scripts/verify-cad-telemetry.mjs [output.json]
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Worker} from 'node:worker_threads';
import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
const sdk = resolve(root, 'overlay/scratch-gui/static/cad-sdk');
const projectPath = resolve(root, 'overlay/scratch-gui/static/circuit-cad/scout-encoder.sb3');
const output = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'artifacts/circuit-cad/telemetry-qualification.json');
const adapterURL = new URL('./lib/cad-worker-node-adapter.mjs', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(resolve(sdk, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.format, 'brickwright-cad-sdk', 'Invalid CAD SDK manifest');
assert.equal(manifest.dirty, false, 'CAD SDK must come from a clean source tree');

function sdkPath(file) {
    assert.ok(typeof file === 'string' && !isAbsolute(file) && !file.split(/[\\/]/).includes('..'), 'Invalid SDK file path');
    return resolve(sdk, file);
}

async function verifySDK() {
    assert.equal(hash(await readFile(resolve(sdk, 'manifest.json'))), hash(manifestBytes), 'SDK manifest changed');
    for (const [file, digest] of Object.entries(manifest.files)) {
        assert.equal(hash(await readFile(sdkPath(file))), digest, `SDK bytes changed: ${file}`);
    }
}

await verifySDK();
const workerPaths = Object.keys(manifest.files).filter(path => /^assets\/simulation\.worker-.*\.js$/.test(path));
assert.equal(workerPaths.length, 1, 'Expected exactly one shipped simulation worker');
assert.ok(Object.hasOwn(manifest.files, manifest.wasm), 'SDK WASM must be covered by the manifest');
const projectBytes = await readFile(projectPath);
const zip = await JSZip.loadAsync(projectBytes);
const cadEntry = zip.file('brickwright/cad.json');
assert.ok(cadEntry, 'Scout project has no CAD document');
const source = await cadEntry.async('string');
const document = JSON.parse(source);
const sourceBefore = JSON.stringify(document);
const wasmURL = 'data:application/wasm;base64,' + (await readFile(sdkPath(manifest.wasm))).toString('base64');

const receipt = {
    recordedAt: new Date().toISOString(),
    sdkCommit: manifest.commit,
    sdkDirty: manifest.dirty,
    sdkManifestSha256: hash(manifestBytes),
    sdkFilesVerified: Object.keys(manifest.files).length,
    sdkFiles: manifest.files,
    scoutProjectSha256: hash(projectBytes),
    cadSourceSha256: hash(source),
    verificationScriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    adapterSha256: hash(await readFile(adapterURL)),
    runtime: `Node ${process.version}`,
    adapter: 'Node worker_threads supplies self, postMessage and browser Emscripten global detection; production worker, geometry, Jolt and SDK bytes unchanged',
    limitations: [
        'Worker-level qualification of the shipped CAD simulation and release Jolt WASM; no browser or UI claim.',
        'No mounted editor, public-controller history/display/lease lifecycle or full Lite application exercised.',
        'Direct mechanical impulses with a body ray, not circuit electronics or compiled firmware.',
        'Diagnostic elapsed times are not a controlled performance benchmark.'
    ],
    passed: false
};

const worker = new Worker(adapterURL, {workerData: {workerURL: pathToFileURL(sdkPath(workerPaths[0])).href}});
let sequence = 0;
let closing = false;
let resolveReady;
let rejectReady;
const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
const pending = new Map();
const readyTimeout = setTimeout(() => fail(new Error('Worker initialization timed out')), 10000);

function fail(error) {
    clearTimeout(readyTimeout);
    rejectReady(error);
    for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(error);
    }
    pending.clear();
}

worker.on('message', message => {
    if (message.ready) {
        clearTimeout(readyTimeout);
        resolveReady();
        return;
    }
    const entry = pending.get(message.request);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.request);
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve(message.frame);
});
worker.on('error', fail);
worker.on('exit', code => {
    if (!closing) fail(new Error(`Simulation worker exited unexpectedly (${code})`));
});

function send(command) {
    return new Promise((resolve, reject) => {
        const request = ++sequence;
        const timer = setTimeout(() => {
            pending.delete(request);
            reject(new Error(`Worker command timed out: ${command.op}`));
        }, command.op === 'start' ? 90000 : 10000);
        pending.set(request, {resolve, reject, timer});
        try {
            worker.postMessage({...command, request});
        } catch (error) {
            clearTimeout(timer);
            pending.delete(request);
            reject(error);
        }
    });
}

const telemetry = sample => ({
    time: sample.time,
    angles: sample.angles,
    speeds: sample.speeds,
    linearPositions: sample.linearPositions,
    linearSpeeds: sample.linearSpeeds,
    distances: sample.distances
});
const rays = [{id: 'downward', bodyId: 'chassis', originMm: [0, 0, 20], direction: [0, 0, -1], rangeMm: 1000}];
const impulses = index => [
    {id: 'drive-a', impulse: index < 40 ? .0001 : index < 60 ? 0 : .00008},
    {id: 'drive-b', impulse: index < 40 ? .0001 : index < 60 ? 0 : -.00008}
];
const start = () => send({op: 'start', document, wasmURL, fixBase: false, locale: 'en'});
const progress = stage => { receipt.stage = stage; console.log(stage); };

try {
    const began = performance.now();
    await ready;
    const runs = {};
    for (const mode of ['full', 'compact']) {
        progress(`${mode}: starting shipped worker physics`);
        const initial = await start();
        assert.equal(initial.time, 0);
        const samples = [];
        let fullReplies = 0;
        let compactReplies = 0;
        let totalBytes = 0;
        const beganRun = performance.now();
        for (let index = 0; index < 100; index++) {
            const compact = mode === 'compact' && index % 4 !== 3;
            const sample = await send({op: 'actuator-step', impulses: impulses(index), rays, servos: [], ...(compact ? {telemetryOnly: true} : {})});
            assert.ok(Math.abs(sample.time - (index + 1) * .005) < 1e-12, 'Changed 5 ms physics cadence');
            assert.ok(Object.values(sample.angles).every(Number.isFinite), 'Nonfinite hinge angle');
            assert.ok(Object.values(sample.speeds).every(Number.isFinite), 'Nonfinite hinge speed');
            if (compact) {
                compactReplies++;
                assert.ok(!('poses' in sample), 'Compact reply contains body poses');
            } else {
                fullReplies++;
                assert.equal(sample.poses.length, initial.poses.length, 'Full reply is missing body poses');
            }
            samples.push(sample);
            totalBytes += Buffer.byteLength(JSON.stringify(sample));
            if (index % 25 === 24) progress(`${mode}: ${index + 1}/100`);
        }
        runs[mode] = {initial, samples, fullReplies, compactReplies, totalBytes, elapsedMs: performance.now() - beganRun};
    }

    progress('comparing exact feedback');
    assert.deepEqual(runs.full.initial, runs.compact.initial, 'Fresh initial frames differ');
    for (let index = 0; index < 100; index++) {
        assert.deepEqual(telemetry(runs.full.samples[index]), telemetry(runs.compact.samples[index]), `Telemetry differs at step ${index + 1}`);
        if (index % 4 === 3) assert.deepEqual(runs.full.samples[index], runs.compact.samples[index], `Complete poses differ at step ${index + 1}`);
    }
    const final = runs.compact.samples.at(-1);
    assert.deepEqual(runs.full.samples.at(-1), final, 'Final physical state differs');
    assert.ok(runs.compact.totalBytes < runs.full.totalBytes, 'Compact replies did not reduce serialized feedback');
    assert.deepEqual(await send({op: 'stop-motors'}), final, 'Stop changed physical state without stepping');
    assert.deepEqual(await send({op: 'sense', rays}), final, 'Sense changed physical state');
    await assert.rejects(send({op: 'actuator-step', impulses: [{id: 'drive-a', impulse: Infinity}], telemetryOnly: true}), /Invalid actuator impulse/);
    assert.equal((await send({op: 'sense', rays})).time, final.time, 'Rejected input advanced physics');
    const reset = await start();
    assert.deepEqual(reset, runs.full.initial, 'Restart initial frame differs');
    assert.deepEqual(await send({op: 'actuator-step', impulses: impulses(0), rays, servos: []}), runs.full.samples[0], 'Restart first step differs');
    assert.equal(JSON.stringify(document), sourceBefore, 'Input document changed');
    assert.equal(hash(await readFile(projectPath)), receipt.scoutProjectSha256, 'Scout project bytes changed');
    await verifySDK();

    const firstPosition = reset.poses.find(pose => pose.id === 'chassis').positionMm;
    const finalPosition = final.poses.find(pose => pose.id === 'chassis').positionMm;
    receipt.result = {
        stepsPerComparisonRun: 100, stepSeconds: .005, physicsHz: 200,
        renderedBodyPoses: final.poses.length,
        exactMatchingTelemetrySamples: 100, exactMatchingCompletePoseFrames: 25,
        finalTime: final.time, finalAngles: final.angles, finalSpeeds: final.speeds, finalDistances: final.distances,
        chassisStartMm: firstPosition, chassisEndMm: finalPosition,
        chassisDisplacementMm: Math.hypot(...finalPosition.map((value, index) => value - firstPosition[index])),
        traffic: {
            measurement: 'UTF-8 JSON bytes of reply frames, excluding the request envelope',
            full: {fullReplies: runs.full.fullReplies, compactReplies: runs.full.compactReplies, bytes: runs.full.totalBytes},
            compact: {fullReplies: runs.compact.fullReplies, compactReplies: runs.compact.compactReplies, bytes: runs.compact.totalBytes},
            payloadReduction: 1 - runs.compact.totalBytes / runs.full.totalBytes
        },
        stopPreservesTimeAndPoses: true, sensePreservesTimeAndPoses: true,
        invalidInputDoesNotAdvance: true, restartInitialAndFirstFrameExact: true,
        inputSourceUnchanged: true, scoutProjectUnchanged: true, sdkBytesUnchanged: true,
        timing: {elapsedMs: performance.now() - began, fullRunMs: runs.full.elapsedMs, compactRunMs: runs.compact.elapsedMs, performanceClaim: false}
    };
    receipt.passed = true;
    progress('complete');
} catch (error) {
    receipt.error = error.stack || String(error);
    console.error(receipt.error);
    process.exitCode = 1;
} finally {
    closing = true;
    clearTimeout(readyTimeout);
    for (const entry of pending.values()) clearTimeout(entry.timer);
    await worker.terminate();
    await mkdir(dirname(output), {recursive: true});
    await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({passed: receipt.passed, receipt: output}));
}
