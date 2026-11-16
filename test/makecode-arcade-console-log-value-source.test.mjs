import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {consoleLogValueConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/lower-console-log-values.js';
const setup='let actor=sprites.create(img`1`,SpriteKind.Player);';
const refused=source=>assert.ok(arcadeToPseudocode(source).unsupported.some(x=>x==='console.logValue()'),source);

test('literal labels format actual Sprite x/y exactly through existing log and inspection words',()=>{
 for(const property of ['x','y'])for(const label of ['axis','','__proto__']){
  const out=arcadeToPseudocode(setup+`console.logValue(${JSON.stringify(label)},actor.${property})`);assert.deepEqual(out.unsupported,[]);
  assert.match(out.code,/arcade log/);assert.match(out.code,/arcade inspect value/);assert.equal(out.code.split(`arcade property ${property} of`).length-1,1);
  if(label)assert.ok(out.code.includes(label+': '));else assert.doesNotMatch(out.code,/: /);
 }
});

test('unproved, nullable, opaque, effectful or out-of-slice values retain refusal',()=>{
 for(const source of [
  'let actor:Sprite;console.logValue("x",actor.x)',
  'let actor:Sprite=null;console.logValue("x",actor.x)',
  'let actor:any={x:1};console.logValue("x",actor.x)',
  setup+'let label="x";console.logValue(label,actor.x)',
  setup+'console.logValue("x",actor.x,1)',
  setup+'console.logValue("x",actor.vx)',
  setup+'function owner(){return actor}console.logValue("x",owner().x)',
  setup+'function value(){return 1}console.logValue("x",value())',
  setup+'console.logValue("x",-0)',setup+'console.logValue("x",NaN)',setup+'console.logValue("x",null)',
  setup+'actor=null;console.logValue("x",actor.x)'
 ])refused(source);
});

test('configured console writers, aliases, hidden sources and reflection keep original refusal',()=>{
 const call=setup+'console.logValue("x",actor.x)';
 for(const prefix of ['let console:any=1;','function hidden(console:any){console.logValue("x",1)}',
  'console.logValue=function(){};','console.log=function(){};','console.inspect=function(){return "changed"};',
  'let alias=console;','let alias=console.logValue;','console["logValue"]=function(){};',
  'Object.assign(console,{});','class Hidden{constructor(){console.logValue=function(){}}}',
  'let acquire=(function(){})["con"+"structor"];']){
  assert.equal(consoleLogValueConfiguredSourceSafe({'main.ts':prefix+call}),false,prefix);refused(prefix+call);
 }
 for(const [name,text]of [['hidden.g.ts','console.logValue=function(){}'],['hidden.ts','console.inspect=function(){return "changed"}'],['native.asm','nop'],['main.py','']]){
  const files={'main.ts':call,[name]:text,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})};
  assert.equal(consoleLogValueConfiguredSourceSafe(files),false,name);assert.ok(arcadeToPseudocode(files).unsupported.includes('console.logValue()'));
 }
});
