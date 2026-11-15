// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Robot Lab R4 judges (2026-11-12): Solstice walking beam and Tempest double pendulum, after their start-guard
// pose repairs (each model now rests in its gravity equilibrium, so the unpowered cold settle no longer moves it).
//
// Each law is the mechanism's own physics and its constants come from the compiled model, never from a run.
// Bounds are frozen here and never loosened to admit a model.
//
// - walking-beam-v1 (solstice-pumpjack): a crank-rocker four-bar (crank r, pitman Lp, beam arm rb about the beam
//   pivot C) drives a walking beam whose far arm rd carries a pump rod Lr down to a piston on a straight slider.
//   Every length and the slider line are read from the compiled joint points. For each observed crank angle φ the
//   judge solves the closed loop |B(β) − P(φ)| = Lp for the beam angle β and then the piston position on its line
//   with |S − D(β)| = Lr, and compares both with the observed beam and piston poses. Swing and stroke follow from
//   the same loop over a full crank turn (42.40° and 40.58 mm for the compiled lengths).
// - double-pendulum-mode-v1 (tempest-pendulum): two compound pendulums in series on a carrier that the motor holds
//   still. Linearised about the hanging rest, M·q̈ + K·q = 0 with M and K from each arm's mass, centre of mass
//   and moment of inertia about its centre (the engine's compiled mass properties): slow mode 0.6650 s with
//   lower/upper amplitude ratio +1.485, fast mode 0.2989 s with ratio −1.436. These constants were computed from
//   the compiled bodies (test/bw-sim-qualification.test.mjs recomputes them from the engine's mass properties and
//   requires equality); not the point-mass ideal (√2 ratio), which the compiled arms do not have. While the
//   carrier is held, the observed upper and lower arm angles must be the sum of the two predicted modes: the
//   modal coordinates' zero-crossing periods equal the predicted periods, and the two-mode fit leaves only a small
//   residual in each arm.
import assert from 'node:assert/strict';
import {observeAddon} from './sim-lab-addon-judge.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=v=>Math.hypot(...v),unit=v=>v.map(x=>x/norm(v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],scale=(v,s)=>v.map(x=>x*s);
const deg=x=>x*180/Math.PI,span=a=>Math.max(...a)-Math.min(...a),max=a=>Math.max(...a);
const unwrap=a=>{let p=a[0],t=p;return a.map(v=>{t+=Math.atan2(Math.sin(v-p),Math.cos(v-p));p=v;return t;});};
const fmt=o=>JSON.stringify(o,(k,v)=>typeof v==='number'?+v.toPrecision(6):v);
const check=(ok,msg,values)=>assert.ok(ok,msg+' '+fmt(values));

// Frozen constants and bounds of the two laws. Never loosened to admit a model.
export const R4_LAWS=Object.freeze({
 walkingBeam:Object.freeze({crankMm:16,pitmanMm:64,beamInMm:48,beamOutMm:56,rodMm:64,compiledMm:.05,swingDeg:42.40,strokeMm:40.58,
  predictedTol:.05,beamDeg:.1,pistonMm:.1,driveDeg:.25,swingTolDeg:.1,strokeTolMm:.1,crankSpanDeg:359,returnDeg:1,disconnectedDeg:5}),
 doublePendulum:Object.freeze({slowS:.66499,fastS:.29888,slowShape:1.4847,fastShape:-1.4356,armMm:64,compiledMm:.05,bob:'39367p01.dat',
  periodRel:.01,residualRel:.15,fastMinDeg:.3,heldDeg:.25,driveDeg:.25,minHoldS:6,settleS:.5,disconnectedDeg:5})
});

