// SPDX-License-Identifier: BSD-3-Clause
// The actual saved Scout, electrical solver, public CAD controller and shipped
// physics worker. Only browser event/Worker plumbing is adapted for Node.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import {BoardImpl} from 'bw-board/board.js';
import {inferNetlist, checkWiring} from 'bw-board/infer-netlist.js';
import {getDevice} from 'bw-board/devices.js';
import {registerAllDevices} from 'bw-board/register-all.js';
import {Circuit} from 'bw-circuit-ui/model/circuit.js';
import {setEngine} from 'bw-circuit-ui/engine.js';
import {createCrispBasicRunner} from '../../overlay/scratch-gui/src/lib/crispbasic-runner.js';
import {createWasmSession, SimulationError} from '../../packages/crisp-basic/browser.mjs';

registerAllDevices();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice});

export const CRISPBASIC_CAD_PROJECT = new URL('../../overlay/scratch-gui/static/circuit-cad/scout-encoder.sb3', import.meta.url);
export const CRISPBASIC_CAD_SOURCE = new URL('../../packages/crisp-basic/examples/cad-robot/source.bas', import.meta.url);
const wasmModuleURL = new URL('../../packages/crisp-basic/.build/wasm/crispbasic.mjs', import.meta.url);
const runtimeBaseURL = new URL('../../packages/crisp-basic/', import.meta.url);
const adapterURL = new URL('./cad-worker-node-adapter.mjs', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadCrispBasicCadExample() {
    const archive = await JSZip.loadAsync(await readFile(CRISPBASIC_CAD_PROJECT));
    const document = JSON.parse(await archive.file('brickwright/cad.json').async('string'));
    const {state} = JSON.parse(await archive.file('brickwright/state.json').async('string'));
    return {document, circuit: state.circuit, connections: state.cadCircuit,
        source: await readFile(CRISPBASIC_CAD_SOURCE, 'utf8')};
}

export async function createCrispBasicCadFixture({swapMotorLeads = false, onCommand = () => {}, onEvent = () => {}} = {}) {
    const example = await loadCrispBasicCadExample();
    if (swapMotorLeads) for (const wire of example.circuit.wires) {
        for (const end of [wire.from, wire.to]) {
            if (['left', 'right'].includes(end.part) && ['a', 'b'].includes(end.terminal)) end.terminal = end.terminal === 'a' ? 'b' : 'a';
        }
    }
    const model = Circuit.fromJSON(example.circuit);
    assert.equal(model.netlistError, null, 'the saved Scout circuit must be accepted');
    assert.equal(model.wires.length, example.circuit.wires.length, 'the saved Scout must retain every wire');
    const board = model.board;
    // Explicit developer override permits testing a freshly built SDK before
    // adoption. The normal qualification always reads the pinned shipped SDK.
    const sdkURL = process.env.CRISP_BASIC_TEST_CAD_SDK ?
        pathToFileURL(`${process.env.CRISP_BASIC_TEST_CAD_SDK.replace(/\/$/, '')}/`) :
        new URL('../../overlay/scratch-gui/static/cad-sdk/', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json', sdkURL), 'utf8'));
    assert.equal(manifest.format, 'brickwright-cad-sdk');
    assert.equal(manifest.dirty, false, 'the CAD SDK must come from clean committed source');
    for (const [name, expected] of Object.entries(manifest.files)) {
        assert.ok(!name.split('/').includes('..') && !name.startsWith('/'));
        assert.equal(digest(await readFile(new URL(name, sdkURL))), expected, `CAD SDK bytes changed: ${name}`);
    }
    const sdk = await import(new URL('sdk.js', sdkURL).href);
    assert.equal(typeof sdk.createSimulationController, 'function', 'the shipped SDK must expose its public clock controller');
    const wasmURL = `data:application/wasm;base64,${(await readFile(new URL(manifest.wasm, sdkURL))).toString('base64')}`;
    const originals = new Map(['document', 'window', 'Worker', 'localStorage', '__bwCad'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const commands = [], workers = new Set(), terminated = [];
    class BrowserWorker {
        constructor(url) {
            this.ready = false;
            this.queue = [];
            this.worker = new Worker(adapterURL, {workerData: {workerURL: String(url)}});
            workers.add(this);
            this.worker.on('message', message => {
                if (message.ready) {
                    this.ready = true;
                    for (const command of this.queue.splice(0)) this.send(command);
                } else this.onmessage?.({data: message});
            });
            this.worker.on('error', error => this.onerror?.({message: error.message}));
        }
        send(command) {
            this.worker.postMessage(command);
            const observed = {op: command.op, request: command.request,
                ...(command.impulses ? {impulses: structuredClone(command.impulses)} : {})};
            commands.push(observed);
            onCommand(observed);
        }
        postMessage(command) {if (this.ready) this.send(command);else this.queue.push(command);}
        terminate() {
            this.queue.length = 0;
            if (workers.delete(this)) terminated.push(this.worker.terminate());
        }
    }
    const eventTarget = new EventTarget();
    Object.assign(globalThis, {
        document: Object.assign(new EventTarget(), {hidden: false, baseURI: sdkURL.href}),
        window: eventTarget,
        Worker: BrowserWorker,
        localStorage: {getItem: key => key === 'bw-cad-circuit-bindings' ? JSON.stringify(example.connections) : null}
    });
    const cadSession = sdk.createCadSession(example.document);
    const frames = [];
    const controller = sdk.createSimulationController(cadSession, wasmURL, async () => {}, () => {}, frame => {
        if (frame) frames.push(structuredClone(frame));
    });
    globalThis.__bwCad = {editor: {session: cadSession, simulation: controller}};
    const runtime = Object.assign(new EventEmitter(), {circuitBoard: board, circuitModel: model, threads: [], cadSimulation: controller});
    eventTarget.addEventListener('bw-circuit-clock-owner', event => event.detail.board && event.detail.ready());
    const runner = createCrispBasicRunner({circuit: {runtime, eventTarget, cad: true},
        assetBaseURL: runtimeBaseURL.href, timeoutMs: 60000, onEvent,
        loadRuntime: async () => ({SimulationError, createWasmSession: options => createWasmSession({...options, moduleURL: wasmModuleURL})})});
    return {board, model, runtime, runner, controller, cadSession, frames, commands, source: example.source,
        sdkCommit: manifest.commit,
        async dispose() {
            try {await runner.dispose();}
            finally {
                controller.dispose();cadSession.dispose();
                for (const worker of [...workers]) worker.terminate();
                await Promise.allSettled(terminated);
                for (const [key, descriptor] of originals) {
                    if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key];
                }
            }
        }};
}
