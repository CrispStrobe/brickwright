// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Selected real execute wrapper/Promise consumer + primitive loan, cache owner,
// coordinator and Thread. Metadata and unrelated value/report services authored.
// New branch/finally controls use selected actual Sequencer.stepThread too.
// Metadata/value services authored; no complete execute loop or VM constructed.
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
const sequencerModule={exports:{}};
new Function('require','module',hooks.patchSequencerActivations(fs.readFileSync(process.argv[4],'utf8')))(name=>{
    if(name==='../util/bw-engine-activations')return engine;
    if(name==='./thread')return Thread;
    if(name==='../util/timer')return class Timer {start(){}timeElapsed(){return 0;}};
    if(name==='./execute.js')return (sequencer,thread)=>sequencer.runtime.executeSelected(sequencer,thread);
    throw Error(name);
},sequencerModule);
const Sequencer=sequencerModule.exports;
const fixture=(mode='engine')=>{
    const runtime=new EventEmitter(),thread=new Thread('try'),blocks={},impls={},inputMaps=new WeakMap();
    const container={_cache:{_executeCached:{}},getBlock:id=>blocks[id],getInputs:block=>inputMaps.get(block),
        getNextBlock:id=>blocks[id]?.next??null,getBranch:(id,n)=>{container.observeBranch?.(id,n);return blocks[id]?.inputs[n===1?'SUBSTACK':'SUBSTACK'+n]?.block??null;}};
    const target={blocks:container};thread.target=target;thread.blockContainer=container;thread.pushStack('try');
    const sequencer=new Sequencer(runtime);sequencer.activeThread=thread;runtime.profiler=null;
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
    const execute=makeExecute((sequencer,thread)=>{
        const op=container._cache._executeCached[thread.peekStack()]._ops[0],actualUtil={runtime,thread,target,sequencer};
        const result=primitive.handles(op.opcode)?primitive.invoke(runtime,thread,container,op,op._argValues,actualUtil,()=>op._blockFunction(op._argValues,actualUtil)):op._blockFunction(op._argValues,actualUtil);
        if(result&&typeof result.then==='function')observed.promise(result,sequencer,thread,op,true);
        return result;
    });
    runtime.executeSelected=execute;
    const args={HAS_CATCH:'1',HAS_FINALLY:'0',CATCH_NAME:'error'};
    const extension={},exceptionOwners=new WeakMap([[extension,owner]]);
    const extensionSource=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const actualMethod=extensionSource.slice(extensionSource.indexOf('    structuredTry(args,util) {'),extensionSource.indexOf('    throwValue(args,util) {'));
    const control=new Function('exceptionOwners','return ({'+actualMethod+'});')(exceptionOwners).structuredTry.bind(extension);
    operation('try','arcade_structuredTry',args,control,
        {SUBSTACK:{block:'throw',shadow:null},SUBSTACK2:{block:'catch',shadow:null},SUBSTACK3:{block:null,shadow:null}});
    operation('throw','arcade_throwValue',{VALUE:19},(args,util)=>owner.raise(args,util),{},'try');
    blocks.catch={id:'catch',parent:'try'};
    const observed={reports:[],warnings:[]};
    observed.promise=new Function('Thread','bwEngineActivations','bwArcadeExceptions','handleReport','log',selected.slice(start,end)+'\nreturn handlePromise;')(
        Thread,engine,exceptions,(value,sequencer,thread)=>{observed.reports.push(value);thread.status=Thread.STATUS_RUNNING;},{warn:(...args)=>observed.warnings.push(args)});
    return {runtime,thread,sequencer,owner,errors,util,operation,invoke,execute,blocks,container,observed,args,step:()=>{sequencer.activeThread=thread;sequencer.stepThread(thread);}};
};

