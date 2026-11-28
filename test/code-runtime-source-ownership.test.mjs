// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Execute the actual editor methods with deferred derivation and React-state
// boundaries. These are host ownership controls, not compiler, rendered UI,
// interpreter, board or device qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopeAfter} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
import {createCodeDocument, addCodeProjection} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const executionSource = readFileSync(new URL(
    '../overlay/scratch-gui/src/lib/code-execution-session.js', import.meta.url), 'utf8');
const {createCodeExecutionSession} = await import(
    `data:text/javascript;base64,${Buffer.from(executionSource).toString('base64')}`);
const labels = {pseudocode: 'Pseudocode', python: 'Python', javascript: 'JavaScript', asm: 'ASM'};
const signatures = [
    'switchTab (to) {',
    'setGenOpt (patch) {',
    'setActiveCode (text) {',
    'activeCode () {'
];
const methods = signatures.map(signature => signature.slice(0, -1) + scopeAfter(source, signature)).join('\n');
const Editor = codeDocumentEditorClass(source, methods, {LANG_LABEL: labels});
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

function fixture ({generatedView = false} = {}) {
    const requests = [];
    const updates = [];
    const editor = new Editor();
    const apply = (update, done) => {
        const patch = typeof update === 'function' ? update(editor.state) : update;
        if (patch) editor.state = {...editor.state, ...patch};
        done?.();
    };
    Object.assign(editor, {
        _deriveRequest: 0,
        _unmounted: false,
        props: {vm: {id: 'original-project'}},
        state: {
            lang: 'python', busy: false, asmMode: 'source',
            buffers: {python: '# authored Python\nprint(1)\n', pseudocode: 'WHEN flag clicked:\n  say 1\n',
                javascript: '', asm: ''},
            asyncMode: false, driverMode: 'shim', eventsMode: false,
            status: 'existing status', output: 'existing output', emptyTabOffer: null,
            conversionReport: null
        },
        L: {
            stConverting: lang => `Converting to ${lang}`,
            stCantShow: (lang, error) => `Cannot show ${lang}: ${error}`,
            stRegen: 'Regenerating',
            stWarn: text => `Warning: ${text}`
        },
        leaveCp1 () {},
        detachCardiac () {},
        invalidateArcadeReport () {},
        deriveBuffer (code, from, to) {
            const gate = deferred();
            requests.push({code, from, to, gate});
            return gate.promise;
        },
        setState (update, done) {
            if (this.deferUpdates) updates.push({update, done});
            else apply(update, done);
        },
        flushUpdates () {
            this.deferUpdates = false;
            for (const {update, done} of updates.splice(0)) apply(update, done);
        }
    });
    if (generatedView) {
        const document = createCodeDocument({lang: 'pseudocode', code: editor.state.buffers.pseudocode,
            generationOptions: editor.codeGenerationOptions()});
        editor.state.codeDocument = addCodeProjection(document, {lang: 'python', code: editor.state.buffers.python,
            sourceRevision: document.revision, options: editor.genOpts('python')});
    }
    return {editor, requests, updates};
}

const begin = (editor, action) => {
    if (action === 'switch') editor.switchTab('javascript');
    else editor.setGenOpt({asyncMode: true});
};
const result = outcome => outcome === 'success' ? {code: 'old derived source'} : {error: 'old derivation failed'};
const visible = editor => ({
    lang: editor.state.lang,
    buffers: editor.state.buffers,
    status: editor.state.status,
    output: editor.state.output,
    emptyTabOffer: editor.state.emptyTabOffer,
    conversionReport: editor.state.conversionReport
});
const ownsVisibleState = (editor, expected) => {
    assert.equal(editor.state.buffers, expected.buffers, 'A stale request cannot replace the current buffer revision');
    assert.deepEqual(visible(editor), expected, 'A stale request cannot publish editor navigation, text or feedback');
};
const publishNewerFeedback = editor => {
    editor.state = {...editor.state, status: 'newer editor owns feedback', output: 'newer output',
        emptyTabOffer: null, conversionReport: {direction: 'newer operation'}};
};

