// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Executes the producer's REAL selected Thread mutators and handlePromise
// consumer, not copied implementations. No VM/guest/compiler is constructed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {EventEmitter}=require('node:events');
const hooks=require('../scripts/lib/engine-activation-hooks.cjs');
const activations=require('../overlay/scratch-vm/src/util/bw-engine-activations');
const threadPath=process.argv[2],executePath=process.argv[3];
assert.ok(threadPath&&executePath,'Supply the exact selected Thread and execute source paths');
const threadSource=fs.readFileSync(threadPath,'utf8'),executeSource=fs.readFileSync(executePath,'utf8');
const patchedThread=hooks.patchThreadActivations(threadSource),patchedExecute=hooks.patchExecuteActivations(executeSource);
const threadModule={exports:{}};
new Function('require','module',patchedThread)(name=>{
    assert.equal(name,'../util/bw-engine-activations');return activations;
},threadModule);
const Thread=threadModule.exports;
const start=patchedExecute.indexOf('const handlePromise = (');
const end=patchedExecute.indexOf('\n/**\n * A execute.js internal representation',start);
assert.ok(start>=0&&end>start);
const promiseSource=patchedExecute.slice(start,end);
const makeHandlePromise=new Function('Thread','bwEngineActivations','bwArcadeExceptions','handleReport','log',
    promiseSource+'\nreturn handlePromise;');
const fixture=()=>{
    const runtime=new EventEmitter(),thread=new Thread('A'),target={blocks:{}};
    thread.target=target;thread.blockContainer=target.blocks;thread.pushStack('A');
    const sequencer={runtime,activeThread:thread};runtime.sequencer=sequencer;
    runtime.threads=[thread];runtime.targets=[target];
    return {runtime,thread,sequencer};
};
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
const observer=()=>{
    const observed={reports:[],warnings:[]};
    // These are observations of other services, not substitute activation or
    // consumer implementations. The changed guard/Thread code executes above.
    const terminal={capture:()=>null,stale:()=>false,consume:()=>false};
    observed.consume=makeHandlePromise(Thread,activations,terminal,
        value=>observed.reports.push(value),{warn:(...args)=>observed.warnings.push(args)});
    return observed;
};

test('real reuse/reset invalidates an engine ticket even with the identical frame object',()=>{
    const {thread,sequencer}=fixture(),frame=thread.peekStackFrame();
    const ticket=activations.enter(sequencer,thread);assert.ok(ticket);
    assert.equal(activations.capture(sequencer,thread),ticket);activations.leave(ticket);
    assert.equal(activations.capture(sequencer,thread),null);assert.equal(activations.valid(ticket,sequencer,thread),true);
    thread.reuseStackForNextBlock('B');assert.equal(thread.peekStackFrame(),frame);
    assert.equal(activations.valid(ticket,sequencer,thread),false);
    thread.reuseStackForNextBlock('A');assert.equal(activations.valid(ticket,sequencer,thread),false);
    const next=activations.enter(sequencer,thread);assert.notEqual(next,ticket);
    thread.peekStackFrame().reuse();assert.equal(activations.valid(next,sequencer,thread),false);
});

test('real pop/free-list/push and branch pushes cannot renew a released activation',()=>{
    const {thread,sequencer}=fixture(),frame=thread.peekStackFrame();
    const ticket=activations.enter(sequencer,thread);activations.leave(ticket);
    thread.popStack();thread.pushStack('A');assert.equal(thread.peekStackFrame(),frame);
    assert.equal(activations.valid(ticket,sequencer,thread),false);
    const next=activations.enter(sequencer,thread);thread.pushStack('branch');
    assert.equal(activations.valid(next,sequencer,thread),false);
});

