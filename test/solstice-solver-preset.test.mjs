// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseModel,serializeModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {compile,AUTHORED_LIGHT_LINKS,FOREIGN_LIGHT_LINKS} from '../overlay/scratch-gui/src/lib/bw-sim/mech/compile.js';
import {catalogFrom,prepareModel} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {EXPERIMENTAL_MODELS} from '../overlay/scratch-gui/src/lib/bw-sim/model/experimental-models.js';
import {createEditor} from '../overlay/scratch-gui/src/lib/bw-sim/editor/editor-state.js';
import {upgradeMechanismV1,validatePlacedModel} from '../overlay/scratch-gui/src/lib/bw-sim/contracts.js';
import {buildSteps} from '../overlay/scratch-gui/src/lib/bw-sim/instructions/steps.js';
import {buildGraph} from '../overlay/scratch-gui/src/lib/bw-sim/mech/graph.js';
import {observeAddon} from '../scripts/lib/sim-lab-addon-judge.mjs';
import {compiledWalkingBeam,walkingBeamPose,judgeWalkingBeam,r4DisconnectionLoss,R4_LAWS} from '../scripts/lib/sim-lab-r4-judges.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lab='overlay/scratch-gui/static/sim-lab/';
const source=read(lab+'models/solstice-pumpjack.ldr'),program=read(lab+'programs/solstice-pumpjack.bw');
const baseline=source.replace(/^0 !BW SOLVER light-links\r?\n/m,'');
const catalog=catalogFrom(JSON.parse(read('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json')));
const prepare=text=>prepareModel(text,catalog,{mat:'plain',autoPorts:false});

test('Solstice instructions use connected pages of at most six placements',()=>{
 const {model,refusals}=parseModel(source,{catalog});assert.deepEqual(refusals,[]);
 assert.deepEqual(parseModel(read(lab+'models/solstice-pumpjack.mpd'),{catalog}).model,model,'both formats retain the same ordered placements and preset');
 const plan=buildSteps(model,catalog);assert.equal(plan.source,'auto');
 const {nodes,edges}=buildGraph(model,catalog,[]),adjacency=new Map(model.parts.map(p=>[p.id,new Set()]));
 for(const edge of edges){const a=nodes.get(edge.a.part).partId,b=nodes.get(edge.b.part).partId;if(a!==b){adjacency.get(a).add(b);adjacency.get(b).add(a);}}
 const built=new Set();
 for(const [index,step] of plan.steps.entries()){
  assert.equal(step.loose,false,`page ${index+1} is connected`);assert.ok(step.parts.length>=1&&step.parts.length<=6,`page ${index+1}: ${step.parts.length} placements`);
  const fresh=new Set(step.parts),reached=new Set(built.size?step.parts.filter(id=>[...adjacency.get(id)].some(other=>built.has(other))):[step.parts[0]]),queue=[...reached];
  while(queue.length)for(const next of adjacency.get(queue.shift()))if(fresh.has(next)&&!reached.has(next)){reached.add(next);queue.push(next);}
  assert.equal(reached.size,fresh.size,`page ${index+1}: every placement connects to the assembly`);
  for(const id of step.parts){assert.ok(!built.has(id),'each placement occurs once');built.add(id);}
 }
 assert.equal(built.size,93);assert.deepEqual([...built].sort(),model.parts.map(p=>p.id).sort());
});

test('solver preset parses strictly and roundtrips through LDR and MPD',()=>{
 for(const extension of ['ldr','mpd']){
  const parsed=parseModel(read(lab+'models/solstice-pumpjack.'+extension),{catalog});
  assert.equal(parsed.model.solver,'light-links');
  const restored=parseModel(serializeModel(parsed.model,{precision:12}),{catalog});
  assert.equal(restored.model.solver,'light-links');
  assert.deepEqual(restored.model.parts,parsed.model.parts,'no placement changes on save');
 }
 for(const annotation of ['0 !BW SOLVER unknown','0 !BW SOLVER light-links\n0 !BW SOLVER light-links']){
  const parsed=parseModel(annotation+'\n'+baseline,{catalog});
  assert.ok(parsed.refusals.some(x=>x.code==='bad-solver-preset'));
  assert.throws(()=>serializeModel(parsed.model),/solver must/);
  assert.throws(()=>compile(parsed.model,catalog,{version:2}),/solver must/);
  const prepared=prepare(annotation+'\n'+baseline);
  assert.equal(prepared.mechanism,null,'invalid preset prevents simulation without throwing');
  assert.ok(prepared.issues.some(x=>x.code==='bad-solver-preset'&&x.severity==='error'));
  assert.equal(prepared.model.solver,undefined,'display model remains usable in Build');
 }
});

