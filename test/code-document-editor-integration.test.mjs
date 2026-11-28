// SPDX-License-Identifier: BSD-3-Clause
// Exercise the actual importer methods and durable document adapters together.
// Only compiler, VM and browser-storage edges are controlled here; rendered UI,
// worker execution and physical-device qualifications have separate controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {createCodeDocument, selectCodeDocumentLanguage,
    CODE_DOCUMENT_MAX_BYTES, OWNED_CONSOLE_EXECUTION} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const methods = [
    'activeCode () {', 'setActiveCode (text) {', 'async deriveBuffer (src, from, to) {',
    'switchTab (to) {', 'openEmptyTab (to) {', 'setGenOpt (patch) {', 'async setDevice (deviceId) {',
    'readAutosave () {', 'writeAutosave () {', 'async fromBlocks () {',
    'async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {'
].map(signature => codeEditorMethod(source, signature)).join('\n');
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const ownedJS = '// owned-console-v1: registered async tasks.\n' +
    'registerTask(async () => { console.log(42); });\n';
const defaultSource = 'DEVICE pico\n# keep this authored comment\nWHEN flag clicked:\n  say 42\n';

function fixture ({lang = 'pseudocode', code = defaultSource, target = 'pico', owned = false,
    generatedJavaScript = null, storage = new Map()} = {}) {
    const generators = [];
    const parsed = [];
    const queued = [];
    const localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => {
            if (editor.storageFailure) throw new Error('storage unavailable');
            storage.set(key, value);
        }
    };
    const Editor = codeDocumentEditorClass(source, methods, {
        localStorage, BW_AUTOSAVE_KEY: 'bw-code-autosave', DOS_LANG: {},
        TWO_WAY: new Set(['pseudocode', 'python', 'javascript']),
        DEVICE_BY_ID: {pico: {label: 'Pico', core: 'rp2040'}, i8086: {label: '8086', core: 'i8086'}},
        classifyConversionWarnings: warnings => ({changed: warnings, unsupported: []}),
        conversionFailure: error => ({message: error.message, issues: []}),
        captureCodeArtwork: () => null,
        dosLangBuffersFor: async () => ({})
    });
    const editor = new Editor();
    let project = {targets: [{isStage: true, name: 'Stage', comments: {}}]};
    const stage = {isStage: true, id: 'stage'};
    const vm = {runtime: {targets: [stage], getTargetForStage: () => stage},
        toJSON: () => JSON.stringify(project)};
    const apply = (update, done) => {
        const patch = typeof update === 'function' ? update(editor.state) : update;
        if (patch) editor.state = {...editor.state, ...patch};
        done?.();
    };
    Object.assign(editor, {
        props: {vm}, _unmounted: false,
        state: {lang, buffers: {}, busy: false, asmMode: 'source', uploads: [], importedPython: false,
            driverMode: 'simulator', asyncMode: false, eventsMode: true, basicProfile: 'bbc',
            basicLineNumbers: true, jsExecution: owned ? OWNED_CONSOLE_EXECUTION : 'classic',
            status: '', output: null, conversionReport: null, emptyTabOffer: null},
        L: {stReading: 'Reading blocks', stRegen: 'Regenerating', stCompiling: 'Compiling',
            stConverting: to => `Converting to ${to}`, stCantShow: (to, message) => `${to}: ${message}`,
            stError: message => `error: ${message}`, stCOneWay: 'one-way language'},
        leaveCp1 () {}, invalidateArcadeReport () {}, loadCatalog () {}, publishAppliedDevice () {},
        canLiftAsm: () => false,
        setState (update, done) {
            if (this.deferUpdates) queued.push({update, done});
            else apply(update, done);
        },
        flushUpdates () {
            this.deferUpdates = false;
            for (const {update, done} of queued.splice(0)) apply(update, done);
        }
    });
    let libraries = 0;
    class Builder {
        // The compiler's Stage-comment device reader: these projects carry none.
        static readStc () { return null; }
        constructor () { this.project = {targets: []}; this.warnings = []; }
        parse (text) { parsed.push(text); this.project.source = text; }
        decompile () { return editor.blockSource ?? defaultSource; }
        generatePython (_project, options) {
            generators.push({lang: 'python', options}); return '# generated Python\nprint(42)\n';
        }
        generateJavaScript (_project, options) {
            generators.push({lang: 'javascript', options});
            return generatedJavaScript ?? (options.execution === OWNED_CONSOLE_EXECUTION ? ownedJS : 'console.log(42);\n');
        }
        generateC () { return 'int main(void) { return 0; }'; }
        generateBASIC (_project, options) {
            generators.push({lang: 'basic', options}); return {ok: true, basic: '10 PRINT 42'};
        }
        generateMicroPython () { return {ok: true, py: 'print(42)\n'}; }
    }
    editor.lib = async () => { libraries++; return {default: Builder}; };
    const document = createCodeDocument({lang, code, target, runtime: editor.codeRuntimeFor(lang, target),
        generationOptions: editor.codeGenerationOptions()});
    Object.assign(editor.state, editor.codeDocumentState(document));
    return {editor, storage, generators, parsed, queued,
        get libraryCalls () { return libraries; },
        replaceProject () { project = {...project, changed: true}; }
    };
}

