import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {numberPromptLengthSourceSafe,literalDefaultTextPrompt,markDefaultTextPrompts} from '../overlay/scratch-gui/src/lib/bw-makecode/number-prompt-length-source.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';

test('literal explicit default twelve preserves the existing one-argument text prompt output',()=>{
 for(const prefix of ['', 'function make(){return 1};let ready=make();']){
  const explicit=arcadeToPseudocode(prefix+'let answer=game.askForString("Input?",12)');
  const omitted=arcadeToPseudocode(prefix+'let answer=game.askForString("Input?")');
  assert.deepEqual(explicit.unsupported,[]);assert.deepEqual(explicit,omitted);
 }
});

test('only original unbound literal defaults receive metadata without changing argument nodes',()=>{
 const program=parseMakeCodeTs('game.askForString("Input?",12)'),call=program.body[0].expr,args=call.args,callee=call.callee;
 assert.equal(literalDefaultTextPrompt(call),true);markDefaultTextPrompts(program,true);
 assert.equal(call.bwPxtDefaultTextPrompt,true);assert.strictEqual(call.args,args);assert.strictEqual(call.callee,callee);
 const shadow=parseMakeCodeTs('let game=1;game.askForString("Input?",12)');markDefaultTextPrompts(shadow,true);
 assert.equal(shadow.body[1].expr.bwPxtDefaultTextPrompt,undefined);
});

test('other lengths, dynamic arguments and explicit keyboard options retain their refusal',()=>{
 for(const args of ['"Input?",11','"Input?",13','"Input?",0','"Input?",-12','"Input?",6+6','"Input?",+12','"Input?",limit','question,12','"Input?",12,false','"Input?",12,true']){
  const result=arcadeToPseudocode(`let limit=12;let question="Input?";let answer=game.askForString(${args})`);
  assert.ok(result.unsupported.some(reason=>reason.includes('length limit')),args);
 }
});

test('SDK writers, aliases, hidden source and reflection preserve explicit-default refusal',()=>{
 const call='let answer=game.askForString("Input?",12)';
 for(const prefix of ['let game=1;','function hidden(game:any){game.askForString("x",12)}',
  'game.askForString=function(){return "changed"};','let alias=game;','let alias=game.askForString;',
  'game["askForString"]=function(){return "changed"};','console.inspect=function(){return "changed"};',
  'String.prototype.substr=function(){return "changed"};','Object.assign(game,{});',
  'class Hidden{constructor(){game.askForString=function(){return "changed"}}}']){
  assert.equal(numberPromptLengthSourceSafe({'main.ts':prefix+call}),false,prefix);
  const rejected=arcadeToPseudocode(prefix+call);
  assert.ok(rejected.unsupported.some(reason=>reason.includes('length limit')),prefix);
  assert.deepEqual(rejected,arcadeToPseudocode(prefix+call.replace(',12)',',11)')),'unsafe output stays on the original unsupported-options path');
 }
 for(const [name,text] of [['hidden.g.ts','game.askForString=function(){return "changed"}'],['native.asm','nop'],['main.py',''],['hidden.d.ts','declare const game:any;']]){
  const files={'main.ts':call,[name]:text,'pxt.json':JSON.stringify({files:['main.ts',name]})};
  assert.equal(numberPromptLengthSourceSafe(files),false,name);assert.ok(arcadeToPseudocode(files).unsupported.some(reason=>reason.includes('length limit')),name);
 }
});
