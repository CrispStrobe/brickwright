import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
const source=`let callbackName=7
let hits=0
let delta=2
controller.A.onEvent(ControllerButtonEvent.Pressed,function callbackName(){hits+=1000})
controller.A.onEvent(ControllerButtonEvent.Pressed,function callbackName(){hits+=delta;delta+=1})
let seen=callbackName
seen+=0
let ready=1
ready+=0`;
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const press=async(run,held)=>{run.vm.postIOData('keyboard',{key:' ',isDown:held});await stepFrames(run.vm,4)};
test('unused local callback names preserve original SDK replacement, capture and outer binding through Code and SB3',async()=>{
 const original=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{hits:5},buttonActions:{afterGlobals:{ready:1},steps:[{button:5,held:true,waitForGlobals:{hits:2,delta:3}},{button:5,held:false},{delay:20,button:5,held:true,waitForGlobals:{hits:5,delta:4}},{button:5,held:false}]}});
 assert.equal(original.seen,7);assert.equal(original.callbackName,7);assert.equal(original.hits,5);assert.equal(original.delta,4);
 try{
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
  const exercise=async run=>{assert.deepEqual(run.errors,[]);assert.equal(values(run).seen,7);await press(run,true);assert.equal(values(run).hits,2);await press(run,false);await press(run,true);assert.equal(values(run).hits,original.hits);assert.equal(values(run).delta,original.delta);await press(run,false);assert.deepEqual(run.errors,[])};
  const run=await runProgram(out.code,{frames:4,storage:true,countExtensionCalls:false});await exercise(run);
  await exercise(await runProgram(run.creator.decompile(),{frames:4,storage:true,countExtensionCalls:false}));
  const archive=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(archive);fresh.vm.greenFlag();await stepFrames(fresh.vm,4);await exercise(fresh);
  const exported=projectToArcade(run.creator.project);assert.deepEqual(exported.unsupported,[]);assert.deepEqual(arcadeToPseudocode(exported.files).unsupported,[]);
  run.vm.stopAll();await press(run,true);assert.equal(values(run).hits,5);await press(run,false);run.vm.greenFlag();await stepFrames(run.vm,4);await exercise(run);
 }finally{quitStrandedVMs()}
});
test('unproved active-Python and recursive handlers remain diagnosed and never execute as anonymous callbacks',async()=>{
 try{
  for(const files of [
   {'main.ts':'let hits=0;game.onUpdate(function recur(){hits+=1;recur()})'},
   {'pxt.json':JSON.stringify({dependencies:{device:'*'},preferredEditor:'pyprj',files:['main.ts','main.py']}),'main.ts':'let hits=0;game.onUpdate(function update_ui(){hits+=1})','main.py':'hits=9'}
  ]){
   const out=arcadeToPseudocode(files);assert.ok(out.unsupported.some(x=>/^Named /.test(x)));const run=await runProgram(out.code,{frames:8,countExtensionCalls:false});assert.equal(values(run).hits,0);assert.deepEqual(run.errors,[]);
  }
 }finally{quitStrandedVMs()}
});
