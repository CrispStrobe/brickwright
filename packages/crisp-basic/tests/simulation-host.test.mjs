import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulationHost, SimulationError, SIMULATION_CAPABILITIES} from '../src/simulation-host.mjs';

const refuses = (fn, code) => assert.throws(fn, error => {
    assert.ok(error instanceof SimulationError);
    assert.equal(error.code, code);
    return true;
});

test('digital pin operations produce fixed logical levels and timestamped traces', () => {
    const host = createSimulationHost();
    host.pinMode(2, 'output');
    host.digitalWrite(2, 1);
    host.delay(25);
    host.digitalWrite(2, 0);
    assert.equal(host.digitalRead(2), 0);
    assert.equal(host.millis(), 25);
    assert.deepEqual(host.trace, [
        {sequence: 1, atMs: 0, type: 'pin-mode', pin: 2, mode: 'output'},
        {sequence: 2, atMs: 0, type: 'digital-write', pin: 2, value: 1},
        {sequence: 3, atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25},
        {sequence: 4, atMs: 25, type: 'digital-write', pin: 2, value: 0},
        {sequence: 5, atMs: 25, type: 'digital-read', pin: 2, value: 0}
    ]);
});

test('floating inputs refuse; pull-ups and explicit release have distinct semantics', () => {
    const host = createSimulationHost();
    refuses(() => host.digitalRead(0), 'floating-input');
    refuses(() => host.digitalWrite(0, 1), 'pin-not-output');
    assert.deepEqual(host.trace, []);
    host.pinMode(0, 'input-pullup');
    assert.equal(host.digitalRead(0), 1);
    host.setInput(0, 0);
    assert.equal(host.digitalRead(0), 0);
    host.setInput(0, null);
    assert.equal(host.digitalRead(0), 1);
    host.pinMode(0, 'input');
    refuses(() => host.digitalRead(0), 'floating-input');
});

test('output latch and input stimulus are independent, with no circuit contention claims', () => {
    const host = createSimulationHost();
    host.setInput(0, 1);
    host.pinMode(0, 'output');
    assert.equal(host.digitalRead(0), 0); // Defined initial latch.
    host.digitalWrite(0, 1);
    host.setInput(0, 0);
    assert.equal(host.digitalRead(0), 1);
    host.pinMode(0, 'input');
    assert.equal(host.digitalRead(0), 0);
    host.pinMode(0, 'output');
    assert.equal(host.digitalRead(0), 1); // Mode changes retain the latch.
});

test('scheduled stimuli apply in chronological and stable equal-time order', () => {
    const host = createSimulationHost();
    host.scheduleInput(1, 1, 20);
    host.scheduleInput(1, 1, 10);
    host.scheduleInput(1, 0, 10);
    host.scheduleInput(1, null, 21);
    host.delay(10);
    assert.equal(host.digitalRead(1), 0);
    assert.equal(host.pendingInputs, 2);
    host.delay(10);
    assert.equal(host.digitalRead(1), 1);
    host.delay(1);
    refuses(() => host.digitalRead(1), 'floating-input');
    assert.deepEqual(host.trace.filter(event => event.type === 'input').map(({atMs, value}) => ({atMs, value})), [
        {atMs: 10, value: 1}, {atMs: 10, value: 0}, {atMs: 20, value: 1}, {atMs: 21, value: null}
    ]);
    assert.equal(host.millis(), 21);
});

test('current-time scheduled inputs remain queued until an explicit zero delay', () => {
    const host = createSimulationHost();
    host.scheduleInput(3, 1, 0);
    refuses(() => host.digitalRead(3), 'floating-input');
    assert.equal(host.pendingInputs, 1);
    host.delay(0);
    assert.equal(host.digitalRead(3), 1);
    assert.equal(host.millis(), 0);
});

test('trace limit refuses an entire time advance atomically, including due stimuli', () => {
    const host = createSimulationHost({maxTraceEvents: 3});
    host.scheduleInput(0, 1, 2);
    host.scheduleInput(0, 0, 3);
    host.setInput(0, 0);
    refuses(() => host.delay(3), 'trace-limit'); // Would need three more records.
    assert.equal(host.millis(), 0);
    assert.equal(host.pendingInputs, 2);
    assert.deepEqual(host.trace, [{sequence: 1, atMs: 0, type: 'input', pin: 0, value: 0}]);
    assert.equal(host.digitalRead(0), 0);
    refuses(() => host.delay(2), 'trace-limit');
    assert.equal(host.pendingInputs, 2);
});

test('pin mode and write refusal at a trace limit do not change the completed trace', () => {
    const host = createSimulationHost({maxTraceEvents: 2});
    host.pinMode(0, 'output');
    host.digitalWrite(0, 1);
    const finished = host.trace;
    refuses(() => host.pinMode(0, 'input'), 'trace-limit');
    refuses(() => host.digitalWrite(0, 0), 'trace-limit');
    refuses(() => host.digitalRead(0), 'trace-limit');
    assert.deepEqual(host.trace, finished);
    host.reset();
    assert.deepEqual(host.trace, []);
});

