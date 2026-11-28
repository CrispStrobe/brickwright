/**
 * The in-job audit that a green job hid no skipped gate: each verdict can fire.
 *
 * The script is judged on saved job payloads, not the live API, because the
 * thing to prove is the judgement — a step conclusion table in, a verdict out —
 * and the API only ever shows you the run you are in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {judge, run, fetchJobs} from '../scripts/audit-job-steps.mjs';

const step = (name, conclusion) => ({name, status: 'completed', conclusion});
const AUDIT = 'Audit — every browser gate ran';
const base = [
    step('Install', 'success'), step('Build the editor', 'success'),
    step('Browser gate — circuit UX', 'success'), step('Browser gate — editor', 'success'),
    step('Browser benchmark — 8086 desktop and mobile', 'success'), step(AUDIT, null)
];

const apiEnv = {GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '42', GH_TOKEN: 'test-only',
    BW_JOB_NAME: 'browser (heavy)', GITHUB_RUN_ATTEMPT: '2'};
const apiJob = {id: 123, name: apiEnv.BW_JOB_NAME, run_id: 42, run_attempt: 2};
const jsonResponse = body => ({ok: true, json: async () => body});

test('API listing identifies the job, direct endpoint supplies its step conclusions', async () => {
    const calls = [];
    const detail = {...apiJob, steps: base};
    const jobs = await fetchJobs(async (url, options) => {
        calls.push({url, options});
        return jsonResponse(url.includes('/actions/jobs/') ? detail :
            {total_count: 1, jobs: [{...apiJob, steps: [{name: 'Install', status: 'in_progress'}]}]});
    }, {env: apiEnv, sleep: async () => assert.fail('no retry expected')});
    assert.deepEqual(jobs, [detail]);
    assert.equal(calls.length, 2);
    assert.ok(new URL(calls[1].url).pathname.endsWith('/actions/jobs/123'));
    assert.equal(calls[1].options.headers['Cache-Control'], 'no-cache');
});

test('repeated API polls bypass cached incomplete snapshots even in the same clock millisecond', async () => {
    const cache = new Map(), calls = [];
    let completed = false;
    const fetchCached = async (url, options) => {
        calls.push(url);assert.equal(options.cache, 'no-store');
        if (!cache.has(url)) cache.set(url, url.includes('/actions/jobs/') ?
            {...apiJob, steps: [{name: 'Browser gate — fixture', status: completed ? 'completed' : 'in_progress', conclusion: completed ? 'success' : null}]} :
            {total_count: 1, jobs: [apiJob]});
        return jsonResponse(cache.get(url));
    };
    const options = {env: apiEnv, now: () => 123, sleep: async () => assert.fail('no retry expected')};
    const first = await fetchJobs(fetchCached, options);completed = true;
    const second = await fetchJobs(fetchCached, options);
    assert.equal(first[0].steps[0].status, 'in_progress');
    assert.equal(second[0].steps[0].status, 'completed');
    assert.equal(new Set(calls).size, 4, 'both listing and detail receive a new cache key');
});

test('direct endpoint cannot substitute another run, attempt, matrix leg or job', async () => {
    for (const mutation of [{run_id: 43}, {run_attempt: 1}, {name: 'browser (light)'}, {id: 124}]) {
        let sleeps = 0;
        await assert.rejects(fetchJobs(async url => jsonResponse(url.includes('/actions/jobs/') ?
            {...apiJob, ...mutation, steps: base} : {total_count: 1, jobs: [apiJob]}),
        {env: apiEnv, sleep: async ms => {assert.equal(ms, 15000); sleeps++;}}), /identity does not match/);
        assert.equal(sleeps, 1);
    }
});

test('unreadable direct endpoint fails closed rather than falling back to listing steps', async () => {
    await assert.rejects(fetchJobs(async url => url.includes('/actions/jobs/') ?
        {ok: false, status: 503, text: async () => 'unavailable'} :
        jsonResponse({total_count: 1, jobs: [{...apiJob, steps: base}]}),
    {env: apiEnv, sleep: async () => {}}), /GitHub job HTTP 503/);
});

test('all browser gates ran: ok, and the count is the count', () => {
    const v = judge(base);
    assert.equal(v.verdict, 'ok');
    assert.equal(v.ran, 3);
});

test('a skipped gate in a job with no failing step is the lie, named', () => {
    const steps = base.map(s => s.name === 'Browser gate — editor' ? step(s.name, 'skipped') : s);
    const v = judge(steps);
    assert.equal(v.verdict, 'skipped-in-green');
    assert.deepEqual(v.skipped, ['Browser gate — editor']);
});

test('a skipped gate after a real failure is a note, not a second red', () => {
    const steps = base.map(s => s.name === 'Build the editor' ? step(s.name, 'failure')
        : isGate(s.name) ? step(s.name, 'skipped') : s);
    const v = judge(steps);
    assert.equal(v.verdict, 'skipped-after-red');
    assert.deepEqual(v.failedEarlier, ['Build the editor']);
    assert.equal(v.skipped.length, 3);
});

test('a timed-out gate counts as red, so the gates after it are a note', () => {
    const steps = base.map(s => s.name === 'Browser gate — circuit UX' ? step(s.name, 'timed_out')
        : s.name === 'Browser gate — editor' ? step(s.name, 'skipped') : s);
    assert.equal(judge(steps).verdict, 'skipped-after-red');
});

test('a job with no browser gates is a misplaced audit, not a pass', () => {
    assert.equal(judge([step('Install', 'success'), step(AUDIT, null)]).verdict, 'no-gates');
});

test('the audit step itself is never counted as an earlier failure', () => {
    const steps = base.map(s => s.name === AUDIT ? step(s.name, 'failure') : s);
    assert.equal(judge(steps).verdict, 'ok');
});

function isGate (name) {
    return /^Browser (?:gates?|benchmark) — /.test(name);
}

const sinks = () => { const out = {logs: [], errors: []}; return {out, log: m => out.logs.push(m), error: m => out.errors.push(m)}; };

test('an API failure is an ABSENCE — red, but the message never says a gate was skipped', async () => {
    const {out, log, error} = sinks();
    const code = await run(async () => { throw new Error('GitHub HTTP 403: rate limit (after one retry; first attempt: GitHub HTTP 403)'); },
        {jobName: 'build', attempt: 1}, {log, error});
    assert.equal(code, 1);
    assert.match(out.errors[0], /could not audit this run: GitHub HTTP 403/);
    assert.doesNotMatch(out.errors.join('\n'), /skipped with no earlier failure/, 'an absence must not read as a finding');
});

test('a finding names the gate and does not read as an absence', async () => {
    const {out, log, error} = sinks();
    const jobs = [{name: 'build', run_attempt: 1, steps: base.map(s => s.name === 'Browser gate — editor' ? step(s.name, 'skipped') : s)}];
    const code = await run(async () => jobs, {jobName: 'build', attempt: 1}, {log, error});
    assert.equal(code, 1);
    assert.match(out.errors[0], /skipped with no earlier failure/);
    assert.match(out.errors[0], /Browser gate — editor/);
    assert.doesNotMatch(out.errors[0], /could not audit/);
});

test('the job cannot be found: red as an absence, not as a finding', async () => {
    const {out, log, error} = sinks();
    const code = await run(async () => [{name: 'corpus', run_attempt: 1, steps: []}], {jobName: 'build', attempt: 1}, {log, error});
    assert.equal(code, 1);
    assert.match(out.errors[0], /could not audit this run: expected exactly one job/);
});

// ---- Under a matrix of shards (2026-09-06) ----------------------------------

import {expectedForShard} from '../scripts/audit-job-steps.mjs';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// A SYNTHETIC workflow with the same shape as build.yml's browser job. The
// real one is test/browser-gate-shards.test.mjs's business: judging it here
// too meant a gate added without a clause produced seven reds for one cause
// (main f80a4abe2, the two Pico gates), and a set-equality read for the worker.
const SYNTH_YML = [
    'jobs:', '  browser:', '    name: browser (${{ matrix.shard }})', '    strategy:', '      fail-fast: false', '      matrix:', '        shard: [heavy, light]', '    steps:',
    '      - name: Install', '      - name: Serve the built app', '        id: serve',
    '      - name: Browser gate — circuit UX', "        if: ${{ steps.serve.outcome == 'success' && matrix.shard == 'light' }}",
    '      - name: Browser gate — editor', "        if: ${{ steps.serve.outcome == 'success' && matrix.shard == 'light' }}",
    '      - name: Browser benchmark — 8086 desktop and mobile', "        if: ${{ steps.serve.outcome == 'success' && matrix.shard == 'heavy' }}",
    '      - name: Audit — every browser gate ran', '        if: always()', ''
].join('\n');
const heavyLeg = {shard: 'heavy', mine: ['Browser benchmark — 8086 desktop and mobile'], others: ['Browser gate — circuit UX', 'Browser gate — editor']};
const inHeavy = base.map(s => isGate(s.name) && !heavyLeg.mine.includes(s.name) ? step(s.name, 'skipped') : s);

test('shard: gates assigned elsewhere show skipped here and that is ok; the count is this leg\'s count', () => {
    const v = judge(inHeavy, undefined, heavyLeg);
    assert.equal(v.verdict, 'ok');
    assert.equal(v.ran, 1);
    assert.deepEqual(v.skipped, []);
});

test('shard: a gate assigned HERE that ended skipped is still the lie, named', () => {
    const steps = inHeavy.map(s => s.name === heavyLeg.mine[0] ? step(s.name, 'skipped') : s);
    const v = judge(steps, undefined, heavyLeg);
    assert.equal(v.verdict, 'skipped-in-green');
    assert.deepEqual(v.skipped, heavyLeg.mine);
});

test('shard: a gate assigned elsewhere that RAN here is a double run, failed by name', () => {
    const steps = inHeavy.map(s => s.name === 'Browser gate — editor' ? step(s.name, 'success') : s);
    const v = judge(steps, undefined, heavyLeg);
    assert.equal(v.verdict, 'ran-in-wrong-shard');
    assert.deepEqual(v.wrongShard, ['Browser gate — editor (success)']);
});

test('shard: a gate in the job that no clause assigns is failed by name, before anything else', () => {
    const steps = [...inHeavy, step('Browser gate — brand new, no clause', 'success')];
    const v = judge(steps, undefined, heavyLeg);
    assert.equal(v.verdict, 'unassigned-gate');
    assert.deepEqual(v.unassigned, ['Browser gate — brand new, no clause']);
});

test('shard: the leg is found by its DISPLAY name, and a leg named only by GITHUB_JOB is an absence, not a finding', async () => {
    const jobs = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy}, {name: 'browser (light)', run_attempt: 1, steps: base}];
    const yml = SYNTH_YML;
    let s = sinks();
    let code = await run(async () => jobs, {jobName: 'browser', attempt: 1, shard: 'heavy', workflowText: yml}, {log: s.log, error: s.error});
    assert.equal(code, 1);
    assert.match(s.out.errors[0], /could not audit this run: expected exactly one job named "browser", found 0/);
    assert.doesNotMatch(s.out.errors.join('\n'), /skipped with no earlier failure/);
});

test('shard: the audit refuses a workflow whose clauses are not a partition, as a workflow defect, before judging any step', async () => {
    const yml = SYNTH_YML;
    const broken = yml.replace(" && matrix.shard == 'light' }}", ' }}'); // circuit UX loses its clause
    assert.notEqual(broken, yml, 'mutation anchor');
    const s = sinks();
    const code = await run(async () => { throw new Error('must not be reached'); }, {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: broken}, {log: s.log, error: s.error});
    assert.equal(code, 1);
    assert.match(s.out.errors[0], /not a partition of the gates/);
    assert.match(s.out.errors[0], /no shard clause.*Browser gate — circuit UX/);
    const e = expectedForShard(yml, 'heavy');
    assert.ok(e.ok && e.mine.length === 1 && e.others.length === 2, `the synthetic workflow partitions: heavy ${e.mine.length}, others ${e.others.length}`);
});

test('shard: a gate elsewhere the API has not reported yet (null conclusion) is not a double run', () => {
    const steps = inHeavy.map(s => s.name === 'Browser gate — editor' ? {name: s.name, status: 'queued', conclusion: null} : s);
    assert.equal(judge(steps, undefined, heavyLeg).verdict, 'ok', 'run 34015453480: three light gates read null in the heavy leg and were called a double run');
});

test('the audit re-reads while a step before it is unreported, then judges the settled read', async () => {
    const settled = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy}];
    const lagging = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy.map(s => s.name === 'Browser gate — circuit UX' ? {name: s.name, status: 'in_progress', conclusion: null} : s)}];
    const yml = SYNTH_YML;
    let reads = 0;
    const slept = [];
    const s = sinks();
    const code = await run(async () => (++reads <= 2 ? lagging : settled), {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: yml},
        {log: s.log, error: s.error, sleep: async ms => { slept.push(ms); }});
    assert.equal(code, 0, s.out.errors.join('\n'));
    assert.equal(reads, 3, 'two lagging reads, then the settled one');
    assert.deepEqual(slept, [10000, 10000]);
    assert.match(s.out.logs.join('\n'), /not yet reported complete/);
});

test('a step still unreported after the retries is an ABSENCE — red, never a finding', async () => {
    const lagging = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy.map(s => s.name === 'Browser gate — circuit UX' ? {name: s.name, status: 'in_progress', conclusion: null} : s)}];
    const yml = SYNTH_YML;
    const s = sinks();
    const code = await run(async () => lagging, {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: yml}, {log: s.log, error: s.error, sleep: async () => {}});
    assert.equal(code, 1);
    assert.match(s.out.errors[0], /could not audit this run: 1 step\(s\) still not reported complete/);
    assert.doesNotMatch(s.out.errors.join('\n'), /double run|skipped with no earlier failure/);
});

test('the re-read waits only on steps BEFORE the audit: the post-job steps the API lists after it are always queued while it runs', async () => {
    const withPost = [{name: 'browser (heavy)', run_attempt: 1, steps: [...inHeavy,
        {name: 'Post Run actions/setup-node@x', status: 'queued', conclusion: null},
        {name: 'Complete job', status: 'queued', conclusion: null}]}];
    const yml = SYNTH_YML;
    const slept = [];
    const s = sinks();
    const code = await run(async () => withPost, {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: yml}, {log: s.log, error: s.error, sleep: async ms => { slept.push(ms); }});
    assert.equal(code, 0, s.out.errors.join('\n'));
    assert.deepEqual(slept, [], 'queued post-job steps must not trigger a single re-read');
});

test('a null step assigned ELSEWHERE triggers the re-read too (the loop is not narrowed to this leg)', async () => {
    const yml = SYNTH_YML;
    const lagging = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy.map(s => s.name === 'Browser gate — editor' ? {name: s.name, status: 'queued', conclusion: null} : s)}];
    const settled = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy}];
    let reads = 0;
    const s = sinks();
    const code = await run(async () => (++reads === 1 ? lagging : settled), {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: yml}, {log: s.log, error: s.error, sleep: async () => {}});
    assert.equal(code, 0);
    assert.equal(reads, 2);
});


test('missing API step array is retried until the complete shard records arrive', async () => {
    let reads = 0, waits = 0;
    const {log, error} = sinks();
    const code = await run(async () => [{name: 'browser (heavy)', run_attempt: 1,
        steps: ++reads === 1 ? [] : inHeavy}],
    {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: SYNTH_YML},
    {log, error, sleep: async ms => {assert.equal(ms, 10000); waits++;}});
    assert.equal(code, 0); assert.equal(reads, 2); assert.equal(waits, 1);
});

test('a permanently missing own or other-shard record cannot produce a partial green', async () => {
    for (const missing of ['Browser benchmark — 8086 desktop and mobile', 'Browser gate — editor', AUDIT]) {
        let waits = 0;
        const {out, log, error} = sinks();
        const code = await run(async () => [{name: 'browser (heavy)', run_attempt: 1,
            steps: inHeavy.filter(s => s.name !== missing)}],
        {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: SYNTH_YML},
        {log, error, sleep: async () => {waits++;}});
        assert.equal(code, 1); assert.equal(waits, 6);
        assert.match(out.errors.join('\n'), /unaudited/);
        assert.ok(out.errors.join('\n').includes(missing));
    }
});

test('duplicate gate records remain unauditable even if both claim success', async () => {
    const {out, log, error} = sinks();
    const code = await run(async () => [{name: 'browser (heavy)', run_attempt: 1,
        steps: [...inHeavy, step('Browser benchmark — 8086 desktop and mobile', 'success')]}],
    {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: SYNTH_YML},
    {log, error, sleep: async () => {}});
    assert.equal(code, 1); assert.match(out.errors.join('\n'), /2 records/);
});

// Distinct runner-scalar mode: all input rows come from the actual workflow
// expressions. Only runner context and network/Git fixture boundaries are fake.
import {runnerSourceMap, runnerTerminalReceipt, runnerTerminalCLI, runnerScalarExpressionBounds, RUNNER_WIRE_ENV, RUNNER_INPUT_CAP, RUNNER_RECEIPT_CAP} from '../scripts/audit-job-steps.mjs';
import {shardsOf} from '../scripts/lib/workflow-gates.mjs';
import * as runnerFs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const RUNNER_ROOT = path.resolve(import.meta.dirname, '..');
const RUNNER_WORKFLOW = readFileSync(path.join(RUNNER_ROOT, '.github/workflows/build.yml'), 'utf8');
const RUNNER_SCRIPT = path.join(RUNNER_ROOT, 'scripts/audit-job-steps.mjs');
const runnerHash = (raw, kind = 'sha256') => createHash(kind).update(raw).digest('hex');
const runnerBlob = text => runnerHash(Buffer.concat([Buffer.from('blob '+Buffer.byteLength(text)+'\0'), Buffer.from(text)]), 'sha1');
const runnerEnvironment = (shard, head = 'a'.repeat(40), workspace = RUNNER_ROOT) => ({
    GITHUB_REPOSITORY: 'CrispStrobe/brickwright', GITHUB_REPOSITORY_ID: '1291854269',
    GITHUB_RUN_ID: '40113882924', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_JOB: 'browser', BW_JOB_NAME: 'browser ('+shard+')', GITHUB_SHA: head,
    GITHUB_WORKFLOW_SHA: 'b'.repeat(40), GITHUB_WORKFLOW_REF: 'CrispStrobe/brickwright/.github/workflows/build.yml@refs/pull/900/merge',
    GITHUB_WORKSPACE: workspace, GH_TOKEN: 'authored-private-token-fixture',
    UNRELATED_STEP_OUTPUT: 'authored-private-output-fixture'
});
const runnerSource = (text, env) => ({text, checkoutHead: env.GITHUB_SHA, gitBlob: runnerBlob(text), sha256: runnerHash(text)});
const runnerContext = (text, shard) => Object.fromEntries(runnerSourceMap(text).steps.map(step => {
    const assigned = shardsOf(step), state = assigned.length && !assigned.includes(shard) ? 'skipped' : 'success';
    return [step.id, {outcome: state, conclusion: state}];
}));
const runnerDeclaredLines = text => {
    const block = text.slice(text.indexOf('      - name: '+AUDIT));
    const rows = block.split('\n');
    const result = [];
    for (let at = 0; at < rows.length; at++) {
        if (!new RegExp('^          '+RUNNER_WIRE_ENV+'(?:_[2-6])?: \\|$').test(rows[at])) continue;
        for (let i = at + 1; rows[i]?.startsWith('            '); i++) result.push(rows[i].slice(12));
    }
    assert.ok(result.length > 0);return result;
};
const renderRunnerContext = (text, context, env, shard) => {
    const github = {repository: env.GITHUB_REPOSITORY, run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT,
        job: env.GITHUB_JOB, sha: env.GITHUB_SHA, workflow_sha: env.GITHUB_WORKFLOW_SHA, workflow_ref: env.GITHUB_WORKFLOW_REF};
    return runnerDeclaredLines(text).map(line => line.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (whole, expression) => {
        const property = expression.trim();
        if (property === 'matrix.shard') return shard;
        if (/^github\.[a-z_]+$/.test(property)) { assert.ok(Object.hasOwn(github, property.slice(7))); return github[property.slice(7)]; }
        const m = /^steps\['([A-Za-z_][A-Za-z0-9_-]*)'\]\.(outcome|conclusion)$/.exec(property);
        assert.ok(m, 'only explicit scalar terminal references are rendered');
        return context[m[1]]?.[m[2]] ?? '';
    })).join('\n')+'\n';
};
let runnerFixture;
const getRunnerFixture = () => {
    if (runnerFixture) return runnerFixture;
    const directory = runnerFs.mkdtempSync(path.join(RUNNER_ROOT, '.runner-audit-controls-'));
    runnerFs.mkdirSync(path.join(directory, '.github/workflows'), {recursive: true});
    runnerFs.mkdirSync(path.join(directory, 'scripts/lib'), {recursive: true});
    runnerFs.writeFileSync(path.join(directory, '.github/workflows/build.yml'), RUNNER_WORKFLOW);
    runnerFs.copyFileSync(path.join(RUNNER_ROOT, 'scripts/lib/workflow-gates.mjs'), path.join(directory, 'scripts/lib/workflow-gates.mjs'));
    const git = args => execFileSync('/usr/bin/git', ['-C', directory, ...args], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000,
        env: {...process.env, GIT_AUTHOR_NAME: 'Authored source control', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
            GIT_COMMITTER_NAME: 'Authored source control', GIT_COMMITTER_EMAIL: 'fixture@example.invalid'}});
    git(['init', '-q']);git(['add', '.github/workflows/build.yml']);git(['commit', '-q', '-m', 'Authored workflow fixture']);
    runnerFixture = {directory, git, head: git(['rev-parse', 'HEAD']).toString().trim()};
    return runnerFixture;
};
test.after(() => { if (runnerFixture) runnerFs.rmSync(runnerFixture.directory, {recursive: true, force: true}); });
const runnerCLI = (shard, wire, envChanges = {}, args = []) => {
    const fixture = getRunnerFixture(), parts = {}, rows = wire.match(/[^\n]*\n/g) || [];
    let offset = 0;
    for (const scalar of runnerSourceMap(RUNNER_WORKFLOW).scalars) {
        parts[scalar.key] = rows.slice(offset, offset + scalar.lines.length).join('');offset += scalar.lines.length;
    }
    const env = {...process.env, ...runnerEnvironment(shard, fixture.head, fixture.directory), ...parts, ...envChanges};
    // A regression into the API route must never make a real API call here.
    return spawnSync(process.execPath, ['--import', 'data:text/javascript,globalThis.fetch=async()=>{throw new Error("forbidden network fixture")}', RUNNER_SCRIPT,
        '--shard', shard, '--workflow', path.join(fixture.directory, '.github/workflows/build.yml'), '--runner-terminals-v1', ...args],
    {cwd: fixture.directory, env, encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024});
};
const receiptFrom = result => {
    assert.equal(result.error, undefined, result.error?.message);
    const lines = result.stdout.trimEnd().split('\n');assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith('browser-runner-evidence-v1 '));
    return JSON.parse(lines[0].slice('browser-runner-evidence-v1 '.length));
};

test('runner: every current shard traverses actual workflow expressions, checked Git and genuine CLI', () => {
    const fixture = getRunnerFixture(), mapping = runnerSourceMap(RUNNER_WORKFLOW);
    assert.ok(mapping.steps.length > 200);assert.ok(mapping.steps.some(s => s.name === ''));
    for (const shard of mapping.job.shards) {
        const env = runnerEnvironment(shard, fixture.head, fixture.directory), context = runnerContext(RUNNER_WORKFLOW, shard);
        const wire = renderRunnerContext(RUNNER_WORKFLOW, context, env, shard), result = runnerCLI(shard, wire);
        assert.equal(result.status, 0, result.stderr);assert.equal(result.stderr, '');
        const receipt = receiptFrom(result), expected = expectedForShard(RUNNER_WORKFLOW, shard);
        assert.equal(receipt.schema, 'bw.browser.runner-terminals.v1');assert.equal(receipt.evidenceMode, 'runner-scalars');
        assert.equal(receipt.complete, true);assert.equal(receipt.allAssignedGatesSucceeded, true);
        assert.equal(receipt.verdict.verdict, 'ok');assert.equal(receipt.verdict.ran, expected.mine.length);
        assert.deepEqual(receipt.steps.map(s => [s.id, s.name]), mapping.steps.map(s => [s.id, s.name]));
        assert.equal(receipt.identity.checkoutHead, fixture.head);assert.equal(receipt.source.gitBlob, runnerBlob(RUNNER_WORKFLOW));
        assert.equal(receipt.source.sha256, runnerHash(RUNNER_WORKFLOW));
        assert.notEqual(receipt.identity.executingWorkflowSha, receipt.identity.checkoutHead, 'executing W is recorded separately');
        assert.ok(Buffer.byteLength(wire) < RUNNER_INPUT_CAP && Buffer.byteLength(result.stdout) <= RUNNER_RECEIPT_CAP);
        assert.doesNotMatch(result.stdout, /authored-private|outputs|GH_TOKEN|GITHUB_WORKSPACE/);
    }
});

test('runner: live repository rename binds the stable ID and the matching workflow through the real CLI', () => {
    const fixture = getRunnerFixture(), shard = 'lightcad1';
    const base = runnerEnvironment(shard, fixture.head, fixture.directory);
    const context = runnerContext(RUNNER_WORKFLOW, shard);
    const workflowRef = repository => repository+'/.github/workflows/build.yml@refs/pull/900/merge';
    for (const repository of ['CrispStrobe/brickwright', 'CrispStrobe/brickwright-lite']) {
        const env = {...base, GITHUB_REPOSITORY: repository, GITHUB_WORKFLOW_REF: workflowRef(repository)};
        const result = runnerCLI(shard, renderRunnerContext(RUNNER_WORKFLOW, context, env, shard), env);
        assert.equal(result.status, 0, repository+': '+result.stderr);
        const receipt = receiptFrom(result);
        assert.equal(receipt.complete, true);
        assert.equal(receipt.allAssignedGatesSucceeded, true);
        assert.equal(receipt.identity.repository, repository);
        assert.equal(receipt.identity.workflowRef, workflowRef(repository));
    }
    const repositoryRefusal = 'current runner repository/job/shard identity';
    const workflowRefusal = 'current checked source/workflow identity';
    for (const [label, changes, reason] of [
        ['missing repository ID', {GITHUB_REPOSITORY_ID: undefined}, repositoryRefusal],
        ['legacy application ID', {GITHUB_REPOSITORY_ID: '881088189'}, repositoryRefusal],
        ['foreign owner', {GITHUB_REPOSITORY: 'other/brickwright', GITHUB_WORKFLOW_REF: workflowRef('other/brickwright')}, repositoryRefusal],
        ['legacy application name', {GITHUB_REPOSITORY: 'CrispStrobe/brickwright-legacy', GITHUB_WORKFLOW_REF: workflowRef('CrispStrobe/brickwright-legacy')}, repositoryRefusal],
        ['current name with historical workflow', {GITHUB_WORKFLOW_REF: workflowRef('CrispStrobe/brickwright-lite')}, workflowRefusal],
        ['historical name with current workflow', {GITHUB_REPOSITORY: 'CrispStrobe/brickwright-lite'}, workflowRefusal]
    ]) {
        const env = {...base, ...changes};
        // Render a self-consistent hostile header: the authority guard, not a
        // stale wire/header mismatch, must refuse each invalid identity.
        const result = runnerCLI(shard, renderRunnerContext(RUNNER_WORKFLOW, context, env, shard), env);
        assert.equal(result.status, 1, label);
        const refusal = receiptFrom({...result, stdout: result.stderr});
        assert.equal(refusal.complete, false, label);
        assert.equal(refusal.firstFailure.reason, reason, label);
    }
});

test('runner: real CLI preserves skipped-in-green, wrong-shard and real earlier-red behavior', () => {
    const fixture = getRunnerFixture(), mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0];
    const expected = expectedForShard(RUNNER_WORKFLOW, shard), env = runnerEnvironment(shard, fixture.head, fixture.directory);
    const own = mapping.steps.find(s => s.name === expected.mine[0]).id, other = mapping.steps.find(s => s.name === expected.others[0]).id;
    for (const cut of ['own-skip', 'other-run', 'earlier-red', 'gate-failed']) {
        const context = runnerContext(RUNNER_WORKFLOW, shard);
        if (cut === 'own-skip') context[own] = {outcome: 'skipped', conclusion: 'skipped'};
        if (cut === 'other-run') context[other] = {outcome: 'success', conclusion: 'success'};
        if (cut === 'earlier-red') {
            context[mapping.steps[0].id] = {outcome: 'failure', conclusion: 'failure'};
            for (const name of expected.mine) context[mapping.steps.find(s => s.name === name).id] = {outcome: 'skipped', conclusion: 'skipped'};
        }
        if (cut === 'gate-failed') context[own] = {outcome: 'failure', conclusion: 'failure'};
        const result = runnerCLI(shard, renderRunnerContext(RUNNER_WORKFLOW, context, env, shard)), receipt = receiptFrom(result);
        assert.equal(result.status, ['own-skip', 'other-run'].includes(cut) ? 1 : 0, result.stderr);
        assert.equal(receipt.verdict.verdict, { 'own-skip': 'skipped-in-green', 'other-run': 'ran-in-wrong-shard', 'earlier-red': 'skipped-after-red', 'gate-failed': 'ok'}[cut]);
        assert.equal(receipt.allAssignedGatesSucceeded, false);
        if (cut === 'gate-failed') assert.ok(receipt.verdict.failedEarlier.includes(expected.mine[0]));
    }
});

test('runner: documented continued failure differs from malformed contradiction, neither is positive', () => {
    const mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0], env = runnerEnvironment(shard);
    const own = mapping.steps.find(s => s.name === expectedForShard(RUNNER_WORKFLOW, shard).mine[0]);
    assert.doesNotMatch(RUNNER_WORKFLOW.slice(RUNNER_WORKFLOW.indexOf('\n  browser:\n'), RUNNER_WORKFLOW.indexOf('\n  corpus:\n')), /^        continue-on-error:/m);
    for (const selected of [mapping.steps[0], own]) {
        const context = runnerContext(RUNNER_WORKFLOW, shard);context[selected.id] = {outcome: 'failure', conclusion: 'success'};
        const wire = renderRunnerContext(RUNNER_WORKFLOW, context, env, shard);
        assert.throws(() => runnerTerminalReceipt(wire, runnerSource(RUNNER_WORKFLOW, env), {env, shard}), /valid continued failure is outside/);
    }
    const context = runnerContext(RUNNER_WORKFLOW, shard);context[own.id] = {outcome: 'success', conclusion: 'failure'};
    assert.throws(() => runnerTerminalReceipt(renderRunnerContext(RUNNER_WORKFLOW, context, env, shard), runnerSource(RUNNER_WORKFLOW, env), {env, shard}), /contradiction/);
    const changed = RUNNER_WORKFLOW.replace('        id: '+mapping.steps[0].id, '        id: '+mapping.steps[0].id+'\n        continue-on-error: true');
    assert.throws(() => runnerSourceMap(changed), /source without continue-on-error/, 'a future declared non-gate continuation needs reviewed profile support');
});

test('runner: missing empty extra duplicate reordered and malformed state rows refuse coherently', () => {
    const mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0], env = runnerEnvironment(shard);
    const good = renderRunnerContext(RUNNER_WORKFLOW, runnerContext(RUNNER_WORKFLOW, shard), env, shard), lines = good.trimEnd().split('\n');
    const cuts = [lines.slice(0, -1).join('\n')+'\n', good+lines[1]+'\n', good.replace(lines[2], lines[1]),
        [lines[0], lines[2], lines[1], ...lines.slice(3)].join('\n')+'\n', good.replace(lines[1], lines[1].split('\t')[0]+'\t\tsuccess'),
        good.replace(lines[1], lines[1].split('\t')[0]+'\tcompleted\tsuccess'),good.replace(lines[1], lines[1]+'\textra'),
        good.replace(lines[1], 'foreign_step\tsuccess\tsuccess'),good.slice(0, -1),good.replaceAll('\n', '\r\n'),'x'.repeat(RUNNER_INPUT_CAP + 1)];
    for (const wire of cuts) assert.throws(() => runnerTerminalReceipt(wire, runnerSource(RUNNER_WORKFLOW, env), {env, shard}));
    const context = runnerContext(RUNNER_WORKFLOW, shard);delete context[mapping.steps[0].id];
    assert.throws(() => runnerTerminalReceipt(renderRunnerContext(RUNNER_WORKFLOW, context, env, shard), runnerSource(RUNNER_WORKFLOW, env), {env, shard}));
});

test('runner: run source attempt job shard and Git byte drift refuse through the real CLI', () => {
    const fixture = getRunnerFixture(), mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0], env = runnerEnvironment(shard, fixture.head, fixture.directory);
    const good = renderRunnerContext(RUNNER_WORKFLOW, runnerContext(RUNNER_WORKFLOW, shard), env, shard);
    for (const changes of [{GITHUB_RUN_ID: '999'}, {GITHUB_RUN_ATTEMPT: '2'}, {GITHUB_JOB: 'unit'}, {BW_JOB_NAME: 'browser (foreign)'},
        {GITHUB_SHA: 'c'.repeat(40)}, {GITHUB_WORKFLOW_SHA: 'c'.repeat(40)}, {GITHUB_WORKFLOW_REF: 'foreign/workflow@refs/heads/main'}, {GITHUB_REPOSITORY: 'other/repo'}]) {
        const result = runnerCLI(shard, good, changes);assert.equal(result.status, 1);assert.doesNotMatch(result.stderr, /authored-private|outputs|token-fixture/);
        assert.ok(result.stderr.includes('"complete":false'));
    }
    const file = path.join(fixture.directory, '.github/workflows/build.yml');
    try { runnerFs.appendFileSync(file, '\n# uncommitted source drift\n');assert.equal(runnerCLI(shard, good).status, 1); }
    finally { runnerFs.writeFileSync(file, RUNNER_WORKFLOW); }
    for (const args of [['--runner-terminals-v1'], ['--file', 'none'], ['--shard', shard]]) assert.equal(runnerCLI(shard, good, {}, args).status, 1);
});

let runnerMutantNumber = 0;
const runnerMutant = async (old, replacement) => {
    const text = readFileSync(RUNNER_SCRIPT, 'utf8');assert.equal(text.split(old).length, 2, 'one actual guard mutation');
    const fixture = getRunnerFixture(), target = path.join(fixture.directory, 'scripts/audit-mutant-'+(++runnerMutantNumber)+'.mjs');
    runnerFs.writeFileSync(target, text.replace(old, replacement));
    return import(pathToFileURL(target).href);
};
test('runner: actual mapping and extra-row guard deletion mutants accept the same hostile inputs', async () => {
    const mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0], env = runnerEnvironment(shard);
    const first = mapping.steps[0].id, second = mapping.steps[1].id;
    const changed = RUNNER_WORKFLOW.replace("steps['"+first+"'].outcome", "steps['"+second+"'].outcome");
    const wire = renderRunnerContext(changed, runnerContext(RUNNER_WORKFLOW, shard), env, shard);
    assert.throws(() => runnerTerminalReceipt(wire, runnerSource(changed, env), {env, shard}), /exact scalar/);
    const mutant = await runnerMutant('declared.every((row, index) => row === scalar.lines[index])', 'true');
    assert.equal(mutant.runnerTerminalReceipt(wire, runnerSource(changed, env), {env, shard}).allAssignedGatesSucceeded, true);
    const good = renderRunnerContext(RUNNER_WORKFLOW, runnerContext(RUNNER_WORKFLOW, shard), env, shard), extra = good+first+'\tsuccess\tsuccess\n';
    assert.throws(() => runnerTerminalReceipt(extra, runnerSource(RUNNER_WORKFLOW, env), {env, shard}), /row count/);
    const countMutant = await runnerMutant('lines.length === mapping.steps.length + 1', 'lines.length >= mapping.steps.length + 1');
    assert.equal(countMutant.runnerTerminalReceipt(extra, runnerSource(RUNNER_WORKFLOW, env), {env, shard}).allAssignedGatesSucceeded, true);
});

test('runner: the legacy six-poll absence guard remains a nonvacuous independent boundary', async () => {
    const partial = [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy.map(s => s.name === 'Browser gate — editor' ? {name: s.name, status: 'pending', conclusion: null} : s)}];
    const where = {jobName: 'browser (heavy)', attempt: 1, shard: 'heavy', workflowText: SYNTH_YML};
    const quiet = {log() {}, error() {}, sleep: async () => {}};
    assert.equal(await run(async () => partial, where, quiet), 1);
    const mutant = await runnerMutant('if (mine.length === 1 && unreported(mine[0]).length) {', 'if (false) {');
    assert.equal(await mutant.run(async () => partial, where, quiet), 0, 'same partial evidence turns green if the old refusal is removed');
});

test('runner: explicit scalar parts respect compiled GitHub format limits and refuse partial delivery', () => {
    const mapping = runnerSourceMap(RUNNER_WORKFLOW), fixture = getRunnerFixture(), shard = mapping.job.shards[0];
    assert.equal(mapping.scalars.length, Math.ceil(mapping.steps.length / 100),
        'every source step travels in a bounded 100-row scalar part');
    for (const part of mapping.scalars) {
        const bounds = runnerScalarExpressionBounds(part.lines.join('\n')+'\n');
        assert.ok(bounds.parameters <= 255 && bounds.characters <= 21000, JSON.stringify(bounds));
    }
    const single = runnerScalarExpressionBounds(mapping.scalars.flatMap(p => p.lines).join('\n')+'\n');
    assert.ok(single.parameters > 255 && single.characters > 21000, 'one field over all current rows would exceed platform expression limits');
    const env = runnerEnvironment(shard, fixture.head, fixture.directory), wire = renderRunnerContext(RUNNER_WORKFLOW, runnerContext(RUNNER_WORKFLOW, shard), env, shard);
    const incomplete = mapping.scalars.flatMap(({key}) => [undefined, '', 'not-terminal'].map(value => ({[key]: value})));
    const extraPart = RUNNER_WIRE_ENV+'_'+(mapping.scalars.length + 1);
    for (const changes of [...incomplete,
        {[extraPart]: 'extra\n'}, {[RUNNER_WIRE_ENV+'_2']: 'x'.repeat(RUNNER_INPUT_CAP + 1)}]) {
        const result = runnerCLI(shard, wire, changes);assert.equal(result.status, 1);
        assert.ok(result.stderr.includes('"complete":false'));assert.doesNotMatch(result.stderr, /authored-private/);
    }
});

const sizedRunnerWorkflow = count => {
    const entries = Array.from({length: count}, (_, index) => ({id: 'bounded_'+String(index).padStart(4, '0'),
        name: index < count - 3 ? ('Authored setup '+index+' ').padEnd(500, 'x') : index === count - 3 ? 'Serve the built app' :
            'Browser gate — '+(index === count - 2 ? 'heavy' : 'light'),
        shard: index === count - 2 ? 'heavy' : index === count - 1 ? 'light' : null}));
    const lines = ['jobs:', '  browser:', '    name: browser (${{ matrix.shard }})', '    timeout-minutes: 30', '    strategy:', '      matrix:', '        shard: [heavy, light]', '    steps:'];
    for (const row of entries) {
        lines.push('      - name: '+row.name, '        id: '+row.id);
        if (row.shard) lines.push("        if: ${{ matrix.shard == '"+row.shard+"' }}");
        lines.push('        run: echo authored fixture only');
    }
    lines.push('      - name: '+AUDIT, '        if: always()', '        env:', '          GH_TOKEN: ${{ github.token }}', '          BW_JOB_NAME: browser (${{ matrix.shard }})');
    for (let offset = 0; offset < entries.length; offset += 100) {
        const n = offset / 100 + 1;
        lines.push('          '+RUNNER_WIRE_ENV+(n === 1 ? '' : '_'+n)+': |');
        if (n === 1) lines.push('            '+runnerDeclaredLines(RUNNER_WORKFLOW)[0]);
        for (const row of entries.slice(offset, offset + 100)) lines.push('            '+row.id+"\t${{ steps['"+row.id+"'].outcome }}\t${{ steps['"+row.id+"'].conclusion }}");
    }
    lines.push('        run: node scripts/audit-job-steps.mjs --shard ${{ matrix.shard }} --runner-terminals-v1', '');
    return lines.join('\n');
};

test('runner: complete source, row and receipt bounds refuse without truncation; cap mutant is detected', async () => {
    const sourceText = sizedRunnerWorkflow(512), env = runnerEnvironment('heavy');
    assert.equal(runnerSourceMap(sourceText).steps.length, 512);
    const wire = renderRunnerContext(sourceText, runnerContext(sourceText, 'heavy'), env, 'heavy');
    assert.ok(Buffer.byteLength(wire) < RUNNER_INPUT_CAP);
    assert.throws(() => runnerTerminalReceipt(wire, runnerSource(sourceText, env), {env, shard: 'heavy'}), /complete sanitized receipt byte cap/);
    const mutant = await runnerMutant('runnerNeed(Buffer.byteLength(RUNNER_PREFIX + JSON.stringify(receipt) + \'\\n\') <= RUNNER_RECEIPT_CAP, \'complete sanitized receipt byte cap\');', '');
    const oversized = mutant.runnerTerminalReceipt(wire, runnerSource(sourceText, env), {env, shard: 'heavy'});
    assert.ok(Buffer.byteLength(JSON.stringify(oversized)) > RUNNER_RECEIPT_CAP && oversized.steps.length === 512);
    assert.throws(() => runnerSourceMap(sizedRunnerWorkflow(513)), /bounded complete preceding source steps/);
    assert.throws(() => runnerSourceMap(RUNNER_WORKFLOW+'#'.repeat(1024 * 1024)), /bounded checked workflow/);
    const mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0], currentEnv = runnerEnvironment(shard), good = renderRunnerContext(RUNNER_WORKFLOW, runnerContext(RUNNER_WORKFLOW, shard), currentEnv, shard);
    assert.equal(runnerTerminalReceipt(good, runnerSource(RUNNER_WORKFLOW, currentEnv), {env: currentEnv, shard}).allAssignedGatesSucceeded, true);
    for (const change of [{sha256: '0'.repeat(64)}, {gitBlob: '0'.repeat(40)}, {checkoutHead: '0'.repeat(40)}]) {
        assert.throws(() => runnerTerminalReceipt(good, {...runnerSource(RUNNER_WORKFLOW, currentEnv), ...change}, {env: currentEnv, shard}));
    }
});

test('runner: Git-bound workflow rejects symlink, hardlink and workspace substitution', () => {
    const fixture = getRunnerFixture(), mapping = runnerSourceMap(RUNNER_WORKFLOW), shard = mapping.job.shards[0], env = runnerEnvironment(shard, fixture.head, fixture.directory);
    const wire = renderRunnerContext(RUNNER_WORKFLOW, runnerContext(RUNNER_WORKFLOW, shard), env, shard);
    const file = path.join(fixture.directory, '.github/workflows/build.yml'), other = path.join(fixture.directory, 'authored-alias');
    try { runnerFs.linkSync(file, other);assert.equal(runnerCLI(shard, wire).status, 1); }
    finally { runnerFs.unlinkSync(other); }
    try { runnerFs.renameSync(file, other);runnerFs.symlinkSync(other, file);assert.equal(runnerCLI(shard, wire).status, 1); }
    finally { runnerFs.unlinkSync(file);runnerFs.renameSync(other, file); }
    assert.equal(runnerCLI(shard, wire, {GITHUB_WORKSPACE: path.join(fixture.directory, 'other')}).status, 1);
    assert.equal(runnerCLI(shard, wire).status, 0);
});

test('runner: legacy file CLI remains independently selectable without runner input', () => {
    const fixture = getRunnerFixture(), file = path.join(fixture.directory, 'legacy-jobs.json'), workflow = path.join(fixture.directory, 'legacy-workflow.yml');
    runnerFs.writeFileSync(file, JSON.stringify({jobs: [{name: 'browser (heavy)', run_attempt: 1, steps: inHeavy}]}));
    runnerFs.writeFileSync(workflow, SYNTH_YML);
    const env = {...process.env, BW_JOB_NAME: 'browser (heavy)', GITHUB_RUN_ATTEMPT: '1'};
    delete env[RUNNER_WIRE_ENV];
    const result = spawnSync(process.execPath, ['--import', 'data:text/javascript,globalThis.fetch=async()=>{throw new Error("forbidden network fixture")}',
        RUNNER_SCRIPT, '--file', file, '--shard', 'heavy', '--workflow', workflow], {cwd: fixture.directory, env, encoding: 'utf8', timeout: 5000, maxBuffer: 65536});
    assert.equal(result.status, 0, result.stderr);assert.match(result.stdout, /audit-job-steps: every browser gate ran/);
});

test('runner: source duplicate gate/shard and unassigned gate cannot become a scalar green', () => {
    const mapping = runnerSourceMap(RUNNER_WORKFLOW), gates = mapping.steps.filter(s => isGate(s.name)), shard = mapping.job.shards[0], env = runnerEnvironment(shard);
    const duplicate = RUNNER_WORKFLOW.replace('      - name: '+gates[1].name+'\n', '      - name: '+gates[0].name+'\n');
    assert.throws(() => runnerSourceMap(duplicate), /one source browser gate record/);
    const browserAt = RUNNER_WORKFLOW.indexOf('\n  browser:\n');
    const repeatedShard = RUNNER_WORKFLOW.slice(0, browserAt)+RUNNER_WORKFLOW.slice(browserAt).replace('        shard: [', '        shard: ['+shard+', ');
    assert.throws(() => runnerSourceMap(repeatedShard), /distinct current source shards/);
    const rows = RUNNER_WORKFLOW.split('\n'), at = gates[0].line - 1;
    const end = rows.findIndex((line, index) => index > at && line.startsWith('      - '));
    const condition = rows.slice(at, end).findIndex(line => line.startsWith('        if:'));
    assert.ok(condition >= 0);rows.splice(at + condition, 1);
    const unassigned = rows.join('\n'), context = runnerContext(unassigned, shard);
    assert.throws(() => runnerTerminalReceipt(renderRunnerContext(unassigned, context, env, shard), runnerSource(unassigned, env), {env, shard}), /source shard partition/);
});

test('only the full direct module entry executes CLI; same-basename file and data imports stay inert', () => {
    const directory = runnerFs.mkdtempSync(path.join(RUNNER_ROOT, '.runner-main-identity-'));
    try {
        const wrapper = path.join(directory, 'audit-job-steps.mjs');
        const source = readFileSync(RUNNER_SCRIPT, 'utf8').replace("'./lib/workflow-gates.mjs'",
            JSON.stringify(pathToFileURL(path.join(RUNNER_ROOT, 'scripts/lib/workflow-gates.mjs')).href));
        const imported = [pathToFileURL(RUNNER_SCRIPT).href, 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')];
        const args = ['--import', 'data:text/javascript,globalThis.fetch=async()=>{throw Error("network must stay unreachable")}',
            wrapper, '--runner-terminals-v1', '--shard', 'light'];
        for (const url of imported) {
            runnerFs.writeFileSync(wrapper, `import {judge} from ${JSON.stringify(url)};\nif(typeof judge!=='function')throw Error('missing pure export');\nconsole.log('imported-without-cli');\n`);
            const result = spawnSync(process.execPath, args, {cwd: RUNNER_ROOT, env: {}, encoding: 'utf8', timeout: 5000, maxBuffer: 65536});
            assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'imported-without-cli\n');
            assert.equal(result.stderr, '', 'an imported same-basename module must not emit CLI evidence');
        }
        const direct = spawnSync(process.execPath, [RUNNER_SCRIPT, '--runner-terminals-v1', '--shard', 'light'],
            {cwd: RUNNER_ROOT, env: {}, encoding: 'utf8', timeout: 5000, maxBuffer: 65536});
        assert.equal(direct.status, 1, 'the actual entry must execute and refuse absent runner context');
        assert.match(direct.stderr, /browser-runner-evidence-v1 .*RunnerEvidenceRefusal/);
    } finally {runnerFs.rmSync(directory, {recursive: true, force: true});}
});
