import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import {admitOfficialGui} from '../scripts/admit-official-gui-artifact.mjs';
import {GUI_MANIFEST, GUI_RUNNER_ENV, GUI_RUNNER_TEMPLATE, guiRunnerProducerSource,
    guiRunnerProducerReceipt, admitGuiArtifactMetadata, admitGuiArtifactRunnerMetadata} from '../scripts/lib/official-gui-artifact.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const workflow = await readFile(path.join(root, '.github/workflows/build.yml'), 'utf8');
const source = guiRunnerProducerSource(workflow), sha = c => c.repeat(40);
const hash = b => createHash('sha256').update(b).digest('hex');
const repository = 'CrispStrobe/brickwright-lite', api = `https://api.github.com/repos/${repository}/actions`;
const expected = {repository, runId: 12, attempt: 2, runHeadSha: sha('a'), reviewedHeadSha: sha('a'),
    checkoutSha: sha('b'), treeSha: sha('c'), producerSha: sha('d'), arraysValuesSha: sha('e'), jobId: 34, artifactId: 56};
const environment = e => ({GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: '12', GITHUB_RUN_ATTEMPT: '2',
    GITHUB_SHA: e.checkoutSha, GITHUB_JOB: 'arcade-numeric-authoring', BW_GUI_PRODUCER_RESULT: 'success', [GUI_RUNNER_ENV]: render(e),
    GITHUB_WORKFLOW_SHA: sha('f'), GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/build.yml@refs/pull/12/merge`});

// Evaluate the actual checked workflow's scalar expressions, rather than a
// second handwritten list of states or an invented completed REST record.
function render(e = expected, changes = {}) {
    const build = workflow.split('  build:\n')[1].split('\n  browser:')[0];
    const wire = build.split('      gui_producer_runner_v1: |\n')[1].split(/^    [a-z]/m)[0]
        .split('\n').filter(Boolean).map(line => line.slice(8)).join('\n') + '\n';
    assert.equal(wire, GUI_RUNNER_TEMPLATE);
    assert.ok(!wire.includes('github.job'), 'job outputs cannot read the step-only github.job context');
    assert.equal(wire.split('\n')[0].split('\t')[4], 'build', 'logical producer identity comes from the inspected job key');
    const values = {'github.repository': repository, 'github.run_id': '12', 'github.run_attempt': '2',
        'github.sha': e.checkoutSha, 'github.event.pull_request.head.sha || github.sha': e.runHeadSha,
        'github.workflow_sha': sha('f'), 'github.workflow_ref': `${repository}/.github/workflows/build.yml@refs/pull/12/merge`};
    for (const step of source.steps) for (const field of ['outcome', 'conclusion']) values[`steps['${step.id}'].${field}`] = 'success';
    Object.assign(values, changes);
    return wire.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, expression) => {
        assert.ok(Object.hasOwn(values, expression), expression); return values[expression];
    });
}
const evidence = (e = expected) => ({wire: render(e), source, env: environment(e)});
const metadata = () => ({run: {id: 12, run_attempt: 2, head_sha: sha('a'), repository: {id: 1, full_name: repository},
    head_repository: {id: 1, full_name: repository}, html_url: `https://github.com/${repository}/actions/runs/12`,
    path: '.github/workflows/build.yml', event: 'pull_request', pull_requests: [{head: {sha: sha('a')}}]},
job: {id: 34, run_id: 12, run_attempt: 2, head_sha: sha('a'), name: 'build', status: 'completed', conclusion: 'success',
    html_url: `https://github.com/${repository}/actions/runs/12/job/34`, run_url: `${api}/runs/12`,
    started_at: '2026-10-24T00:00:00Z', completed_at: '2026-10-24T01:00:00Z',
    steps: source.steps.map(s => ({name: s.name, status: 'pending', conclusion: null}))},
artifact: {id: 56, name: 'github-pages', expired: false, url: `${api}/artifacts/56`, archive_download_url: `${api}/artifacts/56/zip`,
    size_in_bytes: 1, created_at: '2026-10-24T00:59:00Z', workflow_run: {id: 12, head_sha: sha('a'), repository_id: 1, head_repository_id: 1}},
artifacts: [{id: 56, name: 'github-pages'}]});
function tar(entries) {
    const chunks = [];
    for (const [name, body] of entries) {
        const h = Buffer.alloc(512); h.write(name); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
        h.write(body.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136); h.fill(32, 148, 156); h[156] = 48;
        h.write(h.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148);
        chunks.push(h, body, Buffer.alloc((512 - body.length % 512) % 512));
    }
    return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}
