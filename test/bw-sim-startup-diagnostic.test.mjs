// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimRunner} from '../overlay/scratch-gui/src/lib/bw-sim/sim-worker-protocol.js';
import {createPhysicsHost} from '../overlay/scratch-gui/src/lib/bw-sim/physics/physics-host.js';
import {startupDiagnosticSelection, collectStartupDiagnostic} from '../overlay/scratch-gui/src/lib/bw-sim/measurements/startup-diagnostic.js';

const mechanism = {bodies:[{id:'a',motion:'dynamic'},{id:'b',motion:'dynamic'}],joints:[{id:'h',type:'hinge'},{id:'s',type:'slider'}]};
const selection = {revision:7,bodies:['a','b'],joints:['h','s'],stopSeconds:0.55};
const fake = () => {
    let t = 0, saved = 0, fail = false, detaches = 0;
    const listeners = new Set(), operations = [], pose = {position:[0,0,0],rotation:[0,0,0,1]};
    const core = {
        get time(){return t;},
        checkpoint(){operations.push('checkpoint');saved=t;}, rollback(){operations.push('rollback');t=saved;},
        step(dt){operations.push(['step',dt]);const n=Math.round(dt/0.005);for(let i=0;i<n;i++){t+=0.005;if(fail)throw Error('step failed');for(const cb of listeners)cb({t,stepSeconds:0.005});}},
        observeFixedSteps(cb){listeners.add(cb);return()=>{detaches++;listeners.delete(cb);};},
        bodyPose(id){pose.position[0]=t+(id==='a'?1:2);return pose;},
        bodyLinearVelocity:()=>[0,0,0],bodyAngularVelocity:()=>[0,0,0],bodyDynamics:()=>({massKg:1}),
        jointState:()=>({angle:t,position:t,velocity:0}),jointDynamics:()=>({t,motorTorqueNm:0}),
        currentContactPairs:()=>[['a','b']],destroy(){operations.push('destroy');}
    };
    const runner = createSimRunner({J:{},createPhysicsCore:()=>core,mechanism,stepMs:5});
    return {core,runner,operations,listeners,get detaches(){return detaches;},fail:()=>{fail=true;}};
};

test('optional trace leaves ordinary result keys/order, typed arrays and command/step order unchanged',()=>{
    const off=fake(), on=fake();
    const a=off.runner.run({ticks:[10]}), b=on.runner.run({ticks:[10],startupDiagnostic:selection});
    const {startupDiagnostic:trace,...ordinary}=b;
    assert.deepEqual(Object.keys(ordinary),Object.keys(a)); assert.deepEqual(ordinary,a);
    assert.deepEqual(off.operations,on.operations); assert.equal(Object.hasOwn(a,'startupDiagnostic'),false);
    assert.equal(off.detaches,0); assert.equal(on.detaches,1);
    assert.equal(trace.initial.t,0);assert.deepEqual(trace.samples.map(x=>x.t),[0.005,0.01]);
    assert.equal(trace.qualification,false);assert.ok(trace.unavailable.includes('contactImpulses'));
});

test('binding-style shared temporaries are copied immediately per body and per step',()=>{
    const f=fake(),r=f.runner.run({ticks:[10],startupDiagnostic:selection}).startupDiagnostic;
    assert.equal(r.initial.bodies[0].pose.position[0],1);
    assert.equal(r.initial.bodies[1].pose.position[0],2);
    assert.equal(r.samples[0].bodies[0].pose.position[0],1.005);
    f.core.bodyPose('b');assert.equal(r.samples[1].bodies[0].pose.position[0],1.01);
});

