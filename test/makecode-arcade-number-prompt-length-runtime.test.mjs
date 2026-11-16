import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';
import BW from '../overlay/scratch-vm/src/util/bw-values.js';
const source='let stage=1;let one=game.askForNumber("One",1);stage=2;let two=game.askForNumber("Two",2);stage=3;let three=game.askForNumber("Three",3);stage=4;let original=game.askForNumber("Default");stage=5;';
const value=(run,name)=>BW.decode(run.vm.runtime.targets.flatMap(target=>Object.values(target.variables)).find(variable=>variable.name.replace(/^(?:Game_)+/,'')===name)?.value);
const settle=()=>new Promise(setImmediate);
function host(){
 const runtime=new EventEmitter();let reply='';runtime.on('ANSWER',value=>{reply=value});
 runtime.getOpcodeFunction=opcode=>opcode==='sensing_askandwait'?()=>new Promise(resolve=>runtime.once('ANSWER',resolve)):()=>reply;
 const arcade=new (loadExtensionClass('arcade'))(runtime)._inst;return {runtime,arcade,util:{target:{}}};
}
const button=(arcade,name)=>{arcade._controllerButtonEdge(1,name,true);arcade._controllerButtonEdge(1,name,false)};

test('length reporter reuses prompt scene, counts sign and point, switches keyboard and cancels on Stop',async()=>{
 const {runtime,arcade,util}=host(),world=arcade._state();let finished=false,coerced=false;
 assert.throws(()=>arcade.askForNumberLength({QUESTION:{toString(){coerced=true;return 'x'}},LENGTH:2},util),/requires a String question/);
 assert.equal(coerced,false);assert.equal(arcade._state(),world);
 const pending=arcade.askForNumberLength({QUESTION:'n',LENGTH:2},util).then(value=>{finished=true;return value});
 await settle();assert.notEqual(arcade._state(),world);assert.deepEqual(runtime.bwArcadeTextPrompt,{answerLength:2,numbersOnly:true});
 runtime.emit('ARCADE_PROMPT_INPUT','-.5');assert.equal(arcade._textPromptUi.prompt.result,'-.');
 runtime.emit('ARCADE_PROMPT_CANCEL');await settle();assert.equal(finished,false);assert.equal(arcade._textPromptUi.prompt.useSystemKeyboard,false);
 for(let i=0;i<4;i++)button(arcade,'down');button(arcade,'a');assert.ok(Number.isNaN(await pending));assert.equal(arcade._state(),world);
 const first=arcade.askForNumberLength({QUESTION:'first',LENGTH:1},util),queued=arcade.askForNumberLength({QUESTION:'queued',LENGTH:3},util);
 await settle();runtime.emit('PROJECT_STOP_ALL');const stopped=arcade._state();
 for(const result of await Promise.all([first,queued]))assert.ok(Number.isNaN(result));
 runtime.emit('ANSWER','9');await settle();assert.equal(arcade._state(),stopped);assert.equal(arcade._textPromptWaits.size,0);assert.equal(runtime.bwArcadeTextPrompt,null);
 const legacy=arcade.askForNumber({QUESTION:'unchanged'},util);await settle();assert.equal(runtime.bwArcadeTextPrompt.answerLength,6);runtime.emit('ANSWER','1234567');assert.equal(await legacy,123456);
});

test('literal length prompts match original PXT results and block through Code, fresh SB3 and export',async()=>{
 const inputs=['-','-12','1.59','1234567'];
 const steps=inputs.flatMap((text,i)=>[{delay:100,text},{delay:20,key:'Enter',waitForGlobals:{stage:i+2}}]);
 const original=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{stage:5},buttonActions:{afterGlobals:{stage:1},steps}});
 assert.ok(Number.isNaN(original.one));assert.equal(original.two,-1);assert.equal(original.three,1.5);assert.equal(original.original,123456);
 try{
  const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
  const check=async run=>{
   for(let i=0;i<inputs.length;i++){
    await stepFrames(run.vm,5,20);assert.equal(value(run,'stage'),i+1,'caller blocks until answer');
    assert.equal(run.vm.runtime.bwArcadeTextPrompt.answerLength,[1,2,3,6][i]);
    run.vm.runtime.emit('ANSWER',inputs[i]);
   }
   await stepFrames(run.vm,5,20);assert.equal(value(run,'stage'),5);
   for(const name of ['one','two','three','original'])assert.equal(value(run,name),original[name],name);
   assert.deepEqual(run.errors,[]);
  };
  const run=await runProgram(imported.code,{frames:0,storage:true});await check(run);
  const code=await runProgram(run.creator.decompile(),{frames:0,storage:true});await check(code);
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await check(fresh);
  const exported=projectToArcade(run.creator.project);assert.deepEqual(exported.unsupported,[]);assert.match(exported.ts,/game\.askForNumber\([^,]+, 3\)/);
  const again=arcadeToPseudocode(exported.files);assert.deepEqual(again.unsupported,[]);const reimport=await runProgram(again.code,{frames:0});await check(reimport);
  const stop=await runProgram(imported.code,{frames:4});assert.equal(value(stop,'stage'),1);stop.vm.stopAll();stop.vm.runtime.emit('ANSWER','9');await stepFrames(stop.vm,5,20);assert.equal(value(stop,'stage'),1);
 }finally{quitStrandedVMs()}
});
