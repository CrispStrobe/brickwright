// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {qualificationContracts,QUALIFICATION_JUDGES,disconnectedSource,issueKeys,actuatorState,assertFinalHold} from '../scripts/lib/robot-lab-qualification.mjs';
import {HUBLESS_DISCONNECTION_LOSSES} from '../scripts/lib/sim-lab-hubless-judges.mjs';
import {toggleLeverLawErrorDeg} from '../scripts/lib/sim-lab-toggle-thirdline-judge.mjs';
import {batch3DisconnectionLoss} from '../scripts/lib/sim-lab-batch3-judges.mjs';
import {batch2DisconnectionLoss} from '../scripts/lib/sim-lab-batch2-judges.mjs';
import {afterturnDisconnectionLoss,judgeAfterturn,judgeAfterturnControl} from '../scripts/lib/sim-lab-afterturn-judge.mjs';
import {batchCDisconnectionLoss} from '../scripts/lib/sim-lab-batchC-judges.mjs';
import {batchADisconnectionLoss} from '../scripts/lib/sim-lab-batchA-judges.mjs';
import {batchBDisconnectionLoss} from '../scripts/lib/sim-lab-batchB-judges.mjs';
import {p6DisconnectionLoss} from '../scripts/lib/sim-lab-p6-judges.mjs';
import {judgeRimRun,rimrunDisconnectionLoss,rimrunMeasure} from '../scripts/lib/sim-lab-rimrun-judge.mjs';
import {nineIntakeDisconnectionLoss} from '../scripts/lib/sim-lab-nine-intake-judge.mjs';
import {judgeObliquityTilt,obliquityDisconnectionLoss,orreryTrack,compiledOrrery} from '../scripts/lib/sim-lab-obliquity-judge.mjs';
import {r2DisconnectionLoss} from '../scripts/lib/sim-lab-r2-judges.mjs';
import {r3DisconnectionLoss} from '../scripts/lib/sim-lab-r3-judges.mjs';
import {r4DisconnectionLoss,doublePendulumModes,R4_LAWS} from '../scripts/lib/sim-lab-r4-judges.mjs';
import {catalogFrom,prepareModel,MODELS} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {runRobotLabProgram} from './helpers/robot-lab-direct-vm.mjs';import {observeAddon} from '../scripts/lib/sim-lab-addon-judge.mjs';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {isBatchEPromotion,runBatchEPromotion} from './helpers/robot-lab-promotion-programs.mjs';
import {batchEDisconnectionLoss} from '../scripts/lib/sim-lab-batchE-judges.mjs';
import {BATCH_E_CONTRACTS} from '../scripts/lib/sim-lab-batchE-judges.mjs';
import {evaluateTiplinePair} from '../scripts/lib/sim-lab-tipline-judge.mjs';
import {evaluateTwistspanPair} from '../scripts/lib/sim-lab-twistspan-judge.mjs';
import {judgeSwayShiftPair} from '../scripts/lib/sim-lab-swayshift-judge.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),lab='overlay/scratch-gui/static/sim-lab/',catalog=catalogFrom(JSON.parse(read('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json')));
const selected=process.env.BW_MODEL_QUALIFY_MODELS?.split(',');
const R2_MUTANTS=Object.freeze({'cadence-geneva':['dial_output_gear',{part:'3649.dat'},/dial = −star\/3/],
 'helios-transmission':['sun_input',{part:'94925.dat'},/compound planets/],'orion-cardan':['fork_middle_far',{turn:90},/middle forks in phase/]});
// R3 (2026-11-12): one wrong-model mutant of each compiled model, each changing a constant the law reads from the compiled model.
const R3_MUTANTS=Object.freeze({
 // The slotted lever's pivot moved one hole (8 mm) towards the crank: pivot distance 56 -> 48 mm, a different quick return.
 'vesper-quickreturn':[r=>{const lever=r.mechanism.bodies.find(b=>b.parts.includes('slot_housing')).id,frame=r.mechanism.bodies.find(b=>b.parts.includes('pin_O')).id,
  j=r.mechanism.joints.find(j=>j.type==='hinge'&&[j.body1,j.body2].includes(lever)&&[j.body1,j.body2].includes(frame)),c=r.mechanism.joints.find(j=>j.motor).point,d=c.map((v,i)=>v-j.point[i]),n=Math.hypot(...d);
  j.point=j.point.map((v,i)=>v+d[i]/n*.008);},/quick-return kinematics/],
 // The collar four times as heavy (its colliders' masses): the same lift would need a higher speed.
 'aster-governor':[r=>{const b=r.mechanism.bodies.find(b=>b.parts.includes('collar'));b.massKg*=4;for(const c of b.colliders)c.massKg*=4;},/held speed/],
 // The rotor's 24T gear replaced by a 40T: rotor = carrier·(1 − 16/40) = 0.6·carrier, not carrier/3.
 apex:[r=>{r.runModel.parts.find(p=>p.id==='output_24t').part='3649.dat';},/rotor = carrier\/3/]});