const layout=(v,{catchBody='catch',finallyBody='finally',body='body',hasCatch=true,hasFinally=true}={})=>{
    const control=v.blocks.try;control.inputs.SUBSTACK.block=body;control.inputs.SUBSTACK2.block=catchBody;control.inputs.SUBSTACK3.block=finallyBody;
    v.args.HAS_CATCH=control.fields.HAS_CATCH.value=hasCatch?'1':'0';
    v.args.HAS_FINALLY=control.fields.HAS_FINALLY.value=hasFinally?'1':'0';
    if(!hasCatch)v.args.CATCH_NAME=control.fields.CATCH_NAME.value='';
};
const trace=(v,id,events,next=null,parent='try',action=null)=>{
    v.operation(id,'test_'+id,{},()=>{events.push(id);return action?.();},{},parent);v.blocks[id].next=next;
};
test('actual sequencer normal try skips catch, runs finally once, then resumes successor',()=>{
    const v=fixture(),events=[];layout(v);trace(v,'body',events,'body2');trace(v,'body2',events);
    trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    v.step();assert.deepEqual(events,['body','body2','finally','after']);assert.deepEqual(v.errors,[]);assert.equal(v.thread.status,Thread.STATUS_DONE);
});
test('actual owned throw enters catch and normal catch exit runs finally before successor',()=>{
    const v=fixture(),events=[];layout(v,{body:'throw'});trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    v.step();assert.deepEqual(events,['catch','finally','after']);assert.deepEqual(v.errors,[]);
});
test('try/finally without catch preserves original signal until normal finalizer completion',()=>{
    const v=fixture(),events=[];layout(v,{body:'throw',hasCatch:false,catchBody:null});trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    v.step();assert.deepEqual(events,['finally']);assert.equal(v.errors.length,1);assert.equal(v.errors[0].message,'Arcade uncaught thrown value: 19');assert.equal(v.owner.failure(v.thread),v.errors[0]);
});
test('throw from catch enters its finally and a throw from finally replaces the saved signal',()=>{
    const v=fixture(),events=[];layout(v,{body:'throw'});
    v.operation('catch','arcade_throwValue',{VALUE:23},(args,util)=>v.owner.raise(args,util),{},'try');
    v.operation('finally','arcade_throwValue',{VALUE:29},(args,util)=>v.owner.raise(args,util),{},'try');
    // All throw operations retain the single actual installed implementation.
    const implementation=(args,util)=>v.owner.raise(args,util);
    for(const id of ['throw','catch','finally'])v.container._cache._executeCached[id]._ops[0]._blockFunction=implementation;
    v.runtime.getOpcodeFunction=opcode=>opcode==='arcade_throwValue'?implementation:v.container._cache._executeCached.try._ops[0]._blockFunction;
    v.step();assert.equal(v.errors.length,1);assert.equal(v.errors[0].message,'Arcade uncaught thrown value: 29');assert.deepEqual(events,[]);
});
test('authored empty try/catch/finally branches complete through actual null-branch sequencer paths',()=>{
    const v=fixture(),events=[];layout(v,{body:null,catchBody:null,finallyBody:null});trace(v,'after',events);v.blocks.try.next='after';
    for(let n=0;n<4&&v.thread.status!==Thread.STATUS_DONE;n++)v.step();
    assert.deepEqual(events,['after']);assert.deepEqual(v.errors,[]);
});
test('actual Promise fulfillment completes its owned branch without losing finally to ordinary pop',async()=>{
    const v=fixture(),events=[];let resolve;layout(v);trace(v,'body',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));
    trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    v.step();assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);assert.deepEqual(events,['body']);
    resolve();await Promise.resolve();await Promise.resolve();v.step();
    assert.deepEqual(events,['body','finally','after']);assert.deepEqual(v.errors,[]);assert.deepEqual(v.observed.warnings,[]);
});
test('branch frame pool/reset invalidates ownership instead of resuming stale authored finally',()=>{
    const v=fixture(),events=[];layout(v);trace(v,'body',events);trace(v,'finally',events);trace(v,'catch',events);
    v.execute(v.sequencer,v.thread);const frame=v.thread.peekStackFrame();frame.reset();
    assert.throws(()=>v.thread.goToNextBlock(),/ownership/);assert.deepEqual(events,[]);
});
test('Stop/restart between asynchronous branch entry and completion cannot run old finally',async()=>{
    const v=fixture(),events=[];let resolve;layout(v);trace(v,'body',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));trace(v,'finally',events);trace(v,'catch',events);
    v.step();v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');resolve();await Promise.resolve();await Promise.resolve();
    assert.deepEqual(events,['body']);assert.deepEqual(v.errors,[]);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
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
    v.container.getProcedureDefinition=()=> 'childTry';v.container.getProcedureParamNamesIdsAndDefaults=()=>[[],[],[]];
    v.runtime._pushThread=(definition,target)=>{
        const child=new Thread(definition);child.target=target;child.blockContainer=target.blocks;child.pushStack(definition);v.runtime.threads.push(child);return child;
    };
    v.runtime.currentStepTime=10;
    return extension;
};

