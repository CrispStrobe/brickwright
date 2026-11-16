import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {asHeldLegacyPredecessor} from './helpers/held-legacy-concurrency.mjs';
import {assertReviewedConcurrency} from './helpers/reviewed-concurrency-projections.mjs';
const names = ["ack-z80-cpm", "arcade-controls", "basic-oracle", "build", "cycle-core-qualification", "debugger", "i80386-freedos-circuits-direct-actual", "i80386-hdd-gui-actual", "i80386-native-font-selection", "i8086-execution", "makecode-arcade-bases", "mobile", "model-measurements", "native-installed-qualification", "pascal-ack-image", "reference-qualified-instruments", "robot-lab-own-firmware", "robot-model-webkit-comparison", "rust-notices", "spike-linux-package", "target-performance", "tauri", "vendor-freshness"];
const labeled = new Set(['build','i80386-freedos-circuits-direct-actual','i80386-hdd-gui-actual','i80386-native-font-selection']);
const labelSuffix = "-${{ (github.event.action == 'labeled' || github.event.action == 'unlabeled') && format('label-{0}', github.event.label.name) || 'code' }}";
const expand = (text, github) => text.replace(/\$\{\{(.*?)\}\}/g, (_, expression) => String(vm.runInNewContext(expression, {github, format: (pattern, ...args) => pattern.replace(/\{(\d+)\}/g, (_, index) => String(args[index]))})));
const sample = (overrides = {}) => ({workflow:'Workflow',ref:'refs/heads/topic',ref_type:'branch',event_name:'push',event:{action:'synchronize',label:{name:'ci:full'}},run_id:101,...overrides});
const policy = (source, github) => {
    const group = /^  group: (.*)$/m.exec(source)[1];
    const cancel = /^  cancel-in-progress: (.*)$/m.exec(source)[1];
    return {group:expand(group,github).toLowerCase(),cancel:expand(cancel,github)==='true'};
};
function check(source, labels, admit = true, preserveMain = false) {
    // Build is checked by behavior, without freezing one expression spelling.
    if (admit && !preserveMain) assertReviewedConcurrency(source,{labels});
    const get = changes => policy(source,sample(changes));
    for (const event_name of ['push','pull_request']) {
        const a = get({event_name}), b = get({event_name,run_id:102});
        assert.equal(a.group,b.group,'newer same-ref code runs supersede');
        assert.equal(a.group,'workflow-refs/heads/topic'+(labels?'-code':''),'eligible code retains exact parent group');
        assert.equal(a.cancel,true);
        assert.notEqual(a.group,get({event_name,ref:'refs/heads/other'}).group);
        assert.notEqual(a.group,get({event_name,workflow:'Other'}).group);
    }
    for (const event_name of ['push','pull_request']) {
        const a = get({event_name,ref:'refs/heads/main'});
        const b = get({event_name,ref:'refs/heads/main',run_id:102});
        assert.equal(a.group,b.group,'main retains one active and one latest pending entry');
        assert.equal(a.cancel,!(preserveMain && event_name==='push'),'only main push validation survives a newer push');
    }
    // Code event names retain the same shared-ref behavior of the policy parent.
    assert.equal(get({}).group,get({event_name:'pull_request'}).group);
    const preserved = [];
    for (const ref of ['refs/heads/main','refs/heads/topic','refs/tags/v1']) {
        for (const event_name of ['workflow_dispatch','push','pull_request','schedule','workflow_call','repository_dispatch','pull_request_target']) {
            const ref_type = ref.includes('/tags/') ? 'tag':'branch';
            if (ref_type==='branch' && ['push','pull_request'].includes(event_name)) continue;
            const a=get({ref,ref_type,event_name}),b=get({ref,ref_type,event_name,run_id:102});
            assert.equal(a.cancel,false,'preserved runs do not cancel running peers');
            assert.notEqual(a.group,b.group,'preserved runs never replace pending peers');
            assert.notEqual(a.group,get({ref}).group,'preserved run cannot replace or be replaced by code run');
            preserved.push(a);
        }
    }
    for (const ref of ['refs/heads/topic','refs/tags/v1']) {
        const ref_type=ref.includes('/tags/')?'tag':'branch';
        const preservedRuns=['workflow_dispatch','workflow_dispatch','workflow_dispatch','push','push','schedule'].map((event_name,index)=>get({ref,ref_type,event_name,run_id:300+index})).filter((_,index)=>ref_type==='tag'||index!==3&&index!==4);
        assert.equal(new Set(preservedRuns.map(x=>x.group)).size,preservedRuns.length,'distinct real run IDs survive as running and multiple pending candidates across events');
    }
    if (labels) {
        const code=get({event_name:'pull_request'});
        const label=get({event_name:'pull_request',event:{action:'labeled',label:{name:'ci:full'}}});
        assert.notEqual(code.group,label.group);
        assert.notEqual(label.group,get({event_name:'pull_request',event:{action:'labeled',label:{name:'ci:other'}}}).group);
        assert.equal(label.group,get({event_name:'pull_request',run_id:102,event:{action:'unlabeled',label:{name:'ci:full'}}}).group);
    }
}
for (const name of names) test(`${name}: event/ref isolation, pending preservation and supersession`,()=> {
    const source=readFileSync(new URL(`../.github/workflows/${name}.yml`,import.meta.url),'utf8');
    check(source,labeled.has(name),true,name==='build');
    if (name !== 'build') for (const mutation of [
        source.replace(/^concurrency:/m, 'unreviewed-concurrency:'),
        source.replace('concurrency:\n', 'concurrency:\n  extra-policy: true\n'),
        source.replace(/^  cancel-in-progress:.*$/m, match=>match+'\n\n  extra-policy: true'),
        source.replace(/^  cancel-in-progress:.*$/m, match=>match+'\n\n# continuation\n\n  extra-policy: true'),
    ]) assert.throws(()=>check(mutation,labeled.has(name),true,name==='build'),'closed policy mapping');
    if (labeled.has(name)) {
        const mutation=source.replace(labelSuffix,'');
        if (name !== 'build') assert.throws(()=>check(mutation,true),'label policy admission');
        assert.throws(()=>check(mutation,true,false,name==='build'),'label partition behavior');
    }
    for (const [title,mutation] of [
        ['old unsafe shared group',source.replace(/\$\{\{ !\(github.ref_type.*?\}\}/,'')],
        ['same-ref preservation starvation',source.replace("format('-isolated-{0}', github.run_id)","'isolated'")],
        ['manual joins supersession',source.replace("github.event_name == 'push'","github.event_name == 'workflow_dispatch'")],
        ['tags join supersession',source.replace("github.ref_type != 'tag'","github.ref_type == 'tag'")],
        ['cross-workflow collision',source.replace('${{ github.workflow }}','Workflow')],
        ['cross-ref collision',source.replace('${{ github.ref }}','ref')],
        ['always cancel',source.replace(/^  cancel-in-progress:.*$/m,'  cancel-in-progress: true')],
        ['never supersede',source.replace(/^  cancel-in-progress:.*$/m,'  cancel-in-progress: false')],
        ['unbounded extra block',source+'\nconcurrency:\n'],
    ]) {assert.notEqual(source,mutation,title); if (name !== 'build') assert.throws(()=>check(mutation,labeled.has(name)),title); if (title !== 'unbounded extra block') assert.throws(()=>check(mutation,labeled.has(name),false,name==='build'),title+' behavioral refusal');}
});


test('current cycle and model isolation preserves their exact workflow/ref predecessor', () => {
    for (const name of ['cycle-core-qualification', 'model-measurements']) {
        const current = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
        assertReviewedConcurrency(current);
        const source = asHeldLegacyPredecessor(current);
        assertReviewedConcurrency(source, {profile: 'workflow-ref'});
        assert.throws(() => assertReviewedConcurrency(source), 'old workflow cannot enter isolated profile');
        const changed = source.replace('${{ github.workflow }}', "${{ github.workflow }}${{ !(github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request')) && format('-isolated-{0}', github.run_id) || '' }}");
        assert.notEqual(changed, source);
        assert.throws(() => assertReviewedConcurrency(changed, {profile: 'workflow-ref'}),
            'isolated policy cannot enter unchanged workflow/ref profile');
        assertReviewedConcurrency(changed);
    }
    for (const name of names) {
        const source = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
        assert.throws(() => assertReviewedConcurrency(source, {labels: labeled.has(name), profile: 'workflow-ref'}),
            'isolated workflow cannot enter old workflow/ref profile');
    }
    assert.throws(() => assertReviewedConcurrency('', {profile: 'unreviewed'}));
});
