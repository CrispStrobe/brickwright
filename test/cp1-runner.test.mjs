// SPDX-License-Identifier: BSD-3-Clause
// Execute the real Lite runner, CP1 target, adapter and BoardImpl together.
// Every ROM byte below is authored for this test; no historical ROM is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardImpl, registerAllDevices, CP1_TERMINALS} from 'bw-board';
import {createDebugRunner, boardTimeBase} from
    '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js';
import {assembleCp1Program} from '../overlay/scratch-gui/src/lib/cp1-program.js';

registerAllDevices();

function firmware(code = [
    0x23, 0xaf, // MOV A,#AF: base I/O selected; reset released
    0x3a,       // OUTL P2,A
    0xb8, 0x00, // MOV R0,#00: 8155 command register
    0x23, 0x0f, // MOV A,#0F: basic PA/PB/PC output mode
    0x90,       // MOVX @R0,A
    0xb8, 0x02, // MOV R0,#02: external port 2 / base PB
    0x09,       // IN A,P1: physical switch input
    0x90,       // MOVX @R0,A: drive the resistor/LED network
    0x04, 0x0a, // JMP input loop
]) {
    const bytes = new Uint8Array(2048);
    bytes.set(code);
    return bytes;
}

function realBoard(expansion) {
    const board = new BoardImpl(5);
    board.setNetlist([
        {id: 'trainer', kind: 'kosmos-cp1', params: {expansion}, terminals: [...CP1_TERMINALS]},
        {id: 'r', kind: 'resistor', params: {ohms: 330}, terminals: ['a', 'b']},
        {id: 'led', kind: 'led', params: {vf: 2, color: 'red'}, terminals: ['anode', 'cathode']},
        {id: 'switch', kind: 'switch', params: {closed: false}, terminals: ['a', 'b']},
    ], [
        {id: 'out', terminals: [{part: 'trainer', terminal: 'P2.0'}, {part: 'r', terminal: 'a'}]},
        {id: 'led', terminals: [{part: 'r', terminal: 'b'}, {part: 'led', terminal: 'anode'}]},
        {id: 'in', terminals: [{part: 'trainer', terminal: 'P1.0'}, {part: 'switch', terminal: 'a'}]},
        {id: 'ground', terminals: [{part: 'trainer', terminal: 'gnd'},
            {part: 'switch', terminal: 'b'}, {part: 'led', terminal: 'cathode'}]},
    ]);
    board.advanceTo(100000000n);
    return board;
}

function controlledBrowser() {
    const names = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch'];
    const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const events = new EventTarget();
    const frames = new Map();
    const dispatched = [];
    let nextId = 1;
    let frameNumber = 0;
    let networkCalls = 0;
    globalThis.window = Object.assign(Object.create(globalThis), {
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent(event) { dispatched.push(event); return events.dispatchEvent(event); },
    });
    globalThis.document = {baseURI: 'http://localhost/', documentElement: {lang: 'en'}};
    globalThis.requestAnimationFrame = callback => {
        const id = nextId++;
        frames.set(id, callback);
        return id;
    };
    globalThis.cancelAnimationFrame = id => frames.delete(id);
    globalThis.fetch = async () => {
        networkCalls++;
        throw new Error('A CP1 ROM runner must not request a compiler or network resource');
    };
    return {
        frames, dispatched,
        get networkCalls() { return networkCalls; },
        frame() {
            const pending = frames.entries().next().value;
            assert.ok(pending, 'the real runner scheduled an animation frame');
            const [id, callback] = pending;
            frames.delete(id);
            callback(++frameNumber * (1000 / 60));
        },
        drainIdle() {
            // A pause during an editor action may leave one already scheduled
            // callback. It must retire without running the CPU or scheduling more.
            if (frames.size) this.frame();
            assert.equal(frames.size, 0, 'a paused runner does not keep scheduling work');
        },
        restore() {
            frames.clear();
            for (const [name, descriptor] of originals) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor);
                else delete globalThis[name];
            }
        },
    };
}

