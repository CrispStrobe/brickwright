import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
async function owner(run){const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default;const native=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;assert.strictEqual(native._runtime,run.vm.runtime);return native;}
async function input(run,native,player,button,held,frames=2){native._controllerButtonEdge(player,button,held);await stepFrames(run.vm,frames);}
const source=`let first=0
let second=0
let released=0
let repeated=0
controller.setRepeatDefault(100,50)
controller.player1.onButtonEvent(ControllerButton.A,ControllerButtonEvent.Pressed,function(){first+=99})
controller.A.onEvent(ControllerButtonEvent.Pressed,function(){first+=1})
controller.player2.onButtonEvent(ControllerButton.B,ControllerButtonEvent.Pressed,function(){second+=99})
controller.player2.onButtonEvent(ControllerButton.B,ControllerButtonEvent.Pressed,function(){second+=2})
controller.player3.onButtonEvent(ControllerButton.Left,ControllerButtonEvent.Released,function(){released+=3})
controller.player4.onButtonEvent(ControllerButton.Up,ControllerButtonEvent.Repeated,function(){repeated+=4})
let ready=1
ready+=0`;
const steps=[{button:5,held:true,waitForGlobals:{first:1}},{button:5,held:false},{button:13,held:true,waitForGlobals:{second:2}},{button:13,held:false},{button:15,held:true},{delay:20,button:15,held:false,waitForGlobals:{released:3}},{button:23,held:true},{delay:120,button:23,held:false,waitForGlobals:{repeated:4}}];
test('P1–P4 direct buttons match original pressed/released/repeat and replacement through Code, SB3 and export',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{repeated:4},buttonActions:{afterGlobals:{ready:1},steps}});
 for(const [key,value]of Object.entries({first:1,second:2,released:3,repeated:4}))assert.equal(expected[key],value);
 try{
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
  const exercise=async run=>{const native=await owner(run);assert.deepEqual(run.errors,[]);await input(run,native,1,'a',true);await input(run,native,1,'a',false);await input(run,native,2,'b',true);await input(run,native,2,'b',false);await input(run,native,3,'left',true);await input(run,native,3,'left',false);await input(run,native,4,'up',true,4);await input(run,native,4,'up',false);for(const key of ['first','second','released','repeated'])assert.equal(values(run)[key],expected[key],key);assert.deepEqual(run.errors,[]);};
  const run=await runProgram(out.code,{frames:3,storage:true,countExtensionCalls:false});await exercise(run);
  await exercise(await runProgram(run.creator.decompile(),{frames:3,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,3);await exercise(fresh);
  const exported=projectToArcade(run.creator.project);assert.deepEqual(exported.unsupported,[]);assert.match(exported.ts,/controller\.player[1-4]\.onButtonEvent/);assert.deepEqual(arcadeToPseudocode(exported.files).unsupported,[]);
  const declarations=[...exported.ts.matchAll(/\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g)].map(match=>match[1]),names={};
  for(const key of ['ready','first','second','released','repeated']){const matches=[...new Set(declarations.filter(name=>name.replace(/^(?:Game_)+/,'')===key))];assert.equal(matches.length,1,`exact exported ${key} declaration`);names[key]=matches[0];}
  const markers=values=>Object.fromEntries(Object.entries(values).map(([key,value])=>[names[key],value]));
  const exportedOriginal=await runPxtArcade(exported.files,{fakeClock:true,waitForGlobals:markers({repeated:4}),buttonActions:{afterGlobals:markers({ready:1}),steps:steps.map(step=>({...step,...(step.waitForGlobals?{waitForGlobals:markers(step.waitForGlobals)}:{})}))}});for(const key of ['first','second','released','repeated'])assert.equal(exportedOriginal[names[key]],expected[key],key+' exported');
 }finally{quitStrandedVMs()}
});
const scenes=`let trace=""
let phase=0
controller.player2.onButtonEvent(ControllerButton.A,ControllerButtonEvent.Pressed,function(){
 trace+="R"
 game.pushScene()
 phase=1
 controller.player2.onButtonEvent(ControllerButton.A,ControllerButtonEvent.Pressed,function(){trace+="C";game.popScene();phase=2})
})
let ready=1
ready+=0`;
test('per-player wrapper slots follow actual scene push/pop and retain Stop/restart behavior',async()=>{
 const expected=await runPxtArcade(scenes,{fakeClock:true,waitForGlobals:{trace:'RCR'},buttonActions:{afterGlobals:{ready:1},steps:[{button:12,held:true,waitForGlobals:{phase:1}},{button:12,held:false},{delay:20,button:12,held:true,waitForGlobals:{phase:2}},{button:12,held:false},{delay:20,button:12,held:true,waitForGlobals:{trace:'RCR'}},{button:12,held:false}]}});
 assert.equal(expected.trace,'RCR');assert.equal(expected.phase,1);
 try{
  const out=arcadeToPseudocode(scenes);assert.deepEqual(out.unsupported,[]);const run=await runProgram(out.code,{frames:3,countExtensionCalls:false}),native=await owner(run);
  await input(run,native,2,'a',true,4);assert.equal(values(run).phase,1);await input(run,native,2,'a',false);await input(run,native,2,'a',true,4);assert.equal(values(run).phase,2);await input(run,native,2,'a',false);await input(run,native,2,'a',true,4);assert.equal(values(run).trace,expected.trace);await input(run,native,2,'a',false);
  run.vm.stopAll();await input(run,native,2,'a',true,4);assert.equal(values(run).trace,'RCR');await input(run,native,2,'a',false);run.vm.greenFlag();await stepFrames(run.vm,3);assert.equal(values(run).trace,'');await input(run,native,2,'a',true,4);assert.equal(values(run).trace,'R');assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
