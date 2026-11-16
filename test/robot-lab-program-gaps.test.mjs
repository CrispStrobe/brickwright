// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {programGapErrors} from '../scripts/lib/robot-lab-program-gaps.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../docs/data/'+name,import.meta.url)));
const matrix=read('robot-lab-program-gaps-20261114.json'),inventory=read('robot-lab-experimental-checkpoint.json').models;
test('gap list covers inventory exactly and working entries retain terminal, runner and actual output evidence',()=>assert.deepEqual(programGapErrors(matrix,inventory),[]));
test('summary and bounded smoke cannot conceal missing completion or output evidence',()=>{
    for(const mutate of [m=>m.models.pop(),m=>m.models.push(m.models[0]),m=>m.summary.working++,m=>{const r=m.models.find(r=>r.status==='WORKING');delete r.latestCompletionRun.outputMeasurement;delete r.latestCompletionRun.outputMeasurements;},m=>{m.models.find(r=>r.status==='WORKING').latestCompletionRun.execution='BOUNDED_PARTIAL';},m=>{m.models.find(r=>r.status==='WORKING').latestCompletionRun.programKind='DIAGNOSTIC_MOTOR_SMOKE';},m=>{const r=m.models[0];r.status='WORKING';r.gaps=[];delete r.latestCompletionRun;}]){const altered=structuredClone(matrix);mutate(altered);assert.notEqual(programGapErrors(altered,inventory).length,0);}
});
test('pressure evidence is validated as pressure rather than translation',()=>{
    const m=structuredClone(matrix),r=m.models.find(r=>r.status==='WORKING');
    r.latestCompletionRun.outputMeasurements=[{type:'air-pressure',samples:10,invalid:false,networks:{air:{initialKpa:150,minKpa:150,maxKpa:160,finalKpa:160}}}];
    assert.deepEqual(programGapErrors(m,inventory),[]);r.latestCompletionRun.outputMeasurements[0].networks.air.maxKpa=NaN;assert.ok(programGapErrors(m,inventory).some(e=>e.endsWith('valid-output-missing')));
});

test('working evidence requires integer sample counts of at least two',()=>{
    for(const samples of [undefined,NaN,Infinity,1.5,'3',null,0,1]){
        const altered=structuredClone(matrix),row=altered.models.find(r=>r.status==='WORKING');
        const output=(row.latestCompletionRun.outputMeasurements||[row.latestCompletionRun.outputMeasurement])[0];
        if(samples===undefined)delete output.samples;else output.samples=samples;
        assert.ok(programGapErrors(altered,inventory).includes(row.id+':valid-output-missing'),String(samples));
    }
    const altered=structuredClone(matrix),row=altered.models.find(r=>r.status==='WORKING');
    (row.latestCompletionRun.outputMeasurements||[row.latestCompletionRun.outputMeasurement])[0].samples=2;
    assert.deepEqual(programGapErrors(altered,inventory),[]);
});

test('prototype property names are invalid statuses',()=>{
    for(const status of ['constructor','__proto__','toString']){
        const altered={models:[{id:'example',status,gaps:['reason']}],summary:{total:1,working:0,partial:0,blocked:0}};
        assert.ok(programGapErrors(altered,[{id:'example'}]).includes('example:invalid-status'),status);
    }
});
test('working evidence retains every required output channel',()=>{
    const altered=structuredClone(matrix),row=altered.models.find(r=>r.id==='kestrel-flapper');
    assert.equal(row.latestCompletionRun.outputMeasurements.length,2);
    row.latestCompletionRun.outputMeasurements.pop();
    assert.ok(programGapErrors(altered,inventory).includes('kestrel-flapper:output-channel-count'));
});
