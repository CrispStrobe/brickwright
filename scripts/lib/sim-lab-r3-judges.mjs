// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Robot Lab R3 judges (2026-11-12): Vesper quick-return shaper, Aster centrifugal governor, Apex Wankel rotor.
//
// Each law is the mechanism's own physics with its constants read from the compiled model (joint points and axes,
// slider axes, collider masses, catalogue tooth counts), never fitted to a run. Each judge then measures the parts'
// actual poses relative to the hub and the motor encoder. Bounds are frozen here and never loosened to admit a model.
//
// - quick-return-v1 (vesper-quickreturn): crank-and-slotted-lever (Whitworth) quick return. The crank pin P turns on
//   radius r about the motor axis C and slides in the lever's guide, a line kept at the compiled distance from the
//   lever pivot O; the lever end B drives the ram pin S through a rod of the compiled length, and S runs on the ram's
//   slider line. The ram position is a function of the crank angle alone, predicted for every frame from these
//   compiled points; the stroke and the time ratio (crank arc of the slow stroke over that of the fast stroke) follow
//   from it (here 66.17 mm and 1.4588). Reversing the crank swaps which ram direction is the slow one.
// - governor-lift-v1 (aster-governor): a loaded (Porter) governor with offset hinges. For a collar lift h the arms'
//   pose follows from the compiled hinge points; in the frame turning with the spindle the effective potential is
//   V(h) = g·Σ m·y − ½ω²·J(h), with J the moment of inertia about the spindle axis of the compiled colliders (mass,
//   centre, shape inertia). Equilibrium dV/dh = 0 gives ω²(h) = 2g·(dY/dh)/(dJ/dh). Each held speed is compared with
//   the speed the measured lift predicts. (The point-mass form ω² = g·k·tan a/(e + L sin a) of the handoff is the same
//   law with every arm mass lumped at the weight axle; it is about 4.5 % slow here, so the judge uses the distributed
//   compiled masses.)
// - wankel-ratio-v1 (apex): Wankel kinematics. Motor A's 20T drives the 28T turntable carrier (|carrier| = (20/28)|A|,
//   carrier against the motor); the fixed 16T sun drives the carrier's 8T idler, whose 8T twin drives the rotor's
//   24T gear, so rotor = carrier·(1 − (16/8)(8/24)) = carrier/3, same direction. The rotor bearing sits at the
//   compiled eccentricity e from the carrier axis, so the rotor centre runs on that circle at the carrier angle.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observeAddon} from './sim-lab-addon-judge.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),sc=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=v=>Math.hypot(...v),unit=v=>sc(v,1/norm(v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const deg=x=>x*180/Math.PI,span=a=>Math.max(...a)-Math.min(...a),maxAbs=a=>Math.max(...a.map(Math.abs)),mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const unwrap=a=>{let p=a[0],t=p;return a.map(v=>{t+=Math.atan2(Math.sin(v-p),Math.cos(v-p));p=v;return t;});};
const fmt=o=>JSON.stringify(o,(k,v)=>typeof v==='number'?+v.toPrecision(6):v);
const check=(ok,msg,values)=>assert.ok(ok,msg+' '+fmt(values));
// Quaternions [x, y, z, w], as the engine records body rotations.
const qrot=(q,v)=>{const u=q.slice(0,3),t=sc(cross(u,v),2);return add(add(v,sc(t,q[3])),cross(u,t));};
const qconj=q=>[-q[0],-q[1],-q[2],q[3]];
const rodrigues=(n,th,v)=>add(add(sc(v,Math.cos(th)),sc(cross(n,v),Math.sin(th))),sc(n,dot(n,v)*(1-Math.cos(th))));
const CATALOG=(()=>{const P=JSON.parse(readFileSync(new URL('../../overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json',import.meta.url),'utf8'));return new Map(Object.values(P.parts||P).map(p=>[p.part,p]));})();
/** Tooth count of a compiled part, from the part catalogue. */
const teeth=(r,id)=>{const p=r.runModel.parts.find(p=>p.id===id);assert.ok(p,'compiled part '+id);const n=CATALOG.get(p.part)?.gear?.teeth;assert.ok(n>0,'gear part '+id);return n;};

// Frozen constants and bounds of the three laws. Never loosened to admit a model.
export const R3_LAWS=Object.freeze({
 quickReturn:Object.freeze({lawMm:.5,strokeMm:.5,ratioTol:.02,driveDeg:.5,crankTurns:3,stages:Object.freeze({forward:[1,3],reverse:[2,4]}),disconnectedMm:5}),
 governor:Object.freeze({speedTol:.03,restMm:.1,repeatMm:.5,plateaus:Object.freeze([3,5,7,9,11,15]),rests:Object.freeze([1,13,17]),tail:.6,cutMinDps:790,cutMaxLiftMm:1}),
 wankel:Object.freeze({carrierDeg:.25,rotorDeg:.25,centreMm:.1,carrierTurns:3,disconnectedDeg:5})
});

