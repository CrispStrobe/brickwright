// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Selected real execute wrapper/Promise consumer + primitive loan, cache owner,
// coordinator and Thread. Metadata and unrelated value/report services authored.
// No complete execute loop, installed overlay, VM, guest or managed settlement.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events');
const hooks=require('../scripts/lib/engine-activation-hooks.cjs');
const engine=require('../overlay/scratch-vm/src/util/bw-engine-activations');
const utilRoot=path.resolve(__dirname,'../overlay/scratch-vm/src/util');
const loaded=new Map();
const load=name=>{
    if(name==='./bw-engine-activations'||name==='../util/bw-engine-activations')return engine;
    if(name==='./bw-array-operations')return {consumeFailureLease(){throw Error('unrelated Array service');}};
    if(['./bw-source-condition-waits','./bw-scene-clock-number'].includes(name))return {after:(_record,result)=>result,finish(){}};
    if(loaded.has(name))return loaded.get(name).exports;
    const mod={exports:{}};loaded.set(name,mod);
    new Function('require','module',fs.readFileSync(path.join(utilRoot,name.slice(2)+'.js'),'utf8'))(load,mod);return mod.exports;
};
const exceptions=load('./bw-arcade-exceptions'),primitive=load('./bw-primitive-owner');
const selected=hooks.patchExecuteActivations(fs.readFileSync(process.argv[3],'utf8'));
const wrapper=selected.slice(selected.indexOf('module.exports = function executeWithContext'));
const makeExecute=execute=>{
    const mod={exports:{}};
    new Function('module','bwEngineActivations','bwArcadeExceptions','execute','blockUtility','letUnused',
        'let executing=false;\n'+wrapper)(mod,engine,exceptions,execute,{},null);
    return mod.exports;
};
const start=selected.indexOf('const handlePromise = ('),end=selected.indexOf('\n/**\n * A execute.js internal representation',start);
assert.ok(start>=0&&end>start);
const threadModule={exports:{}};
new Function('require','module',hooks.patchThreadActivations(fs.readFileSync(process.argv[2],'utf8')))(load,threadModule);
const Thread=threadModule.exports;
const fixture=(mode='engine')=>{
    const runtime=new EventEmitter(),thread=new Thread('try'),blocks={},impls={},inputMaps=new WeakMap();
    const container={_cache:{_executeCached:{}},getBlock:id=>blocks[id],getInputs:block=>inputMaps.get(block),
        getBranch:(id,n)=>{container.observeBranch?.(id,n);return blocks[id]?.inputs[n===1?'SUBSTACK':'SUBSTACK'+n]?.block??null;}};
    const target={blocks:container};thread.target=target;thread.blockContainer=container;thread.pushStack('try');
    const sequencer={runtime,activeThread:thread,retireThread(t){t.status=Thread.STATUS_DONE;}};
    Object.assign(runtime,{sequencer,threads:[thread],targets:[target],getOpcodeFunction:opcode=>impls[opcode],isActiveThread:t=>runtime.threads.includes(t)});
    const owner=exceptions[mode==='engine'?'createStructuredEngine':mode==='preview'?'createStructuredPreview':'create'](runtime,args=>args.VALUE);
    const errors=[];runtime.on('BLOCKS_ERROR',error=>errors.push(error));runtime.emit('PROJECT_START');
    const util={runtime,thread,target,sequencer};
    const operation=(id,opcode,args,implementation,inputs={},parent=null)=>{
        impls[opcode]=implementation;
        const fields=Object.fromEntries(Object.entries(args).filter(([name])=>name!=='VALUE').map(([name,value])=>[name,{name,value}]));
        const block={id,opcode,fields,inputs,mutation:null,parent};blocks[id]=block;
        const nonbranch=Object.fromEntries(Object.entries(inputs).filter(([name])=>!name.startsWith('SUBSTACK')));inputMaps.set(block,nonbranch);
        const op={id,opcode,_argValues:args,_blockFunction:implementation,fields,inputs:nonbranch,mutation:null};
        container._cache._executeCached[id]={_ops:[op]};return op;
    };
    const invoke=op=>primitive.invoke(runtime,thread,container,op,op._argValues,util,()=>op._blockFunction(op._argValues,util));
    const execute=makeExecute(()=>invoke(container._cache._executeCached[thread.peekStack()]._ops[0]));
    const args={HAS_CATCH:'1',HAS_FINALLY:'0',CATCH_NAME:'error'};
    operation('try','arcade_structuredTry',args,(args,util)=>owner.bindStructuredHandlerEntry(args,util),
        {SUBSTACK:{block:'throw',shadow:null},SUBSTACK2:{block:'catch',shadow:null},SUBSTACK3:{block:null,shadow:null}});
    operation('throw','arcade_throwValue',{VALUE:19},(args,util)=>owner.raise(args,util),{},'try');
    blocks.catch={id:'catch',parent:'try'};
    const entry=execute(sequencer,thread);assert.ok(entry||mode==='default');thread.pushStack('throw');
    const observed={reports:[],warnings:[]};
    observed.promise=new Function('Thread','bwEngineActivations','bwArcadeExceptions','handleReport','log',selected.slice(start,end)+'\nreturn handlePromise;')(
        Thread,engine,exceptions,value=>observed.reports.push(value),{warn:(...args)=>observed.warnings.push(args)});
    return {runtime,thread,sequencer,owner,errors,util,operation,invoke,execute,blocks,container,observed,args};
};
const captureSignal=v=>{
    const origin=engine.enter(v.sequencer,v.thread);let signal;
    try{v.invoke(v.container._cache._executeCached.throw._ops[0]);}catch(error){signal=error;}
    assert.ok(signal);return {signal,origin};
};
test('actual wrapper consumes staged real primitive signal only after physical installation',()=>{
    const v=fixture();v.execute(v.sequencer,v.thread);
    assert.deepEqual(v.thread.stack,['try','catch']);assert.equal(v.thread.status,Thread.STATUS_RUNNING);
    assert.deepEqual(v.errors,[]);assert.equal(v.owner.failure(v.thread),null);
    assert.equal(engine.readCatchCell(v.runtime,v.thread,'error').value,19);
});
test('actual Promise rejection consumes transfer before stale activation, without report/log/pop',async()=>{
    const v=fixture(),{signal,origin}=captureSignal(v);let reject;
    v.observed.promise(new Promise((_resolve,no)=>{reject=no;}),v.sequencer,v.thread,{},true);engine.leave(origin);
    reject(signal);await Promise.resolve();await Promise.resolve();
    assert.deepEqual(v.thread.stack,['try','catch']);assert.equal(v.thread.status,Thread.STATUS_RUNNING);
    assert.deepEqual(v.observed.reports,[]);assert.deepEqual(v.observed.warnings,[]);assert.deepEqual(v.errors,[]);
});
test('changed branch falls back to the identical original signal and terminal retirement',()=>{
    const v=fixture(),{signal}=captureSignal(v);v.blocks.catch.parent='changed';
    assert.equal(exceptions.consume(v.runtime,v.thread,signal),true);
    assert.equal(v.owner.failure(v.thread),signal);assert.equal(v.errors[0],signal);assert.equal(v.thread.status,Thread.STATUS_DONE);
    assert.equal(exceptions.consume(v.runtime,v.thread,signal),true);
});
test('stopped/restarted or reused origin cannot install old catch work',()=>{
    for(const mutate of [v=>{v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');},v=>v.thread.reuseStackForNextBlock('throw')]){
        const v=fixture(),{signal}=captureSignal(v);mutate(v);
        assert.equal(exceptions.consume(v.runtime,v.thread,signal),true);assert.notEqual(v.thread.peekStack(),'catch');
    }
});
test('copied signals and foreign consumers cannot take a staged transfer',()=>{
    const v=fixture(),other=fixture(),{signal}=captureSignal(v);
    assert.equal(exceptions.consume(v.runtime,v.thread,new Error(signal.message)),false);
    assert.equal(exceptions.consume(other.runtime,other.thread,signal),false);
    assert.equal(exceptions.consume(v.runtime,other.thread,signal),false);
    assert.equal(exceptions.consume(v.runtime,v.thread,signal),true);assert.equal(v.thread.peekStack(),'catch');
});
test('preview/default and unsupported finally preserve original terminal behavior',()=>{
    for(const mode of ['preview','default','engine']){
        const v=fixture(mode);if(mode==='engine')v.args.HAS_FINALLY=v.blocks.try.fields.HAS_FINALLY.value='1';
        v.execute(v.sequencer,v.thread);assert.equal(v.errors.length,1);assert.equal(v.owner.failure(v.thread),v.errors[0]);
        assert.equal(v.thread.status,Thread.STATUS_DONE);assert.notEqual(v.thread.peekStack(),'catch');
    }
});
test('actual lexical get/set methods use private catch cells and preserve outer params',()=>{
    const v=fixture();v.thread.stackFrames[0].params={error:77};v.execute(v.sequencer,v.thread);
    const source=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const methods=source.slice(source.indexOf('    _localParams(util) {'),source.indexOf('    registerSpriteCreated(args, util) {'));
    const extension={_runtime:v.runtime};const exceptionOwners=new WeakMap([[extension,v.owner]]);
    const methodsObject=new Function('exceptionOwners','procedureOwners','dependencies','Scratch',
        'return ({'+methods.replace(/\n    (setLocal|getLocal)\(/g,'\n    ,$1(')+'});')(
        exceptionOwners,new WeakMap([[extension,{write(){throw Error('outer writer must not run');}}]]),
        {currentNumberInput:(_runtime,args)=>args.VALUE},{BWValues:{encode:x=>x,decode:x=>x}});
    Object.assign(extension,methodsObject);
    const read=v.operation('read','arcade_getLocal',{NAME:'error'},(args,util)=>extension.getLocal(args,util));
    const write=v.operation('write','arcade_setLocal',{NAME:'error',VALUE:31},(args,util)=>extension.setLocal(args,util));
    v.thread.pushStack('read');assert.equal(v.execute(v.sequencer,v.thread),19);v.thread.popStack();
    v.thread.pushStack('write');v.execute(v.sequencer,v.thread);v.thread.popStack();
    v.thread.pushStack('read');assert.equal(v.execute(v.sequencer,v.thread),31);
    assert.deepEqual(v.thread.stackFrames[0].params,{error:77});
    v.runtime.emit('PROJECT_STOP_ALL');assert.equal(engine.readCatchCell(v.runtime,v.thread,'error'),null);
});

const managedExtension=(v,onCleanup=()=>{})=>{
    const source=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const methods=source.slice(source.indexOf('    _pumpFunctionCalls() {'),source.indexOf('    returnValue(args, util) {'));
    const extension={_runtime:v.runtime,_functionCalls:new Set(),_sdkObjectClasses:{matches:()=>false},_objectHeap:{validateTransport(){}},
        _objectError(error){throw error;}};
    const exceptionOwners=new WeakMap([[extension,v.owner]]),procedureOwners=new WeakMap([[extension,{prepare:()=>({procedures:new Map()}),managedEntry:()=>null}]]);
    const classCallableHosts=new WeakMap(),managedReturnHosts=new WeakMap([[extension,{forget:onCleanup,bind(){}}]]);
    Object.assign(extension,new Function('exceptionOwners','procedureOwners','dependencies','Scratch','classCallableHosts','managedReturnHosts',
        'return ({'+methods.replace('\n    callFunction(', '\n    ,callFunction(')+'});')(
        exceptionOwners,procedureOwners,{primitiveOwner:primitive},{BWValues:{encode:x=>x,decode:x=>x,jsonReplacer:(_key,value)=>value,UNDEFINED:undefined}},classCallableHosts,managedReturnHosts));
    v.container.getProcedureDefinition=()=> 'throw';v.container.getProcedureParamNamesIdsAndDefaults=()=>[[],[],[]];
    v.runtime._pushThread=(definition,target)=>{
        const child=new Thread(definition);child.target=target;child.blockContainer=target.blocks;child.pushStack(definition);v.runtime.threads.push(child);return child;
    };
    v.runtime.currentStepTime=10;
    return extension;
};
test('actual synchronous callFunction transfers a child throw through its caller wrapper',()=>{
    const v=fixture(),extension=managedExtension(v);
    v.sequencer.stepThread=child=>v.execute(v.sequencer,child);
    // Selected wrapper's execution callback above uses the fixture thread;
    // replace it with actual current-thread cache/loan dispatch for managed tests.
    v.execute=makeExecute((sequencer,thread)=>{
        const op=v.container._cache._executeCached[thread.peekStack()]._ops[0];
        const util={...v.util,thread};
        return primitive.invoke(v.runtime,thread,v.container,op,op._argValues,util,()=>op._blockFunction(op._argValues,util));
    });
    v.thread.popStack();
    v.operation('call','arcade_callFunction',{NAME:'f',ARGS:'[]'},(args,util)=>extension.callFunction(args,util));
    v.thread.pushStack('call');v.execute(v.sequencer,v.thread);
    assert.deepEqual(v.thread.stack,['try','catch']);assert.equal(v.thread.status,Thread.STATUS_RUNNING);
    assert.deepEqual(v.errors,[]);assert.equal(extension._functionCalls.size,0);
    assert.equal(v.runtime.threads[1].status,Thread.STATUS_DONE);
});
test('actual pump settles pending managed transfer before stale-origin filtering without ordinary pop/report',async()=>{
    const v=fixture(),extension=managedExtension(v);
    const execute=makeExecute((sequencer,thread)=>{
        const op=v.container._cache._executeCached[thread.peekStack()]._ops[0],util={...v.util,thread,sequencer:null};
        const result=primitive.invoke(v.runtime,thread,v.container,op,op._argValues,util,()=>op._blockFunction(op._argValues,util));
        if(result&&typeof result.then==='function')v.observed.promise(result,sequencer,thread,{},true);
        return result;
    });
    v.thread.popStack();v.operation('call','arcade_callFunction',{NAME:'f',ARGS:'[]'},(args,util)=>extension.callFunction(args,util));
    v.thread.pushStack('call');
    // The actual managed call queues instead of stepping the child inline.
    const pending=execute(v.sequencer,v.thread);
    assert.equal(extension._functionCalls.size,1);
    assert.ok(pending&&typeof pending.then==='function');
    const child=v.runtime.threads[1];v.sequencer.activeThread=child;execute(v.sequencer,child);
    assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);assert.equal(v.thread.peekStack(),'catch');
    v.sequencer.activeThread=v.thread;extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();
    assert.equal(extension._functionCalls.size,0);assert.deepEqual(v.thread.stack,['try','catch']);assert.equal(v.thread.status,Thread.STATUS_RUNNING);
    assert.deepEqual(v.observed.reports,[]);assert.deepEqual(v.observed.warnings,[]);assert.deepEqual(v.errors,[]);
});

test('Stop/restart during actual managed cleanup cannot terminally retire the new run',()=>{
    const v=fixture(),extension=managedExtension(v,()=>{v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');});
    const retire=[];v.sequencer.retireThread=thread=>{retire.push(thread);thread.status=Thread.STATUS_DONE;};
    const execute=makeExecute((sequencer,thread)=>{
        const op=v.container._cache._executeCached[thread.peekStack()]._ops[0],util={...v.util,thread,sequencer:null};
        return primitive.invoke(v.runtime,thread,v.container,op,op._argValues,util,()=>op._blockFunction(op._argValues,util));
    });
    v.thread.popStack();v.operation('call','arcade_callFunction',{NAME:'f',ARGS:'[]'},(args,util)=>extension.callFunction(args,util));
    v.thread.pushStack('call');const pending=execute(v.sequencer,v.thread);pending.catch(()=>{});
    const child=v.runtime.threads[1];v.sequencer.activeThread=child;execute(v.sequencer,child);
    assert.equal(retire.includes(v.thread),false);assert.deepEqual(v.errors,[]);
});

const queueManaged=v=>{
    const extension=managedExtension(v);
    const execute=makeExecute((sequencer,thread)=>{
        const op=v.container._cache._executeCached[thread.peekStack()]._ops[0],util={...v.util,thread,sequencer:null};
        return primitive.invoke(v.runtime,thread,v.container,op,op._argValues,util,()=>op._blockFunction(op._argValues,util));
    });
    v.thread.popStack();v.operation('call','arcade_callFunction',{NAME:'f',ARGS:'[]'},(args,util)=>extension.callFunction(args,util));
    v.thread.pushStack('call');const pending=execute(v.sequencer,v.thread);let transport;
    pending.catch(error=>{transport=error;});
    const child=v.runtime.threads[1];
    return {extension,child,pending,transport:()=>transport,run:()=>{v.sequencer.activeThread=child;execute(v.sequencer,child);v.sequencer.activeThread=v.thread;}};
};
test('actual pending call transfer has foreign/copy/one-use rejection ownership',async()=>{
    const v=fixture(),other=fixture(),q=queueManaged(v);q.run();q.extension._pumpFunctionCalls();await Promise.resolve();
    const token=q.transport();assert.ok(token);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
    assert.equal(exceptions.consume(v.runtime,v.thread,new Error(token.message)),false);
    assert.equal(exceptions.consume(other.runtime,other.thread,token),false);
    assert.equal(exceptions.consume(v.runtime,q.child,token),false);
    assert.equal(exceptions.consume(v.runtime,v.thread,token),true);assert.equal(v.thread.status,Thread.STATUS_RUNNING);
    assert.equal(exceptions.consume(v.runtime,v.thread,token),false);assert.deepEqual(v.errors,[]);
});
test('actual pending managed settlement rejects changed branch with original signal',async()=>{
    const v=fixture(),q=queueManaged(v);q.run();v.blocks.catch.parent='changed';q.extension._pumpFunctionCalls();await Promise.resolve();
    assert.equal(exceptions.consume(v.runtime,v.thread,q.transport()),true);
    assert.equal(v.thread.status,Thread.STATUS_DONE);assert.equal(v.errors.length,1);
    assert.equal(v.owner.failure(v.thread),v.errors[0]);assert.equal(v.errors[0].message,'Arcade uncaught thrown value: 19');
});
test('Stop/restart before pending call settlement absorbs old transport without new handler execution',async()=>{
    const v=fixture(),q=queueManaged(v);q.run();v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');
    q.extension._pumpFunctionCalls();await Promise.resolve();
    assert.equal(exceptions.consume(v.runtime,v.thread,q.transport()),true);
    assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);assert.deepEqual(v.errors,[]);
});
test('unlink of the actual immutable managed edge prevents handler installation',()=>{
    const v=fixture(),q=queueManaged(v),call=[...q.extension._functionCalls][0];call.unlink();q.run();
    assert.notEqual(v.thread.peekStack(),'catch');assert.equal(v.errors.length,1);assert.equal(v.owner.failure(q.child),v.errors[0]);
});

test('physical receipt must be consumed before suppression, with installed reporter state revalidated',()=>{
    const v=fixture();v.container.observeBranch=()=>{if(v.thread.peekStack()==='catch')v.thread.justReported=99;};
    v.execute(v.sequencer,v.thread);assert.equal(v.errors.length,1);assert.equal(v.thread.status,Thread.STATUS_DONE);
});
test('Stop/restart during actual pending-settlement metadata cannot publish old terminal failure',async()=>{
    const v=fixture(),q=queueManaged(v);q.run();q.extension._pumpFunctionCalls();await Promise.resolve();
    v.container.observeBranch=()=>{v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');};
    assert.equal(exceptions.consume(v.runtime,v.thread,q.transport()),true);
    assert.deepEqual(v.errors,[]);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
});
test('producer recognizes exact old/new full hooks, refuses partial hooks, and consumes before stale filter',()=>{
    const original=fs.readFileSync(process.argv[3],'utf8'),patched=hooks.patchExecuteActivations(original);
    assert.equal(hooks.patchExecuteActivations(patched),patched);
    assert.equal(hooks.stripExecuteActivations(patched),original);
    const previous=patched.replace('        if (bwArcadeExceptions.consume(sequencer.runtime, thread, rejectionReason)) return;\n','');
    assert.equal(hooks.patchExecuteActivations(previous),patched);
    assert.throws(()=>hooks.patchExecuteActivations(patched.replace('bwEngineActivations.leave(bwEngineActivationEntry);','')));
    const rejection=patched.slice(patched.indexOf('    }, rejectionReason => {'));
    assert.ok(rejection.indexOf('bwArcadeExceptions.consume(')<rejection.indexOf('!bwEngineActivations.valid('));
});
test('unlink after actual primitive staging invalidates the retained exact managed edge',()=>{
    const v=fixture(),q=queueManaged(v),call=[...q.extension._functionCalls][0];
    v.sequencer.activeThread=q.child;const origin=engine.enter(v.sequencer,q.child);
    const op=v.container._cache._executeCached.throw._ops[0],util={...v.util,thread:q.child};let signal;
    try{primitive.invoke(v.runtime,q.child,v.container,op,op._argValues,util,()=>v.owner.raise(op._argValues,util));}catch(error){signal=error;}
    assert.ok(signal);call.unlink();assert.equal(exceptions.consume(v.runtime,q.child,signal),true);engine.leave(origin);
    assert.notEqual(v.thread.peekStack(),'catch');assert.equal(v.errors[0],signal);
});
