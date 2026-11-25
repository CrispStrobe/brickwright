// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {BoardImpl} from 'bw-board';
import {registerDCMotor} from 'bw-board/devices/dc-motor';
import {installCircuitCadBridge} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/bridge.js';
registerDCMotor();
test('Stop cuts power during preparation; an old acquisition cannot change a restarted run',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,cad:globalThis.__bwCad};
 globalThis.window=new EventTarget();globalThis.document=new EventTarget();document.hidden=false;
 const tasks=[];
 let closed=0,mechanicalSteps=0;
 window.MessageChannel=class {
  port1={close:()=>{closed++;}};
  port2={postMessage:()=>tasks.push(()=>this.port1.onmessage()),close:()=>{closed++;}};
 };
 const config={version:1,cadDocumentId:'fixture',enabled:true,drives:[{partId:'motor',jointId:'axle'}]};globalThis.localStorage={getItem:()=>JSON.stringify(config)};
 globalThis.__bwCad={editor:{session:{state:{document:{id:'fixture'}}}}};
 const runtime=new EventEmitter(),board=new BoardImpl(5);board.setNetlist([{id:'motor',kind:'dc_motor',terminals:['a','b'],params:{}}],[]);board.setPower(true);runtime.circuitBoard=board;runtime.currentStepTime=1000/30;runtime._step=()=>{};
 let resolveFirst,acquired=0,oldReleased=false,flags=0;
 const frame={time:0,poses:[],angles:{axle:0},speeds:{axle:0},linearPositions:{},linearSpeeds:{}};
 const lease=()=>({snapshot:()=>structuredClone(frame),async step(){mechanicalSteps++;return structuredClone(frame);},release(){}});
 runtime.cadSimulation={reset(){},acquireExternalClock(){acquired++;return acquired===1?new Promise(r=>{resolveFirst=r;}):Promise.resolve(lease());}};
 const vm={runtime,stopAll(){runtime.emit('PROJECT_STOP_ALL');},greenFlag(){flags++;vm.stopAll();runtime.emit('PROJECT_START');}};
 window.addEventListener('bw-circuit-clock-owner',e=>e.detail.ready?.());const cleanup=installCircuitCadBridge(vm);
 try{
  const cancelled=runtime.cadCircuitSimulation.start();for(let i=0;i<20&&!resolveFirst;i++)await Promise.resolve();assert.equal(acquired,1);
  runtime.cadCircuitSimulation.stop();assert.equal(board.powered,false);
  await runtime.cadCircuitSimulation.start();assert.equal(runtime.cadCircuitSimulation.state().phase,'running');assert.equal(board.powered,true);
  resolveFirst({...lease(),release(){oldReleased=true;}});await cancelled;
  assert.equal(oldReleased,true);assert.equal(runtime.cadCircuitSimulation.state().phase,'running');assert.equal(board.powered,true);assert.equal(flags,1);assert.ok(runtime.bwProgramClock);
  runtime._step();
  assert.equal(tasks.length,1,'physics flush yields to a browser task');
  runtime.cadCircuitSimulation.stop();assert.equal(board.powered,false);assert.equal(runtime.bwProgramClock,undefined);
  tasks.shift()();
  await Promise.resolve();
  assert.equal(mechanicalSteps,0,'a posted flush cannot advance a stopped simulation');
 }finally{cleanup();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.localStorage=previous.localStorage;globalThis.__bwCad=previous.cad;}
 assert.equal(closed,2,'bridge disposal closes both ports');
});
