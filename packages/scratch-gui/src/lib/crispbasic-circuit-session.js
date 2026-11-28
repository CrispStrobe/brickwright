// SPDX-License-Identifier: BSD-3-Clause
// The GUI owns the shared canvas and its clock. The interpreter never does.
import {createCrispBasicBoardHost} from './crispbasic-board-host.js';

const OWNER_EVENT = 'bw-circuit-clock-owner';
const MODEL_MUTATIONS = ['_saveHistory', '_syncNetlist', 'syncWithExternalNets'];
const mutationGuards = new WeakMap();
const cleanupPendingError = () => Object.assign(
    new Error('The Circuit cannot change until BASIC pin cleanup has finished'), {code: 'circuit-cleanup-pending'});
const stopped = () => new Error('The BASIC circuit run was stopped');
const otherRun = () => new Error('Stop the other simulator, debugger or blocks program before connecting BASIC to the Circuit');
const cleanupFailure = error => {
    let message = 'Circuit cleanup failed';
    try { message += `: ${error?.message || String(error)}`; } catch { /* hostile exception */ }
    return Object.assign(new Error(message), {code: 'circuit-cleanup-failed'});
};

/** Reserve one existing canvas board and wait until the Designer stops its
 * clock. No pins, power or solver state change until createHost is called. */
