// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {encodeProjectState, decodeProjectState, attachBrickwrightState, extractBrickwrightState,
    replaceProjectState, BUNDLE_PATH} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';
import {createCardiacWorkspace, CARDIAC_WORKSPACE_KEY, readCardiacWorkspaceActive,
    setCardiacWorkspaceActive, validateCardiacWorkspace} from '../overlay/scratch-gui/src/lib/cardiac-project.js';

const draft = () => ({...createCardiacWorkspace('ORG 01\nCLA unfinished_label\n', '042\n-'), active: false,
    loadedProgram: {entry: 1, words: [{address: 1, value: 580}, {address: 2, value: 900}, {address: 80, value: 42}]}});
const storage = (initial = {}) => {
    const values = new Map(Object.entries(initial));
    return {get length () {return values.size;}, key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key), dump: () => Object.fromEntries(values)};
};

test('the CARDIAC bundle section preserves an unfinished draft, independent image and inactive selection', () => {
    const workspace = draft();
    const raw = {[CARDIAC_WORKSPACE_KEY]: JSON.stringify(workspace)};
    assert.deepEqual(encodeProjectState(raw), {cardiac: workspace});
    assert.deepEqual(JSON.parse(decodeProjectState({cardiac: workspace})[CARDIAC_WORKSPACE_KEY]), workspace);
    for (const field of ['pc', 'acc', 'steps', 'running', 'inputQueue', 'output', 'memory', 'lastEvent']) {
        assert.throws(() => decodeProjectState({cardiac: {...workspace, [field]: 1}}), field);
    }
    assert.throws(() => decodeProjectState({cardiac: {...workspace, version: 2}}));
});

test('opening a project without CARDIAC removes the prior draft and selection while keeping preferences', () => {
    const store = storage({[CARDIAC_WORKSPACE_KEY]: JSON.stringify({...draft(), active: true}), 'bw-theme': 'dark'});
    const result = replaceProjectState(store, {});
    assert.equal(result.outcome, 'loaded');
    assert.deepEqual(store.dump(), {'bw-theme': 'dark'});
    assert.equal(readCardiacWorkspaceActive(store), false);
});

test('an actual SB3 archive carries the draft and loaded image without changing Scratch or starting a run', async () => {
    const workspace = draft();
    const project = {targets: [{isStage: true, name: 'Stage', blocks: {}, costumes: [], sounds: []}], meta: {semver: '3.0.0'}};
    const previous = Object.fromEntries(['localStorage', 'window', 'CustomEvent'].map(key => [key, globalThis[key]]));
    globalThis.localStorage = storage({[CARDIAC_WORKSPACE_KEY]: JSON.stringify(workspace)});
    const events = [];
    globalThis.window = {dispatchEvent: event => events.push(event.type)};
    globalThis.CustomEvent = class {constructor (type) {this.type = type;}};
    try {
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify(project));
        const saved = await attachBrickwrightState(new Blob([await zip.generateAsync({type: 'nodebuffer'})]));
        const opened = await JSZip.loadAsync(await saved.arrayBuffer());
        assert.deepEqual(JSON.parse(await opened.file('project.json').async('text')), project);
        const bundle = JSON.parse(await opened.file(BUNDLE_PATH).async('text'));
        assert.deepEqual(bundle.state.cardiac, workspace);
        globalThis.localStorage = storage({'bw-theme': 'dark'});
        const result = await extractBrickwrightState(await saved.arrayBuffer());
        assert.equal(result.outcome, 'loaded');
        assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(CARDIAC_WORKSPACE_KEY)), workspace);
        assert.equal(readCardiacWorkspaceActive(globalThis.localStorage), false);
        assert.equal(globalThis.localStorage.getItem('bw-theme'), 'dark');
        assert.ok(events.every(name => !/run|key|media-load/.test(name)), events.join(', '));
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
});

test('selection helpers distinguish an inactive or legacy draft from an explicit active workspace', () => {
    const workspace = draft();
    const store = storage({[CARDIAC_WORKSPACE_KEY]: JSON.stringify(workspace)});
    assert.equal(readCardiacWorkspaceActive(store), false);
    setCardiacWorkspaceActive(store, true);
    assert.equal(readCardiacWorkspaceActive(store), true);
    assert.deepEqual(JSON.parse(store.getItem(CARDIAC_WORKSPACE_KEY)), {...workspace, active: true});
    setCardiacWorkspaceActive(store, false);
    assert.deepEqual(JSON.parse(store.getItem(CARDIAC_WORKSPACE_KEY)), workspace);

    const {active, ...legacy} = workspace;
    assert.equal(validateCardiacWorkspace(legacy).project.active, false);
    store.setItem(CARDIAC_WORKSPACE_KEY, JSON.stringify(legacy));
    assert.equal(readCardiacWorkspaceActive(store), false);
    store.setItem(CARDIAC_WORKSPACE_KEY, '{unfinished');
    setCardiacWorkspaceActive(store, true);
    assert.equal(store.getItem(CARDIAC_WORKSPACE_KEY), '{unfinished');
    assert.equal(readCardiacWorkspaceActive(store), false);
});
