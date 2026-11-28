// Dependency-free tests of the real session/host guard and disposal code.
// The real bw-board/Circuit snapshot and undo contract is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter, getEventListeners} from 'node:events';

const read = name => readFileSync(new URL(`../overlay/scratch-gui/src/lib/${name}.js`, import.meta.url), 'utf8');
const hostSource = read('crispbasic-board-host').replace("import {getDevice} from 'bw-board/devices.js';", '')
    .replaceAll('export function ', 'function ');
const createHost = new Function('getDevice', `${hostSource}\nreturn createCrispBasicBoardHost;`)(() => undefined);
const sessionSource = read('crispbasic-circuit-session')
    .replace("import {createCrispBasicBoardHost} from './crispbasic-board-host.js';", '')
    .replace('export async function ', 'async function ');
const createSession = new Function('createCrispBasicBoardHost', `${sessionSource}\nreturn createCrispBasicCircuitSession;`)(createHost);
class SimulationError extends Error {
    constructor (code, message) { super(message); this.code = code; }
}

function fixture ({model = {}, acknowledge = true} = {}) {
    const listeners = new Set(), pinStates = new Map();
    const board = {
        parts: [{id: 'cpu', kind: 'mcu', terminals: ['P1.0', 'P1.1']}], nets: [], powered: false, time: 0n,
        lease: null, onPin: null,
        getNets () { return this.nets; }, getTime () { return this.time; },
        onChange (fn) { listeners.add(fn); }, offChange (fn) { listeners.delete(fn); },
        emit (event) { for (const listener of [...listeners]) listener(event); },
        setPin (pin, mode, driveHigh) {
            this.onPin?.(pin, mode, driveHigh);
            pinStates.set(pin, {mode, driveHigh});
            this.emit({type: 'pin', detail: {pin}});
        },
        setPower (on) { this.powered = on; this.emit({type: 'power', detail: {on}}); },
        readPin (pin) { return Number(pinStates.get(pin)?.driveHigh || false); },
        readAnalog (pin) { return this.readPin(pin) * 5; },
        advanceToLive (target, {maxSteps}) {
            const started = this.time; this.time = target;
            return {startedTimeNs: String(started), requestedTimeNs: String(target), processedTimeNs: String(target),
                completed: true, maxSteps, steps: Number(started !== target)};
        },
        claimExternalClock () {
            assert.equal(this.lease, null);
            let running = false;
            const lease = {
                isActive: () => this.lease === lease,
                run: action => {
                    assert.equal(this.lease, lease); assert.equal(running, false);
                    running = true;
                    try { return action(); } finally { running = false; }
                },
                release: () => { assert.equal(running, false); if (this.lease === lease) this.lease = null; }
            };
            this.lease = lease;
            return lease;
        },
        snapshot () { return new Map(pinStates); }
    };
    const runtime = Object.assign(new EventEmitter(), {circuitBoard: board, threads: []});
    if (model) { model.board = board; runtime.circuitModel = model; }
    const eventTarget = new EventTarget(), requests = [], invalidations = [];
    eventTarget.addEventListener('bw-circuit-clock-owner', event => {
        requests.push(event.detail);
        if (event.detail.board && acknowledge) event.detail.ready();
    });
    const start = async () => {
        const controller = new AbortController();
        const session = await createSession({runtime, eventTarget, signal: controller.signal,
            onInvalidate: error => { invalidations.push(error); controller.abort(); }});
        return {session, controller,
            host: () => session.createHost({signal: controller.signal}, SimulationError)};
    };
    return {board, model, runtime, eventTarget, requests, invalidations, listeners, pinStates, start};
}

const inputPins = f => [...f.pinStates.values()].every(pin => pin.mode === 'input');

for (const name of ['_saveHistory', '_syncNetlist', 'syncWithExternalNets']) {
    test(`${name} releases GPIO before invoking the inherited original with its receiver and arguments`, async () => {
        let calls = 0, host;
        const result = {};
        const proto = {[name] (...args) {
            calls++;
            assert.equal(this, f.model); assert.deepEqual(args, [7, 'nets']);
            assert.equal(host.cleanupComplete, true); assert.equal(f.board.lease, null);
            assert.equal(inputPins(f), true);
            return result;
        }};
        const f = fixture({model: Object.create(proto)});
        const run = await f.start(); host = run.host();
        host.pinMode(8, 'output'); host.digitalWrite(8, 1);
        assert.equal(f.model[name](7, 'nets'), result);
        assert.equal(calls, 1); assert.equal(f.invalidations.length, 1);
        assert.equal(Object.hasOwn(f.model, name), false);
        assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
        run.session.dispose();
    });
}

