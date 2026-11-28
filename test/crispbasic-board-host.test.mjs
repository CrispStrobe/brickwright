// Real electrical solver and run ownership qualification for the GUI adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardImpl} from 'bw-board/board.js';
import {registerBoardKinds} from 'bw-board/devices/board-kinds.js';
import {SimulationError} from '../packages/crisp-basic/src/simulation-host.mjs';
import {createCrispBasicBoardHost, resolveCrispBasicPinMap} from '../overlay/scratch-gui/src/lib/crispbasic-board-host.js';

registerBoardKinds();
const MS = 1000000n;
const part = (id, kind, terminals, params = {}) => ({id, kind, terminals, params});
const terminal = (part, terminal) => ({part, terminal});
const net = (id, ...terminals) => ({id, terminals});
const hasCode = code => error => error instanceof SimulationError && error.code === code;

function circuit({kind = 'arduino_uno', output = 'd13', input = 'd2', vcc = 5, clamp = false} = {}) {
    const board = new BoardImpl(vcc);
    const ground = kind === 'pi_pico' ? 'gnd_1' : kind === 'microbit_breakout' ? 'gnd_l' : 'gnd';
    const parts = [
        part('controller', kind, [output, input, ground]),
        part('R', 'resistor', ['a', 'b'], {ohms: 1000}),
        part('LED', 'led', ['anode', 'cathode'], {vf: 2}),
        part('KEY', 'button', ['a', 'b']),
        part('ground', 'gnd', ['gnd'])
    ];
    const nets = [
        net('drive', terminal('controller', output), terminal('R', 'a')),
        net('light', terminal('R', 'b'), terminal('LED', 'anode')),
        net('sense', terminal('controller', input), terminal('KEY', 'a')),
        net('ground', terminal('controller', ground), terminal('LED', 'cathode'), terminal('KEY', 'b'), terminal('ground', 'gnd'))
    ];
    if (clamp) {
        parts.push(part('clamp', 'resistor', ['a', 'b'], {ohms: 1}));
        nets[0].terminals.push(terminal('clamp', 'a'));
        nets[3].terminals.push(terminal('clamp', 'b'));
    }
    board.setNetlist(parts, nets);
    return board;
}

function hostFor(board, options = {}) {
    const abort = new AbortController();
    const host = createCrispBasicBoardHost({board, signal: abort.signal, SimulationError, ...options});
    return {host, abort};
}

test('logical IDs use controller numbering and reject analog-only, absent, and duplicate pins', () => {
    const map = (kind, terminals) => resolveCrispBasicPinMap({parts: [part('cpu', kind, terminals)], nets: []});
    assert.deepEqual(map('arduino_uno', ['D13', 'A0', 'A5', 'GND', 'RESET']).pinMap,
        [{pin: 13, terminal: 'D13'}, {pin: 14, terminal: 'A0'}, {pin: 19, terminal: 'A5'}]);
    assert.deepEqual(map('arduino_nano', ['D0', 'A5', 'A6', 'A7']).pins, [0, 19]);
    assert.deepEqual(map('arduino_mega', ['D53', 'A0', 'A15']).pins, [53, 54, 69]);
    assert.deepEqual(map('pi_pico', ['GP0', 'GP22', 'GP23', 'GP25', 'GP28', 'GP29']).pins, [0, 22, 25, 28]);
    assert.deepEqual(map('mcu', ['P0.0', 'P1.0', 'P3.2', 'P7.7', 'RST']).pins, [0, 8, 26, 63]);
    assert.throws(() => map('arduino_uno', ['D13', 'd13']), /duplicate logical pin/);
    assert.throws(() => map('arduino_nano', ['A6', 'A7']), /no supported digital pins/);
    assert.throws(() => resolveCrispBasicPinMap({parts: [], nets: []}), /exactly one GPIO controller/);
    assert.throws(() => resolveCrispBasicPinMap({parts: [part('one', 'arduino_uno', ['d13']),
        part('two', 'pi_pico', ['gp0'])], nets: []}), /exactly one GPIO controller/);
    assert.deepEqual(map('microbit', ['P0', 'P2', '3V', 'GND']).pins, [0, 2]);
    assert.deepEqual(map('microbit_breakout', ['P8', 'P12', 'P16']).pins, [8, 12, 16]);
    assert.deepEqual(map('esp8266', ['GPIO2', 'GPIO6', 'GPIO16']).pins, [2]);
    assert.deepEqual(map('stm32f030', ['PA0', 'PA9', 'PB1', 'PF0', 'PA13']).pins, [0, 9, 17]);
    assert.deepEqual(map('pybadge', ['a0', 'rx', 'tx']).pins, [0, 1, 14]);
    assert.throws(() => map('pybadge', ['sda', 'stemma_sda']), /no supported digital pins/);
    assert.deepEqual(map('stc15_mcu', ['P5.5', 'P4.1']).pins, [33, 45]);
    assert.throws(() => map('microbit', ['P0', 'p0']), /duplicate logical pin/);
    assert.throws(() => map('attiny88', ['PA0', 'PA3']), /no supported digital pins/);
});

