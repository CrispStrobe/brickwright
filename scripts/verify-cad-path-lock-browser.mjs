// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-path-lock-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-path-lock-'));
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
 await page.getByRole('button',{name:'Sketch path',exact:true}).tap();
 const dialog=page.getByRole('dialog',{name:'Sketch path',exact:true});
 await dialog.getByLabel('Sketch name').fill('Locked guide');
 await dialog.getByText('Point locks',{exact:true}).tap();
 await dialog.getByRole('combobox',{name:/^Path point/}).selectOption('1');
 await dialog.getByLabel('Locked X (mm)').fill('40 / 2');
 await dialog.getByLabel('Locked Y (mm)').fill('5');
 await dialog.getByRole('button',{name:'Lock point',exact:true}).tap();
 const marker=dialog.locator('.sketch-path-locked');
 await marker.waitFor();
 assert.equal(await marker.getAttribute('cx'),'20');
 await dialog.getByText('Segment constraints',{exact:true}).tap();
 await dialog.getByRole('combobox',{name:'Path segment'}).selectOption('1');
 await dialog.getByLabel('Endpoint distance (mm)').fill('30 / 2');
 await dialog.getByLabel('Direction (deg)').fill('90');
 await dialog.getByRole('button',{name:'Constrain segment',exact:true}).tap();
 const driven=dialog.locator('[data-driven]');
 await driven.waitFor();
 assert.equal(await driven.getAttribute('cx'),'20');
 assert.equal(await driven.getAttribute('cy'),'-20');
 await dialog.getByRole('button',{name:'Save path',exact:true}).tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'locked-path.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,28);
 assert.deepEqual(saved.roots,[]);
 const id=Object.keys(saved.sketches)[0],profile=saved.sketches[id].profile;
 assert.deepEqual(profile.anchors,[{vertexId:profile.vertexIds[1],x:'40 / 2',y:5}]);
 assert.deepEqual(profile.segmentConstraints,[
  {from:profile.vertexIds[1],to:profile.vertexIds[2],distance:'30 / 2',direction:90}
 ]);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 assert.deepEqual(await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id),profile);
 const path=restored.getByRole('button',{name:'Sketch path: Locked guide',exact:true});
 if(!await path.isVisible())await restored.getByRole('button',{name:'Objects',exact:true}).tap();
 await path.tap();
 const reopened=restored.getByRole('dialog',{name:'Sketch path',exact:true});
 await reopened.getByText('Point locks',{exact:true}).tap();
 await reopened.getByRole('combobox',{name:/^Path point/}).selectOption('1');
 assert.equal(await reopened.getByLabel('Locked X (mm)').inputValue(),'40 / 2');
 assert.equal(await reopened.locator('.sketch-path-locked').getAttribute('cy'),'-5');
 await reopened.getByRole('button',{name:'Unlock point',exact:true}).tap();
 assert.equal(await reopened.getByLabel('Path points X, Y (mm)').inputValue(),'0, 0\n20, 5\n30, 20');
 await reopened.getByText('Segment constraints',{exact:true}).tap();
 await reopened.getByRole('combobox',{name:'Path segment'}).selectOption('1');
 assert.equal(await reopened.getByLabel('Endpoint distance (mm)').inputValue(),'30 / 2');
 assert.equal(await reopened.locator('[data-driven]').getAttribute('cy'),'-20');
 await reopened.getByRole('button',{name:'Remove segment constraint',exact:true}).tap();
 assert.equal(await reopened.getByLabel('Path points X, Y (mm)').inputValue(),'0, 0\n20, 5\n20, 20');
 await reopened.getByRole('button',{name:'Save path',exact:true}).tap();
 await reopened.waitFor({state:'hidden'});
 console.log('PASS Brickwright touch point lock and segment constraint, body-free SB3 round trip and removal');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
