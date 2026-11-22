// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url,pdfOutput,setOutput]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-drawing-sheet-browser.mjs <app-url> [sheet.pdf] [set.pdf]');
const dir=await mkdtemp(join(tmpdir(),'bw-linked-drawing-'));
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

const preview=page=>page.getByRole('img',{name:'Drawing preview'});
const spacing=page=>preview(page).locator('circle').evaluateAll(circles=>
 Math.abs(Number(circles[1].getAttribute('cx'))-Number(circles[0].getAttribute('cx'))));
const sheet=page=>page.getByRole('button',{name:'Drawing: Motor plate drawing',exact:true});
const dialog=page=>page.getByRole('dialog',{name:'Drawing sheet',exact:true});
const waitGeometry=page=>page.evaluate(()=>window.__bwCad.editor.whenIdle());
async function showSheet(page){
 if(!await sheet(page).isVisible())await page.getByRole('button',{name:'Objects',exact:true}).tap();
 await sheet(page).tap();
}
const file=page=>page.getByTestId('bw-file-menu-trigger');

try{
 const page=await open();
 const initial=await page.evaluate(()=>{
  const session=window.__bwCad.editor.session;
  session.setParametric({version:1,parameters:{spacing:{expression:'20',unit:'mm'}},bindings:[]});
  const id=session.addSketchExtrusion({kind:'region',id:'profile',loops:[
   {kind:'outline',id:'plate',points:[[0,0],[40,0],[40,30],[0,30]]},
   {kind:'circle',id:'first',center:['20 mm - spacing / 2',15],radius:2,segments:64},
   {kind:'circle',id:'second',center:['20 mm + spacing / 2',15],radius:3,segments:64}
  ]},{name:'Mounting plate',distance:6});
  return {id,project:session.state.document.id};
 });
 await waitGeometry(page);
 const make=page.getByRole('button',{name:'Create drawing sheet'});
 if(!await make.isVisible())await page.getByRole('button',{name:'Properties',exact:true}).tap();
 await make.tap();
 await dialog(page).getByLabel('Sheet title').fill('Motor plate drawing');
 assert.equal(await spacing(page),20);
 await dialog(page).getByRole('checkbox',{name:'Show section A-A'}).check();
 const cut=dialog(page).getByLabel('Section position (mm)');
 assert.equal(await cut.inputValue(),'15');
 await cut.fill('50');
 assert.match(await dialog(page).getByRole('status',{name:'Drawing status'}).textContent(),/misses the part/);
 await cut.fill('15');
 assert.equal(await preview(page).locator('.drawing-section').count(),3);
 await dialog(page).getByRole('button',{name:'Save drawing sheet'}).tap();
 await dialog(page).waitFor({state:'hidden'});

 await page.getByRole('button',{name:'Parameters',exact:true}).tap();
 const parameters=page.getByRole('dialog',{name:'Model parameters'});
 await parameters.getByLabel('Parameter expression',{exact:true}).fill('28');
 await parameters.getByRole('button',{name:'Apply parameters'}).tap();
 await parameters.getByRole('button',{name:'Close parameters'}).tap();
 await waitGeometry(page);
 await showSheet(page);
 assert.equal(await spacing(page),28);
 assert.equal(await preview(page).locator('.drawing-hidden').count(),8);
 const [pdf]=await Promise.all([
  page.waitForEvent('download'),
  dialog(page).getByRole('button',{name:'Export drawing PDF'}).tap()
 ]);
 const text=await readFile(await pdf.path(),'utf8');
 assert.match(text,/\/MediaBox \[0 0 841\.88976 595\.27559\]/);
 assert.match(text,/229 14 m 279 14 l/);
 assert.match(text,/\[1\.4 0\.9\] 0 d/);
 assert.match(text,/\[3\.5 1 0\.7 1\] 0 d/);
 if(pdfOutput)await pdf.saveAs(pdfOutput);
 await dialog(page).getByRole('button',{name:'Close drawing'}).tap();
 await make.tap();
 await dialog(page).getByLabel('Sheet title').fill('Motor plate overview');
 await dialog(page).getByLabel('Drawing scale').selectOption('1:2');
 await dialog(page).getByLabel('Show hidden lines').uncheck();
 await dialog(page).getByRole('button',{name:'Save drawing sheet'}).tap();
 await dialog(page).waitFor({state:'hidden'});
 const [set]=await Promise.all([
  page.waitForEvent('download'),page.getByRole('button',{name:'Export drawing set (PDF)'}).tap()
 ]);
 const setText=await readFile(await set.path(),'utf8');
 assert.match(setText,/\/Type \/Pages \/Count 2/);
 assert.ok(setText.includes(Buffer.from('Sheet 1 of 2','latin1').toString('hex')));
 assert.ok(setText.includes(Buffer.from('Sheet 2 of 2','latin1').toString('hex')));
 if(setOutput)await set.saveAs(setOutput);
 await file(page).tap();
 const [save]=await Promise.all([
  page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()
 ]);
 const project=join(dir,'plate.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,10);
 assert.deepEqual(saved.drawings[0].section,{axis:'v',position:15});
 assert.equal(saved.drawings[0].source.featureId,initial.id);
 assert.equal(saved.drawings.length,2);
 assert.equal(saved.drawings[1].scale,'1:2');
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([
  restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()
 ]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(project=>window.__bwCad?.editor.session.state.document.id===project,initial.project);
 await waitGeometry(restored);
 await showSheet(restored);
 assert.equal(await spacing(restored),28);
 assert.equal(await preview(restored).locator('.drawing-hidden').count(),8);
 assert.equal(await preview(restored).locator('.drawing-section').count(),3);
 assert.equal(await dialog(restored).getByLabel('Section position (mm)').inputValue(),'15');
 await dialog(restored).getByRole('button',{name:'Close drawing'}).tap();
 await restored.getByRole('button',{name:'Drawing: Motor plate overview',exact:true}).tap();
 assert.equal(await spacing(restored),14);
 assert.equal(await preview(restored).locator('.drawing-hidden').count(),0);
 console.log('PASS linked drawing sheets in Brickwright: touch controls, live parameters, linked section, single and numbered vector PDFs, and SB3 save and reopen');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