function fixture(t, options = {}) {
    const browser = controlledBrowser();
    const expansion = options.expansion ?? false;
    const board = realBoard(expansion);
    const seen = [];
    let compilerCalls = 0;
    let destroyed = false;
    const vm = {
        runtime: {stc: {device: 'kosmos-cp1', pins: []}, circuitBoard: board,
            targets: [], on() {}, off() {}, emit() {}, glowBlock() {}},
        toJSON() {
            compilerCalls++;
            throw new Error('CP1 ROM execution must not serialize blocks for compilation');
        },
    };
    const bootMedia = Object.hasOwn(options, 'bootMedia') ? options.bootMedia
        : {slot: 'rom', name: 'original-test-firmware.bin', bytes: options.rom ?? firmware()};
    const runner = createDebugRunner({vm, targetKind: 'cp1', bootMedia,
        compilerUrl: 'https://compiler.invalid/must-not-be-used',
        machineConfig: {expansion, clockHz: 6000000, partId: 'trainer'},
        onChange: state => seen.push(state)});
    const result = {
        browser, board, vm, runner, seen,
        target: () => globalThis.window.__benchTarget,
        destroy() { if (!destroyed) { runner.destroy(); destroyed = true; } },
        async start() {
            await runner.start();
            assert.equal(runner.state().phase, 'running', runner.state().message);
            // A deterministic 100 us of program time per manually delivered frame.
            runner.setSpeed(0.006);
            assert.equal(browser.frames.size, 1);
            return result;
        },
    };
    t.after(() => {
        try { result.destroy(); }
        finally { browser.restore(); }
        assert.equal(compilerCalls, 0, 'no block compiler or serializer was invoked');
        assert.equal(browser.networkCalls, 0, 'no compiler request or firmware download was made');
    });
    return result;
}

test('CP1 runner executes supplied firmware on the existing real board with one clock and qualified pins', async t => {
    const f = fixture(t, {expansion: true});
    assert.equal(f.runner.cp1Snapshot(), null);
    await f.start();
    const target = f.target();
    assert.equal(target.kind, 'cp1');
    assert.equal(f.runner.board(), f.board);
    assert.equal(f.vm.runtime.circuitBoard, f.board);
    assert.equal(f.vm.runtime.bwRunBoard, f.board);
    assert.equal(target.adapter.machine, target.machine);
    assert.equal(target.machine.expansion, true);
    assert.equal(f.runner.cp1Snapshot().capacity, 256);
    assert.equal(target.timeNs(), 0n);
    assert.equal(f.board.timeNs, 100000000n);
    assert.equal(boardTimeBase(f.board, target), 100000000n);
    assert.ok(f.seen.some(state => /original-test-firmware\.bin/.test(state.message)));
    assert.equal(typeof f.runner.sendSerial, 'undefined', 'CP1 does not advertise an invented serial console');

    f.browser.frame();
    assert.equal(target.timeNs(), 100000n);
    assert.equal(f.board.timeNs, 100100000n, 'adapter and runner do not double-advance the board');
    assert.equal(f.runner.cp1Snapshot().ports.P2.value, 0xff);
    assert.ok(f.board.pinStates.has('trainer.p2.0'), 'machineConfig.partId reaches the adapter');
    assert.ok(!f.board.pinStates.has('p2.0'), 'a part-qualified run does not publish an extra bare pin driver');
    assert.ok(f.board.pinStates.has('trainer.p5.5'), 'CP3 pins reach the same circuit board');
    assert.ok(f.board.ledBrightnessNow('led') > 0.3);

    f.board.setControl('switch', 1);
    f.browser.frame();
    assert.equal(f.runner.cp1Snapshot().ports.P1.value, 0xfe);
    assert.equal(f.runner.cp1Snapshot().ports.P2.value, 0xfe);
    assert.equal(f.board.ledBrightnessNow('led'), 0);
    assert.equal(f.board.timeNs, 100200000n);
    assert.equal(target.timeNs(), 200000n);
});

