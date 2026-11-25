import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {parseJobs} from './workflow-gates.mjs';
import {assertBrickwrightRepository, assertBrickwrightSlug, BRICKWRIGHT_SLUG} from './brickwright-repository.mjs';

export const GUI_MANIFEST = 'bw-gui-build-source.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fullSha = value => assert.match(value || '', /^[0-9a-f]{40}$/, 'Complete source commit required');
const same = (actual, expected, label) => assert.equal(actual, expected, label);
const id = value => assert.ok(Number.isSafeInteger(value) && value > 0, 'Official numeric identity required');

// A dependent consumer can run while sibling jobs remain active. The producer
// job, not the entire run, must have finished successfully. API head_sha is not
// a PR merge checkout witness: that comes from the embedded source manifest.
function producerAttemptOf({attempt, producerAttempt = attempt}) {
    id(attempt); id(producerAttempt);
    assert.ok(producerAttempt <= attempt, 'Producer attempt cannot follow the consumer attempt');
    return producerAttempt;
}

function admitGuiArtifactEnvelope({run, job, artifact, artifacts}, expected, admitSteps) {
    const {repository, runId, attempt, runHeadSha, checkoutSha, reviewedHeadSha, artifactId, jobId} = expected;
    // A single-job rerun reuses the earlier attempt's build job and outputs, so
    // the producer attempt may precede the consumer (run) attempt, never follow it.
    const producerAttempt = producerAttemptOf(expected);
    assertBrickwrightSlug(repository);
    if (repository === BRICKWRIGHT_SLUG) {
        assertBrickwrightRepository(repository, run.repository?.id);
        assertBrickwrightRepository(repository, run.head_repository?.id);
    }
    for (const value of [runId, attempt, artifactId, jobId]) id(value);
    for (const value of [runHeadSha, checkoutSha, reviewedHeadSha]) fullSha(value);
    const api = `https://api.github.com/repos/${repository}/actions`;
    const html = `https://github.com/${repository}/actions/runs/${runId}`;
    same(run.id, runId, 'Workflow run identity'); same(run.run_attempt, attempt, 'Workflow run attempt');
    same(run.repository?.full_name, repository, 'Workflow repository');
    same(run.head_repository?.full_name, repository, 'Workflow source repository');
    same(run.head_sha, runHeadSha, 'Official run source'); same(run.html_url, html, 'Official run URL');
    same(run.path, '.github/workflows/build.yml', 'Official source workflow');
    assert.ok(['push', 'pull_request'].includes(run.event), 'Only reviewed push/PR build events');
    if (run.event === 'push') {same(checkoutSha, runHeadSha, 'Push checkout source'); same(reviewedHeadSha, runHeadSha, 'Push reviewed source');}
    else {
        const prs = run.pull_requests || [];
        assert.ok(prs.some(pr => pr.head?.sha === reviewedHeadSha),
            'PR reviewed head must belong to the official run');
    }
    same(job.id, jobId, 'Official producer job identity'); same(job.run_id, runId, 'Producer run');
    same(job.run_attempt, producerAttempt, 'Producer attempt'); same(job.head_sha, runHeadSha, 'Producer run source');
    same(job.name, 'build', 'Sole Pages producer job'); same(job.status, 'completed', 'Producer completed');
    same(job.conclusion, 'success', 'Producer successful'); same(job.html_url, `${html}/job/${jobId}`, 'Official producer URL'); same(job.run_url, `${api}/runs/${runId}`, 'Producer API run');
    admitSteps(job);
    same(artifact.id, artifactId, 'Artifact identity'); same(artifact.name, 'github-pages', 'Artifact name');
    same(artifact.expired, false, 'Artifact must not be expired');
    same(artifact.url, `${api}/artifacts/${artifactId}`, 'Artifact API URL');
    same(artifact.archive_download_url, `${api}/artifacts/${artifactId}/zip`, 'Archive API URL');
    same(artifact.workflow_run?.id, runId, 'Artifact run'); same(artifact.workflow_run?.head_sha, runHeadSha, 'Artifact source');
    same(artifact.workflow_run?.repository_id, run.repository.id, 'Artifact repository identity');
    same(artifact.workflow_run?.head_repository_id, run.head_repository.id, 'Artifact source repository identity');
    assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'Artifact size metadata');
    const created = Date.parse(artifact.created_at);
    assert.ok(Number.isFinite(created) && created >= Date.parse(job.started_at) && created <= Date.parse(job.completed_at),
        'Artifact must be uploaded within the admitted producer job lifetime');
    const named = artifacts.filter(item => item.name === 'github-pages');
    same(named.length, 1, 'Unique Pages artifact in this run'); same(named[0].id, artifactId, 'Listed artifact identity');
    if (artifact.digest !== null && artifact.digest !== undefined) assert.match(artifact.digest, /^sha256:[0-9a-f]{64}$/, 'Official archive digest');
    return Object.freeze({repository, runId, attempt, producerAttempt, runHeadSha, checkoutSha, reviewedHeadSha, artifactId, jobId,
        archiveUrl: artifact.archive_download_url, archiveBytes: artifact.size_in_bytes, archiveDigest: artifact.digest || null,
        runUrl: html, jobUrl: job.html_url});
}