function healthy(r,native,expectedIssues){
 const key=i=>i.code+':'+[...(i.parts||[])].sort().join(',');
 assert.deepEqual(r.issues.map(key).sort(),(expectedIssues||[]).map(key).sort(),'compiler issues are exactly the reviewed, declared ones');
 assert.deepEqual(r.unsupported,[]);assert.ok(r.finishedAt>0,'the actual VM finishes');
 assert.ok(r.track.length>=(native?1000:100),'dense actual motion recording');
 for(const f of r.track)for(const b of Object.values(f.bodies))assert.ok([...b.position,...b.rotation].every(Number.isFinite));
 assert.ok(r.mechanism.bodies.filter(b=>b.motion==='static').every(b=>b.id==='ground'),'only the floor is fixed');
}
function foundation(r,o){
 const first=r.track.find(f=>f.phase==='program')||r.track[0],b=first.bodies[o.base.id],frames=r.track.filter(f=>f.phase!=='cold');
 const horizontalMm=max(frames.map(f=>Math.hypot(f.bodies[o.base.id].position[0]-b.position[0],f.bodies[o.base.id].position[2]-b.position[2])*1000)),tiltDeg=max(frames.map(f=>o.tilt(f)));
 check(horizontalMm<=2&&tiltDeg<=2,'upright stationary chassis in world coordinates',{horizontalMm,tiltDeg});
 const gapMm=max(r.track.map(f=>o.gap(f))),axisDeg=max(r.track.map(f=>o.axisGap(f)));
 check(gapMm<=.5&&axisDeg<=1,'true hinge closure and aligned axes',{gapMm,axisDeg});return{horizontalMm,tiltDeg,gapMm,axisDeg};
}
const baseOf=r=>{const hubs=r.mechanism.hubs||[];assert.equal(hubs.length,1,'exactly one registered hub names the observation base');return hubs[0].id;};
const bodyOf=(r,id)=>{const b=r.mechanism.bodies.find(b=>b.parts.includes(id));assert.ok(b,'compiled part '+id);return b;};
/** The one joint between the bodies holding parts a and b. */
const jointOf=(r,a,b,type)=>{const A=bodyOf(r,a).id,B=bodyOf(r,b).id,j=r.mechanism.joints.filter(j=>(!type||j.type===type)&&[j.body1,j.body2].includes(A)&&[j.body1,j.body2].includes(B));
 assert.equal(j.length,1,'one compiled joint between '+a+' and '+b);return j[0];};
const motorJoint=r=>{const m=r.mechanism.joints.filter(j=>j.motor?.port==='A');assert.equal(m.length,1,'motor A drives one joint');return m[0];};
/** A plane basis (u, v) perpendicular to the axis, v = axis × u: a rotation by +θ about the axis turns u towards v. */
const basis=axis=>{const a=unit(axis),t=Math.abs(a[0])<.9?[1,0,0]:[0,1,0],u=unit(cross(t,a));return{a,u,v:cross(a,u)};};
const to2=(B,p,o)=>{const d=sub(p,o);return[dot(d,B.u),dot(d,B.v)];};
const rot2=([x,y],t)=>[x*Math.cos(t)-y*Math.sin(t),x*Math.sin(t)+y*Math.cos(t)];
const vars=r=>r.track.at(-1).extra?.variables||{};
const relAngle=(o,f,id,B)=>o.angle(f,id,B.a,B.u);

// ---------------------------------------------------------------------------------------------- walking-beam-v1
// The pin centres of the linkage in each part's own LDraw frame (LDU): crank pin P on the crank, pitman pin B and
// pump-rod pin D on the walking beam, rod pin S on the piston. A cut run (pin P removed) still has these parts.
const BEAM_PINS=Object.freeze({P:['crank',[0,-10,40]],B:['walking_beam',[0,10,-120]],D:['walking_beam',[0,10,140]],S:['piston_rack',[-110,0,10]]});
/** The four-bar and slider geometry: the crank axis, beam pivot and slider line from the compiled joints, the four
 *  pin centres from the parts (the main judge checks they coincide with the compiled pin joints). */
