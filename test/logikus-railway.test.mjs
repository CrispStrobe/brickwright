import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProgram, evaluateProgram, truthTable, validateProgram}
    from '../overlay/scratch-gui/src/lib/logikus/model.js';
import {getPreset} from '../overlay/scratch-gui/src/lib/logikus/presets.js';
import {inspectRailway, railwayTarget, railwayViolations}
    from '../overlay/scratch-gui/src/lib/logikus/railway.js';

const inputs = (values = [], button = false) => ({switches: [...values, ...Array(10 - values.length).fill(false)], button});
const preset = () => getPreset('railway').program;
const addWire = (program, from, to, id = 'fault') => validateProgram({...program,
    wires: [...program.wires, {id, from, to}]});
const checkReplay = (program, row) => {
    assert.ok(row, 'a counterexample supplies complete reproducible inputs');
    const actual = evaluateProgram(program, row);
    assert.deepEqual(actual.lamps, row.lamps);
    assert.deepEqual(railwayTarget(row.switches), row.expected);
    assert.deepEqual(railwayViolations(row.switches, actual.lamps), row.violations);
    assert.deepEqual(row.different, row.lamps.flatMap((on, i) => on === row.expected[i] ? [] : [i]));
    assert.equal(row.safe, row.violations.length === 0);
    assert.equal(row.matches, row.different.length === 0);
};

test('the railway preset matches an independent Boolean specification in all 32 states', () => {
    const program = preset();
    const rows = truthTable(program);
    assert.equal(rows.length, 32);
    for (const row of rows) {
        const [requestA, requestB, crossing, exitA, exitB] = row.switches;
        const expected = [requestA && !requestB && !crossing && !exitA,
            requestB && !requestA && !crossing && !exitB, ...Array(8).fill(false)];
        assert.deepEqual(row.lamps, expected, row.switches.map(Number).join(''));
        assert.deepEqual(railwayTarget(row.switches), expected);
        assert.deepEqual(railwayViolations(row.switches, row.lamps), []);
    }
    assert.equal(rows.filter(row => row.lamps[0]).length, 2);
    assert.equal(rows.filter(row => row.lamps[1]).length, 2);
    assert.equal(rows.filter(row => !row.lamps[0] && !row.lamps[1]).length, 28);
    const report = inspectRailway(program);
    assert.deepEqual(report.switchIndices, [0, 1, 2, 3, 4]);
    assert.equal(report.button, false);
    assert.equal(report.total, 32);
    assert.equal(report.safeCount, 32);
    assert.equal(report.unsafeCount, 0);
    assert.equal(report.matched, 32);
    assert.equal(report.mismatched, 0);
    assert.equal(report.safetyCounterexample, null);
    assert.equal(report.counterexample, null);
});

test('route requests, shared occupancy and the corresponding exit each gate the actual signals', () => {
    const program = preset();
    const cases = [
        [[0, 0, 0, 0, 0], [false, false]],
        [[1, 1, 0, 0, 0], [false, false]],
        [[1, 0, 0, 0, 0], [true, false]],
        [[1, 0, 0, 0, 1], [true, false]],
        [[1, 0, 0, 1, 0], [false, false]],
        [[1, 0, 1, 0, 0], [false, false]],
        [[0, 1, 0, 0, 0], [false, true]],
        [[0, 1, 0, 1, 0], [false, true]],
        [[0, 1, 0, 0, 1], [false, false]],
        [[0, 1, 1, 0, 0], [false, false]],
        [[1, 1, 1, 1, 1], [false, false]]
    ];
    for (const [switches, expected] of cases) {
        assert.deepEqual(evaluateProgram(program, inputs(switches)).lamps.slice(0, 2), expected);
    }
    assert.deepEqual(evaluateProgram(program, inputs([1, 0, 0, 0, 0, 1, 1, 1, 1, 1], true)).lamps,
        evaluateProgram(program, inputs([1, 0, 0, 0, 0])).lamps,
        'unused controls and Test do not affect the supplied circuit');
});

