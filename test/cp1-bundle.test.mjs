import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {encodeProjectState, decodeProjectState, attachBrickwrightState, extractBrickwrightState,
    BUNDLE_PATH, replaceProjectState} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const draft = () => ({format: 'brickwright.cp1-workspace', version: 1,
    configuration: {expansion: true, clockHz: 6000000},
    rom: {sha256: '1'.repeat(64), byteLength: 2048, name: 'local-monitor.bin'},
    source: 'ORG 128\nAKO 42\nSPU unfinished_label\n'});
const storage = initial => {
    const values = new Map(Object.entries(initial));
    return {get length () { return values.size; }, key: i => [...values.keys()][i] ?? null,
        getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key), dump: () => Object.fromEntries(values)};
};

test('CP1 optional bundle section preserves incomplete source and a ROM reference only', () => {
    const workspace = draft();
    const raw = {'bw-cp1-workspace': JSON.stringify(workspace)};
    assert.deepEqual(encodeProjectState(raw), {cp1: workspace});
    assert.deepEqual(decodeProjectState({cp1: workspace}), raw);
    for (const property of ['cpu', 'heldKeys', 'romBytes', 'resume']) {
        assert.throws(() => decodeProjectState({cp1: {...workspace, [property]: {}}}));
    }
    assert.throws(() => decodeProjectState({cp1: {...workspace, version: 2}}));
});

test('a vanilla project removes CP1 state while preserving personal preferences', () => {
    const store = storage({'bw-cp1-workspace': JSON.stringify(draft()), 'bw-theme': 'dark'});
    const result = replaceProjectState(store, {});
    assert.equal(result.outcome, 'loaded');
    assert.deepEqual(store.dump(), {'bw-theme': 'dark'});
});

test('real sb3 archive carries the draft without changing Scratch project.json or auto-running', async () => {
    const workspace = draft();
    const project = {targets: [{isStage: true, name: 'Stage', blocks: {}, costumes: [], sounds: []}],
        meta: {semver: '3.0.0'}};
    const previousStorage = globalThis.localStorage, previousWindow = globalThis.window,
        previousCustomEvent = globalThis.CustomEvent;
    globalThis.localStorage = storage({'bw-cp1-workspace': JSON.stringify(workspace)});
    const events = [];
    globalThis.window = {dispatchEvent: event => events.push(event.type)};
    globalThis.CustomEvent = class { constructor (type) { this.type = type; } };
    try {
        const zip = new JSZip(); zip.file('project.json', JSON.stringify(project));
        const base = await zip.generateAsync({type: 'nodebuffer'});
        const saved = await attachBrickwrightState(new Blob([base]));
        const opened = await JSZip.loadAsync(await saved.arrayBuffer());
        assert.deepEqual(JSON.parse(await opened.file('project.json').async('text')), project);
        const bundle = JSON.parse(await opened.file(BUNDLE_PATH).async('text'));
        assert.deepEqual(bundle.state.cp1, workspace);
        globalThis.localStorage = storage({'bw-theme': 'dark'});
        const result = await extractBrickwrightState(await saved.arrayBuffer());
        assert.equal(result.outcome, 'loaded');
        assert.deepEqual(JSON.parse(globalThis.localStorage.getItem('bw-cp1-workspace')), workspace);
        assert.equal(globalThis.localStorage.getItem('bw-theme'), 'dark');
        assert.ok(events.every(name => !/run|key|media-load/.test(name)));
    } finally {
        if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
        if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
        if (previousCustomEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = previousCustomEvent;
    }
});
