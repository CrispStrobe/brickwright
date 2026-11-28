import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const worker = readFileSync(new URL('../overlay/scratch-gui/sw.js', import.meta.url), 'utf8');
const inventory = JSON.parse(readFileSync(new URL(
    '../overlay/scratch-gui/src/lib/runtime-package-inventory.json', import.meta.url), 'utf8'));
const optionalCaches = inventory.packages
    .filter(record => record.delivery === 'optional-user-download')
    .map(record => record.cacheName);
const appCache = /const CACHE = '([^']+)'/.exec(worker)?.[1];
const previews = ['brickwright-library-previews-v1', 'brickwright-rendered-thumbnails-v1'];
const payloadUrl = 'https://compiler.example.invalid/static/sdcc-wasm/sdcc.wasm';
const payload = Uint8Array.from([0, 97, 115, 109, 1, 2, 3, 255]);

// Execute the shipped worker's handlers. The cache fake stores real Response
// bytes and exposes every open/delete/fetch, rather than reproducing its filter.
const rig = (names, {holdDeletes = false, source = worker} = {}) => {
    const handlers = new Map();
    const stores = new Map(names.map(name => [name, new Map()]));
    const events = [];
    const opened = [];
    const requested = [];
    const pendingDeletes = [];
    let firstDelete;
    const deletionStarted = new Promise(resolve => { firstDelete = resolve; });
    const caches = {
        keys: async () => [...stores.keys()],
        open: async name => {
            opened.push(name);
            if (!stores.has(name)) stores.set(name, new Map());
            const entries = stores.get(name);
            return {
                match: async url => entries.get(url)?.clone(),
                put: async (url, response) => entries.set(url, response.clone())
            };
        },
        delete: async name => {
            events.push(`deleting:${name}`);
            firstDelete();
            if (holdDeletes) await new Promise(resolve => pendingDeletes.push(resolve));
            const deleted = stores.delete(name);
            events.push(`deleted:${name}`);
            return deleted;
        }
    };
    const declaredOptionalCaches = Array.from(runInNewContext(
        source + '\n[...OPTIONAL_TOOLCHAIN_CACHES];', {
        self: {
            addEventListener: (name, handler) => handlers.set(name, handler),
            skipWaiting: async () => { events.push('skipWaiting'); },
            clients: {claim: async () => { events.push('claim'); }},
            location: {origin: 'https://app.example.invalid'}
        },
        caches, URL, Response, setTimeout, clearTimeout,
        fetch: async (...args) => { requested.push(args); throw new Error('unexpected fetch'); }
    }));
    const activate = () => {
        let completion;
        handlers.get('activate')({waitUntil: promise => { completion = promise; }});
        assert.ok(completion && typeof completion.then === 'function', 'activation must extend its lifetime');
        return completion;
    };
    return {stores, events, opened, requested, pendingDeletes, deletionStarted, declaredOptionalCaches, activate,
        install: () => handlers.get('install')()};
};

test('activation retains exact inventoried optional caches and their bytes while purging obsolete caches', {timeout: 2000}, async () => {
    assert.ok(appCache, 'the fixture must identify the real app cache');
    assert.ok(optionalCaches.length, 'the inventory must contain the optional package under test');
    const kept = [appCache, ...previews, ...optionalCaches];
    const removed = ['brickwright-v1', 'bw-sdcc-wasm-v0', 'bw-sdcc-wasm-v1-extra',
        'bw-other-toolchain-v1', 'unrelated-cache'];
    const state = rig([...kept, ...removed], {holdDeletes: true});
    assert.deepEqual(state.declaredOptionalCaches.sort(), optionalCaches.slice().sort(),
        'the entire worker exception set must match the inventoried optional installations');
    for (const name of optionalCaches) state.stores.get(name).set(payloadUrl, new Response(payload));

    await state.install();
    const completion = state.activate();
    await state.deletionStarted;
    assert.equal(state.pendingDeletes.length, removed.length, 'every obsolete cache must be scheduled');
    assert.equal(state.events.includes('claim'), false, 'clients must not be claimed before cleanup settles');
    for (const release of state.pendingDeletes) release();
    await completion;

    assert.deepEqual([...state.stores.keys()].sort(), kept.sort());
    for (const name of optionalCaches) {
        assert.deepEqual(new Uint8Array(await state.stores.get(name).get(payloadUrl).arrayBuffer()), payload);
    }
    assert.equal(state.events.at(-1), 'claim');
    assert.deepEqual(state.opened, [], 'activation must not open or populate optional caches');
    assert.deepEqual(state.requested, [], 'install and activation must not prefetch compiler payloads');
});

test('fresh install and activation do not create an optional toolchain cache or request its files', async () => {
    const state = rig([appCache, 'brickwright-v1']);
    await state.install();
    await state.activate();
    assert.deepEqual([...state.stores.keys()], [appCache]);
    assert.deepEqual(state.opened, []);
    assert.deepEqual(state.requested, []);
});

test('the optional retention check fails when the actual worker loses its exact-name exception', async () => {
    const source = worker.replace(' && !OPTIONAL_TOOLCHAIN_CACHES.has(k)', '');
    assert.notEqual(source, worker, 'the mutation must change the worker');
    const state = rig([appCache, ...optionalCaches], {source});
    await state.activate();
    for (const name of optionalCaches) assert.equal(state.stores.has(name), false);
});

test('the worker and its tracked build mirror are byte-identical', () => {
    assert.equal(worker, readFileSync(new URL('../packages/scratch-gui/sw.js', import.meta.url), 'utf8'));
});
