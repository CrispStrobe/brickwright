// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import * as project from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import * as sdk from '../overlay/scratch-gui/static/cad-sdk/sdk.js';
import {attachBrickwrightState, inspectBrickwrightState, applyBrickwrightInspection,
    BUNDLE_PATH, BUNDLE_FORMAT, BUNDLE_VERSION} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const gui = createRequire(process.env.BW_INTEGRATED_ROOT ?
    pathToFileURL(resolve(process.env.BW_INTEGRATED_ROOT, 'package.json')) :
    new URL('../packages/scratch-gui/package.json', import.meta.url));
const React = gui('react'), {create, act} = gui('react-test-renderer');
const code = gui('@babel/core').transformSync(readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/cad-tab.jsx', import.meta.url), 'utf8'), {
    filename: 'cad-tab.jsx', babelrc: false, configFile: false,
    presets: [gui.resolve('@babel/preset-react')],
    plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs')]
}).code;
const flush = callback => act(async () => { await callback?.(); await Promise.resolve(); });
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return {promise, resolve, reject};
};
const documentText = title => sdk.serializeDocument(sdk.createDocument(title));

// Mount the shipping React host with real SDK documents and sessions. The SDK's
// DOM/WebGL view is the boundary double: it subscribes to real session changes,
// exposes the host callbacks, and records disposal. No browser claim is made.
async function fixture ({text = documentText('First project'), loadSDK} = {}) {
    const previous = {window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage};
    const values = new Map([[project.CAD_STORAGE_KEY, text]]), inputs = [], editors = [], surfaces = new Map();
    globalThis.window = new EventTarget();
    globalThis.localStorage = {get length () { return values.size; }, key: i => [...values.keys()][i],
        getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)};
    globalThis.document = {body: {appendChild () {}}, createElement: type => {
        assert.equal(type, 'input');
        const input = {style: {}, files: [], removed: false, click () {}, remove () { this.removed = true; }};
        inputs.push(input);
        return input;
    }};
    project.setLiveCadText(undefined);
    const hostedSDK = {...sdk, mountCadEditor: (host, options) => {
        const editor = {session: options.session, options, disposed: false, focus () {}, setColorMode () {},
            dispose () { this.disposed = true; unsubscribe(); }};
        let revision = options.session.state.revision;
        const unsubscribe = options.session.subscribe(state => {
            if (state.revision !== revision) {
                revision = state.revision;
                options.onDocumentChange(state.document);
            }
        });
        editors.push(editor);
        return editor;
    }};
    const module = {exports: {}};
    new Function('require', 'module', 'exports', code)(name => {
        if (name === './cad-circuit-panel.jsx') return {__esModule: true, default: () => null};
        if (name.endsWith('/bw-cad-program.js')) return {CAD_READY_EVENT: 'bw-cad-ready'};
        if (name.endsWith('/download-blob.js')) return {__esModule: true, default: () => {}};
        if (name.endsWith('/bw-cad-sdk.js')) return {loadCadSDK: () => loadSDK ? loadSDK(hostedSDK) : Promise.resolve(hostedSDK), cadAssetURL: path => path};
        if (name.endsWith('/bw-cad-project.js')) return project;
        if (name.endsWith('/global-undo.js')) return {activateUndoSurface () {}, notifyUndoState () {},
            registerUndoSurface: (id, surface) => { surfaces.set(id, surface); return () => surfaces.delete(id); }};
        return gui(name);
    }, module, module.exports);
    const Component = module.exports.default;
    let renderer;
    const mount = () => flush(() => { renderer = create(React.createElement(Component,
        {vm: {}, isVisible: true, locale: 'en', theme: 'default'}), {createNodeMock: () => ({})}); });
    const unmount = () => flush(() => { renderer?.unmount(); renderer = null; });
    await mount();
    return {values, inputs, editors, surfaces, mount, unmount, hostedSDK,
        current: () => window.__bwCad?.editor,
        alerts: () => renderer.root.findAllByProps({role: 'alert'}).map(node => node.children.join(' ')).join(' '),
        async load (cad, {legacy = false} = {}) {
            const zip = new JSZip();
            zip.file('project.json', '{"targets":[]}');
            if (cad !== null) zip.file(project.CAD_PROJECT_PATH, cad);
            if (!legacy) zip.file(BUNDLE_PATH, JSON.stringify({format: BUNDLE_FORMAT, version: BUNDLE_VERSION, state: {}}));
            const inspection = await inspectBrickwrightState(await zip.generateAsync({type: 'arraybuffer'}));
            await flush(() => {
                const applied = applyBrickwrightInspection(inspection);
                window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded', {detail: applied}));
            });
        },
        async savedCad () {
            const zip = new JSZip(); zip.file('project.json', '{"targets":[]}');
            const saved = await attachBrickwrightState(await zip.generateAsync({type: 'blob'}));
            return (await JSZip.loadAsync(await saved.arrayBuffer())).file(project.CAD_PROJECT_PATH)?.async('text');
        },
        async close () {
            await unmount();
            project.setLiveCadText(undefined);
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete globalThis[key];
                else globalThis[key] = value;
            }
        }
    };
}