function healthy(r,native,expectedIssues){
 const key=i=>i.code+':'+[...(i.parts||[])].sort().join(',');
 assert.deepEqual(r.issues.map(key).sort(),(expectedIssues||[]).map(key).sort(),'compiler issues are exactly the reviewed, declared ones');
 assert.deepEqual(r.unsupported,[]);assert.ok(r.finishedAt>0,'the actual VM finishes');
 assert.ok(r.track.length>=(native?1000:100),'dense actual motion recording');
 for(const f of r.track)for(const b of Object.values(f.bodies))assert.ok([...b.position,...b.rotation].every(Number.isFinite));
 assert.ok(r.mechanism.bodies.filter(b=>b.motion==='static').every(b=>b.id==='ground'),'only the floor is fixed');
 assert.equal(r.mechanism.actuators.length,1);
}
function foundation(r,o){
 const first=r.track.find(f=>f.phase==='program')||r.track[0],b=first.bodies[o.base.id],frames=r.track.filter(f=>f.phase!=='cold');
 const horizontalMm=Math.max(...frames.map(f=>Math.hypot(f.bodies[o.base.id].position[0]-b.position[0],f.bodies[o.base.id].position[2]-b.position[2])*1000)),tiltDeg=Math.max(...frames.map(f=>o.tilt(f)));
 check(horizontalMm<=2&&tiltDeg<=2,'upright stationary chassis in world coordinates',{horizontalMm,tiltDeg});
 const gapMm=Math.max(...r.track.map(f=>o.gap(f))),axisDeg=Math.max(...r.track.map(f=>o.axisGap(f)));
 check(gapMm<=.5&&axisDeg<=1,'true hinge closure and aligned axes',{gapMm,axisDeg});return{horizontalMm,tiltDeg,gapMm,axisDeg};
}
function completed(r){const v=r.track.at(-1).extra.variables;assert.equal(Number(v.completed),1,'program reports completion');assert.equal(Number(v.failed),0,'program reports no failure');}
const program=r=>r.track.filter(f=>f.phase!=='cold');
const bodyOf=(r,part)=>{const b=r.mechanism.bodies.find(b=>b.parts.includes(part));assert.ok(b,'compiled body of '+part);return b;};
const jointBetween=(r,a,b,type)=>{const j=r.mechanism.joints.find(j=>(!type||j.type===type)&&((j.body1===a&&j.body2===b)||(j.body1===b&&j.body2===a)));assert.ok(j,'compiled joint '+a+'–'+b);return j;};
/** A compiled (world, initial) point carried by its body, expressed in the hub's initial frame (cf. observeAddon). */
function carried(r,o,f,bodyId,p){
 const b=r.mechanism.bodies.find(x=>x.id===bodyId),fb=f.bodies[bodyId],base=o.base,fh=f.bodies[base.id];
 const w=add(fb.position,qrot(fb.rotation,qrot(qconj(b.rotation),sub(p,b.position))));
 return add(base.position,qrot(base.rotation,qrot(qconj(fh.rotation),sub(w,fh.position))));
}
/** Unwrapped rotation (deg from the first frame) of a body about an axis, relative to the hub. */
const absoluteTurn=(o,frames,part,axis)=>{const ref=unit(cross(axis,Math.abs(axis[0])<.8?[1,0,0]:[0,1,0]));return unwrap(frames.map(f=>o.angle(f,part,axis,ref))).map(deg);};
/** The same, from the first program frame. */
const turn=(o,frames,part,axis)=>{const a=absoluteTurn(o,frames,part,axis);return a.map(x=>x-a[0]);};
const encoder=(r,frames,port)=>{const j=r.mechanism.joints.find(j=>j.motor?.port===port);assert.ok(j,'motor '+port+' drives a joint');return{joint:j,deg:frames.map(f=>deg(f.joints[j.id].angle-frames[0].joints[j.id].angle))};};
const stageOf=f=>Number(f.extra?.variables?.stage);

