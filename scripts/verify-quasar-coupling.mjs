// SPDX-License-Identifier: BSD-3-Clause
// Real packaged circuit + CAD mechanics; explicit stage commands (VM proof is separate).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import JSZip from 'jszip';import{BoardImpl,registerAllDevices}from'bw-board';import{createCoupledSession}from'../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const cadRoot=resolve(process.argv[2]||'../brickwright-cad');
const {createGeometryKernel}=await import(pathToFileURL(resolve(cadRoot,'packages/geometry/dist/index.js')));
const {prepareDocumentCollisions,createPhysicsWorld}=await import(pathToFileURL(resolve(cadRoot,'packages/physics/dist/index.js')));
registerAllDevices();const name=process.env.ROBOT||'quasar',z=await JSZip.loadAsync(await readFile('overlay/scratch-gui/static/cad-robots/'+name+'.sb3')),doc=JSON.parse(await z.file('brickwright/cad.json').async('text')),s=JSON.parse(await z.file('brickwright/state.json').async('text')).state;

const parents=new Map,ends=new Map,key=e=>e.part+':'+e.terminal,root=k=>{if(!parents.has(k))parents.set(k,k);if(parents.get(k)!==k)parents.set(k,root(parents.get(k)));return parents.get(k);};for(const wire of s.circuit.wires){const a=key(wire.from),b=key(wire.to);ends.set(a,wire.from);ends.set(b,wire.to);parents.set(root(a),root(b));}const groups=new Map;for(const[k,e]of ends){const r=root(k);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(e);}const board=new BoardImpl(5);board.setNetlist(s.circuit.parts,[...groups].map(([id,terminals])=>({id,terminals})));board.setPower(true);
const kernel=await createGeometryKernel({wasmBinary:await readFile(resolve(cadRoot,'node_modules/manifold-3d/manifold.wasm'))}),geometry=kernel.evaluate(doc),prepared=await prepareDocumentCollisions(doc,geometry,kernel);const world=await createPhysicsWorld(doc,geometry,prepared);let last={},frame;
const measure=()=>{const next={time:world.time,angles:{},speeds:{},linearPositions:{},linearSpeeds:{}};for(const j of doc.joints){if(j.kind==='hinge'){const a=world.hingeAngle(j.id)*180/Math.PI,delta=last[j.id]===undefined?0:((a-last[j.id]+180)%360+360)%360-180;next.angles[j.id]=(frame?.angles[j.id]||0)+delta;next.speeds[j.id]=delta/.005;last[j.id]=a;}if(j.kind==='slider'){const p=world.sliderPosition(j.id);next.linearPositions[j.id]=p;next.linearSpeeds[j.id]=frame?(p-frame.linearPositions[j.id])/.005:0;}}return frame=next;};measure();
let physicsMs=0,boardMs=0,steps=0;const advance=board.advanceTo.bind(board);board.advanceTo=(...args)=>{const t=performance.now();try{return advance(...args);}finally{boardMs+=performance.now()-t;}};
const step=async(impulses,rays,servos)=>{for(const i of impulses)world.applyJointImpulse(i.id,i.impulse);for(const a of servos)if(a.enabled)world.setHingeServo(a.id,a.angleRad,a.torqueNm);const t=performance.now();world.step(.005);physicsMs+=performance.now()-t;steps++;return measure();};const session=await createCoupledSession({board,connections:s.cadCircuit,mechanics:{snapshot:()=>frame,step,stepTelemetry:step,release(){}}});const command=(id,direction,speed)=>{board.setDeviceControl(id,'direction',direction);board.setDeviceControl(id,'speed',speed);};
command('motorB','forward',25);command('motorC','forward',0);
const samples=[];let phase='';
const center=()=>{const p=world.pose('blank'),[x,y,z,w]=p.quaternion,[a,b,c]=[0,-20,46.2],u=2*(y*c-z*b),v=2*(z*a-x*c),t=2*(x*b-y*a);return[a+w*u+y*t-z*v+p.positionMm[0],b+w*v+z*u-x*t+p.positionMm[1],c+w*t+x*v-y*u+p.positionMm[2]];};
const started=performance.now();try{
for(let i=0;i<2000;i++){
 const seconds=i*.005;
 board.setDeviceControl('servoA','angle',90+Math.min(90,Math.max(0,(seconds-.5)*50)));
 const next=seconds<2.8?'index':seconds<3.8?'press':seconds<4.8?'retract':seconds<6.8?'eject':seconds<8.8?'return':'manual';
 if(next!==phase){if(phase)samples.push({phase,time:seconds,frame,blank:center()});phase=next;
 command('motorB',phase==='press'?'reverse':'forward',phase==='press'?5:25);
 command('motorC',phase==='return'?'reverse':'forward',phase==='eject'||phase==='return'?10:0);
 }
 session.tick(5);await session.idle();
}
samples.push({phase,time:world.time,frame,blank:center()});
const byPhase=Object.fromEntries(samples.map(s=>[s.phase,s]));
assert.ok(byPhase.index.blank[0]>12&&Math.abs(byPhase.index.blank[1])<8);
assert.ok(byPhase.press.frame.linearPositions['ram-b']<-3&&byPhase.press.frame.linearPositions['ram-b']>-6);
assert.ok(byPhase.retract.frame.linearPositions['ram-b']>3);
assert.ok(byPhase.eject.frame.linearPositions['eject-c']>60);
assert.ok(byPhase.eject.blank[0]>25&&byPhase.eject.blank[2]>5&&byPhase.eject.blank[2]<20);
assert.ok(Math.abs(byPhase.return.frame.linearPositions['eject-c'])<1);
for(const s of samples)assert.ok(s.blank.every(v=>Number.isFinite(v)&&Math.abs(v)<300));
console.log(JSON.stringify({totalMs:performance.now()-started,boardMs,physicsMs,samples}));
}catch(e){console.error('FAIL',e.message,frame);process.exitCode=1;}finally{session.stop();world.dispose();}
