// Code-document integration must retain the existing Pico route when its owner
// changes during startup. Exercise the production orchestration with controlled
// emulator/import boundaries; firmware/GPIO qualification stays in its browser gate.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getEventListeners} from 'node:events';
import {runInNewContext} from 'node:vm';
import {createFreshPicoEpoch, createPicoByteChannel}
    from '../overlay/scratch-gui/src/lib/pico-sim-epoch.js';

const source = readFileSync(new URL('../overlay/scratch-gui/src/lib/pico-sim-run.js', import.meta.url), 'utf8');
const executable = source
    .replace(/^import \{createFreshPicoEpoch, createPicoByteChannel\} from .*;\n/, '')
    .replace(/\bexport (?=(?:async )?function)/g, '')
    .replace(/\bimport\s*\(/g, 'loadModule(');
const defer = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };

function fixture (options = {}) {
    let clock = 0;
    let nextId = 0;
    const frames = new Map();
    const timers = new Map();
    const stats = {loads: [], boards: [], adapters: [], serial: [], programs: [], statuses: [], errors: [], events: []};
    const vm = {runtime: {}};
    const window = {dispatchEvent (event) {
        stats.events.push(event.type);
        if (options.onDispatch) options.onDispatch(event);
    }};
    class Board {
        constructor () { stats.boards.push(this); }
        setNetlist (parts, nets) { this.netlist = {parts, nets}; }
        setPower (value) { this.power = value; }
    }
    class CDC {
        constructor (controller) { controller.cdc = this; this.sent = []; stats.serial.push(this); }
        sendSerialByte (byte) { this.sent.push(byte); }
    }
    const createAdapter = () => {
        const adapter = {
            rp2040: {flash: new Uint8Array(8), usbCtrl: {}, clock: {nanos: 0}},
            attachBoard (board) { this.board = board; },
            bootFromFlash (image) { this.rp2040.flash.set(image); },
            advanceNs (ns) {
                this.rp2040.clock.nanos += ns;
                if (options.onAdvance) options.onAdvance();
                const cdc = this.rp2040.usbCtrl.cdc;
                if (options.enumerate !== false && !cdc.connected) {
                    cdc.connected = true;
                    cdc.onDeviceConnected();
                }
            },
            takeResetRequest () { const reset = this.reset; this.reset = false; return reset; }
        };
        stats.adapters.push(adapter);
        return adapter;
    };
    const modules = {
        'bw-board': {BoardImpl: Board, inferNetlist: () => ({parts: [], nets: []})},
        'bw-board/rp2040js-adapter': {createRp2040jsAdapter: createAdapter},
        './bw-debug/resolve-netlist.js': {resolveNetlist: async () => {
            if (options.netlistGate) await options.netlistGate;
            return {parts: [], nets: []};
        }},
        './pico-repl.js': {createPicoRepl: transport => ({async deployMainPy (py) {
            const adapter = stats.adapters.at(-1);
            stats.programs.push(py);
            if (options.deploy) await options.deploy({py, transport, adapter});
            if (options.reset !== false) adapter.reset = true;
        }})},
        rp2040js: {USBCDC: CDC}
    };
    const api = runInNewContext(`${executable}\n({startPicoSimRun});`, {
        createFreshPicoEpoch, createPicoByteChannel,
        Error, Uint8Array, Promise,
        Date: class extends Date { static now () { return clock; } },
        CustomEvent: class { constructor (type) { this.type = type; } },
        window,
        loadModule: async specifier => {
            stats.loads.push(specifier);
            if (options.loadGate) await options.loadGate(specifier);
            assert.ok(modules[specifier], `unexpected dependency ${specifier}`);
            return modules[specifier];
        },
        requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout: (callback, delay = 0) => {
            const id = ++nextId;
            timers.set(id, {callback, due: clock + delay});
            return id;
        },
        clearTimeout: id => timers.delete(id)
    });
    const start = (py = 'print(1)', signal) => {
        const result = {settled: false};
        result.promise = api.startPicoSimRun({image: new Uint8Array([1]), vm, stc: {}, py, signal,
            onStatus: value => stats.statuses.push(value), onError: error => stats.errors.push(error)});
        result.promise.then(value => { result.settled = true; result.value = value; },
            error => { result.settled = true; result.error = error; });
        return result;
    };
    const tick = async () => {
        clock += 16;
        const readyFrames = [...frames];
        frames.clear();
        for (const [, callback] of readyFrames) callback(clock);
        const readyTimers = [...timers].filter(([, timer]) => timer.due <= clock);
        for (const [id, timer] of readyTimers) { timers.delete(id); timer.callback(); }
        await flush();
    };
    const until = async predicate => {
        await flush();
        for (let i = 0; i < 100 && !predicate(); i++) await tick();
        assert.ok(predicate(), 'controlled startup did not reach the requested boundary');
    };
    const running = async result => {
        await until(() => result.settled);
        if (result.error) throw result.error;
        return result.value;
    };
    return {start, running, until, tick, vm, window, stats, frames, timers};
}

