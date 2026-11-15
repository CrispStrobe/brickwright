// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Loads the LDraw files a model needs from the app's vendored subset
// (static/ldraw/, scripts/sync-ldraw-parts.mjs) into memory, so the
// synchronous geometry reader (ldraw-geometry.js) and the scene builder can
// use them. Same-origin only; the closure is discovered by parsing each file's
// type-1 references, in waves, so a model costs one round trip per nesting
// level rather than one per file.
//
// A part beyond the vendored subset (one added from the LDraw catalogue,
// part-meta/catalog-parts.js) resolves through the fallback (setLDrawFallback):
// the whole library, read file by file from the ldraw-stl mirror (ldraw-catalog.js).
// The vendored file list (ldraw-lock.json) then says which files are here, so a
// files are resolved directly, including primitives, without speculative 404s.

import {visualAssembly} from './visual-assemblies.js';
import {OWNED_PART_FILES} from './owned-parts.js';
import {parseLDraw, refKey, SEARCH_DIRS} from './ldraw-geometry.js';

export const LDRAW_BASE = 'static/ldraw/';

let defaultFallback = null;
/**
 * Where files the vendored subset lacks come from: {library: Promise<catalogue>, local?: Promise<Set<string>>},
 * or null (only the vendored files). sim-lab.js sets it once a learner uses the LDraw catalogue.
 * @param {object|null} fallback
 */
export const setLDrawFallback = fallback => {
    defaultFallback = fallback;
};

/** The vendored files (ldraw-lock.json's list), lower case, for a fallback's `local`. */
export const vendoredFiles = async ({fetchImpl = globalThis.fetch, base = LDRAW_BASE} = {}) => {
    const response = await fetchImpl(`${base}ldraw-lock.json`);
    if (!response.ok) return null;
    return new Set(Object.keys(JSON.parse(await response.text()).files).map(f => f.toLowerCase()));
};

/**
 * @param {string[]} parts part file names, e.g. ['45601.dat', '54696p01.dat']
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.base]
 * @param {boolean} [options.withConfig] also load LDConfig.ldr (the colour table), readable as 'LDConfig.ldr'
 * @param {object|null} [options.fallback] the LDraw catalogue for files not vendored (setLDrawFallback's)
 * @returns {Promise<{read: (path: string) => string|undefined, files: Map<string, string>, missing: string[], fromCatalogue: string[]}>}
 *          read() takes library-relative paths ('parts/3001.dat', 'p/4-4cyli.dat');
 *          missing lists references found in no search directory; fromCatalogue the paths the fallback supplied
 */
/**
 * A vendored file's text (null when it is not there), fetched once per fetch function: a big model's parts share their
 * primitives (the stud, the pin hole's rings), and each part's closure asked for them again (the 4x4 Off-Roader:
 * 2,266 requests). A failed request is forgotten, so it may be tried again.
 */
const fetched = new WeakMap();
const fetchText = (fetchImpl, url) => {
    if (!fetched.has(fetchImpl)) fetched.set(fetchImpl, new Map());
    const cache = fetched.get(fetchImpl);
    if (!cache.has(url)) {
        const p = Promise.resolve(fetchImpl(url)).then(r => (r.ok ? r.text() : null));
        p.catch(() => cache.delete(url));
        cache.set(url, p);
    }
    return cache.get(url);
};

export const fetchLDrawClosure = async (parts, {fetchImpl = globalThis.fetch, base = LDRAW_BASE, withConfig = false,
    fallback = defaultFallback} = {}) => {
    const files = new Map();
    const missing = [];
    const tried = new Set();
    const fromCatalogue = [];
    const local = await (fallback?.local || vendoredFiles({fetchImpl, base})).catch(() => null);
    let library;
    const catalogue = () => {
        if (library === undefined) library = fallback ? fallback.library.catch(() => null) : Promise.resolve(null);
        return library;
    };
    // One reference resolves to the first search directory that has it.
    const resolveOne = async ref => {
        const key = refKey(ref);
        if (base === LDRAW_BASE && OWNED_PART_FILES.includes(key)) {
            const path = 'parts/' + key;
            if (!files.has(path)) {
                const response = await fetchImpl('static/sim-lab/parts/' + key);
                if (!response.ok) {missing.push(ref);return null;}
                files.set(path, await response.text());
            }
            return path;
        }
        for (const dir of SEARCH_DIRS) {
            const path = dir + key;
            if (files.has(path)) return path;
            if (!dir) continue;
            if (local && !local.has(path)) continue; // not vendored: no request that can only 404
            const text = await fetchText(fetchImpl, `${base}${path}`);
            if (text !== null) {
                files.set(path, text);
                return path;
            }
        }
        const lib = fallback ? await catalogue() : null;
        for (const dir of lib ? SEARCH_DIRS : []) {
            const path = dir + key;
            if (!dir || !lib.has(path)) continue;
            files.set(path, await lib.read(path));
            fromCatalogue.push(path);
            return path;
        }
        missing.push(ref);
        return null;
    };
    let wave = [...new Set(parts.flatMap(name => [refKey(name), refKey(visualAssembly(name))]))];
    while (wave.length) {
        const found = await Promise.all(wave.filter(k => !tried.has(k)).map(k => {
            tried.add(k);
            return resolveOne(k);
        }));
        const next = new Set();
        for (const path of found) {
            if (!path) continue;
            for (const r of parseLDraw(files.get(path)).refs) {
                const k = refKey(r.file);
                if (!tried.has(k)) next.add(k);
            }
        }
        wave = [...next];
    }
    if (withConfig) {
        const response = await fetchImpl(`${base}LDConfig.ldr`);
        if (response.ok) files.set('ldconfig.ldr', await response.text());
        else missing.push('LDConfig.ldr');
    }
    return {read: p => files.get(p.toLowerCase()), files, missing, fromCatalogue};
};

/**
 * Everything a model's pictures need: its parts', its decoration's (model.decor: a cable's segments,
 * a part not in the catalogue) and the library files its own parts use (model.files: an MPD's
 * embedded parts) — and a read() that serves those own parts first, by name, under any search dir.
 * @param {{parts: {part: string}[], decor?: {part: string}[], files?: object}} model
 * @param {object} [options] as fetchLDrawClosure's
 */
export const fetchModelDrawing = async (model, options = {}) => {
    const own = new Map(Object.entries(model.files || {}).map(([name, text]) => [refKey(name), text]));
    const names = new Set([...model.parts.map(p => p.part), ...(model.decor || []).map(d => d.part)]);
    for (const text of own.values()) {
        for (const line of text.split(/\r?\n/)) {
            const m = /^\s*1\s+(?:\S+\s+){13}(.+?)\s*$/.exec(line);
            if (m) names.add(m[1]);
        }
    }
    const closure = await fetchLDrawClosure([...names].filter(n => !own.has(refKey(n))), options);
    const ownOf = path => own.get(refKey(path).replace(/^(?:parts\/|p\/)/, ''));
    return {...closure, read: path => ownOf(path) ?? closure.read(path)};
};
