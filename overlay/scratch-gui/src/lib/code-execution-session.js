// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors

// One owner for a disposable Code-tab worker. This is an execution/lifecycle
// boundary, not a security sandbox or an interpreter implementation.
export const DEFAULT_CODE_TIMEOUT_MS = 4000;
export const DEFAULT_CODE_OUTPUT_LIMIT = 65536;
export const DEFAULT_CODE_INPUT_PROBE_INTERVAL_MS = 250;
export const DEFAULT_CODE_INPUT_PROBE_TIMEOUT_MS = 1000;

let nextRunId = 0;
const defaultClock = {
    now: () => typeof performance !== 'undefined' ? performance.now() : Date.now(),
    setTimeout: (fn, delay) => setTimeout(fn, delay),
    clearTimeout: timer => clearTimeout(timer)
};
const messageFor = error => String(error && error.message || error || 'Worker error').slice(0, 4096);

const createBlobWorker = source => {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' ||
        typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        throw new Error('This environment cannot run code in a worker.');
    }
    const url = URL.createObjectURL(new Blob([source], {type: 'application/javascript'}));
    try {
        return {worker: new Worker(url), release: () => URL.revokeObjectURL(url)};
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }
};

/**
 * Start one worker run, including ownership of an asynchronous source load.
 *
 * workerSource is a string, Promise<string>, or function returning either. A
 * cancellation during loading prevents worker creation even if the load resolves.
 * onOutput receives bounded cumulative output (at most once per flushIntervalMs,
 * plus input/reset/final flushes). onInput receives a request or null to clear it.
 * Call replyToInput(requestId, string) for the current request only.
 *
 * Wire protocol: every message carries runId. Host sends run/code/maxOutputChars
 * and input-reply/requestId/value. During input, input-ping/requestId/probeId
 * requires a matching input-pong. Worker sends out/text, done, error/text,
 * input/requestId/prompt/pauseBudget, input-state/requestId/pauseBudget,
 * output-reset, or output-limit. Request IDs are distinct
 * short strings or non-negative safe integers. One input may be pending at a time.
 *
 * The execution timeout starts when code is dispatched. Input pauses it unless
 * pauseBudget is false (other owned work is still active); matching input-state
 * messages may change that state. Resuming never replenishes the budget. A
 * separate responsiveness probe remains active during input, so asking without
 * awaiting, or a busy sibling task, cannot disable worker timeout protection.
 * Human waiting can continue while the worker answers those probes.
 * Output-reset clears visible output but
 * never replenishes the total accepted-output budget (UTF-16 code units).
 * Worker sources should also batch and bound output before posting messages.
 *
 * createWorker/clock are injectable for source-only tests. createWorker returns
 * {worker, release?}; release owns resources such as the Blob URL. The result
 * Promise always resolves; browser termination has no completion acknowledgement.
 */
