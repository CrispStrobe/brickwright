import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
    primeToolchainCache, inspectToolchain, cachedResolver, measureToolchain,
    TOOLCHAIN_FILES, TOOLCHAIN_CACHE, GPL_TOOLCHAIN_ORIGIN as ORIGIN, fixtureBytes
} from './helpers/toolchain-fixture.mjs';
import {readRuntimePackageInventory, validateRuntimePackageInventory}
    from '../scripts/lib/runtime-package-inventory.mjs';

const urlOf = name => `${ORIGIN}static/sdcc-wasm/${name}`;
const nameOf = url => url.slice(url.lastIndexOf('/') + 1);
const validFetch = async url => new Response(fixtureBytes(nameOf(url)));
const corrupt = name => {
    const bytes = fixtureBytes(name);
    bytes[0] ^= 1; // Same length: rejection must come from the digest.
    return bytes;
};

function cacheHarness() {
    const entries = new Map();
    const opened = [];
    const stored = [];
    const deleted = [];
    const caches = {open: async name => {
        opened.push(name);
        assert.equal(name, TOOLCHAIN_CACHE);
        return {
            match: async url => entries.get(url)?.clone(),
            put: async (url, response) => { stored.push(url); entries.set(url, response.clone()); },
            delete: async url => { deleted.push(url); return entries.delete(url); }
        };
    }};
    return {entries, opened, stored, deleted, caches};
}

function urlHarness(failAt = Infinity) {
    const blobs = new Map();
    const revoked = [];
    return {blobs, revoked, URL: {
        createObjectURL: blob => {
            if (blobs.size === failAt) throw new Error('object URL allocation failed');
            const url = `blob:verified-${blobs.size}`;
            blobs.set(url, blob);
            return url;
        },
        revokeObjectURL: url => { revoked.push(url); }
    }};
}

test('the production inventory pins exactly nine immutable artifacts without clearing licenses', () => {
    const inventory = readRuntimePackageInventory();
    const record = inventory.packages.find(pkg => pkg.id === 'sdcc-wasm');
    assert.equal(record.integrity.status, 'sha256-pinned');
    assert.equal(record.integrity.algorithm, 'SHA-256');
    assert.equal(record.integrity.sourceRevision, '64ea6915733cf6d6563dfe9424c8cc71b4731e06');
    assert.deepEqual(Object.keys(record.integrity.artifacts), record.files);
    assert.equal(record.files.length, 9);
    assert.equal(record.compilerLicense.status, 'component-review-required');
    assert.equal(record.runtimeLicense.status, 'requires-file-level-review');
    assert.equal(record.delivery, 'optional-user-download');
    assert.equal(record.bundled, false);
});

test('inventory validation rejects incomplete digests and mutable or mismatched evidence', () => {
    const baseline = readRuntimePackageInventory();
    const mutations = [
        integrity => { delete integrity.artifacts['runtime.json']; },
        integrity => { integrity.artifacts['extra.js'] = integrity.artifacts['cc1.js']; },
        integrity => { integrity.artifacts['cc1.js'].sha256 = '0'.repeat(63); },
        integrity => { integrity.artifacts['cc1.js'].bytes = 0; },
        integrity => { integrity.artifacts['cc1.js'].bytes = 1.5; },
        integrity => { integrity.artifacts['cc1.js'].gitBlobSha = 'main'; },
        integrity => { integrity.algorithm = 'SHA-1'; },
        integrity => { integrity.sourceRevision = 'main'; },
        integrity => { integrity.sourceBaseUrl = 'https://example.invalid/main/'; },
        integrity => { integrity.sourceBaseUrl += '?revision=main'; }
    ];
    for (const mutate of mutations) {
        const inventory = structuredClone(baseline);
        mutate(inventory.packages[0].integrity);
        assert.throws(() => validateRuntimePackageInventory(inventory), /Runtime package inventory:/);
    }
});

test('all nine verified downloads are reusable offline as correctly typed immutable blob snapshots', async () => {
    const cache = cacheHarness();
    await primeToolchainCache(ORIGIN, {caches: cache.caches, fetch: validFetch});
    const noNetwork = async () => { throw new Error('offline: no request is permitted'); };
    const report = await inspectToolchain(ORIGIN, {caches: cache.caches, fetch: noNetwork});
    assert.equal(report.complete, true);
    assert.deepEqual(report.invalid, []);
    assert.equal(report.bytes, TOOLCHAIN_FILES.reduce((n, name) => n + fixtureBytes(name).length, 0));
    const urls = urlHarness();
    const resolve = await cachedResolver(ORIGIN, {caches: cache.caches, fetch: noNetwork, URL: urls.URL});
    assert.equal(urls.blobs.size, 9);
    // Changing storage after resolution cannot change the accepted snapshot.
    for (const name of TOOLCHAIN_FILES) {
        cache.entries.set(urlOf(name), new Response(corrupt(name)));
        const blob = urls.blobs.get(resolve(name));
        assert.deepEqual(Buffer.from(await blob.arrayBuffer()), fixtureBytes(name));
        assert.equal(blob.type, name.endsWith('.js') ? 'text/javascript' :
            (name.endsWith('.wasm') ? 'application/wasm' : 'application/json'));
    }
    assert.throws(() => resolve('../cc1.js'), /Unknown SDCC package member/);
    assert.throws(() => resolve('https://example.invalid/payload.js'), /Unknown SDCC package member/);
});

