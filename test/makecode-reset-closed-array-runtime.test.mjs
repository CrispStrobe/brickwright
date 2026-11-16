import test from 'node:test';
import assert from 'node:assert/strict';
import {source} from './fixtures/reset-closed-string-array.mjs';
import {createRequire} from 'node:module';
import {guiDependencyFile} from './helpers/bw-integrated.mjs';
// The stock profiler captures the real Performance API at module load. Load
// only that class with Node's actual clock, then restore headless globals before
// the VM/SVG renderer loads. No guest or primitive implementation is replaced.
const withPerformanceWindow=fn=>{const prior=Object.getOwnPropertyDescriptor(globalThis,'window');assert.ok(globalThis.performance&&typeof globalThis.performance.now==='function');Object.defineProperty(globalThis,'window',{value:{performance:globalThis.performance},configurable:true,writable:true});try{return fn();}finally{if(prior)Object.defineProperty(globalThis,'window',prior);else delete globalThis.window;}};
const require=createRequire(import.meta.url),profilerFile=guiDependencyFile('scratch-vm/src/engine/profiler.js');
assert.equal(require.cache[require.resolve(profilerFile)],undefined,'profiler clock is captured before the VM loads');
const NativeProfiler=withPerformanceWindow(()=>require(profilerFile));
const {arcadeToPseudocode}=await import('../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js');
const {runPxtArcade}=await import('./helpers/pxt-arcade-runtime.mjs');
const {runProgram,stepFrames,quitStrandedVMs}=await import('./helpers/bw-vm.mjs');
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
test('closed String-array read keeps original lookup count and result through actual Code and saved SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true,inspectArrayReads:['labels']});assert.equal(expected.found,1);assert.deepEqual(expected.$arrayReads.labels,[0,1]);
 try{
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade reset game/);
  const exercise=async run=>{
   const blocks=run.vm.runtime.targets.flatMap(target=>Object.values(target.blocks._blocks));const reads=blocks.filter(block=>block.opcode.startsWith('arrays_')&&block.inputs.INDEX&&!block.inputs.VALUE);
   assert.equal(reads.length,1,JSON.stringify(reads.map(row=>({opcode:row.opcode,keys:Object.keys(row.inputs)}))));const opcode=reads[0].opcode,original=run.vm.runtime._primitives[opcode],seen=[];assert.equal(typeof original,'function');
   // Observe the real VM profiler's completed-block counter. Replacing the
   // primitive invalidates its independent constructor/metadata owner binding.
   const runtime=run.vm.runtime,readTarget=runtime.targets.find(target=>target.blocks.getBlock(reads[0].id));assert.ok(readTarget);withPerformanceWindow(()=>runtime.enableProfiling(()=>{}));assert.ok(runtime.profiler);assert.ok(runtime.profiler instanceof NativeProfiler);
   const frame=runtime.profiler.frame(runtime.profiler.idByName('blockFunction'),opcode);let count=frame.count;
   Object.defineProperty(frame,'count',{configurable:true,enumerable:true,get:()=>count,set:next=>{
    if(next===count+1){const actual=[...new Set(Object.values(readTarget.blocks._cache._executeCached).flatMap(cache=>cache._ops||[]).filter(operation=>operation.id===reads[0].id&&operation._profilerFrame===frame))];assert.equal(actual?.length,1);assert.strictEqual(actual[0]._blockFunction,original);const index=Object.getOwnPropertyDescriptor(actual[0]._argValues,'INDEX');assert.ok(index&&Object.hasOwn(index,'value'));assert.ok(['number','string'].includes(typeof index.value));seen.push(Number(index.value));}count=next;
   }});
   try{await stepFrames(run.vm,8);}finally{runtime.disableProfiling();}
   assert.strictEqual(runtime._primitives[opcode],original,'observer never replaces the owned primitive');assert.equal(values(run).found,expected.found);assert.deepEqual(seen,expected.$arrayReads.labels);assert.deepEqual(run.errors,[]);
  };
  const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});await exercise(run);
  await exercise(await runProgram(run.creator.decompile(),{frames:0,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await exercise(fresh);
 }finally{quitStrandedVMs()}
});
