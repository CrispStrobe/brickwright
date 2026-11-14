import test from 'node:test';
import assert from 'node:assert/strict';
import {source} from './fixtures/reset-closed-string-array.mjs';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
test('closed String-array read keeps original lookup count and result through actual Code and saved SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true,inspectArrayReads:['labels']});assert.equal(expected.found,1);assert.deepEqual(expected.$arrayReads.labels,[0,1]);
 try{
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade reset game/);
  const exercise=async run=>{
   const blocks=run.vm.runtime.targets.flatMap(target=>Object.values(target.blocks._blocks));const reads=blocks.filter(block=>block.opcode.startsWith('arrays_')&&block.inputs.INDEX&&!block.inputs.VALUE);
   assert.equal(reads.length,1,JSON.stringify(reads.map(row=>({opcode:row.opcode,keys:Object.keys(row.inputs)}))));const opcode=reads[0].opcode,original=run.vm.runtime._primitives[opcode],seen=[];assert.equal(typeof original,'function');
   run.vm.runtime._primitives[opcode]=(args,util)=>{seen.push(Number(args.INDEX));return original(args,util)};
   await stepFrames(run.vm,8);assert.equal(values(run).found,expected.found);assert.deepEqual(seen,expected.$arrayReads.labels);assert.deepEqual(run.errors,[]);
  };
  const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});await exercise(run);
  await exercise(await runProgram(run.creator.decompile(),{frames:0,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await exercise(fresh);
 }finally{quitStrandedVMs()}
});