test('unsupported incoming CAD retires the previous editor and preserves its exact sidecar on save', async () => {
    const f = await fixture();
    try {
        const old = f.current();
        old.session.add({kind: 'box', size: [10, 20, 30]});
        assert.equal(f.surfaces.get('cad').canUndo(), true);
        const future = JSON.stringify({...JSON.parse(documentText('Future project')), version: 999, futureData: {kept: true}});
        await f.load(future);
        assert.equal(old.disposed, true);
        assert.equal(f.current(), undefined, 'the previous design cannot remain the writable current project');
        assert.equal(f.surfaces.has('cad'), false, 'global Undo cannot restore the old design');
        assert.match(f.alerts(), /version|supported/i);
        old.options.onDocumentChange(old.session.state.document);
        assert.equal(project.readCadText(), future, 'late callbacks cannot overwrite the new sidecar');
        assert.equal(await f.savedCad(), future);
        const next = documentText('Supported project');
        await f.load(next);
        assert.equal(f.current().session.state.document.title, 'Supported project');
        assert.equal(f.alerts(), '');
        f.current().session.rename('Edited supported project');
        assert.equal(JSON.parse(await f.savedCad()).title, 'Edited supported project');
    } finally { await f.close(); }
});

test('an initially unsupported CAD project recovers automatically after a supported project loads', async () => {
    const future = JSON.stringify({...JSON.parse(documentText('Future')), version: 999});
    const f = await fixture({text: future});
    try {
        assert.equal(f.current(), undefined);
        assert.match(f.alerts(), /version|supported/i);
        await f.load(documentText('Recovered'), {legacy: true});
        assert.equal(f.current().session.state.document.title, 'Recovered');
        assert.equal(f.alerts(), '');
    } finally { await f.close(); }
});

test('Open and Import file reads settle as cancellation when a different project loads', async () => {
    for (const method of ['requestOpen', 'requestImport']) {
        const f = await fixture();
        try {
            const old = f.current(), reading = deferred(), selection = old.options[method]();
            const input = f.inputs.at(-1);
            input.files = [{name: method === 'requestOpen' ? 'old.bcad' : 'old.stl', size: 1, arrayBuffer: () => reading.promise}];
            const changed = input.onchange();
            const next = documentText('Incoming project');
            await f.load(next);
            assert.equal(await selection, null);
            assert.equal(input.removed, true);
            assert.equal(input.onchange, null);
            assert.equal(input.oncancel, null);
            reading.reject(new Error('late read failure'));
            await changed;
            assert.equal(f.current().session.state.document.title, 'Incoming project');
            assert.equal(project.readCadText(), next);
            assert.equal(f.alerts(), '');
        } finally { await f.close(); }
    }
});