export function compiledWalkingBeam(r,o=observeAddon(r,baseOf(r))){
 const crank=motorJoint(r),beam=jointOf(r,'walking_beam','hub','hinge'),slide=jointOf(r,'piston_rack','hub','slider');
 assert.ok([crank.body1,crank.body2].includes(bodyOf(r,'crank').id),'motor A turns the crank directly');
 const B=basis(crank.axis);check(Math.abs(Math.abs(dot(unit(beam.axis),B.a))-1)<1e-6,'beam pivot parallel to the crank axis',{joint:beam.id});
 const pin=k=>to2(B,o.initial(...BEAM_PINS[k]),crank.point),O=[0,0],C=to2(B,beam.point,crank.point),P0=pin('P'),B0=pin('B'),D0=pin('D'),S0=pin('S');
 const s=[dot(unit(slide.axis),B.u),dot(unit(slide.axis),B.v)],d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
 return{B,O,C,P0,B0,D0,S0,slide:s,crankMm:d(P0,O)*1000,pitmanMm:d(B0,P0)*1000,beamInMm:d(B0,C)*1000,beamOutMm:d(D0,C)*1000,rodMm:d(S0,D0)*1000,
  armsOpposite:dot(sub(B0,C),sub(D0,C))<0};
}
/** In-plane distance (mm) between each linkage pin centre and its compiled hinge (every hinge parallel to the crank). */
function pinJointGapsMm(r,g){
 const crank=motorJoint(r),pairs={P:['pitman','crank'],B:['pitman','walking_beam'],D:['pump_rod','walking_beam'],S:['pump_rod','piston_rack']};
 return Object.fromEntries(Object.entries(pairs).map(([k,[a,b]])=>{const j=jointOf(r,a,b,'hinge');check(Math.abs(Math.abs(dot(unit(j.axis),g.B.a))-1)<1e-6,'every hinge parallel to the crank axis',{joint:j.id});
  const q=to2(g.B,j.point,crank.point),p=g[k+'0'];return[k,Math.hypot(q[0]-p[0],q[1]-p[1])*1000];}));
}
/** The closed loop: beam angle β (from the saved pose) and piston travel along the slider for crank angle φ. */
export function walkingBeamPose(g,phi,beta0=0){
 const P=add(g.O,rot2(sub(g.P0,g.O),phi)),Lp=Math.hypot(g.B0[0]-g.P0[0],g.B0[1]-g.P0[1]),Lr=Math.hypot(g.S0[0]-g.D0[0],g.S0[1]-g.D0[1]);
 const f=b=>{const Bb=add(g.C,rot2(sub(g.B0,g.C),b));return Math.hypot(Bb[0]-P[0],Bb[1]-P[1])-Lp;};
 let b=beta0;for(let i=0;i<50;i++){const h=1e-7,df=(f(b+h)-f(b-h))/(2*h);if(!(Math.abs(df)>1e-12))break;const step=f(b)/df;b-=step;if(Math.abs(step)<1e-13)break;}
 const D=add(g.C,rot2(sub(g.D0,g.C),b)),w=sub(g.S0,D),bq=2*dot(w,g.slide),cq=dot(w,w)-Lr*Lr,disc=Math.sqrt(Math.max(0,bq*bq-4*cq));
 const roots=[(-bq+disc)/2,(-bq-disc)/2];return{beta:b,s:Math.abs(roots[0])<=Math.abs(roots[1])?roots[0]:roots[1],residual:Math.abs(f(b))};
}
/** Swing and stroke over one full crank turn, from the compiled loop. */
export function walkingBeamExtent(g){
 const rows=[];let b=0;for(let i=0;i<=3600;i++){const p=walkingBeamPose(g,i*Math.PI/1800,b);b=p.beta;rows.push(p);}
 return{swingDeg:deg(span(rows.map(x=>x.beta))),strokeMm:span(rows.map(x=>x.s))*1000,closureMm:max(rows.map(x=>x.residual))*1000};
}
/** Per frame: observed crank, beam and piston relative to the authored pose and hub; encoder travel from the first frame. */
export function walkingBeamTrack(r,o=observeAddon(r,baseOf(r)),g=compiledWalkingBeam(r,o)){
 const motor=motorJoint(r),crankBody=bodyOf(r,'crank').id,sign=motor.body2===crankBody?1:-1,frames=r.track.filter(f=>f.phase!=='cold');
 assert.ok(frames.length>0,'program frames recorded');
 // The compiled loop and piston origin use the authored pose. Rebasing angles to the
 // first observed frame mixes coordinate origins and can hide or spread startup error.
 const crank=unwrap(frames.map(f=>relAngle(o,f,'crank',g.B))),beam=unwrap(frames.map(f=>relAngle(o,f,'walking_beam',g.B)));
 const p0=o.initial('piston_rack'),axis3=add(scale(g.B.u,g.slide[0]),scale(g.B.v,g.slide[1]));
 const motor0=frames[0].joints[motor.id].angle;
 return frames.map((f,i)=>({t:f.t,phi:crank[i],beta:beam[i],s:dot(sub(o.point(f,'piston_rack'),p0),axis3),motor:sign*(f.joints[motor.id].angle-motor0)}));
}
function walkingBeamErrors(rows,g){let b=0;return rows.map(x=>{const p=walkingBeamPose(g,x.phi,b);b=p.beta;return{beamDeg:Math.abs(deg(x.beta-p.beta)),pistonMm:Math.abs(x.s-p.s)*1000};});}

