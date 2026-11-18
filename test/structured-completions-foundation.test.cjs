// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Pure detached-state controls. No Scratch, parser, compiler, model, clocks,
// process spawning or original research inputs. Run this file directly with
// Node (without --test) to avoid the test runner spawning isolated children.
const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('../overlay/scratch-vm/src/util/bw-structured-completions');
const opened = () => {const owner=create();owner.start();return {owner, invocation:owner.beginInvocation()};};
const view = (owner, invocation, completion) => owner.describe(invocation, completion);

test('normal and return completions survive a normal finalizer exactly once', () => {
    for (const kind of ['normal','return']) {
        const {owner, invocation}=opened(), body={name:'cleanup'}, frame=owner.enterTry(invocation,null,body);
        const initial=owner.completion(invocation,kind,17);
        const finalizer=owner.finish(invocation,frame,initial);
        assert.equal(finalizer.kind,'finally');assert.equal(finalizer.body,body);
        assert.equal(finalizer.completion,initial);
        const ended=owner.finish(invocation,frame,owner.completion(invocation,'normal',99));
        assert.equal(ended.kind,'complete');assert.equal(ended.completion,initial);
        assert.deepEqual(view(owner,invocation,ended.completion),{kind,value:17,target:null});
        assert.throws(()=>owner.finish(invocation,frame,initial),/innermost/);
        owner.endInvocation(invocation);assert.equal(owner.current(invocation),false);
    }
});

test('catch receives only throw and catch completion enters finally before propagating', () => {
    const {owner,invocation}=opened(), catchBody={}, finalBody={}, thrown={identity:'opaque payload'};
    const frame=owner.enterTry(invocation,catchBody,finalBody);
    const thrownRecord=owner.completion(invocation,'throw',thrown);
    const caught=owner.finish(invocation,frame,thrownRecord);
    assert.equal(caught.kind,'catch');assert.equal(caught.body,catchBody);
    assert.equal(view(owner,invocation,caught.completion).value,thrown);
    const returned=owner.completion(invocation,'return',8);
    const finalizer=owner.finish(invocation,frame,returned);
    assert.equal(finalizer.kind,'finally');assert.equal(finalizer.body,finalBody);
    assert.equal(finalizer.completion,returned);
    assert.equal(owner.finish(invocation,frame,owner.completion(invocation,'normal')).completion,returned);
    const bypass=owner.enterTry(invocation,catchBody,null), normal=owner.completion(invocation,'normal');
    assert.equal(owner.finish(invocation,bypass,normal).kind,'complete');
});

test('each abrupt finalizer completion overrides the pending one and preserves jump identity', () => {
    for (const kind of ['return','break','continue','throw']) {
        const {owner,invocation}=opened(), frame=owner.enterTry(invocation,null,{});
        const pending=owner.completion(invocation,'throw','old');owner.finish(invocation,frame,pending);
        const target=kind==='break'||kind==='continue'?owner.declareTarget(invocation,'loop'):null;
        const replacement=owner.completion(invocation,kind,target?undefined:'new',target);
        const ended=owner.finish(invocation,frame,replacement);
        assert.equal(ended.completion,replacement);assert.equal(view(owner,invocation,ended.completion).kind,kind);
        assert.equal(view(owner,invocation,ended.completion).target,target);
    }
});

test('nested unwinding is innermost first for return, break, continue and throw', () => {
    for (const kind of ['return','break','continue','throw']) {
        const {owner,invocation}=opened(), outerBody={}, innerBody={};
        const outer=owner.enterTry(invocation,{},outerBody), inner=owner.enterTry(invocation,null,innerBody);
        const target=kind==='break'||kind==='continue'?owner.declareTarget(invocation,'loop'):null;
        const abrupt=owner.completion(invocation,kind,target?undefined:4,target);
        assert.throws(()=>owner.finish(invocation,outer,abrupt),/innermost/);
        const first=owner.finish(invocation,inner,abrupt);assert.equal(first.body,innerBody);
        const propagated=owner.finish(invocation,inner,owner.completion(invocation,'normal')).completion;
        assert.equal(propagated,abrupt);
        const next=owner.finish(invocation,outer,propagated);
        if (kind==='throw') {
            assert.equal(next.kind,'catch');
            const rethrow=owner.completion(invocation,'throw',view(owner,invocation,next.completion).value);
            assert.equal(owner.finish(invocation,outer,rethrow).body,outerBody);
        } else assert.equal(next.body,outerBody);
        const ended=owner.finish(invocation,outer,owner.completion(invocation,'normal'));
        assert.equal(ended.kind,'complete');assert.equal(view(owner,invocation,ended.completion).kind,kind);
    }
});

