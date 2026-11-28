// SPDX-License-Identifier: BSD-3-Clause
// Exercise the real editor/renderer methods with controlled asynchronous
// boundaries. These are lifecycle tests, not a rendered full-GUI claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
import {conversionFailure} from '../overlay/scratch-gui/src/lib/bw-conversion-error.js';
import {EventEmitter} from 'node:events';
import {VduDecoder} from 'bw-board/vdu-decoder.js';
import {validateCrispBasicPseudocode, crispBasicModeError} from '../overlay/scratch-gui/src/lib/sb3-creator-crispbasic-mode.js';
import {extractCrispBasicEditorMethods} from '../scripts/lib/crispbasic-editor-harness.mjs';

const editorSource = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
function between(source, start, end) {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `Actual method boundaries: ${start}`);
    return source.slice(a, b);
}
// The lane's editor methods (run, lifecycle, profile/draft and unmount
// dependencies) plus conversion, on the shared fixture's production document
// adapters and neutral machine hooks; only the VM and worker edges belong here.
const editorMethods = extractCrispBasicEditorMethods(editorSource) +
    between(editorSource, '    convertedSource ({pseudocode, warnings = []}) {', '    /**\n     * Is the RCX extension loaded?');
const Editor = codeDocumentEditorClass(editorSource, editorMethods,
    {DOS_LANG: {}, conversionFailure, validateCrispBasicPseudocode, crispBasicModeError});
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const done = {status: 'completed', exitCode: 0};
const turn = () => new Promise(resolve => setImmediate(resolve));

function fixture({loadGate = null, disposeGate = null, runFailure = null, disposeFailure = null} = {}) {
    const entered = deferred();
    const completion = deferred();
    const calls = [];
    const highlights = [];
    let emit;
    let runnerOptions;
    let created = 0;
    const runner = {
        async run(source, options) {
            calls.push(['run', source, options]); entered.resolve();
            if (runFailure) throw runFailure;
            return completion.promise;
        },
        cancel() { calls.push(['cancel']); completion.resolve({status: 'cancelled'}); return true; },
        async reset() { calls.push(['reset']); completion.resolve({status: 'cancelled'}); },
        async dispose() {
            calls.push(['dispose']);
            if (disposeGate) await disposeGate.promise;
            if (disposeFailure) throw disposeFailure;
        },
        writeInput(value) { calls.push(['input', value]); },
        endInput() { calls.push(['end-input']); }
    };
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang: 'basic', basicProfile: 'bbc', basicEngine: 'crispbasic', basicFilename: 'lesson.bas',
            basicOutputRunId: 0, basicInputMethod: null, basicInputValue: '', basicInputError: '',
            basicLineNumbers: false, basicPortableLibrary: false, basicWarnings: [],
            libraryTarget: null, authoredSources: {},
            buffers: {basic: 'PRINT "hello"\n'}, running: false, basicResetting: false},
        props: {vm: {runtime: {}}},
        L: {basicCrispLoading: 'loading', basicCrispRunning: 'running', basicCrispError: 'error',
            basicZ80Numbering: line => `Z80 needs valid increasing numbered statements at editor line ${line}; regenerate or use CrispBASIC`,
            basicCrispCompleted: code => `completed:${code}`, basicCrispStopped: 'stopped',
            basicCrispStopping: 'stopping', basicCrispTimeout: 'timeout', basicCrispOutputLimit: 'output-limit',
            basicCrispSimulationLimit: 'simulation-limit',
            basicCrispResetDone: 'reset', basicInputKeyError: 'one Latin-1 character'},
        setState(update) { const patch = typeof update === 'function' ? update(this.state) : update;
            if (patch) Object.assign(this.state, patch); },
        setHighlightedLine(line) { highlights.push(line); },
        async loadCrispBasicRunner() {
            if (loadGate) await loadGate.promise;
            return {createCrispBasicRunner(options) { created++; runnerOptions = options; emit = options.onEvent; return runner; }};
        }
    });
    return {editor, runner, calls, highlights, entered, completion,
        emit: event => emit(event), get created() { return created; }, get runnerOptions() { return runnerOptions; }};
}
const view = (output, inputMethod = null) => ({type: 'view', output, rawOutput: output, inputMethod, runId: 1});

test('BBC Run sends the exact edited source and filename to the interactive WASM adapter', async () => {
    const f = fixture();
    const source = '100 REM retained filename and physical lines\n\n200 PRINT "é"\n';
    f.editor.state.buffers.basic = source;
    const pending = f.editor.runBasic(); await f.entered.promise;
    assert.deepEqual(f.calls[0], ['run', source, {filename: 'lesson.bas', interactive: true, timeoutMs: 60000}]);
    assert.equal(f.editor.state.running, true);
    assert.equal(f.runnerOptions.circuit, undefined, 'Circuit access remains opt-in');
    f.emit({...view('é\n'), rawOutput: '\x16\x01é\r\n'});
    assert.equal(f.editor.state.output, 'é\n');
    assert.equal(f.editor.state.basicRawOutput, '\x16\x01é\r\n');
    f.completion.resolve(done); await pending;
    assert.equal(f.editor.state.status, 'completed:0');
    assert.equal(f.editor.state.running, false);
    assert.equal(f.editor.state.crispBasicActive, false);
    assert.equal(f.calls.at(-1)[0], 'dispose');
});

