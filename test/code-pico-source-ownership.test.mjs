// SPDX-License-Identifier: BSD-3-Clause
// Run the actual importer methods and document model. Only firmware loading and
// the Pico startup boundary are controlled here; pico-sim-run-ownership.test.mjs
// exercises the production helper's cancellation/cleanup, and the browser gate
// retains the actual firmware/GPIO qualification.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {createCodeDocument, addCodeProjection} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const signatures = [
    'async run () {', 'async runPicoSim (pythonSource = null) {', 'stopPicoSim () {',
    'stopCodeRun () {', 'disposeCodeRun () {', 'bindCodeStopRuntime () {',
    'activeCode () {', 'setActiveCode (text) {', 'currentStc () {',
    'async setDevice (deviceId) {', 'componentDidUpdate (prevProps, prevState) {',
    'componentWillUnmount () {'
];
const actualMethods = signatures.map(signature => codeEditorMethod(source, signature)).join('\n');
let substitutedImports = 0;
const methods = actualMethods.replace(
    /\bimport\(\s*(?:\/\*[\s\S]*?\*\/\s*)?(['"])\.\.\/\.\.\/lib\/(pico-sim-run|pico-firmware)\.js\1\s*\)/g,
    (_match, _quote, name) => { substitutedImports++; return `loadPicoBoundary(${JSON.stringify(name)})`; }
);
assert.equal(substitutedImports, 2, 'control exactly the helper and firmware imports, leaving actual methods intact');

const authoredPython = '# Keep the exact visible source — including comments.\n' +
    'total = -3 // 2\nfor value in [1, 2]:\n    if value == 2:\n        break\nprint(total)\n';
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const runtime = () => ({stc: {device: 'pico', pins: [{name: 'led', pin: 'GP25'}]},
    on () {}, removeListener () {}});

function fixture ({lang = 'python', waitForFirmware = false} = {}) {
    const requests = [];
    const publications = [];
    const updates = [];
    const pendingTimers = new Map();
    const firmware = {image: new Uint8Array([1, 2, 3])};
    const firmwareGate = deferred();
    let firmwareLoads = 0;
    let timerId = 0;
    const abortError = () => Object.assign(new Error('controlled Pico startup aborted'), {name: 'AbortError'});
    // This boundary records the signal the real importer passes. A held startup
    // can publish only when explicitly released before that signal is aborted.
    const startPicoSimRun = args => {
        assert.ok(args.signal instanceof AbortSignal, 'the existing helper receives a real owner AbortSignal');
        const request = {args, board: {}, stops: 0, aborted: false, settled: false};
        requests.push(request);
        return new Promise((resolve, reject) => {
            const abort = () => {
                request.aborted = true;
                request.settled = true;
                reject(abortError());
            };
            args.signal.addEventListener('abort', abort, {once: true});
            request.release = () => {
                if (request.settled || args.signal.aborted) return;
                request.settled = true;
                args.signal.removeEventListener('abort', abort);
                args.vm.runtime.bwRunBoard = request.board;
                publications.push(request);
                args.onStatus('controlled Pico running');
                resolve({stop: () => {
                    request.stops++;
                    if (args.vm.runtime.bwRunBoard === request.board) delete args.vm.runtime.bwRunBoard;
                }});
            };
            if (args.signal.aborted) abort();
        });
    };
    const Editor = codeDocumentEditorClass(source, methods, {
        AbortController,
        window: {removeEventListener () {}, dispatchEvent () {}},
        DEVICE_BY_ID: {pico: {}, microbit: {}},
        notifyEditorMenuActions () {},
        setTimeout: callback => { const id = ++timerId; pendingTimers.set(id, callback); return id; },
        clearTimeout: id => pendingTimers.delete(id),
        loadPicoBoundary: async name => name === 'pico-sim-run' ? {startPicoSimRun} : {
            loadPicoFirmware: async () => {
                firmwareLoads++;
                return waitForFirmware ? firmwareGate.promise : firmware;
            }
        },
        createCodeExecutionSession () { throw new Error('Pico source must not fall through to the generic worker'); }
    });
    const editor = new Editor();
    Object.assign(editor, {
        _unmounted: false,
        _autosaveTimer: null,
        props: {vm: {runtime: runtime()}, isVisible: false},
        state: {busy: false, running: false, picoSimRunning: false, asmMode: 'source', revealed: true,
            actionsOpen: false, bundledExamplesStatus: 'idle', driverMode: 'shim', asyncMode: false,
            eventsMode: false, basicProfile: 'bbc', basicLineNumbers: true, jsExecution: 'classic',
            status: '', output: null},
        L: {picoSimStopped: 'Pico stopped', picoSimNoFirmware: 'No Pico firmware',
            deployPicoFail: message => `Pico failed: ${message}`},
        lib () { throw new Error('Running visible authored Python must not regenerate Pseudo'); },
        invalidateArcadeReport () {},
        loadCatalog () {},
        writeAutosave () { this.savedDocument = this.codeDocumentSnapshot(); return true; },
        setState (update, done) {
            assert.equal(this._unmounted, false, 'a disposed Pico owner cannot publish React state');
            const previous = this.state;
            const patch = typeof update === 'function' ? update(previous) : update;
            if (patch) {
                this.state = {...previous, ...patch};
                updates.push(patch);
                this.componentDidUpdate(this.props, previous);
            }
            done?.();
        }
    });
    const document = createCodeDocument({lang: 'pseudocode', code: 'DEVICE PICO\nWHEN flag clicked:\n  say 1\n',
        generationOptions: editor.codeGenerationOptions()});
    const projection = addCodeProjection(document, {lang, code: 'print(1)\n', sourceRevision: document.revision,
        runtime: 'pico-micropython', options: editor.genOpts(lang)});
    editor.state = {...editor.state, ...editor.codeDocumentState(projection)};
    editor.setActiveCode(authoredPython);
    return {editor, requests, publications, updates, firmware, firmwareGate,
        get firmwareLoads () { return firmwareLoads; }};
}

for (const lang of ['python', 'micropython']) {
    test(`Run forwards exact authored ${lang} after editing removed Pseudo, retaining the Pico target`, async () => {
        const f = fixture({lang});
        const {editor} = f;
        assert.equal(editor.state.buffers.pseudocode, '');
        assert.equal(editor.state.codeDocument.lang, lang);
        assert.equal(editor.state.codeTarget, 'pico');
        assert.equal(editor.state.codeRuntime, 'pico-micropython');
        const run = editor.run();
        await flush();
        assert.equal(f.requests.length, 1);
        const request = f.requests[0];
        assert.equal(request.args.py, authoredPython);
        assert.equal(request.args.vm, editor.props.vm);
        assert.equal(request.args.stc, editor.props.vm.runtime.stc);
        assert.equal(request.args.image, f.firmware.image);
        assert.equal(request.args.signal.aborted, false);
        request.release();
        await run;
        assert.equal(editor.state.picoSimRunning, true);
        assert.equal(editor.props.vm.runtime.bwRunBoard, request.board);
        assert.equal(editor.activeCode(), authoredPython);
        assert.equal(editor.state.codeDocument.target, 'pico');
        editor.stopCodeRun();
        assert.equal(request.args.signal.aborted, true);
        assert.equal(request.stops, 1);
        assert.equal(editor.props.vm.runtime.bwRunBoard, undefined);
    });
}

for (const action of ['Stop', 'unmount', 'target replacement', 'VM replacement']) {
    test(`${action} aborts the actual importer's pending Pico helper before it can publish`, async () => {
        const f = fixture();
        const {editor} = f;
        const oldVm = editor.props.vm;
        const run = editor.run();
        await flush();
        assert.equal(f.requests.length, 1);
        const request = f.requests[0];
        assert.equal(request.args.signal.aborted, false);
        assert.equal(f.publications.length, 0);
        if (action === 'Stop') editor.stopCodeRun();
        else if (action === 'unmount') editor.componentWillUnmount();
        else if (action === 'target replacement') await editor.setDevice('microbit');
        else {
            const props = editor.props;
            const state = editor.state;
            editor.props = {...props, vm: {runtime: runtime()}};
            editor.componentDidUpdate(props, state);
        }
        assert.equal(request.args.signal.aborted, true, 'owner revocation must reach the pending helper immediately');
        assert.equal(request.aborted, true);
        await run;
        const beforeLateCallbacks = editor.state;
        const updateCount = f.updates.length;
        request.release();
        request.args.onStatus('stale helper status');
        request.args.onError(new Error('stale helper error'));
        await flush();
        assert.equal(f.publications.length, 0);
        assert.equal(oldVm.runtime.bwRunBoard, undefined);
        assert.equal(editor.props.vm.runtime.bwRunBoard, undefined);
        assert.equal(editor.state, beforeLateCallbacks);
        assert.equal(f.updates.length, updateCount);
        assert.equal(editor.activeCode(), authoredPython);
        if (action === 'target replacement') {
            assert.equal(editor.state.codeDocument.target, 'microbit');
            assert.equal(editor.state.codeRuntime, 'skulpt');
        }
    });
}

test('Run replacement aborts the pending Pico source before starting the newer visible source', async () => {
    const f = fixture();
    const {editor} = f;
    const first = editor.run();
    await flush();
    editor.setActiveCode('# replacement source\nprint(42)\n');
    const second = editor.run();
    await flush();
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[0].args.py, authoredPython);
    assert.equal(f.requests[0].args.signal.aborted, true);
    assert.equal(f.requests[1].args.py, '# replacement source\nprint(42)\n');
    assert.equal(f.requests[1].args.signal.aborted, false);
    f.requests[0].release();
    f.requests[1].release();
    await Promise.all([first, second]);
    assert.deepEqual(f.publications, [f.requests[1]]);
    const status = editor.state.status;
    f.requests[0].args.onStatus('old status after replacement');
    assert.equal(editor.state.status, status);
    assert.equal(editor.props.vm.runtime.bwRunBoard, f.requests[1].board);
    editor.stopPicoSim();
});

test('Stop while loading Pico firmware aborts the owner and never starts the helper', async () => {
    const f = fixture({waitForFirmware: true});
    const run = f.editor.run();
    await flush();
    assert.equal(f.firmwareLoads, 1);
    const signal = f.editor._picoSimAbort.signal;
    f.editor.stopCodeRun();
    assert.equal(signal.aborted, true);
    f.firmwareGate.resolve(f.firmware);
    await run;
    assert.equal(f.requests.length, 0);
    assert.equal(f.publications.length, 0);
    assert.equal(f.editor.state.running, false);
    assert.equal(f.editor.activeCode(), authoredPython);
    assert.equal(f.editor.state.codeDocument.target, 'pico');
});
