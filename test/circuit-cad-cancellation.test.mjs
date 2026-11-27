// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter, getEventListeners} from 'node:events';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {installCircuitCadBridge, STATUS_EVENT} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/bridge.js';

// No hardware engine is needed to observe startup ownership and cancellation.
// Deadlines are controlled so a leaked 30-second waiter cannot slow the suite.
function fixture (t, {ready = false} = {}) {
    const previous = Object.fromEntries(['window', 'document', 'localStorage', '__bwCad']
        .map(key => [key, globalThis[key]]));
    const deadlines = new Map();
    t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => {
        const timer = {}; deadlines.set(timer, {ms, fire: () => fn(...args)}); return timer;
    });
    t.mock.method(globalThis, 'clearTimeout', timer => deadlines.delete(timer));
    globalThis.window = new EventTarget();
    globalThis.document = new EventTarget(); document.hidden = false;
    const config = {version: 1, cadDocumentId: 'robot', enabled: true,
        drives: [{partId: 'motor', jointId: 'axle'}]};
    globalThis.localStorage = {getItem: () => JSON.stringify(config)};
    globalThis.__bwCad = {editor: {session: {state: {document: {id: 'robot'}}}}};
    const owners = [], runtime = new EventEmitter();
    const resources = {clocks: new Set(), ports: new Set(), sensorSamples: []};
    let flags = 0, epoch = 0;
    const board = {
        parts: [{id: 'motor', kind: 'dc_motor'}, {id: 'distance', kind: 'ultrasonic'}], timeNs: 0n, powered: true,
        reset () {epoch++; this.timeNs = 0n; resources.clocks.clear(); resources.ports.clear();},
        setPower (value) {this.powered = value;}, getPinStates: () => [],
        setMechanicalShaftState () {},
        attachMechanicalShaft () {
            const token = Symbol('shaft'); resources.ports.add(token);
            return () => resources.ports.delete(token);
        },
        attachExternalDistanceSensor () {
            const token = Symbol('distance'); resources.ports.add(token);
            return {sample (value) {
                resources.sensorSamples.push(value);
                assert.ok(resources.ports.has(token), 'a released sensor must not receive a late sample');
            }, release () {resources.ports.delete(token);}};
        },
        claimExternalClock () {
            const expected = epoch; let released = false;
            const token = Symbol('clock'); resources.clocks.add(token);
            return {isActive: () => !released && expected === epoch, release () {
                released = true; resources.clocks.delete(token);
            }};
        }
    };
    const frame = {time: 0, poses: [], angles: {axle: 0}, speeds: {axle: 0}, linearPositions: {}, linearSpeeds: {}};
    runtime.currentStepTime = 1000 / 30; runtime._step = () => {};
    if (ready) runtime.circuitBoard = board;
    runtime.cadSimulation = {reset () {}, async acquireExternalClock () {
        return {snapshot: () => structuredClone(frame), release () {}};
    }};
    const vm = {runtime, stopAll () {runtime.emit('PROJECT_STOP_ALL');}, greenFlag () {
        flags++; vm.stopAll(); runtime.emit('PROJECT_START');
    }};
    const originalFlag = vm.greenFlag;
    window.addEventListener('bw-circuit-clock-owner', event => {
        if (event.detail.board) owners.push(event.detail);
    });
    let dispose = installCircuitCadBridge(vm);
    const api = runtime.cadCircuitSimulation;
    const track = promise => {
        const result = {settled: false};
        promise.then(value => Object.assign(result, {settled: true, value}),
            error => Object.assign(result, {settled: true, error}));
        return result;
    };
    return {runtime, vm, board, owners, api, deadlines, originalFlag, config, frame, resources,
        get flags () {return flags;},
        start: () => track(api.start()),
        fireDeadline (ms) {
            const found = [...deadlines].find(([, timer]) => timer.ms === ms);
            assert.ok(found, `Expected a ${ms} ms deadline`);
            deadlines.delete(found[0]); found[1].fire();
        },
        dispose () {dispose?.(); dispose = null;},
        close () {
            this.dispose();
            // Also drain old-source waiters when a negative-control assertion fails.
            const remaining = [...deadlines.values()]; deadlines.clear();
            for (const timer of remaining) timer.fire();
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
            }
        }
    };
}