test('Connect Circuit passes the actual runtime only when explicitly enabled', async () => {
    const f = fixture(); f.editor.state.basicConnectCircuit = true;
    const pending = f.editor.runBasic(); await f.entered.promise;
    assert.deepEqual(f.runnerOptions.circuit, {runtime: f.editor.props.vm.runtime});
    f.completion.resolve(done); await pending;
});

test('Connect CAD motors requests the shared clock only with Circuit access enabled', async () => {
    for (const connectCircuit of [false, true]) {
        const f = fixture();
        f.editor.state.basicConnectCircuit = connectCircuit;
        f.editor.state.basicConnectCad = true;
        const pending = f.editor.runBasic();await f.entered.promise;
        assert.deepEqual(f.runnerOptions.circuit,
            connectCircuit ? {runtime: f.editor.props.vm.runtime, cad: true} : undefined);
        f.completion.resolve(done);await pending;
    }
});

test('a CAD connection edit during the cold import revokes the pending BASIC start', async () => {
    const previous = globalThis.window;globalThis.window = new EventTarget();
    try {
        const gate = deferred(), f = fixture({loadGate: gate});
        f.editor.state.basicConnectCircuit = true;f.editor.state.basicConnectCad = true;
        const pending = f.editor.runBasic();
        window.dispatchEvent(new CustomEvent('bw-cad-circuit-bindings-changed'));
        gate.resolve();await pending;
        assert.equal(f.created, 0);
        assert.equal(f.editor.state.running, false);
    } finally {if (previous === undefined) delete globalThis.window;else globalThis.window = previous;}
});

for (const name of ['PROJECT_STOP_ALL', 'PROJECT_START', 'PROJECT_LOADED']) {
    test(`${name} during the cold Circuit import revokes the old BASIC start`, async () => {
        const gate = deferred(), f = fixture({loadGate: gate});
        f.editor.state.basicConnectCircuit = true;
        f.editor.props.vm.runtime = new EventEmitter();
        const pending = f.editor.runBasic();
        f.editor.props.vm.runtime.emit(name);
        assert.equal(f.editor.state.status, 'stopped');
        gate.resolve(); await pending;
        assert.equal(f.created, 0);
        assert.equal(f.editor.props.vm.runtime.eventNames().length, 0);
    });
}

