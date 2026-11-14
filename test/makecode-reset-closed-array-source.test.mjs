import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {gameResetSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/game-reset-source.js';
import {closedResetStringArraySyntax} from '../overlay/scratch-gui/src/lib/bw-makecode/reset-closed-string-array-source.js';
import {playerButtonConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/player-button-registration-source.js';
import {source} from './fixtures/reset-closed-string-array.mjs';

const files=code=>({'main.ts':code});
const refused=code=>{assert.equal(gameResetSourceSafe(files(code)),false,code);assert.ok(!arcadeToPseudocode(code).code.includes('arcade reset game'))};
test('reset alone admits a closed actual String-array search and erased formal any[]',()=>{
 for(const code of [source,source.replace('slot<values.length','slot<=values.length-1').replace('===wanted','==wanted'),source.replace('let found=','chosen=game.askForString("Choose a tone");let found=')]){
  assert.equal(gameResetSourceSafe(files(code)),true);assert.equal(playerButtonConfiguredSourceSafe(files(code)),false,'per-player admission remains unchanged');const out=arcadeToPseudocode(code);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade reset game/);
 }
});
test('array/function aliases, escapes, writers and multiple call sites retain refusal',()=>{
 for(const suffix of ['let alias=labels;','labels[0]="other";','labels.push("other");','unknownConsumer(labels);','let alias=locate;','let again=locate(chosen,labels);','locate=function(){return 0};'])refused(source+';'+suffix);
 for(const replacement of ['values[slot]="other";','unknownConsumer(values);','let escape=values;','values.length=0;','slot=1;'])refused(source.replace('if(values[slot]',replacement+'if(values[slot]'));
});
test('annotations, non-String producers, numeric-key changes and opaque helper bodies supply no authority',()=>{
 for(const code of [source.replace('["violet","gold","silver"]','[{},"gold"]'),source.replace('["violet","gold","silver"]','[function(){return "gold"}]'),source.replace('["violet","gold","silver"]','[1,2,3]'),source.replace('["violet","gold","silver"]','unknownProducer()'),source.replace('let chosen="gold"','let chosen=unknownProducer()'),source.replace('values[slot]','values[chosen]'),source.replace('slot++','slot+=1'),source.replace('return -1','unknownEffect();return -1'),source+';chosen=unknownProducer()',source+';chosen++',source+';[chosen]=[unknownProducer()]'])refused(code);
});
test('full configured source still refuses SDK writers, aliases, hidden callers and active inputs',()=>{
 for(const body of ['game.reset=function(){}','control.reset=function(){}','game.askForString=function(){return "gold"}','let alias=control.reset','let indirect=locate','let again=locate(chosen,labels)','let duplicate=labels']){
  const map={'main.ts':source,'hidden.ts':body,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts'],testFiles:['hidden.ts']})};assert.equal(gameResetSourceSafe(map),false,body);assert.ok(!arcadeToPseudocode(map).code.includes('arcade reset game'));
 }
 for(const [name,body]of [['main.py','pass'],['native.asm','']]){const map={'main.ts':source,[name]:body,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})};assert.equal(gameResetSourceSafe(map),false,name)}
});
test('dynamic reflection and forged erased forms cannot use the selected read exception',()=>{
 for(const code of [source+';let acquire=(function(){})["con"+"structor"]',source.replace('values[slot]','values[slot]["con"+"structor"]'),source.replace('values:any[]','values:any[][]'),source.replace('values:any[]','values:unknown[]'),source.replace('values[slot]','values[(slot=1)]'),source+';Object.assign(game,{})',source+';(game.reset)=function(){}',source+';delete (control.reset)'])refused(code);
});

test('forged exception maps and tokens cannot bypass the complete source census',()=>{
 const unsafe=source+';let reflect=(function(){})["con"+"structor"]',map=files(unsafe),forged=new Map([['main.ts',{source:unsafe,indices:new Set(Array.from({length:2000},(_,i)=>i))}]]);
 for(const fake of [forged,{},Object.freeze({}),{source:unsafe,indices:forged}])assert.equal(playerButtonConfiguredSourceSafe(map,fake),false);
 const owned={'main.ts':source,'hidden.ts':'','pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts','hidden.ts']})},proof=closedResetStringArraySyntax(owned);
 assert.ok(proof);assert.equal(playerButtonConfiguredSourceSafe(owned,proof),true);assert.equal(playerButtonConfiguredSourceSafe(owned,new Proxy(proof,{})),false);
 owned['hidden.ts']='let escaped=labels';assert.equal(playerButtonConfiguredSourceSafe(owned,proof),false,'held authority cannot survive an added array escape');
 assert.equal(playerButtonConfiguredSourceSafe({...owned,'hidden.ts':''},proof),false,'another file object cannot borrow authority');
});
