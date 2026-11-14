// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readOutputPose, orientationTravelDeg, observeTerminal, programCompletion, PROGRAM_OUTPUT_CONTRACTS} from '../scripts/lib/robot-lab-program-completion.mjs';
const contract=PROGRAM_OUTPUT_CONTRACTS['toggle-lever'];
const valid=()=>({execution:'COMPLETED',terminalObservation:{sawZero:true,sawTransition:true},programVariables:{completed:1,stage:4},motors:{A:{commanded:true,moved:true}},outputMeasurement:{samples:3,invalid:false,travelM:0.02,homeErrorM:0.0001},messages:['ToggleLever complete: compare the passive lever arc with the link closure.'],failures:[]});
test('requires actual zero-to-one terminal transition and final terminal value',()=>{const state={};observeTerminal(state,{completed:1},'completed');assert.equal(state.sawTransition,undefined);observeTerminal(state,{completed:0},'completed');observeTerminal(state,{completed:1},'completed');assert.equal(state.sawTransition,true);const r=valid();r.programVariables.completed=0;assert.equal(programCompletion(r,contract).status,'PARTIAL');});
test('completed program, primary drive and real passive output are jointly required',()=>{assert.equal(programCompletion(valid(),contract).status,'COMPLETE');for(const mutate of [r=>r.execution='BOUNDED_PARTIAL',r=>r.outputMeasurement.travelM=0,r=>r.outputMeasurement.invalid=true,r=>r.motors={},r=>r.messages=[],r=>r.terminalObservation.sawTransition=false]){const r=valid();mutate(r);assert.equal(programCompletion(r,contract).status,'PARTIAL');}});
test('motor diagnostic, error and unreviewed output can never complete',()=>{const r=valid();r.failures=['program-fault-flag'];assert.equal(programCompletion(r,contract).status,'FAIL');assert.equal(programCompletion(valid(),null).status,'PARTIAL');});

test('PointWeaver observes authored endpoint origin relative to its base, not rotating off-axis tip',()=>{
    const requested=[];const poses={endpoint_marker:{ok:true,position:[0.07,0.02,-0.014],quat:[0,0,0,1]},'base_cross_-40':{ok:true,position:[0.01,0,0.02],quat:[0,0,0,1]},endpoint_marker_tip:{ok:true,position:[0.078,0.024,-0.014],quat:[0,0,0,1]}};
    const api={pose:id=>{requested.push(id);return poses[id];}},c=PROGRAM_OUTPUT_CONTRACTS.pointweaver;
    const first=readOutputPose(api,c);poses.endpoint_marker_tip.position=[0.062,0.024,-0.014];
    assert.deepEqual(readOutputPose(api,c),first);assert.deepEqual(requested,['endpoint_marker','base_cross_-40','endpoint_marker','base_cross_-40']);
    assert.deepEqual(first.position,poses.endpoint_marker.position.map((v,i)=>v-poses['base_cross_-40'].position[i]));
    poses.endpoint_marker.position[0]=NaN;assert.equal(readOutputPose(api,c),null);
});
test('local point follows placement and body rotation; reference removes world translation and rotation',()=>{
    const half=Math.sqrt(0.5),q=[0,0,half,half];
    const placements=new Map([['foot',{rotation:[1,0,0,0,1,0,0,0,1]}],['frame',{rotation:[1,0,0,0,1,0,0,0,1]}]]);
    const poses={foot:{ok:true,position:[1,2,3],quat:q},frame:{ok:true,position:[1,2,3],quat:q}};
    const r=readOutputPose({pose:id=>poses[id]},{part:'foot',localPointLdu:[100,0,0],relativeTo:'frame',referencePointLdu:[0,-50,0]},placements);
    assert.ok(Math.abs(r.position[0]-0.04)<1e-12);assert.ok(Math.abs(r.position[1]+0.02)<1e-12);assert.ok(Math.abs(r.position[2])<1e-12);
    assert.ok(Math.abs(r.quat[3]-1)<1e-12);
    assert.equal(readOutputPose({pose:id=>poses[id]},{part:'foot',localPointLdu:[100,0,0]},null),null);
});
test('fixed origins can still produce meaningful output rotation, quaternion sign is equivalent',()=>{
    const q=[0,Math.sqrt(0.5),0,Math.sqrt(0.5)];assert.ok(Math.abs(orientationTravelDeg([0,0,0,1],q)-90)<1e-10);
    assert.equal(orientationTravelDeg(q,q.map(v=>-v)),0);
    const r=valid();r.outputMeasurement.travelM=0;r.outputMeasurement.rotationDeg=30;
    assert.equal(programCompletion(r,{...contract,minTravelM:undefined,minRotationDeg:0.1}).status,'COMPLETE');
});
test('every required output channel and actual pressure rise must be observed',()=>{
    const c={...contract,outputs:[{minTravelM:0.001},{type:'air-pressure',requireRise:true}]},r=valid();r.outputMeasurements=[r.outputMeasurement,{samples:3,invalid:false,networks:{tank:{initialKpa:150,maxKpa:160}}}];
    assert.equal(programCompletion(r,c).status,'COMPLETE');r.outputMeasurements[1].networks.tank.maxKpa=150;assert.equal(programCompletion(r,c).status,'PARTIAL');r.outputMeasurements.pop();assert.equal(programCompletion(r,c).status,'PARTIAL');
});
test('local measurement uses placed scene rotation, including mat-start quarter turn',()=>{
    const c={part:'foot',localPointLdu:[100,0,0]},api={pose:()=>({ok:true,position:[0,0,0],quat:[0,0,0,1]})};
    const placed=new Map([['foot',{rotation:[0,0,1,0,1,0,-1,0,0]}]]);
    assert.deepEqual(readOutputPose(api,c,placed).position,[0,0,0.04]);
});
