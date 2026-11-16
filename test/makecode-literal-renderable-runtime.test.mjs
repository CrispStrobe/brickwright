import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
const palette=['#000000','#ffffff','#ff2121','#ff93c4','#ff8135','#fff609','#249ca3','#78dc52','#003fad','#87f2ff','#8e2ec4','#a4839f','#5c406c','#e5cdc4','#91463d','#000000'];
const unpack=v=>'#'+[v&255,(v>>>8)&255,(v>>>16)&255].map(b=>b.toString(16).padStart(2,'0')).join('');
const source=`scene.setBackgroundColor(9)
let low=sprites.create(img\`22\n22\`,SpriteKind.Player);low.setPosition(10,10);low.z=-1
let before=sprites.create(img\`33\n33\`,SpriteKind.Player);before.setPosition(20,20)
scene.createRenderable(0,function(target,camera){target.fillRect(4,4,32,32,7);target.drawRect(6,6,28,28,15);target.drawLine(0,119,159,0,6)})
let after=sprites.create(img\`44\n44\`,SpriteKind.Player);after.setPosition(30,30)
pause(100);let done=1;done+=0`;
async function owner(run){const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default;const native=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;assert.strictEqual(native._runtime,run.vm.runtime);return native;}
const frame=run=>run.vm.runtime.bwArcadeDeviceState.sceneFrame;
test('depth0 literal drawing matches all19200 PXT pixels, exact z/id order, Code and fresh SB3 without added yield',async()=>{
 const original=await runPxtArcade(source,{fakeClock:true,inspectDisplay:true,waitForDisplay:true,waitForGlobals:{done:1}}),expected=original.$display.screen.map(unpack);const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);const observations=[];
 const check=async(run,restart=true)=>{
  const native=await owner(run),runtime=run.vm.runtime,primitive=runtime._primitives.arcade_addLiteralDrawing;
  runtime._primitives.arcade_addLiteralDrawing=(args,util)=>{const state=native._state(),id=state.nextSpriteId,status=util.thread.status,clock=runtime.currentMSecs,originalYield=util.yield;let yields=0;util.yield=function(...a){yields++;return originalYield.apply(this,a)};let result;try{result=primitive(args,util)}finally{util.yield=originalYield}assert.ok(!result?.then);assert.equal(yields,0);assert.equal(util.thread.status,status);assert.equal(runtime.currentMSecs,clock);assert.equal(state.nextSpriteId,id+1);const added=native._renderablesOf(state).filter(r=>r.id===id&&r.z===0);assert.equal(added.length,1);observations.push({id,z:added[0].z,yields});return result;};
  if(restart){run.vm.stopAll();run.vm.greenFlag();}await stepFrames(run.vm,10);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);const actual=[...frame(run).pixels];assert.equal(actual.length,19200);assert.deepEqual(actual.map(i=>palette[i]),expected);assert.equal(actual[6*160+6],15,'black border keeps palette index15');assert.equal(actual[119*160],6,'line endpoint');assert.equal(actual[10*160+10],7,'z-1 Sprite is below drawing');assert.equal(actual[20*160+20],7,'earlier same-z Sprite is below drawing');assert.equal(actual[30*160+30],4,'later same-z Sprite remains above drawing');runtime._primitives.arcade_addLiteralDrawing=primitive;return native;
 };
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,uploads:out.costumes,countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,uploads:out.costumes,countExtensionCalls:false}));
  const bytes=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(bytes);const native=await check(fresh);assert.equal(observations.length,3);
  const primitive=fresh.vm.runtime._primitives.arcade_addLiteralDrawing,state=native._state(),id=state.nextSpriteId,count=native._renderablesOf(state).length,errors=fresh.errors.length;
  const invalid=['not json','null','{}','[["fillRect",0,0,161,1,1]]','[["drawRect",0,0,1,1,16]]','[["drawLine",-1,0,1,1,1]]','[["fillRect",0.5,0,1,1,1]]',JSON.stringify(Array(33).fill(['fillRect',0,0,1,1,1])),5];
  for(const commands of invalid)primitive({COMMANDS:commands},{});assert.equal(state.nextSpriteId,id);assert.equal(native._renderablesOf(state).length,count);assert.equal(fresh.errors.length,errors+invalid.length);
 }finally{quitStrandedVMs()}
});
test('literal drawing is scene-owned and Stop/restart retains a fresh root and no leaked child drawing',async()=>{
 const s='scene.setBackgroundColor(9);scene.createRenderable(0,function(t,c){t.fillRect(0,0,160,120,7)});pause(30);game.pushScene();scene.setBackgroundColor(1);scene.createRenderable(0,function(t,c){t.fillRect(0,0,160,120,6)});pause(30);game.popScene();pause(30);let done=1;done+=0';
 const original=await runPxtArcade(s,{fakeClock:true,inspectDisplay:true,waitForDisplay:true,waitForGlobals:{done:1}});assert.ok(original.$display.screen.every(v=>unpack(v)===palette[7]));const out=arcadeToPseudocode(s);assert.deepEqual(out.unsupported,[]);
 try{const run=await runProgram(out.code,{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false}),native=await owner(run),records=[],add=native._addSceneRenderable;native._addSceneRenderable=function(state,r){if(r.z===0)records.push({state,r});return add.call(this,state,r)};let previous;
  for(let attempt=0;attempt<2;attempt++){records.length=0;run.vm.stopAll();const clock=createArcadeDiscreteTimers();run.vm.runtime.bwArcadeProgramClock=clock;run.vm.runtime.updateCurrentMSecs=()=>{run.vm.runtime.currentMSecs=clock.now()};run.vm.greenFlag();await stepFrames(run.vm,1,0);await clock.advanceTo(120);assert.deepEqual(run.errors,[]);assert.equal(records.length,2);assert.notEqual(records[0].state,records[1].state);assert.strictEqual(native._state(),records[0].state);assert.equal(native._renderablesOf(native._state()).filter(r=>r.z===0).length,1);assert.ok(frame(run).pixels.every(v=>v===7));if(previous)assert.notEqual(native._state(),previous);previous=native._state();}
  native._addSceneRenderable=add;
 }finally{quitStrandedVMs()}
});