// ---------------------------------------------------------------- quick-return-v1
/** The compiled crank, lever, rod and ram geometry, in the crank's plane. */
export function compiledQuickReturn(r,{requireDrive=true}={}){
 const crank=bodyOf(r,'crank'),lever=bodyOf(r,'slot_housing'),slide=bodyOf(r,'slot_rack'),rod=bodyOf(r,'connecting_rod'),ram=bodyOf(r,'ram_rack');
 const drive=r.mechanism.joints.find(j=>j.motor?.port==='A');assert.ok(drive&&(!requireDrive||[drive.body1,drive.body2].includes(crank.id)),'motor A turns the crank');
 const n=unit(drive.axis),e1=unit(cross(n,Math.abs(n[0])<.8?[1,0,0]:[0,1,0])),e2=cross(n,e1),to2=p=>[dot(p,e1),dot(p,e2)],dir2=v=>unit([dot(v,e1),dot(v,e2)]);
 const leverFrame=r.mechanism.joints.find(j=>j.type==='hinge'&&[j.body1,j.body2].includes(lever.id)&&![rod.id,slide.id].includes(j.body1===lever.id?j.body2:j.body1));assert.ok(leverFrame,'the lever pivots on the frame');
 // The crank pin P is the crank's outer hole (beam 5, local +40 LDU), so the law also stands when the pin is cut.
 const Pw=observeAddon(r).initial('crank',[0,0,40]),pj=r.mechanism.joints.find(j=>j.type==='hinge'&&[j.body1,j.body2].includes(crank.id)&&[j.body1,j.body2].includes(slide.id));
 const C=to2(drive.point),O=to2(leverFrame.point),P=to2(Pw),B=to2(jointBetween(r,lever.id,rod.id,'hinge').point),S=to2(jointBetween(r,rod.id,ram.id,'hinge').point);
 const u=dir2(jointBetween(r,slide.id,lever.id,'slider').axis),ramSlide=r.mechanism.joints.find(j=>j.type==='slider'&&[j.body1,j.body2].includes(ram.id));assert.ok(ramSlide,'the ram runs on a slider');
 const a=dir2(ramSlide.axis),c2=(p,q)=>p[0]*q[1]-p[1]*q[0];
 const crankMm=norm(sub(P,C))*1000,centreMm=norm(sub(O,C))*1000,leverOffsetMm=c2(u,sub(P,O))*1000,leverMm=norm(sub(B,O))*1000,rodMm=norm(sub(S,B))*1000;
 const e0=c2(u,sub(P,O)),psi0=Math.atan2(u[1],u[0]),alpha0=Math.atan2(P[1]-O[1],P[0]-O[0]),rho0=norm(sub(P,O));
 // ψ = α − asin(e0/ρ) or α − π + asin(e0/ρ): the branch that holds at the compiled pose.
 const branch=Math.abs(Math.cos(alpha0-Math.asin(e0/rho0)-psi0)-1)<1e-6?0:1;
 const w0=sub(S,B),sign=Math.sign(dot(a,w0))||1,L=norm(w0);
 /** Ram travel (m, along its slider) for a crank turn th (rad) from the compiled pose. */
 const ram0=th=>{const p=add(C,[Math.cos(th)*(P[0]-C[0])-Math.sin(th)*(P[1]-C[1]),Math.sin(th)*(P[0]-C[0])+Math.cos(th)*(P[1]-C[1])]),d=sub(p,O),rho=norm(d),al=Math.atan2(d[1],d[0]);
  const psi=branch?al-Math.PI+Math.asin(e0/rho):al-Math.asin(e0/rho),dp=psi-psi0,b=add(O,[Math.cos(dp)*(B[0]-O[0])-Math.sin(dp)*(B[1]-O[1]),Math.sin(dp)*(B[0]-O[0])+Math.cos(dp)*(B[1]-O[1])]),w=sub(S,b),aw=dot(a,w);
  return -aw+sign*Math.sqrt(aw*aw-dot(w,w)+L*L);};
 // Stroke and time ratio from a fine sweep of the compiled kinematics.
 const N=36000,v=Array.from({length:N},(_,i)=>ram0(2*Math.PI*i/N)),iMax=v.indexOf(Math.max(...v)),iMin=v.indexOf(Math.min(...v));
 const riseArcDeg=((iMax-iMin+N)%N)*360/N,fallArcDeg=360-riseArcDeg;
 return{pinJointMm:pj?norm(sub(to2(pj.point),P))*1000:null,crankMm,centreMm,leverOffsetMm,leverMm,rodMm,strokeMm:(v[iMax]-v[iMin])*1000,riseArcDeg,fallArcDeg,timeRatio:Math.max(riseArcDeg,fallArcDeg)/Math.min(riseArcDeg,fallArcDeg),
  crankAxis:n,ramAxis:ramSlide.axis,ram0,ramBody:ram.id,ramPoint:jointBetween(r,rod.id,ram.id,'hinge').point,aPlane:a,e1,e2};
}
/** Turning points of the ram within a run of frames: [frame index, crank angle (deg), ram (mm)], parabola-refined. */
function turningPoints(crank,ram,idx){
 const out=[];for(let k=1;k<idx.length-1;k++){const [a,b,c]=[ram[idx[k-1]],ram[idx[k]],ram[idx[k+1]]];
  if((b>a&&b>=c)||(b<a&&b<=c)){const den=a-2*b+c,s=den?Math.max(-1,Math.min(1,.5*(a-c)/den)):0,i=idx[k],j=s>=0?idx[k+1]:idx[k-1];
   out.push({i,crankDeg:crank[i]+Math.abs(s)*(crank[j]-crank[i]),mm:b,kind:b>a?'max':'min'});}}
 // Merge noise: keep alternating extremes only, the most extreme of each run.
 const merged=[];for(const p of out){const q=merged.at(-1);if(q&&q.kind===p.kind){if((p.kind==='max')===(p.mm>q.mm))merged[merged.length-1]=p;}else merged.push(p);}
 return merged;
}
export function quickReturnTrack(r,o=observeAddon(r),g=compiledQuickReturn(r)){
 // Crank angle and ram travel from the compiled pose (the cold settle may already have turned the crank a little).
 const frames=program(r),crank=absoluteTurn(o,frames,'crank',g.crankAxis),enc=encoder(r,frames,'A'),a3=add(sc(g.e1,g.aPlane[0]),sc(g.e2,g.aPlane[1]));
 const ramMm=frames.map(f=>dot(sub(carried(r,o,f,g.ramBody,g.ramPoint),g.ramPoint),a3)*1000);
 const pred=crank.map(c=>g.ram0(c*Math.PI/180)*1000);
 return{frames,crank,enc:enc.deg,ramMm,pred};
}
export function judgeQuickReturn(r,{native=false,contract}={}){
 const L=R3_LAWS.quickReturn;healthy(r,native,contract?.expectedIssues);completed(r);
 const o=observeAddon(r),g=compiledQuickReturn(r),t=quickReturnTrack(r,o,g);
 const driveDeg=maxAbs(t.crank.map((x,i)=>Math.abs(x-t.crank[0])-Math.abs(t.enc[i]))),lawMm=maxAbs(t.ramMm.map((x,i)=>x-t.pred[i])),strokeMm=span(t.ramMm);
 // Turning points only while the crank is commanded to move (the program's own `moving` flag), not in the holds.
 const stageIdx=s=>t.frames.map((f,i)=>stageOf(f)===s&&Number(f.extra.variables.moving)===1?i:-1).filter(i=>i>=0),stageAll=s=>t.frames.map((f,i)=>stageOf(f)===s?i:-1).filter(i=>i>=0);
 const slow={},ratios=[];
 for(const s of [...L.stages.forward,...L.stages.reverse]){const idx=stageIdx(s),pts=turningPoints(t.crank,t.ramMm,idx);
  const arcs=pts.slice(1).map((p,k)=>({arc:Math.abs(p.crankDeg-pts[k].crankDeg),dir:Math.sign(p.mm-pts[k].mm)}));
  const full=arcs.filter(a=>a.arc>60);for(let k=0;k+1<full.length;k++)ratios.push(Math.max(full[k].arc,full[k+1].arc)/Math.min(full[k].arc,full[k+1].arc));
  const longer=full.filter(a=>a.arc>180);slow[s]=longer.length?Math.sign(mean(longer.map(a=>a.dir))):0;}
 const turns=[...L.stages.forward,...L.stages.reverse].map(s=>{const idx=stageAll(s);return Math.abs(t.crank[idx.at(-1)]-t.crank[idx[0]])/360;});
 const ratioError=maxAbs(ratios.map(x=>x-g.timeRatio)),fwd=L.stages.forward.map(s=>slow[s]),rev=L.stages.reverse.map(s=>slow[s]);
 const values={lawMm,strokeMm,predictedStrokeMm:g.strokeMm,ratios:ratios.length,ratioMin:Math.min(...ratios),ratioMax:Math.max(...ratios),predictedRatio:g.timeRatio,ratioError,slowForward:fwd,slowReverse:rev,turns,driveDeg};
 check(g.pinJointMm!==null&&g.pinJointMm<=.01&&Math.abs(g.crankMm-16)<=.05&&g.rodMm>0&&g.leverMm>g.centreMm,'compiled crank-and-slotted-lever: 16 mm crank inside the pivot distance',g);
 check(turns.every(x=>Math.abs(x-L.crankTurns)<=.02),'three crank turns in every stage',values);
 check(driveDeg<=L.driveDeg,'crank turns 1:1 with motor A',values);
 check(lawMm<=L.lawMm,'ram follows the compiled quick-return kinematics at every crank angle',values);
 check(Math.abs(strokeMm-g.strokeMm)<=L.strokeMm,'ram stroke is the compiled stroke',values);
 check(ratios.length>=16&&ratioError<=L.ratioTol,'slow stroke over quick return takes the compiled crank-arc ratio',values);
 check(fwd.every(x=>x!==0&&x===fwd[0])&&rev.every(x=>x===-fwd[0]),'reversing the crank swaps the slow side',values);
 return{law:'Whitworth quick return: ram(θ) from the compiled crank, lever, guide offset and rod; stroke and arc ratio',compiled:{crankMm:g.crankMm,centreMm:g.centreMm,leverOffsetMm:g.leverOffsetMm,leverMm:g.leverMm,rodMm:g.rodMm,strokeMm:g.strokeMm,timeRatio:g.timeRatio},...values,frames:t.frames.length,foundation:foundation(r,o)};
}
/** Disconnection: without the crank pin P the crank still turns three times per stage, but the ram no longer follows. */
export function quickReturnDisconnectionLoss(r){
 const o=observeAddon(r),g=compiledQuickReturn(r,{requireDrive:false}),t=quickReturnTrack(r,o,g),value=maxAbs(t.ramMm.map((x,i)=>x-t.pred[i]));
 return{metric:'ramLawErrorMm',value,crankSpanDeg:span(t.crank),ramSpanMm:span(t.ramMm),lost:value>R3_LAWS.quickReturn.disconnectedMm};
}

