import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {withClosedSpriteNullFilters,lowerClosedSpriteNullFilters,currentClosedSpriteNullFilter,bindClosedSpriteNullFilterConsumer,emitClosedSpriteNullFilter} from '../overlay/scratch-gui/src/lib/bw-makecode/closed-sprite-null-filter.js';
const source='let items:Sprite[]=[];let a=sprites.create(img`1`,SpriteKind.Player);items.push(a);for(let i=0;i<items.length;i++){if(i===0)items[i]=null}items=items.filter(value=>value!=null);let count=items.length';
const refused=code=>{const out=arcadeToPseudocode(code);assert.ok(out.unsupported.length,typeof code==='string'?code:JSON.stringify(code));assert.ok(!out.code.includes('without null'))};
test('owned dense Sprite/null source gets a single native reporter, without callback or loop expansion',()=>{
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.equal((out.code.match(/without null/g)||[]).length,1);
 const empty=arcadeToPseudocode('let items:Sprite[]=[];items=items.filter(value=>value!=null)');assert.deepEqual(empty.unsupported,[]);assert.match(empty.code,/without null/);
});
test('aliases, holes, unknown producers, writes and open receivers remain unsupported',()=>{
 for(const code of [source+';let alias=items',source.replace('items.push(a)','items.push(null)'),source.replace('sprites.create(img`1`,SpriteKind.Player)','unknown()'),source.replace('items[i]=null','items[99]=null'),source.replace('items[i]=null','delete items[i]'),source+';items.length=100',source.replace('items[i]=null','items[i+1]=null'),source+';items=[]',source.replace('if(i===0)items[i]=null','pause(1);if(i===0)items[i]=null'),source.replace('if(i===0)items[i]=null','control.waitMicros(1);if(i===0)items[i]=null'),source.replace('items.push(a)','unknownConsumer(items)'),source.replace('let items:Sprite[]=[]','let items:Sprite[]=unknown()'),'function open(items:Sprite[]){items=items.filter(v=>v!=null)}'])refused(code);
});
test('callback effects, captures, aliases, altered predicates and method/prototype writers are not generalized',()=>{
 for(const callback of ['value=>{count++;return value!=null}','value=>value!==undefined','value=>value!=0','value=>value','value=>unknown(value)','(value,index)=>value!=null','(value=unknown())=>value!=null','value=>value!=wanted'])refused(source.replace('value=>value!=null',callback));
 for(const hidden of ['Array.prototype.filter=function(){return []}','let method=items.filter','let alias=items','let reflect=(function(){})["con"+"structor"]'])refused({'main.ts':source,'hidden.ts':hidden,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts'],testFiles:['hidden.ts']})});
});
test('source identity, stale input and reentrant scopes cannot lend another consumer an array fact',()=>{
 const files={'main.ts':source};let node;
 withClosedSpriteNullFilters(files,()=>{const p=lowerClosedSpriteNullFilters(parseMakeCodeTs(source));const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='ClosedSpriteNullFilter')node=n;Object.values(n).forEach(v=>Array.isArray(v)?v.forEach(walk):walk(v))};walk(p);assert.ok(node);assert.equal(currentClosedSpriteNullFilter(node),true);assert.equal(currentClosedSpriteNullFilter({...node,receiver:{type:'Identifier',name:'other'}}),false);withClosedSpriteNullFilters({'main.ts':source+';let alias=items'},()=>assert.equal(!!currentClosedSpriteNullFilter(node),false));assert.equal(currentClosedSpriteNullFilter(node),true);files['hidden.ts']='Array.prototype.filter=function(){return []}';assert.equal(!!currentClosedSpriteNullFilter(node),false)});
 assert.equal(!!currentClosedSpriteNullFilter(node),false);
});

test('actual lowered input and final receiver/writer descriptors retain their own authority',()=>{
 withClosedSpriteNullFilters({'main.ts':source},()=>{
  const alien=parseMakeCodeTs(source+';let alias=items');assert.equal(lowerClosedSpriteNullFilters(alien),alien);
  const program=lowerClosedSpriteNullFilters(parseMakeCodeTs(source));let node;
  const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='ClosedSpriteNullFilter')node=n;Object.values(n).forEach(v=>Array.isArray(v)?v.forEach(walk):walk(v))};walk(program);assert.ok(node);
  const notes=[],consumer={provenArrayReferences:new WeakSet([node.receiver]),expr:n=>n.name,note:n=>notes.push(n)};
  bindClosedSpriteNullFilterConsumer(consumer,program);assert.equal(emitClosedSpriteNullFilter(consumer,node),'arcade sprite array (items) without null');
  const copy={...node,receiver:{...node.receiver}};assert.equal(emitClosedSpriteNullFilter(consumer,copy),'undefined value');
  program.body[0].decls[0].init={type:'Array',items:[{type:'Null'}]};assert.equal(emitClosedSpriteNullFilter(consumer,node),'undefined value');assert.equal(notes.length,2);
 });
});