test('current language conversion uses its source snapshot and retains the authored source', async () => {
    const {editor, requests} = fixture();
    const authored = editor.state.buffers.python;
    editor.switchTab('javascript');
    assert.equal(requests.length, 1);
    assert.deepEqual(requests.map(({code, from, to}) => ({code, from, to})),
        [{code: authored, from: 'python', to: 'javascript'}]);
    assert.equal(editor.state.busy, true);
    requests[0].gate.resolve({code: 'console.log(1);\n'});
    await turn();
    assert.equal(editor.state.lang, 'javascript');
    assert.equal(editor.state.buffers.javascript, 'console.log(1);\n');
    assert.equal(editor.state.buffers.python, authored);
    assert.equal(editor.state.busy, false);
    assert.equal(editor.state.output, null);
    assert.equal(editor.state.emptyTabOffer, null);
});

test('current failed language conversion retains source and offers the requested empty editor', async () => {
    const {editor, requests} = fixture();
    const buffers = editor.state.buffers;
    editor.switchTab('javascript');
    requests[0].gate.resolve({error: 'unsupported authored construct'});
    await turn();
    assert.equal(editor.state.lang, 'python');
    assert.equal(editor.state.buffers, buffers);
    assert.equal(editor.state.emptyTabOffer, 'javascript');
    assert.match(editor.state.status, /unsupported authored construct/);
    assert.equal(editor.state.busy, false);
});

test('current generator-option conversion updates only its admitted active representation', async () => {
    const {editor, requests} = fixture({generatedView: true});
    const pseudocode = editor.state.buffers.pseudocode;
    editor.setGenOpt({asyncMode: true});
    assert.equal(editor.state.asyncMode, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].code, pseudocode);
    assert.equal(requests[0].from, 'pseudocode');
    assert.equal(requests[0].to, 'python');
    requests[0].gate.resolve({code: 'generated async Python'});
    await turn();
    assert.equal(editor.state.lang, 'python');
    assert.equal(editor.state.buffers.python, 'generated async Python');
    assert.equal(editor.state.buffers.pseudocode, pseudocode);
    assert.equal(editor.state.busy, false);
    assert.equal(editor.state.output, null);
});

test('current generator-option failure remains visible without replacing source', async () => {
    const {editor, requests} = fixture({generatedView: true});
    const buffers = editor.state.buffers;
    editor.setGenOpt({eventsMode: true});
    requests[0].gate.resolve({error: 'cannot generate selected profile'});
    await turn();
    assert.equal(editor.state.eventsMode, true);
    assert.equal(editor.state.buffers, buffers);
    assert.match(editor.state.status, /cannot generate selected profile/);
    assert.equal(editor.state.busy, false);
});

for (const action of ['switch', 'options']) {
    for (const outcome of ['success', 'error']) {
        test(`${action}: late ${outcome} cannot replace a newer authored edit`, async () => {
            const {editor, requests} = fixture({generatedView: action === 'options'});
            begin(editor, action);
            editor.setActiveCode('# newer authored Python\nprint(42)\n');
            publishNewerFeedback(editor);
            const current = visible(editor);
            requests[0].gate.resolve(result(outcome));
            await turn();
            ownsVisibleState(editor, current);
        });

        test(`${action}: edit and revert does not restore an old derivation's ownership (${outcome})`, async () => {
            const {editor, requests} = fixture({generatedView: action === 'options'});
            const original = editor.state.buffers;
            begin(editor, action);
            editor.setActiveCode('temporary edit');
            // An undo can restore identical text while producing a new editor
            // revision. Equality of every string still must not revive the job.
            editor.state = {...editor.state, buffers: {...original}};
            assert.deepEqual(editor.state.buffers, original);
            assert.notEqual(editor.state.buffers, original);
            publishNewerFeedback(editor);
            const current = visible(editor);
            requests[0].gate.resolve(result(outcome));
            await turn();
            ownsVisibleState(editor, current);
        });

        test(`${action}: a replacement VM revokes late ${outcome} publication`, async () => {
            const {editor, requests} = fixture({generatedView: action === 'options'});
            begin(editor, action);
            editor.props = {vm: {id: 'replacement-project'}};
            publishNewerFeedback(editor);
            const current = visible(editor);
            requests[0].gate.resolve(result(outcome));
            await turn();
            ownsVisibleState(editor, current);
        });

        test(`${action}: a newer language selection survives late ${outcome}`, async () => {
            const {editor, requests} = fixture({generatedView: action === 'options'});
            begin(editor, action);
            editor.state = {...editor.state, lang: 'asm'};
            publishNewerFeedback(editor);
            const current = visible(editor);
            requests[0].gate.resolve(result(outcome));
            await turn();
            ownsVisibleState(editor, current);
        });

        test(`${action}: queued ${outcome} publication rechecks the editor when React applies it`, async () => {
            const {editor, requests, updates} = fixture({generatedView: action === 'options'});
            begin(editor, action);
            editor.deferUpdates = true;
            requests[0].gate.resolve(result(outcome));
            await turn();
            assert.ok(updates.length > 0, 'The actual completion reached its state-publication boundary');
            editor.state = {...editor.state, buffers: {...editor.state.buffers, python: 'edit after completion was queued'}};
            publishNewerFeedback(editor);
            const current = visible(editor);
            editor.flushUpdates();
            ownsVisibleState(editor, current);
        });
    }
}

