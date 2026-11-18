// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// NEW UNRUN controls for the actual instrumented Thread/frame lifetime helper.
// No VM/guest and no rerun of the prior activation/preview/foundation suites.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {EventEmitter}=require('node:events');
const hooks=require('../scripts/lib/engine-activation-hooks.cjs');
const engine=require('../overlay/scratch-vm/src/util/bw-engine-activations');
assert.ok(process.argv[2],'Supply the selected Thread source');
const loaded={exports:{}};new Function('require','module',hooks.patchThreadActivations(fs.readFileSync(process.argv[2],'utf8')))(
    name=>{assert.equal(name,'../util/bw-engine-activations');return engine;},loaded);
const Thread=loaded.exports;
const fixture=()=>{const runtime=new EventEmitter(),thread=new Thread('caller'),target={blocks:{}};
    thread.target=target;thread.blockContainer=target.blocks;thread.pushStack('caller');
    const sequencer={runtime,activeThread:thread};runtime.sequencer=sequencer;runtime.targets=[target];runtime.threads=[thread];
    const activation=engine.enter(sequencer,thread),frame=thread.peekStackFrame(),lease=engine.captureFrame(activation);
    assert.ok(lease);return {runtime,thread,sequencer,activation,frame,lease};};

test('frame lifetime survives child push/pop while the original execute ticket expires',()=>{
    const {runtime,thread,sequencer,activation,frame,lease}=fixture();engine.leave(activation);
    thread.pushStack('child');assert.equal(engine.valid(activation,sequencer,thread),false);
    assert.equal(engine.validFrame(lease,runtime,thread,frame),true);
    thread.popStack();assert.equal(engine.validFrame(lease,runtime,thread,frame),true);
});
test('same-frame reset and pop/free-list reuse invalidate a lifetime permanently',()=>{
    for(const operation of ['reuse','pool']){const {runtime,thread,frame,lease}=fixture();
        if(operation==='reuse')thread.reuseStackForNextBlock('other');else{thread.popStack();thread.pushStack('caller');}
        assert.equal(thread.peekStackFrame(),frame);assert.equal(engine.validFrame(lease,runtime,thread,frame),false);
    }
});
test('foreign/copy/Stop-restart lifetime cannot authorize a fresh caller',()=>{
    const {runtime,thread,sequencer,frame,lease}=fixture();
    assert.equal(engine.validFrame({...lease},runtime,thread,frame),false);
    assert.equal(engine.validFrame(lease,{},thread,frame),false);
    runtime.emit('PROJECT_STOP_ALL');runtime.emit('PROJECT_START');
    const fresh=engine.enter(sequencer,thread),next=engine.captureFrame(fresh);assert.ok(next);assert.notEqual(next,lease);
    assert.equal(engine.validFrame(lease,runtime,thread,frame),false);assert.equal(engine.validFrame(next,runtime,thread,frame),true);
});
test('frame lifetime capture requires the exact live engine entry, not an old ticket or copied data',()=>{
    const {thread,sequencer,activation}=fixture();engine.leave(activation);
    assert.equal(engine.captureFrame(activation),null);assert.equal(engine.captureFrame({...activation}),null);
    const next=engine.enter(sequencer,thread);assert.ok(engine.captureFrame(next));
});

test('actual changed link consumer rejects a stale supplied frame lease without active-caller downgrade',()=>{
    const path=require('node:path');
    const source=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/util/bw-arcade-exceptions.js'),'utf8');
    const start=source.indexOf('        link(child, caller, cleanup = () => {}, lease = null) {');
    const end=source.indexOf('        linkPhysicalUpdate(',start);assert.ok(start>=0&&end>start);
    const method=source.slice(start,end); // actual changed method, not a copied implementation
    const {runtime,thread:caller,frame,lease:frameLease}=fixture();
    const child=new Thread('child');child.target=caller.target;child.blockContainer=caller.blockContainer;child.pushStack('child');runtime.threads.push(child);
    const owner={},callerLeases=new WeakMap(),edges=new WeakMap(),lease=Object.freeze({}),generation=3;
    callerLeases.set(lease,{owner,thread:caller,frame,generation,frameLease});
    const remove=WeakMap.prototype.delete,apply=Reflect.apply;
    const link=new Function('callerLeases','owner','generation','engineActivations','live','runtime','edges','structuredBridge','failureGet','failureHas','failureDelete','setCurrent',
        'return ({'+method+'}).link;')(callerLeases,owner,generation,engine,
        value=>runtime.threads.includes(value)&&!value.isKilled,runtime,edges,null,
        (map,key)=>map.get(key),(map,key)=>map.has(key),(map,key)=>apply(remove,map,[key]),(map,key,value)=>map.set(key,value));
    const unlink=link(child,caller,()=>{},lease);assert.equal(typeof unlink,'function');unlink();
    caller.reuseStackForNextBlock('replacement');assert.equal(caller.peekStackFrame(),frame);
    assert.equal(runtime.sequencer.activeThread,caller);
    assert.throws(()=>link(child,caller,()=>{},lease),/current retained caller lease/);
    // A genuinely direct current caller keeps the original no-lease path.
    assert.equal(typeof link(child,caller,()=>{},null),'function');
});
