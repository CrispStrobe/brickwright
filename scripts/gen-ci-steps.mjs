#!/usr/bin/env node
/**
 * The CI step census (plan T14): which workflow steps and jobs actually run,
 * read from the jobs API of the last green/completed runs of EVERY workflow —
 * the same question T13 asked of tests, one level up.
 *
 *   node scripts/gen-ci-steps.mjs --fetch    read the runs (gh api) and REWRITE
 *                                            docs/generated/ci-step-census.json
 *   node scripts/gen-ci-steps.mjs --check    exit 1 on a step nobody runs
 *   node scripts/gen-ci-steps.mjs --fetch --workflow arcade-controls.yml
 *     Refresh just that workflow; retain every other recorded observation.
 *     --baseline-ref HEAD can use committed readings after an uncommitted refresh.
 *
 * Per (workflow, step name), aggregated over every job instance in a run (a
 * shard's gate that runs in the sibling shard RAN): runs it appeared in, runs
 * it ran in (any conclusion but skipped), split main/branch, and the `if:`
 * clause the workflow gives it at the newest run's sha. Per (workflow, job)
 * the same. A workflow's named steps AT THAT SHA are recorded too, so a step
 * that is in the file but in no run is seen; a step younger than the readings
 * is reported, never judged.
 *
 * Measured 2026-09-07 (247 runs, 10 workflows, 169 steps): 0 steps ran in no
 * run they appeared in; 26 ran sometimes — 17 skipped once behind a failed
 * build job, the rest trigger/tag/matrix conditions by design; the only "in
 * the file, in no run" steps were younger than the readings.
 */
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseJobs} from './lib/workflow-gates.mjs';
import {parseStepPointers, judgeSteps, POINTERS_FILE} from './lib/skip-pointers.mjs';
import {assertBrickwrightRepository, BRICKWRIGHT_PREVIOUS_SLUG, BRICKWRIGHT_SLUG} from './lib/brickwright-repository.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const READINGS = path.join(ROOT, 'docs', 'generated', 'ci-step-census.json');
const RUNS_PER_WORKFLOW = 20, GREEN_MAIN = 20;
// FETCH WINDOW for build.yml, which is sampled as "the last GREEN_MAIN green
// main runs plus every branch run in the window". 60 was enough until a busy day
// filled the window with branch runs and red main runs: a regeneration on
// 2026-09-28 found only 17 build.yml runs and NOT ONE in which `deploy` or
// `verify-gui` had executed, because those only run on a green main build. The
// readings then classified both as "nobody runs" and the census test went red on
// a different assertion than the one the regeneration was fixing — one state
// failing coverage, the other failing step classification, with no correct
// version available. The window has to reach back far enough to contain
// GREEN_MAIN actual green main runs, not merely 60 runs of any kind.
const BUILD_WINDOW = 200;
const HOUSEKEEPING = /^(Set up job|Complete job|Post |Run actions\/|Initialize containers|Stop containers)/;
const gh = args => execFileSync('gh', args, {encoding: 'utf8', maxBuffer: 256 << 20});

/** Named steps per job of a workflow text, with their if: clauses. */
export const yamlSteps = text => {
    const out = [];
    for (const job of parseJobs(text).values()) for (const s of job.steps) if (s.name) out.push({job: job.id, name: s.name, ifs: s.ifs, line: s.line});
    return out;
};

