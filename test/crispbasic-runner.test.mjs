import test from 'node:test';
import assert from 'node:assert/strict';
import {CrispBasicOutput, createCrispBasicRunner, vduLatin1} from
    '../overlay/scratch-gui/src/lib/crispbasic-runner.js';

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const completed = {status: 'completed', backend: 'bbcsdl-wasm', text: 'ok', output: Uint8Array.of(111, 107)};
const base = 'https://example.invalid/workbench/static/crispbasic/';

function fixture ({loading, finishing, cleanup} = {}) {
    const calls = [], events = [], entered = deferred();
    let sessionOptions;
    const done = finishing || deferred();
    const runtime = {createWasmSession (options) {
        calls.push(['create', options]); sessionOptions = options;
        return {
            run (source, opts) { calls.push(['run', source, opts]); entered.resolve(); return done.promise; },
            cancel () { calls.push(['cancel']); done.resolve({...completed, status: 'cancelled'}); return true; },
            writeInput (bytes) { calls.push(['input', bytes]); return true; },
            endInput () { calls.push(['end']); },
            async dispose () { calls.push(['dispose']); await cleanup?.promise; }
        };
    }};
    const runner = createCrispBasicRunner({assetBaseURL: base, onEvent: event => events.push(event),
        loadRuntime: async url => { calls.push(['load', url]); return loading ? loading.promise : runtime; }});
    return {runner, runtime, calls, events, entered, done, emit: event => sessionOptions.onEvent(event)};
}

test('Latin-1 preserves every byte, including C1 codes, without UTF-8 or Windows-1252 substitution', () => {
    const bytes = Uint8Array.from({length: 256}, (_, index) => index);
    assert.deepEqual([...vduLatin1(bytes)].map(char => char.charCodeAt(0)), [...bytes]);
    assert.throws(() => vduLatin1('text'), /Uint8Array/);
});

test('canonical VDU decoder excludes fragmented graphics parameters from transcript', () => {
    const output = new CrispBasicOutput();
    const bytes = Uint8Array.of(65, 25, 5, 65, 0, 66, 0, 128, 233, 13, 10);
    for (const byte of bytes) output.append(Uint8Array.of(byte));
    assert.equal(output.rawOutput, vduLatin1(bytes));
    assert.equal(output.output, 'A\x80é\r\n');
    output.append(Uint8Array.of(25, 4, 1));
    output.reset();
    output.append(Uint8Array.of(66));
    assert.equal(output.output, 'B', 'reset must discard unfinished VDU parameters');
});

test('loading is lazy and uses relocatable packaged URLs; source and filename are preserved', async () => {
    const f = fixture();
    assert.deepEqual(f.calls, []);
    const source = 'PRINT "hello"\nEND\n';
    const pending = f.runner.run(source, {filename: 'lesson.bas', interactive: true});
    await f.entered.promise;
    assert.deepEqual(f.calls[0], ['load', base + 'browser.mjs']);
    assert.equal(f.calls[1][1].moduleURL, base + 'wasm/crispbasic.mjs');
    assert.equal(f.calls[1][1].workerURL, base + 'src/wasm-worker.mjs');
    assert.equal(f.calls[2][1], source);
    assert.equal(f.calls[2][2].filename, 'lesson.bas');
    assert.equal(f.calls[2][2].interactive, true);
    f.done.resolve(completed);
    assert.equal((await pending).status, 'completed');
    assert.equal(f.runner.state, 'idle');
    assert.equal(f.calls.at(-1)[0], 'dispose');
    assert.equal(f.events.filter(event => event.type === 'result').length, 1);
});

test('cancel during cold loading resolves without creating a late worker', async () => {
    const loading = deferred(); const f = fixture({loading});
    const pending = f.runner.run('END');
    await Promise.resolve();
    assert.equal(f.runner.cancel(), true);
    assert.equal((await pending).status, 'cancelled');
    loading.resolve(f.runtime);
    await Promise.resolve();
    assert.ok(!f.calls.some(call => call[0] === 'create'));
    assert.equal(f.runner.cancel(), false);
});

test('deadline includes a loader that never resolves', async () => {
    const f = fixture({loading: deferred()});
    const result = await f.runner.run('END', {timeoutMs: 25});
    assert.equal(result.status, 'timeout');
    assert.equal(f.runner.state, 'idle');
    assert.ok(!f.calls.some(call => call[0] === 'create'));
});

test('failed asset load returns actionable feedback without choosing another engine', async () => {
    const f = fixture({loading: {promise: Promise.reject(new Error('HTTP 404'))}});
    const result = await f.runner.run('END');
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /npm run build:crispbasic/);
    assert.match(result.error.message, /HTTP 404/);
    assert.ok(!f.calls.some(call => call[0] === 'create'));
});

test('input prompts and exact output update view state; input and EOF clear the prompt', async () => {
    const f = fixture(); const pending = f.runner.run('INPUT A$');
    await f.entered.promise;
    f.emit({type: 'output', bytes: Uint8Array.of(72, 105, 25, 5, 65)});
    f.emit({type: 'output', bytes: Uint8Array.of(0, 66, 0, 233)});
    f.emit({type: 'input', method: 'line'});
    const view = f.events.filter(event => event.type === 'view').at(-1);
    assert.equal(view.output, 'Hié');
    assert.equal(view.rawOutput, 'Hi\x19\x05A\0B\0é');
    assert.equal(view.inputMethod, 'line');
    f.runner.writeInput('é\n');
    assert.equal(f.events.at(-1).inputMethod, null);
    assert.deepEqual(f.calls.at(-1), ['input', 'é\n']);
    f.emit({type: 'input', method: 'key'});
    f.runner.endInput();
    assert.equal(f.events.at(-1).inputMethod, null);
    f.done.resolve(completed); await pending;
});

