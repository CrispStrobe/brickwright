import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {createRequire} from 'node:module';import {VM_SRC} from './helpers/bw-extensions.mjs';
const BW=createRequire(import.meta.url)(VM_SRC+'/util/bw-values.js');
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
test('pure null filter is synchronous, fresh, ordered and handle-preserving against PXT through Code and fresh SB3',async()=>{
 const source=`let items:Sprite[]=[]
let a=sprites.create(img\`1\`,SpriteKind.Player)
let b=sprites.create(img\`2\`,SpriteKind.Player)
let c=sprites.create(img\`3\`,SpriteKind.Player)
a.x=11;b.x=22;c.x=33
items.push(a);items.push(b);items.push(c)
for(let i=0;i<items.length;i++){if(i===1)items[i]=null}
let before=game.runtime()
items=items.filter(value=>value!=null)
let after=game.runtime()
let count=items.length
let order=0
for(let i=0;i<items.length;i++){order=order*100+items[i].x}
items=items.filter(value=>value!=null)
let again=items.length
let done=1;done+=0`;
 const expected=await runPxtArcade(source,{fakeClock:true});assert.equal(expected.count,2);assert.equal(expected.order,1133);assert.equal(expected.again,2);assert.equal(expected.before,expected.after);
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.equal((out.code.match(/without null/g)||[]).length,2);
 const observed=[],raw=new Map();
 const instrument=run=>{
  const runtime=run.vm.runtime,original=runtime._primitives.arcade_withoutNullSprites;assert.equal(typeof original,'function');raw.set(runtime,original);
  runtime._primitives.arcade_withoutNullSprites=(args,util)=>{
   const body=BW.arrayValue(runtime,args.ARRAY),snapshot=body.slice(),status=util.thread.status,clock=runtime.currentMSecs;
   const yieldMethod=util.yield;let yields=0;util.yield=function(...args){yields++;return yieldMethod.apply(this,args)};
   let result;try{result=original(args,util)}finally{util.yield=yieldMethod}
   assert.ok(!result?.then,'native reporter never returns a Promise');assert.equal(yields,0);assert.equal(util.thread.status,status);assert.equal(runtime.currentMSecs,clock);
   const fresh=BW.arrayValue(runtime,result);assert.ok(Array.isArray(fresh));assert.notEqual(fresh,body);assert.deepEqual(body,snapshot);assert.deepEqual(fresh,snapshot.filter(value=>value!==null));observed.push({before:body.length,after:fresh.length,yields});return result;
  };
 };
 const check=async run=>{instrument(run);await stepFrames(run.vm,40);for(const key of ['count','order','again','done'])assert.equal(values(run)[key],expected[key],key);assert.equal(values(run).before,values(run).after);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[])};
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,uploads:out.costumes,countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,uploads:out.costumes,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);instrument(fresh);fresh.vm.greenFlag();await stepFrames(fresh.vm,40);for(const key of ['count','order','again','done'])assert.equal(values(fresh)[key],expected[key],key+' SB3');assert.equal(values(fresh).before,values(fresh).after);assert.deepEqual(fresh.errors,[]);assert.equal(observed.length,6);
  const primitive=raw.get(fresh.vm.runtime);const errorsBefore=fresh.errors.length;
  let getters=0;const accessor=[];Object.defineProperty(accessor,'0',{get(){getters++;return null},enumerable:true});
  const invalidBodies=[new Array(2),[undefined],[5],[{}],accessor,Object.setPrototypeOf([null],null)];
  for(const invalid of invalidBodies){
   const result=primitive.call(null,{ARRAY:BW.arrayReference(fresh.vm.runtime,invalid)},{thread:{status:1},yield(){throw Error('unexpected yield')}});assert.equal(BW.decode(result),undefined);
  }
  assert.equal(getters,0);assert.equal(fresh.errors.length,errorsBefore+invalidBodies.length);
 }finally{quitStrandedVMs()}
});