const expandedControllers = [
    {kind: 'stc15_mcu', output: 'P5.5', input: 'P4.1', outputId: 45, inputId: 33, voltage: 5},
    {kind: 'pybadge', output: 'd5', input: 'rx', outputId: 5, inputId: 0, voltage: 3.3},
    {kind: 'microbit', output: 'p0', input: 'p1', outputId: 0, inputId: 1, voltage: 3.3},
    {kind: 'microbit_breakout', output: 'p8', input: 'p16', outputId: 8, inputId: 16, voltage: 3.3},
    {kind: 'calliopemini', output: 'p3', input: 'p2', outputId: 3, inputId: 2, voltage: 3.3},
    {kind: 'circuit_playground_express', output: 'a7', input: 'a1', outputId: 7, inputId: 1, voltage: 3.3},
    {kind: 'esp8266', output: 'gpio2', input: 'gpio12', outputId: 2, inputId: 12, voltage: 3.3},
    {kind: 'esp32_4848s040', output: 'gpio40', input: 'gpio44', outputId: 40, inputId: 44, voltage: 3.3},
    {kind: 'attiny85', output: 'pb0', input: 'pb1', outputId: 8, inputId: 9, voltage: 5},
    {kind: 'attiny88', output: 'pd7', input: 'pc2', outputId: 31, inputId: 18, voltage: 5},
    {kind: 'attiny88_qfn32', output: 'pa0', input: 'pa3', outputId: 0, inputId: 3, voltage: 5},
    {kind: 'stm32f030', output: 'pb1', input: 'pa9', outputId: 17, inputId: 9, voltage: 3.3},
    {kind: 'eater6502', output: 'via1.pb7', input: 'via1.pa3', outputId: 15, inputId: 3, voltage: 5}
];

for (const target of expandedControllers) {
    test(`${target.kind}: portable host controls the actual circuit, solved input and retained latch`, async () => {
        const board = circuit(target);
        const {host} = hostFor(board);
        assert.equal(host.capabilities.profile.kind, target.kind);
        assert.equal(host.capabilities.profile.nominalVoltage, target.voltage);
        assert.ok(host.capabilities.profile.label && host.capabilities.profile.numbering && host.capabilities.profile.help);
        assert.equal(host.capabilities.profile.execution, 'host-driven-circuit');
        assert.equal(host.capabilities.profile.nativeInterpreter, false);
        host.pinMode(target.outputId, 'output');
        host.digitalWrite(target.outputId, 1);
        await host.delay(3);
        assert.ok(board.ledBrightness('LED') > 0.01, 'a real solved LED carries current');
        assert.ok(board.readAnalog(target.output) > target.voltage - 0.2);
        assert.ok(board.readAnalog(target.output) <= target.voltage, '3.3 V GPIO cannot inherit the 5 V bench');
        host.pinMode(target.inputId, 'input-pullup');
        assert.equal(host.digitalRead(target.inputId), 1);
        board.setControl('KEY', 1);
        assert.equal(host.digitalRead(target.inputId), 0, 'the real button grounds the input');
        host.digitalToggle(target.outputId);
        assert.equal(host.digitalRead(target.outputId), 0);
        host.digitalToggle(target.outputId);
        assert.equal(host.digitalRead(target.outputId), 1);
        assert.equal(host.millis(), 3);
        host.dispose();
        assert.equal(host.state, 'disposed');
        assert.equal(board.readAnalog(target.output), 0);
        assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
        const lease = board.claimExternalClock();
        lease.release();
    });
}

