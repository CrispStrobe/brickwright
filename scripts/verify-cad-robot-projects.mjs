// SPDX-License-Identifier: BSD-3-Clause
// Complete GUI selection -> shared loader -> real VM, Widgets, Circuit and Jolt.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {CAD_ROBOT_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js';

function checkQuasarCycle(frame,samples){
   const center=f=>{const p=f.poses.find(p=>p.id==='blank'),[x,y,z,w]=p.quaternion,[a,b,c]=[0,-20,46.2],u=2*(y*c-z*b),v=2*(z*a-x*c),t=2*(x*b-y*a);return[a+w*u+y*t-z*v+p.positionMm[0],b+w*v+z*u-x*t+p.positionMm[1],c+w*t+x*v-y*u+p.positionMm[2]];};
   const pressed=samples.filter(f=>f.linearPositions['ram-b'] < -3 && center(f)[2]>40);
   assert.ok(pressed.length,'the real VM must reach the pressing stage');
   assert.ok(Math.min(...pressed.map(f=>f.linearPositions['ram-b']))>-6,'ram must stop on the blank instead of collapsing into the dial');
   const indexed=center(pressed[0]);assert.ok(indexed[0]>12&&indexed[0]<27&&Math.abs(indexed[1])<8,'the blank must be indexed under the ram');
   assert.ok(Math.max(...samples.map(f=>f.linearPositions['eject-c']))>60,'ejector must reach the blank');
   const firstDrop=samples.find(f=>f.time>5&&center(f)[2]<35);
   assert.ok(firstDrop&&Math.hypot(...center(firstDrop).slice(0,2))>28,'blank must clear the dial edge before falling; no tunneling through its floor');
   const done=center(frame);assert.ok(done[2]<20&&done[2]>4,'the blank must land on the work surface');
   assert.ok(Math.abs(frame.linearPositions['eject-c'])<1,'ejector must return');
   for(const f of samples)for(const p of f.poses){assert.ok(Math.abs(Math.hypot(...p.quaternion)-1)<.001,'rigid rotation must remain normalized');assert.ok(p.positionMm.every(v=>Number.isFinite(v)&&Math.abs(v)<300),'no body may be flung out of the mechanism');}
 return {indexed,firstDrop:center(firstDrop),landed:done,minRamMm:Math.min(...pressed.map(f=>f.linearPositions['ram-b'])),maxEjectMm:Math.max(...samples.map(f=>f.linearPositions['eject-c']))};
}
// Probe input restoration on an isolated part so visual overlap never makes the test ambiguous.
async function addDragProbe(page){
 return page.evaluate(async()=>{
  const {editor}=window.__bwCad,ready=await editor.whenIdle(),x=Math.min(...ready.bodies.map(body=>body.bounds.min[0]))-45;
  const point=[x,0,10],id=editor.session.add({kind:'box',size:[20,20,20]},{transform:{position:point,rotation:[0,0,0],scale:[1,1,1]}});
  await editor.whenIdle();await editor.executeCommand('top');editor.frame();editor.setSurfaceSnap(false);
  return {id,point};
 });
}
async function assertSelectAndDrag(page,probe){
 const {PerspectiveCamera,Vector3}=await import('../packages/scratch-gui/node_modules/three/build/three.module.js');
 const canvas=page.getByTestId('cad-canvas');
 const rect=await canvas.boundingBox(),cameraPosition=JSON.parse(await canvas.getAttribute('data-camera-position')),target=JSON.parse(await canvas.getAttribute('data-camera-target'));
 const camera=new PerspectiveCamera(42,rect.width/rect.height,.1,200000);
 camera.up.set(0,0,1);camera.position.fromArray(cameraPosition);camera.lookAt(new Vector3(...target));camera.updateMatrixWorld();
 const point=new Vector3(probe.point[0],probe.point[1],20).project(camera);
 const x=rect.x+(point.x+1)*rect.width/2,y=rect.y+(1-point.y)*rect.height/2;
 await page.mouse.click(x,y);
 await page.waitForFunction(id=>window.__bwCad.editor.session.state.selection.includes(id),probe.id,{timeout:10000});
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y+10,{steps:6});await page.mouse.up();
 await page.waitForFunction(({id,point})=>window.__bwCad.editor.session.state.document.nodes[id].transform.position.some((v,i)=>Math.abs(v-point[i])>1),probe,{timeout:10000});
 console.log('PASS Stop restores canvas selection and drag without a simulation reset');
}
const browserType={chromium,firefox,webkit}[process.env.PROOF_BROWSER||'chromium'];
if(!browserType)throw new Error('Unsupported proof browser');
const browser=await browserType.launch({headless:true,executablePath:process.env.BW_BROWSER_EXECUTABLE,
 ...(browserType===chromium&&process.env.PROOF_SOFTWARE_GPU==='1'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}),
 ...(browserType===firefox?{firefoxUserPrefs:{'webgl.force-enabled':true}}:{})});
