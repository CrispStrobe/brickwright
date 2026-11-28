import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {parsePushPaths} from '../scripts/lib/doc-triggers.mjs';
import {isDocsOnly, pushWouldBuild} from '../scripts/ci-docs-only.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const yml = readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');
const {entries} = parsePushPaths(yml);

test('docs-only is the push trigger filter applied to the PR, failing closed', () => {
    assert.equal(isDocsOnly(['LANES.md'], entries), true);
    assert.equal(isDocsOnly(['LANES.md', 'docs/SOME-UNREAD-NOTE.md'], entries), true);
    // Docs that code reads are build triggers, so they are code changes here.
    for (const f of ['docs/FETCH-PINNING.md', 'docs/generated/x.md', 'THIRD-PARTY-NOTICES.md',
        'overlay/scratch-gui/examples/a/EXPECTED.md', 'scripts/list-tests.mjs', '.github/workflows/build.yml'])
        assert.equal(isDocsOnly(['LANES.md', f], entries), false, f);
    assert.equal(isDocsOnly([], entries), false, 'an empty file list is not evidence of docs-only');
    assert.equal(pushWouldBuild('package.json', entries), true);
    assert.throws(() => pushWouldBuild('x', ['**', '!docs/**/*.md']), /unsupported trigger pattern/);
    assert.throws(() => isDocsOnly(['LANES.md'], ['!LANES.md']), /must start with \*\*/);
});

test('the CLI prints a GITHUB_OUTPUT line', () => {
    const run = input => spawnSync(process.execPath, ['scripts/ci-docs-only.mjs'], {cwd: ROOT, input, encoding: 'utf8'});
    assert.equal(run('LANES.md\nREADME.md\n').stdout.trim(), 'docs_only=true');
    assert.equal(run('LANES.md\nsrc/x.js\n').stdout.trim(), 'docs_only=false');
});

test('build.yml wires the tiers: scope, gate, fast and thorough conditions', () => {
    const jobs = new Map([...yml.matchAll(/^  ([a-z][\w-]*):\n([\s\S]*?)(?=^  [a-z][\w-]*:\n|(?![\s\S]))/gm)].map(m => [m[1], m[2]]));
    const scope = jobs.get('scope'), gate = jobs.get('full-ci-gate');
    assert.ok(scope && gate, 'scope and full-ci-gate jobs exist');
    assert.match(scope, /node scripts\/ci-docs-only\.mjs/);
    assert.match(gate, /name: full CI requested/);
    assert.match(gate, /FAST: \$\{\{ needs\.scope\.outputs\.fast \}\}/);
    assert.match(gate, /THOROUGH: \$\{\{ needs\.scope\.outputs\.thorough \}\}/);
    assert.doesNotMatch(gate, /HAS_FULL|BROWSER_NEEDED|github\.event\.label/);
    for (const fast of ['unit', 'build', 'corpus']) assert.match(jobs.get(fast), /needs\.scope\.outputs\.fast == 'true'/, fast);
    for (const heavy of ['browser', 'fpga-surface']) assert.match(jobs.get(heavy), /needs\.scope\.outputs\.thorough == 'true'/, heavy);
    assert.match(yml, /pull_request:\n    types: \[opened, synchronize, reopened, labeled, unlabeled, ready_for_review\]/);
});

// Execute the checked-in shell, not a second JavaScript tier implementation.
// Use the runner's explicit Bash path; absence fails closed, without PATH fallback.
const workflowJob = (source, name) => {
    const jobs = new Map([...source.matchAll(/^  ([a-z][\w-]*):\n([\s\S]*?)(?=^  [a-z][\w-]*:\n|(?![\s\S]))/gm)]
        .map(match => [match[1], match[2]]));
    assert.ok(jobs.has(name), `missing workflow job: ${name}`);
    return jobs.get(name);
};
const workflowShell = (job, marker) => {
    const start = job.indexOf(marker);
    assert.ok(start >= 0, `missing workflow step: ${marker}`);
    const run = job.indexOf('        run: |\n', start);
    assert.ok(run >= 0, `missing shell for: ${marker}`);
    const lines = job.slice(run + '        run: |\n'.length).split('\n');
    const body = [];
    for (const line of lines) {
        if (line && !line.startsWith('          ')) break;
        body.push(line.slice(10));
    }
    assert.ok(body.some(line => line.trim()), 'workflow shell must not be empty');
    return body.join('\n');
};
const tierShell = workflowShell(workflowJob(yml, 'scope'), '- id: tier');
const gateShell = workflowShell(workflowJob(yml, 'full-ci-gate'), '- name: Admit selected CI tier');
const executeShell = (shell, inputs) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bw-ci-tier-'));
    const output = path.join(dir, 'output');
    try {
        const run = spawnSync('/usr/bin/bash', ['-c', shell], {
            env: {PATH: process.env.PATH, EVENT: 'pull_request', ACTION: 'synchronize',
                LABEL: '', HAS_FULL: 'false', DOCS_ONLY: 'false',
                NEED_HEAVY: 'true', NEED_LIGHT: 'true', NEED_ROBOTLAB: 'true', NEED_FPGA: 'true',
                NEED_LIGHTCAD1: 'false', NEED_LIGHTCAD2: 'false', NEED_LIGHTCAD3: 'false',
                NEED_LIGHTARTWORK: 'false', NEED_ROBOTVIEW: 'false',
                FAST: 'false', THOROUGH: 'false', ...inputs, GITHUB_OUTPUT: output},
            encoding: 'utf8', timeout: 5000, maxBuffer: 65536
        });
        assert.ifError(run.error);
        return {...run, output: run.status === 0 && shell === tierShell ?
            Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('='))) : {}};
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
};

