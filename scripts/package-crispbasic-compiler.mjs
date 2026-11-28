#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Stage the standalone repository's browser-safe compiler without duplicating
// its source into Brickwright's interpreter extraction/mirror history.
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/compiler/index.mjs', 'src/compiler/runtime.mjs', 'src/compiler/platform.mjs',
    'src/source.mjs', 'LICENSE'];
const exec = promisify(execFile);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function compilerLock(lockPath) {
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    let repository;
    try { repository = new URL(lock.repository); } catch { /* diagnosed below */ }
    if (lock.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(lock.commit || '') ||
        !repository || !['https:', 'file:'].includes(repository.protocol) || repository.username || repository.password) {
        throw new Error('The C99 compiler lock requires schemaVersion 1, an HTTPS repository (or local file URL), and an exact 40-hex commit.');
    }
    if (JSON.stringify(Object.keys(lock.files || {}).sort()) !== JSON.stringify([...files].sort())) {
        throw new Error('The C99 compiler lock must enumerate exactly the five compiler source/license files.');
    }
    for (const name of files) {
        const entry = lock.files[name];
        if (!Number.isSafeInteger(entry?.bytes) || entry.bytes < 1 || !/^[0-9a-f]{64}$/.test(entry.sha256 || '')) {
            throw new Error(`The C99 compiler lock has no valid size/SHA-256 for ${name}.`);
        }
    }
    return lock;
}

function manifestFor(lock) {
    return {schemaVersion: 1, format: 'brickwright-crispbasic-c99', entry: 'src/compiler/index.mjs',
        source: {repository: lock.repository, commit: lock.commit},
        files: Object.fromEntries(files.map(name => [name, {bytes: lock.files[name].bytes, sha256: lock.files[name].sha256}]))};
}

function verifySource(name, bytes, lock) {
    const expected = lock.files[name];
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) {
        throw new Error(`C99 compiler source does not match locked commit ${lock.commit}: ${name}. Update the reviewed lock when changing compiler revisions.`);
    }
}

async function stagedFiles(directory, prefix = '') {
    const names = [];
    for (const entry of await readdir(directory, {withFileTypes: true})) {
        const name = prefix + entry.name;
        if (entry.isDirectory()) names.push(...await stagedFiles(path.join(directory, entry.name), name + '/'));
        else if (entry.isFile()) names.push(name);
        else throw new Error(`Unexpected non-file in C99 compiler assets: ${name}`);
    }
    return names;
}

async function verifyStaged(target, lock, manifest) {
    const found = await stagedFiles(target);
    if (JSON.stringify(found.sort()) !== JSON.stringify([...files, 'manifest.json'].sort())) {
        throw new Error('The C99 compiler package has missing or unexpected assets.');
    }
    const actual = JSON.parse(await readFile(path.join(target, 'manifest.json'), 'utf8'));
    if (JSON.stringify(actual) !== JSON.stringify(manifest)) throw new Error('The C99 compiler asset manifest is stale.');
    for (const name of files) verifySource(name, await readFile(path.join(target, name)), lock);
}

async function lockedSources(lock, cacheRoot) {
    const repository = path.join(path.resolve(cacheRoot), lock.commit + '.git');
    await mkdir(repository, {recursive: true});
    const git = async args => {
        try {
            return await exec('git', ['--no-replace-objects', '--git-dir', repository, ...args],
                {encoding: 'buffer', timeout: 120000, maxBuffer: 1024 * 1024,
                    env: {...process.env, GIT_TERMINAL_PROMPT: '0'}});
        } catch (error) {
            throw new Error(`Cannot prepare locked CrispBASIC compiler ${lock.commit}: ${String(error.stderr || error.message).trim()}`);
        }
    };
    await git(['init', '--bare', '--quiet']);
    try { await git(['cat-file', '-e', `${lock.commit}^{commit}`]); }
    catch {
        await git(['fetch', '--quiet', '--no-tags', '--depth=1', lock.repository, lock.commit]);
    }
    const revision = String((await git(['rev-parse', `${lock.commit}^{commit}`])).stdout).trim();
    if (revision !== lock.commit) throw new Error(`C99 compiler fetch resolved ${revision}, expected ${lock.commit}.`);
    const sources = new Map();
    for (const name of files) sources.set(name, (await git(['show', `${lock.commit}:${name}`])).stdout);
    return sources;
}

export async function packageCrispBasicCompiler ({packageRoot,
    destination = path.join(root, 'packages/scratch-gui/static/crispbasic-compiler'),
    lockPath = path.join(root, 'crispbasic-compiler.lock.json'),
    cacheRoot = path.join(root, '.build/crispbasic-compiler'), check = false} = {}) {
    const lock = await compilerLock(lockPath), manifest = manifestFor(lock);
    const target = path.resolve(destination);
    if (check) { await verifyStaged(target, lock, manifest); return manifest; }
    // A valid staged package is already sufficient for an offline incremental
    // build. Explicit local sources are still checked even when assets exist.
    if (!packageRoot) {
        try { await verifyStaged(target, lock, manifest); return manifest; }
        catch { /* Rebuild absent/stale assets from the immutable source pin. */ }
    }
    const sources = packageRoot ? new Map(await Promise.all(files.map(async name =>
        [name, await readFile(path.join(packageRoot, name))]))) : await lockedSources(lock, cacheRoot);
    for (const [name, bytes] of sources) verifySource(name, bytes, lock);
    const compiler = sources.get('src/compiler/index.mjs').toString('utf8');
    if (!/export function compileSource\b/.test(compiler)) throw new Error('The supplied package has no C99 compiler entrypoint.');
    sources.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    await mkdir(path.dirname(target), {recursive: true});
    const staging = await mkdtemp(path.join(path.dirname(target), '.crispbasic-compiler-'));
    const backup = staging + '-previous';
    let previous = false;
    try {
        for (const [name, bytes] of sources) {
            await mkdir(path.dirname(path.join(staging, name)), {recursive: true});
            await writeFile(path.join(staging, name), bytes);
        }
        try { await rename(target, backup); previous = true; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        try { await rename(staging, target); }
        catch (error) { if (previous) await rename(backup, target); throw error; }
        if (previous) await rm(backup, {recursive: true, force: true});
        return manifest;
    } finally { await rm(staging, {recursive: true, force: true}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const options = {};
    try {
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--check') options.check = true;
            else if (['--package', '--destination'].includes(args[i]) && args[i + 1]) {
                options[args[i] === '--package' ? 'packageRoot' : 'destination'] = path.resolve(args[++i]);
            } else throw new Error('Usage: node scripts/package-crispbasic-compiler.mjs [--check] [--package PATH] [--destination PATH]');
        }
        packageCrispBasicCompiler(options).then(manifest => {
            console.log(`${options.check ? 'Verified' : 'Packaged'} ${Object.keys(manifest.files).length} C99 compiler assets at ${manifest.source.commit}.`);
        }).catch(error => { console.error(error.message); process.exitCode = 1; });
    } catch (error) { console.error(error.message); process.exitCode = 2; }
}
