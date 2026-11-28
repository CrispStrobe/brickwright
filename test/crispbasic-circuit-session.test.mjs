// Shared canvas ownership, including cold starts and late acknowledgements.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter, getEventListeners} from 'node:events';
import {BoardImpl} from 'bw-board/board.js';
import {registerBoardKinds} from 'bw-board/devices/board-kinds.js';
import {SimulationError} from '../packages/crisp-basic/src/simulation-host.mjs';
import {createCrispBasicCircuitSession} from '../overlay/scratch-gui/src/lib/crispbasic-circuit-session.js';
import {createCrispBasicRunner} from '../overlay/scratch-gui/src/lib/crispbasic-runner.js';

registerBoardKinds();
const turn = () => new Promise(resolve => setImmediate(resolve));
const circuitSource = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx', import.meta.url), 'utf8');
const handlerStart = circuitSource.indexOf('        this._couplingHandler = event => {');
const handlerEnd = circuitSource.indexOf('        this._couplingOpen = ', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const installHandler = new Function('setTimeout', circuitSource.slice(handlerStart, handlerEnd));

function makeBoard () {
    const board = new BoardImpl();
    board.setNetlist([
        {id: 'cpu', kind: 'arduino_uno', terminals: ['d13', 'gnd'], params: {}},
        {id: 'ground', kind: 'gnd', terminals: ['gnd'], params: {}}
    ], [{id: 'drive', terminals: [{part: 'cpu', terminal: 'd13'}]},
        {id: 'gnd', terminals: [{part: 'cpu', terminal: 'gnd'}, {part: 'ground', terminal: 'gnd'}]}]);
    return board;
}

function failNextPinRelease (board) {
    const setPin = board.setPin.bind(board);
    let pending = true;
    board.setPin = (...args) => {
        if (pending && args[1] === 'input') { pending = false; throw null; }
        return setPin(...args);
    };
}

function fixture ({acknowledge = true, board = makeBoard()} = {}) {
    const runtime = new EventEmitter();
    Object.assign(runtime, {circuitBoard: board, circuitModel: {board, netlistError: null}, threads: []});
    const eventTarget = new EventTarget(), requests = [], releases = [], callbacks = [];
    const designer = {props: {vm: {runtime}}, state: {}, setState (update, done) { Object.assign(this.state, update); done?.(); }};
    installHandler.call(designer, callback => { callbacks.push(callback); if (acknowledge) queueMicrotask(callback); });
    eventTarget.addEventListener('bw-circuit-clock-owner', event => {
        if (event.detail.board) requests.push(event.detail); else releases.push(event.detail);
        designer._couplingHandler(event);
    });
    const start = (options = {}) => {
        const controller = new AbortController(), invalidations = [];
        const promise = createCrispBasicCircuitSession({runtime, eventTarget, signal: controller.signal,
            onInvalidate: error => { invalidations.push(error.message); controller.abort(); }, ...options});
        return {controller, promise, invalidations};
    };
    return {runtime, board, eventTarget, requests, releases, callbacks, designer, start,
        emit: (name, detail) => eventTarget.dispatchEvent(new CustomEvent(name, {detail}))};
}

test('the Designer acknowledges before any host touches the actual canvas board', async () => {
    const f = fixture({acknowledge: false}); f.board.setPower(false);
    const originalPins = f.board.getPinStates();
    const started = f.start();
    assert.equal(f.requests.length, 1);
    assert.equal(f.runtime.bwCrispBasicSimulation.board, f.board);
    assert.equal(f.board._externalClock, undefined);
    assert.equal(f.board.powered, false);
    assert.deepEqual(f.board.getPinStates(), originalPins);
    f.callbacks.shift()();
    const lease = await started.promise;
    const host = lease.createHost({signal: started.controller.signal}, SimulationError);
    host.pinMode(13, 'output'); host.digitalWrite(13, 1);
    assert.ok(f.board.readAnalog('d13') > 4.9);
    assert.throws(() => lease.createHost({signal: started.controller.signal}, SimulationError), /only one/);
    lease.dispose();
    assert.equal(f.board._externalClock, null);
    assert.equal(f.board.powered, false);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.designer._coupledBoard, null);
    assert.equal(getEventListeners(f.eventTarget, 'bw-circuit-changed').length, 0);
    assert.equal(f.runtime.listenerCount('PROJECT_STOP_ALL'), 0);
});