test('file selections are cancelled on unmount or intervening document edits', async () => {
    for (const action of ['unmount', 'edit']) {
        const f = await fixture();
        try {
            const current = f.current(), selection = current.options.requestOpen();
            const input = f.inputs.at(-1);
            if (action === 'unmount') await f.unmount();
            else {
                current.session.rename('Changed while choosing');
                input.files = [{name: 'old.bcad', size: 1, arrayBuffer: async () => new ArrayBuffer(1)}];
                await input.onchange();
            }
            assert.equal(await selection, null);
            assert.equal(input.removed, true);
        } finally { await f.close(); }
    }
});

test('ordinary settings remounts retain undo while supported and empty project replacements reset it', async () => {
    const f = await fixture();
    try {
        const first = f.current();
        first.session.add({kind: 'box', size: [10, 20, 30]});
        const saved = project.readCadText();
        await f.unmount(); await f.mount();
        assert.equal(f.current().session, first.session);
        assert.equal(f.surfaces.get('cad').canUndo(), true);
        assert.equal(project.readCadText(), saved);
        for (const legacy of [false, true]) {
            await f.load(null, {legacy});
            assert.equal(f.current().session.state.document.roots.length, 0);
            assert.equal(f.surfaces.get('cad').canUndo(), false);
            assert.equal(project.readCadText(), null);
        }
    } finally { await f.close(); }
});

test('a failed file read is discarded after the same project is edited', async () => {
    const f = await fixture();
    try {
        const current = f.current(), reading = deferred(), selected = current.options.requestOpen();
        const result = selected.then(file => ({file}), error => ({error}));
        const input = f.inputs.at(-1);
        input.files = [{name: 'old.bcad', size: 1, arrayBuffer: () => reading.promise}];
        const changed = input.onchange();
        current.session.rename('Edited while reading');
        reading.reject(new Error('stale file read failed'));
        await changed;
        assert.deepEqual(await result, {file: null});
        assert.equal(input.removed, true);
        assert.equal(current.session.state.document.title, 'Edited while reading');
        assert.equal(JSON.parse(project.readCadText()).title, 'Edited while reading');
    } finally { await f.close(); }
});

test('current file read and size failures still reject and clean up the input', async () => {
    for (const kind of ['read', 'size']) {
        const f = await fixture();
        try {
            const failure = new Error('current file read failed'), selected = f.current().options.requestOpen();
            const rejected = assert.rejects(selected, kind === 'read' ? error => error === failure : /Project exceeds 64 MiB/);
            const input = f.inputs.at(-1);
            let reads = 0;
            input.files = [{name: 'design.bcad', size: kind === 'size' ? 64 * 1024 * 1024 + 1 : 1,
                arrayBuffer: async () => { reads++; throw failure; }}];
            await input.onchange();
            await rejected;
            assert.equal(reads, kind === 'size' ? 0 : 1);
            assert.equal(input.removed, true);
            assert.equal(input.onchange, null);
            assert.equal(input.oncancel, null);
        } finally { await f.close(); }
    }
});

test('a current file selection still returns its bytes and cancellation cleans up its input', async () => {
    const f = await fixture();
    try {
        const selected = f.current().options.requestOpen(), input = f.inputs.at(-1);
        input.files = [{name: 'design.bcad', size: 3, arrayBuffer: async () => Uint8Array.of(1, 2, 3).buffer}];
        await input.onchange();
        assert.deepEqual(await selected, {name: 'design.bcad', bytes: Uint8Array.of(1, 2, 3)});
        assert.equal(input.removed, true);
        const cancelled = f.current().options.requestImport(), next = f.inputs.at(-1);
        next.oncancel();
        assert.equal(await cancelled, null);
        assert.equal(next.removed, true);
    } finally { await f.close(); }
});

test('a project replacement during SDK loading mounts only the latest document', async () => {
    const loading = deferred(), f = await fixture({loadSDK: () => loading.promise});
    try {
        await f.load(documentText('Latest project'));
        await flush(() => loading.resolve(f.hostedSDK));
        assert.equal(f.editors.length, 1);
        assert.equal(f.current().session.state.document.title, 'Latest project');
    } finally { await f.close(); }
});
