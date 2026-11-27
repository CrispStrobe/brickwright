// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {loadCadBrowserFixture} from './lib/cad-browser-fixtures.mjs';

const [url,fixture,output]=process.argv.slice(2);
if(!url||!fixture)throw Error('Usage: node scripts/verify-cad-dwg-browser.mjs <app-url> <inch plate.dwg> [exported.dwg]');
const fixtureFile=await loadCadBrowserFixture('dwg',fixture);
const dir=await mkdtemp(join(tmpdir(),'bw-dwg-project-'));
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
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 const sketch=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await sketch.getByText('Import DXF or DWG outline',{exact:true}).tap();
 await sketch.getByLabel('Choose DWG file',{exact:true}).setInputFiles(fixtureFile);
 const layers=sketch.getByRole('group',{name:'DWG layers',exact:true});
 await layers.getByRole('checkbox',{name:'GUIDES',exact:true}).uncheck();
 await sketch.getByText('Paper-space layout entities were skipped.',{exact:true}).waitFor();
 await sketch.getByRole('button',{name:'Import selected layers',exact:true}).tap();
 assert.ok(workers.some(url=>url.includes('sketch-dwg.worker')));
 const coordinates=sketch.getByLabel('Outline points X, Y (mm)',{exact:true});
 assert.match(await coordinates.inputValue(),/50\.8, 25\.4/);
 await sketch.getByRole('button',{name:'Create extrusion',exact:true}).tap();
 await sketch.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 const exportDwg=page.getByRole('button',{name:'Export sketch as DWG',exact:true});
 if(!await exportDwg.isVisible())await page.getByRole('button',{name:'Properties',exact:true}).tap();
 const [dwg]=await Promise.all([page.waitForEvent('download'),exportDwg.tap()]);
 const bytes=await readFile(await dwg.path());
 assert.equal(bytes.subarray(0,6).toString(),'AC1032');
 if(output)await dwg.saveAs(output);
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 await sketch.getByText('Import DXF or DWG outline',{exact:true}).tap();
 await sketch.getByLabel('Choose DWG file',{exact:true}).setInputFiles({name:'Round trip.dwg',mimeType:'image/vnd.dwg',buffer:bytes});
 await coordinates.waitFor({state:'visible'});
 assert.match(await coordinates.inputValue(),/50\.8, 25\.4/);
 assert.match(await coordinates.inputValue(),/0, 0, 0\.25, 2\.54, 5\.08/);
 await sketch.getByRole('button',{name:'Close sketch',exact:true}).tap();

 await file(page).tap();
 const [save]=await Promise.all([
  page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()
 ]);
 const project=join(dir,'inch-plate.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.roots.length,1);
 const sketchId=saved.nodes[saved.roots[0]].sketchId;
 const profile=saved.sketches[sketchId].profile;
 assert.equal(profile.dxfLayer,'CUT');
 assert.deepEqual(profile.points,[[0,0],[50.8,0],[50.8,25.4],[0,25.4]]);
 assert.equal(profile.bulges[0],.25);
 assert.ok(Math.abs(profile.dxfWidths[0][1]-5.08)<1e-8);
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
 assert.deepEqual(await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,sketchId),profile);
 const object=restored.getByTestId('object-name');
 if(!await object.isVisible())await restored.getByRole('button',{name:'Objects',exact:true}).tap();
 await object.tap();
 const edit=restored.getByRole('button',{name:'Edit sketch & extrusion',exact:true});
 if(!await edit.isVisible())await restored.getByRole('button',{name:'Properties',exact:true}).tap();
 await edit.tap();
 assert.match(await restored.getByLabel('Outline points X, Y (mm)',{exact:true}).inputValue(),/50\.8, 25\.4/);
 console.log('PASS DWG import, binary export and reimport, layer selection, inch scale, editable geometry and Brickwright SB3 save and reopen');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
