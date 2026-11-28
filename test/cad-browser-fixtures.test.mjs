// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadCadBrowserFixture} from '../scripts/lib/cad-browser-fixtures.mjs';
import {generateCadBrowserDwg, DWG_WORKER_SHA256, DWG_FACTORY_SHA256} from '../scripts/gen-cad-browser-dwg-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'test/fixtures/cad/browser');
const provenance = JSON.parse(await readFile(join(directory, 'provenance.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

test('CAD browser inputs retain their canonical source and license bytes', async () => {
    const sdk = JSON.parse(await readFile(join(root, provenance.cadSdk.consumerManifest), 'utf8'));
    assert.equal(sdk.commit, provenance.cadSdk.commit);
    for (const kind of ['dwg', 'step']) {
        const fixture = provenance.fixtures[kind];
        const payload = await loadCadBrowserFixture(kind, join(directory, fixture.file));
        assert.equal(payload.name, fixture.file);
        assert.equal(sha256(payload.buffer), fixture.sha256);
        if (kind === 'step') {
            assert.equal(gitBlob(payload.buffer), fixture.source.gitBlob);
            assert.equal(fixture.source.gitBlob, fixture.cadSdkCopy.gitBlob);
        }
    }
    const factory = provenance.fixtures.dwg.source;
    const bytes = await readFile(join(directory, factory.retainedFile));
    assert.equal(bytes.length, factory.bytes);
    assert.equal(sha256(bytes), DWG_FACTORY_SHA256);
    assert.equal(gitBlob(bytes), factory.gitBlob);
    for (const [file, license] of Object.entries(provenance.licenses)) {
        const bytes = await readFile(join(directory, file));
        assert.equal(bytes.length, license.bytes);
        assert.equal(sha256(bytes), license.sha256);
        assert.equal(gitBlob(bytes), license.gitBlob);
    }
    const generation = provenance.fixtures.dwg.generation;
    const worker = await readFile(join(root, generation.worker));
    assert.equal(worker.length, generation.workerBytes);
    assert.equal(sha256(worker), DWG_WORKER_SHA256);
    assert.equal(generation.workerSha256, DWG_WORKER_SHA256);
});

test('the canonical DWG reproduces from fresh codec contexts and refuses altered generator inputs', async () => {
    const previousTimezone = process.env.TZ;
    const temporary = await mkdtemp(join(tmpdir(), 'bw-cad-fixture-generator-'));
    process.env.TZ = 'UTC';
    try {
        const expected = await readFile(join(directory, provenance.fixtures.dwg.file));
        assert.deepEqual(generateCadBrowserDwg(), expected);
        assert.deepEqual(generateCadBrowserDwg(), expected);
        const worker = join(temporary, 'worker.js');
        await writeFile(worker, Buffer.concat([await readFile(join(root, provenance.fixtures.dwg.generation.worker)), Buffer.from('\n')]));
        assert.throws(() => generateCadBrowserDwg({worker}), /exact shipping DWG worker bytes/);
        const factory = join(temporary, 'factory.ts');
        await writeFile(factory, Buffer.concat([await readFile(join(directory, 'sketch-dwg-fixture.ts')), Buffer.from('\n')]));
        assert.throws(() => generateCadBrowserDwg({factory}), /exact canonical fixture factory bytes/);
    } finally {
        if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone;
        await rm(temporary, {recursive: true, force: true});
    }
});

for (const kind of ['dwg', 'step']) test(`${kind} browser command refuses a same-size altered fixture before launching`, async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'bw-cad-fixture-refusal-'));
    try {
        const record = provenance.fixtures[kind];
        const changed = await readFile(join(directory, record.file));
        changed[changed.length - 1] ^= 1;
        const fixture = join(temporary, record.file);
        await writeFile(fixture, changed);
        await assert.rejects(loadCadBrowserFixture(kind, fixture), /reviewed CAD fixture SHA256/);
        const result = spawnSync(process.execPath, ['--import', resolve(root, 'scripts/lib/register-gui-scope.mjs'),
            resolve(root, `scripts/verify-cad-${kind}-browser.mjs`), 'http://127.0.0.1:8617/', fixture], {
            cwd: root, encoding: 'utf8', timeout: 10000,
            env: {...process.env, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: join(temporary, 'must-not-launch')}
        });
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /reviewed CAD fixture SHA256/);
        assert.doesNotMatch(result.stderr, /browserType\.launch|Executable doesn.t exist/);
        await writeFile(fixture, changed.subarray(1));
        await assert.rejects(loadCadBrowserFixture(kind, fixture), /reviewed CAD fixture byte count/);
    } finally {await rm(temporary, {recursive: true, force: true});}
});