test('a successful external project replacement during Circuit loading cannot start on its replacement board', async () => {
    const previous = globalThis.window;
    globalThis.window = new EventTarget();
    try {
        const gate = deferred(), f = fixture({loadGate: gate});
        f.editor.state.basicConnectCircuit = true;
        const pending = f.editor.runBasic();
        window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded', {detail: {outcome: 'invalid'}}));
        assert.equal(f.editor.state.running, true, 'refused loads preserve the current project');
        window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded', {detail: {outcome: 'loaded'}}));
        gate.resolve(); await pending;
        assert.equal(f.created, 0);
        assert.equal(f.editor.state.status, 'stopped');
    } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test('the three 8086 BASIC routes retain their explicit selection', async () => {
    const routes = {i8086: 'runBasicOn8086', 'i8086-dos': 'runBasicOnRealDos', 'i8086-ubasic': 'runBasicOnDosInterp'};
    for (const [profile, method] of Object.entries(routes)) {
        const f = fixture(); f.editor.state.basicProfile = profile;
        const seen = [];
        f.editor[method] = source => seen.push(source);
        await f.editor.runBasic();
        assert.deepEqual(seen, [f.editor.state.buffers.basic]);
        assert.equal(f.created, 0);
    }
});

test('the selected machine resolves a stale BBC preference before Run and portable generation', async () => {
    const f = fixture();
    Object.assign(f.editor.state, {libraryTarget: 'i8086', basicProfile: 'bbc', basicPortableLibrary: true});
    const routed = [];
    f.editor.runBasicOn8086 = source => routed.push(source);
    assert.equal(f.editor.selectedBasicProfile().id, 'i8086');
    assert.deepEqual(f.editor.basicGenerationOptions(), {profile: 'ms', lineNumbers: false});
    await f.editor.runBasic();
    assert.deepEqual(routed, [f.editor.state.buffers.basic]);
    assert.equal(f.created, 0);

    f.editor.state.libraryTarget = 'arduino-uno';
    const compiled = [];
    f.editor.compileCrispBasic = () => compiled.push(f.editor.activeCode());
    assert.equal(f.editor.selectedBasicProfile().id, 'bbc-c99');
    assert.equal(f.editor.selectedBasicProfile().compiled, true);
    assert.deepEqual(f.editor.basicGenerationOptions(), {profile: 'bbc', lineNumbers: false});
    await f.editor.runBasic();
    assert.deepEqual(compiled, [f.editor.state.buffers.basic], 'Uno dispatches to its qualified C99 route');
    assert.equal(f.created, 0, 'Uno must not create the browser interpreter');
    assert.equal(routed.length, 1, 'Uno must not reuse the stale 8086 route');

    f.editor.state.libraryTarget = 'arduino-mega';
    assert.equal(f.editor.selectedBasicProfile(), undefined, 'an unsupported machine does not inherit BBC Run');
    await f.editor.runBasic();
    assert.equal(f.created, 0);
    assert.equal(routed.length, 1);
    assert.equal(compiled.length, 1, 'an unsupported machine must not reuse the Uno compiler route');
});

test('standalone Pico BASIC edits and runs its own draft while retaining the BBC source', async () => {
    const f = fixture();
    const original = f.editor.state.buffers.basic;
    Object.assign(f.editor.state, {libraryTarget: 'pico', basicProfile: 'pico-piccolo'});
    f.editor.state.buffers['pico-piccolo'] = 'print "old Piccolo"\n';
    f.editor.setActiveCode('print "new Piccolo"\n');
    assert.equal(f.editor.activeCode(), 'print "new Piccolo"\n');
    assert.equal(f.editor.state.buffers.basic, original);
    const routed = [];
    f.editor.runPicoBasic = (source, profile) => routed.push([source, profile.id, profile.media]);
    await f.editor.runBasic();
    assert.deepEqual(routed, [['print "new Piccolo"\n', 'pico-piccolo', 'piccolobasic-rp2040']]);
    assert.equal(f.created, 0);
    Object.assign(f.editor.state, {libraryTarget: null, basicProfile: 'bbc'});
    assert.equal(f.editor.activeCode(), original);
});

test('editing BASIC preserves standalone and machine-hidden authored drafts', () => {
    const f = fixture();
    f.editor.state.libraryTarget = 'pico';
    Object.assign(f.editor.state.buffers, {pseudocode: 'DEVICE pico\n', javascript: 'const retained = 1;',
        asm: 'retained assembly', nqc: 'retained NQC', 'pico-stefan': '10 PRINT "retained Stefan"'});
    f.editor.state.authoredSources = {javascript: 'const retained = 1;'};
    f.editor.setActiveCode('PRINT "new BBC"\n');
    assert.equal(f.editor.state.buffers.basic, 'PRINT "new BBC"\n');
    assert.equal(f.editor.state.buffers.javascript, 'const retained = 1;');
    assert.equal(f.editor.state.authoredSources.javascript, 'const retained = 1;');
    assert.equal(f.editor.state.buffers.asm, 'retained assembly');
    assert.equal(f.editor.state.buffers.nqc, 'retained NQC');
    assert.equal(f.editor.state.buffers['pico-stefan'], '10 PRINT "retained Stefan"');
});

test('Z80 refuses unnumbered, mixed or malformed numbering before loading its ROM', async () => {
    const originalFetch = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = async () => { fetched++; throw new Error('ROM fetch must not occur'); };
    try {
        for (const [source, line] of [
            ['PRINT "unnumbered"\n', 1],
            ['10 PRINT "mixed"\n\nEND\n', 3],
            ['-10 PRINT "signed"\n', 1],
            ['+10 PRINT "signed"\n', 1],
            ['1.5 PRINT "fraction"\n', 1],
            ['1e3 PRINT "exponent"\n', 1],
            ['10 PRINT "first"\n10 END\n', 2],
            ['20 PRINT "first"\n10 END\n', 2],
            ['9007199254740992 PRINT "unsafe integer"\n', 1]
        ]) {
            const f = fixture();
            f.editor.state.basicEngine = 'z80';
            f.editor.state.basicLineNumbers = true; // The actual buffer decides, not this preference.
            f.editor.state.buffers.basic = source;
            await f.editor.runBasic();
            assert.equal(f.created, 0);
            assert.equal(f.editor.state.running, false);
            assert.match(f.editor.state.status, new RegExp(`editor line ${line};`));
            assert.equal(f.editor.state.buffers.basic, source);
        }
        assert.equal(fetched, 0);
    } finally { globalThis.fetch = originalFetch; }
});

test('valid numbered source still routes to the selected Z80 runner without rewriting it', async () => {
    const actual = between(editorSource, '    async runBasic () {', '    // Fetch examples/index.json once');
    const importExpression = 'await import(/* webpackChunkName: "bw-board" */ \'bw-board/bbc-z80-runner.js\')';
    assert.ok(actual.includes(importExpression));
    const calls = [];
    const loadZ80 = async () => ({BbcZ80Runner: class {
        constructor({com}) { calls.push(['image', [...com]]); this.rawOutput = 'retro'; }
        start(source) { calls.push(['start', source]); return this; }
        pump() { return {done: true, reason: 'ok', output: 'retro'}; }
    }});
    const fetchRom = async url => {
        calls.push(['fetch', url]);
        return {ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer};
    };
    const LegacyEditor = new Function('Editor', 'loadZ80', 'fetch', 'requestAnimationFrame',
        `return class extends Editor {${actual.replace(importExpression, 'await loadZ80()')}}`)(
        Editor, loadZ80, fetchRom, callback => callback());
    const f = fixture(); Object.setPrototypeOf(f.editor, LegacyEditor.prototype);
    const source = '0 REM first\r\n 10PRINT "retro"\r\n\r\n20 END\r\n';
    f.editor.state.basicEngine = 'z80';
    f.editor.state.basicLineNumbers = false;
    f.editor.state.buffers.basic = source;
    await f.editor.runBasic();
    assert.equal(f.created, 0);
    assert.deepEqual(calls, [['fetch', 'static/roms/bbcbasic.com'], ['image', [1, 2, 3]], ['start', source]]);
    assert.equal(f.editor.state.output, 'retro');
    assert.equal(f.editor.state.running, false);
    assert.equal(f.editor.state.buffers.basic, source);
});

test('a generation refusal cannot execute its explanatory REM placeholder', async () => {
    const f = fixture(); f.editor.state.basicGenerationFailed = true;
    await f.editor.runBasic();
    assert.equal(f.created, 0);
    assert.deepEqual(f.calls, []);
});

test('BBC generation retains subset warnings and reports failed generation separately from source', async () => {
    for (const ok of [true, false]) {
        const f = fixture(); const calls = [];
        f.editor.state.basicLineNumbers = false;
        const project = {targets: []};
        f.editor.lib = async () => ({default: class {
            constructor() { this.project = project; }
            parse(source) { calls.push(['parse', source]); }
            generateBASIC(value, options) {
                calls.push(['generate', value, options]);
                return {ok, basic: 'PRINT "generated"', reasons: ok ? [] : ['two scripts cannot run together'],
                    warnings: ['digitalWrite is a commented hardware stub']};
            }
        }});
        const result = await f.editor.deriveBuffer('WHEN flag clicked:', 'pseudocode', 'basic');
        assert.deepEqual(calls.at(-1), ['generate', project, {profile: 'bbc', lineNumbers: false}]);
        if (ok) {
            assert.equal(result.basicGenerationFailed, false);
            assert.ok(result.basicWarnings.includes('digitalWrite is a commented hardware stub'));
            assert.equal(result.code, 'PRINT "generated"');
        } else {
            // A refused conversion is a refusal with its reasons (the authored
            // Code document's rule): no placeholder text becomes the BASIC buffer.
            assert.equal(result.code, undefined);
            assert.match(result.error, /two scripts cannot run together/);
            assert.equal(result.diagnostics.preserved, false);
        }
    }
});

test('portable generation follows the resolved profile and selected engine', () => {
    for (const [libraryTarget, basicProfile, basicEngine, expected] of [
        [null, 'bbc', 'crispbasic', {profile: 'bbc', lineNumbers: false, mode: 'crispbasic'}],
        [null, 'bbc', 'z80', {profile: 'bbc', lineNumbers: false}],
        ['i8086', 'bbc', 'crispbasic', {profile: 'ms', lineNumbers: false}],
        ['pico', 'bbc', 'crispbasic', {profile: 'bbc', lineNumbers: false}]
    ]) {
        const f = fixture();
        Object.assign(f.editor.state, {libraryTarget, basicProfile, basicEngine, basicPortableLibrary: true});
        assert.deepEqual(f.editor.basicGenerationOptions(), expected);
    }
});

for (const outcome of ['throws', 'BASIC error result']) {
    test(`${outcome} survives disposal failure and the next Run waits for cleanup`, async () => {
        const gate = deferred();
        const primary = {kind: 'basic', filename: 'lesson.bas', line: 3, message: 'original BASIC failure'};
        const f = fixture({disposeGate: gate, disposeFailure: new Error('secondary disposal failure'),
            runFailure: outcome === 'throws' ? primary : null});
        const pending = f.editor.runBasic();
        await f.entered.promise;
        if (outcome !== 'throws') f.completion.resolve({status: 'error', error: primary});
        await turn();
        assert.ok(f.calls.some(call => call[0] === 'dispose'));
        assert.equal(f.editor.state.running, true, 'cleanup still owns Run');
        await f.editor.runBasic();
        assert.equal(f.created, 1);
        gate.resolve();
        await pending;
        assert.equal(f.editor.state.running, false);
        assert.equal(f.editor.state.basicDiagnostic.message, 'lesson.bas:3: original BASIC failure');
        assert.deepEqual(f.highlights, [null, 3]);
    });
}

test('Stop during the cold import prevents a late worker from starting', async () => {
    const gate = deferred(); const f = fixture({loadGate: gate});
    const pending = f.editor.runBasic();
    f.editor.stopCrispBasic();
    assert.equal(f.editor.state.running, false);
    assert.equal(f.editor.state.status, 'stopped');
    gate.resolve(); await pending;
    assert.equal(f.created, 0);
    assert.equal(f.editor.state.status, 'stopped');
});

test('Stop waits for worker disposal before enabling another Run', async () => {
    const gate = deferred(); const f = fixture({disposeGate: gate});
    const pending = f.editor.runBasic(); await f.entered.promise;
    f.editor.stopCrispBasic(); await turn();
    assert.equal(f.editor.state.running, true);
    await f.editor.runBasic();
    assert.equal(f.created, 1);
    gate.resolve(); await pending;
    assert.equal(f.editor.state.running, false);
    assert.equal(f.editor.state.status, 'stopped');
});

test('line and key requests send different byte sequences, including an empty line and Enter', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    for (const [method, input, bytes] of [['line', 'é', 'é\n'], ['line', '', '\n'], ['key', 'A', 'A'], ['key', '', '\r']]) {
        f.emit(view('', method)); f.editor.state.basicInputValue = input;
        let prevented = false;
        f.editor.sendCrispBasicInput({preventDefault() { prevented = true; }});
        assert.equal(prevented, true);
        assert.deepEqual(f.calls.at(-1), ['input', bytes]);
        assert.equal(f.editor.state.basicInputMethod, null);
        assert.equal(f.editor.state.basicInputValue, '');
    }
    f.completion.resolve(done); await pending;
});

test('invalid key input stays visible without sending malformed data', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    f.emit(view('', 'key')); f.editor.state.basicInputValue = '€';
    f.editor.sendCrispBasicInput();
    assert.equal(f.calls.filter(c => c[0] === 'input').length, 0);
    assert.equal(f.editor.state.basicInputError, 'one Latin-1 character');
    assert.equal(f.editor.state.basicInputMethod, 'key');
    f.completion.resolve(done); await pending;
});

