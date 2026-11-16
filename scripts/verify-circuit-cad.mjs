// SPDX-License-Identifier: BSD-3-Clause
// Runs against the complete shipping GUI, real Scratch VM, Board, worker and Jolt.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.PROOF_URL || 'http://127.0.0.1:8134/';
const engine=process.argv.includes('--webkit')?webkit:chromium;
const browser=await engine.launch({headless:true,args:engine===chromium?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
const page=await browser.newPage({viewport:{width:1366,height:1024},hasTouch:engine===webkit,serviceWorkers:'block'}),errors=[];
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
  await page.getByTestId('bw-settings-menu-trigger').click();const preference=page.getByLabel(/Color mode/i);
  if(!await preference.isVisible())await page.getByText('Preferences',{exact:true}).click();await preference.selectOption('dark');await page.keyboard.press('Escape');
  await wait(()=>window.__bwCad?.editor.colorMode==='dark');
 }
 if(process.argv.includes('--library')){
  const cad=page.getByTestId('bw-cad-tab');await cad.getByLabel('File menu',{exact:true}).click();await cad.getByRole('button',{name:'Model library',exact:true}).click();
  const models=cad.getByRole('dialog',{name:'Model library',exact:true});await models.getByLabel('Model type',{exact:true}).selectOption('source');
  await wait(()=>document.querySelector('[data-testid="bw-cad-tab"] [data-state]')?.shadowRoot?.querySelectorAll('.model-library-card').length>130);
  await models.locator('.model-library-card').first().click();assert.ok(await models.locator('.model-library-preview img').isVisible());await models.getByRole('button',{name:'Close model library'}).click();console.log('PASS more than 130 editable source models and library preview');
 }
 const panel=page.getByTestId('bw-cad-circuit-panel');await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Open Scout circuit + CAD example…',exact:true}).click();
 await wait(()=>window.__bwCad?.editor.session.state.document.id==='robot-tt-rover');
 console.log('Demo CAD loaded');
 await page.getByRole('tab',{name:'Circuit',exact:true}).click();
 await wait(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard?.parts.some(p=>p.id==='left'));
 await page.getByRole('tab',{name:'CAD',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 await page.evaluate(()=>{window.__coupledMaxEncoder=0;window.addEventListener('bw-cad-circuit-status',()=>{const r=window.__brickwrightStore.getState().scratchGui.vm.runtime,b=r.circuitBoard,count=b?.getDeviceState('left')?.count;if(Number.isFinite(count))window.__coupledMaxEncoder=Math.max(window.__coupledMaxEncoder,count);});});
 const before=await page.evaluate(()=>window.__bwCad.editor.session.serialize());
 await panel.getByRole('button',{name:process.argv.includes('--firmware')?'Run on simulated Arduino':'Run blocks / pseudocode',exact:true}).click();
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
 await panel.waitFor({state:'visible'});
 await panel.getByRole('button',{name:'Stop',exact:true}).click({force:true});
 const stopped=await page.evaluate(()=>{const r=window.__brickwrightStore.getState().scratchGui.vm.runtime;return {powered:r.circuitBoard.powered,t:String(r.circuitBoard.timeNs),clock:!!r.bwProgramClock};});
 assert.equal(stopped.powered,false);assert.equal(stopped.clock,false);
 await new Promise(r=>setTimeout(r,100));assert.equal(await page.evaluate(()=>String(window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard.timeNs)),stopped.t);
 await page.evaluate(()=>window.__bwCad.editor.frame());
 await page.screenshot({path:`${out}/${flavor}-coupled.png`,animations:'disabled',timeout:10000});
 await panel.getByRole('button',{name:'Reset',exact:true}).click({force:true});assert.equal(await page.evaluate(()=>window.__bwCad.editor.simulation.snapshot().time),0);
 delete result.source;await writeFile(`${out}/${flavor}-result.json`,JSON.stringify({...result,stopped,errors},null,2));
 assert.deepEqual(errors,[]);console.log('PASS physical chassis, encoder feedback, immutable source, stop and reset');
} catch(e){console.error(await page.evaluate(()=>({status:window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.cadCircuitSimulation?.state(),clock:(()=>{const c=window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwProgramClock;return c?{owedMs:c.owedMs,programMs:c.programMs,simulatedMs:c.simulatedMs,stats:c.stats,pace:c._pace,timers:[...c._timers.values()].map(t=>({due:t.due,every:t.every}))}:null;})(),alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent)})).catch(()=>null));await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});throw e;}finally{clearInterval(pulse);await browser.close();}
