// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('../overlay/scratch-vm/src/util/bw-structured-continuations');
// PURE fake frame observations, not a Scratch VM or proof of engine hooks.
// No clocks, compiler, original project, subprocess or provider.
const fixture = () => {
    const frames=new WeakMap(), parents=new WeakMap();
    const bridge=create((thread,frame,top=false)=>frames.get(thread)?.includes(frame)===true&&
        (!top||frames.get(thread).at(-1)===frame),
        thread=>parents.get(thread)||null);
    const add=()=>{const thread={},frame={};frames.set(thread,[frame]);return {thread,frame};};
    bridge.start();return {bridge,frames,parents,add};
};

test('owned active frame plans a catch once; preview neither executes nor finishes it',()=>{
    const {bridge,add}=fixture(),{thread,frame}=add(),inv=bridge.begin(thread,frame);
    let executed=0;const body=()=>{executed++;},handler=bridge.enter(inv,body,{}),signal={};
    const plan=bridge.offerOwnedThrow(thread,frame,signal,'payload');assert.ok(plan);
    const seen=bridge.inspectPlan(plan,signal);assert.equal(seen.kind,'catch');assert.equal(seen.body,body);
    assert.equal(seen.invocation,inv);assert.equal(seen.frame,handler);assert.equal(seen.value,'payload');
    assert.equal(bridge.takePlan(plan,{}),null);assert.ok(bridge.takePlan(plan,signal));
    assert.equal(bridge.takePlan(plan,signal),null);assert.equal(executed,0);
    assert.equal(bridge.complete(inv,handler,'throw','payload').kind,'catch');
    assert.equal(bridge.complete(inv,handler,'return',9).kind,'finally');
    assert.equal(bridge.describe(inv,bridge.complete(inv,handler,'normal').completion).value,9);
});

test('nested catch/finally does not recatch or skip a running finalizer',()=>{
    const {bridge,add}=fixture(),{thread,frame}=add(),inv=bridge.begin(thread,frame);
    const outer=bridge.enter(inv,{},{}),inner=bridge.enter(inv,{},{}),signal={};
    assert.equal(bridge.inspectPlan(bridge.offerOwnedThrow(thread,frame,signal,1),signal).frame,inner);
    assert.equal(bridge.complete(inv,inner,'throw',1).kind,'catch');
    const fromCatch=bridge.offerOwnedThrow(thread,frame,signal,2);
    assert.equal(bridge.inspectPlan(fromCatch,signal).kind,'finally');
    bridge.complete(inv,inner,'throw',2);
    assert.equal(bridge.offerOwnedThrow(thread,frame,signal,3),null);
    const propagated=bridge.complete(inv,inner,'normal').completion;assert.equal(bridge.describe(inv,propagated).value,2);
    assert.equal(bridge.inspectPlan(bridge.offerOwnedThrow(thread,frame,signal,2),signal).frame,outer);
});

test('actual managed parent edge reaches a suspended caller, with edge revalidation',()=>{
    const {bridge,add,parents}=fixture(),caller=add(),child=add();
    const inv=bridge.begin(caller.thread,caller.frame);bridge.enter(inv,{},{});
    const suspension=bridge.suspend(inv),signal={};
    assert.equal(bridge.offerOwnedThrow(child.thread,child.frame,signal,4),null);
    parents.set(child.thread,{thread:caller.thread,frame:caller.frame});
    const plan=bridge.offerOwnedThrow(child.thread,child.frame,signal,4);assert.ok(plan);
    parents.delete(child.thread);assert.equal(bridge.takePlan(plan,signal),null);
    parents.set(child.thread,{thread:caller.thread,frame:caller.frame});
    assert.ok(bridge.takePlan(bridge.offerOwnedThrow(child.thread,child.frame,signal,4),signal));
    assert.equal(bridge.resume(inv,suspension),true);
});