test('Pico default no-signal route still installs the clicked program, resets and owns its Stop', async () => {
    const f = fixture();
    const handle = await f.running(f.start('print(-3 // 2)\n'));
    assert.deepEqual(f.stats.programs, ['print(-3 // 2)\n']);
    assert.equal(f.stats.adapters.length, 2, 'deployment must replace the controller on reset');
    assert.equal(f.vm.runtime.bwRunBoard, f.stats.boards[0]);
    assert.equal(f.window.__bwPicoSim.phase(), 'running');
    assert.equal(f.frames.size, 1);
    handle.stop();
    handle.stop();
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.window.__bwPicoSim, undefined);
    assert.equal(f.frames.size, 0);
    assert.deepEqual(f.stats.serial.at(-1).sent, [3, 3]);
});

test('already-aborted Pico startup imports nothing and leaves existing bindings untouched', async () => {
    const controller = new AbortController();
    controller.abort();
    const f = fixture();
    const board = f.vm.runtime.bwRunBoard = {};
    const observation = f.window.__bwPicoSim = {};
    const result = f.start('print(1)', controller.signal);
    await assert.rejects(result.promise, {name: 'AbortError'});
    assert.deepEqual(f.stats.loads, []);
    assert.deepEqual(f.stats.statuses, []);
    assert.equal(f.vm.runtime.bwRunBoard, board);
    assert.equal(f.window.__bwPicoSim, observation);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

for (const boundary of ['dependency', 'netlist']) {
    test(`Pico cancellation during ${boundary} wait settles immediately and cannot publish later`, async () => {
        const gate = defer();
        const controller = new AbortController();
        const f = fixture(boundary === 'dependency' ? {loadGate: () => gate.promise} : {netlistGate: gate.promise});
        const result = f.start('print(1)', controller.signal);
        await flush();
        assert.equal(result.settled, false);
        controller.abort();
        await flush();
        assert.equal(result.settled, true, 'Stop must not await the unresolved dependency');
        await assert.rejects(result.promise, {name: 'AbortError'});
        const successor = f.vm.runtime.bwRunBoard = {};
        const observation = f.window.__bwPicoSim = {};
        gate.resolve();
        await flush();
        assert.equal(f.stats.boards.length, 0);
        assert.equal(f.vm.runtime.bwRunBoard, successor);
        assert.equal(f.window.__bwPicoSim, observation);
        assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    });
}

test('Pico abort during USB boot cancels its pump before deployment', async () => {
    const f = fixture({enumerate: false});
    const controller = new AbortController();
    const result = f.start('print(1)', controller.signal);
    await flush();
    assert.equal(f.window.__bwPicoSim.phase(), 'booting');
    assert.equal(f.frames.size, 1);
    controller.abort();
    await assert.rejects(result.promise, {name: 'AbortError'});
    await f.tick();
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.window.__bwPicoSim, undefined);
    assert.deepEqual(f.stats.programs, []);
});

test('Pico cancellation inside a board step cannot schedule another pump', async () => {
    const controller = new AbortController();
    const f = fixture({onAdvance: () => controller.abort()});
    const result = f.start('print(1)', controller.signal);
    await flush();
    await f.tick();
    await assert.rejects(result.promise, {name: 'AbortError'});
    assert.equal(f.frames.size, 0);
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.window.__bwPicoSim, undefined);
    assert.deepEqual(f.stats.programs, []);
});

