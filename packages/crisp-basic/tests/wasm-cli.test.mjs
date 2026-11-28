import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url));
const normalized = text => text.replace(/\r\n/g, '\n');

async function files(t, source, fixture) {
    const directory = await mkdtemp(join(tmpdir(), 'crispbasic-wasm-cli-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const program = join(directory, 'program with spaces.bas');
    await writeFile(program, source);
    const simulation = join(directory, 'pins.json');
    if (fixture !== undefined) await writeFile(simulation, JSON.stringify(fixture));
    return {program, simulation, directory};
}

function runCli(args, input = '') {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, '--backend', 'wasm', ...args], {stdio: ['pipe', 'pipe', 'pipe']});
        let stdout = '', stderr = '';
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('WASM CLI did not finish')); }, 10000);
        child.stdout.setEncoding('utf8').on('data', bytes => { stdout += bytes; });
        child.stderr.setEncoding('utf8').on('data', bytes => { stderr += bytes; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', (code, signal) => { clearTimeout(timer); resolve({code, signal, stdout, stderr}); });
        child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
        child.stdin.end(input);
    });
}

test('portable CLI qualification requires the real WASM artifact', async () => {
    await readFile(new URL('../.build/wasm/crispbasic.mjs', import.meta.url));
    const bytes = await readFile(new URL('../.build/wasm/crispbasic.wasm', import.meta.url));
    assert.equal(WebAssembly.validate(bytes), true);
});

test('WASM CLI executes structured source, Latin-1 bytes and intentional exit status', async t => {
    const {program} = await files(t, 'FOR i% = 1 TO 3\nPRINT STR$(i%*i%)\nNEXT\nVDU 128,255\nQUIT 7\n');
    const result = await runCli([program, '--json']);
    assert.equal(result.code, 7, result.stderr);
    assert.equal(result.signal, null);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.backend, 'bbcsdl-wasm');
    assert.equal(parsed.status, 'completed');
    assert.equal(parsed.exitCode, 7);
    assert.equal(normalized(parsed.text), '1\n4\n9\n\x80\xff');
    assert.deepEqual(Buffer.from(parsed.outputBase64, 'base64'), Buffer.from(parsed.text, 'latin1'));
    assert.equal(result.stderr, '');
});

test('WASM CLI supplies both piped and file input and terminates after EOF', async t => {
    const {program, directory} = await files(t, 'INPUT "" name$\nPRINT "hello " + name$\nEND\n');
    const piped = await runCli([program], 'Ada\n');
    assert.equal(piped.code, 0, piped.stderr);
    assert.match(normalized(piped.stdout), /hello Ada\n$/);
    const input = join(directory, 'answer.txt');
    await writeFile(input, 'Grace\n');
    const fromFile = await runCli([program, '--input', input]);
    assert.equal(fromFile.code, 0, fromFile.stderr);
    assert.match(normalized(fromFile.stdout), /hello Grace\n$/);
    const eof = await runCli([program, '--json']);
    assert.equal(eof.code, 1);
    assert.match(JSON.parse(eof.stdout).error.message, /input|EOF/i);
});

test('WASM CLI preserves physical source diagnostics and restricted-host errors', async t => {
    const {program} = await files(t, 'REM source header\n\nERROR 100, "portable failure"\n');
    const result = await runCli([program, '--json']);
    const parsed = JSON.parse(result.stdout);
    assert.equal(result.code, 1);
    assert.equal(parsed.error.line, 3);
    assert.equal(parsed.error.filename, program);
    assert.equal(parsed.error.message, 'portable failure');
    await writeFile(program, 'SYS "getpid" TO pid%\n');
    const restricted = await runCli([program, '--json']);
    assert.equal(restricted.code, 1);
    assert.equal(JSON.parse(restricted.stdout).status, 'error');
    assert.match(JSON.parse(restricted.stdout).error.message, /not available|not supported/i);
    await writeFile(program, 'PRINT "🙂"\n');
    const sourceError = await runCli([program, '--json']);
    assert.equal(sourceError.code, 1);
    assert.equal(JSON.parse(sourceError.stdout).status, 'source-error');
});