/** Why a step ran only sometimes, from its clause and the runs it skipped in. Pure. */
export const why = (clause, skippedRunsHadFailure) => {
    if (skippedRunsHadFailure) return 'upstream failure — skipped only in runs where an earlier job failed';
    const c = clause || '';
    if (/event_name/.test(c)) return 'trigger — the clause names the event';
    if (/refs\/tags|startsWith\(github\.ref/.test(c)) return 'tag — runs on tag refs only';
    if (/refs\/heads\/main|github\.ref\s*==/.test(c)) return 'branch — runs on main only';
    if (/matrix\./.test(c)) return 'matrix — runs in one matrix leg';
    if (/steps\.\w+\.(outcome|outputs)/.test(c)) return 'outcome guard — behind an earlier step\'s result';
    return c ? 'clause — ' + c.slice(0, 80) : 'no clause — skipped by the runner after a failure';
};

/** Pure: from [{run, workflow, branch, sha, jobs:[{name, conclusion, steps:[{name, conclusion}]}]}] and {wf: yamlText} to the readings' body. */
export const census = (runs, yamlAtSha) => {
    const steps = {}, jobs = {};
    for (const r of runs) {
        const runFailed = r.jobs.some(j => j.conclusion === 'failure');
        const isMain = r.branch === 'main';
        const seenStep = new Set(), seenJob = new Set();
        for (const j of r.jobs) {
            const jname = j.name.replace(/ \(.*\)$/, '');
            const J = ((jobs[r.workflow] ||= {})[jname] ||= {existed: 0, ran: 0, existedMain: 0, ranMain: 0});
            if (!seenJob.has(jname)) { seenJob.add(jname); J.existed++; if (isMain) J.existedMain++; J._ran = false; }
            if (j.conclusion !== 'skipped' && !J._ran) { J._ran = true; J.ran++; if (isMain) J.ranMain++; }
            for (const s of j.steps) {
                if (HOUSEKEEPING.test(s.name)) continue;
                const S = ((steps[r.workflow] ||= {})[s.name] ||= {existed: 0, ran: 0, existedMain: 0, ranMain: 0, skippedInFailedRuns: 0, skippedInGreenRuns: 0, jobs: []});
                if (!S.jobs.includes(jname)) S.jobs.push(jname);
                const k = `${r.workflow}::${s.name}`;
                if (!seenStep.has(k)) { seenStep.add(k); S.existed++; if (isMain) S.existedMain++; S._ran = false; }
                if (s.conclusion !== 'skipped' && !S._ran) { S._ran = true; S.ran++; if (isMain) S.ranMain++; }
            }
        }
        for (const k of seenStep) { const [wf, name] = k.split('::'); const S = steps[wf][name]; if (!S._ran) { if (runFailed) S.skippedInFailedRuns++; else S.skippedInGreenRuns++; } }
    }
    const workflows = {};
    for (const wf of Object.keys(yamlAtSha)) {
        const y = yamlSteps(yamlAtSha[wf]);
        const st = steps[wf] || {};
        for (const [name, S] of Object.entries(st)) {
            delete S._ran;
            const decl = y.find(s => s.name === name);
            S.clause = decl ? decl.ifs : null;
            S.class = S.ran === 0 ? 'never' : S.ran === S.existed ? 'always' : 'sometimes';
            if (S.class === 'sometimes') S.why = why(S.clause, S.skippedInGreenRuns === 0);
        }
        for (const J of Object.values(jobs[wf] || {})) { delete J._ran; J.class = J.ran === 0 ? 'never' : J.ran === J.existed ? 'always' : 'sometimes'; }
        workflows[wf] = {
            runs: runs.filter(r => r.workflow === wf).length,
            stepsInFile: y.map(s => s.name),
            inFileInNoRun: y.filter(s => !st[s.name]).map(s => s.name),
            steps: st, jobs: jobs[wf] || {}
        };
    }
    return workflows;
};

// A workflow introduced on a branch does not exist at the newest main run.
// Read its own newest completed run instead of feeding an empty file to the
// parser. Prefer main evidence when this workflow has any.
export const workflowSource = (runs, workflow, fallback, recordedMainSha) => {
    const own = runs.filter(run => run.workflow === workflow)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const observed = own.find(run => run.branch === 'main') || own[0] || fallback;
    if (observed || recordedMainSha === undefined) return observed;
    if (typeof recordedMainSha !== 'string' || !/^[0-9a-f]{7,40}$/.test(recordedMainSha)) {
        throw new Error('Recorded declaration source must be a commit SHA');
    }
    // A scoped new workflow has no run to supply a declaration. This baseline
    // supplies source only; it never enters runs or becomes a new observation.
    return {sha: recordedMainSha};
};

/** Live REST metadata binds the current name to the owned repository. */
export const repositoryIdentity = metadata => {
    if (!metadata || !Number.isSafeInteger(metadata.id) || metadata.id <= 0) {
        throw new Error('Live repository metadata must carry a positive numeric repository ID');
    }
    assertBrickwrightRepository(metadata.full_name, metadata.id);
    return {repo: metadata.full_name, repositoryId: metadata.id};
};

export const mergeWorkflowReadings = (previous, fresh, workflow) => {
    const renamed = previous.repo === BRICKWRIGHT_PREVIOUS_SLUG && fresh.repo === BRICKWRIGHT_SLUG;
    if ((previous.repo !== fresh.repo && !renamed) || !fresh.workflows[workflow]) {
        throw new Error('Workflow refresh must match the recorded repository and workflow');
    }
    if ([BRICKWRIGHT_PREVIOUS_SLUG, BRICKWRIGHT_SLUG].includes(previous.repo)) {
        // The existing identity policy admits historical old-slug readings
        // without an ID. Canonical readings must identify the same owned repo.
        assertBrickwrightRepository(previous.repo, previous.repositoryId);
        assertBrickwrightRepository(fresh.repo, fresh.repositoryId);
    }
    return {
        ...previous,
        repo: fresh.repo,
        ...(fresh.repositoryId === undefined ? {} : {repositoryId: fresh.repositoryId}),
        generatedAt: fresh.generatedAt,
        runs: [...previous.runs.filter(r => r.workflow !== workflow), ...fresh.runs],
        workflowsInTree: [...new Set([...previous.workflowsInTree, workflow])].sort(),
        workflows: {...previous.workflows, [workflow]: fresh.workflows[workflow]},
        lastRefresh: {workflow, at: fresh.generatedAt, sourceSha: fresh.workflows[workflow].sourceSha}
    };
};

const fetchAll = (selectedWorkflow, recordedMainSha) => {
    const requestedRepo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
    const {repo, repositoryId} = repositoryIdentity(JSON.parse(gh(['api', `repos/${requestedRepo}`])));
    const inTree = readdirSync(path.join(ROOT, '.github/workflows')).filter(f => f.endsWith('.yml'));
    if (selectedWorkflow && !inTree.includes(selectedWorkflow)) throw new Error(`Unknown workflow: ${selectedWorkflow}`);
    const wfs = selectedWorkflow ? [selectedWorkflow] : inTree;
    const runs = [];
    for (const wf of wfs) {
        // A WORKFLOW THAT HAS NEVER RUN IS A NORMAL STATE, and until this was
        // handled a new one could not be added at all: `gh run list` answers
        // 404 for a workflow GitHub has not registered (it registers on the
        // default branch), so --fetch died, so the census could not cover the
        // file, so the ci-step-census gate was red on every PR that added a
        // workflow — including the one that would have put it on the default
        // branch. Chicken and egg, with the tooling holding both.
        let list = [];
        try {
            list = JSON.parse(gh(['run', 'list', '--repo', repo, '--workflow', wf, '--limit', String(wf === 'build.yml' ? BUILD_WINDOW : RUNS_PER_WORKFLOW), '--json', 'databaseId,headSha,headBranch,status,conclusion,createdAt']))
                .filter(r => r.status === 'completed' && r.conclusion !== 'cancelled');
        } catch (e) {
            if (!/404|not found/i.test(String(e.stderr || e.message || e))) throw e;
            console.warn(`${wf}: no runs yet (not on the default branch) — declared steps only`);
        }
        // build.yml: the last GREEN_MAIN green main runs plus every branch dispatch in the window
        const picked = wf === 'build.yml' ? [...list.filter(r => r.headBranch === 'main' && r.conclusion === 'success').slice(0, GREEN_MAIN), ...list.filter(r => r.headBranch !== 'main')] : list;
        for (const r of picked) {
            const jobs = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${r.databaseId}/jobs?per_page=100`])).jobs.map(j => ({name: j.name, conclusion: j.conclusion, steps: (j.steps || []).map(s => ({name: s.name, conclusion: s.conclusion}))}));
            runs.push({run: r.databaseId, workflow: wf, branch: r.headBranch, sha: r.headSha.slice(0, 9), createdAt: r.createdAt, jobs});
        }
    }
    // Bind each declaration to a run that actually contained that workflow.
    const newestMain = runs.filter(r => r.branch === 'main').sort((a, b) => a.createdAt < b.createdAt ? 1 : -1)[0];
    const yamlAtSha = {};
    const sourceShas = {};
    for (const wf of wfs) {
        const source = workflowSource(runs, wf, newestMain, selectedWorkflow ? recordedMainSha : undefined);
        if (!source) throw new Error(`No completed run can supply ${wf}`);
        sourceShas[wf] = source.sha;
        try {
            yamlAtSha[wf] = execFileSync('git', ['show', `${source.sha}:.github/workflows/${wf}`],
                {cwd: ROOT, encoding: 'utf8'});
        } catch (e) {
            // The same new-workflow case: no run carries it, so the fallback
            // source is a main commit that does not have the file. Read the
            // working tree instead and say so — the declared steps are still a
            // fact, they simply have no observations behind them yet.
            if (!/exists on disk, but not in|does not exist|fatal: path/i.test(String(e.stderr || e.message || e))) throw e;
            yamlAtSha[wf] = readFileSync(path.join(ROOT, '.github/workflows', wf), 'utf8');
            sourceShas[wf] = 'working-tree';
            console.warn(`${wf}: not present at ${source.sha} — sourced from the working tree`);
        }
    }
    return {repo, repositoryId, runs, newestMain, yamlAtSha, sourceShas, wfs};
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    if (process.argv.includes('--fetch')) {
        const option = flag => {
            const index = process.argv.indexOf(flag);
            if (index < 0) return undefined;
            const value = process.argv[index + 1];
            if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value`);
            return value;
        };
        const selectedWorkflow = option('--workflow');
        const baselineRef = option('--baseline-ref');
        if (baselineRef && !selectedWorkflow) throw new Error('--baseline-ref requires --workflow');
        const previousText = selectedWorkflow ? (baselineRef
            ? execFileSync('git', ['show', `${baselineRef}:docs/generated/ci-step-census.json`], {cwd: ROOT, encoding: 'utf8'})
            : readFileSync(READINGS, 'utf8')) : null;
        const previous = previousText ? JSON.parse(previousText) : null;
        const {repo, repositoryId, runs, newestMain, yamlAtSha, sourceShas, wfs} = fetchAll(selectedWorkflow, previous?.headSha);
        const workflows = census(runs, yamlAtSha);
        for (const wf of wfs) workflows[wf].sourceSha = sourceShas[wf];
        const fresh = {generatedAt: new Date().toISOString(), repo, repositoryId, headSha: newestMain?.sha, newestMainRun: newestMain?.run, runs: runs.map(r => ({run: r.run, workflow: r.workflow, branch: r.branch, sha: r.sha})), workflowsInTree: wfs, workflows};
        const body = selectedWorkflow ? mergeWorkflowReadings(previous, fresh, selectedWorkflow) : fresh;
        // A scoped refresh preserves the existing presentation as well as the
        // observations; changing one declaration must not reindent every row.
        const indentation = previousText?.match(/\n([ \t]+)"/)?.[1] || 1;
        writeFileSync(READINGS, JSON.stringify(body, null, indentation) + '\n');
        // `--fetch` REWRITES A TRACKED FILE. It reads like a read-only flag and is
        // not one: brickwright-lite-ea ran it inside a lane worktree on 2026-09-07,
        // `git add -A` swept 143 lines of readings into an unrelated source commit,
        // and the rebase conflict that followed cost a diagnosis. So the file is
        // named on stdout every time, with what to do about it.
        console.log(`::notice::${path.relative(ROOT, READINGS)} was REWRITTEN by --fetch. It is tracked: commit it on its own, or \`git checkout\` it before committing unrelated work — never sweep it in with \`git add -A\`.`);
        const all = Object.values(workflows).flatMap(w => Object.values(w.steps));
        console.log(`ci-step-census: ${runs.length} runs, ${wfs.length} workflows, ${all.length} steps — never ${all.filter(s => s.class === 'never').length}, sometimes ${all.filter(s => s.class === 'sometimes').length}, always ${all.filter(s => s.class === 'always').length}; in workflow files at their recorded sourceShas but in no run: ${Object.values(workflows).reduce((a, w) => a + w.inFileInNoRun.length, 0)}`);
    }
    const readings = JSON.parse(readFileSync(READINGS, 'utf8'));
    const pointers = parseStepPointers(readFileSync(path.join(ROOT, POINTERS_FILE), 'utf8'));
    const problems = judgeSteps(readings, pointers);
    for (const p of problems) console.log(`  ${p}`);
    console.log(problems.length ? `${problems.length} step(s)/job(s)/workflow(s) nobody runs` : 'every workflow step and job runs somewhere the readings can see');
    if (process.argv.includes('--check') && problems.length) process.exit(1);
}