const managedFinalizerFixture=(queued=false)=>{
    const v=fixture(),events=[],extension=managedExtension(v);layout(v,{body:'call'});
    trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    const childArgs={HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''};
    v.operation('childTry','arcade_structuredTry',childArgs,v.container._cache._executeCached.try._ops[0]._blockFunction,
        {SUBSTACK:{block:'throw',shadow:null},SUBSTACK2:{block:null,shadow:null},SUBSTACK3:{block:'childFinally',shadow:null}});
    trace(v,'childFinally',events,null,'childTry');v.blocks.throw.parent='childTry';
    if(queued)v.thread.bwFunctionNames=new Set(['f']);
    v.operation('call','arcade_callFunction',{NAME:'f',ARGS:'[]'},(args,util)=>extension.callFunction(args,util),{},'try');
    return {v,events,extension};
};
test('child finally completes before actual synchronous managed transfer enters parent catch',()=>{
    const {v,events}=managedFinalizerFixture();v.step();
    assert.deepEqual(events,['childFinally','catch','finally','after']);assert.deepEqual(v.errors,[]);
});
test('child finally completes before actual queued managed transfer settles at parent Promise consumer',async()=>{
    const {v,events,extension}=managedFinalizerFixture(true);v.step();assert.equal(extension._functionCalls.size,1);
    const child=v.runtime.threads[1];v.sequencer.activeThread=child;v.sequencer.stepThread(child);
    assert.deepEqual(events,['childFinally']);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
    v.sequencer.activeThread=v.thread;extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();v.step();
    assert.deepEqual(events,['childFinally','catch','finally','after']);assert.deepEqual(v.errors,[]);assert.deepEqual(v.observed.warnings,[]);
});
test('normal inner finally resumes saved throw into actual outer same-thread catch',()=>{
    const v=fixture(),events=[];layout(v,{body:'inner'});trace(v,'catch',events);trace(v,'finally',events);trace(v,'after',events);v.blocks.try.next='after';
    const args={HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''};
    v.operation('inner','arcade_structuredTry',args,v.container._cache._executeCached.try._ops[0]._blockFunction,
        {SUBSTACK:{block:'throw',shadow:null},SUBSTACK2:{block:null,shadow:null},SUBSTACK3:{block:'innerFinally',shadow:null}},'try');
    trace(v,'innerFinally',events,null,'inner');v.blocks.throw.parent='inner';v.step();
    assert.deepEqual(events,['innerFinally','catch','finally','after']);assert.deepEqual(v.errors,[]);
});

test('changed control metadata during pending finally retires the exact original signal',async()=>{
    const v=fixture(),events=[];let resolve,original;layout(v,{body:'throw',catchBody:null,hasCatch:false});
    v.operation('throw','arcade_throwValue',{VALUE:19},(args,util)=>{try{return v.owner.raise(args,util);}catch(error){original=error;throw error;}},{},'try');
    trace(v,'finally',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));v.step();assert.deepEqual(v.errors,[]);
    v.blocks.try.fields.HAS_FINALLY.value='changed';resolve();await Promise.resolve();await Promise.resolve();
    assert.equal(v.errors.length,1);assert.equal(v.errors[0],original);assert.equal(v.owner.failure(v.thread),original);
});
test('Stop/restart during normal finalizer successor observation emits no old terminal signal',()=>{
    const v=fixture(),events=[];layout(v,{body:'throw',catchBody:null,hasCatch:false});
    trace(v,'finally',events);const original=v.container.getNextBlock;
    v.container.getNextBlock=id=>{if(id==='finally'){v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');}return original(id);};
    // Capture the stable method at entry; mutation of the run happens only when
    // its real finalizer successor is inspected, not via a fabricated completion.
    v.step();assert.deepEqual(events,['finally']);assert.deepEqual(v.errors,[]);
});

test('synchronous changed finalizer metadata retains original signal instead of falling through as ordinary code',()=>{
    const v=fixture(),events=[];let original;layout(v,{body:'throw',catchBody:null,hasCatch:false});
    v.operation('throw','arcade_throwValue',{VALUE:19},(args,util)=>{try{return v.owner.raise(args,util);}catch(error){original=error;throw error;}},{},'try');
    trace(v,'finally',events,null,'try',()=>{v.blocks.try.fields.HAS_FINALLY.value='changed';});
    trace(v,'after',events);v.blocks.try.next='after';v.step();
    assert.deepEqual(events,['finally']);assert.equal(v.errors[0],original);assert.equal(v.errors.length,1);
});
test('actual disabled control refuses foreign entry metadata rather than silently completing',()=>{
    const v=fixture();v.blocks.try.fields.HAS_CATCH.value='changed';
    assert.throws(()=>v.step(),/HAS_CATCH does not match its current literal field/);assert.deepEqual(v.errors,[]);
});
test('new Thread/Promise/Sequencer branch hooks round-trip exactly and refuse partial source',()=>{
    for(const [file,patch,strip]of [
        [process.argv[2],hooks.patchThreadActivations,hooks.stripThreadActivations],
        [process.argv[3],hooks.patchExecuteActivations,hooks.stripExecuteActivations],
        [process.argv[4],hooks.patchSequencerActivations,hooks.stripSequencerActivations]]){
        const original=fs.readFileSync(file,'utf8'),patched=patch(original);
        assert.equal(strip(patched),original);assert.equal(patch(patched),patched);
    }
    const source=hooks.patchSequencerActivations(fs.readFileSync(process.argv[4],'utf8'));
    assert.throws(()=>hooks.patchSequencerActivations(source.replace('if (bwEngineActivations.finishEmptyBranch(this, thread)) return;','')));
});
