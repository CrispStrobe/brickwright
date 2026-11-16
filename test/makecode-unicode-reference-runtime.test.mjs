import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
const source='let 主角=sprites.create(img`1`,SpriteKind.Player);let 跳床=sprites.create(img`2`,SpriteKind.Projectile);主角.x=21;跳床.x=87;let 数値=主角.x+跳床.x;数値+=5;let heroX=主角.x;let padX=跳床.x;let result=数値;let distinct=主角!==跳床?1:0;let done=1;done+=0';
test('Unicode source names preserve distinct Sprite and scalar cells against PXT/native/Code/fresh SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true});assert.deepEqual([expected.heroX,expected.padX,expected.result,expected.distinct],[21,87,113,1]);
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
 const check=async run=>{await stepFrames(run.vm,30);const actual=values(run);for(const key of ['heroX','padX','result','distinct','done'])assert.equal(actual[key],expected[key],key);assert.notEqual(actual['主角'],actual['跳床']);assert.equal(actual['数値'],113);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[])};
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,uploads:out.costumes,countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,uploads:out.costumes,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await check(fresh);
 }finally{quitStrandedVMs()}
});
test('Unicode spelling does not grant opaque values primitive or array authority',()=>{
 for(const source of ['let 値:any={};let result=値 & 1','function open(値:any){return 値[0]}','let items:Sprite[]=[];let alias=items;items=items.filter(v=>v!=null)'])assert.ok(arcadeToPseudocode(source).unsupported.length,source);
});
