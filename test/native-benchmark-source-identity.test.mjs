// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBenchmarkSourceHead} from '../scripts/lib/native-benchmark-source-identity.mjs';

test('native benchmark receipt uses the explicitly supplied Git executable and actual HEAD', () => {
    const sha = 'a'.repeat(40);
    const calls = [];
    const result = nativeBenchmarkSourceHead('/provided/git', '/project', (program, args, options) => {
        calls.push({program, args, options}); return `${sha}\n`;
    });
    assert.equal(result, sha);
    assert.deepEqual(calls, [{program: '/provided/git', args: ['rev-parse', '--verify', 'HEAD^{commit}'], options: {cwd: '/project', encoding: 'utf8'}}]);
});

test('missing, relative or malformed source identity is refused', () => {
    assert.throws(() => nativeBenchmarkSourceHead(undefined, '/project'), /BW_GIT_EXECUTABLE/);
    assert.throws(() => nativeBenchmarkSourceHead('git', '/project'), /absolute path/);
    assert.throws(() => nativeBenchmarkSourceHead('/provided/git', '/project', () => 'main\n'), /full source commit/);
});
