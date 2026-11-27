import {prepareSource, SourceError} from './source.mjs';
import {WASM_BACKEND, WASM_CAPABILITIES} from './wasm-capabilities.mjs';
import {createSimulationHost, SimulationError} from './simulation-host.mjs';
import {
    DEFAULT_SIMULATION_REQUESTS, MAX_SIMULATION_REQUESTS, SIMULATION_MODES,
    SIMULATION_ERROR_CODES, SIMULATION_LIMIT_CODES, validSimulationRequest, validSimulationValue
} from './simulation-protocol.mjs';

const DEFAULT_MODULE_URL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const DEFAULT_WORKER_URL = new URL('./wasm-worker.mjs', import.meta.url);
const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 16 * 1024;
// Never transfer ownership of a used host, even between independent sessions.
// Weak membership does not retain finished hosts or their trace buffers.
const ownedSimulationHosts = new WeakSet();
let lastRunId = 0;

function simulationOptions(value) {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('simulation must be an options object');
    }
    if (Object.keys(value).some(key => !['createHost', 'maxRequests'].includes(key))) {
        throw new TypeError('Unknown simulation option; use createHost and maxRequests');
    }
    const {createHost = () => createSimulationHost(), maxRequests = DEFAULT_SIMULATION_REQUESTS} = value;
    if (typeof createHost !== 'function') throw new TypeError('simulation.createHost must be a synchronous function');
    if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > MAX_SIMULATION_REQUESTS) {
        throw new RangeError(`simulation.maxRequests must be an integer from 1 to ${MAX_SIMULATION_REQUESTS}`);
    }
    return Object.freeze({createHost, maxRequests});
}

function positiveInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0x7fffffff) {
        throw new RangeError(`${name} must be an integer from 1 to 2147483647`);
    }
    return value;
}

function asURL(value, name) {
    if (!(value instanceof URL) && (typeof value !== 'string' || !value || value.includes('\0'))) {
        throw new TypeError(`${name} must be a URL or nonempty URL string`);
    }
    return new URL(value, import.meta.url).href;
}

function inputBytes(input) {
    if (input instanceof Uint8Array) return input.slice();
    if (typeof input !== 'string') throw new TypeError('input must be a string or Uint8Array');
    const bytes = new Uint8Array(input.length);
    for (let index = 0; index < input.length; index++) {
        const code = input.charCodeAt(index);
        if (code > 255) throw new TypeError('WASM input strings must contain only Latin-1 characters; use Uint8Array for bytes');
        bytes[index] = code;
    }
    return bytes;
}

function latin1(bytes) {
    const chunks = [];
    // TextDecoder('latin1') uses Windows-1252 for bytes 0x80..0x9f. Raw VDU
    // text must instead preserve every byte's corresponding code point.
    for (let index = 0; index < bytes.length; index += 8192) {
        chunks.push(String.fromCharCode(...bytes.subarray(index, index + 8192)));
    }
    return chunks.join('');
}

function concatenate(chunks, length) {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}

function hostError(message) { return {kind: 'host', message}; }
function errorMessage(error) {
    try { return String(error?.message || error).slice(0, 4096); }
    catch { return 'Unprintable host error'; }
}
function simulationFailureCode(error) {
    try { return error instanceof SimulationError ? error.code : null; }
    catch { return null; }
}