async function packet(e = expected, producerAttempt = 2) {
    const target = Buffer.from(JSON.stringify({versions: {target: '4.2.1', pxt: '13.2.1', commits: 'https://github.com/microsoft/pxt-arcade/commits/2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea'}}));
    const worker = Buffer.from('authored inert worker bytes');
    const manifest = {schema: 1, repository, runId: 12, attempt: producerAttempt, job: 'build', githubSha: e.checkoutSha,
        sourceSha: e.checkoutSha, reviewedHeadSha: e.reviewedHeadSha, treeSha: e.treeSha,
        producerSha: e.producerSha, arraysValuesSha: e.arraysValuesSha,
        sdk: {version: '4.2.1', pxtVersion: '13.2.1', targetCommit: '2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea', targetSha256: hash(target), workerSha256: hash(worker)}};
    const zip = new JSZip(); zip.file('artifact.tar', tar([[GUI_MANIFEST, Buffer.from(JSON.stringify(manifest))],
        ['static/makecode/arcade/target.json', target], ['static/makecode/arcade/pxtworker.js', worker], ['gui.js', Buffer.from('inert editor fixture')]]));
    const bytes = await zip.generateAsync({type: 'nodebuffer'}), meta = metadata();
    meta.job.run_attempt = producerAttempt; meta.artifact.size_in_bytes = bytes.length; meta.artifact.digest = `sha256:${hash(bytes)}`;
    return {bytes, meta};
}
function transport(p) {
    const calls = [];
    return {calls, fetchImpl: async url => {
        calls.push(url);
        if (url === `${api}/runs/12`) return {status: 200, json: async () => p.meta.run};
        if (url.startsWith(`${api}/runs/12/attempts/${p.meta.job.run_attempt}/jobs?`)) return {status: 200, json: async () => ({total_count: 1, jobs: [p.meta.job]})};
        if (url.startsWith(`${api}/runs/12/artifacts?`)) return {status: 200, json: async () => ({total_count: (p.artifactsOverride || [p.meta.artifact]).length, artifacts: p.artifactsOverride || [p.meta.artifact]})};
        if (url === `${api}/artifacts/56/zip`) return {status: 302, headers: new Headers({location: 'https://fixture.invalid/original'})};
        assert.equal(url, 'https://fixture.invalid/original'); return {status: 200, arrayBuffer: async () => p.bytes};
    }};
}
async function ownedTemporary(fn) {
    const parent = path.join(root, 'test-results'); await mkdir(parent, {recursive: true});
    const dir = await mkdtemp(path.join(parent, 'gui-runner-producer-'));
    try { return await fn(dir); } finally { await rm(dir, {recursive: true, force: true}); }
}

test('actual workflow scalar mapping drives a distinct receipt and leaves pending REST evidence untouched', () => {
    const raw = render(), receipt = guiRunnerProducerReceipt(raw, source, {expected, env: environment(expected)}), m = metadata();
    assert.equal(receipt.inputSha256, hash(Buffer.from(raw))); assert.equal(receipt.workflowSha256, hash(Buffer.from(workflow)));
    assert.equal(receipt.apiStepEvidenceRewritten, false); assert.equal(receipt.workflowSha, sha('f'));
    assert.equal(admitGuiArtifactRunnerMetadata(m, expected, receipt).jobId, 34);
    assert.ok(m.job.steps.every(s => s.status === 'pending' && s.conclusion === null));
    assert.throws(() => admitGuiArtifactMetadata(m, expected), /Completed producer step Build the editor/);
});