// R4 (sim-lab-r4-judges.mjs): Tempest's lower bob replaced by a different wheel part.
const R4_MUTANTS=Object.freeze({'tempest-pendulum':['lower_bob_wheel',{part:'56145.dat'},/compiled serial pendulum/]});
test('qualification refuses unknown principles, missing models and incomplete disconnections',()=>{
 assert.throws(()=>qualificationContracts(['invented-pass']));assert.throws(()=>qualificationContracts([]));assert.throws(()=>disconnectedSource('0 model\n',['missing']));
});
// The observation base is the SPIKE hub part the compiler registered (mechanism.hubs[0].id is that part's
// own !BW ID: 'hub' in most models, 'spike_hub' in Helixgate, Loop Relay, Parity Dial and Counter Slide),
// the same lookup the nine-intake judge uses. A hard-coded 'hub' found no body for those four (handoff P4).
const hubPartOf=r=>{const hubs=r.mechanism.hubs||[];assert.equal(hubs.length,1,'exactly one registered hub names the observation base');return hubs[0].id;};
const run=async(c,modelText,autoPorts,label=autoPorts===false?'strict':'ordinary')=>{
 const errors=[];let hooked=false;const r=isBatchEPromotion(c.id)?await runBatchEPromotion(c,modelText,autoPorts):await runRobotLabProgram(read(lab+'programs/'+c.id+'.bw'),{...c,modelText,autoPorts,observeFrame:({session,vm,hub,prepared})=>{
  if(!hooked){vm.runtime.on('ERROR',e=>errors.push(String(e)));vm.runtime.on('BLOCKS_ERROR',e=>errors.push(String(e)));hooked=true;}
  for(const b of vm.runtime.targets.flatMap(t=>Object.values(t.blocks._blocks))){const literal=Object.keys(b.fields||{}).length===1&&Object.keys(b.inputs||{}).length===0;assert.ok(b.opcode in vm.runtime._primitives||b.opcode in vm.runtime._hats||literal,'actual registered opcode: '+b.opcode);}
  return{variables:Object.fromEntries(vm.runtime.targets.flatMap(t=>Object.values(t.variables||{}).map(v=>[v.name,v.value]))),modes:hub.motors._controllers.map(c=>c.mode),actuators:actuatorState(session),sessionFailed:session.failed?String(session.failed):null,...(c.observeAir?{air:session.core.airState?session.core.airState():[]}:{}),
   // observeContacts: the engine's body contact pairs at this frame (WereBodiesInContact), for a judge that admits a window only after two bodies separate.
   ...(c.observeContacts?{contacts:session.core.currentContactPairs()}:{}),
   // observeDynamics: each dynamic body's configured mass and world centre of mass, and each motor joint's held torque (N·m), for a holding-torque law.
   ...(c.observeDynamics?{dynamics:{bodies:Object.fromEntries(prepared.mechanism.bodies.filter(b=>b.motion==='dynamic').map(b=>{const d=session.core.bodyDynamics(b.id);return[b.id,{com:d.centerOfMassWorld,massKg:d.configuredMassKg}];})),joints:Object.fromEntries(prepared.mechanism.joints.filter(j=>j.motor).map(j=>[j.id,session.core.jointDynamics(j.id)?.motorTorqueNm??0]))}}:{})};
 }});if(process.env.BW_MODEL_QUALIFY_EVIDENCE_DIR){const dir=process.env.BW_MODEL_QUALIFY_EVIDENCE_DIR;mkdirSync(dir,{recursive:true});writeFileSync(dir+'/'+c.id+'-'+label+'.json',JSON.stringify(r)+'\n');}assert.deepEqual(errors,[]);assert.ok(r.track.every(f=>!f.extra.sessionFailed));return r;
};
for(const c of qualificationContracts(selected).filter(c=>!c.nativeSuite)){
 const source=read(lab+'models/'+c.id+'.ldr'),program=read(lab+'programs/'+c.id+'.bw'),judge=r=>QUALIFICATION_JUDGES[c.judge](r,{native:true,contract:c});
 test(c.id+': exact source, licence, topology, compiler, unassisted equality and complete registration',()=>{
  // A versioned metadata adaptation retains and verifies its original intake.
  const fixture=c.id==='rimrun'?'rimrun-internal-edge-pairs-v1-source':c.id+'-source';
  const dir='test/fixtures/model-files/'+fixture+'/',provenance=JSON.parse(read(dir+'provenance.json'));
  if(c.id==='rimrun'){
   assert.equal(provenance.version,'internal-edge-pairs-v1');assert.equal(provenance.parent.fixture,'rimrun-source');
   const parent='test/fixtures/model-files/rimrun-source/',original=read(parent+'models/rimrun.ldr');
   assert.equal(createHash('sha256').update(read(parent+'provenance.json')).digest('hex'),provenance.parent.provenanceSha256);
   const retained=JSON.parse(read(parent+'provenance.json'));
   for(const[file,hash]of Object.entries(retained.files))assert.equal(createHash('sha256').update(read(parent+file)).digest('hex'),hash);
   assert.equal(createHash('sha256').update(original).digest('hex'),provenance.parent.modelSha256);
   const adapted=original.replace('0 !LDRAW_ORG Unofficial_Model','0 !BW INTERNAL_EDGE_PAIR left_wheel_-1 hub\n0 !BW INTERNAL_EDGE_PAIR right_wheel_-1 hub\n0 !LDRAW_ORG Unofficial_Model')
    .replace('Native stock-part mechanics; no model physics overrides.','Native stock-part mechanics; no mass or inertia overrides.');
   assert.equal(read(dir+'models/rimrun.ldr'),adapted,'only the exact declared metadata/header adaptation is admitted');
   assert.equal(read(dir+'programs/rimrun.bw'),read(parent+'programs/rimrun.bw'));
   assert.equal(read(dir+'LICENSE.txt'),read(parent+'LICENSE.txt'));
  }
  for(const [file,hash]of Object.entries(provenance.files))assert.equal(createHash('sha256').update(read(dir+file)).digest('hex'),hash);
  assert.equal(source,read(dir+(c.id==='quartermaster'?'quartermaster.ldr':'models/'+c.id+'.ldr')));assert.equal(program,read(dir+(c.id==='quartermaster'?'quartermaster.bw':'programs/'+c.id+'.bw')));
  assert.match(source,/^0 Author: CrispStrobe$/m);assert.match(read(lab+'licenses/'+c.id+'.txt'),/BSD 3-Clause License/);
  const entry=MODELS.find(m=>m.file===c.id+'.ldr');assert.ok(entry);assert.equal(entry.example,c.id+'.bw');if(c.motorless)assert.equal(entry.manualJog,undefined,'nothing to jog');else assert.ok(entry.manualJog);
  const p=prepareModel(source,catalog),strict=prepareModel(source,catalog,{autoPorts:false});assert.deepEqual(p,strict);assert.deepEqual(issueKeys(p.issues),issueKeys(c.expectedIssues||[]));assert.equal(p.model.parts.length,c.parts);assert.deepEqual(p.mechanism.actuators.map(a=>a.port).sort(),c.ports);
  const creator=new Creator();creator.parse(program);assert.deepEqual(creator.errors||[],[]);assert.deepEqual(creator.warnings||[],[]);
 });
 for(const autoPorts of [undefined,false])test(c.id+': '+(autoPorts===false?'strict':'ordinary')+' real VM, passive laws, frozen-output and world-drift controls',async t=>{
  const r=await run(c,source,autoPorts);t.diagnostic(JSON.stringify({id:c.id,result:judge(r)}));
  const last=r.track.at(-1);assertFinalHold(c,last);assert.equal(r.hubId===null,Boolean(c.hubless),'hubless exactly when the model has no hub');
  const frozen=structuredClone(r),body=r.mechanism.bodies.find(b=>b.parts.includes(c.frozenOutput));for(const f of frozen.track)f.bodies[body.id]=structuredClone(frozen.track[0].bodies[body.id]);assert.throws(()=>judge(frozen),'a stationary output cannot pass');
  const shifted=structuredClone(r);for(const b of Object.values(shifted.track.at(-1).bodies))b.position[0]+=.01;assert.throws(()=>judge(shifted),/stationary chassis/,'relative output laws do not hide world drift');
 });
 if(isBatchEPromotion(c.id))test(c.id+': fresh longer cold start and causal comparison at the second cadence',async t=>{
  const options={coldMs:2500},main=await runBatchEPromotion(c,source,false,options);
  judge(main);assertFinalHold(c,main.track.at(-1));
  let comparison,result;
  if(c.id==='tipline'){
   comparison=await runBatchEPromotion(c,read(lab+'models/tipline-swapped.ldr'),false,{...options,variant:'tipline-swapped'});
   result=evaluateTiplinePair(main,comparison,{contract:BATCH_E_CONTRACTS.tipline});assert.equal(result.status,'PASS');
  }else if(c.id==='twistspan'){
   comparison=await runBatchEPromotion(c,read(lab+'models/twistspan-inner.ldr'),false,{...options,variant:'twistspan-inner'});
   result=evaluateTwistspanPair(main,comparison,{contract:BATCH_E_CONTRACTS.twistspan});assert.equal(result.status,'PASS');
  }else{
   comparison=await runBatchEPromotion(c,source,false,{...options,mode:'in-phase',source:read(lab+'programs/swayshift-in-phase.bw')});
   result=judgeSwayShiftPair(main,comparison,{contract:BATCH_E_CONTRACTS.swayshift});assert.equal(result.passed,true,JSON.stringify(result.gates.filter(g=>!g.passed)));
  }
  if(process.env.BW_MODEL_QUALIFY_EVIDENCE_DIR){const dir=process.env.BW_MODEL_QUALIFY_EVIDENCE_DIR;mkdirSync(dir,{recursive:true});writeFileSync(dir+'/'+c.id+'-cold-comparison.json',JSON.stringify({main,comparison})+'\n');}
  t.diagnostic(JSON.stringify({id:c.id,coldMs:2500,frameMs:main.provenance.frameMs,comparison:'PASS'}));
 });
 // Afterturn's physical control: the supplied fixed-mass model under the same program and judge keeps no net cycle,
 // and the moving-mass judgement refuses it.
 if(c.id==='afterturn')test('afterturn: fixed-mass control keeps the constant ratio and no net cycle',async t=>{
  const r=await run({...c,id:'afterturn'},read(lab+'models/afterturn-fixed-masses.ldr'),false,'fixed-masses-control'),result=judgeAfterturnControl(r);
  assert.throws(()=>judgeAfterturn(r));t.diagnostic(JSON.stringify({id:'afterturn-fixed-masses',cycle:result.cycle,inverse:result.inverse}));
 });
 // RimRun's causal control: the supplied scene with the ballast layouts exchanged between the lanes. The same
 // judge passes and the inner-ballast roller still leads, now in the other lane: the lead follows the ballast.
 if(c.id==='rimrun')test('rimrun: lane-swapped control moves the lead with the ballast',async t=>{
  const main=judgeRimRun(await run(c,source,false),{native:true}),swapped=judgeRimRun(await run(c,read(lab+'models/rimrun-swapped.ldr'),false,'swapped-control'),{native:true});
  assert.equal(main.innerLane,'left');assert.equal(swapped.innerLane,'right','the inner ballast is in the other lane');
  for(const x of [main,swapped])assert.ok(x.leadMm>=5);t.diagnostic(JSON.stringify({id:'rimrun-swapped',main:{innerLane:main.innerLane,ratio:main.ratio,leadMm:main.leadMm},swapped:{innerLane:swapped.innerLane,ratio:swapped.ratio,leadMm:swapped.leadMm}}));
 });
 // RimRun's fit window (2026-11-10): from gate clearance (engine contacts) to the lane's first tile joint (compiled
 // tile colliders), at least ten frames. Mis-predicted inertia, a window cut short by a tile joint, and a gate
 // that has not cleared are each refused by the unchanged 5 % judge.
 if(c.id==='rimrun')test('rimrun: one-tile window after gate clearance; wrong inertia, crossing and uncleared windows are refused',async t=>{
  const r=await run(c,source,false,'window-controls'),ok=judgeRimRun(r,{native:true}),m=rimrunMeasure(r);
  for(const l of m.lanes){const w=l.window;assert.ok(w.frames>=10);assert.ok(w.tile[0]<=w.fromS&&w.fromS<w.toS&&w.toS<w.tile[1],'every fitted frame lies on one tile');assert.ok(w.from>=m.window.clearance);}
  const rollers=['left_wheel_-1','right_wheel_-1'].map(p=>r.mechanism.bodies.find(b=>b.parts.includes(p)));
  // Wrong inertia: each roller's ballast moved 40 % further from its axle (same masses), so the prediction is wrong.
  const wrong=structuredClone(r);for(const b of wrong.mechanism.bodies.filter(b=>rollers.some(x=>x.id===b.id))){
   const axle=b.colliders.find(x=>/_shaft_-1$/.test(x.part)).position;for(const col of b.colliders.filter(x=>/_ballast_/.test(x.part)))col.position=col.position.map((v,i)=>axle[i]+(v-axle[i])*1.4);}
  assert.throws(()=>judgeRimRun(wrong,{native:true}),/accelerates at|ratio/);
  // A window that would cross a tile joint: the lanes' tiles shortened to 40 % leave no ten frames on one tile.
  const cut=structuredClone(r),frame=cut.mechanism.bodies.find(b=>b.colliders.some(x=>/^track_left_/.test(x.part)));
  for(const col of frame.colliders.filter(x=>/^track_(left|right)_/.test(x.part))){const k=col.halfExtents.indexOf(Math.max(...col.halfExtents));col.halfExtents[k]*=.4;}
  assert.throws(()=>judgeRimRun(cut,{native:true}),/one tile|on a track tile/);
  // The gate not yet clear: an engine contact between the gate and a roller inside the window, or just before the catches.
  const gate=r.mechanism.joints.find(j=>j.motor?.port==='A').body2;
  for(const at of [m.lanes[0].window.from+100,m.window.contactAt-20]){const late=structuredClone(r),f=late.track.find(x=>x.t>=at);f.extra.contacts=[...f.extra.contacts,[gate,rollers[0].id].sort()];
   assert.throws(()=>judgeRimRun(late,{native:true}),/enough frames on one tile|clears both rollers/);}
  t.diagnostic(JSON.stringify({id:'rimrun-window',clearance:m.window.clearance,lanes:m.lanes.map(l=>({lane:l.lane,accel:l.accel,predicted:l.predicted,frames:l.window.frames,from:l.window.from,to:l.window.to})),ratio:ok.ratio,leadMm:ok.leadMm}));
 });
 // Obliquity Orrery (R1): two wrong models built from the real run, each refused by the unchanged judge, and the
 // handoff's crank-B cut recorded. (1) The Earth plate turned 90° about its spindle (the shipped control's pose,
 // obliquity-orrery-turned-axis) on the same carried body: it obeys its own law sin δ = sin 22.5° · cos(λ − 135°),
 // which shows the measurement is real, and is refused because the compiled solstice is not at 45°. (2) The Earth
 // turned with its orbit, as a coupler without the parallelogram would: its axis no longer keeps one direction.
 if(c.id==='obliquity-orrery')test('obliquity-orrery: turned-axis and turning-Earth mutants are refused; crank B cut recorded',async t=>{
  const r=await run(c,source,false,'mutant-base'),ok=judgeObliquityTilt(r,{native:true,contract:c});
  const law=(lam,lam0)=>Math.asin(Math.sin(22.5*Math.PI/180)*Math.cos((lam-lam0)*Math.PI/180))*180/Math.PI;
  // (1) Turned connector: the Earth plate's compiled orientation turned -90° about the vertical (the control's pose),
  // about its own reference point, so that point stays on the 16 mm orbit level with the Sun and only the tilt turns.
  const turned=structuredClone(r),parts=new Map(turned.runModel.parts.map(p=>[p.id,p])),e=parts.get('earth');
  const M=[0,0,-1,0,1,0,1,0,0],mv=(A,v)=>[0,1,2].map(i=>A[3*i]*v[0]+A[3*i+1]*v[1]+A[3*i+2]*v[2]),refPt=mv(e.rotation,[0,2,0]).map((x,i)=>x+e.position[i]);
  e.rotation=[0,1,2].flatMap(i=>[0,1,2].map(j=>M[3*i]*e.rotation[j]+M[3*i+1]*e.rotation[3+j]+M[3*i+2]*e.rotation[6+j]));e.position=refPt.map((x,i)=>x-mv(e.rotation,[0,2,0])[i]);
  const g=compiledOrrery(turned);assert.ok(Math.abs(g.epsilonDeg-22.5)<=.01&&Math.abs(Math.abs(g.solsticeDeg-45)-90)<=.01,'the mutant keeps the tilt and moves the solstice a quarter orbit: '+JSON.stringify(g));
  const rows=orreryTrack(turned),own=Math.max(...rows.map(x=>Math.abs(x.delta-law(x.lam,g.solsticeDeg))));
  assert.ok(own<=.01,'the turned Earth follows its own law: '+own);
  assert.throws(()=>judgeObliquityTilt(turned,{native:true,contract:c}),/leans at the Sun/);
  // (2) Turning Earth: each frame, turn the Earth's body about the vertical through its reference point by the
  // orbit's own turn, so the axis follows the Sun direction instead of keeping its direction.
  const spun=structuredClone(r),o=observeAddon(spun),b=o.body('earth');
  const qm=([x,y,z,w],[a,b2,c2,d])=>[w*a+x*d+y*c2-z*b2,w*b2-x*c2+y*d+z*a,w*c2+x*b2-y*a+z*d,w*d-x*a-y*b2-z*c2],qr=(q,v)=>qm(qm(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);
  const ref=o.initial('earth',[0,2,0]),local=qr([-b.rotation[0],-b.rotation[1],-b.rotation[2],b.rotation[3]],ref.map((x,i)=>x-b.position[i]));
  const az=f=>{const p=f.bodies[b.id],c0=qr(p.rotation,local).map((x,i)=>x+p.position[i]);return[c0,Math.atan2(c0[2],c0[0])];};
  const sun=r.track.map(f=>o.point(f,'sun_marker')),a0=Math.atan2(o.point(r.track[0],'earth',[0,2,0])[2]-sun[0][2],o.point(r.track[0],'earth',[0,2,0])[0]-sun[0][0]);
  spun.track.forEach((f,k)=>{const E=o.point(r.track[k],'earth',[0,2,0]),turn=Math.atan2(E[2]-sun[k][2],E[0]-sun[k][0])-a0,q=[0,Math.sin(-turn/2),0,Math.cos(-turn/2)],[c0]=az(f),p=f.bodies[b.id];
   p.position=qr(q,p.position.map((x,i)=>x-c0[i])).map((x,i)=>x+c0[i]);p.rotation=qm(q,p.rotation);});
  assert.throws(()=>judgeObliquityTilt(spun,{native:true,contract:c}),/declination follows/);
  // The handoff's proposed cut (crank B's coupler pin). A frictionless coupler hanging from one vertical pin feels no
  // gravity torque about it, so whether the law is lost is measured, not assumed.
  const cutB=await run(c,disconnectedSource(source,['crank_pin_B']),false,'crank-B-cut'),lossB=obliquityDisconnectionLoss(cutB);
  let judgedB;try{judgeObliquityTilt(cutB,{native:true,contract:c});judgedB='PASS';}catch(err){judgedB=String(err.message).slice(0,300);}
  t.diagnostic(JSON.stringify({id:'obliquity-orrery-mutants',main:{lawErrorDeg:ok.lawErrorDeg,driveErrorDeg:ok.driveErrorDeg,radiusErrorMm:ok.radiusErrorMm,compiled:ok.compiled},turnedOwnLawDeg:own,turnedSolsticeDeg:g.solsticeDeg,crankBCut:{loss:lossB,judge:judgedB}}));
 });
 // R2 judge family: a wrong-model mutant of each compiled model, built from the real run, must be refused by the
 // unchanged judge. Each changes one part the law's constants are read from, keeping the recorded motion: the dial
 // gear of the Geneva train (24T -> 40T), the carrier ring of the differential (28T -> 24T), the input sun of the
 // epicyclic set (24T -> 16T), and the far fork of the Cardan middle shaft turned a quarter turn (misphased pair).
 if(R2_MUTANTS[c.id])test(c.id+': wrong-model mutant is refused by the unchanged judge',async t=>{
  const r=await run(c,source,false,'mutant-base'),ok=judge(r),bad=structuredClone(r),[part,change,pattern]=R2_MUTANTS[c.id];
  if(change.part){const p=bad.runModel.parts.find(p=>p.id===part);assert.ok(p,part);p.part=change.part;}
  else{const u=bad.mechanism.couplings.find(x=>x.kind==='universalJoint'&&x.parts.includes(part));assert.ok(u,part);const [x,y]=[u.shaft1,u.fork1];u.fork1=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];}
  assert.throws(()=>judge(bad),pattern);
  t.diagnostic(JSON.stringify({id:c.id+'-mutant',part,change,main:Object.fromEntries(Object.entries(ok).filter(([k])=>!['foundation','compiled','speeds','stages'].includes(k)))}));
 });
 if(R3_MUTANTS[c.id])test(c.id+': wrong-model mutant is refused by the unchanged judge',async t=>{
  const r=await run(c,source,false,'mutant-base'),ok=judge(r),bad=structuredClone(r),[mutate,pattern]=R3_MUTANTS[c.id];mutate(bad);
  assert.throws(()=>judge(bad),pattern);
  t.diagnostic(JSON.stringify({id:c.id+'-mutant',main:Object.fromEntries(Object.entries(ok).filter(([k])=>!['foundation','compiled','plateaus'].includes(k)))}));
 });
 if(R4_MUTANTS[c.id])test(c.id+': wrong-model mutant is refused by the unchanged judge',async t=>{
  const r=await run(c,source,false,'mutant-base'),ok=judge(r),bad=structuredClone(r),[part,change,pattern]=R4_MUTANTS[c.id];
  const p=bad.runModel.parts.find(p=>p.id===part);assert.ok(p,part);
  p.part=change.part;
  assert.throws(()=>judge(bad),pattern);
  t.diagnostic(JSON.stringify({id:c.id+'-mutant',part,change,main:Object.fromEntries(Object.entries(ok).filter(([k])=>!['foundation','compiled','windows'].includes(k)))}));
 });
 // Tempest: the frozen normal modes of double-pendulum-mode-v1 are recomputed from the engine's own mass properties
 // (configured mass, world centre of mass and inertia of the two arm bodies at the hanging rest) and the compiled
 // shoulder and elbow hinges; they must equal R4_LAWS.doublePendulum.
 if(c.id==='tempest-pendulum')test(c.id+': frozen normal modes equal the engine mass properties',async t=>{
  let modes;
  await runRobotLabProgram('DEVICE SPIKE\nWHEN flag clicked:\n  wait 0.05 seconds\n',{modelText:source,autoPorts:false,frameMs:25,timeLimitMs:100,observeSetup:({session,prepared})=>{
   const m=prepared.mechanism,body=id=>{const b=m.bodies.find(b=>b.parts.includes(id));assert.ok(b,id);return b.id;},hinge=(a,b)=>{const j=m.joints.filter(j=>j.type==='hinge'&&[j.body1,j.body2].includes(body(a))&&[j.body1,j.body2].includes(body(b)));assert.equal(j.length,1,a+'-'+b);return j[0];};
   const arm=id=>{const d=session.core.bodyDynamics(body(id));return{mass:d.configuredMassKg,com:d.centerOfMassWorld,inertia:d.inertiaKgM2};},shoulder=hinge('carrier','upper_arm'),elbow=hinge('upper_arm','lower_arm');
   modes=doublePendulumModes({axis:shoulder.axis,shoulder:shoulder.point,elbow:elbow.point,upper:arm('upper_arm'),lower:arm('lower_arm')});
  }});
  assert.ok(modes,'mass properties observed');const L=R4_LAWS.doublePendulum;
  for(const k of ['slowS','fastS','slowShape','fastShape'])assert.ok(Math.abs(modes[k]-L[k])/Math.abs(L[k])<=1e-3,k+' '+modes[k]+' vs '+L[k]);
  t.diagnostic(JSON.stringify({id:c.id+'-modes',slowS:modes.slowS,fastS:modes.fastS,slowShape:modes.slowShape,fastShape:modes.fastShape}));
 });
 test(c.id+': physical disconnection destroys the intended output while the real input still completes',async t=>{
  const r=await run(c,disconnectedSource(source,c.disconnect),false,'disconnected'),o=observeAddon(r,c.observeBase??hubPartOf(r)),input=c.motorless?null:r.mechanism.joints.find(j=>j.motor?.port===c.ports[0]),travel=input?Math.max(...r.track.map(f=>Math.abs(f.joints[input.id].angle)))*180/Math.PI:0;
  assert.ok(r.finishedAt>0);if(!c.motorless)assert.ok(travel>(c.disconnectInputDeg??(c.id==='sine-shuttle'?1070:1430)),'input genuinely still turns');
  let motion;
  if(c.id==='sine-shuttle'){
   const v=o.initial('guide_x_-100',[20,0,0]).map((x,i)=>x-o.initial('guide_x_-100')[i]),len=Math.hypot(...v),axis=v.map(x=>x/len),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
   const points=r.track.map(f=>dot(o.point(f,c.frozenOutput).map((x,i)=>x-o.point(f,'crank')[i]),axis)*1000);
   motion=Math.max(...points)-Math.min(...points);
   // A detached carriage can drift or hit something. The causal requirement is
   // loss of the declared 31..33 mm cosine stroke, not an invented frozen pose.
   assert.ok(motion<31,'disconnection loses the original minimum useful stroke');
   assert.ok(Math.max(...r.track.map((f,i)=>Math.abs(points[i]-16*Math.cos(f.joints[input.id].angle))))>.5,'the original cosine-law bound rejects the disconnected mechanism');
  }
  // A detached yoke, link and lever form a free chain that can drift; the causal requirement is
  // loss of the declared closure law (within 2.5° when connected), not an invented frozen pose.
  else if(c.id==='toggle-lever'){motion=toggleLeverLawErrorDeg(r);assert.ok(motion>5,'without the crank pin the lever leaves the toggle closure law');}
  else if(c.id==='thirdline'){const un=a=>{let p=a[0],s=p;return a.map(v=>{s+=Math.atan2(Math.sin(v-p),Math.cos(v-p));p=v;return s;});},din=un(r.track.map(f=>o.angle(f,'input_arm',[0,1,0],[1,0,0]))),dru=un(r.track.map(f=>o.angle(f,c.frozenOutput,[0,1,0],[1,0,0])));motion=Math.max(...r.track.map((f,i)=>Math.abs((dru[i]-dru[0])-(din[i]-din[0])/3)))*180/Math.PI;assert.ok(motion>.5,'without the marked joint the ruler leaves the one-third law');}
  // Hubless and motorless models: the judge module measures each law's own loss (sim-lab-hubless-judges.mjs).
  // Afterturn: without the rods every wheel stroke leaves the reviewed model's predicted Iw/J(B) (sim-lab-afterturn-judge.mjs).
  else if(c.id==='afterturn'){const loss=afterturnDisconnectionLoss(r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  else if(isBatchEPromotion(c.id)){const loss=batchEDisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the measured physical law: '+JSON.stringify(loss));}
  else if(c.disconnectLaw&&Object.hasOwn(HUBLESS_DISCONNECTION_LOSSES,c.id)){const loss=HUBLESS_DISCONNECTION_LOSSES[c.id](r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // Batches C and D: the judge module measures each law's own loss (sim-lab-batchC-judges.mjs).
  else if(c.disconnectLoss==='batch-c'){const loss=batchCDisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // Batches A and B: the judge module measures each law's own loss (sim-lab-batchA-judges.mjs, sim-lab-batchB-judges.mjs).
  else if(c.disconnectLoss==='batch-a'){const loss=batchADisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // RimRun: all ballast removed, the identical rollers lose the inner-ballast lead (sim-lab-rimrun-judge.mjs).
  else if(c.disconnectLoss==='rimrun'){const loss=rimrunDisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // Obliquity Orrery: without crank A's coupler pin the Earth stays put while the encoder sweeps (sim-lab-obliquity-judge.mjs).
  else if(c.disconnectLoss==='obliquity'){const loss=obliquityDisconnectionLoss(r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // R2 judge family (sim-lab-r2-judges.mjs): drive pin, carrier drive bevel, control gear or one Cardan fork removed.
  else if(c.disconnectLoss==='r2'){const loss=r2DisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // R3 (sim-lab-r3-judges.mjs): Vesper's crank pin, Aster's two collar links or Apex's rotor-drive 8T removed.
  else if(c.disconnectLoss==='r3'){const loss=r3DisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // R4 (sim-lab-r4-judges.mjs): Tempest's motor-to-carrier pins removed (r4DisconnectionLoss also measures Solstice's pin_P cut).
  else if(c.disconnectLoss==='r4'){const loss=r4DisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  else if(c.disconnectLoss==='p6'){const loss=p6DisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // Nine Technic intakes: the reviewed part removal must break the passive law while the input route completes.
  else if(c.disconnectLoss==='nine-intake'){const loss=nineIntakeDisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  else if(c.disconnectLoss==='batch-b'){const loss=batchBDisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // Third batch: the judge module measures each law's own loss (sim-lab-batch3-judges.mjs).
  else if(c.disconnectLaw){const loss=batch3DisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+JSON.stringify(loss));}
  // Second batch: each law has its own measured loss (see sim-lab-batch2-judges.mjs for the thresholds).
  else if(c.disconnectMeasure){const loss=batch2DisconnectionLoss(c.id,r);motion=loss.value;assert.ok(loss.lost,'disconnection loses the law: '+loss.metric+' '+loss.value);}
  else{const j=r.mechanism.joints.find(j=>!j.motor&&j.body2===o.body(c.frozenOutput).id);const angles=r.track.map(f=>o.angle(f,c.frozenOutput,j.axis,[0,0,1]));motion=(Math.max(...angles)-Math.min(...angles))*180/Math.PI;assert.ok(motion<1,'wheel loses indexing without the roller');}
  assert.throws(()=>judge(r));t.diagnostic(JSON.stringify({id:c.id,inputTravelDeg:travel,disconnectedOutputMotion:motion}));
 });
}

// Negative controls for the hubless/motorless path: the new branches still refuse broken models.
const frame=(actuators,busy={},modes=[])=>({busy,extra:{actuators,modes}});
test('hubless hold check reads the lab-direct controller and refuses an unheld, busy or hub-driven model',()=>{
 const hubless={id:'x',hubless:true,ports:['A']},hubbed={id:'y',ports:['A']},motorless={id:'z',motorless:true,ports:[]};
 assert.doesNotThrow(()=>assertFinalHold(hubless,frame({driver:'lab-direct',modes:{A:'hold'},busy:{A:false}})));
 for(const mode of ['brake','coast','position','speed','power'])assert.throws(()=>assertFinalHold(hubless,frame({driver:'lab-direct',modes:{A:mode},busy:{A:false}})),/held/);
 assert.throws(()=>assertFinalHold(hubless,frame({driver:'lab-direct',modes:{A:'hold'},busy:{A:true}})),/finished/);
 assert.throws(()=>assertFinalHold(hubless,frame({driver:'hub'},{A:false},['hold'])),/lab-direct/,'a hub reading never stands in for lab-direct');
 assert.throws(()=>assertFinalHold(hubless,frame({driver:'lab-direct',modes:{A:'hold',B:'hold'},busy:{A:false,B:false}})),/exactly the contract ports/);
 assert.throws(()=>assertFinalHold(hubless,frame(undefined)),/actuator state/);
 // Hub models keep exactly their reviewed check.
 assert.doesNotThrow(()=>assertFinalHold(hubbed,frame({driver:'hub'},{A:false},['hold'])));
 assert.throws(()=>assertFinalHold(hubbed,frame({driver:'hub'},{A:false},['idle'])));
 assert.throws(()=>assertFinalHold(hubbed,frame({driver:'hub'},{A:true},['hold'])));
 assert.throws(()=>assertFinalHold(hubbed,frame({driver:'lab-direct',modes:{A:'hold'},busy:{A:false}},{A:false},['hold'])),/not driven by lab-direct/);
 assert.doesNotThrow(()=>assertFinalHold(motorless,frame({driver:'hub'})));
 assert.throws(()=>assertFinalHold(motorless,frame({driver:'hub'},{A:false})),/no driven port/);
});
test('actuatorState reads the session lab-direct controller, not an assumed hub',()=>{
 const motors=new Map([['A',{mode:'hold'}]]),waiters=new Map();
 assert.deepEqual(actuatorState({hubs:[{profile:'lab-direct',hub:{motors,waiters}}]}),{driver:'lab-direct',modes:{A:'hold'},busy:{A:false}});
 waiters.set('A',{});assert.equal(actuatorState({hubs:[{profile:'lab-direct',hub:{motors,waiters}}]}).busy.A,true);
 assert.deepEqual(actuatorState({hubs:[{profile:'spike-prime',hub:{}}]}),{driver:'hub'});assert.deepEqual(actuatorState({hubs:[]}),{driver:'none'});
});
test('contract validation refuses undeclared hubless or motorless shapes',()=>{
 const data=JSON.parse(read('docs/data/robot-lab-qualification.json'));
 for(const c of data.models.filter(c=>!c.hubless&&!c.motorless)){assert.equal(c.observeBase,undefined);assert.ok(c.ports.length>=1,'existing models keep a driven port');}
 const pv=data.models.find(c=>c.id==='pivot-exchange');assert.ok(pv?.motorless&&pv.ports.length===0&&!pv.hubless);
 assert.deepEqual(pv.expectedIssues,[{code:'no-motor',parts:[]}]);for(const c of data.models.filter(c=>!c.motorless))assert.ok(!(c.expectedIssues||[]).some(i=>i.code==='no-motor'));
});
// The hubless path end to end on the real experimental Phasor Twin (not promoted: its bytes fail the
// established construction gate). The hub reading that misjudged it stays wrong; the lab-direct reading holds.
const PHASOR={id:'phasor-twin',judge:'stirling-quadrature-v1',ports:['A'],hubless:true,observeBase:'base_cross_60',coldMs:500,timeLimitMs:60000,afterMs:500,frameMs:20,frozenOutput:'pistonrod_B',disconnect:['conrod_B','wristpin_B']};
if(!selected)test('hubless path: experimental Phasor Twin passes its law and hold, and its disconnection is refused',async t=>{
 const source=read(lab+'models/phasor-twin.ldr'),r=await run(PHASOR,source,false,'hubless-experimental'),last=r.track.at(-1);
 assert.equal(r.hubId,null);const result=QUALIFICATION_JUDGES[PHASOR.judge](r,{native:true});assertFinalHold(PHASOR,last);
 assert.notEqual(last.extra.modes[0],'hold','the hub controller reading never sees the lab-direct hold');
 assert.throws(()=>assertFinalHold({...PHASOR,hubless:undefined},last),/not driven by lab-direct/);
 const d=await run(PHASOR,disconnectedSource(source,PHASOR.disconnect),false,'hubless-experimental-disconnected'),loss=HUBLESS_DISCONNECTION_LOSSES[PHASOR.id](d);
 assert.ok(loss.lost,JSON.stringify(loss));assert.throws(()=>QUALIFICATION_JUDGES[PHASOR.judge](d,{native:true}));
 t.diagnostic(JSON.stringify({result,disconnected:loss}));
});