test('BASIC drive lights the real LED, input reads the button, and cleanup releases drives', async () => {
    const board = circuit();
    board.setPower(false);
    const {host} = hostFor(board);
    assert.equal(board.powered, true);
    assert.equal(host.capabilities.circuitPhysics, true);
    assert.equal(host.capabilities.hardware, false);
    assert.deepEqual(host.capabilities.pins, [2, 13]);
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    await host.delay(25);
    assert.ok(board.ledBrightness('LED') > 0.1, 'the real solver carries LED current');
    assert.ok(board.readAnalog('d13') > 4.8);
    host.pinMode(2, 'input-pullup');
    assert.equal(host.digitalRead(2), 1);
    board.setControl('KEY', 1);
    assert.equal(host.digitalRead(2), 0);
    assert.equal(host.millis(), 25);
    assert.equal(board.getTime(), 25n * MS);
    const saved = host.trace;
    assert.deepEqual(saved.map(event => event.type), ['pin-mode', 'digital-write', 'delay', 'pin-mode', 'digital-read', 'digital-read']);
    assert.ok(Object.isFrozen(saved) && saved.every(Object.isFrozen));
    host.dispose();
    assert.equal(host.state, 'disposed');
    assert.equal(board.powered, false);
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
    assert.equal(board.readAnalog('d13'), 0);
    assert.deepEqual(host.trace, saved);
    const lease = board.claimExternalClock();
    lease.release();
});

test('Pico output uses its 3.3 V model despite a 5 V bench supply', () => {
    const board = circuit({kind: 'pi_pico', output: 'gp0', input: 'gp1'});
    const {host} = hostFor(board);
    host.pinMode(0, 'output');
    host.digitalWrite(0, 1);
    assert.ok(board.readAnalog('gp0') > 3.1 && board.readAnalog('gp0') <= 3.3);
    assert.equal(host.digitalRead(0), 1);
    host.dispose();
});

test('toggle inverts the retained request even when the electrical net is clamped low', () => {
    const board = circuit({clamp: true});
    const {host} = hostFor(board);
    assert.equal(host.capabilities.digitalToggle, true);
    assert.equal(host.capabilities.outputLatch, 'per-run-retained-electrical-level');
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    assert.ok(board.readAnalog('d13') < 0.3, 'the one-ohm load pulls the physical node low');
    assert.equal(host.digitalRead(13), 0);
    const requested = () => board.getPinStates().find(pin => pin.pin.toLowerCase() === 'd13').driveHigh;
    assert.equal(requested(), true, 'the requested output and solved read disagree');
    host.digitalToggle(13);
    assert.equal(requested(), false, 'toggle must change the high latch to low despite the low read');
    assert.equal(host.digitalRead(13), 0);
    host.digitalToggle(13);
    assert.equal(requested(), true);
    assert.equal(host.digitalRead(13), 0, 'the clamp still controls the sensed electrical level');
    assert.equal(board.getTime(), 0n);
    assert.equal(host.solverSteps, 0);
    assert.deepEqual(host.trace.filter(event => event.type === 'digital-toggle'), [
        {sequence: 4, atMs: 0, type: 'digital-toggle', pin: 13, terminal: 'd13', value: 0},
        {sequence: 6, atMs: 0, type: 'digital-toggle', pin: 13, terminal: 'd13', value: 1}
    ]);
    host.dispose();
});

