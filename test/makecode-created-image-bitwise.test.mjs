import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {closedCreatedImageDimensions,createdImageDimensionSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/closed-created-image-dimensions.js';
const source='let markers=[0];function half(input:Image):number{let created=image.create(input.width,input.height);const x=created.width>>1;const y=created.height>>1;created.setPixel(x,y,3);return x*100+y}';
const reads=p=>{const result=[];const visit=n=>{if(!n||typeof n!=="object")return;if(n.type==='Member'&&['width','height'].includes(n.name))result.push(n);Object.values(n).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v))};visit(p);return result};
test('only adjacent exact created Image dimension identities qualify',()=>{
 const program=parseMakeCodeTs(source),proof=closedCreatedImageDimensions(program),dimensions=reads(program).filter(n=>n.object?.name==='created');assert.equal(dimensions.length,2);assert.ok(dimensions.every(n=>proof.has(n)));assert.ok(!proof.has({...dimensions[0]}));assert.ok(!proof.has(reads(parseMakeCodeTs(source))[0]));
 const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/calculate value .* op ">>"/);
});
test('alias, reassignment, property writer, escape and prior side effects retain refusal',()=>{
 for(const code of [source.replace('const x=','let alias=created;const x='),source.replace('created.setPixel','let alias=created;created.setPixel'),source.replace('const x=','unknown(created);const x='),source.replace('const x=','created.width=9;const x='),source.replace('const x=','created=image.create(8,8);const x='),source.replace('const x=','unknown();const x='),source.replace('const x=','function capture(){return created.width}const x='),source.replace('image.create(input.width,input.height)','unknown()')]){
  assert.equal(createdImageDimensionSourceSafe({'main.ts':code}),false,code);const out=arcadeToPseudocode(code);assert.ok(out.unsupported.some(s=>s.includes('Bitwise operation requires proven primitive')),code);
 }
});
test('SDK aliases, hidden writers, reflection and annotations do not establish producer authority',()=>{
 for(const hidden of ['image.create=function(){return null}','let alias=image.create','let alias=image','image["create"]=function(){return null}','Object.assign(image,{})','let reflect=(function(){})["con"+"structor"]','Image.prototype.width=9']){
  const out=arcadeToPseudocode({'main.ts':source,'hidden.ts':hidden,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts'],testFiles:['hidden.ts']})});assert.ok(out.unsupported.some(s=>s.includes('Bitwise operation requires proven primitive')),hidden);
 }
 const out=arcadeToPseudocode('let markers=[0];function half(created:Image):number{const result=created.width>>1;return result}');assert.ok(out.unsupported.length);
});
export {source};

test('shared compiler constants supply no authority to an ambiguous receiver identity',()=>{
 const program=parseMakeCodeTs(source),dimensions=reads(program).filter(n=>n.object?.name==='created');
 const shifts=program.body.find(n=>n.type==='FunctionDeclaration').body.filter(n=>n.type==='Declaration'&&n.decls[0].init?.op==='>>').map(n=>n.decls[0].init);
 shifts[1].right=shifts[0].right;
 assert.ok(dimensions.every(n=>closedCreatedImageDimensions(program).has(n)),'sharing an unrelated immutable Number is not a receiver alias');
 dimensions[1].object=dimensions[0].object;
 const ambiguous=closedCreatedImageDimensions(program);assert.ok(dimensions.every(n=>!ambiguous.has(n)),'shared executable receiver identity has no unique parent');
});

test('unprocessed configured Python or native inputs cannot lend SDK producer authority',()=>{
 for(const [name,text] of [['main.py','pass'],['native.asm','']]){
  const files={'main.ts':source,[name]:text,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})};
  assert.equal(createdImageDimensionSourceSafe(files),false,name);
  assert.ok(arcadeToPseudocode(files).unsupported.some(s=>s.includes('Bitwise operation requires proven primitive')),name);
 }
});