// ---------------------------------------------------------------- governor-lift-v1
/** Colliders of a body in world coordinates at the compiled pose: centre, principal axes, inertia, mass. */
function colliders(b){return b.colliders.map(c=>{const q=c.rotation||[0,0,0,1],axes=[[1,0,0],[0,1,0],[0,0,1]].map(e=>qrot(b.rotation,qrot(q,e)));let I;
 if(c.shape==='box'){const [x,y,z]=c.halfExtents.map(v=>2*v);I=[y*y+z*z,x*x+z*z,x*x+y*y].map(v=>v*c.massKg/12);}
 else if(c.shape==='cylinder'){const R=c.radius,h=2*c.halfHeight,p=c.massKg*(3*R*R+h*h)/12;I=[p,c.massKg*R*R/2,p];}
 else if(c.shape==='sphere')I=[0,0,0].map(()=>.4*c.massKg*c.radius*c.radius);else throw new Error('collider shape '+c.shape);
 assert.ok(c.massKg>0,'collider mass');return{p:add(b.position,qrot(b.rotation,c.position||[0,0,0])),axes,I,m:c.massKg};});}
/** The compiled governor: hinge points, collar slider, and ω²(h) from the effective potential of the compiled masses. */
export function compiledGovernor(r){
 const M=r.mechanism,spin=M.joints.find(j=>j.motor?.port==='A');assert.ok(spin,'motor A turns the spindle');
 const rotor=spin.body2,collar=bodyOf(r,'collar').id,slide=jointBetween(r,rotor,collar,'slider'),up=unit(sc(M.gravity,-1)),axisP=spin.point;
 check(Math.abs(Math.abs(dot(unit(spin.axis),up))-1)<1e-9&&Math.abs(Math.abs(dot(unit(slide.axis),up))-1)<1e-9,'vertical spindle and collar slider',{spin:spin.axis,slide:slide.axis});
 // Each side's arms swing in the plane through its top hinge normal to the hinge axis; points are projected there
 // (the compiled hinge points also carry each pin's position along its axis).
 const sides=['pos','neg'].map(s=>{const U=bodyOf(r,'upper_arm_'+s).id,Lw=bodyOf(r,'lower_arm_'+s).id,T=jointBetween(r,U,rotor,'hinge'),W=jointBetween(r,U,Lw,'hinge'),K=jointBetween(r,Lw,collar,'hinge'),n=unit(T.axis);
  for(const j of [W,K])assert.ok(Math.abs(Math.abs(dot(unit(j.axis),n))-1)<1e-9,'parallel arm hinges');
  const proj=p=>sub(p,sc(n,dot(sub(p,T.point),n))),radial=p=>{const v=sub(p,axisP);return norm(sub(v,sc(up,dot(v,up))));};
  return{U,L:Lw,T:T.point,W0:W.point,K0:K.point,Wp:proj(W.point),Kp:proj(K.point),n,upperMm:norm(sub(proj(W.point),T.point))*1000,lowerMm:norm(sub(proj(W.point),proj(K.point)))*1000,
   topOffsetMm:radial(T.point)*1000,collarOffsetMm:radial(K.point)*1000};});
 const angleAbout=(n,a,b)=>Math.atan2(dot(n,cross(a,b)),dot(a,b));
 const pose=h=>{const out=[[collar,null,sc(up,h)]];for(const s of sides){const K=add(s.Kp,sc(up,h)),L1=norm(sub(s.Wp,s.T)),L2=norm(sub(s.Wp,s.Kp)),d=sub(K,s.T),D=norm(d),a=(L1*L1-L2*L2+D*D)/(2*D),hh=Math.sqrt(Math.max(0,L1*L1-a*a)),e=sc(d,1/D),pp=cross(s.n,e);
  const c1=add(add(s.T,sc(e,a)),sc(pp,hh)),c2=add(add(s.T,sc(e,a)),sc(pp,-hh)),W=norm(sub(c1,s.Wp))<norm(sub(c2,s.Wp))?c1:c2;
  out.push([s.U,{n:s.n,th:angleAbout(s.n,sub(s.Wp,s.T),sub(W,s.T)),pivot:s.T},[0,0,0]],[s.L,{n:s.n,th:angleAbout(s.n,sub(s.Kp,s.Wp),sub(K,W)),pivot:s.W0},sub(W,s.Wp)]);}return out;};
 const parts=new Map(M.bodies.filter(b=>b.motion==='dynamic').map(b=>[b.id,colliders(b)]));
 const JY=h=>{let J=0,Y=0;for(const [id,R,t] of pose(h))for(const c of parts.get(id)){let p=c.p,ax=c.axes;if(R){p=add(R.pivot,rodrigues(R.n,R.th,sub(p,R.pivot)));ax=ax.map(a=>rodrigues(R.n,R.th,a));}p=add(p,t);
  const rel=sub(p,axisP),rad=sub(rel,sc(up,dot(rel,up)));J+=c.m*dot(rad,rad)+c.I.reduce((s,Ii,i)=>s+Ii*dot(ax[i],up)**2,0);Y+=c.m*dot(p,up);}return{J,Y};};
 const g=norm(M.gravity),dh=1e-6;
 /** Spindle speed (deg/s) that holds the collar lifted h metres. */
 const omegaDeg=h=>{const a=JY(h-dh),b=JY(h+dh);return deg(Math.sqrt(2*g*(b.Y-a.Y)/(b.J-a.J)));};
 const masses=Object.fromEntries(['collar','upper_arm_pos','lower_arm_pos'].map(p=>[p,bodyOf(r,p).massKg]));
 return{sides:sides.map(({U,L,n,T,W0,K0,Wp,Kp,...x})=>x),masses,liftOffDps:omegaDeg(0),omegaDeg,collar,rotor,slide,up};
}
export function governorTrack(r,o=observeAddon(r),g=compiledGovernor(r)){
 const frames=program(r),spin=encoder(r,frames,'A'),p0=slidePoint(r,g),h=frames.map(f=>dot(sub(carried(r,o,f,g.collar,p0),carried(r,o,frames[0],g.collar,p0)),g.up)*1000);
 const L=R3_LAWS.governor,t=frames.map(f=>f.t/1000);
 const stage=s=>{const idx=frames.map((f,i)=>stageOf(f)===s?i:-1).filter(i=>i>=0);assert.ok(idx.length>=20,'stage '+s+' is recorded');const tail=idx.slice(Math.floor(idx.length*(1-L.tail)));
  const speedDps=Math.abs(spin.deg[tail.at(-1)]-spin.deg[tail[0]])/(t[tail.at(-1)]-t[tail[0]]),liftMm=mean(tail.map(i=>h[i]));
  return{stage:s,speedDps,liftMm,liftSpanMm:span(tail.map(i=>h[i])),predictedDps:g.omegaDeg(liftMm/1000)};};
 return{frames,h,stage,spin:spin.deg};
}
const slidePoint=(r,g)=>g.slide.point;
export function judgeGovernorLift(r,{native=false,contract}={}){
 const L=R3_LAWS.governor;healthy(r,native,contract?.expectedIssues);completed(r);
 const o=observeAddon(r),g=compiledGovernor(r),t=governorTrack(r,o,g);
 const plateaus=L.plateaus.map(t.stage),rests=L.rests.map(t.stage);
 for(const p of plateaus)p.speedError=(p.predictedDps-p.speedDps)/p.speedDps;
 const speedError=maxAbs(plateaus.map(p=>p.speedError)),restMm=maxAbs(rests.map(p=>p.liftMm)),byStage=Object.fromEntries(plateaus.map(p=>[p.stage,p]));
 const repeatMm=Math.max(Math.abs(byStage[5].liftMm-byStage[9].liftMm),Math.abs(byStage[5].liftMm-byStage[15].liftMm),Math.abs(byStage[3].liftMm-byStage[11].liftMm));
 const values={liftOffDps:g.liftOffDps,plateaus:plateaus.map(({stage,speedDps,liftMm,predictedDps,speedError})=>({stage,speedDps,liftMm,predictedDps,speedError})),speedError,restMm,repeatMm};
 check(g.sides.every(s=>Math.abs(s.upperMm-s.lowerMm)<=.01&&Math.abs(s.topOffsetMm-s.collarOffsetMm)<=.01),'compiled loaded governor: equal arms on equal hinge offsets',g.sides);
 check(rests.every(p=>p.speedDps<1)&&restMm<=L.restMm,'at rest gravity holds the collar on its stop',values);
 check(byStage[3].liftMm<byStage[5].liftMm&&byStage[5].liftMm<byStage[7].liftMm&&byStage[3].liftMm>L.restMm,'the collar rises with spindle speed',values);
 check(speedError<=L.speedTol,'each held speed is the speed the measured lift predicts (ω²(h) from the compiled masses)',values);
 check(repeatMm<=L.repeatMm,'the same speed gives the same lift rising, falling and after a restart',values);
 return{law:'loaded governor: ω²(h) = 2g·(dY/dh)/(dJ/dh) from the compiled hinges and collider masses',compiled:{sides:g.sides,masses:g.masses,liftOffDps:g.liftOffDps},...values,frames:t.frames.length,foundation:foundation(r,o)};
}
/**
 * Disconnection: without the two lower (collar) links the spindle still reaches every speed, but the collar is no
 * longer lifted. The law needs the collar lifted well above the compiled lift-off speed (16 mm at 800°/s, ±3 %); the
 * cut leaves it on its stop.
 */
