import assert from 'node:assert/strict';
import test from 'node:test';
import {createWasmSession} from '../browser.mjs';
import {createNativeSession} from '../src/native-session.mjs';
import {corpus} from './wasm-corpus.mjs';

for (const fixture of corpus) {
    test(`native/WASM parity with fixed anchors: ${fixture.name}`, async t => {
        const sessions = [createNativeSession(), createWasmSession()];
        for (const session of sessions) t.after(() => session.dispose());
        const expected = fixture.bytes ?? [...Buffer.from(fixture.text, 'latin1')];
        const results = await Promise.all(sessions.map(session => session.run(fixture.source, {
            filename: `${fixture.name}.bas`, input: fixture.input ?? ''
        })));
        for (const result of results) {
            assert.equal(result.status, 'completed', `${result.backend}: ${JSON.stringify(result.error)}`);
            assert.equal(result.exitCode, fixture.exitCode ?? 0);
            assert.deepEqual([...result.output], expected, result.backend);
            assert.equal(result.text, Buffer.from(result.output).toString('latin1'));
        }
        assert.deepEqual(results[0].output, results[1].output);
    });
}
