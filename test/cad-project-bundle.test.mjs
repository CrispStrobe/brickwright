// SPDX-License-Identifier: BSD-3-Clause
import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {CAD_PROJECT_PATH,CAD_STORAGE_KEY,setLiveCadText,readCadText,getCadProjectGeneration} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {attachBrickwrightState,extractBrickwrightState,inspectBrickwrightState,applyBrickwrightInspection,rollbackBrickwrightInspection} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';
const doc={format:'brickwright-cad',version:7,units:'mm',id:'design',title:'My design',nodes:{},roots:[]};
const text=JSON.stringify(doc);
const values=new Map();
const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
beforeEach(()=>{values.clear();setLiveCadText(undefined);globalThis.localStorage=storage;});
const project=async(cad,{badState=false}={})=>{
 const zip=new JSZip();zip.file('project.json','{"targets":[]}');zip.file('original.txt','unchanged');
 if(cad!==undefined)zip.file(CAD_PROJECT_PATH,cad);
 if(badState)zip.file('brickwright/state.json','{broken');
 return zip.generateAsync({type:'arraybuffer'});
};
test('CAD sidecar saves live content and preserves Scratch and existing archive entries',async()=>{
 storage.setItem(CAD_STORAGE_KEY,'stale');setLiveCadText(text);
 const zip=await JSZip.loadAsync(await (await attachBrickwrightState(new Blob([await project()]))).arrayBuffer());
 assert.equal(await zip.file(CAD_PROJECT_PATH).async('text'),text);
 assert.equal(await zip.file('original.txt').async('text'),'unchanged');
 assert.equal(await zip.file('project.json').async('text'),'{"targets":[]}');
 const state=JSON.parse(await zip.file('brickwright/state.json').async('text'));
 assert.equal(state.state.cad,undefined,'CAD uses the SDK-compatible separate sidecar');
});
test('legacy SB3s with CAD load atomically, old projects clear CAD, and rollback restores its live cache',async()=>{
 storage.setItem(CAD_STORAGE_KEY,'previous storage');setLiveCadText('previous live');
 const inspection=await inspectBrickwrightState(await project(text));
 const generation=getCadProjectGeneration();
 const applied=applyBrickwrightInspection(inspection);
 assert.notEqual(getCadProjectGeneration(),generation);
 assert.equal(readCadText(),text);
 assert.equal(rollbackBrickwrightInspection(applied).rolledBack,true);
 assert.equal(getCadProjectGeneration(),generation);
 assert.equal(readCadText(),'previous live');assert.equal(storage.getItem(CAD_STORAGE_KEY),'previous storage');
 const clean=applyBrickwrightInspection(await inspectBrickwrightState(await project()));
 assert.equal(clean.outcome,'legacy');assert.equal(readCadText(),null);
});
test('CAD survives save/load with the editor off, including future CAD documents',async()=>{
 const future=JSON.stringify({...doc,version:999,extension:{kept:true}});
 applyBrickwrightInspection(await inspectBrickwrightState(await project(future)));
 const saved=await attachBrickwrightState(new Blob([await project()]));
 assert.equal(await (await JSZip.loadAsync(await saved.arrayBuffer())).file(CAD_PROJECT_PATH).async('text'),future);
});
test('invalid CAD or tab state refuses the whole archive before touching current content',async()=>{
 for(const buffer of [await project('{broken'),await project('{"format":"other"}'),await project(text,{badState:true})]){
  storage.setItem(CAD_STORAGE_KEY,text);
  const inspected=await inspectBrickwrightState(buffer);
  assert.equal(inspected.outcome,'invalid');applyBrickwrightInspection(inspected);
  assert.equal(storage.getItem(CAD_STORAGE_KEY),text);
 }
});

test('a preserved future Brickwright bundle carries its own CAD sidecar rather than the previous project design',async()=>{
 const futureCad=JSON.stringify({...doc,id:'futureDesign',version:999});
 const zip=await JSZip.loadAsync(await project(futureCad));
 zip.file('brickwright/state.json',JSON.stringify({format:'brickwright-state',version:999,state:{unknown:true}}));
 storage.setItem(CAD_STORAGE_KEY,text);
 const result=await extractBrickwrightState(await zip.generateAsync({type:'arraybuffer'}));
 assert.equal(result.outcome,'future');assert.equal(readCadText(),text);
 const saved=await attachBrickwrightState(new Blob([await project()]));
 const after=await JSZip.loadAsync(await saved.arrayBuffer());
 assert.equal(await after.file(CAD_PROJECT_PATH).async('text'),futureCad);
 assert.equal(JSON.parse(await after.file('brickwright/state.json').async('text')).version,999);
});

test('quota-limited CAD recovery keeps exact sidecar live, saves it again and can roll back',async()=>{
 const large=JSON.stringify({...doc,title:'Recovered large design',extra:'x'.repeat(20000)});
 const quota=Object.create(storage);quota.setItem=(key,value)=>{if(value.length>10000)throw new DOMException('Storage quota exceeded','QuotaExceededError');storage.setItem(key,value);};
 storage.setItem(CAD_STORAGE_KEY,text);setLiveCadText('previous live');
 const applied=applyBrickwrightInspection(await inspectBrickwrightState(await project(large)),quota);
 assert.equal(applied.outcome,'legacy');assert.equal(applied.storageMode,'session-cad');
 assert.equal(readCadText(),large);assert.equal(storage.getItem(CAD_STORAGE_KEY),null);
 const saved=await attachBrickwrightState(new Blob([await project()]));
 assert.equal(await(await JSZip.loadAsync(await saved.arrayBuffer())).file(CAD_PROJECT_PATH).async('text'),large);
 assert.equal(rollbackBrickwrightInspection(applied,quota).rolledBack,true);
 assert.equal(readCadText(),'previous live');assert.equal(storage.getItem(CAD_STORAGE_KEY),text);
});