test('own method descriptors and accessors are restored exactly; read-only snapshots do not cancel', async () => {
    const model = {};
    Object.defineProperty(model, '_saveHistory', {value () {}, writable: false, enumerable: true, configurable: true});
    Object.defineProperty(model, '_syncNetlist', {value () {}, writable: true, enumerable: false, configurable: false});
    const external = () => {};
    Object.defineProperty(model, 'syncWithExternalNets', {get: () => external, enumerable: true, configurable: true});
    const before = Object.getOwnPropertyDescriptors(model), f = fixture({model});
    const run = await f.start(), host = run.host();
    host.pinMode(8, 'output'); host.digitalWrite(8, 1);
    assert.equal(f.board.snapshot().get('P1.0').mode, 'pushpull');
    assert.equal(f.invalidations.length, 0); assert.equal(host.cleanupComplete, false);
    run.session.dispose();
    for (const name of Object.keys(before)) assert.deepEqual(Object.getOwnPropertyDescriptor(model, name), before[name]);
});

test('absent methods and an absent model remain supported', async () => {
    for (const model of [{}, null]) {
        const f = fixture({model}), run = await f.start();
        const host = run.host(); run.session.dispose();
        assert.equal(host.cleanupComplete, true); assert.equal(f.board.lease, null);
    }
});

test('partial guard installation failure unwinds prior methods before any clock request', async () => {
    const model = {_saveHistory () {}, syncWithExternalNets () {}};
    Object.defineProperty(model, '_syncNetlist', {value () {}, writable: false, configurable: false});
    const before = Object.getOwnPropertyDescriptors(model), f = fixture({model});
    await assert.rejects(f.start(), TypeError);
    for (const name of Object.keys(before)) assert.deepEqual(Object.getOwnPropertyDescriptor(model, name), before[name]);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined); assert.equal(f.requests.length, 0);
    assert.equal(f.listeners.size, 0); assert.equal(getEventListeners(f.eventTarget, 'bw-circuit-changed').length, 0);
});

