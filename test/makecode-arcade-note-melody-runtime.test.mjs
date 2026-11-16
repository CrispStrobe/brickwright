import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';
import {createArcadeRuntimeMock} from './helpers/arcade-runtime-mock.mjs';
import BW from '../overlay/scratch-vm/src/util/bw-values.js';

const Arcade=loadExtensionClass('arcade');
const source='let after=0;music.setVolume(12);music.playMelody("C5 - D C",240);after=1;';
const value=(run,name)=>BW.decode(run.vm.runtime.targets.flatMap(target=>Object.values(target.variables)).find(variable=>variable.name.replace(/^(?:Game_)+/,'')===name)?.value);
const bytes=log=>log.map(entry=>entry.bytes);
async function start(run){
 const clock=createArcadeDiscreteTimers();run.vm.stopAll();run.vm.runtime.bwArcadeProgramClock=clock;
 run.vm.runtime.updateCurrentMSecs=()=>{run.vm.runtime.currentMSecs=clock.now()};run.vm.greenFlag();await stepFrames(run.vm,1,0);await clock.advanceTo(0);return clock;
}

test('legacy note adapter forwards the original generator, raw notes, tempo and blocking result without substituting a playable',()=>{
 const facade=new Arcade(createArcadeRuntimeMock()),instance=facade._inst,args=[],generator={},pending=Promise.resolve();
 instance._music=()=>({pxt:{music:{playMelody:(...values)=>{args.push(values);return generator;}}},run:value=>{assert.strictEqual(value,generator);return pending;}});
 assert.strictEqual(facade.playNoteMelody({NOTES:'C5 - D C',TEMPO:240}),pending);
 assert.deepEqual(args,[['C5 - D C',240]]);
 const error=new Error('original generator fault');instance._music=()=>({pxt:{music:{playMelody:()=>generator}},run:()=>{throw error;}});
 assert.throws(()=>facade.playNoteMelody({NOTES:'C',TEMPO:120}),value=>value===error);
 const info=facade.getInfo();assert.deepEqual(Object.keys(info.blocks.find(block=>block.opcode==='playNoteMelody').arguments),['NOTES','TEMPO']);
 assert.deepEqual(Object.keys(info.blocks.find(block=>block.opcode==='playMelody').arguments),['MELODY','MODE']);
 const runtime=createArcadeRuntimeMock(),faults=[];runtime.on('BLOCKS_ERROR',error=>faults.push(error));
 const actual=new Arcade(runtime);let coerced=0;const opaque={toString(){coerced+=1;throw new Error('tempo coerced');}};
 actual.playNoteMelody({NOTES:null,TEMPO:opaque});
 assert.equal(coerced,0);assert.equal(faults.length,1);assert.match(faults[0],/split/,'original notes.split faults before tempo coercion');
});

test('literal note melody matches original default volume, rests and octave reset, blocks and survives Code and SB3',async()=>{
 const original=await runPxtArcade(source,{fakeClock:true,recordSound:true,waitForGlobals:{after:1}});
 assert.equal(original.$sound.length,3);
 const originalBytes=bytes(original.$sound);assert.ok((originalBytes[0][2]|originalBytes[0][3]<<8)>(originalBytes[2][2]|originalBytes[2][3]<<8));
 try {
  const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
  const run=await runProgram(imported.code,{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});
  const check=async target=>{
   assert.deepEqual(target.creator.warnings,[]);const clock=await start(target);await clock.advanceTo(100);assert.equal(value(target,'after'),0);
   await clock.advanceTo(1200);assert.equal(value(target,'after'),1);assert.deepEqual(target.errors,[]);assert.deepEqual(bytes(target.vm.runtime.bwArcadeMusicLog),originalBytes);
  };
  await check(run);
  const code=await runProgram(run.creator.decompile(),{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});await check(code);
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());run.vm.stopAll();await run.vm.loadProject(saved);await check(run);
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);await check(fresh);
  const exported=projectToArcade(code.creator.project);assert.deepEqual(exported.unsupported,[]);assert.match(exported.files['main.ts'],/music\.playMelody\(/);
  const reimported=arcadeToPseudocode(exported.files);assert.deepEqual(reimported.unsupported,[]);
  const reimport=await runProgram(reimported.code,{frames:0,storage:true,frameAuthority:'timed',retainExtensionTimers:true});await check(reimport);
  const clock=await start(run);await clock.advanceTo(100);run.vm.stopAll();await clock.advanceTo(1600);assert.equal(value(run,'after'),0,'Stop cancels the blocked caller');
 } finally {quitStrandedVMs()}
});
