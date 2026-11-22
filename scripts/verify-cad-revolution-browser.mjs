// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-revolution-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-revolution-'));
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

const revolution=page=>page.getByRole('dialog',{name:'Sketch and revolution'});
const file=page=>page.getByTestId('bw-file-menu-trigger');
const volume=(page,id)=>page.evaluate(async id=>(await window.__bwCad.editor.whenIdle()).bodies.find(body=>body.id===id)?.volume,id);
async function showProperties(page,action){
 if(!await action.isVisible())await page.getByRole('button',{name:'Properties',exact:true}).tap();
 await action.tap();
}

try{
 const page=await open();
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 const sketch=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await sketch.getByLabel('Sketch name').fill('Shared shaft profile');
 await sketch.getByLabel('Sketch plane').selectOption('XZ');
 await sketch.getByLabel('Sketch width (mm)').fill('10');
 await sketch.getByRole('button',{name:'Create extrusion'}).tap();
 await sketch.waitFor({state:'hidden'});
 await showProperties(page,page.getByRole('button',{name:'Revolve this sketch',exact:true}));
 const dialog=revolution(page),sweep=dialog.getByLabel('Sweep angle (deg)');
 assert.equal(await dialog.getByLabel('Sketch width (mm)').isDisabled(),true);
 assert.equal(await dialog.locator('.sketch-revolution-axis').getAttribute('x1'),'-5');
 await sweep.fill('180');
 await dialog.getByRole('button',{name:'Create revolution'}).tap();
 await dialog.waitFor({state:'hidden'});
 const ids=await page.evaluate(()=>{
  const {id:project,roots:[extrusion,revolution]}=window.__bwCad.editor.session.state.document;
  return {project,extrusion,revolution};
 });
 const initial=await volume(page,ids.revolution);
 assert.ok(Math.abs(initial/(Math.PI*100*30/2)-1)<.001);
 await showProperties(page,page.getByRole('button',{name:'Edit sketch & revolution',exact:true}));
 await sweep.fill('90');
 await dialog.getByLabel('Sketch depth (mm)').fill('24');
 await dialog.getByRole('button',{name:'Apply sketch changes'}).tap();
 await dialog.waitFor({state:'hidden'});
 const edited=await volume(page,ids.revolution);
 assert.ok(Math.abs(edited/initial-.4)<.001);
 assert.ok(Math.abs(await volume(page,ids.extrusion)-2400)<.001);

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'shaft.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,12);
 const node=saved.nodes[ids.revolution];
 assert.equal(node.kind,'revolution');
 assert.equal(node.angle,90);
 assert.equal(node.sketchId,saved.nodes[ids.extrusion].sketchId);
 assert.equal(saved.sketches[node.sketchId].profile.depth,24);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,ids.project);
 assert.equal(await volume(restored,ids.revolution),edited);
 const object=restored.getByTestId('object-name').filter({hasText:'Revolution'});
 if(!await object.isVisible())await restored.getByRole('button',{name:'Objects',exact:true}).tap();
 await object.tap();
 await showProperties(restored,restored.getByRole('button',{name:'Edit sketch & revolution',exact:true}));
 assert.equal(await revolution(restored).getByLabel('Sweep angle (deg)').inputValue(),'90');
 assert.equal(await revolution(restored).getByLabel('Sketch depth (mm)').inputValue(),'24');
 console.log('PASS Brickwright touch Revolve, linked sketch geometry, and SB3 save and reopen');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
