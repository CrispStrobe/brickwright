import assert from 'node:assert/strict';
import {access, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createWasmSession, WASM_CAPABILITIES} from '../browser.mjs';
import {corpus} from './wasm-corpus.mjs';

const moduleURL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const wasmURL = new URL('../.build/wasm/crispbasic.wasm', import.meta.url);
const textLines = text => text.replace(/\r\n/g, '\n');

function sessionFor(t, options = {}) {
    const session = createWasmSession({moduleURL, ...options});
    t.after(() => session.dispose());
    return session;
}

async function fakeWorker(t, body) {
    const directory = await mkdtemp(fileURLToPath(new URL('../.build/worker-test-', import.meta.url)));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const filename = `${directory}/worker.mjs`;
    await writeFile(filename, `import {parentPort} from 'node:worker_threads';\n${body}\n`);
    return new URL(`file://${filename}`);
}

test('WASM integration requires a real built module; an absent artifact fails', async () => {
    await access(moduleURL);
    const bytes = await readFile(wasmURL);
    assert.equal(WebAssembly.validate(bytes), true);
});

test('the restricted profile advertises only implemented capabilities', () => {
    assert.equal(WASM_CAPABILITIES.backend, 'bbcsdl-wasm');
    assert.equal(WASM_CAPABILITIES.isolation, 'webassembly-worker');
    assert.equal(WASM_CAPABILITIES.host.filesystem, false);
    assert.equal(WASM_CAPABILITIES.host.nativeCalls, false);
    assert.equal(WASM_CAPABILITIES.output.graphics, false);
    assert.equal(WASM_CAPABILITIES.hardware, false);
    assert.equal(WASM_CAPABILITIES.debug.step, false);
    assert.throws(() => { WASM_CAPABILITIES.host.filesystem = true; }, TypeError);
});

for (const fixture of corpus) {
    test(`WASM anchored corpus: ${fixture.name}`, async t => {
        const session = sessionFor(t);
        const expected = fixture.bytes ?? [...Buffer.from(fixture.text, 'latin1')];
        const result = await session.run(fixture.source, {
            filename: `${fixture.name}.bas`, input: fixture.input ?? ''
        });
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.exitCode, fixture.exitCode ?? 0);
        assert.deepEqual([...result.output], expected);
        assert.equal(result.text, Buffer.from(result.output).toString('latin1'));
    });
}

test('streamed output cannot be mutated by observers and matches the final bytes', async t => {
    const observed = [], terminal = [];
    const session = sessionFor(t, {onEvent: event => {
        if (event.type === 'output') {
            observed.push(...event.bytes);
            event.bytes.fill(0);
        }
        if (event.type === 'result') terminal.push(event.result);
    }});
    const result = await session.run('PRINT "stream"\nVDU 128,255\nEND\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual(observed, [...result.output]);
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0], result);
    assert.equal(result.text, 'stream\r\n\x80\xff');
    assert.equal(session.state, 'idle');
});

test('unhandled errors preserve original editor positions and BASIC line numbers', async t => {
    const session = sessionFor(t);
    for (const [source, expectedBasicLine] of [
        ['REM first\n\nERROR 100, "expected failure"\n', 3],
        ['100 REM first\n\n450 ERROR 100, "expected failure"\n', 450]
    ]) {
        const result = await session.run(source, {filename: 'broken.bas'});
        assert.equal(result.status, 'error', JSON.stringify(result.error));
        assert.equal(result.error.kind, 'basic');
        assert.equal(result.error.code, 100);
        assert.equal(result.error.message, 'expected failure');
        assert.equal(result.error.basicLine, expectedBasicLine);
        assert.equal(result.error.line, 3);
        assert.equal(result.error.filename, 'broken.bas');
        assert.equal(result.exitCode, 1);
    }
});

test('token record limits are reported before executing truncated source', async t => {
    const result = await sessionFor(t).run(`REM first\nPRINT "${'a'.repeat(300)}"\n`, {filename: 'long.bas'});
    assert.equal(result.status, 'error', JSON.stringify(result.error));
    assert.match(result.error.message, /tokenized|too long|255/i);
    assert.equal(result.error.line, 2);
    assert.equal(result.output.length, 0);
});

