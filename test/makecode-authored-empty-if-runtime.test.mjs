import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const source=`let hits=0
let order=0
let branch=0
function probe(value:number):number{hits+=1;order=order*10+value;return value}
if(probe(1)){}
if(probe(0)){}
if(probe(0)){}else{branch+=1}
if(probe(1)){if(probe(0)){}else{branch+=2}}else{}
if(probe(0)&&probe(9)){}
if(probe(1)||probe(9)){}else{}
if(probe(0)){}else if(probe(1)){}else{branch+=64}
if("false"){}else{branch+=1000}
if(""){}else{branch+=8}
let done=1
done+=0`;
test('authored empty If evaluates true, false, short-circuit and nested conditions once through PXT, Code and SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true});assert.equal(expected.hits,9);assert.equal(expected.order,100100101);assert.equal(expected.branch,11);assert.equal(expected.done,1);
 try{
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/PASS/);
  const check=async run=>{await stepFrames(run.vm,40);for(const key of ['hits','order','branch','done'])assert.equal(values(run)[key],expected[key],key);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[])};
  const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,countExtensionCalls:false}));
  const mixed=out.code.replace(/^( {4,})(set branch .*)$/gm,'$1PASS\n$1$2');assert.notEqual(mixed,out.code);await check(await runProgram(mixed,{frames:0,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,40);for(const key of ['hits','order','branch','done'])assert.equal(values(fresh)[key],expected[key],key+' saved');assert.deepEqual(fresh.errors,[]);
 }finally{quitStrandedVMs()}
});
test('a fault in an empty If condition still terminates its caller before later effects',async()=>{
 const fault='let actor=sprites.create(img`1`,SpriteKind.Player);let after=0;actor=null;if(actor.x){};after=1;after+=0';
 await assert.rejects(runPxtArcade(fault,{fakeClock:true}),/null|undefined|Cannot read/);
 try{
  const out=arcadeToPseudocode(fault);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/PASS/);const run=await runProgram(out.code,{frames:20,storage:true,uploads:out.costumes,countExtensionCalls:false});assert.equal(values(run).after,0);assert.ok(run.errors.length);assert.deepEqual(run.creator.warnings,[]);
 }finally{quitStrandedVMs()}
});

test('legacy PASS procedure execution is preserved beside an explicit empty branch',async()=>{
 try{const run=await runProgram('SPRITE Game:\nDEFINE PASS:\n  change hits by (1)\nWHEN flag clicked:\n  IF (1) = (1) THEN:\n    PASS\n  IF (1) = (1) THEN:\n    PASS:',{frames:5,countExtensionCalls:false});assert.equal(values(run).hits,1);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[])}finally{quitStrandedVMs()}
});
