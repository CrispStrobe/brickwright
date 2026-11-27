// SPDX-License-Identifier: BSD-3-Clause
// Authored scheduling controls around the actual importer methods. Builder/VM
// edges are fakes; these are not rendered UI, compiler or guest qualifications.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
import {createCodeDocument, addCodeProjection} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const importer = new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url);
const original = readFileSync(importer, 'utf8');
const extract = (start, end) => {
    const a = original.indexOf(start);
    const b = original.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `Actual method boundaries: ${start}`);
    return original.slice(a, b);
};
const methods = extract('    async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {',
    '    // Read the running project into all languages at once.') +
    extract('    async loadAsmExample (id) {', '    openArtefactFile (file) {') +
    extract('    publishAppliedDevice (stc) {',
        '    // Real hardware, two minutes: generate MicroPython and push it to a');
const Editor = codeDocumentEditorClass(original, methods, {
    TWO_WAY: new Set(['pseudocode']), DOS_LANG: {}, codeArtworkMatches: () => false, captureCodeArtwork: () => null,
    classifyConversionWarnings: () => ({changed: [], unsupported: []}),
    conversionFailure: error => ({message: error.message, issues: []}), pickLocale: () => 'en',
    confirmAsync: async () => true,
    DEVICE_BY_ID: {pico: {core: 'rp2040', label: 'Pico'}, i8086: {core: 'i8086', label: '8086'}}
});
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const example = {id: 'pins', source: '; An LED and a Switch on the 8255\nMOV AX, 1', label: 'Pins'};

function fixture (hold = null, failure = null) {
    const entered = deferred();
    const release = deferred();
    const calls = [];
    const selectionCalls = [];
    const commentCalls = [];
    const makeStage = id => ({isStage: true, id, createComment (...args) { commentCalls.push({id, args}); }});
    let stage = makeStage('initial');
    let loads = 0;
    let refreshes = 0;
    class Builder {
        static RETARGET_POOLS = {pico: {}};
        static retargetPseudocode (source) { return {ok: true, pseudocode: source, warnings: []}; }
        static STC_COMMENT_ID = 'test-stc';
        static writeStcComment (project) {
            project.targets[0].comments = {'test-stc': {text: JSON.stringify(project.stc)}};
        }
        constructor () {
            this.project = {targets: [], stc: hold === 'load-commit' ? {device: 'pico', pins: []} :
                hold === 'comment' || editor.withStc ? {device: 'i8086', pins: []} : null};
            this.warnings = [];
        }
        parse () { if (failure === 'parse') throw new Error('current parse failed'); }
        async generateSB3 () {
            await editor.onGenerateSB3?.();
            return {arrayBuffer: async () => new ArrayBuffer(0)};
        }
        generatePython () { editor.onGenerate?.(); return 'generated Python'; }
        generateJavaScript () { return 'generated JS'; }
        generateC () { return 'generated C'; }
        generateBASIC () { return {ok: true, basic: 'generated BASIC'}; }
        generateMicroPython () { return {ok: true, py: 'generated MicroPython'}; }
    }
    const editor = new Editor();
    const vm = {
        runtime: {getTargetForStage: () => stage, targets: [stage]},
        async loadProject () {
            calls.push('load');
            const load = ++loads;
            if (hold === 'load-commit' && load === 1) { entered.resolve(); await release.promise; }
            stage = makeStage(`loaded-${load}`);
            vm.runtime.targets = editor.withActor ?
                [stage, {isStage: false, id: 'actor', blocks: {getScripts: () => ['body']}}] : [stage];
            if (hold === 'load' && loads === 1) { entered.resolve(); await release.promise; }
            if (failure === 'load') throw new Error('current load failed');
        },
        extensionManager: {async refreshBlocks () {
            calls.push('refresh');
            if (hold === 'refresh' && ++refreshes === 1) { entered.resolve(); await release.promise; }
        }},
        toJSON () { return JSON.stringify({targets: [{isStage: true, comments: {}}]}); },
        setEditingTarget (id) { selectionCalls.push(id); }
    };
    Object.assign(editor, {
        state: {lang: 'pseudocode', buffers: {pseudocode: 'DEVICE i8086', asm: 'old ASM'},
            uploads: [], basicProfile: 'i8086', basicLineNumbers: false, importedPython: true,
            driverMode: 'shim', asyncMode: false, eventsMode: false, jsExecution: 'classic'},
        props: {locale: 'en', vm},
        L: {stCompiling: 'compiling', stLoaded: 'Blocks loaded.', stCOneWay: 'one-way language',
            stError: message => `error: ${message}`, stWarn: message => message,
            asmExampleLoaded: () => 'example loaded'},
        setState (update, done) {
            const patch = typeof update === 'function' ? update(this.state) : update;
            if (patch) Object.assign(this.state, patch);
            done?.();
        },
        activeCode () { return this.state.buffers[this.state.lang] || ''; },
        canLiftAsm: () => false, loadCatalog () {}, _asmExamples: () => [example]
    });
    let libraries = 0;
    editor.lib = async () => {
        if (hold === 'comment' && ++libraries === 2) { entered.resolve(); await release.promise; }
        return {default: Builder};
    };
    return {editor, entered, release, calls, selectionCalls, commentCalls,
        get libraryCalls () { return libraries; }, replaceStage () {
        stage = makeStage('external');
        vm.runtime.targets = [stage];
    }};
}

