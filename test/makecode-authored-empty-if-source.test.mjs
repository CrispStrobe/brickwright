import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
const compile=source=>{const out=arcadeToPseudocode(source),c=new Creator();c.parse(out.code);return {out,c}};
test('empty branch intent is opt-in parser data and preserves absent versus explicit ELSE',()=>{
 const plain=parseMakeCodeTs('if(true){}').body[0];assert.deepEqual(plain,{type:'If',test:{type:'Boolean',value:true},consequent:[],alternate:null});
 const option={retainAuthoredEmptyBranches:true},absent=parseMakeCodeTs('if(true){}',option).body[0],present=parseMakeCodeTs('if(true){}else{}',option).body[0];assert.equal(absent.bwAuthoredEmptyConsequent,true);assert.equal(absent.alternate,null);assert.equal(absent.bwAuthoredEmptyAlternate,undefined);assert.deepEqual(present.alternate,[]);assert.equal(present.bwAuthoredEmptyAlternate,true);
 const nested=parseMakeCodeTs('if(true){}else if(false){}else{}',option).body[0];assert.equal(nested.bwAuthoredEmptyAlternate,undefined);assert.equal(nested.alternate[0].bwAuthoredEmptyAlternate,true);
});
test('actual authored emptiness survives value normalization and emits explicit PASS only in its branch',()=>{
 for(const source of ['let n=0;if(n){};n=1','let n=1;if(n){}else{};n=2','let n=0;function PASS(){n+=1}if(n){};PASS();','let n=1;if(n){if(n){}else{n=2}}else{};n=3','let calls=0;function check(value:number):number{calls+=1;return value}if(check(1)&&check(0)){};let done=1']){
  const {out,c}=compile(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/PASS/);assert.deepEqual(c.warnings,[]);assert.ok(Object.values(c.project.targets.find(t=>!t.isStage).blocks).some(b=>b.opcode==='control_if'||b.opcode==='control_if_else'));
 }
});
test('branches emptied by unsupported or unknown source retain the original diagnostics and warning',()=>{
 for(const source of ['if(true){unknownBuiltin()}','if(true){debugger;}']){const {out,c}=compile(source);assert.ok(out.unsupported.length,source);assert.ok(!out.code.includes('PASS'),source);assert.ok(c.warnings.some(w=>w.includes('Empty body')),source)}
});

 test('empty branch markers add no VM yield or executable body blocks',()=>{
 const {out,c}=compile('let n=1;if(n){}else{};n=2');assert.deepEqual(out.unsupported,[]);assert.deepEqual(c.warnings,[]);const all=c.project.targets.flatMap(t=>Object.values(t.blocks));const branch=all.find(b=>b.opcode==='control_if_else');assert.ok(branch);assert.equal(branch.inputs.SUBSTACK,undefined);assert.equal(branch.inputs.SUBSTACK2,undefined);assert.ok(!all.some(b=>['control_wait','control_wait_until','control_repeat','control_forever','procedures_call'].includes(b.opcode)));
});
