import assert from 'node:assert/strict';

// Exact policy from the reviewed workflow/ref cancellation change. A projection
// changes only this block; historical hashes still bind every other byte.
export const reviewedPolicy = "concurrency:\n  group: ${{ github.workflow }}${{ !(github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request')) && format('-isolated-{0}', github.run_id) || '' }}-${{ github.ref }}\n  cancel-in-progress: ${{ github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request') }}\n";
export const workflowRefPolicy = "concurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: ${{ github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request') }}\n";
// Main's earlier public option names the same exact workflow/ref policy.
// Keep both explicit interfaces; conflicting or unknown selections refuse.
export const automaticOnlyPolicy = workflowRefPolicy;
const labelSuffix = "-${{ (github.event.action == 'labeled' || github.event.action == 'unlabeled') && format('label-{0}', github.event.label.name) || 'code' }}";
export const assertReviewedConcurrency = (text, {labels = false, profile, automaticOnly} = {}) => {
    assert.ok(profile === undefined || ['isolated', 'workflow-ref'].includes(profile), 'explicit reviewed concurrency profile');
    assert.ok(automaticOnly === undefined || typeof automaticOnly === 'boolean', 'explicit automatic-only selection');
    const aliasProfile = automaticOnly === undefined ? undefined : automaticOnly ? 'workflow-ref' : 'isolated';
    assert.ok(profile === undefined || aliasProfile === undefined || profile === aliasProfile, 'concurrency selections agree');
    const sourcePolicy = (profile ?? aliasProfile ?? 'isolated') === 'workflow-ref' ? workflowRefPolicy : reviewedPolicy;
    const policy = labels ? sourcePolicy.replace('${{ github.ref }}', '${{ github.ref }}' + labelSuffix) : sourcePolicy;
    assert.equal((text.match(/^concurrency:/gm) || []).length, 1, 'one workflow concurrency block');
    const heading = /^concurrency:\n/m.exec(text);
    assert.ok(heading, 'workflow concurrency mapping exists');
    const rest = text.slice(heading.index + heading[0].length);
    const end = /^[A-Za-z_][A-Za-z0-9_-]*:/m.exec(rest)?.index ?? rest.length;
    const block = heading[0] + rest.slice(0, end).replace(/\n+$/, '\n');
    assert.equal(block, policy, 'exact reviewed workflow/ref cancellation policy');
};
export const studyBeforeConcurrencyPolicy = (file, text) => {
    if (file !== '.github/workflows/reference-qualified-instruments.yml') return text;
    try { assertReviewedConcurrency(text); } catch (cause) {
        throw new Error('sealed completed-study source changed: exact reviewed scheduler policy required', {cause});
    }
    return text.replace(reviewedPolicy, "concurrency:\n  group: reference-qualified-instruments-${{ github.event_name }}-${{ github.sha }}\n  cancel-in-progress: false\n\n");
};