const page=await browser.newPage({viewport:process.argv.includes('--ipad')?{width:1024,height:768}:{width:1440,height:1000},hasTouch:process.argv.includes('--ipad'),serviceWorkers:'block'}),errors=[],results=[];let cancelNext=false;
if(process.env.PROOF_FORCE_SCALAR==='1')await page.route(/\/jolt-physics\.simd\.wasm-compat[^/]*\.js$/,route=>route.abort());

if(process.env.PROOF_DIAGNOSTICS==='1'){
 page.on('console',message=>{if(['error','warning'].includes(message.type()))console.log('Browser',message.text().slice(0,400));});
 page.on('requestfailed',request=>console.log('Request failed',new URL(request.url()).pathname,request.failure()));
}
page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});page.on('dialog',d=>{if(cancelNext){cancelNext=false;return d.dismiss();}return d.accept();});page.setDefaultTimeout(180000);
await page.addInitScript(()=>{localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-cad-enabled','1');
 document.addEventListener('click',event=>{
  const times=window.__proofRunTimes;
  if(times?.clicked==null&&times&&event.composedPath().some(node=>node?.dataset?.testid==='bw-cad-run'))times.clicked=performance.now();
 },true);
 for(const [event,key] of [['bw-circuit-ensure-ready','circuitRequested'],['bw-circuit-clock-owner','circuitOwnership'],['bw-board-ready','boardReady']]){
  window.addEventListener(event,e=>{const times=window.__proofRunTimes;if(times?.clicked!=null&&times[key]==null&&(key!=='circuitOwnership'||e.detail?.board))times[key]=performance.now();});
 }
 window.addEventListener('bw-board-ready',()=>{
  const times=window.__proofRunTimes;
  if(times?.clicked==null)return;
  const runtime=window.__brickwrightStore?.getState().scratchGui.vm?.runtime;
  const ids=(runtime?.circuitBoard?.parts||[]).map(part=>part.id).join(',');
  const history=times.boardHistory||=[];
  if(history.at(-1)?.ids!==ids)history.push({ids,elapsedMs:performance.now()-times.clicked});
 });
 window.addEventListener('bw-cad-circuit-status',event=>{
  const times=window.__proofRunTimes,status=event.detail;
  if(!times||status?.phase!=='running')return;
  const wall=performance.now();
  times.running??=wall;
  if(status.time>0){
   const sample={wall,sim:status.time};
   times.firstSimFrame??=sample;
   times.lastSimFrame=sample;
  }
 });
 window.__proofSamples=[];
 setInterval(()=>{
  const sim=window.__bwCad?.editor.simulation,times=window.__proofRunTimes;
  if(sim?.state.state!=='running'||!times||times.clicked==null)return;
  const frame=sim.snapshot();
  if(frame.poses?.some(p=>p.id==='blank'))window.__proofSamples.push(frame);
  if(times.firstMotion==null&&frame.time>0&&(
   Object.entries(frame.angles).some(([key,value])=>Math.abs(value-(times.initial.angles[key]??0))>.5)||
   Object.entries(frame.linearPositions).some(([key,value])=>Math.abs(value-(times.initial.linearPositions[key]??0))>.2)
  ))times.firstMotion=performance.now();
 },30);
 window.__proofDraws={count:0,duplicate:0,frame:0,lastFrame:-1};
 const raf=now=>{
  window.__proofDraws.frame++;
  const t=window.__proofRunTimes;
  if(t?.clicked!=null){if(t.lastFrame!=null)t.frameGaps.push(now-t.lastFrame);t.lastFrame=now;}
  requestAnimationFrame(raf);
 };requestAnimationFrame(raf);
 for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!type)continue;const clear=type.prototype.clear;type.prototype.clear=function(...args){if(this.canvas?.dataset.testid==='cad-canvas'){const d=window.__proofDraws;d.count++;if(d.lastFrame===d.frame)d.duplicate++;d.lastFrame=d.frame;}return clear.apply(this,args);};}
});
if(process.env.PROOF_PHASES==='1')await page.addInitScript(legacyShafts=>{
 const timing=window.__phaseTiming={electrical:[],shaftFeedback:[],mechanical:[],startup:[],interval:[]};
 const boards=new WeakSet();
 window.addEventListener('bw-circuit-clock-owner',event=>{
  const board=event.detail?.board;
  if(!board||boards.has(board))return;
  boards.add(board);
  if(legacyShafts)board.setMechanicalShaftStates=undefined;
  for(const [method,bucket] of [
   ['advanceTo','electrical'],
   ['setMechanicalShaftState','shaftFeedback'],
   ['setMechanicalShaftStates','shaftFeedback']
  ]){
   const original=board[method];
   if(typeof original!=='function')continue;
   board[method]=function(...args){
    const start=performance.now();
    try{return original.apply(this,args);}
    finally{timing[bucket].push(performance.now()-start);}
   };
  }
 });
 const OriginalWorker=window.Worker;
 window.Worker=class extends OriginalWorker{
  constructor(url,options){
   super(url,options);
   if(!/simulation\.worker/.test(String(url)))return;
   const post=this.postMessage,requests=new Map();
   let previous;
   this.postMessage=function(message,...rest){
    if(message.op==='actuator-step'||message.op==='start'){
     const now=performance.now();
     if(message.op==='actuator-step'&&previous!==undefined)timing.interval.push(now-previous);
     if(message.op==='actuator-step')previous=now;
     requests.set(message.request,{start:now,bucket:message.op==='start'?'startup':'mechanical'});
    }
    return post.call(this,message,...rest);
   };
   this.addEventListener('message',event=>{
    const request=requests.get(event.data?.request);
    if(!request)return;
    requests.delete(event.data.request);
    timing[request.bucket].push(performance.now()-request.start);
   });
  }
 };
},process.env.PROOF_LEGACY_SHAFTS==='1');
const wait=fn=>page.waitForFunction(fn,null,{timeout:180000,polling:100});const out=process.env.PROOF_OUT||'artifacts/cad-robot-projects';await mkdir(out,{recursive:true});
try{
 await page.goto(process.env.PROOF_URL||'http://127.0.0.1:8141/',{waitUntil:'commit'});await wait(()=>window.__brickwrightStore?.getState().scratchGui.vm?.runtime?.cadCircuitSimulation);await page.getByRole('tab',{name:'CAD',exact:true}).click();await wait(()=>window.__bwCad?.editor);console.log('GUI CAD ready');
 const cad=page.getByTestId('bw-cad-tab');
 for(const [i,item]of CAD_ROBOT_EXAMPLES.entries()){
  if(process.argv.includes('--ipad')&&!process.env.ONLY_ROBOT&&i>0)break;
  if((process.env.SKIP_ROBOTS||'').split(',').includes(item.id))continue;
  if(process.env.ONLY_ROBOT&&process.env.ONLY_ROBOT!==item.id)continue;console.log('Selecting',item.id);
  const panel=page.getByTestId('bw-cad-circuit-panel');if(await panel.isVisible())await panel.getByRole('button',{name:'Close program settings'}).click();
  await cad.getByRole('button',{name:'Model library',exact:true}).click();
  const library=cad.getByRole('dialog',{name:'Model library',exact:true});
  await library.getByLabel('Model type',{exact:true}).selectOption('projects');
  await library.getByLabel('Search models',{exact:true}).fill(item.name);
  await library.getByRole('button',{name:`${item.name} Robot project · Includes code`,exact:true}).click();
  const choice=library.getByRole('button',{name:`Open ${item.name} project`,exact:true});
  if(i===0){
   const before=await page.evaluate(()=>window.__bwCad.editor.session.serialize());
   cancelNext=true;await choice.click();
   await choice.click({trial:true});
   assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.serialize()),before,'cancelling project replacement preserves the design');
  }
  await choice.click();console.log('Project choice returned',item.id);await page.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,item.id,{timeout:180000});await page.getByTestId('bw-cad-robot-controls').waitFor();console.log('Waiting for CAD geometry',item.id);await page.evaluate(()=>Promise.race([window.__bwCad.editor.whenIdle(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('CAD geometry did not finish within 120 seconds')),120000))]));console.log('Geometry ready',item.id);
  const wireCount=Number(await page.locator('canvas[data-wire-count]').getAttribute('data-wire-count'));if(process.env.PROOF_WIRING==='1'){assert.ok(wireCount>0,`Missing visible harnesses for ${item.id}`);console.log('Visible harnesses',item.id,wireCount);}
  const state=await page.evaluate(()=>{const rt=window.__brickwrightStore.getState().scratchGui.vm.runtime;return{id:window.__bwCad.editor.session.state.document.id,widgets:rt.controllerPanel.getWidgets().map(w=>({name:w.name,value:w.state.value,min:w.config.min,max:w.config.max})),code:JSON.parse(localStorage.getItem('bw-code-autosave')),circuit:JSON.parse(localStorage.getItem('bw-circuit-autosave')),connections:JSON.parse(localStorage.getItem('bw-cad-circuit-bindings')||'null'),blocks:rt.targets.flatMap(t=>Object.values(t.blocks?._blocks||{})).map(b=>b.opcode)};});
  assert.equal(state.id,item.id);assert.equal(state.connections.cadDocumentId,item.id);assert.ok(state.widgets.length>=2);assert.ok(state.code.code.includes('widget value'));assert.ok(state.blocks.includes('controller_controllerValue'));assert.ok(state.blocks.includes('event_whenflagclicked'));assert.ok(state.circuit.parts.some(p=>p.id==='uno'));
  const hardware=await page.evaluate(()=>{const d=window.__bwCad.editor.session.state.document;return{controller:d.nodes['electronics-controller']?.physics?.sourcePreset,clockHz:d.nodes['electronics-controller']?.physics?.parameters?.clockHz,drivers:d.roots.filter(id=>id.startsWith('electronics-driver-')).length,regulator:!!d.nodes['electronics-regulator'],servoBus:!!d.nodes['electronics-servo-bus'],power:!!d.nodes['electronics-power']||['visual-power-source','visual-aa-holder-830'].includes(d.nodes['battery-envelope']?.physics?.sourcePreset)};});
  if(process.env.PROOF_ELECTRONICS==='1'){
   assert.equal(hardware.controller,'visual-metro-mini',item.id+' controller');assert.equal(hardware.clockHz,16000000);assert.ok(hardware.regulator&&hardware.power);
   assert.equal(hardware.drivers,state.circuit.parts.filter(p=>p.kind==='h_bridge').length);assert.equal(hardware.drivers,Math.ceil(state.connections.drives.length/2));assert.equal(hardware.servoBus,state.connections.servos.length>0);console.log('Complete electronics',item.id,JSON.stringify(hardware));
  }
  if(process.env.PROOF_LEGACY_UPGRADE==='1'&&item.id==='robot-atlas-forklift'){
   const panelWasVisible=await panel.isVisible();if(panelWasVisible)await panel.getByRole('button',{name:'Close program settings'}).click();
   await page.evaluate(()=>{const d=structuredClone(window.__bwCad.editor.session.state.document);for(const id of Object.keys(d.nodes))if(id.startsWith('electronics-'))delete d.nodes[id];d.roots=d.roots.filter(id=>d.nodes[id]);d.joints=d.joints.filter(j=>d.nodes[j.bodyA]&&d.nodes[j.bodyB]);const used=new Set(Object.values(d.nodes).flatMap(n=>n.provenance||[]));d.provenance.records=d.provenance.records.filter(r=>used.has(r.id));delete d.modelSource;window.__bwCad.editor.session.load(d);});
   await page.evaluate(()=>window.__bwCad.editor.whenIdle());
   if(!await page.getByTestId('add-robot-electronics').isVisible())await cad.getByRole('button',{name:'Properties',exact:true}).click();
   const sibling=()=>page.evaluate(()=>{const rt=window.__brickwrightStore.getState().scratchGui.vm.runtime;return{code:JSON.parse(localStorage.getItem('bw-code-autosave')),circuit:rt.circuitModel.toJSON(),connections:JSON.parse(localStorage.getItem('bw-cad-circuit-bindings')),widgets:rt.controllerPanel.getWidgets().map(w=>({name:w.name,config:w.config,value:w.state.value})),blocks:rt.targets.map(t=>t.blocks?._blocks||{})};});
   const beforeSiblings=await sibling(),beforeCad=await page.evaluate(()=>window.__bwCad.editor.session.serialize());
   await page.getByTestId('add-robot-electronics').click();await page.waitForFunction(()=>!!window.__bwCad.editor.session.state.document.nodes['electronics-controller']);await page.evaluate(()=>window.__bwCad.editor.whenIdle());assert.deepEqual(await sibling(),beforeSiblings,'hardware upgrade preserves Code, Circuit, Widgets, Blocks and bindings');
   await cad.getByRole('button',{name:'Undo',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.whenIdle());assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.serialize()),beforeCad);assert.deepEqual(await sibling(),beforeSiblings);
   await cad.getByRole('button',{name:'Redo',exact:true}).click();await page.evaluate(()=>window.__bwCad.editor.whenIdle());assert.ok(await page.evaluate(()=>!!window.__bwCad.editor.session.state.document.nodes['electronics-controller']));assert.deepEqual(await sibling(),beforeSiblings);
   if(panelWasVisible)await page.getByTestId('bw-cad-program-settings').click();console.log('PASS integrated legacy Atlas hardware upgrade preserves all sibling editors and exact Undo/Redo');
  }
  // Operated, not default: a signed widget is driven harder in the direction of the project's own preset.
  // Presets start inside travel (5389b9b17), but not every joint starts mid-travel: Hermes' hoist-b
  // (limits [-16, 0]) starts at its upper stop and its preset -25 lowers it, so a blanket +60 held it on the stop.
  if(process.env.PROOF_DEFAULT!=='1')for(const widget of state.widgets){const value=widget.min<0?(widget.value<0?-60:60):Math.min(widget.max,105);await page.getByTestId(`bw-cad-control-${widget.name}`).evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);assert.equal(await page.evaluate(name=>window.__brickwrightStore.getState().scratchGui.vm.runtime.controllerPanel.getValue(name),widget.name),value);}
  if(process.env.PROOF_PRIME_CIRCUIT==='1'){
   await page.getByRole('tab',{name:'Circuit',exact:true}).click();
   await wait(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard?.parts.some(p=>p.id==='uno'));
   await page.getByRole('tab',{name:'CAD',exact:true}).click();
   if(!await page.getByTestId('bw-cad-robot-controls').isVisible())await page.getByRole('button',{name:'Robot controls',exact:true}).click();
  }
  await writeFile(`${out}/loaded-${item.id}.json`,JSON.stringify({id:item.id,widgets:state.widgets,blocks:true,code:true,circuit:true,connections:state.connections},null,2));
  if(process.env.PROOF_LOAD_ONLY==='1'){console.log('PASS full project load',item.id);continue;}
  if(process.env.PROOF_CONTROLS_CLOSED==='1')await page.getByTestId('bw-cad-circuit-panel').getByRole('button',{name:'Close program settings'}).click();
  console.log('Widgets ready',item.id,process.env.PROOF_DEFAULT==='1'?'untouched defaults':'operated');const source=await page.evaluate(()=>{window.__proofSamples=[];const sim=window.__bwCad.editor.simulation,api=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadSimulation;
 const {angles,linearPositions}=sim.snapshot();
 window.__proofRunTimes={requested:performance.now(),running:null,initial:{angles,linearPositions},frameGaps:[]};
 if(!api.__proofTiming){
  for(const key of ['reset','acquireExternalClock']){
   const original=api[key];
   api[key]=function(...args){
    const times=window.__proofRunTimes;
    if(times?.clicked==null)return original.apply(this,args);
    times[key+'Start']=performance.now();
    const result=original.apply(this,args),done=()=>{times[key+'End']=performance.now();};
    if(result?.then)result.then(done,done);else done();
    return result;
   };
  }
  api.__proofTiming=true;
 }Object.assign(window.__proofDraws,{count:0,duplicate:0,lastFrame:-1});window.__proofHeartbeat={last:performance.now(),max:0,ticks:0};window.__proofHeartbeatTimer=setInterval(()=>{const h=window.__proofHeartbeat,n=performance.now();h.max=Math.max(h.max,n-h.last);h.last=n;h.ticks++;},50);return window.__bwCad.editor.session.serialize();});await page.evaluate(value=>{window.__robotProofSeconds=value;},Number(process.env.PROOF_SIM_SECONDS||(item.id==='robot-quasar-press'?15:6)));const runStarted=performance.now();if(process.env.PROOF_BLUR_PREPARATION==='1')await page.evaluate(()=>{let attempts=0;const timer=setInterval(()=>{if(window.__bwCad.editor.simulation.state.state==='preparing')window.dispatchEvent(new Event('blur'));if(++attempts>40)clearInterval(timer);},25);});await page.getByTestId('bw-cad-run').click();console.log('Run pressed',item.id);
  if(item.id==='robot-quasar-press'&&process.env.PROOF_DEFAULT==='1'){
   await wait(()=>{const f=window.__bwCad.editor.simulation.snapshot();return f.angles['dial-a']>85&&f.linearPositions['ram-b']>0;});
   await page.screenshot({path:`${out}/quasar-indexed.png`});
   await wait(()=>window.__bwCad.editor.simulation.snapshot().linearPositions['ram-b'] < -3);
   await page.screenshot({path:`${out}/quasar-pressed.png`});
  }
  if(process.env.PROOF_PROFILE==='1'&&browserType===chromium){
   const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
   setTimeout(async()=>{try{const {profile}=await cdp.send('Profiler.stop');await writeFile(`${out}/cpu-${item.id}.json`,JSON.stringify(profile));console.log('CPU profile captured',item.id);}catch(error){console.log('Profiler:',error.message);}},15000);
  }
