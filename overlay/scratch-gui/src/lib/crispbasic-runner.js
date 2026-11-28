// SPDX-License-Identifier: BSD-3-Clause
// Brickwright owns this adapter; the interpreter package has no GUI dependency.
import {VduDecoder} from 'bw-board/vdu-decoder.js';
import {createCrispBasicCircuitSession} from './crispbasic-circuit-session.js';

export const CRISPBASIC_VIEW_CAPABILITIES = Object.freeze({
    backend: 'bbcsdl-wasm', graphics: 'vdu-subset', graphicsQueries: false,
    circuitPins: false, sourceDebugger: false
});
const CIRCUIT_VIEW_CAPABILITIES = Object.freeze({...CRISPBASIC_VIEW_CAPABILITIES,
    circuitPins: true, hardware: false});

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_OUTPUT_BYTES = 1024 * 1024;
const hostMessage = error => {
    try { return error?.message || String(error); }
    catch { return 'Unknown host error'; }
};
const positiveInteger = (value, name) => {
    if (!Number.isInteger(value) || value < 1 || value > 0x7fffffff) {
        throw new RangeError(`${name} must be an integer from 1 to 2147483647`);
    }
    return value;
};

/** Exact byte-to-code-point mapping, including 0x80..0x9f (not Windows-1252). */
export function vduLatin1 (bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError('VDU output must be Uint8Array');
    const parts = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) {
        parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    }
    return parts.join('');
}

/** Keep the canonical decoder's state across chunks. Text is a transcript;
 * cursor positioning, colours and graphics belong to the canvas renderer. */
export class CrispBasicOutput {
    constructor () { this.reset(); }
    reset () {
        this.decoder = new VduDecoder();
        this.rawOutput = '';
        this.output = '';
    }
    append (bytes) {
        this.rawOutput += vduLatin1(bytes);
        let text = '';
        for (const byte of bytes) {
            for (const event of this.decoder.push(byte)) {
                if (event.type === 'char') text += event.char;
                else if (event.type === 'newline') text += '\n';
                else if (event.type === 'cr') text += '\r';
            }
        }
        this.output += text;
    }
}

function assetURLs (baseURL) {
    const base = baseURL ? new URL(baseURL) :
        new URL('static/crispbasic/', globalThis.document?.baseURI || globalThis.location?.href);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    return {
        browserURL: new URL('browser.mjs', base).href,
        moduleURL: new URL('wasm/crispbasic.mjs', base).href,
        workerURL: new URL('src/wasm-worker.mjs', base).href
    };
}

const loadBrowserRuntime = async url => import(/* webpackIgnore: true */ url);

/** Load native browser ESM only on Run. This keeps Node imports, generated glue
 * and import.meta.url out of webpack's legacy GUI graph. loadRuntime/baseURL
 * are trusted embedding configuration; neither is taken from BASIC source. */
export class CrispBasicRunner {
    constructor ({onEvent, assetBaseURL, loadRuntime = loadBrowserRuntime,
        timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputBytes = DEFAULT_OUTPUT_BYTES, circuit} = {}) {
        if (onEvent !== undefined && typeof onEvent !== 'function') throw new TypeError('onEvent must be a function');
        if (typeof loadRuntime !== 'function') throw new TypeError('loadRuntime must be a function');
        if (circuit !== undefined && (!circuit || typeof circuit !== 'object' || !circuit.runtime)) {
            throw new TypeError('circuit must supply the active GUI runtime');
        }
        this._options = {onEvent, assetBaseURL, loadRuntime, circuit,
            timeoutMs: positiveInteger(timeoutMs, 'timeoutMs'),
            maxOutputBytes: positiveInteger(maxOutputBytes, 'maxOutputBytes')};
        this._state = 'idle';
        this._disposed = false;
        this._active = null;
        this._resetting = null;
        this._runId = 0;
        this._output = new CrispBasicOutput();
        this._inputMethod = null;
    }

