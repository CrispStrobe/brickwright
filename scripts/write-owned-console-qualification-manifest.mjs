#!/usr/bin/env node
// Local candidate integration identity. Never emits the hosted GUI manifest.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {bindGuiHarnessGit} from './lib/gui-harness-source.mjs';

const arg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    if (index < 0) return fallback;
    assert(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), `${name} requires a value`);
    return process.argv[index + 1];
};
const supplierArgument = arg('--supplier');
assert(supplierArgument, '--supplier requires an immutable candidate checkout');
const root = path.resolve(arg('--consumer', process.cwd()));
const supplier = path.resolve(supplierArgument);
const site = path.resolve(root, arg('--build', 'packages/scratch-gui/build'));
const out = path.resolve(arg('--out', path.join(root, 'scripts/probes/code-runtime/owned-code-tab/experimental-bundle.json')));
const expectedSupplier = arg('--expect-supplier');
assert.match(expectedSupplier || '', /^[0-9a-f]{40}$/, '--expect-supplier requires the reviewed full candidate SHA');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const gitExecutable = arg('--git-executable', process.env.BW_GUI_GIT_EXECUTABLE);
const consumerGit = bindGuiHarnessGit({root, executable: gitExecutable, maxBuffer: 128 * 1024 * 1024});
const supplierGit = bindGuiHarnessGit({root: supplier, executable: gitExecutable, maxBuffer: 128 * 1024 * 1024});
assert.deepEqual(supplierGit.tool, consumerGit.tool, 'one explicit Git executable inspects both checkouts');
const git = (cwd, args) => {
    assert(cwd === root || cwd === supplier, 'Git is bound only to the admitted checkouts');
    return (cwd === root ? consumerGit : supplierGit).run(args);
};
const consumerCommit = git(root, ['rev-parse', 'HEAD']).trim();
const supplierCommit = git(supplier, ['rev-parse', 'HEAD']).trim();
assert.equal(supplierCommit, expectedSupplier);
assert.equal(git(supplier, ['status', '--porcelain', '--untracked-files=no']).trim(), '', 'supplier checkout is immutable');
const committedPins = JSON.parse(git(root, ['show', 'HEAD:vendor-pins.json']));
const pins = JSON.parse(await fs.readFile(path.join(root, 'vendor-pins.json'), 'utf8'));
assert.equal(pins['sb3-creator'], supplierCommit);
assert.notEqual(committedPins['sb3-creator'], supplierCommit, 'this manifest is only for the isolated experimental bump');
assert.equal(pins['bw-board'], committedPins['bw-board']);
assert.equal(pins['bw-circuit-ui'], committedPins['bw-circuit-ui']);

const {SB3_CREATOR_FILES, applySb3CreatorRewrites} = await import(pathToFileURL(path.join(root,
    'scripts/lib/vendor-rewrites.mjs')).href);
const sourceFiles = {};
for (const [local, upstream] of SB3_CREATOR_FILES) {
    const expected = applySb3CreatorRewrites(await fs.readFile(path.join(supplier, upstream), 'utf8'));
    for (const prefix of ['overlay/scratch-gui/src/lib/', 'packages/scratch-gui/src/lib/']) {
        const relative = prefix + local;
        const bytes = await fs.readFile(path.join(root, relative));
        assert.equal(bytes.toString('utf8'), expected, `official rewritten supplier bytes and mirror: ${relative}`);
        sourceFiles[relative] = sha(bytes);
    }
}
for (const relative of [
    'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',
    'packages/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',
    'overlay/scratch-gui/src/lib/code-source-document.js',
    'packages/scratch-gui/src/lib/code-source-document.js',
    'overlay/scratch-gui/src/lib/code-execution-session.js',
    'packages/scratch-gui/src/lib/code-execution-session.js',
    'overlay/scratch-gui/src/lib/code-execution-workers.js',
    'packages/scratch-gui/src/lib/code-execution-workers.js',
    'overlay/scratch-gui/src/lib/bw-conversion-error.js',
    'packages/scratch-gui/src/lib/bw-conversion-error.js',
    'overlay/scratch-gui/src/lib/pico-sim-run.js',
    'packages/scratch-gui/src/lib/pico-sim-run.js',
    'scripts/sync-sb3creator.mjs', 'scripts/sync-examples.mjs',
    'scripts/lib/vendor-rewrites.mjs', 'scripts/lib/gui-harness-source.mjs', 'scripts/verify-owned-console-code-tab.mjs',
    'scripts/write-owned-console-qualification-manifest.mjs',
    'vendor-pins.json', 'package.json', 'package-lock.json',
    'packages/scratch-gui/package.json', 'packages/scratch-gui/package-lock.json'
]) sourceFiles[relative] = sha(await fs.readFile(path.join(root, relative)));

const files = {};
const walk = async directory => {
    for (const entry of (await fs.readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(file);
        else if (entry.isFile() && (/\.(?:m?js)$/.test(entry.name) || file === path.join(site, 'index.html'))) {
            files[path.relative(site, file).split(path.sep).join('/')] = sha(await fs.readFile(file));
        }
    }
};
await walk(site);
assert.match(files['index.html'] || '', /^[0-9a-f]{64}$/);
assert(Object.keys(files).length > 5, 'real built editor has emitted script assets');
const patch = git(root, ['diff', '--no-ext-diff', '--binary', 'HEAD', '--']);
assert(patch.trim(), 'the supplier candidate is a local patch over the shipping checkpoint');
const manifest = {
    schema: 'bw.owned-console-experimental-bundle.v1',
    classification: 'experimental-candidate-bundle',
    shippingEvidence: false,
    createdAt: new Date().toISOString(),
    consumer: {repository: 'CrispStrobe/brickwright', commit: consumerCommit},
    supplier: {repository: 'CrispStrobe/sb3-creator', shippingPin: committedPins['sb3-creator'],
        candidateCommit: supplierCommit, qualification: 'Candidate integration only; supplier RF release gate remains independent.'},
    sync: {method: 'Official sync-sb3creator.mjs and sync-examples.mjs --dir with explicit --pin, followed by integrate.mjs',
        force: false, allowStale: false, compilerByteIdentity: true, compilerMirrorsIdentical: true},
    npmPins: {'bw-board': pins['bw-board'], 'bw-circuit-ui': pins['bw-circuit-ui']},
    trackedPatchSha256: sha(patch),
    changedPaths: git(root, ['diff', '--name-only', 'HEAD', '--']).trim().split('\n'),
    sourceFiles,
    build: {directory: 'packages/scratch-gui/build', files,
        command: arg('--build-command', 'NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2560 npm run build')},
    environment: {node: process.version, platform: process.platform, arch: process.arch, git: consumerGit.tool}
};
await fs.mkdir(path.dirname(out), {recursive: true});
await fs.writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({manifest: out, consumerCommit, supplierCommit,
    shippingSupplierPin: committedPins['sb3-creator'], scripts: Object.keys(files).length - 1,
    sourceFiles: Object.keys(sourceFiles).length, shippingEvidence: false}, null, 2));
