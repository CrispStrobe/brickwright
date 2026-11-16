// Direct Code tests: no MakeCode source graph or high-level result loan exists.
import test from 'node:test';import assert from 'node:assert/strict';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
const code=`DEVICE ARCADE
GLOBAL output
SPRITE Game:
WHEN arcade source starts:
  set output to (arcade call function "hold %s" arguments (arcade function argument (calculate value (arcade call function "pick %s" arguments (arcade function argument ((0 + (99))) rest ("[]"))) op "+" with ((0 + (0)))) rest ("[]")))
DEFINE pick (k):
  arcade set local a to (new array reference from ("[]"))
  mutate array reference (arcade local a) op "push" index (0) value ((0 + (2)))
  mutate array reference (arcade local a) op "reverse" index (0) value (0)
  arcade return value (item (arcade local k) of array reference (arcade local a))
DEFINE hold (n):
  declare arcade procedure "hold %s" parameter "n" as Number
  arcade return value (arcade local n)`;
const execute=async source=>{const run=await runProgram(source,{frames:0,countExtensionCalls:false});await stepFrames(run.vm,30,0);return run;};
const refused=run=>assert.ok(run.errors.some(e=>/primitive domain evidence|operation binding|source graph changed/.test(e)),JSON.stringify(run.errors));
test('direct Code retains Undefined until actual numeric arithmetic, with no source type certificate',async()=>{
 try{
  const run=await execute(code);assert.deepEqual(run.errors,[]);const value=run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).find(v=>v.name.replace(/^Game_/,'')==='output')?.value;assert.ok(Number.isNaN(value)||value?.bwNumber==='NaN');
  // Removing +0 must expose Number|Undefined, so a Number formal refuses it.
  const direct=code.replace('calculate value (arcade call function "pick %s" arguments (arcade function argument ((0 + (99))) rest ("[]"))) op "+" with ((0 + (0)))','arcade call function "pick %s" arguments (arcade function argument ((0 + (99))) rest ("[]"))');assert.notEqual(direct,code);const missing=await execute(direct);assert.ok(missing.errors.length);assert.ok(missing.errors.some(e=>/Number|Undefined|domain/.test(e)),JSON.stringify(missing.errors));
  const present=await execute(direct.replace('((0 + (99)))','((0 + (0)))'));assert.ok(present.errors.length);assert.ok(present.errors.some(e=>/Number|Undefined|domain/.test(e)),JSON.stringify(present.errors));
 }finally{quitStrandedVMs()}
});
test('lowered aliases, mixed pushes, wrong operation bindings and initialization/effect edits stay refused',async()=>{
 const edits={
  stringPush:c=>c.replace('value ((0 + (2)))','value ("2")'),
  dormantStringPush:c=>c.replace('  mutate array reference (arcade local a) op "push" index (0) value ((0 + (2)))','  arcade repeat while compare value ((0 + (0))) op "<" with ((0 + (0))):\n    mutate array reference (arcade local a) op "push" index (0) value ("2")'),
  alias:c=>c.replace('  arcade return value (item','  arcade set local b to (arcade local a)\n  arcade return value (item'),
  lateReset:c=>c.replace('  arcade return value (item','  arcade set local a to (null value)\n  arcade return value (item'),
  nonemptyAllocation:c=>c.replace('new array reference from ("[]")','new array reference from ("[2]")'),
  changedReverse:c=>c.replace('op "reverse"','op "pop"'),
  unprovedIndex:c=>c.replace('((0 + (99)))','("99")'),
  hiddenReverseOperand:c=>c.replace('op "reverse" index (0) value (0)','op "reverse" index (0) value ((0 + (1)))'),
  extraEffect:c=>c.replace('  arcade return value (item','  move 1 steps\n  arcade return value (item'),
  beforeAllocation:c=>c.replace('  arcade set local a to (new array reference from ("[]"))\n','').replace('  arcade return value (item','  arcade set local a to (new array reference from ("[]"))\n  arcade return value (item')
 };
 try{for(const [name,edit]of Object.entries(edits)){const changed=edit(code);assert.notEqual(changed,code,name);refused(await execute(changed));}}
 finally{quitStrandedVMs()}
});
test('current genuine Array delegates and graph edits invalidate the lowered proof',async()=>{
 try{
  const run=await execute(code);assert.deepEqual(run.errors,[]);
  const original=run.vm.runtime.getOpcodeFunction('arrays_mutateReference');run.vm.runtime._primitives.arrays_mutateReference=()=>{};
  await assert.rejects(async()=>{run.vm.greenFlag();await stepFrames(run.vm,30,0)},/actual cached caller/);run.vm.runtime._primitives.arrays_mutateReference=original;
  const metadata=await execute(code);assert.deepEqual(metadata.errors,[]);
  const entry=metadata.vm.runtime._blockInfo.find(info=>info.id==='arrays').blocks.find(b=>b.json?.type==='arrays_referenceLength');entry.info.func=()=>0;
  metadata.vm.greenFlag();await stepFrames(metadata.vm,30,0);refused(metadata);
  const facade=await execute(code);assert.deepEqual(facade.errors,[]);facade.vm.runtime._primitives={...facade.vm.runtime._primitives};
  facade.vm.greenFlag();await stepFrames(facade.vm,30,0);refused(facade);
  const trapped=await execute(code);assert.deepEqual(trapped.errors,[]);
  const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default;
  const instance=dispatch.services[trapped.vm.extensionManager._loadedExtensions.get('arrays')]._inst;let getters=0;
  Object.defineProperty(instance,'referenceLength',{get(){getters++;return ()=>0},configurable:true});
  let thrown;try{trapped.vm.greenFlag();await stepFrames(trapped.vm,30,0)}catch(error){thrown=String(error)}
  assert.equal(getters,0);assert.ok([thrown,...trapped.errors].some(e=>/Local Array result operation binding changed/.test(e)),String(thrown)+JSON.stringify(trapped.errors));
  const edited=await execute(code);assert.deepEqual(edited.errors,[]);
  for(const target of edited.vm.runtime.targets)for(const b of Object.values(target.blocks._blocks||{}))if(b.opcode==='arrays_mutateReference'){
   const op=target.blocks.getBlock(b.inputs.OP.block);if(op?.fields?.TEXT?.value==='reverse')target.blocks.changeBlock({id:op.id,element:'field',name:'TEXT',value:'pop'});
  }
  edited.vm.greenFlag();await stepFrames(edited.vm,30,0);refused(edited);
 }finally{quitStrandedVMs()}
});
