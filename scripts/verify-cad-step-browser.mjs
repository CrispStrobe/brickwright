// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {loadCadBrowserFixture} from './lib/cad-browser-fixtures.mjs';

const [url,fixture]=process.argv.slice(2);
if(!url||!fixture)throw Error('Usage: node scripts/verify-cad-step-browser.mjs <app-url> <Adafruit 3777 STEP file>');
const fixtureFile=await loadCadBrowserFixture('step',fixture);
const working=await mkdtemp(join(tmpdir(),'bw-step-import-'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const tab=page=>page.getByRole('tab',{name:'CAD',exact:true});
const file=page=>page.getByTestId('bw-file-menu-trigger');
async function open(){
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,acceptDownloads:true,serviceWorkers:'block'});
 page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  localStorage.setItem('bw-starter-v1-complete','1');
  localStorage.setItem('bw-cad-enabled','1');
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
 });
 await page.goto(url);
 await tab(page).tap();
 await page.waitForFunction(()=>window.__bwCad?.editor);
 return page;
}

try{
 const page=await open();
 const workers=[];
 page.on('worker',worker=>workers.push(worker.url()));
 const [picker]=await Promise.all([
  page.waitForEvent('filechooser'),
  page.evaluate(()=>{void window.__bwCad.editor.executeCommand('import');})
 ]);
 assert.equal(await picker.element().getAttribute('accept'),'.stl,.step,.stp');
 await picker.setFiles(fixtureFile);
 await page.waitForFunction(()=>window.__bwCad?.editor.session.state.document.roots.length===8);
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 assert.ok(workers.some(url=>url.includes('step-import.worker')));
 const bodies=page.getByTestId('object-name');
 if(!await bodies.first().isVisible())await page.getByRole('button',{name:'Objects',exact:true}).tap();
 assert.equal(await bodies.count(),8);
 assert.equal(await bodies.filter({hasText:'body A'}).count(),1);

 await file(page).tap();
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()
 ]);
 const project=join(working,'reference-motor.sb3');
 await download.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,30);
 assert.equal(saved.roots.length,8);
 for(const id of saved.roots){
  assert.equal(saved.nodes[id].reference,true);
  assert.equal(saved.nodes[id].surface,true);
 }
 assert.equal(saved.nodes[saved.roots[0]].color,'#fff985');
 assert.equal(await page.evaluate(()=>window.__bwCad.editor.commandState.canExport),false);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [projectPicker]=await Promise.all([
  restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()
 ]);
 restored.on('dialog',dialog=>dialog.accept());
 await projectPicker.setFiles(project);
 await tab(restored).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 const current=await restored.evaluate(async()=>{
  const editor=window.__bwCad.editor;
  await editor.whenIdle();
  return editor.session.state.document;
 });
 assert.deepEqual(current.nodes,saved.nodes);
 console.log('PASS STEP supplier motor imported with colors and eight references, print exclusion and SB3 reopen');
}finally{
 await browser.close();
 await rm(working,{recursive:true,force:true});
}
