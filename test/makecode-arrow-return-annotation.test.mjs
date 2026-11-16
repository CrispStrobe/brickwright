// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
const init=source=>parseMakeCodeTs(source,{retainCallableMetadata:true,parameterDefaults:true}).body[0].decls[0].init;

test('arrow return annotations preserve body, parameter types and callable metadata',()=>{
 for(const [type,expression] of [['string','text + "!"'],['number','text.length'],['void','undefined']]){
  const value=init(`const f=(text:string):${type} => ${expression};`);
  assert.equal(value.type,'FunctionExpression');assert.equal(value.functionKind,'arrow');
  assert.deepEqual([...value.params],['text']);assert.equal(value.paramTypes.text.text,'string');
  assert.equal(value.returnType,type);assert.equal(value.body[0].type,'Return');
 }
 const value=init('const f=(x:number=3):number => {return x+2};');
 assert.equal(value.returnType,'number');assert.equal(value.parameterDefaults.length,1);
 assert.equal(value.body.at(-1).type,'Return');
 assert.equal(init('const f=():number[] => [1,2];').returnType,'number[]');
});

test('ordinary parentheses, unannotated arrows and named function return types keep their grammar',()=>{
 const ast=parseMakeCodeTs('let n=(2+3)*4; const f=(x:number)=>x+1; function g():number {return 7}');
 assert.equal(ast.body[0].decls[0].init.op,'*');
 assert.equal(ast.body[1].decls[0].init.body[0].value.op,'+');
 assert.equal(ast.body[2].returnType,'number');
 for(const source of ['const f=(x:number): => x;', 'const f=(x:number):number x;', 'const f=():()=>number => ()=>1;'])assert.throws(()=>parseMakeCodeTs(source),undefined,source);
});

test('a typed arrow consumed by Arcade produces actual raw Creator blocks without diagnostics',()=>{
 const source='let total=0; [1,2,3].forEach((value:number):void => {total+=value});';
 const translated=arcadeToPseudocode(source);assert.deepEqual(translated.unsupported,[]);
 const creator=new Creator();const project=creator.parse(translated.code);assert.deepEqual(creator.warnings,[]);
 assert.ok(project.targets.some(target=>Object.keys(target.blocks).length>0));
});
