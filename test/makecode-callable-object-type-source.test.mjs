import test from 'node:test';import assert from 'node:assert/strict';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
test('a callable object result belongs to the parameter type and leaves the actual body intact',()=>{
 const tree=parseMakeCodeTs('function accept(handler: () => {}) { let observed=4; observed+=3; return observed } let after=9;');
 const fn=tree.body[0];assert.deepEqual(fn.params,['handler']);assert.equal(fn.paramTypes.handler.text,'()=>{}');assert.equal(fn.body.length,3);assert.equal(fn.body[0].decls[0].name,'observed');assert.equal(fn.body[2].type,'Return');assert.equal(tree.body[1].decls[0].name,'after');
});
test('nested object result braces and sibling parameters retain separate exact type metadata',()=>{
 const tree=parseMakeCodeTs('function accept(handler: () => {value:{count:number}}, next: number) {return next}');const fn=tree.body[0];assert.deepEqual(fn.params,['handler','next']);assert.equal(fn.paramTypes.handler.text,'()=>{value:{count:number}}');assert.equal(fn.paramTypes.next.text,'number');assert.equal(fn.body[0].value.name,'next');
});
test('ordinary named bodies and explicit arrow bodies keep their original delimiters',()=>{
 const tree=parseMakeCodeTs('function ordinary(): number {return 7};let arrow=():number=>{return 8};let callable:()=>{}=()=>9;');assert.equal(tree.body[0].returnType,'number');assert.equal(tree.body[0].body[0].value.value,'7');const decls=tree.body.filter(n=>n.type==='Declaration');assert.equal(decls[0].decls[0].init.body[0].value.value,'8');assert.equal(decls[1].decls[0].typeName,'()=>{}');assert.equal(decls[1].decls[0].init.body[0].value.value,'9');
});
test('parsing callable object types gives no Number authority to open results or object fields',()=>{
 for(const source of ['function accept(handler:()=>{}){return handler()|0};let result=accept(null)', 'function accept(value:{count:number}){return value.count|0};let result=accept(unknownValue)'])assert.ok(arcadeToPseudocode(source).unsupported.length>0,source);
 const values=arcadeToPseudocode('let callback:()=>{}=function(){return 7};let result=""+callback()');assert.ok(values.unsupported.some(x=>x.includes('FunctionExpression as a value')));
 assert.throws(()=>parseMakeCodeTs('let fn=(): (()=>number) => ()=>1'),undefined,'grouped callable arrow returns remain refused');
 assert.throws(()=>parseMakeCodeTs('function accept(handler:()=>{value:number}) {'),/expected/);
});