test('toggle begins from zero, retains written state through mode changes, and starts fresh each run', () => {
    const board = circuit();
    const {host} = hostFor(board);
    host.pinMode(13, 'output');
    host.digitalToggle(13);
    assert.equal(host.digitalRead(13), 1);
    host.digitalWrite(13, 1);
    host.pinMode(13, 'input-pullup');
    const before = host.trace;
    const states = board.getPinStates();
    assert.throws(() => host.digitalToggle(13), hasCode('pin-not-output'));
    assert.deepEqual(board.getPinStates(), states);
    assert.deepEqual(host.trace, before);
    host.pinMode(13, 'output');
    assert.equal(host.digitalRead(13), 1);
    host.digitalToggle(13);
    assert.equal(host.digitalRead(13), 0);
    host.digitalToggle(13);
    host.dispose();
    const released = board.getPinStates();
    assert.throws(() => host.digitalToggle(13), hasCode('disposed'));
    assert.deepEqual(board.getPinStates(), released);
    const next = hostFor(board).host;
    next.pinMode(13, 'output');
    assert.equal(next.digitalRead(13), 0, 'a new run does not inherit the old high latch');
    next.digitalToggle(13);
    assert.equal(next.digitalRead(13), 1);
    assert.equal(board.getTime(), 0n);
    next.dispose();
});

test('run time has a fresh origin without resetting existing controls or solver state', async () => {
    const board = circuit();
    board.setControl('KEY', 1);
    board.advanceTo(123n * MS);
    const parts = board.parts;
    const {host} = hostFor(board);
    assert.equal(host.millis(), 0);
    host.pinMode(2, 'input-pullup');
    assert.equal(host.digitalRead(2), 0, 'the existing pressed control survives');
    await host.delay(7);
    assert.equal(host.millis(), 7);
    assert.equal(board.getTime(), 130n * MS);
    assert.equal(board.parts, parts);
    host.dispose();
});

test('domain errors leave time, trace and electrical state unchanged', async () => {
    const board = circuit();
    const {host} = hostFor(board);
    assert.throws(() => host.pinMode(12, 'output'), hasCode('invalid-pin'));
    assert.throws(() => host.pinMode(13.5, 'output'), hasCode('invalid-pin'));
    assert.throws(() => host.pinMode(13, 'OUTPUT'), hasCode('invalid-mode'));
    assert.throws(() => host.digitalWrite(13, 1), hasCode('pin-not-output'));
    assert.throws(() => host.digitalWrite(13, 0.5), hasCode('invalid-level'));
    assert.throws(() => host.digitalToggle(13), hasCode('pin-not-output'));
    for (const id of [12, 13.5, '13', NaN, Infinity]) {
        assert.throws(() => host.digitalToggle(id), hasCode('invalid-pin'));
    }
    await assert.rejects(host.delay(0.5), hasCode('invalid-time'));
    assert.equal(host.trace.length, 0);
    assert.equal(board.getTime(), 0n);
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    assert.equal(host.digitalRead(13), 1, 'domain errors remain recoverable');
    host.dispose();
});

test('toggle reserves its trace before changing a retained high output request', () => {
    const board = circuit();
    const {host} = hostFor(board, {maxTraceEvents: 2});
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    const states = board.getPinStates();
    const trace = host.trace;
    assert.throws(() => host.digitalToggle(13), hasCode('trace-limit'));
    assert.deepEqual(board.getPinStates(), states);
    assert.deepEqual(host.trace, trace);
    assert.equal(board.getTime(), 0n);
    assert.throws(() => host.digitalToggle(13), hasCode('trace-limit'), 'a budget failure is terminal');
    host.dispose();
});