test('WASM CLI timeout and output bounds have stable terminal exit codes', async t => {
    const {program} = await files(t, 'REPEAT\nUNTIL FALSE\n');
    const timed = await runCli([program, '--timeout', '100', '--json']);
    assert.equal(timed.code, 124, timed.stderr);
    assert.equal(JSON.parse(timed.stdout).status, 'timeout');
    await writeFile(program, 'REPEAT\nPRINT "abcdefghij"\nUNTIL FALSE\n');
    const bounded = await runCli([program, '--max-output', '64', '--json']);
    assert.equal(bounded.code, 125, bounded.stderr);
    const parsed = JSON.parse(bounded.stdout);
    assert.equal(parsed.status, 'output-limit');
    assert.equal(Buffer.from(parsed.outputBase64, 'base64').length, 64);
});

test('portable simulation fixtures execute BASIC and expose deterministic final traces', async t => {
    const {program, simulation} = await files(t, `PROCpinMode(0, "output")
PROCpinMode(1, "input-pullup")
PROCdigitalWrite(0, 1)
PRINT STR$(FNdigitalRead(1))
PROCdelay(25)
PROCdigitalToggle(0)
PRINT STR$(FNdigitalRead(1)) + ":" + STR$(FNmillis)
END
`, {schemaVersion: 1, pins: [0, 1], maxRequests: 20, inputs: [{pin: 1, value: 0, atMs: 25}]});
    const first = await runCli([program, '--simulation', simulation, '--json']);
    const second = await runCli([program, '--simulation', simulation, '--json']);
    assert.equal(first.code, 0, first.stderr);
    assert.equal(second.code, 0, second.stderr);
    const one = JSON.parse(first.stdout), two = JSON.parse(second.stdout);
    assert.equal(normalized(one.text), '1\n0:25\n');
    assert.equal(one.simulation.capabilities.hardware, false);
    assert.equal(one.simulation.capabilities.circuitPhysics, false);
    assert.equal(one.simulation.elapsedMs, 25);
    assert.deepEqual(one.simulation, two.simulation);
    assert.deepEqual(one.simulation.trace.map(({type}) => type), [
        'pin-mode', 'pin-mode', 'digital-write', 'digital-read', 'input', 'delay', 'digital-toggle', 'digital-read'
    ]);
    assert.deepEqual(one.simulation.trace.find(({type}) => type === 'digital-toggle'),
        {sequence: 7, atMs: 25, type: 'digital-toggle', pin: 0, value: 0});
});

test('simulation budget is terminal and retains the completed trace', async t => {
    const {program, simulation} = await files(t, `ON ERROR PRINT "must not catch" : END
PROCpinMode(0, "output")
PROCdigitalWrite(0, 1)
PROCdigitalToggle(0)
END
`, {schemaVersion: 1, pins: [0], maxRequests: 2});
    const result = await runCli([program, '--simulation', simulation, '--json']);
    assert.equal(result.code, 125, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'simulation-limit');
    assert.equal(parsed.error.code, 'request-limit');
    assert.doesNotMatch(parsed.text, /must not catch/);
    assert.deepEqual(parsed.simulation.trace.map(({type}) => type), ['pin-mode', 'digital-write']);
});

test('invalid simulation fixtures never run or emit partial program output', async t => {
    const {program, simulation} = await files(t, 'PRINT "must not execute"\nEND\n',
        {schemaVersion: 1, pins: [0], inputs: [{pin: 1, value: 0, atMs: 1}]});
    const result = await runCli([program, '--simulation', simulation, '--json']);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /unknown logical pin/i);
});

// Windows forcibly terminates another process for child.kill('SIGTERM'); it
// does not deliver POSIX signals to its JavaScript handler. Timeout, output
// and request-budget termination above run identically on every host.
if (process.platform !== 'win32') test('SIGTERM cancels the portable worker and completes the CLI result', {timeout: 10000}, async t => {
    const {program} = await files(t, 'PRINT "ready"\nREPEAT\nUNTIL FALSE\n');
    const child = spawn(process.execPath, [cli, '--backend', 'wasm', program, '--timeout', '5000'],
        {stdio: ['pipe', 'pipe', 'pipe']});
    t.after(() => child.kill('SIGKILL'));
    let output = '', diagnostics = '';
    child.stdout.setEncoding('utf8').on('data', text => {
        output += text;
        if (output.includes('ready')) child.kill('SIGTERM');
    });
    child.stderr.setEncoding('utf8').on('data', text => { diagnostics += text; });
    child.stdin.end();
    const result = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({code, signal}));
    });
    assert.match(output, /ready/);
    assert.equal(result.signal, null);
    assert.equal(result.code, 130, diagnostics);
    assert.match(diagnostics, /cancelled/);
});
