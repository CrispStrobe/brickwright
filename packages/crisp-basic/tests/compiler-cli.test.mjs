import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const cli = fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url));
function run(args, cwd) {
    return spawnSync(process.execPath, [cli, 'compile', ...args], {cwd, encoding: 'utf8', timeout: 30000});
}
async function workspace(t, source = 'PRINT "compiled"\nEND\n') {
    const dir = await mkdtemp(join(tmpdir(), 'crisp-compile-cli-'));
    t.after(() => rm(dir, {recursive: true, force: true}));
    await writeFile(join(dir, 'program.bas'), source);
    return dir;
}

test('compile CLI emits self-contained C99 and gcc executable with a truthful build receipt', async (t) => {
    const dir = await workspace(t);
    const result = run(['program.bas', '--json'], dir);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'built');
    assert.equal(receipt.target, 'native');
    assert.equal(receipt.metadata.interpreterEmbedded, false);
    assert.equal(receipt.validation.status, 'build-only');
    assert.equal(receipt.validation.simulator, 'not-run');
    const executable = spawnSync(join(dir, 'program'), [], {encoding: 'buffer', timeout: 5000});
    assert.ifError(executable.error);
    assert.equal(executable.status, 0);
    assert.equal(executable.stdout.toString('latin1'), 'compiled\r\n');
    assert.equal(receipt.artifacts[0].sha256.length, 64);
    assert.match(await readFile(join(dir, 'program.c'), 'utf8'), /int main\(/);
});

test('emit-c needs no toolchain and retains the requested target platform', async (t) => {
    const dir = await workspace(t, 'PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nEND\n');
    const result = run(
        ['program.bas', '--target', 'uno', '--emit-c', '--cc', '/missing/compiler', '--json'],
        dir
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'emitted');
    assert.equal(receipt.target, 'arduino-uno');
    assert.equal(receipt.validation.status, 'not-run');
    assert.match(await readFile(join(dir, 'program.c'), 'utf8'), /avr\/io.h/);
    assert.deepEqual((await readdir(dir)).sort(), ['program.bas', 'program.c']);
});

test('compiler refusal reports physical and BASIC source lines before writing outputs', async (t) => {
    const source = '10 REM EVAL in a comment is harmless\n100 PRINT EVAL("1+1")\n';
    const dir = await workspace(t, source);
    const result = run(['program.bas', '--json'], dir);
    assert.equal(result.status, 1);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'error');
    assert.equal(receipt.error.line, 2);
    assert.equal(receipt.error.basicLine, 100);
    assert.match(receipt.error.message, /EVAL/);
    assert.deepEqual(await readdir(dir), ['program.bas']);
    assert.equal(await readFile(join(dir, 'program.bas'), 'utf8'), source);
});

test('toolchain failure cannot produce a successful receipt', async (t) => {
    const dir = await workspace(t);
    const result = run(['program.bas', '--cc', join(dir, 'no-such-gcc'), '--json'], dir);
    assert.equal(result.status, 1);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'error');
    assert.equal(receipt.error.code, 'toolchain-unavailable');
    assert.deepEqual((await readdir(dir)).sort(), ['program.bas', 'program.c']);
});

test('compiler CLI prevents source replacement and rejects unknown target/options', async (t) => {
    const dir = await workspace(t);
    for (const args of [
        ['program.bas', '--output', 'program.bas'],
        ['program.bas', '--emit-c', '--output', 'program.bas'],
        ['program.bas', '--target', 'fictional'],
        ['program.bas', '--timeout', '0'],
        ['program.bas', '--unsafe-eval']
    ]) {
        const result = run(args, dir);
        assert.equal(result.status, 1);
    }
    assert.deepEqual(await readdir(dir), ['program.bas']);
});
