import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directlyExecutesChildProcessGate as executes,
    directlyExecutesPromisifiedGate as promisified} from '../scripts/lib/gate-promisified-exec.mjs';

const gate = 'verify-example.mjs';
const child = "import {execFileSync} from 'node:child_process';";
const direct = "execFileSync(process.execPath, ['scripts/verify-example.mjs']);";

test('direct child coverage follows the imported program argument', () => {
    for (const source of [
        child + direct,
        "import {spawn, spawnSync, execFile, fork} from 'node:child_process'; spawn(process.execPath, ['scripts/verify-example.mjs']);",
        "import {spawnSync} from 'node:child_process'; spawnSync('node', ['./scripts/verify-example.mjs']);",
        "import {execFile} from 'node:child_process'; execFile(process.execPath, ['scripts/verify-example.mjs'], () => {});",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs');",
        "import {execFileSync as run} from 'node:child_process'; run(process.execPath, ['scripts/verify-example.mjs']);",
        "import * as childProcess from 'node:child_process'; childProcess.execFileSync(process.execPath, ['scripts/verify-example.mjs']);",
        "import childProcess from 'node:child_process'; const run = childProcess.execFileSync; run(process.execPath, ['scripts/verify-example.mjs']);",
        child + " const node = process.execPath; const program = 'scripts/verify-example.mjs'; execFileSync(node, [program]);",
        child + " const program = 'scripts/verify-example.mjs'; const selected = program; execFileSync(process.execPath, [selected]);",
        child + " import {join} from 'node:path'; const S = join(import.meta.dirname, '..', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S]);",
        child + " import path from 'node:path'; import {fileURLToPath} from 'node:url'; const here = path.dirname(fileURLToPath(import.meta.url)); const S = path.resolve(here, '..', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S]);",
        child + " import {fileURLToPath} from 'node:url'; const S = fileURLToPath(new URL('../scripts/verify-example.mjs', import.meta.url)); execFileSync(process.execPath, [S]);",
        "import {fork} from 'node:child_process'; fork(new URL('../scripts/verify-example.mjs', import.meta.url));",
        child + " import proc from 'node:process'; execFileSync(proc.execPath, ['scripts/verify-example.mjs']);",
        child + " process.env.EXAMPLE_MODE = '1'; " + direct
    ]) assert.equal(executes(source, gate), true, source);
});

test('Node preload options do not replace the executed entry point', () => {
    for (const options of [
        "'--import', './scripts/lib/register-gui-scope.mjs', ",
        "'--import=./scripts/lib/register-gui-scope.mjs', ",
        "'--no-warnings', '--require', './setup.cjs', ",
        "'--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ",
        "'--', "
    ]) assert.equal(executes(child + `execFileSync(process.execPath, [${options}'scripts/${gate}']);`, gate), true);
    for (const argv of [
        "['--import', 'scripts/verify-example.mjs']",
        "['--import=scripts/verify-example.mjs', 'scripts/other.mjs']",
        "['--eval', 'scripts/verify-example.mjs']",
        "['-p', 'scripts/verify-example.mjs']",
        "['--unknown', 'scripts/verify-example.mjs']",
        "['scripts/other.mjs', 'scripts/verify-example.mjs']",
        "['--import', ...preloads, 'scripts/verify-example.mjs']"
    ]) assert.equal(executes(child + `execFileSync(process.execPath, ${argv});`, gate), false, argv);
});

test('census data, source strings and unrelated subprocesses are not gate execution', () => {
    for (const source of [
        child + " const rows = [{file: 'scripts/verify-example.mjs'}]; execFileSync('/usr/bin/python3', ['-I', '-c', probe]);",
        child + " const program = 'scripts/verify-example.mjs'; execFileSync(process.execPath, ['scripts/other.mjs']);",
        // gate-shapes-allow: deliberate negative fixture: a Python executable must never count as running a Node gate.
        child + " const program = 'scripts/verify-example.mjs'; execFileSync('python3', [program]);",
        child + " const description = \"execFileSync(process.execPath, ['scripts/verify-example.mjs']);\";",
        child + " // execFileSync(process.execPath, ['scripts/verify-example.mjs']);\n",
        // gate-shapes-allow: deliberate negative fixture: an unrelated git invocation must not make a path mention coverage.
        child + " readFileSync('scripts/verify-example.mjs'); execFileSync('git', ['status']);",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs-other']);",
        child + " execFileSync(process.execPath, ['scripts/other/../elsewhere/verify-example.mjs']);"
    ]) assert.equal(executes(source, gate), false, source);
    const actual = readFileSync(new URL('./fetch-pinning.test.mjs', import.meta.url), 'utf8');
    assert.ok(actual.includes("file: 'scripts/verify-machine-video-boot.mjs'"));
    assert.equal(executes(actual, 'verify-machine-video-boot.mjs'), false,
        'the real fetch census reads a source path and executes unrelated Python; it never launches this browser gate');
});

