import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {gameResetSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/game-reset-source.js';
test('standalone unchanged game.reset uses the distinct nonreturning command',()=>{
 for(const source of ['game.reset();','function restart(){game.reset()}controller.A.onEvent(ControllerButtonEvent.Pressed,function(){restart()})']){
  const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade reset game/);
 }
});
test('reset values, arguments and SDK mutations retain refusal',()=>{
 for(const source of ['game.reset(1)','let result=game.reset()','let game:any=0;game.reset()','game.reset=function(){};game.reset()','let alias=game;game.reset()','let control:any=0;game.reset()','control.reset=function(){};game.reset()','let alias=control.reset;game.reset()','let alias=control;game.reset()','(game.reset)=function(){};game.reset()','class Hidden{constructor(){game.reset=function(){}}}game.reset()','let f=(function(){})["constructor"];game.reset()']){
  const out=arcadeToPseudocode(source);assert.ok(out.unsupported.length,source);assert.ok(!out.code.includes('arcade reset game'),source);
 }
});
test('all configured source writers and active Python remain refused',()=>{
 for(const [name,body]of [['hidden.g.ts','game.reset=function(){}'],['hidden-control.ts','control.reset=function(){}'],['hidden-alias.ts','let reset=control.reset'],['test.ts','game.reset=function(){}'],['native.asm',''],['main.py','value=7']]){
  const files={'main.ts':'game.reset()',[name]:body,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})};assert.equal(gameResetSourceSafe(files),false,name);assert.ok(!arcadeToPseudocode(files).code.includes('arcade reset game'),name);
 }
});