test('End input closes the stream and clears the pending request', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    f.emit(view('?', 'line')); f.editor.endCrispBasicInput();
    assert.deepEqual(f.calls.at(-1), ['end-input']);
    assert.equal(f.editor.state.basicInputMethod, null);
    f.completion.resolve(done); await pending;
});

test('runtime input rejections are displayed beside the preserved input', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    f.runner.writeInput = () => { throw new Error('input exceeds the limit'); };
    f.emit(view('?', 'line')); f.editor.state.basicInputValue = 'keep me';
    f.editor.sendCrispBasicInput();
    assert.equal(f.editor.state.basicInputError, 'input exceeds the limit');
    assert.equal(f.editor.state.basicInputValue, 'keep me');
    f.completion.resolve(done); await pending;
});

test('Reset during import clears output and revokes the old start', async () => {
    const gate = deferred(); const f = fixture({loadGate: gate});
    const pending = f.editor.runBasic();
    await f.editor.resetCrispBasic();
    assert.equal(f.editor.state.basicRawOutput, '');
    assert.equal(f.editor.state.basicOutputRunId, 2);
    assert.equal(f.editor.state.status, 'reset');
    gate.resolve(); await pending;
    assert.equal(f.created, 0);
    assert.equal(f.editor.state.status, 'reset');
});