for (const first of ['switch', 'options']) {
    for (const outcome of ['success', 'error']) {
        test(`${first}: old ${outcome} cannot clear a newer generator request's busy state`, async () => {
            const {editor, requests} = fixture({generatedView: true});
            begin(editor, first);
            // Both entry points share derivation ownership. The public option
            // method can be called while an earlier derivation is pending.
            editor.setGenOpt({eventsMode: true});
            assert.equal(requests.length, 2);
            publishNewerFeedback(editor);
            const current = visible(editor);
            requests[0].gate.resolve(result(outcome));
            await turn();
            ownsVisibleState(editor, current);
            assert.equal(editor.state.busy, true, 'The newer request is still pending');
            requests[1].gate.resolve({code: 'newer generated Python'});
            await turn();
            assert.equal(editor.state.lang, 'python');
            assert.equal(editor.state.buffers.python, 'newer generated Python');
            assert.equal(editor.state.busy, false);
        });

        test(`${first}: newer completed derivation keeps its result after old ${outcome}`, async () => {
            const {editor, requests} = fixture({generatedView: true});
            begin(editor, first);
            editor.setGenOpt({eventsMode: true});
            assert.equal(requests.length, 2);
            requests[1].gate.resolve({code: 'newer completed Python'});
            await turn();
            const current = visible(editor);
            requests[0].gate.resolve(result(outcome));
            await turn();
            ownsVisibleState(editor, current);
            assert.equal(editor.state.buffers.python, 'newer completed Python');
            assert.equal(editor.state.busy, false);
        });
    }
}

test('an already queued completion cannot clear a request started before React applies that completion', async () => {
    const {editor, requests, updates} = fixture({generatedView: true});
    editor.setGenOpt({asyncMode: true});
    editor.deferUpdates = true;
    requests[0].gate.resolve({code: 'old queued Python'});
    await turn();
    assert.ok(updates.length > 0);
    editor.deferUpdates = false;
    editor.setGenOpt({eventsMode: true});
    assert.equal(requests.length, 2);
    publishNewerFeedback(editor);
    const current = visible(editor);
    editor.flushUpdates();
    ownsVisibleState(editor, current);
    assert.equal(editor.state.busy, true);
    requests[1].gate.resolve({code: 'current Python'});
    await turn();
    assert.equal(editor.state.buffers.python, 'current Python');
    assert.equal(editor.state.busy, false);
});

// Integrate the actual component run methods with the actual session service.
// Only the worker transport and clock are fake here; Python/JS is not evaluated.
const runSignatures = [
    'async run () {', 'stopCodeRun () {', 'disposeCodeRun () {',
    'submitCodeInput (event, expectedInput = this.state.codeInput) {', 'bindCodeStopRuntime () {',
    'componentDidUpdate (prevProps, prevState) {', 'componentWillUnmount () {', 'activeCode () {'
];
const runMethods = runSignatures.map(signature => signature.slice(0, -1) + scopeAfter(source, signature)).join('\n');
const runClock = () => {
    let now = 0;
    let sequence = 0;
    const timers = new Map();
    return {
        now: () => now,
        setTimeout (callback, delay) {
            const id = ++sequence;
            timers.set(id, {callback, at: now + delay});
            return id;
        },
        clearTimeout: id => timers.delete(id),
        advance (delay) {
            const target = now + delay;
            for (;;) {
                const next = [...timers].filter(([, value]) => value.at <= target)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;
                timers.delete(next[0]);
                next[1].callback();
            }
            now = target;
        }
    };
};
const runtime = () => {
    const listeners = new Map();
    return {
        listeners,
        on: (name, callback) => listeners.set(name, callback),
        removeListener (name, callback) {
            if (listeners.get(name) === callback) listeners.delete(name);
        }
    };
};