test('ordinary conversion still regenerates buffers, retains authored ASM and finishes busy', async () => {
    const f = fixture(); await f.editor.compile();
    assert.deepEqual(f.calls, ['load', 'refresh']);
    assert.equal(f.editor.state.buffers.python, 'generated Python');
    assert.equal(f.editor.state.buffers.asm, 'old ASM');
    assert.equal(f.editor.state.importedPython, false);
    assert.equal(f.editor.state.status, 'Blocks loaded.');
    assert.equal(f.editor.state.busy, false);
});

test('explicit device-retarget source still compiles while ASM is selected', async () => {
    const f = fixture(); f.editor.state.lang = 'asm';
    await f.editor.compile({pseudocode: 'DEVICE i8086'});
    assert.deepEqual(f.calls, ['load', 'refresh']);
    assert.equal(f.editor.state.lang, 'asm');
    assert.equal(f.editor.state.buffers.asm, 'old ASM');
    assert.equal(f.editor.state.status, 'Blocks loaded.');
    assert.equal(f.editor.state.codeDocument.lang, 'pseudocode');
    assert.equal(f.editor.state.codeDocument.code, 'DEVICE i8086');
    assert.equal(f.editor.state.codeDocument.target, 'i8086');
    assert.equal(f.editor.state.codeDocument.selectedLang, 'asm');
});

test('To blocks from a generated view preserves its authored source, revision and target', async () => {
    const f = fixture();
    const authored = '# hand-maintained Python comment\nprint(42)\n';
    let document = createCodeDocument({lang: 'python', code: authored, target: 'pico', runtime: 'pico-micropython',
        generationOptions: f.editor.codeGenerationOptions()});
    document = addCodeProjection(document, {lang: 'pseudocode', code: 'DEVICE pico\nSAY 42',
        sourceRevision: document.revision, options: f.editor.genOpts('pseudocode'), runtime: null});
    Object.assign(f.editor.state, f.editor.codeDocumentState(document));

    await f.editor.compile();

    assert.deepEqual(f.calls, ['load', 'refresh']);
    assert.equal(f.editor.state.codeDocument.lang, 'python');
    assert.equal(f.editor.state.codeDocument.code, authored);
    assert.equal(f.editor.state.buffers.python, authored, 'Generated Python must not overwrite the author');
    assert.equal(f.editor.state.codeDocument.revision, document.revision);
    assert.equal(f.editor.state.codeDocument.target, 'pico');
    assert.equal(f.editor.state.codeDocument.selectedLang, 'pseudocode');
    assert.equal(f.editor.state.codeDocument.projections.pseudocode.sourceRevision, document.revision);
    assert.equal(f.editor.state.conversionReport.preserved, true);
});

