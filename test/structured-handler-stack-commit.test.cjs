// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Physical installation controls: real binder and selected instrumented Thread.
// Cache/control data is authored here; this is not an installed primitive/VM.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {EventEmitter}=require('node:events');
const hooks=require('../scripts/lib/engine-activation-hooks.cjs');
const engine=require('../overlay/scratch-vm/src/util/bw-engine-activations');
assert.ok(process.argv[2],'Supply selected Thread source');
const loaded={exports:{}};new Function('require','module',hooks.patchThreadActivations(fs.readFileSync(process.argv[2],'utf8')))(
    name=>{assert.equal(name,'../util/bw-engine-activations');return engine;},loaded);
const Thread=loaded.exports;
const fixture=()=>{
    const runtime=new EventEmitter(),thread=new Thread('try'),implementation=()=>{},args={HAS_CATCH:'1',HAS_FINALLY:'0',CATCH_NAME:'error'};
    const fields=Object.fromEntries(Object.entries(args).map(([name,value])=>[name,{name,value}]));
    const inputs={SUBSTACK:{block:'tryBody',shadow:null},SUBSTACK2:{block:'catchBody',shadow:null},SUBSTACK3:{block:null,shadow:null}};
    const block={id:'try',opcode:'arcade_structuredTry',fields,inputs,mutation:null};
    const blocks={try:block,tryBody:{id:'tryBody',parent:'try'},catchBody:{id:'catchBody',parent:'try'},finallyBody:{id:'finallyBody',parent:'try'}};
    const operation={id:'try',opcode:block.opcode,_argValues:args,_blockFunction:implementation,fields,mutation:null};
    const container={_cache:{_executeCached:{try:{_ops:[operation]}}},getBlock:id=>blocks[id],
        getBranch:(id,number)=>blocks[id]?.inputs?.[number===1?'SUBSTACK':'SUBSTACK'+number]?.block??null};
    const target={blocks:container};thread.target=target;thread.blockContainer=container;thread.pushStack('try');
    const sequencer={runtime,activeThread:thread};runtime.sequencer=sequencer;runtime.threads=[thread];runtime.targets=[target];runtime.getOpcodeFunction=()=>implementation;
    const activation=engine.enter(sequencer,thread),lease=engine.captureFrame(activation);
    return {runtime,thread,sequencer,args,fields,inputs,block,blocks,container,operation,activation,lease};
};
const bind=v=>engine.bindHandlerEntry(v.activation,v.lease,v.args);

const offer=(v,value=13)=>{
    const entry=bind(v);assert.ok(entry);engine.leave(v.activation);
    v.thread.pushStack('tryBody');const origin=engine.enter(v.sequencer,v.thread);assert.ok(origin);
    const request=engine.prepareHandlerTransfer(origin,entry,value);assert.ok(request);
    return {entry,origin,request};
};
test('physical commit installs the canonical catch stack before a one-use private acknowledgement',()=>{
    const v=fixture(),control=v.thread.peekStackFrame(),{request,origin}=offer(v);
    v.thread.peekStackFrame().params={stale:1};v.thread.peekStackFrame().reported=['stale'];
    v.thread.justReported=71;v.thread.status=Thread.STATUS_PROMISE_WAIT;
    const oldFrame=v.thread.peekStackFrame(),ack=engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin);assert.ok(ack);
    assert.deepEqual(v.thread.stack,['try','catchBody']);assert.equal(v.thread.stackFrames[0],control);
    assert.notEqual(v.thread.peekStackFrame(),oldFrame);assert.equal(v.thread.status,Thread.STATUS_RUNNING);
    assert.equal(v.thread.justReported,null);assert.equal(v.thread.peekStackFrame().reported,null);
    assert.equal(v.thread.peekStackFrame().params,null);assert.equal(v.thread.peekStackFrame().waitingReporter,null);
    assert.equal(engine.valid(origin,v.sequencer,v.thread),false);
    assert.equal(engine.takeHandlerAck({...ack},v.sequencer,v.thread),false);
    assert.equal(engine.takeHandlerAck(ack,v.sequencer,v.thread),true);
    assert.equal(engine.takeHandlerAck(ack,v.sequencer,v.thread),false);
    assert.equal(engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin),null);
});
test('changed control prefix and branch identity refuse before any physical mutation',()=>{
    for(const mutate of [v=>{v.thread.stack[0]='changed';},v=>{v.inputs.SUBSTACK2={block:'catchBody',shadow:null};},
        v=>{v.blocks.catchBody={id:'catchBody'};}]){
        const v=fixture(),{request,origin}=offer(v);mutate(v);const before=[...v.thread.stack],frames=[...v.thread.stackFrames];
        assert.equal(engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin),null);
        assert.deepEqual(v.thread.stack,before);assert.deepEqual(v.thread.stackFrames,frames);
    }
});
test('Stop/restart, popped-pool origin and foreign consumer cannot install a handler',()=>{
    for(const mutate of [v=>{v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');},
        v=>{v.thread.popStack();v.thread.pushStack('tryBody');}]){
        const v=fixture(),{request,origin}=offer(v);mutate(v);const before=[...v.thread.stack];
        assert.equal(engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin),null);assert.deepEqual(v.thread.stack,before);
    }
    const v=fixture(),other=fixture(),{request,origin}=offer(v);
    assert.equal(engine.commitHandlerTransfer(request,other.sequencer,other.thread,origin),null);
});
test('an acknowledgement expires if installation changes or Stop occurs before consumption',()=>{
    for(const mutate of [v=>v.runtime.emit('PROJECT_STOP_ALL'),v=>v.thread.pushStack('other'),v=>{v.thread.justReported=3;}]){
        const v=fixture(),{request,origin}=offer(v),ack=engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin);assert.ok(ack);
        mutate(v);assert.equal(engine.takeHandlerAck(ack,v.sequencer,v.thread),false);
    }
});
test('managed-thread destination and any pending finally refuse this same-thread dependency',()=>{
    const v=fixture(),other=fixture(),entry=bind(other);assert.ok(entry);
    assert.equal(engine.prepareHandlerTransfer(v.activation,entry,3),null);
    v.args.HAS_FINALLY=v.fields.HAS_FINALLY.value='1';const pendingFinally=bind(v);assert.ok(pendingFinally);
    assert.equal(engine.prepareHandlerTransfer(v.activation,pendingFinally,3),null);
});
test('a Stop during frame preparation cannot install work or mint an acknowledgement',()=>{
    const v=fixture(),{request,origin}=offer(v),frame=v.thread.stackFrames[0],Frame=frame.constructor;
    frame.constructor=class extends Frame {constructor(warp){super(warp);v.runtime.emit('PROJECT_STOP_ALL');}};
    const before=[...v.thread.stack];assert.equal(engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin),null);
    assert.deepEqual(v.thread.stack,before);
});

