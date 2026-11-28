import assert from 'node:assert/strict';
import test from 'node:test';
import {createNativeSession} from '../index.mjs';
import {nativeOptions} from './native-test-target.mjs';
import {corpus} from './wasm-corpus.mjs';

// Exercise the same anchored corpus on every CPU, including ARM32 recursion,
// DATA/string heap layouts and byte I/O, without requiring a WASM build there.
for (const fixture of corpus) {
    test(`native CPU fixed anchor: ${fixture.name}`, async t => {
        const session = createNativeSession(nativeOptions());
        t.after(() => session.dispose());
        const result = await session.run(fixture.source, {
            filename: `${fixture.name}.bas`, input: fixture.input ?? ''
        });
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.exitCode, fixture.exitCode ?? 0);
        const expected = fixture.bytes ?? [...Buffer.from(fixture.text, 'latin1')];
        assert.deepEqual([...result.output], expected);
    });
}
