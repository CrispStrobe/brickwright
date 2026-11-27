// Original code, BSD-3-Clause. A logical digital-pin reference host, not an
// electrical solver or a bridge from BASIC to JavaScript. See SIMULATION.md.
const MAX_TIME_MS = 0x7fffffff;
const MAX_EVENTS = 1000000;
const MODES = Object.freeze(['input', 'output', 'input-pullup']);

export const SIMULATION_CAPABILITIES = Object.freeze({
    schemaVersion: 1,
    backend: 'deterministic-digital-simulation',
    hardware: false,
    basicBridge: false,
    circuitPhysics: false,
    digitalPins: true,
    analogPins: false,
    pwm: false,
    interrupts: false,
    clock: 'explicit-integer-milliseconds',
    pinModes: MODES
});

export class SimulationError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'SimulationError';
        this.code = code;
    }
}

function fail(code, message) { throw new SimulationError(code, message); }

function integer(value, minimum, maximum, code, name) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        fail(code, `${name} must be an integer from ${minimum} to ${maximum}`);
    }
    return value;
}

function level(value, nullable = false) {
    if (value !== 0 && value !== 1 && !(nullable && value === null)) {
        fail('invalid-level', nullable ? 'input level must be 0, 1 or null (released)' : 'digital level must be 0 or 1');
    }
    return value;
}

/** Synchronous, deterministic reference implementation for the future
 * physical-computing host boundary. It has no interpreter, DOM, timers or I/O.
 */
export class SimulationHost {
    #pins;
    #clock = 0;
    #trace = [];
    #scheduled = [];
    #disposed = false;
    #capabilities;

    constructor({pins = [0, 1, 2, 3, 4, 5, 6, 7], maxTraceEvents = 4096,
        maxScheduledInputs = 4096, maxTimeMs = MAX_TIME_MS} = {}) {
        if (!Array.isArray(pins) || pins.length < 1 || pins.length > 256) {
            fail('invalid-pins', 'pins must be an array containing 1 to 256 distinct logical pin IDs');
        }
        const ids = Array.from(pins, pin => integer(pin, 0, 65535, 'invalid-pin', 'pin ID'));
        if (new Set(ids).size !== ids.length) fail('invalid-pins', 'logical pin IDs must be distinct');
        integer(maxTraceEvents, 1, MAX_EVENTS, 'invalid-limit', 'maxTraceEvents');
        integer(maxScheduledInputs, 1, MAX_EVENTS, 'invalid-limit', 'maxScheduledInputs');
        integer(maxTimeMs, 0, MAX_TIME_MS, 'invalid-limit', 'maxTimeMs');
        this.#pins = new Map(ids.map(pin => [pin, {mode: 'input', latch: 0, input: null}]));
        this.#capabilities = Object.freeze({...SIMULATION_CAPABILITIES,
            pins: Object.freeze(ids),
            limits: Object.freeze({maxTraceEvents, maxScheduledInputs, maxTimeMs})
        });
    }

    get state() { return this.#disposed ? 'disposed' : 'ready'; }
    get capabilities() { return this.#capabilities; }
    get trace() { return Object.freeze(this.#trace.slice()); }
    get pendingInputs() { return this.#scheduled.length; }

    #ready() {
        if (this.#disposed) fail('disposed', 'simulation host is disposed');
    }

    #pin(pin) {
        this.#ready();
        if (!Number.isInteger(pin) || !this.#pins.has(pin)) fail('invalid-pin', `unknown logical pin: ${String(pin)}`);
        return this.#pins.get(pin);
    }

    #reserve(count = 1) {
        if (this.#trace.length + count > this.#capabilities.limits.maxTraceEvents) {
            fail('trace-limit', 'simulation trace limit reached');
        }
    }

    #record(type, fields = {}) {
        this.#trace.push(Object.freeze({sequence: this.#trace.length + 1, atMs: this.#clock, type, ...fields}));
    }

    pinMode(pin, mode) {
        const target = this.#pin(pin);
        if (!MODES.includes(mode)) fail('invalid-mode', `pin mode must be one of: ${MODES.join(', ')}`);
        this.#reserve();
        target.mode = mode;
        this.#record('pin-mode', {pin, mode});
    }

    digitalWrite(pin, value) {
        const target = this.#pin(pin);
        level(value);
        if (target.mode !== 'output') fail('pin-not-output', `pin ${pin} is not configured as an output`);
        this.#reserve();
        target.latch = value;
        this.#record('digital-write', {pin, value});
    }

    digitalRead(pin) {
        const target = this.#pin(pin);
        const value = target.mode === 'output' ? target.latch :
            target.input ?? (target.mode === 'input-pullup' ? 1 : null);
        if (value === null) fail('floating-input', `pin ${pin} has no input stimulus or pull-up`);
        this.#reserve();
        this.#record('digital-read', {pin, value});
        return value;
    }

    /** Apply an external logical stimulus. null releases it. Stimuli remain
     * stored while output mode reads its own latch; this is not contention
     * modelling and makes no claim about real circuit voltage or current.
     */
    setInput(pin, value) {
        const target = this.#pin(pin);
        level(value, true);
        this.#reserve();
        target.input = value;
        this.#record('input', {pin, value});
    }

    /** Queue a stimulus at an absolute simulated time. Equal-time records
     * retain insertion order. Even at the current time, apply on delay(0).
     */
    scheduleInput(pin, value, atMs) {
        this.#pin(pin);
        level(value, true);
        integer(atMs, this.#clock, this.#capabilities.limits.maxTimeMs, 'invalid-time', 'atMs');
        if (this.#scheduled.length === this.#capabilities.limits.maxScheduledInputs) {
            fail('input-limit', 'scheduled input limit reached');
        }
        // JS Array.sort is stable: equal timestamps preserve insertion order.
        this.#scheduled.push({pin, value, atMs});
        this.#scheduled.sort((left, right) => left.atMs - right.atMs);
    }

    delay(milliseconds) {
        this.#ready();
        integer(milliseconds, 0, MAX_TIME_MS, 'invalid-time', 'delay');
        const until = this.#clock + milliseconds;
        if (until > this.#capabilities.limits.maxTimeMs) fail('time-limit', 'simulation time limit reached');
        let count = 0;
        while (count < this.#scheduled.length && this.#scheduled[count].atMs <= until) count++;
        // Budget the complete advance before modifying time, pins or queue.
        this.#reserve(count + 1);
        const fromMs = this.#clock;
        for (const event of this.#scheduled.splice(0, count)) {
            this.#clock = event.atMs;
            this.#pins.get(event.pin).input = event.value;
            this.#record('input', {pin: event.pin, value: event.value});
        }
        this.#clock = until;
        this.#record('delay', {fromMs, milliseconds});
    }

    millis() {
        this.#ready();
        return this.#clock;
    }

    /** Reset the run, retaining configured logical IDs and resource limits. */
    reset() {
        this.#ready();
        this.#clock = 0;
        this.#trace = [];
        this.#scheduled = [];
        for (const pin of this.#pins.values()) {
            pin.mode = 'input';
            pin.latch = 0;
            pin.input = null;
        }
    }

    /** Idempotent; retain the final trace for inspection and release stimuli. */
    dispose() {
        this.#disposed = true;
        this.#scheduled = [];
    }
}

export function createSimulationHost(options) { return new SimulationHost(options); }