test('time and queue limits preserve current time, trace and pending inputs', () => {
    const host = createSimulationHost({maxTimeMs: 10, maxScheduledInputs: 1});
    host.scheduleInput(0, 1, 10);
    refuses(() => host.scheduleInput(1, 0, 1), 'input-limit');
    refuses(() => host.delay(11), 'time-limit');
    assert.equal(host.millis(), 0);
    assert.equal(host.pendingInputs, 1);
    assert.deepEqual(host.trace, []);
    host.delay(10);
    assert.equal(host.digitalRead(0), 1);
    refuses(() => host.scheduleInput(0, 0, 9), 'invalid-time');
    refuses(() => host.scheduleInput(0, 0, 11), 'invalid-time');
    refuses(() => host.delay(1), 'time-limit');
    assert.equal(host.millis(), 10);
    assert.equal(host.pendingInputs, 0);
});

test('invalid pins, modes, levels and durations never coerce or silently clamp', () => {
    const host = createSimulationHost({pins: [3, 42]});
    for (const pin of [-1, 0, '3', 3.5, NaN, Infinity, undefined]) {
        refuses(() => host.pinMode(pin, 'output'), 'invalid-pin');
    }
    for (const mode of ['OUTPUT', 1, null, 'analog']) refuses(() => host.pinMode(3, mode), 'invalid-mode');
    for (const value of [2, -1, true, false, '0', NaN, undefined]) {
        refuses(() => host.setInput(3, value), 'invalid-level');
    }
    for (const duration of [-1, 0.1, '1', NaN, Infinity, 0x80000000]) {
        refuses(() => host.delay(duration), 'invalid-time');
    }
    assert.deepEqual(host.trace, []);
    assert.equal(host.millis(), 0);
});

test('constructor rejects invalid pin maps and unbounded resource options', () => {
    for (const pins of [[], [0, 0], new Uint8Array([0]), Array.from({length: 257}, (_, i) => i)]) {
        refuses(() => createSimulationHost({pins}), 'invalid-pins');
    }
    for (const pins of [[-1], [65536], ['0'], [0.5], Array(1)]) refuses(() => createSimulationHost({pins}), 'invalid-pin');
    for (const options of [{maxTraceEvents: 0}, {maxTraceEvents: 1000001}, {maxScheduledInputs: Infinity},
        {maxScheduledInputs: 0}, {maxTimeMs: -1}, {maxTimeMs: 0x80000000}]) {
        refuses(() => createSimulationHost(options), 'invalid-limit');
    }
});

test('capabilities and trace snapshots cannot mutate the host', () => {
    const pins = [5, 10];
    const host = createSimulationHost({pins});
    pins[0] = 99;
    host.pinMode(5, 'output');
    const before = host.trace;
    assert.throws(() => before.push({type: 'fake'}), TypeError);
    assert.throws(() => { before[0].mode = 'input'; }, TypeError);
    assert.throws(() => { host.capabilities.limits.maxTraceEvents = Infinity; }, TypeError);
    assert.throws(() => host.capabilities.pins.push(99), TypeError);
    assert.throws(() => SIMULATION_CAPABILITIES.pinModes.push('analog'), TypeError);
    host.digitalWrite(5, 1);
    assert.equal(before.length, 1);
    assert.equal(host.trace.length, 2);
    assert.deepEqual(host.capabilities.pins, [5, 10]);
    assert.equal(host.capabilities.basicBridge, false);
    assert.equal(host.capabilities.hardware, false);
    assert.equal(host.capabilities.circuitPhysics, false);
});

test('reset retains configuration, clears stimuli and reproduces the same trace', () => {
    const host = createSimulationHost({pins: [42], maxTimeMs: 50});
    const run = () => {
        host.pinMode(42, 'output');
        host.digitalWrite(42, 1);
        host.delay(10);
        return host.trace;
    };
    const before = run();
    host.scheduleInput(42, 0, 30);
    host.reset();
    assert.equal(host.pendingInputs, 0);
    assert.equal(host.millis(), 0);
    refuses(() => host.digitalRead(42), 'floating-input');
    refuses(() => host.pinMode(0, 'output'), 'invalid-pin');
    assert.equal(host.capabilities.limits.maxTimeMs, 50);
    assert.deepEqual(run(), before);
});

test('separate hosts have independent state; disposal is final and idempotent', () => {
    const first = createSimulationHost();
    const second = createSimulationHost();
    first.pinMode(0, 'output');
    first.digitalWrite(0, 1);
    first.delay(4);
    first.scheduleInput(1, 1, 5);
    const finalTrace = first.trace;
    refuses(() => second.digitalRead(0), 'floating-input');
    assert.equal(second.millis(), 0);
    first.dispose();
    first.dispose();
    assert.equal(first.state, 'disposed');
    assert.equal(first.pendingInputs, 0);
    assert.deepEqual(first.trace, finalTrace);
    for (const call of [() => first.pinMode(0, 'input'), () => first.digitalWrite(0, 0),
        () => first.digitalRead(0), () => first.setInput(0, 0), () => first.scheduleInput(0, 0, 0),
        () => first.delay(0), () => first.millis(), () => first.reset()]) refuses(call, 'disposed');
    assert.equal(second.state, 'ready');
});
