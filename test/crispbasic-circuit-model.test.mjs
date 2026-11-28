// Exercise the pinned Circuit model's real snapshot/rebuild and undo paths.
// A newly constructed mock board cannot expose drive inheritance on rebuild.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {BoardImpl} from 'bw-board/board.js';
import {inferNetlist, checkWiring} from 'bw-board/infer-netlist.js';
import {getDevice} from 'bw-board/devices.js';
import {registerBoardKinds} from 'bw-board/devices/board-kinds.js';
import {Circuit} from 'bw-circuit-ui/model/circuit.js';
import {setEngine} from 'bw-circuit-ui/engine.js';
import {SimulationError} from '../packages/crisp-basic/src/simulation-host.mjs';
import {createCrispBasicCircuitSession} from '../overlay/scratch-gui/src/lib/crispbasic-circuit-session.js';

registerBoardKinds();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice});

async function fixture(t, {cleanupMayFail = false} = {}) {
    const model = Circuit.fromJSON({vcc: 5, parts: [
        {id: 'cpu', kind: 'arduino_uno', terminals: ['d13', 'd2', 'gnd'], params: {}, x: 0, y: 0},
        {id: 'ground', kind: 'gnd', terminals: ['gnd'], params: {}, x: 100, y: 100},
        {id: 'button', kind: 'button', terminals: ['a', 'b'], params: {}, x: 200, y: 100},
        {id: 'load', kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 220}, x: 200, y: 200}
    ], wires: [
        {id: 'ground-wire', from: {part: 'cpu', terminal: 'gnd'}, to: {part: 'ground', terminal: 'gnd'}},
        {id: 'button-wire', from: {part: 'cpu', terminal: 'd2'}, to: {part: 'button', terminal: 'a'}},
        {id: 'button-ground', from: {part: 'button', terminal: 'b'}, to: {part: 'ground', terminal: 'gnd'}},
        {id: 'load-wire', from: {part: 'cpu', terminal: 'd13'}, to: {part: 'load', terminal: 'a'}},
        {id: 'load-ground', from: {part: 'load', terminal: 'b'}, to: {part: 'ground', terminal: 'gnd'}}
    ]});
    assert.equal(model.netlistError, null);
    const board = model.board;
    board.setPower(false);
    const runtime = Object.assign(new EventEmitter(), {circuitModel: model, circuitBoard: board, threads: []});
    const eventTarget = new EventTarget();
    eventTarget.addEventListener('bw-circuit-clock-owner', event => event.detail.ready?.());
    const controller = new AbortController();
    const invalidations = [];
    const session = await createCrispBasicCircuitSession({runtime, eventTarget, signal: controller.signal,
        onInvalidate: error => { invalidations.push(error.message); controller.abort(); }});
    t.after(() => {
        controller.abort();
        try { session.dispose(); }
        catch (error) { if (!cleanupMayFail) throw error; }
    });
    const host = session.createHost({signal: controller.signal}, SimulationError);
    host.pinMode(13, 'output');
    host.digitalWrite(13, 1);
    assert.equal(host.digitalRead(13), 1, JSON.stringify(board.getPinStates()));
    return {model, board, runtime, session, host, invalidations, controller};
}

const releasedPins = board => {
    const pins = board.getPinStates();
    assert.ok(pins.every(pin => pin.mode === 'input'), JSON.stringify(pins));
};

for (const rebuild of ['_syncNetlist', 'syncWithExternalNets']) {
    test(`the real Circuit ${rebuild} releases BASIC before copying its solver snapshot`, async t => {
        const f = await fixture(t);
        f.board.setControl('button', 1);
        await f.host.delay(2);
        const time = f.board.getTime();
        if (rebuild === 'syncWithExternalNets') f.model.syncWithExternalNets(f.board.getNets());
        else f.model._syncNetlist();
        assert.equal(f.invalidations.length, 1);
        assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
        assert.equal(f.board._externalClock, null);
        assert.notEqual(f.model.board, f.board, 'the actual model creates a replacement board');
        assert.equal(f.model.netlistError, null);
        releasedPins(f.board);
        releasedPins(f.model.board);
        assert.equal(f.model.board.getTime(), time, 'accepted electrical time is preserved');
        assert.equal(f.model.board.getControl('button'), 1, 'external button state is preserved');
        assert.equal(f.model.board.powered, false, 'temporary BASIC power is not inherited');
        assert.equal(Object.hasOwn(f.model, '_syncNetlist'), false);
        assert.equal(Object.hasOwn(f.model, 'syncWithExternalNets'), false);
        assert.equal(Object.hasOwn(f.model, '_saveHistory'), false);
    });
}

test('real history, undo and redo never retain an active BASIC output drive', async t => {
    const f = await fixture(t);
    f.model._saveHistory();
    assert.equal(f.invalidations.length, 1);
    releasedPins(f.board);
    f.model.addPart('resistor', {ohms: 220}, 300, 100);
    assert.equal(f.model.undo(), true);
    releasedPins(f.model.board);
    assert.equal(f.model.redo(), true);
    releasedPins(f.model.board);
    assert.equal(f.model.board.powered, false);
});

test('a read-only solver snapshot and Circuit export preserve the active run and show its real drive', async t => {
    const f = await fixture(t);
    const before = f.runtime.bwCrispBasicSimulation;
    const snapshot = f.board.snapshot();
    const pin = new Map(snapshot.pinStates).get('d13');
    assert.equal(pin.mode, 'pushpull');
    assert.equal(pin.driveHigh, true);
    assert.equal(f.model.toJSON().parts.length, 4);
    assert.equal(f.runtime.bwCrispBasicSimulation, before);
    assert.deepEqual(f.invalidations, []);
    assert.equal(f.host.state, 'ready');
});

test('a foreign GPIO takeover remains authoritative when the real Circuit subsequently rebuilds', async t => {
    const f = await fixture(t);
    f.board.setPin('d13', 'pushpull', false);
    assert.equal(f.invalidations.length, 1);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    f.model._syncNetlist();
    const pin = f.model.board.getPinStates().find(value => value.pin.toLowerCase() === 'd13');
    assert.equal(pin.mode, 'pushpull');
    assert.equal(pin.driveHigh, false);
});

test('failed BASIC cleanup prevents a real Circuit rebuild from copying an unreleased drive', async t => {
    const f = await fixture(t, {cleanupMayFail: true});
    const original = f.board.setPin.bind(f.board);
    f.board.setPin = (terminal, mode, value) => {
        if (terminal === 'd13' && mode === 'input') throw new Error('release refused');
        return original(terminal, mode, value);
    };
    for (let attempt = 0; attempt < 2; attempt++) {
        assert.throws(() => f.model.syncWithExternalNets(f.board.getNets()), /cleanup failed.*release refused/i);
        assert.equal(f.model.board, f.board, 'neither attempt constructed a replacement');
    }
    assert.throws(() => f.model._saveHistory(), /cleanup failed.*release refused/i);
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.throws(() => f.session.dispose(), /cleanup failed.*release refused/i);
});