for (const boundary of ['load', 'refresh']) {
    test(`ASM example chosen during ${boundary} survives old conversion completion`, async () => {
        const f = fixture(boundary); const pending = f.editor.compile(); await f.entered.promise;
        f.editor.state.lang = 'asm'; await f.editor.loadAsmExample('pins');
        const buffers = f.editor.state.buffers;
        f.release.resolve(); await pending;
        assert.equal(f.editor.state.buffers, buffers);
        assert.equal(f.editor.state.buffers.asm, example.source);
        assert.equal(f.editor.state.status, 'example loaded');
        assert.equal(f.editor.state.importedPython, true);
        assert.equal(f.editor.state.busy, false);
    });
}

test('an edit and revert still invalidates the captured buffer ownership', async () => {
    const f = fixture('load'); const pending = f.editor.compile(); await f.entered.promise;
    const initial = f.editor.state.buffers;
    f.editor.state.buffers = {...initial, asm: 'new authored ASM'};
    f.editor.state.buffers = {...initial};
    f.editor.state.status = 'new edit owns feedback';
    const current = f.editor.state.buffers;
    f.release.resolve(); await pending;
    assert.equal(f.editor.state.buffers, current);
    assert.equal(f.editor.state.status, 'new edit owns feedback');
});

test('a later language selection retains its editor and feedback', async () => {
    const f = fixture('load'); const pending = f.editor.compile(); await f.entered.promise;
    f.editor.state.lang = 'asm'; f.editor.state.status = 'ASM selected';
    const current = f.editor.state.buffers;
    f.release.resolve(); await pending;
    assert.equal(f.editor.state.buffers, current);
    assert.equal(f.editor.state.status, 'ASM selected');
});

test('an older completion cannot replace a newer completed conversion', async () => {
    const f = fixture('load'); const old = f.editor.compile(); await f.entered.promise;
    await f.editor.compile();
    const current = f.editor.state.buffers;
    f.editor.state.status = 'new conversion owns feedback';
    f.release.resolve(); await old;
    assert.equal(f.editor.state.buffers, current);
    assert.equal(f.editor.state.status, 'new conversion owns feedback');
    assert.equal(f.editor.state.busy, false);
    assert.deepEqual(f.calls, ['load', 'load', 'refresh'], 'Superseded load completion must not refresh the new project');
});

test('an older completion cannot clear a newer pending conversion busy state', async () => {
    const f = fixture('load'); const old = f.editor.compile(); await f.entered.promise;
    const entered = deferred(); const release = deferred();
    let refreshes = 0;
    f.editor.props.vm.extensionManager.refreshBlocks = async () => {
        if (++refreshes !== 1) return;
        entered.resolve(); await release.promise;
    };
    const current = f.editor.compile(); await entered.promise;
    f.release.resolve(); await old;
    const whilePending = f.editor.state.busy;
    release.resolve(); await current;
    assert.equal(whilePending, true);
    assert.equal(f.editor.state.busy, false);
});

for (const strict of [false, true]) {
    test(`current error remains visible and busy clears, strict=${strict}`, async () => {
        const f = fixture(null, 'parse');
        if (strict) await assert.rejects(f.editor.compile({strict}), /current parse failed/);
        else await f.editor.compile();
        assert.equal(f.editor.state.status, 'error: current parse failed');
        assert.equal(f.editor.state.busy, false);
        assert.deepEqual(f.calls, []);
    });
}

test('an old load error cannot overwrite a newer example', async () => {
    const f = fixture('load', 'load'); const old = f.editor.compile(); await f.entered.promise;
    f.editor.state.lang = 'asm'; await f.editor.loadAsmExample('pins');
    const current = f.editor.state.buffers;
    f.release.resolve(); await old;
    assert.equal(f.editor.state.buffers, current);
    assert.equal(f.editor.state.status, 'example loaded');
    assert.equal(f.editor.state.busy, false);
});

test('pre-load source/project admission still refuses a changed active source', async () => {
    const f = fixture(); const entered = deferred(); const release = deferred();
    const lib = f.editor.lib;
    f.editor.lib = async () => { entered.resolve(); await release.promise; return lib(); };
    const old = f.editor.compile(); await entered.promise;
    f.editor.state.buffers = {...f.editor.state.buffers, pseudocode: 'new source'};
    release.resolve(); await old;
    assert.deepEqual(f.calls, []);
    assert.equal(f.editor.state.buffers.pseudocode, 'new source');
    assert.equal(f.editor.state.busy, false);
});

