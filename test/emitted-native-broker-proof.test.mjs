import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {verifyEmittedNativeBrokerProof} from '../scripts/verify-emitted-native-broker-proof.mjs';
import {generateProofPackage} from '../scripts/package-native-broker-proof-pins.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
test('only content-addressed broker proof sources opt out of asset minification', async () => {
    const config = await readFile(path.join(rootDir, 'overlay/scratch-gui/webpack.config.js'), 'utf8');
    const expression = config.match(/const preserveProofAssetInfo = ([\s\S]*?);/)[1];
    const info = vm.runInNewContext(`(${expression})`);
    assert.equal(info({filename: `static/native-broker/proof-pins/sources/${'a'.repeat(64)}.js`}).minimized, true);
    for (const filename of ['gui.js', 'chunks/foo.js', 'static/native-broker/native-broker-host.js', 'static/test-fixtures/capability-probe.js', 'static/native-broker/proof-pins/sources/moving.js']) {
        assert.equal(info({filename}).minimized, undefined, filename);
    }
    assert.match(config, /from: 'static',\s+to: 'static',\s+(?:globOptions:[^\n]+\s+)?info: preserveProofAssetInfo/);
    assert.equal(await readFile(path.join(rootDir, 'packages/scratch-gui/webpack.config.js'), 'utf8'), config);
});

test('emitted proof verifier rejects missing, truncated, minified and alias-altered output', async () => {
    const buildDir = await mkdtemp(path.join(tmpdir(), 'emitted-proof-'));
    try {
        const pins = JSON.parse(await readFile(path.join(rootDir, 'overlay/scratch-vm/src/extension-support/gallery-proof-pins.json')));
        const source = await readFile(path.join(rootDir, 'overlay/scratch-gui/static/test-fixtures/capability-probe.js'));
        const expected = generateProofPackage(pins, source);
        const dir = path.join(buildDir, 'static/native-broker/proof-pins');
        await mkdir(path.join(dir, 'sources'), {recursive: true});
        await assert.rejects(verifyEmittedNativeBrokerProof({rootDir, buildDir}), /manifest missing/);
        await writeFile(path.join(dir, 'manifest.json'), expected.manifestText);
        await assert.rejects(verifyEmittedNativeBrokerProof({rootDir, buildDir}), /source set missing/);
        const file = path.join(dir, expected.asset);
        await writeFile(file, source);
        const result = await verifyEmittedNativeBrokerProof({rootDir, buildDir});
        assert.equal(result.bytes, 1421); assert.equal(result.aliases, 2); assert.ok(Object.isFrozen(result));
        for (const mutation of [source.subarray(0, 829), Buffer.from(source.toString().replace(/\s+/g, ' ')), Buffer.alloc(source.length, 32)]) {
            await writeFile(file, mutation);
            await assert.rejects(verifyEmittedNativeBrokerProof({rootDir, buildDir}), /source changed/);
        }
        await writeFile(file, source);
        const widened = structuredClone(expected.manifest);
        Object.values(widened.aliases)[0].brokerCapabilities.push('platform.kind.read');
        await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(widened, null, 2) + '\n');
        await assert.rejects(verifyEmittedNativeBrokerProof({rootDir, buildDir}), /reviewed pins\/aliases/);
        await writeFile(path.join(dir, 'manifest.json'), expected.manifestText);
        await writeFile(path.join(dir, 'sources/extra.js'), 'extra');
        await assert.rejects(verifyEmittedNativeBrokerProof({rootDir, buildDir}), /source set missing or unexpected/);
    } finally {await rm(buildDir, {recursive: true, force: true});}
});

test('both production builds gate emitted proof and license bytes after successful compilation', async () => {
    const workflow = await readFile(path.join(rootDir, '.github/workflows/build.yml'), 'utf8');
    for (const id of ['build_editor', 'build_editor_browser']) {
        assert.match(workflow, new RegExp(`if: \\$\\{\\{ !cancelled\\(\\) && steps\\.${id}\\.outcome == 'success' \\}\\}\\n        run: \\|\\n          node scripts/verify-emitted-native-broker-proof\\.mjs packages/scratch-gui/build\\n          node scripts/package-upstream-notices\\.mjs --check --build-dir packages/scratch-gui/build`));
    }
});