function runFixture (context, {lang = 'javascript', code = 'console.log("clicked");', device = null} = {}) {
    const sessions = [];
    const updates = [];
    const clock = runClock();
    const pythonSource = deferred();
    const windowEvents = [];
    const startSession = options => {
        const entry = {options, workers: [], stops: 0, disposals: 0};
        const session = createCodeExecutionSession({...options, clock,
            createWorker (workerSource) {
                const worker = {
                    workerSource, sent: [], terminated: 0, released: 0,
                    postMessage (message) { this.sent.push(message); },
                    terminate () { this.terminated++; },
                    emit (message) { this.onmessage?.({data: {runId: session.id, ...message}}); }
                };
                entry.workers.push(worker);
                return {worker, release: () => { worker.released++; }};
            }
        });
        const stop = session.stop;
        const dispose = session.dispose;
        session.stop = (...args) => { entry.stops++; return stop(...args); };
        session.dispose = (...args) => { entry.disposals++; return dispose(...args); };
        entry.session = session;
        sessions.push(entry);
        return session;
    };
    const RunEditor = codeDocumentEditorClass(source, runMethods, {
        createCodeExecutionSession: startSession,
        JAVASCRIPT_WORKER_SOURCE: '/* JavaScript worker source */',
        createPythonWorkerSource: ({core, stdlib}) => `/* Python worker source: ${core}; ${stdlib} */`,
        notifyEditorMenuActions: () => {},
        window: {removeEventListener: (name, callback) => windowEvents.push({name, callback})}
    });
    const editor = new RunEditor();
    const apply = (update, done) => {
        const patch = typeof update === 'function' ? update(editor.state) : update;
        if (patch) editor.state = {...editor.state, ...patch};
        done?.();
    };
    Object.assign(editor, {
        _unmounted: false, _codeRunRequest: null, _codeSession: null, _codeStopRuntime: null,
        props: {vm: {runtime: runtime()}, isVisible: false},
        state: {
            lang, buffers: {[lang]: code}, asmMode: 'source', driverMode: 'shim',
            codeDocument: createCodeDocument({lang, code, target: device,
                runtime: editor.codeRuntimeFor(lang, device)}),
            busy: false, running: false, codeSessionRunning: false, codeInput: null,
            codeInputValue: '', codeRunLabel: '', output: null, status: '',
            revealed: true, actionsOpen: false, bundledExamplesStatus: 'ready'
        },
        L: {
            stLoadingPy: 'Loading Python', codeConsolePython: 'Python console', codeConsoleJs: 'JavaScript console',
            codeLegacySimulator: 'Legacy simulator', codeNoOutput: 'No output', codeTimeout: 'Timed out',
            codeStopped: 'Stopped', codeOutputLimit: 'Output limit', foreverLoop: 'Forever loop'
        },
        selectedDevice: device,
        currentDevice () { return this.selectedDevice; },
        skulptSource: () => pythonSource.promise,
        invalidateArcadeReport () {},
        _reveal () {},
        writeAutosave () {},
        setMaximizedChrome () {},
        picoRuns: 0,
        async runPicoSim () { this.picoRuns++; },
        legacySources: [],
        async runJsMain (text, output) { this.legacySources.push(text); output.push('legacy result'); },
        setState (update, done) {
            if (this.deferUpdates) updates.push({update, done});
            else apply(update, done);
        },
        flushUpdates () {
            this.deferUpdates = false;
            for (const {update, done} of updates.splice(0)) apply(update, done);
        }
    });
    editor._onStopCodeRun = () => editor.stopCodeRun();
    context.after(async () => {
        editor._unmounted = true;
        editor.disposeCodeRun();
        for (const entry of sessions) entry.session.dispose();
        await Promise.all(sessions.map(entry => entry.session.promise));
    });
    return {editor, sessions, updates, pythonSource, clock, windowEvents};
}

