// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-trim-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-trim-'));
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

try{
 const page=await open();
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 const dialog=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await dialog.getByLabel('Sketch name').fill('Trimmed arc');
 await dialog.getByLabel('Profile',{exact:true}).selectOption('outline');
 const points=dialog.getByLabel('Outline points X, Y (mm)');
 const original='0, 0, 1\n10, 0\n10, 8\n0, 8';
 await points.fill(original);
 await dialog.getByText('Trim by line',{exact:true}).tap();
 await dialog.getByRole('button',{name:'Pick trim line',exact:true}).tap();
 const svg=dialog.locator('.sketch-preview svg');
 for(const [x,y] of [[5,7],[5,-4]]){
  await svg.scrollIntoViewIfNeeded();
  const at=await svg.evaluate((node,[x,y])=>{
   const point=new DOMPoint(x+4.5,-y-3.5).matrixTransform(node.getScreenCTM());
   return {x:point.x,y:point.y};
  },[x,y]);
  await page.touchscreen.tap(at.x,at.y);
 }
 assert.equal(await dialog.getByLabel('First trim point X, Y (mm)').inputValue(),'5, 7');
 assert.equal(await dialog.getByLabel('Second trim point X, Y (mm)').inputValue(),'5, -4');
 assert.ok(await dialog.locator('.sketch-trim-side').isVisible());
 await dialog.getByRole('button',{name:'Trim draft',exact:true}).tap();
 const [x,y,bulge]=(await points.inputValue()).split('\n')[0].split(',').map(Number);
 assert.ok(Math.abs(x-5)<1e-8);
 assert.ok(Math.abs(y+5)<1e-8);
 assert.ok(Math.abs(bulge-Math.tan(Math.PI/8))<1e-8);
 assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),0);
 await dialog.getByRole('button',{name:'Create extrusion'}).tap();
 await dialog.waitFor({state:'hidden'});
 const geometry=await page.evaluate(async()=>{
  const {bodies}=await window.__bwCad.editor.whenIdle();
  return {id:bodies[0].id,bounds:bodies[0].bounds,volume:bodies[0].volume};
 });
 assert.ok(geometry.volume>0);

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'trim.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 const id=saved.nodes[geometry.id].sketchId;
 const profile=saved.sketches[id].profile;
 assert.deepEqual(profile.points[0],[x,y]);
 assert.equal(profile.bulges[0],bulge);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 const reopened=await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id);
 assert.deepEqual(reopened,profile);
 console.log('PASS Brickwright touch trim line, retained arc and SB3 round trip');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