test('trace and time limits are reserved before output or clock mutations', async () => {
    const board = circuit();
    const {host} = hostFor(board, {maxTraceEvents: 1});
    host.pinMode(13, 'output');
    const before = board.readAnalog('d13');
    assert.throws(() => host.digitalWrite(13, 1), hasCode('trace-limit'));
    assert.equal(board.readAnalog('d13'), before);
    assert.equal(host.trace.length, 1);
    host.dispose();
    const second = hostFor(board, {maxTimeMs: 4}).host;
    await assert.rejects(second.delay(5), hasCode('time-limit'));
    assert.equal(board.getTime(), 0n);
    assert.equal(second.trace.length, 0);
    assert.throws(() => second.millis(), hasCode('time-limit'), 'a limit cannot be reset by catching it');
    second.dispose();
});

test('solver step budget accumulates across delays and leaves an incomplete request terminal', async () => {
    const board = circuit();
    const {host} = hostFor(board, {maxSolverSteps: 3, maxStepsPerBatch: 2});
    await host.delay(2);
    assert.equal(host.solverSteps, 2);
    await assert.rejects(host.delay(2), hasCode('solver-limit'));
    assert.equal(host.solverSteps, 3);
    assert.equal(board.getTime(), 3n * MS);
    assert.deepEqual(host.trace.map(event => [event.type, event.atMs]), [['delay', 2]]);
    assert.throws(() => host.pinMode(13, 'output'), hasCode('solver-limit'));
    host.dispose();
});

test('cancel between solver batches releases ownership and a late continuation has no effects', async () => {
    const board = circuit();
    let resume, yielded = false;
    const {host, abort} = hostFor(board, {maxStepsPerBatch: 1,
        yieldTask: () => { yielded = true; return new Promise(resolve => { resume = resolve; }); }});
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    const pending = host.delay(20);
    assert.equal(yielded, true);
    assert.equal(board.getTime(), MS);
    abort.abort();
    assert.equal(host.state, 'disposed');
    const lease = board.claimExternalClock();
    lease.run(() => board.setPin('d13', 'pushpull', true));
    const states = board.getPinStates();
    resume();
    await assert.rejects(pending, hasCode('disposed'));
    assert.equal(board.getTime(), MS);
    assert.deepEqual(board.getPinStates(), states);
    host.dispose();
    assert.ok(lease.isActive());
    lease.release();
});

for (const operation of ['digitalWrite', 'digitalToggle']) {
test(`synchronous board observers can cancel ${operation} without reentrant cleanup or a success trace`, () => {
    const board = circuit();
    board.setPower(false);
    const {host, abort} = hostFor(board);
    host.pinMode(13, 'output');
    let observed = false;
    board.onChange(event => {
        if (!observed && event.type === 'pin' && event.detail.pin === 'd13' && event.detail.driveHigh) {
            observed = true;
            abort.abort();
            assert.equal(host.state, 'disposed', 'cancellation is visible during the original call');
        }
    });
    assert.throws(() => host[operation](13, 1), hasCode('disposed'));
    assert.equal(observed, true);
    assert.equal(board.powered, false);
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
    assert.deepEqual(host.trace.map(event => event.type), ['pin-mode']);
    host.dispose();
    const lease = board.claimExternalClock();
    lease.release();
});
}

test('pending delay forbids a second operation and yields before completing a long advance', async () => {
    const board = circuit();
    let turns = 0;
    const {host} = hostFor(board, {maxStepsPerBatch: 2,
        yieldTask: () => { turns++; return Promise.resolve(); }});
    const pending = host.delay(7);
    assert.throws(() => host.digitalRead(2), hasCode('unavailable'));
    assert.throws(() => host.digitalToggle(13), hasCode('unavailable'));
    await assert.rejects(host.delay(1), hasCode('unavailable'));
    await pending;
    assert.equal(turns, 3);
    assert.equal(host.millis(), 7);
    host.dispose();
});