test('publication rechecks editor ownership after a generator reenters the editor', async () => {
    const f = fixture(); let current;
    f.editor.onGenerate = () => {
        current = f.editor.state.buffers = {...f.editor.state.buffers, asm: 'new edit during generation'};
        f.editor.state.status = 'new edit owns feedback';
    };
    await f.editor.compile();
    assert.equal(f.editor.state.buffers, current);
    assert.equal(f.editor.state.buffers.asm, 'new edit during generation');
    assert.equal(f.editor.state.status, 'new edit owns feedback');
    assert.equal(f.editor.state.importedPython, true);
});

for (const boundary of ['refresh', 'comment']) {
    test(`old ${boundary} completion cannot reselect a newer conversion's target`, async () => {
        const f = fixture(boundary); const old = f.editor.compile(); await f.entered.promise;
        await f.editor.compile();
        const selections = [...f.selectionCalls];
        const comments = [...f.commentCalls];
        f.release.resolve(); await old;
        assert.deepEqual(f.selectionCalls, selections);
        assert.deepEqual(f.commentCalls, comments, 'An older completion cannot write metadata onto the newer stage');
        assert.equal(f.editor.state.status, 'Blocks loaded.');
    });
}

test('a current unsupported conversion keeps its refusal after an older load completes', async () => {
    const f = fixture('load'); const old = f.editor.compile(); await f.entered.promise;
    f.editor.state.lang = 'c'; await f.editor.compile();
    const afterRefusalBusy = f.editor.state.busy;
    f.release.resolve(); await old;
    assert.equal(afterRefusalBusy, false);
    assert.equal(f.editor.state.status, 'one-way language');
    assert.equal(f.editor.state.busy, false);
});

test('queued busy cleanup rechecks ownership when React applies its updater', async () => {
    const f = fixture(); const queued = []; const setState = f.editor.setState;
    f.editor.setState = function (update, done) {
        const patch = typeof update === 'function' ? update(this.state) : update;
        if (patch && Object.keys(patch).length === 1 && patch.busy === false) {
            queued.push(update); done?.(); return;
        }
        setState.call(this, update, done);
    };
    await f.editor.compile(); assert.equal(queued.length, 1);
    const entered = deferred(); const release = deferred(); const lib = f.editor.lib;
    f.editor.lib = async () => { entered.resolve(); await release.promise; return lib(); };
    const current = f.editor.compile(); await entered.promise;
    setState.call(f.editor, queued.shift());
    const whilePending = f.editor.state.busy;
    release.resolve(); await current;
    assert.equal(whilePending, true);
    setState.call(f.editor, queued.shift());
    assert.equal(f.editor.state.busy, false);
});

test('superseded strict preparation cancels without invoking the old VM load', async () => {
    const f = fixture(); const entered = deferred(); const release = deferred(); const lib = f.editor.lib;
    // After a previous project/import completed, both resources are already
    // null. Their unchanged values cannot stand in for conversion ownership.
    f.editor._animationImport = null; f.editor._makeCodeRequest = null;
    let libraries = 0;
    f.editor.lib = async () => {
        if (++libraries === 1) { entered.resolve(); await release.promise; }
        return lib();
    };
    const old = f.editor.compile({strict: true}); await entered.promise;
    await f.editor.compile();
    release.resolve(); await assert.doesNotReject(old);
    assert.deepEqual(f.calls, ['load', 'refresh']);
});