export async function createCrispBasicCircuitSession ({runtime, eventTarget = globalThis.window,
    signal, onInvalidate = () => {}, timeoutMs = 10000, expectedBoard, expectedParts, expectedNets} = {}) {
    if (!runtime || typeof runtime !== 'object') throw new Error('The Circuit runtime is unavailable');
    if (!eventTarget?.addEventListener || !eventTarget?.removeEventListener || !eventTarget?.dispatchEvent) {
        throw new Error('Open the Circuit tab before connecting BASIC');
    }
    if (!(signal instanceof AbortSignal)) throw new TypeError('The circuit session requires an AbortSignal');
    if (signal.aborted) throw stopped();
    if (runtime.bwCrispBasicSimulation || runtime.bwCircuitRunPreparing || runtime.bwRunBoard || runtime.bwProgramClock ||
        runtime.threads?.length || ['preparing', 'compiling', 'running'].includes(runtime.cadCircuitSimulation?.state().phase)) {
        throw otherRun();
    }
    const board = runtime.circuitBoard;
    if (expectedBoard && (board !== expectedBoard || board.parts !== expectedParts || board.getNets?.() !== expectedNets)) {
        throw new Error('The Circuit changed while BASIC was loading; run it again');
    }
    const model = runtime.circuitModel;
    if (model?.netlistError) throw new Error(`The Circuit was rejected: ${String(model.netlistError).split('\n')[0]}`);
    if (!board || !Array.isArray(board.parts) || !board.parts.length || typeof board.getNets !== 'function') {
        throw new Error('Open a wired circuit with one supported controller in the Circuit tab, then connect BASIC');
    }
    if (model?.board && model.board !== board) throw new Error('The Circuit is changing; wait for it to finish loading');
    const parts = board.parts, nets = board.getNets();
    let disposed = false, host = null, creatingHost = false, requested = false, ready = false, rejectWait, disposalError = null;
    const owner = {board, stop: () => invalidate('The BASIC circuit run was stopped')};
    runtime.bwCrispBasicSimulation = owner;
    const windowListeners = [], runtimeListeners = [], modelGuards = [];
    const clean = action => {
        try { action(); } catch (error) { if (!disposalError) disposalError = cleanupFailure(error); }
    };
    const cleanupPending = () => creatingHost || Boolean(host && !host.cleanupComplete);
    const restoreModelGuards = () => {
        // Keep the guard during a solver callback or pin-release callback:
        // retrying a refused edit in that same stack must not take a snapshot.
        // A failed pin release must also block a later retry of the edit.
        if (cleanupPending() || disposalError) return;
        for (const entry of modelGuards) clean(() => {
            if (entry.restored) return;
            if (Object.getOwnPropertyDescriptor(model, entry.name)?.value === entry.guard) {
                if (entry.descriptor) Object.defineProperty(model, entry.name, entry.descriptor);
                else if (!Reflect.deleteProperty(model, entry.name)) throw new Error(`Could not release Circuit ${entry.name} guard`);
            }
            entry.restored = true;
        });
    };
    const watch = (name, fn) => {
        windowListeners.push([name, fn]); eventTarget.addEventListener(name, fn);
    };
    const watchRuntime = (name, fn) => {
        if (typeof runtime.on === 'function' && typeof runtime.off === 'function') {
            runtimeListeners.push([name, fn]); runtime.on(name, fn);
        }
    };
    const valid = () => !disposed && !signal.aborted && runtime.bwCrispBasicSimulation === owner &&
        !runtime.bwRunBoard && !runtime.bwCircuitRunPreparing && !runtime.bwProgramClock &&
        runtime.circuitBoard === board && board.parts === parts && board.getNets() === nets &&
        (!runtime.circuitModel || runtime.circuitModel === model) && !model?.netlistError;
    const release = () => {
        if (disposed) return;
        disposed = true;
        clean(() => signal.removeEventListener('abort', abort));
        for (const [name, fn] of windowListeners) clean(() => eventTarget.removeEventListener(name, fn));
        for (const [name, fn] of runtimeListeners) clean(() => runtime.off(name, fn));
        clean(() => board.offChange?.(boardChanged));
        // Host cleanup is synchronous and idempotent; it releases only its
        // own pin/clock lease before the Designer may resume its animation.
        clean(() => host?.dispose());
        restoreModelGuards();
        clean(() => { if (runtime.bwCrispBasicSimulation === owner) delete runtime.bwCrispBasicSimulation; });
        clean(() => { if (requested) eventTarget.dispatchEvent(new CustomEvent(OWNER_EVENT, {detail: {board: null, owner}})); });
    };
    const dispose = () => {
        release();
        // Cancellation can occur inside a solver callback. The host completes
        // its deferred cleanup when that synchronous operation unwinds, then
        // exposes any retained failure on the next idempotent dispose call.
        try { host?.dispose(); }
        catch (error) { if (!disposalError) disposalError = cleanupFailure(error); }
        restoreModelGuards();
        if (disposalError) throw disposalError;
    };
    const invalidate = message => {
        if (disposed) return;
        const error = new Error(message);
        try { onInvalidate(error); }
        catch (failure) { if (!disposalError) disposalError = cleanupFailure(failure); }
        finally { rejectWait?.(error); release(); }
    };
    // EventTarget reports thrown listener errors outside the awaited Run.
    // Retain them for dispose() instead, while releasing every owned resource.
    const abort = () => { rejectWait?.(stopped()); release(); };
    const boardChanged = event => {
        if (host?.state === 'disposed') return;
        if (['netlist', 'reset', 'restore', 'param'].includes(event.type)) invalidate('The Circuit changed; BASIC stopped');
        else if (event.type === 'power' && event.detail?.on === false) invalidate('Circuit power was switched off; BASIC stopped');
    };
    const guardModelMutations = () => {
        if (!model) return;
        for (const name of MODEL_MUTATIONS) {
            if (disposed || signal.aborted) throw stopped();
            let descriptor = Object.getOwnPropertyDescriptor(model, name);
            let original = model[name];
            const previous = mutationGuards.get(original);
            if (previous?.model === model) {
                // Never install over a pending/failed old guard: restoring it
                // at the end of this run would strand that old owner forever.
                previous.finish();
                descriptor = Object.getOwnPropertyDescriptor(model, name);
                original = model[name];
            }
            if (disposed || signal.aborted) throw stopped();
            if (typeof original !== 'function') continue;
            function guard (...args) {
                if (this !== model) return Reflect.apply(original, this, args);
                // A model rebuild copies its old board's GPIO snapshot before
                // the Designer emits edit/board-ready effects. Release the
                // captured board BEFORE history or either rebuild can copy it.
                invalidate('The Circuit changed; BASIC stopped');
                dispose();
                if (cleanupPending()) throw cleanupPendingError();
                // A callback may retain this function past disposal. Let a
                // newer session guard its own mutation, never restore over it.
                const current = Object.getOwnPropertyDescriptor(model, name)?.value;
                if (current !== guard && mutationGuards.has(current)) return Reflect.apply(current, this, args);
                return Reflect.apply(original, this, args);
            }
            mutationGuards.set(guard, {model, finish: () => {
                if (!disposed) throw otherRun();
                dispose();
                if (cleanupPending()) throw cleanupPendingError();
            }});
            const replacement = descriptor && Object.hasOwn(descriptor, 'value') ?
                {...descriptor, value: guard} :
                {value: guard, writable: true, configurable: true, enumerable: descriptor?.enumerable ?? false};
            Object.defineProperty(model, name, replacement);
            modelGuards.push({name, descriptor, guard, restored: false});
        }
    };
    try {
        guardModelMutations();
        signal.addEventListener('abort', abort, {once: true});
        board.onChange?.(boardChanged);
        watch('bw-board-ready', () => { if (!valid()) invalidate('The active Circuit was replaced; BASIC stopped'); });
        watch('bw-circuit-changed', () => invalidate('The Circuit changed; BASIC stopped'));
        watch('bw-project-bundle-loaded', event => {
            if (!['future', 'invalid', 'storage-failed'].includes(event.detail?.outcome)) {
                invalidate('The project was replaced; BASIC stopped');
            }
        });
        watch('bw-settings-change', event => {
            if (event.detail?.key === 'bw-device-id') invalidate('The selected device changed; BASIC stopped');
        });
        for (const name of ['bw-stop-all', 'bw-power-off', 'bw-green-flag']) watch(name, () => invalidate('The BASIC circuit run was stopped'));
        for (const name of ['PROJECT_STOP_ALL', 'PROJECT_START', 'PROJECT_LOADED']) watchRuntime(name, () => invalidate('The BASIC circuit run was stopped'));
        await new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true; clearTimeout(timer); rejectWait = null; callback(value);
            };
            const timer = setTimeout(() => finish(reject, new Error('Open the Circuit tab before connecting BASIC')), timeoutMs);
            rejectWait = error => finish(reject, error);
            requested = true;
            eventTarget.dispatchEvent(new CustomEvent(OWNER_EVENT, {detail: {board, owner, signal,
                ready: () => { if (valid()) { ready = true; finish(resolve); } else finish(reject, stopped()); },
                reject: error => finish(reject, error)}}));
            if (!valid()) finish(reject, stopped());
        });
        if (!valid()) throw stopped();
        return {
            board,
            createHost ({signal: hostSignal}, SimulationError) {
                if (!ready || !valid() || hostSignal.aborted) throw stopped();
                if (host) throw new Error('A circuit session can create only one BASIC host');
                creatingHost = true;
                try {
                    host = createCrispBasicBoardHost({board, signal: hostSignal, SimulationError,
                        onInvalidate: error => invalidate(error.message)});
                    if (!valid()) { host.dispose(); throw stopped(); }
                    return host;
                } finally {
                    creatingHost = false;
                    if (disposed) dispose();
                }
            },
            dispose
        };
    } catch (error) { dispose(); throw error; }
}