test('Reset waits for disposal and rejects late output and completion', async () => {
    const gate = deferred(); const f = fixture({disposeGate: gate});
    const pending = f.editor.runBasic(); await f.entered.promise;
    f.emit(view('old output', 'line'));
    const resetting = f.editor.resetCrispBasic(); await turn();
    f.emit(view('late output', 'key'));
    assert.equal(f.editor.state.basicResetting, true);
    assert.equal(f.editor.state.output, 'old output');
    await f.editor.runBasic(); assert.equal(f.created, 1);
    gate.resolve(); await Promise.all([pending, resetting]);
    assert.equal(f.editor.state.output, '');
    assert.equal(f.editor.state.basicInputMethod, null);
    assert.equal(f.editor.state.status, 'reset');
    assert.equal(f.editor.state.running, false);
});

test('a failed reset still disposes the adapter and reports the error', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    f.runner.reset = async () => { f.completion.resolve({status: 'cancelled'}); throw new Error('reset failed'); };
    await f.editor.resetCrispBasic(); await pending;
    assert.ok(f.calls.some(c => c[0] === 'dispose'));
    assert.match(f.editor.state.basicDiagnostic.message, /reset failed/);
    assert.equal(f.editor.state.running, false);
});

test('unmount disposes an active session and all late view updates are ignored', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    const adjacentCleanup = [];
    f.editor._codeRunRequest = {source: 'owned console'};
    f.editor._codeSession = {dispose() { adjacentCleanup.push('console'); }};
    f.editor._picoBasicHardware = {
        unmirror() { adjacentCleanup.push('mirror'); },
        session: {close() { adjacentCleanup.push('Pico UART'); }}
    };
    const previousWindow = globalThis.window;
    globalThis.window = {removeEventListener() {}};
    try { f.editor.componentWillUnmount(); }
    finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
    const before = {...f.editor.state};
    f.emit(view('late output', 'line')); await Promise.all([pending, f.editor._picoBasicClosing]);
    assert.deepEqual(f.editor.state, before);
    assert.ok(f.calls.some(c => c[0] === 'cancel'));
    assert.ok(f.calls.some(c => c[0] === 'dispose'));
    assert.deepEqual(adjacentCleanup, ['console', 'mirror', 'Pico UART']);
    assert.equal(f.editor._codeRunRequest, null);
    assert.equal(f.editor._codeSession, null);
    assert.equal(f.editor._picoBasicHardware, null);
});

