import test from 'node:test';
import {assertReviewedConcurrency} from './helpers/reviewed-concurrency-projections.mjs';
import {assertHeldLegacyConcurrency, asHeldLegacyPredecessor} from './helpers/held-legacy-concurrency.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('./fixtures/cycle-core-candidates.json', import.meta.url)));
const workflow = readFileSync(new URL('../.github/workflows/cycle-core-qualification.yml', import.meta.url), 'utf8');
const qualifier = readFileSync(new URL('../scripts/qualify-cycle-candidates.mjs', import.meta.url), 'utf8');
const oracleGenerator = readFileSync(new URL('../scripts/generate-floooh-z80-oracle-header.mjs', import.meta.url), 'utf8');

test('cycle candidates and oracles use immutable full commit pins', () => {
    for (const candidate of Object.values(manifest.candidates)) {
        assert.match(candidate.commit, /^[0-9a-f]{40}$/);
        assert.match(candidate.oracle.commit, /^[0-9a-f]{40}$/);
        assert.ok(workflow.includes(candidate.commit));
    }
    assert.equal(manifest.candidates.z80.sourceSha256['chips/z80.h'].length, 64);
    for (const path of manifest.candidates.z80.oracle.vectorPaths) {
        assert.match(manifest.candidates.z80.oracle.sourceSha256[path], /^[0-9a-f]{64}$/);
        assert.ok(workflow.includes(path));
    }
});

test('heavy qualification is hosted, bounded, fail-closed and retains evidence', () => {
    assert.match(qualifier, /cycle-core qualification is CI-only/);
    assert.match(workflow, /timeout-minutes: 45/);
    assertHeldLegacyConcurrency(asHeldLegacyPredecessor(workflow));
    assertReviewedConcurrency(asHeldLegacyPredecessor(workflow), {profile: 'workflow-ref'});
    assertReviewedConcurrency(asHeldLegacyPredecessor(workflow), {automaticOnly: true});
    assertReviewedConcurrency(workflow);
    assert.match(workflow, /if: always\(\)/);
    assert.match(workflow, /cycle-core-qualification\/report\.json/);
    assert.match(qualifier, /evaluationSucceeded:/);
    assert.match(qualifier, /candidateResults/);
    assert.match(qualifier, /every\(candidate => candidate\.promotionReady\)/);
    assert.match(qualifier, /snapshot replay is byte-identical/);
    assert.match(qualifier, /snapshots replay from every exercised microstep/);
    assert.match(qualifier, /non-empty recorded control activity/);
    assert.match(qualifier, /HALT and interrupt acknowledge are observable cycle boundaries/);
    assert.match(qualifier, /matches the pinned SingleStepTests retire vector/);
    assert.match(qualifier, /publishes the bounded pinned SingleStepTests corpus result/);
    assert.match(oracleGenerator, /oracle hash mismatch/);
    assert.match(oracleGenerator, /vectorCount: vectors\.length/);
    assert.match(qualifier, /WAIT stretching and NMI entry are directly observed/);
    assert.match(qualifier, /publishes bounded cost receipts/);
    assert.match(qualifier, /JSMoo W65C02 promotion decision matches replay evidence/);
    assert.match(qualifier, /JSMoo W65C02 emits non-empty bus activity/);
    assert.match(qualifier, /runs the bounded pinned WDC65C02 corpus/);
    assert.match(qualifier, /prove every selected oracle shard hash/);
    assert.match(qualifier, /WAI and STP corpus omissions remain explicit rejection receipts/);
    assert.match(qualifier, /corpus failure evidence is bounded, never discarded/);
    assert.match(qualifier, /known B-latch defect is reproduced by real oracle vectors/);
    assert.match(qualifier, /runs exact WAI\/STP IRQ\/NMI timed-bus scenarios/);
    assert.match(qualifier, /snapshots replay at every low-power microstep/);
    assert.match(qualifier, /WAI timing defects remain explicit rejection evidence/);
    assert.match(qualifier, /STP hold and reset behavior match the bespoke vectors/);
});

test('candidate licenses and every admitted source are hash-pinned', () => {
    assert.equal(manifest.candidates.w65c02.license, 'MIT');
    assert.equal(manifest.candidates.w65c02.decision, 'reject');
    assert.equal(manifest.candidates.z80.decision, 'qualify');
    assert.equal(manifest.candidates.z80.expectedRejection, undefined);
    assert.equal(manifest.candidates.w65c02.oracle.variant, 'wdc65c02/v1');
    assert.ok(manifest.candidates.w65c02.oracle.vectorPaths.length >= 8);
    assert.ok(manifest.candidates.w65c02.oracle.vectorsPerOpcode > 0);
    for (const path of manifest.candidates.w65c02.oracle.vectorPaths) {
        assert.match(manifest.candidates.w65c02.oracle.vectorSha256[path], /^[0-9a-f]{64}$/);
        assert.ok(workflow.includes(path));
    }
    assert.match(manifest.candidates.w65c02.oracle.excluded.cb, /WAI/);
    assert.match(manifest.candidates.w65c02.oracle.excluded.db, /STP/);
    for (const candidate of Object.values(manifest.candidates)) {
        assert.ok(candidate.licensePath);
        for (const path of [...candidate.sourcePaths, candidate.licensePath]) {
            assert.match(candidate.sourceSha256[path], /^[0-9a-f]{64}$/);
        }
    }
    assert.match(qualifier, /license is promotion-ready/);
    assert.doesNotMatch(qualifier, /continue-on-error|allowFailure|waive/i);
});