test('solver preset compile changes only explicit solver policy and retains experimental status',()=>{
 const original=prepare(baseline),candidate=prepare(source);
 assert.equal(original.mechanism.solver,undefined);
 assert.deepEqual(candidate.mechanism.solver,{lightLinks:AUTHORED_LIGHT_LINKS});
 const {solver,...unchanged}=candidate.mechanism;
 assert.deepEqual(unchanged,original.mechanism,'compiled bodies, joints, contacts and geometry stay unchanged');
 const foreign=compile(original.runModel,catalog,{version:2,rescueLoose:true});
 assert.deepEqual(foreign.solver.lightLinks,FOREIGN_LIGHT_LINKS,'unannotated foreign models retain their policy');
 assert.deepEqual(compile(candidate.runModel,catalog).solver,{lightLinks:AUTHORED_LIGHT_LINKS},'version1 preserves explicit intent too');
 assert.deepEqual(upgradeMechanismV1(compile(candidate.runModel,catalog)).solver,{lightLinks:AUTHORED_LIGHT_LINKS},'physics version upgrade retains the policy');
 const saved=prepare(serializeModel(candidate.model,{precision:12}));
 assert.deepEqual(saved.mechanism.solver,candidate.mechanism.solver);
 assert.equal(EXPERIMENTAL_MODELS.find(x=>x.file==='solstice-pumpjack.ldr').experimental,true);
});

test('Build import, edit, undo, redo and save/reopen retain the solver preset',()=>{
 const prepared=prepare(source),editor=createEditor({model:prepared.model,catalog});
 const part=editor.model.parts[0],originalColor=part.color,changedColor=originalColor===4?1:4;
 assert.equal(editor.model.solver,'light-links','opening Build keeps the setting');
 editor.apply({type:'recolor',id:part.id,color:changedColor});
 assert.equal(editor.model.parts[0].color,changedColor,'the actual edit occurred');
 assert.equal(editor.model.solver,'light-links');
 editor.undo();assert.equal(editor.model.parts[0].color,originalColor);assert.equal(editor.model.solver,'light-links');
 editor.redo();assert.equal(editor.model.parts[0].color,changedColor);assert.equal(editor.model.solver,'light-links');
 const reopened=prepare(serializeModel(editor.model,{precision:12}));
 assert.deepEqual(reopened.mechanism.solver,{lightLinks:AUTHORED_LIGHT_LINKS},'saved edited model still compiles with the preset');
 const ordinary=createEditor({model:prepare(baseline).model,catalog});
 ordinary.apply({type:'recolor',id:ordinary.model.parts[0].id,color:changedColor});
 assert.equal(ordinary.model.solver,undefined,'editing ordinary models does not opt in');
 assert.ok(validatePlacedModel({...prepared.model,solver:'typo'},catalog).some(problem=>problem.includes('model.solver')));
});

test('solver preset and explicit contact pairs survive the same edit, export and upgrade',()=>{
 const model={version:1,solver:'light-links',internalEdgeRemovalPairs:[['b','a']],parts:['a','b'].map((id,i)=>({id,part:'3001.dat',color:4,position:[i*200,0,0],rotation:[1,0,0,0,1,0,0,0,1]}))};
 const editor=createEditor({model,catalog});
 editor.apply({type:'recolor',id:'a',color:1});editor.undo();editor.redo();
 const parsed=parseModel(serializeModel(editor.model),{catalog});assert.deepEqual(parsed.refusals,[]);
 assert.equal(parsed.model.solver,'light-links');assert.deepEqual(parsed.model.internalEdgeRemovalPairs,[['b','a']]);
 const v1=compile(parsed.model,catalog,{ground:false}),v2=compile(parsed.model,catalog,{ground:false,version:2});
 assert.deepEqual(upgradeMechanismV1(v1).solver,{lightLinks:AUTHORED_LIGHT_LINKS});
 assert.deepEqual(v2.solver,{lightLinks:AUTHORED_LIGHT_LINKS});
 assert.deepEqual(v2.internalEdgeRemovalPairs,upgradeMechanismV1(v1).internalEdgeRemovalPairs);
 assert.equal(v2.internalEdgeRemovalPairs.length,1,'the current contact policy remains active alongside the preset');
});

