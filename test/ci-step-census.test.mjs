/**
 * Every workflow step and job runs somewhere the readings can see (plan T14) —
 * T13's rule one level up. docs/generated/ci-step-census.json (scripts/gen-ci-steps.mjs
 * --fetch, never hand-edited) holds, per workflow, the steps in the file at the
 * readings' sha and what each did across the last runs; this test holds it to:
 *
 *   - a workflow in the tree with no completed run → "a workflow nobody runs";
 *   - a step in the file at that sha but in no run → "a step in no run";
 *   - a step or job that appeared and ran in none → a pointer under "Steps that
 *     run elsewhere" in CI-POINTERS.md (where its condition holds, dated) or red;
 *   - a step younger than the readings is reported, not judged.
 *
 * Measured 2026-09-07 over 247 runs of 10 workflows, 169 steps: none ran in no
 * run it appeared in; 26 ran sometimes, each explained by an upstream failure,
 * a trigger, a tag, a matrix leg, or an outcome guard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {parseStepPointers, judgeSteps, STEP_HEADING} from '../scripts/lib/skip-pointers.mjs';
import {census, yamlSteps, why, workflowSource, mergeWorkflowReadings, repositoryIdentity, READINGS} from '../scripts/gen-ci-steps.mjs';
import {BRICKWRIGHT_REPOSITORY_ID, BRICKWRIGHT_PREVIOUS_SLUG, BRICKWRIGHT_SLUG} from '../scripts/lib/brickwright-repository.mjs';

test('a scoped workflow refresh preserves unrelated dated evidence and main provenance', () => {
    const previous = {repo: 'owner/repo', headSha: 'old-main', newestMainRun: 1,
        runs: [{run: 1, workflow: 'old.yml'}, {run: 2, workflow: 'new.yml'}],
        workflowsInTree: ['old.yml', 'new.yml'], workflows: {'old.yml': {sourceSha: 'old', runs: 1}, 'new.yml': {runs: 1}}};
    const fresh = {repo: 'owner/repo', generatedAt: '2026-10-04', runs: [{run: 3, workflow: 'new.yml'}],
        workflows: {'new.yml': {sourceSha: 'branch', runs: 1}}};
    const result = mergeWorkflowReadings(previous, fresh, 'new.yml');
    assert.deepEqual(result.workflows['old.yml'], previous.workflows['old.yml']);
    assert.equal(result.headSha, 'old-main');
    assert.equal(result.newestMainRun, 1);
    assert.deepEqual(result.runs, [{run: 1, workflow: 'old.yml'}, {run: 3, workflow: 'new.yml'}]);
    assert.equal(result.lastRefresh.sourceSha, 'branch');
    assert.throws(() => mergeWorkflowReadings(previous, {...fresh, repo: 'other/repo'}, 'new.yml'));
    assert.throws(() => mergeWorkflowReadings(previous, fresh, 'absent.yml'));
});

test('live census metadata requires the owned repository ID, not just the renamed slug', () => {
    const metadata = {full_name: BRICKWRIGHT_SLUG, id: BRICKWRIGHT_REPOSITORY_ID};
    assert.deepEqual(repositoryIdentity(metadata),
        {repo: BRICKWRIGHT_SLUG, repositoryId: BRICKWRIGHT_REPOSITORY_ID});
    for (const id of [undefined, null, 0, -1, 1.5, String(BRICKWRIGHT_REPOSITORY_ID), BRICKWRIGHT_REPOSITORY_ID - 1]) {
        assert.throws(() => repositoryIdentity({...metadata, id}), 'an absent, malformed or wrong ID is refused');
    }
    for (const full_name of [undefined, 'other/brickwright', 'CrispStrobe/brickwright-legacy']) {
        assert.throws(() => repositoryIdentity({...metadata, full_name}), 'another repository name is refused');
    }
});

test('a scoped census refresh admits the owned rename without changing prior observations or main provenance', () => {
    const previous = {repo: BRICKWRIGHT_PREVIOUS_SLUG, headSha: 'a87a7b447', newestMainRun: 17,
        generatedAt: '2026-09-07',
        runs: [{run: 17, workflow: 'old.yml', branch: 'main', sha: 'a87a7b447'},
            {run: 18, workflow: 'cowgol.yml', branch: 'feature', sha: '111111111'}],
        workflowsInTree: ['old.yml', 'cowgol.yml'],
        workflows: {'old.yml': {sourceSha: 'a87a7b447', runs: 1, steps: {old: {ran: 1}}},
            'cowgol.yml': {sourceSha: '111111111', runs: 1}}};
    const before = structuredClone(previous);
    const fresh = {repo: BRICKWRIGHT_SLUG, repositoryId: BRICKWRIGHT_REPOSITORY_ID,
        generatedAt: '2026-11-28',
        runs: [{run: 19, workflow: 'cowgol.yml', branch: 'feature', sha: '222222222'}],
        workflows: {'cowgol.yml': {sourceSha: '222222222', runs: 1}}};
    const result = mergeWorkflowReadings(previous, fresh, 'cowgol.yml');
    assert.equal(result.repo, BRICKWRIGHT_SLUG);
    assert.equal(result.repositoryId, BRICKWRIGHT_REPOSITORY_ID);
    assert.equal(result.headSha, previous.headSha);
    assert.equal(result.newestMainRun, previous.newestMainRun);
    assert.equal(JSON.stringify(result.workflows['old.yml']), JSON.stringify(previous.workflows['old.yml']));
    assert.deepEqual(result.runs, [previous.runs[0], fresh.runs[0]]);
    assert.deepEqual(previous, before, 'the inherited readings were not mutated');
    const anotherRun = {run: 20, workflow: 'another.yml', branch: 'feature', sha: '333333333'};
    const next = mergeWorkflowReadings(result, {...fresh,
        runs: [anotherRun],
        workflows: {'another.yml': {sourceSha: '333333333', runs: 1}}}, 'another.yml');
    assert.equal(next.repo, BRICKWRIGHT_SLUG);
    assert.equal(next.repositoryId, BRICKWRIGHT_REPOSITORY_ID);
    assert.equal(next.headSha, previous.headSha);
    assert.equal(next.newestMainRun, previous.newestMainRun);
    assert.deepEqual(next.runs, [...result.runs, anotherRun]);
    assert.deepEqual(next.workflows['old.yml'], previous.workflows['old.yml']);
    assert.deepEqual(next.workflows['cowgol.yml'], result.workflows['cowgol.yml']);
});

test('census rename admission refuses another repository, a wrong ID and a reverse rename', () => {
    const previous = {repo: BRICKWRIGHT_PREVIOUS_SLUG,
        runs: [], workflowsInTree: [], workflows: {}};
    const fresh = {repo: BRICKWRIGHT_SLUG, repositoryId: BRICKWRIGHT_REPOSITORY_ID,
        runs: [], workflows: {'cowgol.yml': {sourceSha: '222222222', runs: 0}}};
    assert.throws(() => mergeWorkflowReadings(previous, {...fresh, repositoryId: undefined}, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings(previous, {...fresh, repositoryId: BRICKWRIGHT_REPOSITORY_ID - 1}, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings({...previous, repositoryId: BRICKWRIGHT_REPOSITORY_ID - 1}, fresh, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings({...previous, repo: 'other/brickwright'}, fresh, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings(previous, {...fresh, repo: 'other/brickwright'}, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings({...previous, repo: BRICKWRIGHT_SLUG,
        repositoryId: BRICKWRIGHT_REPOSITORY_ID}, {...fresh, repo: BRICKWRIGHT_PREVIOUS_SLUG}, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings({...previous, repo: BRICKWRIGHT_SLUG,
        repositoryId: BRICKWRIGHT_REPOSITORY_ID - 1}, fresh, 'cowgol.yml'));
    assert.throws(() => mergeWorkflowReadings(previous, fresh, 'missing.yml'));
});

test('a new workflow sources its own branch run until main has actually run it', () => {
    const main = {workflow: 'old.yml', branch: 'main', sha: 'main', createdAt: '2026-09-08'};
    const branch = {workflow: 'new.yml', branch: 'feature', sha: 'branch', createdAt: '2026-09-07'};
    assert.equal(workflowSource([main, branch], 'new.yml', main), branch);
    const older = {...branch, sha: 'older', createdAt: '2026-09-06'};
    assert.equal(workflowSource([older, branch, main], 'new.yml', main), branch);
    const promoted = {...older, branch: 'main', sha: 'promoted'};
    assert.equal(workflowSource([branch, promoted, main], 'new.yml', main), promoted);
    assert.equal(workflowSource([main], 'unrun.yml', main), main);
});

const ROOT = path.resolve(import.meta.dirname, '..');

test('a scoped zero-run declaration keeps recorded main provenance without inventing observations', () => {
    const sha = 'a'.repeat(40);
    const source = workflowSource([], 'manual.yml', undefined, sha);
    assert.deepEqual(source, {sha});
    const workflows = census([], {'manual.yml': 'jobs:\n  audit:\n    steps:\n      - name: Inspect metadata\n        run: node audit.mjs\n'});
    workflows['manual.yml'].sourceSha = 'working-tree';
    const previous = {repo: 'owner/repo', headSha: sha, newestMainRun: 17,
        runs: [{run: 17, workflow: 'old.yml', branch: 'main', sha}],
        workflowsInTree: ['old.yml'], workflows: {'old.yml': {runs: 1, steps: {}, jobs: {}}}};
    const merged = mergeWorkflowReadings(previous, {repo: previous.repo,
        generatedAt: '2026-10-23', runs: [], workflows}, 'manual.yml');
    assert.equal(merged.headSha, sha);
    assert.equal(merged.newestMainRun, 17);
    assert.deepEqual(merged.runs, previous.runs);
    assert.deepEqual(merged.workflows['old.yml'], previous.workflows['old.yml']);
    assert.equal(merged.workflows['manual.yml'].runs, 0);
    assert.deepEqual(merged.workflows['manual.yml'].steps, {});
    assert.deepEqual(merged.workflows['manual.yml'].jobs, {});
    assert.deepEqual(merged.workflows['manual.yml'].inFileInNoRun, ['Inspect metadata']);
    const observed = {workflow: 'manual.yml', branch: 'main', sha: 'b'.repeat(40), createdAt: '2026-10-22'};
    assert.equal(workflowSource([observed], 'manual.yml', undefined, sha), observed);
    assert.equal(workflowSource([], 'manual.yml'), undefined, 'global discovery still needs actual observations');
    for (const bad of ['main', '', 'a'.repeat(41), 'source\nother']) {
        assert.throws(() => workflowSource([], 'manual.yml', undefined, bad), /commit SHA/);
    }
});

const readings = JSON.parse(readFileSync(READINGS, 'utf8'));
const pointers = parseStepPointers(readFileSync(path.join(ROOT, 'CI-POINTERS.md'), 'utf8'));

test('the readings are the generator\'s: they name their runs and sha, and cover every workflow in the tree', () => {
    assert.ok(readings.headSha && readings.runs.length >= 20 && readings.runs.every(r => Number.isInteger(r.run)), 'the readings name the runs and the sha they were read at');
    const inTree = readdirSync(path.join(ROOT, '.github/workflows')).filter(f => f.endsWith('.yml')).sort();
    const younger = inTree.filter(wf => !readings.workflowsInTree.includes(wf));
    assert.deepEqual(readings.workflowsInTree.filter(wf => !inTree.includes(wf)), [], 'readings for workflow(s) the tree no longer has — regenerate (node scripts/gen-ci-steps.mjs --fetch)');
    assert.deepEqual(younger, [], 'workflow(s) in the tree the readings never saw — regenerate:\n  ' + younger.join('\n  '));
});

test('every step and job runs somewhere the readings can see; steps younger than the readings are reported', t => {
    const problems = judgeSteps(readings, pointers);
    assert.deepEqual(problems, [], 'step(s) nobody runs:\n  ' + problems.join('\n  '));
    // steps in the CURRENT file that the file at the readings' sha did not have: younger, not judged
    const younger = [];
    for (const wf of readings.workflowsInTree) {
        const now = yamlSteps(readFileSync(path.join(ROOT, '.github/workflows', wf), 'utf8')).map(s => s.name);
        for (const n of now) if (!readings.workflows[wf].stepsInFile.includes(n)) younger.push(`${wf} :: ${n}`);
    }
    if (younger.length) t.diagnostic(`younger than the readings (${readings.headSha}), judged on the next --fetch: ${younger.join('; ')}`);
    const all = Object.values(readings.workflows).flatMap(w => Object.values(w.steps));
    for (const s of all.filter(s => s.class === 'sometimes')) assert.ok(s.why, 'a sometimes step carries its why');
});

test('mutation: the four shapes that must redden, and a dated pointer that clears one', () => {
    const base = {headSha: 'abc123456', workflowsInTree: ['a.yml', 'b.yml'], workflows: {
        'a.yml': {runs: 5, stepsInFile: ['one', 'two'], inFileInNoRun: [], steps: {one: {existed: 5, ran: 5, class: 'always'}, two: {existed: 5, ran: 3, class: 'sometimes', why: 'trigger'}}, jobs: {j: {existed: 5, ran: 5, class: 'always'}}},
        'b.yml': {runs: 2, stepsInFile: ['x'], inFileInNoRun: [], steps: {x: {existed: 2, ran: 2, class: 'always'}}, jobs: {}}
    }};
    assert.deepEqual(judgeSteps(base, []), []);
    const never = structuredClone(base); never.workflows['a.yml'].steps.two = {existed: 5, ran: 0, class: 'never', clause: "github.event_name == 'schedule'"};
    assert.match(judgeSteps(never, [])[0], /a\.yml :: "two": appeared in 5 run\(s\) and ran in none — a step nobody runs; point at where its condition holds \(clause: github\.event_name == 'schedule'\)/);
    const ptr = parseStepPointers(`${STEP_HEADING}\n- a.yml :: two :: the schedule trigger at 03:00 UTC, run 123 on 2026-09-07\n`);
    assert.deepEqual(judgeSteps(never, ptr), [], 'a dated pointer clears it');
    const undated = parseStepPointers(`${STEP_HEADING}\n- a.yml :: two :: somewhere, someday\n`);
    assert.match(judgeSteps(never, undated)[0], /a pointer without a date is a claim nobody can check/);
    const inNoRun = structuredClone(base); inNoRun.workflows['a.yml'].inFileInNoRun = ['three']; inNoRun.workflows['a.yml'].stepsInFile.push('three');
    assert.match(judgeSteps(inNoRun, [])[0], /a\.yml :: "three": in the file at abc123456 but in none of 5 run\(s\) — a step in no run/);
    inNoRun.workflows['a.yml'].sourceSha = 'branch123';
    assert.match(judgeSteps(inNoRun, [])[0], /in the file at branch123/);
    const noRuns = structuredClone(base); noRuns.workflows['b.yml'].runs = 0;
    assert.match(judgeSteps(noRuns, [])[0], /b\.yml: no completed run in the readings — a workflow nobody runs/);
    assert.deepEqual(judgeSteps(noRuns, parseStepPointers(`${STEP_HEADING}\n- b.yml :: * :: runs on tags only, last 2026-09-01\n`)), []);
    const job = structuredClone(base); job.workflows['a.yml'].jobs.j = {existed: 5, ran: 0, class: 'never'};
    assert.match(judgeSteps(job, [])[0], /a\.yml :: job "j": appeared in 5 run\(s\) and ran in none — a job nobody runs/);
});

test('the census over runs (mutation): a shard\'s gate that ran one job over RAN; a skip behind a failed job is an upstream failure', () => {
    const yaml = "jobs:\n  browser:\n    steps:\n      - name: gate A\n        if: ${{ matrix.shard == 'heavy' }}\n      - name: gate B\n        if: ${{ matrix.shard == 'light' }}\n      - name: measure\n        if: ${{ github.event_name == 'workflow_dispatch' }}\n";
    const run = (id, branch, aHeavy, bLight, measure, buildOk = true) => ({run: id, workflow: 'w.yml', branch, jobs: [
        {name: 'build', conclusion: buildOk ? 'success' : 'failure', steps: [{name: 'unit', conclusion: buildOk ? 'success' : 'skipped'}]},
        {name: 'browser (heavy)', conclusion: 'success', steps: [{name: 'gate A', conclusion: aHeavy}, {name: 'gate B', conclusion: 'skipped'}, {name: 'measure', conclusion: measure}]},
        {name: 'browser (light)', conclusion: 'success', steps: [{name: 'gate A', conclusion: 'skipped'}, {name: 'gate B', conclusion: bLight}, {name: 'measure', conclusion: measure}]}
    ]});
    const w = census([run(1, 'main', 'success', 'success', 'skipped'), run(2, 'x', 'success', 'success', 'success'), run(3, 'y', 'success', 'success', 'success', false)], {'w.yml': yaml});
    const s = w['w.yml'].steps;
    assert.deepEqual([s['gate A'].class, s['gate B'].class], ['always', 'always'], 'skipped in one shard, ran in the other: ran');
    assert.equal(s.measure.class, 'sometimes'); assert.match(s.measure.why, /^trigger/);
    assert.equal(s.unit.class, 'sometimes'); assert.match(s.unit.why, /^upstream failure/);
    assert.deepEqual(w['w.yml'].jobs.browser, {existed: 3, ran: 3, existedMain: 1, ranMain: 1, class: 'always'});
    assert.deepEqual(w['w.yml'].inFileInNoRun, []);
    const w2 = census([run(1, 'main', 'skipped', 'success', 'skipped')], {'w.yml': yaml});
    assert.equal(w2['w.yml'].steps['gate A'].class, 'never', 'skipped in every shard of every run: never');
    assert.deepEqual(yamlSteps(yaml).map(s => s.name), ['gate A', 'gate B', 'measure']);
    assert.match(why("matrix.os == 'macos-latest'", false), /^matrix/); assert.match(why("startsWith(github.ref, 'refs/tags/')", false), /^tag/); assert.match(why("steps.order.outputs.stale != 'true'", false), /^outcome guard/);
});
