// SPDX-License-Identifier: BSD-3-Clause
// Errors specific to the binary64 BBCSDL WASM profile belong in its CI route.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createWasmSession} from '../index.mjs';
import {workspace, build, execute} from './compiler-regression-helpers.mjs';
import {registerCompilerNumericErrors} from './compiler-numeric-errors.mjs';

for (const statement of ['PRINT 1.7976931348623157E308', 'PRINT VAL("1.7976931348623157E308")', 'PRINT VAL("E512")']) {
    test(`binary64 decimal conversion preserves BBCSDL overflow: ${statement}`, async t => {
        const directory = await workspace(t);
        const source = `PRINT "before"\n${statement}\nPRINT "unreachable"\nEND\n`;
        const session = createWasmSession();
        t.after(() => session.dispose());
        const reference = await session.run(source);
        assert.equal(reference.status, 'error');
        assert.equal(reference.error.code, 20);
        const result = await execute(await build(directory, source, [], 'binary64'));
        assert.equal(result.status, reference.exitCode);
        assert.deepEqual(result.stdout, Buffer.from(reference.output));
        assert.match(result.stderr.toString(), /BASIC line 2:/);
    });
}

registerCompilerNumericErrors({name: 'binary64', numericProfile: 'binary64', createSession: () => createWasmSession()});
