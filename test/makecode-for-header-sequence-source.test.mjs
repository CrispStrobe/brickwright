import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {lowerSourceLoopControl} from '../overlay/scratch-gui/src/lib/bw-makecode/lower-source-loop-control.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
test('for header commas retain ordered discarded expressions and lower before value staging',()=>{
 const tree=parseMakeCodeTs('let x=0;let offset=0;for(x=0,offset=4;x<3;x++,offset++){if(x==1)continue}');
 const loop=tree.body.at(-1);assert.equal(loop.type,'For');assert.equal(loop.init.type,'Block');
 assert.deepEqual(loop.init.body.map(s=>s.expr.left.name),['x','offset']);
 assert.equal(loop.update.type,'ForHeaderSequence');assert.deepEqual(loop.update.expressions.map(e=>e.argument.name),['x','offset']);
 const lowered=lowerSourceLoopControl(tree);assert.ok(!JSON.stringify(lowered).includes('ForHeaderSequence'));
 const result=arcadeToPseudocode('let x=0;let offset=0;for(x=0,offset=4;x<3;x++,offset++){if(x==1)continue}');assert.deepEqual(result.unsupported,[]);
});
test('header list grammar does not widen comma values, tests or malformed lists',()=>{
 for(const text of ['let x=(1,2)','for(let x=0;x<3,x<4;x++){}','for(x=0,;x<3;x++){}','for(x=0;x<3;x++,){}','for(x=0;x<3;,x++){}'])assert.throws(()=>parseMakeCodeTs(text),undefined,text);
});
test('argument commas, declaration lists, arrays and single-update loops keep their original shape',()=>{
 const tree=parseMakeCodeTs('let x=0,y=1;for(let z=0;z<3;z++){f(x,y);let a=[x,y]}');
 assert.equal(tree.body[0].decls.length,2);const loop=tree.body[1];assert.equal(loop.init.type,'Declaration');assert.equal(loop.update.type,'Update');assert.equal(loop.body[0].expr.args.length,2);assert.equal(loop.body[1].decls[0].init.items.length,2);
});
test('opaque property producers remain refused inside ordered headers',()=>{
 const out=arcadeToPseudocode('let n=0;let object={value:1};for(n=0;n<2;n++,n+=object.value){}');assert.ok(out.unsupported.length>0);
});