// The legacy route retains its exact required API step facts and assertion order.
export function admitGuiArtifactMetadata(metadata, expected) {
    return admitGuiArtifactEnvelope(metadata, expected, job => {
    for (const name of ['Build the editor', 'Write GUI build source manifest', 'Upload GUI Pages artifact']) {
        const steps = job.steps?.filter(step => step.name === name) || [];
        same(steps.length, 1, `Unique producer step ${name}`);
        same(steps[0].status, 'completed', `Completed producer step ${name}`);
        same(steps[0].conclusion, 'success', `Successful producer step ${name}`);
    }
    });
}

export const GUI_RUNNER_ENV = 'BW_GUI_PRODUCER_RUNNER_V1';
export const GUI_RUNNER_INPUT_CAP = 16 * 1024;
export const GUI_RUNNER_RECEIPT_CAP = 32 * 1024;
const GUI_RUNNER_SCHEMA = 'bw.gui.producer-runner.v1';
const GUI_RUNNER_STEPS = Object.freeze([
    ['build_editor', 'Build the editor'],
    ['gui_build_manifest', 'Write GUI build source manifest'],
    ['gui_pages_upload', 'Upload GUI Pages artifact']
]);
const GUI_RUNNER_HEADER = [GUI_RUNNER_SCHEMA, '${{ github.repository }}', '${{ github.run_id }}',
    '${{ github.run_attempt }}', 'build', '${{ github.sha }}',
    '${{ github.event.pull_request.head.sha || github.sha }}',
    '${{ github.event.pull_request.head.sha || github.sha }}',
    '${{ github.workflow_sha }}', '${{ github.workflow_ref }}'].join('\t');
export const GUI_RUNNER_TEMPLATE = [GUI_RUNNER_HEADER, ...GUI_RUNNER_STEPS.map(([step]) =>
    `${step}\t${'${{'} steps['${step}'].outcome }}\t${'${{'} steps['${step}'].conclusion }}`)].join('\n') + '\n';