test('CP1 runner snapshots stay detached and passive, and pause/resume freezes the same board', async t => {
    const f = await fixture(t).start();
    f.browser.frame();
    const machine = f.target().machine;
    const running = machine.saveState();
    const boardTime = f.board.timeNs;
    const pendingFrames = f.browser.frames.size;
    const samples = f.target().adapter.stats.inputSampleCount;
    for (let i = 0; i < 5; i++) {
        const snapshot = f.runner.cp1Snapshot();
        snapshot.cells[0].operand = 255;
        snapshot.display.duty[0][0] = 500;
        f.runner.state();
        f.runner.timeMs();
    }
    assert.deepEqual(machine.saveState(), running);
    assert.equal(f.board.timeNs, boardTime);
    assert.equal(f.browser.frames.size, pendingFrames);
    assert.equal(f.target().adapter.stats.inputSampleCount, samples);

    f.runner.cp1Key('RUN', true);
    f.runner.pause();
    assert.equal(f.runner.state().phase, 'paused');
    assert.deepEqual(f.runner.cp1Snapshot().keys, []);
    const paused = machine.saveState();
    f.browser.drainIdle();
    assert.deepEqual(machine.saveState(), paused);
    assert.equal(f.board.timeNs, boardTime);
    f.runner.resume();
    assert.equal(f.runner.state().phase, 'running');
    f.browser.frame();
    assert.ok(machine.cycles > paused.cycles);
    assert.equal(f.board.timeNs, boardTime + 100000n);
});

test('CP1 program load pauses execution, releases keys, writes physical RAM, and publishes one completed load', async t => {
    const f = await fixture(t).start();
    f.browser.frame();
    const machine = f.target().machine;
    machine.writeCell(127, 7, 99);
    f.runner.cp1Key('PC', true);
    const assembly = assembleCp1Program('AKO 42\nANZ\nHLT\n');
    assert.equal(assembly.bytes.length, 256);
    const at = f.board.timeNs;
    const cycles = machine.cycles;
    f.runner.cp1LoadProgram(assembly);
    assert.equal(f.runner.state().phase, 'paused');
    assert.equal(f.target().state(), 'halted');
    assert.deepEqual(f.runner.cp1Snapshot().keys, []);
    assert.deepEqual(machine.readCell(0), {opcode: 4, operand: 42});
    assert.deepEqual(machine.readCell(1), {opcode: 2, operand: 0});
    assert.deepEqual(machine.readCell(2), {opcode: 1, operand: 0});
    assert.deepEqual(machine.readCell(127), {opcode: 0, operand: 0});
    assert.equal(machine.cycles, cycles);
    assert.equal(f.board.timeNs, at);
    const loaded = f.browser.dispatched.filter(event => event.type === 'bw-cp1-program-loaded');
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].detail, {cells: 3, expansion: false});
    assembly.bytes.fill(0xff);
    assert.deepEqual(machine.readCell(0), {opcode: 4, operand: 42});
    f.browser.drainIdle();
    assert.equal(machine.cycles, cycles);
    assert.equal(f.board.timeNs, at);
});

test('CP1 program loading rejects oversized CP3 images and odd-byte images without clearing base RAM', async t => {
    const f = await fixture(t).start();
    f.browser.frame();
    const machine = f.target().machine;
    machine.writeCell(0, 4, 66);
    machine.writeCell(127, 7, 123);
    const before = Array.from(machine.base.ram);
    const expanded = assembleCp1Program('ORG 255\nHLT\n', {expansion: true});
    const badInputs = [
        expanded,
        {ok: true, bytes: new Uint8Array([4, 42, 7]), words: [{address: 0, opcode: 4, operand: 42}]},
        {ok: false, bytes: new Uint8Array(256), words: []},
        {ok: true, bytes: [4, 42], words: [{address: 0, opcode: 4, operand: 42}]},
    ];
    for (const assembly of badInputs) {
        assert.throws(() => f.runner.cp1LoadProgram(assembly));
        assert.deepEqual(Array.from(machine.base.ram), before);
    }
    assert.equal(f.browser.dispatched.filter(event => event.type === 'bw-cp1-program-loaded').length, 0);
    assert.equal(f.board.timeNs, 100100000n);
});

test('CP3 program loading uses the installed expansion and manual cell edits pause before validation', async t => {
    const f = await fixture(t, {expansion: true}).start();
    f.browser.frame();
    const machine = f.target().machine;
    f.runner.cp1LoadProgram(assembleCp1Program('ORG 255\nAKO 99\n', {expansion: true}));
    assert.deepEqual(machine.readCell(255), {opcode: 4, operand: 99});
    assert.deepEqual(Array.from(machine.expansionChip.ram.slice(254)), [4, 99]);
    f.runner.resume();
    assert.equal(f.runner.state().phase, 'running');
    const beforeTime = machine.cycles;
    assert.equal(f.runner.cp1WriteCell(128, {opcode: 7, operand: 255}), true);
    assert.equal(f.runner.state().phase, 'paused');
    assert.deepEqual(machine.readCell(128), {opcode: 7, operand: 255});
    assert.equal(machine.cycles, beforeTime);
    const before = machine.saveState();
    assert.throws(() => f.runner.cp1WriteCell(256, {opcode: 1, operand: 0}));
    assert.throws(() => f.runner.cp1WriteCell(128, {opcode: 1, operand: 256}));
    assert.deepEqual(machine.saveState(), before);
});