test('unmount during import cannot start a worker', async () => {
    const gate = deferred(); const f = fixture({loadGate: gate});
    const pending = f.editor.runBasic();
    f.editor._unmounted = true; await f.editor.disposeCrispBasic();
    gate.resolve(); await pending;
    assert.equal(f.created, 0);
});

test('queued React view updates recheck ownership after Stop', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    const queued = []; const update = f.editor.setState;
    f.editor.setState = function (patch) {
        if (typeof patch === 'function') queued.push(patch); else update.call(this, patch);
    };
    f.emit(view('stale view', 'line'));
    f.editor.stopCrispBasic();
    update.call(f.editor, queued.shift());
    assert.notEqual(f.editor.state.output, 'stale view');
    assert.equal(f.editor.state.basicInputMethod, null);
    await pending;
    for (const patch of queued) update.call(f.editor, patch);
    assert.equal(f.editor.state.status, 'stopped');
});

test('React can commit final bytes after the same run has completed', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    const queued = []; const update = f.editor.setState;
    f.editor.setState = function (patch) {
        if (typeof patch === 'function') queued.push(patch); else update.call(this, patch);
    };
    f.emit(view('final bytes\r\n'));
    f.completion.resolve(done); await pending;
    assert.equal(f.editor._crispBasicRun, null);
    for (const patch of queued) update.call(f.editor, patch);
    assert.equal(f.editor.state.output, 'final bytes\r\n');
    assert.equal(f.editor.state.basicRawOutput, 'final bytes\r\n');
    assert.equal(f.editor.state.status, 'completed:0');
});

test('mapped BASIC errors display the original filename and physical editor line', async () => {
    const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
    f.completion.resolve({status: 'error', error: {kind: 'basic', filename: 'lesson.bas', line: 3, basicLine: 200, message: 'Division by zero'}});
    await pending;
    assert.equal(f.editor.state.basicDiagnostic.message, 'lesson.bas:3: Division by zero');
    assert.deepEqual(f.highlights, [null, 3]);
});

test('an error does not highlight a newer edited source or a different language', async () => {
    for (const change of ['source', 'language']) {
        const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
        if (change === 'source') f.editor.state.buffers.basic = 'PRINT "edited"';
        else f.editor.state.lang = 'python';
        f.completion.resolve({status: 'error', error: {kind: 'basic', line: 3, message: 'old error'}});
        await pending;
        assert.deepEqual(f.highlights, [null]);
    }
});

test('source errors keep their supplied location without a duplicate prefix', async () => {
    const f = fixture();
    f.runner.run = async () => { throw Object.assign(new Error('lesson.bas:2:4: unsupported character'),
        {filename: 'lesson.bas', line: 2, column: 4}); };
    await f.editor.runBasic();
    assert.equal(f.editor.state.basicDiagnostic.message, 'lesson.bas:2:4: unsupported character');
    assert.equal(f.editor.state.running, false);
});

for (const status of ['timeout', 'output-limit', 'simulation-limit']) {
    test(`${status} remains distinct from successful completion`, async () => {
        const f = fixture(); const pending = f.editor.runBasic(); await f.entered.promise;
        f.completion.resolve({status}); await pending;
        assert.equal(f.editor.state.status, status);
        assert.equal(f.editor.state.basicInputMethod, null);
        assert.equal(f.editor.state.running, false);
    });
}

