import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {setEngine} from 'bw-circuit-ui/engine.js';
import {Circuit} from 'bw-circuit-ui/model/circuit.js';
import {BoardImpl} from 'bw-board/board.js';
import {inferNetlist,checkWiring} from 'bw-board/infer-netlist.js';
import {registerAllDevices} from 'bw-board/register-all.js';
import {getDevice} from 'bw-board/devices.js';
registerAllDevices();setEngine({BoardImpl,inferNetlist,checkWiring,getDevice});
const examples=path.resolve(import.meta.dirname,'../overlay/scratch-gui/examples');
const load=id=>Circuit.fromJSON(JSON.parse(fs.readFileSync(path.join(examples,id,'circuit.json'))));
const byLabel=(c,label)=>{const p=c.parts.find(p=>p.label===label);assert.ok(p,label);return p;};
const net=(c,label,terminal)=>c.board.getNets().find(n=>n.terminals.some(t=>t.part===byLabel(c,label).id&&t.terminal===terminal))?.id;
const connected=(c,a,b)=>{const [p,t]=a.split('.'),[q,u]=b.split('.');assert.equal(net(c,p,t),net(c,q,u),`${a} and ${b}`);assert.ok(net(c,p,t));};
const current=(c,label)=>Math.abs(c.board.branchCurrent(byLabel(c,label).id,'a'));

test('all school projects retain parts, wires and labels after two save/load cycles',()=>{
 for(const id of ['school-miniorgan-107056','school-intercom-101455','school-led-people-dog']){
  const c=load(id),first=c.toJSON(),second=Circuit.fromJSON(first).toJSON();
  assert.deepEqual(second,first,id);
  assert.equal(c.parts.some(p=>p.kind==='mcu'),false);
 }
});

test('organ preserves the complementary feedback topology and all eight rheostat keys',()=>{
 const c=load('school-miniorgan-107056');assert.equal(c.vcc,9);
 assert.deepEqual(byLabel(c,'VCC').params.points,[[0,0],[.00001,9]]);
 assert.equal(c.parts.filter(p=>p.kind==='button').length,8);
 assert.equal(byLabel(c,'R1-180k').params.ohms,180000);
 assert.equal(byLabel(c,'C1-3n3').params.farads,3.3e-9);
 assert.equal(byLabel(c,'C2-10n').params.farads,10e-9);
 connected(c,'BC548.collector','BC558.base');connected(c,'BC558.collector','C2-10n.a');
 connected(c,'BC548.base','C2-10n.b');connected(c,'BC558.emitter','VCC.pos');
 for(let k=1;k<=8;k++){
  assert.equal(byLabel(c,'Trim'+k).params.ohms,1000000);
  connected(c,'Trim'+k+'.wiper','R1-180k.b');connected(c,'Trim'+k+'.b','Key'+k+'.a');
  connected(c,'Key'+k+'.b','VCC.pos');assert.equal(net(c,'Trim'+k,'a'),undefined);
 }
});

test('intercom retains amplifier values and cross-connects both switch poles',()=>{
 const c=load('school-intercom-101455');
 assert.equal(c.parts.filter(p=>p.kind==='npn').length,3);
 assert.deepEqual(Array.from({length:11},(_,i)=>byLabel(c,'R'+(i+1)).params.ohms),[10000,10000,4700,1000000,1000000,1000,100000,47000,100,10,47000]);
 assert.deepEqual(Array.from({length:7},(_,i)=>byLabel(c,'C'+(i+1)).params.farads),[10e-9,1e-6,4.7e-6,4.7e-6,4.7e-6,10e-6,47e-6]);
 connected(c,'DPDT-A.a','DPDT-B.b');connected(c,'DPDT-A.a','C2.a');
 connected(c,'DPDT-A.b','DPDT-B.a');connected(c,'DPDT-A.b','BC337-T3.emitter');
 for(const station of ['A','B']){
  assert.equal(byLabel(c,'Speaker-'+station+'-8ohm').params.ohms,8);
  connected(c,'DPDT-'+station+'.com','Speaker-'+station+'-8ohm.a');
 }
});

