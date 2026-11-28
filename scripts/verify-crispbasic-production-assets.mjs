#!/usr/bin/env node
// Authenticate the emitted production payload against the build recipe, not
// merely against a manifest copied alongside potentially changed bytes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageCrispBasic, CRISPBASIC_PACKAGE} from './package-crispbasic.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => ({bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});

async function chunks(directory, prefix = 'chunks') {
    const files = [];
    for (const entry of await readdir(join(directory, prefix), {withFileTypes: true})) {
        const path = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) files.push(...await chunks(directory, path));
        else if (entry.isFile()) {
            if (entry.name.endsWith('.js')) files.push(path);
        } else throw new Error(`Production chunks contain a non-regular entry: ${path}`);
    }
    return files.sort();
}

export async function verifyCrispBasicProductionAssets({
    buildRoot = join(root, 'packages/scratch-gui/build'),
    packageRoot = CRISPBASIC_PACKAGE,
    expectedCommit = process.env.GITHUB_SHA || null
} = {}) {
    const directory = resolve(buildRoot);
    const manifestBytes = await readFile(join(directory, 'brickwright-build.json'));
    const build = JSON.parse(manifestBytes);
    assert.equal(build.schema, 2, 'Expected the production Brickwright build identity');
    assert.equal(build.product, 'Brickwright');
    assert.match(build.commit, /^[0-9a-f]{7}$/, 'Production qualification requires a known source commit');
    assert.ok(Number.isFinite(Date.parse(build.builtAt)), 'Production build time is missing');
    if (expectedCommit) {
        assert.match(expectedCommit, /^[0-9a-f]{7,40}$/, 'Expected commit must be a Git SHA');
        assert.equal(build.commit, expectedCommit.slice(0, 7), 'Production bundle is from another source commit');
    }

    const html = await readFile(join(directory, 'index.html'));
    const scripts = [...html.toString('utf8').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
        .map(match => match[1]);
    assert.ok(scripts.length, 'Production index.html has no script entries');
    const entries = [...new Set(scripts.map(source => {
        // Webpack's shipping page uses local entry scripts. Refuse a URL that
        // would let the qualification accidentally fetch another deployment.
        assert.match(source, /^(?:\.\/)?[a-zA-Z0-9_.\/-]+\.js$/, `Non-local production script: ${source}`);
        assert.ok(!source.startsWith('/') && !source.split('/').includes('..'), `Unsafe production script: ${source}`);
        return source.replace(/^\.\//, '');
    }))].sort();
    assert.ok(entries.some(path => /^gui\.[0-9a-f]{8}\.js$/.test(path)),
        'Expected the webpack production GUI entry');

    const payload = await packageCrispBasic({packageRoot,
        destination: join(directory, 'static/crispbasic'), check: true});
    const emittedChunks = await chunks(directory);
    assert.ok(emittedChunks.length, 'Expected the full workbench lazy chunks');
    const hashed = {};
    for (const path of ['index.html', 'brickwright-build.json', ...entries, ...emittedChunks]) {
        const bytes = await readFile(join(directory, path));
        assert.ok(bytes.length, `Empty production asset: ${path}`);
        hashed[path] = digest(bytes);
    }
    return {
        schemaVersion: 1,
        qualification: 'crispbasic-production-assets',
        sourceCommit: expectedCommit,
        build,
        entries,
        chunkCount: emittedChunks.length,
        assets: hashed,
        crispbasic: {
            version: payload.version,
            upstreamCommit: payload.upstreamCommit,
            compiler: payload.compiler,
            assetCount: Object.keys(payload.files).length,
            manifest: digest(await readFile(join(directory, 'static/crispbasic/manifest.json'))),
            files: payload.files
        }
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [buildRoot, output = join(root, 'artifacts/crispbasic-production/assets.json'), ...extra] = process.argv.slice(2);
    if (extra.length) {
        console.error('Usage: node scripts/verify-crispbasic-production-assets.mjs [build-directory] [report.json]');
        process.exitCode = 2;
    } else {
        try {
            const report = await verifyCrispBasicProductionAssets({buildRoot});
            await mkdir(dirname(resolve(output)), {recursive: true});
            await writeFile(output, JSON.stringify(report, null, 2) + '\n');
            console.log(`CrispBASIC production payload verified: ${report.crispbasic.assetCount} exact runtime assets, ` +
                `${report.entries.length} entry scripts, ${report.chunkCount} lazy chunks; build ${report.build.commit}.`);
            console.log(`Production asset evidence: ${output}`);
        } catch (error) {
            console.error(error.stack || error.message);
            process.exitCode = 1;
        }
    }
}