test('redo uses rolled-back initial state and a fresh collector, not rejected-attempt rows',()=>{
    const f=fake();
    const rejected=f.runner.run({ticks:[10],startupDiagnostic:selection}).startupDiagnostic;
    rejected.samples[0].bodies[0].pose.position[0]=99;
    const accepted=f.runner.run({ticks:[5],redo:true,startupDiagnostic:{...selection,revision:8}}).startupDiagnostic;
    assert.equal(accepted.revision,8);assert.equal(accepted.initial.t,0);
    assert.equal(accepted.samples.length,1);assert.equal(accepted.samples[0].t,0.005);
    assert.equal(accepted.samples[0].bodies[0].pose.position[0],1.005);
    assert.equal(f.detaches,2);assert.equal(f.listeners.size,0);
});

test('invalid requests reject before checkpoint or solver steps; absent selection reads nothing',()=>{
    for(const change of [{revision:0},{stopSeconds:0.551},{bodies:['a','a']},{joints:['missing']},{bodies:[]},{bodies:Array(1)},{joints:Array(1)}]){
        const f=fake();assert.throws(()=>f.runner.run({ticks:[5],startupDiagnostic:{...selection,...change}}),/invalid startup/);
        assert.deepEqual(f.operations,[]);
    }
    assert.equal(collectStartupDiagnostic({},null),null);
    assert.equal(startupDiagnosticSelection(null,mechanism),null);
    assert.throws(()=>startupDiagnosticSelection(selection,{...mechanism,bodies:Array.from({length:17},(_,i)=>({id:String(i),motion:'dynamic'}))}),/invalid startup/);
    assert.throws(()=>startupDiagnosticSelection({...selection,bodies:['a','b','c','d','e','f','g']},{...mechanism,bodies:'abcdefg'.split('').map(id=>({id,motion:'dynamic'}))}),/invalid startup/);
});

test('bounded completed-step prefix retains actual step times and always detaches on failure',()=>{
    const f=fake(),r=f.runner.run({ticks:[560],startupDiagnostic:selection}).startupDiagnostic;
    assert.equal(r.samples.length,110);assert.ok(Math.abs(r.samples.at(-1).t-0.55)<1e-12);assert.equal(r.overflow,false);
    const bad=fake();bad.fail();assert.throws(()=>bad.runner.run({ticks:[5],startupDiagnostic:selection}),/step failed/);
    assert.equal(bad.detaches,1);assert.equal(bad.listeners.size,0);
    const missing=fake();delete missing.core.currentContactPairs;
    const packet=missing.runner.run({ticks:[5],startupDiagnostic:selection}).startupDiagnostic;
    assert.equal(packet.samples[0].contactPairs,null);assert.ok(packet.unavailable.includes('currentContactPairs'));
    let cb,detaches=0;
    const bare={time:0,observeFixedSteps:fn=>{cb=fn;return()=>detaches++;}};
    const bounded=collectStartupDiagnostic(bare,selection);
    for(let i=0;i<112;i++)cb({t:0.005,stepSeconds:0.005});
    assert.equal(bounded.take().samples.length,110);assert.equal(bounded.take().overflow,true);
    bounded.detach();bounded.detach();cb({t:0.005,stepSeconds:0.005});
    assert.equal(bounded.take().samples.length,110);assert.equal(detaches,1);
});

test('actual host forwards optional packet only when present, preserving transfer ordering',async()=>{
    const posts=[],f=fake();
    const host=createPhysicsHost({loadJolt:async()=>({}),createPhysicsCore:()=>f.core,createSimRunner:()=>f.runner,post:(msg,transfer)=>posts.push({msg,transfer})});
    await host.handle({type:'sim-load',id:1,mechanism,hubs:[],stepMs:5});
    await host.handle({type:'sim-batch',id:2,scene:1,ticks:[5]});
    await host.handle({type:'sim-batch',id:3,scene:1,ticks:[5],startupDiagnostic:selection});
    assert.equal(posts[1].msg.type,'sim-frames');assert.equal(Object.hasOwn(posts[1].msg,'startupDiagnostic'),false);
    assert.equal(posts[2].msg.startupDiagnostic.revision,7);
    for(const {msg,transfer} of posts)assert.deepEqual(transfer,[msg.bodies.buffer,msg.joints.buffer]);
});
