/**
 * Where the SDCC toolchain comes from — and why it is not in this app.
 *
 * SDCC is GPL-2.0-or-later. Brickwright is BSD-3-Clause. Until now the compiler
 * itself was tracked in this repository and `webpack.config.js` copied it into
 * `static/sdcc-wasm/` in the build output, which `tauri.conf.json` bundles
 * wholesale — so the shipping Mac build carried 8.7 MB of GPL binaries inside a
 * BSD-3 application. Measured 2026-09-07 in CI's own github-pages artifact: 101
 * files under `static/sdcc-wasm/`.
 *
 * The binaries now live in their own GPL repository, with COPYING, the written
 * offer of corresponding source, and the SHA-256 of each binary:
 *   https://github.com/CrispStrobe/sdcc-wasm
 * served at the origin below. Nothing GPL is copied into this build any more;
 * the toolchain is fetched only when a user asks for it.
 *
 * THREE MODES, one setting:
 *   online (DEFAULT) — no WASM at all. `localTargetSupported()` returns false,
 *     so `intercept.js` simply does not claim the request and the existing
 *     hosted compiler serves it. This needs no request or response mapping: the
 *     callers already POST to that service for every target this bundle cannot
 *     link, and have since before the local path existed.
 *   local — opt-in. Fetched once from the GPL origin and kept in Cache Storage
 *     so it survives going offline.
 *   dev — the old in-build path, for a web build that still copies the files.
 *     Never the default, and it must never put files in the app bundle.
 *
 * NOTE the honest cost of the default. `intercept.js` says a supported request
 * must never silently fall back to the network after a local failure, "because
 * that would turn offline/debug failures into surprising network traffic". With
 * `online` as the default, the five STC parts that used to compile in-page now
 * need either a network or an explicit opt-in. That is a real regression for an
 * offline learner, accepted deliberately: shipping GPL binaries inside a BSD-3
 * app is not a trade that a convenience can win.
 */

import {remoteToolchainsAllowed} from '../distribution-policy.js';
import runtimePackageInventory from '../runtime-package-inventory.cjs';

const sdccPackage = runtimePackageInventory.packages.find(record => record.id === 'sdcc-wasm');

export const GPL_TOOLCHAIN_ORIGIN = sdccPackage.origin;
export const TOOLCHAIN_MODE_KEY = 'bw-sdcc-toolchain';
export const TOOLCHAIN_CACHE = sdccPackage.cacheName;

/** Every file `loadToolchain` asks for, so the cache can be filled in one pass. */
export const TOOLCHAIN_FILES = Object.freeze(sdccPackage.files.slice());

const IS_NODE = typeof process === 'object' && typeof process?.versions?.node === 'string';

export function getToolchainMode (storage) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    let raw = null;
    try {
        raw = store && store.getItem(TOOLCHAIN_MODE_KEY);
    } catch {
        raw = null; // private mode, or storage refused — the default is the safe one
    }
    if (raw === 'local' || raw === 'dev' || raw === 'online') return raw;

    // THE DEFAULT'S DOMAIN. `online` is the right answer in a BROWSER, where the
    // question this whole module answers is what we are allowed to SHIP. Under
    // Node — the smoke harness, the integration suites — there is no bundle, no
    // user and no store, and the toolchain on disk is the entire point. A single
    // default that only knew about the browser sent a disk-backed harness at a
    // network origin (CI run 34160645833). Note the condition: NO storage at
    // all. A Node caller that supplies a storage is asking to be treated as a
    // browser and gets the browser default.
    if (!store && IS_NODE) return 'local';
    return 'online';
}

export function setToolchainMode (mode, storage) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    const value = mode === 'local' || mode === 'dev' ? mode : 'online';
    try {
        if (store) store.setItem(TOOLCHAIN_MODE_KEY, value);
    } catch { /* refused; the getter falls back to online */ }
    return value;
}

/**
 * Read the explicit compiler request from either kind of application URL.
 *
 * Scratch projects and lessons are hash-routed. A user following advice from
 * inside a lesson will naturally append the setting to the URL they can see,
 * producing `#/lesson?...&localCompiler=on`. `location.search` cannot see that
 * query. Prefer the real page query when it contains the key, then inspect the
 * hash query; this keeps ordinary links stable and makes the visible recovery
 * instruction work on routed lesson URLs too.
 */