test('Pico abort interrupts an in-flight deploy read without a late error publication', async () => {
    let transport;
    const f = fixture({deploy: async request => { transport = request.transport; await transport.read(); }});
    const controller = new AbortController();
    const result = f.start('print(1)', controller.signal);
    await f.until(() => Boolean(transport));
    controller.abort();
    await assert.rejects(result.promise, {name: 'AbortError'});
    await assert.rejects(transport.read(), {name: 'AbortError'});
    await assert.rejects(transport.write('late program bytes'), {name: 'AbortError'});
    await flush();
    assert.equal(f.frames.size, 0);
    assert.deepEqual(f.stats.serial.at(-1).sent, [3, 3]);
    assert.deepEqual(f.stats.errors, []);
    assert.equal(f.stats.statuses.includes('running'), false);
});

test('Pico abort while awaiting its reboot cannot later report running', async () => {
    const f = fixture({reset: false});
    const controller = new AbortController();
    const result = f.start('print(1)', controller.signal);
    await f.until(() => f.window.__bwPicoSim?.subPhase() === 'waiting-for-reset');
    controller.abort();
    await assert.rejects(result.promise, {name: 'AbortError'});
    await f.tick();
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.stats.statuses.includes('running'), false);
});

test('older Pico Stop never removes a newer running board or observation', async () => {
    const f = fixture();
    const first = await f.running(f.start('print(1)'));
    const controller = new AbortController();
    const second = await f.running(f.start('print(2)', controller.signal));
    const board = f.vm.runtime.bwRunBoard;
    const observation = f.window.__bwPicoSim;
    assert.notEqual(board, f.stats.boards[0]);
    first.stop();
    assert.equal(f.vm.runtime.bwRunBoard, board);
    assert.equal(f.window.__bwPicoSim, observation);
    assert.equal(f.frames.size, 1, 'only the successor pump remains');
    controller.abort();
    second.stop();
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.window.__bwPicoSim, undefined);
    assert.equal(f.frames.size, 0);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('late completion of an aborted Pico deployment preserves its successor', async () => {
    const gate = defer();
    const f = fixture({deploy: async ({py}) => { if (py === 'first') await gate.promise; }});
    const controller = new AbortController();
    const first = f.start('first', controller.signal);
    await f.until(() => f.stats.programs.includes('first'));
    const second = await f.running(f.start('second'));
    const board = f.vm.runtime.bwRunBoard;
    const observation = f.window.__bwPicoSim;
    controller.abort();
    await assert.rejects(first.promise, {name: 'AbortError'});
    gate.resolve();
    await flush();
    await f.tick();
    assert.equal(f.vm.runtime.bwRunBoard, board);
    assert.equal(f.window.__bwPicoSim, observation);
    assert.equal(f.frames.size, 1);
    assert.deepEqual(f.stats.errors, []);
    second.stop();
});

test('synchronous board publication cancellation creates no later observation or pump', async () => {
    const controller = new AbortController();
    const f = fixture({onDispatch: () => controller.abort()});
    const result = f.start('print(1)', controller.signal);
    await assert.rejects(result.promise, {name: 'AbortError'});
    await flush();
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.window.__bwPicoSim, undefined);
    assert.equal(f.frames.size, 0);
    assert.deepEqual(f.stats.programs, []);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});