test('Stop during acknowledgement releases listeners and stale callbacks cannot take the next run', async () => {
    const f = fixture({acknowledge: false});
    const first = f.start(); first.controller.abort();
    await assert.rejects(first.promise, /stopped/);
    const second = f.start();
    const acknowledgeSecond = f.callbacks.at(-1);
    const current = f.runtime.bwCrispBasicSimulation;
    f.callbacks[0](); f.requests[0].ready(); f.requests[0].reject(new Error('late'));
    f.emit('bw-circuit-clock-owner', {board: null, owner: f.requests[0].owner});
    assert.equal(f.runtime.bwCrispBasicSimulation, current);
    assert.equal(f.designer._coupledOwner, current);
    acknowledgeSecond();
    const lease = await second.promise;
    lease.dispose();
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

test('an abort before the Designer sees its request cannot install a ghost owner', async () => {
    const f = fixture({acknowledge: false});
    const abort = new AbortController();
    // A prior listener can Stop synchronously while dispatch is still walking listeners.
    const isolated = new EventTarget();
    isolated.addEventListener('bw-circuit-clock-owner', event => { if (event.detail.board) abort.abort(); });
    isolated.addEventListener('bw-circuit-clock-owner', event => f.designer._couplingHandler(event));
    await assert.rejects(createCrispBasicCircuitSession({runtime: f.runtime, eventTarget: isolated,
        signal: abort.signal}), /stopped|cancelled/);
    assert.equal(f.designer._coupledBoard, null);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.callbacks.length, 1, 'only the no-op release may schedule an acknowledgement');
});

test('a rejected Designer clock leaves another owner and its pin drive untouched', async () => {
    const f = fixture();
    const other = {name: 'other'};
    f.designer._coupledOwner = other; f.designer._coupledBoard = f.board;
    f.board.setPower(true); f.board.setPin('d13', 'pushpull', true);
    await assert.rejects(f.start().promise, /already has an owner/);
    assert.equal(f.designer._coupledOwner, other);
    assert.equal(f.board.powered, true);
    assert.ok(f.board.readAnalog('d13') > 4.9);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
});

for (const conflict of ['bwCrispBasicSimulation', 'bwCircuitRunPreparing', 'bwRunBoard', 'bwProgramClock', 'threads', 'cadCircuitSimulation']) {
    test(`BASIC refuses competing ${conflict} before requesting the Designer`, async () => {
        const f = fixture();
        f.runtime[conflict] = conflict === 'threads' ? [{}] : conflict === 'cadCircuitSimulation' ? {state: () => ({phase: 'preparing'})} : {};
        await assert.rejects(f.start().promise, /Stop the other/);
        assert.equal(f.requests.length, 0);
    });
}

test('a rejected or absent canvas never creates an inferred board', async () => {
    const f = fixture();
    f.runtime.circuitModel.netlistError = 'bad net';
    await assert.rejects(f.start().promise, /rejected: bad net/);
    delete f.runtime.circuitBoard; delete f.runtime.circuitModel;
    await assert.rejects(f.start().promise, /Open a wired circuit/);
    assert.equal(f.requests.length, 0);
});

for (const cause of ['bw-circuit-changed', 'bw-power-off', 'bw-stop-all', 'bw-green-flag', 'PROJECT_LOADED', 'PROJECT_STOP_ALL', 'PROJECT_START', 'netlist', 'reset', 'replacement']) {
    test(`${cause} revokes a live host before a later effect`, async () => {
        const f = fixture();
        const started = f.start(), lease = await started.promise;
        const host = lease.createHost({signal: started.controller.signal}, SimulationError);
        host.pinMode(13, 'output'); host.digitalWrite(13, 1);
        if (cause.startsWith('PROJECT_')) f.runtime.emit(cause);
        else if (cause === 'netlist') f.board.setNetlist(f.board.parts, f.board.getNets());
        else if (cause === 'reset') f.board.reset();
        else if (cause === 'replacement') { f.runtime.circuitBoard = makeBoard(); f.emit('bw-board-ready'); }
        else f.emit(cause);
        assert.equal(started.invalidations.length, 1);
        assert.equal(host.state, 'disposed');
        assert.throws(() => host.digitalWrite(13, 1), /disposed|stopped|cancelled/i);
        assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
        assert.equal(f.designer._coupledBoard, null);
        lease.dispose();
    });
}

test('refused project replacements and unrelated settings preserve the live lease', async () => {
    const f = fixture(), started = f.start(), lease = await started.promise;
    for (const outcome of ['future', 'invalid', 'storage-failed']) f.emit('bw-project-bundle-loaded', {outcome});
    f.emit('bw-settings-change', {key: 'unrelated'});
    assert.equal(started.invalidations.length, 0);
    assert.equal(f.designer._coupledBoard, f.board);
    f.emit('bw-project-bundle-loaded', {outcome: 'loaded'});
    assert.equal(started.invalidations.length, 1);
    lease.dispose();
});

test('host completion restoring power does not turn a successful run into cancellation', async () => {
    const f = fixture(); f.board.setPower(false);
    const started = f.start(), lease = await started.promise;
    const host = lease.createHost({signal: started.controller.signal}, SimulationError);
    host.dispose();
    assert.equal(f.board.powered, false);
    assert.deepEqual(started.invalidations, []);
    lease.dispose();
});

test('abort retains unusual cleanup failures for the awaited disposer, without throwing from its listener', async () => {
    const f = fixture(), started = f.start(), lease = await started.promise;
    const host = lease.createHost({signal: started.controller.signal}, SimulationError);
    host.pinMode(13, 'output');
    failNextPinRelease(f.board);
    assert.doesNotThrow(() => started.controller.abort());
    await turn();
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.designer._coupledBoard, null);
    assert.equal(f.board._externalClock, null);
    assert.throws(() => lease.dispose(), /Circuit cleanup failed: null/);
});

