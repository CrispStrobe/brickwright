// SPDX-License-Identifier: BSD-3-Clause
/**
 * Load the pinned Cowgol WebAssembly tools and run one isolated instance per
 * compiler stage.
 *
 * INTEGRITY. Every module and binary is fetched as bytes and checked against
 * the SHA-256 and length in pins.js (generated from the build manifests by
 * scripts/package-cowgol-wasm.mjs) BEFORE it is compiled or imported. In a
 * browser the verified glue is imported from a blob: URL, so the code that
 * runs is the code that was hashed (the optional-payload rule of the LP1 SDCC
 * package). Under Node the verified file is imported by its file URL.
 *
 * TWO PAYLOADS. `bundled` (Cowgol BSD-2-Clause stages, public-domain zmac,
 * BSD-2-Clause NASM, runtime headers/objects) ships in the app under
 * static/cowgol-wasm/. `gpl` (djlink, 64tass) is GPL and is never copied into
 * the BSD-3 app: it is an optional download from a separately configured
 * origin, cached in its own Cache Storage bucket after verification. Without
 * it, DOS and Eater 6502 report `unavailable` and the caller uses the hosted
 * service where the distribution policy allows.
 *
 * ISOLATION. Each invocation is a fresh Emscripten instance with its own
 * MEMFS: nothing one stage leaves behind can be mistaken for the next stage's
 * input. Only the files the pipeline names cross between stages.
 */
import {buildCowgolNative, toolsForTarget, BUNDLE} from './pipeline.js';
import {COWGOL_WASM_PINS} from './pins.js';

export const COWGOL_GPL_CACHE = 'bw-cowgol-wasm-gpl-v1';
const IS_NODE = typeof process === 'object' && typeof process?.versions?.node === 'string';

export class CowgolWasmUnavailable extends Error {
    constructor (message) { super(message); this.name = 'CowgolWasmUnavailable'; }
}
class CowgolToolError extends Error {
    constructor (message) { super(message); this.name = 'CowgolToolError'; }
}

const hexDigest = async bytes => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle?.digest) throw new CowgolWasmUnavailable('SHA-256 is unavailable; the offline Cowgol compiler cannot be verified.');
    const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
};