    get state () { return this._state; }
    get capabilities () { return this._options.circuit ? CIRCUIT_VIEW_CAPABILITIES : CRISPBASIC_VIEW_CAPABILITIES; }

    _emit (event, active = this._active) {
        if (this._disposed) return;
        try { this._options.onEvent?.(event); }
        catch (error) {
            if (active && event.type !== 'result') {
                this._stop(active, 'host-error', {kind: 'host', message: `View callback failed: ${hostMessage(error)}`});
            }
        }
    }

    _view () {
        this._emit({type: 'view', runId: this._runId, inputMethod: this._inputMethod,
            output: this._output.output, rawOutput: this._output.rawOutput});
    }

    _stop (active, status, error) {
        if (active.reason || active.finished) return false;
        active.reason = {status, ...(error ? {error} : {})};
        active.stopLoading();
        try { active.controller.abort(); }
        catch (failure) { active.reason = {status: 'host-error', error: {kind: 'host', message: hostMessage(failure)}}; }
        try { active.session?.cancel(); }
        catch (failure) { active.reason = {status: 'host-error', error: {kind: 'host', message: hostMessage(failure)}}; }
        return true;
    }

    run (source, options = {}) {
        let timeoutMs, maxOutputBytes, circuit;
        try {
            if (this._disposed) throw new Error('CrispBASIC runner is disposed');
            if (this._resetting) throw new Error('CrispBASIC runner is resetting');
            if (this._active) throw new Error('CrispBASIC runner is already running');
            timeoutMs = positiveInteger(options.timeoutMs ?? this._options.timeoutMs, 'timeoutMs');
            maxOutputBytes = positiveInteger(options.maxOutputBytes ?? this._options.maxOutputBytes, 'maxOutputBytes');
            if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw new TypeError('signal must be an AbortSignal');
            if (this._options.circuit) {
                const expectedBoard = this._options.circuit.runtime.circuitBoard;
                circuit = {...this._options.circuit, expectedBoard, expectedParts: expectedBoard?.parts,
                    expectedNets: expectedBoard?.getNets?.()};
            }
        } catch (error) { return Promise.reject(error); }
        const active = {session: null, circuit: null, controller: new AbortController(),
            reason: null, finished: false, started: performance.now()};
        active.stopped = new Promise(resolve => { active.stopLoading = resolve; });
        this._active = active;
        this._runId++;
        this._output.reset();
        this._inputMethod = null;
        this._state = 'loading';
        active.done = Promise.resolve().then(() => this._execute(active, source, {...options, timeoutMs, maxOutputBytes, circuit}));
        this._view();
        this._emit({type: 'state', state: 'loading'});
        return active.done;
    }

