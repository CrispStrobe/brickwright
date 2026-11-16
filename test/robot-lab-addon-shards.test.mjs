// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseJobs,shardsOf} from '../scripts/lib/workflow-gates.mjs';

const workflow=readFileSync(new URL('../.github/workflows/build.yml',import.meta.url),'utf8');
const job=parseJobs(workflow).get('browser'),lines=workflow.split('\n');
const cases=[
    ['counterturn complete example','counterturn','robotaddon4'],
    ['snapgate complete example','snapgate','robotaddon4'],
    ['echo-bridge complete example','echo-bridge','robotaddon4'],
    ['resonance complete experiments','resonance-lab','robotaddon4'],
    ['new model deliveries','cusp-lab,product-plotter,gimbal-lab,sky-courier','robotaddon4'],
    ['SineShuttle and Quartermaster complete examples','sine-shuttle,quartermaster','robotaddon5'],
    ['Watt Line and TwinTempo complete examples','watt-line,twin-tempo','robotaddon5'],
    ['root-bridge complete example','root-bridge','robotaddon6'],
    ['balance-engine complete example','balance-engine','robotaddon6'],
    ['linger complete example','linger','robotaddon6'],
    ['crossline complete example','crossline','robotaddon6']
];
test('the published addon gates remain unique with their exact commands and acceptance bounds',()=>{
    assert.equal(job.timeout,30,'Outer budget remains unchanged');
    const assigned=new Map();
    for(const [label,models,shard] of cases){
        const name='Browser gate — Robot Lab '+label,hits=job.steps.filter(s=>s.name===name);
        assert.equal(hits.length,1,'Exactly one existing gate: '+name);
        const step=hits[0];assert.deepEqual(shardsOf(step),[shard],name);
        assert.equal(step.timeout,8,'Original individual timeout: '+name);
        assert.equal(step.ifs,"${{ !cancelled() && steps.serve.outcome == 'success' && matrix.shard == '"+shard+"' }}",'Original non-selector fences: '+name);
        const at=job.steps.indexOf(step),end=job.steps[at+1]?.line-1||lines.length,body=lines.slice(step.line-1,end).join('\n');
        const commands=[...body.matchAll(/^        run: (.*)$/gm)].map(m=>m[1]);
        assert.deepEqual(commands,['npm run verify:sim-lab -- --part=examples --examples='+models],'Original unchanged oracle invocation: '+name);
        assigned.set(name,shard);
    }
    assert.equal(assigned.size,11,'No omitted or duplicated published gate');
});
test('additional addon shards use the existing Robot Lab scope predicate',()=>{
    for(const shard of ['robotaddon5','robotaddon6','robotaddon7','robotaddon8','robotaddon9','robotaddon10','robotaddon11','robotaddon12','robotaddon13','robotaddon14','robotaddon15','robotaddon16','robotaddon18','robotaddon19','robotaddon22','robotaddon24']){
        assert.equal(job.shards.filter(s=>s===shard).length,1,'Unique matrix registration');
        const exclusion="          - shard: ${{ needs.scope.outputs.robotlab != 'true' && '"+shard+"' || 'none' }}";
        assert.equal(lines.filter(line=>line===exclusion).length,1,'Same existing path-scope predicate');
    }
});

test('all newly delivered primary experiments have one complete journey with unchanged budgets',()=>{
    const deliveries={robotaddon7:['wavemaker','cascade','rise-ratio','cable-compass'],
        robotaddon8:['rod-ratio','vernier-drive','line-turner','dune-strider','oblique'],robotaddon9:['atlas-six'],robotaddon10:['helixgate','looprelay','paritydial'],
        robotaddon11:['counterslide','toggle-press','footfall'],robotaddon12:['phasekeeper','vectorsum','pointweaver']};
    const selectors=[...workflow.matchAll(/--part=examples --examples=([^\s]+)/g)].flatMap(m=>m[1].split(','));
    for(const [shard,models]of Object.entries(deliveries))for(const id of models){
        assert.equal(selectors.filter(value=>value===id).length,1,'No omitted or duplicated selector: '+id);
        const steps=job.steps.filter(s=>s.name==='Browser gate — Robot Lab '+id+' intake');assert.equal(steps.length,1,id);
        const step=steps[0];assert.deepEqual(shardsOf(step),[shard]);assert.equal(step.timeout,8);
        assert.equal(step.ifs,"${{ !cancelled() && steps.serve.outcome == 'success' && matrix.shard == '"+shard+"' }}");
        const at=job.steps.indexOf(step),end=job.steps[at+1]?.line-1||lines.length,body=lines.slice(step.line-1,end).join('\n');
        assert.deepEqual([...body.matchAll(/^        run: (.*)$/gm)].map(m=>m[1]),['npm run verify:sim-lab -- --part=examples --examples='+id+(id==='atlas-six'?' --intake-capture=atlas-six':'')]);
    }
});

test('the promotions Evenhand, RimRun (Q5), Obliquity Orrery (R1) and the R2 family and Apex (R3) each have one browser gate on their own shard',()=>{
    const selectors=[...workflow.matchAll(/--part=examples --examples=([^\s]+)/g)].flatMap(m=>m[1].split(','));
    for(const [shard,id]of [['robotaddon13','evenhand'],['robotaddon14','rimrun'],['robotaddon15','obliquity-orrery'],['robotaddon16','cadence-geneva'],['robotaddon18','helios-transmission'],['robotaddon19','orion-cardan'],['robotaddon22','apex'],['robotaddon24','tempest-pendulum']]){
        assert.equal(selectors.filter(value=>value===id).length,1,'No omitted or duplicated selector: '+id);
        const steps=job.steps.filter(s=>s.name==='Browser gate — Robot Lab '+id+' promotion');assert.equal(steps.length,1,id);
        const step=steps[0];assert.deepEqual(shardsOf(step),[shard]);
        assert.equal(step.ifs,"${{ !cancelled() && steps.serve.outcome == 'success' && matrix.shard == '"+shard+"' }}");
        const at=job.steps.indexOf(step),end=job.steps[at+1]?.line-1||lines.length,body=lines.slice(step.line-1,end).join('\n');
        assert.deepEqual([...body.matchAll(/^        run: (.*)$/gm)].map(m=>m[1]),['npm run verify:sim-lab -- --part=examples --examples='+id]);
    }
});

test('Cross Ratio adds one bounded gate to addon1 without redistributing existing cases',()=>{
 const name='Browser gate — Robot Lab Cross Ratio complete example';
 const hits=job.steps.filter(s=>s.name===name);assert.equal(hits.length,1);
 const step=hits[0];assert.deepEqual(shardsOf(step),['robotaddon1']);
 assert.equal(step.timeout,8);assert.equal(job.timeout,30);
 assert.equal(step.ifs,"${{ !cancelled() && steps.serve.outcome == 'success' && matrix.shard == 'robotaddon1' }}");
 const at=job.steps.indexOf(step),end=job.steps[at+1]?.line-1||lines.length;
 assert.match(lines.slice(step.line-1,end).join('\n'),/^        run: npm run verify:sim-lab -- --part=examples --examples=cross-ratio$/m);
});