test('source closure refuses IDs, names, order, scalar/default/output substitutions and consumer-route drift', () => {
    for (const change of [
        s => s.replace('\tbuild\t${{ github.sha }}', '\t${{ github.job }}\t${{ github.sha }}'),
        s => s.replace('id: gui_build_manifest', 'id: wrong_manifest'),
        s => s.replace('id: gui_pages_upload', 'id: gui_pages_upload\n        id: duplicate'),
        s => s.replace('name: Write GUI build source manifest', 'name: Unknown manifest writer'),
        s => s.replace("steps['gui_pages_upload'].outcome", "steps['build_editor'].outcome"),
        s => s.replace("steps['gui_pages_upload'].conclusion", "steps['gui_pages_upload'].outputs.secret"),
        s => s.replace("steps['gui_pages_upload'].outcome", "toJSON(steps)"),
        s => s.replace("steps['gui_pages_upload'].outcome", "steps['gui_pages_upload'].outcome || 'success'"),
        s => s.replace('    needs: build\n    runs-on:', '    needs: other\n    runs-on:'),
        s => s.replace('${{ needs.build.result }}', '${{ needs.other.result }}'),
        s => s.replace('      BW_GUI_PRODUCER_RESULT:', '      BW_GUI_PRODUCER_EXTRA: bad\n      BW_GUI_PRODUCER_RESULT:'),
        s => s.replace('      gui_producer_runner_v1: |', '      extra: bad\n      gui_producer_runner_v1: |'),
        s => s.replace('id: gui_build_manifest', 'id: gui_build_manifest\n        continue-on-error: true'),
        s => s.replace(' --runner-producer-v1\n', '\n')
    ]) {const hostile = change(workflow); assert.notEqual(hostile, workflow); assert.throws(() => guiRunnerProducerSource(hostile));}
});

test('coherent producer source step reordering and whole-source overflow refuse', () => {
    const manifest = '      - name: Write GUI build source manifest\n', upload = '      - name: Upload GUI Pages artifact\n';
    const first = workflow.indexOf(manifest), second = workflow.indexOf(upload), end = workflow.indexOf('\n  # THE MISMATCHED-TREE HAZARD', second);
    assert.ok(first > 0 && second > first && end > second);
    const reordered = workflow.slice(0, first) + workflow.slice(second, end) + '\n' + workflow.slice(first, second) + workflow.slice(end);
    assert.notEqual(reordered, workflow); assert.throws(() => guiRunnerProducerSource(reordered), /step order/);
    assert.throws(() => guiRunnerProducerSource(workflow + '#'.repeat(1024 * 1024)), /Bounded/);
});

test('missing, extra, duplicate, reordered, unsuccessful, COE, malformed and oversized scalars refuse', () => {
    const wire = render(), lines = wire.trimEnd().split('\n');
    for (const bad of [undefined, '', wire.trimEnd(), wire.replace(/\n/g, '\r\n'), wire + lines[1] + '\n',
        lines.slice(0, -1).join('\n') + '\n', [lines[0], lines[2], lines[1], lines[3]].join('\n') + '\n',
        wire.replace('success\tsuccess', 'failure\tsuccess'), wire.replace('success\tsuccess', 'success\tfailure'),
        wire.replace('success\tsuccess', '\tsuccess'), wire.replace('success\tsuccess', 'skipped\tskipped'),
        wire.replace('success\tsuccess', 'pending\tpending'), wire.replace('success\tsuccess', 'cancelled\tcancelled'),
        wire.replace('/merge', '/mer\0ge'), wire.replace('gui_pages_upload\t', 'gui_build_manifest\t'), 'x'.repeat(16385) + '\n']) {
        assert.throws(() => guiRunnerProducerReceipt(bad, source, {expected, env: {...environment(expected), [GUI_RUNNER_ENV]: bad}}));
    }
});