test('interactive INPUT suspends and resumes nested function frames', async t => {
    let requests = 0;
    const session = sessionFor(t, {onEvent: event => {
        if (event.type !== 'input') return;
        assert.equal(event.method, 'line');
        requests++;
        setTimeout(() => { session.writeInput('awake\n'); session.endInput(); }, 20);
    }});
    const result = await session.run(`PROCouter
END
DEF PROCouter
LOCAL answer$
answer$ = FNask(4)
PRINT answer$
ENDPROC
DEF FNask(n%)
LOCAL reply$
IF n% > 0 THEN =FNask(n%-1)
INPUT "" reply$
=reply$
`, {interactive: true});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(requests, 1);
    assert.equal(textLines(result.text), '\nawake\n');
    assert.throws(() => session.writeInput('late'), /input stream/i);
});

test('interactive input can be supplied before a worker finishes starting', async t => {
    const session = sessionFor(t);
    const pending = session.run('INPUT "" name$\nPRINT name$\nEND\n', {interactive: true});
    session.writeInput('early\n');
    session.endInput();
    const result = await pending;
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(textLines(result.text), '\nearly\n');
});

test('ON ERROR LOCAL survives an asynchronous INPUT and returns through its procedure frame', async t => {
    const session = sessionFor(t, {onEvent: event => {
        if (event.type === 'input') setTimeout(() => {
            session.writeInput('Ada\n');
            session.endInput();
        }, 20);
    }});
    const result = await session.run(`PROCask
PRINT "returned"
END
DEF PROCask
LOCAL reply$
ON ERROR LOCAL PRINT "handled:" + REPORT$ : ENDPROC
INPUT "" reply$
ERROR 100, "after " + reply$
ENDPROC
`, {interactive: true});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '\r\nhandled:after Ada\r\nreturned\r\n');
});

test('closed input produces a BASIC error and remains catchable by ON ERROR', async t => {
    const session = sessionFor(t);
    const failed = await session.run('INPUT "" name$\nEND\n');
    assert.equal(failed.status, 'error', JSON.stringify(failed.error));
    assert.match(failed.error.message, /input|end.of.file|EOF/i);
    const handled = await session.run('ON ERROR PRINT "closed" : END\nINPUT "" name$\nEND\n');
    assert.equal(handled.status, 'completed', JSON.stringify(handled.error));
    assert.equal(textLines(handled.text), 'closed\n');
});

test('nonblocking and timed INKEY respect available bytes and an open input stream', async t => {
    const session = sessionFor(t);
    for (const [input, expected] of [['', '-1\n'], ['x', '120\n']]) {
        const result = await session.run('PRINT STR$(INKEY(0))\nEND\n', {input});
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(textLines(result.text), expected);
    }
    const waited = await session.run('PRINT STR$(INKEY(5))\nEND\n', {interactive: true});
    assert.equal(waited.status, 'completed', JSON.stringify(waited.error));
    assert.equal(textLines(waited.text), '-1\n');
    assert.ok(waited.durationMs >= 40);
});

test('INKEY skips CRLF residue without waiting for another byte', async t => {
    const result = await sessionFor(t).run('INPUT "" name$\nPRINT STR$(INKEY(0))\nEND\n', {
        interactive: true, input: 'Ada\r\n'
    });
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text.trim(), '-1');
});

