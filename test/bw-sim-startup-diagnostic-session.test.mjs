// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {SimSession} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {PhysicsClient} from '../overlay/scratch-gui/src/lib/bw-sim/physics/physics-client.js';
import {admitStartupDiagnostic} from '../overlay/scratch-gui/src/lib/bw-sim/measurements/startup-diagnostic-consumer.js';
import {createPrecisionAnalysis} from '../overlay/scratch-gui/src/lib/bw-sim/measurements/precision.js';

const mechanism={bodies:[{id:'body',motion:'dynamic'}],joints:[{id:'hinge',type:'hinge'}]};
const option={bodies:['body'],joints:['hinge'],stopSeconds:0.55};
const selection={...option,revision:1};
// Independent wire fixtures: no producer imports or engine execution.
const row=(t,stepSeconds,marker=0)=>({t,stepSeconds,bodies:[{id:'body',pose:{position:[marker,0,0],rotation:[0,0,0,1]},
    linearVelocityMS:[0,0,0],angularVelocityRadS:[0,0,0],dynamics:{solverMassKg:1}}],
    joints:[{id:'hinge',state:{angle:0,velocity:0},dynamics:null}],contactPairs:[]});
const packet=(revision=1,marker=0)=>({schema:'robot-lab.startup-diagnostic.v1',revision,qualification:false,stopSeconds:0.55,
    initial:row(0,null,marker),samples:[row(0.005,0.005,marker)],overflow:false,
    unavailable:['hingeAnchorImpulses','contactImpulses','effectiveIslandIterations']});
const reply=(diagnostic=packet())=>({type:'sim-frames',t:0.005,bodies:new Float64Array([0,0,0,0,0,0,1]),joints:new Float64Array(2),
    frames:[],observations:null,startupDiagnostic:diagnostic,workMs:0});
const session=()=>{
    const s=Object.create(SimSession.prototype),requests=[],events=[];
    Object.assign(s,{mechanism,worker:true,scene:1,time:0,_steps:0,_ticks:[],_pendingMs:0,_inFlight:null,_idle:[],
        _disposed:false,failed:null,bridge:null,hubs:[],listeners:new Set(),_measurementObservation:null,
        _precisionAnalysis:createPrecisionAnalysis(null),stats:{batches:0,steps:0,redos:0,diverged:0,droppedMs:0,roundTripMs:0,maxRoundTripMs:0,workerMs:0,mainMs:0},
        core:{time:0,bodyIds:['body'],update(r){events.push('update');this.time=r.t;}},
        client:{simBatch:request=>new Promise(resolve=>requests.push({request,resolve})),simDispose:async()=>{events.push('dispose');}}});
    s.onAdvance(()=>events.push('advance'));
    const send=()=>{s._ticks=[5];s._pendingMs=5;s._send();};
    return {s,requests,events,send};
};
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('client request keys/order remain unchanged when disabled and forward optional diagnostic only on request',async()=>{
    const sent=[],port={postMessage(msg){sent.push(structuredClone(msg));queueMicrotask(()=>port.onmessage({data:{type:'sim-frames',id:msg.id}}));}};
    const client=new PhysicsClient(port);
    await client.simBatch({scene:1});await client.simBatch({scene:1,startupDiagnostic:selection});
    assert.deepEqual(Object.keys(sent[0]),['type','scene','steps','ticks','hubs','redo','observation','id']);
    assert.equal(Object.hasOwn(sent[0],'startupDiagnostic'),false);assert.deepEqual(sent[1].startupDiagnostic,selection);
});

test('idle cold-worker enable validates atomically; normal session sends no new field',()=>{
    const f=session();f.send();assert.equal(Object.hasOwn(f.requests[0].request,'startupDiagnostic'),false);
    const g=session();const selected=g.s.setStartupDiagnostic(option);selected.bodies[0]='changed';
    assert.equal(g.s._startupDiagnosticSelection.bodies[0],'body');
    assert.throws(()=>g.s.setStartupDiagnostic({...option,stopSeconds:1}),/invalid startup/);
    assert.equal(g.s.startupDiagnosticRevision,1);
    g.s.core.time=0.005;assert.throws(()=>g.s.setStartupDiagnostic(option),/before its first tick/);
    const h=session();h.s.worker=false;assert.throws(()=>h.s.setStartupDiagnostic(option),/idle worker/);
    const k=session();k.s.time=1;assert.throws(()=>k.s.setStartupDiagnostic(option),/before its first tick/);
});

test('only an accepted batch contributes copied diagnostics before onAdvance; repeated reads cannot mutate it',async()=>{
    const f=session();f.s.setStartupDiagnostic(option);
    f.s.onAdvance(()=>assert.equal(f.s.startupDiagnosticObservations.status,'observed'));
    f.send();const raw=packet();f.requests[0].resolve(reply(raw));await flush();
    assert.deepEqual(f.events,['update','advance']);assert.equal(f.s.time,5);
    const accepted=f.s.startupDiagnosticObservations;assert.equal(accepted.acceptedBatch,1);
    raw.samples[0].bodies[0].pose.position[0]=99;accepted.packet.initial.bodies[0].pose.position[0]=88;
    assert.equal(f.s.startupDiagnosticObservations.packet.samples[0].bodies[0].pose.position[0],0);
    assert.equal(f.s.startupDiagnosticObservations.packet.initial.bodies[0].pose.position[0],0);
});

