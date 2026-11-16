import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';
import BW from '../overlay/scratch-vm/src/util/bw-values.js';
const source='let stage=1;let explicit=game.askForString("First?",12);stage=2;let omitted=game.askForString("Second?");stage=3;';
const value=(run,name)=>BW.decode(run.vm.runtime.targets.flatMap(target=>Object.values(target.variables)).find(variable=>variable.name.replace(/^(?:Game_)+/,'')===name)?.value);
const settle=()=>new Promise(setImmediate);
function host(){
 const runtime=new EventEmitter();let reply='';runtime.on('ANSWER',value=>{reply=value});
 runtime.getOpcodeFunction=opcode=>opcode==='sensing_askandwait'?()=>new Promise(resolve=>runtime.once('ANSWER',resolve)):()=>reply;
 const arcade=new (loadExtensionClass('arcade'))(runtime)._inst;return {runtime,arcade,util:{target:{}}};
}
const button=(arcade,name)=>{arcade._controllerButtonEdge(1,name,true);arcade._controllerButtonEdge(1,name,false)};

test('unchanged text prompt default12 suspends scene, switches keyboard on cancel and survives Stop',async()=>{
 const {runtime,arcade,util}=host(),world=arcade._state();let finished=false;
 const pending=arcade.askForString({QUESTION:'Input?'},util).then(value=>{finished=true;return value});
 await settle();assert.notEqual(arcade._state(),world);assert.deepEqual(runtime.bwArcadeTextPrompt,{answerLength:12,numbersOnly:false});
 runtime.emit('ARCADE_PROMPT_INPUT','abcdefghijklmnop');assert.equal(arcade._textPromptUi.prompt.result,'abcdefghijkl');
 runtime.emit('ARCADE_PROMPT_CANCEL');await settle();assert.equal(finished,false);assert.equal(arcade._textPromptUi.prompt.useSystemKeyboard,false);
 button(arcade,'a');assert.equal(arcade._textPromptUi.prompt.result,'abcdefghijkl','onscreen keyboard retains default length');
 for(let i=0;i<3;i++)button(arcade,'down');button(arcade,'right');button(arcade,'a');
 assert.equal(await pending,'abcdefghijkl');assert.equal(arcade._state(),world);
 const active=arcade.askForString({QUESTION:'active'},util),queued=arcade.askForString({QUESTION:'queued'},util);
 await settle();runtime.emit('PROJECT_STOP_ALL');const stopped=arcade._state();
 assert.deepEqual(await Promise.all([active,queued]),['','']);runtime.emit('ANSWER','late');await settle();
 assert.equal(arcade._state(),stopped);assert.equal(arcade._textPromptWaits.size,0);assert.equal(runtime.bwArcadeTextPrompt,null);
});

const replies=['abcdefghijklmnop','done'];
function actions(stage){return {afterGlobals:{[stage]:1},steps:replies.flatMap((text,i)=>[{delay:100,text},{delay:20,key:'Enter',waitForGlobals:{[stage]:i+2}}])};}
test('explicit default12 matches original PXT and default omission through Code, SB3 and export',async()=>{
 const original=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{stage:3},buttonActions:actions('stage')});
 assert.equal(original.explicit,'abcdefghijkl');assert.equal(original.omitted,'done');
 try{
  const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
  assert.deepEqual(imported,arcadeToPseudocode(source.replace(',12)',')')));
  const check=async run=>{
   for(let i=0;i<replies.length;i++){
    await stepFrames(run.vm,5,20);assert.equal(value(run,'stage'),i+1,'caller blocks until actual answer');
    assert.deepEqual(run.vm.runtime.bwArcadeTextPrompt,{answerLength:12,numbersOnly:false});run.vm.runtime.emit('ANSWER',replies[i]);
   }
   await stepFrames(run.vm,5,20);assert.equal(value(run,'stage'),3);
   for(const name of ['explicit','omitted'])assert.equal(value(run,name),original[name],name);assert.deepEqual(run.errors,[]);
  };
  const run=await runProgram(imported.code,{frames:0,storage:true});await check(run);
  const code=await runProgram(run.creator.decompile(),{frames:0,storage:true});await check(code);
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await check(fresh);
  const exported=projectToArcade(run.creator.project);assert.deepEqual(exported.unsupported,[]);
  assert.doesNotMatch(exported.ts,/askForString\([^\n]*,\s*12/);
  const stageName=/(?:let|var)\s+(\w*stage)\b/.exec(exported.ts)?.[1];assert.ok(stageName);
  const omittedOriginal=await runPxtArcade(exported.files,{fakeClock:true,waitForGlobals:{[stageName]:3},buttonActions:actions(stageName)});
  const normalized=Object.fromEntries(Object.entries(omittedOriginal).map(([key,value])=>[key.replace(/^(?:Game_)+/,''),value]));
  for(const name of ['explicit','omitted'])assert.equal(normalized[name],original[name],name+' original export');
  const again=arcadeToPseudocode(exported.files);assert.deepEqual(again.unsupported,[]);const reimport=await runProgram(again.code,{frames:0});await check(reimport);
  const stopped=await runProgram(imported.code,{frames:4});assert.equal(value(stopped,'stage'),1);stopped.vm.stopAll();stopped.vm.runtime.emit('ANSWER','late');await stepFrames(stopped.vm,5,20);assert.equal(value(stopped,'stage'),1);
 }finally{quitStrandedVMs()}
});