// This source profile is deliberately specific to the single existing build
// dependency. The logical producer job is the checked static build key;
// github.job is unavailable at job-output evaluation. Only terminal scalars
// are exported, never an action's outputs/context.
export function guiRunnerProducerSource(workflowText) {
    assert.ok(typeof workflowText === 'string' && Buffer.byteLength(workflowText) <= 1024 * 1024, 'Bounded producer workflow source');
    const block = name => {
        const matches = [...workflowText.matchAll(new RegExp(`^  ${name}:$`, 'gm'))];
        same(matches.length, 1, `Unique producer source job ${name}`);
        const rest = workflowText.slice(matches[0].index + matches[0][0].length);
        return rest.split(/\n  [a-z][a-z-]*:\n/)[0];
    };
    const build = block('build'), consumer = block('arcade-numeric-authoring');
    const jobs = parseJobs(workflowText), steps = jobs.get('build').steps;
    const selected = GUI_RUNNER_STEPS.map(([stepId, name]) => {
        const found = steps.filter(step => step.name === name);
        same(found.length, 1, `Unique source producer step ${name}`);
        same(found[0].id, stepId, `Source producer ID ${name}`);same(found[0].idCount, 1, 'Unique producer ID declaration');
        same(steps.filter(step => step.id === stepId).length, 1, 'Producer ID assigned once');
        const index = steps.indexOf(found[0]);
        // Read this step's own source extent; a declared COE critical outcome
        // remains outside this strict successful-producer profile.
        const own = workflowText.split('\n').slice(found[0].line - 1).join('\n').split(/\n(?:      - |  [a-z][a-z-]*:)/)[0];
        assert.ok(!/^        continue-on-error:/m.test(own), 'Critical producer continue-on-error unsupported');
        return {id: stepId, name, index};
    });
    assert.ok(selected.every((step, i) => i === 0 || step.index > selected[i - 1].index), 'Producer source step order');
    const expectedOutput = '    outputs:\n      gui_producer_runner_v1: |\n' + GUI_RUNNER_TEMPLATE.split('\n').filter(Boolean).map(line => `        ${line}\n`).join('');
    same((build.match(/^    outputs:/gm) || []).length, 1, 'Unique producer outputs block');
    assert.ok(build.includes(expectedOutput), 'Exact scalar producer output mapping');
    const outputAt = build.indexOf('    outputs:\n');
    same(build.slice(outputAt).split(/(?=^    [a-z][a-z-]*:)/m)[0], expectedOutput, 'Closed producer output keys');
    assert.ok(/^    needs: build$/m.test(consumer), 'Exact same-workflow build dependency');
    same([...consumer.matchAll(/^    if: (.+)$/gm)].map(match => match[1]).join('\n'),
        "needs.build.result == 'success' && (github.event_name == 'push' || github.event_name == 'pull_request')",
        'Supported official GUI consumer events');
    same([...consumer.matchAll(/^      (BW_GUI_PRODUCER_[A-Z0-9_]+):/gm)].map(match => match[1]).sort().join(','), [GUI_RUNNER_ENV, 'BW_GUI_PRODUCER_RESULT'].sort().join(','), 'Closed consumer producer inputs');
    for (const [key, expression] of [[GUI_RUNNER_ENV, '${{ needs.build.outputs.gui_producer_runner_v1 }}'],
        ['BW_GUI_PRODUCER_RESULT', '${{ needs.build.result }}']]) {
        same((consumer.match(new RegExp(`^      ${key}:`, 'gm')) || []).length, 1, 'Unique consumer scalar mapping');
        assert.ok(consumer.includes(`      ${key}: ${expression}\n`), 'Exact consumer scalar expression');
    }
    same((consumer.match(/--runner-producer-v1/g) || []).length, 1, 'Unique producer evidence selection');
    assert.ok(consumer.includes('run: node scripts/admit-official-gui-artifact.mjs test-results/numeric-gui-admission --runner-producer-v1\n'), 'Exact producer evidence invocation');
    return Object.freeze({schema: GUI_RUNNER_SCHEMA, workflowSha256: hash(Buffer.from(workflowText)), steps: selected});
}