test('console executes the clicked Python snapshot after lazy loading despite later source and language edits', async context => {
    const clicked = '# keep exact source\nvalue = 7 // 2\nprint(value)\n';
    const f = runFixture(context, {lang: 'python', code: clicked});
    const pending = f.editor.run();
    await turn();
    assert.equal(f.sessions.length, 1);
    assert.equal(f.sessions[0].options.code, clicked);
    assert.equal(f.sessions[0].workers.length, 0, 'The Python source loader is still pending');
    f.editor.state = {...f.editor.state, lang: 'javascript', buffers: {javascript: 'newer authored JS'}};
    f.pythonSource.resolve({core: 'core payload', stdlib: 'stdlib payload'});
    await turn();
    const worker = f.sessions[0].workers[0];
    assert.equal(worker.sent[0].code, clicked);
    assert.match(worker.workerSource, /core payload; stdlib payload/);
    worker.emit({type: 'done'});
    await pending;
    assert.equal(f.editor.state.buffers.javascript, 'newer authored JS');
    assert.equal(f.editor.state.running, false);
});

test('Stop during Python source loading prevents late worker creation', async context => {
    const f = runFixture(context, {lang: 'python', code: 'print(1)'});
    const pending = f.editor.run();
    await turn();
    f.editor.stopCodeRun();
    await pending;
    assert.equal(f.sessions[0].stops, 1);
    assert.equal(f.editor.state.running, false);
    assert.equal(f.editor.state.codeSessionRunning, false);
    const stopped = {...f.editor.state};
    f.pythonSource.resolve({core: 'late core', stdlib: 'late stdlib'});
    await turn();
    assert.equal(f.sessions[0].workers.length, 0);
    assert.deepEqual(f.editor.state, stopped, 'The late loader must preserve the Stop feedback');
});

test('current output and ordinary input flow through the owned session', async context => {
    const f = runFixture(context);
    const pending = f.editor.run();
    await turn();
    const entry = f.sessions[0];
    const worker = entry.workers[0];
    worker.emit({type: 'out', text: 'before\n'});
    f.clock.advance(32);
    assert.equal(f.editor.state.output, 'before\n');
    worker.emit({type: 'input', requestId: 'name', prompt: 'Name?'});
    assert.equal(f.editor.state.codeInput.runId, entry.session.id);
    assert.equal(f.editor.state.codeInput.prompt, 'Name?');
    f.editor.state.codeInputValue = 'Ada';
    let prevented = false;
    f.editor.submitCodeInput({preventDefault () { prevented = true; }});
    assert.equal(prevented, true);
    assert.deepEqual(worker.sent.at(-1),
        {type: 'input-reply', runId: entry.session.id, requestId: 'name', value: 'Ada'});
    assert.equal(f.editor.state.codeInput, null);
    worker.emit({type: 'out', text: 'hello Ada\n'});
    worker.emit({type: 'done'});
    await pending;
    assert.equal(f.editor.state.output, 'before\nhello Ada\n');
    assert.equal(f.editor.state.running, false);
    assert.equal(worker.terminated, 1);
    assert.equal(worker.released, 1);
});

test('old output, input and result callbacks cannot replace a newer console run', async context => {
    const f = runFixture(context);
    const old = f.editor.run();
    await turn();
    const previous = f.sessions[0];
    // Resolve the old result, but start another run before its await continues.
    previous.workers[0].emit({type: 'out', text: 'old result'});
    previous.workers[0].emit({type: 'done'});
    f.editor.state.buffers = {javascript: 'new clicked source'};
    const current = f.editor.run();
    await turn();
    assert.equal(f.sessions.length, 2);
    const active = f.sessions[1];
    assert.equal(active.workers[0].sent[0].code, 'new clicked source');
    assert.equal(f.editor.state.running, true);
    assert.equal(f.editor.state.output, '');
    previous.options.onOutput('late old output');
    previous.options.onInput({runId: previous.session.id, requestId: 'old', prompt: 'Old question'});
    previous.options.onInput(null);
    assert.equal(f.editor.state.output, '');
    assert.equal(f.editor.state.codeInput, null);
    assert.equal(f.editor._codeSession, active.session);
    active.workers[0].emit({type: 'out', text: 'new result'});
    active.workers[0].emit({type: 'done'});
    await Promise.all([old, current]);
    assert.equal(f.editor.state.output, 'new result');
});