test('nested execution scopes restore capture while Stop/start/load/dispose invalidate old entries',()=>{
    const {thread,sequencer,runtime}=fixture();const outer=activations.enter(sequencer,thread);
    const child=new Thread('child');child.target=thread.target;child.blockContainer=thread.blockContainer;child.pushStack('child');
    runtime.threads.push(child);sequencer.activeThread=child;
    const inner=activations.enter(sequencer,child);assert.equal(activations.capture(sequencer,thread),null);
    activations.leave(inner);sequencer.activeThread=thread;assert.equal(activations.capture(sequencer,thread),outer);
    runtime.emit('PROJECT_STOP_ALL');assert.equal(activations.valid(outer,sequencer,thread),false);
    assert.equal(activations.valid(inner,sequencer,child),false);assert.equal(activations.enter(sequencer,thread),null);
    runtime.emit('PROJECT_START');const fresh=activations.enter(sequencer,thread);assert.ok(fresh);
    runtime.emit('PROJECT_LOADED');assert.equal(activations.valid(fresh,sequencer,thread),false);
    runtime.emit('PROJECT_START');const last=activations.enter(sequencer,thread);runtime.emit('RUNTIME_DISPOSED');
    assert.equal(activations.valid(last,sequencer,thread),false);assert.equal(activations.enter(sequencer,thread),null);
});

test('real handlePromise consumer still delivers a valid ordinary fulfillment',async()=>{
    const {thread,sequencer}=fixture(),watch=observer(),pending=defer();
    const ticket=activations.enter(sequencer,thread);
    watch.consume(pending.promise,sequencer,thread,{},false);activations.leave(ticket);
    assert.equal(thread.status,Thread.STATUS_PROMISE_WAIT);pending.resolve(17);await settle();
    assert.deepEqual(watch.reports,[17]);assert.equal(thread.peekStackFrame().bwPromiseReported,true);
});

test('real handlePromise fulfillment guard rejects reuse before reporting or touching the new frame',async()=>{
    const {thread,sequencer}=fixture(),watch=observer(),pending=defer();
    const ticket=activations.enter(sequencer,thread);watch.consume(pending.promise,sequencer,thread,{},false);activations.leave(ticket);
    thread.reuseStackForNextBlock('B');pending.resolve(99);await settle();
    assert.deepEqual(watch.reports,[]);assert.equal(thread.peekStack(),'B');
    assert.notEqual(thread.peekStackFrame().bwPromiseReported,true);
});

test('real handlePromise rejection guard preserves ordinary pop and rejects stale rejection without popping B',async()=>{
    const good=fixture(),first=observer(),one=defer();let ticket=activations.enter(good.sequencer,good.thread);
    first.consume(one.promise,good.sequencer,good.thread,{},false);activations.leave(ticket);one.reject('ordinary');await settle();
    assert.equal(first.warnings.length,1);assert.equal(good.thread.stack.length,0);assert.equal(good.thread.status,Thread.STATUS_RUNNING);
    const stale=fixture(),second=observer(),two=defer();ticket=activations.enter(stale.sequencer,stale.thread);
    second.consume(two.promise,stale.sequencer,stale.thread,{},false);activations.leave(ticket);
    stale.thread.reuseStackForNextBlock('B');two.reject('old');await settle();
    assert.equal(second.warnings.length,0);assert.equal(stale.thread.peekStack(),'B');
});

test('real Promise consumer drops old Stop/restart settlement while accepting the fresh invocation',async()=>{
    const {thread,sequencer,runtime}=fixture(),watch=observer(),old=defer();let ticket=activations.enter(sequencer,thread);
    watch.consume(old.promise,sequencer,thread,{},false);activations.leave(ticket);
    runtime.emit('PROJECT_STOP_ALL');runtime.emit('PROJECT_START');thread.status=Thread.STATUS_RUNNING;
    const fresh=defer();ticket=activations.enter(sequencer,thread);watch.consume(fresh.promise,sequencer,thread,{},false);activations.leave(ticket);
    old.resolve('old');await settle();assert.deepEqual(watch.reports,[]);
    fresh.resolve('fresh');await settle();assert.deepEqual(watch.reports,['fresh']);
});

test('producer strips its own hooks before existing producers, is idempotent and rejects partial hooks',()=>{
    assert.equal(hooks.patchThreadActivations(patchedThread),patchedThread);
    assert.equal(hooks.patchExecuteActivations(patchedExecute),patchedExecute);
    assert.equal(hooks.stripThreadActivations(patchedThread),threadSource);
    assert.equal(hooks.stripExecuteActivations(patchedExecute),executeSource);
    assert.throws(()=>hooks.patchThreadActivations(patchedThread.replace('bwEngineActivations.invalidateFrame(this);','')),/anchor/);
    assert.throws(()=>hooks.patchExecuteActivations(patchedExecute.replace('bwEngineActivations.leave(bwEngineActivationEntry);','')),/anchor/);
});
