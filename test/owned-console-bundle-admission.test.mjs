import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ownedConsoleSourcePaths, verifyOwnedConsoleBundleSource, settleOwnedConsoleScriptReads,
    assertOwnedConsoleLoadedScripts} from '../scripts/lib/owned-console-bundle.mjs';
import {SB3_CREATOR_FILES} from '../scripts/lib/vendor-rewrites.mjs';

const repository = path.resolve(import.meta.dirname, '..');
const executable = process.env.BW_GUI_GIT_EXECUTABLE || '/usr/bin/git';
const mappings = [['fixture-compiler.js', 'compiler.js']];
const compiler = version => `export const version = ${version};\n`;
const put = async (root, relative, bytes) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), {recursive: true});
    await writeFile(file, bytes);
};

test('the real supplier inventory admits repeated identical mappings and rejects conflicting destinations', () => {
    const paths = ownedConsoleSourcePaths(SB3_CREATOR_FILES);
    for (const prefix of ['overlay', 'packages']) {
        assert.equal(paths.filter(file => file === `${prefix}/scratch-gui/src/lib/cpxDialect.js`).length, 1);
    }
    assert.deepEqual(ownedConsoleSourcePaths([...mappings, ...mappings]), ownedConsoleSourcePaths(mappings));
    assert.throws(() => ownedConsoleSourcePaths([...SB3_CREATOR_FILES, ['cpxDialect.js', 'conflicting-source.js']]),
        /conflicting supplier mappings/);
});

test('asset admission waits for late reads and requires every observed script to match', async () => {
    let releaseFirst, releaseLate;
    const reads = [new Promise(resolve => {releaseFirst = resolve;})];
    const settled = settleOwnedConsoleScriptReads(reads);
    reads.push(new Promise(resolve => {releaseLate = resolve;}));
    let complete = false;
    settled.then(() => {complete = true;});
    releaseFirst();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(complete, false, 'the late read must not escape a Promise.all snapshot');
    releaseLate();
    await settled;
    assert.equal(complete, true);
    const verified = {sha256: 'a'.repeat(64), matchesQualifiedBuild: true};
    assertOwnedConsoleLoadedScripts([verified], {bound: true});
    assert.throws(() => assertOwnedConsoleLoadedScripts([verified, {}], {bound: true}), /every observed script read completed/);
    assert.throws(() => assertOwnedConsoleLoadedScripts([verified, {sha256: 'b'.repeat(64)}], {bound: true}),
        /every observed script matches/, 'one matching script cannot vouch for another unresolved binding');
});