test('a same-size digest mismatch in any of the nine downloads is rejected before storage', async () => {
    for (const bad of TOOLCHAIN_FILES) {
        const cache = cacheHarness();
        const fetched = [];
        await assert.rejects(() => primeToolchainCache(ORIGIN, {caches: cache.caches,
            fetch: async url => {
                fetched.push(nameOf(url));
                return new Response(nameOf(url) === bad ? corrupt(bad) : fixtureBytes(nameOf(url)));
            }}), error => error.code === 'TOOLCHAIN_INTEGRITY' && error.message.includes(bad));
        assert.equal(cache.entries.has(urlOf(bad)), false, bad);
        assert.equal(cache.stored.includes(urlOf(bad)), false, bad);
        assert.equal(fetched.at(-1), bad, 'stop before any later member');
        assert.equal((await inspectToolchain(ORIGIN, {caches: cache.caches})).complete, false);
    }
});

test('offline inspection identifies every corrupt cached member and resume repairs only that member', async () => {
    const cache = cacheHarness();
    await primeToolchainCache(ORIGIN, {caches: cache.caches, fetch: validFetch});
    for (const bad of TOOLCHAIN_FILES) {
        cache.entries.set(urlOf(bad), new Response(corrupt(bad)));
        const report = await inspectToolchain(ORIGIN, {caches: cache.caches,
            fetch: () => { throw new Error('inspection reached the network'); }});
        assert.equal(report.complete, false);
        assert.deepEqual(report.invalid, [bad]);
        assert.deepEqual(report.missing, [bad]);
        assert.equal(report.present.length, 8);
        assert.equal(cache.entries.has(urlOf(bad)), true, 'inspection does not mutate storage');
        const requested = [];
        await primeToolchainCache(ORIGIN, {caches: cache.caches, fetch: async url => {
            requested.push(nameOf(url));
            return validFetch(url);
        }});
        assert.deepEqual(requested, [bad]);
        assert.ok(cache.deleted.includes(urlOf(bad)));
        assert.equal((await inspectToolchain(ORIGIN, {caches: cache.caches})).complete, true);
    }
    cache.entries.set(urlOf('runtime.json'), new Response(new Uint8Array()));
    assert.deepEqual((await inspectToolchain(ORIGIN, {caches: cache.caches})).invalid, ['runtime.json']);
});

test('no corrupt or missing member can escape through a resolver network fallback', async () => {
    for (const bad of TOOLCHAIN_FILES) {
        const cache = cacheHarness();
        await primeToolchainCache(ORIGIN, {caches: cache.caches, fetch: validFetch});
        cache.entries.set(urlOf(bad), new Response(corrupt(bad)));
        const urls = urlHarness();
        await assert.rejects(() => cachedResolver(ORIGIN, {
            caches: cache.caches, URL: urls.URL, fetch: async url => {
                assert.equal(nameOf(url), bad);
                return new Response(corrupt(bad));
            }
        }), error => error.code === 'TOOLCHAIN_INTEGRITY');
        assert.equal(urls.blobs.size, 0, 'verify the entire snapshot before exposing any member');
        assert.equal(cache.entries.has(urlOf(bad)), false);
    }
});

test('an explicit compile without Cache Storage still verifies all nine bytes before returning URLs', async () => {
    const requested = [];
    const urls = urlHarness();
    const resolve = await cachedResolver(ORIGIN, {URL: urls.URL, fetch: async url => {
        requested.push(nameOf(url));
        return validFetch(url);
    }});
    assert.deepEqual(requested, TOOLCHAIN_FILES);
    for (const name of TOOLCHAIN_FILES) assert.match(resolve(name), /^blob:/);
});

