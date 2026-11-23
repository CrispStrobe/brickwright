// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-pattern-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-pattern-'));
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
 await sketch.getByLabel('Profile',{exact:true}).selectOption('circle');
 const radius=sketch.getByLabel('Sketch radius (mm)');
 await radius.fill('2');
 await sketch.getByLabel('Circle center X, Y (mm)').fill('14, 2');
 await sketch.getByRole('button',{name:'Create extrusion'}).tap();
 await sketch.waitFor({state:'hidden'});
 const source=await body(page);
 assert.deepEqual(source.bounds.min,[12,0,0]);

 await page.locator('summary[aria-label="Edit menu"]').tap();
 await page.getByRole('button',{name:'Pattern',exact:true}).tap();
 const create=page.getByRole('dialog',{name:'Pattern body'});
 await create.getByLabel('Total instances').fill('3');
 await create.getByLabel('Spacing (mm)').fill('12');
 await create.getByRole('button',{name:'Create pattern'}).tap();
 await create.waitFor({state:'hidden'});
 const row=await body(page);
 assert.equal(row.bounds.max[0],40);
 assert.ok(Math.abs(row.volume/source.volume-3)<1e-8);

 const edit=page.getByRole('button',{name:'Edit pattern',exact:true});
 if(!await edit.isVisible())await page.getByRole('button',{name:'Properties',exact:true}).tap();
 await edit.tap();
 const dialog=page.getByRole('dialog',{name:'Edit pattern'});
 await dialog.getByLabel('Pattern type').selectOption('circular');
 await dialog.getByLabel('Center X (mm)').fill('4');
 await dialog.getByLabel('Center Y (mm)').fill('2');
 await dialog.getByLabel('Total instances').fill('4');
 await dialog.getByRole('button',{name:'Apply pattern changes'}).tap();
 await dialog.waitFor({state:'hidden'});
 const ring=await body(page);
 assert.equal(ring.id,row.id);
 assert.deepEqual(ring.bounds.min,[-8,-10,0]);
 assert.deepEqual(ring.bounds.max,[16,14,10]);
 assert.ok(Math.abs(ring.volume/source.volume-4)<1e-8);

 await page.getByText('Edit source shapes',{exact:true}).tap();
 await page.getByRole('button',{name:'Edit Extrusion',exact:true}).tap();
 await page.getByRole('button',{name:'Edit sketch & extrusion',exact:true}).tap();
 await radius.fill('3');
 await sketch.getByRole('button',{name:'Apply sketch changes'}).tap();
 await sketch.waitFor({state:'hidden'});
 const expected=await body(page);
 assert.equal(expected.id,ring.id);
 assert.deepEqual(expected.bounds.min,[-9,-11,0]);
 assert.ok(Math.abs(expected.volume/ring.volume-2.25)<1e-8);

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'bolt-circle.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,14);
 const node=saved.nodes[ring.id];
 assert.equal(node.kind,'pattern');
 assert.equal(node.source,source.id);
 assert.deepEqual(node.pattern,{mode:'circular',axis:'Z',count:4,center:[4,2],sweep:360});
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 assert.deepEqual(await body(restored),expected);
 console.log('PASS Brickwright touch linear and circular patterns, live source edits, and SB3 save and reopen');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
