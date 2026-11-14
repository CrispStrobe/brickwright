// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Real parser, Scratch VM, bundled Robot Lab extension and API. Only the clock
// is simulated, following spike-arena-vm.mjs; all motor completion is feedback.
import {retainFrame} from '../../scripts/lib/robot-lab-run-retention.mjs';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {VM,FakeClock,HubState,registerVirtualHub} from './spike-arena-vm.mjs';
import Creator from '../../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {loadExtensionClass,bundledExtensionIds,VM_SRC} from './bw-extensions.mjs';
import {catalogFrom,prepareModel,SimSession,hubBodyOf} from '../../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {loadJolt} from '../../overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js';
import {createRobotLabApi} from '../../overlay/scratch-gui/src/lib/bw-sim/api/robot-lab-api.js';
const CATALOG=catalogFrom(JSON.parse(readFileSync(new URL('../../overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json',import.meta.url))));
const Timer=createRequire(import.meta.url)(VM_SRC+'/util/timer.js');
export async function runRobotLabProgram(source,{modelText,timeLimitMs,catalog=CATALOG,autoPorts,frameMs=1000/30,observeFrame,observeSetup,coldMs=0,afterMs=0,withSpike=false,retainTrack=true}){
 const p=prepareModel(modelText,catalog,{mat:'plain',...(autoPorts===undefined?{}:{autoPorts})}),J=await loadJolt(),clock=new FakeClock(1.7e12);
 let clockInstalled=false;if(withSpike){clock.install();clockInstalled=true;}
 const registered=withSpike?registerVirtualHub():null,hub=registered?.hub||new HubState();hub.setSimulationEnabled(true);
 const session=new SimSession({...p,hubState:hub,catalog,mat:'plain',J}),vm=new VM();
 let simRunning=!withSpike,spike=null;
 const api=createRobotLabApi({getSession:()=>session,getStatus:()=> withSpike?(simRunning?'running':'paused'):'running',start:async()=>{simRunning=true;},stop:()=>{simRunning=false;},ensureRunning:()=>{simRunning=true;},locale:()=> 'en'});vm.runtime.robotLab=api;
 let finishedAt=null;const track=[],vmErrors=[],spikeCalls=[];
 try{
  const creator=new Creator();creator.parse(source);const data=Buffer.from(await(await creator.generateSB3()).arrayBuffer());
  const manager=vm.extensionManager,original=manager.loadExtensionURL.bind(manager);
  manager.loadExtensionURL=id=>{if(id!=='robotlab'&&!(withSpike&&id==='spikeprime'))return original(id);const Cls=loadExtensionClass(bundledExtensionIds().get(id)),ext=new Cls(vm.runtime);if(id==='spikeprime'){spike=ext;const original=ext.motorSetStopAction;ext.motorSetStopAction=function(args){const call={args:structuredClone(args),before:hub.backend._controllers.slice(0,2).map(c=>c.defaultStopAction)};spikeCalls.push(call);const result=original.call(this,args);Promise.resolve(result).then(()=>{call.after=hub.backend._controllers.slice(0,2).map(c=>c.defaultStopAction);});return result;};}manager._loadedExtensions.set(id,manager._registerInternalExtension(ext));return Promise.resolve();};
  if(withSpike){vm.runtime.on('BLOCKS_ERROR',e=>vmErrors.push(String(e)));vm.on('BLOCKS_ERROR',e=>vmErrors.push(String(e)));}
  await vm.loadProject(data);vm.setCompatibilityMode(true);vm.runtime.currentStepTime=1000/30;
  if(!clockInstalled){clock.install();clockInstalled=true;}let budget=0;vm.runtime.sequencer.timer=new Timer({now:()=>budget++});
  const snapshot=phase=>retainFrame(track,{t:session.time,phase,bodies:Object.fromEntries(p.mechanism.bodies.filter(b=>b.motion==='dynamic').map(b=>[b.id,session.core.bodyPose(b.id)])),joints:Object.fromEntries(p.mechanism.joints.filter(j=>['hinge','slider'].includes(j.type)).map(j=>[j.id,session.core.jointState(j.id)])),busy:Object.fromEntries(p.mechanism.actuators.map(a=>[a.port,hub.motors.busy(a.port)])),...(observeFrame?{extra:observeFrame({session,vm,hub,prepared:p})}:{})},retainTrack);
  if(withSpike){
   if(!spike)throw Error('Program did not load the real SPIKE extension');
   spike.setConnectionMode({MODE:'web-ble'});const connecting=spike.connectHub();
   for(let i=0;i<200&&!spike.isConnected();i++)await clock.advance(10);
   await connecting;if(!spike.isConnected())throw Error('Virtual SPIKE connection failed');
   await clock.advance(200);
   if(session.hubs[0].hub.hubState!==registered.hub||registered.registration.peripheral.hubState!==registered.hub)throw Error('SPIKE transport/session hub identity differs');
  }
  if(observeSetup)observeSetup({session,vm,hub,prepared:p});
  // The program's clock is the app's (bw-sim/sim-clock.js SimLabClock.now()): an integer epoch plus the
  // simulated ms the world has applied since Run. FakeClock's Date.now() accumulates `now += frameMs` on a
  // 1.7e12 base, which rounds each 33.3 ms frame down by ~8e-5 ms, so a wait of a whole number of frames
  // (0.3 s, 0.5 s, 1 s at 30 fps) took one frame longer here than in the browser, and a run judged here
  // was not the run the pane makes (test/bw-sim-robot-lab-program-clock.test.mjs).
  const epoch=Math.round(Date.now());let programMs=0;
  if(!withSpike)vm.runtime.updateCurrentMSecs=()=>{vm.runtime.currentMSecs=epoch+programMs;};
  if(coldMs){snapshot('cold');for(let ms=0;ms<coldMs;ms+=frameMs){await clock.advance(frameMs);session.tick(frameMs);await session.idle();snapshot('cold');}}
  vm.greenFlag();
  for(let i=0;i<Math.ceil(timeLimitMs/frameMs);i++){
   await clock.advance(frameMs);vm.runtime._step();for(let j=0;j<5;j++)await Promise.resolve();
   if(!withSpike||simRunning)session.tick(frameMs);await session.idle();programMs+=frameMs;
   snapshot('program');
   if(i>5&&!vm.runtime.threads.some(t=>t.status!==4)){finishedAt=session.time;break;}
  }
  if(finishedAt)for(let ms=0;ms<afterMs;ms+=frameMs){await clock.advance(frameMs);session.tick(frameMs);await session.idle();snapshot('after');}
  return {track,runModel:p.runModel,mechanism:p.mechanism,issues:p.issues,hubId:hubBodyOf(p.model,p.mechanism,catalog),unsupported:[],finishedAt,...(withSpike?{worldPaused:!simRunning,spikeConnected:spike.isConnected(),spikeCalls,vmErrors,unsupportedPython:hub.data.lastUnsupportedPythonTunnel??null}: {})};
 }finally{try{api.dispose();vm.stopAll();vm.quit();}finally{try{session.dispose();registered?.registration.unregister();}finally{if(clockInstalled)clock.uninstall();}}}
}