export function guiRunnerProducerReceipt(wire, source, {expected, env}) {
    assert.ok(typeof wire === 'string' && Buffer.byteLength(wire) <= GUI_RUNNER_INPUT_CAP && !wire.includes('\r') && wire.endsWith('\n'), 'Bounded LF producer scalar input');
    assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(wire), 'No scalar control characters');
    const lines = wire.slice(0, -1).split('\n');same(lines.length, 4, 'Complete closed producer rows');
    same(Object.keys(env).filter(key => key.startsWith('BW_GUI_PRODUCER_')).sort().join(','), [GUI_RUNNER_ENV, 'BW_GUI_PRODUCER_RESULT'].sort().join(','), 'Closed runtime producer input keys');
    same(env[GUI_RUNNER_ENV], wire, 'Exact mapped consumer scalar bytes');
    const fields = lines[0].split('\t');same(fields.length, 10, 'Closed producer header');
    const [schema, repository, runId, attempt, job, checkoutSha, runHeadSha, reviewedHeadSha, workflowSha, workflowRef] = fields;
    same(schema, GUI_RUNNER_SCHEMA, 'Producer evidence schema');same(source.schema, schema, 'Selected producer source schema');
    same(repository, expected.repository, 'Producer scalar repository');assertBrickwrightRepository(repository, env.GITHUB_REPOSITORY_ID);
    same(runId, String(expected.runId), 'Producer scalar run');
    assert.match(attempt, /^[1-9][0-9]{0,8}$/, 'Producer scalar attempt');
    const producerAttempt = producerAttemptOf({attempt: expected.attempt, producerAttempt: Number(attempt)});
    same(job, 'build', 'Producer scalar logical job');same(checkoutSha, expected.checkoutSha, 'Producer scalar checkout');
    same(runHeadSha, expected.runHeadSha, 'Producer scalar run head');same(reviewedHeadSha, expected.reviewedHeadSha, 'Producer scalar reviewed head');
    for (const value of [checkoutSha, runHeadSha, reviewedHeadSha, workflowSha]) fullSha(value);
    same(env.GITHUB_REPOSITORY, repository, 'Consumer repository');same(env.GITHUB_RUN_ID, runId, 'Consumer run');
    same(env.GITHUB_RUN_ATTEMPT, String(expected.attempt), 'Consumer attempt');same(env.GITHUB_SHA, checkoutSha, 'Consumer actual checkout');
    same(env.GITHUB_JOB, 'arcade-numeric-authoring', 'Consumer logical job');same(env.BW_GUI_PRODUCER_RESULT, 'success', 'Successful build dependency result');
    same(env.GITHUB_WORKFLOW_SHA, workflowSha, 'Same executing workflow source');same(env.GITHUB_WORKFLOW_REF, workflowRef, 'Same executing workflow reference');
    const workflowPrefix = `${repository}/.github/workflows/build.yml@`;
    assert.ok(workflowRef.startsWith(workflowPrefix), 'Official producer workflow reference');
    assert.match(workflowRef.slice(workflowPrefix.length), /^refs\/(?:pull\/[1-9][0-9]*\/merge|heads\/[^\s\t]+)$/, 'Official producer workflow reference');
    const rows = lines.slice(1).map((line, i) => {
        const parts = line.split('\t');same(parts.length, 3, 'Closed terminal producer row');
        const [stepId, outcome, conclusion] = parts;const selected = source.steps[i];
        same(stepId, selected.id, 'Ordered source producer ID');
        same(outcome, 'success', 'Critical producer outcome must succeed');same(conclusion, 'success', 'Critical producer conclusion must succeed');
        return {...selected, outcome, conclusion};
    });
    const receipt = {schema: GUI_RUNNER_SCHEMA, repository, runId: expected.runId, attempt: expected.attempt, producerAttempt,
        producerJob: job, consumerJob: env.GITHUB_JOB, checkoutSha, runHeadSha, reviewedHeadSha,
        workflowSha, workflowRef, workflowSha256: source.workflowSha256, dependencyResult: 'success', rows,
        inputBytes: Buffer.byteLength(wire), inputSha256: hash(Buffer.from(wire)), apiStepEvidenceRewritten: false};
    assert.ok(Buffer.byteLength(JSON.stringify(receipt) + '\n') <= GUI_RUNNER_RECEIPT_CAP, 'Bounded complete producer receipt');
    return Object.freeze(receipt);
}