test('same-workflow source/run/head/attempt/job/result bindings reject coherent header and context drift', () => {
    const wire = render();
    for (const change of [e => e.GITHUB_REPOSITORY = 'other/repo', e => e.GITHUB_RUN_ID = '13', e => e.GITHUB_RUN_ATTEMPT = '3',
        e => e.GITHUB_SHA = sha('c'), e => e.GITHUB_JOB = 'build', e => e.BW_GUI_PRODUCER_RESULT = 'failure',
        e => e.GITHUB_WORKFLOW_SHA = sha('c'), e => e.GITHUB_WORKFLOW_REF += '-other', e => e.BW_GUI_PRODUCER_EXTRA = 'bad', e => e[GUI_RUNNER_ENV] += 'extra']) {
        const env = environment(expected); change(env); assert.throws(() => guiRunnerProducerReceipt(wire, source, {expected, env}));
    }
    for (const key of ['repository', 'runId', 'attempt', 'checkoutSha', 'runHeadSha', 'reviewedHeadSha']) {
        const e = {...expected, [key]: typeof expected[key] === 'number' ? expected[key] + 1 : sha('c')};
        assert.throws(() => guiRunnerProducerReceipt(wire, source, {expected: e, env: environment(expected)}));
    }
});

test('genuine admission validates authored ZIP/digest/manifest with pending API steps only in selected mode', async () => ownedTemporary(async dir => {
    const p = await packet(), t = transport(p);
    await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, 'legacy'), fetchImpl: t.fetchImpl}), /Completed producer step/);
    assert.ok(!t.calls.some(url => url.endsWith('/zip')));
    const result = await admitOfficialGui({expected, directory: path.join(dir, 'runner'), fetchImpl: t.fetchImpl, runnerEvidence: evidence()});
    assert.equal(t.calls.filter(url => url.endsWith('/zip')).length, 1);
    const retained = JSON.parse(await readFile(path.join(dir, 'runner/metadata.json')));
    assert.ok(retained.metadata.job.steps.every(s => s.status === 'pending'));
    assert.equal(JSON.parse(await readFile(result.receiptPath)).sourceSha, expected.checkoutSha);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'runner/runner-evidence.json'))).rows.length, 3);
}));

test('runner mode retains common official identity/failure/sole-artifact checks and requests zero archives on refusal', async () => ownedTemporary(async dir => {
    const changes = [p => p.meta.run.id++, p => p.meta.run.run_attempt++, p => p.meta.run.head_sha = sha('e'),
        p => p.meta.job.name = 'other', p => p.meta.job.conclusion = 'failure', p => p.meta.job.run_attempt++,
        p => p.meta.artifact.name = 'other', p => p.meta.artifact.workflow_run.head_sha = sha('e'),
        p => p.meta.artifact.created_at = '2025-01-01', p => p.meta.artifact.digest = 'malformed',
        p => p.meta.job.steps[0].conclusion = 'failure', p => p.meta.job.steps[0].status = 'unknown',
        p => p.meta.job.steps.push({...p.meta.job.steps[0]}),
        p => p.artifactsOverride = [p.meta.artifact, {...p.meta.artifact, id: 57}]];
    for (const [i, change] of changes.entries()) {
        const p = await packet(); change(p); const t = transport(p);
        await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, String(i)), fetchImpl: t.fetchImpl, runnerEvidence: evidence()}));
        assert.ok(!t.calls.some(url => url.endsWith('/zip')));
    }
    const p = await packet(), t = transport(p), bad = evidence(); bad.wire = bad.wire.replace('success\tsuccess', 'failure\tsuccess');
    await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, 'failed-outcome'), fetchImpl: t.fetchImpl, runnerEvidence: bad}));
    assert.equal(t.calls.length, 0);
}));

