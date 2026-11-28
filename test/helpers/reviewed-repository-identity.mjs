import assert from 'node:assert/strict';
import {hddBeforeCrispBasicNoticeControl} from './reviewed-basic-oracle-notice.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// The repository rename changed four complete guards, not their event, actor,
// attempt or retirement policy. Their exact inverse retains the historical
// workflow digest. The separate source inverse retains every older test seal.
const raw = readFileSync(new URL('../fixtures/i80386-repository-identity-review.json', import.meta.url));
assert.equal(createHash('sha256').update(raw).digest('hex'), '4288f9c69a6bf8e945a4673dd59e84d34c95e207c1cbe4f3e70326c3dde67fce');
const review = JSON.parse(raw);
assert.equal(review.schema, 'bw.x86-repository-identity-review.v1');
assert.equal(review.file, 'test/i80386-hdd-gui-actual.test.mjs');
assert.equal(review.changes.length, 6);
assert.equal(review.workflow.file, '.github/workflows/i80386-hdd-gui-actual.yml');
assert.deepEqual(review.workflow.guards.map(row => row.job),
    ['actual-v8', 'actual-v9', 'font-bridge', 'font-discovery']);
const previousIdentity = "github.repository == 'CrispStrobe/brickwright-lite'";
const currentIdentity = "github.repository_id == '1291854269'";
for (const {job, before, after} of review.workflow.guards) {
    assert.ok(after.startsWith(`  ${job}:\n    if: >-\n`), 'exact named job predicate');
    assert.equal(before.split(previousIdentity).length, 2, 'one historical identity in the guard');
    assert.equal(after.split(currentIdentity).length, 2, 'one current identity in the guard');
    assert.equal(after, before.replace(previousIdentity, currentIdentity),
        'the reviewed workflow delta changes only repository identity');
}
const invert = (text, changes, label) => {
    let held = text;
    for (const {before, after} of changes) {
        assert.equal(held.split(after).length, 2, `one exact reviewed ${label} hunk`);
        held = held.replace(after, before);
    }
    return held;
};

export const hddWorkflowBeforeRepositoryIdentity = (file, text) => {
    assert.equal(file, review.workflow.file, 'explicit reviewed HDD workflow scope');
    assert.equal((text.match(/\bgithub\.repository_id\b/g) || []).length, 4,
        'four exact reviewed repository identity guards, no surplus positions');
    assert.equal(text.split(previousIdentity).length, 1, 'no obsolete live repository-name guard');
    for (const {job} of review.workflow.guards) {
        assert.equal(text.split(`\n  ${job}:\n`).length, 2, 'one exact reviewed repository identity job');
    }
    return invert(text, review.workflow.guards, 'repository identity guard');
};

// Only these exact source hunks are inverted. An unrelated byte survives and
// is rejected by the unchanged downstream historical source profile.
export const hddBeforeRepositoryIdentityControl = (file, text) => {
    if (file !== review.file) return text;
    return invert(hddBeforeCrispBasicNoticeControl(file, text), review.changes, 'repository identity source');
};
