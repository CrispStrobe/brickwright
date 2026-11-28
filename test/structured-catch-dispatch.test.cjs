// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// New held-dispatch controls only. Reuse adapters without registering old tests.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'structured-catch-capture.test.cjs'),'utf8');
const mod={exports:{}};
new Function('require','module','__dirname','process',source.slice(0,source.indexOf('for(const queued of [false,true])test'))+'\nmodule.exports={make,Thread};')(require,mod,__dirname,process);
const {make,Thread}=mod.exports;
const Dispatch=require('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/callable-dispatch');
const setup=(options={})=>{
    const s=make(options),{v,extension}=s;
    v.blocks.try.next=null;
    if(options.owner==='default'){v.thread.stack[0]=null;v.thread.stackFrames[0].waitingReporter='ordinaryCaller';v.thread.pushStack('create');v.blocks.writeLocal.next=null;}
    v.step();
    assert.equal(s.refs.length,1);
    assert.deepEqual(s.reads,[]);
    v.runtime.bwArcadeFrameAuthority='manual';
    v.operation('serviceHat','arcade_whenCallableDispatched',{NAME:'closure'},()=>{});
    v.blocks.serviceHat.inputs={NAME:{block:'serviceName'}};
    v.blocks.serviceName={opcode:'text',fields:{TEXT:{value:'closure'}}};
    v.blocks.serviceHat.next='serviceRun';
    v.operation('serviceRun','arcade_runCallableDispatch',{},extension.runCallableDispatch.bind(extension),{},'serviceHat');
    v.runtime.allScriptsByOpcodeDo=(opcode,visit)=>{assert.equal(opcode,'arcade_whenCallableDispatched');visit({blockId:'serviceHat'},v.thread.target);};
    extension._callableDispatch=new Dispatch(v.runtime,extension._callableValues,
        (invocation,util,args)=>extension._callableProcedure(invocation,util,args,'arcade_runCallableDispatch'));
    const dispatch=()=>{
        const promise=extension.invokeHeldCallable(s.refs[0],[],{kind:'authored'});
        // Own the rejection even when selected engine source throws synchronously.
        promise.catch(()=>{});
        const service=[...v.runtime.threads].at(-1);
        return {promise,service};
    };
    const step=thread=>{v.sequencer.activeThread=thread;v.sequencer.stepThread(thread);};
    return {...s,dispatch,step};
};
for(const mode of ['cell','value'])test(`held service captures escaped catch ${mode} through actual cached dispatch`,async()=>{
    const s=setup({mode}),a=s.dispatch();s.step(a.service);await s.drain();
    assert.equal(await a.promise,mode==='cell'?31:19);assert.deepEqual(s.reads,[mode==='cell'?31:19]);assert.deepEqual(s.v.errors,[]);
    const b=s.dispatch();s.step(b.service);await s.drain();assert.equal(await b.promise,mode==='cell'?31:19);
    assert.notEqual(a.service,b.service);
});
test('held writer shares catch cell across fresh services while preserving outer params',async()=>{
    const s=setup({writer:true}),a=s.dispatch();s.step(a.service);await s.drain();assert.equal(await a.promise,53);
    const b=s.dispatch();s.step(b.service);await s.drain();assert.equal(await b.promise,53);assert.equal(s.v.thread.stackFrames[0]?.params?.error??77,77);
});
test('copied service args cannot supply the actual dispatch primitive loan',async()=>{
    const s=setup(),a=s.dispatch();
    s.v.blocks.serviceHat.next=null;
    assert.throws(()=>s.extension.runCallableDispatch({}, {...s.v.util,thread:a.service}),/actual callable primitive/);
    await assert.rejects(a.promise,/actual callable primitive/);assert.deepEqual(s.reads,[]);
});
test('changed service cached primitive cannot publish a catch read',async()=>{
    const s=setup(),a=s.dispatch();
    s.v.runtime.getOpcodeFunction=opcode=>opcode==='arcade_runCallableDispatch'?()=>{}:undefined;
    assert.throws(()=>s.step(a.service));assert.deepEqual(s.reads,[]);
});
test('Stop cancels queued held service without a program result',async()=>{
    const s=setup(),a=s.dispatch();s.v.runtime.emit('PROJECT_STOP_ALL');s.v.runtime.emit('PROJECT_START');
    assert.equal(await a.promise,undefined);assert.deepEqual(s.reads,[]);assert.equal(s.extension._callableDispatch.pending.size,0);
});
test('held invocation map replacement refuses before captured child read',async()=>{
    const s=setup(),a=s.dispatch();a.service.bwCallableDispatch.invocation.captures=new Map(a.service.bwArcadeCaptures);
    assert.throws(()=>s.step(a.service),/actual issued callable invocation/);await assert.rejects(a.promise,/actual issued callable invocation/);assert.deepEqual(s.reads,[]);
});
test('ordinary held dispatch preserves default local cell behavior',async()=>{
    const s=setup({owner:'default'}),a=s.dispatch();s.step(a.service);await s.drain();assert.equal(await a.promise,31);assert.deepEqual(s.v.errors,[]);
});
