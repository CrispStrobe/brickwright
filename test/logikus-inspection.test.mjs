import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyProgram, evaluateProgram, validateProgram} from '../overlay/scratch-gui/src/lib/logikus/model.js';
import {LOGIKUS_PRESETS, getPreset} from '../overlay/scratch-gui/src/lib/logikus/presets.js';
import {inspectProgram, programInputs} from '../overlay/scratch-gui/src/lib/logikus/inspection.js';
import {createWorkspace, validateWorkspace} from '../overlay/scratch-gui/src/lib/logikus/workspace.js';

const withWires = pairs => validateProgram({...createEmptyProgram(),
    wires: pairs.map(([from, to], i) => ({id: `w${i}`, from, to}))});
const checkCounterexample = (report, program, target) => {
    const row = report.counterexample;
    assert.ok(row, 'inspection supplies a concrete input combination');
    assert.equal(row.switches.length, 10);
    assert.deepEqual(evaluateProgram(program, row).lamps, row.lamps,
        'applying the counterexample to the real model reproduces the reported lamps');
    assert.deepEqual(evaluateProgram(target, row).lamps, row.expected,
        'the same inputs reproduce the expected goal lamps');
    assert.deepEqual(row.different,
        row.lamps.flatMap((on, i) => on === row.expected[i] ? [] : [i]));
    assert.equal(row.matches, false);
};

test('removing an input cannot hide the failing setting from Test all states', () => {
    const target = getPreset('and').program;
    // Bypassing the second contact turns AND into S0, deleting all references
    // to S1 in the learner's wiring. The target still needs S1 enumerated.
    const edited = getPreset('lamp').program;
    const report = inspectProgram(edited, target);
    assert.deepEqual(report.switchIndices, [0, 1]);
    assert.equal(report.rows.length, 4);
    assert.equal(report.matched, 3);
    assert.equal(report.counterexample.switches[0], true);
    assert.equal(report.counterexample.switches[1], false);
    assert.equal(report.counterexample.lamps[0], true);
    assert.equal(report.counterexample.expected[0], false);
    checkCounterexample(report, edited, target);
});

test('a newly added switch is included even when the original goal never referenced it', () => {
    const target = getPreset('lamp').program;
    const edited = withWires([['Q', 'S0.Aa'], ['S0.Ab', 'S7.Aa'], ['S7.Ab', 'L0']]);
    const report = inspectProgram(edited, target);
    assert.deepEqual(report.switchIndices, [0, 7]);
    assert.equal(report.rows.length, 4);
    assert.equal(report.matched, 3);
    assert.equal(report.counterexample.switches[0], true);
    assert.equal(report.counterexample.switches[7], false);
    assert.equal(report.counterexample.lamps[0], false);
    assert.equal(report.counterexample.expected[0], true);
    checkCounterexample(report, edited, target);
});

test('bypassing Test still enumerates its released state because the goal uses the button', () => {
    const target = getPreset('code-lock').program;
    const edited = validateProgram({...target, wires: target.wires
        .filter(wire => !(wire.from === 'Q' && wire.to === 'Ta'))
        .map(wire => wire.from === 'Tb' ? {...wire, from: 'Q'} : wire)});
    assert.equal(programInputs(edited).button, false);
    const report = inspectProgram(edited, target);
    assert.equal(report.button, true);
    assert.equal(report.rows.length, 2048);
    assert.equal(report.matched, 2047);
    assert.equal(report.counterexample.switches.map(Number).join(''), '1011101101');
    assert.equal(report.counterexample.button, false);
    checkCounterexample(report, edited, target);
});

test('adding Test cannot suppress its counterexample when the original goal is immediate', () => {
    const target = getPreset('lamp').program;
    const edited = withWires([['Q', 'Ta'], ['Tb', 'S0.Aa'], ['S0.Ab', 'L0']]);
    const report = inspectProgram(edited, target);
    assert.equal(report.button, true);
    assert.equal(report.rows.length, 4);
    assert.equal(report.matched, 3);
    assert.equal(report.counterexample.switches[0], true);
    assert.equal(report.counterexample.button, false);
    checkCounterexample(report, edited, target);
});

