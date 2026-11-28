// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// New engine-argument compatibility controls; previous suites are adapters only.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'structured-branch-finally.test.cjs'),'utf8'),mod={exports:{}};
new Function('require','module','__dirname','process',source.slice(0,source.indexOf("test('actual sequencer normal"))+'\nmodule.exports={fixture,layout,trace};')(require,mod,__dirname,process);
const {fixture,layout,trace}=mod.exports;
const make=()=>{
 const v=fixture(),events=[];layout(v,{body:'throw'});trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
 v.args.mutation=v.blocks.try.mutation;
 return {v,events};
};
test('actual cached engine mutation argument permits owned catch/finally and successor',()=>{
 const {v,events}=make();v.step();assert.deepEqual(events,['catch','finally','after']);assert.deepEqual(v.errors,[]);
});
for(const shape of ['wrong-value','accessor','extra-key'])test(`canonical entry refuses ${shape} engine argument`,()=>{
 const {v,events}=make();let reads=0;
 if(shape==='wrong-value')v.args.mutation={};
 if(shape==='accessor')Object.defineProperty(v.args,'mutation',{get(){reads++;return null;},enumerable:true});
 if(shape==='extra-key')v.args.extra=null;
 assert.throws(()=>v.step(),/actual owned entry/);assert.deepEqual(events,[]);assert.equal(reads,0);
});
for(const shape of ['change','delete','accessor'])test(`live handler refuses mutation argument ${shape} after admission`,()=>{
 const {v,events}=make();let reads=0;
 v.operation('throw','arcade_throwValue',{VALUE:19},(args,util)=>{
  if(shape==='change')v.args.mutation={};
  if(shape==='delete')delete v.args.mutation;
  if(shape==='accessor')Object.defineProperty(v.args,'mutation',{get(){reads++;return null;},enumerable:true});
  return v.owner.raise(args,util);
 },{},'try');
 v.step();assert.deepEqual(events,[]);assert.equal(reads,0);assert.equal(v.errors.length,1);assert.equal(v.errors[0].message,'Arcade uncaught thrown value: 19');assert.equal(v.owner.failure(v.thread),v.errors[0]);
});
