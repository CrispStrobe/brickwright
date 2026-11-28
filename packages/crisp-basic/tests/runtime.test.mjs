import assert from 'node:assert/strict';
import {access, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createNativeSession} from '../index.mjs';

const executable = fileURLToPath(new URL('../.build/crispbasic-native', import.meta.url));
const textLines = text => text.replace(/\r\n/g, '\n');

function sessionFor(t, options = {}) {
    const session = createNativeSession({executable, ...options});
    t.after(() => session.dispose());
    return session;
}

async function fakeExecutable(t, body) {
    const directory = await mkdtemp(path.join(tmpdir(), 'crispbasic-protocol-test-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const filename = path.join(directory, 'backend.mjs');
    await writeFile(filename, `#!${process.execPath}\nimport {writeSync} from 'node:fs';\n${body}\n`, {mode: 0o700});
    return filename;
}

test('native integration requires a built executable; absence is not a passing skip', async () => {
    await access(executable, constants.X_OK);
});

test('the real core executes structured BASIC, procedures, functions, arrays and strings', async t => {
    const session = sessionFor(t);
    const result = await session.run(`DIM values%(4)
FOR i% = 0 TO 4
    values%(i%) = i% * i%
NEXT
total% = 0
i% = 0
WHILE i% <= 4
    total% += values%(i%)
    i% += 1
ENDWHILE
REPEAT
    total% -= 1
UNTIL total% = 28
IF total% = 28 THEN
    PROCemit("ok")
ELSE
    PROCemit("wrong")
ENDIF
PRINT STR$(FNdouble(total%))
END
DEF PROCemit(value$)
    LOCAL decorated$
    decorated$ = LEFT$(value$, 1) + RIGHT$(value$, 1)
    PRINT decorated$
ENDPROC
DEF FNdouble(value%) = value% * 2
`, {filename: 'structured.bas'});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(textLines(result.text), 'ok\n56\n');
    assert.equal(result.exitCode, 0);
    assert.equal(session.state, 'idle');
    assert.ok(result.output instanceof Uint8Array);
    assert.equal(result.text, Buffer.from(result.output).toString('latin1'));
});

test('raw VDU bytes are preserved without ANSI translation or UTF-8 replacement', async t => {
    const session = sessionFor(t);
    const result = await session.run('VDU 22,8,25,69,0,1,128,255\nEND\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual([...result.output], [22, 8, 25, 69, 0, 1, 128, 255]);
});

test('streamed output and terminal events agree with the final result', async t => {
    const events = [];
    const session = sessionFor(t, {onEvent: event => events.push(event)});
    const result = await session.run('PRINT "stream"\nVDU 128,255\nEND\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    const streamed = events.filter(event => event.type === 'output').flatMap(event => [...event.bytes]);
    assert.deepEqual(streamed, [...result.output]);
    const completed = events.filter(event => event.type === 'result');
    assert.equal(completed.length, 1);
    assert.equal(completed[0].result.status, 'completed');
});

test('empty and blank-only programs complete without banners or REPL prompts', async t => {
    const session = sessionFor(t);
    for (const source of ['', '\n\n']) {
        const result = await session.run(source);
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.output.length, 0);
    }
});

test('compact numbered lines, bare line numbers and tab whitespace reach the real tokenizer', async t => {
    const session = sessionFor(t);
    const result = await session.run('10PRINT "compact"\n20\n30\tvalue%\t= 7\n40PRINT STR$(value%)\n50END\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(textLines(result.text), 'compact\n7\n');
});

test('BASIC errors use the native status channel and map to the original editor line', async t => {
    const session = sessionFor(t);
    const result = await session.run('REM first line\n\nERROR 100, "expected failure"\n', {
        filename: 'broken.bas'
    });
    assert.equal(result.status, 'error');
    assert.equal(result.error.kind, 'basic');
    assert.equal(result.error.code, 100);
    assert.match(result.error.message, /expected failure/);
    assert.equal(result.error.filename, 'broken.bas');
    assert.equal(result.error.line, 3);
    assert.equal(result.error.basicLine, 3);
    assert.notEqual(result.exitCode, 0);
});

test('explicit BASIC line numbers map back to physical source lines', async t => {
    const session = sessionFor(t);
    const result = await session.run('100 REM first line\n\n450 ERROR 101, "numbered failure"\n', {
        filename: 'numbered.bas'
    });
    assert.equal(result.status, 'error');
    assert.equal(result.error.basicLine, 450);
    assert.equal(result.error.line, 3);
});

test('native tokenizer rejects overlong token records instead of silently truncating source', async t => {
    const session = sessionFor(t);
    const result = await session.run(`REM first\nPRINT "${'a'.repeat(300)}"\n`, {
        filename: 'too-long.bas'
    });
    assert.equal(result.status, 'error');
    assert.match(result.error.message, /tokenized|too long|255/i);
    assert.equal(result.error.line, 2);
    assert.equal(result.output.length, 0);
});

test('ON ERROR handles an error inside BASIC without turning success into host failure', async t => {
    const session = sessionFor(t);
    const result = await session.run(`ON ERROR PRINT "handled" : END
ERROR 100, "deliberate"
PRINT "unreachable"
`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(textLines(result.text), 'handled\n');
});

test('QUIT preserves an intentional nonzero program exit without fabricating a runtime error', async t => {
    const session = sessionFor(t);
    const result = await session.run('PRINT "leaving"\nQUIT 7\nPRINT "unreachable"\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.exitCode, 7);
    assert.equal(result.error, undefined);
    assert.equal(textLines(result.text), 'leaving\n');
});

test('text resembling errors or REPL markers remains ordinary program output', async t => {
    const session = sessionFor(t);
    const result = await session.run(`PRINT "Mistake at line 1"
PRINT ">RUN"
PRINT ">*QUIT"
PRINT "Error 100: this is text"
END
`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(textLines(result.text), 'Mistake at line 1\n>RUN\n>*QUIT\nError 100: this is text\n');
});

test('runtime INPUT consumes data separately from the loaded program', async t => {
    const session = sessionFor(t);
    const result = await session.run('INPUT "" name$\nPRINT "hello " + name$\nEND\n', {
        input: 'Ada\n'
    });
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.match(textLines(result.text), /hello Ada\n$/);
});

test('interactive INPUT requests can be answered through the session event API', async t => {
    let requests = 0;
    const session = sessionFor(t, {onEvent: event => {
        if (event.type === 'input' && event.method === 'line') {
            requests++;
            session.writeInput('Lin\n');
            session.endInput();
        }
    }});
    const result = await session.run('INPUT "" name$\nPRINT "hello " + name$\nEND\n', {interactive: true});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(requests, 1);
    assert.match(textLines(result.text), /hello Lin\n$/);
    assert.throws(() => session.writeInput('late\n'), /input stream|interactive/i);
});

test('input EOF is a reported error rather than a spin or successful completion', async t => {
    const session = sessionFor(t, {timeoutMs: 2000});
    const result = await session.run('INPUT "" name$\nPRINT name$\nEND\n');
    assert.equal(result.status, 'error');
    assert.match(result.error.message, /input|end.of.file|EOF/i);
});

test('nonblocking INKEY reports no key at EOF and still consumes buffered keys', async t => {
    const session = sessionFor(t);
    for (const [input, expected] of [['', '-1\n'], ['x', '120\n']]) {
        const result = await session.run('PRINT STR$(INKEY(0))\nEND\n', {input});
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(textLines(result.text), expected);
    }
});

test('INKEY after CRLF line input skips residual LF without blocking on an open stream', async t => {
    const session = sessionFor(t, {timeoutMs: 1000});
    for (const interactive of [false, true]) {
        const result = await session.run('INPUT "" name$\nPRINT STR$(INKEY(0))\nEND\n', {
            input: 'Ada\r\n', interactive
        });
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.text.trim(), '-1');
    }
});

test('timed INKEY waits for its deadline and returns without requiring stdin EOF', async t => {
    const session = sessionFor(t, {timeoutMs: 2000});
    const result = await session.run('PRINT STR$(INKEY(5))\nEND\n', {interactive: true});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(textLines(result.text), '-1\n');
    assert.ok(result.durationMs >= 35, `INKEY(5) returned prematurely after ${result.durationMs}ms`);
});

test('an infinite loop is bounded by the wall-clock deadline', {timeout: 10000}, async t => {
    const session = sessionFor(t, {timeoutMs: 100});
    const start = performance.now();
    const result = await session.run('REPEAT\nUNTIL FALSE\n');
    assert.equal(result.status, 'timeout');
    assert.ok(performance.now() - start < 5000);
    assert.equal(session.state, 'idle');
});

test('output limit truncates at the configured byte budget and stops execution', async t => {
    const session = sessionFor(t, {maxOutputBytes: 128});
    const result = await session.run('REPEAT\nPRINT "abcdefghij"\nUNTIL FALSE\n');
    assert.equal(result.status, 'output-limit');
    assert.equal(result.output.length, 128);
    assert.equal(session.state, 'idle');
});

test('AbortSignal cancels a running core and leaves the session reusable', {timeout: 10000}, async t => {
    const session = sessionFor(t);
    const controller = new AbortController();
    const pending = session.run('REPEAT\nUNTIL FALSE\n', {signal: controller.signal});
    const timer = setTimeout(() => controller.abort(), 100);
    t.after(() => clearTimeout(timer));
    const result = await pending;
    assert.equal(result.status, 'cancelled');
    const again = await session.run('PRINT "reused"\nEND\n');
    assert.equal(again.status, 'completed', JSON.stringify(again.error));
    assert.equal(textLines(again.text), 'reused\n');
});

test('reset cancels in-flight work and waits for the old process to finish', {timeout: 10000}, async t => {
    const session = sessionFor(t);
    const pending = session.run('REPEAT\nUNTIL FALSE\n');
    await session.reset();
    const result = await pending;
    assert.equal(result.status, 'cancelled');
    assert.equal(session.state, 'idle');
    const again = await session.run('PRINT "after reset"\nEND\n');
    assert.equal(again.status, 'completed', JSON.stringify(again.error));
    assert.equal(textLines(again.text), 'after reset\n');
});

test('each run starts with fresh interpreter memory', async t => {
    const session = sessionFor(t);
    const first = await session.run('secret% = 99\nEND\n');
    assert.equal(first.status, 'completed', JSON.stringify(first.error));
    const second = await session.run('PRINT secret%\nEND\n');
    assert.equal(second.status, 'error');
    assert.match(second.error.message, /variable/i);
});

test('busy and disposed sessions reject invalid lifecycle operations', async t => {
    const session = sessionFor(t);
    const pending = session.run('REPEAT\nUNTIL FALSE\n');
    await assert.rejects(async () => session.run('END\n'), /running|busy/i);
    session.cancel();
    assert.equal((await pending).status, 'cancelled');
    await session.dispose();
    assert.equal(session.state, 'disposed');
    await assert.rejects(async () => session.run('END\n'), /disposed/i);
});

test('concurrent dispose calls both await process termination and workspace cleanup', {timeout: 10000}, async t => {
    const fake = await fakeExecutable(t, `
process.stdout.write(JSON.stringify({pid: process.pid, directory: process.cwd()}) + "\\n");
setInterval(() => {}, 1000);
`);
    let signalReady;
    const ready = new Promise(resolve => { signalReady = resolve; });
    let startup = '';
    const session = sessionFor(t, {executable: fake, onEvent: event => {
        if (event.type !== 'output') return;
        startup += Buffer.from(event.bytes).toString('latin1');
        const newline = startup.indexOf('\n');
        if (newline !== -1) signalReady(JSON.parse(startup.slice(0, newline)));
    }});
    const pending = session.run('END\n');
    let runSettled = false;
    pending.then(() => { runSettled = true; });
    const child = await ready;

    const first = session.dispose();
    const second = session.dispose();
    const verifyDisposal = async disposal => {
        await disposal;
        assert.equal(runSettled, true, 'dispose resolved before the active run finished');
        assert.equal(session.state, 'disposed');
        assert.throws(() => process.kill(child.pid, 0), {code: 'ESRCH'});
        await assert.rejects(access(child.directory), {code: 'ENOENT'});
    };
    await Promise.all([verifyDisposal(first), verifyDisposal(second)]);
    assert.equal((await pending).status, 'cancelled');
});

test('missing executable is a host error with no lingering running state', async t => {
    const session = sessionFor(t, {executable: `${executable}.does-not-exist`});
    const result = await session.run('END\n');
    assert.equal(result.status, 'host-error');
    assert.equal(result.error.kind, 'host');
    assert.equal(session.state, 'idle');
});

test('a zero-exit child without native completion is not mistaken for a successful BASIC run', async t => {
    const fake = await fakeExecutable(t, 'process.stdout.write("unfinished");');
    const session = sessionFor(t, {executable: fake});
    const result = await session.run('END\n');
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /valid completion/i);
    assert.equal(session.state, 'idle');
});

test('malformed or contradictory native completion produces a host error', async t => {
    for (const body of [
        'writeSync(3, "not JSON\\n");',
        'writeSync(3, JSON.stringify({type:"result",version:1,status:"completed",exitCode:0}) + "\\n"); process.exitCode = 7;'
    ]) {
        const fake = await fakeExecutable(t, body);
        const session = sessionFor(t, {executable: fake});
        const result = await session.run('END\n');
        assert.equal(result.status, 'host-error');
        assert.equal(session.state, 'idle');
    }
});

test('observer failure stops the process instead of stranding a running session', async t => {
    const session = sessionFor(t, {onEvent: event => {
        if (event.type === 'output') throw new Error('observer failed');
    }});
    const result = await session.run('REPEAT\nPRINT "event"\nUNTIL FALSE\n');
    assert.equal(result.status, 'host-error');
    assert.match(result.error.message, /observer failed/);
    assert.equal(session.state, 'idle');
});
