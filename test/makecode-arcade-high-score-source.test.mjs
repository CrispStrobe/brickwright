import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {highScoreConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/high-score-source.js';
test('fresh high score uses Number reporter with default, comparison and primitive inspection',()=>{
 for(const source of ['let best=info.highScore();best+=0','let best=info.highScore();console.log(console.inspect(best))','if(info.score()>info.highScore()){info.changeScoreBy(1)}']){
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade high score/);
 }
});
test('ordinary user setting operations coexist without replacing builtin getter methods',()=>{
 for(const operation of ['settings.writeNumber("high-score",-2)','settings.remove("high-score")','settings.clear()']){
  const out=arcadeToPseudocode(operation+';let best=info.highScore();best+=0');assert.deepEqual(out.unsupported,[]);
 }
});
test('source aliases, namespace writers, reflection and hidden configured sources preserve refusal',()=>{
 const call='let best=info.highScore()';
 for(const prefix of ['let info:any=1;','info.highScore=function(){return 1};','let alias=info;',
  'settings.readNumber=function(){return 1};','let alias=settings.readNumber;',
  'settings["readNumber"]=function(){return 1};','class Hidden{constructor(){settings.readNumber=function(){return 1}}}',
  'Object.assign(settings,{});','let acquire=(function(){})["con"+"structor"];']){
  assert.equal(highScoreConfiguredSourceSafe({'main.ts':prefix+call}),false,prefix);assert.ok(arcadeToPseudocode(prefix+call).unsupported.some(x=>x.includes('info.highScore')));
 }
 for(const name of ['hidden.g.ts','native.asm','hidden.d.ts']){
  const files={'main.ts':call,[name]:'','pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})};assert.equal(highScoreConfiguredSourceSafe(files),false);
 }
 for(const arg of ['1','undefined'])assert.ok(arcadeToPseudocode(`let best=info.highScore(${arg})`).unsupported.some(x=>x.includes('info.highScore')));
});