test('a method getter that cancels during installation cannot strand a later guard', async () => {
    let calls = 0;
    const model = {_saveHistory () { calls++; }};
    const rebuild = () => {};
    Object.defineProperty(model, '_syncNetlist', {get () { this._saveHistory(); return rebuild; }, configurable: true});
    const before = Object.getOwnPropertyDescriptors(model), f = fixture({model});
    await assert.rejects(f.start(), /stopped/);
    for (const name of Object.keys(before)) assert.deepEqual(Object.getOwnPropertyDescriptor(model, name), before[name]);
    assert.equal(calls, 1); assert.equal(f.requests.length, 0);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

test('a mutation during the clock handoff cancels before any host has acquired GPIO', async () => {
    let calls = 0;
    const f = fixture({acknowledge: false, model: {_saveHistory () { calls++; }}});
    const pending = f.start();
    f.model._saveHistory();
    await assert.rejects(pending, /stopped/);
    assert.equal(calls, 1); assert.equal(f.pinStates.size, 0); assert.equal(f.board.lease, null);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

test('a borrowed method preserves its receiver without cancelling the captured model', async () => {
    const error = new Error('original failure');
    const model = {_saveHistory (arg) { if (arg === error) throw error; return this.value + arg; }};
    const f = fixture({model}), run = await f.start(), host = run.host();
    assert.equal(model._saveHistory.call({value: 4}, 5), 9);
    assert.throws(() => model._saveHistory.call({}, error), candidate => candidate === error);
    assert.equal(host.state, 'ready'); assert.equal(f.invalidations.length, 0);
    assert.throws(() => model._saveHistory(error), candidate => candidate === error);
    assert.equal(host.cleanupComplete, true); assert.equal(f.invalidations.length, 1);
});

test('a retained old guard delegates a later real mutation to its current owner', async () => {
    let calls = 0;
    const f = fixture({model: {_saveHistory () { calls++; assert.equal(f.board.lease, null); assert.equal(inputPins(f), true); }}});
    const first = await f.start(); first.host();
    const oldGuard = f.model._saveHistory;
    first.session.dispose();
    const second = await f.start(), host = second.host();
    host.pinMode(8, 'output'); host.digitalWrite(8, 1);
    const newGuard = f.model._saveHistory;
    first.session.dispose();
    assert.equal(f.model._saveHistory, newGuard);
    oldGuard.call(f.model);
    assert.equal(calls, 1); assert.equal(f.invalidations.length, 1);
    assert.equal(host.cleanupComplete, true); assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

test('disposal does not overwrite a foreign replacement method', async () => {
    const f = fixture({model: {_saveHistory () { return 'original'; }}}), run = await f.start();
    const stale = f.model._saveHistory, foreign = () => 'foreign';
    f.model._saveHistory = foreign;
    run.session.dispose();
    assert.equal(f.model._saveHistory, foreign);
    assert.equal(stale.call(f.model), 'original');
    assert.equal(f.model._saveHistory, foreign); assert.equal(f.invalidations.length, 0);
});

test('cleanup failures block history and remain visible to repeated disposal', async () => {
    let calls = 0;
    const f = fixture({model: {_saveHistory () { calls++; }}}), run = await f.start(), host = run.host();
    host.pinMode(8, 'output'); host.digitalWrite(8, 1);
    f.board.onPin = (pin, mode) => { if (pin === 'P1.0' && mode === 'input') throw new Error('pin release refused'); };
    assert.throws(() => f.model._saveHistory(), {code: 'circuit-cleanup-failed'});
    assert.equal(calls, 0); assert.equal(host.cleanupComplete, true); assert.equal(f.board.lease, null);
    assert.throws(() => run.session.dispose(), /pin release refused/);
    assert.throws(() => f.model._saveHistory(), /pin release refused/);
    assert.equal(calls, 0);
    await assert.rejects(f.start(), /pin release refused/);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

test('a mutation inside a solver operation is refused until deferred pin cleanup unwinds', async () => {
    let calls = 0;
    const f = fixture({model: {_syncNetlist () { calls++; }}}), run = await f.start(), host = run.host();
    f.board.onPin = (pin, mode) => { if (mode === 'pushpull') f.model._syncNetlist(); };
    assert.throws(() => host.pinMode(8, 'output'), {code: 'circuit-cleanup-pending'});
    assert.equal(calls, 0); assert.equal(host.cleanupComplete, true); assert.equal(f.board.lease, null);
    assert.equal(inputPins(f), true);
    run.session.dispose();
    f.model._syncNetlist(); assert.equal(calls, 1);
});

test('mutation guards remain in place during reentrant cleanup callbacks', async () => {
    let calls = 0, checked = false;
    const f = fixture({model: {_saveHistory () { calls++; }}}), run = await f.start(), host = run.host();
    host.pinMode(8, 'output'); host.digitalWrite(8, 1);
    f.board.onPin = (pin, mode) => {
        if (mode !== 'input' || checked) return;
        checked = true; assert.equal(host.cleanupComplete, false);
        for (let attempt = 0; attempt < 2; attempt++) {
            assert.throws(() => f.model._saveHistory(), {code: 'circuit-cleanup-pending'});
        }
    };
    run.session.dispose();
    assert.equal(checked, true); assert.equal(calls, 0);
    assert.equal(host.cleanupComplete, true); assert.equal(inputPins(f), true);
    f.model._saveHistory(); assert.equal(calls, 1);
});

test('a new session cannot capture a pending old guard and can start after cleanup unwinds', async () => {
    const original = function () {};
    const f = fixture({model: {_saveHistory: original}}), run = await f.start(), host = run.host();
    let next;
    f.eventTarget.addEventListener('bw-circuit-clock-owner', event => {
        if (!event.detail.board && !next) next = f.start();
    });
    f.board.onPin = (pin, mode) => { if (mode === 'pushpull') f.model._saveHistory(); };
    assert.throws(() => host.pinMode(8, 'output'), {code: 'circuit-cleanup-pending'});
    await assert.rejects(next, {code: 'circuit-cleanup-pending'});
    assert.equal(f.board.lease, null); assert.equal(host.cleanupComplete, true);
    // The next session finalizes the old guard before capturing descriptors,
    // even if the old session's public dispose has not been called yet.
    const last = await f.start(); last.host();
    last.session.dispose(); run.session.dispose();
    assert.equal(f.model._saveHistory, original);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

test('constructor callbacks cannot mutate before the host is assigned', async () => {
    let calls = 0, attempted = false;
    const f = fixture({model: {syncWithExternalNets () { calls++; }}}), run = await f.start();
    const guarded = f.model.syncWithExternalNets;
    f.board.onPin = () => {
        if (attempted) return;
        attempted = true; f.model.syncWithExternalNets([]);
    };
    assert.throws(() => run.host(), {code: 'circuit-cleanup-pending'});
    assert.equal(attempted, true); assert.equal(calls, 0);
    assert.equal(f.board.lease, null); assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.notEqual(f.model.syncWithExternalNets, guarded);
    run.session.dispose(); f.model.syncWithExternalNets([]); assert.equal(calls, 1);
});

test('descriptor restoration failures block the original and remain reported', async () => {
    let calls = 0;
    const f = fixture({model: {_saveHistory () { calls++; }}}), run = await f.start(), host = run.host();
    Object.defineProperty(f.model, '_saveHistory', {value: f.model._saveHistory, writable: false, configurable: false});
    assert.throws(() => f.model._saveHistory(), {code: 'circuit-cleanup-failed'});
    assert.equal(calls, 0); assert.equal(host.cleanupComplete, true); assert.equal(f.board.lease, null);
    assert.throws(() => run.session.dispose(), {code: 'circuit-cleanup-failed'});
});