async function readUrl (url, fetchImpl) {
    if (IS_NODE && url.startsWith('file:')) {
        const [{readFile}, {fileURLToPath}] = await Promise.all([
            import(/* webpackIgnore: true */ 'node:fs/promises'), import(/* webpackIgnore: true */ 'node:url')]);
        return new Uint8Array(await readFile(fileURLToPath(url)));
    }
    const response = await (fetchImpl || globalThis.fetch)(url, {credentials: 'same-origin'});
    if (!response.ok) throw new CowgolWasmUnavailable(`Offline Cowgol asset missing: ${url} (HTTP ${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
}

/** One payload: a base URL and its pinned file table. */
function payloadReader (base, pin, {fetchImpl, cacheName} = {}) {
    const verified = new Map();
    const cacheOpen = cacheName && typeof caches !== 'undefined' ? () => caches.open(cacheName) : null;
    return async path => {
        if (verified.has(path)) return verified.get(path);
        const expected = pin.files[path];
        if (!expected) throw new CowgolWasmUnavailable(`Unpinned offline Cowgol asset: ${path}`);
        const url = new URL(path, base).href;
        const check = async bytes => bytes && bytes.length === expected.bytes && await hexDigest(bytes) === expected.sha256;
        let bytes = null;
        if (cacheOpen) {
            try {
                const hit = await (await cacheOpen()).match(url);
                if (hit) bytes = new Uint8Array(await hit.arrayBuffer());
            } catch { bytes = null; }
            if (bytes && !await check(bytes)) bytes = null; // corrupt cache entry: refetch
        }
        if (!bytes) {
            bytes = await readUrl(url, fetchImpl);
            if (!await check(bytes)) throw new CowgolWasmUnavailable(`Offline Cowgol asset failed SHA-256 verification: ${path}`);
            if (cacheOpen) {
                try { await (await cacheOpen()).put(url, new Response(bytes)); } catch { /* storage refused */ }
            }
        }
        verified.set(path, bytes);
        return bytes;
    };
}

async function importGlue (url, bytes) {
    if (IS_NODE && url.startsWith('file:')) return import(/* webpackIgnore: true */ url);
    const blob = URL.createObjectURL(new Blob([bytes], {type: 'text/javascript'}));
    try { return await import(/* webpackIgnore: true */ blob); } finally { URL.revokeObjectURL(blob); }
}

function mkdirp (FS, directory) {
    let current = '';
    for (const part of directory.split('/').filter(Boolean)) {
        current += `/${part}`;
        try { FS.mkdir(current); } catch { /* exists */ }
    }
}

/**
 * @param {object} options
 * @param {string} options.bundledBase  URL of static/cowgol-wasm/ (trailing slash)
 * @param {string} [options.gplBase]    URL of the optional GPL payload, or null
 * @param {object} [options.pins]       defaults to the generated pins.js
 */
export function createCowgolWasmToolchain ({bundledBase, gplBase = null, pins = COWGOL_WASM_PINS, fetchImpl} = {}) {
    if (!pins?.bundled) throw new CowgolWasmUnavailable('This build carries no offline Cowgol compiler payload.');
    const readers = {
        bundled: payloadReader(bundledBase, pins.bundled, {fetchImpl}),
        gpl: gplBase && pins.gpl ? payloadReader(gplBase, pins.gpl, {fetchImpl, cacheName: COWGOL_GPL_CACHE}) : null
    };
    const payloadOf = tool => pins.bundled.tools[tool] ? 'bundled' : pins.gpl?.tools?.[tool] ? 'gpl' : null;
    const available = tool => {
        const payload = payloadOf(tool);
        return payload === 'bundled' || (payload === 'gpl' && Boolean(readers.gpl));
    };
    const supports = target => {
        const tools = toolsForTarget(target);
        return tools.length > 0 && tools.every(available);
    };
    const tools = new Map();
    const loadTool = tool => {
        if (!tools.has(tool)) {
            const promise = (async () => {
                const payload = payloadOf(tool);
                if (!available(tool)) throw new CowgolWasmUnavailable(`The offline Cowgol tool ${tool} is not installed.`);
                const entry = pins[payload].tools[tool];
                const read = readers[payload];
                const base = payload === 'bundled' ? bundledBase : gplBase;
                const [glue, wasm] = await Promise.all([read(entry.module), read(entry.wasm)]);
                const [mod, compiled] = await Promise.all([
                    importGlue(new URL(entry.module, base).href, glue), WebAssembly.compile(wasm)]);
                const factory = mod.default || mod.createCowgolTool;
                if (typeof factory !== 'function') throw new CowgolWasmUnavailable(`${entry.module} exports no module factory`);
                return {factory, compiled};
            })();
            promise.catch(() => tools.delete(tool));
            tools.set(tool, promise);
        }
        return tools.get(tool);
    };
    let runtimeFiles = null;
    const loadRuntimeFiles = () => {
        runtimeFiles ||= (async () => {
            const entries = Object.keys(pins.bundled.files).filter(path => path.startsWith('rt/'));
            const files = {};
            await Promise.all(entries.map(async path => { files[`${BUNDLE}/${path}`] = await readers.bundled(path); }));
            return files;
        })();
        runtimeFiles.catch(() => { runtimeFiles = null; });
        return runtimeFiles;
    };

    const runTool = async (tool, argv, files, outputs) => {
        const [{factory, compiled}, rt] = await Promise.all([loadTool(tool), loadRuntimeFiles()]);
        const stdout = [];
        const stderr = [];
        let status = 0;
        let aborted = null;
        // Emscripten's Node quit_ writes the guest's status into the HOST
        // process's exitCode (see smallerc-wasm/compiler.js). Put it back.
        const hostExitCode = IS_NODE ? process.exitCode : undefined;
        let module = null;
        try {
            module = await factory({
                thisProgram: argv[0],
                arguments: argv.slice(1),
                noInitialRun: false,
                instantiateWasm: (imports, receive) => {
                    WebAssembly.instantiate(compiled, imports).then(instance => receive(instance, compiled));
                    return {};
                },
                preRun: [M => {
                    for (const [path, bytes] of Object.entries({...rt, ...files})) {
                        mkdirp(M.FS, path.slice(0, path.lastIndexOf('/')));
                        M.FS.writeFile(path, bytes);
                    }
                    mkdirp(M.FS, '/work');
                    M.FS.chdir('/work');
                    M.FS.init(() => null, byte => { if (byte !== null) stdout.push(byte); },
                        byte => { if (byte !== null) stderr.push(byte); });
                }],
                print: () => {}, printErr: () => {},
                onExit: code => { status = code; },
                quit: (code, toThrow) => { status = code; throw toThrow; },
                onAbort: why => { aborted = String(why); }
            });
        } catch (error) {
            if (!aborted && !(error && typeof error === 'object' && 'status' in error)) aborted = String(error?.message || error);
            if (error && typeof error === 'object' && 'status' in error) status = error.status;
        } finally {
            if (IS_NODE) process.exitCode = hostExitCode;
        }
        if (aborted) {
            // A native crash surfaces as a negative signal status; this is the
            // WebAssembly equivalent and is never mistaken for success.
            throw new CowgolToolError(`${argv[0].split('/').pop()} aborted: ${aborted}`);
        }
        const produced = new Map();
        for (const path of outputs) {
            try { produced.set(path, module.FS.readFile(path)); } catch { /* absent */ }
        }
        return {status, stdout: Uint8Array.from(stdout), stderr: Uint8Array.from(stderr), files: produced};
    };

    return {
        commit: pins.bundled.cowgolCommit,
        supports,
        /** Same request/response contract as the hosted POST /compile. */
        async compile (req) {
            if (!supports(req.target)) {
                throw new CowgolWasmUnavailable(`Offline Cowgol does not build ${req.target} in this installation.`);
            }
            return buildCowgolNative(req, {runTool, commit: pins.bundled.cowgolCommit});
        }
    };
}