test('a runner cleanup failure is a host error and leaves Run and Reset usable', async () => {
    const f = fixture();
    let host, finish;
    const runner = createCrispBasicRunner({circuit: {runtime: f.runtime, eventTarget: f.eventTarget},
        assetBaseURL: 'https://example.invalid/static/crispbasic/',
        loadRuntime: async () => ({SimulationError, createWasmSession (options) {
            return {
                run () {
                    host = options.simulation.createHost({signal: new AbortController().signal});
                    host.pinMode(13, 'output');
                    failNextPinRelease(f.board);
                    return new Promise(resolve => { finish = resolve; });
                }, cancel () { finish({status: 'cancelled'}); }, dispose () {}
            };
        }})});
    const running = runner.run('END');
    await turn();
    finish({status: 'completed'});
    const result = await running;
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /cleanup failed: null/);
    assert.equal(runner.state, 'idle');
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    await runner.reset();
    await runner.dispose();
});

test('reentrant cancellation rechecks a deferred host cleanup failure after its pin operation unwinds', async () => {
    const f = fixture();
    let finish;
    const runner = createCrispBasicRunner({circuit: {runtime: f.runtime, eventTarget: f.eventTarget},
        assetBaseURL: 'https://example.invalid/static/crispbasic/',
        loadRuntime: async () => ({SimulationError, createWasmSession (options) {
            return {
                run () {
                    return new Promise(resolve => {
                        finish = resolve;
                        const host = options.simulation.createHost({signal: new AbortController().signal});
                        host.pinMode(13, 'output');
                        failNextPinRelease(f.board);
                        const cancelOnDrive = event => {
                            if (event.type === 'pin' && event.detail?.driveHigh) runner.cancel();
                        };
                        f.board.onChange(cancelOnDrive);
                        try { host.digitalWrite(13, 1); } catch { /* Cancellation owns the in-flight request. */ }
                        f.board.offChange(cancelOnDrive);
                    });
                }, cancel () { finish({status: 'cancelled'}); }, dispose () {}
            };
        }})});
    const result = await runner.run('PROCdigitalWrite(13, 1)');
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /cleanup failed: null/);
    assert.equal(runner.state, 'idle');
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.board._externalClock, null);
    await runner.dispose();
});