export function admitGuiArtifactRunnerMetadata(metadata, expected, receipt) {
    // The selected receipt is data from the separately checked scalar source;
    // validate its exact successful shape again at the official metadata join.
    same(receipt.schema, GUI_RUNNER_SCHEMA, 'Admitted runner receipt schema');
    for (const key of ['repository', 'runId', 'attempt', 'checkoutSha', 'runHeadSha', 'reviewedHeadSha']) same(receipt[key], expected[key], `Runner official join ${key}`);
    same(receipt.producerAttempt, producerAttemptOf(expected), 'Runner official join producerAttempt');
    same(receipt.dependencyResult, 'success', 'Runner dependency admitted');same(receipt.rows.length, 3, 'Runner producer count');
    return admitGuiArtifactEnvelope(metadata, expected, job => {
        for (const [i, [stepId, name]] of GUI_RUNNER_STEPS.entries()) {
            same(receipt.rows[i].id, stepId, 'Runner official producer ID');same(receipt.rows[i].name, name, 'Runner official producer name');
            same(receipt.rows[i].outcome, 'success', 'Runner official producer outcome');same(receipt.rows[i].conclusion, 'success', 'Runner official producer conclusion');
            const observed = (job.steps || []).filter(step => step.name === name);
            assert.ok(observed.length <= 1, 'Unambiguous optional API producer observation');
            for (const step of observed) {
                assert.ok(['pending', 'queued', 'in_progress', 'completed'].includes(step.status), 'Known optional API producer state');
                assert.ok(step.conclusion == null || step.conclusion === 'success', 'No conflicting API producer failure');
                if (step.status === 'completed') same(step.conclusion, 'success', 'Matching terminal API producer observation');
            }
        }
    });
}

export function safeGuiMember(name) {
    assert.ok(typeof name === 'string' && name.length && !name.includes('\\') && !name.includes('\0'), 'Unsafe artifact member');
    const cleaned = name.startsWith('./') ? name.slice(2) : name;
    assert.ok(cleaned && !path.posix.isAbsolute(cleaned) && !/^[A-Za-z]:/.test(cleaned), 'Absolute artifact member');
    assert.ok(cleaned.split('/').every(part => part && part !== '.' && part !== '..'), 'Artifact path traversal');
    return cleaned;
}

// Inspect central directory before JSZip (which normalizes paths and replaces
// duplicate names). Only a Pages artifact.tar wrapper is supported. ZIP64 and
// other layouts are explicit refusals, never permissive extraction fallbacks.
function inspectZip(bytes) {
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
        if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {end = offset; break;}
    }
    assert.ok(end >= 0, 'ZIP end record required');
    same(bytes.readUInt16LE(end + 4), 0, 'Single ZIP disk'); same(bytes.readUInt16LE(end + 6), 0, 'Single ZIP directory disk');
    const count = bytes.readUInt16LE(end + 10), start = bytes.readUInt32LE(end + 16);
    same(bytes.readUInt16LE(end + 8), count, 'Complete ZIP directory'); assert.notEqual(count, 65535, 'ZIP64 unsupported');
    assert.ok(start + bytes.readUInt32LE(end + 12) === end, 'ZIP directory extent');
    const names = new Set(); let offset = start;
    for (let i = 0; i < count; i++) {
        assert.ok(offset + 46 <= end, 'Truncated ZIP directory'); same(bytes.readUInt32LE(offset), 0x02014b50, 'ZIP directory record');
        const flags = bytes.readUInt16LE(offset + 8); assert.equal(flags & 1, 0, 'Encrypted ZIP unsupported');
        const length = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
        assert.ok(offset + 46 + length + extra + comment <= end, 'ZIP name extent');
        const name = safeGuiMember(bytes.subarray(offset + 46, offset + 46 + length).toString('utf8'));
        assert.ok(!names.has(name), 'Duplicate ZIP member'); names.add(name);
        const mode = bytes.readUInt32LE(offset + 38) >>> 16;
        assert.ok((mode & 0xf000) === 0 || (mode & 0xf000) === 0x8000, 'ZIP symlink/special member refused');
        same(name, 'artifact.tar', 'Only the official Pages TAR wrapper is supported');
        offset += 46 + length + extra + comment;
    }
    same(offset, end, 'Complete ZIP directory extent'); same(names.size, 1, 'Exactly one Pages TAR wrapper');
}

