// SPDX-License-Identifier: BSD-3-Clause
// Real compiled AVR + real circuit + real qualified CAD physics. No GUI or mock motor.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {BoardImpl} from 'bw-board';
import {registerAllDevices} from 'bw-board/register-all';
import {createAvr8jsAdapter} from 'bw-board/avr8js-adapter.js';
import {parseIntelHex} from 'bw-board/intel-hex.js';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {createCoupledSession} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
const cad=process.argv[2];if(!cad)throw new Error('Usage: node scripts/qualify-circuit-cad.mjs <built-cad-checkout> [compiler-response.json]');
const load=relative=>import(pathToFileURL(resolve(cad,relative)).href);
const [{createGeometryKernel},{createPhysicsWorld,prepareDocumentCollisions}]=await Promise.all([load('packages/geometry/dist/index.js'),load('packages/physics/dist/index.js')]);
const zip=await JSZip.loadAsync(await readFile(new URL('../overlay/scratch-gui/static/circuit-cad/scout-encoder.sb3',import.meta.url))),project=JSON.parse(await zip.file('project.json').async('text')),doc=JSON.parse(await zip.file('brickwright/cad.json').async('text')),state=JSON.parse(await zip.file('brickwright/state.json').async('text')).state,source=JSON.stringify(doc),code=new SB3Creator().generateC(project,{debug:true});
let compiled;if(process.argv[3])compiled=JSON.parse(await readFile(process.argv[3],'utf8'));else{const response=await fetch('https://stc-compiler.vercel.app/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,language:'c',target:'atmega328p',format:'ihx',symbols:true}),signal:AbortSignal.timeout(60000)});compiled=await response.json();}
assert.equal(compiled.success,true,JSON.stringify(compiled.errors || compiled.error));
registerAllDevices();const circuit=state.circuit,groups=new Map();for(const wire of circuit.wires){if(!groups.has(wire.netId))groups.set(wire.netId,new Map());for(const t of[wire.from,wire.to])groups.get(wire.netId).set(t.part+':'+t.terminal,t);}
const board=new BoardImpl(circuit.vcc);board.setNetlist(circuit.parts,[...groups].map(([id,terminals])=>({id,terminals:[...terminals.values()]})));board.setPower(true);
const kernel=await createGeometryKernel({wasmBinary:await readFile(resolve(cad,'node_modules/manifold-3d/manifold.wasm'))}),geometry=kernel.evaluate(doc),prepared=await prepareDocumentCollisions(doc,geometry,kernel),world=await createPhysicsWorld(doc,geometry,prepared);
const ids=doc.joints.filter(j=>j.kind==='hinge').map(j=>j.id),previous=Object.fromEntries(ids.map(id=>[id,world.hingeAngle(id)]));let frame={time:0,poses:[],angles:Object.fromEntries(ids.map(id=>[id,0])),speeds:Object.fromEntries(ids.map(id=>[id,0])),linearPositions:{},linearSpeeds:{}};
let steps=0,peakCurrentA=0,peakEncoder=0,peakStepMs=0;
const mechanics={snapshot:()=>structuredClone(frame),release(){},async step(impulses){const started=performance.now();for(const drive of impulses)world.applyJointImpulse(drive.id,drive.impulse);world.step(.005);peakStepMs=Math.max(peakStepMs,performance.now()-started);steps++;for(const id of ids){const angle=world.hingeAngle(id),delta=Math.atan2(Math.sin(angle-previous[id]),Math.cos(angle-previous[id]));frame.angles[id]+=delta*180/Math.PI;frame.speeds[id]=delta*180/Math.PI/.005;previous[id]=angle;}frame.time=world.time;frame.poses=doc.roots.map(id=>({id,...world.pose(id)}));assert.equal(world.separatedHingePairCount,2,'electrically loaded hinges must retain their qualified alignment bounds');return structuredClone(frame);}};
const firmware=createAvr8jsAdapter({program:parseIntelHex(Buffer.from(compiled.base64,'base64').toString('utf8')),clockHz:compiled.f_cpu || 16000000});firmware.attachBoard(board);
const session=await createCoupledSession({board,mechanics,connections:state.cadCircuit,firmware}),started=performance.now();const phases=[];
try{
 for(let i=0;i<500;i++){session.tick(5);await session.idle();peakEncoder=Math.max(peakEncoder,board.getDeviceState('left').count);for(const r of session.readings())peakCurrentA=Math.max(peakCurrentA,Math.abs(r.currentA));if(i%100===99){const pose=world.pose('chassis'),q=pose.quaternion;phases.push({time:world.time,positionMm:pose.positionMm,yawDegrees:Math.atan2(2*(q[3]*q[2]+q[0]*q[1]),1-2*(q[1]**2+q[2]**2))*180/Math.PI,encoder:board.getDeviceState('left').count,pins:board.getPinStates()});console.log('phase',phases.at(-1).time,phases.at(-1).positionMm,phases.at(-1).yawDegrees);}}
 const last=phases.at(-1);assert.ok(Math.hypot(...last.positionMm)>50);assert.ok(Math.abs(last.yawDegrees)>5);assert.ok(peakEncoder>=8);assert.equal(board.readPin('D5'),0,'firmware disabled left motor after its encoder/turn program');assert.equal(board.readPin('D6'),0);assert.equal(JSON.stringify(doc),source);session.stop();assert.equal(board.powered,false);
 const report={passed:true,steps,stepHz:200,sourceUnchanged:true,sourceSha256:createHash('sha256').update(source).digest('hex'),cSha256:createHash('sha256').update(code).digest('hex'),firmwareBytes:compiled.bytes,wallMs:performance.now()-started,peakStepMs,peakCurrentA,peakEncoder,separatedHingePairs:world.separatedHingePairCount,phases};await mkdir('artifacts/circuit-cad',{recursive:true});await writeFile('artifacts/circuit-cad/physical-qualification.json',JSON.stringify(report,null,2));console.log('PASS real AVR, electrical torque, encoder stop, physical turn and source preservation');
}finally{session.stop();world.dispose();}