test('import identity, shadowing and mutation remain refusals', () => {
    for (const source of [
        direct,
        "import {execFileSync} from 'unrelated'; " + direct,
        child + " function pretend(execFileSync) { " + direct + ' }',
        child + " function pretend(process) { " + direct + ' }',
        child + " const process = fake; " + direct,
        child + " process.execPath = '/other'; " + direct,
        child + " const proc = process; proc.execPath = '/other'; " + direct,
        "import proc from 'node:process'; " + child + " proc.execPath = '/other'; execFileSync(proc.execPath, ['scripts/verify-example.mjs']);",
        "import * as cp from 'node:child_process'; cp.execFileSync = fake; cp.execFileSync(process.execPath, ['scripts/verify-example.mjs']);",
        "import * as cp from 'node:child_process'; const alias = cp; alias.execFileSync = fake; cp.execFileSync(process.execPath, ['scripts/verify-example.mjs']);",
        child + " const program = 'scripts/verify-example.mjs'; function pretend(program) { execFileSync(process.execPath, [program]); }",
        child + " let program = 'scripts/verify-example.mjs'; execFileSync(process.execPath, [program]);",
        child + " const program = 'scripts/verify-example.mjs'; program = 'scripts/other.mjs'; execFileSync(process.execPath, [program]);",
        child + " import {join} from 'unrelated'; const S = join(import.meta.dirname, '..', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S]);",
        child + " import {join} from 'node:path'; function pretend(join) { const S = join(import.meta.dirname, '..', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S]); }",
        child + " const URL = fake; const S = new URL('../scripts/verify-example.mjs', import.meta.url); execFileSync(process.execPath, [S]);",
        child + " import {join} from 'node:path'; const S = join('/different-checkout', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S]);",
        'invalid JavaScript {'
    ]) assert.equal(executes(source, gate), false, source);
});


test('cwd and fork overrides preserve the repository program and Node identity', () => {
    for (const source of [
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: process.cwd()});",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {shell: false});",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs', [], {execArgv: [], shell: false});",
        child + " import {resolve} from 'node:path'; const ROOT = resolve(import.meta.dirname, '..'); execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: ROOT});",
        child + " const options = {cwd: process.cwd()}; const selected = options; execFileSync(process.execPath, ['scripts/verify-example.mjs'], selected);",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: new URL('../', import.meta.url)});",
        child + " import {resolve} from 'node:path'; process.chdir('/elsewhere'); const S = resolve(import.meta.dirname, '..', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S], {cwd: '/different-checkout'});",
        child + " import {resolve} from 'node:path'; process.chdir('/elsewhere'); const ROOT = resolve(import.meta.dirname, '..'); execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: ROOT});",
        "import {fork} from 'node:child_process'; fork(new URL('../scripts/verify-example.mjs', import.meta.url), [], {cwd: '/different-checkout', execPath: process.execPath});",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs', {execPath: process.execPath});",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs', [], {execPath: 'node', cwd: process.cwd()});"
    ]) assert.equal(executes(source, gate), true, source);
    for (const source of [
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: '/different-checkout'});",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {shell: '/other-shell'});",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {shell: true});",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs', [], {execArgv: ['-e', '0']});",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: unknownDirectory});",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], unknownOptions);",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {...unknownOptions});",
        child + " execFileSync(process.execPath, ['scripts/verify-example.mjs'], {__proto__: unknownOptions});",
        child + " const options = {cwd: process.cwd()}; options.cwd = '/elsewhere'; execFileSync(process.execPath, ['scripts/verify-example.mjs'], options);",
        child + " process.chdir('/elsewhere'); execFileSync(process.execPath, ['scripts/verify-example.mjs']);",
        child + " process['chdir']('/elsewhere'); execFileSync(process.execPath, ['scripts/verify-example.mjs']);",
        child + " import {chdir as move} from 'node:process'; move('/elsewhere'); execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: '.'});",
        child + " process.chdir('/elsewhere'); execFileSync(process.execPath, ['scripts/verify-example.mjs'], {cwd: process.cwd()});",
        child + " import {resolve} from 'node:path'; process.chdir('/elsewhere'); const S = resolve('scripts/verify-example.mjs'); execFileSync(process.execPath, [S]);",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs', {execPath: '/other'});",
        "import {fork} from 'node:child_process'; fork(new URL('../scripts/verify-example.mjs', import.meta.url), [], {execPath: unknownNode});",
        "import {fork} from 'node:child_process'; fork('scripts/verify-example.mjs', [], {cwd: '/different-checkout'});",
        child + " import {resolve} from 'node:path'; import.meta.dirname = '/elsewhere'; const S = resolve(import.meta.dirname, '..', 'scripts', 'verify-example.mjs'); execFileSync(process.execPath, [S]);",
        "import {fork} from 'node:child_process'; import.meta.url = 'file:///different/test.mjs'; fork(new URL('../scripts/verify-example.mjs', import.meta.url));",
        "import {fork} from 'node:child_process'; const meta = import.meta; meta.url = 'file:///different/test.mjs'; fork(new URL('../scripts/verify-example.mjs', import.meta.url));"
    ]) assert.equal(executes(source, gate), false, source);
});

test('the existing promisified recognizer still owns its exact call form', () => {
    const source = "import {execFile} from 'node:child_process'; import {promisify} from 'node:util'; " +
        "promisify(execFile)(process.execPath, ['scripts/verify-example.mjs']);";
    assert.equal(executes(source, gate), false);
    assert.equal(promisified(source, gate), true);
});