function tarString(bytes) {return bytes.subarray(0, bytes.indexOf(0) < 0 ? bytes.length : bytes.indexOf(0)).toString('utf8');}
function octal(bytes) {
    const value = tarString(bytes).trim(); assert.match(value, /^[0-7]+$/, 'Canonical TAR octal field');
    const parsed = Number.parseInt(value, 8); assert.ok(Number.isSafeInteger(parsed), 'Safe TAR numeric field'); return parsed;
}
export function inspectGuiTar(bytes) {
    const members = new Map(); let offset = 0, longName = null, ended = false;
    while (offset + 512 <= bytes.length) {
        const header = bytes.subarray(offset, offset + 512);
        if (header.every(value => value === 0)) {
            assert.ok(bytes.subarray(offset).every(value => value === 0), 'Nonzero TAR trailing payload'); ended = true; break;
        }
        let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
        same(sum, octal(header.subarray(148, 156)), 'TAR checksum');
        const size = octal(header.subarray(124, 136));
        assert.ok(offset + 512 + size <= bytes.length, 'Truncated TAR member');
        const body = bytes.subarray(offset + 512, offset + 512 + size), type = header[156];
        const prefix = tarString(header.subarray(345, 500));
        const rawName = longName || [prefix, tarString(header.subarray(0, 100))].filter(Boolean).join('/');
        offset += 512 + Math.ceil(size / 512) * 512;
        if (type === 76) {assert.equal(longName, null, 'Nested GNU long name refused'); longName = tarString(body); continue;}
        longName = null;
        if (type === 53) {
            same(size, 0, 'TAR directory has no payload');
            if (rawName !== './' && rawName !== '.') safeGuiMember(rawName.replace(/\/$/, ''));
            continue;
        }
        assert.ok(type === 0 || type === 48, 'TAR symlink/hardlink/special/PAX member refused');
        const name = safeGuiMember(rawName); assert.ok(!members.has(name), 'Duplicate TAR member'); members.set(name, body);
    }
    assert.ok(ended && longName === null, 'Complete TAR termination');
    return members;
}

export async function readGuiArchiveMembers(bytes) {
    inspectZip(bytes);
    const zip = await JSZip.loadAsync(bytes, {checkCRC32: true});
    return inspectGuiTar(await zip.file('artifact.tar').async('nodebuffer'));
}

export async function inspectGuiArchive(bytes, admission, expected) {
    same(bytes.length, admission.archiveBytes, 'Original ZIP length');
    const archiveSha256 = hash(bytes);
    if (admission.archiveDigest) same(`sha256:${archiveSha256}`, admission.archiveDigest, 'Official ZIP digest');
    const members = await readGuiArchiveMembers(bytes);
    assert.ok(members.has(GUI_MANIFEST), 'Embedded original build manifest required');
    const manifest = JSON.parse(members.get(GUI_MANIFEST).toString('utf8'));
    same(manifest.schema, 1, 'Build manifest schema'); same(manifest.repository, admission.repository, 'Manifest repository');
    same(manifest.runId, admission.runId, 'Manifest run'); same(manifest.attempt, admission.producerAttempt, 'Manifest producer attempt');
    same(manifest.job, 'build', 'Manifest producer'); same(manifest.githubSha, admission.checkoutSha, 'Original GITHUB_SHA checkout');
    same(manifest.sourceSha, admission.checkoutSha, 'Manifest actual checkout'); same(manifest.reviewedHeadSha, admission.reviewedHeadSha, 'Manifest reviewed source');
    for (const key of ['treeSha', 'producerSha', 'arraysValuesSha']) {fullSha(manifest[key]); same(manifest[key], expected[key], `Manifest ${key}`);}
    same(manifest.sdk.version, '4.2.1', 'Selected Arcade version'); same(manifest.sdk.pxtVersion, '13.2.1', 'Selected PXT version');
    same(manifest.sdk.targetCommit, '2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea', 'Selected original target commit');
    const target = members.get('static/makecode/arcade/target.json'), worker = members.get('static/makecode/arcade/pxtworker.js');
    assert.ok(target && worker, 'Original artifact SDK worker and target required');
    same(hash(target), manifest.sdk.targetSha256, 'Manifest target body'); same(hash(worker), manifest.sdk.workerSha256, 'Manifest worker body');
    const versions = JSON.parse(target.toString('utf8')).versions;
    same(versions.target, manifest.sdk.version, 'Original target version'); same(versions.pxt, manifest.sdk.pxtVersion, 'Original PXT version');
    same(versions.commits, `https://github.com/microsoft/pxt-arcade/commits/${manifest.sdk.targetCommit}`, 'Original SDK source');
    const assets = Object.create(null), assetBytes = Object.create(null);
    for (const [name, body] of members) {assets[name] = hash(body); assetBytes[name] = body.length;}
    assert.ok(Object.keys(assets).some(name => name.endsWith('.js')), 'Actual JavaScript inventory required');
    const receipt = {sourceSha: manifest.sourceSha, treeSha: manifest.treeSha, reviewedHeadSha: manifest.reviewedHeadSha,
        producerSha: manifest.producerSha, arraysValuesSha: manifest.arraysValuesSha, sdk: manifest.sdk,
        build: {runId: admission.runId, attempt: admission.producerAttempt, consumerAttempt: admission.attempt, jobId: admission.jobId, artifactId: admission.artifactId,
            runUrl: admission.runUrl, conclusion: 'success', checkoutSha: admission.checkoutSha, archiveSha256}, assets, assetBytes};
    return {members, receipt, manifest};
}