test('AA people/dog split currents at the shared arm and parallel legs',()=>{
 const c=load('school-led-people-dog');c.advanceTo(25_000_000n);
 assert.equal(c.parts.filter(p=>p.kind==='resistor').length,15);
 assert.equal(byLabel(c,'R5').params.ohms,470);
 assert.ok(Math.abs(current(c,'R9')-current(c,'R8')-current(c,'R10'))<1e-9);
 assert.ok(Math.abs(current(c,'R1')-current(c,'R2'))<1e-9);
 assert.ok(Math.abs(current(c,'R13')-current(c,'R11')-current(c,'R12'))<1e-9);
 assert.ok(Math.abs(current(c,'R14')-current(c,'R15'))<1e-9);
 // bw-board round 3 (a685b22) solves LEDs on the exponential junction: the
 // class default n = 1.8 and series rs = 10 Ω (parts-library classDefaults),
 // with Is chosen so the total drop is the LED's vf at its rated 20 mA. The
 // old knee model (1.8 V threshold + 10 Ω) is replaced by an independent
 // solve of that law. The +10 Ω in the denominators below is that rs.
 const vt=0.02585,nVt=1.8*vt,rs=10;
 const isOf=vf=>0.02/(Math.exp((vf-0.02*rs)/nVt)-1);
 const vj=(i,vf)=>nVt*Math.log(i/isOf(vf)+1);
 // Current through LED(vf) in series with R (rs included) driven by V.
 const led=(V,R,vf)=>{let lo=0,hi=V/R;for(let k=0;k<200;k++){const m=(lo+hi)/2;(m*(R+rs)+vj(m,vf)>V)?hi=m:lo=m;}return (lo+hi)/2;};
 assert.ok(Math.abs(current(c,'R5')-led(4.5,470+220+110,2))<1e-7);
 // The shared node ux balances 4.5 V through 220 Ω against two LED legs.
 let lo=0,hi=4.5;for(let k=0;k<200;k++){const ux=(lo+hi)/2;((4.5-ux)/220>led(ux,330,2)+led(ux,302.5,2.1))?lo=ux:hi=ux;}
 const ux=(lo+hi)/2;
 assert.ok(Math.abs(current(c,'R8')-led(ux,330,2))<1e-7);
 assert.ok(Math.abs(current(c,'R10')-led(ux,302.5,2.1))<1e-7);
});

test('open outside arm has zero measured current (requires supplier PR662)',()=>{
 const c=load('school-led-people-dog');c.advanceTo(25_000_000n);
 assert.ok(current(c,'R4')<1e-12,`open arm reported ${current(c,'R4')} A`);
});


test('open dog tail has zero current (requires supplier PR663)',()=>{
 const c=load('school-led-people-dog');c.advanceTo(25_000_000n);
 assert.ok(Math.abs(c.board.branchCurrent(byLabel(c,'Tail').id,'anode'))<1e-12);
});

test('organ key produces repeating pulses with healthy accepted transient history',()=>{
 const c=load('school-miniorgan-107056');c.setControl(byLabel(c,'Key1').id,1);
 const h=c.board.addScopeChannel({type:'voltage',netId:net(c,'LS-8ohm','a'),sampleRateHz:100000,depth:4096});
 c.advanceTo(25_000_000n);assert.equal(c.board.transientAnalysisStatus().accuracyMet,true);
 const d=c.board.getScopeData(h),depth=d.samples.length/2,count=Math.min(d.count,depth),oldest=(d.writeIndex-count+depth)%depth;
 const edges=[];let previous=0;
 for(let i=0;i<count;i++){
  const value=d.samples[((oldest+i)%depth)*2+1],time=Number(d.startTNs)/1e9+i*Number(d.sampleIntervalNs)/1e9;
  if(time>.004&&previous<4&&value>=4)edges.push(time);previous=value;
 }
 assert.ok(edges.length>=4);const hz=(edges.length-1)/(edges.at(-1)-edges[0]);
 assert.ok(Math.abs(hz-261.3)<2,`${hz} Hz`);
 for(let i=1;i<=8;i++)assert.ok(Math.abs(c.board.branchCurrent(byLabel(c,'Trim'+i).id,'a'))<1e-12);
});


test('released gallery organ key stops sustained pulses after stored charge settles',()=>{
 const c=load('school-miniorgan-107056');c.setControl(byLabel(c,'Key1').id,1);
 const h=c.board.addScopeChannel({type:'voltage',netId:net(c,'LS-8ohm','a'),sampleRateHz:100000,depth:4096});
 c.advanceTo(20_000_000n);c.setControl(byLabel(c,'Key1').id,0);
 for(let ms=25;ms<=80;ms+=5)c.advanceTo(BigInt(ms)*1_000_000n);
 assert.equal(c.board.transientAnalysisStatus().accuracyMet,true);
 const d=c.board.getScopeData(h);assert.ok(d.count>=1000);
 const peaks=Array.from(d.samples).filter((v,i)=>i%2&&Number.isFinite(v));
 assert.ok(peaks.length>=1000);assert.ok(Math.max(...peaks)<4);
});