test('direct stack edits and stale reporter fields cannot preserve an acknowledgement',()=>{
    for(const mutate of [v=>{v.thread.stack[v.thread.stack.length-1]='other';},
        v=>{v.thread.stack.push('other');},v=>{v.thread.peekStackFrame().reporting='old';},
        v=>{v.thread.stackFrames[0].reported=['old'];}]){
        const v=fixture(),{request,origin}=offer(v),ack=engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin);assert.ok(ack);
        mutate(v);assert.equal(engine.takeHandlerAck(ack,v.sequencer,v.thread),false);
    }
});
test('physical installation clears owning control reporter state and preserves its params',()=>{
    const v=fixture(),control=v.thread.peekStackFrame(),params={n:7};control.params=params;
    const {request,origin}=offer(v);control.justReported=1;control.reported=[2];control.waitingReporter='old';control.reporting='old';
    const ack=engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin);assert.ok(ack);
    assert.equal(control.params,params);assert.equal(control.justReported,null);assert.equal(control.reported,null);
    assert.equal(control.waitingReporter,null);assert.equal(control.reporting,'');assert.equal(engine.takeHandlerAck(ack,v.sequencer,v.thread),true);
});

test('rebinding the same owning frame permanently supersedes its prior entry',()=>{
    const v=fixture(),old=bind(v),next=bind(v);assert.ok(old);assert.ok(next);assert.notEqual(old,next);
    assert.equal(engine.inspectHandlerEntry(old,v.runtime,v.thread),null);assert.ok(engine.inspectHandlerEntry(next,v.runtime,v.thread));
});
test('a canonical branch with a foreign parent cannot bind or survive a parent edit',()=>{
    const v=fixture();v.blocks.catchBody.parent='foreign';assert.equal(bind(v),null);
    v.blocks.catchBody.parent='try';const entry=bind(v);assert.ok(entry);
    v.blocks.catchBody.parent='foreign';assert.equal(engine.inspectHandlerEntry(entry,v.runtime,v.thread),null);
});

test('an outer handler cannot skip a canonical inner boundary with a pending finally',()=>{
    const v=fixture(),outer=bind(v);assert.ok(outer);engine.leave(v.activation);v.thread.pushStack('inner');
    const args={HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''},fields=Object.fromEntries(Object.entries(args).map(([name,value])=>[name,{name,value}]));
    const inputs={SUBSTACK:{block:'innerBody',shadow:null},SUBSTACK3:{block:'innerFinally',shadow:null}};
    v.blocks.inner={id:'inner',opcode:'arcade_structuredTry',inputs,fields,mutation:null};
    v.blocks.innerBody={id:'innerBody',parent:'inner'};v.blocks.innerFinally={id:'innerFinally',parent:'inner'};
    v.container._cache._executeCached.inner={_ops:[{id:'inner',opcode:'arcade_structuredTry',_argValues:args,
        _blockFunction:v.operation._blockFunction,fields,mutation:null}]};
    const origin=engine.enter(v.sequencer,v.thread),lease=engine.captureFrame(origin),inner=engine.bindHandlerEntry(origin,lease,args);assert.ok(inner);
    assert.equal(engine.prepareHandlerTransfer(origin,outer,17),null);
});

test('Stop during final receipt metadata validation prevents suppression',()=>{
    const v=fixture(),original=v.container.getBranch;let stop=false;
    v.container.getBranch=(...args)=>{const value=original(...args);if(stop)v.runtime.emit('PROJECT_STOP_ALL');return value;};
    const {request,origin}=offer(v),ack=engine.commitHandlerTransfer(request,v.sequencer,v.thread,origin);assert.ok(ack);
    stop=true;assert.equal(engine.takeHandlerAck(ack,v.sequencer,v.thread),false);
});
