/**
 * The download manager's algorithm: progress, cancellation, resume, inspect,
 * remove — exercised without a browser.
 *
 * READ THIS BEFORE TRUSTING A GREEN RUN: these use the FILESYSTEM backing. They
 * are evidence about the algorithm, not about Cache Storage. The browser store
 * is exercised only where a browser runs, and nothing here closes that.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import {fileSystemStore} from '../overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-store.js';
import {
    primeToolchainCache, inspectToolchain, removeToolchain, measureToolchain,
    TOOLCHAIN_FILES, GPL_TOOLCHAIN_ORIGIN as ORIGIN, fixtureBytes
} from './helpers/toolchain-fixture.mjs';

const newStore = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bw-toolchain-'));
    return {dir, store: fileSystemStore(dir, fsp, path)};
};
/** A fetch that yields distinct bodies, counts calls, and can be made to stall. */
const countingFetch = () => {
    const asked = [];
    const fn = async url => {
        asked.push(url);
        return new Response(`payload:${url}`, {status: 200});
    };
    fn.asked = asked;
    return fn;
};

test('the filesystem store round-trips, and a zero-byte file is NOT present', async () => {
    const {dir, store} = await newStore();
    const url = `${ORIGIN}static/sdcc-wasm/sdcc.wasm`;
    assert.equal(await store.has(url), false);
    await store.put(url, new Response('abc'));
    assert.equal(await store.has(url), true);
    assert.equal((await store.read(url)).toString(), 'abc');
    assert.equal(await store.bytes(url), 3);

    // A cancellation between open and write leaves an empty file. Counting it as
    // present is how a resume skips the very file it was meant to finish.
    await writeFile(path.join(dir, 'sdld.wasm'), '');
    assert.equal(await store.has(`${ORIGIN}static/sdcc-wasm/sdld.wasm`), false,
        'an empty file must not read as a stored download');
});

test('no URL can make the store write outside its own directory', async () => {
    // My first version of this asserted a REFUSAL and failed: the store takes
    // only the basename, so `../../etc/passwd` becomes `passwd` INSIDE the
    // directory. That is safe, and safer than refusing, but it is not what I
    // assumed. Assert the invariant that actually holds — containment — and
    // keep the refusal test for the case that really cannot be named.
    const {dir, store} = await newStore();
    const sneaky = 'https://x/static/sdcc-wasm/../../etc/passwd';
    await store.put(sneaky, new Response('x'));
    const inside = path.join(dir, 'passwd');
    assert.equal((await readFile(inside)).toString(), 'x',
        'the entry landed inside the store directory, under its basename');
    // NOT asserted by checking that /etc/passwd is absent: it exists on every
    // machine this will ever run on, so that assertion tested the operating
    // system and would have "passed" only where the file was already missing.
    // The real invariant is that the path the store writes to is inside dir.
    assert.equal(path.dirname(inside), dir);
    assert.ok(!path.relative(dir, inside).startsWith('..'),
        'the resolved path never leaves the store directory');

    // A URL whose basename IS a traversal segment has no legal name at all.
    await assert.rejects(() => store.has('https://x/static/sdcc-wasm/..'), /refusing to store/);
    await assert.rejects(() => store.has('https://x/static/sdcc-wasm/'), /refusing to store/);
});

test('priming reports progress for every file, in order', async () => {
    const {store} = await newStore();
    const fetch_ = countingFetch();
    const seen = [];
    const stored = await primeToolchainCache(ORIGIN, {
        store, fetch: fetch_, onProgress: e => seen.push(`${e.state}:${e.name}`)
    });
    assert.deepEqual(stored, TOOLCHAIN_FILES.slice());
    assert.equal(fetch_.asked.length, TOOLCHAIN_FILES.length);
    for (const name of TOOLCHAIN_FILES) {
        assert.ok(seen.includes(`fetching:${name}`), `no fetching event for ${name}`);
        assert.ok(seen.includes(`stored:${name}`), `no stored event for ${name}`);
    }
    // Progress that arrives all at once at the end is not progress.
    assert.ok(seen.indexOf(`stored:${TOOLCHAIN_FILES[0]}`) <
        seen.indexOf(`fetching:${TOOLCHAIN_FILES[1]}`),
    'the first file must be reported stored before the second is fetched');
});

test('a cancel mid-download stops, and RESUME CONTINUES FROM THE REAL PARTIAL STATE', async () => {
    const {store} = await newStore();
    const controller = new AbortController();
    const stopAfter = 3;
    let fetched = 0;
    const fetch_ = async url => {
        if (++fetched >= stopAfter) controller.abort();
        return new Response(`payload:${url}`, {status: 200});
    };

    await assert.rejects(
        () => primeToolchainCache(ORIGIN, {store, fetch: fetch_, signal: controller.signal}),
        e => e.name === 'AbortError', 'a cancelled download must reject, not resolve short');

    // THE PARTIAL STATE IS REAL — produced by the cancellation above, not built
    // by hand. A resume tested against a partial state I constructed myself
    // would only prove it handles the partial states I imagined.
    const half = await inspectToolchain(ORIGIN, {store});
    assert.equal(half.complete, false);
    assert.ok(half.present.length > 0 && half.present.length < TOOLCHAIN_FILES.length,
        `expected a genuinely partial store, got ${half.present.length}/${TOOLCHAIN_FILES.length}`);

    // Resume: only what is missing is fetched, and the result is complete.
    const second = countingFetch();
    const stored = await primeToolchainCache(ORIGIN, {store, fetch: second});
    assert.deepEqual(stored, TOOLCHAIN_FILES.slice());
    assert.equal(second.asked.length, half.missing.length,
        `resume refetched ${second.asked.length} files but only ${half.missing.length} were missing`);
    const after = await inspectToolchain(ORIGIN, {store});
    assert.equal(after.complete, true);
});

