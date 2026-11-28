// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Reuse only the authored graph adapters, not the previous unchanged controls.
const source=fs.readFileSync(path.join(__dirname,'structured-branch-finally.test.cjs'),'utf8');
const adapters=source.slice(0,source.indexOf("test('actual sequencer normal"));
const mod={exports:{}};
new Function('require','module','__dirname','process',adapters+'\nmodule.exports={fixture,layout,trace,Thread,primitive};')(require,mod,__dirname,process);
const {fixture,layout,trace,Thread,primitive}=mod.exports;
const returnFixture=(mode='engine')=>{
    const v=fixture(mode),events=[];layout(v,{body:'return'});
    trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    const extension={},exceptionOwners=new WeakMap([[extension,v.owner]]);
    const reads=[],managedReturnHosts=new WeakMap([[extension,{value(args){reads.push(args.VALUE);v.readHook?.();return args.VALUE;}}]]);
    const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const method=text.slice(text.indexOf('    returnValue(args, util) {'),text.indexOf('    declareSourceCallable(args,util) {'));
    const actual=new Function('exceptionOwners','managedReturnHosts','return ({'+method+'}).returnValue;')(exceptionOwners,managedReturnHosts).bind(extension);
    const implementation=(args,util)=>actual(args,util);
    v.operation('return','arcade_returnValue',{VALUE:41},implementation,{},'try');
    return {v,events,reads,implementation};
};
test('actual returnValue delays managed publication and retirement until lexical finally',()=>{
    const {v,events,reads}=returnFixture();
    v.blocks.finally.next='finally2';trace(v,'finally2',events,null,'try',()=>assert.equal(v.thread.bwReturnValue,undefined));
    v.step();assert.deepEqual(events,['finally','finally2']);assert.equal(v.thread.bwReturnValue,41);assert.deepEqual(reads,[41]);assert.deepEqual(v.errors,[]);
});

