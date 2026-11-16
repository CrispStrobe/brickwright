import assert from 'node:assert/strict';
import test from 'node:test';
import {automaticOnlyPolicy, assertReviewedConcurrency, reviewedPolicy,
    modelWorkflowBeforeConcurrencyPolicy} from './helpers/reviewed-concurrency-projections.mjs';

test('pending model/cycle policy selection is explicit and cannot admit global policy drift', () => {
    assertReviewedConcurrency(reviewedPolicy);
    assertReviewedConcurrency(automaticOnlyPolicy, {automaticOnly: true});
    assert.throws(() => assertReviewedConcurrency(automaticOnlyPolicy));
    assert.throws(() => assertReviewedConcurrency(reviewedPolicy, {automaticOnly: true}));
    assert.throws(() => modelWorkflowBeforeConcurrencyPolicy(reviewedPolicy + '\n'));
    for (const [policy, options] of [[reviewedPolicy, {}], [automaticOnlyPolicy, {automaticOnly: true}]]) {
        for (const changed of [
            policy.replace("github.event_name == 'push'", "github.event_name == 'workflow_dispatch'"),
            policy.replace("github.ref_type != 'tag'", "github.ref_type == 'tag'"),
            policy.replace('${{ github.workflow }}', 'shared'),
            policy.replace('${{ github.ref }}', '${{ github.sha }}'),
            policy + '  extra-policy: true\n',
            policy + '\nconcurrency:\n',
        ]) assert.throws(() => assertReviewedConcurrency(changed, options));
    }
    for (const changed of [
        reviewedPolicy.replace("format('-isolated-{0}', github.run_id)", "'isolated'"),
        reviewedPolicy.replace("format('-isolated-{0}', github.run_id)", "format('-isolated-{0}', github.sha)"),
    ]) assert.throws(() => assertReviewedConcurrency(changed));
});

test('profile and automatic-only options reject invalid and contradictory selections', () => {
    assertReviewedConcurrency(automaticOnlyPolicy, {profile: 'workflow-ref'});
    assertReviewedConcurrency(reviewedPolicy, {profile: 'isolated'});
    assertReviewedConcurrency(automaticOnlyPolicy, {profile: 'workflow-ref', automaticOnly: true});
    assertReviewedConcurrency(reviewedPolicy, {profile: 'isolated', automaticOnly: false});
    for (const profile of ['unknown', null, true, 1]) {
        assert.throws(() => assertReviewedConcurrency(reviewedPolicy, {profile}));
    }
    for (const automaticOnly of ['true', null, 1]) {
        assert.throws(() => assertReviewedConcurrency(reviewedPolicy, {automaticOnly}));
    }
    assert.throws(() => assertReviewedConcurrency(automaticOnlyPolicy,
        {profile: 'isolated', automaticOnly: true}));
    assert.throws(() => assertReviewedConcurrency(automaticOnlyPolicy,
        {profile: 'workflow-ref', automaticOnly: false}));
});