export function governorDisconnectionLoss(r){
 const L=R3_LAWS.governor,frames=program(r),spin=encoder(r,frames,'A'),collar=bodyOf(r,'collar'),slide=r.mechanism.joints.find(j=>j.type==='slider'&&[j.body1,j.body2].includes(collar.id));
 assert.ok(slide,'the collar runs on a slider');const o=observeAddon(r),up=unit(sc(r.mechanism.gravity,-1)),t=frames.map(f=>f.t/1000);
 const h=frames.map(f=>dot(sub(carried(r,o,f,collar.id,slide.point),slide.point),up)*1000);
 const stage=s=>{const idx=frames.map((f,i)=>stageOf(f)===s?i:-1).filter(i=>i>=0),tail=idx.slice(Math.floor(idx.length*(1-L.tail)));
  return{speedDps:Math.abs(spin.deg[tail.at(-1)]-spin.deg[tail[0]])/(t[tail.at(-1)]-t[tail[0]]),liftMm:mean(tail.map(i=>h[i]))};};
 const fastest=stage(7);
 return{metric:'collarLiftAtFastestMm',value:fastest.liftMm,speedDps:fastest.speedDps,lost:fastest.speedDps>=L.cutMinDps&&fastest.liftMm<L.cutMaxLiftMm};
}