export function localCompilerRequest (win = typeof window === 'undefined' ? undefined : window) {
    try {
        if (!win || !win.location) return null;
        const search = win.location.search || '';
        const pageParams = new URLSearchParams(search);
        const pageHasRequest = pageParams.has('localCompiler');
        const pageRequest = pageHasRequest ? pageParams.get('localCompiler') : null;
        // Present-but-empty has always meant "unset" to the route predicate.
        // Do not let that placeholder hide a real request in a routed lesson.
        if (pageRequest !== null && pageRequest !== '') return pageRequest;

        const hash = win.location.hash || '';
        const queryAt = hash.indexOf('?');
        if (queryAt === -1) return pageRequest;
        const hashParams = new URLSearchParams(hash.slice(queryAt + 1));
        return hashParams.has('localCompiler') ? hashParams.get('localCompiler') : pageRequest;
    } catch {
        return null;
    }
}

/**
 * THE SINGLE PREDICATE. Is this bundle allowed to compile in-page right now?
 *
 * Until 2026-09-07 two settings governed this, with opposite defaults and
 * different keys, neither aware of the other: `bwLocalCompiler='off'` /
 * `?localCompiler=off` (an opt-OUT, default ON, in debug-runner.js) and
 * `bw-sdcc-toolchain='local'` (an opt-IN, default OFF, here). The result was a
 * SILENT FALLBACK through a second door — debug-runner saw no opt-out, so it
 * installed the intercept and announced nothing; the intercept then declined
 * the request because the toolchain was off, and the compile went to the
 * network without the status line saying so. That is the exact thing
 * intercept.js's header forbids.
 *
 * Order of precedence, and the first rule is the one that matters:
 *   1. AN EXPLICIT REQUEST WINS OVER ANY DEFAULT. Someone who typed
 *      `?localCompiler=off` asked for something; a default arriving underneath
 *      them later must not overturn it. Defaults change, requests do not.
 *      `?localCompiler=on` is its mirror and a direct-link alternative to the
 *      persistent setting in Menu → Settings → C Compiler.
 *   2. A persisted `bwLocalCompiler='off'` is the same request, made to stick.
 *   3. Otherwise the toolchain mode: `local` or `dev` enable it.
 *   4. Otherwise the domain default — see getToolchainMode.
 *
 * Takes the window rather than reaching for it, so the rule is testable without
 * a browser. That is the D-EMU-BP2 lesson debug-runner.js already records, and
 * ignoring it is how CI run 34160645833 went red: a routing decision reachable
 * only through a live session cannot be tested, and a routing decision is
 * precisely the thing that must be.
 */
export function localToolchainEnabled (win = typeof window === 'undefined' ? undefined : window) {
    // This BUILD-TIME rule precedes every opt-in, including ?localCompiler=on. A URL or stale
    // preference cannot change the distribution policy baked into the webpack bundle.
    if (!remoteToolchainsAllowed()) return false;
    const store = win && win.localStorage ? win.localStorage : undefined;
    try {
        const asked = localCompilerRequest(win);
        if (asked !== null && asked !== '') {
            if (/^(off|0|false|no)$/i.test(asked)) return false;
            if (/^(on|1|true|yes)$/i.test(asked)) return true;
        }
        if (store && store.getItem('bwLocalCompiler') === 'off') return false;
    } catch {
        // No location, no storage, private browsing. Not a request either way;
        // fall through to the mode and its domain default.
    }
    return getToolchainMode(store) !== 'online';
}

import {cacheStorageStore} from './toolchain-store.js';

const fileUrl = (base, name) => new URL(`static/sdcc-wasm/${name}`, base).href;

/** The store to use when a caller did not bring one: the browser's. */
const defaultStore = deps => {
    if (deps.store) return deps.store;
    const caches_ = deps.caches || (typeof caches === 'undefined' ? null : caches);
    return caches_ ? cacheStorageStore(caches_, TOOLCHAIN_CACHE) : null;
};

