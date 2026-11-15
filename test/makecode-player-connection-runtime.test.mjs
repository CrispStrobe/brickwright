import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
const source=`let trace=""
controller.player1.onEvent(ControllerEvent.Connected,function(){trace+="1"})
controller.player2.onEvent(ControllerEvent.Connected,function(){trace+="X"})
controller.player2.onEvent(ControllerEvent.Connected,function(){trace+="2"})
controller.player2.onEvent(ControllerEvent.Disconnected,function(){trace+="D"})
control.raiseEvent(controller.player1.id,ControllerEvent.Connected)
control.raiseEvent(controller.player2.id,ControllerEvent.Connected)
control.raiseEvent(controller.player2.id,ControllerEvent.Disconnected)
control.raiseEvent(controller.player3.id,ControllerEvent.Connected)
pause(60)
game.pushScene()
controller.player2.onEvent(ControllerEvent.Connected,function(){trace+="C"})
control.raiseEvent(controller.player2.id,ControllerEvent.Connected)
pause(60)
game.popScene()
control.raiseEvent(controller.player2.id,ControllerEvent.Connected)
pause(60)
let observed=trace;observed+=""`;
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
async function finish(run){run.vm.stopAll();const clock=createArcadeDiscreteTimers();run.vm.runtime.bwArcadeProgramClock=clock;run.vm.runtime.updateCurrentMSecs=()=>{run.vm.runtime.currentMSecs=clock.now()};run.vm.greenFlag();await stepFrames(run.vm,1,0);await clock.advanceTo(220);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);return values(run);}
test('fixed-player connections retain default event queue, replacement and scene restoration through PXT/native/Code/fresh SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true});assert.equal(expected.observed,'12DC2');
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false});assert.equal((await finish(run)).observed,expected.observed);
  const code=await runProgram(run.creator.decompile(),{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false});assert.equal((await finish(code)).observed,expected.observed);
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,frameAuthority:'timed',countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);assert.equal((await finish(fresh)).observed,expected.observed);
  run.vm.stopAll();const stopped=values(run).trace;await stepFrames(run.vm,3);assert.equal(values(run).trace,stopped);assert.equal((await finish(run)).observed,expected.observed,'restart gets one fresh set of slots');
 }finally{quitStrandedVMs()}
});