async function fixture(t, {experimental = false} = {}) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'owned-console-bundle-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const root = path.join(directory, 'consumer'), supplier = path.join(directory, 'supplier');
    const git = (cwd, ...args) => execFileSync(executable, args, {cwd, encoding: 'utf8'}).trim();
    const commit = cwd => {
        git(cwd, 'add', '.');
        git(cwd, '-c', 'user.name=Owned fixture', '-c', 'user.email=owned@example.invalid',
            'commit', '--quiet', '-m', 'Reviewed fixture');
        return git(cwd, 'rev-parse', 'HEAD');
    };
    for (const cwd of [root, supplier]) {
        await mkdir(cwd, {recursive: true});
        git(cwd, 'init', '--quiet');
    }
    await put(supplier, 'compiler.js', compiler(1));
    const oldSupplier = commit(supplier);
    await put(supplier, 'compiler.js', compiler(2));
    const supplierCommit = commit(supplier);
    for (const file of ownedConsoleSourcePaths(mappings)) await put(root, file, '// owned fixture\n');
    for (const file of ['scripts/write-owned-console-qualification-manifest.mjs',
        'scripts/verify-owned-console-code-tab.mjs', 'scripts/lib-code-actions.mjs',
        'scripts/lib/owned-console-bundle.mjs', 'scripts/lib/gui-harness-source.mjs']) {
        await put(root, file, await readFile(path.join(repository, file)));
    }
    await put(root, 'scripts/lib/vendor-rewrites.mjs',
        `export const SB3_CREATOR_FILES = ${JSON.stringify(mappings)};\nexport const applySb3CreatorRewrites = value => value;\n`);
    await put(root, 'package.json', '{"type":"module"}\n');
    await put(root, '.gitignore', 'packages/\n');
    const pins = {'sb3-creator': experimental ? oldSupplier : supplierCommit,
        'bw-board': 'a'.repeat(40), 'bw-circuit-ui': 'b'.repeat(40)};
    await put(root, 'vendor-pins.json', JSON.stringify(pins) + '\n');
    for (const prefix of ['overlay', 'packages']) {
        await put(root, `${prefix}/scratch-gui/src/lib/fixture-compiler.js`, compiler(experimental ? 1 : 2));
    }
    await put(root, 'packages/scratch-gui/build/index.html', '<!doctype html><title>Fixture</title>\n');
    for (let n = 0; n < 5; n++) await put(root, `packages/scratch-gui/build/fixture-${n}.js`, compiler(n));
    const consumerCommit = commit(root);
    let sequence = 0;
    const produce = (mode = 'committed-pin', extra = []) => {
        const output = path.join(directory, `bundle-${++sequence}.json`);
        const args = [path.join(root, 'scripts/write-owned-console-qualification-manifest.mjs'),
            '--consumer', root, '--supplier', supplier, '--expect-supplier', supplierCommit,
            '--source-mode', mode, '--git-executable', executable, '--out', output];
        if (!extra.includes('--omit-consumer')) args.push('--expect-consumer', consumerCommit);
        const result = spawnSync(process.execPath, [...args, ...extra.filter(x => x !== '--omit-consumer')],
            {cwd: root, encoding: 'utf8', timeout: 10000});
        return {result, output};
    };
    const verify = qualification => verifyOwnedConsoleBundleSource({root, executable, qualification});
    return {root, supplier, directory, pins, git, commit, produce, verify,
        consumerCommit, supplierCommit, oldSupplier};
}

test('the actual producer and reader bind a clean committed pin without claiming hosted shipping', async t => {
    const f = await fixture(t);
    const {result, output} = f.produce();
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(manifest.classification, 'committed-pin-local-bundle');
    assert.equal(manifest.shippingEvidence, false);
    assert.equal(manifest.consumer.commit, f.consumerCommit);
    assert.equal(manifest.supplier.commit, f.supplierCommit);
    assert.deepEqual(manifest.changedPaths, []);
    assert.equal(Object.keys(manifest.sourceFiles).length, ownedConsoleSourcePaths(mappings).length);
    await f.verify(manifest);
    const missingConsumer = f.produce('committed-pin', ['--omit-consumer']);
    assert.notEqual(missingConsumer.result.status, 0);
    assert.match(missingConsumer.result.stderr, /expect-consumer requires/);
    const wrongConsumer = f.produce('committed-pin', ['--omit-consumer', '--expect-consumer', '0'.repeat(40)]);
    assert.notEqual(wrongConsumer.result.status, 0, 'a different reviewed consumer cannot be substituted');
    const wrongMode = f.produce('shipping');
    assert.notEqual(wrongMode.result.status, 0);
    assert.match(wrongMode.result.stderr, /source-mode is experimental or committed-pin/);
});

test('committed-pin production refuses dirty source and independently changed integrated mirrors', async t => {
    const f = await fixture(t);
    const source = 'overlay/scratch-gui/src/lib/code-source-document.js';
    const original = await readFile(path.join(f.root, source));
    await put(f.root, source, '// changed author\n');
    let observed = f.produce();
    assert.notEqual(observed.result.status, 0);
    assert.match(observed.result.stderr, /consumer tracked source must be clean/);
    f.git(f.root, 'add', source);
    observed = f.produce();
    assert.notEqual(observed.result.status, 0, 'staged edits also refuse');
    await put(f.root, source, original);
    f.git(f.root, 'add', source);
    await put(f.supplier, 'compiler.js', compiler(3));
    observed = f.produce();
    assert.notEqual(observed.result.status, 0);
    assert.match(observed.result.stderr, /supplier checkout is immutable/);
    await put(f.supplier, 'compiler.js', compiler(2));
    for (const [mirror, message] of [
        ['packages/scratch-gui/src/lib/fixture-compiler.js', /official rewritten supplier bytes/],
        ['packages/scratch-gui/src/lib/code-source-document.js', /owned source and integrated mirror agree/]
    ]) {
        const bytes = await readFile(path.join(f.root, mirror));
        await put(f.root, mirror, '// ignored mirror changed\n');
        assert.equal(f.git(f.root, 'status', '--porcelain', '--untracked-files=no'), '', 'Git alone cannot see the ignored mirror');
        observed = f.produce();
        assert.notEqual(observed.result.status, 0);
        assert.match(observed.result.stderr, message);
        await put(f.root, mirror, bytes);
    }
});

