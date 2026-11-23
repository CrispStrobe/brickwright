// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url,fixture,exportTo]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-path-dxf-browser.mjs <app-url> [fixture.dxf] [export.dxf]');
const dir=await mkdtemp(join(tmpdir(),'bw-path-dxf-'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});

async function open(){
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,serviceWorkers:'block',acceptDownloads:true});
 page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  localStorage.setItem('bw-starter-v1-complete','1');
  localStorage.setItem('bw-cad-enabled','1');
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
 });
 await page.goto(url);
 await page.getByRole('tab',{name:'CAD',exact:true}).tap();
 await page.waitForFunction(()=>window.__bwCad?.editor);
 return page;
}
const file=page=>page.getByTestId('bw-file-menu-trigger');

const input=Buffer.from([
 '0','SECTION','2','HEADER','9','$INSUNITS','70',1,'0','ENDSEC',
 '0','SECTION','2','TABLES','0','TABLE','2','LTYPE',
 '0','LTYPE','2','Guide dash','73',2,'49',.5,'74',0,'49',-.25,'74',0,'0','ENDTAB',
 '0','TABLE','2','LAYER','0','LAYER','2','Guides','62',-5,'6','Guide dash','370',25,'290',0,'0','ENDTAB','0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 '0','LWPOLYLINE','8','Guides','90',3,'70',0,'38',10,'210',0,'220',.6,'230',.8,
 '10',0,'20',2,'40',.1,'41',.2,
 '10',0,'20',1,'40',.2,'41',.1,'42',-Math.tan(Math.PI/8),
 '10',1,'20',0,
 '0','LINE','8','Construction','10',2,'20',2,'11',3,'21',3,
 '0','LINE','8','Guides','410','Sheet 1','10',50,'20',50,'11',55,'21',55,
 '0','ENDSEC','0','EOF'
].join('\n'));

try{
 const page=await open();
 await page.getByRole('button',{name:'Sketch path',exact:true}).tap();
 const path=page.getByRole('dialog',{name:'Sketch path',exact:true});
 await path.getByText('DXF or DWG path',{exact:true}).tap();
 const fileInput=path.getByLabel('Choose DXF file');
 await fileInput.setInputFiles(fixture||{name:'inch guide.dxf',mimeType:'application/dxf',buffer:input});
 const importedLayer=path.getByText('DXF layer: Guides',{exact:true});
 const importLayers=path.getByRole('button',{name:'Import selected layers',exact:true});
 if(!fixture){
  await path.getByText('Paper-space layout entities were skipped.',{exact:true}).waitFor();
  await path.getByRole('checkbox',{name:'Construction',exact:true}).tap();
  await importLayers.tap();
  await path.getByText('The source plane was unfolded into the selected sketch plane at actual size.',{exact:true}).waitFor();
 }else{
  await Promise.race([importedLayer.waitFor({state:'visible'}),importLayers.waitFor({state:'visible'})]);
  if(await importLayers.isVisible())await importLayers.tap();
 }
 await importedLayer.waitFor({state:'visible'});
 const points=path.getByLabel('Path points X, Y (mm)');
 const expected=[ [0,50.8], [0,25.4,-Math.tan(Math.PI/8)], [25.4,0] ];
 const readRows=async()=>(await points.inputValue()).split('\n').map(row=>row.split(',').map(Number));
 async function verifyPoints(){
  const rows=await readRows();
  const actual=rows.map(([x,y,bulge])=>bulge?[x,y,bulge]:[x,y]);
  assert.deepEqual(actual.map(row=>row.length),expected.map(row=>row.length));
  for(const [i,row] of actual.entries())for(const [j,value] of row.entries())assert.ok(Math.abs(value-expected[i][j])<1e-9);
 }
 await verifyPoints();
 if(!fixture){
  const rows=await readRows();
  assert.deepEqual(rows.map(row=>row.slice(3)),[[2.54,5.08],[5.08,2.54],[]]);
  await points.fill((await points.inputValue()).replace('0, 50.8, 0, 2.54, 5.08','0, 50.8, 0, 3, 5.08'));
 }
 const [exported]=await Promise.all([
  page.waitForEvent('download'),path.getByRole('button',{name:'Export path as DXF'}).tap()
 ]);
 const dxf=exportTo??join(dir,'exported.dxf');
 await exported.saveAs(dxf);
 const text=await readFile(dxf,'utf8');
 assert.match(text,/\$INSUNITS\r\n70\r\n4/);
 assert.match(text,/90\r\n3\r\n70\r\n0/);
 assert.doesNotMatch(text,/Construction/);
 if(!fixture){
  assert.match(text,/62\r\n-5\r\n6\r\nGuide dash\r\n290\r\n0\r\n370\r\n25/);
  assert.match(text,/49\r\n12.7\r\n74\r\n0\r\n49\r\n-6.35/);
  assert.match(text,/40\r\n3\r\n41\r\n5.08/);
 }

 await fileInput.setInputFiles({name:'Verified guide.dxf',mimeType:'application/dxf',buffer:Buffer.from(text)});
 await fileInput.and(path.locator('input:enabled')).waitFor({state:'visible'});
 assert.equal(await path.getByLabel('Sketch name').inputValue(),'Verified guide');
 await verifyPoints();
 await path.getByRole('button',{name:'Save path',exact:true}).tap();
 await path.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const zip=await JSZip.loadAsync(await readFile(await save.path()));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 const sketch=Object.values(saved.sketches)[0];
 assert.equal(sketch.name,'Verified guide');
 assert.equal(sketch.profile.dxfLayer,'Guides');
 if(!fixture)assert.deepEqual(sketch.profile.dxfWidths,[[3,5.08],[5.08,2.54],[0,0]]);
 if(!fixture)assert.deepEqual(sketch.profile.dxfLayerStyle,{
  color:-5,plot:false,lineweight:25,linetype:{name:'Guide dash',pattern:[12.7,-6.35]}
 });
 assert.deepEqual(sketch.profile.bulges,[0,-Math.tan(Math.PI/8),0]);
 assert.deepEqual(saved.roots,[]);
 console.log('PASS Brickwright touch tilted DXF path model-space and layer filtering, import, export, reimport and SB3 layer style and width retention');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
