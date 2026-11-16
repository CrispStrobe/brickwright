import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
import BW from '../overlay/scratch-vm/src/util/bw-values.js';

const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(target=>Object.values(target.variables)).map(variable=>[variable.name.replace(/^(?:Game_)+/,''),BW.decode(variable.value)]));
const source=`let trace=""
let presses=0
let releases=0
let repeats=0
let ready=0
let done=0
function install(value:number){
 let captured=value
 controller.anyButton.onEvent(ControllerButtonEvent.Pressed,function(){trace+="P"+captured;captured+=1;presses+=1})
 captured+=1
}
install(1)
install(5)
controller.anyButton.onEvent(ControllerButtonEvent.Released,function(){releases+=1})
controller.anyButton.onEvent(ControllerButtonEvent.Repeated,function(){repeats+=1})
controller.A.repeatDelay=60
controller.A.repeatInterval=20
game.onUpdate(function(){ready=1;if(game.runtime()>=400)done=1})
pause(400)`;
const steps=[
 {button:5,player:1,nativeButton:'a',held:true},{delay:120},{button:5,player:1,nativeButton:'a',held:false},
 {button:12,player:2,nativeButton:'a',held:true},{delay:20},{button:12,player:2,nativeButton:'a',held:false},
 {button:15,player:3,nativeButton:'left',held:true},{delay:20},{button:15,player:3,nativeButton:'left',held:false},
 {button:27,player:4,nativeButton:'b',held:true},{delay:20},{button:27,player:4,nativeButton:'b',held:false},{delay:80}
];
async function begin(run){
 const clock=createArcadeDiscreteTimers();run.vm.stopAll();run.vm.runtime.bwArcadeProgramClock=clock;
 run.vm.runtime.updateCurrentMSecs=()=>{run.vm.runtime.currentMSecs=clock.now()};run.vm.greenFlag();
 await stepFrames(run.vm,1,0);await clock.advanceTo(0);return clock;
}
async function drive(run,input=steps,end=400){
 const clock=await begin(run);let now=0;
 for(const step of input){
  if(step.delay){now+=step.delay;await clock.advanceTo(now);}
  if(step.button!==undefined){run.vm.runtime.emit('ARCADE_PLAYER_BUTTON_EDGE',step.player,step.nativeButton,step.held);await clock.advanceTo(now);}
 }
 await clock.advanceTo(end);assert.deepEqual(run.errors,[]);return values(run);
}

test('original and translated any-button callbacks replace captures and receive all players, release and repeat',async()=>{
 const original=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{done:1},buttonActions:{afterGlobals:{ready:1},steps}});
 assert.equal(original.trace,'P6P7P8P9');assert.equal(original.presses,4);assert.equal(original.releases,4);assert.ok(original.repeats>0);
 try{
  const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
  const run=await runProgram(imported.code,{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});
  const check=async target=>{
   assert.deepEqual(target.creator.warnings,[]);const actual=await drive(target);
   for(const key of ['trace','presses','releases','repeats','done'])assert.equal(actual[key],original[key],key);
  };
  await check(run);
  const code=await runProgram(run.creator.decompile(),{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});await check(code);
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());run.vm.stopAll();await run.vm.loadProject(saved);await check(run);
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);await check(fresh);
  const exported=projectToArcade(code.creator.project);assert.deepEqual(exported.unsupported,[]);
  const exportedOriginal=await runPxtArcade(exported.files,{fakeClock:true,waitForGlobals:{done:1},buttonActions:{afterGlobals:{ready:1},steps}});
  for(const key of ['trace','presses','releases','repeats','done'])assert.equal(exportedOriginal[key]??exportedOriginal['Game_'+key],original[key],key+' exported');
  const reimported=arcadeToPseudocode(exported.files);assert.deepEqual(reimported.unsupported,[]);
  const reimport=await runProgram(reimported.code,{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});await check(reimport);
 }finally{quitStrandedVMs()}
});

test('any-button callbacks registered in a child scene restore the parent replacement and capture cells',async()=>{
 const sceneSource=`let trace="";let ready=0;let done=0;
 function install(value:number){let captured=value;controller.anyButton.onEvent(ControllerButtonEvent.Pressed,function(){trace+="P"+captured;captured+=1})}
 install(1);
 controller.B.onEvent(ControllerButtonEvent.Pressed,function(){game.pushScene();install(10);controller.B.onEvent(ControllerButtonEvent.Pressed,function(){game.popScene()})});
 game.onUpdate(function(){ready=1;if(game.runtime()>=400)done=1});pause(400);`;
 const input=[
  {button:6,player:1,nativeButton:'b',held:true},{delay:20},{button:6,player:1,nativeButton:'b',held:false},
  {button:12,player:2,nativeButton:'a',held:true},{delay:20},{button:12,player:2,nativeButton:'a',held:false},
  {button:6,player:1,nativeButton:'b',held:true},{delay:20},{button:6,player:1,nativeButton:'b',held:false},
  {button:15,player:3,nativeButton:'left',held:true},{delay:20},{button:15,player:3,nativeButton:'left',held:false},
  {button:27,player:4,nativeButton:'b',held:true},{delay:20},{button:27,player:4,nativeButton:'b',held:false}
 ];
 const original=await runPxtArcade(sceneSource,{fakeClock:true,waitForGlobals:{done:1},buttonActions:{afterGlobals:{ready:1},steps:input}});
 assert.equal(original.trace,'P1P10P11P2P3');
 try{
  const imported=arcadeToPseudocode(sceneSource);assert.deepEqual(imported.unsupported,[]);
  const run=await runProgram(imported.code,{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});
  assert.equal((await drive(run,input)).trace,original.trace);
 }finally{quitStrandedVMs()}
});

test('replacement while a wildcard callback waits uses the new callback for pending events; Stop cancels the old invocation',async()=>{
 const busy=`let trace="";let replaced=0;let ready=0;let done=0;
 controller.anyButton.onEvent(ControllerButtonEvent.Pressed,function(){trace+="O";pause(80);trace+="D"});
 game.onUpdate(function(){ready=1;if(game.runtime()>=40 && replaced===0){replaced=1;controller.anyButton.onEvent(ControllerButtonEvent.Pressed,function(){trace+="N"})}if(game.runtime()>=240)done=1});pause(240);`;
 const input=[{button:5,player:1,nativeButton:'a',held:true},{delay:10},{button:5,player:1,nativeButton:'a',held:false},{delay:10},{button:13,player:2,nativeButton:'b',held:true},{delay:10},{button:13,player:2,nativeButton:'b',held:false}];
 const original=await runPxtArcade(busy,{fakeClock:true,waitForGlobals:{done:1},buttonActions:{afterGlobals:{ready:1},steps:input}});
 assert.equal(original.trace,'ODN');
 try{
  const imported=arcadeToPseudocode(busy);assert.deepEqual(imported.unsupported,[]);
  const run=await runProgram(imported.code,{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});
  assert.equal((await drive(run,input,240)).trace,original.trace);
  const clock=await begin(run);run.vm.runtime.emit('ARCADE_PLAYER_BUTTON_EDGE',1,'a',true);await clock.advanceTo(20);
  assert.equal(values(run).trace,'O');run.vm.stopAll();await clock.advanceTo(200);assert.equal(values(run).trace,'O');
  assert.equal((await drive(run,input,240)).trace,original.trace);
 }finally{quitStrandedVMs()}
});
