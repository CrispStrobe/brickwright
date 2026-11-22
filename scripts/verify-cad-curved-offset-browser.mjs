// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-curved-offset-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-curve-offset-'));
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
const body=page=>page.evaluate(async()=>{
 const {bodies}=await window.__bwCad.editor.whenIdle();
 const {id,bounds,volume}=bodies[0];
 return {id,bounds,volume};
});

try{
 const page=await open();
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 const dialog=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await dialog.getByLabel('Sketch name').fill('Curved offset');
 await dialog.getByLabel('Profile',{exact:true}).selectOption('outline');
 const outline=dialog.getByLabel('Outline points X, Y (mm)');
 const original='0, 0, 1\n10, 0\n10, 8\n0, 8';
 await outline.fill(original);
 await dialog.getByText('Offset profile',{exact:true}).tap();
 const distance=dialog.getByLabel('Offset distance (mm)');
 const offset=dialog.getByRole('button',{name:'Apply offset to draft'});
 await distance.fill('-10');
 await offset.tap();
 const status=dialog.getByRole('status',{name:'Sketch status'});
 await status.waitFor({state:'visible'});
 assert.match(await status.textContent(),/collapses an edge/);
 assert.equal(await outline.inputValue(),original);
 await distance.fill('1');
 await offset.tap();
 await offset.and(dialog.locator('button:enabled')).waitFor({state:'visible'});
 const rows=(await outline.inputValue()).split('\n').map(row=>row.split(',').map(Number));
 assert.equal(rows.length,6);
 assert.ok(Math.abs(rows[0][2]-1)<1e-8);
 assert.equal(rows.filter(row=>row[2]).length,3);
 await dialog.getByRole('button',{name:'Create extrusion'}).tap();
 await dialog.waitFor({state:'hidden'});
 const result=await body(page);
 const wanted=[-1,-6,0,11,9,10];
 [...result.bounds.min,...result.bounds.max].forEach((value,i)=>assert.ok(Math.abs(value-wanted[i])<1e-6));

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'offset-arc.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 const id=saved.nodes[result.id].sketchId;
 const profile=saved.sketches[id].profile;
 assert.equal(profile.kind,'outline');
 assert.deepEqual(profile.bulges,rows.map(row=>row[2]??0));
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 assert.deepEqual(await body(restored),result);
 assert.deepEqual(await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id),profile);
 console.log('PASS Brickwright touch curved offset, editable arcs, and SB3 round trip');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
