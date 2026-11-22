// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-sketch-path-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-path-'));
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
 await dialog.getByLabel('Sketch name').fill('Open arc');
 const points=dialog.getByLabel('Path points X, Y (mm)');
 await points.fill('0, 0, 1\n@10, 0\n@0, 8\n@-10, 0');
 await dialog.getByText('Trim by line',{exact:true}).tap();
 await dialog.getByLabel('First trim point X, Y (mm)').fill('5, 7');
 await dialog.getByLabel('Second trim point X, Y (mm)').fill('5, -4');
 await dialog.getByRole('button',{name:'Trim path draft'}).tap();
 const [x,y,bulge]=(await points.inputValue()).split('\n')[0].split(',').map(Number);
 assert.ok(Math.abs(x-5)<1e-8);
 assert.ok(Math.abs(y+5)<1e-8);
 assert.ok(Math.abs(bulge-Math.tan(Math.PI/8))<1e-8);
 await dialog.getByRole('button',{name:'Save path',exact:true}).tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'open-path.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,15);
 assert.deepEqual(saved.roots,[]);
 const id=Object.keys(saved.sketches)[0],profile=saved.sketches[id].profile;
 assert.equal(profile.kind,'path');
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
 assert.deepEqual(await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id),profile);
 const path=restored.getByRole('button',{name:'Sketch path: Open arc',exact:true});
 if(!await path.isVisible())await restored.getByRole('button',{name:'Objects',exact:true}).tap();
 await path.tap();
 const reopened=restored.getByRole('dialog',{name:'Sketch path',exact:true});
 await reopened.getByRole('button',{name:'Close into outline',exact:true}).tap();
 await reopened.waitFor({state:'hidden'});
 await restored.getByRole('button',{name:'Extrude sketch: Open arc',exact:true}).tap();
 const extrusion=restored.getByRole('dialog',{name:'Sketch and extrusion'});
 await extrusion.getByLabel('Extrusion distance (mm)').fill('4');
 await extrusion.getByRole('button',{name:'Create extrusion',exact:true}).tap();
 await extrusion.waitFor({state:'hidden'});
 const geometry=await restored.evaluate(async id=>{
  const editor=window.__bwCad.editor;
  const {nodes,roots,sketches}=editor.session.state.document;
  const {bodies}=await editor.whenIdle();
  return {source:nodes[roots[0]].sketchId,profile:sketches[id].profile,volume:bodies[0].volume,height:bodies[0].bounds.max[2]};
 },id);
 assert.equal(geometry.source,id);
 assert.equal(geometry.profile.id,profile.id);
 assert.equal(geometry.profile.kind,'outline');
 assert.ok(geometry.volume>0);
 assert.equal(geometry.height,4);
 console.log('PASS Brickwright touch open path trim, body-free SB3 round trip, closure and extrusion');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