export const createCodeExecutionSession = ({
    workerSource,
    code,
    timeoutMs = DEFAULT_CODE_TIMEOUT_MS,
    maxOutputChars = DEFAULT_CODE_OUTPUT_LIMIT,
    flushIntervalMs = 32,
    inputProbeIntervalMs = DEFAULT_CODE_INPUT_PROBE_INTERVAL_MS,
    inputProbeTimeoutMs = DEFAULT_CODE_INPUT_PROBE_TIMEOUT_MS,
    onOutput = () => {},
    onInput = () => {},
    createWorker = createBlobWorker,
    clock = defaultClock
}) => {
    const id = `code-run-${++nextRunId}`;
    let resolveResult;
    const promise = new Promise(resolve => { resolveResult = resolve; });
    let worker = null;
    let release = null;
    let settled = false;
    let executionTimer = null;
    let flushTimer = null;
    let inputProbeTimer = null;
    let pendingProbe = null;
    let nextProbeId = 0;
    let budgetStarted = null;
    let remainingMs = timeoutMs;
    let output = '';
    let totalOutputChars = 0;
    let truncated = false;
    let outputDirty = false;
    let pendingInput = null;
    const inputIds = new Set();

    const clearTimer = name => {
        const timer = name === 'execution' ? executionTimer : flushTimer;
        if (timer !== null) clock.clearTimeout(timer);
        if (name === 'execution') executionTimer = null;
        else flushTimer = null;
    };
    const flushOutput = (reset = false) => {
        clearTimer('flush');
        if (!outputDirty && !reset) return null;
        outputDirty = false;
        try {
            onOutput(output, {runId: id, truncated, reset});
            return null;
        } catch (error) {
            return error;
        }
    };
    const clearInput = () => {
        if (inputProbeTimer !== null) clock.clearTimeout(inputProbeTimer);
        inputProbeTimer = null;
        pendingProbe = null;
        if (!pendingInput) return;
        pendingInput = null;
        // Cleanup cannot be prevented by a caller whose view has disappeared.
        try { onInput(null); } catch (error) { /* the run is being cleared */ }
    };
    const finish = (status, details = {}) => {
        if (settled) return false;
        settled = true;
        clearTimer('execution');
        clearTimer('flush');
        if (worker) {
            worker.onmessage = null;
            worker.onerror = null;
            worker.onmessageerror = null;
            try {
                const termination = worker.terminate();
                if (termination && typeof termination.catch === 'function') termination.catch(() => {});
            } catch (error) { /* release resources and settle even if teardown fails */ }
        }
        if (release) {
            try { release(); } catch (error) { /* a revoked resource must not strand the run */ }
            release = null;
        }
        clearInput();
        const outputError = flushOutput();
        resolveResult({
            runId: id,
            status: outputError ? 'error' : status,
            output,
            totalOutputChars,
            truncated,
            ...details,
            ...(outputError ? {error: messageFor(outputError)} : {})
        });
        return true;
    };
    const notifyOutput = (reset = false) => {
        const error = flushOutput(reset);
        if (error) finish('error', {error: messageFor(error)});
    };
    const armBudget = () => {
        if (settled) return false;
        if (executionTimer !== null) return true;
        if (remainingMs <= 0) {
            finish('timeout');
            return false;
        }
        budgetStarted = clock.now();
        executionTimer = clock.setTimeout(() => finish('timeout'), remainingMs);
        return true;
    };
    const pauseBudget = () => {
        clearTimer('execution');
        if (budgetStarted !== null) remainingMs -= Math.max(0, clock.now() - budgetStarted);
        budgetStarted = null;
    };
    const setInputBudget = paused => {
        if (!paused) return armBudget();
        pauseBudget();
        if (remainingMs <= 0) {
            finish('timeout');
            return false;
        }
        return true;
    };
    const scheduleInputProbe = () => {
        if (settled || !pendingInput || inputProbeTimer !== null) return;
        inputProbeTimer = clock.setTimeout(() => {
            inputProbeTimer = null;
            if (settled || !pendingInput) return;
            pendingProbe = {requestId: pendingInput.requestId, probeId: ++nextProbeId};
            // Arm before dispatch: even a synchronous test transport may reply.
            inputProbeTimer = clock.setTimeout(() => {
                inputProbeTimer = null;
                if (!settled && pendingInput && pendingProbe) {
                    finish('timeout', {reason: 'input-unresponsive'});
                }
            }, inputProbeTimeoutMs);
            try {
                worker.postMessage({type: 'input-ping', runId: id, ...pendingProbe});
            } catch (error) {
                finish('error', {error: messageFor(error)});
            }
        }, inputProbeIntervalMs);
    };
    const failProtocol = text => finish('error', {error: text});
    const receive = event => {
        if (settled) return;
        const data = event && event.data;
        if (!data || data.runId !== id) return;
        if (data.type === 'out') {
            if (typeof data.text !== 'string') return failProtocol('Worker output must be text.');
            const available = Math.max(0, maxOutputChars - totalOutputChars);
            const accepted = data.text.slice(0, available);
            output += accepted;
            totalOutputChars += accepted.length;
            outputDirty = outputDirty || accepted.length > 0;
            if (data.text.length > available) {
                truncated = true;
                outputDirty = true;
                finish('output-limit');
            } else if (outputDirty && flushTimer === null) {
                flushTimer = clock.setTimeout(() => {
                    flushTimer = null;
                    if (!settled) notifyOutput();
                }, flushIntervalMs);
            }
        } else if (data.type === 'output-reset') {
            output = '';
            outputDirty = true;
            notifyOutput(true);
        } else if (data.type === 'done') {
            finish('completed');
        } else if (data.type === 'error') {
            finish('error', {error: messageFor(data.text)});
        } else if (data.type === 'output-limit') {
            truncated = true;
            outputDirty = true;
            finish('output-limit');
        } else if (data.type === 'input') {
            const validId = (typeof data.requestId === 'string' && data.requestId.length > 0 &&
                data.requestId.length <= 128) ||
                (Number.isSafeInteger(data.requestId) && data.requestId >= 0);
            if (!validId || typeof data.prompt !== 'string' || data.prompt.length > 4096 ||
                pendingInput || inputIds.has(data.requestId) || inputIds.size >= 1000 ||
                (data.pauseBudget !== undefined && typeof data.pauseBudget !== 'boolean')) {
                return failProtocol('Invalid or overlapping worker input request.');
            }
            if (!setInputBudget(data.pauseBudget !== false)) return;
            inputIds.add(data.requestId);
            pendingInput = {runId: id, requestId: data.requestId, prompt: data.prompt};
            notifyOutput();
            if (settled) return;
            scheduleInputProbe();
            try { onInput(pendingInput); } catch (error) { finish('error', {error: messageFor(error)}); }
        } else if (data.type === 'input-state') {
            if (!pendingInput || data.requestId !== pendingInput.requestId) return;
            if (typeof data.pauseBudget !== 'boolean') return failProtocol('Invalid worker input state.');
            setInputBudget(data.pauseBudget);
        } else if (data.type === 'input-pong') {
            if (!pendingInput || !pendingProbe || data.requestId !== pendingInput.requestId ||
                data.requestId !== pendingProbe.requestId || data.probeId !== pendingProbe.probeId) return;
            if (inputProbeTimer !== null) clock.clearTimeout(inputProbeTimer);
            inputProbeTimer = null;
            pendingProbe = null;
            scheduleInputProbe();
        }
    };
    const replyToInput = (requestId, value) => {
        if (settled || !pendingInput || pendingInput.requestId !== requestId || typeof value !== 'string') return false;
        if (value.length > 65536) {
            finish('error', {error: 'Input exceeds the preview limit.'});
            return false;
        }
        clearInput();
        if (settled || !armBudget()) return false;
        try {
            worker.postMessage({type: 'input-reply', runId: id, requestId, value});
            return true;
        } catch (error) {
            finish('error', {error: messageFor(error)});
            return false;
        }
    };
    const session = {
        id,
        promise,
        stop: (reason = 'stopped') => finish('stopped', {reason}),
        dispose: () => finish('stopped', {reason: 'disposed'}),
        replyToInput
    };

    Promise.resolve().then(() => {
        if (settled) return null;
        return typeof workerSource === 'function' ? workerSource() : workerSource;
    }).then(source => {
        if (settled) return;
        if (typeof source !== 'string' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
            !Number.isSafeInteger(maxOutputChars) || maxOutputChars <= 0 ||
            !Number.isFinite(flushIntervalMs) || flushIntervalMs < 0 ||
            !Number.isFinite(inputProbeIntervalMs) || inputProbeIntervalMs <= 0 ||
            !Number.isFinite(inputProbeTimeoutMs) || inputProbeTimeoutMs <= 0) {
            finish('unavailable', {error: 'Invalid code execution session configuration.'});
            return;
        }
        const resource = createWorker(source);
        worker = resource.worker;
        release = typeof resource.release === 'function' ? resource.release : null;
        if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function') {
            finish('unavailable', {error: 'Worker creation did not return an executable worker.'});
            return;
        }
        worker.onmessage = receive;
        worker.onerror = event => {
            if (event && event.preventDefault) event.preventDefault();
            finish('error', {error: messageFor(event && event.message)});
        };
        worker.onmessageerror = event => {
            if (event && event.preventDefault) event.preventDefault();
            finish('error', {error: 'Worker message could not be read.'});
        };
        if (armBudget()) worker.postMessage({type: 'run', runId: id, code, maxOutputChars});
    }).catch(error => {
        if (!settled) finish(worker ? 'error' : 'unavailable', {error: messageFor(error)});
    });
    return session;
};
