import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const source='function sample(k:number,n:number){let a=[];for(let i=0;i<n;i++)a.push(i+1);a.reverse();return a[k]}let first=sample(0,4)+0;let middle=sample(1,4)+0;let absent=sample(99,4)+0;let negative=sample(-1,4)+0;let empty=sample(0,0)+0;let nanIndex=sample(0/0,4)+0;let infiniteIndex=sample(1/0,4)+0;let absentInt=Math.idiv(absent,1);let negativeInt=Math.idiv(negative,1);let emptyInt=Math.idiv(empty,1);let infinityInt=Math.idiv(1/0,1);function format(n:number){n=n*2;let text=""+n;return text.charAt(0)}let formatted=format(first);let done=0;done+=1;';
const expected={first:4,middle:3,absent:NaN,negative:NaN,empty:NaN,nanIndex:NaN,infiniteIndex:NaN,absentInt:0,negativeInt:0,emptyInt:0,infinityInt:0,formatted:'8',done:1};
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const check=(actual,label)=>{for(const [key,value]of Object.entries(expected))assert.deepEqual(actual[key],value,label+' '+key)};
const finish=async run=>{await stepFrames(run.vm,100,0);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);return values(run)};
test('closed local numeric read preserves reverse order, Undefined/NaN and pure String receivers through PXT/native/Code/fresh SB3',async()=>{
 const pxt=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{done:1}});check(pxt,'PXT');const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});check(await finish(run),'native');
  check(await finish(await runProgram(run.creator.decompile(),{frames:0,storage:true,countExtensionCalls:false})),'Code');
  const bytes=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(bytes);fresh.vm.greenFlag();check(await finish(fresh),'fresh SB3');
 }finally{quitStrandedVMs()}
});