test('CAD refuses an active BASIC circuit lease before stopping or changing its board', async t => {
    const f = fixture(t, {ready: true});
    try {
        f.runtime.bwCrispBasicSimulation = {board: f.board};
        await assert.rejects(f.api.start(), /Stop the other simulator/);
        assert.equal(f.owners.length, 0);
        assert.equal(f.board.powered, true);
        assert.equal(f.flags, 0);
        assert.equal(f.runtime.bwCrispBasicSimulation.board, f.board);
    } finally { delete f.runtime.bwCrispBasicSimulation; f.close(); }
});

test('progress events are throttled while synchronous status and Stop retain the latest readings', async t => {
    const f = fixture(t, {ready: true});
    try {
        let wallTime = 0, hold = false, finishStep;
        t.mock.method(performance, 'now', () => wallTime);
        const claimClock = f.board.claimExternalClock;
        f.board.claimExternalClock = () => ({...claimClock(), run: advance => advance()});
        f.board.advanceTo = time => {f.board.timeNs = time;};
        f.board.takeMechanicalShaftImpulse = () => ({impulseNms: 0, currentA: Number(f.board.timeNs) / 1e9});
        f.runtime.cadSimulation.acquireExternalClock = async () => {
            const frame = structuredClone(f.frame);
            return {
                snapshot: () => structuredClone(frame),
                async step () {
                    if (hold) await new Promise(resolve => {finishStep = resolve;});
                    frame.time += .005;
                    return structuredClone(frame);
                },
                release () {}
            };
        };
        const events = [];
        window.addEventListener(STATUS_EVENT, event => events.push(event.detail));
        const start = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
        assert.equal(start.settled, true);
        assert.deepEqual(f.api.state().readings, []);
        const session = f.runtime.bwProgramClock.session;
        for (let tick = 0; tick < 15; tick++) {
            wallTime = tick * 10;
            session.tick(10); await session.idle();
        }
        const progress = events.filter(event => event.phase === 'running' && event.time > 0);
        assert.deepEqual(progress.map(event => Math.round(event.time * 1000)), [10, 110]);
        assert.equal(progress[0].readings[0].currentA, .01);
        assert.equal(Math.round(f.api.state().time * 1000), 150);
        assert.equal(f.api.state().readings[0].currentA, .15);
        wallTime += 10;
        session.tick(10); await session.idle();
        hold = true;
        session.tick(10); await nextTurn();
        assert.ok(finishStep);
        assert.equal(Math.round(f.api.state().time * 1000), 160);
        assert.equal(f.api.state().readings[0].currentA, .16);
        f.api.stop();
        finishStep(); await session.idle();
        assert.equal(events.at(-1).phase, 'idle');
        assert.equal(Math.round(events.at(-1).time * 1000), 160);
        assert.equal(events.at(-1).readings[0].currentA, .16);
        f.api.reset();
        assert.equal(f.api.state().time, 0);
        assert.deepEqual(f.api.state().readings, []);
    } finally {f.close();}
});

test('Stop settles an unavailable Circuit start and removes its listener and deadline', async t => {
    const f = fixture(t);
    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            const run = f.start();
            assert.equal(getEventListeners(window, 'bw-board-ready').length, 1);
            assert.equal(f.deadlines.size, 1);
            f.api.stop(); await nextTurn();
            assert.equal(run.settled, true, 'a stopped start must not wait for Circuit or its timeout');
            assert.equal(run.error, undefined, 'intentional cancellation is not a simulation failure');
            assert.equal(f.api.state().phase, 'idle');
            assert.equal(getEventListeners(window, 'bw-board-ready').length, 0);
            assert.equal(f.deadlines.size, 0);
        }
        f.runtime.circuitBoard = f.board;
        window.dispatchEvent(new Event('bw-board-ready')); await nextTurn();
        assert.equal(f.owners.length, 0, 'late readiness does not acquire the circuit after Stop');
        assert.equal(f.flags, 0);
    } finally {f.close();}
});

