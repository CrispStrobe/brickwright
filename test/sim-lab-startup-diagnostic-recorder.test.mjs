// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {SimSession} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {installBrowserMechanicsRecorder} from '../scripts/lib/sim-lab-browser-recorder.mjs';

const option={bodies:['body'],joints:['hinge'],stopSeconds:0.55};
const fixture=()=>{
    const commands=[],s=Object.create(SimSession.prototype);
    const pose={position:[0,0,0],rotation:[0,0,0,1]},api={motors:()=>[],encoder:()=>({ok:true,angleDeg:0})};
    for(const name of ['start','stopMotor','runMotorDegrees','setMotorPower','setMotorSpeed','motorAngle','motorSpeed'])api[name]=()=>{commands.push(name);return {ok:true};};
    const originals={...api};
    Object.assign(s,{worker:true,time:0,model:{parts:[]},runModel:{parts:[]},listeners:new Set(),
        mechanism:{bodies:[{id:'body',motion:'dynamic',parts:['part']}],joints:[{id:'hinge',type:'hinge'}],actuators:[]},
        bridge:{hubBody:'hub'},_inFlight:null,_steps:0,_ticks:[],_pendingMs:0,
        core:{time:0,bodyPose:()=>pose,jointState:()=>({angle:0}),ropeState:()=>[]}});
    const pane={session:s,state:{issues:[]},hub:{motors:{busy:()=>false,_controllers:[]}},props:{vm:{runtime:{robotLab:api,threads:[{status:0}],targets:[]}}}};
    const window={__bwSimLab:{_pane:pane}};
    const snapshot=(t,stepSeconds)=>({t,stepSeconds,bodies:[{id:'body',pose:structuredClone(pose),linearVelocityMS:[0,0,0],angularVelocityRadS:[0,0,0],dynamics:{solverMassKg:1}}],
        joints:[{id:'hinge',state:{angle:0},dynamics:null}],contactPairs:[]});
    const deliver=(start,end,invalid=false)=>{
        const selected=s._startupDiagnosticSelection;
        const packet={schema:'robot-lab.startup-diagnostic.v1',revision:selected.revision,stopSeconds:selected.stopSeconds,qualification:false,
            initial:snapshot(start,null),samples:end>start?[snapshot(end,0.005)]:[],overflow:false,
            unavailable:['hingeAnchorImpulses','contactImpulses','effectiveIslandIterations']};
        s._acceptStartupDiagnostic(invalid?null:packet,{startupDiagnostic:selected,startupDiagnosticStartSeconds:start},end);
        s.core.time=end;s.time=end*1000;s._advanced();
    };
    return {s,window,api,originals,commands,deliver};
};
const withWindow=fn=>{
    const before=globalThis.window;
    try{return fn();}finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}
};

test('disabled recorder does not read or set the diagnostic surface or add diagnostic output',()=>withWindow(()=>{
    const f=fixture();globalThis.window=f.window;
    f.s.setStartupDiagnostic=()=>{throw Error('unexpected setter');};
    Object.defineProperty(f.s,'startupDiagnosticObservations',{get(){throw Error('unexpected getter');}});
    installBrowserMechanicsRecorder({recordKey:'record',captureKey:'capture',extended:true});
    window.capture();assert.equal(Object.hasOwn(window.record,'startupDiagnostic'),false);
    assert.deepEqual(f.commands,[]);window.__bwRestoreMechanicsRecorder();
    for(const key of Object.keys(f.originals))assert.equal(f.api[key],f.originals[key]);
}));