test('owned JavaScript is selected explicitly and remains a projection of its untouched author', async () => {
    const f = fixture({owned: true});
    const original = f.editor.state.codeDocument;
    f.editor.switchTab('javascript');
    await turn();
    assert.equal(f.editor.state.lang, 'javascript');
    assert.equal(f.editor.activeCode(), ownedJS);
    assert.deepEqual(f.generators.find(call => call.lang === 'javascript').options,
        {driver: 'shim', async: true, events: false, execution: OWNED_CONSOLE_EXECUTION});
    assert.equal(f.editor.state.codeDocument.lang, 'pseudocode');
    assert.equal(f.editor.state.codeDocument.code, defaultSource);
    assert.equal(f.editor.state.codeDocument.revision, original.revision);
    assert.equal(f.editor.state.codeDocument.projections.javascript.execution, OWNED_CONSOLE_EXECUTION);
    assert.equal(f.editor.currentDevice(), 'pico');
    assert.equal(f.editor.state.codeDocument.runtime, 'javascript');

    const calls = f.libraryCalls;
    f.editor.switchTab('pseudocode');
    assert.equal(f.libraryCalls, calls, 'Returning to the author does not reverse-read generated JavaScript');
    assert.equal(f.editor.activeCode(), defaultSource);
    assert.equal(f.editor.state.codeDocument.runtime, null);
    f.editor.switchTab('javascript');
    assert.equal(f.libraryCalls, calls, 'An unchanged generated view can be reused');
    f.editor.switchTab('python');
    await turn();
    assert.equal(f.editor.state.lang, 'python');
    assert.equal(f.parsed.at(-1), defaultSource, 'A second view is derived from its authored source');
    assert.equal(f.editor.state.codeDocument.runtime, 'pico-micropython');
});

test('changing the selected JavaScript mode regenerates its view with owned options only for JavaScript', async () => {
    const f = fixture();
    f.editor.switchTab('javascript'); await turn();
    const revision = f.editor.state.codeDocument.revision;
    f.editor.setGenOpt({jsExecution: OWNED_CONSOLE_EXECUTION}); await turn();
    assert.equal(f.editor.activeCode(), ownedJS);
    assert.equal(f.editor.state.codeDocument.code, defaultSource);
    assert.equal(f.editor.state.codeDocument.revision, revision);
    assert.deepEqual(f.generators.at(-1).options,
        {driver: 'shim', async: true, events: false, execution: OWNED_CONSOLE_EXECUTION});
    assert.deepEqual(f.editor.genOpts('python'), {driver: 'simulator', async: false, events: true});
    assert.equal(f.editor.state.codeDocument.generationOptions.execution, OWNED_CONSOLE_EXECUTION);
});

test('editing generated owned JavaScript keeps provenance and refuses both reverse routes before a reader runs', async () => {
    const f = fixture({owned: true});
    f.editor.switchTab('javascript'); await turn();
    const revision = f.editor.state.codeDocument.revision;
    const edit = 'registerTask(async () => { console.log("edited without the marker"); });';
    f.editor.setActiveCode(edit);
    assert.equal(f.editor.state.codeDocument.lang, 'javascript');
    assert.equal(f.editor.state.codeDocument.code, edit);
    assert.equal(f.editor.state.codeDocument.revision, revision + 1);
    assert.equal(f.editor.state.codeDocument.execution, OWNED_CONSOLE_EXECUTION);
    assert.equal(f.editor.currentDevice(), 'pico');
    assert.deepEqual(f.editor.state.codeDocument.projections, {});
    const document = f.editor.state.codeDocument;
    const calls = f.libraryCalls;
    const derived = await f.editor.deriveBuffer(edit, 'javascript', 'pseudocode');
    assert.match(derived.error, /owned|console|async/i);
    assert.equal(derived.diagnostics.preserved, false);
    await assert.rejects(f.editor.compile({strict: true}), /owned|console|async/i);
    assert.equal(f.libraryCalls, calls, 'Neither reverse path should invoke the supplier');
    assert.equal(f.editor.state.codeDocument, document);
    assert.equal(f.editor.activeCode(), edit);
    assert.equal(f.editor.state.conversionReport.preserved, false);
    assert.equal(f.editor.state.busy, false);
});

