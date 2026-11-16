// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseWalkingBeamStartup} from '../scripts/lib/sim-lab-walking-beam-startup-diagnostic.mjs';
function fixture(){
 const body=(id,part,position)=>({id,parts:[part],position,rotation:[0,0,0,1]});
 const bodies=[body('base','hub',[0,0,0]),body('rotor','crank',[0,0,0]),body('beam','walking_beam',[0,0,0]),body('piston','piston_rack',[.044,-.12,-.052])];
 const mechanism={hubs:[{id:'hub'}],bodies,joints:[
  {id:'motor',type:'hinge',body1:'base',body2:'rotor',point:[0,-.064,0],axis:[1,0,0],motor:{port:'A'}},
  {id:'beam-pivot',type:'hinge',body1:'beam',body2:'base',point:[0,0,0],axis:[1,0,0]},
  {id:'slider',type:'slider',body1:'piston',body2:'base',point:[.044,-.12,-.052],axis:[0,-1,0]}
 ]};
 const rotation=[1,0,0,0,1,0,0,0,1];
 const runModel={parts:bodies.map(b=>({id:b.parts[0],position:b.position.map((x,i)=>x/(i===0?.0004:-.0004)),rotation}))};
 const frame=(t,phase)=>({t,phase,bodies:Object.fromEntries(bodies.map(b=>[b.id,{position:[...b.position],rotation:[...b.rotation]}]))});
 return {mechanism,runModel,track:[frame(0,'cold'),frame(25,'cold'),frame(50,'program'),frame(75,'program')]};
}
test('exact authored linkage reports sampled startup coverage without granting qualification',()=>{
 const r=fixture(),saved=structuredClone(r),report=diagnoseWalkingBeamStartup(r);
 assert.equal(report.schema,'robot-lab.walking-beam-startup-diagnostic.v1');
 assert.equal(report.status,'observed-within-bounds');assert.equal(report.qualification,false);
 assert.deepEqual(report.coverage,{fromMs:0,throughMs:50,coldSamples:2,programSamples:1,samples:3});
 assert.ok(report.maxima.beamDeg<1e-9);assert.ok(report.maxima.pistonMm<1e-9);
 assert.deepEqual(report.bounds,{beamDeg:.1,pistonMm:.1});assert.deepEqual(r,saved);
});
test('cold-only error remains visible even when subsequent program samples are exact',()=>{
 const r=fixture(),angle=.2*Math.PI/180;
 r.track[1].bodies.beam.rotation=[Math.sin(angle/2),0,0,Math.cos(angle/2)];
 r.track[1].bodies.piston.position[1]-=.0002;
 const report=diagnoseWalkingBeamStartup(r);
 assert.equal(report.status,'observed-fail');assert.ok(report.maxima.beamDeg>.1);assert.ok(report.maxima.pistonMm>.1);
 assert.deepEqual(report.witnesses,{beam:{t:25,phase:'cold'},piston:{t:25,phase:'cold'}});
});
test('missing cold samples, missing boundary and invalid time order never gain a diagnostic pass',()=>{
 const r=fixture();r.track=r.track.filter(f=>f.phase==='program');assert.equal(diagnoseWalkingBeamStartup(r).status,'not-observed');
 const cold=fixture();cold.track=cold.track.filter(f=>f.phase==='cold');assert.equal(diagnoseWalkingBeamStartup(cold).reason,'missing-program-boundary');
 const invalid=fixture();invalid.track[1].t=0;assert.equal(diagnoseWalkingBeamStartup(invalid).reason,'invalid-sample-times');
});
test('the first browser-like program sample is assessed, with later motion outside the stated prefix',()=>{
 const r=fixture();r.track.splice(1,1);r.track[1].bodies.piston.position[1]-=.0002;
 const report=diagnoseWalkingBeamStartup(r);
 assert.equal(report.status,'observed-fail');assert.deepEqual(report.witnesses.piston,{t:50,phase:'program'});
 const later=fixture();later.track.at(-1).bodies.piston.position[1]-=.01;
 assert.equal(diagnoseWalkingBeamStartup(later).status,'observed-within-bounds','the report does not pretend to assess later motion');
});