test('serialized opt-in recorder observes copied accepted packets once and stops its selection at the finite window',()=>withWindow(()=>{
    const f=fixture();globalThis.window=f.window;
    // Playwright serializes this function: no imported helper may be needed in-page.
    const serialized=(0,eval)('('+installBrowserMechanicsRecorder.toString()+')');
    serialized({recordKey:'record',captureKey:'capture',extended:true,startupDiagnostic:option});
    assert.equal(f.s.startupDiagnosticRevision,1);assert.deepEqual(f.commands,[]);
    f.deliver(0,0.005);window.capture();window.capture();
    assert.equal(window.record.startupDiagnostic.packets.length,1);
    assert.equal(window.record.track[window.record.startupDiagnostic.packets[0].phaseFrom].phase,'program');
    window.record.startupDiagnostic.packets[0].packet.samples[0].bodies[0].pose.position[0]=99;
    assert.equal(f.s.startupDiagnosticObservations.packet.samples[0].bodies[0].pose.position[0],0);
    f.deliver(0.545,0.55);
    assert.equal(window.record.startupDiagnostic.packets.length,2);
    assert.equal(window.record.startupDiagnostic.qualification,false);
    assert.equal(window.record.startupDiagnostic.stopReason,'window-reached');
    assert.equal(f.s.startupDiagnosticRevision,null);assert.deepEqual(f.commands,[]);
    window.capture();assert.equal(window.record.startupDiagnostic.packets.length,2);
    window.__bwRestoreMechanicsRecorder();
    for(const key of Object.keys(f.originals))assert.equal(f.api[key],f.originals[key]);
}));

test('explicit restoration disables only the selection this recorder owns',()=>withWindow(()=>{
    const f=fixture();globalThis.window=f.window;
    installBrowserMechanicsRecorder({recordKey:'record',captureKey:'capture',extended:true,startupDiagnostic:option});
    const newer=f.s.setStartupDiagnostic(option);assert.equal(newer.revision,2);
    window.__bwRestoreMechanicsRecorder();
    assert.equal(f.s.startupDiagnosticRevision,2);assert.equal(window.record.startupDiagnostic.stopReason,'restored');
    assert.deepEqual(f.commands,[]);
}));

test('zero-step accepted batches retain only the first repeated initial snapshot',()=>withWindow(()=>{
    const f=fixture();globalThis.window=f.window;
    installBrowserMechanicsRecorder({recordKey:'record',captureKey:'capture',extended:true,startupDiagnostic:option});
    for(let i=0;i<200;i++)f.deliver(0,0);
    assert.equal(window.record.startupDiagnostic.packets.length,1);
    assert.equal(window.record.startupDiagnostic.packets[0].packet.initial.t,0);
    assert.equal(window.record.startupDiagnostic.packets[0].packet.samples.length,0);
    window.__bwRestoreMechanicsRecorder();assert.equal(f.s.startupDiagnosticRevision,null);
}));

test('unavailable admitted packet is retained honestly and stops further diagnostic collection',()=>withWindow(()=>{
    const f=fixture();globalThis.window=f.window;
    installBrowserMechanicsRecorder({recordKey:'record',captureKey:'capture',extended:true,startupDiagnostic:option});
    f.deliver(0,0.005,true);
    const diagnostic=window.record.startupDiagnostic;
    assert.equal(diagnostic.packets[0].status,'unavailable');assert.equal(diagnostic.packets[0].packet,null);
    assert.equal(diagnostic.stopReason,'unavailable');assert.equal(f.s.startupDiagnosticRevision,null);
    assert.equal(diagnostic.qualification,false);assert.deepEqual(f.commands,[]);
    window.__bwRestoreMechanicsRecorder();
}));

test('invalid or unsupported opt-in does not leave API wrappers or an active selection behind',()=>withWindow(()=>{
    for(const kind of ['mode','late','parts','capture']){
        const f=fixture();globalThis.window=f.window;
        if(kind==='late')f.s.core.time=0.005;
        if(kind==='capture')f.s.core.bodyPose=()=>{throw Error('initial getter failed');};
        assert.throws(()=>installBrowserMechanicsRecorder({recordKey:'record',captureKey:'capture',extended:kind!=='mode',startupDiagnostic:option,
            ...(kind==='parts'?{stepParts:['missing']}: {})}));
        assert.equal(f.s.startupDiagnosticRevision,null);
        for(const key of Object.keys(f.originals))assert.equal(f.api[key],f.originals[key]);
        assert.deepEqual(f.commands,[]);
    }
}));
