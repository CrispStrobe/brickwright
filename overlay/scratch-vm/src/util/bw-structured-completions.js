// SPDX-License-Identifier: BSD-3-Clause
'use strict';

// Detached completion algebra, NOT an Arcade exception capability. Nothing in
// the parser, sequencer, generator runner or exception coordinator imports this
// module. A future bridge must bind each invocation to its actual thread/frame
// and intercept an owned throw before retireLineage retires the caller chain.
// Entries below are opaque body identities; this module never executes them.
module.exports = function createStructuredCompletions () {
    const invocations = new WeakMap(), completions = new WeakMap();
    const frames = new WeakMap(), targets = new WeakMap(), leases = new WeakMap();
    const active = new Set();
    let running = false, disposed = false, generation = 0;
    const token = () => Object.freeze(Object.create(null));
    const live = state => Boolean(state && running && !disposed && !state.closed &&
        state.generation === generation && active.has(state));
    const stateOf = (invocation, allowSuspended = false) => {
        const state = invocations.get(invocation);
        if (!live(state)) throw new Error('Structured completion requires its live invocation');
        if (!allowSuspended && state.suspension) throw new Error('Structured invocation is suspended');
        return state;
    };
    const recordOf = (state, completion) => {
        const record = completions.get(completion);
        if (!record || record.state !== state) throw new Error('Foreign structured completion');
        return record;
    };
    const release = state => {
        state.closed = true;
        for (const frame of state.stack) frames.delete(frame);
        state.stack.length = 0;
        if (state.suspension) leases.delete(state.suspension);
        state.suspension = null;
        active.delete(state);
    };
    const stop = () => {
        running = false;
        generation++;
        // Stop is cancellation, not a fabricated return/throw completion.
        // No authored finalizer is entered; host iterator cleanup is separate.
        for (const state of active) release(state);
    };
    const entry = value => value === null ||
        typeof value === 'object' || typeof value === 'function';
    const action = (kind, frame, body, completion) => Object.freeze({kind, frame, body, completion});
    return Object.freeze({
        start () {
            if (disposed || running) throw new Error('Structured run requires a stopped owner');
            generation++;
            running = true;
        },
        stop,
        dispose () {stop();disposed = true;},
        beginInvocation () {
            if (!running || disposed) throw new Error('Structured owner is not running');
            const invocation = token();
            const state = {generation, closed:false, stack:[], suspension:null, revision:0};
            invocations.set(invocation, state);
            active.add(state);
            return invocation;
        },
        current (invocation) {return live(invocations.get(invocation));},
        endInvocation (invocation) {
            const state = stateOf(invocation);
            if (state.stack.length) throw new Error('Structured invocation still has an unwind boundary');
            release(state);
        },
        cancelInvocation (invocation) {release(stateOf(invocation, true));},
        declareTarget (invocation, kind) {
            const state = stateOf(invocation);
            if (kind !== 'loop' && kind !== 'switch') throw new Error('Unknown structured target');
            const target = token();
            targets.set(target, {state, kind});
            return target;
        },
        completion (invocation, kind, value = undefined, target = null) {
            const state = stateOf(invocation);
            if (!['normal','return','break','continue','throw'].includes(kind)) {
                throw new Error('Unknown structured completion kind');
            }
            if (kind === 'break' || kind === 'continue') {
                const destination = targets.get(target);
                if (!destination || destination.state !== state ||
                    kind === 'continue' && destination.kind !== 'loop' || value !== undefined) {
                    throw new Error('Structured jump requires its invocation target');
                }
            } else if (target !== null) throw new Error('Only a structured jump has a target');
            const completion = token();
            completions.set(completion, {state, kind, value, target});
            return completion;
        },
        describe (invocation, completion) {
            const record = recordOf(stateOf(invocation, true), completion);
            // This view is data, never accepted back as a branded completion.
            return Object.freeze({kind:record.kind, value:record.value, target:record.target});
        },
        enterTry (invocation, catchEntry = null, finallyEntry = null) {
            const state = stateOf(invocation);
            if (!entry(catchEntry) || !entry(finallyEntry) || catchEntry === null && finallyEntry === null) {
                throw new Error('Structured boundary requires catch or finally body identity');
            }
            const frame = token();
            frames.set(frame, {state, phase:'try', catchEntry, finallyEntry, pending:null});
            state.stack.push(frame);
            state.revision++;
            return frame;
        },
        finish (invocation, frame, completion) {
            const state = stateOf(invocation), record = recordOf(state, completion);
            const boundary = frames.get(frame);
            if (!boundary || boundary.state !== state || state.stack.at(-1) !== frame) {
                throw new Error('Structured unwinding requires the innermost live boundary');
            }
            state.revision++;
            if (boundary.phase === 'try' && record.kind === 'throw' && boundary.catchEntry !== null) {
                boundary.phase = 'catch';
                return action('catch', frame, boundary.catchEntry, completion);
            }
            if (boundary.phase !== 'finally' && boundary.finallyEntry !== null) {
                boundary.pending = completion;
                boundary.phase = 'finally';
                return action('finally', frame, boundary.finallyEntry, completion);
            }
            // Normal finalizer completion resumes the saved completion. Every
            // abrupt finalizer completion replaces it, including another throw.
            const result = boundary.phase === 'finally' && record.kind === 'normal' ?
                boundary.pending : completion;
            boundary.phase = 'closed';
            state.stack.pop();
            frames.delete(frame);
            return action('complete', frame, null, result);
        },
        suspend (invocation) {
            const state = stateOf(invocation), lease = token();
            const snapshot = {state, generation, revision:state.revision, frame:state.stack.at(-1)};
            leases.set(lease, snapshot);
            state.suspension = lease;
            return lease;
        },
        resume (invocation, lease) {
            // A stale/foreign settlement must not alter a new invocation or
            // consume its actual pending lease. A successful lease is one-use.
            const state = invocations.get(invocation), snapshot = leases.get(lease);
            if (!live(state) || !snapshot || snapshot.state !== state || snapshot.generation !== generation ||
                state.suspension !== lease || snapshot.revision !== state.revision ||
                snapshot.frame !== state.stack.at(-1)) return false;
            leases.delete(lease);
            state.suspension = null;
            state.revision++;
            return true;
        }
    });
};
