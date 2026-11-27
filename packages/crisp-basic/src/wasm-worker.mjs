// Worker-owned runtime. BASIC has access only to the callbacks supplied below;
// it never receives JavaScript source evaluation, fetch, or Node facilities.
import {
    SIMULATION_ABI, validRunId, validSimulationArguments, validSimulationReply, simulationErrorNumber
} from './simulation-protocol.mjs';
const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
const port = isNode ? (await import('node:worker_threads')).parentPort : null;
const send = (message, transfer = []) => {
    const record = {version: 1, ...message};
    if (port) port.postMessage(record, transfer);
    else postMessage(record, transfer);
};

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 16 * 1024;
function errorMessage(error) {
    try { return String(error?.message || error).slice(0, 4096); }
    catch { return 'Unprintable host error'; }
}
let started = false, completed = false, ended = true, inputTotal = 0;
let chunks = [], chunkOffset = 0, waiting = null;
let simulationRunId = null, simulationEnabled = false, simulationSequence = 0, simulationWaiting = null;

function simulationRequest(operation, first, second) {
    if (completed) return Promise.reject(new Error('WASM worker has already completed'));
    if (!simulationEnabled) return Promise.resolve(-8); // Catchable unavailable operation.
    if (simulationWaiting || !validSimulationArguments(operation, [first, second]) ||
            simulationSequence === Number.MAX_SAFE_INTEGER) {
        return Promise.reject(new Error('Invalid or concurrent C/WASM simulation request'));
    }
    return new Promise((resolve, reject) => {
        const requestId = ++simulationSequence;
        simulationWaiting = {requestId, operation, resolve, reject};
        send({type: 'simulation-request', runId: simulationRunId, requestId, operation, args: [first, second]});
    });
}

function simulationReply(message) {
    const pending = simulationWaiting;
    if (!pending || !validSimulationReply(message, simulationRunId, pending.requestId, pending.operation)) {
        throw new Error('Malformed, stale, or unowned simulation reply');
    }
    simulationWaiting = null;
    pending.resolve(message.ok ? message.value : simulationErrorNumber(message.error.code));
}

function takeByte() {
    if (!chunks.length) return -1;
    const value = chunks[0][chunkOffset++];
    if (chunkOffset === chunks[0].length) { chunks.shift(); chunkOffset = 0; }
    return value;
}

function wakeInput() {
    if (!waiting || (!chunks.length && !ended)) return;
    const {resolve, timer} = waiting;
    waiting = null;
    clearTimeout(timer);
    resolve(takeByte());
}

function addInput(bytes) {
    if (!(bytes instanceof Uint8Array) || inputTotal + bytes.length > MAX_INPUT_BYTES) {
        throw new Error('Invalid or oversized WASM input');
    }
    inputTotal += bytes.length;
    if (bytes.length) chunks.push(bytes);
    wakeInput();
}

function readByte(waitMs) {
    if (completed) return Promise.reject(new Error('WASM worker has already completed'));
    if (chunks.length) return Promise.resolve(takeByte());
    if (ended || waitMs === 0) return Promise.resolve(-1);
    if (waiting) return Promise.reject(new Error('Concurrent WASM input reads are not supported'));
    return new Promise(resolve => {
        const pending = {resolve, timer: undefined};
        waiting = pending;
        if (waitMs >= 0) pending.timer = setTimeout(() => {
            if (waiting !== pending) return;
            waiting = null;
            resolve(-1);
        }, Math.min(waitMs, 0x7fffffff));
    });
}

