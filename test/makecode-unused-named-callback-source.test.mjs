import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {analyseCallableBindings} from '../overlay/scratch-gui/src/lib/bw-makecode/callable-bindings.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
const parse=source=>parseMakeCodeTs(source,{namedFunctionExpressions:true,parameterDefaults:true,retainCallableMetadata:true});
const all=node=>{const result=[];const walk=value=>{if(!value||typeof value!=='object')return;if(value.type)result.push(value);for(const child of Object.values(value))if(child&&typeof child==='object')walk(child)};walk(node);return result};
test('opted-in parser retains local name, defaults and lexical self binding without leaking into the parent',()=>{
 assert.throws(()=>parseMakeCodeTs('let action=function named(){}'),/expected \(/i);
 const program=parse('let named=7;let action=function named(value=named){return function(){return named}};let outside=named');
 const expressions=all(program).filter(n=>n.type==='FunctionExpression'),fn=expressions[0],proof=analyseCallableBindings(program),outer=proof.global.names.get('named');
 assert.equal(fn.selfName,'named');assert.equal(fn.selfNameDefaults[0].value.name,'named');
 const self=proof.scopes.get(fn).parent.names.get('named');assert.equal(self.kind,'function-expression-name');assert.equal(self.declared,true);assert.notStrictEqual(self,outer);
 for(const ref of all(fn).filter(n=>n.type==='Identifier'&&n.name==='named'))assert.strictEqual(proof.references.get(ref),self);
 assert.strictEqual(proof.references.get(program.body.at(-1).decls[0].init),outer);
 const shadow=parse('let action=function same(same:number){return same}'),shadowFn=shadow.body[0].decls[0].init,shadowProof=analyseCallableBindings(shadow);
 assert.equal(shadowProof.references.get(shadowFn.body[0].value).kind,'parameter');
});
test('unused names normalize only at ordinary direct callback sites, retaining outer variables and exact anonymous output',()=>{
 for(const call of ['controller.A.onEvent(ControllerButtonEvent.Pressed,HANDLER)','game.onUpdate(HANDLER)','game.onUpdateInterval(50,HANDLER)','forever(HANDLER)']){
  const named=arcadeToPseudocode('let count=0;'+call.replace('HANDLER','function local_name(){count+=1}'));
  const anonymous=arcadeToPseudocode('let count=0;'+call.replace('HANDLER','function(){count+=1}'));
  assert.deepEqual(named.unsupported,anonymous.unsupported,call);assert.deepEqual(named.unsupported,[]);assert.equal(named.code,anonymous.code,call);
 }
 const source='let same=7;let count=0;controller.A.onEvent(ControllerButtonEvent.Pressed,function same(){count+=1});let observed=same;observed+=0';assert.deepEqual(arcadeToPseudocode(source).unsupported,[]);
});
test('recursive, captured, escaped, default, shadow and reflected names retain refusal',()=>{
 for(const fn of ['function self(){self()}','function self(){self=function(){}}','function self(){let alias=self}','function self(){let nested=function(){return self}}','function self(value=self){}','function self(self:number){console.log(self)}'])
  assert.ok(arcadeToPseudocode('controller.A.onEvent(ControllerButtonEvent.Pressed,'+fn+')').unsupported.some(x=>/Named function expression/.test(x)),fn);
 for(const source of ['let action=function named(){};let label=action.name','observe(function named(){})','(function named(){})()','let game:any={};game.onUpdate(function named(){})','game.onUpdate=function(fn){};game.onUpdate(function named(){})','let alias=game;game.onUpdate(function named(){})','Object.assign(game,{});game.onUpdate(function named(){})','control.internalOnEvent=function(source,value,action){action()};controller.A.onEvent(ControllerButtonEvent.Pressed,function named(){})','let handlers=game.currentScene();game.onUpdate(function named(){})','let context=control.eventContext();game.onUpdate(function named(){})','game.onUpdate(function named(){});let inspect=(function(){})["con"+"structor"]'])
  assert.ok(arcadeToPseudocode(source).unsupported.some(x=>/Named (?:function expression|callback)/.test(x)),source);
});
test('multi-file boundaries parse opted-in callbacks while active Python diagnostics stay present',()=>{
 const files={'pxt.json':JSON.stringify({dependencies:{device:'*'},preferredEditor:'pyprj',files:['extra.ts','main.ts','main.py']}),'extra.ts':'let count=0','main.ts':'game.onUpdate(function update_ui(){count+=1})','main.py':'count = 99\n'};
 const out=arcadeToPseudocode(files);assert.ok(out.unsupported.some(x=>/Python|\.py/.test(x)),out.unsupported.join('\n'));assert.ok(!out.unsupported.some(x=>/expected \(/i.test(x)));assert.match(out.code,/change count by|count/);
});
test('all configured TS/test/conditional and active non-TS sources retain opaque callback refusal',()=>{
 const main='let hits=0;game.onUpdate(function update_ui(){hits+=1})';
 const project=(file,content,options={})=>({'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',file],...options}),'main.ts':main,[file]:content});
 for(const files of [project('hidden.g.ts','game.onUpdate=function(action){console.log(action.name)}'),project('native.asm',''),project('main.py','hits=9'),project('conditional.ts','game.onUpdate=function(action){}',{fileDependencies:{'conditional.ts':'extra'}}),{...project('test.ts','game.onUpdate=function(action){}'), 'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts'],testFiles:['test.ts']})}]){
  const out=arcadeToPseudocode(files);assert.ok(out.unsupported.some(x=>/Named callback requires all configured sources/.test(x)),out.unsupported.join('\n'));assert.ok(!out.code.includes('change hits by 1'));
 }
 for(const editor of ['tsprj','blocksprj'])assert.deepEqual(arcadeToPseudocode(project('main.py','hits=9',{preferredEditor:editor})).unsupported,[]);
 const wrong=project('extra.ts','');wrong['pxt.json']=JSON.stringify({dependencies:{device:'github:example/device#x'},files:['main.ts','extra.ts']});assert.ok(arcadeToPseudocode(wrong).unsupported.some(x=>/Named callback requires/.test(x)));
});

test('nested named-function scopes propagate grandparent captures through each owning closure',()=>{
 const program=parse('function outer(){let value=1;return function middle(){return function inner(){return value}}}');
 const proof=analyseCallableBindings(program),outer=program.body[0],middle=outer.body[1].value,inner=middle.body[0].value;
 const binding=proof.scopes.get(outer).names.get('value');assert.ok(binding);
 assert.ok(proof.scopes.get(middle).captures.has(binding));assert.ok(proof.scopes.get(inner).captures.has(binding));
 assert.strictEqual(proof.references.get(inner.body[0].value),binding);
 assert.equal(proof.scopes.get(middle).parent.names.get('middle').declared,true);
});
