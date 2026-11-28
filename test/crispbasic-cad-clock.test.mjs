// Actual electrical solver with an independent I*d(omega)=torque*dt oracle.
// The separate crispbasic-cad-physics test qualifies the real CAD worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {BoardImpl} from 'bw-board/board.js';
import {registerAllDevices} from 'bw-board/register-all.js';
import {SimulationError} from '../packages/crisp-basic/src/simulation-host.mjs';
import {createCrispBasicBoardHost} from '../overlay/scratch-gui/src/lib/crispbasic-board-host.js';
import {createCoupledSession} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
import {prepareCrispBasicCadClock} from '../overlay/scratch-gui/src/lib/crispbasic-cad-clock.js';
import {createCrispBasicCircuitSession} from '../overlay/scratch-gui/src/lib/crispbasic-circuit-session.js';

registerAllDevices();
const MS = 1000000n;
const turn = () => new Promise(resolve => setImmediate(resolve));
const connections = {version: 1, cadDocumentId: 'rotor', enabled: true,
    drives: [{partId: 'motor', jointId: 'axle'}]};

function motorBoard() {
    const board = new BoardImpl(5), t = (part, terminal) => ({part, terminal});
    board.setNetlist([
        {id: 'uno', kind: 'arduino_uno', terminals: ['d3', 'd7', 'd8', 'd2', 'd4', 'gnd'], params: {}},
        {id: 'supply', kind: 'vcc', terminals: ['vcc'], params: {}},
        {id: 'ground', kind: 'gnd', terminals: ['gnd'], params: {}},
        {id: 'bridge', kind: 'h_bridge', terminals: ['vcc', 'gnd', 'en1', 'in1', 'in2', 'out1', 'out2', 'en2', 'in3', 'in4', 'out3', 'out4'], params: {}},
        {id: 'motor', kind: 'dc_motor_encoder', terminals: ['a', 'b', 'enc_a', 'enc_b'],
            params: {windingR: 10, windingH: 0, kV: .2, kT: .2, pulsesPerRev: 2}}
    ], [
        ['v', t('supply', 'vcc'), t('bridge', 'vcc')],
        ['g', t('ground', 'gnd'), t('bridge', 'gnd'), t('uno', 'gnd')],
        ['en', t('uno', 'd3'), t('bridge', 'en1')],
        ['in1', t('uno', 'd7'), t('bridge', 'in1')],
        ['in2', t('uno', 'd8'), t('bridge', 'in2')],
        ['a', t('motor', 'a'), t('bridge', 'out1')],
        ['b', t('motor', 'b'), t('bridge', 'out2')],
        ['ea', t('motor', 'enc_a'), t('uno', 'd2')],
        ['eb', t('motor', 'enc_b'), t('uno', 'd4')]
    ].map(([id, ...terminals]) => ({id, terminals})));
    return board;
}

function inertia({time = 0, angle = 0, omega = 0} = {}) {
    const steps = [];
    let releases = 0;
    const snapshot = () => ({time, angles: {axle: angle * 180 / Math.PI},
        speeds: {axle: omega * 180 / Math.PI}, linearPositions: {}, linearSpeeds: {}, poses: []});
    return {
        snapshot, steps, get releases() {return releases;},
        async step(impulses) {
            assert.equal(releases, 0);
            const impulse = impulses[0].impulse;
            steps.push({impulse, before: snapshot()});
            omega += impulse / .002;
            angle += omega * .005;
            time += .005;
            return snapshot();
        },
        release() {releases++;}
    };
}

async function fixture({board = motorBoard(), mechanics = inertia(), ...options} = {}) {
    const controller = new AbortController();
    const coupled = await createCoupledSession({board, mechanics, connections, clockMode: 'program', signal: controller.signal});
    const host = createCrispBasicBoardHost({board, signal: controller.signal, SimulationError,
        clock: coupled.programClock, yieldTask: turn, ...options});
    const drive = forward => {
        for (const pin of [3, 7, 8]) host.pinMode(pin, 'output');
        host.digitalWrite(7, forward ? 1 : 0);
        host.digitalWrite(8, forward ? 0 : 1);
        host.digitalWrite(3, 1);
    };
    return {board, mechanics, host, coupled, controller, drive};
}

test('BASIC pin writes split one mechanical impulse at exact integer milliseconds', async () => {
    const f = await fixture();
    try {
        f.drive(true);
        await f.host.delay(2);
        assert.equal(f.board.timeNs, 2n * MS);
        assert.equal(f.mechanics.steps.length, 0);
        assert.equal(f.coupled.programClock.timeMs, 0);
        f.drive(false);
        await f.host.delay(3);
        assert.equal(f.board.timeNs, 5n * MS);
        assert.equal(f.host.millis(), 5);
        assert.equal(f.mechanics.steps.length, 1);
        assert.ok(f.mechanics.steps[0].impulse < 0, '3 reverse ms outweigh 2 forward ms in the same integral');
        assert.ok(f.coupled.snapshot().angles.axle < 0);
        const writes = f.host.trace.filter(event => event.type === 'digital-write' && event.pin === 7);
        assert.deepEqual(writes.map(({atMs, value}) => ({atMs, value})), [{atMs: 0, value: 1}, {atMs: 2, value: 0}]);
        assert.throws(() => f.coupled.tick(5), /BASIC owns/);
    } finally {f.host.dispose();}
});

