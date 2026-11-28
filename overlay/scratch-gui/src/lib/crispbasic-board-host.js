// SPDX-License-Identifier: BSD-3-Clause
// GUI-owned electrical adapter. The standalone CrispBASIC package has no
// dependency on bw-board or on the editor's circuit ownership protocol.
import {getDevice} from 'bw-board/devices.js';

const MS_NS = 1000000n;
const SAFE_NS = BigInt(Number.MAX_SAFE_INTEGER);
const MODES = Object.freeze(['input', 'output', 'input-pullup']);
const SUPPORTED = new Set(['mcu', 'arduino_uno', 'arduino_nano', 'arduino_mega', 'pi_pico']);
const unavailable = message => Object.assign(new Error(message), {code: 'unavailable'});

function logicalPin(kind, terminal) {
    let match;
    if (kind === 'mcu') {
        match = /^p([0-7])\.([0-7])$/i.exec(terminal);
        return match ? Number(match[1]) * 8 + Number(match[2]) : null;
    }
    if (kind === 'pi_pico') {
        match = /^gp(\d+)$/i.exec(terminal);
        const pin = match ? Number(match[1]) : -1;
        return (pin >= 0 && pin <= 22) || pin === 25 || (pin >= 26 && pin <= 28) ? pin : null;
    }
    const mega = kind === 'arduino_mega';
    match = /^d(\d+)$/i.exec(terminal);
    if (match && Number(match[1]) <= (mega ? 53 : 13)) return Number(match[1]);
    match = /^a(\d+)$/i.exec(terminal);
    // Nano A6/A7 have no digital GPIO. They never enter this bridge's map.
    if (match && Number(match[1]) <= (mega ? 15 : 5)) return (mega ? 54 : 14) + Number(match[1]);
    return null;
}

/** Logical IDs are board GPIO numbers, never physical header positions.
 * Only one controller is admitted: bw-board's unqualified GPIO namespace is
 * shared, and qualifying a board pin would use the bench supply voltage rather
 * than that controller model's logic voltage.
 */
export function resolveCrispBasicPinMap(board) {
    if (!board || !Array.isArray(board.parts) || !Array.isArray(board.nets)) {
        throw unavailable('Open a supported circuit in the Circuit tab first');
    }
    const controllers = board.parts.filter(part => part &&
        (SUPPORTED.has(part.kind) || getDevice(part.kind)?.gpioFollowsPinStates));
    if (controllers.length !== 1) {
        throw unavailable('BASIC circuit simulation requires exactly one GPIO controller');
    }
    const controller = controllers[0];
    if (!SUPPORTED.has(controller.kind)) {
        throw unavailable(`BASIC circuit simulation does not support ${controller.kind}`);
    }
    if (controller.kind !== 'mcu' && !getDevice(controller.kind)?.gpioFollowsPinStates) {
        throw unavailable(`The circuit engine has not registered ${controller.kind}`);
    }
    if (!Array.isArray(controller.terminals)) throw unavailable('The circuit controller has no terminal map');
    const seen = new Set();
    const pinMap = [];
    for (const terminal of controller.terminals) {
        if (typeof terminal !== 'string') throw unavailable('The circuit controller has an invalid terminal');
        const pin = logicalPin(controller.kind, terminal);
        if (pin === null) continue;
        if (seen.has(pin)) throw unavailable(`The circuit controller has duplicate logical pin ${pin}`);
        seen.add(pin);
        pinMap.push(Object.freeze({pin, terminal}));
    }
    if (!pinMap.length || pinMap.length > 256) throw unavailable('The circuit controller has no supported digital pins');
    pinMap.sort((a, b) => a.pin - b.pin);
    return Object.freeze({
        controller: Object.freeze({id: controller.id, kind: controller.kind}),
        pins: Object.freeze(pinMap.map(entry => entry.pin)),
        pinMap: Object.freeze(pinMap)
    });
}

/** Fresh run host, constructed only after the GUI has acquired the Designer.
 * Keeps the circuit's component state and controls; FNmillis starts at zero
 * relative to the acquired board time. Never calls board.reset(), which would
 * revoke someone else's clock lease. Solver batches yield outside lease.run().
 */