/** walking-beam-v1: beam and piston follow the compiled crank-rocker loop at every frame. */
export function judgeWalkingBeam(r,{native=false,contract}={}){
 const L=R4_LAWS.walkingBeam;healthy(r,native,contract?.expectedIssues);assert.equal(r.mechanism.actuators.length,1);
 const o=observeAddon(r,baseOf(r)),g=compiledWalkingBeam(r,o),ext=walkingBeamExtent(g),pinGapsMm=pinJointGapsMm(r,g);
 check(Object.values(pinGapsMm).every(x=>x<=L.compiledMm),'linkage pins sit on their compiled hinges',pinGapsMm);
 const compiled={crankMm:g.crankMm,pitmanMm:g.pitmanMm,beamInMm:g.beamInMm,beamOutMm:g.beamOutMm,rodMm:g.rodMm,...ext};
 check([['crankMm','crankMm'],['pitmanMm','pitmanMm'],['beamInMm','beamInMm'],['beamOutMm','beamOutMm'],['rodMm','rodMm']].every(([k,c])=>Math.abs(compiled[k]-L[c])<=L.compiledMm)&&g.armsOpposite,
  'compiled walking beam: 16 mm crank, 64 mm pitman, 48/56 mm beam arms on opposite sides, 64 mm pump rod',compiled);
 check(Math.abs(ext.swingDeg-L.swingDeg)<=L.predictedTol&&Math.abs(ext.strokeMm-L.strokeMm)<=L.predictedTol&&ext.closureMm<1e-6,'compiled loop predicts 42.40° swing and 40.58 mm stroke',compiled);
 const v=vars(r);assert.equal(Number(v.completed),1,'program reports completion');assert.equal(Number(v.failed),0,'program reports no failure');assert.equal(Number(v.stage),7,'program reaches its final stage');
 const rows=walkingBeamTrack(r,o,g),err=walkingBeamErrors(rows,g);
 const values={beamErrorDeg:max(err.map(e=>e.beamDeg)),pistonErrorMm:max(err.map(e=>e.pistonMm)),driveErrorDeg:max(rows.map(x=>Math.abs(deg(x.phi-rows[0].phi-x.motor)))),
  crankSpanDeg:deg(span(rows.map(x=>x.phi))),swingDeg:deg(span(rows.map(x=>x.beta))),strokeMm:span(rows.map(x=>x.s))*1000,returnDeg:Math.abs(deg(rows.at(-1).phi))};
 check(values.crankSpanDeg>=L.crankSpanDeg,'the crank turns a full revolution',values);
 check(values.beamErrorDeg<=L.beamDeg,'walking beam follows the compiled crank-rocker loop',values);
 check(values.pistonErrorMm<=L.pistonMm,'piston follows the pump rod on its slider',values);
 check(values.driveErrorDeg<=L.driveDeg,'crank turns 1:1 with motor A',values);
 check(Math.abs(values.swingDeg-ext.swingDeg)<=L.swingTolDeg&&Math.abs(values.strokeMm-ext.strokeMm)<=L.strokeTolMm,'observed swing and stroke equal the predicted extent',values);
 check(values.returnDeg<=L.returnDeg,'crank returns to the saved pose',values);
 return{law:'|B(β) − P(φ)| = Lp; |S − D(β)| = Lr (compiled crank-rocker and slider)',compiled,...values,frames:rows.length,foundation:foundation(r,o)};
}

// ------------------------------------------------------------------------------------ double-pendulum-mode-v1
const MODES=(()=>{const L=R4_LAWS.doublePendulum;const V=[[1,1],[L.slowShape,L.fastShape]],det=V[0][0]*V[1][1]-V[0][1]*V[1][0];
 return{w:[2*Math.PI/L.slowS,2*Math.PI/L.fastS],V,inv:[[V[1][1]/det,-V[0][1]/det],[-V[1][0]/det,V[0][0]/det]]};})();
