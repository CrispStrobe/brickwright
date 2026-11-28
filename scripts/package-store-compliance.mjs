#!/usr/bin/env node
/** Package artifact-bound App Store review evidence. */
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const artifactRecord = file => ({
    name: path.basename(file),
    bytes: statSync(file).size,
    sha256: sha256(file)
});

export function packageStoreCompliance ({buildDir, artifacts = [], outDir, root = ROOT,
    verify = true, now = () => new Date().toISOString(), sourceCommit}) {
    const build = path.resolve(root, buildDir);
    const receiptPath = path.join(build, 'brickwright-build.json');
    if (!existsSync(receiptPath)) throw new Error(`missing build receipt: ${receiptPath}`);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assertReceipt(receipt);
    const commit = sourceCommit || execFileSync('git', ['rev-parse', 'HEAD'],
        {cwd: root, encoding: 'utf8'}).trim();
    if (!/^[0-9a-f]{40}$/.test(commit) || !commit.startsWith(receipt.commit)) {
        throw new Error(`build receipt commit ${JSON.stringify(receipt.commit)} does not match source ${commit}`);
    }
    if (!artifacts.length) throw new Error('at least one --artifact is required');
    const resolvedArtifacts = artifacts.map(file => path.resolve(root, file));
    for (const file of resolvedArtifacts) {
        if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`missing release artifact: ${file}`);
    }
    if (verify) {
        execFileSync(process.execPath, [path.join(root, 'scripts/verify-no-gpl-in-build.mjs'), build],
            {cwd: root, stdio: 'pipe'});
    }

    const names = resolvedArtifacts.map(file => path.basename(file));
    if (new Set(names).size !== names.length) throw new Error('release artifacts must have unique filenames');
    const out = path.resolve(root, outDir);
    if (existsSync(out) && readdirSync(out).length) {
        throw new Error(`output directory is not empty (choose a fresh --out): ${out}`);
    }
    mkdirSync(out, {recursive: true});
    const evidence = [
        ['REVIEW-NOTES.md', 'docs/APP-STORE-COMPLIANCE.md'],
        ['APP-STORE-METADATA.md', 'docs/app-store-metadata.md'],
        ['THIRD-PARTY-NOTICES.md', 'THIRD-PARTY-NOTICES.md'],
        ['LICENSE', 'LICENSE'],
        ['PrivacyInfo.xcprivacy', 'apps/tauri/src-tauri/ios/PrivacyInfo.xcprivacy'],
        ['Info.ios.plist', 'apps/tauri/src-tauri/Info.ios.plist'],
        ['entitlements.plist', 'apps/tauri/src-tauri/entitlements.plist'],
        ['brickwright-build.json', path.relative(root, receiptPath)]
    ];
    for (const [name, source] of evidence) copyFileSync(path.join(root, source), path.join(out, name));
    for (const file of resolvedArtifacts) copyFileSync(file, path.join(out, path.basename(file)));

    const files = [...evidence.map(([name]) => path.join(out, name)),
        ...resolvedArtifacts.map(file => path.join(out, path.basename(file)))];
    const manifest = {
        schema: 1,
        product: 'Brickwright',
        generatedAt: now(),
        sourceCommit: commit,
        buildReceipt: receipt,
        outputScan: verify ? 'passed: no registered optional-only payloads or known prohibited signatures in frontend output; not a complete licence audit' : 'not run',
        files: files.map(artifactRecord).sort((a, b) => a.name.localeCompare(b.name))
    };
    writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}

function assertReceipt (receipt) {
    if (receipt?.schema !== 2 || receipt.product !== 'Brickwright') {
        throw new Error('brickwright-build.json is not a Brickwright schema-2 receipt');
    }
    const policy = receipt.distributionPolicy;
    for (const key of ['remoteExtensions', 'executableToolchains', 'machineImages']) {
        if (!['allow', 'deny'].includes(policy?.[key])) {
            throw new Error(`build receipt has invalid ${key} policy: ${JSON.stringify(policy?.[key])}`);
        }
    }
}

const RUN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (RUN) {
    const values = key => process.argv.flatMap((arg, i) => arg === key ? [process.argv[i + 1]] : []);
    const one = (key, fallback) => values(key).at(-1) || fallback;
    try {
        const manifest = packageStoreCompliance({
            buildDir: one('--build', 'packages/scratch-gui/build'),
            artifacts: values('--artifact'),
            outDir: one('--out', 'artifacts/store-compliance')
        });
        console.log(`Store compliance bundle: ${manifest.files.length} evidence file(s), ` +
            `${manifest.sourceCommit.slice(0, 12)}, ${manifest.buildReceipt.distributionPolicy.remoteExtensions}/` +
            `${manifest.buildReceipt.distributionPolicy.executableToolchains}/` +
            `${manifest.buildReceipt.distributionPolicy.machineImages}`);
    } catch (error) {
        console.error(error.message || error);
        process.exitCode = 1;
    }
}
