#!/usr/bin/env node
/**
 * A GREEN JOB MUST NOT HIDE A SKIPPED GATE.
 *
 * 2026-09-05, twice: a job reported success while a browser gate inside it had
 * been `skipped` — once because an `if:` named a status function and silenced
 * the seventeen steps after it (build.yml's own comments record run 62385f4c5),
 * once because a merge moved steps into a job whose conditions no longer held.
 * Every one of those greens was read, by people, as "the gate passed". The
 * reviewer's remedy has been a per-step audit by hand: open the run, count the
 * browser steps, check none says skipped. This step does that audit inside the
 * job, so the job cannot be green with a skipped gate in it.
 *
 * Runs as the LAST step of the job that holds the browser gates, `if: always()`.
 * It asks the Actions API for this run's jobs, finds its own job, and:
 *
 *   - if any `Browser gate…` / `Browser benchmark…` step ended `skipped` while
 *     NO earlier step failed, fails, naming the skipped steps — that is the lie;
 *   - if an earlier step did fail, prints the skipped list as a note and exits 0:
 *     the job is already red for the real reason, and a second red for the same
 *     cause is noise;
 *   - if it cannot see its own job (API, permissions), FAILS — a check that
 *     cannot see is not a check that passed.
 *
 * SHARDS (2026-09-06). The browser job is a matrix of shards, one body, each
 * gate's `if:` naming the shard it belongs to (scripts/lib/workflow-gates.mjs
 * reads those clauses; they are the only list). With `--shard <name>` the audit
 * judges THIS leg against that list: a gate assigned here that ended skipped
 * is the lie above; a gate assigned elsewhere must show skipped here — one that
 * ran is a double run, failed by name; a gate in this job's steps with no
 * assignment is failed by name; and the partition itself (every gate exactly
 * one existing shard, no shard empty, companions matching) is re-checked from
 * the checked-out build.yml, so a workflow edit that dodges the unit tests
 * still fails inside the job. BW_JOB_NAME carries the leg's display name
 * (`browser (heavy)`), because the API reports that and GITHUB_JOB stays
 * `browser` for every leg.
 *
 * `--file jobs.json` feeds it a saved jobs payload instead of the API, which is
 * how test/audit-job-steps.test.mjs proves each branch above can fire.
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseJobs, partition, isBrowserStep, AUDIT_STEP} from './lib/workflow-gates.mjs';

const RED = new Set(['failure', 'cancelled', 'timed_out']);

/**
 * Judge one job's steps. Pure; exported for the tests.
 * @param {Array<{name: string, status: string, conclusion: string|null}>} steps - the job's steps in order
 * @param {string} selfName - this audit step's own name, excluded from "earlier failed"
 * @param {{shard: string, mine: string[], others: string[]}} [expected] - under a matrix: the
 *   gates assigned to this leg and to the other legs (from the workflow's clauses)
 * @returns {{verdict: 'ok'|'skipped-in-green'|'skipped-after-red'|'no-gates'|'ran-in-wrong-shard'|'unassigned-gate',
 *   skipped: string[], failedEarlier: string[], ran: number, wrongShard: string[], unassigned: string[]}}
 */
export const judge = (steps, selfName = AUDIT_STEP, expected = null) => {
    const others = steps.filter(s => s.name !== selfName);
    const allBrowser = others.filter(s => isBrowserStep(s.name));
    const failedEarlier = others.filter(s => RED.has(s.conclusion)).map(s => s.name);
    let browser = allBrowser;
    const wrongShard = [];
    const unassigned = [];
    if (expected) {
        const mine = new Set(expected.mine), elsewhere = new Set(expected.others);
        for (const s of allBrowser) {
            if (mine.has(s.name)) continue;
            // A double run is a step that COMPLETED with a verdict other than
            // skipped. A null conclusion is a step the API has not reported yet
            // (run 34015453480: the three light gates skipped just before the
            // audit still read null when it asked) — not a run, never a finding.
            if (elsewhere.has(s.name)) { if (s.status === 'completed' && s.conclusion && s.conclusion !== 'skipped') wrongShard.push(`${s.name} (${s.conclusion})`); }
            else unassigned.push(s.name);
        }
        browser = allBrowser.filter(s => mine.has(s.name));
    }
    const skipped = browser.filter(s => s.conclusion === 'skipped').map(s => s.name);
    const ran = browser.filter(s => s.conclusion === 'success').length;
    const base = {skipped, failedEarlier, ran, wrongShard, unassigned};
    if (unassigned.length) return {verdict: 'unassigned-gate', ...base};
    if (wrongShard.length) return {verdict: 'ran-in-wrong-shard', ...base};
    if (browser.length === 0) return {verdict: 'no-gates', ...base};
    if (skipped.length === 0) return {verdict: 'ok', ...base};
    return {verdict: failedEarlier.length ? 'skipped-after-red' : 'skipped-in-green', ...base};
};

