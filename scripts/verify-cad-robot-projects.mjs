// SPDX-License-Identifier: BSD-3-Clause
// Complete GUI selection -> shared loader -> real VM, Widgets, Circuit and Jolt.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {CAD_ROBOT_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js';
const browser=await (process.env.PROOF_BROWSER==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:process.env.BW_BROWSER_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}));
const page=await browser.newPage({viewport:process.argv.includes('--ipad')?{width:1024,height:768}:{width:1440,height:1000},hasTouch:process.argv.includes('--ipad'),serviceWorkers:'block'}),errors=[],results=[];let cancelNext=false;
page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});page.on('dialog',d=>{if(cancelNext){cancelNext=false;return d.dismiss();}return d.accept();});page.setDefaultTimeout(180000);
await page.addInitScript(()=>{localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');});
const wait=fn=>page.waitForFunction(fn,null,{timeout:180000,polling:100});const out=process.env.PROOF_OUT||'artifacts/cad-robot-projects';await mkdir(out,{recursive:true});
try{
 await page.goto(process.env.PROOF_URL||'http://127.0.0.1:8141/',{waitUntil:'commit'});await wait(()=>window.__brickwrightStore?.getState().scratchGui.vm?.runtime);await page.getByRole('tab',{name:'CAD',exact:true}).click();await wait(()=>window.__bwCad?.editor);console.log('GUI CAD ready');
 const cad=page.getByTestId('bw-cad-tab');
 for(const [i,item]of CAD_ROBOT_EXAMPLES.entries()){
  if(process.argv.includes('--ipad')&&i>0)break;
  if((process.env.SKIP_ROBOTS||'').split(',').includes(item.id))continue;
  if(process.env.ONLY_ROBOT&&process.env.ONLY_ROBOT!==item.id)continue;console.log('Selecting',item.id);
  const panel=page.getByTestId('bw-cad-circuit-panel');if(await panel.isVisible())await panel.getByRole('button',{name:'Close program settings'}).click();
  const viaExamples=process.env.PROOF_VIA_EXAMPLES==='1';let shapes,choice;
  if(viaExamples){await page.getByRole('button',{name:'Robot examples',exact:true}).click();choice=panel.getByRole('button',{name:`Open ${item.name} project`,exact:true});}
  else{await cad.getByRole('button',{name:'Shapes',exact:true}).click();shapes=cad.getByRole('dialog',{name:'Shape library',exact:true});await shapes.getByLabel('Search shapes',{exact:true}).fill(item.name);choice=shapes.getByRole('button',{name:/^Open .+ project$/});}
  await choice.waitFor();
  if(i===0){const before=await page.evaluate(()=>window.__bwCad.editor.session.serialize());cancelNext=true;await choice.click();assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.serialize()),before,'cancelling project replacement preserves the design');if(!viaExamples){await cad.getByRole('button',{name:'Shapes',exact:true}).click();await shapes.getByLabel('Search shapes',{exact:true}).fill(item.name);}}
  await choice.click();console.log('Project choice returned',item.id);await page.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,item.id,{timeout:180000});await page.getByTestId('bw-cad-robot-controls').waitFor();console.log('Waiting for CAD geometry',item.id);await page.evaluate(()=>Promise.race([window.__bwCad.editor.whenIdle(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('CAD geometry did not finish within 120 seconds')),120000))]));console.log('Geometry ready',item.id);
  const state=await page.evaluate(()=>{const rt=window.__brickwrightStore.getState().scratchGui.vm.runtime;return{id:window.__bwCad.editor.session.state.document.id,widgets:rt.controllerPanel.getWidgets().map(w=>({name:w.name,value:w.state.value,min:w.config.min,max:w.config.max})),code:JSON.parse(localStorage.getItem('bw-code-autosave')),circuit:JSON.parse(localStorage.getItem('bw-circuit-autosave')),connections:JSON.parse(localStorage.getItem('bw-cad-circuit-bindings')||'null'),blocks:rt.targets.flatMap(t=>Object.values(t.blocks?._blocks||{})).map(b=>b.opcode)};});
  assert.equal(state.id,item.id);assert.equal(state.connections.cadDocumentId,item.id);assert.ok(state.widgets.length>=2);assert.ok(state.code.code.includes('widget value'));assert.ok(state.blocks.includes('controller_controllerValue'));assert.ok(state.blocks.includes('event_whenflagclicked'));assert.ok(state.circuit.parts.some(p=>p.id==='uno'));
  if(process.env.PROOF_DEFAULT!=='1')for(const widget of state.widgets){const value=widget.min<0?60:Math.min(widget.max,105);await page.getByTestId(`bw-cad-control-${widget.name}`).evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);assert.equal(await page.evaluate(name=>window.__brickwrightStore.getState().scratchGui.vm.runtime.controllerPanel.getValue(name),widget.name),value);}
  await writeFile(`${out}/loaded-${item.id}.json`,JSON.stringify({id:item.id,widgets:state.widgets,blocks:true,code:true,circuit:true,connections:state.connections},null,2));
  if(process.env.PROOF_LOAD_ONLY==='1'){console.log('PASS full project load',item.id);continue;}
  if(process.env.PROOF_CONTROLS_CLOSED==='1')await page.getByTestId('bw-cad-circuit-panel').getByRole('button',{name:'Close program settings'}).click();
  console.log('Widgets ready',item.id,process.env.PROOF_DEFAULT==='1'?'untouched defaults':'operated');const source=await page.evaluate(()=>{window.__proofHeartbeat={last:performance.now(),max:0,ticks:0};window.__proofHeartbeatTimer=setInterval(()=>{const h=window.__proofHeartbeat,n=performance.now();h.max=Math.max(h.max,n-h.last);h.last=n;h.ticks++;},50);return window.__bwCad.editor.session.serialize();});await page.evaluate(value=>{window.__robotProofSeconds=value;},Number(process.env.PROOF_SIM_SECONDS||6));await page.getByTestId('bw-cad-run').click();console.log('Run pressed',item.id);await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>window.__robotProofSeconds;});
  const after=await page.evaluate(()=>({state:window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state(),frame:window.__bwCad.editor.simulation.snapshot(),source:window.__bwCad.editor.session.serialize(),boardParts:window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard.parts.map(p=>({id:p.id,kind:p.kind}))}));await writeFile(`${out}/debug-${item.id}.json`,JSON.stringify({state:after.state,frame:after.frame},null,2));assert.equal(after.state.phase,'running',after.state.error);assert.equal(after.source,source);
  await writeFile(`${out}/debug-${item.id}.json`,JSON.stringify({state:after.state,frame:after.frame},null,2));
  const motion=[...Object.values(after.frame.angles||{}),...Object.values(after.frame.linearPositions||{})];assert.ok(motion.some(v=>Math.abs(v)>1),`${item.name}: real joints must move from widget commands`);
  for(const d of state.connections.drives){const value=(d.kind==='slider'?after.frame.linearPositions:after.frame.angles)[d.jointId];assert.ok(Math.abs(value)>.5,`${item.name}: ${d.partId} must physically drive ${d.jointId}, got ${value}`);}
  for(const d of state.connections.servos)assert.ok(Math.abs(after.frame.angles[d.jointId])>1,`${item.name}: ${d.partId} must physically turn ${d.jointId}`);
  if(process.env.PROOF_CONTROLS_CLOSED==='1'){assert.equal(await page.getByTestId('bw-cad-robot-controls').isVisible(),false);await page.getByRole('button',{name:'Robot controls',exact:true}).click();}
  await page.getByTestId('bw-cad-robot-controls').waitFor();
  await page.screenshot({path:`${out}/${item.file.replace('.sb3','')}${process.argv.includes('--ipad')?'-ipad':''}.png`,animations:'disabled'});await page.getByRole('button',{name:'Stop program',exact:true}).click();await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
  if(process.env.PROOF_REPEAT==='1'){
   await page.getByTestId('bw-cad-run').click();await page.getByTestId('bw-cad-robot-controls').waitFor();
   await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>.5;});
   assert.equal(await page.evaluate(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state().phase),'running');
   await page.getByTestId('bw-cad-robot-controls').getByRole('button',{name:'Center controls'}).click();
   await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>1.5;});
   assert.equal(await page.evaluate(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state().phase),'running');
   await page.getByTestId('bw-cad-robot-controls').waitFor();
   await page.getByRole('button',{name:'Stop program',exact:true}).click();await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
  }
  after.heartbeat=await page.evaluate(()=>{clearInterval(window.__proofHeartbeatTimer);return window.__proofHeartbeat;});delete after.source;await writeFile(`${out}/passed-${item.id}${process.argv.includes('--ipad')?'-ipad':''}.json`,JSON.stringify({id:item.id,widgets:state.widgets,after},null,2));results.push({id:item.id,widgets:state.widgets,code:true,blocks:true,circuit:true,after});await writeFile(`${out}/result${process.argv.includes('--ipad')?'-ipad':''}.json`,JSON.stringify({results,errors},null,2));console.log('PASS',item.name,'complete project; Widgets -> Circuit -> moving CAD joints; Stop/Reset');
 }
 assert.deepEqual(errors,[]);
}catch(error){console.log(await page.evaluate(()=>({alerts:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent),status:window.__brickwrightStore?.getState()?.scratchGui.vm.runtime.cadCircuitSimulation.state()})).catch(()=>null));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
