// SPDX-License-Identifier: BSD-3-Clause
// Runtime conversions must preserve the target reference's result or range
// error, including already-produced bytes and the source statement.
import assert from 'node:assert/strict';
import test from 'node:test';
import {workspace, build, execute} from './compiler-regression-helpers.mjs';

export function registerCompilerNumericErrors({name, createSession, numericProfile, saturatingIntegerConversions = false, armv7Native = false}) {
    const statements = [
        'a%=2147483648',
        'a%=-2147483649',
        'a%=2147483647:a%+=1',
        'a%=-2147483648:a%-=1',
        'a%=4294967296.0',
        'FOR i%=2147483647 TO 2147483647:PRINT ;i%:NEXT',
        'FOR i%=-2147483648 TO -2147483648 STEP -1:PRINT ;i%:NEXT'
    ];
    for (const statement of statements) {
        test(`independent C99 / BBCSDL ${name} range error: ${statement}`, async t => {
            const directory = await workspace(t);
            const source = `PRINT "before"\n${statement}\nPRINT "unreachable"\nEND\n`;
            const session = createSession();
            t.after(() => session.dispose());
            const reference = await session.run(source, {filename: 'range-error.bas'});
            assert.equal(reference.status, 'error', JSON.stringify(reference));
            assert.equal(reference.error.code, 20);
            assert.equal(reference.error.line, 2);
            const result = await execute(await build(directory, source, [], numericProfile));
            assert.equal(result.status, 1);
            assert.deepEqual(result.stdout, Buffer.from(reference.output));
            assert.match(result.stderr.toString(), /BASIC line 2: number too big/);
        });
    }

    for (const [value, armv7Value] of [
        ['1E100', '-1'], ['-1E100', '1'],
        ['18446744073709551616.0', '-1'], ['-18446744073709551616.0', '1'],
        ['18446744073709549568.0', '-2048'], ['-18446744073709549568.0', '2048']
    ]) {
        test(`independent C99 / BBCSDL ${name} real assignment conversion: ${value}`, async t => {
            const directory = await workspace(t);
            const source = `PRINT "before"\na%=${value}:PRINT ;a%\nPRINT "after"\nEND\n`;
            const session = createSession();
            t.after(() => session.dispose());
            const reference = await session.run(source, {filename: 'assignment-conversion.bas'});
            assert.equal(reference.status, armv7Native ? 'completed' : 'error', JSON.stringify(reference));
            const result = await execute(await build(directory, source, [], numericProfile));
            assert.deepEqual(result.stdout, Buffer.from(reference.output));
            if (armv7Native) {
                assert.equal(result.status, 0);
                assert.equal(result.stdout.toString('latin1'), `before\r\n${armv7Value}\r\nafter\r\n`);
                assert.equal(result.stderr.length, 0);
            } else {
                assert.equal(reference.error.code, 20);
                assert.equal(reference.error.line, 2);
                assert.equal(result.status, 1);
                assert.match(result.stderr.toString(), /BASIC line 2: number too big/);
            }
        });
    }

    // The native AArch64 build and the explicit WASM/binary64 profile have
    // different real-to-integer expression conversions. Pin both outcomes,
    // then compare independent executions; never drop these edge cases from
    // the ARM suite or infer the expected behavior from the compiler output.
    for (const [statement, saturated] of [
        ['PRINT (9223372036854775808.0>>0)', '9.22337204E18\r\n'],
        ['PRINT (1E100<<1)', '        -2\r\n']
    ]) {
        test(`independent C99 / BBCSDL ${name} integer conversion: ${statement}`, async t => {
            const directory = await workspace(t);
            const source = `PRINT "before"\n${statement}\nPRINT "after"\nEND\n`;
            const session = createSession();
            t.after(() => session.dispose());
            const reference = await session.run(source, {filename: 'integer-conversion.bas'});
            assert.equal(reference.status, saturatingIntegerConversions ? 'completed' : 'error', JSON.stringify(reference));
            const result = await execute(await build(directory, source, [], numericProfile));
            assert.deepEqual(result.stdout, Buffer.from(reference.output));
            if (saturatingIntegerConversions) {
                assert.equal(result.status, 0);
                assert.equal(result.stdout.toString('latin1'), `before\r\n${saturated}after\r\n`);
                assert.equal(result.stderr.length, 0);
            } else {
                assert.equal(reference.error.code, 20);
                assert.equal(reference.error.line, 2);
                assert.equal(result.status, 1);
                assert.match(result.stderr.toString(), /BASIC line 2: number too big/);
            }
        });
    }
}
