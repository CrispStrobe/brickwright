// Real interpreter -> saved electrical Circuit -> public CAD controller ->
// shipped geometry/Jolt worker. No clock, motor or physics implementation stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrispBasicCadFixture} from '../../../scripts/lib/crispbasic-cad-fixture.mjs';

const turn = () => new Promise(resolve => setImmediate(resolve));
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`);
const steps = f => f.commands.filter(command => command.op === 'actuator-step').length;

function released(f) {
    assert.equal(f.runner.state, 'idle');
    assert.equal(f.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.board._externalClock ?? null, null);
    assert.equal(f.controller.state.state, 'paused');
    assert.ok(f.board.getPinStates().every(pin => pin.mode === 'input'));
    const frame = f.controller.snapshot();
    for (const [part, joint] of [['left', 'drive-a'], ['right', 'drive-b']]) {
        const motor = f.board.getDeviceState(part);
        assert.equal(motor.externalShaft, undefined, `${part} released its mechanical ownership`);
        near(motor.velocity, frame.speeds[joint] * Math.PI / 180, 1e-8);
        near(motor.angle, frame.angles[joint] * Math.PI / 180, 1e-8);
    }
}

for (const swapMotorLeads of [false, true]) test(`real BASIC moves the saved Scout CAD rover${swapMotorLeads ? ' with reversed motor leads' : ''}`, {timeout: 90000}, async t => {
    const f = await createCrispBasicCadFixture({swapMotorLeads});t.after(() => f.dispose());
    const document = f.cadSession.serialize(), revision = f.cadSession.state.revision;
    const result = await f.runner.run(f.source);
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.match(result.text, /Elapsed ms: 205\r\nEncoder: [01]\r\n/);
    assert.equal(f.board.timeNs, 205000000n);
    assert.equal(steps(f), 41, '2 + 3 + 200 ms produces exactly forty-one 5 ms worker steps');
    assert.equal(f.commands.filter(command => command.op === 'start').length, 1);
    const initial = f.frames[0], frame = f.controller.snapshot(), sign = swapMotorLeads ? -1 : 1;
    near(frame.time, .205);
    assert.equal(frame.poses.length, initial.poses.length);
    for (const joint of ['drive-a', 'drive-b']) {
        assert.ok(sign * (frame.angles[joint] - initial.angles[joint]) > 1, `${joint} turns with the measured winding polarity`);
        assert.ok(sign * frame.speeds[joint] > 1, `${joint} retains signed physical angular velocity`);
    }
    const before = initial.poses.find(pose => pose.id === 'chassis').positionMm;
    const after = frame.poses.find(pose => pose.id === 'chassis').positionMm;
    assert.ok(after.some((value, index) => Math.abs(value - before[index]) > .1), 'the free rover body actually moves');
    released(f);
    assert.equal(f.cadSession.serialize(), document, 'simulation never rewrites the authored CAD document');
    assert.equal(f.cadSession.state.revision, revision);
});

test('a second BASIC run reacquires the same paused real physics world and starts its own millisecond origin', {timeout: 90000}, async t => {
    let input;
    const prompted = new Promise(resolve => {input = resolve;});
    const f = await createCrispBasicCadFixture({onEvent: event => {if (event.type === 'input') input();}});t.after(() => f.dispose());
    assert.equal((await f.runner.run(f.source)).status, 'completed');
    released(f);
    const first = f.controller.snapshot();
    const second = f.runner.run(`INPUT gate$\nPRINT "Origin: "; FNmillis\n${f.source}`, {interactive: true});
    await prompted;
    assert.deepEqual(f.controller.snapshot(), first, 'acquisition leaves every retained pose, speed and timestamp unchanged');
    assert.equal(steps(f), 41);
    assert.equal(f.commands.filter(command => command.op === 'start').length, 1, 'reacquisition reuses the existing world');
    f.runner.writeInput('continue\n');
    const result = await second;
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.match(result.text, /Origin: 0\r\nElapsed ms: 205/);
    assert.equal(f.board.timeNs, 410000000n);
    near(f.controller.snapshot().time, .410);
    assert.equal(steps(f), 82);
    released(f);
});

test('Stop after a real actuator command was submitted preserves that final frame without an extra motion step', {timeout: 90000}, async t => {
    let f, stopScheduled = false, stopCount;
    f = await createCrispBasicCadFixture({onCommand: command => {
        if (command.op === 'actuator-step' && !stopScheduled) {
            stopScheduled = true;
            // The message has already reached worker_threads. Defer only until
            // the public controller has retained its pending-request promise.
            queueMicrotask(() => {stopCount = steps(f);assert.equal(f.runner.cancel(), true);});
        }
    }});t.after(() => f.dispose());
    const setup = f.source.split('PROCdelay(2)')[0];
    const result = await f.runner.run(`${setup}REPEAT\nPROCdelay(5)\nUNTIL FALSE\n`);
    assert.equal(result.status, 'cancelled', JSON.stringify(result));
    assert.equal(stopScheduled, true);
    assert.equal(stopCount, 1);
    assert.equal(steps(f), stopCount, 'cleanup did not submit an additional actuator or motion step');
    assert.equal(f.commands.filter(command => command.op === 'step').length, 0);
    assert.equal(f.board.timeNs, 5000000n);
    near(f.controller.snapshot().time, .005);
    released(f);
    const stopped = f.controller.snapshot();
    await turn();await turn();
    assert.deepEqual(f.controller.snapshot(), stopped, 'no abandoned request advances physics after Run settles');
    const next = await f.runner.run('PRINT FNmillis\nEND\n');
    assert.equal(next.status, 'completed', JSON.stringify(next));
    assert.equal(next.text, '         0\r\n', 'BBC numeric PRINT retains its default field width');
    assert.deepEqual(f.controller.snapshot(), stopped);
    assert.equal(steps(f), 1);
    assert.equal(f.commands.filter(command => command.op === 'start').length, 1);
    released(f);
});