test('replacement netlist or clock invalidates the host and stale cleanup does not touch a new owner', () => {
    const board = circuit();
    const {host} = hostFor(board);
    host.pinMode(13, 'output');
    board.reset();
    const lease = board.claimExternalClock();
    lease.run(() => board.setPin('d13', 'pushpull', true));
    const before = board.getPinStates();
    assert.throws(() => host.digitalWrite(13, 0), hasCode('unavailable'));
    assert.throws(() => host.digitalToggle(13), hasCode('unavailable'));
    host.dispose();
    assert.deepEqual(board.getPinStates(), before);
    assert.ok(lease.isActive());
    lease.release();
    const other = hostFor(board).host;
    board.parts = board.parts.slice();
    assert.throws(() => other.millis(), hasCode('unavailable'), 'identity changes are detected even without events');
    other.dispose();
});

test('an existing clock owner is never reset, depowered, or released by failed initialization', () => {
    const board = circuit();
    const lease = board.claimExternalClock();
    lease.run(() => board.setPin('d13', 'pushpull', true));
    const states = board.getPinStates();
    assert.throws(() => hostFor(board), /already has an owner/);
    assert.ok(lease.isActive());
    assert.deepEqual(board.getPinStates(), states);
    assert.equal(board.powered, true);
    lease.release();
});

test('foreign GPIO writes preserve that pin while releasing the other BASIC drives', () => {
    const board = circuit();
    const changes = [];
    const {host} = hostFor(board, {onInvalidate: error => changes.push(error.message)});
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    host.pinMode(2, 'output');
    host.digitalWrite(2, 1);
    board.setPin('D2', 'pushpull', false);
    assert.deepEqual(changes, ['Another controller changed a circuit pin; BASIC stopped']);
    assert.throws(() => host.millis(), hasCode('unavailable'));
    host.dispose();
    const states = new Map(board.getPinStates().map(pin => [pin.pin.toLowerCase(), pin]));
    assert.equal(states.get('d13').mode, 'input', 'BASIC cannot orphan its other high output');
    assert.equal(states.get('d2').mode, 'pushpull', 'foreign controller retains its pin');
    assert.equal(states.get('d2').driveHigh, false);
    const lease = board.claimExternalClock();
    lease.release();
});

test('external power-off releases BASIC outputs without turning the circuit back on', () => {
    const board = circuit();
    const {host} = hostFor(board);
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    board.setPower(false);
    assert.throws(() => host.millis(), hasCode('unavailable'));
    host.dispose();
    assert.equal(board.powered, false);
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
});

test('failed initialization releases the acquired clock and all pins it could clear', () => {
    const board = circuit();
    const native = board.setPin.bind(board);
    let failOnce = true;
    board.setPin = (...args) => {
        if (args[0] === 'd13' && failOnce) { failOnce = false; throw new Error('initial solve failed'); }
        return native(...args);
    };
    assert.throws(() => hostFor(board), /initial solve failed/);
    const lease = board.claimExternalClock();
    lease.release();
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
});

test('abort cleanup failure is retained for the parent disposer and still releases the clock', () => {
    const board = circuit();
    const {host, abort} = hostFor(board);
    const native = board.setPin.bind(board);
    board.setPin = (...args) => {
        if (args[0] === 'd2') throw null;
        return native(...args);
    };
    abort.abort();
    let threw = false;
    try { host.dispose(); } catch (error) { threw = true; assert.equal(error, null); }
    assert.equal(threw, true, 'even a non-Error thrown by cleanup reaches the parent');
    const lease = board.claimExternalClock();
    lease.release();
});

test('malformed solver receipts and nonfinite pin readings fail instead of reporting successful work', async () => {
    const board = circuit();
    const {host} = hostFor(board);
    const advance = board.advanceToLive.bind(board);
    board.advanceToLive = (target, options) => {
        const receipt = advance(target, options);
        return target > 0n ? {...receipt, completed: false} : receipt;
    };
    await assert.rejects(host.delay(1), /invalid advancement receipt/);
    assert.equal(host.trace.length, 0);
    host.dispose();
    board.advanceToLive = advance;
    const second = hostFor(board).host;
    board.readAnalog = () => NaN;
    assert.throws(() => second.digitalRead(13), /invalid pin reading/);
    assert.equal(second.trace.length, 0);
    second.dispose();
});
