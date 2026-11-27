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
    const ground = kind === 'pi_pico' ? 'gnd_1' : 'gnd';
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
    assert.throws(() => map('microbit', ['p0']), /does not support/);
});

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

test('electrical read reports output contention instead of returning the latch', () => {
    const board = circuit({clamp: true});
    const {host} = hostFor(board);
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    assert.ok(board.readAnalog('d13') < 0.3, 'the one-ohm load pulls the physical node low');
    assert.equal(host.digitalRead(13), 0);
    host.dispose();
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
    await assert.rejects(host.delay(0.5), hasCode('invalid-time'));
    assert.equal(host.trace.length, 0);
    assert.equal(board.getTime(), 0n);
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    assert.equal(host.digitalRead(13), 1, 'domain errors remain recoverable');
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

test('synchronous board observers can cancel a write without reentrant cleanup or a success trace', () => {
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
    assert.throws(() => host.digitalWrite(13, 1), hasCode('disposed'));
    assert.equal(observed, true);
    assert.equal(board.powered, false);
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
    assert.deepEqual(host.trace.map(event => event.type), ['pin-mode']);
    host.dispose();
    const lease = board.claimExternalClock();
    lease.release();
});

test('pending delay forbids a second operation and yields before completing a long advance', async () => {
    const board = circuit();
    let turns = 0;
    const {host} = hostFor(board, {maxStepsPerBatch: 2,
        yieldTask: () => { turns++; return Promise.resolve(); }});
    const pending = host.delay(7);
    assert.throws(() => host.digitalRead(2), hasCode('unavailable'));
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
