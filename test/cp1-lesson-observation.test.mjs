import test from 'node:test';
import assert from 'node:assert/strict';
import {cp1LessonObservation, createCp1LessonBatch} from '../overlay/scratch-gui/src/lib/cp1-lesson-observation.js';

const event = (sequence = 1, address = 0) => ({type: 'cp1.command', kind: 'command',
    profileId: 'authored-test-profile', romSha1: 'a'.repeat(40), sequence, pc: address + 1,
    tNs: BigInt(sequence) * 2500n, accumulator: {opcode: 17, operand: 231},
    comparison: {value: false}, command: {address, opcode: 5, operand: 90},
    outcome: 'completed', commandCycles: 25});

test('lesson observation preserves full engine state and has JSON-safe simulated timestamps', () => {
    const item = cp1LessonObservation(event(), 'trainer');
    assert.equal(item.event, 'cp1-command');
    assert.equal(item.detail.accumulatorOpcode, 17);
    assert.equal(item.detail.accumulatorOperand, 231);
    assert.equal(item.detail.comparison, false);
    assert.equal(item.detail.address, 0);
    assert.equal(item.detail.timeNs, '2500');
    assert.equal(item.detail.partId, 'trainer');
    assert.doesNotThrow(() => JSON.stringify(item));
});

test('source loading, an unqualified event, or an unfinished command cannot complete a lesson', () => {
    for (const invalid of [null, {source: 'AKO 42'}, {...event(), profileId: ''},
        {...event(), romSha1: 'unknown'}, {...event(), outcome: 'started'},
        {...event(), command: null}, {...event(), tNs: -1n}]) {
        assert.equal(cp1LessonObservation(invalid), null);
    }
});

test('bounded batches coalesce each command while preserving distinct command and terminal facts', () => {
    const batch = createCp1LessonBatch('trainer');
    for (let sequence = 1; sequence <= 10000; sequence++) batch.accept(event(sequence, sequence % 250));
    const error = {...event(10001), type: 'cp1.error', kind: 'error', error: {code: 6}};
    batch.accept(error);
    const items = batch.take();
    assert.equal(items.length, 251);
    assert.equal(items.at(-1).event, 'cp1-error');
    assert.equal(items.at(-1).detail.errorCode, 6);
    assert.equal(items[0].detail.sequence, 9751);
    assert.deepEqual(batch.take(), []);
    batch.accept(event()); batch.clear(); assert.deepEqual(batch.take(), []);
});
