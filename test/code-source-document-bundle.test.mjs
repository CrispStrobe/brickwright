// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {createCodeDocument, addCodeProjection, editCodeDocument, serializeCodeDocument,
    restoreCodeDocumentState} from '../overlay/scratch-gui/src/lib/code-source-document.js';
import {attachBrickwrightState, extractBrickwrightState, BUNDLE_PATH,
    BUNDLE_FORMAT, BUNDLE_VERSION} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const memoryStorage = initial => {
    const values = new Map(Object.entries(initial));
    return {
        get length () { return values.size; },
        key: index => [...values.keys()][index] ?? null,
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        dump: () => Object.fromEntries(values)
    };
};
const archive = async code => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify({targets: [], meta: {semver: '3.0.0'}}));
    if (code) zip.file(BUNDLE_PATH, JSON.stringify({format: BUNDLE_FORMAT, version: BUNDLE_VERSION,
        state: {code}}));
    return zip.generateAsync({type: 'nodebuffer'});
};
const asArrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const withBrowser = async action => {
    const previous = Object.fromEntries(['localStorage', 'window', 'CustomEvent'].map(key =>
        [key, {exists: Object.hasOwn(globalThis, key), value: globalThis[key]}]));
    globalThis.window = {dispatchEvent: () => {}};
    globalThis.CustomEvent = class { constructor (type, options = {}) { this.type = type; this.detail = options.detail; } };
    try { await action(); } finally {
        for (const [key, entry] of Object.entries(previous)) {
            if (entry.exists) globalThis[key] = entry.value;
            else delete globalThis[key];
        }
    }
};

test('real project save/open preserves source, selected generated text, target and engine', async () => {
    await withBrowser(async () => {
        const source = 'DEVICE PICO\nWHEN flag clicked:\n  say "original"';
        const document = addCodeProjection(createCodeDocument({code: source}), {
            lang: 'python', code: 'print("visible generated")', sourceRevision: 1,
            options: {driver: 'shim'}, diagnostics: {warnings: []}, runtime: 'skulpt'
        });
        const saved = serializeCodeDocument(document);
        globalThis.localStorage = memoryStorage({'bw-code-autosave': saved});
        const base = await archive();
        const result = await attachBrickwrightState(new Blob([base]));
        const zip = await JSZip.loadAsync(await result.arrayBuffer());
        const sidecar = JSON.parse(await zip.file(BUNDLE_PATH).async('text'));
        assert.equal(sidecar.state.code.lang, 'pseudocode');
        assert.equal(sidecar.state.code.code, source);
        assert.equal(sidecar.state.code.selectedLang, 'python');

        globalThis.localStorage = memoryStorage({'bw-code-autosave': JSON.stringify({lang: 'javascript',
            code: 'old project'}), 'bw-theme': 'dark'});
        const bytes = Buffer.from(await result.arrayBuffer());
        const loaded = await extractBrickwrightState(asArrayBuffer(bytes));
        assert.equal(loaded.outcome, 'loaded');
        assert.equal(globalThis.localStorage.getItem('bw-code-autosave'), saved);
        assert.equal(globalThis.localStorage.getItem('bw-theme'), 'dark');
        const restored = restoreCodeDocumentState(JSON.parse(globalThis.localStorage.getItem('bw-code-autosave')));
        assert.equal(restored.lang, 'python');
        assert.equal(restored.buffers.python, 'print("visible generated")');
        assert.equal(restored.buffers.pseudocode, source);
        assert.equal(restored.buffers.javascript, '', 'replacement does not retain the prior project tab');
        assert.equal(restored.codeTarget, 'pico');
        assert.equal(restored.codeRuntime, 'skulpt');
    });
});

test('an edited generated source keeps its target and async conversion contract through the archive', async () => {
    await withBrowser(async () => {
        const generated = addCodeProjection(createCodeDocument({code: 'DEVICE PICO\n'}), {
            lang: 'javascript', code: '// owned-console-v1: owned tasks\ncodeRun.spawn(async task => {});',
            sourceRevision: 1
        });
        const edited = editCodeDocument(generated, {lang: 'javascript',
            code: 'codeRun.spawn(async task => { console.log(await task.input("Still owned?")); });'});
        const bytes = await archive(edited);
        globalThis.localStorage = memoryStorage({});
        assert.equal((await extractBrickwrightState(asArrayBuffer(bytes))).outcome, 'loaded');
        const restored = restoreCodeDocumentState(JSON.parse(globalThis.localStorage.getItem('bw-code-autosave')));
        assert.equal(restored.buffers.javascript, edited.code);
        assert.equal(restored.codeDocument.execution, 'owned-console-v1');
        assert.equal(restored.codeTarget, 'pico');
        assert.equal(restored.codeRuntime, 'javascript');
    });
});

