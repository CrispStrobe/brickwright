// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,copyFileSync,statSync,constants} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cadSdkFetchPins,validateCadProvenanceUrl,CAD_SDK_ROOT,CAD_SDK_PRODUCER,APPROVED_CAD_COMMIT,APPROVED_CAD_CARRIER,APPROVED_CAD_CARRIER_SHA256,APPROVED_CAD_CARRIERS} from '../scripts/lib/cad-sdk-fetch-pins.mjs';
const full='1'.repeat(40), carrier=APPROVED_CAD_CARRIER;
const original=fileURLToPath(new URL(`../${CAD_SDK_ROOT}/${carrier}`,import.meta.url));
const raw = (ref=full,owner='Ghostkeeper',repo='SlicerTestModels',file='models/example.stl') => ['raw.','githubusercontent.com/',owner,'/',repo,'/',ref,'/',file].join('');
const detectors=[['raw', /raw\.githubusercontent\.com\/[^\s'"`)\\]+/g]];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'cad-fetch-pin-')),directory=path.join(root,CAD_SDK_ROOT);mkdirSync(directory,{recursive:true});mkdirSync(path.join(root,'scripts'));
 writeFileSync(path.join(root,CAD_SDK_PRODUCER),'// tracked producer fixture\n');
 const target=path.join(directory,carrier);
 for(const name of Object.keys(APPROVED_CAD_CARRIERS)){const source=fileURLToPath(new URL(`../${CAD_SDK_ROOT}/${name}`,import.meta.url)),dest=path.join(directory,name);copyFileSync(source,dest,constants.COPYFILE_FICLONE);const a=statSync(source),b=statSync(dest);assert.ok(a.dev!==b.dev||a.ino!==b.ino,'mutant copy must not share original inode')}
 const sourceStat=statSync(original),targetStat=statSync(target);assert.ok(sourceStat.dev!==targetStat.dev||sourceStat.ino!==targetStat.ino,'mutants must never write through an original hardlink');
 const manifest={format:'brickwright-cad-sdk',version:1,repository:'https://github.com/CrispStrobe/brickwright-cad',commit:APPROVED_CAD_COMMIT,dirty:false,files:{...APPROVED_CAD_CARRIERS}};
 const tracked=new Set([CAD_SDK_PRODUCER,`${CAD_SDK_ROOT}/manifest.json`,...Object.keys(APPROVED_CAD_CARRIERS).map(name=>`${CAD_SDK_ROOT}/${name}`)]);
 const save=()=>writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest));save();
 return {root,directory,manifest,tracked,save,run:()=>cadSdkFetchPins(root,tracked,detectors),
  mutate(transform){const before=readFileSync(target,'utf8'),after=transform(before);assert.notEqual(after,before,'the hostile mutation must change the actual carrier');writeFileSync(target,after);manifest.files[carrier]=digest(after);save()},
  clean(){for(const [name,hash]of Object.entries(APPROVED_CAD_CARRIERS))assert.equal(digest(readFileSync(new URL(`../${CAD_SDK_ROOT}/${name}`,import.meta.url))),hash,'original carrier bytes must remain unchanged');rmSync(root,{recursive:true,force:true})}};
}
test('the exact approved 10MB carrier admits existing external immutable provenance only',()=>{
 const f=fixture();try{const rows=f.run();assert.ok(rows.length>1000);assert.ok(rows.some(row=>row.text.includes('/Ghostkeeper/SlicerTestModels/')));assert.equal(rows.filter(row=>row.file===`${CAD_SDK_ROOT}/${carrier}`&&row.text.includes('%20')).length,4);assert.equal(rows.filter(row=>row.file.endsWith('/sdk-Dt1a4PLn.js')).length,5);assert.ok(rows.every(row=>Object.hasOwn(APPROVED_CAD_CARRIERS,path.basename(row.file))&&row.class==='sha-const'))}finally{f.clean()}
});
test('structural validation allows immutable external paths and only literal encoded spaces',()=>{
 for(const value of [raw(),raw(full,'AngeloNicoli','OpenSCAD-Snippet','Asset_SCAD/Angle%20Shelf.scad'),raw(full,'jscad','OpenJSCAD.org','examples/example.js')])assert.doesNotThrow(()=>validateCadProvenanceUrl(value));
 const invalid=[raw('main'),raw('1234567'),raw('${ref}'),raw('%31'.repeat(40)),raw(full.toUpperCase().replace('1','A')),raw(full,'bad%2fowner'),raw(full,'owner','repo','../outside'),raw(full,'owner','repo','path/./file'),raw(full,'owner','repo','%2e%2e/outside'),raw(full,'owner','repo','a%2fb'),raw(full,'owner','repo','a%5cb'),raw(full,'owner','repo','a%2520b'),raw(full,'owner','repo','a%09b'),raw(full,'owner','repo',''),raw()+'?ref=main',raw()+'#fragment',raw().replace('models/','user@models/'),raw().replace('raw.','raw.evil.'),raw().replace('raw.','%72aw.'),raw().replace('githubusercontent.com/','githubusercontent.com:443/')];
 for(const value of invalid)assert.throws(()=>validateCadProvenanceUrl(value),undefined,value);
});
test('a rewritten actual carrier cannot authorize mutable, escaped or new fixed-SHA URLs by updating the manifest',()=>{
 for(const value of [raw('main'),raw('1234567'),raw(full,'UnapprovedOwner','UnapprovedRepo'),raw('3'.repeat(40)),raw(full,'Ghostkeeper','SlicerTestModels','new/unapproved.stl'),raw(full,'Ghostkeeper','SlicerTestModels','%2e%2e/outside')]){const f=fixture();try{f.mutate(before=>before+'\nconst hostile="https://'+value+'";');assert.throws(f.run,/exact approved carrier hash/)}finally{f.clean()}}
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
  f.save();assert.throws(f.run,undefined,mutation);
 }finally{f.clean()}}
});
test('a hash-correct symlink or another carrier cannot hide a new provenance surface',()=>{
 for(const mutation of ['symlink','no-carrier','second-carrier']){const f=fixture();try{
  if(mutation==='symlink'){const outside=path.join(f.root,'outside.js');copyFileSync(original,outside,constants.COPYFILE_FICLONE);rmSync(path.join(f.directory,carrier));symlinkSync(outside,path.join(f.directory,carrier))}
  if(mutation==='no-carrier')delete f.manifest.files[carrier];
  if(mutation==='second-carrier'){const name='model-library-local-second.js';copyFileSync(original,path.join(f.directory,name),constants.COPYFILE_FICLONE);f.manifest.files[name]=APPROVED_CAD_CARRIER_SHA256;f.tracked.add(`${CAD_SDK_ROOT}/${name}`)}
  f.save();assert.throws(f.run,undefined,mutation);
 }finally{f.clean()}}
});
test('an extra SDK file is not automatically declared, even when tracked',()=>{
 const f=fixture();try{
  const name=`${CAD_SDK_ROOT}/extra.js`,bytes='const source="https://'+raw('main')+'";';writeFileSync(path.join(f.directory,'extra.js'),bytes);f.tracked.add(name);
  const rows=f.run();assert.ok(!rows.some(row=>row.file===name));assert.equal([...bytes.matchAll(detectors[0][1])].length,1,'the ordinary census still detects the undeclared mutable site');
 }finally{f.clean()}
});

test('second exact carrier cannot gain a URL even with a matching updated manifest',()=>{
 const f=fixture();try{const name='sdk-Dt1a4PLn.js',target=path.join(f.directory,name);const bytes=readFileSync(target,'utf8')+'\nconst hostile="https://'+raw('main')+'";';writeFileSync(target,bytes);f.manifest.files[name]=digest(bytes);f.save();assert.throws(f.run,/exact approved carrier hash/)}finally{f.clean()}
});