test('bypassing the crossing contact produces a replayable unsafe state and source path', () => {
    const program = addWire(preset(), 'S2.Ba', 'S2.Bb', 'crossing-bypass');
    const report = inspectRailway(program);
    assert.equal(report.total, 32);
    assert.equal(report.safeCount, 30);
    assert.equal(report.unsafeCount, 2);
    assert.equal(report.matched, 30);
    checkReplay(program, report.safetyCounterexample);
    assert.deepEqual(report.safetyCounterexample.switches.slice(0, 5), [true, false, true, false, false]);
    assert.deepEqual(report.safetyCounterexample.violations, ['crossing-occupied']);
    assert.deepEqual(report.safetyCounterexample.different, [0]);
    assert.equal(report.safetyCounterexample.lamps[0], true);
    assert.equal(report.safetyCounterexample.expected[0], false);
    assert.ok(evaluateProgram(program, report.safetyCounterexample).paths[0].includes('crossing-bypass'));
});

test('removing every wire cannot hide required inputs or turn all-red safety into a functional pass', () => {
    const program = createEmptyProgram();
    const report = inspectRailway(program);
    assert.deepEqual(report.switchIndices, [0, 1, 2, 3, 4]);
    assert.equal(report.total, 32);
    assert.equal(report.safeCount, 32);
    assert.equal(report.unsafeCount, 0);
    assert.equal(report.safetyCounterexample, null);
    assert.equal(report.matched, 28);
    assert.equal(report.mismatched, 4);
    checkReplay(program, report.counterexample);
    assert.equal(report.counterexample.safe, true);
    assert.ok(report.counterexample.expected.some(Boolean));
    assert.ok(report.counterexample.lamps.every(on => !on));
});

test('an inter-route cross-connection can feed backward and produce conflicting green signals', () => {
    // In this written direction the new wire points from B's chain toward A.
    // Current in this example reaches it from A and conducts in reverse to B.
    const program = addWire(preset(), 'S2.Db', 'S3.Bb', 'cross-feed');
    const state = inputs([1, 0, 0, 0, 0]);
    const result = evaluateProgram(program, state);
    assert.deepEqual(result.lamps.slice(0, 2), [true, true]);
    assert.ok(result.paths[1].includes('cross-feed'));
    assert.deepEqual(railwayViolations(state.switches, result.lamps), ['conflicting-routes', 'route-b-unrequested']);
    const report = inspectRailway(program);
    assert.ok(report.unsafeCount > 0);
    assert.ok(report.safetyCounterexample.violations.includes('conflicting-routes'));
    checkReplay(program, report.safetyCounterexample);
});

test('all safety conditions have independent live-state explanations', () => {
    const lamps = (a, b) => [a, b, ...Array(8).fill(false)];
    const cases = [
        [[1, 1, 0, 0, 0], lamps(true, true), ['conflicting-routes']],
        [[1, 0, 1, 0, 0], lamps(true, false), ['crossing-occupied']],
        [[1, 0, 0, 1, 0], lamps(true, false), ['exit-a-occupied']],
        [[0, 1, 0, 0, 1], lamps(false, true), ['exit-b-occupied']],
        [[0, 0, 0, 0, 0], lamps(true, false), ['route-a-unrequested']],
        [[0, 0, 0, 0, 0], lamps(false, true), ['route-b-unrequested']]
    ];
    for (const [switches, actual, violations] of cases) {
        assert.deepEqual(railwayViolations(inputs(switches).switches, actual), violations);
    }
});

test('a different tie-breaking policy can pass state safety while failing the specified behavior', () => {
    // A now has priority if both routes are requested. Its own request and
    // occupancy guards still work, while B retains its opposite-request guard.
    const program = addWire(preset(), 'S1.Ba', 'S1.Bb', 'priority-a');
    const report = inspectRailway(program);
    assert.equal(report.safeCount, 32);
    assert.equal(report.unsafeCount, 0);
    assert.equal(report.matched, 30);
    assert.equal(report.safetyCounterexample, null);
    checkReplay(program, report.counterexample);
    assert.deepEqual(report.counterexample.switches.slice(0, 2), [true, true]);
    assert.deepEqual(report.counterexample.lamps.slice(0, 2), [true, false]);
    assert.deepEqual(report.counterexample.expected.slice(0, 2), [false, false]);
});

