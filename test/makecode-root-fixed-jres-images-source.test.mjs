import test from 'node:test';import assert from 'node:assert/strict';
import {prepareRootFixedImages} from '../overlay/scratch-gui/src/lib/bw-makecode/root-fixed-jres-images.js';
import {decodeMkcdImage} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-assets.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
const body=[0x31,0,0,0,0x42,0,0,0],data=header=>Buffer.from([...header,...body]).toString('base64');
const first=data([0x87,4,2,0,2,0,0,0]),second=data([0xe4,2,2,0]);
const source='namespace paint {\n    //% fixedInstance jres blockIdentity=images._image\n    export const first = image.ofBuffer(hex``);\n    //% fixedInstance jres blockIdentity=images._image\n    export const second = image.ofBuffer(hex``);\n}\n';
const fixture=()=>({'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['assets.ts','art.jres','main.ts'],testFiles:['test.ts']}),'assets.ts':source,'art.jres':JSON.stringify({'*':{namespace:'paint',mimeType:'image/x-mkcd-f4'},first:{data:first,tilemapTile:true},second:{data:second,tilemapTile:true}}),'main.ts':'','test.ts':''});
test('root declared resources preserve exact source order, namespace, pixels and immutable inputs',()=>{
 const f=fixture(),before=JSON.stringify(f),out=prepareRootFixedImages(Object.freeze(f));assert.deepEqual(out.diagnostics,[]);assert.equal(JSON.stringify(f),before);assert.equal(out.resources.length,2);assert.deepEqual(out.resources.map(r=>r.resourceId),['paint.first','paint.second']);
 for(const r of out.resources){assert.equal(r.width,2);assert.equal(r.height,2);assert.deepEqual(r.pixels,[1,2,3,4]);assert.equal(r.allocation,'one existing declaration initializer at its original source position')}
 assert.equal(out.files['assets.ts'],source.replaceAll('image.ofBuffer(hex``)','img`\n    1 2\n    3 4\n`'));assert.equal(out.files['pxt.json'],f['pxt.json']);assert.equal(out.files['art.jres'],f['art.jres']);assert.deepEqual(arcadeToPseudocode(f).unsupported,[]);
});
test('legacy f4 exact length and low-nibble column order agree with modern format including odd height padding',()=>{
 const b=[0x31,0xf5,0xaa,0xbb,0x42,0xf6,0xcc,0xdd];
 for(const header of [[0xe4,2,3,0],[0x87,4,2,0,3,0,0,0]]){const image=decodeMkcdImage(Buffer.from([...header,...b]).toString('base64'));assert.deepEqual([image.width,image.height,...image.pixels],[2,3,1,2,3,4,5,6])}
 for(const b of [[0xe4,0,1,0],[0xe4,1,1,0,1],[0xe4,1,1,0,1,0,0,0,0],[0xe1,1,1,0,1,0,0,0],[0xe4,1,1,0,1,0,0]])assert.equal(decodeMkcdImage(Buffer.from(b).toString('base64')),null);
});
test('source and final importer refuse actual SDK, namespace, binding, prototype, hidden and dynamic writers',()=>{
 for(const extra of ['image.ofBuffer = replacement','image.create = replacement','let alias=image','let factory=image.ofBuffer','namespace paint {export const image=9}','paint.first = unknownValue','let alias=paint','paint["first"] = unknownValue','Object.defineProperty(image,"ofBuffer",{})','this.image.ofBuffer=unknownValue']){
  const f=fixture();f['main.ts']=extra;const p=prepareRootFixedImages(f);assert.equal(p.resources.length,0,extra);assert.ok(p.diagnostics.length,extra);assert.strictEqual(p.files,f);assert.ok(arcadeToPseudocode(f).unsupported.length,extra);
 }
 const f=fixture();f['hidden.ts']='image.ofBuffer=unknownValue';assert.ok(prepareRootFixedImages(f).diagnostics.length);
});
test('missing, duplicate and foreign resources cannot borrow the same short name',()=>{
 for(const modify of [f=>{f['unused.jres']=f['art.jres']},f=>{delete f['art.jres']},f=>{f['art.jres']=f['art.jres'].replace('paint','foreign')},f=>{const cfg=JSON.parse(f['pxt.json']);cfg.files.push('other.jres');f['pxt.json']=JSON.stringify(cfg);f['other.jres']=f['art.jres']},f=>{f['art.jres']=f['art.jres'].replace(first,Buffer.from([0xe4,1,1,0,1]).toString('base64'))}]){const f=fixture();modify(f);const out=prepareRootFixedImages(f);assert.equal(out.resources.length,0);assert.ok(out.diagnostics.length)}
});
test('ordinary empty buffers, nonempty calls and quoted annotations remain unsupported values',()=>{
 for(const replace of [s=>s.replaceAll('//% fixedInstance jres blockIdentity=images._image','// ordinary fixedInstance jres'),s=>s.replaceAll('fixedInstance jres blockIdentity=images._image','tags="fixedInstance jres"'),s=>s.replaceAll('hex``','hex`01`')]){const f=fixture();f['assets.ts']=replace(source);assert.equal(prepareRootFixedImages(f).resources.length,0);assert.ok(arcadeToPseudocode(f).unsupported.length)}
});
test('active foreign sources, unresolved dependencies and accessor input fields provide no root resource authority',()=>{
 for(const edit of [f=>{const c=JSON.parse(f['pxt.json']);c.dependencies.extra='*';f['pxt.json']=JSON.stringify(c)},f=>{const c=JSON.parse(f['pxt.json']);c.files.push('main.py');c.preferredEditor='pyprj';f['pxt.json']=JSON.stringify(c);f['main.py']='pass'}]){const f=fixture();edit(f);assert.ok(prepareRootFixedImages(f).diagnostics.length)}
 const f=fixture();let read=false;Object.defineProperty(f,'hidden.ts',{get(){read=true;return 'image.ofBuffer=unknownValue'},enumerable:true});assert.ok(prepareRootFixedImages(f).diagnostics.length);assert.equal(read,false);
});

test('namespace resource reads preserve actual cells and never create additional Image resources',()=>{
 const f=fixture();f['main.ts']='let alias=paint.first;let same=alias===paint.first;alias.setPixel(0,0,9);let observed=paint.first.getPixel(0,0)';const out=arcadeToPseudocode(f);assert.deepEqual(out.unsupported,[]);assert.equal((out.code.match(/arcade copy image \(arcade frame image/g)||[]).length,2);assert.match(out.code,/set alias to \(__bwNamespace_paint_first\)/);
 for(const ext of ['js','cpp','asm']){const f=fixture(),c=JSON.parse(f['pxt.json']);c.files.push('hidden.'+ext);f['pxt.json']=JSON.stringify(c);f['hidden.'+ext]='writer';assert.ok(prepareRootFixedImages(f).diagnostics.length)}
});