async function createWorker(url) {
    // This import is never evaluated by a browser. The public browser entry
    // has no static dependency on Node's native process or filesystem modules.
    if (typeof process !== 'undefined' && process.versions?.node) {
        const {Worker} = await import('node:worker_threads');
        const worker = new Worker(new URL(url), {type: 'module', execArgv: []});
        return {
            post: message => worker.postMessage(message),
            terminate: () => worker.terminate(),
            listen(message, error, exit) {
                worker.on('message', message);
                worker.on('error', error);
                worker.on('exit', exit);
                return () => {
                    worker.off('message', message);
                    worker.off('error', error);
                    worker.off('exit', exit);
                };
            }
        };
    }
    if (typeof Worker !== 'function') throw new Error('This environment does not provide module Workers');
    const worker = new Worker(url, {type: 'module', name: 'CrispBASIC'});
    return {
        post: message => worker.postMessage(message),
        terminate: () => worker.terminate(),
        listen(message, error) {
            const onMessage = event => message(event.data);
            const onError = event => {
                event.preventDefault();
                error(new Error(event.message || 'CrispBASIC worker failed'));
            };
            const onMessageError = () => error(new Error('Cannot decode a CrispBASIC worker message'));
            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);
            worker.addEventListener('messageerror', onMessageError);
            return () => {
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
                worker.removeEventListener('messageerror', onMessageError);
            };
        }
    };
}

/** One dedicated worker and one fresh WASM instance per run. Hard termination
 * belongs to the parent, so limits also cover a blocked read or tight C loop.
 * moduleURL/workerURL select trusted application assets, never BASIC input.
 */
export class WasmSession {
    #state = 'idle';
    #active = null;
    #disposed = false;
    #options;
    #capabilities;

