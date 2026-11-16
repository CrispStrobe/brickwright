import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
const require=createRequire(import.meta.url),inspect=require('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/console-inspect-values');
const source=`let actor=sprites.create(img\`1\`,SpriteKind.Player)
actor.setPosition(13.25,-4.5)
console.logValue("horizontal",actor.x)
console.logValue("vertical",actor.y)
console.logValue("",actor.x)
console.logValue("__proto__",actor.y)
let finished=1
finished+=0`;
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(target=>Object.values(target.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const lines=run=>(run.vm.runtime.bwArcadeDeviceState.serial||'').split('\n').filter(Boolean);

test('literal-label Sprite telemetry matches original SDK formatting and reads once through Code/SB3',async()=>{
 // Observe actual SDK log delivery with its passive listener; no console
 // function is replaced. Extra special-number calls qualify only the shared
 // primitive formatter; the new source slice still refuses those call shapes.
 const observed='let observed="";console.addListener(function(priority,message){observed+=message+"\\n"});\n'+source+'\nconsole.logValue("",-0);console.logValue("special",NaN);';
 const original=await runPxtArcade(observed,{fakeClock:true,waitForGlobals:{finished:1}}),expected=original.observed.split('\n').filter(Boolean);
 assert.deepEqual(expected,['horizontal: 13.25','vertical: -4.5','13.25','__proto__: -4.5','0','special: NaN']);
 assert.equal(''+inspect.primitive(-0),expected[4]);assert.equal('special: '+inspect.primitive(NaN),expected[5]);
 try{
  const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
  const check=run=>{assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);assert.equal(values(run).finished,1);assert.deepEqual(lines(run),expected.slice(0,4));assert.equal(run.calls.get('arcade_spriteProperty'),4,'one physical getter evaluation per logValue');};
  const run=await runProgram(imported.code,{frames:5,storage:true,uploads:imported.costumes});check(run);
  check(await runProgram(run.creator.decompile(),{frames:5,storage:true,uploads:imported.costumes}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,5);
  assert.deepEqual(fresh.errors,[]);assert.equal(values(fresh).finished,1);assert.deepEqual(lines(fresh),expected.slice(0,4));
 }finally{quitStrandedVMs()}
});

test('actual null receiver fault in an edited live cell aborts before inspection, log and later callback effects',async()=>{
 const source='let actor=sprites.create(img`1`,SpriteKind.Player);let after=0;controller.A.onEvent(ControllerButtonEvent.Pressed,function(){console.logValue("x",actor.x);after=1});';
 const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
 try{
  const run=await runProgram(imported.code,{frames:3});
  const actor=run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).find(v=>v.name.replace(/^(?:Game_)+/,'')==='actor');assert.ok(actor);actor.value=null;
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,6);
  assert.ok(run.errors.some(message=>message.includes('Expected type Sprite but received type null')));
  assert.equal(values(run).after,0);assert.deepEqual(lines(run),[]);assert.equal(run.calls.get('arcade_spriteProperty'),1);assert.equal(run.calls.get('arcade_inspectValue')||0,0);assert.equal(run.calls.get('arcade_log')||0,0);
 }finally{quitStrandedVMs()}
});
