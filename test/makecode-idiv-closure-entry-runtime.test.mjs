import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
const source='const WIDTH=160;const HEIGHT=120;const STEP=8;let columns=0;let rows=0;let observed=0;let done=0;function x(){return Math.idiv(WIDTH,STEP)};function y(){return Math.idiv(HEIGHT,STEP)};function register(){game.onUpdateInterval(10,function(){columns=x();rows=y();observed=columns*100+rows;done=1})};register();pause(30)';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
async function finish(run){run.vm.stopAll();const clock=createArcadeDiscreteTimers();run.vm.runtime.bwArcadeProgramClock=clock;run.vm.runtime.updateCurrentMSecs=()=>{run.vm.runtime.currentMSecs=clock.now()};run.vm.greenFlag();await stepFrames(run.vm,1,0);await clock.advanceTo(40);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);return values(run);}
test('idiv captured producers remain Number and initialized through real interval closures/PXT/native/Code/fresh SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true,waitForGlobals:{done:1}});assert.deepEqual([expected.columns,expected.rows,expected.observed,expected.done],[20,15,2015,1]);const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
 const check=async run=>{const actual=await finish(run);for(const key of ['columns','rows','observed','done'])assert.equal(actual[key],expected[key],key)};
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false}));
  const bytes=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(bytes);await check(fresh);
 }finally{quitStrandedVMs()}
});
