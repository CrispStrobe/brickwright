// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {compileSource} from '../src/compiler/index.mjs';

const compiler = process.env.AVR_CC || 'avr-gcc';
const available = spawnSync(compiler, ['--version']).status === 0;
const required = process.env.CRISPBASIC_REQUIRE_AVR_TOOLCHAIN === '1';

test('sequential BASIC statements reuse AVR stack storage', {skip: !available && !required && 'AVR GCC unavailable'}, async t => {
    assert.ok(available, `Required AVR compiler is unavailable: ${compiler}`);
    const directory = await mkdtemp(path.join(tmpdir(), 'crispbasic-stack-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const frames = [];
    for (const count of [1, 50]) {
        const stem = path.join(directory, 'print' + count);
        await writeFile(stem + '.c', compileSource('PRINT 1.25\n'.repeat(count) + 'END\n', {target: 'arduino-uno'}).c);
        const built = spawnSync(compiler, ['-std=c99', '-Os', '-mmcu=atmega328p', '-DF_CPU=16000000UL',
            '-mdouble=64', '-mlong-double=64', '-ffunction-sections', '-fdata-sections', '-fstack-usage',
            '-c', stem + '.c', '-o', stem + '.o'], {encoding: 'utf8', timeout: 30000});
        assert.ifError(built.error);
        assert.equal(built.status, 0, built.stderr);
        const rows = (await readFile(stem + '.su', 'utf8')).trim().split('\n');
        const programFrames = rows.filter(row => /:(?:cb_program|main)(?:\.[^\t]*)?\t/.test(row));
        assert.ok(programFrames.length, 'AVR stack-usage report contains program/main frames');
        frames.push(programFrames.reduce((sum, row) => sum + Number(row.split('\t')[1]), 0));
    }
    // GCC may inline the one-statement program into main, while outlining its
    // print helper for a larger program. Compare the combined program/main
    // storage, allowing only small register/inlining overhead, not one cb_value
    // frame for every statement.
    t.diagnostic(`AVR program/main stack frames: one statement ${frames[0]} bytes; 50 statements ${frames[1]} bytes`);
    assert.ok(frames[1] <= frames[0] + 64, `50 statements use ${frames[1]} bytes versus ${frames[0]} for one`);
});
