import {createHash, randomBytes} from 'node:crypto';
import {chmod, link, mkdir, readFile, realpath, rename, stat, unlink, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSource, SourceError} from './source.mjs';
import {hostNativeTarget, nativeTarget, verifyNativeBinary} from '../scripts/native-targets.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const magic = Buffer.alloc(16); magic.write('CRISPSDLBNDL1');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const maximum = 512 * 1024 * 1024;
export function validateSDLAssetPath(path) {
    if (typeof path !== 'string' || !path || Buffer.byteLength(path) > 1000 ||
        /[\\\x00-\x1f\x7f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('SDL asset paths must be relative file paths without empty, dot, parent, or control segments');
    }
    return path;
}
function archive(entries) {
    if (entries.length > 10000) throw new Error('Full SDL archive exceeds 10000 files');
    const count = Buffer.alloc(4); count.writeUInt32LE(entries.length);
    const chunks = [count]; let total = 4;
    for (const entry of entries) {
        const path = Buffer.from(validateSDLAssetPath(entry.path)), header = Buffer.alloc(16);
        header.writeUInt32LE(path.length); header.writeUInt32LE(entry.executable ? 0o700 : 0o600, 4);
        header.writeBigUInt64LE(BigInt(entry.bytes.length), 8);
        total += 16 + path.length + entry.bytes.length;
        if (total > maximum) throw new Error('Full SDL bundle payload exceeds 512 MiB');
        chunks.push(header, path, entry.bytes);
    }
    return Buffer.concat(chunks, total);
}
async function canonical(path) {
    try { return await realpath(path); }
    catch (error) { if (error.code === 'ENOENT') return resolve(path); throw error; }
}
/** Package the full SDL host as one self-extracting Linux application.
 * Receipts and hashes are mandatory; resources are addressed through @dir$.
 */
export async function bundleSDL(source, {
    filename = 'main.bas', output, target = hostNativeTarget(), runtimePack,
    title = basename(filename), assets = [], overwrite = false
} = {}) {
    const configuration = nativeTarget(target);
    if (typeof overwrite !== 'boolean') throw new TypeError('overwrite must be boolean');
    if (typeof title !== 'string' || !title || title.includes('\0')) throw new TypeError('title must be a nonempty string');
    if (!Array.isArray(assets)) throw new TypeError('assets must be an array of {source,path}');
    const prepared = prepareSource(source, {filename}), program = Buffer.from(prepared.numberedSource, 'latin1');
    if (program.length > 4 * 1024 * 1024) throw new SourceError('prepared source exceeds 4 MiB', {filename, code: 'source-too-large'});
    const pack = resolve(runtimePack ?? join(root, '.build/sdl/native', target, 'runtime'));
    const destination = resolve(output ?? join(dirname(filename), basename(filename, extname(filename))));
    const inputs = [resolve(filename), join(pack, 'runtime.json')];
    let receipt;
    try { receipt = JSON.parse(await readFile(join(pack, 'runtime.json'), 'utf8')); }
    catch (error) {
        if (error.code === 'ENOENT') throw new Error('Full SDL runtime pack not found; run npm run build:sdl:native or select --runtime-pack');
        throw error;
    }
    if (receipt.schemaVersion !== 1 || receipt.format !== 'crispbasic-sdl-runtime' || receipt.target !== target ||
        receipt.profile !== 'bbcsdl-full-native' || !Array.isArray(receipt.files) || receipt.files.length > 9000) {
        throw new Error('Invalid or incompatible full SDL runtime pack');
    }
    const launcherPath = join(pack, validateSDLAssetPath(receipt.launcher?.path));
    const launcher = await readFile(launcherPath); inputs.push(launcherPath);
    if (digest(launcher) !== receipt.launcher.sha256) throw new Error('SDL launcher SHA-256 mismatch');
    verifyNativeBinary(launcher, configuration);
    const entries = [], paths = new Set(), notices = [];
    const add = entry => {
        validateSDLAssetPath(entry.path);
        if (paths.has(entry.path)) throw new Error('Duplicate SDL archive path: ' + entry.path);
        for (const path of paths) if (path.startsWith(entry.path + '/') || entry.path.startsWith(path + '/')) {
            throw new Error('Conflicting SDL file and directory paths: ' + entry.path);
        }
        paths.add(entry.path); entries.push(entry);
    };
    for (const file of receipt.files) {
        const path = validateSDLAssetPath(file.path), input = join(pack, path);
        if (!(await canonical(input)).startsWith((await canonical(pack)) + '/')) throw new Error('SDL runtime entry escapes runtime pack');
        if ((await stat(input)).size > maximum) throw new Error('SDL runtime file exceeds 512 MiB: ' + path);
        const bytes = await readFile(input); inputs.push(input);
        if (digest(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error('SDL runtime SHA-256/size mismatch: ' + path);
        if (path === 'bbcsdl' || path === 'libstb.so' || path.endsWith('.so.0')) verifyNativeBinary(bytes, configuration);
        add({path: 'runtime/' + path, bytes, executable: file.executable === true});
        if (path.startsWith('notices/') && !path.includes('/upstream/')) notices.push({path, text: bytes.toString('utf8')});
    }
    for (const required of ['bbcsdl', 'libstb.so', 'libSDL2-2.0.so.0', 'libSDL2_ttf-2.0.so.0', 'libSDL2_net-2.0.so.0', 'notices/BBCSDL-LICENSE.txt']) {
        if (!paths.has('runtime/' + required)) throw new Error('Incomplete SDL runtime pack: ' + required);
    }
    add({path: 'program/main.bas', bytes: program, executable: false});
    const resources = [];
    for (const asset of assets) {
        const path = validateSDLAssetPath(asset?.path);
        if (typeof asset.source !== 'string' || !asset.source) throw new TypeError('SDL asset source must name a file');
        const input = resolve(asset.source); inputs.push(input);
        const info = await stat(input);
        if (!info.isFile()) throw new Error('SDL assets must be ordinary files: ' + input);
        if (info.size > maximum) throw new Error('SDL asset exceeds 512 MiB: ' + input);
        const bytes = await readFile(input);
        add({path: 'program/' + path, bytes, executable: false});
        resources.push({path, bytes: bytes.length, sha256: digest(bytes)});
    }
    const canonicalDestination = await canonical(destination);
    for (const input of inputs) if (canonicalDestination === await canonical(input)) {
        throw new Error('Bundle output must differ from source, runtime, and asset inputs');
    }
    const metadata = {
        schemaVersion: 1, format: 'crispbasic-sdl-bundle', profile: 'bbcsdl-full-native', target, title,
        filename: basename(filename), upstreamCommit: receipt.upstreamCommit, cpuRequirement: receipt.cpuRequirement,
        sourceSha256: digest(program), sourceMap: prepared.sourceMap,
        implementation: 'Pinned full BBCSDL interpreter and SDL host; original BASIC source is embedded and tokenized by BBCSDL',
        lifetime: 'END/fallthrough exits the application; QUIT preserves the exit status; ON ERROR remains active',
        extraction: {privateDirectory: true, cleanupAfterExit: true, parent: 'TMPDIR or /tmp', callerWorkingDirectory: 'preserved',
            applicationResources: '@dir$', executableTemporaryFiles: true},
        capabilities: {graphics: true, graphicsReadback: true, sound: true, envelope: true, mouse: true,
            files: true, time: true, timeString: true, eval: true, inlineAssembler: configuration.architecture,
            indirection: true, nativeSystemCalls: true, osCommands: true, timeout: false, outputLimit: false,
            physicalPins: false, description: 'Full upstream Linux SDL host, subject to target architecture, operating system, drivers and supplied libraries/resources'},
        systemDependencies: receipt.systemDependencies, excludedOptionalLibraries: receipt.excludedOptionalLibraries,
        resources, notices, runtimeFiles: receipt.files.map(({path, sha256, bytes}) => ({path, sha256, bytes}))
    };
    const payload = archive(entries), encoded = Buffer.from(JSON.stringify(metadata));
    if (encoded.length > 8 * 1024 * 1024) throw new Error('SDL bundle metadata exceeds 8 MiB');
    const footer = Buffer.alloc(32); magic.copy(footer);
    footer.writeBigUInt64LE(BigInt(payload.length), 16); footer.writeBigUInt64LE(BigInt(encoded.length), 24);
    const bytes = Buffer.concat([launcher, payload, encoded, footer]);
    await mkdir(dirname(destination), {recursive: true});
    const temporary = destination + '.tmp-' + randomBytes(8).toString('hex');
    try {
        await writeFile(temporary, bytes, {flag: 'wx', mode: 0o755}); await chmod(temporary, 0o755);
        if (overwrite) await rename(temporary, destination);
        else { await link(temporary, destination); await unlink(temporary); }
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return {path: destination, target, profile: 'sdl', bytes: bytes.length, sha256: digest(bytes), capabilities: metadata.capabilities, metadata};
}
