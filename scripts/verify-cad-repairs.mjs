// SPDX-License-Identifier: BSD-3-Clause
// Actual GUI/VM/IndexedDB/Jolt and pointer interaction; no DOM/session doubles.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.PROOF_URL||'http://127.0.0.1:8140/';
const browser=await chromium.launch({headless:true,executablePath:process.env.BW_BROWSER_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:1000},serviceWorkers:'block'});
page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});page.on('dialog',d=>d.accept());
await page.addInitScript(()=>{localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');});
const out='artifacts/cad-repairs';await mkdir(out,{recursive:true});
const wait=fn=>page.waitForFunction(fn,null,{timeout:180000,polling:100});
try{
 await page.goto(url,{waitUntil:'commit'});await wait(()=>window.__brickwrightStore?.getState().scratchGui.vm?.runtime);
 await page.getByRole('tab',{name:'CAD',exact:true}).click();await wait(()=>window.__bwCad?.editor);
 await page.evaluate(async()=>{
  const blob=await(await fetch('static/circuit-cad/scout-encoder.sb3')).blob(),at=Date.now();
  await new Promise((resolve,reject)=>{const request=indexedDB.open('bw-autosave',1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('versions'))db.createObjectStore('versions',{keyPath:'id',autoIncrement:true});if(!db.objectStoreNames.contains('handles'))db.createObjectStore('handles');};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,t=db.transaction('versions','readwrite');t.objectStore('versions').put({id:1,at,title:'Recovered Scout',reason:'auto',size:blob.size,blob});t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};});
  localStorage.setItem('bw-autosave-unclean',String(at));localStorage.setItem('repair-quota-fill','q'.repeat(4*1024*1024));
 });
 await page.reload({waitUntil:'commit'});
 const recovery=page.getByTestId('bw-autosave-recovery');await recovery.waitFor();await recovery.getByRole('button',{name:'Reopen',exact:true}).click();await recovery.waitFor({state:'detached'});
 await page.getByRole('tab',{name:'CAD',exact:true}).click();await wait(()=>window.__bwCad?.editor.session.state.document.id==='robot-tt-rover');
 const recovered=await page.evaluate(()=>({id:window.__bwCad.editor.session.state.document.id,stored:localStorage.getItem('bw-cad-document'),filler:localStorage.getItem('repair-quota-fill')?.length,hats:window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.flatMap(t=>Object.values(t.blocks?._blocks||{})).filter(b=>b.opcode==='event_whenflagclicked').length}));
 assert.equal(recovered.stored,null);assert.equal(recovered.filler,4*1024*1024);assert.ok(recovered.hats>0);console.log('PASS real IndexedDB Reopen succeeds past localStorage quota and closes; program restored');
 const source=await page.evaluate(()=>window.__bwCad.editor.session.serialize());
 await page.getByTestId('bw-cad-run').click();await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>1.5;});
 const run=await page.evaluate(()=>({state:window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state(),frame:window.__bwCad.editor.simulation.snapshot(),source:window.__bwCad.editor.session.serialize()}));
 assert.equal(run.state.phase,'running',run.state.error);assert.equal(run.source,source);assert.ok(Math.hypot(...run.frame.poses.find(p=>p.id==='chassis').positionMm)>10);
 await page.getByRole('button',{name:'Stop program',exact:true}).click();console.log('PASS first Run after recovery moves Scout without visiting Circuit or opening Program');
 await page.evaluate(()=>{const vm=window.__brickwrightStore.getState().scratchGui.vm;for(const target of vm.runtime.targets)for(const id of target.blocks.getScripts())target.blocks.deleteBlock(id);});
 await page.getByTestId('bw-cad-run').click();const setup=page.getByTestId('bw-cad-circuit-panel');await setup.waitFor();assert.match(await setup.getByRole('alert').innerText(),/No start program/);
 await setup.getByRole('button',{name:'Close program settings'}).click();await page.getByRole('button',{name:/Run problem: No start program/}).click();await setup.waitFor();await setup.getByRole('button',{name:'Close program settings'}).click();
 console.log('PASS an empty program explains the missing start script; toolbar error opens its explanation');
 await page.evaluate(()=>localStorage.removeItem('repair-quota-fill'));
 await page.getByRole('button',{name:'Reset simulation',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.executeCommand('new'));await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 await page.getByRole('button',{name:'Sketch',exact:true}).click();const sketch=page.getByRole('dialog',{name:'Sketch and extrusion',exact:true});await sketch.waitFor();
 const height=sketch.getByLabel('Extrusion distance (mm)',{exact:true});await height.fill('0');assert.equal(await sketch.getByRole('button',{name:'Create extrusion',exact:true}).isDisabled(),true);assert.doesNotMatch(await sketch.getByLabel('Sketch status').innerText(),/[0-9a-f]{8}-/);
 await height.fill('10');const handle=await sketch.locator('[data-resize="depth"]').boundingBox();assert.ok(handle);await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x-600,handle.y+250,{steps:12});await page.mouse.up();
 assert.ok(Number(await height.inputValue())>=.01);assert.equal(await sketch.getByRole('button',{name:'Create extrusion',exact:true}).isEnabled(),true);assert.equal(await sketch.getByLabel('Sketch status').innerText(),'');
 await height.fill('10');await sketch.getByRole('button',{name:'Create extrusion',exact:true}).click();await sketch.waitFor({state:'hidden'});await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 const extrusion=await page.evaluate(()=>{const s=window.__bwCad.editor.session;return{nodes:Object.values(s.state.document.nodes).map(n=>({kind:n.kind,distance:n.distance})),undo:s.state.canUndo};});assert.equal(extrusion.nodes[0].kind,'extrusion');assert.equal(extrusion.nodes[0].distance,10);assert.equal(extrusion.undo,true);
 await page.evaluate(()=>window.__bwCad.editor.session.undo());assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),0);console.log('PASS actual sketch pointer drag clamps at positive height; creation and one-step undo work');
 // A program-free model should explain the missing script instead of silently running.
 await page.getByTestId('bw-cad-program-settings').click();const panel=page.getByTestId('bw-cad-circuit-panel');await panel.getByRole('button',{name:'Close program settings'}).click();
 await page.screenshot({path:`${out}/repaired.png`,animations:'disabled'});
 // Inject an unrecoverable auxiliary write error to exercise recovery dismissal.
 await page.evaluate(async()=>{const blob=await(await fetch('static/circuit-cad/scout-encoder.sb3')).blob(),at=Date.now();await new Promise((resolve,reject)=>{const r=indexedDB.open('bw-autosave',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('versions','readwrite'),store=t.objectStore('versions');store.clear();store.put({id:1,at,title:'Recovery error control',reason:'auto',size:blob.size,blob});t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};r.onerror=()=>reject(r.error);});localStorage.setItem('bw-autosave-unclean',String(at));});
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='bw-circuit-autosave')throw new DOMException('Recovery write failure control','QuotaExceededError');return original.call(this,key,value);};});
 await page.reload({waitUntil:'commit'});await recovery.waitFor();await recovery.getByRole('button',{name:'Reopen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="bw-autosave-recovery"]')?.textContent.includes('Could not reopen'));
 assert.ok(await recovery.getByRole('button',{name:'Save autosave copy…',exact:true}).isVisible());await recovery.getByRole('button',{name:'Dismiss recovery',exact:true}).click();await recovery.waitFor({state:'detached'});console.log('PASS a recovery write failure offers an autosave copy and X dismisses the dialog');
 assert.deepEqual(errors,[]);delete run.source;await writeFile(`${out}/result.json`,JSON.stringify({recovered,run,extrusion,errors},null,2));
} catch(error){console.error(await page.evaluate(()=>({host:(()=>{const node=document.querySelector('[data-testid="bw-cad-tab"]');let f=node?.[Object.keys(node).find(k=>k.startsWith('__reactFiber'))];while(f?.return)f=f.return;const todo=[f],seen=new Set();while(todo.length){const n=todo.pop();if(!n||seen.has(n))continue;seen.add(n);const i=n.stateNode;if(i&&typeof i.readStc==='function')return{loading:i.loading,visible:i.props.isVisible,error:i.state.error,designer:!!i.state.Designer,requested:i.state.cadCircuitRequested,dock:i.state.debugDock,portal:i._portalOn,box:!!i._boxRef.current};todo.push(n.child,n.sibling);}return null;})(),resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('bw-board')||r.name.includes('bw-circuit')).map(r=>r.name),alerts:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent),simulation:window.__brickwrightStore?.getState()?.scratchGui.vm?.runtime?.cadCircuitSimulation?.state()})).catch(()=>null));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
