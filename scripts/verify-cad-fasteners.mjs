// SPDX-License-Identifier: BSD-3-Clause
// Actual embedded GUI + qualified SDK; isolated profile, no user's app data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const cad=resolve(process.env.CAD_CHECKOUT||'../circuit-cad-engine-work');
const {createPresetDocument}=await import(pathToFileURL(resolve(cad,'packages/editor/dist/shapes.js')));
const {screwVariant}=await import(pathToFileURL(resolve(cad,'packages/core/dist/index.js')));
const out=process.env.PROOF_OUT||'artifacts/cad-fasteners-embedded';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BW_BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
await page.addInitScript(()=>{localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');});
try{
 await page.goto(process.env.PROOF_URL||'http://127.0.0.1:8150/');await page.getByRole('tab',{name:'CAD',exact:true}).click();await page.waitForFunction(()=>window.__bwCad?.editor);
 const host=page.getByTestId('bw-cad-tab'),pane=host.locator('.inspector');
 const load=async doc=>{doc.nodes[doc.roots[0]].transform.position[2]=20;await page.evaluate(async doc=>{const ed=window.__bwCad.editor;ed.session.load(doc);await ed.whenIdle();ed.session.select([doc.roots[0]]);ed.frame();},doc);if(!await pane.isVisible())await host.getByRole('button',{name:'Properties',exact:true}).click();};
 await load(createPresetDocument('screw'));
 const before=await page.evaluate(()=>window.__bwCad.editor.session.serialize());
 assert.equal(await pane.locator('input[data-size-axis="Z"]').inputValue(),'25');
 await pane.getByLabel('Head type',{exact:true}).selectOption('countersunk');assert.equal(await pane.getByLabel('Head height (mm)',{exact:true}).isVisible(),false);assert.equal(await pane.getByLabel('Countersink angle (°)',{exact:true}).isVisible(),true);
 await pane.getByLabel('Point type',{exact:true}).selectOption('gimlet');await pane.getByRole('button',{name:'Apply shape parameters',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.whenIdle());await pane.getByRole('button',{name:'Apply shape parameters',exact:true}).waitFor();
 await page.waitForFunction(()=>window.__bwCad.editor.session.state.document.nodes[window.__bwCad.editor.session.state.document.roots[0]].generator.tipStyle==='gimlet');
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 assert.equal(await pane.locator('input[data-size-axis="Z"]').inputValue(),'23');
 await host.getByRole('button',{name:'Undo',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.whenIdle());assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.serialize()),before);checks.push('Generic screw bounded at 25 mm; change head and threaded point, 23 mm after Apply, exact Undo');
 const recipe=screwVariant('set-screw');Object.assign(recipe,{tipLength:5,tipDiameter:6,cupDepth:1});await load(createPresetDocument('screw','BW',{recipe}));
 assert.equal(await pane.getByLabel('Point length (mm)',{exact:true}).isVisible(),false);assert.equal(await pane.locator('input[data-size-axis="Z"]').inputValue(),'20');await pane.getByLabel('Cup depth (mm)',{exact:true}).fill('2');await pane.getByRole('button',{name:'Apply shape parameters',exact:true}).click();await page.waitForFunction(()=>window.__bwCad.editor.session.state.document.nodes[window.__bwCad.editor.session.state.document.roots[0]].generator.cupDepth===2);await page.evaluate(()=>window.__bwCad.editor.whenIdle());checks.push('Embedded cup point has a fully bounded shaft and edits its real recess depth without a fictitious external point-length field');
 const original=await page.evaluate(()=>window.__bwCad.editor.session.serialize());const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});const box=await pane.boundingBox(),point={x:box.x+box.width*.5,y:box.y+box.height*.65};
 const metrics=()=>pane.evaluate(e=>({x:e.scrollLeft,y:e.scrollTop,width:e.clientWidth,content:e.scrollWidth,action:getComputedStyle(e).touchAction}));await pane.evaluate(e=>e.scrollTop=0);const initial=await metrics();assert.ok(initial.content<=initial.width+1);assert.equal(initial.action,'pan-y');
 const swipe=async(dx,dy)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+dx*i/12,y:point.y+dy*i/12}]});await page.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);};
 await swipe(-70,0);assert.equal((await metrics()).x,0);await swipe(0,-140);const after=await metrics();assert.ok(after.y>initial.y);assert.equal(after.x,0);assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.serialize()),original);checks.push('Actual embedded Properties: horizontal finger swipe stays at zero; vertical swipe scrolls; model/history untouched');
 await page.screenshot({path:out+'/embedded-properties.png'});assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors,metrics:after},null,2)+'\n');console.log('PASS',checks.length,'embedded fastener and trusted touch checks');
}finally{await browser.close();}
