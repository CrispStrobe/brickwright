// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Only graph/service adapters are reused. Previous suites are never registered.
const source=fs.readFileSync(path.join(__dirname,'structured-branch-finally.test.cjs'),'utf8');
const adapters=source.slice(0,source.indexOf("test('actual sequencer normal"));
const managed=source.slice(source.indexOf('const managedExtension='),source.indexOf('const managedFinalizerFixture='));
const all={exports:{}};
new Function('require','module','__dirname','process',adapters+managed+'\nmodule.exports={fixture,layout,trace,Thread,primitive,managedExtension};')(require,all,__dirname,process);
const A=all.exports;
const scenario=({queued=false,childFinally=false,grandFinally=false,rethrow=false,depth=2}={})=>{
    const v=A.fixture(),events=[],cleanups=[],admissions=[],actualOwner=v.owner;
    v.owner={...actualOwner,linkManagedCall(child,args,util,cleanup){
        const lease=actualOwner.captureCaller(args,util,'arcade_callFunction');
        const unlink=actualOwner.linkManagedCall(child,args,util,cleanup);
        admissions.push({child,caller:util.thread,lease,unlink,cleanup});return unlink;
    }};
    v.relink=actualOwner.linkManagedCall;
    const extension=A.managedExtension(v,thread=>cleanups.push(thread));
    A.layout(v,{body:'call0'});A.trace(v,'catch',events);A.trace(v,'finally',events);A.trace(v,'after',events);v.blocks.try.next='after';
    let executed=0;
    const actualExecute=v.runtime.executeSelected;
    v.runtime.executeSelected=(...args)=>{if(++executed>100)throw Error('Authored graph exceeded 100 selected operations');return actualExecute(...args);};
    const control=v.container._cache._executeCached.try._ops[0]._blockFunction;
    const call=(args,util)=>extension.callFunction(args,util);
    const thrown=(args,util)=>{try{return v.owner.raise(args,util);}catch(error){v.lastSignal=error;throw error;}};
    v.container.getProcedureDefinition=name=>'proc'+name.slice(1);
    for(let i=0;i<depth;i++){
        const id='proc'+i,body=i+1<depth?'call'+(i+1):'throw';
        const finalizer=i+1===depth?grandFinally:childFinally;
        if(finalizer){
            v.operation(id,'arcade_structuredTry',{HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''},control,
                {SUBSTACK:{block:body,shadow:null},SUBSTACK2:{block:null,shadow:null},SUBSTACK3:{block:'fin'+i,shadow:null}});
            A.trace(v,'fin'+i,events,null,id,()=>v.finalizerHook?.(i));
            if(rethrow&&i===depth-1)v.operation('fin'+i,'arcade_throwValue',{VALUE:73},thrown,{},id);
        }else{
            // Procedure entry is an actual cached call/throw, no invented handler.
            v.operation(id,i+1<depth?'arcade_callFunction':'arcade_throwValue',i+1<depth?{NAME:'f'+(i+1),ARGS:'[]'}:{VALUE:19},i+1<depth?call:thrown);
        }
        if(i+1<depth)v.operation('call'+(i+1),'arcade_callFunction',{NAME:'f'+(i+1),ARGS:'[]'},call,{},id);
    }
    v.operation('throw','arcade_throwValue',{VALUE:19},thrown,{},'proc'+(depth-1));
    v.operation('call0','arcade_callFunction',{NAME:'f0',ARGS:'[]'},call,{},'try');
    // Every opcode retains its real single registered function identity.
    const get=v.runtime.getOpcodeFunction;
    v.runtime.getOpcodeFunction=opcode=>opcode==='arcade_callFunction'?call:opcode==='arcade_throwValue'?thrown:get(opcode);
    if(queued)v.thread.bwFunctionNames=new Set(Array.from({length:depth},(_,i)=>'f'+i));
    const drain=async()=>{
        for(let n=0;n<16;n++){
            for(const thread of [...v.runtime.threads])if(thread!==v.thread&&thread.status===A.Thread.STATUS_RUNNING){v.sequencer.activeThread=thread;v.sequencer.stepThread(thread);}
            v.sequencer.activeThread=v.thread;extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();
            if(v.thread.status===A.Thread.STATUS_RUNNING)v.step();
            if(extension._functionCalls.size===0)break;
        }
    };
    return {v,events,cleanups,extension,drain,admissions};
};
for(const queued of [false,true]){
    test(`grandchild throw crosses two actual managed edges (${queued?'queued':'sync'})`,async()=>{
        const s=scenario({queued});s.v.step();await s.drain();
        assert.deepEqual(s.events,['catch','finally','after']);assert.deepEqual(s.v.errors,[]);
        assert.deepEqual(s.v.observed.reports,[]);assert.deepEqual(s.v.observed.warnings,[]);assert.equal(s.extension._functionCalls.size,0);
    });
    test(`grandchild and child finalizers precede grandparent catch (${queued?'queued':'sync'})`,async()=>{
        const s=scenario({queued,childFinally:true,grandFinally:true});s.v.step();await s.drain();
        assert.deepEqual(s.events,['fin1','fin0','catch','finally','after']);assert.deepEqual(s.v.errors,[]);
        assert.equal(s.extension._functionCalls.size,0);
    });
}
test('arbitrary four-edge managed chain preserves finalizer order',async()=>{
    const s=scenario({depth:4,childFinally:true,grandFinally:true});s.v.step();await s.drain();
    assert.deepEqual(s.events,['fin3','fin2','fin1','fin0','catch','finally','after']);assert.deepEqual(s.v.errors,[]);
});
test('throw from grandchild finally replaces signal before outer finalizers and catch',async()=>{
    const s=scenario({childFinally:true,grandFinally:true,rethrow:true});let caught;
    s.v.operation('catch','arcade_getLocal',{NAME:'error'},(args,util)=>{caught=s.v.owner.readStructuredLocal(args,util).value;s.events.push('catch');},{},'try');
    s.v.step();await s.drain();assert.equal(caught,73);
    assert.deepEqual(s.events,['fin0','catch','finally','after']);assert.deepEqual(s.v.errors,[]);
});
test('reset immediate caller frame during grandchild finally retains original Error',async()=>{
    const s=scenario({grandFinally:true});
    s.finalizerHook=null;
    s.v.finalizerHook=()=>{const child=s.v.runtime.threads[1];child.stackFrames[child.stackFrames.length-1].reset();};
    s.v.step();await s.drain();assert.deepEqual(s.events,['fin1']);
    assert.equal(s.v.errors.length,1);assert.equal(s.v.errors[0],s.v.lastSignal);
});
test('Stop and reused root frame before queued managed settlement cannot deliver old signal',async()=>{
    const s=scenario({queued:true});s.v.step();
    const child=s.v.runtime.threads[1];s.v.sequencer.activeThread=child;s.v.sequencer.stepThread(child);
    const grandchild=s.v.runtime.threads[2];s.v.sequencer.activeThread=grandchild;s.v.sequencer.stepThread(grandchild);
    assert.equal(s.extension._functionCalls.size,2);assert.deepEqual(s.events,[]);
    s.v.runtime.emit('PROJECT_STOP_ALL');const frame=s.v.thread.peekStackFrame();frame.reset();s.v.runtime.emit('PROJECT_START');
    const stack=[...s.v.thread.stack],status=s.v.thread.status;
    s.v.sequencer.activeThread=child;s.extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();
    assert.deepEqual(s.events,[]);assert.deepEqual(s.v.errors,[]);assert.deepEqual(s.v.observed.reports,[]);
    assert.equal(s.v.thread.peekStackFrame(),frame);assert.deepEqual(s.v.thread.stack,stack);assert.equal(s.v.thread.status,status);
});