const aborted = () => {
    const error = new Error('the toolchain download was cancelled');
    error.name = 'AbortError';
    return error;
};

/**
 * Fill the cache from the GPL origin. Returns the names actually stored, so a
 * caller can report what it got rather than assuming all of them.
 */
/**
 * What the download will cost, WITHOUT downloading it.
 *
 * Measured from the live origin on 2026-09-07: runtime.json is 3,286,732 bytes
 * of a 6,737,737 total — ONE FILE IS 49% OF THE DOWNLOAD, and sdcc.wasm is
 * another 27%. Nine equal steps would advance briskly through four small files
 * and then sit motionless for half the total time, which is not an imprecise
 * bar but one that looks frozen exactly when a user most needs telling it is
 * not. Weighting the steps by bytes fixes that and needs no streaming.
 *
 * Sizes are read from the origin rather than kept as a constant here: a
 * hardcoded manifest is a second place stating a fact the origin already
 * states, and it drifts silently the first time the toolchain is rebuilt.
 *
 * THESE ARE TRANSFER BYTES, NOT DISK BYTES, and the difference is a factor of
 * four. GitHub Pages compresses, and a fetch that advertises gzip gets a
 * Content-Length describing the COMPRESSED stream: 1,697,996 over the wire for
 * 6,737,737 on disk. Measuring with `curl -I`, which sends no Accept-Encoding,
 * returns the uncompressed figure and looks like the same number until you
 * divide one by the other — which is exactly what the first version of the bar
 * did, and it reported "2.8 MiB of 1.6 MiB". A progress bar must take its
 * numerator and denominator from ONE of these, never one of each. It is the
 * transfer figure, because transfer is what the user is waiting for.
 * `inspectToolchain` reports the disk figure, and calls it space.
 *
 * IF YOU EVER ADD BYTE-LEVEL PROGRESS BY READING THE STREAM, READ THIS FIRST.
 * A ReadableStream from a gzip response yields DECOMPRESSED bytes, while this
 * denominator is the COMPRESSED length. Counting one against the other gives a
 * bar that runs to roughly four hundred percent — the same mistake as the one
 * this comment exists to record, one layer deeper and harder to see, because
 * both numbers would then be "bytes we counted ourselves". If a trustworthy
 * denominator cannot be had, per-file weighting is more honest than a
 * percentage computed from two different units.
 *
 * Measured 2026-09-07, both ways, and reconciled with lego-ac to the byte:
 *   runtime.json  607,272 on the wire / 3,286,732 stored — 81% compression,
 *     because it is base64 inside JSON. 36% of the transfer, 49% of the disk.
 *   sdcc.wasm     452,349 / 1,830,464 — 27% either way.
 *   TOTAL       1,697,996 / 6,737,737.
 * The two largest files are 62% of the wire, so weighting still matters; but
 * "half the download" was true of disk and false of transfer.
 */
export async function measureToolchain (base = GPL_TOOLCHAIN_ORIGIN, deps = {}) {
    const fetch_ = deps.fetch || (typeof fetch === 'undefined' ? null : fetch);
    if (!fetch_) throw new Error('no fetch is available');
    const sizes = {};
    let total = 0;
    for (const name of TOOLCHAIN_FILES) {
        const response = await fetch_(fileUrl(base, name), {method: 'HEAD'});
        const length = Number(response.headers && response.headers.get
            ? response.headers.get('content-length') : 0) || 0;
        sizes[name] = length;
        total += length;
    }
    return {sizes, total};
}

