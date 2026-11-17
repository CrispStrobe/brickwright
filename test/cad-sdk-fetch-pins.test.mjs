// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,copyFileSync,statSync,constants} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cadSdkFetchPins,validateCadProvenanceUrl,CAD_SDK_ROOT,CAD_SDK_PRODUCER,APPROVED_CAD_COMMIT,APPROVED_CAD_CARRIER,APPROVED_CAD_CARRIER_SHA256,APPROVED_CAD_CARRIERS,APPROVED_CAD_MANIFEST_SHA256,APPROVED_CAD_PRODUCER_SHA256} from '../scripts/lib/cad-sdk-fetch-pins.mjs';
const full='1'.repeat(40), carrier=APPROVED_CAD_CARRIER, sdkCarrier=Object.keys(APPROVED_CAD_CARRIERS).find(name=>name.startsWith('sdk-'));
const original=fileURLToPath(new URL(`../${CAD_SDK_ROOT}/${carrier}`,import.meta.url));
const raw = (ref=full,owner='Ghostkeeper',repo='SlicerTestModels',file='models/example.stl') => ['raw.','githubusercontent.com/',owner,'/',repo,'/',ref,'/',file].join('');
const detectors=[['raw', /raw\.githubusercontent\.com\/[^\s'"`)\\]+/g]];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'cad-fetch-pin-')),directory=path.join(root,CAD_SDK_ROOT);mkdirSync(directory,{recursive:true});mkdirSync(path.join(root,'scripts'));
 const sourceRoot=fileURLToPath(new URL(`../${CAD_SDK_ROOT}/`,import.meta.url));
 const manifestBytes=readFileSync(path.join(sourceRoot,'manifest.json'));
 assert.equal(digest(manifestBytes),APPROVED_CAD_MANIFEST_SHA256,'fixture requires the actual approved distribution');
 const manifest=JSON.parse(manifestBytes);
 const producer=fileURLToPath(new URL(`../${CAD_SDK_PRODUCER}`,import.meta.url));
 assert.equal(digest(readFileSync(producer)),APPROVED_CAD_PRODUCER_SHA256,'fixture requires actual approved producer');
 copyFileSync(producer,path.join(root,CAD_SDK_PRODUCER),constants.COPYFILE_FICLONE);
 const tracked=new Set([CAD_SDK_PRODUCER,`${CAD_SDK_ROOT}/manifest.json`]);
 for(const name of Object.keys(manifest.files)){
  const source=path.join(sourceRoot,name),dest=path.join(directory,name);mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(source,dest,constants.COPYFILE_FICLONE);
  const a=statSync(source),b=statSync(dest);assert.ok(a.dev!==b.dev||a.ino!==b.ino,'mutant copy must not share original inode');tracked.add(`${CAD_SDK_ROOT}/${name}`);
 }
 writeFileSync(path.join(directory,'manifest.json'),manifestBytes);
 const target=path.join(directory,carrier),save=()=>writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest));
 return {root,directory,manifest,tracked,save,run:()=>cadSdkFetchPins(root,tracked,detectors),
  mutate(transform){const before=readFileSync(target,'utf8'),after=transform(before);assert.notEqual(after,before,'the hostile mutation must change the actual carrier');writeFileSync(target,after);manifest.files[carrier]=digest(after);save()},
  clean(){assert.equal(digest(readFileSync(path.join(sourceRoot,'manifest.json'))),APPROVED_CAD_MANIFEST_SHA256);assert.equal(digest(readFileSync(producer)),APPROVED_CAD_PRODUCER_SHA256);for(const [name,hash]of Object.entries(JSON.parse(manifestBytes).files))assert.equal(digest(readFileSync(path.join(sourceRoot,name))),hash,'original payload bytes must remain unchanged');rmSync(root,{recursive:true,force:true})}};
}
test('the exact approved carrier admits existing external immutable provenance only',()=>{
 const f=fixture();try{const rows=f.run();assert.ok(rows.length>1000);assert.ok(rows.some(row=>row.text.includes('/Ghostkeeper/SlicerTestModels/')));assert.equal(rows.filter(row=>row.file===`${CAD_SDK_ROOT}/${carrier}`&&row.text.includes('%20')).length,4);assert.equal(rows.filter(row=>row.file.endsWith(`/${sdkCarrier}`)).length,9);assert.ok(rows.some(row=>row.text.includes('/4884%20Feather%20RP2040/')));assert.ok(rows.some(row=>row.text.includes('/830%20Battery%20Holder/')));assert.ok(rows.some(row=>row.text.includes('/2590%20Metro%20Mini/')));assert.ok(rows.some(row=>row.text.includes('/4739%20MPM3610%205V%20Buck/')));assert.ok(rows.every(row=>Object.hasOwn(APPROVED_CAD_CARRIERS,path.basename(row.file))&&row.class==='sha-const'))}finally{f.clean()}
});
test('structural validation allows immutable external paths and only literal encoded spaces',()=>{
 for(const value of [raw(),raw(full,'AngeloNicoli','OpenSCAD-Snippet','Asset_SCAD/Angle%20Shelf.scad'),raw(full,'jscad','OpenJSCAD.org','examples/example.js')])assert.doesNotThrow(()=>validateCadProvenanceUrl(value));
 const invalid=[raw('main'),raw('1234567'),raw('${ref}'),raw('%31'.repeat(40)),raw(full.toUpperCase().replace('1','A')),raw(full,'bad%2fowner'),raw(full,'owner','repo','../outside'),raw(full,'owner','repo','path/./file'),raw(full,'owner','repo','%2e%2e/outside'),raw(full,'owner','repo','a%2fb'),raw(full,'owner','repo','a%5cb'),raw(full,'owner','repo','a%2520b'),raw(full,'owner','repo','a%09b'),raw(full,'owner','repo',''),raw()+'?ref=main',raw()+'#fragment',raw().replace('models/','user@models/'),raw().replace('raw.','raw.evil.'),raw().replace('raw.','%72aw.'),raw().replace('githubusercontent.com/','githubusercontent.com:443/')];
 for(const value of invalid)assert.throws(()=>validateCadProvenanceUrl(value),undefined,value);
});
test('a rewritten actual carrier cannot authorize mutable, escaped or new fixed-SHA URLs by updating the manifest',()=>{
 for(const value of [raw('main'),raw('1234567'),raw(full,'UnapprovedOwner','UnapprovedRepo'),raw('3'.repeat(40)),raw(full,'Ghostkeeper','SlicerTestModels','new/unapproved.stl'),raw(full,'Ghostkeeper','SlicerTestModels','%2e%2e/outside')]){const f=fixture();try{f.mutate(before=>before+'\nconst hostile="https://'+value+'";');assert.throws(f.run,/exact approved (?:carrier hash|bytes)/)}finally{f.clean()}}
});
test('changed bytes, untracked artifacts, missing producer and manifest, or a different source pin stay red',()=>{
 for(const mutation of ['bytes','payload','producer','manifest','source-sha','dirty','escape']){const f=fixture();try{
  if(mutation==='bytes')writeFileSync(path.join(f.directory,carrier),'changed');
  if(mutation==='payload')f.tracked.delete(`${CAD_SDK_ROOT}/${carrier}`);
  if(mutation==='producer')f.tracked.delete(CAD_SDK_PRODUCER);
  if(mutation==='manifest')f.tracked.delete(`${CAD_SDK_ROOT}/manifest.json`);
  if(mutation==='source-sha')f.manifest.commit='3'.repeat(40);
  if(mutation==='dirty')f.manifest.dirty=true;
  if(mutation==='escape')f.manifest.files['../outside.js']='0'.repeat(64);
  if(['source-sha','dirty','escape','no-carrier','second-carrier'].includes(mutation))f.save();assert.throws(f.run,undefined,mutation);
 }finally{f.clean()}}
});
test('a hash-correct symlink or another carrier cannot hide a new provenance surface',()=>{
 for(const mutation of ['symlink','no-carrier','second-carrier']){const f=fixture();try{
  if(mutation==='symlink'){const outside=path.join(f.root,'outside.js');copyFileSync(original,outside,constants.COPYFILE_FICLONE);rmSync(path.join(f.directory,carrier));symlinkSync(outside,path.join(f.directory,carrier))}
  if(mutation==='no-carrier')delete f.manifest.files[carrier];
  if(mutation==='second-carrier'){const name='model-library-local-second.js';copyFileSync(original,path.join(f.directory,name),constants.COPYFILE_FICLONE);f.manifest.files[name]=APPROVED_CAD_CARRIER_SHA256;f.tracked.add(`${CAD_SDK_ROOT}/${name}`)}
  if(['source-sha','dirty','escape','no-carrier','second-carrier'].includes(mutation))f.save();assert.throws(f.run,undefined,mutation);
 }finally{f.clean()}}
});
test('an extra SDK file is not automatically declared, even when tracked',()=>{
 const f=fixture();try{
  const name=`${CAD_SDK_ROOT}/extra.js`,bytes='const source="https://'+raw('main')+'";';writeFileSync(path.join(f.directory,'extra.js'),bytes);f.tracked.add(name);
  const rows=f.run();assert.ok(!rows.some(row=>row.file===name));assert.equal([...bytes.matchAll(detectors[0][1])].length,1,'the ordinary census still detects the undeclared mutable site');
 }finally{f.clean()}
});

test('second exact carrier cannot gain a URL even with a matching updated manifest',()=>{
 const f=fixture();try{const name=sdkCarrier,target=path.join(f.directory,name);const bytes=readFileSync(target,'utf8')+'\nconst hostile="https://'+raw('main')+'";';writeFileSync(target,bytes);f.manifest.files[name]=digest(bytes);f.save();assert.throws(f.run,/exact approved (?:carrier hash|bytes)/)}finally{f.clean()}
});

test('noncarrier payload plus adjusted manifest, or producer rewrite, cannot borrow carrier approval',()=>{
 for(const mode of ['payload','producer']){const f=fixture();try{
  if(mode==='payload'){const name='NOTICE.txt',target=path.join(f.directory,name),bytes=readFileSync(target,'utf8')+'\nchanged';writeFileSync(target,bytes);f.manifest.files[name]=digest(bytes);f.save();assert.throws(f.run,/manifest needs exact approved bytes/)}
  else{const target=path.join(f.root,CAD_SDK_PRODUCER);writeFileSync(target,readFileSync(target,'utf8')+'\n// changed');assert.throws(f.run,/producer needs exact approved source bytes/)}
 }finally{f.clean()}}
});