for (const lateFailure of [false, true]) test(`Stop releases initial sensor ownership before a late ${lateFailure ? 'failure' : 'reply'}, preserving restart`, async t => {
    const f = fixture(t, {ready: true});
    try {
        f.config.sensors = [{partId: 'distance', bodyId: 'chassis'}];
        let resolveSense, rejectSense, acquired = 0;
        const oldSense = new Promise((resolve, reject) => {resolveSense = resolve; rejectSense = reject;});
        f.runtime.cadSimulation.acquireExternalClock = async () => {
            const first = ++acquired === 1;
            return {snapshot: () => structuredClone(f.frame), release () {}, sense: () => first ? oldSense
                : Promise.resolve({...structuredClone(f.frame), distances: {distance: 200}})};
        };
        const first = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
        assert.equal(f.resources.clocks.size, 1); assert.equal(f.resources.ports.size, 2);
        assert.equal(first.settled, false);
        f.api.stop();
        assert.equal(f.resources.clocks.size, 0, 'Stop must return the Board clock without waiting for the worker');
        assert.equal(f.resources.ports.size, 0, 'Stop must detach shaft and sensor ports immediately');
        await nextTurn(); assert.equal(first.settled, true); assert.equal(first.error, undefined);
        const second = f.start(); await nextTurn(); f.owners[1].ready(); await nextTurn();
        assert.equal(second.settled, true); assert.equal(second.error, undefined);
        assert.equal(f.api.state().phase, 'running'); assert.equal(f.board.powered, true);
        const clock = f.runtime.bwProgramClock;
        assert.equal(f.resources.clocks.size, 1); assert.equal(f.resources.ports.size, 2);
        assert.deepEqual(f.resources.sensorSamples, [200]);
        if (lateFailure) rejectSense(new Error('old worker failed'));
        else resolveSense({...structuredClone(f.frame), distances: {distance: 999}});
        await nextTurn();
        assert.equal(f.api.state().phase, 'running'); assert.equal(f.api.state().error, '');
        assert.equal(f.runtime.bwProgramClock, clock); assert.equal(f.board.powered, true);
        assert.equal(f.resources.clocks.size, 1); assert.equal(f.resources.ports.size, 2);
        assert.deepEqual(f.resources.sensorSamples, [200], 'a cancelled sense must not publish to old or new ports');
        f.api.stop(); assert.equal(f.resources.clocks.size, 0); assert.equal(f.resources.ports.size, 0);
    } finally {f.close();}
});

test('an active initial sensor failure remains observable and releases Board ownership', async t => {
    const f = fixture(t, {ready: true});
    try {
        f.config.sensors = [{partId: 'distance', bodyId: 'chassis'}];
        let rejectSense;
        f.runtime.cadSimulation.acquireExternalClock = async () => ({
            snapshot: () => structuredClone(f.frame), release () {},
            sense: () => new Promise((resolve, reject) => {rejectSense = reject;})
        });
        const run = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
        const error = new Error('distance worker failed'); rejectSense(error); await nextTurn();
        assert.equal(run.error, error); assert.equal(f.api.state().phase, 'error');
        assert.equal(f.resources.clocks.size, 0); assert.equal(f.resources.ports.size, 0);
        assert.equal(f.board.powered, false); assert.deepEqual(f.resources.sensorSamples, []);
    } finally {f.close();}
});

for (const ready of [false, true]) test(`Disposal releases a pending ${ready ? 'owner acknowledgement' : 'Circuit readiness'} wait`, async t => {
    const f = fixture(t, {ready});
    try {
        const run = f.start(); await nextTurn();
        assert.equal(f.deadlines.size, 1);
        f.dispose(); await nextTurn();
        assert.equal(run.settled, true);
        assert.equal(run.error, undefined);
        assert.equal(f.deadlines.size, 0);
        assert.equal(getEventListeners(window, 'bw-board-ready').length, 0);
        assert.equal(f.runtime.cadCircuitSimulation, undefined);
        assert.equal(f.vm.greenFlag, f.originalFlag);
        f.owners[0]?.ready(); f.owners[0]?.reject(new Error('late owner rejection'));
        f.runtime.circuitBoard = f.board;
        window.dispatchEvent(new Event('bw-board-ready')); await nextTurn();
        assert.equal(f.flags, 0);
        assert.equal(f.runtime.bwProgramClock, undefined);
    } finally {f.close();}
});

test('late owner callbacks from a cancelled start cannot change a restarted run', async t => {
    const f = fixture(t, {ready: true});
    try {
        const first = f.start(); await nextTurn();
        const oldOwner = f.owners[0];
        f.api.stop(); await nextTurn();
        assert.equal(first.settled, true);
        assert.equal(f.board.powered, true, 'an unacknowledged request never owned the board power');
        assert.equal(f.deadlines.size, 0);
        const second = f.start(); await nextTurn();
        assert.equal(f.owners.length, 2);
        f.owners[1].ready(); await nextTurn();
        assert.equal(second.settled, true); assert.equal(second.error, undefined);
        assert.equal(f.api.state().phase, 'running'); assert.equal(f.board.powered, true);
        const clock = f.runtime.bwProgramClock;
        oldOwner.ready(); oldOwner.reject(new Error('stale failure')); await nextTurn();
        assert.equal(f.api.state().phase, 'running'); assert.equal(f.api.state().error, '');
        assert.equal(f.runtime.bwProgramClock, clock); assert.equal(f.board.powered, true);
        assert.equal(f.flags, 1); assert.equal(f.deadlines.size, 0);
        f.api.stop(); assert.equal(f.board.powered, false);
    } finally {f.close();}
});