const terminalSource = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/vdu-terminal.jsx', import.meta.url), 'utf8');
const terminalClass = between(terminalSource, 'class VduTerminal extends React.Component {', '    render () {');
const Terminal = new Function('React', 'VduDecoder', 'PALETTE', `return ${terminalClass}}`)(
    {Component: class {
        constructor(props) { this.props = props; }
        setState(update) { Object.assign(this.state, update); }
    }, createRef: () => ({current: null})},
    VduDecoder, ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff']);

function terminal(output, resetKey = 1) {
    const operations = [];
    const paints = [];
    const ctx = Object.fromEntries(['fillRect', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'closePath', 'fill',
        'save', 'rect', 'clip', 'restore'].map(key => [key, (...args) => {
        operations.push([key, ...args]);
        if (key === 'fillRect' || key === 'fillText') paints.push([key, ctx.fillStyle, ...args]);
    }]));
    const component = new Terminal({output, resetKey});
    component._canvasRef.current = {width: 320, height: 256, getContext: () => ctx};
    component.componentDidMount();
    return {component, operations, paints, ctx, update(next, key = component.props.resetKey) {
        const previous = component.props;
        component.props = {output: next, resetKey: key};
        component.componentDidUpdate(previous);
    }};
}

test('the lazy VDU terminal consumes bytes already present at mount', () => {
    const t = terminal('éA');
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText').map(op => op[1]), ['é', 'A']);
    assert.equal(t.component._processed, 2);
});

test('the VDU terminal keeps partial decoder state across output chunks', () => {
    const t = terminal('\x19\x04\x40');
    t.update('\x19\x04\x40\x01\x00\x02');
    assert.equal(t.component._gx, 320);
    assert.equal(t.component._gy, 512);
    assert.equal(t.operations.filter(op => op[0] === 'fillText').length, 0);
    t.update('\x19\x04\x40\x01\x00\x02A');
    assert.equal(t.operations.filter(op => op[0] === 'fillText').length, 1);
});

test('a new run redraws an identical byte stream and resets decoder and cursors', () => {
    const t = terminal('A\x19\x04');
    t.update('A\x19\x04', 2);
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText'), [['fillText', 'A', 2, 13], ['fillText', 'A', 2, 13]]);
    assert.equal(t.component._decoder.code, 25);
    assert.deepEqual(t.component._decoder.params, [4]);
});

test('replaced or shortened output resets even without an explicit run key', () => {
    const t = terminal('AB');
    t.update('CDE');
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText').slice(-3),
        [['fillText', 'C', 2, 13], ['fillText', 'D', 10, 13], ['fillText', 'E', 18, 13]]);
    t.update(''); t.update('Z');
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText').at(-1), ['fillText', 'Z', 2, 13]);
});

const vdu = (...bytes) => String.fromCharCode(...bytes);
const plot = (mode, x, y) => vdu(25, mode, x & 255, (x >> 8) & 255, y & 255, (y >> 8) & 255);
const origin = (x, y) => vdu(29, x & 255, (x >> 8) & 255, y & 255, (y >> 8) & 255);

test('the canvas applies ORIGIN to absolute positions and adds relative moves exactly once', () => {
    const t = terminal(origin(320, 256) + plot(4, 0, 0) + plot(1, 128, 256));
    assert.deepEqual([t.component._gx, t.component._gy], [448, 512]);
    assert.deepEqual(t.operations.filter(op => ['moveTo', 'lineTo'].includes(op[0])),
        [['moveTo', 80, 191], ['lineTo', 112, 127]]);
    t.update(t.component.props.output + origin(-320, -256) + plot(0, -128, -256));
    assert.deepEqual([t.component._gx, t.component._gy], [320, 256], 'relative motion ignores the changed origin');
    assert.equal(t.operations.filter(op => op[0] === 'stroke').length, 1);
});

test('point, triangle and rectangle PLOT families paint their actual geometry', () => {
    const point = terminal(plot(69, 0, 0));
    assert.deepEqual(point.operations.at(-1), ['fillRect', 0, 255, 1, 1]);
    assert.equal(point.operations.some(op => op[0] === 'stroke'), false, 'a point is not a line from the previous cursor');
    const triangle = terminal(plot(4, 0, 0) + plot(4, 640, 0) + plot(85, 0, 512));
    assert.deepEqual(triangle.operations.slice(-6), [
        ['beginPath'], ['moveTo', 0, 255], ['lineTo', 160, 255], ['lineTo', 0, 127], ['closePath'], ['fill']
    ]);
    const rectangle = terminal(plot(4, 640, 512) + plot(97, -320, -256));
    assert.deepEqual(rectangle.operations.at(-1), ['fillRect', 80, 127, 81, 65]);
    assert.deepEqual([rectangle.component._gx, rectangle.component._gy], [320, 256]);
});

test('graphics and text background colours remain independent and MODE resets drawing state', () => {
    const t = terminal(vdu(17, 129, 18, 0, 130, 16));
    assert.equal(t.ctx.fillStyle, '#00ff00', 'CLG uses green graphics background, not red text background');
    t.update(t.component.props.output + vdu(12));
    assert.equal(t.ctx.fillStyle, '#ff0000', 'CLS uses the text background');
    t.update(t.component.props.output + origin(100, 200) + vdu(18, 0, 1, 22, 0) + plot(5, 640, 512));
    assert.equal(t.ctx.strokeStyle, '#ffffff');
    assert.deepEqual([t.component._originX, t.component._originY], [0, 0]);
    assert.deepEqual(t.operations.filter(op => op[0] === 'moveTo').at(-1), ['moveTo', 0, 255]);
});

