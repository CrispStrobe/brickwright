// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-mirror-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-mirror-'));
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
 const sketch=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await sketch.getByLabel('Profile',{exact:true}).selectOption('outline');
 const points=sketch.getByLabel('Outline points X, Y (mm)');
 await points.fill('5, 0\n15, 0\n15, 4\n9, 4\n9, 10\n5, 10');
 await sketch.getByRole('button',{name:'Create extrusion'}).tap();
 await sketch.waitFor({state:'hidden'});
 const source=await body(page);
 assert.deepEqual(source.bounds.min,[5,0,0]);
 await page.getByRole('button',{name:'Mirror',exact:true}).tap();
 const create=page.getByRole('dialog',{name:'Mirror body'});
 await create.getByLabel('Plane offset (mm)').fill('20');
 await create.getByRole('button',{name:'Mirror body'}).tap();
 await create.waitFor({state:'hidden'});
 const mirrored=await body(page);
 assert.notEqual(mirrored.id,source.id);
 assert.equal(mirrored.bounds.min[0],25);
 assert.equal(mirrored.bounds.max[0],35);
 assert.ok(Math.abs(mirrored.volume-source.volume)<1e-8);

 const edit=page.getByRole('button',{name:'Edit mirror',exact:true});
 if(!await edit.isVisible())await page.getByRole('button',{name:'Properties',exact:true}).tap();
 await page.getByText('Edit source shapes',{exact:true}).tap();
 await page.getByRole('button',{name:'Edit Extrusion',exact:true}).tap();
 await page.getByRole('button',{name:'Edit sketch & extrusion',exact:true}).tap();
 await points.fill('7, 0\n15, 0\n15, 4\n9, 4\n9, 10\n7, 10');
 await sketch.getByRole('button',{name:'Apply sketch changes'}).tap();
 await sketch.waitFor({state:'hidden'});
 assert.equal((await body(page)).bounds.max[0],33);
 await page.getByRole('button',{name:'Back to Mirror of Extrusion',exact:true}).tap();
 await edit.tap();
 const dialog=page.getByRole('dialog',{name:'Edit mirror'});
 await dialog.getByLabel('Plane offset (mm)').fill('25');
 await dialog.getByRole('button',{name:'Apply mirror changes'}).tap();
 await dialog.waitFor({state:'hidden'});
 const expected=await body(page);
 assert.equal(expected.bounds.min[0],35);
 assert.equal(expected.bounds.max[0],43);

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'mirror.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,13);
 const node=saved.nodes[mirrored.id];
 assert.equal(node.kind,'mirror');
 assert.equal(node.source,source.id);
 assert.equal(node.offset,25);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 assert.deepEqual(await body(restored),expected);
 console.log('PASS Brickwright touch Mirror, live source edits, and SB3 save and reopen');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