test('generator controls retain authored JavaScript and BASIC instead of regenerating them', async () => {
    for (const [lang, code, patch] of [
        ['javascript', '// learner comment\nconsole.log(1);', {jsExecution: OWNED_CONSOLE_EXECUTION}],
        ['basic', 'REM learner comment\n10 PRINT 1', {basicProfile: 'ms', basicLineNumbers: false}]
    ]) {
        const f = fixture({lang, code, target: null});
        const revision = f.editor.state.codeDocument.revision;
        f.editor.setGenOpt(patch); await turn();
        assert.equal(f.libraryCalls, 0);
        assert.equal(f.editor.activeCode(), code);
        assert.equal(f.editor.state.codeDocument.lang, lang);
        assert.equal(f.editor.state.codeDocument.revision, revision);
        assert.equal(f.editor.writeAutosave(), true);
        const saved = JSON.parse(f.storage.get('bw-code-autosave'));
        if (lang === 'basic') {
            assert.equal(saved.generationOptions.basicProfile, 'ms');
            assert.equal(saved.generationOptions.basicLineNumbers, false);
        } else assert.equal(saved.generationOptions.execution, OWNED_CONSOLE_EXECUTION);
    }
});

test('an older supplier cannot silently replace a requested owned JavaScript view with classic output', async () => {
    const f = fixture({owned: true, generatedJavaScript: 'console.log("old compiler");'});
    const document = f.editor.state.codeDocument;
    f.editor.switchTab('javascript'); await turn();
    assert.equal(f.editor.state.codeDocument, document);
    assert.equal(f.editor.state.lang, 'pseudocode');
    assert.equal(f.editor.activeCode(), defaultSource);
    assert.match(f.editor.state.status, /compiler revision does not support console programs/);
    assert.equal(f.editor.state.emptyTabOffer, 'javascript');
    assert.equal(f.editor.state.busy, false);
});

test('actual source edits and an undo revoke a pending derivation even when source text returns', async () => {
    const f = fixture({owned: true});
    const gate = deferred();
    const lib = f.editor.lib;
    f.editor.lib = async () => { await gate.promise; return lib(); };
    f.editor.switchTab('javascript');
    const revision = f.editor.state.codeDocument.revision;
    f.editor.setActiveCode('DEVICE pico\nSAY "temporary edit"');
    f.editor.setActiveCode(defaultSource);
    const document = f.editor.state.codeDocument;
    assert.equal(document.revision, revision + 2);
    gate.resolve(); await turn();
    assert.equal(f.editor.state.codeDocument, document);
    assert.equal(f.editor.state.lang, 'pseudocode');
    assert.deepEqual(document.projections, {});
    assert.equal(f.editor.activeCode(), defaultSource);
    assert.equal(f.editor.state.busy, false);
});

test('authored Python keeps explicit target and runtime through editing, saving and reopening', async () => {
    const f = fixture({lang: 'python', code: '# authored Python\nprint(1)\n', target: 'pico'});
    f.editor.setActiveCode('# authored Python\nprint(2)\n');
    assert.equal(f.editor.state.buffers.pseudocode, '');
    assert.equal(f.editor.currentDevice(), 'pico');
    assert.equal(f.editor.state.codeDocument.runtime, 'pico-micropython');
    assert.equal(f.editor.writeAutosave(), true);
    const reopen = fixture({storage: f.storage});
    Object.assign(reopen.editor.state, reopen.editor.codeDocumentState(reopen.editor.readAutosave()));
    assert.equal(reopen.editor.activeCode(), '# authored Python\nprint(2)\n');
    assert.equal(reopen.editor.state.lang, 'python');
    assert.equal(reopen.editor.currentDevice(), 'pico');
    assert.equal(reopen.editor.state.codeDocument.runtime, 'pico-micropython');

    await reopen.editor.setDevice('');
    assert.equal(reopen.editor.currentDevice(), null);
    assert.equal(reopen.editor.state.codeDocument.runtime, 'skulpt');
    assert.equal(reopen.editor.activeCode(), '# authored Python\nprint(2)\n');
    assert.equal(reopen.editor.writeAutosave(), true);
    assert.equal(JSON.parse(f.storage.get('bw-code-autosave')).target, null);
    assert.equal(reopen.libraryCalls, 0, 'Changing an authored Python target does not roundtrip through Pseudocode');
});

