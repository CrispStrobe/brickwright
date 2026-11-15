// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flattenPart} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-geometry.js';
import {visualAssembly} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/visual-assemblies.js';
import {fetchLDrawClosure} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-fetch.js';
import {searchPalette,paletteFrom} from '../overlay/scratch-gui/src/lib/bw-sim/editor/palette.js';
const root=new URL('../overlay/scratch-gui/static/ldraw/',import.meta.url);
const read=p=>{try{return readFileSync(new URL(p,root),'utf8');}catch{return undefined;}};
const parts=JSON.parse(readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json',import.meta.url))).parts;
const catalog=new Map(parts.map(p=>[p.part,p]));
test('open Technic frames keep old connector IDs and expose their perpendicular side bores',()=>{
 assert.match(catalog.get('39794.dat').nameDe,/7 x 11/);
 for(const [name,n,old] of [['39794.dat',32,16],['64179.dat',20,8]]){
  const m=catalog.get(name);assert.equal(m.connectors.length,n);
  for(let i=0;i<old;i++)assert.ok(m.connectors.find(c=>c.id===`y${i}`),`${name}: old y${i} connection survives`);
  assert.ok(m.connectors.some(c=>Math.abs(c.axis[0])===1));assert.ok(m.connectors.some(c=>Math.abs(c.axis[2])===1));
  assert.equal(m.colliders.length,4);
  assert.ok(m.colliders.every(c=>c.position.some((v,i)=>Math.abs(v)>c.halfExtents[i])), 'no rail fills the open center');
 }
});
test('existing SPIKE hub placements fetch and draw the standard battery assembly',async()=>{
 const fetched=await fetchLDrawClosure(['45601.dat'],{fetchImpl:async url=>{const p=url.replace(/^static\/ldraw\//,'');const text=read(p);return {ok:text!==undefined,text:async()=>text,json:async()=>JSON.parse(text)};}});
 assert.deepEqual(fetched.missing,[]);assert.ok(fetched.read('parts/45610.dat'));assert.equal(visualAssembly('45601.dat'),'45601c01.dat');
 const full=flattenPart('45601c01.dat',fetched.read),bare=flattenPart('45601.dat',fetched.read);
 assert.ok(full.polys.length>bare.polys.length);
 assert.match(readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-sim/view/part-geometry.js',import.meta.url),'utf8'),/flattenPart\(visualAssembly\(name\)/);
});
test('battery palette includes PF AA, AAA and rechargeable boxes and the other power families',()=>{
 const batteries=parts.filter(p=>p.category==='battery');assert.ok(batteries.length>=20);
 for(const [q,part] of [['8881','58119.dat'],['88000','64228.dat'],['8878','84599.dat']])assert.ok(searchPalette(catalog,q).some(x=>x.part===part));
 assert.ok(paletteFrom(catalog,{locale:'de'}).some(g=>g.category==='battery'&&g.label==='Batterien / Stromversorgung'));
});
test('7 x 11 frame can be pinned flat beside the long side of the SPIKE hub',async()=>{
 const {buildGraph}=await import('../overlay/scratch-gui/src/lib/bw-sim/mech/graph.js');
 const {solidOverlaps}=await import('../overlay/scratch-gui/src/lib/bw-sim/editor/overlap.js');
 const rotation=[1,0,0,0,1,0,0,0,1];
 const model={version:1,parts:[{id:'hub',part:'45601.dat',position:[0,0,0],rotation},{id:'frame',part:'39794.dat',position:[140,-10,0],rotation},...[40,80].map((z,i)=>({id:`pin${i}`,part:'2780.dat',position:[70,-10,z],rotation}))]};
 const graph=buildGraph(model,catalog);
 for(const pin of ['pin0','pin1']){
  const edges=graph.edges.filter(e=>JSON.stringify(e).includes(pin));
  assert.ok(edges.some(e=>JSON.stringify(e).includes('hub')),`${pin} engages hub`);
  assert.ok(edges.some(e=>JSON.stringify(e).includes('frame')),`${pin} engages frame without rotating frame`);
 }
 assert.deepEqual(solidOverlaps(model,catalog,model.parts[1]),[]);
});