test('foreign/copied plans, replaced caller frame and retired child do not transfer ownership',()=>{
    const {bridge,add,frames,parents}=fixture(),caller=add(),child=add(),foreign=fixture();
    const inv=bridge.begin(caller.thread,caller.frame),signal={};bridge.enter(inv,{},{});
    parents.set(child.thread,{thread:caller.thread,frame:caller.frame});
    const plan=bridge.offerOwnedThrow(child.thread,child.frame,signal,5);assert.ok(plan);
    assert.equal(foreign.bridge.inspectPlan(plan,signal),null);assert.equal(bridge.takePlan({...plan},signal),null);
    frames.set(child.thread,[]);assert.equal(bridge.takePlan(plan,signal),null);
    frames.set(child.thread,[child.frame]);const next=bridge.offerOwnedThrow(child.thread,child.frame,signal,5);assert.ok(next);
    frames.set(caller.thread,[{}]);assert.equal(bridge.takePlan(next,signal),null);
});

test('Stop/restart invalidates plans/yield leases; stale close leaves fresh invocation alive',()=>{
    const {bridge,add}=fixture(),binding=add(),signal={};
    const old=bridge.begin(binding.thread,binding.frame);bridge.enter(old,{},{});
    const lease=bridge.suspend(old),plan=bridge.offerOwnedThrow(binding.thread,binding.frame,signal,6);assert.ok(plan);
    bridge.stop();bridge.start();const fresh=bridge.begin(binding.thread,binding.frame);bridge.enter(fresh,{},{});
    const freshLease=bridge.suspend(fresh);
    assert.equal(bridge.takePlan(plan,signal),null);assert.equal(bridge.resume(old,lease),false);
    assert.equal(bridge.resume(fresh,lease),false);bridge.close(old);
    assert.equal(bridge.current(fresh),true);assert.equal(bridge.resume(fresh,freshLease),true);
    assert.ok(bridge.offerOwnedThrow(binding.thread,binding.frame,signal,7));
});

test('yielding finalizer preserves return; late frame settlement refuses',()=>{
    const {bridge,add,frames}=fixture(),binding=add(),inv=bridge.begin(binding.thread,binding.frame);
    const handler=bridge.enter(inv,null,{});bridge.complete(inv,handler,'return',12);
    const lease=bridge.suspend(inv);assert.throws(()=>bridge.complete(inv,handler,'normal'),/suspended/);
    assert.equal(bridge.resume(inv,lease),true);
    assert.equal(bridge.describe(inv,bridge.complete(inv,handler,'normal').completion).value,12);
    const late=bridge.suspend(inv);frames.set(binding.thread,[]);
    assert.equal(bridge.resume(inv,late),false);bridge.retire(binding.thread);assert.equal(bridge.current(inv),false);
});

test('preview does not authorize terminal-fallback suppression; cyclic and missing frames refuse',()=>{
    const {bridge,add,parents}=fixture(),a=add(),b=add(),signal={};let uncaught=0;
    const dispatch=()=>{const plan=bridge.offerOwnedThrow(a.thread,a.frame,signal,8);
        const observation=plan&&bridge.takePlan(plan,signal);uncaught++;return observation;};
    assert.equal(dispatch(),null);assert.equal(uncaught,1);
    const inv=bridge.begin(a.thread,a.frame);bridge.enter(inv,{},{});
    assert.equal(dispatch().kind,'catch');assert.equal(uncaught,2);
    bridge.retire(a.thread);assert.equal(bridge.offerOwnedThrow(a.thread,a.frame,signal,8),null);
    parents.set(a.thread,b);parents.set(b.thread,a);
    assert.equal(bridge.offerOwnedThrow(a.thread,a.frame,signal,8),null);
    assert.throws(()=>bridge.begin({},{}),/actual current frame/);
});

test('same-thread frame ancestry is explicit, and a newer top frame invalidates an older throw plan',()=>{
    const frames=new WeakMap();
    const bridge=create((thread,frame,top=false)=>frames.get(thread)?.includes(frame)===true&&
        (!top||frames.get(thread).at(-1)===frame),
        (thread,frame)=>{const stack=frames.get(thread),index=stack.indexOf(frame);
            return index>0?{thread,frame:stack[index-1]}:null;});
    bridge.start();const thread={},root={},inner={},nearer={};frames.set(thread,[root]);
    const inv=bridge.begin(thread,root);bridge.enter(inv,{},{});frames.set(thread,[root,inner]);
    const signal={},plan=bridge.offerOwnedThrow(thread,inner,signal,10);assert.ok(plan);
    frames.set(thread,[root,inner,nearer]);assert.equal(bridge.takePlan(plan,signal),null);
    assert.ok(bridge.takePlan(bridge.offerOwnedThrow(thread,nearer,signal,11),signal));
});