const inner=(v,events,body='return')=>{
    v.blocks.try.inputs.SUBSTACK.block='inner';
    v.operation('inner','arcade_structuredTry',{HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''},
        v.container._cache._executeCached.try._ops[0]._blockFunction,
        {SUBSTACK:{block:body,shadow:null},SUBSTACK2:{block:null,shadow:null},SUBSTACK3:{block:'innerFinally',shadow:null}},'try');
    v.blocks[body].parent='inner';trace(v,'innerFinally',events,null,'inner');
};
test('owned return runs nested finalizers inside out and skips catches and successors',()=>{
    const {v,events}=returnFixture();inner(v,events);v.step();
    assert.deepEqual(events,['innerFinally','finally']);assert.equal(v.thread.bwReturnValue,41);assert.deepEqual(v.errors,[]);
});
test('return from a finalizer replaces the saved return without re-entering that finalizer',()=>{
    const {v,events,reads,implementation}=returnFixture();inner(v,events);
    v.operation('innerFinally','arcade_returnValue',{VALUE:53},implementation,{},'inner');
    v.step();assert.deepEqual(events,['finally']);assert.deepEqual(reads,[41,53]);assert.equal(v.thread.bwReturnValue,53);assert.deepEqual(v.errors,[]);
});
test('return from finally replaces its pending owned throw before procedure settlement',()=>{
    const {v,events,implementation}=returnFixture();layout(v,{body:'throw',catchBody:null,hasCatch:false});
    v.operation('finally','arcade_returnValue',{VALUE:67},implementation,{},'try');
    v.step();assert.deepEqual(events,[]);assert.equal(v.thread.bwReturnValue,67);assert.deepEqual(v.errors,[]);assert.equal(v.owner.failure(v.thread),null);
});
test('owned throw from finally replaces saved return and never publishes its value',()=>{
    const {v,events}=returnFixture();v.blocks.try.inputs.SUBSTACK3.block='throw';
    v.step();assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,[]);assert.equal(v.errors.length,1);assert.equal(v.errors[0].message,'Arcade uncaught thrown value: 19');
});
test('asynchronous finalizer completes before the saved return is published exactly once',async()=>{
    const {v,events,reads}=returnFixture();let resolve;
    trace(v,'finally',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));
    v.step();assert.deepEqual(events,['finally']);assert.equal(v.thread.bwReturnValue,undefined);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
    resolve();await Promise.resolve();await Promise.resolve();assert.equal(v.thread.bwReturnValue,41);assert.deepEqual(reads,[41]);assert.deepEqual(v.errors,[]);
});
test('Stop/restart during asynchronous return finalization cannot publish into the new run',async()=>{
    const {v,events}=returnFixture();let resolve;
    trace(v,'finally',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));
    v.step();v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');
    resolve();await Promise.resolve();await Promise.resolve();assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,['finally']);assert.deepEqual(v.errors,[]);
});
test('Stop/restart while reading a return value cancels the retained branch with no publication',()=>{
    const {v,events}=returnFixture();v.readHook=()=>{v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');};
    v.step();assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,[]);assert.deepEqual(v.errors,[]);
});
test('resetting the actual procedure frame during finalization revokes pending return authority',()=>{
    const {v,events}=returnFixture();trace(v,'finally',events,null,'try',()=>v.thread.stackFrames[0].reset());
    assert.throws(()=>v.step(),/ownership|completion/);assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,['finally']);
});
test('changed control metadata refuses pending return without normal successor or value publication',()=>{
    const {v,events}=returnFixture();trace(v,'finally',events,null,'try',()=>{v.blocks.try.fields.HAS_FINALLY.value='changed';});
    assert.throws(()=>v.step(),/ownership|completion/);assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,['finally']);
});
test('command procedure return preserves its destination, discards value, and skips its remaining body',()=>{
    const {v,events,reads}=returnFixture();
    v.operation('caller','test_caller',{},()=>{});v.blocks.caller.next='callerAfter';trace(v,'callerAfter',events,null,null);
    v.thread.stack[0]='caller';v.thread.stackFrames[0].params={argument:1};const destination=v.thread.stackFrames[0];
    v.thread.pushStack('try');v.step();
    assert.deepEqual(events,['finally','callerAfter']);assert.deepEqual(reads,[]);assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(v.errors,[]);
    assert.ok(destination);
});
test('actual catch return runs finally and leaves the procedure without its control successor',()=>{
    const {v,events,implementation}=returnFixture();layout(v,{body:'throw'});
    v.operation('catch','arcade_returnValue',{VALUE:73},implementation,{},'try');v.step();
    assert.deepEqual(events,['finally']);assert.equal(v.thread.bwReturnValue,73);assert.deepEqual(v.errors,[]);
});
test('ordinary default return remains immediate and does not enable structured handlers',()=>{
    const {v,events}=returnFixture('default');v.thread.reuseStackForNextBlock('return');v.step();
    assert.equal(v.thread.bwReturnValue,41);assert.deepEqual(events,[]);assert.deepEqual(v.errors,[]);
});


