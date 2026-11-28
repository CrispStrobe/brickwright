import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {prepareSource} from './source.mjs';
import {BACKEND, NATIVE_CAPABILITIES} from './capabilities.mjs';

const DEFAULT_EXECUTABLE = fileURLToPath(new URL('../.build/crispbasic-native', import.meta.url));
const MAX_DIAGNOSTIC_BYTES = 16 * 1024;
const MAX_CONTROL_LINE_BYTES = 64 * 1024;
const MAX_INPUT_BYTES = 1024 * 1024;

function positiveInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0x7fffffff) {
        throw new RangeError(`${name} must be an integer from 1 to 2147483647`);
    }
    return value;
}

function inputBytes(input) {
    if (typeof input === 'string') {
        for (const character of input) {
            if (character.codePointAt(0) > 255) {
                throw new TypeError('Native input strings must contain only Latin-1 characters; use Uint8Array for bytes');
            }
        }
        return Buffer.from(input, 'latin1');
    }
    if (input instanceof Uint8Array) return Buffer.from(input);
    throw new TypeError('input must be a string or Uint8Array');
}

function hostError(message) {
    return {kind: 'host', message};
}

/**
 * A session owns at most one native child at a time. Each run starts a fresh
 * process because the pinned interpreter keeps process-global state.
 * This is a trusted-code developer backend, not a security sandbox.
 */
export class NativeSession {
    #state = 'idle';
    #active = null;
    #disposed = false;
    #options;

