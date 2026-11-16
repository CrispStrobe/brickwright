// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
const ops=project=>project.targets.flatMap(target=>Object.values(target.blocks)).filter(Boolean);
const compile=code=>{const creator=new Creator(),project=creator.parse(code);assert.deepEqual(creator.warnings,[],code);return{creator,project};};
test('four genuine historical projects translate their five receiver callbacks and compile them',()=>{
 let hats=0;
 for(const name of ['runner','jumper','shooter','racer']){
  const source=readFileSync(new URL(`fixtures/makecode/arcade-instance-overlap-${name}.ts`,import.meta.url),'utf8');
  const translated=arcadeToPseudocode(source);assert.deepEqual(translated.unsupported,[],name);
  const {creator,project}=compile(translated.code),blocks=ops(project);
  const handlers=blocks.filter(b=>b.opcode==='arcade_whenRegisteredInstanceOverlap');hats+=handlers.length;
  assert.equal(blocks.filter(b=>b.opcode==='arcade_registerInstanceOverlapHandler').length,handlers.length);
  const repeated=compile(creator.decompile(project));
  assert.equal(ops(repeated.project).filter(b=>b.opcode==='arcade_whenRegisteredInstanceOverlap').length,handlers.length);
 }
 assert.equal(hats,5);
});
test('receiver callback binds the other sprite and unsupported parameter domains stay diagnosed',()=>{
 const prefix='let s=sprites.create(img`1`,SpriteKind.Player);';
 const good=arcadeToPseudocode(prefix+'s.onOverlap(function(other:Sprite){other.destroy()})');
 assert.deepEqual(good.unsupported,[]);assert.match(good.code,/set local other to arcade event second/);compile(good.code);
 for(const declaration of ['other','other:number','other:Sprite[]','a:Sprite,b:Sprite']){
  const bad=arcadeToPseudocode(prefix+`s.onOverlap(function(${declaration}){})`);
  assert.ok(bad.unsupported.some(note=>note.includes('sprite.onOverlap()')),declaration);
 }
 const none=arcadeToPseudocode(prefix+'s.onOverlap(function(){info.changeScoreBy(1)})');assert.deepEqual(none.unsupported,[]);compile(none.code);
});
test('new words survive quoted keywords/nested reporters and roundtrip without leaking malformed commands',()=>{
 const source='DEVICE ARCADE\nWHEN flag clicked:\n  arcade register instance overlap of (arcade local hero) as "as capturing" capturing "value"\nWHEN arcade instance overlap handler "as capturing" runs:\n  change score by 1\n';
 const {creator,project}=compile(source);assert.equal(ops(project).filter(b=>b.opcode==='arcade_registerInstanceOverlapHandler').length,1);
 const again=compile(creator.decompile(project));assert.equal(ops(again.project).filter(b=>b.opcode==='arcade_whenRegisteredInstanceOverlap').length,1);
 for(const line of ['arcade register instance overlap of hero as "x" capturing "":','when arcade instance overlap handler "x" runs']){
  const c=new Creator();let rejected=false;try{c.parse('DEVICE ARCADE\nWHEN flag clicked:\n  '+line+'\n');}catch(error){assert.match(error.message,/could not be read|unsupported|unparsed/i);rejected=true;}assert.ok(rejected || c.warnings.length>0,line);
 }
});
test('the unchanged conversion audit consumes the new words through its raw supplier Creator',async()=>{
 const {auditConversionSubject}=await import('../scripts/lib/conversion-audit-core.mjs');
 const {default:RawCreator}=await import('../overlay/scratch-gui/src/lib/sb3-creator.js');
 const source=readFileSync(new URL('fixtures/makecode/arcade-instance-overlap-runner.ts',import.meta.url),'utf8');
 let observed=false;
 const result=await auditConversionSubject({kind:'RAW_BASELINE',target:'arcade',name:'receiver-overlap',
  files:{'main.ts':source,'pxt.json':JSON.stringify({name:'receiver-overlap',files:['main.ts'],dependencies:{device:'*'}})}},
  {onCreator:creator=>{observed=true;assert.equal(creator.constructor,RawCreator);assert.equal(ops(creator.project).filter(b=>b.opcode==='arcade_whenRegisteredInstanceOverlap').length,1);}});
 assert.equal(result.stage,'translated');assert.equal(result.creator.status,'return');assert.equal(observed,true);
 assert.deepEqual(result.unsupported,[]);assert.equal(result.inputMutation.rootChanged,false);
});