test('WAIT yields while preserving the BASIC stack and TIME advances monotonically', async t => {
    const result = await sessionFor(t).run('TIME = 100\nWAIT 5\nPRINT STR$(TIME)\nEND\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.ok(Number(result.text.trim()) >= 104, result.text);
});

test('tight loops are stopped by a deadline outside the interpreter worker', {timeout: 10000}, async t => {
    const session = sessionFor(t, {timeoutMs: 150});
    const started = performance.now();
    const result = await session.run('REPEAT\nUNTIL FALSE\n');
    assert.equal(result.status, 'timeout', JSON.stringify(result.error));
    assert.ok(performance.now() - started < 5000);
    assert.equal(session.state, 'idle');
});

test('the deadline includes time suspended in INPUT', async t => {
    const session = sessionFor(t, {timeoutMs: 200});
    const result = await session.run('INPUT "" name$\nEND\n', {interactive: true});
    assert.equal(result.status, 'timeout', JSON.stringify(result.error));
    assert.equal(session.state, 'idle');
});

test('output limits preserve exactly the accepted byte budget', async t => {
    const events = [];
    const session = sessionFor(t, {maxOutputBytes: 128, onEvent: event => {
        if (event.type === 'output') events.push(...event.bytes);
    }});
    const result = await session.run('REPEAT\nPRINT "abcdefghij"\nUNTIL FALSE\n');
    assert.equal(result.status, 'output-limit', JSON.stringify(result.error));
    assert.equal(result.output.length, 128);
    assert.deepEqual(events, [...result.output]);
    assert.equal(session.state, 'idle');
});

test('AbortSignal and cancellation while awaiting input leave the session reusable', async t => {
    const session = sessionFor(t);
    const controller = new AbortController();
    const pending = session.run('INPUT "" name$\nEND\n', {interactive: true, signal: controller.signal});
    const timer = setTimeout(() => controller.abort(), 150);
    t.after(() => clearTimeout(timer));
    assert.equal((await pending).status, 'cancelled');
    const again = await session.run('PRINT "reused"\nEND\n');
    assert.equal(again.status, 'completed', JSON.stringify(again.error));
    assert.equal(textLines(again.text), 'reused\n');
    const preCancelled = new AbortController();
    preCancelled.abort();
    assert.equal((await session.run('END\n', {signal: preCancelled.signal})).status, 'cancelled');
});

test('reset and concurrent dispose wait for the old run to finish', async t => {
    const session = sessionFor(t);
    const pending = session.run('REPEAT\nUNTIL FALSE\n');
    await session.reset();
    assert.equal((await pending).status, 'cancelled');
    assert.equal(session.state, 'idle');
    const last = session.run('REPEAT\nUNTIL FALSE\n');
    let settled = false;
    last.then(() => { settled = true; });
    await Promise.all([session.dispose(), session.dispose()]);
    assert.equal(settled, true);
    assert.equal(session.state, 'disposed');
    assert.equal((await last).status, 'cancelled');
    await assert.rejects(session.run('END\n'), /disposed/);
});

test('repeated and concurrent instances do not share interpreter variables or input', async t => {
    const session = sessionFor(t);
    const first = await session.run('secret% = 99\nEND\n');
    assert.equal(first.status, 'completed', JSON.stringify(first.error));
    const second = await session.run('PRINT secret%\nEND\n');
    assert.equal(second.status, 'error', JSON.stringify(second.error));
    assert.match(second.error.message, /variable/i);
    const sessions = [session, sessionFor(t)];
    const results = await Promise.all(sessions.map((current, index) =>
        current.run('INPUT "" name$\nPRINT name$\nEND\n', {input: `${index}\n`})));
    assert.deepEqual(results.map(result => textLines(result.text)), ['\n0\n', '\n1\n']);
    assert.deepEqual(results.map(result => result.status), ['completed', 'completed']);
});

test('busy sessions reject concurrent runs and invalid inputs are rejected before starting', async t => {
    const session = sessionFor(t);
    await assert.rejects(session.run('END\n', {input: '€'}), /Latin-1/);
    await assert.rejects(session.run('END\n', {input: new Uint8Array(1024 * 1024 + 1)}), /1 MiB/);
    await assert.rejects(session.run('END\n', {timeoutMs: 0}), /timeoutMs/);
    const pending = session.run('REPEAT\nUNTIL FALSE\n');
    await assert.rejects(session.run('END\n'), /already running/);
    assert.equal(session.cancel(), true);
    assert.equal((await pending).status, 'cancelled');
    assert.equal(session.cancel(), false);
});

test('missing WASM assets are host failures with a reusable idle session', async t => {
    const session = sessionFor(t, {moduleURL: new URL('../.build/wasm/missing.mjs', import.meta.url)});
    const result = await session.run('END\n');
    assert.equal(result.status, 'host-error');
    assert.equal(result.error.kind, 'host');
    assert.equal(session.state, 'idle');
});

test('a worker exit or malformed result cannot impersonate successful BASIC completion', async t => {
    for (const body of [
        'parentPort.close();',
        'parentPort.postMessage({version:1,type:"result",status:"completed",exitCode:null,diagnostics:""});',
        'parentPort.postMessage({version:99,type:"result",status:"completed",exitCode:0,diagnostics:""});'
    ]) {
        const workerURL = await fakeWorker(t, body);
        const session = sessionFor(t, {workerURL});
        const result = await session.run('END\n');
        assert.equal(result.status, 'host-error');
        assert.equal(session.state, 'idle');
    }
});

test('an event observer failure terminates the worker and releases the session', async t => {
    const session = sessionFor(t, {onEvent: event => {
        if (event.type === 'output') throw new Error('observer failed');
    }});
    const result = await session.run('REPEAT\nPRINT "event"\nUNTIL FALSE\n');
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /observer failed/);
    assert.equal(session.state, 'idle');
});
