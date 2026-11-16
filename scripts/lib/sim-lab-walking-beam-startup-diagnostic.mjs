// SPDX-License-Identifier: BSD-3-Clause
// An additive observation report, never an admission decision. Legacy motion
// judges retain their program/after interval and their original verdicts.
import {observeAddon} from './sim-lab-addon-judge.mjs';
import {compiledWalkingBeam,walkingBeamPose,R4_LAWS} from './sim-lab-r4-judges.mjs';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const deg=x=>x*180/Math.PI;
export function diagnoseWalkingBeamStartup(recording){
 const bounds={beamDeg:R4_LAWS.walkingBeam.beamDeg,pistonMm:R4_LAWS.walkingBeam.pistonMm};
 const header={schema:'robot-lab.walking-beam-startup-diagnostic.v1',qualification:false,bounds};
 const firstProgram=recording.track.findIndex(f=>f.phase==='program');
 if(firstProgram<0)return {...header,status:'not-observed',reason:'missing-program-boundary'};
 const before=recording.track.slice(0,firstProgram),cold=before.filter(f=>f.phase==='cold');
 if(!cold.length)return {...header,status:'not-observed',reason:'missing-cold-observations'};
 // Describe only the observed prefix through the first program sample. No
 // settling interval, interpolated sample or whole-startup guarantee is added.
 const frames=[...cold,recording.track[firstProgram]];
 if(frames.some((f,i)=>!Number.isFinite(f.t)||(i>0&&f.t<=frames[i-1].t)))return {...header,status:'not-observed',reason:'invalid-sample-times'};
 const hubs=recording.mechanism.hubs||[];
 if(hubs.length!==1)throw new Error('startup diagnostic requires exactly one observation hub');
 const o=observeAddon(recording,hubs[0].id),g=compiledWalkingBeam(recording,o),origin=o.initial('piston_rack');
 const axis=g.B.u.map((x,i)=>x*g.slide[0]+g.B.v[i]*g.slide[1]);
 let previousBeta=0;
 const rows=frames.map(f=>{
  const phi=o.angle(f,'crank',g.B.a,g.B.u),beta=o.angle(f,'walking_beam',g.B.a,g.B.u),expected=walkingBeamPose(g,phi,previousBeta);
  previousBeta=expected.beta;
  const delta=beta-expected.beta;
  const beamDeg=Math.abs(deg(Math.atan2(Math.sin(delta),Math.cos(delta))));
  const pistonMm=Math.abs(dot(sub(o.point(f,'piston_rack'),origin),axis)-expected.s)*1000;
  if(!Number.isFinite(beamDeg)||!Number.isFinite(pistonMm))throw new Error('startup diagnostic contains non-finite residuals');
  return {t:f.t,phase:f.phase,beamDeg,pistonMm};
 });
 const peak=key=>rows.reduce((a,b)=>b[key]>a[key]?b:a);
 const beam=peak('beamDeg'),piston=peak('pistonMm');
 return {...header,status:beam.beamDeg>bounds.beamDeg||piston.pistonMm>bounds.pistonMm?'observed-fail':'observed-within-bounds',
  coverage:{fromMs:frames[0].t,throughMs:frames.at(-1).t,coldSamples:cold.length,programSamples:1,samples:frames.length},
  maxima:{beamDeg:beam.beamDeg,pistonMm:piston.pistonMm},
  witnesses:{beam:{t:beam.t,phase:beam.phase},piston:{t:piston.t,phase:piston.phase}}};
}