test('cancellation during digest verification never stores or exposes the in-flight member', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const realCrypto = globalThis.crypto;
    const controller = new AbortController();
    const cache = cacheHarness();
    Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {subtle: {
        digest: async (...args) => {
            const result = await realCrypto.subtle.digest(...args);
            controller.abort();
            return result;
        }
    }}});
    try {
        await assert.rejects(() => primeToolchainCache(ORIGIN, {
            caches: cache.caches, fetch: validFetch, signal: controller.signal
        }), error => error.name === 'AbortError');
        assert.equal(cache.stored.length, 0);
    } finally {
        Object.defineProperty(globalThis, 'crypto', descriptor);
    }
});

test('cancellation during the final cache write rejects both operations before any URL exposure', async () => {
    for (const operation of [primeToolchainCache, cachedResolver]) {
        const cache = cacheHarness();
        const controller = new AbortController();
        const urls = urlHarness();
        const caches = {open: async name => {
            const underlying = await cache.caches.open(name);
            return {...underlying, put: async (url, response) => {
                await underlying.put(url, response);
                if (nameOf(url) === TOOLCHAIN_FILES.at(-1)) controller.abort();
            }};
        }};
        await assert.rejects(() => operation(ORIGIN, {
            caches, fetch: validFetch, signal: controller.signal, URL: urls.URL
        }), error => error.name === 'AbortError');
        assert.equal(urls.blobs.size, 0);
        assert.equal(cache.entries.size, 9, 'already verified bytes remain available for resume');
        assert.equal((await inspectToolchain(ORIGIN, {caches: cache.caches})).complete, true);
    }
});

test('denied toolchains make no HEAD, GET or cache execution-preparation calls', async () => {
    const previous = process.env.BW_REMOTE_TOOLCHAINS_POLICY;
    process.env.BW_REMOTE_TOOLCHAINS_POLICY = 'deny';
    let requests = 0;
    let opened = 0;
    const deps = {fetch: async () => { requests++; }, caches: {open: async () => { opened++; }}};
    try {
        for (const operation of [measureToolchain, primeToolchainCache, cachedResolver]) {
            await assert.rejects(() => operation(ORIGIN, deps), /distribution cannot download executable toolchains/);
        }
        assert.equal(requests, 0);
        assert.equal(opened, 0);
    } finally {
        if (previous === undefined) delete process.env.BW_REMOTE_TOOLCHAINS_POLICY;
        else process.env.BW_REMOTE_TOOLCHAINS_POLICY = previous;
    }
});

test('missing Web Crypto and an unverified manifest fail closed before opening storage or fetching', () => {
    const inventoryUrl = new URL('../overlay/scratch-gui/src/lib/runtime-package-inventory.cjs', import.meta.url).href;
    const sourceUrl = new URL('../overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-source.js', import.meta.url).href;
    for (const problem of ['crypto', 'manifest']) {
        const script = `
            import assert from 'node:assert/strict';
            import inventory from ${JSON.stringify(inventoryUrl)};
            if (${JSON.stringify(problem)} === 'crypto') Object.defineProperty(globalThis, 'crypto', {value: undefined});
            else inventory.packages[0].integrity.status = 'unverified';
            const source = await import(${JSON.stringify(sourceUrl)});
            let effects = 0;
            const deps = {fetch: async () => { effects++; }, caches: {open: async () => { effects++; }}};
            for (const operation of [source.primeToolchainCache, source.cachedResolver, source.inspectToolchain]) {
                await assert.rejects(() => operation(undefined, deps), /Web Crypto|pinned SHA-256 manifest/);
            }
            assert.equal(effects, 0);
        `;
        execFileSync(process.execPath, ['--input-type=module', '-e', script], {
            env: {...process.env, BW_REMOTE_TOOLCHAINS_POLICY: 'allow'}, stdio: 'pipe'
        });
    }
});

test('a blob allocation failure revokes all URLs already allocated for the snapshot', async () => {
    const urls = urlHarness(2);
    await assert.rejects(() => cachedResolver(ORIGIN, {fetch: validFetch, URL: urls.URL}), /allocation failed/);
    assert.deepEqual(urls.revoked, [...urls.blobs.keys()]);
    assert.equal(urls.revoked.length, 2);
});

test('importing the manager source in the default online mode performs no prefetch or cache creation', () => {
    const sourceUrl = new URL('../overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-source.js', import.meta.url).href;
    const script = `
        import assert from 'node:assert/strict';
        let effects = 0;
        globalThis.fetch = async () => { effects++; throw new Error('unexpected fetch'); };
        globalThis.caches = {open: async () => { effects++; throw new Error('unexpected cache'); }};
        const source = await import(${JSON.stringify(sourceUrl)});
        assert.equal(source.localToolchainEnabled({location: {search: '', hash: ''},
            localStorage: {getItem: () => null}}), false);
        assert.equal(effects, 0);
    `;
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {stdio: 'pipe'});
});