test('TAB and text cursor controls position text without treating LF as CR', () => {
    const t = terminal(vdu(31, 3, 2) + 'A' + vdu(8) + 'B' + vdu(10) + 'C');
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText'), [
        ['fillText', 'A', 26, 45], ['fillText', 'B', 26, 45], ['fillText', 'C', 34, 61]
    ]);
});

test('text cells erase previous glyphs and use the current text background before each character', () => {
    const t = terminal('X' + vdu(17, 129, 18, 0, 130, 31, 0, 0) + ' ');
    assert.deepEqual(t.paints.slice(1), [
        ['fillRect', '#000000', 0, 0, 8, 16], ['fillText', '#ffffff', 'X', 2, 13],
        ['fillRect', '#ff0000', 0, 0, 8, 16], ['fillText', '#ffffff', ' ', 2, 13]
    ], 'a space overwrites X with red text background, independently of green graphics background');
    assert.deepEqual(t.operations.filter(op => op[0] === 'rect'), [['rect', 0, 0, 8, 16], ['rect', 0, 0, 8, 16]],
        'glyphs are clipped to the cell which a subsequent overwrite clears');
    assert.equal(t.operations.filter(op => op[0] === 'save').length, 2);
    assert.equal(t.operations.filter(op => op[0] === 'clip').length, 2);
    assert.equal(t.operations.filter(op => op[0] === 'restore').length, 2);
    assert.deepEqual(t.component.state.unsupported, []);
});

test('horizontal VDU cursor controls wrap across both edges before the next character is drawn', () => {
    const t = terminal(vdu(31, 39, 0, 9) + 'X' + vdu(31, 0, 1, 8) + 'Y');
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText'), [
        ['fillText', 'X', 2, 29], ['fillText', 'Y', 314, 13]
    ]);
    assert.deepEqual([t.component._cx, t.component._cy], [0, 1]);
    assert.deepEqual(t.component.state.unsupported, []);
});

test('DEL backspaces, erases in text background and leaves the cursor at the erased cell', () => {
    const t = terminal('AB' + vdu(17, 132, 127));
    assert.deepEqual(t.paints.at(-1), ['fillRect', '#0000ff', 8, 0, 8, 16]);
    assert.deepEqual([t.component._cx, t.component._cy], [1, 0]);
    t.update(t.component.props.output + 'C');
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText'), [
        ['fillText', 'A', 2, 13], ['fillText', 'B', 10, 13], ['fillText', 'C', 10, 13]
    ]);
    assert.deepEqual([t.component._cx, t.component._cy], [2, 0]);
    assert.deepEqual(t.component.state.unsupported, []);
});

test('DEL at the start of a row clears the previous row last cell', () => {
    const t = terminal(vdu(31, 0, 1, 127));
    assert.deepEqual(t.paints.at(-1), ['fillRect', '#000000', 312, 0, 8, 16]);
    assert.deepEqual([t.component._cx, t.component._cy], [39, 0]);
    assert.equal(t.operations.some(op => op[0] === 'fillText'), false);
    assert.deepEqual(t.component.state.unsupported, []);
});

test('text outside the fixed preview is diagnosed and cannot erase or paint an unrelated visible cell', () => {
    const t = terminal(vdu(31, 39, 15) + 'A' + vdu(9) + 'B' + vdu(31, 0, 0, 127));
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillText'), [['fillText', 'A', 314, 253]]);
    assert.deepEqual(t.operations.filter(op => op[0] === 'fillRect'), [
        ['fillRect', 0, 0, 320, 256], ['fillRect', 312, 240, 8, 16]
    ]);
    assert.deepEqual(t.component.state.unsupported, ['text outside 40x16 preview (scrolling unavailable)']);
    t.update('', 2);
    assert.deepEqual(t.component.state.unsupported, []);
    assert.deepEqual([t.component._cx, t.component._cy], [0, 0]);
});

test('unsupported geometry and raster actions are reported instead of painted as lines', () => {
    const t = terminal(plot(153, 640, 512) + vdu(18, 3, 1) + plot(5, 100, 100));
    assert.deepEqual(t.component.state.unsupported, ['PLOT 153', 'GCOL 3']);
    assert.equal(t.operations.some(op => op[0] === 'stroke' || op[0] === 'lineTo'), false);
    assert.deepEqual([t.component._gx, t.component._gy], [100, 100], 'the final cursor still tracks the requested points');
    t.update('', 2);
    assert.deepEqual(t.component.state.unsupported, [], 'warnings belong only to their run');
});

test('unsupported VDU reports are bounded and duplicate commands do not grow the list', () => {
    const t = terminal(Array.from({length: 256}, (_, mode) => plot(mode, 0, 0)).join(''));
    assert.equal(t.component.state.unsupported.length, 16);
    assert.equal(new Set(t.component.state.unsupported).size, 16);
});