    constructor({executable = DEFAULT_EXECUTABLE, timeoutMs = 5000,
        maxOutputBytes = 1024 * 1024, onEvent, simulation} = {}) {
        if (simulation !== undefined) {
            throw new TypeError('The simulation bridge requires createWasmSession; it is unavailable in the native backend');
        }
        if (typeof executable !== 'string' || !executable || executable.includes('\0')) {
            throw new TypeError('executable must be a nonempty path');
        }
        if (onEvent !== undefined && typeof onEvent !== 'function') {
            throw new TypeError('onEvent must be a function');
        }
        this.#options = {
            executable: resolve(executable),
            timeoutMs: positiveInteger(timeoutMs, 'timeoutMs'),
            maxOutputBytes: positiveInteger(maxOutputBytes, 'maxOutputBytes'),
            onEvent
        };
    }

    get state() { return this.#state; }
    get capabilities() { return NATIVE_CAPABILITIES; }

    #emit(event, active) {
        try {
            this.#options.onEvent?.(event);
        } catch (error) {
            // A consumer's observer must not leave a native process running.
            if (active && event.type !== 'result') {
                this.#stop(active, 'host-error', hostError(`Event callback failed: ${error.message || error}`));
            }
        }
    }

    #stop(active, status, error) {
        if (!active.reason) active.reason = {status, error};
        const child = active.child;
        if (!child?.pid || active.closed) return;
        try {
            // Group termination also closes pipes inherited by native OSCLI
            // children. A hard stop bounds blocked INPUT and non-yielding SYS.
            if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
            else child.kill('SIGKILL');
        } catch (failure) {
            if (failure.code !== 'ESRCH') {
                child.kill('SIGKILL');
            }
        }
    }

    run(source, {filename = 'main.bas', input = '', interactive = false,
        timeoutMs = this.#options.timeoutMs, maxOutputBytes = this.#options.maxOutputBytes,
        signal} = {}) {
        let prepared;
        let bytes;
        try {
            if (this.#disposed) throw new Error('CrispBASIC session is disposed');
            if (this.#active) throw new Error('CrispBASIC session is already running');
            prepared = prepareSource(source, {filename});
            positiveInteger(timeoutMs, 'timeoutMs');
            positiveInteger(maxOutputBytes, 'maxOutputBytes');
            if (typeof interactive !== 'boolean') throw new TypeError('interactive must be a boolean');
            if (signal !== undefined && !(signal instanceof AbortSignal)) {
                throw new TypeError('signal must be an AbortSignal');
            }
            bytes = inputBytes(input);
            if (bytes.length > MAX_INPUT_BYTES) throw new RangeError('input exceeds the 1 MiB per-run limit');
        } catch (error) {
            return Promise.reject(error);
        }

        const active = {
            child: null, closed: false, reason: null, done: null,
            interactive, inputEnded: !interactive, inputBytes: bytes.length,
            inputQueue: bytes.length ? [bytes] : []
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
        if (!active || !active.interactive || active.inputEnded || active.reason || active.closed) {
            throw new Error('No interactive CrispBASIC input stream is open');
        }
        const bytes = inputBytes(input);
        if (active.inputBytes + bytes.length > MAX_INPUT_BYTES) {
            throw new RangeError('input exceeds the 1 MiB per-run limit');
        }
        active.inputBytes += bytes.length;
        if (active.child) return active.child.stdin.write(bytes);
        active.inputQueue.push(bytes);
        return true;
    }

    endInput() {
        const active = this.#active;
        if (!active || active.inputEnded) return;
        active.inputEnded = true;
        active.child?.stdin.end();
    }

    cancel() {
        if (!this.#active) return false;
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
        // Every new run already starts with clean interpreter memory.
    }

    async dispose() {
        if (this.#disposed) {
            await this.#active?.done;
            return;
        }
        this.#disposed = true;
        const active = this.#active;
        if (active) {
            this.#stop(active, 'cancelled');
            await active.done;
        }
        this.#state = 'disposed';
    }

    async #execute(active, prepared, {timeoutMs, maxOutputBytes, signal}) {
        const started = performance.now();
        const output = [];
        let outputLength = 0;
        let diagnostics = Buffer.alloc(0);
        let control = Buffer.alloc(0);
        let nativeResult = null;
        let exitCode = null;
        let exitSignal = null;
        let directory;
        const abort = () => this.#stop(active, 'cancelled');
        signal?.addEventListener('abort', abort, {once: true});
        if (signal?.aborted) abort();
        const timer = setTimeout(() => this.#stop(active, 'timeout'), timeoutMs);

        const protocolError = message => this.#stop(active, 'host-error', hostError(message));
        const onControl = chunk => {
            control = Buffer.concat([control, chunk]);
            let end;
            while ((end = control.indexOf(10)) >= 0) {
                if (end > MAX_CONTROL_LINE_BYTES) {
                    protocolError('Native control record exceeds its size limit');
                    return;
                }
                const line = control.subarray(0, end).toString('utf8');
                control = control.subarray(end + 1);
                let event;
                try { event = JSON.parse(line); } catch {
                    protocolError('Malformed native control record');
                    return;
                }
                if (!event || event.version !== 1) {
                    protocolError('Unsupported native control protocol');
                } else if (event.type === 'input' && ['line', 'key'].includes(event.method)) {
                    this.#emit({type: 'input', method: event.method}, active);
                } else if (event.type === 'result' && ['completed', 'error'].includes(event.status) &&
                    Number.isInteger(event.exitCode) && event.exitCode >= 0 && event.exitCode <= 255 && !nativeResult &&
                    (event.status !== 'error' || (event.error && typeof event.error.message === 'string' &&
                    Number.isInteger(event.error.code) && Number.isInteger(event.error.basicLine)))) {
                    nativeResult = event;
                } else {
                    protocolError('Unexpected native control record');
                }
                if (active.reason) return;
            }
            if (control.length > MAX_CONTROL_LINE_BYTES) protocolError('Native control record exceeds its size limit');
        };

        try {
            if (!active.reason) {
                directory = await mkdtemp(join(tmpdir(), 'crispbasic-'));
                const program = join(directory, 'program.bas');
                await writeFile(program, prepared.numberedSource, {encoding: 'latin1', mode: 0o600});
                if (!active.reason) {
                    const child = spawn(this.#options.executable, [program], {
                        cwd: directory,
                        stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
                        detached: process.platform !== 'win32',
                        windowsHide: true
                    });
                    active.child = child;
                    await new Promise(resolveChild => {
                        child.stdout.on('data', chunk => {
                            if (active.reason) return;
                            const remaining = maxOutputBytes - outputLength;
                            const accepted = chunk.subarray(0, remaining);
                            if (accepted.length) {
                                const saved = Buffer.from(accepted);
                                output.push(saved);
                                outputLength += saved.length;
                                this.#emit({type: 'output', bytes: new Uint8Array(saved)}, active);
                            }
                            if (chunk.length > remaining) this.#stop(active, 'output-limit');
                        });
                        child.stderr.on('data', chunk => {
                            const remaining = MAX_DIAGNOSTIC_BYTES - diagnostics.length;
                            if (remaining > 0) diagnostics = Buffer.concat([diagnostics, chunk.subarray(0, remaining)]);
                        });
                        child.stdio[3].on('data', chunk => {
                            if (!active.reason) onControl(chunk);
                        });
                        child.stdin.on('error', error => {
                            // The program may complete without consuming all supplied input.
                            if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') {
                                this.#stop(active, 'host-error', hostError(`Native input failed: ${error.message}`));
                            }
                        });
                        child.on('error', error => {
                            const hint = error.code === 'ENOENT' ? ' Run npm run build:native in packages/crisp-basic.' : '';
                            this.#stop(active, 'host-error', hostError(`Cannot start native backend: ${error.message}.${hint}`));
                        });
                        child.once('close', (code, childSignal) => {
                            active.closed = true;
                            exitCode = code;
                            exitSignal = childSignal;
                            resolveChild();
                        });
                        for (const bytes of active.inputQueue) child.stdin.write(bytes);
                        active.inputQueue = [];
                        if (active.inputEnded) child.stdin.end();
                    });
                }
            }
        } catch (error) {
            this.#stop(active, 'host-error', hostError(error.message || String(error)));
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            if (directory) {
                try { await rm(directory, {recursive: true, force: true}); } catch (error) {
                    if (!active.reason) active.reason = {
                        status: 'host-error', error: hostError(`Cannot clean native workspace: ${error.message}`)
                    };
                }
            }
        }

        let status = active.reason?.status;
        let error = active.reason?.error;
        if (!status) {
            if (control.length || !nativeResult || exitSignal || exitCode !== nativeResult.exitCode) {
                status = 'host-error';
                error = hostError(`Native backend exited without a valid completion (exit ${exitCode}, signal ${exitSignal || 'none'})`);
            } else {
                status = nativeResult.status;
                if (status === 'error') {
                    const basicError = nativeResult.error;
                    error = {
                        kind: 'basic', code: basicError.code, message: basicError.message,
                        basicLine: basicError.basicLine,
                        line: prepared.sourceMap[basicError.basicLine] ?? null,
                        filename: prepared.filename
                    };
                }
            }
        }
        const bytes = Buffer.concat(output, outputLength);
        return {
            status, backend: BACKEND,
            output: new Uint8Array(bytes), text: bytes.toString('latin1'),
            ...(error ? {error} : {}),
            diagnostics: diagnostics.toString('utf8'),
            exitCode, signal: exitSignal,
            durationMs: Math.round(performance.now() - started)
        };
    }
}

export function createNativeSession(options) {
    return new NativeSession(options);
}