// ---------------------------------------------------------------- wankel-ratio-v1
/** Compiled Wankel train: tooth counts, axes and the rotor bearing's eccentricity. */
export function compiledWankel(r){
 const drive=r.mechanism.joints.find(j=>j.motor?.port==='A');assert.ok(drive,'motor A drives');
 const carrier=bodyOf(r,'turntable_top').id,rotor=bodyOf(r,'output_24t').id,frame=bodyOf(r,'sun_16t').id,idler=bodyOf(r,'idler_upper_8t').id;
 assert.equal(bodyOf(r,'idler_lower_8t').id,idler,'the 8T idlers turn together');
 const cj=jointBetween(r,carrier,frame,'hinge'),rj=jointBetween(r,carrier,rotor,'hinge'),ij=jointBetween(r,carrier,idler,'hinge'),n=unit(cj.axis);
 const radial=v=>sub(v,sc(n,dot(v,n))),eccMm=norm(radial(sub(rj.point,cj.point)))*1000;
 const carrierRatio=teeth(r,'drive_20t')/teeth(r,'turntable_top'),rotorRatio=1-teeth(r,'sun_16t')/teeth(r,'idler_lower_8t')*teeth(r,'idler_upper_8t')/teeth(r,'output_24t');
 return{carrierRatio,rotorRatio,eccMm,axisDeg:deg(Math.acos(Math.min(1,Math.abs(dot(unit(rj.axis),n))))),idlerOnCarrier:Boolean(ij),n,carrier,rotor,carrierPoint:cj.point,rotorPoint:rj.point,drive};
}
export function wankelTrack(r,o=observeAddon(r),g=compiledWankel(r)){
 const frames=program(r),enc=encoder(r,frames,'A'),motorUp=Math.sign(dot(unit(g.drive.axis),g.n));
 const carrier=turn(o,frames,'turntable_top',g.n),rotor=turn(o,frames,'output_24t',g.n),A=enc.deg.map(x=>x*motorUp);
 const c0=carried(r,o,frames[0],g.carrier,g.carrierPoint),r0=sub(carried(r,o,frames[0],g.rotor,g.rotorPoint),c0);
 const centreErrMm=frames.map((f,i)=>{const p=sub(carried(r,o,f,g.rotor,g.rotorPoint),carried(r,o,f,g.carrier,g.carrierPoint)),q=rodrigues(g.n,carrier[i]*Math.PI/180,r0);return norm(sub(p,q))*1000;});
 return{frames,A,carrier,rotor,centreErrMm};
}
export function judgeWankelRatio(r,{native=false,contract}={}){
 const L=R3_LAWS.wankel;healthy(r,native,contract?.expectedIssues);completed(r);
 const o=observeAddon(r),g=compiledWankel(r),t=wankelTrack(r,o,g);
 // An external mesh turns the carrier against the motor.
 const carrierErrorDeg=maxAbs(t.carrier.map((x,i)=>x+g.carrierRatio*t.A[i])),rotorErrorDeg=maxAbs(t.rotor.map((x,i)=>x-g.rotorRatio*t.carrier[i])),centreMm=Math.max(...t.centreErrMm);
 const carrierTurns=span(t.carrier)/360,rotorTurns=span(t.rotor)/360;
 const values={carrierErrorDeg,rotorErrorDeg,centreMm,carrierTurns,rotorTurns,encoderSpanDeg:span(t.A)};
 check(Math.abs(g.carrierRatio-20/28)<1e-9&&Math.abs(g.rotorRatio-1/3)<1e-9&&g.idlerOnCarrier,'compiled 20T:28T carrier drive and 16T:8T, 8T:24T rotor train (rotor = carrier/3)',g);
 check(g.eccMm>1&&g.axisDeg<=.01,'compiled rotor bearing parallel to the carrier axis at an eccentricity',g);
 check(Math.abs(carrierTurns-L.carrierTurns)<=.01,'three carrier turns out and back',values);
 check(carrierErrorDeg<=L.carrierDeg,'carrier = −(20/28)·motor A',values);
 check(rotorErrorDeg<=L.rotorDeg,'rotor = carrier/3, same direction',values);
 check(centreMm<=L.centreMm,'rotor centre runs on the compiled eccentric circle at the carrier angle',values);
 return{law:'Wankel: carrier = −(20/28)·A, rotor = carrier/3, rotor centre on the eccentric circle',compiled:{carrierRatio:g.carrierRatio,rotorRatio:g.rotorRatio,eccMm:g.eccMm},...values,frames:t.frames.length,foundation:foundation(r,o)};
}
/**
 * Disconnection: without the idler's upper 8T (the rotor's drive) the carrier still turns three times, but nothing
 * turns the rotor relative to it, so rotor = carrier/3 is lost. The ratio is the frozen law constant (the cut part's
 * teeth are gone from the compiled model).
 */
export function wankelDisconnectionLoss(r){
 const o=observeAddon(r),frames=program(r),n=unit(jointBetween(r,bodyOf(r,'turntable_top').id,bodyOf(r,'sun_16t').id,'hinge').axis);
 const carrier=turn(o,frames,'turntable_top',n),rotor=turn(o,frames,'output_24t',n),value=maxAbs(rotor.map((x,i)=>x-carrier[i]/3));
 return{metric:'rotorLawErrorDeg',value,carrierTurns:span(carrier)/360,rotorSpanDeg:span(rotor),lost:value>R3_LAWS.wankel.disconnectedDeg};
}

export function r3DisconnectionLoss(id,r){
 const f={'vesper-quickreturn':quickReturnDisconnectionLoss,'aster-governor':governorDisconnectionLoss,apex:wankelDisconnectionLoss}[id];
 assert.ok(f,'no R3 disconnection loss for '+id);return f(r);
}
