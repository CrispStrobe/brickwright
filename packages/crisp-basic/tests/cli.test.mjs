import assert from 'node:assert/strict';
import {execFile, spawn} from 'node:child_process';
import {access, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url));
const executable = fileURLToPath(new URL('../.build/crispbasic-native', import.meta.url));
const textLines = text => text.replace(/\r\n/g, '\n');

function runCli(args) {
    return new Promise((resolve, reject) => {
        execFile(process.execPath, [cli, ...args], {
            timeout: 10000,
            maxBuffer: 2 * 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error && typeof error.code !== 'number') return reject(error);
            resolve({code: error?.code ?? 0, stdout, stderr});
        });
    });
}

async function programFile(t, source, basename = 'program.bas') {
    const directory = await mkdtemp(path.join(tmpdir(), 'crispbasic-cli-test-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const filename = path.join(directory, basename);
    await writeFile(filename, source, 'utf8');
    return filename;
}

test('CLI integration requires the real built native core', async () => {
    await access(executable, constants.X_OK);
});

test('CLI identifies CrispBASIC and explains its commands', async () => {
    const help = await runCli(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /CrispBASIC/);
    assert.match(help.stdout, /--json/);
    assert.match(help.stdout, /--timeout/);
    const version = await runCli(['--version']);
    assert.equal(version.code, 0);
    assert.match(version.stdout, /\d+\.\d+\.\d+/);
});

test('CLI executes a file with spaces in its path and emits only program output', async t => {
    const filename = await programFile(t, 'PRINT "CrispBASIC works"\nEND\n', 'hello world.bas');
    const result = await runCli([filename]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(textLines(result.stdout), 'CrispBASIC works\n');
    assert.equal(result.stderr, '');
});

test('JSON mode emits one parseable result without interleaved program text', async t => {
    const filename = await programFile(t, 'PRINT "json output"\nEND\n');
    const result = await runCli([filename, '--json']);
    assert.equal(result.code, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'completed');
    assert.equal(textLines(parsed.text), 'json output\n');
});

test('CLI errors use the source filename and physical line number', async t => {
    const filename = await programFile(t, 'REM first\n\nERROR 100, "CLI failure"\n');
    const result = await runCli([filename, '--json']);
    assert.equal(result.code, 1);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'error');
    assert.equal(parsed.error.line, 3);
    assert.equal(parsed.error.filename, filename);
    assert.match(parsed.error.message, /CLI failure/);
});

test('CLI returns the program exit code for an intentional QUIT', async t => {
    const filename = await programFile(t, 'QUIT 7\n');
    const result = await runCli([filename, '--json']);
    assert.equal(result.code, 7);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'completed');
    assert.equal(parsed.exitCode, 7);
});

test('CLI --input supplies runtime data without changing source loading', async t => {
    const filename = await programFile(t, 'INPUT "" name$\nPRINT "hello " + name$\nEND\n');
    const inputFile = path.join(path.dirname(filename), 'input.txt');
    await writeFile(inputFile, 'Grace\n');
    const result = await runCli([filename, '--input', inputFile]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(textLines(result.stdout), /hello Grace\n$/);
});

test('CLI deadline stops a nonterminating program with exit 124', async t => {
    const filename = await programFile(t, 'REPEAT\nUNTIL FALSE\n');
    const result = await runCli([filename, '--timeout', '100', '--json']);
    assert.equal(result.code, 124);
    assert.equal(JSON.parse(result.stdout).status, 'timeout');
});

test('CLI output budget terminates excessive output with exit 125', async t => {
    const filename = await programFile(t, 'REPEAT\nPRINT "abcdefghij"\nUNTIL FALSE\n');
    const result = await runCli([filename, '--max-output', '64', '--json']);
    assert.equal(result.code, 125);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'output-limit');
    assert.equal(Buffer.byteLength(parsed.text, 'latin1'), 64);
});

test('a broken output pipe waits for native process and workspace cleanup', {timeout: 10000}, async t => {
    const filename = await programFile(t, `SYS "getpid" TO pid%
PRINT STR$(pid%)
OSCLI "pwd"
INPUT "" ready$
FOR i% = 1 TO 1000
PRINT STRING$(200, "x")
NEXT
channel% = OPENOUT("output-ready.txt")
CLOSE#channel%
REPEAT
UNTIL FALSE
`);
    // Leave stdout unread: the CLI queues more than the pipe capacity, then
    // the native program enters its silent loop. Closing the downstream pipe
    // must clean up that process, not crash Node and abandon it.
    const child = spawn(process.execPath, [cli, filename, '--timeout', '5000'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', bytes => { stderr += bytes.toString('utf8'); });
    const closed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({code, signal}));
    });
    let nativePid;
    let workspace;
    let startup = '';
    const identifyNative = bytes => {
        startup += bytes.toString('latin1');
        const match = /^(\d+)\r?\n([^\r\n]+)\r?\n/.exec(startup);
        if (!match) return;
        nativePid = Number(match[1]);
        workspace = match[2];
        child.stdout.pause();
        child.stdout.removeListener('data', identifyNative);
        child.stdin.end('\n');
    };
    child.stdout.on('data', identifyNative);
    t.after(async () => {
        // The unfixed behavior leaves a detached child. Reap it even when an
        // assertion fails so this regression test cannot leak a busy process.
        if (nativePid) {
            try { process.kill(-nativePid, 'SIGKILL'); } catch { /* Already reaped. */ }
        }
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        await closed.catch(() => {});
        if (workspace) await rm(workspace, {recursive: true, force: true});
    });

    let ready = false;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && !ready) {
        assert.equal(child.exitCode, null, `CLI exited before output was ready: ${stderr}`);
        if (nativePid && workspace) {
            try {
                await access(path.join(workspace, 'output-ready.txt'));
                ready = true;
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
        if (!ready) await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(ready, 'native program did not finish its output before the deadline');
    child.stdout.destroy();
    const result = await closed;
    assert.equal(result.signal, null);
    assert.equal(result.code, 141, stderr);
    assert.doesNotMatch(stderr, /Unhandled|node:events|WriteWrap|at .*file:\/\//);
    assert.throws(() => process.kill(nativePid, 0), {code: 'ESRCH'});
    await assert.rejects(access(workspace), {code: 'ENOENT'});
});

test('invalid CLI arguments fail clearly without running the source', async t => {
    const filename = await programFile(t, 'PRINT "must not run"\nEND\n');
    for (const args of [
        [filename, '--timeout', 'not-a-number'],
        [filename, '--timeout', '0'],
        [filename, '--max-output', '-1'],
        [filename, '--unknown-option']
    ]) {
        const result = await runCli(args);
        assert.notEqual(result.code, 0);
        assert.doesNotMatch(result.stdout, /must not run/);
        assert.ok(result.stderr.length > 0);
    }
});

test('unreadable source files fail without a native crash or stack trace', async () => {
    const result = await runCli(['/this-path-does-not-exist/crispbasic.bas']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /ENOENT|not found|no such file/i);
    assert.doesNotMatch(result.stderr, /at (?:async )?file:\/\//);
});
