// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'structured-branch-finally.test.cjs'),'utf8'),adapters=source.slice(0,source.indexOf("test('actual sequencer normal"));
const mod={exports:{}};
new Function('require','module','__dirname','process',adapters+'\nmodule.exports={fixture,layout,trace,Thread,primitive};')(require,mod,__dirname,process);
const {fixture,layout,trace,Thread,primitive}=mod.exports;
const callableModule={exports:{}};
new Function('require','module',fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/callable-values.js'),'utf8'))(name=>{
    if(name==='./named-callable-host')return ()=>null;
    if(name==='./callable-lexical-plan.generated')return {validateCallableLexicalPlan(){throw Error('Unrelated source lowering is not admitted');}};
    throw Error(name);
},callableModule);
const CallableValues=callableModule.exports;
const make=({mode='cell',queued=false,owner='engine',writer=false}={})=>{
    const v=fixture(owner),events=[],refs=[],results=[],reads=[],rawRefs=new WeakMap();let id=0;
    const values={encode:x=>x,decode:x=>x,jsonReplacer:(_key,x)=>x,UNDEFINED:undefined,isReference:x=>rawRefs.has(x),
        reference(runtime,kind,key){const ref=Object.freeze({bwReference:Object.freeze({kind}),id:++id});rawRefs.set(ref,{runtime,kind,key});return ref;},
        referenceId(runtime,ref,kind){const r=rawRefs.get(ref);return r?.runtime===runtime&&r.kind===kind?r.key:null;}};
    const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const methods=text.slice(text.indexOf('    _pumpFunctionCalls() {'),text.indexOf('    declareSourceCallable(args,util) {'))+
        text.slice(text.indexOf('    createCallable(args,util) {'),text.indexOf('    registerSpriteCreated(args, util) {'))+
        text.slice(text.indexOf('    getCaptured(args, util) {'),text.indexOf('    // game.Prompt'));
    const exceptionOwners=new WeakMap(),procedureOwners=new WeakMap(),classCallableHosts=new WeakMap(),managedReturnHosts=new WeakMap();
    const dependencies={primitiveOwner:primitive,currentNumberInput:(_runtime,args)=>args.VALUE};
    const makeClass=new Function('exceptionOwners','procedureOwners','classCallableHosts','managedReturnHosts','dependencies','Scratch','return class {'+methods+'}');
    const extension=new (makeClass(exceptionOwners,procedureOwners,classCallableHosts,managedReturnHosts,dependencies,{BWValues:values}))();
    Object.assign(extension,{_runtime:v.runtime,_functionCalls:new Set(),_sdkObjectClasses:{matches:()=>false},_objectHeap:{validateTransport(){}},_objectError(error){throw error;}});
    exceptionOwners.set(extension,v.owner);procedureOwners.set(extension,{prepare:()=>({procedures:new Map()}),managedEntry:()=>null,write(){}});
    managedReturnHosts.set(extension,{forget(){},bind(){},value:()=>reads.at(-1)});
    extension._callableValues=new CallableValues(v.runtime,values);
    v.container.getProcedureDefinition=()=> writer?'writeCaptured':'read';v.container.getProcedureParamNamesIdsAndDefaults=()=>[[],[],[]];
    extension._callableValues.declare(v.thread.target,{procedure:'closure',site:'site',parameters:[],captures:[{name:'error',mode}]});
    v.runtime._pushThread=(definition,target)=>{const child=new Thread(definition);child.target=target;child.blockContainer=target.blocks;child.pushStack(definition);v.runtime.threads.push(child);return child;};
    v.runtime.currentStepTime=10;v.thread.stackFrames[0].params={error:77};
    if(queued)v.thread.bwFunctionNames=new Set(['closure']);
    layout(v,{body:'throw',catchBody:'create'});v.blocks.try.next='invoke';trace(v,'finally',events);
    v.operation('create','arcade_createCallable',{NAME:'closure'},(args,util)=>{const ref=extension.createCallable(args,util);refs.push(ref);v.afterCreate?.(ref,args,util);return ref;},{},'try');
    v.blocks.create.next='writeLocal';
    v.operation('writeLocal','arcade_setLocal',{NAME:'error',VALUE:31},extension.setLocal.bind(extension),{},'try');
    v.operation('read','arcade_getCaptured',{NAME:'error'},(args,util)=>{const value=extension.getCaptured(args,util);reads.push(value);return value;});v.blocks.read.next='return';
    v.operation('return','arcade_returnValue',{VALUE:0},extension.returnValue.bind(extension));
    const invokeImpl=(args,util)=>{
        args.CALLABLE=refs[args.WHICH||0];v.beforeInvoke?.();const result=extension.callCallable(args,util);
        if(result&&typeof result.then==='function')return result.then(value=>{results.push(value);return value;});results.push(result);return result;
    };
    v.operation('invoke','arcade_callCallable',{CALLABLE:null,ARGS:'[]'},invokeImpl);
    if(writer){v.operation('writeCaptured','arcade_setCaptured',{NAME:'error',VALUE:53},extension.setCaptured.bind(extension));v.blocks.writeCaptured.next='read';}
    const drain=async()=>{for(let n=0;n<12;n++){
        for(const thread of [...v.runtime.threads])if(thread!==v.thread&&thread.status===Thread.STATUS_RUNNING){v.sequencer.activeThread=thread;v.sequencer.stepThread(thread);}
        v.sequencer.activeThread=v.thread;extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();await Promise.resolve();
        if(v.thread.status===Thread.STATUS_RUNNING)v.step();if(extension._functionCalls.size===0)break;
    }};
    return {v,events,refs,results,reads,extension,drain,values,invokeImpl};
};
for(const queued of [false,true])test(`actual callable captures catch binding rather than outer params after finally (${queued?'queued':'sync'})`,async()=>{
    const s=make({queued});s.v.step();await s.drain();assert.deepEqual(s.reads,[31]);assert.deepEqual(s.results,[31]);assert.deepEqual(s.v.errors,[]);
    assert.deepEqual(s.events,['finally']);assert.equal(s.v.thread.stackFrames[0]?.params?.error??77,77);
});
test('value capture snapshots thrown value while cell capture follows catch assignment',async()=>{
    const s=make({mode:'value'});s.v.step();await s.drain();assert.deepEqual(s.results,[19]);assert.deepEqual(s.v.errors,[]);
});
test('default owner callable locals remain ordinary shared cells',async()=>{
    const s=make({owner:'default'});s.v.thread.stack[0]=null;s.v.thread.stackFrames[0].waitingReporter='ordinaryCaller';s.v.thread.pushStack('create');s.v.blocks.writeLocal.next='invoke';
    s.v.step();await s.drain();assert.deepEqual(s.results,[31]);assert.deepEqual(s.events,[]);assert.deepEqual(s.v.errors,[]);
});
test('two closures share the actual catch cell after catch exit',async()=>{
    const s=make();s.v.afterCreate=(_ref,args,util)=>s.refs.push(s.extension.createCallable(args,util));
    s.v.blocks.invoke.next='invoke2';s.v.operation('invoke2','arcade_callCallable',{CALLABLE:null,ARGS:'[]',WHICH:1},s.invokeImpl);
    s.v.step();await s.drain();assert.equal(s.refs.length,2);assert.notEqual(s.refs[0],s.refs[1]);assert.deepEqual(s.results,[31,31]);
});
test('actual setCaptured writes the escaped cell without writing the outer params',async()=>{
    const s=make({writer:true});s.v.step();await s.drain();assert.deepEqual(s.results,[53]);assert.deepEqual(s.reads,[53]);assert.deepEqual(s.v.errors,[]);
});
for(const change of ['map-copy','sentinel-reset','Stop-reuse'])test(`actual captured read refuses ${change} on a queued invocation`,()=>{
    const s=make({queued:true});s.v.step();const child=s.v.runtime.threads[1];assert.ok(child);
    if(change==='map-copy')child.bwArcadeCaptures=new Map(child.bwArcadeCaptures);
    if(change==='sentinel-reset')child.stackFrames[0].reset();
    if(change==='Stop-reuse'){s.v.runtime.emit('PROJECT_STOP_ALL');child.stackFrames[0].reset();s.v.runtime.emit('PROJECT_START');}
    s.v.sequencer.activeThread=child;assert.throws(()=>s.v.sequencer.stepThread(child),/Captured catch cell/);
    assert.deepEqual(s.reads,[]);assert.deepEqual(s.results,[]);assert.deepEqual(s.v.errors,[]);
});
test('copied public token fields cannot manufacture catch-cell authority',async()=>{
    const s=make({queued:true});s.v.step();const child=s.v.runtime.threads[1],cell=child.bwArcadeCaptures.get('error');
    child.bwArcadeCaptures.set('error',{values:{...cell.values},key:cell.key});
    s.v.sequencer.activeThread=child;s.v.sequencer.stepThread(child);assert.deepEqual(s.reads,[undefined]);
    assert.deepEqual(s.results,[]);assert.deepEqual(s.v.errors,[]);
});
test('captured set refuses Stop inside its actual value reader before writing the cell',()=>{
    const s=make({queued:true,writer:true});s.v.step();const child=s.v.runtime.threads[1];
    Object.defineProperty(s.v.container._cache._executeCached.writeCaptured._ops[0]._argValues,'VALUE',{get(){s.v.runtime.emit('PROJECT_STOP_ALL');s.v.runtime.emit('PROJECT_START');return 91;}});
    s.v.sequencer.activeThread=child;assert.throws(()=>s.v.sequencer.stepThread(child),/Captured catch cell/);assert.deepEqual(s.reads,[]);assert.deepEqual(s.v.errors,[]);
});
