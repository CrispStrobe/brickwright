// SPDX-License-Identifier: BSD-3-Clause
// Runtime range errors must preserve the already-produced bytes and stop at
// the source statement, rather than silently wrap a typed BASIC assignment.
import assert from 'node:assert/strict';
import test from 'node:test';
import {workspace, build, execute} from './compiler-regression-helpers.mjs';

export function registerCompilerNumericErrors({name, createSession, numericProfile}) {
    const statements = [
        'a%=2147483648',
        'a%=-2147483649',
        'a%=2147483647:a%+=1',
        'a%=-2147483648:a%-=1',
        'a%=4294967296.0',
        'a%=1E100',
        'PRINT (9223372036854775808.0>>0)',
        'PRINT (1E100<<1)',
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
}
