import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inspectGuiHarnessSource} from './lib/gui-harness-source.mjs';
import {GUI_MANIFEST} from './lib/official-gui-artifact.mjs';
import {assertBrickwrightRepository} from './lib/brickwright-repository.mjs';

export async function writeGuiBuildManifest({root, site, gitExecutable, context}) {
    const inspected = inspectGuiHarnessSource({root, executable: gitExecutable});
    assertBrickwrightRepository(context.repository, context.repositoryId);
    assert.equal(context.job, 'build');
    assert.equal(inspected.sourceSha, context.githubSha, 'Actual producer checkout must equal GITHUB_SHA');
    assert.match(context.reviewedHeadSha || '', /^[0-9a-f]{40}$/);
    for (const value of [context.runId, context.attempt]) assert.ok(Number.isSafeInteger(value) && value > 0);
    const env = {...process.env}; for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
    env.GIT_OPTIONAL_LOCKS = '0';
    const treeSha = execFileSync(inspected.tool.absolutePath, ['rev-parse', 'HEAD^{tree}'], {cwd: root, env, encoding: 'utf8'}).trim();
    assert.match(treeSha, /^[0-9a-f]{40}$/);
    const pins = JSON.parse(await readFile(path.join(root, 'vendor-pins.json'), 'utf8'));
    const targetBytes = await readFile(path.join(site, 'static/makecode/arcade/target.json'));
    const workerBytes = await readFile(path.join(site, 'static/makecode/arcade/pxtworker.js'));
    const versions = JSON.parse(targetBytes.toString('utf8')).versions;
    assert.equal(versions.target, '4.2.1'); assert.equal(versions.pxt, '13.2.1');
    const targetCommit = '2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea';
    assert.equal(versions.commits, `https://github.com/microsoft/pxt-arcade/commits/${targetCommit}`);
    const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
    const manifest = {schema: 1, ...context, sourceSha: inspected.sourceSha, treeSha,
        producerSha: pins['sb3-creator'], arraysValuesSha: pins['arrays-values'],
        sdk: {version: versions.target, pxtVersion: versions.pxt, targetCommit,
            targetSha256: sha256(targetBytes), workerSha256: sha256(workerBytes)}};
    for (const key of ['producerSha', 'arraysValuesSha']) assert.match(manifest[key] || '', /^[0-9a-f]{40}$/);
    await writeFile(path.join(site, GUI_MANIFEST), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
    return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
    const manifest = await writeGuiBuildManifest({root, site: path.resolve(process.argv[2] || 'packages/scratch-gui/build'),
        gitExecutable: process.env.BW_GUI_GIT_EXECUTABLE,
        context: {repository: process.env.GITHUB_REPOSITORY, repositoryId: Number(process.env.GITHUB_REPOSITORY_ID),
            runId: Number(process.env.GITHUB_RUN_ID),
            attempt: Number(process.env.GITHUB_RUN_ATTEMPT), job: process.env.GITHUB_JOB,
            githubSha: process.env.GITHUB_SHA, reviewedHeadSha: process.env.BW_GUI_REVIEWED_HEAD_SHA}});
    console.log(JSON.stringify({manifest: GUI_MANIFEST, sourceSha: manifest.sourceSha, treeSha: manifest.treeSha}));
}
