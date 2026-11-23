// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-outline-constraints-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-outline-constraints-'));
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
 const page=await open(),workers=[];
 page.on('worker',worker=>workers.push(worker.url()));
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 const sketch=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await sketch.getByLabel('Profile',{exact:true}).selectOption('outline');
 const coordinates=sketch.getByLabel('Outline points X, Y (mm)');
 await coordinates.fill('0, 0\n38, 3\n35, 22\n2, 20');
 await sketch.getByText('Outline constraints',{exact:true}).tap();
 async function add(kind,edge,value){
  await sketch.getByLabel('Constraint',{exact:true}).selectOption(kind);
  await sketch.getByLabel('Constrained segment').selectOption(String(edge));
  if(kind==='length')await sketch.getByLabel('Segment length (mm)').fill(String(value));
  else if(value!==undefined)await sketch.getByLabel('Second segment').selectOption(String(value));
  await sketch.getByRole('button',{name:'Add constraint',exact:true}).tap();
 }
 for(const args of [
  ['horizontal',0],['vertical',1],['parallel',0,2],['perpendicular',2,3],
  ['length',0,'80 mm / 2'],['equal',0,2],['length',1,20]
 ])await add(...args);
 const solve=sketch.getByRole('button',{name:'Solve outline',exact:true});
 await solve.tap();
 await sketch.getByText('Outline solved. Fully constrained.',{exact:true}).waitFor();
 assert.ok(workers.some(url=>url.includes('outline-constraints.worker')));
 const expected='0, 0\n40, 0\n40, 20\n0, 20';
 assert.equal(await coordinates.inputValue(),expected);
 await add('length',0,45);
 await solve.tap();
 await sketch.getByText('Could not solve these outline constraints. Check dimensions and segment choices.',{exact:true}).waitFor();
 assert.equal(await coordinates.inputValue(),expected);
 await sketch.getByRole('button',{name:'Remove constraint 8',exact:true}).tap();
 assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),0);
 await sketch.getByRole('button',{name:'Create extrusion',exact:true}).tap();
 await sketch.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await file(page).tap();
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()
 ]);
 const project=join(dir,'outline.sb3');
 await download.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,31);
 assert.equal(saved.roots.length,1);
 const id=saved.nodes[saved.roots[0]].sketchId;
 const profile=saved.sketches[id].profile;
 assert.deepEqual(profile.points,[[0,0],[40,0],[40,20],[0,20]]);
 assert.equal(profile.vertexIds.length,4);
 assert.equal(profile.relations.length,7);
 assert.equal(profile.relations[4].length,'80 mm / 2');
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([
  restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()
 ]);
 restored.on('dialog',dialog=>dialog.accept());
 await picker.setFiles(project);
 await tab(restored).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 await restored.evaluate(()=>window.__bwCad.editor.whenIdle());
 const readProfile=()=>restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id);
 assert.deepEqual(await readProfile(),profile);
 const object=restored.getByTestId('object-name');
 if(!await object.isVisible())await restored.getByRole('button',{name:'Objects',exact:true}).tap();
 await object.tap();
 const edit=restored.getByRole('button',{name:'Edit sketch & extrusion',exact:true});
 if(!await edit.isVisible())await restored.getByRole('button',{name:'Properties',exact:true}).tap();
 await edit.tap();
 const reopened=restored.getByRole('dialog',{name:'Sketch and extrusion'});
 await reopened.getByRole('button',{name:'Edit constraint 5',exact:true}).tap();
 const dimension=reopened.getByLabel('Segment length (mm)');
 assert.equal(await dimension.inputValue(),'80 mm / 2');
 await dimension.fill('60');
 await reopened.getByRole('button',{name:'Update constraint',exact:true}).tap();
 await reopened.getByRole('button',{name:'Solve outline',exact:true}).tap();
 await reopened.getByText('Outline solved. Fully constrained.',{exact:true}).waitFor();
 await reopened.getByRole('button',{name:'Apply sketch changes',exact:true}).tap();
 await reopened.waitFor({state:'hidden'});
 const edited=await readProfile();
 assert.deepEqual(edited.points.map(point=>point.map(value=>Math.round(value*1e6)/1e6)),[[0,0],[60,0],[60,20],[0,20]]);
 assert.deepEqual(edited.vertexIds,profile.vertexIds);
 assert.equal(Number(edited.relations[4].length),60);
 console.log('PASS outline solve, conflict rejection, SB3 reopen, and editing a saved constraint');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
