// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// New consumers for compiler-emitted TOKEN/CAPTURES registrations. Selected
// real registration, callback, Thread, execute and Sequencer bodies; authored
// blocks/services. This does not admit try syntax or qualify a full project.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'structured-branch-finally.test.cjs'),'utf8');
const mod={exports:{}};
new Function('require','module','__dirname','process',source.slice(0,source.indexOf("test('actual sequencer normal"))+'\nmodule.exports={fixture,layout,trace,Thread,primitive};')(require,mod,__dirname,process);
const {fixture,layout,trace,Thread,primitive}=mod.exports;
const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
const method=name=>{
 const start=text.search(new RegExp('^    \\*?'+name+'\\(','m'));assert.ok(start>=0,name);
 const tail=text.slice(start),end=tail.slice(1).search(/\n    \*?[A-Za-z_$][\w$]*\(/);
 assert.ok(end>=0,name);return tail.slice(0,end+1);
};
const make=(mode='engine',{kind='update',writer=false}={})=>{
 const v=fixture(mode),events=[],reads=[],owners=new WeakMap(),procedures=new WeakMap();
 const methods=['_terrainRegistration','_handlerRegistration','registerUpdateHandler','registerIntervalHandler','whenRegisteredUpdate','whenRegisteredWall','_registeredCallbackSteps','_localParams','setLocal','getCaptured','setCaptured'].map(method).join('\n');
 const Class=new Function('exceptionOwners','procedureOwners','dependencies','Scratch','return class {'+methods+'\n}')(owners,procedures,{primitiveOwner:primitive,currentNumberInput:(_runtime,args)=>args.VALUE},{BWValues:{encode:x=>x,decode:x=>x}});
 const extension=new Class();owners.set(extension,v.owner);procedures.set(extension,{write(){}});
 Object.assign(extension,{_runtime:v.runtime,_terrainEpoch:0,_terrainStopped:false,_terrainWaits:new Set(),_updateHandlers:[],_intervalHandlers:[],_kindValue:()=>0});
 v.runtime._pushThread=(id,target)=>{const thread=new Thread(id);thread.target=target;thread.blockContainer=target.blocks;thread.pushStack(id);v.runtime.threads.push(thread);return thread;};
 v.runtime.allScriptsByOpcodeDo=(opcode,visit)=>{assert.equal(opcode,'arcade_whenRegisteredUpdate');visit({blockId:'hat'},v.thread.target);};
 v.thread.stackFrames[0].params={error:77};layout(v,{body:'throw',catchBody:'register'});v.blocks.try.next=null;trace(v,'finally',events);
 const opcode=kind==='interval'?'arcade_registerIntervalHandler':'arcade_registerUpdateHandler';
 v.operation('register',opcode,{TOKEN:'callback',CAPTURES:'error',...(kind==='interval'?{INTERVAL:10}:{})},extension[kind==='interval'?'registerIntervalHandler':'registerUpdateHandler'].bind(extension),{},'try');
 v.blocks.register.next='write';v.operation('write','arcade_setLocal',{NAME:'error',VALUE:31},extension.setLocal.bind(extension),{},'try');
 v.operation('hat','arcade_whenRegisteredUpdate',{TOKEN:'callback'},extension.whenRegisteredUpdate.bind(extension),{TOKEN:{block:'token'}});
 v.blocks.token={opcode:'text',fields:{TEXT:{value:'callback'}}};v.blocks.hat.next=writer?'writeCaptured':'read';
 const read=(args,util)=>{reads.push(extension.getCaptured(args,util));};
 v.operation('read','arcade_getCaptured',{NAME:'error'},read);
 v.blocks.read.next='readAgain';v.operation('readAgain','arcade_getCaptured',{NAME:'error'},read);
 v.operation('writeCaptured','arcade_setCaptured',{NAME:'error',VALUE:53},extension.setCaptured.bind(extension));v.blocks.writeCaptured.next='read';
 const registration=()=>[...extension._updateHandlers,...extension._intervalHandlers][0];
 const dispatch=(record=registration(),deferred=false)=>extension._registeredCallbackSteps([record],'arcade_whenRegisteredUpdate',{},undefined,deferred);
 return {v,extension,events,reads,registration,dispatch};
};
for(const kind of ['update','interval'])test(`emitted ${kind} registration retains catch cells through callback advancement`,()=>{
 const s=make('engine',{kind});s.v.step();assert.deepEqual(s.events,['finally']);assert.deepEqual(s.reads,[]);
 assert.equal(s.dispatch().next().done,true);assert.deepEqual(s.reads,[31,31]);assert.deepEqual(s.v.errors,[]);
 assert.equal(s.dispatch().next().done,true);assert.deepEqual(s.reads,[31,31,31,31]);
});
test('registered callback write shares the detached catch cell with later deliveries',()=>{
 const s=make('engine',{writer:true});s.v.step();s.dispatch().next();s.dispatch().next();assert.deepEqual(s.reads,[53,53,53,53]);
 assert.equal(s.v.thread.stackFrames[0]?.params?.error??77,77);
});
for(const change of ['map-copy','token','Stop-restart'])test(`registered callback rejects ${change} before executing`,()=>{
 const s=make();s.v.step();const record={...s.registration()};
 if(change==='map-copy')record.captures=new Map(record.captures);
 if(change==='token'){record.token='changed';s.v.blocks.token.fields.TEXT.value='changed';}
 if(change==='Stop-restart'){s.v.runtime.emit('PROJECT_STOP_ALL');s.v.runtime.emit('PROJECT_START');}
 assert.throws(()=>s.dispatch(record).next(),/Event capture/);assert.deepEqual(s.reads,[]);
});
test('queued callback root reset cannot revive captured cells',()=>{
 const s=make();s.v.step();const generator=s.dispatch(undefined,true),wait=generator.next();assert.equal(wait.done,false);
 const child=s.v.runtime.threads.at(-1);child.stackFrames[0].reset();s.v.sequencer.activeThread=child;
 assert.throws(()=>s.v.sequencer.stepThread(child),/Captured catch/);assert.deepEqual(s.reads,[]);
 generator.return();
});
test('ordinary owner preserves the emitted registration local cells',()=>{
 const s=make('default');s.v.thread.stack[0]=null;s.v.thread.stackFrames[0].waitingReporter='ordinary';s.v.thread.pushStack('register');
 s.v.step();assert.equal(s.dispatch().next().done,true);assert.deepEqual(s.reads,[31,31]);assert.deepEqual(s.events,[]);
});

test('registration inside a callback preserves its actual inherited catch map',()=>{
 const s=make();const operation=s.v.container._cache._executeCached.register._ops[0];
 s.v.operation('nested','arcade_registerUpdateHandler',{TOKEN:'callback',CAPTURES:'error'},operation._blockFunction);
 s.v.blocks.read.next='nested';s.v.blocks.nested.next='readAgain';
 s.v.step();s.dispatch().next();const next=s.extension._updateHandlers[1];assert.ok(next);
 assert.notEqual(next.captures,s.registration().captures);s.dispatch(next).next();assert.deepEqual(s.reads,[31,31,31,31]);
});
test('copied registration args cannot issue a captured event map',()=>{
 const s=make();const op=s.v.container._cache._executeCached.register._ops[0],original=op._blockFunction;
 const forged=(args,util)=>original({...args},util);op._blockFunction=forged;
 const getOpcode=s.v.runtime.getOpcodeFunction;
 s.v.runtime.getOpcodeFunction=opcode=>opcode==='arcade_registerUpdateHandler'?forged:getOpcode(opcode);
 assert.throws(()=>s.v.step(),/actual registration primitive/);assert.equal(s.extension._updateHandlers.length,0);
});

test('an unadmitted callback command cannot borrow event capture ownership',()=>{
 const s=make();s.v.operation('register','arcade_registerExternal',{TOKEN:'callback',CAPTURES:'error'},s.extension._terrainRegistration.bind(s.extension),{},'try');
 assert.throws(()=>s.v.step(),/actual registration primitive/);assert.equal(s.extension._updateHandlers.length,0);
});
