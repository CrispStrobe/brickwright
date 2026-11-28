// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';
import path from 'node:path';

export const NATIVE_BENCHMARK_ROOT = 'overlay/scratch-gui/src/lib/bw-native-benchmarks';
// Reviewed together: the consumer rehashes cache/network bytes before cache,
// notices or return, and rehashes executable bytes before loading native code.
// A change to that ordering must be reviewed, not silently reclassified.
export const APPROVED_BENCHMARK_FILES = Object.freeze({
    'index.js': 'e8ee45ecc92842e69ec545f6dcdabd2fb9c6a5a17a7649f84cb7c2dac173d4a3',
    'provenance.json': 'a8edcd3e46823eab98de85614e6251923a95aa71a03d68723ca368b0e56c8c95',
    'catalog.json': 'c39788c934ffcfb89e9878a942ca8ffe39254a276f62355ec2a5ed876c70c093'
});
const safePath = value => typeof value === 'string' && value.split('/').every(part =>
    /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..');
export function nativeBenchmarkFetchPin(root, tracked, detectors) {
    const directory = path.join(root, NATIVE_BENCHMARK_ROOT);
    assert.ok(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink());
    const files = {};
    for (const [file, hash] of Object.entries(APPROVED_BENCHMARK_FILES)) {
        const name = `${NATIVE_BENCHMARK_ROOT}/${file}`, absolute = path.join(root, name);
        assert.ok(tracked.has(name), `Untracked benchmark provenance: ${file}`);
        const stat = lstatSync(absolute);
        assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'Benchmark proof must be a regular file');
        assert.ok(realpathSync(absolute).startsWith(realpathSync(root) + path.sep), 'Benchmark proof escaped checkout');
        files[file] = readFileSync(absolute);
        assert.equal(createHash('sha256').update(files[file]).digest('hex'), hash, `Unapproved benchmark proof bytes: ${file}`);
    }
    const provenance = JSON.parse(files['provenance.json']), catalog = JSON.parse(files['catalog.json']);
    assert.equal(provenance.repository, 'CrispStrobe/brickwright-media-lab');
    assert.equal(provenance.base, 'projects/x86-benchmarks');
    assert.equal(provenance.commit, '01d06fb63d5bdd4c0ede48e811e8fc1f6971d2ce');
    const mediaCommit = provenance.assetsCommit || provenance.commit;
    assert.equal(mediaCommit, 'c8dc584d39b69b1ed9f98af69e548d9da3d5b240');
    assert.match(mediaCommit, /^[0-9a-f]{40}$/);
    assert.ok(safePath(provenance.repository) && safePath(provenance.base));
    assert.ok(Object.keys(catalog).length > 0);
    for (const [project, item] of Object.entries(catalog)) {
        assert.ok(safePath(project) && safePath(item.directory || project));
        assert.ok(Object.keys(item.files).length > 0);
        for (const [name, proof] of Object.entries(item.files)) {
            assert.ok(safePath(name), 'Unsafe benchmark payload path');
            assert.ok(Number.isSafeInteger(proof.bytes) && proof.bytes > 0, 'Invalid benchmark byte count');
            assert.match(proof.sha256, /^[0-9a-f]{64}$/, 'Invalid benchmark SHA-256');
        }
    }
    const file = `${NATIVE_BENCHMARK_ROOT}/index.js`;
    const expected = 'raw.' + 'githubusercontent.com/${provenance.repository}/${mediaCommit}/${provenance.base}/';
    const found = [];
    for (const [kind, detector, only] of detectors) {
        if (only && !only.test(file)) continue;
        for (const match of files['index.js'].toString('utf8').matchAll(detector)) {
            const text = (match[1] ?? match[0]).trim().replace(/\s+/g, ' ');
            assert.equal(kind, 'raw', 'New benchmark fetch shape requires review');
            assert.equal(text, expected, 'New benchmark fetch site requires review');
            found.push(text);
        }
    }
    assert.equal(found.length, 1, 'Exactly one reviewed benchmark URL constructor is required');
    return {file, kind: 'raw', text: expected, class: 'validated-input',
        why: 'Tracked, exact SHA-256-frozen consumer, provenance and catalog constrain the owned repository, base and full media commit. Every catalog payload has a positive byte count and SHA-256; the reviewed consumer verifies cached and downloaded bytes before cache writes, notices or return, and executable bytes again before native loading. Source or metadata drift requires explicit review.'};
}