for (const [name, mutate] of [
    ['future version', document => ({...document, version: 2})],
    ['invalid source identity', document => ({...document, revision: 0})],
    ['oversized stored source', document => ({...document, code: '€'.repeat(180000)})],
    ['stale projection', document => ({...document, projections: {javascript: {
        code: 'stale', sourceRevision: 999, options: {}, diagnostics: null, execution: null
    }}})]
]) {
    test(`${name} in a real archive preserves every current project storage key`, async () => {
        await withBrowser(async () => {
            const before = {'bw-code-autosave': JSON.stringify({lang: 'python', code: 'print("keep")'}),
                'bw-circuit-autosave': JSON.stringify({parts: [], wires: []}), 'bw-theme': 'dark'};
            globalThis.localStorage = memoryStorage(before);
            const bytes = await archive(mutate(createCodeDocument({code: 'say "incoming"'})));
            const result = await extractBrickwrightState(asArrayBuffer(bytes));
            assert.equal(result.outcome, 'invalid');
            assert.deepEqual(globalThis.localStorage.dump(), before);
        });
    });
}

test('live Code collection refuses a stale successful archive after a source save failure', async () => {
    await withBrowser(async () => {
        const oldSource = JSON.stringify({lang: 'python', code: 'print("older saved source")'});
        globalThis.localStorage = memoryStorage({'bw-code-autosave': oldSource});
        const visible = editCodeDocument(createCodeDocument({lang: 'python', code: 'print("old")'}), {
            lang: 'python', code: '€'.repeat(180000)
        });
        globalThis.window.dispatchEvent = event => {
            if (event.type !== 'bw-project-bundle-collect') return;
            try { globalThis.localStorage.setItem('bw-code-autosave', serializeCodeDocument(visible)); }
            catch (error) { event.detail.refuseCodeSave(error.message); }
        };
        const base = await archive();
        await assert.rejects(attachBrickwrightState(new Blob([base])), error =>
            error.code === 'BW_CODE_SAVE_REFUSED' && /Code source was not saved:.*exceeds.*bytes/.test(error.message));
        assert.equal(visible.code, '€'.repeat(180000));
        assert.equal(globalThis.localStorage.getItem('bw-code-autosave'), oldSource);

        // A different successful collection is not poisoned by the first one.
        const replacement = createCodeDocument({lang: 'python', code: 'print("new project")', target: null});
        globalThis.window.dispatchEvent = event => {
            if (event.type === 'bw-project-bundle-collect') {
                globalThis.localStorage.setItem('bw-code-autosave', serializeCodeDocument(replacement));
            }
        };
        const saved = await attachBrickwrightState(new Blob([base]));
        const zip = await JSZip.loadAsync(await saved.arrayBuffer());
        const sidecar = JSON.parse(await zip.file(BUNDLE_PATH).async('text'));
        assert.equal(sidecar.state.code.code, 'print("new project")');
    });
});

test('a live storage failure is a named save refusal even though old stored Code is valid', async () => {
    await withBrowser(async () => {
        const previous = JSON.stringify({lang: 'javascript', code: 'console.log("old")'});
        globalThis.localStorage = memoryStorage({'bw-code-autosave': previous});
        globalThis.window.dispatchEvent = event => {
            if (event.type === 'bw-project-bundle-collect') event.detail.refuseCodeSave('Storage quota is full.');
        };
        const base = await archive();
        await assert.rejects(attachBrickwrightState(new Blob([base])), {
            code: 'BW_CODE_SAVE_REFUSED', message: 'Code source was not saved: Storage quota is full.'
        });
        assert.equal(globalThis.localStorage.getItem('bw-code-autosave'), previous);
    });
});

for (const [name, stored] of [
    ['malformed JSON', '{'],
    ['future document', JSON.stringify({...createCodeDocument({code: 'keep incoming source'}), version: 2})],
    ['oversized document', JSON.stringify(createCodeDocument({lang: 'python', code: '€'.repeat(180000)}))]
]) {
    test(`stored ${name} refuses archive creation outside the generic archive fallback`, async () => {
        await withBrowser(async () => {
            globalThis.localStorage = memoryStorage({'bw-code-autosave': stored});
            const base = await archive();
            await assert.rejects(attachBrickwrightState(new Blob([base])), error =>
                error.code === 'BW_CODE_SAVE_REFUSED' && /Code source was not saved:/.test(error.message));
            assert.equal(globalThis.localStorage.getItem('bw-code-autosave'), stored);
        });
    });
}
