// SPDX-License-Identifier: BSD-3-Clause
// Real WebKit GUI: browser wheel, native input contract, and CAD editing after Stop.
import {webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.PROOF_OUT||'artifacts/editor-trackpad';await mkdir(out,{recursive:true});
const browser=await webkit.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');});
const report={checks:[],errors};
const check=name=>{report.checks.push(name);console.log('PASS',name);};
try{
 await page.goto(process.env.PROOF_URL||'http://127.0.0.1:8150/',{waitUntil:'commit'});
 await page.getByRole('tab',{name:'Blocks',exact:true}).click();await page.waitForSelector('.blocklySvg');
 await page.evaluate(()=>{
  for(let node=document.querySelector('.blocklySvg');node;node=node.parentElement){
   const key=Object.keys(node).find(k=>/^__react(InternalInstance|Fiber)/.test(k));
   if(!key)continue;
   for(let fiber=node[key];fiber;fiber=fiber.return)if(fiber.stateNode?.workspace?.getMetrics){
    window.__inputBlocks=fiber.stateNode.workspace;window.__inputBlockly=fiber.stateNode.ScratchBlocks;break;
   }
   if(window.__inputBlocks)break;
  }
  const w=window.__inputBlocks;if(!w)throw Error('Blocks workspace unavailable');
  const b=w.newBlock('motion_movesteps');b.initSvg();b.render();b.moveBy(2400,2400);w.resizeContents();
 });
 await page.waitForTimeout(400);
 const blocks=()=>page.evaluate(()=>({x:__inputBlocks.scrollX,y:__inputBlocks.scrollY,scale:__inputBlocks.scale,source:__inputBlockly.Xml.domToText(__inputBlockly.Xml.workspaceToDom(__inputBlocks))}));
 const svg=page.locator('.blocklySvg').first(),r=await svg.boundingBox(),point={x:r.x+r.width*.65,y:r.y+r.height*.5};
 let before=await blocks();await page.mouse.move(point.x,point.y);await page.mouse.wheel(80,120);await page.waitForTimeout(200);let after=await blocks();
 assert.ok(after.x<before.x&&after.y<before.y);assert.equal(after.source,before.source);assert.equal(after.scale,before.scale);check('ordinary two-axis wheel pans Blocks without changing code');
 const native=data=>page.evaluate(data=>{window.dispatchEvent(new CustomEvent('brickwright-camera-input',{detail:data}));return data.handled===true;},data);
 before=await blocks();assert.equal(await native({...point,kind:'wheel',deltaX:24,deltaY:32,deltaMode:0,precise:true}),true);after=await blocks();
 assert.ok(Math.abs(after.x-(before.x-24))<.1&&Math.abs(after.y-(before.y-32))<.1);assert.equal(after.source,before.source);check('native trackpad pan moves Blocks once in both axes');
 before=await blocks();assert.equal(await native({...point,kind:'zoom',factor:1.2}),true);after=await blocks();
 assert.ok(Math.abs(after.scale-before.scale*1.2)<.001);assert.equal(after.source,before.source);check('native pinch zooms Blocks without moving authored blocks');
 assert.equal(await native({x:20,y:20,kind:'wheel',deltaX:0,deltaY:40}),false);check('editor input leaves the app toolbar unhandled');
 const flyoutBefore=await page.evaluate(()=>__inputBlocks.getFlyout().getWorkspace().scrollY);
 assert.equal(await native({x:150,y:400,kind:'wheel',deltaX:0,deltaY:100}),true);
 assert.notEqual(await page.evaluate(()=>__inputBlocks.getFlyout().getWorkspace().scrollY),flyoutBefore);check('native scrolling reaches the block palette');
 await page.screenshot({path:`${out}/blocks.png`});
 await page.getByRole('tab',{name:'CAD',exact:true}).click();await page.waitForFunction(()=>window.__bwCad?.editor);
 await page.evaluate(async()=>{const e=__bwCad.editor;e.session.add({kind:'box',size:[20,20,20]});await e.whenIdle();e.frame();e.session.select([]);});
 const canvas=page.getByTestId('cad-canvas'),c=await canvas.boundingBox(),center={x:c.x+c.width/2,y:c.y+c.height/2};
 const design=()=>page.evaluate(()=>({selection:__bwCad.editor.session.state.selection,transform:structuredClone(__bwCad.editor.session.state.document.nodes[__bwCad.editor.session.state.document.roots[0]].transform),source:__bwCad.editor.session.serialize(),state:__bwCad.editor.simulation.state}));
 const drag=async()=>{await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x+80,center.y+20,{steps:10});await page.mouse.up();await page.evaluate(()=>__bwCad.editor.whenIdle());};
 before=await design();await drag();after=await design();assert.equal(after.selection.length,1);assert.notDeepEqual(after.transform.position,before.transform.position);check('one pointer gesture selects and drags an unselected CAD solid');
 const source=after.source,zoomBefore=await canvas.getAttribute('data-camera-zoom');
 assert.equal(await native({...center,kind:'zoom',factor:1.2}),true);await page.waitForTimeout(100);
 assert.notEqual(await canvas.getAttribute('data-camera-zoom'),zoomBefore);assert.equal((await design()).source,source);check('native input reaches CAD after switching tabs without changing the design');
 await page.evaluate(async()=>{const s=__bwCad.editor.simulation;await s.start();});await page.waitForTimeout(300);
 const recording=await page.evaluate(async()=>{const s=__bwCad.editor.simulation,before=s.replayRange();await s.stop();__bwCad.editor.frame();return {before,after:s.replayRange()};});
 assert.equal((await design()).state.state,'idle');assert.deepEqual(recording.after,recording.before);
 before=await design();await drag();after=await design();assert.notDeepEqual(after.transform.position,before.transform.position);check('CAD Stop restores dragging without Reset and retains recording until an edit');
 await page.screenshot({path:`${out}/cad-after-stop.png`});
 await page.getByRole('tab',{name:'Blocks',exact:true}).click();await page.waitForTimeout(200);
 before=await blocks();const current=await svg.boundingBox();assert.equal(await native({x:current.x+current.width*.65,y:current.y+current.height*.5,kind:'wheel',deltaX:-20,deltaY:-20}),true);after=await blocks();assert.ok(after.x>before.x&&after.y>before.y);check('Blocks native panning still works after a CAD round trip');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