// Exact source-only delta of the separately reviewed HDD workflow projection
// repair. Restore it before comparing the unchanged historical source digest.
const hddHelper = "// Policy 4be93d2bfd422acdc3f776a73b72d099813538e1 changed only these\n// concurrency bytes in the held workflows. Admit the exact new policy, then\n// restore its exact predecessor bytes so every historical digest stays binding.\nconst reviewedConcurrency = \"concurrency:\\n\" +\n    \"  group: ${{ github.workflow }}${{ !(github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request')) && format('-isolated-{0}', github.run_id) || '' }}-${{ github.ref }}\";\nconst reviewedCancellation = \"\\n  cancel-in-progress: ${{ github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request') }}\\n\";\nconst concurrencyPredecessors = new Map([\n    ['i80386-hdd-gui-actual', \"concurrency:\\n  group: gui-hdd-${{ github.event.pull_request.head.sha || github.sha }}-${{ github.event_name }}\\n  cancel-in-progress: false\\n\\n\"],\n    ['ack-z80-cpm', ''], ['basic-oracle', ''], ['target-performance', ''],\n    ['makecode-arcade-bases', \"concurrency:\\n  group: makecode-arcade-bases-${{ github.ref }}\\n  cancel-in-progress: true\\n\\n\"],\n    ['pascal-ack-image', \"concurrency:\\n  group: pascal-ack-image-${{ github.ref }}\\n  cancel-in-progress: true\\n\\n\"],\n    ['rust-notices', \"concurrency:\\n  group: rust-notices-${{ github.head_ref || github.ref_name }}\\n  cancel-in-progress: true\\n\\n\"],\n]);\nconst heldBeforeConcurrencyPolicy = (name, workflow) => {\n    assert.ok(concurrencyPredecessors.has(name), `${name}: explicitly reviewed policy scope`);\n    const labelGroup = name === 'i80386-hdd-gui-actual' ?\n        \"-${{ (github.event.action == 'labeled' || github.event.action == 'unlabeled') && format('label-{0}', github.event.label.name) || 'code' }}\" : '';\n    const predecessor = concurrencyPredecessors.get(name);\n    const policy = reviewedConcurrency + labelGroup + reviewedCancellation + (predecessor === '' ? '\\n' : '');\n    assert.equal((workflow.match(/^concurrency:/gm) || []).length, 1, `${name}: one workflow concurrency block`);\n    assert.equal(workflow.split(policy).length, 2, `${name}: exact reviewed concurrency policy`);\n    return workflow.replace(policy, predecessor);\n};\n\ntest('reviewed concurrency projection rejects missing, duplicate and altered policy', () => {\n    for (const name of concurrencyPredecessors.keys()) {\n        const workflow = fs.readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');\n        const held = heldBeforeConcurrencyPolicy(name, workflow);\n        for (const mutation of [\n            workflow.replace('concurrency:', 'unreviewed-concurrency:'),\n            workflow + '\\nconcurrency:\\n',\n            workflow.replace('${{ github.workflow }}', 'different-workflow'),\n            workflow.replace(\"github.ref_type != 'tag'\", \"github.ref_type == 'tag'\"),\n            workflow.replace(\"github.event_name == 'push'\", \"github.event_name == 'workflow_dispatch'\"),\n            workflow.replace(\"github.event_name == 'pull_request')\", \"github.event_name == 'pull_request_target')\"),\n            workflow.replace(reviewedCancellation, '\\n  cancel-in-progress: true\\n'),\n        ]) assert.throws(() => heldBeforeConcurrencyPolicy(name, mutation), `${name}: policy drift refuses`);\n        // The projection must preserve even one unrelated byte for the old digest\n        // to reject; it cannot normalize a trigger, job, step or cap modification.\n        assert.equal(heldBeforeConcurrencyPolicy(name, workflow + '# unrelated drift\\n'), held + '# unrelated drift\\n');\n    }\n    assert.throws(() => heldBeforeConcurrencyPolicy('unreviewed-workflow', ''));\n});\n\n";
const hddReplacements = [
    [
        "const workflow = heldBeforeConcurrencyPolicy('i80386-hdd-gui-actual',\n        fs.readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml',import.meta.url),'utf8'));",
        "const workflow = fs.readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml',import.meta.url),'utf8');"
    ],
    [
        "createHash('sha256').update(heldBeforeConcurrencyPolicy(name,workflow).replace(block,'  push:\\n'))",
        "createHash('sha256').update(workflow.replace(block,'  push:\\n'))"
    ],
    [
        "createHash('sha256').update(heldBeforeConcurrencyPolicy('rust-notices',workflow))",
        "createHash('sha256').update(workflow)"
    ]
];
export const hddBeforeConcurrencyControl = (file, text) => {
    if (file !== 'test/i80386-hdd-gui-actual.test.mjs') return text;
    assert.equal(text.split(hddHelper).length, 2, 'exact reviewed HDD projection helper');
    let held = text.replace(hddHelper, '');
    for (const [current, previous] of hddReplacements) {
        assert.equal(held.split(current).length, 2, 'one exact reviewed HDD projection call');
        held = held.replace(current, previous);
    }
    return held;
};

// Occurrence recognizers refuse malformed source by returning no positions.
export const hddHistoricalHashBody = (file, text) => {
    try { return hddBeforeConcurrencyControl(file, text); } catch { return ''; }
};

export const modelWorkflowBeforeConcurrencyPolicy = text => {
    assertReviewedConcurrency(text, {profile: 'workflow-ref'});
    assert.equal(text.split(workflowRefPolicy + '\n').length, 2, 'exact inserted model policy extent');
    return text.replace(workflowRefPolicy + '\n', '');
};