for (const ready of [false, true]) test(`Stop inside the ${ready ? 'owner request' : 'Circuit wake'} event cancels synchronously`, async t => {
    const f = fixture(t, {ready});
    try {
        const eventName = ready ? 'bw-circuit-clock-owner' : 'bw-circuit-ensure-ready';
        window.addEventListener(eventName, event => {
            if (ready && !event.detail.board) return;
            f.api.stop();
        });
        const run = f.start(); await nextTurn();
        assert.equal(run.settled, true); assert.equal(run.error, undefined);
        assert.equal(f.api.state().phase, 'idle'); assert.equal(f.deadlines.size, 0);
        assert.equal(getEventListeners(window, 'bw-board-ready').length, 0);
        assert.equal(f.flags, 0); assert.equal(f.runtime.bwProgramClock, undefined);
    } finally {f.close();}
});

test('a real Circuit readiness timeout still rejects and removes its listener', async t => {
    const f = fixture(t);
    try {
        const run = f.start(); f.fireDeadline(30000); await nextTurn();
        assert.equal(run.settled, true);
        assert.match(run.error?.message || '', /Open a wired motor circuit/);
        assert.equal(f.api.state().phase, 'error');
        assert.match(f.api.state().error, /Open a wired motor circuit/);
        assert.equal(getEventListeners(window, 'bw-board-ready').length, 0);
        assert.equal(f.deadlines.size, 0); assert.equal(f.flags, 0);
    } finally {f.close();}
});

for (const timedOut of [false, true]) test(`a real owner ${timedOut ? 'timeout' : 'rejection'} stays observable without changing unowned pins or power`, async t => {
    const f = fixture(t, {ready: true});
    try {
        const effects = [];
        f.board.getPinStates = () => [{pin: 'P1.0', mode: 'output'}];
        f.board.setPin = (...args) => effects.push(['pin', ...args]);
        const setPower = f.board.setPower.bind(f.board);
        f.board.setPower = value => { effects.push(['power', value]); setPower(value); };
        const run = f.start(); await nextTurn();
        const error = new Error('designer refused ownership');
        if (timedOut) f.fireDeadline(10000); else f.owners[0].reject(error);
        await nextTurn();
        assert.equal(run.settled, true);
        if (timedOut) assert.match(run.error?.message || '', /Open the Circuit tab/);
        else assert.equal(run.error, error);
        assert.equal(f.api.state().phase, 'error');
        assert.equal(f.board.powered, true); assert.equal(f.deadlines.size, 0);
        assert.deepEqual(effects, [], 'a rejected owner must not release another program’s output');
        f.owners[0].ready(); await nextTurn();
        assert.equal(f.api.state().phase, 'error'); assert.equal(f.flags, 0);
    } finally {f.close();}
});