const managedFixture=queued=>{
    const {v,events,reads}=returnFixture();layout(v,{body:'call'});
    const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const methods=text.slice(text.indexOf('    _pumpFunctionCalls() {'),text.indexOf('    declareSourceCallable(args,util) {'));
    const extension={_runtime:v.runtime,_functionCalls:new Set(),_sdkObjectClasses:{matches:()=>false},_objectHeap:{validateTransport(){}},_objectError(error){throw error;}};
    const exceptionOwners=new WeakMap([[extension,v.owner]]),procedureOwners=new WeakMap([[extension,{prepare:()=>({procedures:new Map()}),managedEntry:()=>null}]]);
    const managedReturnHosts=new WeakMap([[extension,{forget(){events.push('cleanup');},bind(){},value:args=>args.VALUE}]]);
    Object.assign(extension,new Function('exceptionOwners','procedureOwners','dependencies','Scratch','classCallableHosts','managedReturnHosts',
        'return ({'+methods.replace('\n    callFunction(', '\n    ,callFunction(').replace('\n    returnValue(', '\n    ,returnValue(')+'});')(
        exceptionOwners,procedureOwners,{primitiveOwner:primitive},
        {BWValues:{encode:x=>x,decode:x=>x,jsonReplacer:(_key,value)=>value,UNDEFINED:undefined}},new WeakMap(),managedReturnHosts));
    v.container.getProcedureDefinition=()=> 'childTry';v.container.getProcedureParamNamesIdsAndDefaults=()=>[[],[],[]];
    v.runtime._pushThread=(definition,target)=>{const child=new Thread(definition);child.target=target;child.blockContainer=target.blocks;child.pushStack(definition);v.runtime.threads.push(child);return child;};
    v.runtime.currentStepTime=10;
    const control=v.container._cache._executeCached.try._ops[0]._blockFunction;
    v.operation('childTry','arcade_structuredTry',{HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''},control,
        {SUBSTACK:{block:'childReturn',shadow:null},SUBSTACK2:{block:null,shadow:null},SUBSTACK3:{block:'childFinally',shadow:null}});
    v.operation('childReturn','arcade_returnValue',{VALUE:83},(args,util)=>extension.returnValue(args,util),{},'childTry');
    trace(v,'childFinally',events,null,'childTry',()=>{assert.equal(v.runtime.threads[1].bwReturnValue,undefined);});
    if(queued)v.thread.bwFunctionNames=new Set(['f']);
    let returned;
    v.operation('call','arcade_callFunction',{NAME:'f',ARGS:'[]'},(args,util)=>{
        const value=extension.callFunction(args,util);if(value&&typeof value.then==='function')return value.then(result=>{returned=result;events.push('settled');return result;});
        returned=value;events.push('settled');return value;
    },{},'try');
    return {v,events,extension,result:()=>returned};
};
test('actual synchronous managed call settles its child return only after child finally',()=>{
    const {v,events,result}=managedFixture(false);v.step();
    assert.deepEqual(events,['childFinally','settled','finally','after']);assert.equal(result(),83);assert.deepEqual(v.errors,[]);
});
test('actual queued managed call pumps child return after finalization and before caller continuation',async()=>{
    const {v,events,extension,result}=managedFixture(true);v.step();assert.equal(extension._functionCalls.size,1);
    const child=v.runtime.threads[1];v.sequencer.activeThread=child;v.sequencer.stepThread(child);
    assert.deepEqual(events,['childFinally']);assert.equal(result(),undefined);
    v.sequencer.activeThread=v.thread;extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();await Promise.resolve();v.step();
    assert.deepEqual(events,['childFinally','settled','finally','after']);assert.equal(result(),83);assert.deepEqual(v.errors,[]);
});

test('resetting retained command destination cannot settle through still-live nested handler frames',()=>{
    const {v,events}=returnFixture();v.operation('caller','test_caller',{},()=>{});v.blocks.caller.next='callerAfter';trace(v,'callerAfter',events,null,null);
    v.thread.stack[0]='caller';v.thread.stackFrames[0].params={argument:1};const destination=v.thread.stackFrames[0];v.thread.pushStack('try');
    trace(v,'finally',events,null,'try',()=>destination.reset());
    assert.throws(()=>v.step(),/ownership|completion/);assert.deepEqual(events,['finally']);assert.equal(v.thread.bwReturnValue,undefined);
});

test('Stop/restart during actual cached return admission cannot fall back to stale ordinary settlement',()=>{
    const {v,events}=returnFixture();const original=v.container.getInputs;
    v.container.getInputs=block=>{if(block.id==='return'){v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');}return original(block);};
    v.step();assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,[]);assert.deepEqual(v.errors,[]);
});

test('reset during managed return value observation cannot adopt a replaced origin branch frame',()=>{
    const {v,events}=returnFixture();v.readHook=()=>v.thread.peekStackFrame().reset();
    assert.throws(()=>v.step(),/ownership|entry/);assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,[]);
});
test('outer handler observation cannot adopt a reset inner finalizer branch during return relay',()=>{
    const {v,events}=returnFixture();inner(v,events);let changed=false;
    v.container.observeBranch=id=>{if(!changed&&id==='try'&&v.thread.peekStack()==='innerFinally'){changed=true;v.thread.peekStackFrame().reset();}};
    assert.throws(()=>v.step(),/ownership|completion/);assert.equal(v.thread.bwReturnValue,undefined);assert.deepEqual(events,['innerFinally']);assert.equal(changed,true);
});