test('matching runner evidence never bypasses archive bytes, digest or embedded source identity', async () => ownedTemporary(async dir => {
    for (const [i, change] of [p => p.meta.artifact.digest = 'sha256:' + '0'.repeat(64),
        p => {p.bytes[0] ^= 1; p.meta.artifact.digest = 'sha256:' + hash(p.bytes);},
        p => p.meta.artifact.size_in_bytes++].entries()) {
        const p = await packet(); change(p); const t = transport(p);
        await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, String(i)), fetchImpl: t.fetchImpl, runnerEvidence: evidence()}));
        assert.equal(t.calls.filter(url => url.endsWith('/zip')).length, 1);
    }
    const p = await packet({...expected, checkoutSha: sha('c')}), t = transport(p);
    await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, 'wrong-manifest'), fetchImpl: t.fetchImpl, runnerEvidence: evidence()}), /source|checkout/i);
}));

test('genuine CLI binds checked Git source and terminal context before its sole mocked archive intake', async () => ownedTemporary(async dir => {
    const fixture = path.join(dir, 'source'); await mkdir(fixture);
    const files = ['scripts/admit-official-gui-artifact.mjs', 'scripts/lib/official-gui-artifact.mjs',
        'scripts/lib/gui-harness-source.mjs', 'scripts/lib/workflow-gates.mjs',
        'scripts/lib/brickwright-repository.mjs', '.github/workflows/build.yml'];
    for (const file of files) {await mkdir(path.dirname(path.join(fixture, file)), {recursive: true}); await writeFile(path.join(fixture, file), await readFile(path.join(root, file)));}
    await writeFile(path.join(fixture, 'vendor-pins.json'), JSON.stringify({'sb3-creator': expected.producerSha, 'arrays-values': expected.arraysValuesSha}));
    const git = args => execFileSync('/usr/bin/git', ['-C', fixture, ...args], {encoding: 'utf8'}).trim();
    git(['init', '-q']); git(['config', 'user.name', 'Owned fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
    git(['add', '.']); git(['commit', '-qm', 'authored source fixture']);
    const e = {...expected, checkoutSha: git(['rev-parse', 'HEAD']), treeSha: git(['rev-parse', 'HEAD^{tree}'])};
    const p = await packet(e), metaFile = path.join(dir, 'metadata.json'), zipFile = path.join(dir, 'archive.zip'), callsFile = path.join(dir, 'calls.json');
    await writeFile(metaFile, JSON.stringify(p.meta)); await writeFile(zipFile, p.bytes);
    const hook = path.join(dir, 'mock-fetch.mjs');
    await writeFile(hook, `import {readFileSync,writeFileSync} from 'node:fs';
const m=JSON.parse(readFileSync(process.env.AUTHORED_METADATA)),calls=[];
globalThis.fetch=async url=>{calls.push(url);writeFileSync(process.env.AUTHORED_CALLS,JSON.stringify(calls));
if(url.endsWith('/runs/12'))return {status:200,json:async()=>m.run};
if(url.includes('/attempts/2/jobs?'))return {status:200,json:async()=>({total_count:1,jobs:[m.job]})};
if(url.includes('/runs/12/artifacts?'))return {status:200,json:async()=>({total_count:1,artifacts:[m.artifact]})};
if(url===m.artifact.archive_download_url)return {status:302,headers:new Headers({location:'https://fixture.invalid/original'})};
if(url==='https://fixture.invalid/original')return {status:200,arrayBuffer:async()=>readFileSync(process.env.AUTHORED_ZIP)};
throw Error('Unassigned mocked API URL');};\n`);
    const env = {...process.env, ...environment(e), BW_GUI_GIT_EXECUTABLE: '/usr/bin/git', BW_GUI_RUN_HEAD_SHA: e.runHeadSha,
        BW_GUI_REVIEWED_HEAD_SHA: e.reviewedHeadSha, [GUI_RUNNER_ENV]: render(e), AUTHORED_METADATA: metaFile, AUTHORED_ZIP: zipFile, AUTHORED_CALLS: callsFile};
    delete env.GITHUB_OUTPUT; delete env.BW_GUI_RETAINED_ARCHIVE;
    // Keep only an explicitly supplied dependency loader. Test-only --import
    // hooks use the test checkout's cwd and must not be projected into another
    // Git fixture; normal hosted Node resolves its already-installed packages.
    const loaderArgs = [];
    for (let i = 0; i < process.execArgv.length; i++) if (['--experimental-loader', '--loader'].includes(process.execArgv[i])) {
        loaderArgs.push(process.execArgv[i], path.resolve(process.execArgv[++i]));
    }
    const run = (name, selected = true, changed = {}) => spawnSync(process.execPath, [...loaderArgs, '--import', hook,
        path.join(fixture, files[0]), path.join(dir, name), ...(selected ? ['--runner-producer-v1'] : [])],
    {cwd: fixture, env: {...env, ...changed}, timeout: 10000, maxBuffer: 256 * 1024, encoding: 'utf8'});
    const positive = run('positive'); assert.equal(positive.status, 0, positive.stderr);
    assert.equal(JSON.parse(await readFile(callsFile)).filter(url => url.endsWith('/zip')).length, 1);
    const record = JSON.parse(await readFile(path.join(dir, 'positive/runner-evidence.json')));
    assert.equal(record.checkoutSha, e.checkoutSha); assert.equal(record.workflowSha, sha('f'));
    for (const [name, changes] of [['bad-run', {GITHUB_RUN_ID: '13'}], ['bad-result', {BW_GUI_PRODUCER_RESULT: 'failure'}],
        ['bad-wire', {[GUI_RUNNER_ENV]: render(e).replace('success\tsuccess', 'failure\tsuccess')}], ['bad-job', {GITHUB_JOB: 'build'}]]) {
        await writeFile(callsFile, '[]'); const result = run(name, true, changes); assert.equal(result.status, 1);
        assert.deepEqual(JSON.parse(await readFile(callsFile)), []); assert.ok(result.stderr.length < 2048);
    }
    await writeFile(callsFile, '[]'); const legacy = run('legacy', false); assert.equal(legacy.status, 1);
    assert.match(legacy.stderr, /Completed producer step Build the editor/); assert.ok(!JSON.parse(await readFile(callsFile)).some(url => url.endsWith('/zip')));
    await writeFile(callsFile, '[]'); await writeFile(path.join(fixture, '.github/workflows/build.yml'), workflow + '# uncommitted drift\n');
    const drift = run('source-drift'); assert.equal(drift.status, 1); assert.deepEqual(JSON.parse(await readFile(callsFile)), []);
}));


test('source and identity guard mutants accept the coherent hostile fixture only when those guards are removed', async () => {
    const file = path.join(root, 'scripts/lib/official-gui-artifact.mjs');
    const jszip = import.meta.resolve('jszip');
    assert.equal(new URL(jszip).protocol, 'file:', 'resolve the approved package from this normal file context');
    const code = (await readFile(file, 'utf8'))
        .replace("'./workflow-gates.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'scripts/lib/workflow-gates.mjs')).href))
        .replace("'./brickwright-repository.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'scripts/lib/brickwright-repository.mjs')).href))
        .replace("'jszip'", JSON.stringify(jszip));
    const load = async body => import('data:text/javascript;base64,' + Buffer.from(body).toString('base64'));
    const wrong = workflow.replace("steps['gui_pages_upload'].outcome", "steps['build_editor'].outcome");
    assert.notEqual(wrong, workflow); assert.throws(() => guiRunnerProducerSource(wrong));
    const sourceMutant = code.replace("    assert.ok(build.includes(expectedOutput), 'Exact scalar producer output mapping');\n", '')
        .replace("    same(build.slice(outputAt).split(/(?=^    [a-z][a-z-]*:)/m)[0], expectedOutput, 'Closed producer output keys');\n", '');
    assert.notEqual(sourceMutant, code); const weakerSource = await load(sourceMutant);
    assert.equal(weakerSource.guiRunnerProducerSource(wrong).steps.length, 3);
    const wire = render().replace('\t12\t2\tbuild', '\t13\t2\tbuild'), env = {...environment(expected), GITHUB_RUN_ID: '13', [GUI_RUNNER_ENV]: wire};
    assert.notEqual(wire, render()); assert.throws(() => guiRunnerProducerReceipt(wire, source, {expected, env}));
    const identityMutant = code.replace("same(runId, String(expected.runId), 'Producer scalar run');", '');
    assert.notEqual(identityMutant, code); const weakerIdentity = await load(identityMutant);
    assert.equal(weakerIdentity.guiRunnerProducerReceipt(wire, source, {expected, env}).runId, 12,
        'the removed check would conceal a coherently changed header/context run');
});

const consumerGuard = sourceText => {
    const bodies = sourceText.split('  arcade-numeric-authoring:\n');
    assert.equal(bodies.length, 2, 'one official numeric consumer');
    const consumer = bodies[1].split(/\n  [a-z][a-z-]*:\n/)[0];
    const guards = [...consumer.matchAll(/^    if: (.+)$/gm)];
    assert.equal(guards.length, 1, 'one explicit consumer event guard');
    return guards[0][1];
};
const assertConsumerSelection = sourceText => {
    const expression = consumerGuard(sourceText);
    const cases = [
        ['push', 'success', true], ['pull_request', 'success', true],
        ['workflow_dispatch', 'success', false], ['schedule', 'success', false],
        ['pull_request_target', 'success', false], [undefined, 'success', false],
        ['push', 'failure', false], ['pull_request', 'cancelled', false],
        ['push', 'skipped', false], ['pull_request', undefined, false]
    ];
    for (const [event, result, selected] of cases) {
        const actual = runInNewContext(expression, {github: {event_name: event}, needs: {build: {result}}}, {timeout: 100});
        assert.equal(actual, selected, `actual consumer guard: ${event}/${result}`);
    }
};

test('actual consumer source requires successful supported push/PR events, with manual coverage supplied separately', () => {
    assertConsumerSelection(workflow);
    assert.doesNotThrow(() => guiRunnerProducerSource(workflow));
});

test('actual consumer source and event matrix reject removed, weakened and unconditional guards', () => {
    const guard = consumerGuard(workflow);
    const line = `    if: ${guard}\n`;
    assert.equal(workflow.split(line).length - 1, 1, 'exact consumer guard anchor');
    for (const replacement of ['', "    if: needs.build.result == 'success'\n", '    if: true\n',
        "    if: needs.build.result == 'success' && github.event_name != 'workflow_dispatch'\n"]) {
        const mutant = workflow.replace(line, replacement);
        assert.throws(() => guiRunnerProducerSource(mutant), /Supported official GUI consumer events/,
            'the actual source verifier must reject altered event authority');
        assert.throws(() => assertConsumerSelection(mutant), {name: 'AssertionError'},
            'the actual event/dependency matrix must detect the changed behavior');
    }
});


test('unsupported manual metadata still refuses before the sole archive GET', async () => ownedTemporary(async dir => {
    const e = {...expected, checkoutSha: expected.runHeadSha};
    const meta = metadata(); meta.run.event = 'workflow_dispatch'; meta.run.head_branch = 'lane/reviewed-fixture';
    const ref = `${repository}/.github/workflows/build.yml@refs/heads/lane/reviewed-fixture`;
    const wire = render(e, {'github.workflow_ref': ref});
    const env = {...environment(e), GITHUB_WORKFLOW_REF: ref, [GUI_RUNNER_ENV]: wire};
    const fixture = transport({meta, bytes: Buffer.alloc(0)});
    await assert.rejects(admitOfficialGui({expected: e, directory: path.join(dir, 'manual-refusal'),
        token: 'authored-fixture', fetchImpl: fixture.fetchImpl, runnerEvidence: {wire, source, env}}),
    /Only reviewed push\/PR build events/);
    assert.equal(fixture.calls.filter(url => url === `${api}/artifacts/56/zip` ||
        url === 'https://fixture.invalid/original').length, 0, 'no archive request before supported-event admission');
}));

// Issue #1700: a single-job rerun (consumer attempt 2) reuses the attempt-1
// build job, whose outputs and embedded manifest name attempt 1.
const rerunEvidence = (producerAttempt, changes = {}) => {
    const wire = render(expected, {'github.run_attempt': String(producerAttempt), ...changes});
    return {wire, source, env: {...environment(expected), [GUI_RUNNER_ENV]: wire}};
};

test('single-job rerun admits the earlier producer attempt and binds jobs census, job and manifest to it', async () => ownedTemporary(async dir => {
    const receipt = guiRunnerProducerReceipt(rerunEvidence(1).wire, source, {expected, env: rerunEvidence(1).env});
    assert.equal(receipt.attempt, 2); assert.equal(receipt.producerAttempt, 1);
    const p = await packet(expected, 1), t = transport(p);
    const result = await admitOfficialGui({expected, directory: path.join(dir, 'rerun'), fetchImpl: t.fetchImpl, runnerEvidence: rerunEvidence(1)});
    assert.ok(t.calls.some(url => url.startsWith(`${api}/runs/12/attempts/1/jobs?`)));
    assert.ok(!t.calls.some(url => url.includes('/attempts/2/')));
    const build = JSON.parse(await readFile(result.receiptPath)).build;
    assert.equal(build.attempt, 1); assert.equal(build.consumerAttempt, 2);
}));

test('rerun admission still rejects evidence from a different attempt or a different run', async () => ownedTemporary(async dir => {
    // Scalar from a later attempt than the consumer, or not a positive integer.
    for (const bad of ['3', '0', '01', '1.0', '']) assert.throws(
        () => guiRunnerProducerReceipt(rerunEvidence(bad).wire, source, {expected, env: rerunEvidence(bad).env}), String(bad));
    // Scalar from another run.
    assert.throws(() => guiRunnerProducerReceipt(rerunEvidence(1, {'github.run_id': '13'}).wire, source,
        {expected, env: rerunEvidence(1, {'github.run_id': '13'}).env}), /Producer scalar run/);
    // Official API job, or embedded manifest, from an attempt other than the scalar's.
    const cases = [
        async () => { const p = await packet(expected, 1); p.meta.job.run_attempt = 2; return p; },
        async () => { const p = await packet(expected, 1); p.meta.run.id = 13; return p; },
        async () => { const p = await packet(expected, 1); p.meta.job.run_id = 13; return p; },
        async () => { const p = await packet(expected, 1); p.meta.artifact.workflow_run.id = 13; return p; },
    ];
    for (const [i, make] of cases.entries()) {
        const p = await make(), t = transport(p);
        await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, String(i)), fetchImpl: t.fetchImpl, runnerEvidence: rerunEvidence(1)}), String(i));
        assert.ok(!t.calls.some(url => url.endsWith('/zip')), String(i));
    }
    // Manifest naming the consumer attempt while the producer job is attempt 1.
    const p = await packet(expected, 2); p.meta.job.run_attempt = 1; const t = transport(p);
    await assert.rejects(admitOfficialGui({expected, directory: path.join(dir, 'manifest'), fetchImpl: t.fetchImpl, runnerEvidence: rerunEvidence(1)}), /Manifest producer attempt/);
}));
