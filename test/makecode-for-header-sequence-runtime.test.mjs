import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,'').replace(/^(x|y)_$/,'$1'),v.value]));
const source=`let trace="";let x=0;let offset=0;let observedInit=0;let observedUpdate=0;
for(x=0,offset=4,observedInit=offset;x<5;x++,offset+=2,observedUpdate=offset){if(x==1)continue;trace+=""+x+":"+offset+";";if(x==3)break}
let untouched=7;for(x=10,untouched=9;x<0;x++,untouched=99){}
let y=0;let targetX=0;let targetY=0;let positions="";
for(x=0;x<3;x++,targetX++){for(y=0,targetY=2;y<3;y++,targetY++){if(y==1)continue;positions+=""+targetX+":"+targetY+";"}}
let done=1;done+=0`;
test('ordered header operations retain evaluation order, break, continue and nested ownership in PXT/native/Code/fresh SB3',async()=>{
 const expected=await runPxtArcade(source,{fakeClock:true});assert.equal(expected.trace,'0:4;2:8;3:10;');assert.equal(expected.observedInit,4);assert.equal(expected.observedUpdate,10);assert.equal(expected.untouched,9);assert.equal(expected.positions,'0:2;0:4;1:2;1:4;2:2;2:4;');
 const check=run=>{assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);for(const n of ['trace','observedInit','observedUpdate','untouched','positions','x','y','targetX','targetY','done'])assert.equal(values(run)[n],expected[n],n)};
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
 try{const run=await runProgram(out.code,{frames:60,storage:true});check(run);const replay=await runProgram(run.creator.decompile(),{frames:60,storage:true});check(replay);
 const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await stepFrames(fresh.vm,60);check(fresh);
 }finally{quitStrandedVMs()}
});
test('a header fault preserves earlier effects and prevents later expressions and the next body',async()=>{
 const out=arcadeToPseudocode('let trace="";let later=0;let dead:Sprite=null;for(let i=0;i<2;trace+="U",dead.setPosition(1,2),later++){trace+="B"};let done=1');assert.deepEqual(out.unsupported,[]);
 try{const run=await runProgram(out.code,{frames:30,storage:true});assert.equal(values(run).trace,'BU');assert.equal(values(run).later,0);assert.notEqual(values(run).done,1);assert.ok(run.errors.length>0);assert.match(JSON.stringify(run.errors),/null|Sprite|sprite/i);assert.deepEqual(run.creator.warnings,[])}finally{quitStrandedVMs()}
});