test('CP1 runner releases physical keys on release, reset, stop and teardown without rewinding the board', async t => {
    const f = await fixture(t).start();
    f.browser.frame();
    const target = f.target();
    const machine = target.machine;
    assert.equal(f.runner.cp1Key('RUN', true), true);
    assert.equal(f.runner.cp1Key('2', true), true);
    assert.deepEqual(new Set(f.runner.cp1Snapshot().keys), new Set(['RUN', '2']));
    const cycles = machine.cycles;
    f.runner.cp1ReleaseKeys();
    assert.deepEqual(f.runner.cp1Snapshot().keys, []);
    assert.equal(machine.cycles, cycles);
    machine.writeCell(0, 4, 88);
    f.runner.cp1Key('CAS', true);
    assert.equal(f.runner.cp1Reset(), true);
    assert.equal(f.runner.state().phase, 'paused');
    assert.deepEqual(machine.pressedKeys, []);
    assert.equal(machine.cpu.pc, 0);
    assert.equal(machine.cpu.cycles, 0);
    assert.equal(machine.cycles, cycles);
    assert.deepEqual(machine.readCell(0), {opcode: 4, operand: 88});
    assert.equal(f.board.timeNs, 100100000n);
    f.browser.drainIdle();

    f.runner.resume();
    f.runner.cp1Key('STEP', true);
    f.runner.stop();
    assert.equal(f.runner.state().phase, 'idle');
    assert.deepEqual(machine.pressedKeys, []);
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.vm.runtime.circuitBoard, f.board);
    assert.equal(f.board.timeNs, 100100000n);
    assert.equal(f.browser.frames.size, 0);
    await f.runner.start();
    f.runner.cp1Key('INP', true);
    f.destroy();
    assert.equal(target.state(), 'detached');
    assert.deepEqual(machine.pressedKeys, []);
    assert.equal(f.runner.cp1Snapshot(), null);
    assert.equal(f.runner.cp1Key('RUN', true), false);
    assert.equal(f.vm.runtime.bwRunBoard, undefined);
    assert.equal(f.browser.frames.size, 0);
    const pin = {...f.board.pinStates.get('trainer.p1.0')};
    machine.writeCpuPort(1, 0);
    assert.deepEqual(f.board.pinStates.get('trainer.p1.0'), pin, 'a detached machine cannot keep driving the old circuit');
    assert.equal(f.board.timeNs, 100100000n);
});

test('CP1 runner treats a 2048-byte image beginning with OUTL P2,A as raw firmware', async t => {
    const f = await fixture(t, {rom: firmware([0x3a, 0x04, 0x01])}).start();
    f.browser.frame();
    assert.equal(f.runner.state().phase, 'running');
    assert.equal(f.target().machine.cpu.rom[0], 0x3a);
    assert.equal(f.runner.cp1Snapshot().rom.bytes, 2048);
    assert.equal(f.runner.cp1Snapshot().rom.known, false);
});

for (const [label, bootMedia] of [
    ['missing', null],
    ['empty', {bytes: new Uint8Array()}],
    ['short', {bytes: new Uint8Array(2047)}],
    ['long', {bytes: new Uint8Array(2049)}],
]) {
    test(`CP1 runner visibly refuses ${label} firmware without compiler or network fallback`, async t => {
        const f = fixture(t, {bootMedia});
        await f.runner.start();
        assert.equal(f.runner.state().phase, 'error');
        assert.match(f.runner.state().message, /2048/);
        assert.ok(f.seen.some(state => state.phase === 'error' && /2048/.test(state.message)));
        assert.equal(f.runner.cp1Snapshot(), null);
        assert.equal(f.runner.cp1Key('RUN', true), false);
        assert.equal(f.vm.runtime.bwRunBoard, undefined);
        assert.equal(f.vm.runtime.circuitBoard, f.board);
        assert.equal(f.browser.frames.size, 0);
        assert.equal(f.board.timeNs, 100000000n);
    });
}