test('unlink and relink the same middle child during grandchild finally refuses captured edge substitution',async()=>{
    const s=scenario({grandFinally:true});let replaced=false;
    s.v.finalizerHook=()=>{
        const {child,caller,lease,unlink,cleanup}=s.admissions[0];assert.ok(lease);unlink();
        s.v.relink(child,{bwExceptionCaller:lease},{runtime:s.v.runtime,thread:caller},cleanup);replaced=true;
    };
    s.v.step();await s.drain();assert.equal(replaced,true);assert.deepEqual(s.events,['fin1']);
    assert.equal(s.v.errors.length,1);assert.equal(s.v.errors[0],s.v.lastSignal);
});
for(const queued of [false,true])test(`grandchild finally relays across a handler-free middle call (${queued?'queued':'sync'})`,async()=>{
    const s=scenario({queued,grandFinally:true});s.v.step();await s.drain();
    assert.deepEqual(s.events,['fin1','catch','finally','after']);assert.deepEqual(s.v.errors,[]);
});
test('grandparent finally without catch retains original terminal signal across multiple calls',async()=>{
    const s=scenario();s.v.args.HAS_CATCH=s.v.blocks.try.fields.HAS_CATCH.value='0';
    s.v.args.CATCH_NAME=s.v.blocks.try.fields.CATCH_NAME.value='';
    s.v.blocks.try.inputs.SUBSTACK2.block=null;
    s.v.step();await s.drain();assert.deepEqual(s.events,['finally']);assert.equal(s.v.errors.length,1);assert.equal(s.v.errors[0],s.v.lastSignal);
});

