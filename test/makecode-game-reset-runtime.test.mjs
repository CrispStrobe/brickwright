import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
async function owner(run){const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default;return dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;}
async function timed(source){const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false,frameAuthority:'timed'});run.vm.stopAll();const clock=createArcadeDiscreteTimers();run.vm.runtime.bwArcadeProgramClock=clock;run.vm.runtime.updateCurrentMSecs=()=>{run.vm.runtime.currentMSecs=clock.now()};return {run,clock,native:await owner(run)};}
async function advance(run,clock,target){await clock.advanceTo(target);await stepFrames(run.vm,4,0);}
const suspended=`let before=0
let innerAfter=0
let outerAfter=0
let callerAfter=0
let independent=0
function inner(){pause(1);game.reset();innerAfter=1}
function outer(){inner();outerAfter=1}
controller.A.onEvent(ControllerButtonEvent.Pressed,function(){before=1;outer();callerAfter=1})
control.runInParallel(function(){pause(100);independent=7})
let ready=1
ready+=0`;
test('actual original reset posts once and never resumes nested callers; held native matches and Stop invalidates its promise',async()=>{
 const original=await runPxtArcade(suspended,{observeControlReset:true,fakeClock:true,waitForGlobals:{independent:7},buttonActions:{afterGlobals:{ready:1},steps:[{button:5,held:true,waitForGlobals:{before:1}},{delay:200,button:5,held:false}]}});
 assert.equal(original.$controlResets,1);for(const name of ['innerAfter','outerAfter','callerAfter'])assert.equal(original[name],0);assert.equal(original.independent,7);
 try{
  const {run,clock,native}=await timed(suspended);run.vm.runtime.bwArcadeHoldControlReset=true;run.vm.greenFlag();await stepFrames(run.vm,5,0);native._controllerButtonEdge(1,'a',true);await stepFrames(run.vm,5,0);await advance(run,clock,200);
  assert.equal(run.vm.runtime.bwArcadeControlResets,1);for(const name of ['innerAfter','outerAfter','callerAfter','independent'])assert.equal(values(run)[name],original[name],name);assert.equal(native._resetSuspensions.size,1);
  const old=new Set(run.vm.runtime.threads);run.vm.stopAll();await stepFrames(run.vm,4,0);assert.equal(native._resetSuspensions.size,0);for(const name of ['innerAfter','outerAfter','callerAfter'])assert.equal(values(run)[name],0,name);
  run.vm.greenFlag();await advance(run,clock,400);for(const thread of run.vm.runtime.threads)assert.ok(!old.has(thread));for(const name of ['innerAfter','outerAfter','callerAfter'])assert.equal(values(run)[name],0,name);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
const restart=`let boots=settings.readNumber("restart-count")
if(!settings.exists("restart-count")){boots=0}
boots+=1
settings.writeNumber("restart-count",boots)
let innerAfter=0
let callerAfter=0
let stale=0
function inner(){pause(1);game.reset();innerAfter=1}
if(boots==1){game.pushScene()}
controller.A.onEvent(ControllerButtonEvent.Pressed,function(){inner();callerAfter=1})
if(boots==1){control.runInParallel(function(){pause(100);stale=9})}
let ready=1
ready+=0`;
test('native reset performs actual lifecycle restart, retaining settings and retiring old async/nested callers through Code and SB3',async()=>{
 try{
  const {run,clock,native}=await timed(restart);run.vm.greenFlag();await stepFrames(run.vm,5,0);assert.equal(values(run).boots,1);assert.equal(native._sceneStack.length,1);const stage=run.vm.runtime.getTargetForStage(),id=stage.bwArcadeSettings.id;let starts=0;run.vm.runtime.on('PROJECT_START',()=>starts++);
  native._controllerButtonEdge(1,'a',true);await stepFrames(run.vm,5,0);await advance(run,clock,200);assert.equal(starts,1);assert.strictEqual(run.vm.runtime.getTargetForStage(),stage);assert.equal(stage.bwArcadeSettings.id,id);assert.equal(values(run).boots,2);assert.equal(values(run).ready,1);for(const name of ['innerAfter','callerAfter','stale'])assert.equal(values(run)[name],0,name);assert.equal(native._sceneStack.length,0);await advance(run,clock,400);assert.equal(values(run).stale,0);assert.equal(starts,1);assert.deepEqual(run.errors,[]);
  const exported=projectToArcade(run.creator.project);assert.deepEqual(exported.unsupported,[]);assert.match(exported.ts,/game\.reset\(\)/);assert.deepEqual(arcadeToPseudocode(exported.files).unsupported,[]);
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,6);const freshNative=await owner(fresh);freshNative._controllerButtonEdge(1,'a',true);await stepFrames(fresh.vm,5);await new Promise(resolve=>setTimeout(resolve,10));await stepFrames(fresh.vm,7);assert.equal(values(fresh).innerAfter,0);assert.equal(values(fresh).callerAfter,0);assert.deepEqual(fresh.errors,[]);
 }finally{quitStrandedVMs()}
});
test('synchronous reset retires the old same-pass sibling and cannot advance its own block runner',async()=>{
 try{
  const run=await runProgram('DEVICE ARCADE\nGLOBAL boot\nGLOBAL after\nGLOBAL sibling\nSPRITE Game:\nWHEN flag clicked:\n  change boot by (1)\n  IF (boot) = (1) THEN:\n    arcade reset game\n    set after to (1)\nWHEN flag clicked:\n  set sibling to (2)',{frames:0,countExtensionCalls:false});
  const runtime=run.vm.runtime,old=new Set(runtime.threads),writes=[];assert.equal(old.size,2);let reset=false;runtime.on('PROJECT_START',()=>{reset=true});const original=runtime._primitives.data_setvariableto;runtime._primitives.data_setvariableto=(args,util)=>{if(reset&&old.has(util.thread))writes.push(args.VARIABLE);return original(args,util)};
  await stepFrames(run.vm,5);assert.equal(reset,true,JSON.stringify({values:values(run),errors:run.errors,code:run.creator.decompile()}));assert.deepEqual(writes,[]);assert.equal(values(run).after,0);assert.equal(values(run).boot,2);assert.equal(values(run).sibling,"2");for(const thread of old){assert.equal(thread.status,4);assert.equal(thread.stack.length,0)}assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
test('Stop and project replacement settle held reset without resuming a stale caller or restarting the new project',async()=>{
 try{
  const source='let after=0;game.reset();after=1;after+=0',out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);const run=await runProgram(out.code,{frames:0,countExtensionCalls:false});run.vm.runtime.bwArcadeHoldControlReset=true;await stepFrames(run.vm,5);const native=await owner(run);assert.equal(native._resetSuspensions.size,1);assert.equal(values(run).after,0);
  const next=await runProgram('GLOBAL sentinel\nSPRITE Replacement:\nWHEN flag clicked:\n  set sentinel to (42)',{frames:0,countExtensionCalls:false});let starts=0;run.vm.runtime.on('PROJECT_START',()=>starts++);await run.vm.loadProject(next.buffer);await stepFrames(run.vm,4);assert.equal(starts,0);assert.equal(native._resetSuspensions.size,0);run.vm.greenFlag();await stepFrames(run.vm,5);assert.equal(starts,1);assert.equal(values(run).sentinel,"42");assert.equal(values(run).after,undefined);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
// Each old callback's second handler leaves a persistent marker, so main's
// fresh variable initializers cannot hide a continuation across reset.
const staleWrite='settings.writeNumber("stale-handler",9)';
const rebootOnce=(body,root=false)=>`let boots=settings.readNumber("callback-boots")
if(!settings.exists("callback-boots")){boots=0}
boots+=1
settings.writeNumber("callback-boots",boots)
${root?body:`if(boots==1){${body}}`}
let ready=1
ready+=0`;
for(const [name,body,root]of [
 ['kind-destroyed snapshot',`sprites.onDestroyed(SpriteKind.Player,function(sprite){game.reset()});sprites.onDestroyed(SpriteKind.Player,function(sprite){${staleWrite}});let item=sprites.create(img\`1\`,SpriteKind.Player);item.destroy()`],
 ['instance then kind-destroyed chain',`let item=sprites.create(img\`1\`,SpriteKind.Player);item.onDestroyed(function(){game.reset()});sprites.onDestroyed(SpriteKind.Player,function(sprite){${staleWrite}});item.destroy()`],
 ['score threshold snapshot',`info.setScore(0);info.onScore(1,function(){game.reset()});info.onScore(2,function(){${staleWrite}});if(boots==1){info.setScore(3)}`,true],
 ['scene push snapshot',`game.addScenePushHandler(function(){game.reset()});game.addScenePushHandler(function(){${staleWrite}});game.pushScene()`],
 ['forever snapshot and timer',`game.forever(function(){game.reset()});game.forever(function(){${staleWrite}})`]
])test('program generation cancels old '+name+' before persistent effects',async()=>{
 try{
  const {run,clock,native}=await timed(rebootOnce(body,root));run.vm.greenFlag();await stepFrames(run.vm,8,0);await advance(run,clock,0);await advance(run,clock,200);assert.equal(values(run).boots,2,JSON.stringify({name,values:values(run),errors:run.errors,code:run.creator.decompile()}));assert.equal(values(run).ready,1,name);assert.equal(native._settingsStore().call('exists','stale-handler'),false,name);assert.deepEqual(run.errors,[]);
  if(name.startsWith('forever')){assert.equal(native._foreverHandlers.length,0);assert.equal(native._foreverTimer,undefined)}
 }finally{quitStrandedVMs()}
});
test('ordinary scene transitions preserve the callback snapshot and caller continuation',async()=>{
 try{
  const out=arcadeToPseudocode('let calls=0;let after=0;game.addScenePushHandler(function(){calls+=1});game.addScenePushHandler(function(){calls+=2});game.pushScene();game.popScene();game.pushScene();after=1;after+=0');assert.deepEqual(out.unsupported,[]);const run=await runProgram(out.code,{frames:6,countExtensionCalls:false});assert.equal(values(run).calls,6);assert.equal(values(run).after,1);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
for(const transition of ['push','pop'])test('game-over '+transition+' callback reset cannot apply the old terminal scene to the fresh program',async()=>{
 try{
  const body=transition==='push'?'game.addScenePushHandler(function(){game.reset()});game.over(false)':'game.pushScene();game.addScenePopHandler(function(){game.reset()});game.over(false)';
  const source=rebootOnce('game.setGameOverEffect(false,effects.confetti);'+body)+';scene.setBackgroundColor(7)';
  const {run,clock,native}=await timed(source);run.vm.greenFlag();await stepFrames(run.vm,8,0);await advance(run,clock,2000);
  assert.equal(values(run).boots,2);assert.equal(values(run).ready,1);assert.equal(native._sceneStack.length,0);assert.equal(native._state().backgroundColor,7);assert.equal(native._state().backgroundImage,undefined);assert.equal(native._gameOverState().over,false);assert.equal(native._renderablesOf().some(row=>row.z===100),false);assert.deepEqual(run.errors,[]);
  let starts=0;run.vm.runtime.on('PROJECT_START',()=>starts++);native._controllerButtonEdge(1,'a',true);await advance(run,clock,3000);assert.equal(starts,0);assert.equal(values(run).boots,2);
 }finally{quitStrandedVMs()}
});
test('awaited game-over scene handler cancellation cannot resume into a new program',async()=>{
 try{
  const body='game.addScenePushHandler(function(){controller.A.onEvent(ControllerButtonEvent.Pressed,function(){game.reset()});pause(100)});game.over(false)';
  const {run,clock,native}=await timed(rebootOnce(body)+';scene.setBackgroundColor(7)');run.vm.greenFlag();await stepFrames(run.vm,8,0);assert.equal(values(run).boots,1);assert.equal(native._sceneStack.length,1);native._controllerButtonEdge(1,'a',true);await stepFrames(run.vm,8,0);await advance(run,clock,2000);assert.equal(values(run).boots,2);assert.equal(native._state().backgroundImage,undefined);assert.equal(native._state().backgroundColor,7);assert.equal(native._gameOverState().over,false);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
test('completed game-over button wait held across reset cannot restart the fresh program again',async()=>{
 try{
  const {run,clock,native}=await timed(rebootOnce('game.over(false)')+';scene.setBackgroundColor(7)');let release;const gate=new Promise(resolve=>{release=resolve}),wait=native._nextButtonPress;let pressed=false;native._nextButtonPress=function(){return wait.call(this).then(value=>{pressed=true;return gate.then(()=>value)})};
  run.vm.greenFlag();await stepFrames(run.vm,8,0);await advance(run,clock,1000);native._controllerButtonEdge(1,'a',true);await stepFrames(run.vm,6,0);assert.equal(pressed,true);native._nextButtonPress=wait;let starts=0;run.vm.runtime.on('PROJECT_START',()=>starts++);native.resetGame({});await stepFrames(run.vm,6,0);assert.equal(values(run).boots,2);release();await advance(run,clock,2000);assert.equal(starts,1);assert.equal(values(run).boots,2);assert.equal(native._state().backgroundColor,7);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