for (const phase of ['reset', 'acquireExternalClock']) {
    for (const lateFailure of [false, true]) test(`Stop settles pending CAD ${phase} before a late ${lateFailure ? 'failure' : 'reply'} and preserves restart`, async t => {
        const f = fixture(t, {ready: true});
        let resolveFirst, rejectFirst, calls = 0, oldReleases = 0, currentReleases = 0;
        const waiting = new Promise((resolve, reject) => {resolveFirst = resolve; rejectFirst = reject;});
        const lease = release => ({snapshot: () => structuredClone(f.frame), release});
        const original = f.runtime.cadSimulation[phase];
        f.runtime.cadSimulation[phase] = (...args) => ++calls === 1 ? waiting
            : phase === 'acquireExternalClock' ? Promise.resolve(lease(() => {currentReleases++;})) : original(...args);
        try {
            const first = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
            assert.equal(calls, 1); assert.equal(first.settled, false);
            f.api.stop(); await nextTurn();
            assert.equal(first.settled, true, 'Stop must settle Run without waiting for the CAD worker');
            assert.equal(first.error, undefined); assert.equal(f.board.powered, false);
            const second = f.start(); await nextTurn(); f.owners[1].ready(); await nextTurn();
            assert.equal(second.settled, true); assert.equal(second.error, undefined);
            const clock = f.runtime.bwProgramClock;
            if (lateFailure) rejectFirst(new Error('cancelled CAD worker failed'));
            else resolveFirst(phase === 'acquireExternalClock' ? lease(() => {oldReleases++;}) : undefined);
            await nextTurn();
            assert.equal(oldReleases, phase === 'acquireExternalClock' && !lateFailure ? 1 : 0);
            assert.equal(currentReleases, 0, 'the old acquisition must not release the new clock');
            assert.equal(f.api.state().phase, 'running'); assert.equal(f.api.state().error, '');
            assert.equal(f.runtime.bwProgramClock, clock); assert.equal(f.board.powered, true);
            assert.equal(f.flags, 1);
        } finally {
            // Settle the worker even if the old-source cancellation assertion failed.
            resolveFirst(phase === 'acquireExternalClock' ? lease(() => {oldReleases++;}) : undefined);
            await nextTurn(); f.close();
        }
    });

    test(`Disposal settles pending CAD ${phase} and releases a late lease`, async t => {
        const f = fixture(t, {ready: true});
        let resolveFirst, oldReleases = 0;
        const waiting = new Promise(resolve => {resolveFirst = resolve;});
        f.runtime.cadSimulation[phase] = () => waiting;
        try {
            const run = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
            f.dispose(); await nextTurn();
            assert.equal(run.settled, true); assert.equal(run.error, undefined);
            assert.equal(f.runtime.cadCircuitSimulation, undefined); assert.equal(f.board.powered, false);
            resolveFirst(phase === 'acquireExternalClock' ? {release () {oldReleases++;}} : undefined);
            await nextTurn();
            assert.equal(oldReleases, phase === 'acquireExternalClock' ? 1 : 0);
            assert.equal(f.flags, 0); assert.equal(f.runtime.bwProgramClock, undefined);
        } finally {
            resolveFirst(phase === 'acquireExternalClock' ? {release () {oldReleases++;}} : undefined);
            await nextTurn(); f.close();
        }
    });
}

for (const phase of ['reset', 'acquireExternalClock']) {
    test(`a real CAD ${phase} failure remains observable and returns circuit ownership`, async t => {
        const f = fixture(t, {ready: true}), error = new Error(`CAD ${phase} failed`);
        f.runtime.cadSimulation[phase] = async () => {throw error;};
        try {
            const run = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
            assert.equal(run.settled, true); assert.equal(run.error, error);
            assert.equal(f.api.state().phase, 'error'); assert.equal(f.api.state().error, error.message);
            assert.equal(f.board.powered, false); assert.equal(f.runtime.bwProgramClock, undefined);
            assert.equal(f.resources.clocks.size, 0); assert.equal(f.resources.ports.size, 0);
            assert.equal(f.flags, 0);
        } finally {f.close();}
    });

    test(`Stop inside CAD ${phase} prevents a late startup`, async t => {
        const f = fixture(t, {ready: true});
        let released = 0;
        f.runtime.cadSimulation[phase] = () => {
            f.api.stop();
            return phase === 'acquireExternalClock' ? {release () {released++;}} : undefined;
        };
        try {
            const run = f.start(); await nextTurn(); f.owners[0].ready(); await nextTurn();
            assert.equal(run.settled, true); assert.equal(run.error, undefined);
            assert.equal(released, phase === 'acquireExternalClock' ? 1 : 0);
            assert.equal(f.api.state().phase, 'idle'); assert.equal(f.board.powered, false);
            assert.equal(f.flags, 0); assert.equal(f.runtime.bwProgramClock, undefined);
        } finally {f.close();}
    });
}

test('CAD waits past an empty first board until saved motor parts are hydrated', async t => {
    const f=fixture(t);
    try {
        f.runtime.circuitBoard={parts:[]};
        const run=f.start();await nextTurn();
        assert.equal(f.owners.length,0,'an empty designer mount is not the restored motor circuit');
        f.runtime.circuitBoard=f.board;window.dispatchEvent(new Event('bw-board-ready'));await nextTurn();
        assert.equal(f.owners.length,1);f.api.stop();await nextTurn();assert.equal(run.settled,true);assert.equal(run.error,undefined);
        assert.equal(f.api.state().phase,'idle');assert.equal(f.owners.length,1);
    } finally {f.close();}
});
