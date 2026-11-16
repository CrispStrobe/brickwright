import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {playerConnectionConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/player-connection-registration-source.js';
import {playerButtonConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/player-button-registration-source.js';
const call=(player=2,event='Connected',handler='function(){hits+=1}')=>`controller.player${player}.onEvent(ControllerEvent.${event},${handler})`;
const source=body=>'let hits=0;'+body;
const refused=files=>{const out=arcadeToPseudocode(files);assert.ok(out.unsupported.length,typeof files==='string'?files:JSON.stringify(files));assert.ok(!out.code.includes('arcade register control event source (arcade controller event source player'))};
test('fixed player connection enums reuse the existing control-event source, default flags and hat',()=>{
 for(const p of [1,2,3,4])for(const [event,value]of [['Connected',1],['Disconnected',2]]){
  const out=arcadeToPseudocode(source(call(p,event)));assert.deepEqual(out.unsupported,[]);assert.ok(out.code.includes(`arcade register control event source (arcade controller event source player ${p}) value (${value}) flags (16)`));assert.match(out.code,/WHEN arcade control event handler/);
 }
});
test('dynamic receivers/events, open or parameterized callbacks and wrong arity remain refused',()=>{
 for(const body of [call(0),call(5),call(2,'Unknown'),call(2,'Connected','handler'),call(2,'Connected','function named(){hits++}'),call(2,'Connected','function(value:number){hits+=value}'),call().replace('ControllerEvent.Connected','1'),call().replace('Connected,','Connected,1,'),call().replace('controller.player2','controller["player2"]'),'let selected=controller.player2;'+call().replace('controller.player2','selected'),'let event=ControllerEvent.Connected;'+call().replace('ControllerEvent.Connected','event')])refused(source(body));
});
test('complete configured source refuses SDK/enum writers, aliases, shadows and ambient reflection',()=>{
 for(const prefix of ['controller.player2.onEvent=function(){};','(ControllerEvent.Connected)=9;','[ControllerEvent.Connected]=[1];','++(ControllerEvent.Connected);','delete (ControllerEvent.Connected);','let alias=controller.player2;','let ControllerEvent:any={};','let controller:any=0;','control.onEvent=function(){};','let id=controller.player2.id;controller.player2.id=1;','Object.assign(controller,{});','let acquire=(function(){})["con"+"structor"];']){
  const code=source(prefix+call());assert.equal(playerConnectionConfiguredSourceSafe({'main.ts':code}),false,prefix);refused(code);
 }
 for(const [name,hidden]of [['hidden.ts','controller.player1.onEvent=function(){}'],['hidden.g.ts','ControllerEvent.Connected=2'],['hidden.d.ts','declare let ControllerEvent:any'],['native.asm',''],['main.py','hits=5']]){
  const files={'main.ts':source(call()),[name]:hidden,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})};assert.equal(playerConnectionConfiguredSourceSafe(files),false,name);refused(files);
 }
});
test('connection admission does not widen the existing player-button source guard',()=>{
 const files={'main.ts':source(call())};assert.equal(playerConnectionConfiguredSourceSafe(files),true);assert.equal(playerButtonConfiguredSourceSafe(files),false);
 const code=source(call())+';control.raiseEvent(controller.player2.id,ControllerEvent.Connected)';assert.equal(playerConnectionConfiguredSourceSafe({'main.ts':code}),true);
});
