import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
test('actual String producers support comparison without Scratch case folding',()=>{
 for(const source of ['let result="Z".compare("a");result+=0','let labels=["pear","plum"];let wanted="plum";let result=0;for(let value of labels){result+=wanted.compare(value)}','function identity(v:string):string{return v}let result=identity("Alpha").compare(identity("alpha"))','let _mcCompareLeft1="x";let result=_mcCompareLeft1.compare("y")']){
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[],source);assert.match(out.code,/compare value .* op "<"/);const c=new Creator();c.parse(out.code);assert.deepEqual(c.warnings,[]);
 }
});
test('unknown, mixed, asserted and non-String producers remain refused',()=>{
 for(const source of ['let value:any=unknown();let result=value.compare("a")','let value:any="a";value=2;let result=value.compare("a")','let value:any={};let result=(value as string).compare("a")','let value:any;let result=value.compare("a")','let value:any=null;let result=value.compare("a")','let value:any=true?"a":null;let result=value.compare("a")','let value:any="a";let result=value.compare({})','let result="a".compare()','let result="a".compare("b","c")','function compare(value:string){return value.compare("x")}compare(unknown())']){
  const out=arcadeToPseudocode(source);assert.ok(out.unsupported.some(x=>x.includes('String.compare()')),source);assert.doesNotMatch(out.code,/set _mcCompareLeft/);
 }
});
test('hidden method writers and reflected or aliased receivers retain diagnostics',()=>{
 for(const suffix of ['String.prototype.compare=function(){return 0}','let copy=String;copy.prototype.compare=function(){return 0}','let dynamic=(function(){})["con"+"structor"]']){
  const out=arcadeToPseudocode({'main.ts':'let result="a".compare("b")','hidden.ts':suffix,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts'],testFiles:['hidden.ts']})});assert.ok(out.unsupported.length,suffix);
 }
});
