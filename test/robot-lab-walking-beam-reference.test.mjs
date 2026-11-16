// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {walkingBeamPose,walkingBeamTrack,R4_LAWS} from '../scripts/lib/sim-lab-r4-judges.mjs';

// An exact planar linkage, starting its recording after the crank has moved.
// These are independent kinematic observations, not an engine run or a fitted origin.
const g={O:[0,0],C:[.064,0],P0:[.016,0],B0:[.064,.048],D0:[.064,-.056],S0:[.064,-.12],slide:[0,1],B:{a:[0,0,1],u:[1,0,0],v:[0,1,0]}};
function recording(offset=0){
 const angles=[.2,.25,.3],poses=angles.map(phi=>walkingBeamPose(g,phi));
 const r={mechanism:{bodies:[{id:'rotor',parts:['crank']}],joints:[{id:'motor',body1:'base',body2:'rotor',motor:{port:'A'}}]},
  track:angles.map((phi,i)=>({phase:'program',t:25*(i+1),phi,beta:poses[i].beta+(i===0?offset:0),s:poses[i].s,joints:{motor:{angle:1.7+phi}}}))};
 const o={initial:()=>[...g.S0,0],angle:(f,id)=>id==='crank'?f.phi:f.beta,point:f=>[g.S0[0],g.S0[1]+f.s,0]};
 return {r,o,angles,poses};
}
test('the loop keeps its authored origin when recording begins at a nonzero crank angle',()=>{
 const {r,o,angles,poses}=recording(),rows=walkingBeamTrack(r,o,g);
 for(let i=0;i<rows.length;i++){
  assert.ok(Math.abs(rows[i].phi-angles[i])<1e-12);
  assert.ok(Math.abs(rows[i].beta-poses[i].beta)<1e-12);
  assert.ok(Math.abs(rows[i].s-poses[i].s)<1e-12);
  assert.ok(Math.abs(rows[i].phi-rows[0].phi-rows[i].motor)<1e-12,'encoder travel retains its independent first-frame origin');
 }
});
test('a first-frame beam error is preserved without spreading it into later exact poses',()=>{
 const offset=.2*Math.PI/180,{r,o,poses}=recording(offset),rows=walkingBeamTrack(r,o,g);
 const errors=rows.map((x,i)=>Math.abs(x.beta-poses[i].beta)*180/Math.PI);
 assert.ok(errors[0]>R4_LAWS.walkingBeam.beamDeg,'the unchanged bound must still reject this startup error');
 assert.ok(errors.slice(1).every(x=>x<1e-10),'later exact poses have no inherited first-frame error');
 assert.equal(R4_LAWS.walkingBeam.beamDeg,.1);assert.equal(R4_LAWS.walkingBeam.pistonMm,.1);
});