export function createCrispBasicBoardHost({board, signal, SimulationError,
    maxTimeMs = 60000, maxSolverSteps = 65536, maxTraceEvents = 4096,
    maxStepsPerBatch = 16, yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)),
    onInvalidate = () => {}} = {}) {
    if (typeof SimulationError !== 'function') throw new TypeError('SimulationError constructor is required');
    const fail = (code, message) => { throw new SimulationError(code, message); };
    const limit = (value, minimum, maximum, name) => {
        if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
            throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}`);
        }
    };
    limit(maxTimeMs, 0, 0x7fffffff, 'maxTimeMs');
    limit(maxSolverSteps, 1, 1000000, 'maxSolverSteps');
    limit(maxTraceEvents, 1, 1000000, 'maxTraceEvents');
    limit(maxStepsPerBatch, 1, 128, 'maxStepsPerBatch');
    if (typeof yieldTask !== 'function') throw new TypeError('yieldTask must be a function');
    if (typeof onInvalidate !== 'function') throw new TypeError('onInvalidate must be a function');
    if (!signal || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function') {
        throw new TypeError('An AbortSignal is required');
    }
    if (signal.aborted) fail('disposed', 'BASIC circuit run was cancelled');
    for (const method of ['getTime', 'setPin', 'readPin', 'readAnalog', 'setPower', 'advanceToLive',
        'claimExternalClock', 'onChange', 'offChange']) {
        if (typeof board?.[method] !== 'function') fail('unavailable', `Circuit engine is missing ${method}`);
    }
    const mapping = resolveCrispBasicPinMap(board);
    const origin = board.getTime();
    if (typeof origin !== 'bigint' || origin < 0n || origin > SAFE_NS || typeof board.powered !== 'boolean') {
        fail('unavailable', 'The circuit has an invalid simulation clock or power state');
    }
    const parts = board.parts;
    const nets = board.nets;
    const oldPower = board.powered;
    const pinStates = new Map(mapping.pinMap.map(({pin, terminal}) => [pin, {terminal, mode: 'input', latch: 0}]));
    const ownedPins = new Set(mapping.pinMap.map(({terminal}) => terminal.toLowerCase()));
    const trace = [];
    let lease, disposed = false, pending = false, internal = false, invalidated = false;
    let interfered = false, externalPowerChange = false;
    let lastTime = origin, solverSteps = 0, elapsedMs = 0, terminalFailure = null;
    let cleanupDone = false, cleanupFinished = false, disposalFailed = false, disposalFailure;
    const capabilities = Object.freeze({
        schemaVersion: 1, backend: 'brickwright-board-simulation', hardware: false,
        basicBridge: false, circuitPhysics: true, digitalPins: true,
        analogPins: false, pwm: false, interrupts: false,
        clock: 'explicit-integer-milliseconds', digitalRead: 'solved-electrical-level',
        floatingInputs: 'solver-default', pinModes: MODES, ...mapping,
        limits: Object.freeze({maxTimeMs, maxSolverSteps, maxTraceEvents, maxStepsPerBatch})
    });
    const topologyCurrent = () => board.parts === parts && board.nets === nets && !invalidated;
    const changed = event => {
        let message;
        if (event?.type === 'netlist' || event?.type === 'reset') {
            invalidated = true;
            message = 'The circuit changed; BASIC stopped';
        } else if (!internal && event?.type === 'pin') {
            interfered = true;
            const terminal = String(event.detail?.pin).toLowerCase();
            ownedPins.delete(terminal);
            const prefix = `${String(mapping.controller.id).toLowerCase()}.`;
            if (terminal.startsWith(prefix)) ownedPins.delete(terminal.slice(prefix.length));
            message = 'Another controller changed a circuit pin; BASIC stopped';
        } else if (!internal && event?.type === 'power') {
            interfered = true;
            externalPowerChange = true;
            message = 'Circuit power changed; BASIC stopped';
        }
        if (!message || disposed) return;
        try { onInvalidate(new Error(message)); } catch (error) {
            if (!disposalFailed) { disposalFailed = true; disposalFailure = error; }
            try { dispose(); } catch { /* Retained for the parent disposer. */ }
        }
    };
    const ready = () => {
        if (disposed || signal.aborted) fail('disposed', 'BASIC circuit run was cancelled or disposed');
        if (terminalFailure) throw terminalFailure;
        if (!lease?.isActive() || !topologyCurrent() || interfered || board.getTime() !== lastTime) {
            fail('unavailable', 'The circuit changed or its simulation clock was replaced; run BASIC again');
        }
    };
    const budgetFailure = (code, message) => {
        terminalFailure = new SimulationError(code, message);
        throw terminalFailure;
    };
    const reserve = () => {
        if (trace.length >= maxTraceEvents) budgetFailure('trace-limit', 'BASIC circuit trace limit reached');
    };
    const record = (type, fields = {}) => trace.push(Object.freeze({sequence: trace.length + 1,
        atMs: elapsedMs, type, ...fields}));
    const synchronous = action => {
        ready();
        internal = true;
        try { return lease.run(action); } finally {
            internal = false;
            // Board change observers may synchronously cancel this request.
            // Mark it disposed immediately, then release drives only after
            // lease.run has unwound; nested lease work is correctly refused.
            if (disposed && !cleanupDone) dispose();
        }
    };
    const validateReceipt = (receipt, started, target, steps) => {
        const processed = board.getTime();
        if (!receipt || receipt.startedTimeNs !== started.toString() || receipt.requestedTimeNs !== target.toString() ||
            typeof processed !== 'bigint' || processed < started || processed > target ||
            receipt.processedTimeNs !== processed.toString() || receipt.completed !== (processed === target) ||
            receipt.maxSteps !== steps || !Number.isSafeInteger(receipt.steps) || receipt.steps < 0 || receipt.steps > steps ||
            (target > started && (processed <= started || receipt.steps === 0)) ||
            (target === started && (processed !== started || receipt.steps !== 0))) {
            throw new Error('Circuit solver returned an invalid advancement receipt');
        }
        lastTime = processed;
        solverSteps += receipt.steps;
        elapsedMs = Number((processed - origin) / MS_NS);
        ready();
    };
    const checkInstant = () => {
        const started = lastTime;
        const receipt = synchronous(() => board.advanceToLive(started, {maxSteps: 1}));
        validateReceipt(receipt, started, started, 1);
    };
    const pin = id => {
        ready();
        if (pending) fail('unavailable', 'A BASIC circuit delay is already pending');
        if (!Number.isSafeInteger(id) || !pinStates.has(id)) fail('invalid-pin', `Unknown logical circuit pin: ${String(id)}`);
        return pinStates.get(id);
    };
    const dispose = () => {
        disposed = true;
        if (internal) return;
        if (cleanupDone) {
            if (disposalFailed) throw disposalFailure;
            return;
        }
        cleanupDone = true;
        const attempt = action => {
            try { action(); } catch (error) {
                if (!disposalFailed) { disposalFailed = true; disposalFailure = error; }
            }
        };
        attempt(() => signal.removeEventListener('abort', abort));
        attempt(() => board.offChange(changed));
        let owns = false;
        attempt(() => { owns = lease?.isActive() && topologyCurrent(); });
        // A reset/replacement invalidates the lease. Its new owner must not
        // receive the old run's final writes or power change.
        if (owns) {
            for (const {terminal} of pinStates.values()) {
                if (ownedPins.has(terminal.toLowerCase())) {
                    attempt(() => lease.run(() => board.setPin(terminal, 'input', false)));
                }
            }
            // A user who has just turned the circuit off keeps that choice.
            if (board.powered && !externalPowerChange) attempt(() => lease.run(() => board.setPower(oldPower)));
        }
        attempt(() => lease?.release());
        cleanupFinished = true;
        if (disposalFailed) throw disposalFailure;
    };
    const abort = () => { try { dispose(); } catch { /* The parent invokes dispose too; no deferred effect may survive. */ } };

    try {
        lease = board.claimExternalClock();
        if (!lease || ['run', 'isActive', 'release'].some(name => typeof lease[name] !== 'function')) {
            throw new Error('Circuit engine returned an invalid clock lease');
        }
        board.onChange(changed);
        signal.addEventListener('abort', abort, {once: true});
        ready();
        checkInstant();
        for (const {terminal} of pinStates.values()) synchronous(() => board.setPin(terminal, 'input', false));
        synchronous(() => board.setPower(true));
        checkInstant();
    } catch (error) {
        try { dispose(); } catch { /* Preserve the original initialization failure. */ }
        throw error;
    }

    return Object.freeze({
        get state() { return disposed ? 'disposed' : 'ready'; },
        // `state` changes immediately inside a solver callback. Model edits
        // must wait until all synchronous pin/clock cleanup has unwound;
        // dispose() still reports any retained failure after completion.
        get cleanupComplete() { return cleanupFinished; },
        capabilities,
        get trace() { return Object.freeze(trace.slice()); },
        get solverSteps() { return solverSteps; },
        pinMode(id, mode) {
            const target = pin(id);
            if (!MODES.includes(mode)) fail('invalid-mode', `Pin mode must be one of: ${MODES.join(', ')}`);
            reserve();
            synchronous(() => board.setPin(target.terminal, mode === 'output' ? 'pushpull' : mode, target.latch === 1));
            checkInstant();
            target.mode = mode;
            record('pin-mode', {pin: id, terminal: target.terminal, mode});
        },
        digitalWrite(id, value) {
            const target = pin(id);
            if (value !== 0 && value !== 1) fail('invalid-level', 'Digital level must be 0 or 1');
            if (target.mode !== 'output') fail('pin-not-output', `Pin ${id} is not configured as an output`);
            reserve();
            synchronous(() => board.setPin(target.terminal, 'pushpull', value === 1));
            checkInstant();
            target.latch = value;
            record('digital-write', {pin: id, terminal: target.terminal, value});
        },
        digitalRead(id) {
            const target = pin(id);
            reserve();
            checkInstant();
            const voltage = synchronous(() => board.readAnalog(target.terminal));
            const value = synchronous(() => board.readPin(target.terminal));
            if (!Number.isFinite(voltage) || (value !== 0 && value !== 1)) throw new Error('Circuit solver returned an invalid pin reading');
            record('digital-read', {pin: id, terminal: target.terminal, value});
            return value;
        },
        async delay(milliseconds) {
            ready();
            if (pending) fail('unavailable', 'A BASIC circuit delay is already pending');
            if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 0x7fffffff) {
                fail('invalid-time', 'Delay must be an integer from 0 to 2147483647 milliseconds');
            }
            const fromMs = elapsedMs;
            const untilMs = elapsedMs + milliseconds;
            const target = origin + BigInt(untilMs) * MS_NS;
            if (untilMs > maxTimeMs || target > SAFE_NS) budgetFailure('time-limit', 'BASIC circuit simulation time limit reached');
            reserve();
            pending = true;
            try {
                checkInstant();
                while (lastTime < target) {
                    ready();
                    const remaining = maxSolverSteps - solverSteps;
                    if (remaining <= 0) budgetFailure('solver-limit', 'BASIC circuit solver step limit reached');
                    const batch = Math.min(maxStepsPerBatch, remaining);
                    const started = lastTime;
                    const receipt = synchronous(() => board.advanceToLive(target, {maxSteps: batch}));
                    validateReceipt(receipt, started, target, batch);
                    if (!receipt.completed) {
                        if (solverSteps >= maxSolverSteps) budgetFailure('solver-limit', 'BASIC circuit solver step limit reached');
                        await yieldTask();
                        ready();
                    }
                }
                elapsedMs = untilMs;
                record('delay', {fromMs, milliseconds});
            } finally { pending = false; }
        },
        millis() {
            ready();
            if (pending) fail('unavailable', 'A BASIC circuit delay is already pending');
            return elapsedMs;
        },
        dispose
    });
}