    async _execute (active, source, options) {
        const {circuit: circuitOptions, ...executionOptions} = options;
        const abort = () => this._stop(active, 'cancelled');
        options.signal?.addEventListener('abort', abort, {once: true});
        if (options.signal?.aborted) abort();
        const timer = setTimeout(() => this._stop(active, 'timeout'), options.timeoutMs);
        let result;
        try {
            if (!active.reason && circuitOptions) {
                try {
                    active.circuit = await createCrispBasicCircuitSession({...circuitOptions,
                        signal: active.controller.signal,
                        onInvalidate: error => this._stop(active, 'cancelled', {kind: 'host', message: hostMessage(error)})});
                } catch (error) {
                    const detail = {kind: 'host', message: hostMessage(error)};
                    if (error?.code === 'circuit-cleanup-failed') active.reason = {status: 'host-error', error: detail};
                    else this._stop(active, 'host-error', detail);
                }
            }
            if (!active.reason) {
                let urls, runtime;
                try {
                    urls = assetURLs(this._options.assetBaseURL);
                    runtime = await Promise.race([
                        Promise.resolve().then(() => this._options.loadRuntime(urls.browserURL)), active.stopped
                    ]);
                    if (!active.reason && typeof runtime?.createWasmSession !== 'function') {
                        throw new Error('The browser entry has no createWasmSession export');
                    }
                } catch (error) {
                    this._stop(active, 'host-error', {kind: 'host', message:
                        `CrispBASIC could not load. Build and package the engine with npm run build:crispbasic. ${hostMessage(error)}`});
                }
                if (!active.reason) {
                    const onEvent = event => {
                        if (active !== this._active || active.reason || active.finished) return;
                        if (event.type === 'output') {
                            this._output.append(event.bytes);
                            this._view();
                        } else if (event.type === 'input') {
                            this._inputMethod = event.method;
                            this._view();
                        }
                        if (event.type !== 'result' && event.type !== 'state') this._emit(event, active);
                    };
                    active.session = runtime.createWasmSession({moduleURL: urls.moduleURL,
                        workerURL: urls.workerURL, onEvent, maxOutputBytes: options.maxOutputBytes,
                        timeoutMs: options.timeoutMs,
                        ...(active.circuit ? {simulation: {
                            createHost: context => active.circuit.createHost(context, runtime.SimulationError)
                        }} : {})});
                    this._state = 'running';
                    this._emit({type: 'state', state: 'running'}, active);
                    if (!active.reason) {
                        const remaining = Math.max(1, options.timeoutMs - Math.ceil(performance.now() - active.started));
                        result = await active.session.run(source, {...executionOptions, timeoutMs: remaining});
                    }
                }
            }
        } finally {
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', abort);
            // Do not permit a new run, or resolve reset/dispose, until the
            // underlying worker is gone. A cancelled import may finish later;
            // it has no continuation capable of creating a session.
            try {
                let cleanupError;
                const failed = error => { cleanupError = {kind: 'host', message: hostMessage(error)}; };
                try { await active.session?.dispose(); } catch (error) { failed(error); }
                try { active.circuit?.dispose(); } catch (error) { failed(error); }
                try { active.controller.abort(); } catch (error) { failed(error); }
                if (cleanupError) active.reason = {status: 'host-error', error: cleanupError};
            } finally {
                active.finished = true;
                if (this._active === active) this._active = null;
                this._state = this._disposed ? 'disposed' : 'idle';
                this._inputMethod = null;
                this._view();
                this._emit({type: 'state', state: this._state}, null);
            }
        }
        if (!result) {
            result = {backend: 'bbcsdl-wasm', output: new Uint8Array(0), text: '', diagnostics: '',
                exitCode: null, signal: null, durationMs: Math.round(performance.now() - active.started)};
        }
        if (active.reason) {
            const {error: ignored, ...withoutError} = result;
            result = {...withoutError, ...active.reason};
        }
        this._emit({type: 'result', result}, null);
        return result;
    }

    writeInput (input) {
        if (!this._active?.session || this._active.reason) throw new Error('No interactive CrispBASIC input stream is open');
        const accepted = this._active.session.writeInput(input);
        this._inputMethod = null;
        this._view();
        return accepted;
    }
    endInput () {
        this._active?.session?.endInput();
        this._inputMethod = null;
        this._view();
    }
    cancel () { return this._active ? this._stop(this._active, 'cancelled') : false; }
    reset () {
        if (this._disposed) return Promise.reject(new Error('CrispBASIC runner is disposed'));
        if (this._resetting) return this._resetting;
        const active = this._active;
        // Own the reset before cancellation or view callbacks can re-enter.
        // Keep that ownership through the final clear view: a new run must
        // never have its decoder/output cleared by an older reset.
        this._resetting = Promise.resolve().then(() => {
            if (active) this._stop(active, 'cancelled');
            return active?.done;
        }).finally(() => {
            try {
                this._runId++;
                this._output.reset();
                this._inputMethod = null;
                this._view();
            } finally { this._resetting = null; }
        });
        return this._resetting;
    }
    async dispose () {
        this._disposed = true;
        const active = this._active;
        this.cancel();
        try { await active?.done; }
        finally { this._state = 'disposed'; }
    }
}

export const createCrispBasicRunner = options => new CrispBasicRunner(options);