test('redo rejects superseded diagnostic before any mirror/observer publication',async()=>{
    const f=session();let mode='old';
    f.s.hubs=[{id:'hub',hub:{exportState:()=>({mode}),stateKey:x=>x.mode}}];
    f.s.bridge={replay:()=>{f.events.push('replay');return 0;}};
    f.s.setStartupDiagnostic(option);f.s._steps=1;f.s._pendingMs=5;f.s._send();
    mode='new';f.requests[0].resolve(reply(packet(1,11)));await flush();
    assert.equal(f.requests.length,2);assert.equal(f.requests[1].request.redo,true);
    assert.equal(f.s.startupDiagnosticObservations,null);assert.deepEqual(f.events,[]);
    f.requests[1].resolve(reply(packet(1,22)));await flush();
    assert.deepEqual(f.events,['replay','update','advance']);
    assert.equal(f.s.startupDiagnosticObservations.acceptedBatch,1);
    assert.equal(f.s.startupDiagnosticObservations.packet.samples[0].bodies[0].pose.position[0],22);
});

test('disable and disposal fence old replies without changing physical batch acceptance',async()=>{
    const f=session();f.s.setStartupDiagnostic(option);f.send();f.s.setStartupDiagnostic(null);
    f.requests[0].resolve(reply());await flush();assert.equal(f.s.startupDiagnosticObservations,null);assert.equal(f.s.time,5);
    const g=session();g.s.setStartupDiagnostic(option);g.send();g.s.dispose();g.requests[0].resolve(reply());await flush();
    assert.equal(g.s.startupDiagnosticObservations,null);assert.deepEqual(g.events,['dispose']);assert.equal(g.s.time,0);
    const k=session();k.s.setStartupDiagnostic(option);const old=k.s._startupDiagnosticSelection;k.s.setStartupDiagnostic(option);
    k.s._acceptStartupDiagnostic(packet(),{startupDiagnostic:old,startupDiagnosticStartSeconds:0},0.005);
    assert.equal(k.s.startupDiagnosticObservations,null);
});

test('physical divergence contributes no diagnostic packet or observer publication',async()=>{
    const f=session();f.s.setStartupDiagnostic(option);f.send();const bad=reply();bad.bodies[0]=NaN;
    const before=console.error,errors=[];console.error=(...args)=>errors.push(args);
    try{f.requests[0].resolve(bad);await flush();}finally{console.error=before;}
    assert.equal(f.s.startupDiagnosticObservations,null);assert.deepEqual(f.events,[]);
    assert.ok(f.s.failed);assert.equal(errors.length,1);assert.equal(f.s.time,0);
});

test('missing/stale/incomplete packets report unavailable while ordinary accepted physics still advances',async()=>{
    for(const bad of [undefined,packet(2),{...packet(),samples:[]},{...packet(),initial:row(0.001,null)}]){
        const f=session();f.s.setStartupDiagnostic(option);f.send();const r=reply();r.startupDiagnostic=bad;
        f.requests[0].resolve(r);await flush();
        assert.equal(f.s.startupDiagnosticObservations.status,'unavailable');
        assert.equal(f.s.startupDiagnosticObservations.qualification,false);assert.equal(f.s.failed,null);assert.equal(f.s.time,5);
    }
});

test('independent admission rejects invalid identity/time/vector/overflow and copies valid wire data',()=>{
    const good=packet();assert.equal(admitStartupDiagnostic(good,selection,0,0.005).status,'observed');
    for(const alter of [p=>{p.samples[0].bodies[0].id='other';},p=>{p.samples[0].t=0.004;},
        p=>{p.samples[0].bodies[0].pose.position[0]=NaN;},p=>{p.overflow=true;},p=>{p.unavailable=[];},
        p=>{p.samples=Array(1);},p=>{p.samples[0].bodies=Array(1);},p=>{p.samples[0].joints=Array(1);},
        p=>{p.samples[0].bodies[0].pose.position=Array(3);},p=>{p.samples[0].contactPairs=[Array(2)];},
        p=>{p.samples[0].bodies[0].dynamics.inertiaKgM2=[Array(3)];},p=>{p.samples[0].joints[0].state.velocity=Infinity;}]){
        const p=packet();alter(p);assert.equal(admitStartupDiagnostic(p,selection,0,0.005).status,'unavailable');
    }
    const copy=admitStartupDiagnostic(good,selection,0,0.005);good.initial.bodies[0].pose.position[0]=100;
    assert.equal(copy.packet.initial.bodies[0].pose.position[0],0);
    const missing=packet();missing.initial.bodies[0].dynamics=null;missing.samples[0].bodies[0].dynamics=null;missing.unavailable.push('bodyDynamics');
    const partial=admitStartupDiagnostic(missing,selection,0,0.005);
    assert.equal(partial.status,'unavailable');assert.equal(partial.reason,'getter-unavailable');
    assert.equal(partial.packet.samples[0].bodies[0].dynamics,null);
});