/**
 * What the workflow assigns to each shard, and whether that assignment is a
 * partition. Pure over the workflow text; exported for the tests.
 * @returns {{ok: boolean, problems: string[], mine: string[], others: string[]}}
 */
export const expectedForShard = (workflowText, shard) => {
    const p = partition(parseJobs(workflowText));
    const problems = [];
    if (p.shards.length === 0) problems.push('the job holding the browser gates declares no matrix shard list');
    if (!p.shards.includes(shard)) problems.push(`this leg's shard "${shard}" is not in the matrix [${p.shards.join(', ')}]`);
    for (const g of p.unassigned) problems.push(`gate with no shard clause (would run in every shard): ${g}`);
    for (const g of p.multi) problems.push(`gate with more than one shard clause: ${g}`);
    for (const g of p.unknownShard) problems.push(`gate naming a shard the matrix lacks (would never run): ${g}`);
    for (const s of p.emptyShards) problems.push(`shard with no gates: ${s}`);
    for (const c of p.companionMismatch) problems.push(`companion step not on its gate's shard: ${c}`);
    const mine = p.byShard.get(shard) || [];
    const others = [...p.byShard.entries()].filter(([s]) => s !== shard).flatMap(([, gates]) => gates);
    return {ok: problems.length === 0, problems, mine, others};
};

/**
 * This run's jobs from the Actions API. One retry, because the workflow token
 * shares a rate limit with every other run in flight and a busy afternoon has
 * already produced a 403 on the same token today.
 */
