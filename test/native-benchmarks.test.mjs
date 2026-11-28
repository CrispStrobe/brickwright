// SPDX-License-Identifier: BSD-3-Clause
// Fetch/cache controls are fixtures; they are not native execution evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const gui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const local = createRequire(new URL('../overlay/scratch-gui/src/lib/bw-native-benchmarks/index.js', import.meta.url));
const babel = gui('@babel/core');
const file = new URL('../overlay/scratch-gui/src/lib/bw-native-benchmarks/index.js', import.meta.url);
const {code} = babel.transformSync(readFileSync(file, 'utf8'), {filename: file.pathname,
    babelrc: false, configFile: false, plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs')]});
const module = {exports: {}};
new Function('require', 'module', 'exports', code)(local, module, module.exports);
const {fetchAssets, verifyBytes, catalog, provenance} = module.exports;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('startup/terminal helpers remain byte-identical to their pinned media identities', () => {
    for (const [name, proof] of Object.entries(provenance.files)) {
        const bytes = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-native-benchmarks/' + name, import.meta.url));
        assert.equal(bytes.length, proof.bytes); assert.equal(hash(bytes), proof.sha256);
    }
});
test('corrupt bytes, sizes and arbitrary project IDs refuse execution admission', async () => {
    const bytes = new Uint8Array([1, 2]);
    await assert.rejects(verifyBytes(bytes, {bytes: 1, sha256: hash(bytes)}, 'bad'), /Byte count/);
    await assert.rejects(verifyBytes(bytes, {bytes: 2, sha256: '0'.repeat(64)}, 'bad'), /SHA-256/);
    await assert.rejects(fetchAssets('__proto__'), /Unknown benchmark/);
});
test('HTTP error and cancellation remain errors, never cached accepted assets', async () => {
    await assert.rejects(fetchAssets('topbench', {cacheStorage: null, fetcher: async () => new Response('', {status: 503})}), /HTTP 503/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(fetchAssets('topbench', {signal: controller.signal, cacheStorage: null,
        fetcher: () => { throw Error('must not fetch'); }}), /Stopped/);
});
test('registered projects pin immutable metadata, licence and only owned inputs', () => {
    assert.match(provenance.commit, /^[a-f0-9]{40}$/);
    assert.equal(provenance.repository, 'CrispStrobe/brickwright-media-lab');
    for (const item of Object.values(catalog)) {
        for (const name of ['LICENSE', 'assets.json', 'brickwright-media.json']) assert.ok(item.files[name]);
        for (const proof of Object.values(item.files)) {
            assert.ok(proof.bytes > 0); assert.match(proof.sha256, /^[a-f0-9]{64}$/);
        }
    }
    assert.equal(catalog.whetstone.files['WHT.EXE'].sha256, 'f7003e37da058b1a41b8520b010c9791aafa10fa8a9cb11a4c0998055936b8ac');
    assert.ok(catalog.whetstone.files['RUNTIME-NOTICES.txt']);
    assert.ok(catalog.whetstone.files['licenses/COPYING.RUNTIME']);
});

test('cache hits are rehashed; corruption refetches; storage refusal keeps hash verification', async () => {
    const original = catalog.whetstone.files;
    const manifest = JSON.stringify(catalog.whetstone.manifest);
    const inputs = {'LICENSE': 'fixture permission', 'source/whetstone.c': 'fixture source',
        'assets.json': '{}', 'brickwright-media.json': manifest};
    const payloads = Object.fromEntries(Object.entries(inputs).map(([name, text]) => [name, new TextEncoder().encode(text)]));
    catalog.whetstone.files = Object.fromEntries(Object.entries(payloads).map(([name, bytes]) => [name, {bytes: bytes.length, sha256: hash(bytes)}]));
    const saved = new Map(), fetched = [], notices = [];
    const store = {open: async () => ({match: async url => saved.get(url)?.clone(),
        put: async (url, response) => {saved.set(url, response);}, delete: async url => saved.delete(url)})};
    const fetcher = async url => {const name = url.split('/' + catalog.whetstone.directory + '/')[1]; fetched.push(name); return new Response(payloads[name]);};
    try {
        await fetchAssets('whetstone', {fetcher, cacheStorage: store, onNotice: notice => notices.push(notice)});
        assert.equal(fetched.length, 4); assert.deepEqual(notices, ['fixture permission']);
        await fetchAssets('whetstone', {cacheStorage: store, fetcher: () => {throw Error('cache should satisfy');}});
        const url = [...saved.keys()].find(key => key.endsWith('/LICENSE'));
        saved.set(url, new Response('corrupted'));
        fetched.length = 0;
        await fetchAssets('whetstone', {fetcher, cacheStorage: store}); assert.deepEqual(fetched, ['LICENSE']);
        await assert.rejects(fetchAssets('whetstone', {cacheStorage: {open: async () => {throw Error('denied');}},
            fetcher: async () => new Response('incorrect')}), /Byte count|SHA-256/);
    } finally {catalog.whetstone.files = original;}
});

test('same-sized corrupt network bytes never reach cache, notices or returned assets', async () => {
    const original = catalog.topbench.files;
    const bytes = new TextEncoder().encode('owned fixture licence');
    catalog.topbench.files = {LICENSE: {bytes: bytes.length, sha256: hash(bytes)}};
    const corrupt = bytes.slice(); corrupt[0] ^= 1;
    const calls = [];
    try {
        await assert.rejects(fetchAssets('topbench', {
            cacheStorage: {open: async () => ({match: async () => undefined,
                put: async () => calls.push('cache-write')})},
            fetcher: async () => new Response(corrupt),
            onNotice: () => calls.push('notice')
        }), /SHA-256/);
        assert.deepEqual(calls, []);
    } finally { catalog.topbench.files = original; }
});


test('the MIT Sieve only admits its verified raw image', async () => {
    const {runNativeBenchmark} = module.exports;
    const project = 'native-sieve';
    const {manifest, files} = catalog[project];
    assert.equal(manifest.license, 'MIT');
    assert.equal(manifest.kind, 'native-i80386-raw');
    assert.deepEqual(manifest.slots, {raw: 'SIEVE.BIN'});
    assert.equal(files['SIEVE.BIN'].sha256, 'ec78198054f2c65a49db577c7110c40f807437dc6dea6163231422a5306d8db8');
    await assert.rejects(runNativeBenchmark({project, files: {}}), /executable unavailable/);
    await assert.rejects(runNativeBenchmark({project, files: {'SIEVE.BIN': new Uint8Array(375)}}), /SHA-256 mismatch/);
});
