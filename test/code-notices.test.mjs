import assert from 'node:assert/strict';
import test from 'node:test';

import {collectCodeNotices} from '../overlay/scratch-gui/src/components/tw-pseudocode/code-notices.js';
import {usesScratchStage} from '../overlay/scratch-gui/src/components/tw-pseudocode/code-example-view.js';

const editor = () => {
    let state = {codeNotices: [], codeNoticeId: 0, status: '', conversionReport: null};
    return (patch, visible = true) => {
        state = {...state, ...patch};
        state = {...state, ...collectCodeNotices(state, visible)};
        return state.codeNotices;
    };
};

test('one operation can deliver an unread status and report without counting busy progress', () => {
    const update = editor();
    const report = {direction: 'Pseudocode → Blocks', preserved: true};
    assert.deepEqual(update({busy: true, status: 'Compiling…'}), []);
    const rows = update({busy: false, status: 'Blocks loaded.', conversionReport: report});
    assert.deepEqual(rows, [
        {id: 2, report, unread: true},
        {id: 1, status: 'Blocks loaded.', offer: undefined, unread: true}
    ]);
    assert.deepEqual(update({}), rows);
});

test('opening help marks the notices read; new notices count after closing', () => {
    const update = editor();
    update({status: 'A warning'});
    assert.equal(update({showInfo: true}, false)[0].unread, true);
    assert.equal(update({}, true)[0].unread, false);
    assert.equal(update({status: 'Visible while open'})[0].unread, false);
    const rows = update({showInfo: false, status: 'New warning'});
    assert.deepEqual(rows.map(row => row.unread), [true, false, false]);
});

test('dismissal and clearing do not re-add old operations; a repeated later result earns a new ID', () => {
    const update = editor();
    const report = {direction: 'Python → Blocks', preserved: false};
    const [reportRow, statusRow] = update({status: 'Conversion failed.', conversionReport: report});
    assert.deepEqual(update({codeNotices: [statusRow]}), [statusRow]);
    assert.deepEqual(update({codeNotices: []}), []);
    assert.deepEqual(update({busy: true}), []);
    assert.deepEqual(update({busy: false}), []);
    update({status: '', conversionReport: null});
    const [again] = update({status: '', conversionReport: {...report}});
    assert.ok(again.id > reportRow.id);
    assert.equal(again.unread, true);
});

test('Scratch example routing uses visible Stage behavior even in nested blocks', () => {
    const project = (...opcodes) => ({
        targets: [{isStage: true, blocks: Object.fromEntries(opcodes.map((opcode, i) => [i, {opcode}]))}]
    });
    assert.equal(usesScratchStage(project('event_whenflagclicked', 'data_setvariableto', 'operator_add')), false);
    assert.equal(usesScratchStage(project('event_whenflagclicked', 'control_forever', 'motion_movesteps')), true);
    assert.equal(usesScratchStage(project('looks_say')), true);
    assert.equal(usesScratchStage(project('sensing_askandwait')), true);
    assert.equal(usesScratchStage({...project(), monitors: [{visible: true}]}), true);
    assert.equal(usesScratchStage({...project(), monitors: [{visible: false}]}), false);
});
