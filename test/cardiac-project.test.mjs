import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardiacWorkspace, validateCardiacWorkspace, serializeCardiacWorkspace,
    deserializeCardiacWorkspace, CARDIAC_MAX_SOURCE} from '../overlay/scratch-gui/src/lib/cardiac-project.js';
import {assembleCardiac} from '../overlay/scratch-gui/src/lib/cardiac-program.js';

const source = 'ORG 1\nINP 80\nOUT 80\nHRS\nORG 80\nDAT 0\n';
const loaded = () => {
    const assembly = assembleCardiac(source);
    return {entry: assembly.entry, words: assembly.words.map(({address, value}) => ({address, value}))};
};
const reject = value => {
    const result = validateCardiacWorkspace(value);
    assert.equal(result.ok, false);
    assert.equal(result.project, null);
    assert.ok(result.errors.length);
    return result.errors;
};

test('unfinished source and input-strip drafts survive without becoming an executable image', () => {
    const draft = createCardiacWorkspace('again: CLA unfinished +\n', '-00');
    assert.equal(assembleCardiac(draft.source).ok, false);
    const restored = deserializeCardiacWorkspace(serializeCardiacWorkspace(draft));
    assert.deepEqual(restored, draft);
    assert.equal(restored.loadedProgram, null);
    assert.equal(restored.source.endsWith('\n'), true);
});

test('a saved loaded image remains independent of an edited or invalid source draft', () => {
    const workspace = {...createCardiacWorkspace(source, '042'), loadedProgram: loaded()};
    workspace.source = 'ORG 1\nINP unfinished +\n';
    workspace.inputDeck = '0, -';
    const restored = deserializeCardiacWorkspace(serializeCardiacWorkspace(workspace));
    assert.equal(restored.source, workspace.source);
    assert.equal(restored.inputDeck, workspace.inputDeck);
    assert.deepEqual(restored.loadedProgram, loaded());
    assert.equal(assembleCardiac(restored.source).ok, false);
    assert.equal(Object.hasOwn(restored, 'memory'), false);
});

test('validation returns detached normalized authored cells, not references into an editor', () => {
    const image = {entry: 10, words: [{address: 80, value: -0}, {address: 10, value: 900}]};
    const input = {...createCardiacWorkspace('ENTRY 10\n10: 900\n80: 0', ''), loadedProgram: image};
    const result = validateCardiacWorkspace(input);
    assert.equal(result.ok, true);
    assert.deepEqual(result.project.loadedProgram.words, [{address: 10, value: 900}, {address: 80, value: 0}]);
    image.words[1].value = 901;
    image.entry = 99;
    assert.equal(result.project.loadedProgram.words[0].value, 900);
    assert.equal(result.project.loadedProgram.entry, 10);
    assert.equal(Object.is(result.project.loadedProgram.words[1].value, -0), false);
});

test('portable workspaces reject clocks, queued input, runtime memory and resume state', () => {
    for (const [key, value] of [['running', true], ['pc', 20], ['acc', 42], ['steps', 50],
        ['inputQueue', [42]], ['output', [42]], ['memory', Array(100).fill(0)], ['snapshot', {}],
        ['heldKeys', ['RUN']], ['constructor', {}], ['romBytes', [1, 2]]]) {
        reject({...createCardiacWorkspace(source), [key]: value});
    }
    reject({...createCardiacWorkspace(source), loadedProgram: {...loaded(), running: true}});
    reject({...createCardiacWorkspace(source), loadedProgram: {entry: 1, words: [{address: 1, value: 900, source: 'not portable'}]}});
    reject(JSON.parse('{"__proto__":{"polluted":true}}'));
    assert.equal({}.polluted, undefined);
});

test('program bounds and fixed-cell rules reject a whole imported image atomically', () => {
    const base = createCardiacWorkspace(source);
    for (const image of [
        {entry: 100, words: []}, {entry: null, words: []},
        {entry: 1, words: [{address: 1, value: 900}, {address: 1, value: 901}]},
        {entry: 0, words: [{address: 0, value: 2}]},
        {entry: 1, words: [{address: -1, value: 1}]},
        {entry: 1, words: [{address: 100, value: 1}]},
        {entry: 1, words: [{address: 1, value: 1000}]},
        {entry: 1, words: [{address: 1, value: -1000}]},
        {entry: 1, words: [{address: 1, value: 1.5}]},
        {entry: 1, words: [{address: '1', value: 1}]},
        {entry: 1, words: [null]},
    ]) reject({...base, loadedProgram: image});
    assert.equal(validateCardiacWorkspace({...base, loadedProgram: {entry: 0, words: [{address: 0, value: 1}, {address: 99, value: -999}]}}).ok, true);
});

test('unsupported versions and oversized drafts are refused without erasing a valid in-memory draft', () => {
    const base = createCardiacWorkspace('unfinished: ADD ', '42');
    reject({...base, version: 2});
    reject({...base, profile: 'unknown-profile'});
    reject({...base, inputMode: 'automatic'});
    reject({...base, source: 'x'.repeat(CARDIAC_MAX_SOURCE + 1)});
    reject({...base, inputDeck: 'x'.repeat(32769)});
    assert.throws(() => deserializeCardiacWorkspace('{'), SyntaxError);
    assert.throws(() => deserializeCardiacWorkspace(' '.repeat(256 * 1024 + 1)), /at most/);
    assert.deepEqual(base, createCardiacWorkspace('unfinished: ADD ', '42'));
});

test('a sparse authored image must not silently lose missing entries during validation', () => {
    reject({...createCardiacWorkspace(source), loadedProgram: {entry: 1, words: Array(1)}});
});
