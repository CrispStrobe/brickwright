// Exercise the actual JSX methods with deferred/rejected VM loads. A header is
// only a proposed device until the generated project has loaded successfully.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conversionFailure} from '../overlay/scratch-gui/src/lib/bw-conversion-error.js';
import {captureCodeArtwork, codeArtworkMatches} from '../overlay/scratch-gui/src/lib/bw-code-artwork.js';
import {scopeAfter} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {createCodeDocument, addCodeProjection, selectCodeDocumentLanguage} from '../overlay/scratch-gui/src/lib/code-source-document.js';
const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const methods = ['async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {',
    'publishAppliedDevice (stc) {', 'async setDevice (deviceId) {']
    .map(signature => codeEditorMethod(source, signature)).join('\n');
const devices = {arcade: {core: 'arcade'}, microbit: {core: 'microbit'}, calliopemini: {core: 'microbit'}, uno: {core: 'avr'}};
const Event = class { constructor (type, options) { this.type = type; this.detail = options.detail; } };
const setup = ({program = 'DEVICE ARCADE', lang = 'pseudocode', parseError, loadError, deferred = false, setStc = true, deferredRefresh = false, refreshError} = {}) => {
    const events = [], calls = [];
    const window = {dispatchEvent: event => events.push(event)};
    const Editor = codeDocumentEditorClass(source, methods, {
        DEVICE_BY_ID: devices, window, CustomEvent: Event, TWO_WAY: new Set(['pseudocode']),
        classifyConversionWarnings: () => ({changed: [], unsupported: []}),
        LANG_LABEL: {pseudocode: 'Pseudocode', micropython: 'MicroPython', javascript: 'JavaScript', asm: 'ASM'},
        codeArtworkMatches, captureCodeArtwork, conversionFailure, DOS_LANG: {}, resolveExampleBench: () => null
    });
    let finishLoad;
    const pendingLoad = new Promise(resolve => { finishLoad = resolve; });
    let finishRefresh;
    const pendingRefresh = new Promise(resolve => { finishRefresh = resolve; });
    const runtime = {bwDeviceId: 'microbit', bwDeviceCore: 'microbit', stc: {device: 'microbit'},
        targets: [], getTargetForStage: () => null};
    const vm = {runtime, extensionManager: {refreshBlocks (options) { assert.equal(options.throwOnError, true); if (refreshError) return Promise.reject(new Error(refreshError)); if (deferredRefresh) return pendingRefresh; }},
        async loadProject () { calls.push('load'); if (loadError) throw new Error(loadError); if (deferred) await pendingLoad; calls.push('loaded'); },
        toJSON: () => JSON.stringify({targets: []})};
    if (setStc) vm.setStc = stc => { calls.push('stc'); runtime.stc = stc; };
    class Creator {
        constructor () { this.warnings = []; this.project = {targets: []}; }
        parse (text) { if (parseError) throw new Error(parseError); const device = text.match(/^DEVICE\s+(\S+)/im)?.[1]; this.project.stc = device ? {device: device.toLowerCase()} : null; }
        async generateSB3 () { return {arrayBuffer: async () => new ArrayBuffer(0)}; }
        generatePython () { return ''; }
        generateJavaScript () { return ''; }
        generateC () { return ''; }
        generateBASIC () { return {ok: true, basic: ''}; }
        generateMicroPython () { return {ok: true, py: ''}; }
    }
    const component = Object.assign(new Editor(), {props: {vm}, state: {lang,
        buffers: {pseudocode: program, micropython: 'from microbit import *'},
        uploads: [], basicProfile: 'ms', basicLineNumbers: false,
        driverMode: 'shim', asyncMode: false, eventsMode: false, jsExecution: 'classic'},
        L: {stCompiling: 'compiling', stLoaded: 'loaded', stError: error => error},
        setState (patch, done) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); done?.(); },
        activeCode () { return this.state.buffers[this.state.lang]; }, canLiftAsm: () => false, loadCatalog () {},
        deriveBuffer: async source => ({code: source}),
        lib: async () => ({default: Creator})});
    let document = createCodeDocument({lang: 'pseudocode', code: program,
        generationOptions: component.codeGenerationOptions()});
    if (lang !== 'pseudocode' && component.state.buffers[lang]) {
        document = addCodeProjection(document, {lang, code: component.state.buffers[lang],
            sourceRevision: document.revision, options: component.genOpts(lang)});
    }
    Object.assign(component.state, component.codeDocumentState(selectCodeDocumentLanguage(document, lang)));
    Creator.RETARGET_POOLS = {calliopemini: {}};
    Creator.retargetPseudocode = (text, device) => ({ok: true, warnings: [],
        pseudocode: text.replace(/^DEVICE\s+\S+/im, `DEVICE ${device.toUpperCase()}`)});
    return {component, runtime, events, calls, finishLoad, finishRefresh};
};