test('reset waits for worker cleanup and clears decoder/output after cancellation', async () => {
    const cleanup = deferred(); const f = fixture({cleanup});
    const pending = f.runner.run('REPEAT:UNTIL FALSE');
    await f.entered.promise;
    f.emit({type: 'output', bytes: Uint8Array.of(65, 25, 4)});
    let resetFinished = false;
    const resetting = f.runner.reset().then(() => { resetFinished = true; });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(resetFinished, false);
    await assert.rejects(f.runner.run('END'), /resetting/);
    cleanup.resolve(); await resetting;
    assert.equal((await pending).status, 'cancelled');
    const view = f.events.filter(event => event.type === 'view').at(-1);
    assert.equal(view.rawOutput, ''); assert.equal(view.output, '');
    assert.equal(f.runner.state, 'idle');
});

test('idle reset owns its full lifetime and repeated calls share one reset promise', async () => {
    const f = fixture();
    const resetting = f.runner.reset();
    assert.equal(f.runner.reset(), resetting);
    await assert.rejects(f.runner.run('PRINT "new"'), /resetting/);
    await resetting;
    assert.equal(f.events.filter(event => event.type === 'view').length, 1);
    const pending = f.runner.run('PRINT "new"');
    await f.entered.promise;
    f.emit({type: 'output', bytes: Uint8Array.of(78)});
    const view = f.events.filter(event => event.type === 'view').at(-1);
    assert.equal(view.output, 'N');
    f.done.resolve(completed);
    await pending;
});

test('reset from the initial view cancels loading and blocks restarts from the final clear view', async () => {
    const loading = deferred(); const f = fixture({loading});
    let resetting, restart;
    f.runner._options.onEvent = event => {
        f.events.push(event);
        if (event.type === 'view' && event.runId === 1 && !resetting) resetting = f.runner.reset();
        else if (event.type === 'view' && event.runId === 2) {
            restart = f.runner.run('PRINT "too early"');
            // The assertion below observes this after reset settles.
            restart.catch(() => {});
        }
    };
    const pending = f.runner.run('PRINT "old"');
    await resetting;
    assert.equal((await pending).status, 'cancelled');
    await assert.rejects(restart, /resetting/);
    loading.resolve(f.runtime);
    await Promise.resolve();
    assert.ok(!f.calls.some(call => call[0] === 'create'));
    assert.equal(f.runner.state, 'idle');
    assert.equal(f.events.filter(event => event.type === 'view').at(-1).output, '');
});

test('dispose suppresses stale UI events and waits for cleanup', async () => {
    const cleanup = deferred(); const f = fixture({cleanup});
    const pending = f.runner.run('END'); await f.entered.promise;
    const seen = f.events.length;
    const disposal = f.runner.dispose();
    f.emit({type: 'output', bytes: Uint8Array.of(65)});
    await assert.rejects(f.runner.run('END'), /disposed/);
    cleanup.resolve(); await disposal; await pending;
    assert.equal(f.events.length, seen);
    assert.equal(f.runner.state, 'disposed');
    await f.runner.dispose();
});

test('AbortSignal cancels loading and a pre-aborted run does not load anything', async () => {
    const controller = new AbortController(); controller.abort();
    const f = fixture();
    assert.equal((await f.runner.run('END', {signal: controller.signal})).status, 'cancelled');
    assert.deepEqual(f.calls, []);
});

test('source-validation errors are preserved and still release the session', async () => {
    const f = fixture(); const pending = f.runner.run('bad source'); await f.entered.promise;
    const error = Object.assign(new Error('non-Latin-1 character'), {name: 'SourceError', line: 4});
    f.done.reject(error);
    await assert.rejects(pending, actual => actual === error);
    assert.equal(f.runner.state, 'idle');
    assert.equal(f.calls.at(-1)[0], 'dispose');
});

test('an external view callback failure stops the active interpreter', async () => {
    const f = fixture();
    f.runner._options.onEvent = event => { if (event.type === 'view' && event.rawOutput) throw new Error('renderer failed'); };
    const pending = f.runner.run('PRINT "A"'); await f.entered.promise;
    f.emit({type: 'output', bytes: Uint8Array.of(65)});
    const result = await pending;
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /renderer failed/);
    assert.equal(f.calls.at(-1)[0], 'dispose');
});

test('null and unprintable callback failures still stop and clean up the runner', async () => {
    for (const error of [null, Object.create(null)]) {
        const f = fixture();
        f.runner._options.onEvent = event => { if (event.type === 'view' && event.rawOutput) throw error; };
        const pending = f.runner.run('PRINT "A"'); await f.entered.promise;
        f.emit({type: 'output', bytes: Uint8Array.of(65)});
        const result = await pending;
        assert.equal(result.status, 'host-error');
        assert.match(result.error.message, /View callback failed/);
        assert.equal(f.runner.state, 'idle');
        assert.equal(f.calls.at(-1)[0], 'dispose');
    }
});