test('split and whole delays feed identical electrical torque once per CAD boundary', async () => {
    const run = async durations => {
        const f = await fixture();
        try {
            f.drive(true);
            for (const ms of durations) await f.host.delay(ms);
            return {frame: f.coupled.snapshot(), impulses: f.mechanics.steps.map(step => step.impulse), time: f.board.timeNs};
        } finally {f.host.dispose();}
    };
    const whole = await run([20]);
    const split = await run([1, 2, 4, 3, 6, 4]);
    assert.equal(split.time, whole.time);
    assert.equal(split.impulses.length, 4);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(split.impulses[i] - whole.impulses[i]) < 1e-12);
    assert.ok(Math.abs(split.frame.angles.axle - whole.frame.angles.axle) < 1e-10);
});

test('both acquired physical origins survive; BASIC time starts at zero without resets', async () => {
    const board = motorBoard();board.setPower(true);board.advanceTo(17n * MS);
    const mechanics = inertia({time: .125, angle: .3, omega: .4});
    const f = await fixture({board, mechanics});
    try {
        assert.equal(board.timeNs, 17n * MS);
        assert.equal(f.host.millis(), 0);
        assert.equal(f.coupled.programClock.nextBoundaryNs, 22n * MS);
        await f.host.delay(7);
        assert.equal(board.timeNs, 24n * MS);
        assert.equal(f.host.millis(), 7);
        assert.equal(mechanics.steps.length, 1);
        assert.ok(Math.abs(f.coupled.snapshot().time - .130) < 1e-12);
        assert.equal(f.coupled.programClock.nextBoundaryNs, 27n * MS);
    } finally {f.host.dispose();}
    assert.equal(board.powered, true);
    assert.equal(board.timeNs, 24n * MS);
    assert.equal(mechanics.releases, 1);
});

for (const powered of [false, true]) test(`Stop preserves completed rotor state and acquired power=${powered}`, async () => {
    const board = motorBoard();board.setPower(powered);
    const f = await fixture({board});f.drive(true);await f.host.delay(17);
    const state = f.coupled.snapshot(), motor = board.getDeviceState('motor');
    const velocity = motor.velocity, angle = motor.angle;
    assert.ok(velocity > 0);
    f.host.dispose();f.host.dispose();
    assert.equal(f.host.cleanupComplete, true);
    assert.equal(board.timeNs, 17n * MS, 'the 2 ms remainder is not rounded up');
    assert.deepEqual(f.coupled.snapshot(), state);
    assert.equal(motor.velocity, velocity);
    assert.equal(motor.angle, angle);
    assert.equal(motor.externalShaft, undefined);
    assert.equal(board.powered, powered);
    assert.equal(f.mechanics.releases, 1);
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
    board.claimExternalClock().release();
});

test('Stop settles a hanging CAD step, and its late reply cannot update the next run', async () => {
    const mechanics = inertia();let reply, requested;
    const entered = new Promise(resolve => {requested = resolve;});
    mechanics.step = () => {requested();return new Promise(resolve => {reply = resolve;});};
    const f = await fixture({mechanics});f.drive(true);
    const delay = f.host.delay(10);await entered;
    const observed = assert.rejects(delay, /stopped|disposed|cancelled/);
    f.controller.abort();await observed;
    assert.equal(f.host.cleanupComplete, true);
    const next = await fixture({board: f.board});next.drive(false);
    const newOwner = f.board._externalClock;
    reply({...mechanics.snapshot(), time: .005, angles: {axle: 999}});
    await turn();
    assert.equal(f.board._externalClock, newOwner);
    assert.equal(f.coupled.snapshot().time, 0);
    assert.ok(f.board.readAnalog('d8') > 4);
    await next.host.delay(5);assert.ok(next.coupled.snapshot().angles.axle < 0);
    next.host.dispose();
});

for (const bad of ['time', 'joint', 'throw']) test(`invalid CAD ${bad} makes the partial delay terminal without publishing bad feedback`, async () => {
    const mechanics = inertia();
    mechanics.step = async () => {
        if (bad === 'throw') throw new Error('worker failure');
        return {...mechanics.snapshot(), time: bad === 'time' ? .004 : .005,
            ...(bad === 'joint' ? {angles: {axle: NaN}} : {})};
    };
    const f = await fixture({mechanics});f.drive(true);
    try {
        await assert.rejects(f.host.delay(10), /invalid simulation clock|missing|worker failure/);
        assert.equal(f.board.timeNs, 5n * MS);
        assert.equal(f.coupled.snapshot().time, 0);
        assert.throws(() => f.host.digitalWrite(7, 0), /invalid simulation clock|missing|worker failure/);
        assert.equal(f.host.trace.some(event => event.type === 'delay'), false);
    } finally {f.host.dispose();}
    assert.equal(f.mechanics.releases, 1);
});

