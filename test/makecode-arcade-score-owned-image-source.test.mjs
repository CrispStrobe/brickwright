import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {GENERATED_HELPER_PROFILES,inspectGeneratedHelperBindings} from '../overlay/scratch-gui/src/lib/bw-makecode/generated-helper-recognition.js';
import {bindScoreImageSource,scoreImageBindingView} from '../overlay/scratch-gui/src/lib/bw-makecode/score-owned-image-source.js';
import {scoreImageFiles} from './fixtures/arcade-score-owned-image.mjs';
const refused=files=>assert.ok(arcadeToPseudocode(files).unsupported.some(reason=>reason.startsWith('info.onScore')));

test('only owned pure image factories enable literal score registration without opening the shared helper',()=>{
 const files=scoreImageFiles(),out=arcadeToPseudocode(files);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/arcade register score player/);
 const program=parseMakeCodeTs(files['main.ts'],GENERATED_HELPER_PROFILES.ordinary);
 assert.equal(inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary).isCurrent(),false);
 bindScoreImageSource(program,files);const view=scoreImageBindingView(program);assert.ok(view);assert.equal(view.current(),true);
 assert.equal(inspectGeneratedHelperBindings(view.program,GENERATED_HELPER_PROFILES.ordinary).isCurrent(),true);
});

test('forged resources, side effects, dependency refs, shadows and hidden root writers retain refusal',()=>{
 for(const change of [
  f=>{f['images.g.ts']=f['images.g.ts'].replace('3 4','7 4')},
  f=>{f['images.g.ts']=f['images.g.ts'].replace('return img','info.setScore(9);return img')},
  f=>{f['images.g.ts']='//% shim=custom\n'+f['images.g.ts']},
  f=>{f['images.g.ts']=f['images.g.ts'].replace('helpers.stringTrim(name)','name')},
  f=>{f['main.ts']='let assets:any=1;'+f['main.ts']},
  f=>{f['main.ts']='assets.image=function(){return null};'+f['main.ts']},
  f=>{f['main.ts']='let alias=assets;'+f['main.ts']},
  f=>{f['main.ts']='helpers._registerFactory("image",function(){info.setScore(9);return null});'+f['main.ts']},
  f=>{f['main.ts']='class Hidden{constructor(){info.onScore=function(){}}}'+f['main.ts']},
  f=>{f['test.ts']='info["onScore"]=function(){}'},
  f=>{f['main.ts']='let acquire=(function(){})["con"+"structor"];'+f['main.ts']},
  f=>{f['main.ts']=f['main.ts'].replace('assets.image`badge`','assets.unknown`badge`')},
  f=>{f['main.ts']=f['main.ts'].replace('assets.image`badge`','assets.image`missing`')},
  f=>{f['main.ts']=f['main.ts'].replace('assets.image`badge`','assets.image`ba${1}dge`')},
  f=>{const c=JSON.parse(f['pxt.json']);c.dependencies.device='github:example/device#other';f['pxt.json']=JSON.stringify(c)},
  f=>{const c=JSON.parse(f['pxt.json']);c.files.push('native.asm');f['native.asm']='nop';f['pxt.json']=JSON.stringify(c)}
 ]){const files=scoreImageFiles();change(files);refused(files);}
 const early=scoreImageFiles('info.onScore(limit,function(){scene.setBackgroundImage(assets.image`badge`)});let limit=2;');refused(early);
 const dynamic=scoreImageFiles('let limit=2;info.onScore(limit,function(){scene.setBackgroundImage(assets.image`badge`)});');refused(dynamic);
});

test('binding captures exact original executable body and rejects later mutations or foreign replacement calls',()=>{
 const files=scoreImageFiles();
 for(const mutate of [
  p=>p.body.push(parseMakeCodeTs('info.onScore(2,function(){})').body[0]),
  p=>{p.body[1].expr.args[0].value='9'},
  p=>{p.body[1].expr.args[1].body=[]},
  p=>{p.body[1]=parseMakeCodeTs('info.onScore(2,function(){})').body[0]}
 ]){
  const program=parseMakeCodeTs(files['main.ts'],GENERATED_HELPER_PROFILES.ordinary);bindScoreImageSource(program,files);const view=scoreImageBindingView(program);assert.ok(view);
  mutate(program);assert.equal(view.current(),false);assert.equal(scoreImageBindingView(program),null);
 }
 const rebound=parseMakeCodeTs(files['main.ts'],GENERATED_HELPER_PROFILES.ordinary);bindScoreImageSource(rebound,files);const held=scoreImageBindingView(rebound);assert.ok(held);assert.equal(held.current(),true);
 bindScoreImageSource(rebound,{...files,'images.g.ts':'invalid'});assert.equal(scoreImageBindingView(rebound),null);assert.equal(held.current(),false,'failed rebind revokes already issued views');
 const foreign=parseMakeCodeTs('info.onScore(9,function(){scene.setBackgroundImage(assets.image`badge`)});',GENERATED_HELPER_PROFILES.ordinary);
 bindScoreImageSource(foreign,files);assert.equal(scoreImageBindingView(foreign),null);
 const program=parseMakeCodeTs(files['main.ts'],GENERATED_HELPER_PROFILES.ordinary);bindScoreImageSource(program,files);const view=scoreImageBindingView(program);files['images.g.ts']+='\ninfo.setScore(9)';assert.equal(view.current(),false);
});


test('omitted empty parameter bookkeeping never hides extra properties, changed prototypes or descriptors',()=>{
 const files=scoreImageFiles();
 for(const mutate of [
  a=>{a.extra=1},
  a=>{Object.setPrototypeOf(a,Object.create(Array.prototype))},
  a=>{Object.defineProperty(a,'length',{writable:false})},
  a=>{Object.defineProperty(a,'hidden',{value:1})}
 ]){
  const program=parseMakeCodeTs(files['main.ts'],GENERATED_HELPER_PROFILES.ordinary);
  mutate(program.body[1].expr.args[1].params.parameterDefaults);bindScoreImageSource(program,files);
  assert.equal(scoreImageBindingView(program),null);
 }
});
