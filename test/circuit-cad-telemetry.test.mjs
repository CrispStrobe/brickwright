// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCoupledSession} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';

const connections = {
    version: 1, cadDocumentId: 'robot', enabled: true,
    drives: [{partId: 'motor', jointId: 'axle'}, {partId: 'lift', jointId: 'slide', kind: 'slider'}],
    servos: [{partId: 'servo', jointId: 'steering'}],
    sensors: [{partId: 'sensor', bodyId: 'chassis'}]
};

function fixture(compact = true) {
    let active = true, time = 0, released = false;
    const controls = [], states = [], servoSamples = [], sensorSamples = [], returned = [];
    const counts = {full: 0, compact: 0, presented: 0, released: 0, bytes: 0};
    const board = {
        timeNs: 0n, powered: true,
        parts: [{id: 'motor', kind: 'dc_motor'}, {id: 'lift', kind: 'gearmotor'}],
        claimExternalClock: () => ({run: fn => {assert.ok(active);fn();}, isActive: () => active, release: () => {active = false;}}),
        attachMechanicalShaft: () => () => {},
        attachExternalServo: () => ({sample: value => servoSamples.push(value), target: () => ({angleDeg: 45, powered: true}), release() {}}),
        attachExternalDistanceSensor: () => ({sample: value => sensorSamples.push(value), release() {}}),
        advanceTo(ns) {this.timeNs = ns;},
        takeMechanicalShaftImpulse: () => ({impulseNms: .00001, currentA: .1}),
        setMechanicalShaftState: (id, value) => states.push({id, ...value}),
        getPinStates: () => [],
        setPower(value) {this.powered = value;}
    };
    const telemetry = () => ({time, angles: {axle: time * 90, steering: -45}, speeds: {axle: 90, steering: 0},
        linearPositions: {slide: time * 10}, linearSpeeds: {slide: 10}, distances: {sensor: 1000 - time * 10}});
    const snapshot = () => ({...telemetry(), poses: Array.from({length: 128}, (_, i) => ({id: `body-${i}`, positionMm: [time * 10, i, 5], rotation: [0, 0, 0, 1]}))});
    const advance = (impulses, rays, servos, isCompact) => {
        assert.equal(released, false);
        controls.push(structuredClone({impulses, rays, servos}));
        time += .005;
        counts[isCompact ? 'compact' : 'full']++;
        const next = isCompact ? telemetry() : snapshot();
        counts.bytes += JSON.stringify(next).length;
        returned.push(next);
        return next;
    };
    const mechanics = {
        snapshot, sense: async () => snapshot(),
        step: async (impulses, rays, servos, display) => {assert.equal(display, false);return advance(impulses, rays, servos, false);},
        present: () => {counts.presented++;}, release: () => {released = true;counts.released++;}
    };
    if (compact) mechanics.stepTelemetry = async (impulses, rays, servos) => advance(impulses, rays, servos, true);
    return {board, mechanics, counts, controls, states, servoSamples, sensorSamples, returned};
}

test('200 Hz feedback is identical with 60 Hz full-pose presentation and legacy fallback', async () => {
    const run = async compact => {
        const f = fixture(compact), shown = [];
        const session = await createCoupledSession({...f, connections, onFrame: frame => shown.push(frame)});
        for (let i = 0; i < 60; i++) {session.tick(1000 / 60);await session.idle();}
        assert.equal(f.board.timeNs, 1000000000n);
        assert.equal(shown.length, 60);
        for (const frame of shown) {
            assert.equal(frame.poses.length, 128);
            assert.equal(frame.poses[0].positionMm[0], frame.time * 10);
        }
        return {f, shown, snapshot: session.snapshot(), readings: session.readings()};
    };
    const old = await run(false), optimized = await run(true);
    assert.equal(old.f.counts.full, 200);
    assert.equal(optimized.f.counts.full, 60);
    assert.equal(optimized.f.counts.compact, 140);
    assert.equal(optimized.f.counts.presented, 60);
    assert.deepEqual(optimized.snapshot, old.snapshot);
    assert.deepEqual(optimized.shown, old.shown);
    assert.deepEqual(optimized.readings, old.readings);
    for (const key of ['controls', 'states', 'servoSamples', 'sensorSamples']) assert.deepEqual(optimized.f[key], old.f[key], key);
    assert.ok(optimized.f.counts.bytes < old.f.counts.bytes * .35, JSON.stringify({old: old.f.counts, optimized: optimized.f.counts}));
});

