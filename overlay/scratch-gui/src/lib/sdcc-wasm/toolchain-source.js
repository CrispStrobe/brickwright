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

// Capture the reviewed manifest before any async operation. Runtime callers
// cannot replace a digest while a download or cached read is being checked.
const integrity = Object.freeze({...sdccPackage.integrity});
const artifacts = Object.freeze(Object.fromEntries(TOOLCHAIN_FILES.map(name =>
    [name, Object.freeze({...integrity.artifacts?.[name]})])));

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

const requireToolchainPolicy = () => {
    if (!remoteToolchainsAllowed()) {
        throw new Error('This distribution cannot download executable toolchains; use Build online.');
    }
};

const requireIntegrity = () => {
    if (integrity.status !== 'sha256-pinned' || integrity.algorithm !== 'SHA-256' ||
        !/^[a-f0-9]{40}$/.test(integrity.sourceRevision || '') ||
        TOOLCHAIN_FILES.some(name => !/^[a-f0-9]{64}$/.test(artifacts[name].sha256 || '') ||
            !Number.isSafeInteger(artifacts[name].bytes) || artifacts[name].bytes <= 0)) {
        throw new Error('The SDCC package has no complete pinned SHA-256 manifest.');
    }
    if (!globalThis.crypto?.subtle?.digest) {
        throw new Error('SDCC package verification requires Web Crypto SHA-256.');
    }
};

const integrityFailure = name => {
    const error = new Error(`${name}: SDCC package integrity check failed. Install the compiler again.`);
    error.code = 'TOOLCHAIN_INTEGRITY';
    return error;
};

const bodyBytes = async body => {
    if (body instanceof Uint8Array) return Uint8Array.from(body);
    if (body instanceof ArrayBuffer) return new Uint8Array(body.slice(0));
    if (body && typeof body.arrayBuffer === 'function') return new Uint8Array(await body.arrayBuffer());
    throw new Error('The toolchain store did not return readable artifact bytes.');
};

const verifyBytes = async (name, bytes) => {
    const expected = artifacts[name];
    if (!Object.hasOwn(artifacts, name)) throw new Error(`Unknown SDCC package member: ${name}`);
    if (bytes.byteLength !== expected.bytes) throw integrityFailure(name);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hex !== expected.sha256) throw integrityFailure(name);
    return bytes;
};

const contentType = name => name.endsWith('.js') ? 'text/javascript' :
    (name.endsWith('.wasm') ? 'application/wasm' : 'application/json');
const verifiedResponse = (name, bytes) => new Response(bytes, {
    headers: {'content-type': contentType(name)}
});

// Presence is not installation. Inspect and resume both read the real bytes,
// and a cached response never becomes executable just because its key exists.
const storedEntry = async (store, url, name) => {
    const body = store ? await store.read(url) : null;
    if (body === null || body === undefined) return {bytes: null, size: 0, invalid: false};
    const bytes = await bodyBytes(body);
    try {
        await verifyBytes(name, bytes);
        return {bytes, size: bytes.byteLength, invalid: false};
    } catch (error) {
        if (error.code !== 'TOOLCHAIN_INTEGRITY') throw error;
        return {bytes: null, size: bytes.byteLength, invalid: true};
    }
};

const fetchVerified = async (base, name, fetch_, signal) => {
    if (!fetch_) throw new Error('no fetch is available to finish the toolchain installation');
    const response = await fetch_(fileUrl(base, name), signal ? {signal} : undefined);
    if (!response.ok) throw new Error(`${name} returned ${response.status} from ${base}`);
    if (signal?.aborted) throw aborted();
    const bytes = await verifyBytes(name, await bodyBytes(response));
    if (signal?.aborted) throw aborted();
    return bytes;
};

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
    requireToolchainPolicy();
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
    requireToolchainPolicy();
    requireIntegrity();
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

        const entry = await storedEntry(store, url, name);
        if (signal?.aborted) throw aborted();
        if (entry.bytes) {
            stored.push(name);
            // Advertised transfer size, NOT store.bytes(): the denominator is a
            // sum of transfer sizes, and mixing the two made the bar exceed its
            // own total. One source for both ends of the fraction.
            bytesDone += sizeOf(name);
            onProgress({name, index, total, state: 'present',
                done: stored.length, bytes: sizeOf(name), bytesDone, totalBytes});
            continue;
        }
        if (entry.invalid) await store.remove(url);
        onProgress({name, index, total, state: 'fetching',
            done: stored.length, bytes: sizeOf(name), bytesDone, totalBytes});
        const bytes = await fetchVerified(base, name, fetch_, signal);
        // Store the exact verified snapshot, including a usable module MIME
        // type, rather than reopening a body after its digest was accepted.
        await store.put(url, verifiedResponse(name, bytes));
        if (signal?.aborted) throw aborted();
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
    requireIntegrity();
    const store = defaultStore(deps);
    if (!store) return {complete: false, present: [], missing: TOOLCHAIN_FILES.slice(), invalid: [], bytes: 0};
    const present = [];
    const missing = [];
    const invalid = [];
    let bytes = 0;
    for (const name of TOOLCHAIN_FILES) {
        const url = fileUrl(base, name);
        const entry = await storedEntry(store, url, name);
        bytes += entry.size;
        if (entry.bytes) {
            present.push(name);
        } else {
            missing.push(name);
            if (entry.invalid) invalid.push(name);
        }
    }
    return {complete: missing.length === 0, present, missing, invalid, bytes, kind: store.kind};
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
    requireToolchainPolicy();
    requireIntegrity();
    const store = defaultStore(deps);
    const fetch_ = deps.fetch || (typeof fetch === 'undefined' ? null : fetch);
    const URL_ = deps.URL || URL;
    const snapshots = new Map();
    for (const name of TOOLCHAIN_FILES) {
        if (deps.signal?.aborted) throw aborted();
        const url = fileUrl(base, name);
        const entry = await storedEntry(store, url, name);
        if (deps.signal?.aborted) throw aborted();
        let bytes = entry.bytes;
        if (!bytes) {
            if (entry.invalid) await store.remove(url);
            bytes = await fetchVerified(base, name, fetch_, deps.signal);
            if (store) await store.put(url, verifiedResponse(name, bytes));
            if (deps.signal?.aborted) throw aborted();
        }
        snapshots.set(name, bytes);
    }
    // Only a complete verified snapshot receives importable URLs. A partial
    // installation may finish at this explicit compile request, but no member
    // can bypass verification through a raw network URL.
    if (deps.signal?.aborted) throw aborted();
    const urls = new Map();
    try {
        for (const [name, bytes] of snapshots) {
            urls.set(name, URL_.createObjectURL(new Blob([bytes], {type: contentType(name)})));
        }
    } catch (error) {
        for (const url of urls.values()) URL_.revokeObjectURL(url);
        throw error;
    }
    return name => {
        if (!urls.has(name)) throw new Error(`Unknown SDCC package member: ${name}`);
        return urls.get(name);
    };
}
