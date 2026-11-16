// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Serialized by Playwright into the real application page. Extended mode reads
// native encoders and observes actual API calls; it never drives a motor itself.
export function installBrowserMechanicsRecorder({recordKey,captureKey,extended=false,observeProgram=true,observeDynamics=false,stepParts=null,startupDiagnostic=null}){
 if(startupDiagnostic&&!extended)throw new Error('startup diagnostic recorder requires extended mode');
 window.__bwRestoreMechanicsRecorder?.();
 const pane=window.__bwSimLab._pane,s=pane.session,m=s.mechanism,vm=pane.props.vm;
 const r=window[recordKey]={start:s.time,runModel:s.runModel,model:s.model,mechanism:m,hubId:s.bridge.hubBody,issues:pane.state.issues,unsupported:[],track:[]};
 const api=vm.runtime.robotLab;
 const targets=()=>vm.runtime.targets.map(t=>({name:t.getName(),variables:Object.fromEntries(Object.values(t.variables||{}).map(v=>[v.name,v.value]))}));
 const variables=()=>Object.assign({},...targets().map(t=>t.variables));
 let started=false;
 let startupSelection=null,lastStartupBatch=null;
 const stopStartup=reason=>{
  if(!startupSelection||r.startupDiagnostic.stopped)return;
  r.startupDiagnostic.stopped=true;r.startupDiagnostic.stopReason=reason;
  if(s.startupDiagnosticRevision===startupSelection.revision)s.setStartupDiagnostic(null);
 };
 // stepParts: per-step poses of the bodies carrying these parts, plus every slider joint (at most four), taken
 // at each 5 ms physics step through the measurement observation the worker already transports. Read only.
 let lastPacket=null;
 if(stepParts){
  const bodies=[...new Set(stepParts.map(id=>m.bodies.find(b=>b.parts.includes(id))?.id))];
  const joints=m.joints.filter(j=>j.type==='slider').map(j=>j.id);
  if(bodies.some(b=>!b)||joints.length>4)throw new Error('step observation: unknown part or more than four sliders');
  // contacts: the engine's own body contact pairs at each accepted batch (WereBodiesInContact), for judges that
  // admit a window only once two bodies have separated.
  s.setMeasurementObservation({joints,bodies,contacts:true});r.stepObservation={bodies,joints,coreStartMs:null};r.stepSamples=[];
 }
 // A frame's time is the physics time of the poses it holds. With the worker, session.time advances by the
 // wall-clock tick (e.g. 33.3 ms) while each batch runs whole 5 ms steps (30 or 35 ms), so stamping a pose with
 // session.time puts it up to a step off its actual instant, in a repeating pattern that biases any fitted
 // derivative. The native runner stamps every frame at its exact step time; this matches it. Offset to the
 // session clock at install so phases and finishedAt (session time) stay comparable.
 const coreMs=()=>Number.isFinite(s.core?.time)?s.core.time*1000:null,core0=coreMs();
 // Only gates that judge on these stamps ask for them (stepParts): other gates compare frame times with
 // finishedAt and their hold intervals on the session clock, and keep exactly that clock.
 const frameTime=()=>!stepParts||core0===null?s.time:r.start+(coreMs()-core0);
 if(extended){
  r.controlledMotors=api.motors();r.apiEvents=[];r.refusals=[];const originals={};
  for(const name of ['start','stopMotor','runMotorDegrees','setMotorPower','setMotorSpeed','motorAngle','motorSpeed']){
   const original=api[name];originals[name]=original;
   api[name]=function(...args){
    const event=name==='motorAngle'||name==='motorSpeed'?null:{name,args,t:s.time,variables:variables(),...(name==='runMotorDegrees'?{encoderAtCall:api.encoder(args[0])}:{})};
    if(event)r.apiEvents.push(event);
    const observe=result=>{
     if(result?.ok===false||(name==='runMotorDegrees'&&result!=='completed'))r.refusals.push({name,args,result,t:s.time});
     if(event)Object.assign(event,{result,resolvedAt:s.time,...(name==='runMotorDegrees'?{encoderAtResolution:api.encoder(args[0])}:{})});
    };
    const result=original.apply(this,args);
    if(result&&typeof result.then==='function')result.then(observe,error=>r.refusals.push({name,args,error:String(error),t:s.time}));else observe(result);
    return result; // Preserve the exact original result and Promise identity.
   };
  }
  window.__bwRestoreMechanicsRecorder=()=>{for(const[name,original]of Object.entries(originals))api[name]=original;};
 }
 if(startupDiagnostic){
  try{
   if(typeof s.setStartupDiagnostic!=='function')throw new Error('startup diagnostic session unavailable');
   startupSelection=s.setStartupDiagnostic(startupDiagnostic);
   r.startupDiagnostic={selection:startupSelection,qualification:false,packets:[],stopped:false};
  }catch(error){window.__bwRestoreMechanicsRecorder?.();throw error;}
 }
 if(startupSelection){const restore=window.__bwRestoreMechanicsRecorder;window.__bwRestoreMechanicsRecorder=()=>{stopStartup('restored');restore?.();};}
 const capture=()=>{
  if(observeProgram&&!r.finishedAt&&s.time-r.start>1000&&!vm.runtime.threads.some(t=>t.status!==4))r.finishedAt=s.time;
  const extra=observeProgram?{ropes:s.core.ropeState(),variables:variables()}:null;
  // Every frame carries the native rope states (the crane judge reads f.ropes).
  const frame={t:frameTime(),...(stepParts?{sessionT:s.time,contacts:s.core.currentContactPairs()}:{}),ropes:s.core.ropeState(),bodies:Object.fromEntries(m.bodies.filter(b=>b.motion==='dynamic').map(b=>[b.id,s.core.bodyPose(b.id)])),
   joints:Object.fromEntries(m.joints.filter(j=>['hinge','slider'].includes(j.type)).map(j=>[j.id,s.core.jointState(j.id)])),
   busy:Object.fromEntries(m.actuators.map(a=>[a.port,pane.hub.motors.busy(a.port)])),...(extra?{extra}:{})};
  if(extended){
   const groups=targets();r.programVariables=groups;
   Object.assign(frame,{phase:!started?'cold':r.finishedAt&&s.time>r.finishedAt?'after':'program',variables:groups,
    encoder:Object.fromEntries(r.controlledMotors.map(a=>[a.port,api.encoder(a.port)]))});
   frame.extra.modes=Object.fromEntries(m.actuators.map(a=>[a.port,pane.hub.motors._controllers[a.port.charCodeAt(0)-65].mode]));
   // observeDynamics: the same per-frame record the qualification runner takes (test/bw-sim-qualification.test.mjs):
   // each dynamic body's configured mass and world centre of mass, each motor joint's held torque (N·m), read
   // from the worker's own observations of the accepted batch. Read only; nothing here drives a body.
   if(observeDynamics)frame.extra.dynamics={bodies:Object.fromEntries(m.bodies.filter(b=>b.motion==='dynamic').map(b=>{const d=s.core.bodyDynamics(b.id);return[b.id,{com:d?.centerOfMassWorld,massKg:d?.configuredMassKg}];})),
    joints:Object.fromEntries(m.joints.filter(j=>j.motor).map(j=>[j.id,s.core.jointDynamics(j.id)?.motorTorqueNm??0]))};
  }
  // An explicit final read can share a physics timestamp with onAdvance.
  // Keep its freshest observation without inventing a zero-duration step.
  if(stepParts){const pk=s.measurementObservations;
   if(pk&&pk.samples?.length&&JSON.stringify(pk.samples[0].t)!==lastPacket){lastPacket=JSON.stringify(pk.samples[0].t);
    if(pk.overflow||pk.unavailable)r.stepGap=true;
    for(const x of pk.samples)r.stepSamples.push({tMs:r.start+(x.t*1000-core0),phaseFrom:r.track.length,bodies:x.bodies,joints:x.joints});}}
  if(startupSelection&&!r.startupDiagnostic.stopped){const accepted=s.startupDiagnosticObservations;
   if(accepted&&accepted.revision===startupSelection.revision&&accepted.acceptedBatch!==lastStartupBatch){
    lastStartupBatch=accepted.acceptedBatch;
    // A zero-step batch may repeat t0; keep its first initial snapshot, not an unbounded series.
    if(accepted.status!=='observed'||accepted.packet.samples.length||!r.startupDiagnostic.packets.length)r.startupDiagnostic.packets.push({...accepted,
     phaseFrom:extended&&r.track.at(-1)?.t===frame.t?r.track.length-1:r.track.length});
    if(accepted.status!=='observed')stopStartup('unavailable');
    else if(accepted.coreEndSeconds>=startupSelection.stopSeconds-1e-8)stopStartup('window-reached');
   }}
  if(extended&&r.track.at(-1)?.t===frame.t)r.track[r.track.length-1]=frame;else r.track.push(frame);
 };
 window[captureKey]=capture;
 if(extended){try{capture();started=true;}catch(error){if(startupSelection)window.__bwRestoreMechanicsRecorder?.();throw error;}} // Real paused initial snapshot, not a cold-duration claim.
 s.onAdvance(capture);
}
