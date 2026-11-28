import {createHash} from 'node:crypto';
import {link, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSource, SourceError} from './source.mjs';
import {validateSDLAssetPath} from './bundle-sdl.mjs';
import {renderSDLWebPage} from './bundle-sdl-web-page.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 128 << 20;
const reservedRoots = new Set(['dev', 'proc', 'tmp', 'usr', 'program.bas']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = async path => {
    try { return await realpath(path); }
    catch (error) { if (error.code === 'ENOENT') return resolve(path); throw error; }
};
const boundedRead = async filename => {
    const info = await stat(filename);
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error(`Expected a regular file of at most ${MAX_BYTES} bytes: ${filename}`);
    return readFile(filename);
};
const noticeText = bytes => {
    try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch { return bytes.toString('latin1'); }
};

async function atomicWrite(destination, bytes, overwrite) {
    await mkdir(dirname(destination), {recursive: true});
    const temporary = await mkdtemp(join(dirname(destination), '.crispbasic-sdl-web-'));
    try {
        const file = join(temporary, 'artifact.html');
        await writeFile(file, bytes);
        if (overwrite) await rename(file, destination);
        else {
            try { await link(file, destination); }
            catch (error) {
                if (error.code === 'EEXIST') throw new Error(`Output already exists: ${destination}; use --force to replace it.`);
                throw error;
            }
        }
    } finally { await rm(temporary, {recursive: true, force: true}); }
}

/** Package the pinned full SDL WebAssembly host and source into one HTML file. */
export async function bundleSDLWeb(source, {
    filename = 'main.bas', output, runtimePack, title = basename(filename), assets = [], overwrite = false
} = {}) {
    if (typeof overwrite !== 'boolean') throw new Error('overwrite must be a boolean');
    if (typeof title !== 'string' || !title || title.includes('\0')) throw new Error('title must be a nonempty string without NUL');
    if (!Array.isArray(assets)) throw new Error('assets must be an array');
    const prepared = prepareSource(source, {filename});
    const program = Buffer.from(prepared.numberedSource, 'latin1');
    if (program.length > (4 << 20)) throw new SourceError('prepared program exceeds 4 MiB', {filename, code: 'program-too-large'});
    const destination = resolve(output || filename.slice(0, filename.length - extname(filename).length) + '.html');
    const pack = resolve(runtimePack || join(root, '.build/sdl-web'));
    const packRoot = await canonical(pack);
    const receiptPath = join(pack, 'build.json');
    let receipt;
    try { receipt = JSON.parse((await boundedRead(receiptPath)).toString('utf8')); }
    catch (error) {
        if (error.code === 'ENOENT') throw new Error('SDL web runtime is not built; run node scripts/build-sdl-web.mjs or pass --runtime-pack.');
        throw error;
    }
    if (receipt.schemaVersion !== 1 || receipt.hostABI !== 1 || receipt.format !== 'crispbasic-sdl-web-runtime' ||
        receipt.backend !== 'bbcsdl-sdl-wasm' || !Array.isArray(receipt.files) || receipt.files.length > 9000 ||
        !Array.isArray(receipt.notices) || !Array.isArray(receipt.assets)) {
        throw new Error('Invalid or unsupported SDL web runtime receipt');
    }
    const inputs = [await canonical(filename), await canonical(receiptPath)];
    const contents = new Map();
    let total = program.length;
    for (const file of receipt.files) {
        const path = validateSDLAssetPath(file.path);
        if (contents.has(path)) throw new Error('Duplicate runtime file: ' + path);
        const input = await canonical(join(pack, path));
        if (!input.startsWith(packRoot + '/')) throw new Error('Runtime file escapes the runtime pack: ' + path);
        const bytes = await boundedRead(input);
        if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('Runtime file SHA-256 or size mismatch: ' + path);
        total += bytes.length;
        if (total > MAX_BYTES) throw new Error('Embedded SDL web inputs exceed 128 MiB');
        inputs.push(input);
        contents.set(path, bytes);
    }
    const module = contents.get(validateSDLAssetPath(receipt.module));
    const wasm = contents.get(validateSDLAssetPath(receipt.wasm));
    if (!module || !wasm || !wasm.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])) ||
        !module.includes('createCrispBasicSDL') || !module.includes('mainScriptUrlOrBlob')) {
        throw new Error('Runtime receipt does not identify the supported full SDL module and WASM binary');
    }
    const notices = receipt.notices.map(notice => {
        const bytes = contents.get(validateSDLAssetPath(notice.path));
        if (!bytes || typeof notice.name !== 'string' || !notice.name) throw new Error('Invalid runtime notice');
        return {name: notice.name, text: noticeText(bytes)};
    });
    if (!notices.some(notice => notice.name === 'BBCSDL')) throw new Error('Runtime pack must retain the BBCSDL notice');
    const resources = [];
    const paths = new Set(['program.bas']);
    const addResource = (path, bytes) => {
        path = validateSDLAssetPath(path);
        if (reservedRoots.has(path.split('/')[0])) throw new Error('Reserved virtual asset path: ' + path);
        for (const previous of paths) {
            if (previous === path || previous.startsWith(path + '/') || path.startsWith(previous + '/')) {
                throw new Error('Duplicate or conflicting virtual asset path: ' + path);
            }
        }
        paths.add(path);
        resources.push({path, size: bytes.length, sha256: digest(bytes), data: bytes.toString('base64')});
    };
    for (const asset of receipt.assets) {
        const bytes = contents.get(validateSDLAssetPath(asset.file));
        if (!bytes) throw new Error('Runtime resource is absent from the receipt: ' + asset.file);
        addResource(asset.path, bytes);
    }
    for (const asset of assets) {
        if (!asset || typeof asset.source !== 'string') throw new Error('Each asset needs source and path strings');
        const input = await canonical(asset.source);
        const bytes = await boundedRead(input);
        total += bytes.length;
        if (total > MAX_BYTES) throw new Error('Embedded SDL web inputs exceed 128 MiB');
        inputs.push(input);
        addResource(asset.path, bytes);
    }
    const canonicalOutput = await canonical(destination);
    if (inputs.includes(canonicalOutput)) throw new Error('Output must not overwrite source, runtime, receipt or asset input');
    const metadata = {
        schemaVersion: 1, format: 'crispbasic-bundle', profile: 'sdl', target: 'web', backend: receipt.backend,
        filename: basename(filename), sourceSha256: digest(Buffer.from(prepared.source, 'latin1')),
        sourceMap: prepared.sourceMap, upstreamCommit: receipt.upstreamCommit,
        moduleSha256: digest(module), runtimeSha256: digest(wasm), capabilities: receipt.capabilities,
        limitations: receipt.limitations, notices,
        assets: resources.map(({path, size, sha256}) => ({path, bytes: size, sha256})),
        execution: {
            singleDocument: true, networkAssets: false, requiresLocalServer: true,
            crossOriginIsolation: true, timeout: false, outputLimit: false,
            captureDefault: false, maxCapturedVduBytes: 16 << 20
        },
        implementation: 'Pinned BBCSDL SDL host; source is embedded and tokenized by BBCSDL, not compiled.'
    };
    const page = Buffer.from(renderSDLWebPage({metadata, program: program.toString('base64'),
        module: module.toString('base64'), wasm: wasm.toString('base64'), resources}, title));
    await atomicWrite(destination, page, overwrite);
    return {path: destination, target: 'web', profile: 'sdl', backend: receipt.backend,
        bytes: page.length, sha256: digest(page), capabilities: receipt.capabilities};
}
