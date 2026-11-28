// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {packageCrispBasicCompiler} from '../scripts/package-crispbasic-compiler.mjs';

async function fixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'crispbasic-compiler-package-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const source = path.join(directory, 'upstream');
    await mkdir(source);
    const git = (...args) => execFileSync('git', ['-C', source, ...args], {encoding: 'utf8'}).trim();
    git('init', '--quiet');
    git('config', 'user.name', 'Compiler packaging test');
    git('config', 'user.email', 'compiler-test@example.invalid');
    const contents = {
        'src/compiler/index.mjs': 'export function compileSource() { return {c: "pinned"}; }\n',
        'src/compiler/runtime.mjs': 'export const runtime = "pinned runtime";\n',
        'src/compiler/platform.mjs': 'export const platform = "pinned platform";\n',
        'src/source.mjs': 'export const source = "pinned source";\n',
        LICENSE: 'BSD-3-Clause test fixture\n'
    };
    for (const [name, text] of Object.entries(contents)) {
        await mkdir(path.dirname(path.join(source, name)), {recursive: true});
        await writeFile(path.join(source, name), text);
    }
    git('add', '.');
    git('commit', '--quiet', '-m', 'Pinned compiler fixture');
    const commit = git('rev-parse', 'HEAD');
    const lock = {schemaVersion: 1, repository: pathToFileURL(source).href, commit,
        files: Object.fromEntries(Object.entries(contents).map(([name, text]) => [name,
            {bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex')}]))};
    const lockPath = path.join(directory, 'compiler.lock.json');
    await writeFile(lockPath, JSON.stringify(lock));
    return {directory, source, git, contents, lock,
        options: {lockPath, cacheRoot: path.join(directory, 'cache'), destination: path.join(directory, 'assets')}};
}

test('default staging fetches the exact source commit, survives branch drift, and supports offline rebuilds', async t => {
    const f = await fixture(t);
    await writeFile(path.join(f.source, 'src/compiler/index.mjs'), 'export function compileSource() { return {c: "new unreviewed HEAD"}; }\n');
    f.git('add', '.'); f.git('commit', '--quiet', '-m', 'A later upstream compiler');
    assert.notEqual(f.git('rev-parse', 'HEAD'), f.lock.commit);
    const manifest = await packageCrispBasicCompiler(f.options);
    assert.equal(manifest.source.commit, f.lock.commit);
    const entry = path.join(f.options.destination, 'src/compiler/index.mjs');
    assert.equal((await import(pathToFileURL(entry).href)).compileSource().c, 'pinned');
    await rm(f.source, {recursive: true});
    await packageCrispBasicCompiler({...f.options, check: true});
    await packageCrispBasicCompiler(f.options); // valid staged bytes need no network/cache read
    await rm(f.options.destination, {recursive: true});
    await packageCrispBasicCompiler(f.options); // immutable git cache rebuild, upstream absent
    assert.equal(await readFile(entry, 'utf8'), f.contents['src/compiler/index.mjs']);
});

test('local source overrides and packaged assets must match locked hashes without replacing good assets', async t => {
    const f = await fixture(t);
    await packageCrispBasicCompiler({...f.options, packageRoot: f.source});
    const entry = path.join(f.options.destination, 'src/compiler/runtime.mjs');
    const before = await readFile(entry, 'utf8');
    await writeFile(path.join(f.source, 'src/compiler/runtime.mjs'), 'changed local runtime');
    await assert.rejects(packageCrispBasicCompiler({...f.options, packageRoot: f.source}), /does not match locked commit.*runtime\.mjs/);
    assert.equal(await readFile(entry, 'utf8'), before);
    await writeFile(entry, 'changed staged runtime');
    await assert.rejects(packageCrispBasicCompiler({...f.options, check: true}), /does not match locked commit/);
    await writeFile(path.join(f.options.destination, 'unexpected.mjs'), 'unlisted executable module');
    await assert.rejects(packageCrispBasicCompiler({...f.options, check: true}), /unexpected assets/);
});

test('mutable revisions are refused before fetching or staging', async t => {
    const f = await fixture(t);
    await writeFile(f.options.lockPath, JSON.stringify({...f.lock, commit: 'main'}));
    await assert.rejects(packageCrispBasicCompiler(f.options), /exact 40-hex commit/);
});
