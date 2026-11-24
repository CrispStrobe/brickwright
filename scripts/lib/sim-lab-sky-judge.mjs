// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Rope geometry is carried by actual body poses; no analytical pose drives the model.
import assert from 'node:assert/strict';
import {observeAddon} from './sim-lab-addon-judge.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a));
const mul=([x,y,z,w],[a,b,c,d])=>[w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c],conj=([x,y,z,w])=>[-x,-y,-z,w];
const rot=(q,v)=>mul(mul(q,[...v,0]),conj(q)).slice(0,3),span=a=>Math.max(...a)-Math.min(...a);
export function measureSky(r){
 const o=observeAddon(r),base=o.base,ropes=r.mechanism.couplings.filter(c=>c.kind==='rope');assert.equal(ropes.length,2);
 const axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>unit(sub(o.initial('hub',v),o.initial('hub'))));
 const point=(poses,p)=>add(poses[p.body].position,rot(poses[p.body].rotation,p.local));
 const initial=Object.fromEntries(r.mechanism.bodies.map(b=>[b.id,b])),origin=point(initial,ropes[0].hook);
 return r.track.map(f=>{
  const hook=point(f.bodies,ropes[0].hook),local=add(base.position,rot(base.rotation,rot(conj(f.bodies[base.id].rotation),sub(hook,f.bodies[base.id].position))));
  const tie=axes.map(axis=>dot(sub(local,origin),axis)*1000);
  const state=ropes.map((c,i)=>{
   const ps=c.points.map(p=>point(f.bodies,p)),fixed=ps.slice(1).reduce((s,p,k)=>s+norm(sub(p,ps[k])),0);
   const law=c.lengthM-c.radiusM*c.drumSign*f.joints[c.drumJoint].angle-fixed;
   const actual=f.extra?.ropes?.[i],free=actual?.free??law,measured=norm(sub(ps.at(-1),point(f.bodies,c.hook)));
   return {freeMm:free*1000,extensionMm:(measured-free)*1000,slackMm:(free-measured)*1000,lawErrorMm:Math.abs(free-law)*1000,tension:actual?.tension};
  });
  return {t:f.t,stage:String(f.extra?.variables?.stage),tie,ropes:state,gap:o.gap(f),axis:o.axisGap(f),tilt:o.tilt(f),baseTravel:norm(sub(f.bodies[base.id].position,r.track[0].bodies[base.id].position))*1000};
 });
}
export function judgeSky(r,{native=false}={}){
 assert.deepEqual(r.issues,[]);assert.ok(r.finishedAt>0&&r.finishedAt<180000,'Sky: finite VM program');
 assert.equal(r.mechanism.actuators.length,2);assert.equal(r.mechanism.joints.length,4);
 assert.equal(r.mechanism.bodies.filter(b=>b.motion==='dynamic').length,6);
 const rows=measureSky(r),all=rows.flatMap(s=>s.ropes),max=(list,key)=>Math.max(...list.map(s=>s[key]));
 assert.ok(rows.length>=2000);assert.ok(span(rows.map(s=>s.tie[0]))>=30&&span(rows.map(s=>s.tie[1]))>=18);
 assert.ok(max(all,'extensionMm')<=.5,'Sky: every sampled rope extension');assert.ok(max(all,'lawErrorMm')<=.1);
 assert.ok(Math.min(...all.map(s=>s.freeMm))>=80);assert.ok(Math.max(...rows.map(s=>Math.abs(s.tie[2])))<=2);
 const peak=key=>{const row=rows.reduce((a,b)=>b[key]>a[key]?b:a);return {value:row[key],stage:row.stage,time:row.t};};
 const bounds=Object.fromEntries(['gap','axis','tilt','baseTravel'].map(key=>[key,peak(key)]));
 // baseTravel 2 -> 2.5 mm on 2026-11-24, re-measured. The frame does not jump: it creeps along z at
 // ~0.08 mm/s while one winch runs (left:move, right:move) and creeps back on the return, the
 // motor-reaction walk the resting-creep notes describe. Its peak was 1.925 mm (left:settle) when
 // the 2 mm bound was set; 155ef476d (2026-11-15) correctly replaced 64179's solid-window collider
 // with four rails, which changes the two payload frames' mass distribution, and the same program
 // now peaks at 2.356 mm (bit-identical locally and on CI run 45318622606). Restoring only the old
 // 64179 colliders brings back 1.925; its connectors are not involved. Tilt, gap and axis are unchanged.
 assert.ok(max(rows,'gap')<=.5&&max(rows,'axis')<=1&&max(rows,'tilt')<=1&&max(rows,'baseTravel')<=2.5,`Sky: hinge closure and freestanding frame: ${JSON.stringify(bounds)}`);
 const settled={};
 for(const [stage,target]of Object.entries({top:[0,-24,0],left:[-20,-12,0],right:[20,-12,0],home:[0,0,0]})){
  const samples=rows.filter(s=>s.stage===stage+':settle');assert.ok(samples.length);const end=samples.at(-1).t,window=samples.filter(s=>s.t>=end-500-1e-6);
  assert.ok(window.length>=15,'Sky: full final settled window');
  const error=Math.max(...window.map(s=>norm(sub(s.tie,target))));assert.ok(error<=1,`Sky ${stage}: actual target ${error} mm`);
  assert.ok(Math.max(...window.flatMap(a=>window.map(b=>norm(sub(a.tie,b.tie)))))<=.5,'Sky: settled excursion');
  assert.ok(Math.max(...window.map(s=>Math.abs(s.tie[2])))<=1);
  const cables=window.flatMap(s=>s.ropes);assert.ok(max(cables,'slackMm')<=.5);
  const tensions=cables.map(s=>s.tension);
  if(native)assert.ok(tensions.every(t=>Number.isFinite(t)&&t>=.001),`Sky ${stage}: every settled cable tension >= .001 N`);
  settled[stage]={samples:window.length,targetErrorMm:error,...(native?{minimumTensionN:Math.min(...tensions)}:{})};
 }
 assert.ok(norm(rows.at(-1).tie)<=1,'Sky: returns home');
 const final=r.track.at(-1).extra?.variables;assert.equal(Number(final.done),1);assert.equal(Number(final.fault),0);
 return {settled,maximumExtensionMm:max(all,'extensionMm'),nativeForceObserved:native};
}
