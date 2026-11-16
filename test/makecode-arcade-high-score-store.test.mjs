import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';
function setup(){
 const stage={isStage:true},runtime=new EventEmitter(),device=new Map();let fail=false;
 runtime.getTargetForStage=()=>stage;runtime.startHats=()=>[];
 runtime.bwArcadeSettingsStorage={getItem:key=>device.get(key)??null,setItem:(key,value)=>{if(fail)throw Error('device write failed');device.set(key,value)}};
 const adapter=new(loadExtensionClass('arcade'))(runtime),owner=adapter._inst;
 return {stage,runtime,device,adapter,owner,store:()=>owner._settingsStore(),fail:()=>{fail=true}};
}
test('getter is fresh, shares the public byte-backed key and preserves falsy Number fallback',()=>{
 const f=setup();assert.equal(f.adapter.highScore({}),0);
 for(const value of [-5,7,0,-0,NaN,Infinity]){f.store().call('writeNumber','high-score',value);assert.equal(f.adapter.highScore({}),value||0);}
 f.store().call('remove','high-score');assert.equal(f.adapter.highScore({}),0);
 f.store().call('writeNumber','high-score',9);f.store().call('clear');assert.equal(f.adapter.highScore({}),0);
});
test('game-over raw comparator preserves missing, zero, NaN, strict ties, low-score and first-player selection',()=>{
 const f=setup(),prepare=(scores,win=true,judged=true)=>f.owner._prepareGameOverScores(judged,win,scores.map((score,i)=>({number:i+1,score})));
 let result=prepare([-3,-2]);assert.equal(result.winner.number,2);assert.equal(f.adapter.highScore({}),-2);
 result=prepare([-2,-2]);assert.equal(result.winner.number,1);assert.equal(f.adapter.highScore({}),-2);
 f.store().call('writeNumber','high-score',0);prepare([-1]);assert.equal(f.adapter.highScore({}),0);
 f.store().call('writeNumber','high-score',NaN);prepare([9]);assert.ok(Number.isNaN(f.store().call('readNumber','high-score')));assert.equal(f.adapter.highScore({}),0);
 f.adapter.setGameOverScoringType({TYPE:'LowScore'});f.store().call('remove','high-score');prepare([3,2,2]);assert.equal(f.adapter.highScore({}),2);
 result=prepare([2,2]);assert.equal(result.winner.number,1);assert.equal(f.adapter.highScore({}),2);
 f.store().call('writeNumber','high-score',7);prepare([1],false);assert.equal(f.adapter.highScore({}),7);
 let reads=0;const original=f.owner._settingsStore;f.owner._settingsStore=()=>{reads++;throw Error('must not read')};
 result=prepare([1],true,false);assert.equal(reads,0);assert.equal(result.previousBest,false);assert.equal(result.winner,null);f.owner._settingsStore=original;
});
test('failed byte-store commit preserves live/project/device state and propagates error before completion',()=>{
 const f=setup();f.store().call('writeNumber','high-score',4);const record=f.stage.bwArcadeSettings,snapshot=JSON.stringify(record),device=JSON.stringify([...f.device]);f.fail();
 assert.throws(()=>f.owner._prepareGameOverScores(true,true,[{number:1,score:9}]),/device write failed/);
 assert.strictEqual(f.stage.bwArcadeSettings,record);assert.equal(JSON.stringify(f.stage.bwArcadeSettings),snapshot);assert.equal(JSON.stringify([...f.device]),device);assert.equal(f.adapter.highScore({}),4);
});
