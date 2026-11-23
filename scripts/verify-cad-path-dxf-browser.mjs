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
 '0','SECTION','2','HEADER','9','$INSUNITS','70',1,'0','ENDSEC','0','SECTION','2','ENTITIES',
 '0','LINE','8','Guides','10',0,'20',2,'11',0,'21',1,
 '0','ARC','8','Guides','10',0,'20',0,'40',1,'50',0,'51',90,
 '0','LINE','8','Construction','10',2,'20',2,'11',3,'21',3,'0','ENDSEC','0','EOF'
].join('\n'));

try{
 const page=await open();
 await page.getByRole('button',{name:'Sketch path',exact:true}).tap();
 const path=page.getByRole('dialog',{name:'Sketch path',exact:true});
 await path.getByText('DXF path',{exact:true}).tap();
 const fileInput=path.getByLabel('Choose DXF file');
 await fileInput.setInputFiles(fixture||{name:'inch guide.dxf',mimeType:'application/dxf',buffer:input});
 const importedLayer=path.getByText('DXF layer: Guides',{exact:true});
 const importLayers=path.getByRole('button',{name:'Import selected layers',exact:true});
 if(!fixture){
  await path.getByRole('checkbox',{name:'Construction',exact:true}).tap();
  await importLayers.tap();
 }else{
  await Promise.race([importedLayer.waitFor({state:'visible'}),importLayers.waitFor({state:'visible'})]);
  if(await importLayers.isVisible())await importLayers.tap();
 }
 await importedLayer.waitFor({state:'visible'});
 const points=path.getByLabel('Path points X, Y (mm)');
 const expected=[ [0,50.8], [0,25.4,-Math.tan(Math.PI/8)], [25.4,0] ];
 const readPoints=async()=>(await points.inputValue()).split('\n').map(row=>row.split(',').map(Number));
 assert.deepEqual(await readPoints(),expected);
 const [exported]=await Promise.all([
  page.waitForEvent('download'),path.getByRole('button',{name:'Export path as DXF'}).tap()
 ]);
 const dxf=exportTo??join(dir,'exported.dxf');
 await exported.saveAs(dxf);
 const text=await readFile(dxf,'utf8');
 assert.match(text,/\$INSUNITS\r\n70\r\n4/);
 assert.match(text,/90\r\n3\r\n70\r\n0/);
 assert.doesNotMatch(text,/Construction/);

 await fileInput.setInputFiles({name:'Verified guide.dxf',mimeType:'application/dxf',buffer:Buffer.from(text)});
 await fileInput.and(path.locator('input:enabled')).waitFor({state:'visible'});
 assert.equal(await path.getByLabel('Sketch name').inputValue(),'Verified guide');
 assert.deepEqual(await readPoints(),expected);
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
 assert.deepEqual(sketch.profile.bulges,[0,-Math.tan(Math.PI/8),0]);
 assert.deepEqual(saved.roots,[]);
 console.log('PASS Brickwright touch DXF path layer filtering, import, export, reimport and SB3 layer retention');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