export async function primeToolchainCache (base = GPL_TOOLCHAIN_ORIGIN, deps = {}) {
    if (!remoteToolchainsAllowed()) {
        throw new Error('This distribution cannot download executable toolchains; use Build online.');
    }
    const fetch_ = deps.fetch || (typeof fetch === 'undefined' ? null : fetch);
    const store = defaultStore(deps);
    if (!store || !fetch_) throw new Error('no toolchain store or no fetch is available');
    const {signal, onProgress = () => {}, sizes = null, totalBytes = 0} = deps;
    const total = TOOLCHAIN_FILES.length;
    const stored = [];
    // Completed BYTES, not completed files. See measureToolchain for why.
    let bytesDone = 0;
    const sizeOf = name => (sizes && sizes[name]) || 0;

    for (let index = 0; index < total; index++) {
        const name = TOOLCHAIN_FILES[index];
        // Checked BEFORE each file rather than only at the top, so a cancel
        // lands within one file instead of at the end of the run.
        if (signal && signal.aborted) throw aborted();
        const url = fileUrl(base, name);

        // RESUME IS JUST THIS. A file already in the store is not fetched again,
        // so a cancelled download continues from where it stopped rather than
        // starting over — and the store's `has` refuses a zero-byte file, so a
        // write interrupted between open and rename is not mistaken for one.
        if (await store.has(url)) {
            stored.push(name);
            // Advertised transfer size, NOT store.bytes(): the denominator is a
            // sum of transfer sizes, and mixing the two made the bar exceed its
            // own total. One source for both ends of the fraction.
            bytesDone += sizeOf(name);
            onProgress({name, index, total, state: 'present',
                done: stored.length, bytes: sizeOf(name), bytesDone, totalBytes});
            continue;
        }
        onProgress({name, index, total, state: 'fetching',
            done: stored.length, bytes: sizeOf(name), bytesDone, totalBytes});
        const response = await fetch_(url, signal ? {signal} : undefined);
        if (!response.ok) {
            throw new Error(`${name} returned ${response.status} from ${base}`);
        }
        // Re-checked after the await: a cancel that arrives mid-flight must not
        // be recorded as a completed file.
        if (signal && signal.aborted) throw aborted();
        await store.put(url, typeof response.clone === 'function' ? response.clone() : response);
        stored.push(name);
        bytesDone += sizeOf(name);
        onProgress({name, index, total, state: 'stored',
            done: stored.length, bytes: sizeOf(name), bytesDone, totalBytes});
    }
    return stored;
}

/**
 * What is present, WITHOUT touching the network — so a settings dialog can
 * render installed state while offline, which is exactly when a user most wants
 * to know whether they can compile.
 */
export async function inspectToolchain (base = GPL_TOOLCHAIN_ORIGIN, deps = {}) {
    const store = defaultStore(deps);
    if (!store) return {complete: false, present: [], missing: TOOLCHAIN_FILES.slice(), bytes: 0};
    const present = [];
    const missing = [];
    let bytes = 0;
    for (const name of TOOLCHAIN_FILES) {
        const url = fileUrl(base, name);
        if (await store.has(url)) {
            present.push(name);
            if (store.bytes) bytes += await store.bytes(url);
        } else {
            missing.push(name);
        }
    }
    return {complete: missing.length === 0, present, missing, bytes, kind: store.kind};
}

/** Remove it again and free the space. Reports what it actually removed. */
export async function removeToolchain (base = GPL_TOOLCHAIN_ORIGIN, deps = {}) {
    const store = defaultStore(deps);
    if (!store) return [];
    const removed = [];
    for (const name of TOOLCHAIN_FILES) {
        if (await store.remove(fileUrl(base, name))) removed.push(name);
    }
    return removed;
}

/**
 * A `resolve(name)` backed by the cache.
 *
 * It must hand back blob: URLs, not the network URL. The glue is loaded with
 * `import()`, which does NOT consult Cache Storage, so a patched `fetch` would
 * cache the .wasm and still go to the network for the .js — offline in name
 * only. Reading the cache here and importing a blob covers both, because
 * `locateFile` routes the .wasm through the same resolver.
 */
export async function cachedResolver (base = GPL_TOOLCHAIN_ORIGIN, deps = {}) {
    const caches_ = deps.caches || (typeof caches === 'undefined' ? null : caches);
    const URL_ = deps.URL || URL;
    const cache = caches_ ? await caches_.open(TOOLCHAIN_CACHE) : null;
    const urls = new Map();
    if (cache) {
        for (const name of TOOLCHAIN_FILES) {
            const hit = await cache.match(fileUrl(base, name));
            if (hit) urls.set(name, URL_.createObjectURL(await hit.blob()));
        }
    }
    // A name the cache does not hold falls back to the origin, so a partly
    // filled cache degrades to slow rather than to broken.
    return name => urls.get(name) || fileUrl(base, name);
}
