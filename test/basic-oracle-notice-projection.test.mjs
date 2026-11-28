// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {basicOracleBeforeCrispBasicNotice, hddBeforeCrispBasicNoticeControl}
    from './helpers/reviewed-basic-oracle-notice.mjs';
import {assertReviewedConcurrency, reviewedPolicy, hddBeforeConcurrencyControl}
    from './helpers/reviewed-concurrency-projections.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workflow = read('.github/workflows/basic-oracle.yml');
const controlFile = 'test/i80386-hdd-gui-actual.test.mjs';
const control = read(controlFile);
const digest = value => createHash('sha256').update(value).digest('hex');
const originalOracleDigest = '88725722f8784da8b11e2c1ee7bacea11ba959df16666d93bdab9cdc9b8d1783';
const pushBlock = "  push:\n    branches: ['**']\n    tags-ignore: ['bw-gui-hdd-actual-v8-*']\n";
const assertOracle = source => {
    assertReviewedConcurrency(source);
    assert.equal(source.split(reviewedPolicy + '\n').length, 2);
    assert.equal(source.split(pushBlock).length, 2);
    const predecessor = basicOracleBeforeCrispBasicNotice('basic-oracle', source)
        .replace(reviewedPolicy + '\n', '').replace(pushBlock, '  push:\n');
    assert.equal(digest(predecessor), originalOracleDigest,
        'all original executable oracle bytes remain bound by the original hash');
};

test('the exact CrispBASIC notice preserves every executable BASIC oracle line and its historical hash', () => {
    const predecessor = basicOracleBeforeCrispBasicNotice('basic-oracle', workflow);
    const executable = source => source.split('\n').filter(line => !line.startsWith('#')).join('\n');
    assert.equal(executable(predecessor), executable(workflow));
    assertOracle(workflow);
    assert.equal(basicOracleBeforeCrispBasicNotice('unreviewed-workflow', workflow), workflow);
});

test('the notice projection refuses altered, missing or duplicated notices and preserves executable drift', () => {
    const start = workflow.indexOf("# This workflow's BBCSDL");
    const end = workflow.indexOf('\nname:', start);
    const notice = workflow.slice(start, end + 1);
    assert.ok(start >= 0 && end > start);
    for (const mutation of [workflow.replace(notice, ''), workflow + notice,
        workflow.replace('restricted WASM build', 'unrestricted WASM build')]) {
        assert.throws(() => assertOracle(mutation), /exact reviewed CrispBASIC oracle notice/);
    }
    for (const [old, value] of [
        ['contents: read', 'contents: write'],
        ['timeout-minutes: 20', 'timeout-minutes: 21'],
        ['workflow_dispatch:', 'pull_request_target:'],
        ['node scripts/verify-basic-oracle.mjs', 'node scripts/other-oracle.mjs']
    ]) {
        assert.ok(workflow.includes(old));
        const mutation = workflow.replace(old, value);
        assert.throws(() => assertOracle(mutation), /original executable oracle bytes/);
    }
    assert.throws(() => assertOracle(workflow + '# unrelated comment\n'), /original executable oracle bytes/);
});

test('the new control call projects exactly to the previous reviewed source and all older seals', () => {
    const identityReview = JSON.parse(read('test/fixtures/i80386-repository-identity-review.json'));
    const prior = hddBeforeCrispBasicNoticeControl(controlFile, control);
    assert.equal(Buffer.byteLength(prior), identityReview.after.bytes);
    assert.equal(digest(prior), identityReview.after.sha256);
    const historical = hddBeforeConcurrencyControl(controlFile, control);
    assert.equal(Buffer.byteLength(historical), 646674);
    assert.equal(digest(historical), '45ef06f71b0bec8064d4f2bee31e1a78dcaa50cd9e6a4fd10fa8ad39cdd857ae');
});

test('removing the notice import or call cannot bypass historical source checks', () => {
    for (const mutation of [
        control.replace("import {basicOracleBeforeCrispBasicNotice}", "import {removedNoticeProjection}"),
        control.replace('basicOracleBeforeCrispBasicNotice(name, heldBeforeConcurrencyPolicy(name,workflow))',
            'heldBeforeConcurrencyPolicy(name,workflow)')
    ]) {
        assert.notEqual(mutation, control);
        assert.throws(() => hddBeforeConcurrencyControl(controlFile, mutation), /exact reviewed oracle notice/);
    }
    const suffix = '// unrelated source drift\n';
    assert.equal(hddBeforeCrispBasicNoticeControl(controlFile, control + suffix),
        hddBeforeCrispBasicNoticeControl(controlFile, control) + suffix);
    assert.notEqual(digest(hddBeforeConcurrencyControl(controlFile, control + suffix)),
        '45ef06f71b0bec8064d4f2bee31e1a78dcaa50cd9e6a4fd10fa8ad39cdd857ae');
    assert.equal(hddBeforeCrispBasicNoticeControl('test/unreviewed.mjs', control), control);
});