    constructor({moduleURL = DEFAULT_MODULE_URL, workerURL = DEFAULT_WORKER_URL,
        timeoutMs = 5000, maxOutputBytes = 1024 * 1024, onEvent, simulation} = {}) {
        if (onEvent !== undefined && typeof onEvent !== 'function') throw new TypeError('onEvent must be a function');
        this.#options = {
            moduleURL: asURL(moduleURL, 'moduleURL'),
            workerURL: asURL(workerURL, 'workerURL'),
            timeoutMs: positiveInteger(timeoutMs, 'timeoutMs'),
            maxOutputBytes: positiveInteger(maxOutputBytes, 'maxOutputBytes'),
            onEvent, simulation: simulationOptions(simulation)
        };
        this.#capabilities = this.#options.simulation ? Object.freeze({...WASM_CAPABILITIES,
            simulation: Object.freeze({...WASM_CAPABILITIES.simulation, enabled: true, basicBridge: true,
                maxRequests: this.#options.simulation.maxRequests})
        }) : WASM_CAPABILITIES;
    }

    get state() { return this.#state; }
    get capabilities() { return this.#capabilities; }

    #emit(event, active) {
        try { this.#options.onEvent?.(event); }
        catch (error) {
            if (active && event.type !== 'result') {
                this.#stop(active, 'host-error', hostError(`Event callback failed: ${errorMessage(error)}`));
            }
        }
    }

    #stop(active, status, error) {
        if (active.reason || active.terminal) return;
        active.reason = {status, error};
        active.simulationController?.abort();
        active.finish?.();
    }

    run(source, {filename = 'main.bas', input = '', interactive = false,
        timeoutMs = this.#options.timeoutMs, maxOutputBytes = this.#options.maxOutputBytes,
        signal} = {}) {
        let prepared, bytes;
        try {
            if (this.#disposed) throw new Error('CrispBASIC session is disposed');
            if (this.#active) throw new Error('CrispBASIC session is already running');
            prepared = prepareSource(source, {filename});
            if (prepared.numberedSource.length > MAX_SOURCE_BYTES) {
                throw new SourceError('prepared source exceeds the 4 MiB limit', {code: 'source-too-large', filename});
            }
            positiveInteger(timeoutMs, 'timeoutMs');
            positiveInteger(maxOutputBytes, 'maxOutputBytes');
            if (typeof interactive !== 'boolean') throw new TypeError('interactive must be a boolean');
            if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError('signal must be an AbortSignal');
            bytes = inputBytes(input);
            if (bytes.length > MAX_INPUT_BYTES) throw new RangeError('input exceeds the 1 MiB per-run limit');
            if (lastRunId === Number.MAX_SAFE_INTEGER) throw new Error('CrispBASIC run identifiers exhausted');
        } catch (error) { return Promise.reject(error); }

        const active = {
            worker: null, sentStart: false, reason: null, terminal: null, finish: null,
            interactive, inputEnded: !interactive, inputBytes: bytes.length,
            inputQueue: bytes.length ? [bytes] : [], started: performance.now(), done: null,
            runId: ++lastRunId, simulationHost: null, simulationMethods: null,
            simulationController: this.#options.simulation ? new AbortController() : null,
            simulationRequests: 0, simulationPending: null
        };
        this.#active = active;
        this.#state = 'running';
        active.done = Promise.resolve().then(() =>
            this.#execute(active, prepared, {timeoutMs, maxOutputBytes, signal})
        ).then(result => {
            if (this.#active === active) this.#active = null;
            this.#state = this.#disposed ? 'disposed' : 'idle';
            this.#emit({type: 'state', state: this.#state});
            this.#emit({type: 'result', result});
            return result;
        });
        this.#emit({type: 'state', state: 'running'}, active);
        return active.done;
    }

    writeInput(input) {
        const active = this.#active;
        if (!active || !active.interactive || active.inputEnded || active.reason || active.terminal) {
            throw new Error('No interactive CrispBASIC input stream is open');
        }
        const bytes = inputBytes(input);
        if (active.inputBytes + bytes.length > MAX_INPUT_BYTES) throw new RangeError('input exceeds the 1 MiB per-run limit');
        active.inputBytes += bytes.length;
        if (active.sentStart) active.worker.post({type: 'input', bytes});
        else active.inputQueue.push(bytes);
        // Input is copied into a bounded message queue, with no stream
        // backpressure. The cumulative per-run byte limit is enforced here.
        return true;
    }

    endInput() {
        const active = this.#active;
        if (!active || active.inputEnded || active.reason || active.terminal) return;
        active.inputEnded = true;
        if (active.sentStart) active.worker.post({type: 'end-input'});
    }

    cancel() {
        if (!this.#active || this.#active.reason || this.#active.terminal) return false;
        this.#stop(this.#active, 'cancelled');
        return true;
    }

    async reset() {
        if (this.#disposed) throw new Error('CrispBASIC session is disposed');
        const active = this.#active;
        if (active) {
            this.#stop(active, 'cancelled');
            await active.done;
        }
    }

    async dispose() {
        if (this.#disposed) { await this.#active?.done; return; }
        this.#disposed = true;
        const active = this.#active;
        if (active) {
            this.#stop(active, 'cancelled');
            await active.done;
        }
        this.#state = 'disposed';
    }

    #createSimulation(active) {
        const options = this.#options.simulation;
        if (!options) return;
        const host = options.createHost(Object.freeze({signal: active.simulationController.signal, runId: active.runId}));
        if (!host || typeof host !== 'object' || typeof host.then === 'function') {
            // A rejected async factory must not create an unhandled rejection.
            if (host && typeof host.then === 'function') Promise.resolve(host).catch(() => {});
            throw new TypeError('simulation.createHost must synchronously return a fresh simulation host');
        }
        if (ownedSimulationHosts.has(host)) throw new Error('Simulation host is already owned by a run; return a fresh host');
        ownedSimulationHosts.add(host);
        active.simulationHost = host;
        const methods = {};
        for (const name of ['pinMode', 'digitalWrite', 'digitalRead', 'delay', 'millis', 'dispose']) {
            if (typeof host[name] !== 'function') throw new TypeError(`Simulation host requires ${name}()`);
            methods[name] = host[name].bind(host);
        }
        if (host.state === 'disposed') throw new Error('Simulation host is already disposed');
        active.simulationMethods = methods;
    }

    #simulationRequest(active, event, fail) {
        if (!this.#options.simulation || !active.simulationMethods || active.simulationPending ||
                !validSimulationRequest(event, active.runId, active.simulationRequests + 1)) {
            fail('Malformed, concurrent, or unowned simulation request');
            return;
        }
        if (active.simulationRequests === this.#options.simulation.maxRequests) {
            this.#stop(active, 'simulation-limit', {kind: 'simulation', code: 'request-limit',
                message: 'Simulation request limit reached'});
            return;
        }
        active.simulationRequests++;
        const pending = {requestId: event.requestId};
        active.simulationPending = pending;
        const current = () => this.#active === active && !active.reason && !active.terminal &&
            active.simulationPending === pending && !active.simulationController.signal.aborted;
        const reply = body => {
            if (!current()) return;
            active.simulationPending = null;
            try {
                active.worker.post({version: 1, type: 'simulation-reply', runId: active.runId,
                    requestId: event.requestId, ...body});
            } catch (error) { fail(`Cannot reply to simulation request: ${errorMessage(error)}`); }
        };
        // A Promise boundary accommodates asynchronous board adapters while the
        // parent keeps its deadline and can abandon an uncooperative operation.
        Promise.resolve().then(() => {
            if (!current()) return;
            const host = active.simulationMethods;
            const [first, second] = event.args;
            switch (event.operation) {
            case 1: return host.pinMode(first, SIMULATION_MODES[second]);
            case 2: return host.digitalWrite(first, second);
            case 3: return host.digitalRead(first);
            case 4: return host.delay(first);
            case 5: return host.millis();
            }
        }).then(value => {
            if (!current()) return;
            const scalar = [1, 2, 4].includes(event.operation) && value === undefined ? 0 : value;
            if (!validSimulationValue(event.operation, scalar)) {
                fail('Simulation host returned an invalid result');
                return;
            }
            reply({ok: true, value: scalar});
        }).catch(error => {
            if (!current()) return;
            const code = simulationFailureCode(error);
            if (SIMULATION_LIMIT_CODES.includes(code)) {
                this.#stop(active, 'simulation-limit', {kind: 'simulation', code,
                    message: `Simulation ${code} reached`});
            } else if (SIMULATION_ERROR_CODES.includes(code)) {
                reply({ok: false, error: {code}});
            } else fail(`Simulation host failed: ${errorMessage(error)}`);
        });
    }

    async #execute(active, prepared, {timeoutMs, maxOutputBytes, signal}) {
        const output = [];
        let outputLength = 0, detach;
        const finished = new Promise(resolve => { active.finish = resolve; });
        const abort = () => this.#stop(active, 'cancelled');
        signal?.addEventListener('abort', abort, {once: true});
        if (signal?.aborted) abort();
        const remainingMs = Math.max(0, timeoutMs - (performance.now() - active.started));
        const timer = setTimeout(() => this.#stop(active, 'timeout'), remainingMs);
        const fail = message => this.#stop(active, 'host-error', hostError(message));

        const onMessage = event => {
            if (active.reason || active.terminal) return;
            if (!event || event.version !== 1) { fail('Unsupported WASM worker protocol'); return; }
            if (event.type === 'simulation-request') {
                this.#simulationRequest(active, event, fail);
            } else if (active.simulationPending) {
                fail('WASM worker continued while a simulation reply was pending');
            } else if (event.type === 'output' && event.bytes instanceof Uint8Array) {
                const remaining = maxOutputBytes - outputLength;
                const accepted = event.bytes.slice(0, remaining);
                if (accepted.length) {
                    output.push(accepted);
                    outputLength += accepted.length;
                    this.#emit({type: 'output', bytes: accepted.slice()}, active);
                }
                if (event.bytes.length > remaining) this.#stop(active, 'output-limit');
            } else if (event.type === 'input' && ['line', 'key'].includes(event.method)) {
                this.#emit({type: 'input', method: event.method}, active);
            } else if (event.type === 'result' && ['completed', 'error', 'output-limit', 'host-error'].includes(event.status)) {
                const validExit = event.exitCode === null || (Number.isInteger(event.exitCode) && event.exitCode >= 0 && event.exitCode <= 255);
                const validError = event.status !== 'error' || (event.error && Number.isInteger(event.error.code) &&
                    Number.isInteger(event.error.basicLine) && event.error.basicLine >= 0 && event.error.basicLine <= 65279 &&
                    typeof event.error.message === 'string' && event.error.message.length <= 4096);
                const validHostError = event.status !== 'host-error' || (event.error && typeof event.error.message === 'string' && event.error.message.length <= 4096);
                if (!validExit || !validError || !validHostError || typeof event.diagnostics !== 'string' ||
                    event.diagnostics.length > MAX_DIAGNOSTIC_BYTES ||
                    (event.status === 'completed' && event.exitCode === null)) {
                    fail('Malformed WASM completion record');
                    return;
                }
                active.terminal = event;
                active.finish();
            } else fail('Unexpected WASM worker record');
        };

        try {
            if (!active.reason) {
                this.#createSimulation(active);
            }
            if (!active.reason) {
                active.worker = await createWorker(this.#options.workerURL);
                detach = active.worker.listen(onMessage,
                    error => fail(`WASM worker failed: ${errorMessage(error)}`),
                    code => fail(`WASM worker exited without a completion record (exit ${code})`));
                if (!active.reason) {
                    active.worker.post({type: 'start', version: 1, moduleURL: this.#options.moduleURL,
                        runId: active.runId, simulationEnabled: Boolean(this.#options.simulation),
                        source: prepared.numberedSource,
                        input: concatenate(active.inputQueue, active.inputBytes),
                        inputEnded: active.inputEnded, maxOutputBytes});
                    active.inputQueue = [];
                    active.sentStart = true;
                    await finished;
                }
            }
        } catch (error) { fail(`Cannot run WASM backend: ${errorMessage(error)}`); }
        finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            active.simulationController?.abort();
            active.simulationPending = null;
            // Node's terminate() resolves only after the thread is gone.
            // Browser terminate() is synchronous. Both happen before run(),
            // reset() or dispose() resolves, and before any next run begins.
            if (active.worker) {
                try { await active.worker.terminate(); }
                catch (error) {
                    active.reason = {status: 'host-error', error: hostError(`Cannot terminate WASM worker: ${errorMessage(error)}`)};
                }
            }
            detach?.();
            if (active.simulationHost) {
                try {
                    const cleanup = active.simulationMethods?.dispose ??
                        (typeof active.simulationHost.dispose === 'function' ? active.simulationHost.dispose.bind(active.simulationHost) : null);
                    const result = cleanup?.();
                    if (result && typeof result.then === 'function') {
                        Promise.resolve(result).catch(() => {});
                        throw new TypeError('Simulation host dispose() must be synchronous');
                    }
                } catch (error) {
                    active.reason = {status: 'host-error', error: hostError(`Cannot dispose simulation host: ${errorMessage(error)}`)};
                }
            }
        }

        const status = active.reason?.status ?? active.terminal?.status ?? 'host-error';
        let error = active.reason?.error ?? active.terminal?.error;
        if (status === 'error' && error) {
            error = {...error, kind: 'basic', line: prepared.sourceMap[error.basicLine] ?? null, filename: prepared.filename};
            const simulationCode = SIMULATION_ERROR_CODES[error.code - 201];
            if (this.#options.simulation && simulationCode && error.message.startsWith(`Simulation ${simulationCode}:`)) {
                error.simulationCode = simulationCode;
            }
        } else if (status === 'host-error') error = hostError(error?.message || 'WASM backend did not report completion');
        const bytes = concatenate(output, outputLength);
        return {
            status, backend: WASM_BACKEND, output: bytes, text: latin1(bytes),
            ...(error ? {error} : {}), diagnostics: active.terminal?.diagnostics ?? '',
            exitCode: active.terminal?.exitCode ?? null, signal: null,
            durationMs: Math.round(performance.now() - active.started)
        };
    }
}

export function createWasmSession(options) { return new WasmSession(options); }