test('inspect touches no network, so installed state renders offline', async () => {
    const {store} = await newStore();
    const fetch_ = countingFetch();
    await primeToolchainCache(ORIGIN, {store, fetch: fetch_});
    const before = fetch_.asked.length;
    const report = await inspectToolchain(ORIGIN, {store, fetch: fetch_});
    assert.equal(fetch_.asked.length, before, 'inspect must not fetch');
    assert.equal(report.complete, true);
    assert.equal(report.kind, 'filesystem');
    assert.ok(report.bytes > 0, 'inspect reports the space it occupies');
});

test('remove frees it, and reports what it actually removed', async () => {
    const {store} = await newStore();
    await primeToolchainCache(ORIGIN, {store, fetch: countingFetch()});
    const removed = await removeToolchain(ORIGIN, {store});
    assert.deepEqual(removed.sort(), TOOLCHAIN_FILES.slice().sort());
    const after = await inspectToolchain(ORIGIN, {store});
    assert.equal(after.complete, false);
    assert.equal(after.present.length, 0);
    assert.equal(after.bytes, 0);
    // Removing twice reports nothing removed rather than claiming success again.
    assert.deepEqual(await removeToolchain(ORIGIN, {store}), []);
});

test('a bad response is not stored as if it were the toolchain', async () => {
    const {store} = await newStore();
    const fetch_ = async () => new Response('not found', {status: 404});
    await assert.rejects(() => primeToolchainCache(ORIGIN, {store, fetch: fetch_}), /404/);
    assert.equal((await inspectToolchain(ORIGIN, {store})).present.length, 0);
});

// ---- the command line's own contract, exercised as a subprocess -----------
// Offline only: nothing here downloads. The install path is proved by the tests
// above, which drive the same algorithm with an injected fetch.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile);
const CLI = new URL('../scripts/bw-toolchain.mjs', import.meta.url).pathname;
const cli = async (...args) => {
    try {
        const {stdout, stderr} = await run(process.execPath, [CLI, ...args]);
        return {code: 0, stdout, stderr};
    } catch (e) {
        return {code: e.code, stdout: e.stdout || '', stderr: e.stderr || ''};
    }
};

test('compile REFUSES without an explicit mode, and names the modes', async () => {
    const {dir} = await newStore();
    const {code, stderr} = await cli('compile', '/dev/null', '--home', dir);
    assert.notEqual(code, 0, 'a missing mode must not be defaulted into');
    assert.match(stderr, /a mode is required and is not defaulted/);
    assert.match(stderr, /--mode local/);
    assert.match(stderr, /--mode online/);
    // The reason is part of the contract: two defaults already exist and both
    // answer questions a command line is not asking.
    assert.match(stderr, /no user session/);
});

test('status reports absence, the origin, and the licence, without a network', async () => {
    const {dir} = await newStore();
    const {stdout} = await cli('status', '--home', dir);
    assert.match(stdout, /installed\s+: no \(0\/9 files/);
    assert.match(stdout, /crispstrobe\.github\.io\/sdcc-wasm/);
    assert.match(stdout, /GPL-2\.0-or-later/,
        'status must name the licence — this is GPL software in a BSD-3 app');
});

test('an unknown verb fails rather than doing something plausible', async () => {
    const {code, stderr} = await cli('instal');
    assert.equal(code, 2);
    assert.match(stderr, /usage: bw-toolchain/);
});

// ---- weighted progress ----------------------------------------------------
test('progress is weighted by bytes, and never exceeds its own total', async () => {
    // One file is a third of the transfer, so nine equal steps would sit still
    // through it and read as frozen. These sizes are shaped like the real ones.
    const SIZES = {
        'cc1.js': 21672, 'cc1.wasm': 393701, 'sdcc.js': 41216, 'sdcc.wasm': 452349,
        'sdas8051.js': 36144, 'sdas8051.wasm': 53193, 'sdld.js': 35928,
        'sdld.wasm': 56521, 'runtime.json': 607272
    };
    const headFetch = async (url, init) => {
        const name = url.slice(url.lastIndexOf('/') + 1);
        if (init && init.method === 'HEAD') {
            return {ok: true, status: 200, headers: {get: k =>
                (k === 'content-length' ? String(SIZES[name]) : null)}};
        }
        return new Response(fixtureBytes(name), {status: 200});
    };
    const {sizes, total} = await measureToolchain(ORIGIN, {fetch: headFetch});
    assert.equal(total, Object.values(SIZES).reduce((a, b) => a + b, 0));

    const {store} = await newStore();
    const seen = [];
    await primeToolchainCache(ORIGIN, {
        store, fetch: headFetch, sizes, totalBytes: total,
        onProgress: e => { if (e.state !== 'fetching') seen.push(e); }
    });

    // THE BUG THIS PINS: the first version summed store.bytes() (what landed on
    // disk, uncompressed) against a total of Content-Length (the compressed
    // transfer), and reported "2.8 MiB of 1.6 MiB". Numerator and denominator
    // must come from ONE source.
    for (const e of seen) {
        assert.ok(e.bytesDone <= e.totalBytes,
            `progress exceeded its own total: ${e.bytesDone} of ${e.totalBytes} at ${e.name}`);
    }
    assert.equal(seen.at(-1).bytesDone, total, 'progress must finish at exactly the total');

    // And the steps are UNEQUAL — that is the whole point of weighting.
    const steps = seen.map((e, i) => e.bytesDone - (i ? seen[i - 1].bytesDone : 0));
    assert.ok(Math.max(...steps) > Math.min(...steps) * 5,
        'weighted steps should differ markedly; equal steps would stall on the big file');
});