/**
 * The two normal modes from the engine's compiled mass properties (what the frozen slowS/fastS/shapes were computed
 * from): each arm's mass m, centre of mass c and inertia I about its centre (about the hinge axis), the shoulder S
 * and elbow E, all in the world frame at the hanging rest. Linearised Lagrangian of two compound pendulums in
 * series (absolute angles q1, q2; g along −y):
 *   M = [[I1 + m1|c1−S|² + m2|E−S|², m2 (E−S)·(c2−E)], [·, I2 + m2|c2−E|²]],  K = g·diag(m1 h1 + m2 hE, m2 h2)
 * with h the depth of each lever below its pivot (in the swing plane). Returns periods (s) and lower/upper ratios.
 */
export function doublePendulumModes({axis,shoulder,elbow,upper,lower,g=9.81}){
 const B=basis(axis),p=v=>{const d=v;return[dot(d,B.u),dot(d,B.v)];},S=p(shoulder),E=p(elbow),c1=sub(p(upper.com),S),e0=sub(E,S),c2=sub(p(lower.com),E);
 const up=p([0,1,0]),depth=v=>-dot(v,up)/Math.hypot(...up),Ia=I=>{const a=B.a;return a.reduce((s,ai,i)=>s+ai*a.reduce((t,aj,j)=>t+I[i][j]*aj,0),0);};
 const M=[[Ia(upper.inertia)+upper.mass*dot(c1,c1)+lower.mass*dot(e0,e0),lower.mass*dot(e0,c2)],[lower.mass*dot(e0,c2),Ia(lower.inertia)+lower.mass*dot(c2,c2)]];
 const K=[[g*(upper.mass*depth(c1)+lower.mass*depth(e0)),0],[0,g*lower.mass*depth(c2)]];
 // Generalised eigenproblem K v = ω² M v for 2×2: det(K − λM) = 0.
 const a=M[0][0]*M[1][1]-M[0][1]**2,b=-(K[0][0]*M[1][1]+K[1][1]*M[0][0]),c=K[0][0]*K[1][1],disc=Math.sqrt(b*b-4*a*c),l=[(-b-disc)/(2*a),(-b+disc)/(2*a)];
 const ratio=lam=>-(K[0][0]-lam*M[0][0])/(-lam*M[0][1]);
 return{slowS:2*Math.PI/Math.sqrt(l[0]),fastS:2*Math.PI/Math.sqrt(l[1]),slowShape:ratio(l[0]),fastShape:ratio(l[1]),M,K};
}
/** Shoulder, elbow, arm length and bob parts, from the compiled model alone. */
export function compiledDoublePendulum(r){
 const motor=motorJoint(r),shoulder=jointOf(r,'carrier','upper_arm','hinge'),elbow=jointOf(r,'upper_arm','lower_arm','hinge');
 const carrier=bodyOf(r,'carrier').id;assert.ok([motor.body1,motor.body2].includes(carrier),'motor A turns the carrier directly');
 assert.ok(bodyOf(r,'upper_bob_wheel').id===bodyOf(r,'upper_arm').id&&bodyOf(r,'lower_bob_wheel').id===bodyOf(r,'lower_arm').id,'each bob is fixed to its arm');
 const part=id=>r.runModel.parts.find(p=>p.id===id)?.part,B=basis(motor.axis);
 for(const j of [shoulder,elbow])check(Math.abs(Math.abs(dot(unit(j.axis),B.a))-1)<1e-6,'pendulum hinges parallel to the carrier axis',{joint:j.id});
 // The arm in the swing plane: the shoulder-to-elbow offset with its component along the hinge axis removed.
 const d=sub(elbow.point,shoulder.point),arm=sub(d,scale(B.a,dot(d,B.a)));
 return{B,armMm:norm(arm)*1000,bobs:[part('upper_bob_wheel'),part('lower_bob_wheel')],elbowBelowShoulder:dot(arm,[0,-1,0])/norm(arm)};
}
/** Per frame: carrier, upper-arm and lower-arm angles relative to the hub (unwrapped, from the saved pose) and the encoder. */
export function doublePendulumTrack(r,o=observeAddon(r,baseOf(r)),g={B:basis(motorJoint(r).axis)}){
 // The encoder's sign follows the motor joint's body order: positive when the rotor (the body without the hub) is body2.
 const motor=motorJoint(r),base=bodyOf(r,baseOf(r)).id,sign=motor.body1===base?1:-1,frames=r.track.filter(f=>f.phase!=='cold');assert.ok(frames.length>0,'program frames recorded');
 const series=id=>{const a=unwrap(frames.map(f=>relAngle(o,f,id,g.B)));return a.map(x=>x-a[0]);},c=series('carrier'),q1=series('upper_arm'),q2=series('lower_arm'),m0=frames[0].joints[motor.id].angle;
 return frames.map((f,i)=>({t:f.t/1000,carrier:c[i],q1:q1[i],q2:q2[i],motor:sign*(f.joints[motor.id].angle-m0)}));
}
/** Held-carrier windows: the carrier away from home and still (within heldDeg) for at least minHoldS; the first settleS dropped. */
export function heldWindows(rows){
 const L=R4_LAWS.doublePendulum,out=[];let i=0;
 while(i<rows.length){let j=i;while(j+1<rows.length&&Math.abs(deg(rows[j+1].carrier-rows[i].carrier))<=L.heldDeg)j++;
  if(rows[j].t-rows[i].t>=L.minHoldS&&Math.abs(deg(rows[i].carrier))>10)out.push(rows.slice(i,j+1).filter(x=>x.t>=rows[i].t+L.settleS));i=j+1;}
 return out;
}
const lstsq=(A,y)=>{const n=A[0].length,N=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>A.reduce((s,row)=>s+row[i]*row[j],0))),b=Array.from({length:n},(_,i)=>A.reduce((s,row,k)=>s+row[i]*y[k],0));
 for(let c=0;c<n;c++){let p=c;for(let k=c+1;k<n;k++)if(Math.abs(N[k][c])>Math.abs(N[p][c]))p=k;[N[c],N[p]]=[N[p],N[c]];[b[c],b[p]]=[b[p],b[c]];
  for(let k=c+1;k<n;k++){const m=N[k][c]/N[c][c];for(let j=c;j<n;j++)N[k][j]-=m*N[c][j];b[k]-=m*b[c];}}
 const x=Array(n).fill(0);for(let c=n-1;c>=0;c--){let s=b[c];for(let j=c+1;j<n;j++)s-=N[c][j]*x[j];x[c]=s/N[c][c];}return x;};
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
/** One held window: modal zero-crossing periods and the two-mode fit residual of each arm (frozen ω, shapes; free amplitude, phase, decay). */
export function modalWindow(w){
 const t0=w[0].t,t=w.map(x=>x.t-t0),mean=k=>w.reduce((s,x)=>s+x[k],0)/w.length,m1=mean('q1'),m2=mean('q2'),q=w.map(x=>[x.q1-m1,x.q2-m2]);
 const eta=q.map(([a,b])=>[MODES.inv[0][0]*a+MODES.inv[0][1]*b,MODES.inv[1][0]*a+MODES.inv[1][1]*b]);
 const period=k=>{const z=[];for(let i=1;i<eta.length;i++)if(eta[i-1][k]<0&&eta[i][k]>=0)z.push(t[i-1]+(t[i]-t[i-1])*(-eta[i-1][k])/(eta[i][k]-eta[i-1][k]));return z.length>2?(z.at(-1)-z[0])/(z.length-1):NaN;};
 let best=null;
 for(let z1=0;z1<=1;z1+=.02)for(let z2=0;z2<=1.5;z2+=.03){
  const cols=t.map(x=>{const e1=Math.exp(-z1*x),e2=Math.exp(-z2*x),c1=Math.cos(MODES.w[0]*x)*e1,s1=Math.sin(MODES.w[0]*x)*e1,c2=Math.cos(MODES.w[1]*x)*e2,s2=Math.sin(MODES.w[1]*x)*e2;return[c1,s1,c2,s2];});
  // Both arms share the four modal amplitudes: q1 = η_s + η_f, q2 = v_s·η_s + v_f·η_f.
  const A=[...cols.map(c=>[c[0],c[1],c[2],c[3]]),...cols.map(c=>[MODES.V[1][0]*c[0],MODES.V[1][0]*c[1],MODES.V[1][1]*c[2],MODES.V[1][1]*c[3]])],y=[...q.map(x=>x[0]),...q.map(x=>x[1])];
  const x=lstsq(A,y),res=A.map((row,i)=>row.reduce((s,v,k)=>s+v*x[k],0)-y[i]),r1=rms(res.slice(0,q.length))/rms(q.map(x=>x[0])),r2=rms(res.slice(q.length))/rms(q.map(x=>x[1]));
  if(!best||Math.max(r1,r2)<Math.max(best.upperResidual,best.lowerResidual))best={upperResidual:r1,lowerResidual:r2,decay:[z1,z2]};}
 return{seconds:t.at(-1),slowPeriodS:period(0),fastPeriodS:period(1),slowRmsDeg:deg(rms(eta.map(e=>e[0]))),fastRmsDeg:deg(rms(eta.map(e=>e[1]))),
  upperRmsDeg:deg(rms(q.map(x=>x[0]))),...best};
}