test('a blank board and constant outputs have a complete one-row truth table', () => {
    const blank = createEmptyProgram();
    const constant = withWires([['Q', 'L0'], ['L0', 'L9']]);
    const self = inspectProgram(blank, blank);
    assert.deepEqual(self.switchIndices, []);
    assert.equal(self.button, false);
    assert.equal(self.rows.length, 1);
    assert.equal(self.matched, 1);
    assert.equal(self.counterexample, null);
    const report = inspectProgram(blank, constant);
    assert.equal(report.rows.length, 1);
    assert.equal(report.matched, 0);
    assert.deepEqual(report.counterexample.different, [0, 9]);
    checkCounterexample(report, blank, constant);
    const inverse = inspectProgram(constant, blank);
    assert.deepEqual(inverse.counterexample.different, [0, 9]);
    checkCounterexample(inverse, constant, blank);
});

test('an imported unknown preset remains editable and is enumerated without an invented goal', () => {
    const imported = validateWorkspace(JSON.parse(JSON.stringify(createWorkspace({
        program: withWires([['Q', 'S9.Kb'], ['S9.Ka', 'L4']]), presetId: 'my-own-experiment'
    }))));
    const target = LOGIKUS_PRESETS.find(preset => preset.id === imported.presetId)?.program;
    assert.equal(target, undefined, 'an unknown goal ID must never pick a different preset');
    const report = inspectProgram(imported.program, target);
    assert.deepEqual(report.switchIndices, [9]);
    assert.equal(report.rows.length, 2);
    assert.deepEqual(report.rows.map(row => row.lamps[4]), [true, false]);
    assert.equal(report.counterexample, null);
    assert.equal(report.matched, 2);
    for (const row of report.rows) {
        assert.equal(row.expected, null);
        assert.deepEqual(row.different, []);
    }
    const blank = inspectProgram(createEmptyProgram());
    assert.equal(blank.rows.length, 1);
    assert.equal(blank.rows[0].expected, null);
});

test('renaming the panel, switches and lamps does not change the expected logic', () => {
    const target = getPreset('half-adder').program;
    const edited = validateProgram({...target, title: 'Mein Addierer',
        switchLabels: Array.from({length: 10}, (_, i) => `Eingang ${i}`),
        lampLabels: Array.from({length: 10}, (_, i) => `Ergebnis ${i}`)});
    const targetBefore = JSON.stringify(target), editedBefore = JSON.stringify(edited);
    const originalReport = inspectProgram(target, target);
    assert.deepEqual(inspectProgram(edited, target), originalReport);
    assert.deepEqual(inspectProgram(target, edited), originalReport);
    assert.equal(JSON.stringify(target), targetBefore);
    assert.equal(JSON.stringify(edited), editedBefore);
});

test('inspection reports every differing lamp, not only the first output', () => {
    const target = getPreset('half-adder').program;
    const blank = createEmptyProgram();
    const report = inspectProgram(blank, target);
    assert.equal(report.rows.length, 4);
    assert.equal(report.matched, 1);
    assert.deepEqual(report.rows.map(row => row.different), [[], [0], [0], [1]]);
    const altered = withWires([['Q', 'L0'], ['Q', 'L1'], ['Q', 'L9']]);
    const allOff = inspectProgram(altered, blank);
    assert.deepEqual(allOff.counterexample.different, [0, 1, 9]);
    checkCounterexample(allOff, altered, blank);
});

test('all shipped experiments match themselves, with each relevant state included once', () => {
    for (const preset of LOGIKUS_PRESETS) {
        const report = inspectProgram(preset.program, getPreset(preset.id).program);
        assert.deepEqual(report.switchIndices, preset.usedSwitches);
        assert.equal(report.button, Boolean(preset.usesButton));
        assert.equal(report.rows.length, 2 ** (preset.usedSwitches.length + (preset.usesButton ? 1 : 0)));
        assert.equal(report.matched, report.rows.length);
        assert.equal(report.counterexample, null);
        assert.equal(new Set(report.rows.map(row => row.switches.map(Number).join('') + Number(row.button))).size,
            report.rows.length, `${preset.id} enumerates each setting once`);
        for (const row of report.rows) {
            assert.deepEqual(row.lamps, row.expected);
            assert.deepEqual(row.different, []);
        }
    }
});

test('the inspected input union is numeric, deduplicated and includes either button terminal', () => {
    const first = withWires([['Q', 'S8.Ka'], ['S8.Kb', 'S1.Aa'], ['S1.Ab', 'L0']]);
    const second = withWires([['Q', 'S1.Ba'], ['S1.Bb', 'L2'], ['Tb', 'S9.Cb']]);
    assert.deepEqual(programInputs(null, first, undefined, second), {switchIndices: [1, 8, 9], button: true});
    const report = inspectProgram(first, second);
    assert.equal(report.rows.length, 16);
    checkCounterexample(report, first, second);
});
