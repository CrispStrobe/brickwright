import test from 'node:test';import assert from 'node:assert/strict';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';import {importGuiDependency} from './helpers/bw-integrated.mjs';
const code=`DEVICE ARCADE
GLOBAL result
SPRITE Game:
WHEN arcade source starts:
  set result to (arcade call function "first %s" arguments (arcade function argument (arcade ask text "Grade" length 2) rest ("[]")))
DEFINE first (s):
  declare arcade procedure "first %s" parameter "s" as String
  arcade return value (letter 1 of (arcade local s))`;
const value=run=>run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).find(v=>v.name.replace(/^Game_/,'')==='result')?.value;
const answer=async run=>{await stepFrames(run.vm,5,20);run.vm.runtime.emit('ARCADE_PROMPT_INPUT','NPextra');run.vm.runtime.emit('ANSWER','NPextra');await stepFrames(run.vm,5,20);};
const start=source=>runProgram(source,{frames:0,storage:true,countExtensionCalls:false});
const refused=run=>assert.ok(run.errors.some(e=>/length|String|domain|source graph changed|primitive/.test(e)),JSON.stringify(run.errors));
test('direct Code text prompt has bounded String result; altered and reference-valued options refuse',async()=>{
 try{const run=await start(code);await answer(run);assert.equal(value(run),'N');assert.deepEqual(run.errors,[]);
 for(const length of ['4','((0 + (4)))','0','1.5','("2")','(new array reference from ("[2]"))']){const changed=code.replace('length 2','length '+length);assert.notEqual(changed,code);const bad=await start(changed);await assert.rejects(answer(bad),/actual integer length one to three/);assert.ok(bad.vm.runtime.bwArcadeTextPrompt==null);}}
 finally{quitStrandedVMs()}
});
test('foreign prompt delegate and ABA restoration cannot lend a String result',async()=>{
 try{const run=await start(code),dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default,adapter=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')],original=adapter.askForStringLength;adapter.askForStringLength=()=>Promise.resolve('NP');await answer(run);refused(run);adapter.askForStringLength=original;run.vm.stopAll();run.vm.greenFlag();await answer(run);refused(run);assert.notEqual(value(run),'N');}
 finally{quitStrandedVMs()}
});
test('editing a pending prompt length invalidates the actual graph before a constrained consumer',async()=>{
 try{const run=await start(code);await stepFrames(run.vm,5,20);assert.deepEqual(run.vm.runtime.bwArcadeTextPrompt,{answerLength:2,numbersOnly:false});let changed=false;
 for(const target of run.vm.runtime.targets)for(const node of Object.values(target.blocks._blocks||{}))if(node.opcode==='arcade_askForStringLength'){const length=target.blocks.getBlock(node.inputs.LENGTH.block);target.blocks.changeBlock({id:length.id,element:'field',name:'NUM',value:4});changed=true;}
 assert.ok(changed);await answer(run);refused(run);assert.notEqual(value(run),'N');}
 finally{quitStrandedVMs()}
});