test('normal managed return still reaches its actual reader and ordinary Promise report',async()=>{
    const s=scenario({queued:true}),reads=[];
    const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const method=text.slice(text.indexOf('    returnValue(args, util) {'),text.indexOf('    declareSourceCallable(args,util) {'));
    const exceptionOwners=new WeakMap([[s.extension,s.v.owner]]),managedReturnHosts=new WeakMap([[s.extension,{value(args){reads.push(args.VALUE);return args.VALUE;}}]]);
    const actualReturn=new Function('exceptionOwners','managedReturnHosts','return ({'+method+'}).returnValue;')(exceptionOwners,managedReturnHosts).bind(s.extension);
    s.v.operation('proc1','arcade_returnValue',{VALUE:41},actualReturn);
    s.v.step();await s.drain();assert.deepEqual(reads,[41]);assert.deepEqual(s.v.errors,[]);
    assert.deepEqual(s.v.observed.reports,[41,undefined]);assert.deepEqual(s.events,['finally','after']);
});

test('queued grandparent metadata refusal after inner settlement preserves exact original Error',async()=>{
    const s=scenario({queued:true});s.v.step();
    const child=s.v.runtime.threads[1];s.v.sequencer.activeThread=child;s.v.sequencer.stepThread(child);
    const grandchild=s.v.runtime.threads[2];s.v.sequencer.activeThread=grandchild;s.v.sequencer.stepThread(grandchild);
    s.v.sequencer.activeThread=child;s.extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();
    assert.deepEqual(s.events,[]);assert.deepEqual(s.v.errors,[]);
    s.v.blocks.try.fields.HAS_CATCH.value='changed';
    s.v.sequencer.activeThread=s.v.thread;s.extension._pumpFunctionCalls();await Promise.resolve();await Promise.resolve();
    assert.deepEqual(s.events,[]);assert.equal(s.v.errors.length,1);assert.equal(s.v.errors[0],s.v.lastSignal);
    assert.deepEqual(s.v.observed.reports,[]);assert.deepEqual(s.v.observed.warnings,[]);
});
test('grandparent catch waits for both actual managed cleanup and child retirements',async()=>{
    const s=scenario();
    s.v.operation('catch','test_catch',{},()=>{
        assert.equal(s.cleanups.length,2);assert.ok(s.cleanups.every(t=>t.status===A.Thread.STATUS_DONE));
        assert.deepEqual(s.v.errors,[]);s.events.push('catch');
    },{},'try');
    s.v.step();await s.drain();assert.deepEqual(s.events,['catch','finally','after']);
});

test('route observation fault cannot replace the original privately owned thrown Error',async()=>{
    const s=scenario(),alternate=Error('route observer failure');
    Object.defineProperty(s.v.container._cache._executeCached.proc1._ops[0]._argValues,'VALUE',{get(){
        s.v.runtime.targets.includes=()=>{throw alternate;};return 19;
    }});
    s.v.step();assert.equal(s.v.errors.length,1);assert.equal(s.v.errors[0],s.v.lastSignal);
    assert.notEqual(s.v.lastSignal,alternate);assert.equal(s.v.lastSignal.message,'Arcade uncaught thrown value: 19');
    assert.deepEqual(s.events,[]);
});

test('Stop and root-frame reuse during actual managed thrown-value read publishes no old failure',async()=>{
    const s=scenario({queued:true});s.v.step();
    const child=s.v.runtime.threads[1];s.v.sequencer.activeThread=child;s.v.sequencer.stepThread(child);
    const grandchild=s.v.runtime.threads[2];let read=false;
    Object.defineProperty(s.v.container._cache._executeCached.proc1._ops[0]._argValues,'VALUE',{get(){
        read=true;s.v.runtime.emit('PROJECT_STOP_ALL');s.v.thread.peekStackFrame().reset();s.v.runtime.emit('PROJECT_START');return 19;
    }});
    const stack=[...s.v.thread.stack],frame=s.v.thread.peekStackFrame(),status=s.v.thread.status;
    s.v.sequencer.activeThread=grandchild;s.v.sequencer.stepThread(grandchild);
    assert.equal(read,true);assert.deepEqual(s.v.errors,[]);assert.deepEqual(s.events,[]);assert.deepEqual(s.v.observed.reports,[]);
    assert.equal(s.v.thread.peekStackFrame(),frame);assert.deepEqual(s.v.thread.stack,stack);assert.equal(s.v.thread.status,status);
});