test('retargeting Pseudocode while a generated tab is selected changes source and target atomically', async () => {
    const f = fixture();
    f.editor.switchTab('javascript'); await turn();
    const compiled = [];
    f.editor.compile = async options => { compiled.push(options); };
    await f.editor.setDevice('i8086');
    assert.equal(f.editor.state.codeDocument.lang, 'pseudocode');
    assert.equal(f.editor.state.codeDocument.target, 'i8086');
    assert.equal(f.editor.state.codeDocument.selectedLang, 'javascript');
    assert.equal(f.editor.state.buffers.javascript, '', 'A generated view for the old device is invalidated');
    assert.equal(f.editor.state.codeDocument.code, defaultSource.replace('DEVICE pico', 'DEVICE I8086'));
    assert.deepEqual(compiled, [{pseudocode: f.editor.state.codeDocument.code}]);
    await f.editor.setDevice('');
    assert.equal(f.editor.currentDevice(), null);
    assert.equal(f.editor.state.codeDocument.runtime, null);
    assert.equal(f.editor.state.codeDocument.code, defaultSource.replace('DEVICE pico\n', ''));
    assert.equal(f.editor.state.lang, 'pseudocode');
});

test('oversized live edits remain visible while autosave refuses without replacing the last good record', () => {
    const f = fixture();
    assert.equal(f.editor.writeAutosave(), true);
    const saved = f.storage.get('bw-code-autosave');
    const large = '# '.repeat(CODE_DOCUMENT_MAX_BYTES);
    assert.doesNotThrow(() => f.editor.setActiveCode(large));
    assert.equal(f.editor.activeCode(), large);
    assert.equal(f.editor.state.codeDocument.code, large);
    assert.equal(f.editor.writeAutosave(), false);
    assert.equal(f.storage.get('bw-code-autosave'), saved);
    assert.match(f.editor._codeSaveError, /could not be saved/);
    assert.equal(f.editor.state.status, f.editor._codeSaveError);
    f.editor.setActiveCode('SAY "small enough"');
    assert.equal(f.editor.writeAutosave(), true);
    assert.equal(f.editor._codeSaveError, null);
    assert.equal(JSON.parse(f.storage.get('bw-code-autosave')).code, 'SAY "small enough"');
});

test('future autosave versions remain untouched until an explicit authored replacement', () => {
    const f = fixture();
    const future = JSON.stringify({version: 999, lang: 'python', code: 'future source'});
    f.storage.set('bw-code-autosave', future);
    const document = f.editor.state.codeDocument;
    assert.equal(f.editor.readAutosave(), null);
    assert.match(f.editor._codeRestoreError, /saved source is retained/);
    assert.equal(f.editor.writeAutosave(), false);
    assert.equal(f.storage.get('bw-code-autosave'), future);
    assert.equal(f.editor.state.codeDocument, document);
    f.editor.setActiveCode('SAY "explicit replacement"');
    assert.equal(f.editor.writeAutosave(), true);
    assert.equal(JSON.parse(f.storage.get('bw-code-autosave')).code, 'SAY "explicit replacement"');
});

test('From blocks records canonical source, owned JavaScript provenance and retained diagnostics', async () => {
    const f = fixture({lang: 'javascript', code: 'console.log("old author");', owned: true});
    f.editor.blockSource = defaultSource + '  # unsupported: custom extension command\n';
    await f.editor.fromBlocks();
    assert.equal(f.editor.state.codeDocument.lang, 'pseudocode');
    assert.equal(f.editor.state.codeDocument.code, f.editor.blockSource);
    assert.equal(f.editor.state.codeDocument.selectedLang, 'javascript');
    assert.equal(f.editor.activeCode(), ownedJS);
    assert.equal(f.editor.state.codeDocument.target, 'pico');
    assert.equal(f.editor.state.codeDocument.runtime, 'javascript');
    assert.equal(f.editor.state.codeDocument.projections.javascript.execution, OWNED_CONSOLE_EXECUTION);
    assert.deepEqual(f.editor.state.conversionReport.unsupported, ['custom extension command']);
    assert.deepEqual(f.editor.state.codeDocument.projections.javascript.diagnostics.unsupported,
        ['custom extension command']);
    assert.equal(f.editor.state.busy, false);
});

