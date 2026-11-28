// Execute the real C/WASM interpreter against the saved Circuit and motor model.
// No test double can substitute for the bridge, inductor, current or rotor state.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWasmSession} from '../../packages/crisp-basic/browser.mjs';
import {SimulationError} from '../../packages/crisp-basic/src/simulation-host.mjs';
import {createCrispBasicBoardHost} from '../../overlay/scratch-gui/src/lib/crispbasic-board-host.js';
import {createCrispBasicRobotFixture, observeCrispBasicRobotMotor} from '../../scripts/lib/crispbasic-robot-fixture.mjs';

const moduleURL = new URL('../../packages/crisp-basic/.build/wasm/crispbasic.mjs', import.meta.url);
const MS = 1000000n;
const turn = () => new Promise(resolve => setImmediate(resolve));
const closeTo = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, received ${actual}`);

function runningFixture(t, options = {}) {
    const {board, model, source} = createCrispBasicRobotFixture(options);
    const stages = [];
    let host;
    const session = createWasmSession({moduleURL, simulation: {createHost({signal}) {
        host = createCrispBasicBoardHost({board, signal, SimulationError,
            ...(options.yieldTask ? {yieldTask: () => options.yieldTask({board, host, session})} : {})});
        return {
            pinMode: (...args) => host.pinMode(...args),
            digitalWrite: (...args) => host.digitalWrite(...args),
            digitalRead: (...args) => host.digitalRead(...args),
            millis: () => host.millis(),
            dispose: () => host.dispose(),
            delay: async milliseconds => {
                await host.delay(milliseconds);
                stages.push(observeCrispBasicRobotMotor(board));
                assert.deepEqual(board.getWarnings(), [], 'accepted motor frames have no solver or circuit warnings');
            }
        };
    }}});
    t.after(() => session.dispose());
    return {board, model, source, stages, session, get host() { return host; }};
}

function released(f, powered) {
    assert.equal(f.host.state, 'disposed');
    assert.equal(f.host.cleanupComplete, true);
    assert.equal(f.board.powered, powered, 'the original power state is restored');
    assert.ok(f.board.getPinStates().every(pin => pin.mode === 'input'), 'every owned GPIO drive is released');
    for (const pin of ['d3', 'd7', 'd8']) assert.equal(f.board.readAnalog(pin), 0, `${pin} is held low by its pulldown`);
    assert.deepEqual(f.board.getDeviceState('driver').drives, {out1: null, out2: null, out3: null, out4: null},
        'the bridge is disabled even if the user left circuit power on');
    const lease = f.board.claimExternalClock();
    lease.release();
}

for (const swapMotorLeads of [false, true]) {
    test(`real BASIC drives, reverses, brakes and coasts the saved motor Circuit${swapMotorLeads ? ' with exchanged leads' : ''}`, async t => {
        const f = runningFixture(t, {swapMotorLeads});
        assert.equal(f.model.netlistError, null);
        assert.equal(f.board.getDeviceState('motor').direction, 'stopped');
        const result = await f.session.run(f.source, {filename: 'robot-motor/source.bas'});
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.text, 'forward\r\nreverse\r\nbrake\r\ncoast\r\nElapsed ms: 825\r\n');
        assert.deepEqual(f.host.capabilities.pins, [3, 7, 8]);
        assert.deepEqual(f.stages.map(stage => stage.atMs), [200, 500, 800, 825]);
        assert.equal(f.board.getTime(), 825n * MS);
        assert.ok(f.host.solverSteps > 0 && f.host.solverSteps <= f.host.capabilities.limits.maxSolverSteps);

        const [forward, reverse, brake, coast] = f.stages;
        const sign = swapMotorLeads ? -1 : 1;
        // Independent steady-state oracle: 5 V - two 1.4 V output drops,
        // 5 ohm winding + two 2 ohm outputs; torque balances viscous friction.
        const expectedSpeed = (5 - 2 * 1.4) * 0.05 / ((5 + 2 * 2) * 0.0001 + 0.05 * 0.05);
        const expectedCurrent = 0.0001 * expectedSpeed / 0.05;
        closeTo(forward.velocity, sign * expectedSpeed, expectedSpeed * 0.001, 'forward rotor velocity in rad/s');
        closeTo(reverse.velocity, -sign * expectedSpeed, expectedSpeed * 0.001, 'reverse rotor velocity in rad/s');
        closeTo(forward.current, sign * expectedCurrent, 0.0002, 'forward winding current in A');
        closeTo(reverse.current, -sign * expectedCurrent, 0.0002, 'reverse winding current in A');
        assert.equal(forward.direction, swapMotorLeads ? 'reverse' : 'forward');
        assert.equal(reverse.direction, swapMotorLeads ? 'forward' : 'reverse');
        assert.ok(sign * forward.angle > 4, 'the rotor actually accumulates shaft angle');
        assert.ok(sign * (reverse.angle - forward.angle) < -6, 'reversal changes the signed shaft travel');
        assert.equal(forward.speed, Math.abs(forward.velocity));
        assert.equal(reverse.speed, Math.abs(reverse.velocity));

        assert.ok(forward.enable > 4.9 && forward.forward > 4.9 && forward.reverse === 0);
        assert.ok(reverse.enable > 4.9 && reverse.forward === 0 && reverse.reverse > 4.9);
        assert.deepEqual([forward.drives.out1.vTh, forward.drives.out2.vTh], [3.6, 1.4]);
        assert.deepEqual([reverse.drives.out1.vTh, reverse.drives.out2.vTh], [1.4, 3.6]);
        assert.equal(brake.direction, 'stopped');
        assert.ok(brake.speed < 0.01, 'braking dissipates the spinning rotor energy');
        assert.ok(Math.abs(brake.current) < 0.00001);
        assert.deepEqual([brake.drives.out1.vTh, brake.drives.out2.vTh], [1.4, 1.4]);
        assert.equal(coast.enable, 0);
        assert.deepEqual(coast.drives, {out1: null, out2: null, out3: null, out4: null});
        assert.ok(Math.abs(coast.current) < 0.000001, 'disabled outputs do not continue supplying motor current');
        assert.equal(coast.direction, 'stopped');
        assert.ok(coast.speed <= brake.speed);

        assert.deepEqual(f.host.trace.filter(event => event.type === 'delay').map(({fromMs, milliseconds, atMs}) =>
            [fromMs, milliseconds, atMs]), [[0, 200, 200], [200, 300, 500], [500, 300, 800], [800, 25, 825]]);
        assert.deepEqual(f.host.trace.filter(event => event.type === 'digital-write').map(({atMs, pin, value}) =>
            [atMs, pin, value]), [[0, 3, 0], [0, 7, 1], [0, 8, 0], [0, 3, 1],
            [200, 3, 0], [200, 7, 0], [200, 8, 1], [200, 3, 1], [500, 7, 0], [500, 8, 0], [800, 3, 0]]);
        released(f, false);
    });
}

test('Stop during a real motor delay releases the driver and clock without later motion or requests', async t => {
    let stoppedAt, moving;
    const f = runningFixture(t, {powered: true, yieldTask: async ({board, session}) => {
        if (stoppedAt === undefined && board.getTime() >= 100n * MS) {
            moving = observeCrispBasicRobotMotor(board);
            stoppedAt = board.getTime();
            assert.equal(session.cancel(), true);
        }
        await turn();
    }});
    const result = await f.session.run(f.source);
    assert.equal(result.status, 'cancelled', JSON.stringify(result.error));
    assert.ok(stoppedAt >= 100n * MS && stoppedAt < 200n * MS, 'Stop interrupts the first outstanding delay');
    assert.ok(moving.velocity > 20 && moving.current > 0.05, 'Stop occurs while the real motor is powered and turning');
    assert.equal(f.stages.length, 0, 'the cancelled delay never acknowledges completion');
    assert.ok(f.host.trace.every(event => event.atMs === 0 && event.type !== 'delay'));
    released(f, true);
    const before = observeCrispBasicRobotMotor(f.board);
    const trace = f.host.trace;
    await turn();
    await turn();
    assert.equal(f.board.getTime(), stoppedAt);
    assert.deepEqual(observeCrispBasicRobotMotor(f.board), before, 'no abandoned delay advances the motor after Stop');
    assert.deepEqual(f.host.trace, trace, 'no later BASIC GPIO or time request survives cancellation');
    assert.ok(before.speed > 20, 'releasing the drive preserves the rotor state instead of inventing an instantaneous brake');
});

test('an interpreter error with a spinning motor releases its outputs and leaves a reusable clock', async t => {
    const f = runningFixture(t, {powered: true});
    const forwardOnly = f.source.split('REM Disable before changing direction')[0];
    const result = await f.session.run(`${forwardOnly}zero% = 0\nPRINT 1 / zero%\nEND\n`);
    assert.equal(result.status, 'error', JSON.stringify(result.error));
    assert.match(result.error.message, /division by zero/i);
    assert.equal(f.stages.length, 1);
    assert.ok(f.stages[0].velocity > 30);
    assert.equal(f.board.getTime(), 200n * MS);
    released(f, true);
    const before = observeCrispBasicRobotMotor(f.board);
    await turn();
    assert.deepEqual(observeCrispBasicRobotMotor(f.board), before);
});
