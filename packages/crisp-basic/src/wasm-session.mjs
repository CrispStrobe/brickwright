import {prepareSource, SourceError} from './source.mjs';
import {WASM_BACKEND, WASM_CAPABILITIES} from './wasm-capabilities.mjs';

const DEFAULT_MODULE_URL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const DEFAULT_WORKER_URL = new URL('./wasm-worker.mjs', import.meta.url);
const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 16 * 1024;

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

    constructor({moduleURL = DEFAULT_MODULE_URL, workerURL = DEFAULT_WORKER_URL,
        timeoutMs = 5000, maxOutputBytes = 1024 * 1024, onEvent} = {}) {
        if (onEvent !== undefined && typeof onEvent !== 'function') throw new TypeError('onEvent must be a function');
        this.#options = {
            moduleURL: asURL(moduleURL, 'moduleURL'),
            workerURL: asURL(workerURL, 'workerURL'),
            timeoutMs: positiveInteger(timeoutMs, 'timeoutMs'),
            maxOutputBytes: positiveInteger(maxOutputBytes, 'maxOutputBytes'),
            onEvent
        };
    }

    get state() { return this.#state; }
    get capabilities() { return WASM_CAPABILITIES; }

    #emit(event, active) {
        try { this.#options.onEvent?.(event); }
        catch (error) {
            if (active && event.type !== 'result') {
                this.#stop(active, 'host-error', hostError(`Event callback failed: ${error?.message || error}`));
            }
        }
    }

    #stop(active, status, error) {
        if (active.reason || active.terminal) return;
        active.reason = {status, error};
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
        } catch (error) { return Promise.reject(error); }

        const active = {
            worker: null, sentStart: false, reason: null, terminal: null, finish: null,
            interactive, inputEnded: !interactive, inputBytes: bytes.length,
            inputQueue: bytes.length ? [bytes] : [], started: performance.now(), done: null
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
            if (event.type === 'output' && event.bytes instanceof Uint8Array) {
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
                active.worker = await createWorker(this.#options.workerURL);
                detach = active.worker.listen(onMessage,
                    error => fail(`WASM worker failed: ${error?.message || error}`),
                    code => fail(`WASM worker exited without a completion record (exit ${code})`));
                if (!active.reason) {
                    active.worker.post({type: 'start', version: 1, moduleURL: this.#options.moduleURL,
                        source: prepared.numberedSource,
                        input: concatenate(active.inputQueue, active.inputBytes),
                        inputEnded: active.inputEnded, maxOutputBytes});
                    active.inputQueue = [];
                    active.sentStart = true;
                    await finished;
                }
            }
        } catch (error) { fail(`Cannot run WASM backend: ${error?.message || error}`); }
        finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            // Node's terminate() resolves only after the thread is gone.
            // Browser terminate() is synchronous. Both happen before run(),
            // reset() or dispose() resolves, and before any next run begins.
            if (active.worker) {
                try { await active.worker.terminate(); }
                catch (error) {
                    active.reason = {status: 'host-error', error: hostError(`Cannot terminate WASM worker: ${error?.message || error}`)};
                }
            }
            detach?.();
        }

        const status = active.reason?.status ?? active.terminal?.status ?? 'host-error';
        let error = active.reason?.error ?? active.terminal?.error;
        if (status === 'error' && error) {
            error = {...error, kind: 'basic', line: prepared.sourceMap[error.basicLine] ?? null, filename: prepared.filename};
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