test('From blocks with another selected language leaves owned JavaScript lazy', async () => {
    const f = fixture({owned: true, generatedJavaScript: 'old compiler cannot make owned JavaScript'});
    await f.editor.fromBlocks();
    assert.equal(f.editor.state.conversionReport.preserved, true);
    assert.equal(f.editor.state.buffers.javascript, '');
    assert.equal(f.generators.some(call => call.lang === 'javascript'), false);
    assert.equal(f.editor.state.codeDocument.code, defaultSource);
});

test('From blocks refuses unsupported owned JavaScript generation and keeps the existing document', async () => {
    const f = fixture({lang: 'javascript', code: 'console.log("retained");', owned: true,
        generatedJavaScript: 'console.log("unsupported old compiler");'});
    const document = f.editor.state.codeDocument;
    const buffers = f.editor.state.buffers;
    await f.editor.fromBlocks();
    assert.equal(f.editor.state.codeDocument, document);
    assert.equal(f.editor.state.buffers, buffers);
    assert.match(f.editor.state.status, /compiler revision does not support console programs/);
    assert.equal(f.editor.state.conversionReport.preserved, false);
    assert.equal(f.editor.state.busy, false);
});

for (const boundary of ['edit', 'edit-and-undo', 'vm', 'project', 'language', 'unmount']) {
    test(`From blocks cannot replace a newer ${boundary} while its compiler loads`, async () => {
        const f = fixture();
        const gate = deferred();
        const lib = f.editor.lib;
        f.editor.lib = async () => { await gate.promise; return lib(); };
        const pending = f.editor.fromBlocks();
        if (boundary === 'edit' || boundary === 'edit-and-undo') {
            f.editor.setActiveCode('SAY "newer source"');
            if (boundary === 'edit-and-undo') f.editor.setActiveCode(defaultSource);
        } else if (boundary === 'vm') f.editor.props = {vm: {...f.editor.props.vm}};
        else if (boundary === 'project') f.replaceProject();
        else if (boundary === 'language') {
            Object.assign(f.editor.state, f.editor.codeDocumentState(selectCodeDocumentLanguage(
                f.editor.state.codeDocument, 'asm')));
        } else f.editor._unmounted = true;
        f.editor.state.status = 'newer operation owns feedback';
        const document = f.editor.state.codeDocument;
        const buffers = f.editor.state.buffers;
        gate.resolve(); await pending;
        assert.equal(f.editor.state.codeDocument, document);
        assert.equal(f.editor.state.buffers, buffers);
        assert.equal(f.editor.state.status, 'newer operation owns feedback');
        assert.equal(f.editor.state.conversionReport, null);
    });
}

test('queued From blocks publication rechecks the latest editor when React applies its updater', async () => {
    const f = fixture();
    const gate = deferred();
    const lib = f.editor.lib;
    f.editor.lib = async () => { await gate.promise; return lib(); };
    const pending = f.editor.fromBlocks();
    f.editor.deferUpdates = true;
    gate.resolve(); await pending;
    assert.ok(f.queued.length >= 2, 'Publication and busy cleanup are deferred');
    f.editor.deferUpdates = false;
    f.editor.setActiveCode('SAY "typed after the result was queued"');
    f.editor.state.status = 'newer editor owns feedback';
    const document = f.editor.state.codeDocument;
    const buffers = f.editor.state.buffers;
    f.editor.flushUpdates();
    assert.equal(f.editor.state.codeDocument, document);
    assert.equal(f.editor.state.buffers, buffers);
    assert.equal(f.editor.state.status, 'newer editor owns feedback');
    assert.equal(f.editor.state.busy, false);
});

test('machine-generated assembly registers a view without replacing an authored document', () => {
    const f = fixture();
    const document = f.editor.state.codeDocument;
    const buffers = f.editor.state.buffers;
    Object.assign(f.editor.state, f.editor.codeProjectionState(f.editor.state, document, buffers, 'asm', 'MOV AX, 42'));
    assert.equal(f.editor.state.codeDocument.code, defaultSource);
    assert.equal(f.editor.state.codeDocument.lang, 'pseudocode');
    assert.equal(f.editor.state.codeDocument.projections.asm.code, 'MOV AX, 42');
    assert.equal(f.editor.state.lang, 'pseudocode');
    f.editor.setActiveCode('SAY "newer author"');
    assert.deepEqual(f.editor.codeProjectionState(f.editor.state, document, buffers, 'asm', 'MOV AX, 1'), {});
    const own = fixture({lang: 'asm', code: '; authored assembly\nMOV AX, 7'});
    assert.deepEqual(own.editor.codeProjectionState(own.editor.state, own.editor.state.codeDocument,
        own.editor.state.buffers, 'asm', 'generated replacement'), {});
});
