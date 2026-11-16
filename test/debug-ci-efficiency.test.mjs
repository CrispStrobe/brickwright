import test from 'node:test';
import {assertReviewedConcurrency} from './helpers/reviewed-concurrency-projections.mjs';
import {assertHeldLegacyConcurrency, asHeldLegacyPredecessor} from './helpers/held-legacy-concurrency.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

test('cycle qualification gives a cheap verdict before heavy candidate and browser work', () => {
    const workflow = read('cycle-core-qualification.yml');
    const predecessor = asHeldLegacyPredecessor(workflow);
    assertHeldLegacyConcurrency(predecessor);
    assertReviewedConcurrency(predecessor, {profile: 'workflow-ref'});
    assertReviewedConcurrency(workflow);
    const contracts = workflow.indexOf('  contracts:');
    const qualify = workflow.indexOf('  qualify:');
    assert.ok(contracts >= 0 && contracts < qualify);
    assert.match(workflow.slice(qualify), /needs: contracts/);
    assert.equal((workflow.match(/name: Static qualification contracts/g) || []).length, 1,
        'static policy tests must not be repeated after heavy qualification');
    assert.match(workflow, /timeout-minutes: 3/);
    assert.match(predecessor, /^  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}$/m);
    assert.match(predecessor, /^  cancel-in-progress: \$\{\{ github\.ref_type != 'tag' && \(github\.event_name == 'push' \|\| github\.event_name == 'pull_request'\) \}\}$/m);
    const browser = workflow.slice(workflow.indexOf('- name: Install the qualification browser'),
        workflow.indexOf('- uses: actions/upload-artifact'));
    assert.doesNotMatch(browser, /if: always\(\)/,
        'failed native qualification must not spend runner minutes downloading Chromium');
    assert.match(workflow, /actions\/upload-artifact@[\s\S]*if: always\(\)/,
        'failure evidence must still be retained');
});

test('focused debugger CI front-loads dependency-free contracts and caches its only install', () => {
    const workflow = read('debugger.yml');
    assert.ok(workflow.indexOf('  contracts:') < workflow.indexOf('  focused:'));
    assert.match(workflow.slice(workflow.indexOf('  focused:')), /needs: contracts/);
    assert.match(workflow, /cache-dependency-path: packages\/scratch-gui\/package-lock\.json/);
    assert.match(workflow, /overlay\/scratch-gui\/src\/components\/tw-pseudocode\/debug-\*\.jsx/);
    assert.doesNotMatch(workflow.slice(workflow.indexOf('  contracts:'), workflow.indexOf('  focused:')),
        /npm install|npm run vendor|playwright|integrate\.mjs/);
});
