import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {restartTimedArcadeRun} from './helpers/arcade-timed-native.mjs';
import {scoreImageFiles} from './fixtures/arcade-score-owned-image.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(target=>Object.values(target.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const main=`let trace=""
let ready=false
info.onScore(2,function(){trace+="obsolete"})
info.onScore(2,function(){trace+="A";scene.setBackgroundImage(assets.image\`badge\`)})
info.setScore(3)
info.setScore(-1)
info.player2.onScore(1,function(){trace+="B"})
info.player2.setScore(1)
game.pushScene()
info.onScore(2,function(){trace+="C";scene.setBackgroundImage(assets.image\`badge\`)})
info.setScore(2)
game.popScene()
info.setScore(2)
ready=true`;

test('owned named images coexist with original score crossings, replacement, players and scenes through Code/SB3/export',async()=>{
 const files=scoreImageFiles(main),original=await runPxtArcade(files,{fakeClock:true,waitForGlobals:{ready:true}});
 assert.equal(original.trace,'AABCA');
 try{
  const imported=arcadeToPseudocode(files);assert.deepEqual(imported.unsupported,[]);
  const check=run=>{assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);assert.equal(values(run).trace,original.trace);assert.equal(values(run).ready,true);};
  const run=await runProgram(imported.code,{frames:5,storage:true,uploads:imported.costumes});check(run);
  check(await runProgram(run.creator.decompile(),{frames:5,storage:true,uploads:imported.costumes}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());run.vm.stopAll();await run.vm.loadProject(saved);run.vm.greenFlag();await stepFrames(run.vm,5);check(run);
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,5);check(fresh);
  const exported=projectToArcade(JSON.parse(run.vm.toJSON()),{costumeSvg:(target,costume)=>run.creator.assets.get(costume.assetId)?.data});assert.deepEqual(exported.unsupported,[]);
  const again=arcadeToPseudocode(exported.files);assert.deepEqual(again.unsupported,[]);check(await runProgram(again.code,{frames:5,storage:true,uploads:again.costumes}));
 }finally{quitStrandedVMs()}
});

test('owned image score callback blocks its setter until completion and Stop cancels suspended lineage',async()=>{
 const source='let trace="";let ready=false;info.onScore(1,function(){scene.setBackgroundImage(assets.image`badge`);trace+="A";pause(40);trace+="B"});info.setScore(1);trace+="C";ready=true;';
 const files=scoreImageFiles(source),original=await runPxtArcade(files,{fakeClock:true,waitForGlobals:{ready:true}});assert.equal(original.trace,'ABC');
 try{
  const imported=arcadeToPseudocode(files);assert.deepEqual(imported.unsupported,[]);
  const run=await runProgram(imported.code,{frames:0,storage:true,uploads:imported.costumes,frameAuthority:'timed'});
  const first=await restartTimedArcadeRun(run,20);assert.equal(values(run).trace,'A');assert.equal(values(run).ready,false);
  await first.advanceTo(120);assert.equal(values(run).trace,original.trace);assert.equal(values(run).ready,true);assert.deepEqual(run.errors,[]);
  const pending=await restartTimedArcadeRun(run,20);assert.equal(values(run).trace,'A');run.vm.stopAll();await pending.advanceTo(120);assert.equal(values(run).trace,'A');assert.equal(values(run).ready,false);
  await restartTimedArcadeRun(run,120);assert.equal(values(run).trace,original.trace);assert.equal(values(run).ready,true);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
