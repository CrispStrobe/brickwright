// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {buildCompiledC, resolveCompilerTarget} from '../src/compiler-targets.mjs';
import {compilerPlatform} from '../src/compiler/platform.mjs';
import {createSimulationHost} from '../src/simulation-host.mjs';

const cPrelude = '#include <stdint.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <limits.h>\n' +
    'static void cb_fail(const char *message) { fprintf(stderr,"%s\\n",message); exit(1); }\n';
const gcc = spawnSync(process.env.CC || 'gcc', ['--version']).status === 0;

test('compiler target names are distinct from host-driven interpreter targets', () => {
    assert.equal(resolveCompilerTarget('rp2040').id, 'pico');
    assert.equal(resolveCompilerTarget('uno').id, 'arduino-uno');
    assert.equal(resolveCompilerTarget('native').id, 'native');
    assert.throws(() => resolveCompilerTarget('stm32'), /Unknown compiler target/);
    assert.throws(() => compilerPlatform('stm32'), /Unknown compiler platform/);
});

test('native generated platform trace agrees with the independent logical host', {skip: !gcc && 'gcc unavailable'}, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'crispbasic-platform-'));
    try {
        const sourcePath = path.join(dir, 'program.c'), output = path.join(dir, 'program');
        await writeFile(sourcePath, cPrelude + compilerPlatform('native') + `
int main(void) {
    cb_platform_init();
    cb_platform_pin_mode(13, 1);
    cb_platform_pin_mode(2, 2);
    cb_platform_write(13, 1);
    cb_platform_delay(25);
    cb_platform_toggle(13);
    cb_platform_pin_mode(13, 0);
    cb_platform_pin_mode(13, 1);
    cb_platform_putchar((unsigned char)('0' + cb_platform_read(13)));
    cb_platform_putchar((unsigned char)('0' + cb_platform_read(2)));
    cb_platform_putchar((unsigned char)('A' + cb_platform_millis() / 25));
    return 0;
}
`);
        const built = await buildCompiledC({sourcePath, output});
        assert.equal(built.validation.status, 'build-only');
        assert.equal(built.validation.simulator, 'not-run');
        assert.equal(built.artifacts[0].format, 'executable');
        const traceFile = path.join(dir, 'trace.jsonl');
        const run = spawnSync(output, [], {env: {...process.env, CRISPBASIC_TRACE: traceFile}, encoding: 'utf8', timeout: 10000});
        assert.equal(run.status, 0, run.stderr);
        assert.equal(run.stdout, '01B');
        const host = createSimulationHost({pins: [13, 2]});
        host.pinMode(13, 'output'); host.pinMode(2, 'input-pullup');
        host.digitalWrite(13, 1); host.delay(25); host.digitalToggle(13);
        host.pinMode(13, 'input'); host.pinMode(13, 'output');
        host.digitalRead(13); host.digitalRead(2);
        const trace = (await readFile(traceFile, 'utf8')).trim().split('\n').map(JSON.parse);
        assert.deepEqual(trace, host.trace);
    } finally { await rm(dir, {recursive: true, force: true}); }
});

test('native platform rejects an undriven input instead of inventing a level', {skip: !gcc && 'gcc unavailable'}, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'crispbasic-floating-'));
    try {
        const sourcePath = path.join(dir, 'program.c'), output = path.join(dir, 'program');
        await writeFile(sourcePath, cPrelude + compilerPlatform('native') +
            '\nint main(void) { cb_platform_init(); return cb_platform_read(2); }\n');
        await buildCompiledC({sourcePath, output});
        const run = spawnSync(output, [], {encoding: 'utf8', timeout: 10000});
        assert.equal(run.status, 1);
        assert.match(run.stderr, /floating input/);
    } finally { await rm(dir, {recursive: true, force: true}); }
});

test('missing toolchains and unsafe artifact collisions fail without a success receipt', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'crispbasic-build-failure-'));
    try {
        const sourcePath = path.join(dir, 'program.c');
        await writeFile(sourcePath, 'int main(void) { return 0; }\n');
        await assert.rejects(buildCompiledC({sourcePath, output: sourcePath}), /must not replace/);
        await assert.rejects(buildCompiledC({sourcePath, target: 'uno', output: path.join(dir, 'program.elf')}), /\.hex/);
        await assert.rejects(buildCompiledC({sourcePath, output: path.join(dir, 'program'), cc: path.join(dir, 'missing-compiler')}),
            error => error.code === 'toolchain-unavailable');
        await assert.rejects(buildCompiledC({sourcePath, target: 'pico', output: path.join(dir, 'program.uf2'), picoSdkPath: path.join(dir, 'no-sdk')}),
            error => error.code === 'toolchain-unavailable');
    } finally { await rm(dir, {recursive: true, force: true}); }
});
