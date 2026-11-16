// SPDX-License-Identifier: BSD-3-Clause
// Runs against the complete shipping GUI, real Scratch VM, Board, worker and Jolt.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.PROOF_URL || 'http://127.0.0.1:8134/';
const engine=process.argv.includes('--webkit')?webkit:chromium;
const browser=await engine.launch({headless:true,args:engine===chromium?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[],...(engine===chromium&&process.env.BW_BROWSER_EXECUTABLE?{executablePath:process.env.BW_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:process.argv.includes('--ipad')?{width:1024,height:768}:{width:1366,height:1024},hasTouch:engine===webkit||process.argv.includes('--ipad'),serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('pageerror',e.message);});
page.on('dialog',d=>d.accept());page.setDefaultTimeout(180000);
const wait=predicate=>page.waitForFunction(predicate,null,{polling:100,timeout:180000});
await page.addInitScript(()=>{localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');});
const flavor=`${engine===webkit?'webkit':'chromium'}-${process.argv.includes('--firmware')?'firmware':'blocks'}`;
const out='artifacts/circuit-cad';await mkdir(out,{recursive:true});
const pulse=setInterval(()=>page.evaluate(()=>window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.cadCircuitSimulation?.state()).then(s=>console.log('progress',s?.phase,s?.time,s?.error)).catch(()=>{}),10000);
try{
 await page.goto(url,{waitUntil:'commit'});
 await wait(()=>window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime);
 console.log('GUI ready');
 await page.getByRole('tab',{name:'CAD',exact:true}).click();await wait(()=>window.__bwCad?.editor);
 if(process.argv.includes('--dark')){
  if(!await page.getByTestId('bw-settings-menu-trigger').isVisible())await page.getByTestId('bw-chrome-toggle').click();
  await page.getByTestId('bw-settings-menu-trigger').click();const preference=page.getByLabel(/Color mode/i);
  if(!await preference.isVisible())await page.getByText('Preferences',{exact:true}).click();await preference.selectOption('dark');await page.keyboard.press('Escape');
  await wait(()=>window.__bwCad?.editor.colorMode==='dark');
  if(!await page.evaluate(()=>document.body.classList.contains('bw-compact-chrome')))await page.getByTestId('bw-chrome-toggle').click();
 }
 if(process.argv.includes('--library')){
  const cad=page.getByTestId('bw-cad-tab');await cad.getByRole('button',{name:'Model library',exact:true}).click();
  const models=cad.getByRole('dialog',{name:'Model library',exact:true}),filter=models.getByLabel('Model type',{exact:true});
  const cards=models.locator('.model-library-card:has(.model-card-meta)');
  await filter.selectOption('source');await wait(()=>document.querySelector('[data-testid="bw-cad-tab"] [data-state]')?.shadowRoot?.querySelectorAll('.model-library-card').length>=154);
  const sources=await cards.count();assert.ok(sources>=154,'editable sources must remain available');
  await filter.selectOption('');const thumbnails=await cards.evaluateAll(async entries=>{
   const failures=[];await Promise.all(entries.map(async card=>{const source=card.querySelector('img')?.src;if(!source){failures.push(card.textContent);return;}try{const bitmap=new Image();bitmap.src=source;await bitmap.decode();if(!bitmap.naturalWidth||!bitmap.naturalHeight)failures.push(card.textContent);}catch{failures.push(card.textContent);}}));return{models:entries.length,failures};
  });assert.ok(thumbnails.models>=302);assert.deepEqual(thumbnails.failures,[],'every curated thumbnail must decode');
  const adafruit=models.locator('.model-library-card[data-archive-folder]');
  await wait(()=>{const root=document.querySelector('[data-testid="bw-cad-tab"] [data-state]')?.shadowRoot;return root?.querySelectorAll('.model-library-card img[data-adafruit-preview][src^="data:image/png"]').length===482;});
  const archiveImages=await adafruit.locator('img').evaluateAll(async entries=>{const failures=[];await Promise.all(entries.map(async image=>{try{const copy=new Image();copy.src=image.src;await copy.decode();if(copy.naturalWidth!==256||copy.naturalHeight!==192)failures.push(image.alt);}catch{failures.push(image.alt);}}));return{models:entries.length,failures};});assert.equal(archiveImages.models,482);assert.deepEqual(archiveImages.failures,[]);
  await models.getByLabel('Search models').fill('Adafruit');await adafruit.first().click();await page.screenshot({path:`${out}/${flavor}-adafruit.png`,animations:'disabled',timeout:10000});
  await models.getByLabel('Search models').fill('1602 CAP1188');await adafruit.first().click();assert.ok(await models.locator('.model-library-preview img[data-adafruit-preview]').isVisible());await models.getByLabel('Search models').fill('');
  let downloads=0;const downloaded=()=>downloads++;page.on('download',downloaded);
  await page.evaluate(()=>{window.__libraryInitialRoots=window.__bwCad.editor.session.state.document.roots.length;});
  await filter.selectOption('source');await cards.first().click();assert.ok(await models.locator('.model-library-preview img').isVisible());
  await models.getByRole('button',{name:'Insert editable source',exact:true}).click();
  await wait(()=>window.__bwCad.editor.session.state.document.roots.length>window.__libraryInitialRoots);
  const source=await page.evaluate(()=>{const s=window.__bwCad.editor.session.state,n=s.document.nodes[s.selection[0]];return{kind:n.kind,source:n.program?.source,provenance:n.provenance?.length};});
  assert.equal(source.kind,'code');assert.ok(source.source?.length);assert.ok(source.provenance);
  await page.evaluate(()=>window.__bwCad.editor.whenIdle());await filter.selectOption('mesh');const meshes=await cards.count();assert.ok(meshes>=148);
  await cards.first().click();await models.getByRole('button',{name:'Insert selected STL',exact:true}).click();
  await wait(()=>window.__bwCad.editor.session.state.document.roots.length>=window.__libraryInitialRoots+2);
  const mesh=await page.evaluate(()=>{const s=window.__bwCad.editor.session.state,n=s.document.nodes[s.selection[0]];return{kind:n.kind,provenance:n.provenance?.length};});assert.equal(mesh.kind,'mesh');assert.ok(mesh.provenance);assert.equal(downloads,0,'insertion must not become a browser download');page.off('download',downloaded);
  await writeFile(`${out}/library-verification.json`,JSON.stringify({sources,meshes,thumbnails,archiveImages,sourceInserted:source.kind,meshInserted:mesh.kind,downloads},null,2));
  await models.getByRole('button',{name:'Close model library'}).click();console.log(`PASS ${thumbnails.models} curated previews, ${sources} editable sources, ${meshes} meshes, ${archiveImages.models} Adafruit previews, and direct source/STL insertion`);
 }
 const controls=page.getByTestId('bw-cad-program-toolbar'),settings=page.getByTestId('bw-cad-program-settings');
 const layout=()=>page.evaluate(()=>{const host=document.querySelector('[data-testid="bw-cad-tab"] [data-state]'),root=host.shadowRoot,b=root.querySelector('.viewport').getBoundingClientRect(),h=host.getBoundingClientRect(),bar=document.querySelector('[data-testid="bw-cad-program-toolbar"]').getBoundingClientRect();return{viewportTop:b.top,viewportHeight:b.height,header:b.top-h.top,controlsTop:bar.top,compact:document.body.classList.contains('bw-compact-chrome'),fileMenuVisible:[...root.querySelectorAll('summary')].some(s=>s.getAttribute('aria-label')==='File menu'&&s.getBoundingClientRect().height>0)};});
 const beforeSetup=await layout();assert.ok(beforeSetup.header<=64,JSON.stringify(beforeSetup));assert.equal(beforeSetup.compact,true);assert.equal(beforeSetup.fileMenuVisible,false);
 await settings.click();const panel=page.getByTestId('bw-cad-circuit-panel');await panel.waitFor({state:'visible'});const afterSetup=await layout();assert.equal(afterSetup.viewportTop,beforeSetup.viewportTop);assert.equal(afterSetup.viewportHeight,beforeSetup.viewportHeight,'setup drawer must not consume a workspace row');
 await page.screenshot({path:`${out}/${flavor}-setup.png`,animations:'disabled',timeout:10000});
 await panel.getByRole('button',{name:'Open Scout example…',exact:true}).click();
 await wait(()=>window.__bwCad?.editor.session.state.document.id==='robot-tt-rover');
 console.log('Demo CAD loaded');
 await page.getByRole('tab',{name:'Circuit',exact:true}).click();
 await wait(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard?.parts.some(p=>p.id==='left'));
 await page.getByRole('tab',{name:'CAD',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 await page.evaluate(()=>{window.__coupledMaxEncoder=0;window.addEventListener('bw-cad-circuit-status',()=>{const r=window.__brickwrightStore.getState().scratchGui.vm.runtime,b=r.circuitBoard,count=b?.getDeviceState('left')?.count;if(Number.isFinite(count))window.__coupledMaxEncoder=Math.max(window.__coupledMaxEncoder,count);});});
 const before=await page.evaluate(()=>window.__bwCad.editor.session.serialize());
 if(process.argv.includes('--firmware')){await settings.click();await panel.getByLabel('Program runner').selectOption('firmware');await panel.getByRole('button',{name:'Close program settings'}).click();}
 await page.getByTestId('bw-cad-run').click();
 await wait(()=>['running','error'].includes(window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state().phase));
 let state=await page.evaluate(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state());
 assert.equal(state.phase,'running',state.error);console.log('Shared simulation running');
 await wait(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state().time>.2);
 console.log('Electrical and mechanical feedback active');
 await page.getByRole('tab',{name:'Code',exact:true}).click();
 await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.time>2.5 || s.phase!=='running';});
 const result=await page.evaluate(()=>{
  const runtime=window.__brickwrightStore.getState().scratchGui.vm.runtime,b=runtime.circuitBoard,s=runtime.cadCircuitSimulation.state(),f=window.__bwCad.editor.simulation.snapshot();
  return {state:s,frame:f,encoder:b.getDeviceState('left').count,peakEncoder:window.__coupledMaxEncoder,source:window.__bwCad.editor.session.serialize(),pins:b.getPinStates(),stc:runtime.stc,parts:b.parts.map(p=>({id:p.id,kind:p.kind,params:p.params})),voltages:[...b.nodeVoltages]};
 });
 await writeFile(`${out}/latest-debug.json`,JSON.stringify(result,null,2));
 assert.equal(result.state.phase,'running',result.state.error);assert.equal(result.source,before,'preview never changes document or histories');
 const chassis=result.frame.poses.find(p=>p.id==='chassis');assert.ok(Math.hypot(...chassis.positionMm)>10,JSON.stringify(chassis));assert.ok(result.peakEncoder>=8,'program received actual encoder edges');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('bw-open-cad')));
 await controls.waitFor({state:'visible'});
 await controls.getByRole('button',{name:'Stop program',exact:true}).click({force:true});
 const stopped=await page.evaluate(()=>{const r=window.__brickwrightStore.getState().scratchGui.vm.runtime;return {powered:r.circuitBoard.powered,t:String(r.circuitBoard.timeNs),clock:!!r.bwProgramClock};});
 assert.equal(stopped.powered,false);assert.equal(stopped.clock,false);
 await new Promise(r=>setTimeout(r,100));assert.equal(await page.evaluate(()=>String(window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard.timeNs)),stopped.t);
 await page.evaluate(()=>window.__bwCad.editor.frame());
 await page.screenshot({path:`${out}/${flavor}-coupled.png`,animations:'disabled',timeout:10000});
 await controls.getByRole('button',{name:'Reset simulation',exact:true}).click({force:true});assert.equal(await page.evaluate(()=>window.__bwCad.editor.simulation.snapshot().time),0);
 delete result.source;await writeFile(`${out}/${flavor}-result.json`,JSON.stringify({...result,stopped,errors},null,2));
 assert.deepEqual(errors,[]);console.log('PASS physical chassis, encoder feedback, immutable source, stop and reset');
} catch(e){console.error(await page.evaluate(()=>({status:window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.cadCircuitSimulation?.state(),clock:(()=>{const c=window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwProgramClock;return c?{owedMs:c.owedMs,programMs:c.programMs,simulatedMs:c.simulatedMs,stats:c.stats,pace:c._pace,timers:[...c._timers.values()].map(t=>({due:t.due,every:t.every}))}:null;})(),alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent)})).catch(()=>null));await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});throw e;}finally{clearInterval(pulse);await browser.close();}
