// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {retainFrame,createMotorSummary,observeMotorSummary,finishMotorSummary,createMeasurementWriter} from '../scripts/lib/robot-lab-run-retention.mjs';
import {summarizeMotor} from '../scripts/lib/robot-lab-functional.mjs';
test('opt-in last-frame retention preserves exact final time and errors without growing history',()=>{const full=[],last=[];for(let i=0;i<1000;i++){const f={t:i*1000/30,error:i===999?'terminal-failure':null};retainFrame(full,f);retainFrame(last,f,false);}assert.equal(full.length,1000);assert.equal(last.length,1);assert.deepEqual(last[0],full.at(-1));});
test('incremental motor observations preserve movement, fault and stationary classifications',()=>{for(const samples of [[{position:0},{position:2,nonzeroDrive:true,mode:'position'}],[{position:0},{position:NaN}],[{position:0},{position:0,nonzeroDrive:true}]]){const summary=createMotorSummary();samples.forEach(s=>observeMotorSummary(summary,s));assert.deepEqual(finishMotorSummary(summary),summarizeMotor(samples));}});
test('stream produces exact ordered JSON samples and closes on success or abort',()=>{const dir=mkdtempSync(join(tmpdir(),'robot-measurement-'));try{const path=join(dir,'measurement.json'),writer=createMeasurementWriter(path,{schema:1,part:'test'});writer.append({t:1,position:[1,2,3]});writer.append({t:2,error:'observed'});assert.equal(writer.count,2);writer.finish();assert.deepEqual(JSON.parse(readFileSync(path)),{schema:1,part:'test',samples:[{t:1,position:[1,2,3]},{t:2,error:'observed'}]});assert.throws(()=>writer.append({}),/closed/);const failed=createMeasurementWriter(join(dir,'aborted.json'),{schema:1});assert.throws(()=>failed.append({bad:1n}),/BigInt/);failed.abort();assert.throws(()=>failed.append({}),/closed/);}finally{rmSync(dir,{recursive:true,force:true});}});

test('longer execution bounds require explicit bounded-memory opt-in',()=>{const dir=mkdtempSync(join(tmpdir(),'robot-bounds-'));try{const script=fileURLToPath(new URL('../scripts/test-robot-lab-functional.mjs',import.meta.url)),args=[script,'--sim-ms=1000000','--wall-ms=1200000','--models=unknown-model','--out='+dir];const normal=spawnSync(process.execPath,args,{encoding:'utf8'});assert.match(normal.stderr,/at most 600000/);const bounded=spawnSync(process.execPath,[...args,'--bounded-memory'],{encoding:'utf8'});assert.match(bounded.stderr,/Unknown model/);assert.doesNotMatch(bounded.stderr,/at most/);}finally{rmSync(dir,{recursive:true,force:true});}});