/** double-pendulum-mode-v1: the held-carrier swing is the sum of the two compiled normal modes. */
export function judgeDoublePendulum(r,{native=false,contract}={}){
 const L=R4_LAWS.doublePendulum;healthy(r,native,contract?.expectedIssues);assert.equal(r.mechanism.actuators.length,1);
 const o=observeAddon(r,baseOf(r)),g=compiledDoublePendulum(r);
 check(Math.abs(g.armMm-L.armMm)<=L.compiledMm&&g.bobs.every(b=>b===L.bob)&&g.elbowBelowShoulder>.999,'compiled serial pendulum: 64 mm upper arm hanging straight down, a SPIKE wheel bob on each arm',g);
 const v=vars(r);assert.equal(Number(v.completed),1,'program reports completion');assert.equal(Number(v.failed),0,'program reports no failure');assert.equal(Number(v.stage),4,'program reaches its final stage');
 const rows=doublePendulumTrack(r,o,g),windows=heldWindows(rows).map(modalWindow),driveErrorDeg=max(rows.map(x=>Math.abs(deg(x.carrier-x.motor))));
 const values={windows,driveErrorDeg,returnDeg:Math.abs(deg(rows.at(-1).carrier))};
 check(windows.length>=2,'two held-carrier observation windows',values);
 for(const w of windows){
  check(Math.abs(w.slowPeriodS-L.slowS)/L.slowS<=L.periodRel,'slow mode period equals the compiled prediction 0.6650 s',values);
  check(w.upperResidual<=L.residualRel&&w.lowerResidual<=L.residualRel,'both arms are the sum of the two compiled modes',values);
  if(w.fastRmsDeg>=L.fastMinDeg)check(Math.abs(w.fastPeriodS-L.fastS)/L.fastS<=L.periodRel,'fast mode period equals the compiled prediction 0.2989 s',values);
 }
 check(windows.some(w=>w.fastRmsDeg>=L.fastMinDeg),'the fast mode is excited in at least one window',values);
 check(driveErrorDeg<=L.driveDeg,'carrier turns 1:1 with motor A',values);check(values.returnDeg<=1,'carrier returns to the saved pose',values);
 return{law:'M·q̈ + K·q = 0 (compiled arms): slow 0.6650 s (+1.485), fast 0.2989 s (−1.436)',compiled:g,...values,frames:rows.length,foundation:foundation(r,o)};
}

/** Disconnection loss per model: the law's own measure on the cut run. */
export function r4DisconnectionLoss(id,r){
 if(id==='solstice-pumpjack'){
  const g=compiledWalkingBeam(r),rows=walkingBeamTrack(r,undefined,g),err=walkingBeamErrors(rows,g),value=max(err.map(e=>e.beamDeg));
  return{metric:'beamLawErrorDeg',value,crankSpanDeg:deg(span(rows.map(x=>x.phi))),lost:value>R4_LAWS.walkingBeam.disconnectedDeg};
 }
 if(id==='tempest-pendulum'){
  // Without motor A's two pins the carrier no longer follows the motor: it hangs free, so the arms are never excited.
  const rows=doublePendulumTrack(r),value=max(rows.map(x=>Math.abs(deg(x.carrier-x.motor))));
  return{metric:'carrierDriveErrorDeg',value,motorSpanDeg:deg(span(rows.map(x=>x.motor))),upperSpanDeg:deg(span(rows.map(x=>x.q1))),lost:value>R4_LAWS.doublePendulum.disconnectedDeg};
 }
 throw new Error('no R4 disconnection measure for '+id);
}
