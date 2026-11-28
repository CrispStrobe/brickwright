// Exercise the actual workflow shell without launching a browser or compiler.
// The child deliberately fails: a retained log must not turn its verdict green.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseJobs, isBrowserStep, shardsOf} from '../scripts/lib/workflow-gates.mjs';
import {decide, loadContext} from '../scripts/ci-browser-scope.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');
const lines = source.split('\n');
const jobs = parseJobs(source);
const browser = jobs.get('browser');
const proofs = browser.steps.filter(step => step.id?.startsWith('bw_proof_') && isBrowserStep(step.name));
const body = step => {
    const start = step.line - 1;
    let end = start + 1;
    while (end < lines.length && !/^      - |^  [a-z][\w-]*:/.test(lines[end])) end++;
    return lines.slice(start, end).join('\n');
};
const runShell = step => {
    const block = body(step).split('\n');
    const start = block.indexOf('        run: |');
    assert(start >= 0, `${step.name}: an actual shell block is required`);
    const run = [];
    for (const line of block.slice(start + 1)) {
        if (line.trim() && !line.startsWith('          ')) break;
        run.push(line.slice(10));
    }
    return run.join('\n');
};
const scratch = prefix => mkdtempSync(path.join(tmpdir(), prefix));

test('each new browser proof keeps its failing process verdict, log, URL and required arguments', () => {
    assert.equal(proofs.length, 38);
    const cwd = scratch('bw-proof-wiring-');
    try {
        writeFileSync(path.join(cwd, 'node'), `#!${process.execPath}\nconsole.log('fixture-argv ' + JSON.stringify(process.argv.slice(2)));\nconsole.error('intentional proof process failure');\nprocess.exit(42);\n`, {mode: 0o755});
        const argumentsByScript = new Map();
        for (const step of proofs) {
            const shard = shardsOf(step)[0];
            const result = spawnSync('/bin/bash', ['-c', runShell(step)], {
                cwd, env: {...process.env, PATH: `${cwd}:${process.env.PATH}`}, encoding: 'utf8', timeout: 5000
            });
            assert.equal(result.status, 42, `${step.name}: tee must preserve the child's nonzero status\n${result.stderr}`);
            const recorded = result.stdout.split('\n').find(line => line.startsWith('fixture-argv '));
            assert(recorded, `${step.name}: the declared command ran`);
            const args = JSON.parse(recorded.slice('fixture-argv '.length));
            assert.deepEqual(args.slice(0, 2), ['--import', './scripts/lib/register-gui-scope.mjs']);
            const script = args[2];
            assert.match(script, /^scripts\/verify-[\w-]+\.mjs$/);
            assert.equal(argumentsByScript.has(script), false, `${script}: one independent caller`);
            argumentsByScript.set(script, args.slice(3));
            const urlAt = script === 'scripts/verify-owned-console-code-tab.mjs' ? 4 : 3;
            assert.equal(args[urlAt], 'http://127.0.0.1:8617/', `${script}: actual served build URL`);
            const name = path.basename(script, '.mjs').slice('verify-'.length);
            const log = readFileSync(path.join(cwd, 'test-results/browser-proof', shard, `${name}.log`), 'utf8');
            assert.match(log, /intentional proof process failure/);
            assert.doesNotMatch(runShell(step), /BW_\w+_BASELINE|--qualification-manifest|\|\|\s*true/);
        }
        const cadDir = 'test-results/browser-proof/lightcad3';
        assert.deepEqual(argumentsByScript.get('scripts/verify-cad-dwg-browser.mjs'), ['http://127.0.0.1:8617/', 'test/fixtures/cad/browser/inch-plate.dwg', `${cadDir}/roundtrip.dwg`]);
        assert.deepEqual(argumentsByScript.get('scripts/verify-cad-step-browser.mjs'), ['http://127.0.0.1:8617/', 'test/fixtures/cad/browser/Adafruit3777.step']);
        assert.deepEqual(argumentsByScript.get('scripts/verify-cad-dxf-region-browser.mjs'), ['http://127.0.0.1:8617/', '', `${cadDir}/region.dxf`, `${cadDir}/region.pdf`]);
        assert.deepEqual(argumentsByScript.get('scripts/verify-cad-path-dxf-browser.mjs'), ['http://127.0.0.1:8617/', '', `${cadDir}/path.dxf`]);
        assert.deepEqual(argumentsByScript.get('scripts/verify-owned-console-code-tab.mjs'), ['--url', 'http://127.0.0.1:8617/', '--out', 'test-results/browser-proof/lightartwork/owned-console/current.json']);
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});

test('new proof families remain selected when a PR also changes another browser family', () => {
    const tier = jobs.get('scope').steps.find(step => step.id === 'tier');
    const shell = runShell(tier);
    const bindings = [...body(tier).matchAll(/^          (NEED_[A-Z0-9_]+): \$\{\{ steps\.files\.outputs\.scope_([a-z0-9]+) \}\}$/gm)];
    const ctx = loadContext(ROOT);
    const cwd = scratch('bw-proof-scope-');
    const execute = (text, needed) => {
        const output = path.join(cwd, 'github-output');
        writeFileSync(output, '');
        const env = {...process.env, EVENT: 'pull_request', ACTION: 'synchronize', LABEL: '', HAS_FULL: 'true', DOCS_ONLY: 'false', GITHUB_OUTPUT: output};
        for (const [, key, shard] of bindings) env[key] = String(needed.includes(shard));
        const result = spawnSync('/bin/bash', ['-c', text], {cwd, env, encoding: 'utf8', timeout: 5000});
        assert.equal(result.status, 0, result.stderr);
        return Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
    };
    try {
        for (const shard of ['lightcad1', 'lightcad2', 'lightcad3', 'lightartwork', 'robotview']) {
            const proof = proofs.find(step => shardsOf(step)[0] === shard);
            const script = /node --import \S+ (scripts\/verify-[\w-]+\.mjs)/.exec(runShell(proof))[1];
            assert.deepEqual(decide([script], ctx).needed, [shard], 'the real caller discovery selects its shard');
            const family = shard === 'robotview' ? 'robotlab' : 'light';
            const other = shard === 'robotview' ? 'light' : 'heavy';
            const selected = execute(shell, [shard, other]);
            assert.equal(selected[family], 'true', `${shard}: mixed change must retain its family`);
            assert.equal(selected[other], 'true');
            const clause = family === 'light' ? 'NEED_LIGHTCAD1' : 'NEED_ROBOTVIEW';
            const missingAggregation = shell.split('\n').filter(line => !line.startsWith('if ') || !line.includes(clause)).join('\n');
            assert.notEqual(missingAggregation, shell, 'mutation removes actual tier aggregation');
            assert.equal(execute(missingAggregation, [shard, other])[family], 'false', 'the control exposes the skipped family');
            assert(source.includes(`- shard: \${{ needs.scope.outputs.${family} != 'true' && '${shard}' || 'none' }}`));
        }
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});

test('the bounded browser installer adds Firefox for the robot view proofs and retains Chromium elsewhere', () => {
    const install = browser.steps.find(step => step.id === 'playwright');
    const cwd = scratch('bw-proof-browsers-');
    try {
        mkdirSync(path.join(cwd, 'node_modules/.bin'), {recursive: true});
        writeFileSync(path.join(cwd, 'sudo'), '#!/bin/sh\nexec "$@"\n', {mode: 0o755});
        writeFileSync(path.join(cwd, 'timeout'), '#!/bin/sh\nshift\nshift\nexec "$@"\n', {mode: 0o755});
        writeFileSync(path.join(cwd, 'node_modules/.bin/playwright'), `#!${process.execPath}\nconsole.log('fixture-playwright '+JSON.stringify(process.argv.slice(2)));\n`, {mode: 0o755});
        for (const shard of ['light', 'lightcad1', 'lightartwork', 'robotview']) {
            const result = spawnSync('/bin/bash', ['-c', runShell(install)], {cwd, env: {...process.env, BW_BROWSER_SHARD: shard, PATH: `${cwd}:${process.env.PATH}`}, encoding: 'utf8', timeout: 5000});
            assert.equal(result.status, 0, result.stderr);
            const calls = result.stdout.trim().split('\n').map(line => JSON.parse(line.slice('fixture-playwright '.length)));
            const engines = shard === 'robotview' ? ['chromium', 'firefox'] : ['chromium'];
            assert.deepEqual(calls, [['install-deps', ...engines], ['install', ...engines]]);
        }
        const build = browser.steps.find(step => step.id === 'build_editor_browser');
        assert(body(build).includes("BW_ENABLE_CAD: ${{ startsWith(matrix.shard, 'light') && '1' || '0' }}"));
    } finally { rmSync(cwd, {recursive: true, force: true}); }
});