test('fractional program ticks preserve the mechanical remainder and always end with full poses', async () => {
    const f = fixture(), frames = [];
    const session = await createCoupledSession({...f, connections, onFrame: frame => frames.push(frame)});
    for (const ms of [0, 1, 2, 1]) {session.tick(ms);await session.idle();}
    assert.equal(session.time, 0);
    session.tick(1);await session.idle();
    assert.equal(f.counts.full, 1);assert.equal(f.counts.compact, 0);
    session.tick(12);await session.idle();
    assert.equal(f.counts.full, 2);assert.equal(f.counts.compact, 1);
    session.tick(3);await session.idle();
    assert.equal(Math.round(session.time), 20);
    assert.equal(f.board.timeNs, 20000000n);
    assert.deepEqual(frames.map(f => f.time), [.005, .015, .02]);
    assert.ok(frames.every(frame => frame.poses.length === 128));
});

test('an in-flight compact sample never replaces a public full-frame snapshot', async () => {
    const f = fixture();let release, seen;
    const original = f.mechanics.stepTelemetry;
    f.mechanics.stepTelemetry = async (...args) => {const result = await original(...args);seen = result;return new Promise(resolve => {release = () => resolve(result);});};
    const session = await createCoupledSession({...f, connections});
    const initial = session.snapshot();session.tick(15);
    for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
    assert.ok(release);assert.equal(Object.hasOwn(seen, 'poses'), false);
    assert.deepEqual(session.snapshot(), initial);
    // Remove the hold so the remaining compact and terminal full replies finish.
    f.mechanics.stepTelemetry = original;release();await session.idle();
    const latest = session.snapshot();assert.equal(latest.poses.length, 128);assert.equal(Math.round(latest.time * 1000), 15);
    latest.poses[0].positionMm[0] = -999;
    assert.notEqual(session.snapshot().poses[0].positionMm[0], -999);
});

test('stop discards a late compact reply and never publishes an incomplete frame', async () => {
    const f = fixture();let resolve;
    f.mechanics.stepTelemetry = () => new Promise(r => {resolve = r;});
    const shown = [], session = await createCoupledSession({...f, connections, onFrame: frame => shown.push(frame)});
    session.tick(15);for (let i = 0; i < 10 && !resolve; i++) await Promise.resolve();
    assert.ok(resolve);session.stop();resolve({time: .005});await session.idle();
    assert.equal(session.time, 0);assert.equal(session.snapshot().poses.length, 128);
    assert.deepEqual(shown, []);assert.equal(f.counts.presented, 0);assert.equal(f.board.powered, false);
});

test('ticks arriving during a terminal reply still finish on a coherent full frame', async () => {
    const f = fixture();let release;
    const original = f.mechanics.step;
    f.mechanics.step = async (...args) => {const next = await original(...args);return new Promise(resolve => {release = () => resolve(next);});};
    const shown = [], session = await createCoupledSession({...f, connections, onFrame: frame => shown.push(frame)});
    session.tick(5);for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
    assert.ok(release);session.tick(15);f.mechanics.step = original;release();await session.idle();
    assert.equal(Math.round(session.time), 20);
    assert.equal(f.counts.full, 2);assert.equal(f.counts.compact, 2);
    assert.equal(shown.at(-1).time, session.snapshot().time);
    assert.equal(shown.at(-1).poses[0].positionMm[0], .2);
});

test('a rejected compact step cuts power and releases its clock exactly once', async () => {
    const f = fixture(), error = new Error('worker lost'), errors = [], shown = [];
    f.mechanics.stepTelemetry = async () => {throw error;};
    const session = await createCoupledSession({...f, connections, onError: e => errors.push(e), onFrame: frame => shown.push(frame)});
    const before = session.snapshot();session.tick(15);
    await assert.rejects(session.idle(), e => e === error);
    session.stop();session.tick(20);
    assert.equal(session.failed, error);assert.equal(f.board.powered, false);
    assert.equal(f.counts.released, 1);assert.equal(f.counts.presented, 0);
    assert.deepEqual(shown, []);assert.deepEqual(errors, [error]);assert.deepEqual(session.snapshot(), before);
});