test('Code stays busy until the native block definitions have finished refreshing', async () => {
    const {component, finishRefresh} = setup({deferredRefresh: true});
    let complete = false;
    const compiling = component.compile().then(() => { complete = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(complete, false);
    assert.equal(component.state.busy, true);
    assert.notEqual(component.state.status, 'loaded');
    finishRefresh();
    await compiling;
    assert.equal(component.state.busy, false);
    assert.equal(component.state.status, 'loaded');
});

test('DEVICE ARCADE is published only after the generated project loads', async () => {
    const {component, runtime, events, calls, finishLoad} = setup({deferred: true});
    const compiling = component.compile();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['load']);
    assert.equal(runtime.bwDeviceId, 'microbit');
    assert.deepEqual(events, []);
    finishLoad(); await compiling;
    assert.deepEqual(calls, ['load', 'loaded', 'stc']);
    assert.equal(runtime.bwDeviceId, 'arcade');
    assert.equal(runtime.bwDeviceCore, 'arcade');
    assert.deepEqual(events.map(event => [event.type, event.detail]),
        [['bw-settings-change', {key: 'bw-device-id', value: 'arcade'}]]);
    assert.equal(component.state.status, 'loaded');
});
for (const failure of [{parseError: 'invalid source'}, {loadError: 'bad archive'}]) {
    test(`failed application retains previous device: ${Object.values(failure)[0]}`, async () => {
        const {component, runtime, events} = setup(failure);
        await component.compile();
        assert.equal(runtime.bwDeviceId, 'microbit');
        assert.equal(runtime.bwDeviceCore, 'microbit');
        assert.deepEqual(events, []);
        assert.equal(component.state.conversionReport.preserved, false);
    });
}
test('a successfully applied ordinary Scratch project clears stale device hints', async () => {
    const {component, runtime, events} = setup({program: 'SPRITE Game:'});
    await component.compile();
    assert.equal(runtime.bwDeviceId, null); assert.equal(runtime.bwDeviceCore, null);
    assert.deepEqual(events.map(event => event.detail), [{key: 'bw-device-id', value: ''}]);
});
test('fallback VM metadata path publishes the actual parsed target too', async () => {
    const {component, runtime, events} = setup({program: 'DEVICE UNO', setStc: false});
    await component.compile();
    assert.equal(runtime.stc.device, 'uno'); assert.equal(runtime.bwDeviceId, 'uno');
    assert.equal(runtime.bwDeviceCore, 'avr'); assert.equal(events.length, 1);
});

for (const pins of ['', '\nPIN led = P0 OUTPUT']) {
    for (const lang of ['micropython', 'javascript', 'asm']) {
        test(`retarget from ${lang} applies canonical pseudocode (${pins ? 'pins' : 'no pins'})`, async () => {
            const {component, runtime, events, finishLoad} = setup({
                program: `DEVICE MICROBIT${pins}`, lang, deferred: true});
            const retargeting = component.setDevice('calliopemini');
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(runtime.bwDeviceId, 'microbit', 'old device remains while loading');
            assert.deepEqual(events, []);
            finishLoad();
            await retargeting;
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(runtime.stc.device, 'calliopemini');
            assert.equal(runtime.bwDeviceId, 'calliopemini');
            assert.equal(component.state.lang, lang, 'generated view stays selected');
            assert.equal(events.length, 1);
            assert.equal(component.state.conversionReport.direction, 'Pseudocode → Blocks');
        });
    }
}

test('failed native block refresh is reported and never announces loaded', async () => {
    const {component} = setup({refreshError: 'arrays schema registration failed'});
    await component.compile();
    assert.equal(component.state.busy, false);
    assert.notEqual(component.state.status, 'loaded');
    assert.match(component.state.status, /arrays schema registration failed/);
    // Each probe starts from a fresh VM; the fake archive has no artwork ZIP.
    const strict = setup({refreshError: 'arrays schema registration failed'}).component;
    await assert.rejects(strict.compile({strict: true}), /arrays schema registration failed/);
    assert.equal(strict.state.busy, false);
    assert.notEqual(strict.state.status, 'loaded');
});


test('file import cannot clear authored state during a pending device replacement', async () => {
    const {component, finishLoad} = setup({deferred: true});
    const original = {files: {'main.ts': 'retained source'}};
    component._makeCodeProject = original;
    component._makeCodeImportedCode = 'retained code';
    const opened = [];
    component.publishGameControls = () => opened.push('cleared controls');
    component.openArtefactFile = file => opened.push(file.name);
    component.openCodeFile = new Function('isImportableArtefact',
        `return function (e) ${scopeAfter(source, 'openCodeFile (e) {')}`)(() => true);
    const retargeting = component.setDevice('calliopemini');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(component.state.busy, true);
    const file = {name: 'game.mkcd'};
    const input = {files: [file], value: 'game.mkcd'};
    component.openCodeFile({target: input});
    assert.equal(input.value, '', 'The same file can be chosen again after completion');
    assert.deepEqual(opened, []);
    assert.equal(component._makeCodeProject, original);
    assert.equal(component._makeCodeImportedCode, 'retained code');
    finishLoad(); await retargeting;
    assert.equal(component.state.busy, false);
    component.openCodeFile({target: {files: [file], value: 'game.mkcd'}});
    assert.deepEqual(opened, ['cleared controls', 'game.mkcd']);
    assert.equal(component._makeCodeProject, null);
});
