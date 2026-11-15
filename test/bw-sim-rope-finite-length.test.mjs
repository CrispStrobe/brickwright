import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor} from '../overlay/scratch-gui/src/lib/bw-sim/editor/editor-state.js';
import {validatePlacedModel} from '../overlay/scratch-gui/src/lib/bw-sim/contracts.js';

const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const catalog = new Map([['beam.dat', {part: 'beam.dat', category: 'beam'}]]);
const model = () => ({version: 1, parts: [
    {id: 'p1', part: 'beam.dat', position: [0, 0, 0], rotation},
    {id: 'p2', part: 'beam.dat', position: [0, 0, 40], rotation}
]});

test('rope model validation rejects non-finite lengths and retains valid finite lengths', () => {
    const m = model();
    m.ropes = [{id: 'r1', lengthLdu: Infinity, around: ['p1', 'p2']}];
    for (const length of [Infinity, -Infinity, NaN, 0, -1]) {
        m.ropes[0].lengthLdu = length;
        assert.ok(validatePlacedModel(m, catalog).some(e => e.includes('lengthLdu')));
    }
    m.ropes[0].lengthLdu = 120.5;
    assert.deepEqual(validatePlacedModel(m, catalog), []);
});

test('editor rejects a non-finite rope length without changing history', () => {
    const ed = createEditor({model: model(), catalog});
    for (const lengthLdu of [Infinity, -Infinity, NaN, 0, -1]) {
        assert.throws(() => ed.apply({type: 'addRope', around: ['p1', 'p2'], lengthLdu}), /bad rope length/);
    }
    assert.equal(ed.canUndo, false);
    assert.equal(ed.model.ropes, undefined);
    ed.apply({type: 'addRope', around: ['p1', 'p2'], lengthLdu: 120.5});
    assert.equal(ed.model.ropes[0].lengthLdu, 120.5);
    ed.undo();
    assert.equal(ed.model.ropes, undefined);
    ed.redo();
    assert.equal(ed.model.ropes[0].lengthLdu, 120.5);
});