// New owned output only: refuse existing directories, so prior symlinks and
// partial extractions cannot redirect writes or masquerade as admitted bytes.
export async function extractAdmittedGui(inspected, directory) {
    for (const [name, bytes] of inspected.members) {
        same(safeGuiMember(name), name, 'Canonical admitted output member');
        assert.ok(Buffer.isBuffer(bytes), 'Admitted output bytes required');
    }
    await mkdir(directory); // no recursive: existing/redirected outputs refused
    for (const [name, bytes] of inspected.members) {
        const target = path.join(directory, name);
        await mkdir(path.dirname(target), {recursive: true}); await writeFile(target, bytes, {flag: 'wx'});
    }
}

export async function fetchGuiArtifactMetadata({repository, runId, attempt, producerAttempt = attempt, fetchImpl = fetch, token, signal}) {
    assertBrickwrightSlug(repository); id(runId); producerAttemptOf({attempt, producerAttempt});
    const base = `https://api.github.com/repos/${repository}/actions`;
    const headers = {accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? {authorization: `Bearer ${token}`} : {})};
    const get = async url => {
        const response = await fetchImpl(url, {headers, redirect: 'error', ...(signal ? {signal} : {})});
        assert.equal(response.status, 200, 'Official metadata GET must succeed'); return response.json();
    };
    const run = await get(`${base}/runs/${runId}`);
    // Sequential pagination retains the complete unique producer/artifact census.
    const collect = async (url, field) => {
        const all = []; let total;
        for (let page = 1; ; page++) {
            const result = await get(`${url}?per_page=100&page=${page}`);
            assert.ok(Number.isSafeInteger(result.total_count) && result.total_count >= 0, 'Complete official census count');
            if (total === undefined) total = result.total_count; else same(result.total_count, total, 'Stable official census');
            assert.ok(Array.isArray(result[field]), 'Official census records'); all.push(...result[field]);
            assert.ok(all.length <= total, 'Official census extent');
            if (all.length === total) break;
            assert.ok(result[field].length > 0, 'Incomplete official pagination');
        }
        assert.equal(new Set(all.map(value => value.id)).size, all.length, 'Unique official record identities');
        return all;
    };
    const jobs = await collect(`${base}/runs/${runId}/attempts/${producerAttempt}/jobs`, 'jobs');
    const artifacts = await collect(`${base}/runs/${runId}/artifacts`, 'artifacts');
    const producers = jobs.filter(value => value.name === 'build'), pages = artifacts.filter(value => value.name === 'github-pages');
    same(producers.length, 1, 'Unique official build producer'); same(pages.length, 1, 'Unique official Pages artifact');
    return {run, job: producers[0], artifact: pages[0], artifacts};
}

