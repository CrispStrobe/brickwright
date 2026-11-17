// SPDX-License-Identifier: BSD-3-Clause
// Source-admission mutants only; no acquisition or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {nativeBenchmarkFetchPin,NATIVE_BENCHMARK_ROOT,APPROVED_BENCHMARK_FILES} from '../scripts/lib/native-benchmark-fetch-pin.mjs';
const detectors=[['raw',/raw\.githubusercontent\.com\/[^\s'"`)\\]+/g]];
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'benchmark-fetch-pin-')),dir=path.join(root,NATIVE_BENCHMARK_ROOT);mkdirSync(dir,{recursive:true});
 const tracked=new Set();for(const file of Object.keys(APPROVED_BENCHMARK_FILES)){copyFileSync(fileURLToPath(new URL(`../${NATIVE_BENCHMARK_ROOT}/${file}`,import.meta.url)),path.join(dir,file));tracked.add(`${NATIVE_BENCHMARK_ROOT}/${file}`)}
 return {root,dir,tracked,run:()=>nativeBenchmarkFetchPin(root,tracked,detectors),clean:()=>rmSync(root,{recursive:true,force:true}),
 mutate(file,fn){const p=path.join(dir,file),before=readFileSync(p,'utf8'),after=fn(before);assert.notEqual(after,before,'mutant must alter actual proof bytes');writeFileSync(p,after)}};
}
test('exact tracked benchmark source and metadata declare just their dynamic URL constructor',()=>{
 const f=fixture();try{const row=f.run();assert.equal(row.file,`${NATIVE_BENCHMARK_ROOT}/index.js`);assert.equal(row.class,'validated-input');assert.ok(row.text.includes('${mediaCommit}'));}finally{f.clean()}
});
test('provenance cannot redirect to another repo, mutable ref, wrong full SHA or unsafe base',()=>{
 for(const [key,value]of [['repository','Other/Unapproved'],['assetsCommit','main'],['assetsCommit','f'.repeat(40)],['commit','abc1234'],['base','projects/../outside'],['base','projects/%2e%2e/outside']]){
 const f=fixture();try{f.mutate('provenance.json',text=>{const p=JSON.parse(text);p[key]=value;return JSON.stringify(p)});assert.throws(f.run,/Unapproved benchmark proof bytes/)}finally{f.clean()}}
});
test('catalog payload hash, length and path cannot change under existing admission',()=>{
 for(const mutation of ['hash','length','path']){const f=fixture();try{f.mutate('catalog.json',text=>{const c=JSON.parse(text),files=c.topbench.files;if(mutation==='hash')files.LICENSE.sha256='0'.repeat(64);if(mutation==='length')files.LICENSE.bytes=0;if(mutation==='path')files['../outside']=files.LICENSE;return JSON.stringify(c)});assert.throws(f.run,/Unapproved benchmark proof bytes/)}finally{f.clean()}}
});
test('removing either network/cache verification or pre-native verification invalidates admission',()=>{
 for(const change of [s=>s.replace('if (saved) bytes = await verifyBytes(new Uint8Array(await saved.arrayBuffer()), proof, name);','if (saved) bytes = new Uint8Array(await saved.arrayBuffer());'),s=>s.replace('bytes = await verifyBytes(new Uint8Array(await response.arrayBuffer()), proof, name);','bytes = new Uint8Array(await response.arrayBuffer());'),s=>s.replace('await verifyBytes(program, catalog[project].files[imageName], imageName);','void program;')]){
 const f=fixture();try{f.mutate('index.js',change);assert.throws(f.run,/Unapproved benchmark proof bytes/)}finally{f.clean()}}
});
test('untracked and symlinked provenance cannot provide benchmark authority',()=>{
 for(const mode of ['tracking','symlink']){const f=fixture();try{if(mode==='tracking')f.tracked.delete(`${NATIVE_BENCHMARK_ROOT}/catalog.json`);else{const p=path.join(f.dir,'catalog.json'),outside=path.join(f.root,'outside');copyFileSync(p,outside);rmSync(p);symlinkSync(outside,p)}assert.throws(f.run)}finally{f.clean()}}
});
