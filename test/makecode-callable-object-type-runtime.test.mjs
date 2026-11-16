import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const source='let calls=0;function calculate(unused:()=>{}, n:number):number {calls++;return n+7};let result=calculate(function(){return 9},5);result+=0;let following=3;following+=0;';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
test('an erased callable object-result parameter preserves actual ordinary body and following statements through PXT/native/Code/fresh SB3',async()=>{
 const original=await runPxtArcade(source,{fakeClock:true});assert.equal(original.calls,1);assert.equal(original.result,12);assert.equal(original.following,3);
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);const check=run=>{assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);for(const n of ['calls','result','following'])assert.equal(values(run)[n],original[n],n)};
 try{const run=await runProgram(out.code,{frames:30,storage:true});check(run);check(await runProgram(run.creator.decompile(),{frames:30,storage:true}));const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,30);check(fresh)}finally{quitStrandedVMs()}
});
