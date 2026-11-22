// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-offset-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-offset-'));
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
 await dialog.getByLabel('Sketch name').fill('Offset panel');
 await dialog.getByLabel('Profile',{exact:true}).selectOption('region');
 const loops=dialog.getByLabel('Region loops (mm)');
 const original='0, 0 | 40, 0 | 40, 30 | 0, 30\nCIRCLE 12, 15, 4';
 await loops.fill(original);
 await dialog.getByRole('button',{name:'Create extrusion'}).tap();
 await dialog.waitFor({state:'hidden'});
 const before=await body(page);
 assert.deepEqual(before.bounds,{min:[0,0,0],max:[40,30,10]});

 const edit=page.getByRole('button',{name:'Edit sketch & extrusion',exact:true});
 if(!await edit.isVisible())await page.getByRole('button',{name:'Properties',exact:true}).tap();
 await edit.tap();
 await dialog.getByText('Offset profile',{exact:true}).tap();
 const distance=dialog.getByLabel('Offset distance (mm)');
 const offset=dialog.getByRole('button',{name:'Apply offset to draft'});
 await distance.fill('5');
 await offset.tap();
 const status=dialog.getByRole('status',{name:'Sketch status'});
 await status.waitFor({state:'visible'});
 assert.match(await status.textContent(),/region needs/);
 assert.equal(await loops.inputValue(),original);
 await distance.fill('-1');
 await offset.tap();
 await offset.and(dialog.locator('button:enabled')).waitFor({state:'visible'});
 assert.match(await loops.inputValue(),/CIRCLE 12, 15, 5$/);
 assert.deepEqual(await body(page),before);
 await dialog.getByRole('button',{name:'Apply sketch changes'}).tap();
 await dialog.waitFor({state:'hidden'});
 const expected=await body(page);
 assert.equal(expected.id,before.id);
 assert.deepEqual(expected.bounds,{min:[1,1,0],max:[39,29,10]});
 assert.ok(expected.volume<before.volume);

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'offset.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 const source=saved.sketches[saved.nodes[expected.id].sketchId];
 assert.equal(source.profile.loops[1].kind,'circle');
 assert.equal(source.profile.loops[1].radius,5);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 assert.deepEqual(await body(restored),expected);
 console.log('PASS Brickwright touch profile offset, unchanged draft on failure, and SB3 round trip');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
