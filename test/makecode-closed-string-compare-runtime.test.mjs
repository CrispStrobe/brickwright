import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
test('case, prefixes, numeric text, Unicode and operand effects agree with original PXT through Code and SB3',async()=>{
 const source=`let order=0
let receiver="before"
function left():string{order=order*10+1;return receiver}
function right():string{order=order*10+2;receiver="after";return "before"}
let effect=left().compare(right())
receiver="before"
let captured=receiver.compare(right())
let equal="Pear".compare("Pear")
let upper="Z".compare("a")
let lower="a".compare("Z")
let prefix="ab".compare("abc")
let reverse="abc".compare("ab")
let numeric="10".compare("2")
let unicode="é".compare("z")
let empty="".compare("a")
let labels=["berry","peach"]
let total=0
let matches=0
for(let label of labels){total+="peach".compare(label);if("peach".compare(label)===0){matches+=1}else if("peach".compare(label)===1){}}
let skipped=0
if(false&&left().compare(right())){skipped=1}
let done=1
done+=0`;
 const expected=await runPxtArcade(source,{fakeClock:true});assert.equal(expected.order,122);assert.equal(expected.effect,0);assert.equal(expected.captured,0);assert.equal(expected.upper,-1);assert.equal(expected.lower,1);assert.equal(expected.numeric,-1);assert.equal(expected.matches,1);
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
 const keys=['order','receiver','effect','captured','equal','upper','lower','prefix','reverse','numeric','unicode','empty','total','matches','skipped','done'];
 const check=async run=>{await stepFrames(run.vm,40);for(const key of keys)assert.equal(values(run)[key],expected[key],key);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[])};
 try{
  const run=await runProgram(out.code,{frames:0,storage:true,countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer()),fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await check(fresh);
 }finally{quitStrandedVMs()}
});