for (const publication of ['output', 'input', 'result']) {
    test(`queued ${publication} state cannot publish after another console run takes ownership`, async context => {
        const f = runFixture(context);
        const old = f.editor.run();
        await turn();
        const previous = f.sessions[0];
        f.editor.deferUpdates = true;
        if (publication === 'output') previous.options.onOutput('old queued output');
        else if (publication === 'input') {
            previous.options.onInput({runId: previous.session.id, requestId: 'old', prompt: 'Old queued question'});
        } else {
            previous.workers[0].emit({type: 'out', text: 'old queued result'});
            previous.workers[0].emit({type: 'done'});
            await turn();
        }
        assert.ok(f.updates.length > 0, 'The actual callback reached a queued state updater');
        f.editor.deferUpdates = false;
        const current = f.editor.run();
        await turn();
        const active = f.sessions[1];
        active.options.onOutput('current output');
        active.options.onInput({runId: active.session.id, requestId: 'new', prompt: 'Current question'});
        const expected = {...f.editor.state};
        f.editor.flushUpdates();
        assert.deepEqual(f.editor.state, expected);
        assert.equal(f.editor._codeSession, active.session);
        active.workers[0].emit({type: 'done'});
        await Promise.all([old, current]);
    });
}

test('input submission rejects another run, a replaced VM, and a disposed session', async context => {
    const f = runFixture(context);
    const pending = f.editor.run();
    await turn();
    const entry = f.sessions[0];
    const worker = entry.workers[0];
    worker.emit({type: 'input', requestId: 7, prompt: 'Value?'});
    const input = f.editor.state.codeInput;
    f.editor.state.codeInputValue = 'answer';
    f.editor.state.codeInput = {...input, runId: 'another run'};
    f.editor.submitCodeInput();
    assert.equal(worker.sent.length, 1);
    f.editor.state.codeInput = input;
    const vm = f.editor.props.vm;
    f.editor.props = {...f.editor.props, vm: {runtime: runtime()}};
    f.editor.submitCodeInput();
    assert.equal(worker.sent.length, 1);
    f.editor.props = {...f.editor.props, vm};
    f.editor.disposeCodeRun();
    f.editor.state.codeInput = input;
    f.editor.submitCodeInput();
    assert.equal(worker.sent.length, 1);
    assert.equal(worker.terminated, 1);
    await pending;
});

test('Stop while a question is open clears the prompt and rejects a late submitted answer', async context => {
    const f = runFixture(context);
    const pending = f.editor.run();
    await turn();
    const entry = f.sessions[0];
    const worker = entry.workers[0];
    worker.emit({type: 'input', requestId: 1, prompt: 'Value?'});
    f.editor.state.codeInputValue = 'late answer';
    f.editor.stopCodeRun();
    await pending;
    f.editor.submitCodeInput();
    assert.equal(worker.sent.length, 1);
    assert.equal(f.editor.state.codeInput, null);
    assert.equal(f.editor.state.codeInputValue, '');
    assert.equal(f.editor.state.running, false);
});

for (const laterPrompt of ['another run', 'a later question in the same run']) {
    test(`a form captured for an old input cannot answer ${laterPrompt}`, async context => {
        const f = runFixture(context);
        const initial = f.editor.run();
        await turn();
        const previous = f.sessions[0];
        previous.workers[0].emit({type: 'input', requestId: 1, prompt: 'Old question?'});
        const previousInput = f.editor.state.codeInput;
        let current = initial;
        let active = previous;
        if (laterPrompt === 'another run') {
            current = f.editor.run();
            await turn();
            active = f.sessions[1];
        } else {
            f.editor.state.codeInputValue = 'first answer';
            f.editor.submitCodeInput(undefined, previousInput);
        }
        active.workers[0].emit({type: 'input', requestId: 2, prompt: 'Current question?'});
        const currentInput = f.editor.state.codeInput;
        const sentBefore = active.workers[0].sent.length;
        f.editor.state.codeInputValue = 'current answer';
        let prevented = false;
        f.editor.submitCodeInput({preventDefault () { prevented = true; }}, previousInput);
        assert.equal(prevented, true);
        assert.equal(active.workers[0].sent.length, sentBefore);
        assert.equal(f.editor.state.codeInput, currentInput);
        f.editor.submitCodeInput(undefined, currentInput);
        assert.deepEqual(active.workers[0].sent.at(-1), {
            type: 'input-reply', runId: active.session.id, requestId: 2, value: 'current answer'
        });
        active.workers[0].emit({type: 'done'});
        await Promise.all([initial, current]);
    });
}

