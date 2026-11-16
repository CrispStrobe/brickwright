import test from 'node:test';import assert from 'node:assert/strict';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';

test('metadata-only diagnostics reset needs no invented runtime or display owner',()=>{
 const Arcade=loadExtensionClass('arcade');
 for(const runtime of [undefined,null]){const extension=new Arcade(runtime),owner=extension._inst;assert.equal(extension.getInfo().id,'arcade');assert.doesNotThrow(()=>owner._gameStats.reset());assert.equal(owner._gameStats.enabled,false);assert.equal(owner._gameStats.text,'');}
});

test('actual native frame diagnostics still publish to the genuine runtime after metadata-only guard',async()=>{
 try{const run=await runProgram('DEVICE ARCADE\nSPRITE Game:\nWHEN arcade source starts:\n  arcade game stats enabled',{frames:0,countExtensionCalls:false});const publications=[];run.vm.runtime.on('ARCADE_DEVICE_STATS',value=>publications.push(value));
  await stepFrames(run.vm,40,20);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);assert.ok(publications.length>30);assert.match(run.vm.runtime.bwArcadeStatsText,/^fps:(?:Infinity|[0-9]+(?:\.[0-9])?) sprites:0$/);assert.equal(publications.at(-1),run.vm.runtime.bwArcadeStatsText);const held=run.vm.runtime.bwArcadeStatsText;run.vm.stopAll();const stoppedPublications=publications.length;
  await stepFrames(run.vm,5,20);assert.equal(publications.length,stoppedPublications,'Stop must prevent further completed-frame publications');assert.equal(run.vm.runtime.bwArcadeStatsText,held,'Stop retains the displayed sample');
  run.vm.greenFlag();assert.equal(run.vm.runtime.bwArcadeStatsText,'','actual project restart resets diagnostics before the next frame');assert.equal(publications.at(-1),'');
  await stepFrames(run.vm,40,20);assert.ok(publications.length>stoppedPublications+30);assert.match(run.vm.runtime.bwArcadeStatsText,/^fps:(?:Infinity|[0-9]+(?:\.[0-9])?) sprites:0$/);assert.equal(publications.at(-1),run.vm.runtime.bwArcadeStatsText);assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs();}
});