test('a newly wired S9 is enumerated even though the railway goal uses only S0 through S4', () => {
    const program = preset();
    program.wires = program.wires.map(wire => wire.to === 'L0' ? {...wire, to: 'S9.Aa'} : wire);
    program.wires.push({id: 's9-gate', from: 'S9.Ab', to: 'L0'});
    const report = inspectRailway(program);
    assert.deepEqual(report.switchIndices, [0, 1, 2, 3, 4, 9]);
    assert.equal(report.total, 64);
    assert.equal(report.safeCount, 64);
    assert.equal(report.matched, 62);
    checkReplay(program, report.counterexample);
    assert.equal(report.counterexample.switches[9], false);
    assert.equal(report.counterexample.expected[0], true);
    assert.equal(report.counterexample.lamps[0], false);
});

test('a newly wired Test contact is enumerated in both states and its failures are replayable', () => {
    const program = preset();
    program.wires = program.wires.map(wire => wire.to === 'L1' ? {...wire, to: 'Ta'} : wire);
    program.wires.push({id: 'test-gate', from: 'Tb', to: 'L1'});
    const report = inspectRailway(program);
    assert.equal(report.button, true);
    assert.equal(report.total, 64);
    assert.equal(report.safeCount, 64);
    assert.equal(report.matched, 62);
    checkReplay(program, report.counterexample);
    assert.equal(report.counterexample.button, false);
    assert.equal(report.counterexample.expected[1], true);
    assert.equal(report.counterexample.lamps[1], false);
    assert.equal(evaluateProgram(program, {...report.counterexample, button: true}).lamps[1], true);
});

test('a fault gated by both S9 and Test is found across the complete added input space', () => {
    let program = preset();
    program = addWire(program, 'Q', 'S9.Aa', 'extra-switch');
    program = addWire(program, 'S9.Ab', 'Ta', 'extra-test');
    program = addWire(program, 'Tb', 'L0', 'extra-output');
    const report = inspectRailway(program);
    assert.deepEqual(report.switchIndices, [0, 1, 2, 3, 4, 9]);
    assert.equal(report.button, true);
    assert.equal(report.total, 128);
    assert.equal(new Set(report.rows.map(row => row.switches.map(Number).join('') + Number(row.button))).size, 128);
    assert.ok(report.unsafeCount > 0);
    checkReplay(program, report.safetyCounterexample);
    assert.equal(report.safetyCounterexample.switches[9], true);
    assert.equal(report.safetyCounterexample.button, true);
    assert.deepEqual(report.safetyCounterexample.violations, ['route-a-unrequested']);
});

test('unused lamps are functional mismatches but do not invent railway safety violations', () => {
    const program = addWire(preset(), 'Q', 'L9', 'extra-lamp');
    const report = inspectRailway(program);
    assert.equal(report.safeCount, 32);
    assert.equal(report.unsafeCount, 0);
    assert.equal(report.matched, 0);
    assert.equal(report.mismatched, 32);
    assert.deepEqual(report.counterexample.different, [9]);
    checkReplay(program, report.counterexample);
});

test('inspecting renamed circuits preserves fixed port meanings and does not mutate programs or inputs', () => {
    const program = preset();
    const renamed = {...program, title: 'Meine Kreuzung', switchLabels: Array(10).fill('Eingang'),
        lampLabels: Array(10).fill('Signal')};
    const before = JSON.stringify(renamed);
    assert.deepEqual(inspectRailway(renamed), inspectRailway(program));
    assert.equal(JSON.stringify(renamed), before);
    const state = inputs([1, 0, 0, 0, 0]);
    const lamps = evaluateProgram(program, state).lamps;
    const inputsBefore = JSON.stringify({state, lamps});
    railwayTarget(state.switches);
    railwayViolations(state.switches, lamps);
    assert.equal(JSON.stringify({state, lamps}), inputsBefore);
});

test('railway checks reject malformed binary inputs and malformed programs', () => {
    for (const switches of [null, [], Array(10), Array(10).fill('0'), Array(10).fill(2)]) {
        assert.throws(() => railwayTarget(switches), /binary values/);
        assert.throws(() => railwayViolations(switches, Array(10).fill(false)), /binary values/);
    }
    for (const lamps of [null, [], Array(10), Array(10).fill('0'), Array(10).fill(2)]) {
        assert.throws(() => railwayViolations(Array(10).fill(false), lamps), /binary values/);
    }
    assert.throws(() => inspectRailway(null), /program must be an object/);
    assert.deepEqual(railwayTarget(inputs([1, 0, 0, 0, 0]).switches), [true, ...Array(9).fill(false)]);
});
