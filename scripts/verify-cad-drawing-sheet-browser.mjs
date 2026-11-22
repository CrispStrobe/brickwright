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
   {kind:'outline',id:'plate',points:[[0,0],[40,0],[40,30],[0,30]],bulges:[0,0,-.5,0]},
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
 const cut=dialog(page).getByLabel('Section position (mm)',{exact:true});
 assert.equal(await cut.inputValue(),'15');
 const axis=dialog(page).getByLabel('Section axis',{exact:true});
 await axis.selectOption('u');
 assert.equal(await cut.inputValue(),'20');
 assert.equal(await preview(page).locator('.drawing-section').count(),1);
 await axis.selectOption('v');
 assert.equal(await cut.inputValue(),'15');
 await cut.fill('50');
 assert.match(await dialog(page).getByRole('status',{name:'Drawing status'}).textContent(),/misses the part/);
 await cut.fill('15');
 assert.equal(await preview(page).locator('.drawing-section').count(),3);
 await dialog(page).getByRole('checkbox',{name:'Offset section',exact:true}).check();
 await dialog(page).getByLabel('Second section position (mm)').fill('16');
 await dialog(page).getByLabel('Jog at (mm)').fill('spacing / 2 + 10 mm');
 assert.match(await preview(page).textContent(),/Offset section A-A/);
 assert.equal((await preview(page).locator('.drawing-cut').getAttribute('d')).split('L').length,4);
 await dialog(page).getByText('Drawing dimensions',{exact:true}).tap();
 const from=dialog(page).getByLabel('First dimension anchor');
 const to=dialog(page).getByLabel('Second dimension anchor');
 await from.selectOption({label:'Hole 1'});
 await to.selectOption({label:'Hole 2'});
 const pick=dialog(page).getByRole('button',{name:'Pick dimension position',exact:true});
 await pick.tap();
 await preview(page).scrollIntoViewIfNeeded();
 const at=await preview(page).evaluate(svg=>{
  const point=new DOMPoint(80,85).matrixTransform(svg.getScreenCTM());
  return {x:point.x,y:point.y};
 });
 await page.touchscreen.tap(at.x,at.y);
 assert.equal(await pick.getAttribute('aria-pressed'),'false');
 await dialog(page).getByRole('button',{name:'Add dimension',exact:true}).tap();
 assert.equal(await preview(page).locator('.drawing-annotation').count(),5);
 await dialog(page).getByLabel('Dimension type').selectOption('aligned');
 await from.selectOption({label:'Outline 1, point 1 (0, 0)'});
 await to.selectOption({label:'Outline 1, point 3 (40, 30)'});
 assert.equal(await preview(page).locator('.drawing-vertex-marker').count(),2);
 await dialog(page).getByLabel('Paper Y (mm)').fill('110');
 await dialog(page).getByRole('button',{name:'Add dimension',exact:true}).tap();
 assert.equal(await preview(page).locator('.drawing-annotation').count(),10);
 assert.equal(await preview(page).getByText('50 mm',{exact:true}).count(),1);
 const type=dialog(page).getByLabel('Dimension type');
 await type.selectOption('radius');
 await from.selectOption({label:'Outline 1, arc 3'});
 assert.equal(await preview(page).locator('.drawing-arc-marker').count(),1);
 await dialog(page).getByLabel('Paper X (mm)').fill('100');
 await dialog(page).getByRole('button',{name:'Add dimension',exact:true}).tap();
 assert.equal(await preview(page).getByText('R25 mm',{exact:true}).count(),1);
 await type.selectOption('arc-length');
 await from.selectOption({label:'Outline 1, arc 3'});
 await dialog(page).getByLabel('Paper X (mm)').fill('75');
 await dialog(page).getByLabel('Paper Y (mm)').fill('120');
 await dialog(page).getByRole('button',{name:'Add dimension',exact:true}).tap();
 assert.equal(await preview(page).getByText('Arc length 46.365 mm',{exact:true}).count(),1);
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
 assert.match(await preview(page).textContent(),/28 mm/);
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
 assert.ok(text.includes(Buffer.from('Offset section A-A','latin1').toString('hex')));
 assert.ok(text.includes('<'+Buffer.from('Arc length 46.365 mm','latin1').toString('hex')+'>'));
 if(pdfOutput)await pdf.saveAs(pdfOutput);
 await dialog(page).getByRole('button',{name:'Close drawing'}).tap();
 await make.tap();
 await dialog(page).getByLabel('Sheet title').fill('Motor plate overview');
 await dialog(page).getByLabel('Drawing scale').selectOption('1:2');
 await dialog(page).getByLabel('Show hidden lines').uncheck();
 await dialog(page).getByRole('button',{name:'Save drawing sheet'}).tap();
 await dialog(page).waitFor({state:'hidden'});
 await page.evaluate(()=>{
  window.__bwCad.editor.session.add({kind:'box',size:[20,30,12]},
   {name:'Rear bracket',transform:{position:[55,8,3],rotation:[0,0,20],scale:[1,1,1]}});
 });
 await waitGeometry(page);
 const drawingWorkers=[];
 page.on('worker',worker=>{if(worker.url().includes('assembly-projection.worker'))drawingWorkers.push(worker.url());});
 const createAssembly=page.getByRole('button',{name:'Create assembly drawing',exact:true});
 if(!await createAssembly.isVisible())await page.getByRole('button',{name:'Objects',exact:true}).tap();
 await createAssembly.tap();
 await dialog(page).getByLabel('Sheet title').fill('Assembly overview');
 await preview(page).getByText('Assembly · 2 bodies',{exact:true}).waitFor();
 const pathData=await preview(page).locator('.drawing-visible').getAttribute('d');
 assert.ok(pathData.split('M ').length>10);
 await dialog(page).getByLabel('Show hidden lines').uncheck();
 await dialog(page).getByLabel('Show section A-A').check();
 await dialog(page).getByLabel('Section position (mm)',{exact:true}).fill('spacing / 2');
 await preview(page).getByText('World Y = 14 mm',{exact:true}).waitFor();
 await dialog(page).getByLabel('Offset section',{exact:true}).check();
 await dialog(page).getByLabel('Second section position (mm)').fill('8');
 await dialog(page).getByLabel('Jog at (mm)').fill('spacing + 17 mm');
 await preview(page).getByText('World Y = 14 / 8 mm',{exact:true}).waitFor();
 assert.equal((await preview(page).locator('.drawing-cut').getAttribute('d')).split('L').length,4);
 assert.ok(await preview(page).locator('.drawing-section').count()>0);
 await dialog(page).getByRole('button',{name:'Add jog',exact:true}).tap();
 await dialog(page).getByLabel('Jog 2 at (mm)',{exact:true}).fill('spacing + 27 mm');
 await dialog(page).getByLabel('Position after jog 2 (mm)',{exact:true}).fill('spacing / 2');
 await preview(page).getByText('World Y = 14 / 8 / 14 mm',{exact:true}).waitFor();
 assert.equal((await preview(page).locator('.drawing-cut').getAttribute('d')).split('L').length,6);
 await dialog(page).getByText('Model edge dimensions',{exact:true}).tap();
 await dialog(page).getByRole('button',{name:'Add edge dimension',exact:true}).tap();
 await preview(page).scrollIntoViewIfNeeded();
 const picks=await preview(page).evaluate(svg=>{
  const segment=svg.querySelector('.drawing-visible').getAttribute('d').split('M ')[1];
  const [x1,y1,x2,y2]=segment.trim().replace('L ','').split(/\s+/).map(Number);
  const screen=(x,y)=>{
   const point=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());
   return {x:point.x,y:point.y};
  };
  return {edge:screen((x1+x2)/2,(y1+y2)/2),label:screen(80,92)};
 });
 await page.touchscreen.tap(picks.edge.x,picks.edge.y);
 await preview(page).locator('.drawing-model-edge-marker').waitFor({state:'attached'});
 await page.touchscreen.tap(picks.label.x,picks.label.y);
 await preview(page).locator('.drawing-annotation').first().waitFor({state:'attached'});
 assert.equal(await preview(page).locator('.drawing-annotation').count(),5);
 await dialog(page).getByLabel('Include parts list').check();
 await dialog(page).getByLabel('Preview page').selectOption('1');
 await preview(page).getByText('Rear bracket',{exact:true}).waitFor();
 const [assemblyPdf]=await Promise.all([
  page.waitForEvent('download'),
  dialog(page).getByRole('button',{name:'Export drawing PDF'}).tap()
 ]);
 const assemblyText=await readFile(await assemblyPdf.path(),'utf8');
 assert.ok(assemblyText.includes('<'+Buffer.from('Assembly overview','latin1').toString('hex')+'>'));
 assert.match(assemblyText,/\/Type \/Pages \/Count 2/);
 assert.ok(assemblyText.includes('<'+Buffer.from('World Y = 14 / 8 / 14 mm','latin1').toString('hex')+'>'));
 assert.ok(assemblyText.includes('<'+Buffer.from('Rear bracket','latin1').toString('hex')+'>'));
 await dialog(page).getByRole('button',{name:'Save drawing sheet'}).tap();
 await dialog(page).waitFor({state:'hidden'});
 const [set]=await Promise.all([
  page.waitForEvent('download'),page.getByRole('button',{name:'Export drawing set (PDF)'}).tap()
 ]);
 const setText=await readFile(await set.path(),'utf8');
 assert.match(setText,/\/Type \/Pages \/Count 4/);
 assert.ok(setText.includes(Buffer.from('Sheet 1 of 4','latin1').toString('hex')));
 assert.ok(setText.includes(Buffer.from('Sheet 4 of 4','latin1').toString('hex')));
 assert.equal(drawingWorkers.length,1,'preview and drawing-set PDF share the assembly projection');
 if(setOutput)await set.saveAs(setOutput);
 await file(page).tap();
 const [save]=await Promise.all([
  page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()
 ]);
 const project=join(dir,'plate.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,26);
 assert.deepEqual(saved.drawings[0].section,{axis:'v',position:15,jog:{at:'spacing / 2 + 10 mm',position:16}});
 assert.equal(saved.drawings[0].annotations[0].from,'circle:first');
 assert.equal(saved.drawings[0].annotations[0].to,'circle:second');
 assert.equal(saved.drawings[0].source.featureId,initial.id);
 const linkedOutline=saved.sketches[saved.drawings[0].source.sketchId].profile.loops[0];
 assert.equal(saved.drawings[0].annotations[1].from,`vertex:plate:${linkedOutline.vertexIds[0]}`);
 assert.equal(saved.drawings[0].annotations[1].to,`vertex:plate:${linkedOutline.vertexIds[2]}`);
 assert.equal(saved.drawings[0].annotations[1].kind,'aligned');
 const arc=saved.drawings[0].annotations[3];
 assert.equal(arc.kind,'arc-length');
 assert.equal(arc.from,`arc:plate:${linkedOutline.vertexIds[2]}:${linkedOutline.vertexIds[3]}`);
 assert.equal(saved.drawings[0].annotations[2].from,arc.from);
 assert.equal(saved.drawings.length,3);
 assert.equal(saved.drawings[1].scale,'1:2');
 assert.deepEqual(saved.drawings[2].source,{kind:'assembly'});
 assert.equal(saved.drawings[2].hiddenLines,false);
 assert.equal(saved.drawings[2].partsList,true);
 assert.equal(saved.drawings[2].edgeDimensions.length,1);
 assert.ok(saved.roots.includes(saved.drawings[2].edgeDimensions[0].bodyId));
 assert.deepEqual(saved.drawings[2].section,{
  axis:'v',position:'spacing / 2',jog:{at:'spacing + 17 mm',position:8},
  additionalJogs:[{at:'spacing + 27 mm',position:'spacing / 2'}]
 });
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
 assert.match(await preview(restored).textContent(),/28 mm/);
 assert.equal(await preview(restored).locator('.drawing-annotation').count(),15);
 await dialog(restored).getByText('Drawing dimensions',{exact:true}).tap();
 await dialog(restored).getByRole('button',{name:'Edit dimension 2',exact:true}).tap();
 assert.equal(await preview(restored).locator('.drawing-vertex-marker').count(),2);
 assert.equal(await dialog(restored).getByLabel('Dimension type').inputValue(),'aligned');
 assert.equal(await preview(restored).getByText('50 mm',{exact:true}).count(),1);
 assert.equal(await preview(restored).getByText('R25 mm',{exact:true}).count(),1);
 assert.equal(await preview(restored).getByText('Arc length 46.365 mm',{exact:true}).count(),1);
 await dialog(restored).getByRole('button',{name:'Edit dimension 4',exact:true}).tap();
 assert.equal(await preview(restored).locator('.drawing-arc-marker').count(),1);
 assert.equal(await dialog(restored).getByLabel('Dimension type').inputValue(),'arc-length');
 assert.equal(await dialog(restored).getByLabel('Section position (mm)',{exact:true}).inputValue(),'15');
 assert.equal(await dialog(restored).getByLabel('Second section position (mm)').inputValue(),'16');
 assert.equal(await dialog(restored).getByLabel('Jog at (mm)').inputValue(),'spacing / 2 + 10 mm');
 assert.match(await preview(restored).textContent(),/Offset section A-A/);
 await dialog(restored).getByRole('button',{name:'Close drawing'}).tap();
 await restored.getByRole('button',{name:'Drawing: Motor plate overview',exact:true}).tap();
 assert.equal(await spacing(restored),14);
 assert.equal(await preview(restored).locator('.drawing-hidden').count(),0);
 await dialog(restored).getByRole('button',{name:'Close drawing'}).tap();
 await restored.getByRole('button',{name:'Drawing: Assembly overview',exact:true}).tap();
 await preview(restored).getByText('Assembly · 2 bodies',{exact:true}).waitFor();
 assert.equal(await preview(restored).locator('.drawing-hidden').count(),0);
 assert.equal(await dialog(restored).getByLabel('Include parts list').isChecked(),true);
 assert.equal(await dialog(restored).getByLabel('Section position (mm)',{exact:true}).inputValue(),'spacing / 2');
 assert.equal(await dialog(restored).getByLabel('Jog at (mm)').inputValue(),'spacing + 17 mm');
 assert.equal(await dialog(restored).getByLabel('Jog 2 at (mm)',{exact:true}).inputValue(),'spacing + 27 mm');
 assert.equal(await dialog(restored).getByLabel('Position after jog 2 (mm)',{exact:true}).inputValue(),'spacing / 2');
 await preview(restored).getByText('World Y = 14 / 8 / 14 mm',{exact:true}).waitFor();
 assert.equal(await preview(restored).locator('.drawing-annotation').count(),5);
 await dialog(restored).getByLabel('Preview page').selectOption('1');
 await preview(restored).getByText('Rear bracket',{exact:true}).waitFor();
 console.log('PASS model-edge dimensions, multi-jog assembly sections, parts lists, worker-backed assembly and linked sketch drawing sheets in Brickwright: touch controls, live parameters, linked offset sections, aligned and curved dimensions, single and numbered vector PDFs, and SB3 save and reopen');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
