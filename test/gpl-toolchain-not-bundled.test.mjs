/**
 * SDCC is GPL-2.0-or-later and this app is BSD-3-Clause. These are the
 * source-level halves of that separation; `scripts/verify-no-gpl-in-build.mjs`
 * is the half that inspects a real build, which a unit test cannot do because
 * `npm test` runs before the editor is built.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
    getToolchainMode, setToolchainMode, localToolchainEnabled,
    GPL_TOOLCHAIN_ORIGIN, TOOLCHAIN_FILES
} from './helpers/toolchain-fixture.mjs';

const read = p => readFileSync(p, 'utf8');
const CONFIGS = [
    'overlay/scratch-gui/webpack.config.js',
    'packages/scratch-gui/webpack.config.js'
];

test('neither webpack config copies the GPL toolchain into the build', () => {
    for (const path of CONFIGS) {
        const src = read(path);
        assert.equal(/from:\s*'src\/lib\/sdcc-wasm\/dist'/.test(src), false,
            `${path} still copies the SDCC toolchain into the build output`);
        assert.equal(/to:\s*'static\/sdcc-wasm'/.test(src), false,
            `${path} still writes static/sdcc-wasm`);
    }
});

test('both configs are checked, so the overlay cannot drift from the mirror', () => {
    // integrate.mjs copies overlay -> packages, so fixing only one is a fix that
    // survives until the next integrate. Assert the pair really is a pair.
    for (const path of CONFIGS) assert.ok(read(path).includes('sdcc-wasm'),
        `${path} lost the comment explaining why the copy is absent — without it ` +
        'a future edit re-adds the rule with nothing to read');
});

const winWith = (storage, search = '', hash = '') => ({location: {search, hash}, localStorage: storage});

test('the default is online: no GPL is fetched unless a user asks', () => {
    const store = new Map();
    const fake = {getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v)};
    assert.equal(getToolchainMode(fake), 'online');
    // The predicate takes a WINDOW, not a storage — it has to read the URL too,
    // and it must be reachable without a browser.
    assert.equal(localToolchainEnabled(winWith(fake)), false);
    setToolchainMode('local', fake);
    assert.equal(getToolchainMode(fake), 'local');
    assert.equal(localToolchainEnabled(winWith(fake)), true);
    setToolchainMode('nonsense', fake);
    assert.equal(getToolchainMode(fake), 'online', 'an unknown value falls back to the safe default');
});

test('storage that throws still yields the safe default', () => {
    const hostile = {getItem () { throw new Error('denied'); }, setItem () { throw new Error('denied'); }};
    assert.equal(getToolchainMode(hostile), 'online');
    assert.doesNotThrow(() => setToolchainMode('local', hostile));
});

test('the toolchain origin is the GPL repository, not this app', () => {
    assert.match(GPL_TOOLCHAIN_ORIGIN, /^https:\/\/crispstrobe\.github\.io\/sdcc-wasm\//);
    // Every file loadToolchain asks for must be primeable, or "works offline"
    // is only true for the ones someone remembered.
    for (const name of ['cc1.js', 'cc1.wasm', 'sdcc.js', 'sdcc.wasm',
        'sdas8051.js', 'sdas8051.wasm', 'sdld.js', 'sdld.wasm', 'runtime.json']) {
        assert.ok(TOOLCHAIN_FILES.includes(name), `${name} is loaded but never cached`);
    }
});

test('the route is gated on the SETTING, not on the capability', () => {
    const intercept = read('overlay/scratch-gui/src/lib/sdcc-wasm/intercept.js');
    assert.match(intercept, /toolchainEnabled\(\)\s*&&\s*localTargetSupported\(/,
        'intercept must consult the user setting before claiming a compile');
    assert.match(intercept, /toolchainEnabled = localToolchainEnabled/,
        'the predicate must be INJECTED with the real one as its default — a routing ' +
        'decision reachable only through a live session cannot be tested, which is how ' +
        'run 34160645833 went red');
    const compiler = read('overlay/scratch-gui/src/lib/sdcc-wasm/compiler.js');
    assert.equal(/loadToolchain\(document\.baseURI\)/.test(compiler), false,
        'the toolchain must not be loaded from the app origin — that is what bundled it');
});

// ---- the cache primitives, with fakes -----------------------------------
// These are what make "opt in once, then work offline" true rather than
// aspirational, so they are asserted here instead of only in a browser.
import {primeToolchainCache, cachedResolver, TOOLCHAIN_CACHE, GPL_TOOLCHAIN_ORIGIN as ORIGIN}
    from './helpers/toolchain-fixture.mjs';

const fakeCaches = () => {
    const stores = new Map();
    const wrappers = new Map();
    return {
        stores,
        // One wrapper per name. The first version returned a NEW object per
        // open(), so the test that patched `.match` patched an instance the
        // code under test never saw, and the assertion measured nothing.
        open: async name => {
            if (!stores.has(name)) stores.set(name, new Map());
            const store = stores.get(name);
            if (!wrappers.has(name)) {
                wrappers.set(name, {
                    match: async url => store.get(url)?.clone(),
                    put: async (url, response) => store.set(url, response.clone()),
                    delete: async url => store.delete(url)
                });
            }
            return wrappers.get(name);
        }
    };
};
const fakeResponse = body => new Response(`payload:${body}`, {status: 200});

test('priming fetches every file the loader will ask for, once', async () => {
    const caches_ = fakeCaches();
    const asked = [];
    const fetch_ = async url => { asked.push(url); return fakeResponse(url); };
    const stored = await primeToolchainCache(ORIGIN, {caches: caches_, fetch: fetch_});
    assert.equal(stored.length, TOOLCHAIN_FILES.length);
    assert.equal(asked.length, TOOLCHAIN_FILES.length, 'one fetch per file');
    for (const url of asked) assert.ok(url.startsWith(ORIGIN), `${url} left the GPL origin`);

    // Second prime must hit the cache, not the network — otherwise "kept on
    // their device" costs a download every session.
    asked.length = 0;
    await primeToolchainCache(ORIGIN, {caches: caches_, fetch: fetch_});
    assert.deepEqual(asked, [], 'a primed cache re-fetched');
});

test('priming reports a bad response instead of caching it', async () => {
    const caches_ = fakeCaches();
    const fetch_ = async () => ({ok: false, status: 404, clone () { return this; }});
    await assert.rejects(
        () => primeToolchainCache(ORIGIN, {caches: caches_, fetch: fetch_}),
        /404/, 'a 404 must not be cached as if it were the toolchain');
});

test('the resolver serves verified blobs and finishes a partial cache through verification', async () => {
    const caches_ = fakeCaches();
    const fetch_ = async url => fakeResponse(url);
    await primeToolchainCache(ORIGIN, {caches: caches_, fetch: fetch_});
    // Drop one file, so the cache is PARTIAL — the state a cancelled prime
    // leaves behind. Removed from the store itself, not by patching the
    // wrapper, so the code under test sees the same absence a browser would.
    caches_.stores.get(TOOLCHAIN_CACHE).delete(`${ORIGIN}static/sdcc-wasm/sdld.wasm`);

    let made = 0;
    const URL_ = {createObjectURL: () => `blob:fake-${++made}`};
    const fetched = [];
    const resolve = await cachedResolver(ORIGIN, {caches: caches_, URL: URL_,
        fetch: async url => { fetched.push(url); return fakeResponse(url); }});
    assert.match(resolve('sdcc.wasm'), /^blob:/, 'a cached file comes from the cache');
    assert.match(resolve('sdld.wasm'), /^blob:/, 'a fetched file also passes through the verified snapshot');
    assert.deepEqual(fetched, [`${ORIGIN}static/sdcc-wasm/sdld.wasm`]);
    assert.throws(() => resolve('unknown.js'), /Unknown SDCC package member/);
});

// ---- the unification ----------------------------------------------------
// One predicate now decides the route. Two settings with opposite defaults, each
// unaware of the other, produced a silent fallback to the network; these pin the
// precedence that replaced them.
test('an explicit request beats any default, in both directions', () => {
    const off = {getItem: k => (k === 'bwLocalCompiler' ? 'off' : null)};
    const on = {getItem: k => (k === 'bw-sdcc-toolchain' ? 'local' : null)};
    // A default arriving later must not overturn a request already made.
    assert.equal(localToolchainEnabled(winWith(off)), false, 'stored off is a request');
    assert.equal(localToolchainEnabled(winWith(on, '?localCompiler=off')), false,
        '?localCompiler=off beats a stored opt-in');
    // The mirror, which is the route out for a learner stuck offline before any
    // settings dialog exists.
    assert.equal(localToolchainEnabled(winWith(off, '?localCompiler=on')), true,
        '?localCompiler=on beats a stored off');
    assert.equal(localToolchainEnabled(winWith(null, '?localCompiler=on')), true,
        'and works with no storage at all');
    // Present-but-unset is not a request.
    assert.equal(localToolchainEnabled(winWith(off, '?localCompiler=')), false);
});

test('hash-routed lesson URLs carry the explicit compiler request', () => {
    const off = {getItem: k => (k === 'bwLocalCompiler' ? 'off' : null)};
    const on = {getItem: k => (k === 'bw-sdcc-toolchain' ? 'local' : null)};
    assert.equal(localToolchainEnabled(winWith(off, '', '#/lesson?localCompiler=on')), true,
        'adding the documented flag after a lesson hash enables the local toolchain');
    assert.equal(localToolchainEnabled(winWith(on, '', '#/lesson?localCompiler=off')), false,
        'the hash route is symmetric');
    assert.equal(localToolchainEnabled(
        winWith(null, '?localCompiler=off', '#/lesson?localCompiler=on')), false,
    'the page query wins when both URL regions contain the setting');
    assert.equal(localToolchainEnabled(
        winWith(off, '?localCompiler=', '#/lesson?localCompiler=on')), true,
    'an empty page placeholder cannot swallow the routed opt-in');
});

test('under Node with no storage the local toolchain is the honest answer', () => {
    // `online` answers "what may we SHIP", a question that does not exist in a
    // harness with no bundle and no user. Sending the disk-backed smoke test at
    // a network origin is how CI run 34160645833 went red.
    assert.equal(getToolchainMode(null), 'local');
    assert.equal(localToolchainEnabled(undefined), true);
    // But a Node caller that supplies a storage is asking for browser rules.
    assert.equal(getToolchainMode({getItem: () => null}), 'online');
});