test('browser admission rejects missing inventory, false authority and changed ignored bytes', async t => {
    const f = await fixture(t);
    const {result, output} = f.produce();
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(await readFile(output, 'utf8'));
    const mirror = 'packages/scratch-gui/src/lib/code-source-document.js';
    const omitted = structuredClone(manifest);
    delete omitted.sourceFiles[mirror];
    await assert.rejects(f.verify(omitted), /complete source and mirror inventory/);
    await assert.rejects(f.verify({...manifest, shippingEvidence: true}), /not hosted shipping evidence/);
    const wrongPin = structuredClone(manifest);
    wrongPin.npmPins['bw-board'] = 'c'.repeat(40);
    await assert.rejects(f.verify(wrongPin), /bw-board matches the manifest/);
    const wrongSupplier = structuredClone(manifest);
    wrongSupplier.supplier.commit = f.oldSupplier;
    await assert.rejects(f.verify(wrongSupplier), assert.AssertionError);
    const bytes = await readFile(path.join(f.root, mirror));
    await put(f.root, mirror, '// ignored replacement\n');
    assert.equal(f.git(f.root, 'status', '--porcelain', '--untracked-files=no'), '');
    await assert.rejects(f.verify(manifest), /source or integrated mirror changed/);
    const restampedMirror = structuredClone(manifest);
    restampedMirror.sourceFiles[mirror] = createHash('sha256').update(await readFile(path.join(f.root, mirror))).digest('hex');
    await assert.rejects(f.verify(restampedMirror), /owned source and integrated mirror agree/,
        'restamping one ignored mirror cannot make it equal the committed overlay');
    const browser = spawnSync(process.execPath, [path.join(f.root, 'scripts/verify-owned-console-code-tab.mjs'),
        '--qualification-manifest', output, '--git-executable', executable], {
        cwd: f.root, encoding: 'utf8', timeout: 10000,
        env: {...process.env, BW_BROWSER_RUNTIME_ROOT: repository,
            BW_BROWSER: path.join(f.directory, 'must-not-launch')}
    });
    assert.equal(browser.status, 1, browser.stderr);
    assert.match(browser.stderr, /source or integrated mirror changed/);
    assert.doesNotMatch(browser.stderr, /browserType\.launch|Executable doesn.t exist/);
    await put(f.root, mirror, bytes);
    await f.verify(manifest);
});

test('experimental mode still requires the distinct supplier and exact nonempty patch', async t => {
    const f = await fixture(t, {experimental: true});
    await put(f.root, 'vendor-pins.json', JSON.stringify({...f.pins, 'sb3-creator': f.supplierCommit}) + '\n');
    for (const prefix of ['overlay', 'packages']) {
        await put(f.root, `${prefix}/scratch-gui/src/lib/fixture-compiler.js`, compiler(2));
    }
    const {result, output} = f.produce('experimental');
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(manifest.classification, 'experimental-candidate-bundle');
    assert.equal(manifest.supplier.shippingPin, f.oldSupplier);
    assert.equal(manifest.supplier.candidateCommit, f.supplierCommit);
    assert.ok(manifest.changedPaths.includes('vendor-pins.json'));
    await f.verify(manifest);
    const committedRefusal = f.produce('committed-pin');
    assert.notEqual(committedRefusal.result.status, 0);
    assert.match(committedRefusal.result.stderr, /consumer tracked source must be clean/);
    await put(f.root, 'package-lock.json', '// different patch\n');
    await assert.rejects(f.verify(manifest), assert.AssertionError, 'an additional edit cannot borrow the recorded patch');
    f.commit(f.root);
    const samePinRefusal = f.produce('experimental', ['--omit-consumer']);
    assert.notEqual(samePinRefusal.result.status, 0);
    assert.match(samePinRefusal.result.stderr, /experimental mode requires an isolated supplier bump/);
});
