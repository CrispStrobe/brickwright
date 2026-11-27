#!/usr/bin/env node
// Stage the real restricted interpreter as plain ESM assets. No GUI packages,
// bundler, network fetch or generated source rewrite is needed here.
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {WASM_LOCAL_INPUTS, WASM_UPSTREAM_INPUTS} from '../packages/crisp-basic/wasm/build-inputs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CRISPBASIC_PACKAGE = join(ROOT, 'packages/crisp-basic');
export const CRISPBASIC_DESTINATION = join(ROOT, 'packages/scratch-gui/static/crispbasic');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = bytes => JSON.parse(bytes.toString('utf8'));
const rebuild = 'Run npm run build:crispbasic to rebuild and package the restricted WASM runtime.';

async function required(root, path) {
    try { return await readFile(join(root, path)); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
        throw new Error(`CrispBASIC asset is missing: ${path}. ${rebuild}`);
    }
}

function expectDigest(bytes, expected, label) {
    if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected) || digest(bytes) !== expected) {
        throw new Error(`CrispBASIC SHA-256 mismatch: ${label}. ${rebuild}`);
    }
}

/** Read and authenticate the built payload against its recipe and locks before
 * writing anything. The returned manifest describes the exact bytes we ship. */
export async function createCrispBasicPackage(packageRoot = CRISPBASIC_PACKAGE) {
    const files = new Map();
    const copy = async (source, target = source) => {
        const bytes = await required(packageRoot, source);
        files.set(target, bytes);
        return bytes;
    };
    const pkg = json(await required(packageRoot, 'package.json'));
    const lock = json(await copy('upstream.lock.json')).bbcSDL;
    const toolchain = json(await copy('wasm/toolchain.lock.json')).emscripten;
    const build = json(await copy('.build/wasm/build.json', 'wasm/build.json'));
    if (build.schemaVersion !== 1 || build.backend !== 'bbcsdl-wasm' ||
        build.upstreamCommit !== lock.commit || !isDeepStrictEqual(build.toolchain, toolchain)) {
        throw new Error(`CrispBASIC build does not match its locked interpreter/toolchain. ${rebuild}`);
    }
    const sourceInputs = lock.files.filter(file => WASM_UPSTREAM_INPUTS.includes(file.path));
    if (sourceInputs.length !== WASM_UPSTREAM_INPUTS.length || !isDeepStrictEqual(build.sourceInputs, sourceInputs)) {
        throw new Error(`CrispBASIC build has stale or incomplete upstream source records. ${rebuild}`);
    }
    if (!Array.isArray(build.localSourceInputs) ||
        !isDeepStrictEqual(build.localSourceInputs.map(file => file.path), [...WASM_LOCAL_INPUTS])) {
        throw new Error(`CrispBASIC build has no current local source record. ${rebuild}`);
    }
    for (const input of build.localSourceInputs) {
        expectDigest(await required(packageRoot, input.path), input.sha256, input.path);
    }
    const module = await copy('.build/wasm/crispbasic.mjs', 'wasm/crispbasic.mjs');
    const binary = await copy('.build/wasm/crispbasic.wasm', 'wasm/crispbasic.wasm');
    expectDigest(module, build.moduleSha256, 'generated JavaScript module');
    expectDigest(binary, build.wasmSha256, 'WASM binary');
    const compiled = await WebAssembly.compile(binary);
    if (!isDeepStrictEqual(WebAssembly.Module.imports(compiled), build.imports)) {
        throw new Error(`CrispBASIC WASM imports do not match the build record. ${rebuild}`);
    }
    const upstreamLicense = await copy('.build/wasm/BBCSDL-LICENSE.txt', 'licenses/BBCSDL-LICENSE.txt');
    expectDigest(upstreamLicense, lock.files.find(file => file.path === 'licence.txt')?.sha256, 'BBCSDL licence');
    for (const notice of toolchain.notices) {
        const name = basename(notice.path);
        const bytes = await copy(`.build/wasm/licenses/${name}`, `licenses/${name}`);
        expectDigest(bytes, notice.sha256, notice.path);
    }
    for (const path of ['browser.mjs', 'src/source.mjs', 'src/wasm-session.mjs',
        'src/wasm-worker.mjs', 'src/wasm-capabilities.mjs', 'src/simulation-host.mjs',
        'src/simulation-protocol.mjs', 'THIRD-PARTY-NOTICES.md']) {
        await copy(path);
    }
    await copy('LICENSE', 'LICENSE.txt');
    const manifest = {
        schemaVersion: 1,
        format: 'brickwright-crispbasic',
        version: pkg.version,
        backend: build.backend,
        upstreamCommit: build.upstreamCommit,
        compiler: build.compiler,
        entries: {browser: 'browser.mjs', worker: 'src/wasm-worker.mjs', module: 'wasm/crispbasic.mjs'},
        files: Object.fromEntries([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) =>
            [path, {bytes: bytes.length, sha256: digest(bytes)}]))
    };
    files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    return {files, manifest};
}