const residualReader=prepared=>{
 const observer=observeAddon({mechanism:prepared.mechanism,runModel:prepared.runModel},'hub');
 const g=compiledWalkingBeam({mechanism:prepared.mechanism,runModel:prepared.runModel},observer);
 const origin=observer.initial('piston_rack'),axis=g.B.u.map((v,i)=>v*g.slide[0]+g.B.v[i]*g.slide[1]);let previous=0;
 return frame=>{
  const phi=observer.angle(frame,'crank',g.B.a,g.B.u),beta=observer.angle(frame,'walking_beam',g.B.a,g.B.u),expected=walkingBeamPose(g,phi,previous);previous=expected.beta;
  const delta=beta-expected.beta;
  return {beamDeg:Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI),pistonMm:Math.abs(observer.point(frame,'piston_rack').reduce((sum,v,i)=>sum+(v-origin[i])*axis[i],0)-expected.s)*1000};
 };
};

test('every 5ms startup sample meets unchanged law bounds; removing the preset reproduces failure',async t=>{
 const [{loadJolt,createPhysicsCore},{SimHubBridge},{hubRegistry}]=await Promise.all([
  import('../overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js'),
  import('../overlay/scratch-gui/src/lib/bw-sim/hub-bridge.js'),import('../overlay/scratch-gui/src/lib/bw-sim/hubs/index.js')]);
 const J=await loadJolt(),results=[];
 for(const [name,text] of [['original',baseline],['preset',source]]){
  const prepared=prepare(text),mechanism=prepared.mechanism,measure=residualReader(prepared),core=createPhysicsCore(J,mechanism,{stepHz:200});let bridge;
  try{
   const hubs=mechanism.hubs.map(({id,profile,body})=>({hub:hubRegistry.create(profile,{id}),body}));
   bridge=new SimHubBridge({core,mechanism,hubs,stepMs:5});assert.equal(hubs[0].hub.directCommand('A',{stop:'hold'}).ok,true);
   const rows=[];
   for(let step=1;step<=110;step++){
    bridge.step();rows.push({t:core.time,...measure({bodies:Object.fromEntries(mechanism.bodies.filter(b=>b.motion==='dynamic').map(b=>[b.id,core.bodyPose(b.id)]))})});
   }
   const failure=row=>row.beamDeg>R4_LAWS.walkingBeam.beamDeg||row.pistonMm>R4_LAWS.walkingBeam.pistonMm;
   assert.equal(rows.length,110);assert.equal(rows[0].t,.005);assert.equal(rows.at(-1).t,.55);
   if(name==='original')assert.ok(rows.some(failure),'the original startup defect remains observable');
   else assert.deepEqual(rows.filter(failure),[],'every sample, including the first, meets the existing bounds');
   results.push({name,beamDeg:Math.max(...rows.map(x=>x.beamDeg)),pistonMm:Math.max(...rows.map(x=>x.pistonMm))});
  }finally{try{bridge?.dispose();}finally{core.destroy();}}
 }
 t.diagnostic(JSON.stringify(results));
});

test('real Solstice full program passes while pin_P disconnection loses the unchanged law',async t=>{
 const {runRobotLabProgram}=await import('./helpers/robot-lab-direct-vm.mjs');
 const {disconnectedSource,actuatorState}=await import('../scripts/lib/robot-lab-qualification.mjs');
 const contract={id:'solstice-pumpjack',judge:'walking-beam-v1',parts:93,ports:['A'],coldMs:500,timeLimitMs:90000,afterMs:500,frameMs:25,frozenOutput:'walking_beam',disconnect:['pin_P'],disconnectInputDeg:350,disconnectLoss:'r4'};
 const run=async modelText=>{
  const errors=[];let hooked=false;
  const r=await runRobotLabProgram(program,{...contract,modelText,autoPorts:false,observeFrame:({session,vm})=>{
   if(!hooked){hooked=true;for(const event of ['ERROR','BLOCKS_ERROR'])vm.runtime.on(event,e=>errors.push(String(e)));}
   return {variables:Object.fromEntries(vm.runtime.targets.flatMap(x=>Object.values(x.variables||{}).map(v=>[v.name,v.value]))),actuators:actuatorState(session)};
  }});
  assert.deepEqual(errors,[]);return r;
 };
 const connected=await run(source),result=judgeWalkingBeam(connected,{native:true,contract});
 assert.ok(connected.track.some(f=>f.phase==='cold'),'cold observations retained');
 const disconnected=await run(disconnectedSource(source,contract.disconnect));
 const loss=r4DisconnectionLoss('solstice-pumpjack',disconnected);
 assert.ok(loss.lost,JSON.stringify(loss));assert.ok(loss.crankSpanDeg>contract.disconnectInputDeg,'the disconnected input still turns');
 assert.throws(()=>judgeWalkingBeam(disconnected,{native:true,contract}));
 t.diagnostic(JSON.stringify({connected:result,disconnected:loss}));
});