const gateCases = [
    ['documentation only', {DOCS_ONLY: 'true'}, 0],
    ['fast without label', {FAST: 'true'}, 0],
    ['thorough only', {THOROUGH: 'true'}, 0],
    ['fast and thorough', {FAST: 'true', THOROUGH: 'true'}, 0],
    ['no tier', {}, 1],
    ['label alone is not execution', {HAS_FULL: 'true', LABEL: 'ci:full'}, 1],
    ['no-browser flag is not execution', {BROWSER_NEEDED: 'false'}, 1],
    ['missing docs value', {DOCS_ONLY: '', FAST: 'true'}, 1],
    ['invalid docs value', {DOCS_ONLY: 'yes', FAST: 'true'}, 1],
    ['missing fast value', {FAST: '', THOROUGH: 'true'}, 1],
    ['invalid fast value', {FAST: 'TRUE', THOROUGH: 'true'}, 1],
    ['missing thorough value', {DOCS_ONLY: 'true', THOROUGH: ''}, 1],
    ['invalid thorough value', {FAST: 'true', THOROUGH: '1'}, 1]
];
const assertGateCases = shell => {
    for (const [name, inputs, expected] of gateCases) {
        const actual = executeShell(shell, inputs);
        assert.equal(actual.status, expected, `${name}: ${actual.stderr || actual.stdout}`);
    }
};

test('actual workflow admission accepts selected tiers and rejects absent or invalid execution', () => {
    assertGateCases(gateShell);
});

test('actual workflow selector keeps fast PR default and existing thorough/main/dispatch behavior', () => {
    const cases = [
        ['code PR without label', {}, 'true', 'false', false, 0],
        ['code PR with full selection', {HAS_FULL: 'true'}, 'true', 'true', true, 0],
        ['explicit full label event', {ACTION: 'labeled', LABEL: 'ci:full', HAS_FULL: 'true'}, 'false', 'true', true, 0],
        ['removed full label', {ACTION: 'unlabeled', LABEL: 'ci:full'}, 'false', 'false', false, 1],
        ['unrelated label', {ACTION: 'labeled', LABEL: 'example'}, 'false', 'false', false, 1],
        ['documentation PR', {DOCS_ONLY: 'true'}, 'false', 'false', false, 0],
        ['main push', {EVENT: 'push'}, 'true', 'true', true, 0],
        ['manual dispatch', {EVENT: 'workflow_dispatch'}, 'true', 'true', true, 0]
    ];
    for (const [name, inputs, fast, thorough, browser, admitted] of cases) {
        const result = executeShell(tierShell, inputs);
        assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout}`);
        assert.equal(result.output.fast, fast, name);
        assert.equal(result.output.thorough, thorough, name);
        for (const shard of ['browser', 'heavy', 'light', 'robotlab', 'fpga'])
            assert.equal(result.output[shard], String(browser), `${name}: ${shard}`);
        const gate = executeShell(gateShell, {DOCS_ONLY: inputs.DOCS_ONLY || 'false',
            FAST: result.output.fast, THOROUGH: result.output.thorough});
        assert.equal(gate.status, admitted, `${name}: actual selector to actual gate`);
    }
});

test('admission matrix rejects buildable missing-branch and unconditional-success mutations', () => {
    const variants = ['DOCS_ONLY', 'FAST', 'THOROUGH'].map(name => {
        const anchor = `if [ "$${name}" = "true" ]; then`;
        assert.equal(gateShell.split(anchor).length - 1, 1, `${name}: exact branch anchor`);
        return [name, gateShell.replace(anchor, 'if false; then')];
    });
    variants.push(['unconditional success', `exit 0\n${gateShell}`]);
    for (const [name, mutant] of variants) {
        assert.equal(spawnSync('/usr/bin/bash', ['-n'], {input: mutant}).status, 0, `${name}: buildable shell`);
        assert.throws(() => assertGateCases(mutant), {name: 'AssertionError'}, `${name}: real verdict must differ`);
    }
});