test('a suspended finalizer retains pending completion and only its one-use lease may resume it', () => {
    const {owner,invocation}=opened(), frame=owner.enterTry(invocation,null,{});
    const returned=owner.completion(invocation,'return',21);owner.finish(invocation,frame,returned);
    const normal=owner.completion(invocation,'normal'), lease=owner.suspend(invocation);
    assert.throws(()=>owner.finish(invocation,frame,normal),/suspended/);
    assert.throws(()=>owner.enterTry(invocation,null,{}),/suspended/);
    assert.throws(()=>owner.suspend(invocation),/suspended/);
    assert.equal(owner.resume(invocation,{}),false);assert.equal(owner.resume(invocation,lease),true);
    assert.equal(owner.resume(invocation,lease),false);
    assert.equal(owner.finish(invocation,frame,normal).completion,returned);
});

test('Stop/restart drops suspended ownership without entering any authored body or harming a fresh run', () => {
    const {owner,invocation}=opened();let called=0;
    const body=()=>{called++;}, frame=owner.enterTry(invocation,body,body);
    const old=owner.completion(invocation,'throw','old'), lease=owner.suspend(invocation);
    owner.stop();assert.equal(owner.current(invocation),false);assert.equal(called,0);
    owner.start();const fresh=owner.beginInvocation(), freshFrame=owner.enterTry(fresh,null,body);
    const saved=owner.completion(fresh,'return',33), freshNormal=owner.completion(fresh,'normal');
    owner.finish(fresh,freshFrame,saved);const freshLease=owner.suspend(fresh);
    assert.equal(owner.resume(invocation,lease),false);assert.equal(owner.resume(fresh,lease),false);
    assert.throws(()=>owner.finish(invocation,frame,old),/live invocation/);
    assert.throws(()=>owner.finish(fresh,freshFrame,freshNormal),/suspended/);
    assert.equal(owner.resume(fresh,freshLease),true);
    assert.equal(owner.finish(fresh,freshFrame,freshNormal).completion,saved);assert.equal(called,0);
});

test('foreign records, copied data, invocation frames and control targets cannot transfer ownership', () => {
    const {owner,invocation}=opened(), other=owner.beginInvocation(), foreign=create();foreign.start();
    const outsider=foreign.beginInvocation(), frame=owner.enterTry(invocation,null,{});
    const own=owner.completion(invocation,'normal'), otherRecord=owner.completion(other,'normal');
    assert.throws(()=>owner.finish(invocation,frame,otherRecord),/Foreign/);
    assert.throws(()=>owner.finish(invocation,frame,{...view(owner,invocation,own)}),/Foreign/);
    assert.throws(()=>owner.finish(other,frame,otherRecord),/innermost/);
    assert.throws(()=>foreign.describe(outsider,own),/Foreign/);
    const target=owner.declareTarget(other,'loop');
    assert.throws(()=>owner.completion(invocation,'break',undefined,target),/invocation target/);
    assert.throws(()=>owner.completion(invocation,'continue',undefined,owner.declareTarget(invocation,'switch')),/invocation target/);
    assert.throws(()=>owner.completion(invocation,'return',1,target),/Only a structured jump/);
    assert.throws(()=>owner.completion(invocation,'cancel'),/Unknown/);
    // Failed validation left the actual pending boundary usable.
    owner.finish(invocation,frame,own);
    assert.equal(owner.finish(invocation,frame,own).completion,own);
});

test('independent invocations survive sibling suspension/cancellation; ended/disposed owners stay closed', () => {
    const {owner,invocation}=opened(), sibling=owner.beginInvocation();
    const lease=owner.suspend(invocation), frame=owner.enterTry(sibling,null,{});
    const normal=owner.completion(sibling,'normal');owner.finish(sibling,frame,normal);
    owner.finish(sibling,frame,normal);owner.endInvocation(sibling);
    assert.equal(owner.resume(invocation,lease),true);
    const cancelledLease=owner.suspend(invocation);owner.cancelInvocation(invocation);
    assert.equal(owner.resume(invocation,cancelledLease),false);
    assert.throws(()=>owner.completion(sibling,'normal'),/live invocation/);
    assert.throws(()=>owner.start(),/stopped owner/);
    const fresh=owner.beginInvocation();owner.enterTry(fresh,null,{});
    assert.throws(()=>owner.endInvocation(fresh),/unwind boundary/);
    owner.dispose();assert.equal(owner.current(fresh),false);assert.throws(()=>owner.start(),/stopped owner/);
});
