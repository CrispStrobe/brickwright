import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {playerButtonConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/player-button-registration-source.js';
const call=(player=2,button='B',event='Pressed',handler='function(){hits+=1}')=>`controller.player${player}.onButtonEvent(ControllerButton.${button},ControllerButtonEvent.${event},${handler})`;
const source=body=>'let hits=0;'+body;
test('fixed players and SDK buttons map separately from MP numbering and reuse the existing button hat',()=>{
 for(const player of [1,2,3,4])for(const [button,native]of Object.entries({A:'A',B:'B',Left:'left',Up:'up',Right:'right',Down:'down'})){
  const out=arcadeToPseudocode(source(call(player,button)));assert.deepEqual(out.unsupported,[],`${player}/${button}`);assert.match(out.code,new RegExp(`arcade register player \\(${player}\\) button "${native}" event \\(2049\\)`));assert.match(out.code,/WHEN arcade button handler/);assert.ok(!out.code.includes('register multiplayer button'));
 }
 for(const [event,value]of Object.entries({Pressed:2049,Released:2048,Repeated:2054})){const out=arcadeToPseudocode(source(call(3,'A',event)));assert.deepEqual(out.unsupported,[]);assert.ok(out.code.includes(`event (${value})`));}
});
test('dynamic, non-enum and non-inline or parameterized handlers keep the old refusal',()=>{
 for(const body of [call(0),call(5),call(2,'Menu'),call(2,'A','Unknown'),call(2,'A','Pressed','function(value:number){hits+=value}'),call(2,'A','Pressed','function named(){hits+=1}'),call(2,'A','Pressed','handler'),'let selected=ControllerButton.A;controller.player2.onButtonEvent(selected,ControllerButtonEvent.Pressed,function(){hits+=1})',call().replace('ControllerButton.B','6')]){
  const out=arcadeToPseudocode(source(body));assert.ok(out.unsupported.length,body);assert.ok(!out.code.includes('arcade register player ('),body);
 }
});
test('original AST catches parenthesized SDK and enum assignment/update/delete, aliases, shadows and hidden writers',()=>{
 for(const prefix of ['(ControllerButton.A)=6;','[ControllerButton.A]=[6];','({x:ControllerButton.A}={x:6});','++(ControllerButtonEvent.Pressed);','delete (ControllerButton.A);','(controller.player2.A.repeatDelay)=1;','controller.player2.onButtonEvent=function(){};','let receiver=controller.player2;','let alias=ControllerButton;','let controller:any=0;','control.onEvent=function(){};','class Hidden{constructor(){controller.player2.onButtonEvent=function(){}}}','Object.assign(controller,{});','let acquire=(function(){})["con"+"structor"];']){
  const code=source(prefix+call());assert.equal(playerButtonConfiguredSourceSafe({'main.ts':code}),false,prefix);assert.ok(!arcadeToPseudocode(code).code.includes('arcade register player ('),prefix);
 }
 const base={'main.ts':source(call())};
 for(const [filename,body]of [['hidden.g.ts','(ControllerButton.A)=6'],['hidden.ts','controller.player2.onButtonEvent=function(){}'],['test.ts','control.onEvent=function(){}'],['native.asm',''],['main.py','hits=9']]){
  const files={...base,[filename]:body,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',filename]})};assert.equal(playerButtonConfiguredSourceSafe(files),false,filename);assert.ok(!arcadeToPseudocode(files).code.includes('arcade register player ('),filename);
 }
 const conditional={...base,'conditional.ts':'controller.player2.onButtonEvent=function(){}','pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts','conditional.ts'],fileDependencies:{'conditional.ts':'extra'}})};assert.equal(playerButtonConfiguredSourceSafe(conditional),false);
});
test('only parser-validated erased Sprite/Image array declaration suffixes coexist; runtime indexing stays refused',()=>{
 for(const type of ['Sprite','Image']){const out=arcadeToPseudocode(`let values:${type}[]=[];`+source(call()));assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade register player/);}
 for(const prefix of ['let values=[1];let item=values[0];','let values:any=[];let item=values[0];'])assert.equal(playerButtonConfiguredSourceSafe({'main.ts':prefix+source(call())}),false);
 for(const editor of ['tsprj','blocksprj']){const files={'main.ts':source(call()),'main.py':'hits=9','pxt.json':JSON.stringify({dependencies:{device:'*'},preferredEditor:editor,files:['main.ts','main.py']})};assert.equal(playerButtonConfiguredSourceSafe(files),true);assert.deepEqual(arcadeToPseudocode(files).unsupported,[]);}
});
