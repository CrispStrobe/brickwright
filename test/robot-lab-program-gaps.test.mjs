// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {programGapErrors} from '../scripts/lib/robot-lab-program-gaps.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../docs/data/'+name,import.meta.url)));
const matrix=read('robot-lab-program-gaps-20261114.json'),inventory=read('robot-lab-experimental-checkpoint.json').models;
test('gap list covers inventory exactly and working entries retain terminal, runner and actual output evidence',()=>assert.deepEqual(programGapErrors(matrix,inventory),[]));
test('summary and bounded smoke cannot conceal missing completion or output evidence',()=>{
    for(const mutate of [m=>m.models.pop(),m=>m.models.push(m.models[0]),m=>m.summary.working++,m=>{const r=m.models.find(r=>r.status==='WORKING');delete r.latestCompletionRun.outputMeasurement;delete r.latestCompletionRun.outputMeasurements;},m=>{m.models.find(r=>r.status==='WORKING').latestCompletionRun.execution='BOUNDED_PARTIAL';},m=>{const r=m.models.find(r=>r.status==='PARTIAL');r.status='WORKING';r.gaps=[];}]){const altered=structuredClone(matrix);mutate(altered);assert.notEqual(programGapErrors(altered,inventory).length,0);}
});