let apiReadSequence = 0;
export const fetchJobs = async (fetchImpl = fetch, {env = process.env, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now} = {}) => {
    const {GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GH_TOKEN, GITHUB_TOKEN} = env;
    const token = GH_TOKEN || GITHUB_TOKEN;
    if (!repo || !runId || !token) throw new Error('GITHUB_REPOSITORY, GITHUB_RUN_ID and GH_TOKEN are required outside --file mode');
    const once = async () => {
        // Actions responses advertise max-age=60. Each audit poll must read
        // fresh state rather than reuse that entire one-minute cache window.
        const readKey = `${now()}-${++apiReadSequence}`;
        const jobs = [];
        for (let page = 1; page <= 10; page++) {
            const res = await fetchImpl(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100&page=${page}&bw_audit_read=${readKey}`, {
                cache: 'no-store',
                headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Cache-Control': 'no-cache'}
            });
            if (!res.ok) throw new Error(`GitHub HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
            const body = await res.json();
            jobs.push(...(body.jobs || []));
            if (jobs.length >= (body.total_count || 0) || !(body.jobs || []).length) break;
        }
        // The run listing identifies the job; read its steps from the job
        // endpoint as well. Keep identity checks explicit so a stale listing
        // cannot substitute another run, attempt or matrix leg's conclusions.
        const jobName = env.BW_JOB_NAME || env.GITHUB_JOB || 'build';
        const attempt = Number(env.GITHUB_RUN_ATTEMPT || 0);
        const mine = jobs.filter(j => j.name === jobName && (!attempt || Number(j.run_attempt || attempt) === attempt));
        if (mine.length === 1) {
            const listed = mine[0];
            if (!Number.isSafeInteger(listed.id) || listed.id <= 0) throw new Error('listed job has no valid numeric identity');
            const res = await fetchImpl(`https://api.github.com/repos/${repo}/actions/jobs/${listed.id}?bw_audit_read=${readKey}`, {
                cache: 'no-store',
                headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Cache-Control': 'no-cache'}
            });
            if (!res.ok) throw new Error(`GitHub job HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
            const detail = await res.json();
            if (detail.id !== listed.id || detail.name !== jobName || String(detail.run_id) !== String(runId) ||
                (attempt && Number(detail.run_attempt) !== attempt)) throw new Error('direct job response identity does not match this run and attempt');
            jobs[jobs.indexOf(listed)] = detail;
        }
        return jobs;
    };
    try { return await once(); } catch (first) {
        await sleep(15000);
        try { return await once(); } catch (second) { throw new Error(`${second.message} (after one retry; first attempt: ${first.message})`); }
    }
};

/**
 * The whole judgement as a function of how the jobs are loaded, so the tests
 * can drive every exit — including the one where the API cannot be read.
 * @param {() => Promise<Array>} loadJobs - resolves to this run's jobs
 * @param {{jobName: string, attempt: number, shard?: string, workflowText?: string}} where - which job is
 *   "this job"; under a matrix, which shard this leg is and the workflow text to read the clauses from
 * @param {{log: Function, error: Function, sleep?: Function}} out - sinks (sleep injectable for the tests)
 * @returns {Promise<number>} the process exit code
 */
export const run = async (loadJobs, {jobName, attempt, shard = null, workflowText = null}, {log, error, sleep = ms => new Promise(r => setTimeout(r, ms))}) => {
    let expected = null;
    if (shard) {
        // THE PARTITION FIRST, from this checkout's workflow: a bad assignment
        // is a workflow defect and is named as one, before any step is judged.
        const e = expectedForShard(workflowText, shard);
        if (!e.ok) {
            error(`::error::the browser shard assignment in build.yml is not a partition of the gates — fix the if: clauses (test/browser-gate-shards.test.mjs holds the same rule):\n  ${e.problems.join('\n  ')}`);
            return 1;
        }
        expected = {shard, mine: e.mine, others: e.others};
        log(`shard ${shard}: ${e.mine.length} gate(s) assigned here, ${e.others.length} elsewhere`);
    }
    let jobs;
    try {
        jobs = await loadJobs();
    } catch (err) {
        // AN ABSENCE, NOT A FINDING. This exit must never read as "a gate was
        // skipped": a run that could not be audited is red because it is
        // unaudited, and the message says exactly that and nothing about gates.
        error(`::error::could not audit this run: ${err.message}. No browser gate is being reported as skipped; the run is red because it is unaudited (a check that cannot see is not a check that passed).`);
        return 1;
    }
    const findMine = list => list.filter(j => j.name === jobName && (!attempt || Number(j.run_attempt || attempt) === attempt));
    let mine = findMine(jobs);
    if (mine.length !== 1) {
        error(`::error::could not audit this run: expected exactly one job named "${jobName}", found ${mine.length} (${jobs.map(j => j.name).join(', ')}). No browser gate is being reported as skipped.`);
        return 1;
    }
    // THE API LAGS THE JOB. Steps that ended moments before this one can still
    // read status queued/in_progress with a null conclusion (measured on run
    // 34015453480). A read with an unreported step before the audit is not a
    // read of the job; re-ask, up to a minute, before judging anything.
    //
    // THIS LOOP IS THE GUARD ON THE PRIMARY CHECK, NOT A COURTESY TO A SLOW
    // API (lego-be). A gate assigned HERE that really skipped, still reading
    // null when we ask, is not === 'skipped' and would pass check (1) — a
    // false green over exactly the lie the audit exists to catch, and one that
    // never announces itself (the null-elsewhere case announced itself as a
    // red). Exhausting the retries into an ABSENCE is what turns "could not
    // see whether a gate skipped" into red instead of silence. Do not shorten
    // it, and do not narrow it to this leg's own steps: a null step assigned
    // elsewhere must trigger the re-read too, or check (2) under-reports.
    //
    // Only steps BEFORE the audit count: the API lists the post-job steps
    // (Post Run actions/…, Complete job) after it, and those are queued for
    // as long as the audit runs — waiting on them would exhaust every time.
    const unreported = job => {
        const steps = job.steps || [];
        // AUDIT_STEP, not a literal: a renamed step would otherwise count the
        // audit's OWN in_progress step as unreported, exhaust the loop, and turn
        // every run into an absence — permanently, sixty seconds a leg (lego-be).
        const me = steps.findIndex(s => s.name === AUDIT_STEP);
        const pending = (me >= 0 ? steps.slice(0, me) : steps)
            .filter(s => s.status !== 'completed' || !s.conclusion).map(s => s.name);
        // Missing records are incomplete evidence too. The API can return an
        // empty or truncated array even after browser gates have run. Require
        // every assigned gate, including the other shard's skipped records.
        const required = expected ? [...expected.mine, ...expected.others] : [];
        for (const name of required) {
            const matches = steps.filter(s => s.name === name);
            if (matches.length !== 1) pending.push(`${name} (${matches.length} records)`);
        }
        if (me < 0) pending.push(`${AUDIT_STEP} (missing record)`);
        return pending;
    };
    for (let i = 0; i < 6 && unreported(mine[0]).length; i++) {
        log(`${unreported(mine[0]).length} step(s) not yet reported complete by the API; re-reading in 10 s`);
        await sleep(10000);
        try { mine = findMine(await loadJobs()); } catch { /* keep the last good read */ }
        if (mine.length !== 1) break;
    }
    if (mine.length === 1 && unreported(mine[0]).length) {
        error(`::error::could not audit this run: ${unreported(mine[0]).length} step(s) still not reported complete after a minute (${unreported(mine[0]).slice(0, 5).join('; ')}). No browser gate is being reported as skipped; the run is red because it is unaudited.`);
        return 1;
    }
    const {verdict, skipped, failedEarlier, ran, wrongShard, unassigned} = judge(mine[0].steps || [], undefined, expected);
    log(`browser gates that ran: ${ran}; skipped: ${skipped.length}; earlier red steps: ${failedEarlier.length}`);
    if (verdict === 'unassigned-gate') {
        error(`::error::browser gate(s) in this job with no shard assignment in build.yml — they ran in every shard, or in none:\n  ${unassigned.join('\n  ')}`);
        return 1;
    }
    if (verdict === 'ran-in-wrong-shard') {
        error(`::error::browser gate(s) assigned to another shard ran in this one (${shard}) — a double run, and upload-artifact refuses the second artifact of a name:\n  ${wrongShard.join('\n  ')}`);
        return 1;
    }
    if (verdict === 'no-gates') {
        error('::error::could not audit this run: this job holds no Browser gate steps — the audit is in the wrong job, or the gates moved without it.');
        return 1;
    }
    if (verdict === 'skipped-after-red') {
        // NOT A SECOND RED FOR THE SAME CAUSE. A gate skipped downstream of a
        // real failure is that failure's shadow, not a finding; reporting it as
        // one doubles the noise on exactly the runs that are hardest to read.
        // Do not "simplify" this into failing on any skipped gate.
        log(`note: ${skipped.length} browser gate(s) did not run because an earlier step failed (${failedEarlier.join('; ')}); the job is red for that reason:\n  ${skipped.join('\n  ')}`);
        return 0;
    }
    if (verdict === 'skipped-in-green') {
        error(`::error::${skipped.length} browser gate(s) ended skipped with no earlier failure — a green job would have hidden them. Check their if: conditions (build.yml's own history: an if: naming a status function silenced 17 gates):\n  ${skipped.join('\n  ')}`);
        return 1;
    }
    log('audit-job-steps: every browser gate ran');
    return 0;
};

// A separate runner-scalar input boundary. The legacy API/file path above is
// deliberately retained, including its complete-record and six-poll refusal.
export const RUNNER_WIRE_ENV = 'BW_BROWSER_RUNNER_TERMINALS_V1';
export const RUNNER_INPUT_CAP = 64 * 1024;
export const RUNNER_RECEIPT_CAP = 128 * 1024;
const RUNNER_WORKFLOW_CAP = 1024 * 1024;
const RUNNER_SCHEMA = 'bw.browser.runner-terminals.v1';
const RUNNER_HEADER = [RUNNER_SCHEMA, '${{ github.repository }}', '${{ github.run_id }}', '${{ github.run_attempt }}',
    '${{ github.job }}', '${{ matrix.shard }}', '${{ github.sha }}', '${{ github.workflow_sha }}', '${{ github.workflow_ref }}'].join('\t');
const RUNNER_STATES = new Set(['success', 'failure', 'cancelled', 'skipped']);
const RUNNER_PREFIX = 'browser-runner-evidence-v1 ';
const RUNNER_ROWS_PER_SCALAR = 100;
class RunnerRefusal extends Error {}
const runnerNeed = (ok, reason) => { if (!ok) throw new RunnerRefusal(reason); };
const runnerSha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Bound GitHub's interpolated format expression as well as the rendered TSV. */
export const runnerScalarExpressionBounds = value => {
    let format = '', offset = 0;
    const args = [], escape = text => text.replaceAll("'", "''").replaceAll('{', '{{').replaceAll('}', '}}');
    for (const match of value.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)) {
        format += escape(value.slice(offset, match.index))+'{'+args.length+'}';
        args.push(match[1].trim());offset = match.index + match[0].length;
    }
    format += escape(value.slice(offset));
    const expression = "format('"+format+"'"+args.map(arg => ', '+arg).join('')+')';
    return {parameters: args.length + 1, characters: expression.length};
};

/** Source-derived IDs, names and order, including unnamed setup/actions. */
export const runnerSourceMap = workflowText => {
    runnerNeed(typeof workflowText === 'string' && Buffer.byteLength(workflowText) <= RUNNER_WORKFLOW_CAP, 'bounded checked workflow');
    const holders = [...parseJobs(workflowText).values()].filter(j => j.steps.some(s => isBrowserStep(s.name)));
    runnerNeed(holders.length === 1 && holders[0].id === 'browser', 'one browser source job');
    const job = holders[0], audit = job.steps.filter(s => s.name === AUDIT_STEP);
    runnerNeed(job.shards.length > 0 && new Set(job.shards).size === job.shards.length, 'distinct current source shards');
    runnerNeed(audit.length === 1 && job.steps.at(-1) === audit[0] && audit[0].ifs === 'always()', 'one always-last audit source step');
    const steps = job.steps.slice(0, -1);
    runnerNeed(steps.length > 0 && steps.length <= 512, 'bounded complete preceding source steps');
    const gateNames = steps.filter(step => isBrowserStep(step.name)).map(step => step.name);
    runnerNeed(new Set(gateNames).size === gateNames.length, 'one source browser gate record per name');
    const ids = new Set();
    for (const step of steps) {
        runnerNeed(typeof step.id === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(step.id) && step.idCount === 1 && !ids.has(step.id), 'one unique declared ID per preceding step');
        ids.add(step.id);
        runnerNeed(typeof step.name === 'string' && Buffer.byteLength(step.name) <= 512 && !/[\x00-\x1f\x7f]/.test(step.name), 'bounded source step name');
    }
    const lines = workflowText.split('\n');
    // This profile covers the current browser body, which declares no COE.
    // A future declared non-gate continuation needs an explicit reviewed policy.
    runnerNeed(!lines.slice(job.steps[0].line - 1, audit[0].line - 1).some(line => /^        continue-on-error:/.test(line)), 'runner profile requires browser source without continue-on-error');
    const nextJob = lines.findIndex((line, index) => index >= audit[0].line && /^  [a-z][a-z-]*:$/.test(line));
    const block = lines.slice(audit[0].line - 1, nextJob < 0 ? undefined : nextJob);
    runnerNeed(block.includes('          GH_TOKEN: ${{ github.token }}') && block.includes('          BW_JOB_NAME: browser (${{ matrix.shard }})') &&
        block.includes('        run: node scripts/audit-job-steps.mjs --shard ${{ matrix.shard }} --runner-terminals-v1') &&
        block.filter(line => /^        run:/.test(line)).length === 1, 'exact safe final audit invocation and identity scalars');
    const stepLines = steps.map(s => s.id+"\t${{ steps['"+s.id+"'].outcome }}\t${{ steps['"+s.id+"'].conclusion }}");
    const scalars = [];
    for (let offset = 0; offset < steps.length; offset += RUNNER_ROWS_PER_SCALAR) {
        const number = scalars.length + 1, key = RUNNER_WIRE_ENV+(number === 1 ? '' : '_'+number);
        const expected = stepLines.slice(offset, offset + RUNNER_ROWS_PER_SCALAR);
        if (number === 1) expected.unshift(RUNNER_HEADER);
        scalars.push({key, lines: expected});
    }
    const envKeys = block.map(line => /^          ([A-Za-z_][A-Za-z0-9_]*):/.exec(line)?.[1]).filter(Boolean);
    runnerNeed(JSON.stringify(envKeys) === JSON.stringify(['GH_TOKEN', 'BW_JOB_NAME', ...scalars.map(s => s.key)]), 'closed sanitized audit environment mapping');
    for (const scalar of scalars) {
        const headers = block.map((line, index) => line === '          '+scalar.key+': |' ? index : -1).filter(i => i >= 0);
        runnerNeed(headers.length === 1, 'one explicit scalar part source');
        const declared = [];
        for (let i = headers[0] + 1; i < block.length && block[i].startsWith('            '); i++) declared.push(block[i].slice(12));
        runnerNeed(declared.length === scalar.lines.length && declared.every((row, index) => row === scalar.lines[index]), 'exact scalar ID/outcome/conclusion source mapping');
        const limits = runnerScalarExpressionBounds(scalar.lines.join('\n')+'\n');
        runnerNeed(limits.parameters <= 255 && limits.characters <= 21000, 'bounded compiled GitHub scalar expression');
    }
    return {job, steps, scalars, mappingSha256: runnerSha([RUNNER_HEADER, ...stepLines].join('\n')+'\n'), workflowSha256: runnerSha(workflowText)};
};

/** Offline Git reads only: bind the file actually checked out, not a PR preview. */
export const checkedRunnerWorkflow = (workflowFile, env = process.env, cwd = process.cwd()) => {
    runnerNeed(typeof env.GITHUB_WORKSPACE === 'string' && path.resolve(env.GITHUB_WORKSPACE) === path.resolve(cwd) &&
        path.resolve(workflowFile) === path.join(path.resolve(cwd), '.github/workflows/build.yml'), 'checked workspace workflow path');
    let raw, head, meta, blob;
    try {
        const info = lstatSync(workflowFile);
        runnerNeed(info.isFile() && info.nlink === 1 && info.size > 0 && info.size <= RUNNER_WORKFLOW_CAP, 'regular bounded checked workflow');
        raw = readFileSync(workflowFile);
        runnerNeed(raw.length === info.size && raw.length <= RUNNER_WORKFLOW_CAP, 'complete bounded checked workflow read');
        const git = (args, cap) => execFileSync('/usr/bin/git', ['--no-replace-objects', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-C', cwd, ...args], {
            timeout: 5000, maxBuffer: cap, encoding: null, stdio: ['ignore', 'pipe', 'pipe'],
            env: {LANG: 'C.UTF-8', HOME: '/nonexistent', PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0'}
        });
        head = git(['rev-parse', 'HEAD'], 128).toString('ascii');
        meta = git(['ls-tree', '-z', 'HEAD', '--', '.github/workflows/build.yml'], 256).toString('ascii');
        blob = git(['cat-file', 'blob', 'HEAD:.github/workflows/build.yml'], RUNNER_WORKFLOW_CAP + 1);
    } catch (error) {
        if (error instanceof RunnerRefusal) throw error;
        throw new RunnerRefusal('checked workflow Git read refused');
    }
    runnerNeed(/^[0-9a-f]{40}\n$/.test(head) && head.trim() === env.GITHUB_SHA, 'checked HEAD matches current runner SHA');
    const match = /^100644 blob ([0-9a-f]{40})\t\.github\/workflows\/build\.yml\x00$/.exec(meta);
    runnerNeed(match && raw.equals(blob) && createHash('sha1').update(Buffer.concat([Buffer.from('blob '+raw.length+'\0'), raw])).digest('hex') === match[1], 'checked workflow Git blob bytes');
    let text;
    try { text = new TextDecoder('utf-8', {fatal: true}).decode(raw); } catch { throw new RunnerRefusal('checked workflow UTF-8'); }
    return {text, checkoutHead: head.trim(), gitBlob: match[1], sha256: runnerSha(raw)};
};

export const runnerTerminalReceipt = (wire, source, {env = process.env, shard} = {}) => {
    runnerNeed(typeof wire === 'string' && Buffer.byteLength(wire) > 0 && Buffer.byteLength(wire) <= RUNNER_INPUT_CAP && wire.endsWith('\n') && !wire.includes('\r'), 'bounded LF scalar terminal wire');
    const mapping = runnerSourceMap(source.text), job = mapping.job;
    const sourceBytes = Buffer.from(source.text);
    runnerNeed(source.sha256 === mapping.workflowSha256 && /^[0-9a-f]{40}$/.test(source.gitBlob || '') &&
        source.gitBlob === createHash('sha1').update(Buffer.concat([Buffer.from('blob '+sourceBytes.length+'\0'), sourceBytes])).digest('hex'), 'exact checked source fingerprint');
    const partitioned = expectedForShard(source.text, shard);
    runnerNeed(partitioned.ok && typeof shard === 'string' && job.shards.includes(shard), 'complete source shard partition');
    // The 2026-11-25 rename kept repository ID 1291854269 (see
    // docs/REPOSITORY-RENAME.md). Both names describe this workbench; the
    // separate Legacy application has another ID. Bind live evidence to the
    // stable ID without rewriting names in historical receipts.
    runnerNeed(env.GITHUB_REPOSITORY_ID === '1291854269' &&
        ['CrispStrobe/brickwright', 'CrispStrobe/brickwright-lite'].includes(env.GITHUB_REPOSITORY) &&
        env.GITHUB_JOB === job.id && env.BW_JOB_NAME === job.id+' ('+shard+')', 'current runner repository/job/shard identity');
    runnerNeed(typeof env.GITHUB_RUN_ID === 'string' && /^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID) &&
        typeof env.GITHUB_RUN_ATTEMPT === 'string' && /^[1-9][0-9]{0,8}$/.test(env.GITHUB_RUN_ATTEMPT), 'current runner run/attempt identity');
    const workflowPrefix = env.GITHUB_REPOSITORY+'/.github/workflows/build.yml@';
    runnerNeed(/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || '') && source.checkoutHead === env.GITHUB_SHA &&
        /^[0-9a-f]{40}$/.test(env.GITHUB_WORKFLOW_SHA || '') && typeof env.GITHUB_WORKFLOW_REF === 'string' &&
        env.GITHUB_WORKFLOW_REF.length <= 512 && env.GITHUB_WORKFLOW_REF.startsWith(workflowPrefix) &&
        /^refs\/(?:heads|pull)\/[A-Za-z0-9_./-]+$/.test(env.GITHUB_WORKFLOW_REF.slice(workflowPrefix.length)), 'current checked source/workflow identity');
    const lines = wire.slice(0, -1).split('\n');
    const header = [RUNNER_SCHEMA, env.GITHUB_REPOSITORY, env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT, env.GITHUB_JOB, shard, env.GITHUB_SHA, env.GITHUB_WORKFLOW_SHA, env.GITHUB_WORKFLOW_REF].join('\t');
    runnerNeed(lines[0] === header && lines.length === mapping.steps.length + 1, 'exact scalar run/source header and row count');
    const rows = mapping.steps.map((step, index) => {
        const fields = lines[index + 1].split('\t');
        runnerNeed(fields.length === 3 && fields[0] === step.id && RUNNER_STATES.has(fields[1]) && RUNNER_STATES.has(fields[2]), 'ordered source IDs and closed terminal state fields');
        // failure/success is a documented valid COE pair, but this current
        // no-COE profile cannot admit it, whether on a gate or another step.
        runnerNeed(!(fields[1] === 'failure' && fields[2] === 'success'), 'valid continued failure is outside the current browser profile');
        runnerNeed(fields[1] === fields[2], 'outcome/conclusion contradiction; continued failure is not positive evidence');
        return {ordinal: index + 1, id: step.id, name: step.name, outcome: fields[1], conclusion: fields[2]};
    });
    const verdict = judge(rows.map(row => ({...row, status: 'completed'})), AUDIT_STEP, {shard, mine: partitioned.mine, others: partitioned.others});
    const exitCode = ['ok', 'skipped-after-red'].includes(verdict.verdict) ? 0 : 1;
    const receipt = {schema: RUNNER_SCHEMA, evidenceMode: 'runner-scalars', complete: true,
        identity: {repository: env.GITHUB_REPOSITORY, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, job: env.GITHUB_JOB, jobName: env.BW_JOB_NAME, shard,
            checkoutHead: source.checkoutHead, executingWorkflowSha: env.GITHUB_WORKFLOW_SHA, workflowRef: env.GITHUB_WORKFLOW_REF},
        source: {path: '.github/workflows/build.yml', gitBlob: source.gitBlob, sha256: source.sha256, mappingSha256: mapping.mappingSha256},
        steps: rows, verdict, auditExitCode: exitCode,
        allAssignedGatesSucceeded: verdict.verdict === 'ok' && partitioned.mine.every(name => rows.filter(row => row.name === name).length === 1 && rows.find(row => row.name === name).outcome === 'success')};
    runnerNeed(Buffer.byteLength(RUNNER_PREFIX + JSON.stringify(receipt) + '\n') <= RUNNER_RECEIPT_CAP, 'complete sanitized receipt byte cap');
    return receipt;
};

export const runnerTerminalCLI = (args, env = process.env, cwd = process.cwd(), out = console) => {
    try {
        const options = new Map();
        for (let index = 0; index < args.length; index++) {
            const flag = args[index];
            runnerNeed(['--runner-terminals-v1', '--shard', '--workflow'].includes(flag) && !options.has(flag), 'exact runner terminal CLI flags');
            if (flag === '--runner-terminals-v1') options.set(flag, true);
            else { runnerNeed(index + 1 < args.length && !args[index + 1].startsWith('--'), 'runner terminal CLI value'); options.set(flag, args[++index]); }
        }
        runnerNeed(options.get('--runner-terminals-v1') === true && options.has('--shard'), 'explicit runner terminal mode and shard');
        const workflowFile = options.get('--workflow') || path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.github/workflows/build.yml');
        const source = checkedRunnerWorkflow(workflowFile, env, cwd);
        const mapping = runnerSourceMap(source.text), keys = mapping.scalars.map(s => s.key);
        runnerNeed(JSON.stringify(Object.keys(env).filter(k => k === RUNNER_WIRE_ENV || k.startsWith(RUNNER_WIRE_ENV+'_')).sort()) === JSON.stringify([...keys].sort()), 'exact runner scalar part keys');
        runnerNeed(keys.every(key => typeof env[key] === 'string' && env[key].endsWith('\n') && Buffer.byteLength(env[key]) <= RUNNER_INPUT_CAP), 'complete bounded runner scalar parts');
        const receipt = runnerTerminalReceipt(keys.map(key => env[key]).join(''), source, {env, shard: options.get('--shard')});
        out.log(RUNNER_PREFIX + JSON.stringify(receipt));
        if (receipt.auditExitCode !== 0) out.error('::error::runner browser audit finding: '+receipt.verdict.verdict);
        return receipt.auditExitCode;
    } catch (error) {
        const reason = error instanceof RunnerRefusal ? error.message : 'unexpected runner terminal audit failure';
        // Never echo unvalidated input, environment, outputs, Git stderr or a stack.
        out.error(RUNNER_PREFIX + JSON.stringify({schema: RUNNER_SCHEMA, complete: false, firstFailure: {name: 'RunnerEvidenceRefusal', reason}}));
        return 1;
    }
};

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain && process.argv.includes('--runner-terminals-v1')) process.exitCode = runnerTerminalCLI(process.argv.slice(2));
if (isMain && !process.argv.includes('--runner-terminals-v1')) {
    const fileArg = process.argv.indexOf('--file');
    const loadJobs = fileArg >= 0
        ? async () => JSON.parse(readFileSync(process.argv[fileArg + 1], 'utf8')).jobs
        : fetchJobs;
    const shardArg = process.argv.indexOf('--shard');
    const shard = shardArg >= 0 ? process.argv[shardArg + 1] : null;
    const wfArg = process.argv.indexOf('--workflow');
    const workflowFile = wfArg >= 0 ? process.argv[wfArg + 1] : path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.github', 'workflows', 'build.yml');
    run(loadJobs, {
        jobName: process.env.BW_JOB_NAME || process.env.GITHUB_JOB || 'build',
        attempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
        shard,
        workflowText: shard ? readFileSync(workflowFile, 'utf8') : null
    }, {log: console.log, error: console.error}).then(code => process.exit(code));
}