test('overlapping To blocks and Pico retarget retain the applied project device metadata', async () => {
    const f = fixture('load-commit');
    f.editor.withActor = true;
    f.editor.state.buffers.pseudocode = 'DEVICE PICO\nPIN led = GP25 OUTPUT\n\nWHEN flag clicked:\n  turn on led\n';
    const preparing = deferred(); const continuePreparation = deferred(); let builds = 0;
    f.editor.onGenerateSB3 = async () => {
        if (++builds === 2) { preparing.resolve(); await continuePreparation.promise; }
    };
    const compile = f.editor.compile; const pending = [];
    f.editor.compile = function (...args) { const result = compile.apply(this, args); pending.push(result); return result; };
    const old = f.editor.compile(); await f.entered.promise;
    await f.editor.setDevice('pico'); await preparing.promise;
    const currentBuffers = f.editor.state.buffers;
    f.release.resolve(); await old;
    const appliedDevice = f.editor.props.vm.runtime.bwDeviceId;
    const busyWhilePreparing = f.editor.state.busy;
    continuePreparation.resolve(); await Promise.all(pending);
    assert.equal(appliedDevice, 'pico', 'The applied load still owns its project metadata');
    assert.equal(f.editor.props.vm.runtime.bwDeviceId, 'pico');
    assert.equal(f.editor.state.buffers, currentBuffers);
    assert.deepEqual(f.selectionCalls, [], 'Applied-project metadata does not authorize stale editor selection');
    assert.equal(busyWhilePreparing, true);
    assert.match(f.editor.state.status, /code or loaded project changed/, 'The newer preparation still enforces stage admission');
    assert.deepEqual(f.calls, ['load', 'refresh'], 'A rejected preparation must not invoke another VM load');
    assert.equal(f.editor.state.busy, false);
});

test('a loaded conversion does not clear newer animation or imported-project requests', async () => {
    const f = fixture('load'); const old = f.editor.compile(); await f.entered.promise;
    const animation = f.editor._animationImport = {newer: true};
    const imported = f.editor._makeCodeRequest = {newer: true};
    f.editor.state.buffers = {...f.editor.state.buffers, asm: 'new editor work'};
    f.release.resolve(); await old;
    assert.equal(f.editor._animationImport, animation);
    assert.equal(f.editor._makeCodeRequest, imported);
    assert.equal(f.editor.state.buffers.asm, 'new editor work');
});

test('an external stage change during refresh revokes applied-project completion ownership', async () => {
    const f = fixture('refresh'); const old = f.editor.compile(); await f.entered.promise;
    f.replaceStage(); f.editor.props.vm.runtime.bwDeviceId = 'external';
    const buffers = f.editor.state.buffers; f.editor.state.status = 'external project owns feedback';
    const selected = [...f.selectionCalls];
    f.release.resolve(); await old;
    assert.deepEqual(f.selectionCalls, selected);
    assert.equal(f.editor.props.vm.runtime.bwDeviceId, 'external');
    assert.equal(f.editor.state.buffers, buffers);
    assert.equal(f.editor.state.status, 'external project owns feedback');
});

test('current conversion still selects the loaded actor with scripts', async () => {
    const f = fixture(); f.editor.withActor = true;
    await f.editor.compile();
    assert.deepEqual(f.selectionCalls, ['actor', 'actor']);
    assert.equal(f.editor.state.status, 'Blocks loaded.');
});

test('a revoked loaded stage does not start another comment-library operation', async () => {
    const f = fixture('refresh'); f.editor.withStc = true;
    const old = f.editor.compile(); await f.entered.promise;
    f.replaceStage(); const libraries = f.libraryCalls; const comments = [...f.commentCalls];
    f.release.resolve(); await old;
    assert.equal(f.libraryCalls, libraries);
    assert.deepEqual(f.commentCalls, comments);
});

for (const field of ['_animationImport', '_makeCodeRequest']) {
    test(`a new ${field} intent survives even before editor text changes`, async () => {
        const f = fixture('load'); const old = f.editor.compile(); await f.entered.promise;
        const current = f.editor[field] = {newer: true}; const buffers = f.editor.state.buffers;
        f.editor.state.status = 'new import reading';
        f.release.resolve(); await old;
        assert.equal(f.editor[field], current);
        assert.equal(f.editor.state.buffers, buffers);
        assert.equal(f.editor.state.status, 'new import reading');
        assert.equal(f.editor.state.importedPython, true);
    });

    test(`a new ${field} intent during preparation prevents the older VM load`, async () => {
        const f = fixture(); const entered = deferred(); const release = deferred(); const lib = f.editor.lib;
        f.editor.lib = async () => { entered.resolve(); await release.promise; return lib(); };
        const old = f.editor.compile(); await entered.promise;
        const current = f.editor[field] = {newer: true};
        f.editor.state.status = 'new import reading';
        release.resolve(); await old;
        assert.deepEqual(f.calls, []);
        assert.equal(f.editor[field], current);
        assert.equal(f.editor.state.status, 'new import reading');
        assert.equal(f.editor.state.busy, false);
    });
}
