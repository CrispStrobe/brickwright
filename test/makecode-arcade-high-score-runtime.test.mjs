import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const lines=run=>(run.vm.runtime.bwArcadeDeviceState.serial||'').split('\n').filter(Boolean);
const source='settings.writeNumber("high-score",-5);console.log(console.inspect(info.highScore()));let best=info.highScore();console.log(console.inspect(best));settings.writeNumber("high-score",7);let fresh=info.highScore();console.log(console.inspect(fresh));let bits=3;bits=bits&1;console.log(console.inspect(bits));let finished=1;finished+=0';
test('fresh settings-backed Number inspection executes direct and cell values through Code and saved SB3',async()=>{
 const original=await runPxtArcade('let observed="";console.addListener(function(priority,message){observed+=message+"\\n"});'+source,{fakeClock:true,waitForGlobals:{finished:1}});
 const expected=original.observed.split('\n').filter(Boolean);assert.deepEqual(expected,['-5','-5','7','1']);
 try{
  const imported=arcadeToPseudocode(source);assert.deepEqual(imported.unsupported,[]);
  const check=run=>{assert.deepEqual(run.errors,[]);assert.deepEqual(lines(run),expected);assert.equal(values(run).finished,1)};
  const run=await runProgram(imported.code,{frames:5,storage:true,countExtensionCalls:false});check(run);
  check(await runProgram(run.creator.decompile(),{frames:5,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,5);check(fresh);
 }finally{quitStrandedVMs()}
});
test('actual storage read error retires getter lineage before subsequent effects',async()=>{
 try{
  const imported=arcadeToPseudocode('let after=0;let before=1;let best=info.highScore();after=1;after+=0');assert.deepEqual(imported.unsupported,[]);
  const run=await runProgram(imported.code,{frames:0,countExtensionCalls:false});run.vm.runtime.bwArcadeSettingsStorage={getItem(){throw Error('synthetic storage read failure')},setItem(){}};
  await stepFrames(run.vm,5);assert.equal(values(run).before,1);assert.equal(values(run).after,0);assert.ok(run.errors.some(e=>e.includes('synthetic storage read failure')),run.errors.join('\n'));
 }finally{quitStrandedVMs()}
});
test('original SDK raw save comparator matches native score preparation for missing, zero, NaN and low score',async()=>{
 const sdk=await runPxtArcade('settings.remove("high-score");info.setScore(-3);info.player2.setScore(-2);info.saveHighScore();let first=info.highScore();settings.writeNumber("high-score",0);info.saveHighScore();let zero=info.highScore();settings.writeNumber("high-score",NaN);info.saveHighScore();let nanFallback=info.highScore();game.setGameOverScoringType(game.ScoringType.LowScore);settings.remove("high-score");info.setScore(3);info.player2.setScore(2);info.saveHighScore();let low=info.highScore();let done=1;done+=0',{fakeClock:true,waitForGlobals:{done:1}});
 assert.equal(sdk.first,-2);assert.equal(sdk.zero,0);assert.equal(sdk.nanFallback,0);assert.equal(sdk.low,2);
});
test('replacing the high-score fault helper revokes only high-score Number evidence, preserving adjacent arithmetic',async()=>{
 const {importGuiDependency}=await import('./helpers/bw-integrated.mjs');
 const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default;
 try{
  const out=arcadeToPseudocode('let bits=3;let after=0;controller.A.onEvent(ControllerButtonEvent.Pressed,function(){bits=bits&1;after=1});controller.B.onEvent(ControllerButtonEvent.Pressed,function(){console.log(console.inspect(info.highScore()))})');assert.deepEqual(out.unsupported,[]);
  const run=await runProgram(out.code,{frames:3,countExtensionCalls:false});
  const owner=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;owner._highScoreFailure=()=>0;
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,4);assert.equal(values(run).bits,1);assert.equal(values(run).after,1);assert.deepEqual(run.errors,[]);
  run.vm.postIOData('keyboard',{key:'z',isDown:true});await stepFrames(run.vm,4);assert.ok(run.errors.some(e=>e.includes('primitive producer authority')));assert.deepEqual(lines(run),['undefined'],'existing inspection refusal supplies no trusted Number result');
 }finally{quitStrandedVMs()}
});
test('saved settings identity persists across Stop and new VM, while an independent project remains isolated',async()=>{
 const {default:Module}=await import('node:module'),{default:fs}=await import('node:fs'),{default:path}=await import('node:path'),{pathToFileURL}=await import('node:url');
 const {INTEGRATED}=await import('./helpers/bw-integrated.mjs'),{patchArcadeSettingsSB3}=await import('../scripts/lib/arcade-settings-sb3-hooks.mjs');
 const {createRequire}=await import('node:module'),settings=createRequire(import.meta.url)('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/program-settings.js');
 const filename=path.join(INTEGRATED,'node_modules/scratch-vm/src/serialization/sb3.js'),serializer=(await import(pathToFileURL(filename).href)).default;
 const saved={serialize:serializer.serialize,deserialize:serializer.deserialize},patched=new Module(filename);patched.filename=filename;patched.paths=Module._nodeModulePaths(path.dirname(filename));
 const loader=patched.require.bind(patched);patched.require=name=>name==='../extensions/crispstrobe/arcade/program-settings'?settings:loader(name);patched._compile(patchArcadeSettingsSB3(fs.readFileSync(filename,'utf8')),filename);Object.assign(serializer,{serialize:patched.exports.serialize,deserialize:patched.exports.deserialize});
 const records=new Map(),device={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 try{
  const out=arcadeToPseudocode('let best=info.highScore();settings.writeNumber("high-score",best+1)');assert.deepEqual(out.unsupported,[]);
  const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});run.vm.runtime.bwArcadeSettingsStorage=device;await stepFrames(run.vm,5);assert.equal(values(run).best,0);
  const id=run.vm.runtime.getTargetForStage().bwArcadeSettings.id,archive=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());run.vm.stopAll();run.vm.greenFlag();await stepFrames(run.vm,5);assert.equal(values(run).best,1);
  const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();fresh.vm.runtime.bwArcadeSettingsStorage=device;await fresh.vm.loadProject(archive);fresh.vm.greenFlag();await stepFrames(fresh.vm,5);assert.equal(values(fresh).best,2);assert.equal(fresh.vm.runtime.getTargetForStage().bwArcadeSettings.id,id);assert.deepEqual(fresh.errors,[]);
  const independent=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});independent.vm.runtime.bwArcadeSettingsStorage=device;await stepFrames(independent.vm,5);assert.equal(values(independent).best,0);assert.notEqual(independent.vm.runtime.getTargetForStage().bwArcadeSettings.id,id);
 }finally{Object.assign(serializer,saved);quitStrandedVMs()}
});
test('game-over failed write preserves stored record and aborts caller before later callback effects',async()=>{
 const records=new Map();let fail=false;const device={getItem:key=>records.get(key)??null,setItem:(key,value)=>{if(fail)throw Error('synthetic game-over write failure');records.set(key,value)}};
 try{
  const out=arcadeToPseudocode('settings.writeNumber("high-score",4);info.setScore(9);let after=0;controller.A.onEvent(ControllerButtonEvent.Pressed,function(){game.over(true);after=1})');assert.deepEqual(out.unsupported,[]);
  const run=await runProgram(out.code,{frames:0,countExtensionCalls:false});run.vm.runtime.bwArcadeSettingsStorage=device;await stepFrames(run.vm,4);const stage=run.vm.runtime.getTargetForStage(),snapshot=JSON.stringify(stage.bwArcadeSettings),record=stage.bwArcadeSettings;fail=true;
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,5);assert.equal(values(run).after,0);assert.ok(run.errors.some(e=>e.includes('synthetic game-over write failure')));assert.strictEqual(stage.bwArcadeSettings,record);assert.equal(JSON.stringify(stage.bwArcadeSettings),snapshot);
 }finally{quitStrandedVMs()}
});
test('live Number cell mutation and a substituted lookup cannot lend high-score authority to opaque values',async()=>{
 try{
  const out=arcadeToPseudocode('let best=info.highScore();controller.A.onEvent(ControllerButtonEvent.Pressed,function(){console.log(console.inspect(best))})');assert.deepEqual(out.unsupported,[]);
  const run=await runProgram(out.code,{frames:3,countExtensionCalls:false});
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,3);assert.deepEqual(run.errors,[]);assert.deepEqual(lines(run),['0']);
  run.vm.postIOData('keyboard',{key:' ',isDown:false});await stepFrames(run.vm,2);
  const target=run.vm.runtime.targets.find(t=>Object.values(t.variables).some(v=>v.name.replace(/^(?:Game_)+/,'')==='best')),cell=Object.values(target.variables).find(v=>v.name.replace(/^(?:Game_)+/,'')==='best'),consumer=run.vm.runtime.targets.find(t=>!t.isStage&&Object.values(t.blocks._blocks).some(b=>b.opcode==='arcade_inspectValue')),lookup=consumer.lookupVariableById;
  cell.value='opaque-looking:SpriteID';consumer.lookupVariableById=function(id,...rest){return id===cell.id?{...cell,value:0}:lookup.call(this,id,...rest)};
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,3);assert.ok(run.errors.some(e=>e.includes('primitive producer authority')));assert.deepEqual(lines(run),['0','undefined']);
 }finally{quitStrandedVMs()}
});
test('captured Stage/global Number cells are resolved without an overridable lookup',async()=>{
 try{
  const out=arcadeToPseudocode('let best=info.highScore();controller.A.onEvent(ControllerButtonEvent.Pressed,function(){console.log(console.inspect(best))})');assert.deepEqual(out.unsupported,[]);
  let moved=false;const run=await runProgram(out.code,{frames:3,countExtensionCalls:false,observeCreator:creator=>{
   const stage=creator.project.targets.find(t=>t.isStage);moved=Object.values(stage.variables).some(v=>v[0].replace(/^(?:Game_)+/,'')==='best');for(const target of creator.project.targets.filter(t=>!t.isStage))for(const [id,value]of Object.entries(target.variables))if(value[0].replace(/^(?:Game_)+/,'')==='best'){stage.variables[id]=value;delete target.variables[id];moved=true;}
  }});assert.equal(moved,true);
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,3);assert.deepEqual(run.errors,[]);assert.deepEqual(lines(run),['0']);
 }finally{quitStrandedVMs()}
});
test('replacing a captured native variable table during reflection cannot reuse cell evidence',async()=>{
 try{
  const out=arcadeToPseudocode('let best=info.highScore();controller.A.onEvent(ControllerButtonEvent.Pressed,function(){console.log(console.inspect(best))})');
  const run=await runProgram(out.code,{frames:3,countExtensionCalls:false});
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,3);assert.deepEqual(lines(run),['0']);run.vm.postIOData('keyboard',{key:' ',isDown:false});await stepFrames(run.vm,2);
  const owner=run.vm.runtime.targets.find(t=>Object.values(t.variables).some(v=>v.name.replace(/^(?:Game_)+/,'')==='best')),table=owner.variables,[id,cell]=Object.entries(table).find(([,v])=>v.name.replace(/^(?:Game_)+/,'')==='best');let swapped=false;
  owner.variables=new Proxy(table,{getOwnPropertyDescriptor(target,key){if(key===id&&!swapped){swapped=true;owner.variables={...table,[id]:{...cell,value:'opaque-looking:SpriteID'}}}return Reflect.getOwnPropertyDescriptor(target,key)}});
  run.vm.postIOData('keyboard',{key:' ',isDown:true});await stepFrames(run.vm,3);assert.equal(swapped,true);assert.ok(run.errors.some(e=>/producer authority|source graph changed/.test(e)));assert.equal(lines(run).filter(x=>x==='0').length,1);
 }finally{quitStrandedVMs()}
});
test('persistent reporter exports as the original SDK getter and reimports without a cache substitute',async()=>{
 const {projectToArcade}=await import('../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js');
 try{
  const out=arcadeToPseudocode('let best=info.highScore();best+=0');assert.deepEqual(out.unsupported,[]);
  const run=await runProgram(out.code,{frames:3,countExtensionCalls:false});assert.deepEqual(run.errors,[]);
  const exported=projectToArcade(run.creator.project);assert.deepEqual(exported.unsupported,[]);assert.match(exported.ts,/info\.highScore\(\)/);
  assert.deepEqual(arcadeToPseudocode(exported.files).unsupported,[]);
 }finally{quitStrandedVMs()}
});
test('actual archive admission rejects malformed multiple-Stage projects before any getter use',async()=>{
 try{
  const out=arcadeToPseudocode('let best=info.highScore();controller.A.onEvent(ControllerButtonEvent.Pressed,function(){console.log(console.inspect(best))})');
  await assert.rejects(()=>runProgram(out.code,{frames:3,countExtensionCalls:false,observeCreator:creator=>{
   const stage=structuredClone(creator.project.targets.find(t=>t.isStage));stage.name='Other Stage';stage.variables={};stage.blocks={};creator.project.targets.push(stage);
  }}),error=>String(error).includes('validationError')&&String(error).includes('isStage'));
 }finally{quitStrandedVMs()}
});