test('clock acknowledgement timeout returns the pending reservation without touching pins', async () => {
    const f = fixture({acknowledge: false});
    await assert.rejects(f.start({timeoutMs: 5}).promise, /Open the Circuit tab/);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.designer._coupledOwner, null);
    assert.equal(f.board._externalClock, undefined);
});

test('a setup listener failure releases the reservation before rejecting', async () => {
    const f = fixture();
    f.board.onChange = () => { throw new Error('listener setup failed'); };
    await assert.rejects(f.start().promise, /listener setup failed/);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.requests.length, 0);
});

test('a retained AVR debugger cannot restart, step or reset while BASIC owns the canvas', async () => {
    const {createDebugRunner} = await import('../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js');
    const {startPicoSimRun} = await import('../overlay/scratch-gui/src/lib/pico-sim-run.js');
    const f = fixture();
    f.runtime.stc = {device: 'arduino-uno', pins: []};
    const vm = {runtime: f.runtime, toJSON: () => JSON.stringify({targets: [], stc: f.runtime.stc})};
    const debuggerRunner = createDebugRunner({vm, targetKind: 'avr8js'});
    debuggerRunner.setFirmware({name: 'loop.hex', text: ':02000000FFCF30\n:00000001FF\n'});
    try {
        const preparing = debuggerRunner.start({paused: true});
        await assert.rejects(f.start().promise, /Stop the other/, 'BASIC cannot take over a debugger still attaching');
        await preparing;
        assert.equal(debuggerRunner.state().phase, 'paused');
        assert.equal(f.runtime.bwCircuitRunPreparing, undefined);
        debuggerRunner.stop();
        const started = f.start(), lease = await started.promise;
        const host = lease.createHost({signal: started.controller.signal}, SimulationError);
        host.pinMode(13, 'output'); host.digitalWrite(13, 1);
        const previousTime = debuggerRunner.timeMs();
        for (const name of ['resume', 'step', 'stepCycle', 'stepInstruction', 'stepOver', 'stepOut',
            'resetCpu', 'wipe', 'restoreSnapshot', 'writeMem', 'writeReg', 'setPc']) {
            assert.equal(debuggerRunner[name]().code, 'circuit-owned', `${name} must refuse before mutating the retained target`);
        }
        assert.equal(debuggerRunner.runToAddress(0).code, 'circuit-owned');
        await assert.rejects(debuggerRunner.start(), /Stop BASIC/);
        await assert.rejects(startPicoSimRun({vm}), /Stop BASIC/);
        assert.equal(debuggerRunner.timeMs(), previousTime);
        assert.equal(f.board.readPin('d13'), 1);
        lease.dispose();
        assert.equal(debuggerRunner.stepInstruction(), undefined);
        assert.ok(debuggerRunner.timeMs() > previousTime, 'debugger execution is usable after BASIC releases the canvas');
    } finally { f.runtime.bwCrispBasicSimulation?.stop(); debuggerRunner.destroy(); }
});