async function listFiles(directory, prefix = '') {
    const result = [];
    for (const entry of await readdir(directory, {withFileTypes: true})) {
        const path = prefix + entry.name;
        if (entry.isDirectory()) result.push(...await listFiles(join(directory, entry.name), `${path}/`));
        else if (entry.isFile()) result.push(path);
        else throw new Error(`CrispBASIC package contains a non-regular entry: ${path}`);
    }
    return result.sort();
}

export async function packageCrispBasic({packageRoot = CRISPBASIC_PACKAGE,
    destination = CRISPBASIC_DESTINATION, check = false} = {}) {
    const {files, manifest} = await createCrispBasicPackage(packageRoot);
    const target = resolve(destination);
    if (check) {
        let current;
        try { current = await listFiles(target); }
        catch (error) {
            if (error.code !== 'ENOENT') throw error;
            throw new Error('CrispBASIC package is missing; run npm run package:crispbasic.');
        }
        if (!isDeepStrictEqual(current, [...files.keys()].sort())) {
            throw new Error('CrispBASIC package has missing or unexpected files; run npm run package:crispbasic.');
        }
        for (const [path, expected] of files) {
            const currentBytes = await readFile(join(target, path));
            if (!currentBytes.equals(expected)) {
                throw new Error(`CrispBASIC packaged asset is stale: ${path}; run npm run package:crispbasic.`);
            }
        }
        return manifest;
    }

    // Complete the new payload before replacing the owned directory. The sibling
    // rename keeps a failed build from leaving a half-written runtime.
    await mkdir(dirname(target), {recursive: true});
    const staging = await mkdtemp(join(dirname(target), '.crispbasic-stage-'));
    const backup = `${staging}-previous`;
    let backedUp = false;
    try {
        for (const [path, bytes] of files) {
            await mkdir(dirname(join(staging, path)), {recursive: true});
            await writeFile(join(staging, path), bytes);
        }
        try { await rename(target, backup); backedUp = true; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        try { await rename(staging, target); }
        catch (error) {
            if (backedUp) await rename(backup, target);
            throw error;
        }
        if (backedUp) await rm(backup, {recursive: true, force: true});
    } finally { await rm(staging, {recursive: true, force: true}); }
    return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check')) {
        console.error('Usage: node scripts/package-crispbasic.mjs [--check]');
        process.exitCode = 2;
    } else {
        packageCrispBasic({check: args.includes('--check')}).then(manifest => {
            console.log(`CrispBASIC ${args.includes('--check') ? 'verified' : 'packaged'}: ` +
                `${Object.keys(manifest.files).length} assets in ${CRISPBASIC_DESTINATION}`);
        }).catch(error => { console.error(error.message); process.exitCode = 1; });
    }
}
