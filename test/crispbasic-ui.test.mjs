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

const editorSource = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
function between(source, start, end) {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `Actual method boundaries: ${start}`);
    return source.slice(a, b);
}
const editorMethods = between(editorSource, '    async loadCrispBasicRunner () {', '    // Fetch examples/index.json once') +
    between(editorSource, '    componentWillUnmount () {', '    // Current-locale string table') +
    between(editorSource, '    async deriveBuffer (src, from, to) {', '    /**\n     * Is the RCX extension loaded?');
// The production document adapters and neutral machine hooks come from the
// shared fixture; only the VM and worker edges belong to this file.
const Editor = codeDocumentEditorClass(editorSource, editorMethods, {DOS_LANG: {}, conversionFailure});
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const done = {status: 'completed', exitCode: 0};
const turn = () => new Promise(resolve => setImmediate(resolve));

function fixture({loadGate = null, disposeGate = null} = {}) {
    const entered = deferred();
    const completion = deferred();
    const calls = [];
    const highlights = [];
    let emit;
    let runnerOptions;
    let created = 0;
    const runner = {
        async run(source, options) { calls.push(['run', source, options]); entered.resolve(); return completion.promise; },
        cancel() { calls.push(['cancel']); completion.resolve({status: 'cancelled'}); return true; },
        async reset() { calls.push(['reset']); completion.resolve({status: 'cancelled'}); },
        async dispose() { calls.push(['dispose']); if (disposeGate) await disposeGate.promise; },
        writeInput(value) { calls.push(['input', value]); },
        endInput() { calls.push(['end-input']); }
    };
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang: 'basic', basicProfile: 'bbc', basicEngine: 'crispbasic', basicFilename: 'lesson.bas',
            basicOutputRunId: 0, basicInputMethod: null, basicInputValue: '', basicInputError: '',
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
        activeCode() { return this.state.buffers[this.state.lang]; },
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
    const previousWindow = globalThis.window;
    globalThis.window = {removeEventListener() {}};
    try { f.editor.componentWillUnmount(); }
    finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
    const before = {...f.editor.state};
    f.emit(view('late output', 'line')); await pending;
    assert.deepEqual(f.editor.state, before);
    assert.ok(f.calls.some(c => c[0] === 'cancel'));
    assert.ok(f.calls.some(c => c[0] === 'dispose'));
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
    {Component: class { constructor(props) { this.props = props; } }, createRef: () => ({current: null})},
    VduDecoder, ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff']);

function terminal(output, resetKey = 1) {
    const operations = [];
    const ctx = Object.fromEntries(['fillRect', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'stroke'].map(
        key => [key, (...args) => operations.push([key, ...args])]));
    const component = new Terminal({output, resetKey});
    component._canvasRef.current = {width: 320, height: 256, getContext: () => ctx};
    component.componentDidMount();
    return {component, operations, update(next, key = component.props.resetKey) {
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
    assert.deepEqual(t.operations.at(-1), ['fillText', 'Z', 2, 13]);
});
