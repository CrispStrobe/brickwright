import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleCardiac} from '../overlay/scratch-gui/src/lib/cardiac-program.js';
import {cardiacDebugView, checkCardiacPrediction} from '../overlay/scratch-gui/src/lib/cardiac-debug-view.js';

const source = 'ORG 10\nstart: CLA left\nADD right\nSTO result\nOUT result\nHRS\nORG 80\nleft: DAT 17\nright: DAT 25\nresult: DAT 0';
const observation = () => {
    const assembly = assembleCardiac(source);
    const memory = Array(100).fill(0);
    memory[0] = 1;
    memory[99] = 800;
    for (const word of assembly.words) memory[word.address] = word.value;
    return {memory, pc: 10, acc: 0, ir: 0, steps: 0, waiting: false, running: false};
};

test('source correspondence requires the actual live word to match the current assembly', () => {
    const state = observation();
    const before = structuredClone(state);
    const assembly = assembleCardiac(source);
    const view = cardiacDebugView(state, assembly);
    assert.equal(view.sourceLine, 2);
    assert.equal(view.sourceDiffers, false);
    assert.deepEqual(state, before, 'rendering does not mutate the machine observation');
    assert.equal(cardiacDebugView({cardiac: state}, assembly).sourceLine, 2);
});

test('self-modification and unloaded edits cannot receive a false source-line highlight', () => {
    const state = observation();
    state.memory[10] = 181;
    const changed = cardiacDebugView(state, assembleCardiac(source));
    assert.equal(changed.sourceLine, null);
    assert.equal(changed.sourceDiffers, true);
    const edited = cardiacDebugView(observation(), assembleCardiac(source.replace('CLA left', 'CLA right')));
    assert.equal(edited.sourceLine, null);
    assert.equal(edited.sourceDiffers, true);
});

test('unmapped memory, invalid source and absent observations never invent a source position', () => {
    assert.equal(cardiacDebugView({...observation(), pc: 50}, assembleCardiac(source)).sourceLine, null);
    assert.equal(cardiacDebugView(observation(), assembleCardiac('CLA missing')).sourceLine, null);
    assert.equal(cardiacDebugView(null, assembleCardiac(source)), null);
    assert.equal(cardiacDebugView({memory: Array(99).fill(0)}, assembleCardiac(source)), null);
});

test('prediction feedback compares exactly one actual completed instruction', () => {
    const before = {steps: 4, pc: 10, acc: 0};
    const after = {steps: 5, pc: 11, acc: 17};
    assert.equal(checkCardiacPrediction(before, after, '11', '17').kind, 'correct');
    const wrong = checkCardiacPrediction(before, after, '12', '17');
    assert.equal(wrong.kind, 'different');
    assert.equal(wrong.expectedPc, 11);
    assert.equal(wrong.expectedAcc, 17);
    assert.equal(checkCardiacPrediction(before, after, '', '17').kind, 'missing');
    assert.equal(checkCardiacPrediction(before, after, '11', '1.7').kind, 'missing');
    assert.equal(checkCardiacPrediction(before, after, '100', '17').kind, 'invalid');
    assert.equal(checkCardiacPrediction(before, after, '11', '10000').kind, 'invalid');
});

test('an input wait or an unchanged machine never rewards an unexecuted prediction', () => {
    const before = {steps: 4, pc: 1, acc: 0};
    const waiting = {...before, waiting: true};
    assert.equal(checkCardiacPrediction(before, waiting, '1', '0').kind, 'waiting');
    assert.equal(checkCardiacPrediction(before, {...before}, '1', '0').kind, 'waiting');
    assert.equal(checkCardiacPrediction(null, waiting, '1', '0').kind, 'waiting');
});

test('a reset, batch run or invalid counter cannot masquerade as one retired instruction', () => {
    const before = {steps: 4, pc: 1, acc: 0};
    for (const steps of [0, 6, undefined, NaN, 4.5]) {
        assert.equal(checkCardiacPrediction(before, {steps, pc: 1, acc: 0}, '1', '0').kind, 'waiting',
            `step counter ${String(steps)} is not one retirement after 4`);
    }
});