test('VM replacement disposes the old run and moves the project Stop listener', async context => {
    const f = runFixture(context);
    f.editor.bindCodeStopRuntime();
    const previousProps = f.editor.props;
    const oldRuntime = previousProps.vm.runtime;
    const pending = f.editor.run();
    await turn();
    const entry = f.sessions[0];
    const previousState = f.editor.state;
    const nextRuntime = runtime();
    f.editor.props = {...f.editor.props, vm: {runtime: nextRuntime}};
    f.editor.componentDidUpdate(previousProps, previousState);
    await pending;
    assert.equal(entry.disposals, 1);
    assert.equal(entry.workers[0].terminated, 1);
    assert.equal(oldRuntime.listeners.has('PROJECT_STOP_ALL'), false);
    assert.equal(nextRuntime.listeners.get('PROJECT_STOP_ALL'), f.editor._onStopCodeRun);
    const current = {...f.editor.state};
    entry.options.onOutput('old VM output');
    entry.options.onInput({runId: entry.session.id, requestId: 1, prompt: 'Old VM input'});
    assert.deepEqual(f.editor.state, current);
});

test('unmount disposes a pending runtime load and removes both Stop listeners', async context => {
    const f = runFixture(context, {lang: 'python', code: 'print(1)'});
    f.editor.bindCodeStopRuntime();
    const oldRuntime = f.editor.props.vm.runtime;
    const pending = f.editor.run();
    await turn();
    f.editor.componentWillUnmount();
    await pending;
    assert.equal(f.editor._unmounted, true);
    assert.equal(f.editor._codeSession, null);
    assert.equal(f.editor._codeRunRequest, null);
    assert.equal(f.sessions[0].disposals, 1);
    assert.equal(oldRuntime.listeners.has('PROJECT_STOP_ALL'), false);
    assert.ok(f.windowEvents.some(event => event.name === 'bw-stop-all' && event.callback === f.editor._onStopCodeRun));
    const current = {...f.editor.state};
    f.sessions[0].options.onOutput('unmounted output');
    f.sessions[0].options.onInput(null);
    f.pythonSource.resolve({core: 'late core', stdlib: 'late stdlib'});
    await turn();
    assert.equal(f.sessions[0].workers.length, 0);
    assert.deepEqual(f.editor.state, current);
});

test('project Stop reaches the owned console session', async context => {
    const f = runFixture(context);
    f.editor.bindCodeStopRuntime();
    const pending = f.editor.run();
    await turn();
    f.editor.props.vm.runtime.listeners.get('PROJECT_STOP_ALL')();
    await pending;
    assert.equal(f.sessions[0].stops, 1);
    assert.equal(f.editor.state.running, false);
});

test('the existing Pico dispatch is retained instead of silently starting a console worker', async context => {
    for (const lang of ['python', 'micropython']) {
        const f = runFixture(context, {lang, code: 'print("Pico")', device: 'pico'});
        await f.editor.run();
        assert.equal(f.editor.picoRuns, 1);
        assert.equal(f.sessions.length, 0);
    }
});

test('interactive simulator JavaScript retains its declared legacy board route', async context => {
    const code = 'console.log(prompt("Value?"));';
    const f = runFixture(context, {code});
    f.editor.state.driverMode = 'simulator';
    const pending = f.editor.run();
    assert.equal(f.editor.state.codeRunLabel, 'Legacy simulator');
    assert.equal(f.editor.state.codeSessionRunning, false, 'The legacy route must not advertise worker Stop');
    await pending;
    assert.deepEqual(f.editor.legacySources, [code]);
    assert.equal(f.sessions.length, 0);
    assert.equal(f.editor.state.output, 'legacy result');
    assert.equal(f.editor.state.codeSessionRunning, false);
    assert.equal(f.editor.state.codeRunLabel, '');
});
