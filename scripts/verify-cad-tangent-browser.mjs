// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-tangent-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-tangent-'));
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
 const sketchButton=page.getByRole('button',{name:'Sketch',exact:true});
 const dialog=page.getByRole('dialog',{name:'Sketch and extrusion'});
 const profile=dialog.getByLabel('Profile',{exact:true});
 const create=dialog.getByRole('button',{name:'Create extrusion'});
 await sketchButton.tap();
 await dialog.getByLabel('Sketch name').fill('Circular guide');
 await profile.selectOption('circle');
 await dialog.getByLabel('Circle center X, Y (mm)').fill('10, 0');
 await dialog.getByLabel('Sketch radius (mm)').fill('6');
 await create.tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await sketchButton.tap();
 await dialog.getByLabel('Sketch name').fill('Tangential outline');
 await profile.selectOption('outline');
 const points=dialog.getByLabel('Outline points X, Y (mm)');
 await points.fill('0, 0\n9, 7, 0.2\n25, 22\n0, 22');
 await dialog.getByText('Sketch snap references',{exact:true}).tap();
 await dialog.getByLabel('Reference sketch',{exact:true}).selectOption({label:'Circular guide'});
 await dialog.getByRole('checkbox',{name:'Snap straight edges tangent to arcs and circles'}).check();
 const vertex=dialog.locator('[data-resize="vertex"][data-vertex="1"]');
 await vertex.scrollIntoViewIfNeeded();
 const [start,target]=await vertex.evaluate(node=>{
  const matrix=node.getScreenCTM(),x=node.cx.baseVal.value,y=node.cy.baseVal.value;
  return [[x,y],[x-2.4,y+2.1]].map(([x,y])=>{
   const point=new DOMPoint(x,y).matrixTransform(matrix);
   return {x:point.x,y:point.y};
  });
 });
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
 for(const part of [.25,.5,.75,1]){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{
   x:start.x+part*(target.x-start.x),y:start.y+part*(target.y-start.y)
  }]});
 }
 const label=dialog.locator('.sketch-snap-label');
 await label.waitFor({state:'visible'});
 assert.equal(await label.textContent(),'Tangent');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await cdp.detach();
 const [x,y,bulge]=(await points.inputValue()).split('\n')[1].split(',').map(Number);
 assert.ok(Math.abs(x-6.4)<1e-8);
 assert.ok(Math.abs(y-4.8)<1e-8);
 assert.equal(bulge,.2);
 await create.tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await file(page).tap();
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()]);
 const project=join(dir,'tangent.sb3');
 await save.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 const id=Object.values(saved.sketches).find(sketch=>sketch.name==='Tangential outline').id;
 assert.deepEqual(saved.sketches[id].profile.points[1],[x,y]);
 assert.equal(saved.sketches[id].profile.bulges[1],.2);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()]);
 restored.on('dialog',modal=>modal.accept());
 await picker.setFiles(project);
 await restored.getByRole('tab',{name:'CAD',exact:true}).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 const reopened=await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id);
 assert.deepEqual(reopened.points[1],[x,y]);
 assert.equal(reopened.bulges[1],.2);
 console.log('PASS Brickwright touch tangent snap, retained adjacent arc and SB3 round trip');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
