// SPDX-License-Identifier: BSD-3-Clause
// NEXT retains the tags of its limit and increment, and tests its sum before
// coercing that sum to the loop variable's storage type.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import {compileSource} from '../src/compiler/index.mjs';
import {registerCompilerParity} from './compiler-parity-runner.mjs';

const exec = promisify(execFile);
const fixtures = [
    {
        name: 'FOR compares fractional sums before integer variable storage',
        source: `count%=0
FOR i%=0 TO .5 STEP .75
PRINT i%
count%+=1
IF count%>3 THEN EXIT FOR
NEXT
PRINT count%;i%
count%=0
FOR i%=0 TO -.5 STEP -.75
PRINT i%
count%+=1
IF count%>3 THEN EXIT FOR
NEXT
PRINT count%;i%
END
`
    },
    {
        name: 'FOR preserves real-valued integral increments',
        source: `count%=0
FOR i=9007199254740992 TO 9007199254740992 STEP 1.0
PRINT i-9007199254740992
count%+=1
IF count%>3 THEN EXIT FOR
NEXT
PRINT count%
END
`
    }
];

export function registerCompilerFor(configuration) {
    registerCompilerParity({...configuration, fixtures});
    test(`independent C99 / BBCSDL ${configuration.name}: zero STEP retains target-profile handling`, async t => {
        const directory = await mkdtemp(join(tmpdir(), 'crispbasic-for-zero-'));
        t.after(() => rm(directory, {recursive: true, force: true}));
        const session = configuration.createSession();
        t.after(() => session.dispose());
        for (const step of ['0', '0.0', '-0.0']) {
            const source = `FOR i%=1 TO 2 STEP ${step}\nPRINT "entered"\nEXIT FOR\nNEXT\nEND\n`;
            const reference = await session.run(source, {filename: 'zero-step.bas'});
            const binary64NegativeZero = configuration.numericProfile === 'binary64' && step === '-0.0';
            assert.equal(reference.status, binary64NegativeZero ? 'completed' : 'error');
            if (!binary64NegativeZero) {
                assert.equal(reference.error.code, 35);
                assert.equal(reference.error.line, 1);
                assert.equal(reference.output.length, 0);
            }
            const cPath = join(directory, 'program.c');
            const binary = join(directory, 'program');
            await writeFile(cPath, compileSource(source, {
                filename: 'zero-step.bas',
                ...(configuration.numericProfile ? {numericProfile: configuration.numericProfile} : {})
            }).c);
            await exec(process.env.CRISP_BASIC_C99_CC || 'gcc', ['-std=c99', '-O2', cPath, '-lm', '-o', binary]);
            if (binary64NegativeZero) {
                const compiled = await exec(binary, [], {timeout: 5000, encoding: 'buffer'});
                assert.deepEqual(compiled.stdout, Buffer.from(reference.output));
                assert.equal(compiled.stderr.length, 0);
            } else {
                await assert.rejects(exec(binary, [], {timeout: 5000}), error => {
                    assert.equal(error.code, 1);
                    assert.equal(error.stdout, '');
                    assert.match(error.stderr, /BASIC line 1: STEP cannot be zero/);
                    return true;
                });
            }
        }
    });
}