async function execute(config) {
    let module, sourcePointer = 0, basicError = null, requestedExit = 0;
    let diagnostics = '', outputLength = 0, outputLimit = false;
    let output = new Uint8Array(1024), outputUsed = 0, lastFlush = -Infinity;
    const flush = () => {
        if (!outputUsed) return;
        const bytes = output.slice(0, outputUsed);
        outputUsed = 0;
        lastFlush = performance.now();
        send({type: 'output', bytes}, [bytes.buffer]);
    };
    const diagnostic = message => {
        const remaining = MAX_DIAGNOSTIC_BYTES - diagnostics.length;
        if (remaining > 0) diagnostics += (String(message) + '\n').slice(0, remaining);
    };
    const finish = (status, exitCode, error) => {
        if (completed) return;
        flush();
        completed = true;
        send({type: 'result', status, exitCode, diagnostics, ...(error ? {error} : {})});
    };

    try {
        if (config.version !== 1 || typeof config.moduleURL !== 'string' ||
            typeof config.source !== 'string' || config.source.length > MAX_SOURCE_BYTES ||
            !validRunId(config.runId) || typeof config.simulationEnabled !== 'boolean' ||
            typeof config.inputEnded !== 'boolean' || !Number.isInteger(config.maxOutputBytes) ||
            config.maxOutputBytes < 1 || config.maxOutputBytes > 0x7fffffff) {
            throw new Error('Invalid WASM start record');
        }
        ended = config.inputEnded;
        simulationRunId = config.runId;
        simulationEnabled = config.simulationEnabled;
        addInput(config.input);
        const moduleURL = new URL(config.moduleURL);
        const {default: factory} = await import(moduleURL.href);
        if (typeof factory !== 'function') throw new Error('WASM module does not export a factory; run npm run build:wasm');
        const options = {
            locateFile: path => new URL(path, moduleURL).href,
            print: diagnostic, printErr: diagnostic,
            crispHost: {
                output(byte) {
                    if (completed) throw new Error('WASM worker has already completed');
                    if (outputLength === config.maxOutputBytes) {
                        outputLimit = true;
                        flush();
                        throw new Error('CrispBASIC output limit reached');
                    }
                    output[outputUsed++] = byte & 255;
                    outputLength++;
                    // Batch high-volume output, but deliver an early text line
                    // promptly and flush all prompts before requesting input.
                    if (outputUsed === output.length || (byte === 10 && performance.now() - lastFlush >= 16)) flush();
                },
                inputEvent(method) {
                    if (completed) throw new Error('WASM worker has already completed');
                    flush();
                    send({type: 'input', method: method === 0 ? 'line' : 'key'});
                },
                readByte,
                simulationRequest(operation, first, second) {
                    flush();
                    return simulationRequest(operation, first, second);
                },
                now: () => performance.now(),
                runtimeError(code, message, basicLine) {
                    basicError = {code, message: String(message).slice(0, 4096), basicLine};
                },
                setExit(code) { requestedExit = code & 255; }
            }
        };
        // Node's fetch does not support file: URLs. Supplying the bytes keeps
        // the generated module identical in Node and a browser worker.
        if (isNode && moduleURL.protocol === 'file:') {
            const {readFile} = await import('node:fs/promises');
            options.wasmBinary = await readFile(new URL('./crispbasic.wasm', moduleURL));
        }
        module = await factory(options);
        if (completed) return;
        if (simulationEnabled && (typeof module._crisp_simulation_abi !== 'function' ||
                module._crisp_simulation_abi() !== SIMULATION_ABI)) {
            throw new Error('WASM module does not support simulation bridge version 1; rebuild and package CrispBASIC');
        }
        sourcePointer = module._malloc(config.source.length + 1);
        if (!sourcePointer) throw new Error('Cannot allocate WASM source buffer');
        for (let index = 0; index < config.source.length; index++) {
            module.HEAPU8[sourcePointer + index] = config.source.charCodeAt(index);
        }
        module.HEAPU8[sourcePointer + config.source.length] = 0;
        const exit = await module.ccall('crisp_run', 'number', ['number', 'number', 'number'],
            [sourcePointer, config.source.length, simulationEnabled ? 1 : 0], {async: true});
        if (!Number.isInteger(exit)) throw new Error('WASM host returned an invalid exit status');
        finish(basicError ? 'error' : 'completed', basicError ? 1 : (requestedExit || (exit & 255)), basicError);
    } catch (error) {
        finish(outputLimit ? 'output-limit' : 'host-error', null,
            outputLimit ? undefined : {kind: 'host', message: `WASM execution failed: ${errorMessage(error)}`.slice(0, 4096)});
    } finally {
        if (sourcePointer && module) {
            try { module._free(sourcePointer); } catch { /* A trapped instance is discarded by its parent. */ }
        }
    }
}

function receive(message) {
    if (completed) return;
    try {
        if (message?.type === 'start' && !started) {
            started = true;
            void execute(message);
        } else if (message?.type === 'input' && started && !ended) addInput(message.bytes);
        else if (message?.type === 'end-input' && started) { ended = true; wakeInput(); }
        else if (message?.type === 'simulation-reply' && started) simulationReply(message);
        else throw new Error('Unexpected WASM parent message');
    } catch (error) {
        completed = true;
        // Reject a suspended hook too; the parent still owns termination and
        // treats this protocol failure as a host outcome, never a BASIC error.
        if (simulationWaiting) {
            const pending = simulationWaiting;
            simulationWaiting = null;
            pending.reject(error);
        }
        send({type: 'result', status: 'host-error', exitCode: null, diagnostics: '',
            error: {kind: 'host', message: errorMessage(error)}});
    }
}

if (port) port.on('message', receive);
else addEventListener('message', event => receive(event.data));