// A needs: build consumer may start before the API reflects job completion.
// This observes one exact producer; it grants no admission and never retries
// an admission failure. The unchanged validator must still accept the result.
export async function observeGuiProducerCompletion({readMetadata, now = () => performance.now(),
    pause = ms => new Promise(resolve => setTimeout(resolve, ms)), maxWaitMs = 60000}) {
    assert.ok(Number.isFinite(maxWaitMs) && maxWaitMs > 0 && maxWaitMs <= 60000, 'Bounded producer observation');
    const deadline = now() + maxWaitMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Producer metadata observation deadline')), maxWaitMs);
    timer.unref?.();
    const identity = m => [m.run.id, m.run.run_attempt, m.run.head_sha,
        m.job.id, m.job.run_id, m.job.run_attempt, m.job.head_sha, m.artifact.id];
    try {
        let metadata = await readMetadata(controller.signal);
        const original = identity(metadata);
        for (;;) {
            assert.ok(now() <= deadline, 'Producer did not complete within observation bound');
            assert.deepEqual(identity(metadata), original, 'Exact producer/run/attempt/head/artifact must remain unchanged');
            assert.ok(['queued', 'in_progress', 'completed'].includes(metadata.job.status), 'Known producer status');
            if (metadata.job.status === 'completed') return metadata;
            same(metadata.job.conclusion, null, 'Pending producer cannot have a conclusion');
            const remaining = deadline - now();
            assert.ok(remaining > 0, 'Producer did not complete within observation bound');
            await pause(Math.min(1000, remaining));
            assert.ok(now() < deadline, 'Producer did not complete within observation bound');
            metadata = await readMetadata(controller.signal);
        }
    } finally {clearTimeout(timer);}
}

export async function acquireGuiArchive({admission, archivePath, fetchImpl = fetch, token}) {
    // Existing acquisition must have its matching original receipt. Never
    // overwrite or silently reacquire it; a changed body is a preserved failure.
    const recordPath = `${archivePath}.acquisition.json`;
    try {
        const bytes = await readFile(archivePath);
        const record = JSON.parse(await readFile(recordPath, 'utf8'));
        same(JSON.stringify(record.admission), JSON.stringify(admission), 'Reused archive metadata identity');
        same(hash(bytes), record.archiveSha256, 'Reused original archive bytes');
        same(bytes.length, admission.archiveBytes, 'Reused original archive length');
        return bytes;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // A body without a receipt is not a new acquisition opportunity.
        try {await readFile(archivePath); throw new Error('Existing archive has no original acquisition receipt');}
        catch (present) {if (present.code !== 'ENOENT') throw present;}
    }
    const response = await fetchImpl(admission.archiveUrl, {redirect: 'manual', headers: {
        accept: 'application/vnd.github+json', ...(token ? {authorization: `Bearer ${token}`} : {})}});
    same(response.status, 302, 'Official archive redirect');
    const destination = new URL(response.headers.get('location'));
    same(destination.protocol, 'https:', 'Official archive transport');
    assert.equal(destination.username + destination.password, '', 'No redirect credentials');
    // Signed CDN request intentionally has no repository token headers.
    const download = await fetchImpl(destination.href, {redirect: 'error'});
    same(download.status, 200, 'Original archive acquisition');
    const bytes = Buffer.from(await download.arrayBuffer());
    same(bytes.length, admission.archiveBytes, 'Original acquisition length');
    if (admission.archiveDigest) same(`sha256:${hash(bytes)}`, admission.archiveDigest, 'Original acquisition digest');
    await writeFile(archivePath, bytes, {flag: 'wx'});
    await writeFile(recordPath, JSON.stringify({admission, archiveSha256: hash(bytes)}, null, 2) + '\n', {flag: 'wx'});
    return bytes;
}
