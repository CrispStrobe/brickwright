import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCrispBasicPackage, packageCrispBasic} from '../scripts/package-crispbasic.mjs';
import {WASM_LOCAL_INPUTS, WASM_UPSTREAM_INPUTS} from '../packages/crisp-basic/wasm/build-inputs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const write = async (root, path, bytes) => {
    await mkdir(dirname(join(root, path)), {recursive: true});
    await writeFile(join(root, path), bytes);
};

// Synthetic build records exercise packaging integrity; this fixture is not a
// BASIC interpreter. Actual generated source/worker execution has a separate
// WASM-dependent test:brickwright job, so ordinary source tests need no compiler.
async function fixture(t) {
    const parent = join(root, 'artifacts');
    await mkdir(parent, {recursive: true});
    const directory = await mkdtemp(join(parent, 'crispbasic-assets-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const packageRoot = join(directory, 'package');
    const destination = join(directory, 'static/crispbasic');
    const sources = new Set([...WASM_LOCAL_INPUTS, 'package.json', 'browser.mjs',
        'src/source.mjs', 'src/wasm-session.mjs', 'src/wasm-worker.mjs',
        'src/wasm-capabilities.mjs', 'src/simulation-host.mjs', 'src/simulation-protocol.mjs',
        'LICENSE', 'THIRD-PARTY-NOTICES.md']);
    for (const source of sources) {
        await write(packageRoot, source, await readFile(join(root, 'packages/crisp-basic', source)));
    }
    const lock = (await readJSON(join(packageRoot, 'upstream.lock.json'))).bbcSDL;
    const toolchain = (await readJSON(join(packageRoot, 'wasm/toolchain.lock.json'))).emscripten;
    const module = Buffer.from('export default () => { throw new Error("synthetic packaging fixture"); };\n');
    const binary = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    await write(packageRoot, '.build/wasm/crispbasic.mjs', module);
    await write(packageRoot, '.build/wasm/crispbasic.wasm', binary);
    await write(packageRoot, '.build/wasm/BBCSDL-LICENSE.txt',
        await readFile(join(root, 'packages/crisp-basic/native/BBCSDL-LICENSE.txt')));
    for (const notice of toolchain.notices) {
        await write(packageRoot, `.build/wasm/licenses/${notice.path.split('/').at(-1)}`,
            await readFile(join(root, 'packages/crisp-basic', notice.path)));
    }
    const build = {schemaVersion: 1, backend: 'bbcsdl-wasm',
        upstreamCommit: lock.commit, compiler: 'synthetic packaging fixture',
        toolchain, sourceInputs: lock.files.filter(input => WASM_UPSTREAM_INPUTS.includes(input.path)),
        localSourceInputs: await Promise.all(WASM_LOCAL_INPUTS.map(async path =>
            ({path, sha256: sha(await readFile(join(packageRoot, path)))}))),
        moduleSha256: sha(module), wasmSha256: sha(binary), imports: []};
    await write(packageRoot, '.build/wasm/build.json', JSON.stringify(build));
    return {packageRoot, destination, build, directory};
}

test('packaging produces a complete relocatable payload and a deterministic byte manifest', async t => {
    const options = await fixture(t);
    const manifest = await packageCrispBasic(options);
    assert.deepEqual(manifest.entries, {
        browser: 'browser.mjs', worker: 'src/wasm-worker.mjs', module: 'wasm/crispbasic.mjs'
    });
    assert.equal(manifest.format, 'brickwright-crispbasic');
    assert.ok(manifest.files['licenses/BBCSDL-LICENSE.txt']);
    assert.ok(manifest.files['licenses/EMSCRIPTEN-LICENSE.txt']);
    assert.ok(manifest.files['licenses/MUSL-COPYRIGHT.txt']);
    assert.ok(manifest.files['LICENSE.txt']);
    assert.ok(manifest.files['src/simulation-host.mjs']);
    assert.ok(manifest.files['src/simulation-protocol.mjs']);
    assert.equal(Object.keys(manifest.files).some(path => path.startsWith('.') || path.includes('native-session')), false);
    for (const [path, expected] of Object.entries(manifest.files)) {
        const bytes = await readFile(join(options.destination, path));
        assert.equal(bytes.length, expected.bytes, path);
        assert.equal(sha(bytes), expected.sha256, path);
    }
    const first = await readFile(join(options.destination, 'manifest.json'));
    assert.deepEqual(await packageCrispBasic({...options, check: true}), manifest);
    await packageCrispBasic(options);
    assert.deepEqual(await readFile(join(options.destination, 'manifest.json')), first);
    assert.deepEqual(await readFile(join(options.destination, 'src/wasm-worker.mjs')),
        await readFile(join(options.packageRoot, 'src/wasm-worker.mjs')), 'ESM worker bytes stay unmodified');
});

test('check rejects a missing payload without creating it', async t => {
    const options = await fixture(t);
    await assert.rejects(packageCrispBasic({...options, check: true}), /package is missing/);
    await assert.rejects(readFile(join(options.destination, 'manifest.json')), {code: 'ENOENT'});
});

test('check rejects a tampered asset and repackaging repairs it', async t => {
    const options = await fixture(t);
    await packageCrispBasic(options);
    await write(options.destination, 'src/wasm-worker.mjs', 'tampered worker');
    await assert.rejects(packageCrispBasic({...options, check: true}), /asset is stale: src\/wasm-worker/);
    await packageCrispBasic(options);
    await packageCrispBasic({...options, check: true});
});

test('unexpected stale assets are rejected and removed by complete replacement', async t => {
    const options = await fixture(t);
    await packageCrispBasic(options);
    await write(options.destination, 'obsolete.js', 'old payload');
    await assert.rejects(packageCrispBasic({...options, check: true}), /unexpected files/);
    await packageCrispBasic(options);
    await assert.rejects(readFile(join(options.destination, 'obsolete.js')), {code: 'ENOENT'});
});

test('a changed host source refuses stale compiled artifacts before replacing an existing payload', async t => {
    const options = await fixture(t);
    await packageCrispBasic(options);
    const existing = await readFile(join(options.destination, 'manifest.json'));
    await write(options.packageRoot, 'wasm/crispbasic.c', 'changed C host');
    await assert.rejects(packageCrispBasic(options), /SHA-256 mismatch: wasm\/crispbasic.c/);
    assert.deepEqual(await readFile(join(options.destination, 'manifest.json')), existing);
});

test('a changed shared native patcher also invalidates the WASM build', async t => {
    const options = await fixture(t);
    await write(options.packageRoot, 'native/patch-upstream.mjs', 'changed shared patcher');
    await assert.rejects(createCrispBasicPackage(options.packageRoot),
        /SHA-256 mismatch: native\/patch-upstream.mjs/);
});

for (const [path, label] of [
    ['.build/wasm/crispbasic.mjs', 'generated JavaScript module'],
    ['.build/wasm/crispbasic.wasm', 'WASM binary'],
    ['.build/wasm/BBCSDL-LICENSE.txt', 'BBCSDL licence'],
    ['.build/wasm/licenses/EMSCRIPTEN-LICENSE.txt', 'wasm/licenses/EMSCRIPTEN-LICENSE.txt']
]) {
    test(`packaging rejects a corrupt ${label}`, async t => {
        const options = await fixture(t);
        await write(options.packageRoot, path, 'changed bytes');
        await assert.rejects(createCrispBasicPackage(options.packageRoot), error =>
            error.message.includes(`SHA-256 mismatch: ${label}`));
    });
}

test('packaging requires every distribution notice', async t => {
    const options = await fixture(t);
    await rm(join(options.packageRoot, '.build/wasm/licenses/MUSL-COPYRIGHT.txt'));
    await assert.rejects(createCrispBasicPackage(options.packageRoot), /asset is missing: .*MUSL-COPYRIGHT/);
});

test('packaging rejects an old build without local source provenance', async t => {
    const options = await fixture(t);
    delete options.build.localSourceInputs;
    await write(options.packageRoot, '.build/wasm/build.json', JSON.stringify(options.build));
    await assert.rejects(createCrispBasicPackage(options.packageRoot), /no current local source record/);
});

test('packaging verifies the recorded WASM import surface against the compiled module', async t => {
    const options = await fixture(t);
    options.build.imports.push({module: 'env', name: 'unexpected', kind: 'function'});
    await write(options.packageRoot, '.build/wasm/build.json', JSON.stringify(options.build));
    await assert.rejects(createCrispBasicPackage(options.packageRoot), /imports do not match/);
});

test('packaging rejects an incomplete upstream build record', async t => {
    const options = await fixture(t);
    options.build.sourceInputs.pop();
    await write(options.packageRoot, '.build/wasm/build.json', JSON.stringify(options.build));
    await assert.rejects(createCrispBasicPackage(options.packageRoot), /incomplete upstream source records/);
});
