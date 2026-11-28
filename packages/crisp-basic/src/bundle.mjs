// Original code, BSD-3-Clause. Packaging never translates BASIC statements.
import {createHash} from 'node:crypto';
import {chmod, link, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSource, SourceError} from './source.mjs';
import {NATIVE_CAPABILITIES} from './capabilities.mjs';
import {WASM_CAPABILITIES} from './wasm-capabilities.mjs';
import {hostNativeTarget, nativeTarget, verifyNativeBinary} from '../scripts/native-targets.mjs';
import {renderBundlePage} from './bundle-page.mjs';
import {bundleSDL} from './bundle-sdl.mjs';
import {bundleSDLWeb} from './bundle-sdl-web.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAGIC = Buffer.from('CRISPBASICBNDL1\0', 'ascii');
const HOST_ABI = Buffer.from('CRISPBASIC-BUNDLE-HOST-V1', 'ascii');
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
export const BUNDLE_TARGETS = Object.freeze(['linux-x64', 'linux-arm64', 'linux-armv7', 'web']);
export const BUNDLE_PROFILES = Object.freeze(['sdl', 'headless']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function readAsset(path, build) {
    try { return await readFile(path); }
    catch (error) {
        if (error.code === 'ENOENT') throw new Error(`Missing bundle runtime ${path}; run ${build} first.`);
        throw error;
    }
}

async function optionalManifest(path) {
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function notices(web) {
    const paths = ['LICENSE', 'native/BBCSDL-LICENSE.txt'];
    if (web) {
        const lock = JSON.parse(await readFile(join(root, 'wasm/toolchain.lock.json'), 'utf8'));
        paths.push(...lock.emscripten.notices.map(notice => notice.path));
    }
    return Promise.all(paths.map(async path => ({path, text: await readFile(join(root, path), 'utf8')})));
}

async function atomicOutput(path, bytes, executable, overwrite) {
    await mkdir(dirname(path), {recursive: true});
    const directory = await mkdtemp(join(dirname(path), '.crispbasic-bundle-'));
    const temporary = join(directory, 'artifact');
    try {
        await writeFile(temporary, bytes);
        if (executable) await chmod(temporary, 0o755);
        if (overwrite) await rename(temporary, path);
        else {
            try { await link(temporary, path); }
            catch (error) {
                if (error.code === 'EEXIST') throw new Error(`Output already exists: ${path}; use --force to replace it.`);
                throw error;
            }
        }
    } finally { await rm(directory, {recursive: true, force: true}); }
}

/**
 * Embed BBC BASIC and an already-built BBCSDL runtime in one native executable
 * or one offline HTML document. Each artifact retains that runtime's capability
 * profile: packaging cannot add SDL graphics/sound or browser OS access.
 */
export async function bundle(source, {
    filename = 'main.bas', output, target = hostNativeTarget(), runtime, modulePath, wasmPath,
    title = basename(filename), overwrite = false, profile = 'sdl', runtimePack, assets = []
} = {}) {
    if (!BUNDLE_TARGETS.includes(target)) throw new Error(`Unsupported bundle target ${target}; choose ${BUNDLE_TARGETS.join(', ')}`);
    if (!BUNDLE_PROFILES.includes(profile)) throw new Error(`Unsupported bundle profile ${profile}; choose ${BUNDLE_PROFILES.join(', ')}`);
    if (profile === 'sdl') {
        if (runtime !== undefined || modulePath !== undefined || wasmPath !== undefined) {
            throw new Error('runtime/modulePath/wasmPath select the headless host; use profile headless, or runtimePack for SDL');
        }
        return target === 'web' ? bundleSDLWeb(source, {filename, output, runtimePack, title, assets, overwrite}) :
            bundleSDL(source, {filename, output, target, runtimePack, title, assets, overwrite});
    }
    if (runtimePack !== undefined || !Array.isArray(assets) || assets.length) {
        throw new Error('runtimePack and assets require the sdl profile');
    }
    if (typeof overwrite !== 'boolean') throw new TypeError('overwrite must be boolean');
    if (typeof title !== 'string' || !title || title.includes('\0')) throw new TypeError('title must be a nonempty string');
    if (target === 'web' && runtime !== undefined) throw new Error('runtime is a native option; use modulePath and wasmPath for web');
    if (target !== 'web' && (modulePath !== undefined || wasmPath !== undefined)) throw new Error('modulePath and wasmPath require target web');
    const prepared = prepareSource(source, {filename});
    const program = Buffer.from(prepared.numberedSource, 'latin1');
    if (program.length > MAX_SOURCE_BYTES) throw new SourceError('prepared source exceeds the 4 MiB limit', {code: 'source-too-large', filename});
    const stem = basename(filename, extname(filename));
    const destination = resolve(output ?? join(dirname(filename), target === 'web' ? `${stem}.html` : stem));
    if (destination === resolve(filename)) throw new Error('Bundle output must differ from the source filename');
    let bytes, metadata;
    const base = {schemaVersion: 1, format: 'crispbasic-bundle', target, profile,
        filename: basename(filename), sourceSha256: sha256(program), sourceMap: prepared.sourceMap,
        implementation: 'Pinned BBCSDL interpreter with the CrispBASIC host; original BASIC is embedded, not compiled',
        notices: await notices(target === 'web')};

    if (target === 'web') {
        const moduleFile = resolve(modulePath ?? join(root, '.build/wasm/crispbasic.mjs'));
        const wasmFile = resolve(wasmPath ?? join(dirname(moduleFile), 'crispbasic.wasm'));
        if ([moduleFile, wasmFile].includes(destination)) throw new Error('Bundle output must differ from runtime inputs');
        const [moduleBytes, wasmBytes, workerBytes, protocolBytes, manifest] = await Promise.all([
            readAsset(moduleFile, 'npm run build:wasm'), readAsset(wasmFile, 'npm run build:wasm'),
            readFile(join(root, 'src/wasm-worker.mjs')), readFile(join(root, 'src/simulation-protocol.mjs')),
            optionalManifest(join(dirname(moduleFile), 'build.json'))
        ]);
        if (wasmBytes.length < 8 || !wasmBytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) {
            throw new Error('The web runtime is not a WebAssembly v1 module');
        }
        if (!workerBytes.toString('utf8').includes("'./simulation-protocol.mjs'")) throw new Error('WASM worker import contract changed; update the offline bundler');
        if (manifest && (manifest.moduleSha256 !== sha256(moduleBytes) || manifest.wasmSha256 !== sha256(wasmBytes))) {
            throw new Error('WASM runtime does not match its build receipt; rebuild it before bundling');
        }
        metadata = {...base, backend: 'bbcsdl-wasm', capabilities: {
            ...WASM_CAPABILITIES, platforms: ['browser-worker'],
            execution: {...WASM_CAPABILITIES.execution, timeout: false},
            simulation: {available: false, enabled: false, basicBridge: false}
        },
            upstreamCommit: manifest?.upstreamCommit ?? null,
            runtimeSha256: sha256(wasmBytes), moduleSha256: sha256(moduleBytes),
            limits: {maxInputBytes: 1024 * 1024, maxOutputBytes: 16 * 1024 * 1024},
            evidence: 'Packaging retains the selected runtime. Full SDL graphics, sound, filesystem and OS facilities are not supplied by this restricted host.'};
        const assets = {metadata, program: program.toString('base64'), module: moduleBytes.toString('base64'),
            wasm: wasmBytes.toString('base64'), worker: workerBytes.toString('base64'), protocol: protocolBytes.toString('base64')};
        bytes = Buffer.from(renderBundlePage(assets, title), 'utf8');
    } else {
        const config = nativeTarget(target);
        const runtimeFile = resolve(runtime ?? (target === hostNativeTarget() ? join(root, '.build/crispbasic-native') :
            join(root, '.build/targets', target, 'crispbasic-native')));
        if (destination === runtimeFile) throw new Error('Bundle output must differ from the runtime executable');
        const binary = await readAsset(runtimeFile, `CRISP_BASIC_TARGET=${target} npm run build:native`);
        verifyNativeBinary(binary, config);
        if (!binary.includes(HOST_ABI)) throw new Error('Native runtime lacks bundle ABI v1; rebuild it with npm run build:native');
        if (binary.subarray(-MAGIC.length).equals(MAGIC)) throw new Error('The runtime input is already a bundled executable');
        const manifest = await optionalManifest(join(dirname(runtimeFile), 'native-build.json'));
        if (manifest && (manifest.binarySha256 !== sha256(binary) || manifest.target !== target)) {
            throw new Error('Native runtime does not match its build receipt or target; rebuild it before bundling');
        }
        metadata = {...base, backend: 'bbcsdl-native', capabilities: {
            ...NATIVE_CAPABILITIES, platforms: [target],
            execution: {...NATIVE_CAPABILITIES.execution, cancellation: false, timeout: false, outputLimit: false}
        },
            upstreamCommit: manifest?.upstreamCommit ?? null, runtimeSha256: sha256(binary),
            execution: {nodeRequired: false, extractedSource: false, systemLibraries: true},
            evidence: 'Packaging retains the native console host. SDL graphics and sound are not supplied by this host.'};
        const encodedMetadata = Buffer.from(JSON.stringify(metadata), 'utf8');
        if (encodedMetadata.length > 1024 * 1024) throw new Error('Bundle metadata exceeds the 1 MiB limit');
        const footer = Buffer.alloc(24);
        footer.writeUInt32LE(program.length, 0);
        footer.writeUInt32LE(encodedMetadata.length, 4);
        MAGIC.copy(footer, 8);
        bytes = Buffer.concat([binary, program, encodedMetadata, footer]);
    }
    await atomicOutput(destination, bytes, target !== 'web', overwrite);
    return {path: destination, target, profile, bytes: bytes.length, sha256: sha256(bytes),
        backend: metadata.backend, capabilities: metadata.capabilities};
}

/** Inspect the byte-level native overlay without executing the program. */
export function inspectNativeBundle(bytes) {
    const buffer = Buffer.from(bytes);
    if (buffer.length < 24 || !buffer.subarray(-16).equals(MAGIC)) throw new Error('Not a CrispBASIC native bundle');
    const sourceLength = buffer.readUInt32LE(buffer.length - 24);
    const metadataLength = buffer.readUInt32LE(buffer.length - 20);
    const start = buffer.length - 24 - sourceLength - metadataLength;
    if (start < 0 || sourceLength > MAX_SOURCE_BYTES || metadataLength > 1024 * 1024 || !metadataLength) throw new Error('Invalid native bundle lengths');
    return {runtime: buffer.subarray(0, start), source: buffer.subarray(start, start + sourceLength),
        metadata: JSON.parse(buffer.subarray(start + sourceLength, buffer.length - 24).toString('utf8'))};
}