test('reset and replacement prevent an old mechanical reply or cleanup from touching a new board owner', async () => {
    const mechanics = inertia();let reply, requested;
    const entered = new Promise(resolve => {requested = resolve;});
    mechanics.step = () => {requested();return new Promise(resolve => {reply = resolve;});};
    const f = await fixture({mechanics});f.drive(true);
    const delay = f.host.delay(5);await entered;
    const observed = assert.rejects(delay, /changed|stopped|disposed|replaced/);
    f.board.reset();f.board.setPower(true);
    const current = f.board.claimExternalClock();
    current.run(() => f.board.setPin('d8', 'pushpull', true));
    reply({...mechanics.snapshot(), time: .005});await observed;
    f.host.dispose();
    assert.equal(current.isActive(), true);
    assert.equal(f.board.powered, true);
    assert.ok(f.board.readAnalog('d8') > 4);
    current.release();
});

test('cancellation during mechanical feedback defers pin cleanup until the board lease unwinds', async () => {
    const f = await fixture();f.drive(true);
    const update = f.board.setMechanicalShaftState.bind(f.board);
    f.board.setMechanicalShaftState = (...args) => {const result = update(...args);f.controller.abort();return result;};
    await assert.rejects(f.host.delay(5), /cancelled|disposed|stopped/);
    assert.doesNotThrow(() => f.host.dispose());
    assert.equal(f.host.cleanupComplete, true);
    assert.equal(f.mechanics.releases, 1);
    assert.ok(f.board.getPinStates().every(pin => pin.mode === 'input'));
    f.board.claimExternalClock().release();
});

test('CAD acquisition cancellation settles now and releases a late lease exactly once', async () => {
    const board = motorBoard(), controller = new AbortController();let acquired;
    const mechanics = inertia();
    const runtime = {circuitBoard: board, cadSimulation: {acquireExternalClock: () => new Promise(resolve => {acquired = resolve;})}};
    const pending = prepareCrispBasicCadClock({runtime, board, signal: controller.signal, connections, documentId: () => 'rotor'});
    controller.abort();await assert.rejects(pending, /stopped/);
    acquired(mechanics);await turn();
    assert.equal(mechanics.releases, 1);
    assert.equal(board._externalClock, undefined);
});

test('CAD preparation refuses a different design and releases its acquired clock', async () => {
    const board = motorBoard(), mechanics = inertia(), controller = new AbortController();
    const runtime = {circuitBoard: board, cadSimulation: {acquireExternalClock: async () => mechanics}};
    await assert.rejects(prepareCrispBasicCadClock({runtime, board, signal: controller.signal,
        connections, documentId: () => 'different'}), /different CAD design/);
    assert.equal(mechanics.releases, 1);
    assert.equal(board._externalClock, undefined);
});

test('the editor Circuit session carries the same CAD lease through run, project edit and cleanup', async () => {
    const oldStorage = globalThis.localStorage, oldCad = globalThis.__bwCad;
    globalThis.localStorage = {getItem: key => key === 'bw-cad-circuit-bindings' ? JSON.stringify(connections) : null};
    globalThis.__bwCad = {editor: {session: {state: {document: {id: 'rotor'}}}}};
    const board = motorBoard(), mechanics = inertia(), runtime = new EventEmitter();
    Object.assign(runtime, {circuitBoard: board, threads: [], circuitModel: {board, netlistError: null},
        cadSimulation: {acquireExternalClock: async () => mechanics}});
    const eventTarget = new EventTarget(), controller = new AbortController();let releases = 0;
    eventTarget.addEventListener('bw-circuit-clock-owner', event => {
        if (event.detail.board) event.detail.ready();else releases++;
    });
    let session;
    try {
        session = await createCrispBasicCircuitSession({runtime, eventTarget, signal: controller.signal,
            cad: true, onInvalidate: () => controller.abort()});
        const host = session.createHost({signal: controller.signal}, SimulationError);
        assert.equal(host.capabilities.cadPhysics, true);
        assert.equal(host.capabilities.mechanicalStepMs, 5);
        await host.delay(6);
        assert.equal(mechanics.steps.length, 1);
        eventTarget.dispatchEvent(new CustomEvent('bw-cad-circuit-bindings-changed'));
        assert.equal(host.cleanupComplete, true);
        assert.equal(runtime.bwCrispBasicSimulation, undefined);
        assert.equal(mechanics.releases, 1);
        assert.equal(releases, 1);
        assert.throws(() => host.digitalRead(2), /disposed|cancelled/);
    } finally {
        session?.dispose();
        if (oldStorage === undefined) delete globalThis.localStorage;else globalThis.localStorage = oldStorage;
        if (oldCad === undefined) delete globalThis.__bwCad;else globalThis.__bwCad = oldCad;
    }
});
