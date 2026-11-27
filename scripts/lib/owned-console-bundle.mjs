import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {bindGuiHarnessGit} from './gui-harness-source.mjs';

export const OWNED_CONSOLE_BUNDLE_MODES = {
    experimental: {
        schema: 'bw.owned-console-experimental-bundle.v1',
        classification: 'experimental-candidate-bundle'
    },
    'committed-pin': {
        schema: 'bw.owned-console-committed-pin-bundle.v1',
        classification: 'committed-pin-local-bundle'
    }
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mirroredSources = [
    'src/components/tw-pseudocode/pseudocode-importer.jsx',
    'src/lib/code-source-document.js',
    'src/lib/code-execution-session.js',
    'src/lib/code-execution-workers.js',
    'src/lib/bw-conversion-error.js',
    'src/lib/pico-sim-run.js'
];
const otherSources = [
    'scripts/sync-sb3creator.mjs', 'scripts/sync-examples.mjs',
    'scripts/lib/vendor-rewrites.mjs', 'scripts/lib/gui-harness-source.mjs',
    'scripts/lib/owned-console-bundle.mjs',
    'scripts/verify-owned-console-code-tab.mjs',
    'scripts/write-owned-console-qualification-manifest.mjs',
    'vendor-pins.json', 'package.json', 'package-lock.json',
    'packages/scratch-gui/package.json', 'packages/scratch-gui/package-lock.json'
];
const rewritesAt = root => import(pathToFileURL(path.join(root, 'scripts/lib/vendor-rewrites.mjs')).href);
const canonicalMappings = mappings => {
    const destinations = new Map();
    for (const [local, upstream] of mappings) {
        if (destinations.has(local)) assert.equal(destinations.get(local), upstream,
            `conflicting supplier mappings for ${local}`);
        else destinations.set(local, upstream);
    }
    return [...destinations];
};

export function ownedConsoleSourcePaths(mappings) {
    const files = [
        ...canonicalMappings(mappings).flatMap(([local]) => ['overlay', 'packages'].map(prefix => `${prefix}/scratch-gui/src/lib/${local}`)),
        ...mirroredSources.flatMap(file => ['overlay', 'packages'].map(prefix => `${prefix}/scratch-gui/${file}`)),
        ...otherSources
    ];
    assert.equal(new Set(files).size, files.length, 'the source inventory has no duplicate authority');
    return files;
}
const assertIntegratedMirrors = (buffers, mappings) => {
    for (const file of [...canonicalMappings(mappings).map(([local]) => `src/lib/${local}`), ...mirroredSources]) {
        assert.deepEqual(buffers[`packages/scratch-gui/${file}`], buffers[`overlay/scratch-gui/${file}`],
            `owned source and integrated mirror agree: ${file}`);
    }
};

/** Record exact official compiler rewrites and the mirrors used by the build. */
export async function recordOwnedConsoleSources({root, supplier}) {
    const {SB3_CREATOR_FILES, applySb3CreatorRewrites} = await rewritesAt(root);
    const sourcePaths = ownedConsoleSourcePaths(SB3_CREATOR_FILES);
    const buffers = Object.fromEntries(await Promise.all(sourcePaths.map(async relative =>
        [relative, await fs.readFile(path.join(root, relative))])));
    for (const [local, upstream] of canonicalMappings(SB3_CREATOR_FILES)) {
        const expected = applySb3CreatorRewrites(await fs.readFile(path.join(supplier, upstream), 'utf8'));
        for (const prefix of ['overlay', 'packages']) {
            const relative = `${prefix}/scratch-gui/src/lib/${local}`;
            assert.equal(buffers[relative].toString('utf8'), expected,
                `official rewritten supplier bytes and mirror: ${relative}`);
        }
    }
    assertIntegratedMirrors(buffers, SB3_CREATOR_FILES);
    const files = {};
    // Hash the same buffers whose equality was checked, without a second read.
    for (const relative of sourcePaths) files[relative] = sha256(buffers[relative]);
    return files;
}

/** Re-admit the local source and ignored mirrors before opening a browser. */
export async function verifyOwnedConsoleBundleSource({root, executable, qualification}) {
    const mode = Object.entries(OWNED_CONSOLE_BUNDLE_MODES)
        .find(([, value]) => value.schema === qualification.schema);
    assert(mode, 'a known local owned-console bundle schema is required');
    assert.equal(qualification.classification, mode[1].classification);
    assert.equal(qualification.shippingEvidence, false, 'a local bundle is not hosted shipping evidence');
    assert.equal(qualification.consumer.repository, 'CrispStrobe/brickwright');
    assert.equal(qualification.supplier.repository, 'CrispStrobe/sb3-creator');
    assert.equal(qualification.sync.force, false);
    assert.equal(qualification.sync.allowStale, false);
    assert.equal(qualification.sync.compilerByteIdentity, true);
    assert.equal(qualification.sync.compilerMirrorsIdentical, true);
    const binding = bindGuiHarnessGit({root, executable});
    assert.deepEqual(binding.tool, qualification.environment?.git,
        'qualification preflight uses the exact Git executable recorded by the manifest producer');
    const git = binding.run;
    assert.equal(git(['rev-parse', 'HEAD']).trim(), qualification.consumer.commit);
    const committedPins = JSON.parse(git(['show', 'HEAD:vendor-pins.json']));
    const pins = JSON.parse(await fs.readFile(path.join(root, 'vendor-pins.json'), 'utf8'));
    const patch = git(['diff', '--no-ext-diff', '--binary', 'HEAD', '--']);
    if (mode[0] === 'committed-pin') {
        assert.equal(git(['status', '--porcelain', '--untracked-files=no']).trim(), '',
            'committed-pin consumer tracked source must be clean');
        assert.deepEqual(pins, committedPins, 'committed-pin working pins equal the reviewed commit');
        assert.equal(committedPins['sb3-creator'], qualification.supplier.commit);
        assert.equal(patch, '', 'committed-pin qualification has no tracked patch');
        assert.deepEqual(qualification.changedPaths, []);
    } else {
        assert.equal(committedPins['sb3-creator'], qualification.supplier.shippingPin);
        assert.equal(pins['sb3-creator'], qualification.supplier.candidateCommit);
        assert.notEqual(qualification.supplier.candidateCommit, qualification.supplier.shippingPin);
        assert(patch.trim(), 'experimental qualification retains its nonempty sync patch');
        assert.deepEqual(qualification.changedPaths, git(['diff', '--name-only', 'HEAD', '--']).trim().split('\n'));
    }
    for (const name of ['bw-board', 'bw-circuit-ui']) {
        assert.equal(pins[name], committedPins[name], `${name} retains its committed pin`);
        assert.equal(qualification.npmPins[name], pins[name], `${name} matches the manifest`);
    }
    assert.equal(sha256(patch), qualification.trackedPatchSha256,
        'the worktree has exactly the recorded tracked patch');
    const {SB3_CREATOR_FILES} = await rewritesAt(root);
    const expectedPaths = ownedConsoleSourcePaths(SB3_CREATOR_FILES);
    assert.deepEqual(Object.keys(qualification.sourceFiles).sort(), [...expectedPaths].sort(),
        'the complete source and mirror inventory is required');
    const buffers = {};
    for (const relative of expectedPaths) {
        buffers[relative] = await fs.readFile(path.join(root, relative));
        assert.match(qualification.sourceFiles[relative], /^[0-9a-f]{64}$/);
        assert.equal(sha256(buffers[relative]), qualification.sourceFiles[relative],
            `source or integrated mirror changed since qualification: ${relative}`);
    }
    assertIntegratedMirrors(buffers, SB3_CREATOR_FILES);
    assert.match(qualification.build.files['index.html'] || '', /^[0-9a-f]{64}$/);
    return binding.tool;
}

/** A response may enqueue another read while an earlier body is pending. */
export async function settleOwnedConsoleScriptReads(reads) {
    let next = 0;
    while (next < reads.length) {
        const batch = reads.slice(next);
        next += batch.length;
        await Promise.all(batch);
    }
}

export function assertOwnedConsoleLoadedScripts(scripts, {bound}) {
    assert(scripts.length > 0, 'the real app loaded scripts');
    assert.deepEqual(scripts.filter(script => script.error), [], 'observed scripts retain readable matching bytes');
    for (const script of scripts) assert.match(script.sha256 || '', /^[0-9a-f]{64}$/, 'every observed script read completed');
    if (bound) assert(scripts.every(script => script.matchesQualifiedBuild === true),
        'every observed script matches the manifest-bound build');
}
