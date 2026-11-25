import test from 'node:test';
import assert from 'node:assert/strict';
import {cp1DebugView} from '../overlay/scratch-gui/src/lib/cp1-debug-view.js';

const source = '; original test program\nORG 20\nstart: AKO 42\nABS 30\nSPU start\n';
function snapshot () {
    const cells = Array.from({length: 128}, () => ({opcode: 0, operand: 0}));
    cells[20] = {opcode: 4, operand: 42};
    cells[21] = {opcode: 6, operand: 30};
    cells[22] = {opcode: 9, operand: 20};
    return {cells, cp1: {available: true, profileQualified: true, pc: 21,
        accumulator: {opcode: 17, operand: 231}, comparison: {value: true, label: 'test comparison'},
        execution: 'running', command: {address: 20, opcode: 4, operand: 42}, atCommandBoundary: false,
        breakpoints: [22, 20, 22], profileId: 'original-test-profile'}};
}

test('semantic view uses full engine accumulator and current command with a matching source line', () => {
    const input = snapshot();
    const before = structuredClone(input);
    const view = cp1DebugView(input, source);
    assert.equal(view.qualified, true);
    assert.equal(view.pc, 21);
    assert.deepEqual(view.accumulator, {opcode: 17, operand: 231});
    assert.equal(view.comparison, true);
    assert.equal(view.currentAddress, 20);
    assert.equal(view.current.line, 3);
    assert.equal(view.current.source, 'start: AKO 42');
    assert.deepEqual(view.breakpoints, [20, 22]);
    assert.deepEqual(input, before, 'rendering does not mutate a machine observation');
});

test('unloaded edits, modified RAM, invalid source and holes never receive a false current-line highlight', () => {
    assert.equal(cp1DebugView(snapshot(), source.replace('AKO 42', 'AKO 73')).current, null);
    const edited = snapshot();
    edited.cells[20].opcode = 9;
    assert.equal(cp1DebugView(edited, source).sourceMismatch, true);
    const invalid = cp1DebugView(snapshot(), 'AKO 999');
    assert.equal(invalid.sourceValid, false);
    assert.equal(invalid.current, null);
    const hole = snapshot();
    hole.cp1.command.address = 19;
    assert.equal(cp1DebugView(hole, source).current, null);
});

test('unknown or unqualified ROMs cannot invent teaching state from raw CPU values', () => {
    for (const cp1 of [undefined, {...snapshot().cp1, available: false}, {...snapshot().cp1, profileQualified: false}]) {
        const view = cp1DebugView({...snapshot(), cp1, cpu: {pc: 20, a: 42}}, source);
        assert.equal(view.qualified, false);
        assert.equal(view.currentAddress, null);
        assert.equal(view.accumulator, null);
        assert.equal(view.comparison, null);
        assert.deepEqual(view.breakpoints, []);
    }
});

test('CP3 cell bounds and false comparison survive presentation without byte coercion', () => {
    const input = snapshot();
    input.cp1 = {...input.cp1, pc: 255, command: {address: 255, opcode: 4, operand: 231}, comparison: {value: false}, breakpoints: [255, 256, -1, '20']};
    input.cells[255] = {opcode: 4, operand: 231};
    assert.equal(cp1DebugView(input, 'ORG 255\nAKO 231').qualified, true);
    assert.equal(cp1DebugView(input, 'ORG 255\nAKO 231').current, null);
    const view = cp1DebugView(input, 'ORG 255\nAKO 231', {expansion: true});
    assert.equal(view.current.address, 255);
    assert.equal(view.comparison, false);
    assert.deepEqual(view.breakpoints, [255]);
    input.cp1.accumulator.operand = 256;
    assert.equal(cp1DebugView(input, source).accumulator, null);
});

test('unknown execution and unattributable running commands never highlight a RAM-derived source position', () => {
    const input = snapshot();
    input.cp1.execution = 'unknown';
    assert.equal(cp1DebugView(input, source).currentAddress, null);
    assert.equal(cp1DebugView(input, source).current, null);
    input.cp1.execution = 'running';
    for (const command of [null, undefined, {}, {address: 256}, {address: '20'}]) {
        input.cp1.command = command;
        const view = cp1DebugView(input, source);
        assert.equal(view.currentAddress, null, 'do not substitute the teaching PC for an unobserved command');
        assert.equal(view.current, null);
    }
});

test('self-modified RAM cannot relabel the command that is still executing', () => {
    const input = snapshot();
    input.cp1.command = {address: 20, opcode: 6, operand: 20};
    // The running ABS 20 stored 04.042 over itself, making RAM match the draft.
    const view = cp1DebugView(input, source);
    assert.equal(view.rows[0].matchesMemory, true);
    assert.equal(view.currentAddress, 20);
    assert.equal(view.current, null);
    assert.equal(view.sourceMismatch, true);
    input.cp1.execution = 'ready';
    input.cp1.pc = 20;
    input.cp1.command = {address: 20, opcode: 4, operand: 42};
    assert.equal(cp1DebugView(input, source).current.address, 20, 'the replacement can be highlighted at its own boundary');
});
