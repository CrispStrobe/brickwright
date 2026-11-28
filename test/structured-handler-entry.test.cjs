// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// NEW UNRUN tests of real entry binder + actual instrumented selected Thread.
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
    const runtime=new EventEmitter(),thread=new Thread('try'),implementation=()=>{},args={HAS_CATCH:'1',HAS_FINALLY:'1',CATCH_NAME:'error'};
    const fields=Object.fromEntries(Object.entries(args).map(([name,value])=>[name,{name,value}]));
    const inputs={SUBSTACK:{block:'tryBody',shadow:null},SUBSTACK2:{block:'catchBody',shadow:null},SUBSTACK3:{block:'finallyBody',shadow:null}};
    const block={id:'try',opcode:'arcade_structuredTry',fields,inputs,mutation:null};
    const blocks={try:block,tryBody:{id:'tryBody',parent:'try'},catchBody:{id:'catchBody',parent:'try'},finallyBody:{id:'finallyBody',parent:'try'}};
    const operation={id:'try',opcode:block.opcode,_argValues:args,_blockFunction:implementation,fields,mutation:null};
    const container={_cache:{_executeCached:{try:{_ops:[operation]}}},getBlock:id=>blocks[id],
        getBranch:(_id,number)=>block.inputs[number===1?'SUBSTACK':'SUBSTACK'+number]?.block??null};
    const target={blocks:container};thread.target=target;thread.blockContainer=container;thread.pushStack('try');
    const sequencer={runtime,activeThread:thread};runtime.sequencer=sequencer;runtime.threads=[thread];runtime.targets=[target];runtime.getOpcodeFunction=()=>implementation;
    const activation=engine.enter(sequencer,thread),lease=engine.captureFrame(activation);
    return {runtime,thread,sequencer,args,fields,inputs,block,blocks,container,operation,activation,lease};
};
const bind=v=>engine.bindHandlerEntry(v.activation,v.lease,v.args);

test('real binder owns branch identities but issues no transfer acknowledgement',()=>{
    const v=fixture(),entry=bind(v);assert.ok(entry);
    const view=engine.inspectHandlerEntry(entry,v.runtime,v.thread);
    assert.equal(view.catchBranch,'catchBody');assert.equal(view.finallyBranch,'finallyBody');
    assert.equal(view.catchName,'error');assert.equal(view.transferAcknowledged,false);
    assert.equal(engine.inspectHandlerEntry({...entry},v.runtime,v.thread),null);
    v.thread.pushStack('tryBody');assert.ok(engine.inspectHandlerEntry(entry,v.runtime,v.thread));
    v.thread.popStack();assert.ok(engine.inspectHandlerEntry(entry,v.runtime,v.thread));
    v.thread.reuseStackForNextBlock('after');assert.equal(engine.inspectHandlerEntry(entry,v.runtime,v.thread),null);
});
test('foreign lifetime, wrong actual args/function/cache root and ended execution cannot bind',()=>{
    const v=fixture(),other=fixture();assert.equal(engine.bindHandlerEntry(v.activation,other.lease,v.args),null);
    assert.equal(engine.bindHandlerEntry(v.activation,v.lease,{...v.args}),null);
    v.operation._blockFunction=()=>{};assert.equal(bind(v),null);
    const fresh=fixture();engine.leave(fresh.activation);assert.equal(bind(fresh),null);
});
test('field/branch/implementation edits invalidate a previously bound entry',()=>{
    for(const mutate of [v=>{v.fields.CATCH_NAME.value='other';},v=>{v.inputs.SUBSTACK2={block:'catchBody',shadow:null};},
        v=>{v.blocks.catchBody={id:'catchBody'};},v=>{v.container._cache._executeCached.try._ops=[];},
        v=>{v.runtime.getOpcodeFunction=()=>()=>{};},v=>{v.args.extra=1;}]){
        const v=fixture(),entry=bind(v);assert.ok(entry);mutate(v);assert.equal(engine.inspectHandlerEntry(entry,v.runtime,v.thread),null);
    }
});
test('absent and authored-empty branches differ by flags; invalid selectors/shadow/accessors refuse',()=>{
    const empty=fixture();empty.inputs.SUBSTACK2.block=null;assert.ok(bind(empty));
    const absent=fixture();absent.args.HAS_CATCH=absent.fields.HAS_CATCH.value='0';absent.args.CATCH_NAME=absent.fields.CATCH_NAME.value='';
    assert.equal(bind(absent),null);delete absent.inputs.SUBSTACK2;assert.ok(bind(absent));
    for(const mutate of [v=>{v.inputs.SUBSTACK2.shadow='shadow';},v=>{v.args.HAS_CATCH=v.fields.HAS_CATCH.value='true';},
        v=>{Object.defineProperty(v.inputs.SUBSTACK2,'block',{get(){throw Error('must not read branch getter');}});}]){
        const v=fixture();mutate(v);assert.equal(bind(v),null);
    }
});
test('Stop/restart or a pooled identical frame cannot revive an old entry',()=>{
    const v=fixture(),entry=bind(v);assert.ok(entry);
    v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');assert.equal(engine.inspectHandlerEntry(entry,v.runtime,v.thread),null);
    const other=fixture(),before=bind(other),frame=other.thread.peekStackFrame();other.thread.popStack();other.thread.pushStack('try');
    assert.equal(other.thread.peekStackFrame(),frame);assert.equal(engine.inspectHandlerEntry(before,other.runtime,other.thread),null);
});
