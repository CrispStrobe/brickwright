#!/usr/bin/env node
// Local experimental or committed-pin identity. Never emits the hosted GUI manifest.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {bindGuiHarnessGit} from './lib/gui-harness-source.mjs';
import {OWNED_CONSOLE_BUNDLE_MODES, recordOwnedConsoleSources} from './lib/owned-console-bundle.mjs';

const arg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    if (index < 0) return fallback;
    assert(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), `${name} requires a value`);
    return process.argv[index + 1];
};
const supplierArgument = arg('--supplier');
assert(supplierArgument, '--supplier requires an immutable supplier checkout');
const mode = arg('--source-mode', 'experimental');
assert(Object.hasOwn(OWNED_CONSOLE_BUNDLE_MODES, mode), '--source-mode is experimental or committed-pin');
const root = path.resolve(arg('--consumer', process.cwd()));
const supplier = path.resolve(supplierArgument);
const site = path.resolve(root, arg('--build', 'packages/scratch-gui/build'));
const out = path.resolve(arg('--out', path.join(root, 'scripts/probes/code-runtime/owned-code-tab',
    mode === 'committed-pin' ? 'committed-pin-bundle.json' : 'experimental-bundle.json')));
const expectedSupplier = arg('--expect-supplier');
assert.match(expectedSupplier || '', /^[0-9a-f]{40}$/, '--expect-supplier requires the reviewed full supplier SHA');
const expectedConsumer = arg('--expect-consumer');
if (mode === 'committed-pin' || expectedConsumer !== undefined) {
    assert.match(expectedConsumer || '', /^[0-9a-f]{40}$/, '--expect-consumer requires the reviewed full consumer SHA');
}
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
if (expectedConsumer !== undefined) assert.equal(consumerCommit, expectedConsumer);
assert.equal(supplierCommit, expectedSupplier);
assert.equal(git(supplier, ['status', '--porcelain', '--untracked-files=no']).trim(), '', 'supplier checkout is immutable');
const committedPins = JSON.parse(git(root, ['show', 'HEAD:vendor-pins.json']));
const pins = JSON.parse(await fs.readFile(path.join(root, 'vendor-pins.json'), 'utf8'));
assert.equal(pins['sb3-creator'], supplierCommit);
if (mode === 'committed-pin') {
    assert.equal(git(root, ['status', '--porcelain', '--untracked-files=no']).trim(), '',
        'committed-pin consumer tracked source must be clean');
    assert.deepEqual(pins, committedPins, 'committed-pin working pins equal the reviewed commit');
    assert.equal(committedPins['sb3-creator'], supplierCommit);
} else {
    assert.notEqual(committedPins['sb3-creator'], supplierCommit, 'experimental mode requires an isolated supplier bump');
}
assert.equal(pins['bw-board'], committedPins['bw-board']);
assert.equal(pins['bw-circuit-ui'], committedPins['bw-circuit-ui']);

const sourceFiles = await recordOwnedConsoleSources({root, supplier});

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
if (mode === 'committed-pin') assert.equal(patch, '', 'committed-pin qualification has no tracked patch');
else assert(patch.trim(), 'the supplier candidate is a local patch over the shipping checkpoint');
const manifest = {
    ...OWNED_CONSOLE_BUNDLE_MODES[mode],
    shippingEvidence: false,
    createdAt: new Date().toISOString(),
    consumer: {repository: 'CrispStrobe/brickwright', commit: consumerCommit},
    supplier: mode === 'committed-pin'
        ? {repository: 'CrispStrobe/sb3-creator', commit: supplierCommit,
            qualification: 'Local UI qualification on the committed supplier pin; hosted release evidence remains separate.'}
        : {repository: 'CrispStrobe/sb3-creator', shippingPin: committedPins['sb3-creator'],
            candidateCommit: supplierCommit, qualification: 'Candidate integration only; supplier release qualification remains independent.'},
    sync: {method: 'Official sync-sb3creator.mjs and sync-examples.mjs --dir with explicit --pin, followed by integrate.mjs',
        force: false, allowStale: false, compilerByteIdentity: true, compilerMirrorsIdentical: true},
    npmPins: {'bw-board': pins['bw-board'], 'bw-circuit-ui': pins['bw-circuit-ui']},
    trackedPatchSha256: sha(patch),
    changedPaths: patch ? git(root, ['diff', '--name-only', 'HEAD', '--']).trim().split('\n') : [],
    sourceFiles,
    build: {directory: path.relative(root, site).split(path.sep).join('/') || '.', files,
        command: arg('--build-command', 'NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2560 npm run build')},
    environment: {node: process.version, platform: process.platform, arch: process.arch, git: consumerGit.tool}
};
await fs.mkdir(path.dirname(out), {recursive: true});
await fs.writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({manifest: out, consumerCommit, supplierCommit,
    classification: manifest.classification, committedSupplierPin: committedPins['sb3-creator'], scripts: Object.keys(files).length - 1,
    sourceFiles: Object.keys(sourceFiles).length, shippingEvidence: false}, null, 2));