await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>window.__robotProofSeconds;});
  const after=await page.evaluate(()=>({state:window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state(),frame:window.__bwCad.editor.simulation.snapshot(),source:window.__bwCad.editor.session.serialize(),draws:{...window.__proofDraws},runTimes:{...window.__proofRunTimes,finished:performance.now()},boardParts:window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard?.parts.map(p=>({id:p.id,kind:p.kind}))??[]}));const {clicked,firstMotion,acquireExternalClockStart,acquireExternalClockEnd,frameGaps,...marks}=after.runTimes;
  const sorted=frameGaps.sort((a,b)=>a-b);after.browserTiming={clickedToMotionMs:clicked!=null&&firstMotion!=null?firstMotion-clicked:null,mechanicalPreparationMs:acquireExternalClockStart!=null&&acquireExternalClockEnd!=null?acquireExternalClockEnd-acquireExternalClockStart:null,frameP95Ms:sorted[Math.floor(sorted.length*.95)]??null,frameMaxMs:sorted.at(-1)??null,marks};
  delete after.runTimes.frameGaps;
  after.wallSeconds=(performance.now()-runStarted)/1000;after.averageRealTimeFactor=after.frame.time/after.wallSeconds;after.preparationSeconds=after.runTimes.running==null?null:(after.runTimes.running-after.runTimes.requested)/1000;after.runningRealTimeFactor=after.runTimes.running==null?null:after.frame.time/((after.runTimes.finished-after.runTimes.running)/1000);await writeFile(`${out}/debug-${item.id}.json`,JSON.stringify({state:after.state,frame:after.frame,draws:after.draws,wallSeconds:after.wallSeconds,averageRealTimeFactor:after.averageRealTimeFactor,preparationSeconds:after.preparationSeconds,runningRealTimeFactor:after.runningRealTimeFactor,browserTiming:after.browserTiming,boardParts:after.boardParts},null,2));assert.equal(after.state.phase,'running',after.state.error);assert.equal(after.source,source);if(process.env.PROOF_DRAW_BUDGET==='1')assert.ok(after.draws.duplicate<=5,`simulation must coalesce rendering, got ${after.draws.duplicate} duplicate scene draws`);
  if(process.env.PROOF_PHASES==='1')await writeFile(`${out}/phases-${item.id}.json`,JSON.stringify(await page.evaluate(()=>window.__phaseTiming),null,2));
  const {firstSimFrame,lastSimFrame}=after.runTimes;
  if(firstSimFrame&&lastSimFrame.wall>firstSimFrame.wall){
   after.sustainedRealTimeFactor=(lastSimFrame.sim-firstSimFrame.sim)*1000/(lastSimFrame.wall-firstSimFrame.wall);
  }
  if(item.id==='robot-quasar-press'&&process.env.PROOF_DEFAULT==='1'){
   const samples=await page.evaluate(()=>window.__proofSamples);
   await writeFile(`${out}/quasar-cycle-frames.json`,JSON.stringify(samples));
   after.quasarCycle=checkQuasarCycle(after.frame,samples);
  }
  assert.notEqual(after.browserTiming.clickedToMotionMs,null,'one Run click must produce measurable joint motion');
  if(item.id==='robot-atlas-forklift'&&process.env.PROOF_DEFAULT==='1')assert.ok(Math.abs(after.frame.angles['tilt-c']-15)<2,'Atlas must hold the commanded fork tilt under load');
  if(item.id==='robot-nova-loader'){const chassis=after.frame.poses.find(p=>p.id==='chassis');assert.ok(Math.hypot(chassis.positionMm[0],chassis.positionMm[1])>5,'Nova must translate across the floor, not only spin its wheels');}
  const motion=[...Object.values(after.frame.angles||{}),...Object.values(after.frame.linearPositions||{})];assert.ok(motion.some(v=>Math.abs(v)>1),`${item.name}: real joints must move from widget commands`);
  for(const d of state.connections.drives){if(item.id==='robot-quasar-press'&&d.jointId==='eject-c'&&process.env.PROOF_DEFAULT==='1')continue;const value=(d.kind==='slider'?after.frame.linearPositions:after.frame.angles)[d.jointId];assert.ok(Math.abs(value)>.5,`${item.name}: ${d.partId} must physically drive ${d.jointId}, got ${value}`);}
  for(const d of state.connections.servos)assert.ok(Math.abs(after.frame.angles[d.jointId])>1,`${item.name}: ${d.partId} must physically turn ${d.jointId}`);
  if(process.env.PROOF_CONTROLS_CLOSED==='1'){assert.equal(await page.getByTestId('bw-cad-robot-controls').isVisible(),false);await page.getByRole('button',{name:'Robot controls',exact:true}).click();}
  await page.getByTestId('bw-cad-robot-controls').waitFor();
  await page.screenshot({path:`${out}/${item.file.replace('.sb3','')}${process.argv.includes('--ipad')?'-ipad':''}.png`,animations:'disabled'});await page.getByRole('button',{name:'Stop program',exact:true}).click();await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
  if(process.env.PROOF_REPEAT==='1')for(let repeat=0;repeat<Number(process.env.PROOF_EXTRA_CYCLES||1);repeat++){
   let probe=null;
   if(process.env.PROOF_INTERACTION==='1'){
    await page.getByRole('tab',{name:'Circuit',exact:true}).click();
    await page.getByRole('tab',{name:'CAD',exact:true}).click();
    if(!await page.getByTestId('bw-cad-robot-controls').isVisible())await page.getByRole('button',{name:'Robot controls',exact:true}).click();
    probe=await addDragProbe(page);
   }
   await page.evaluate(()=>{window.__proofSamples=[];});
   await page.getByTestId('bw-cad-run').click();await page.getByTestId('bw-cad-robot-controls').waitFor();
   await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>.5;});
   assert.equal(await page.evaluate(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state().phase),'running');
   if(item.id==='robot-quasar-press'&&process.env.PROOF_DEFAULT==='1'){
    await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>15;});
    const again=await page.evaluate(()=>({frame:window.__bwCad.editor.simulation.snapshot(),samples:window.__proofSamples}));
    const cycle=checkQuasarCycle(again.frame,again.samples);
    await writeFile(`${out}/quasar-repeat-${repeat+1}.json`,JSON.stringify({cycle,...again}));
   }
   await page.getByTestId('bw-cad-robot-controls').getByRole('button',{name:'Center controls'}).click();
   await wait(()=>{const s=window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state();return s.phase==='error'||s.time>1.5;});
   assert.equal(await page.evaluate(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.cadCircuitSimulation.state().phase),'running');
   await page.getByTestId('bw-cad-robot-controls').waitFor();
   await page.getByRole('button',{name:'Stop program',exact:true}).click();
   if(probe)await assertSelectAndDrag(page,probe);
   await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
  }
  if(process.env.PROOF_PHASES==='1'){
   const timing=await page.evaluate(()=>window.__phaseTiming);
   await writeFile(`${out}/phases-${item.id}${process.env.PROOF_REPEAT==='1'?'-with-restarts':''}.json`,JSON.stringify(timing,null,2));
   console.log('Mechanical worker start timings (ms)',timing.startup);
  }
  if(process.env.PROOF_MIN_RTF!==undefined){
   const minimum=Number(process.env.PROOF_MIN_RTF);
   assert.ok(Number.isFinite(minimum)&&minimum>0,'PROOF_MIN_RTF must be a positive number');
   assert.ok(after.sustainedRealTimeFactor>=minimum,`${item.name} sustained ${after.sustainedRealTimeFactor?.toFixed(3)}×, below ${minimum}×`);
  }
  after.heartbeat=await page.evaluate(()=>{clearInterval(window.__proofHeartbeatTimer);return window.__proofHeartbeat;});delete after.source;await writeFile(`${out}/passed-${item.id}${process.argv.includes('--ipad')?'-ipad':''}.json`,JSON.stringify({id:item.id,widgets:state.widgets,after},null,2));results.push({id:item.id,widgets:state.widgets,code:true,blocks:true,circuit:true,wireCount,hardware,after});await writeFile(`${out}/result${process.argv.includes('--ipad')?'-ipad':''}.json`,JSON.stringify({results,errors},null,2));console.log('PASS',item.name,'complete project; Widgets -> Circuit -> moving CAD joints; Stop/Reset');
 }
 assert.deepEqual(errors,[]);
}catch(error){console.log(await page.evaluate(()=>({alerts:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent),status:window.__brickwrightStore?.getState()?.scratchGui.vm.runtime.cadCircuitSimulation.state()})).catch(()=>null));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
