// SPDX-License-Identifier: BSD-3-Clause
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sdkOnly=process.argv.includes('--sdk-only');
const expectAbsent=process.argv.includes('--expect-absent');
const ipad=process.argv.includes('--ipad');
const trace=message=>{if(process.env.BW_CAD_CHECK_DEBUG)process.stderr.write(message+'\n');};
const build=resolve(process.env.BW_GUI_BUILD_ROOT || resolve(root,'packages/scratch-gui/build'));
const fixture=`<!doctype html><div id="cad" style="height:700px"></div><script type="module">
import * as sdk from '/static/cad-sdk/sdk.js';
window.sdk=sdk;window.session=sdk.createCadSession();
window.editor=sdk.mountCadEditor(document.querySelector('#cad'),{session,wasmURL:'/static/cad-sdk/cad-assets/manifold.wasm'});
await editor.whenIdle();window.ready=true;</script>`;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/cad-program.sb3'&&process.env.BW_CAD_PROGRAM_FIXTURE){res.end(await readFile(process.env.BW_CAD_PROGRAM_FIXTURE));return;}
  if(path==='/motor-fixture.bcad'&&process.env.BW_CAD_MOTOR_FIXTURE){res.setHeader('Content-Type','application/json');res.end(await readFile(process.env.BW_CAD_MOTOR_FIXTURE));return;}
  if(path==='/slider-fixture.bcad'&&process.env.BW_CAD_SLIDER_FIXTURE){res.setHeader('Content-Type','application/json');res.end(await readFile(process.env.BW_CAD_SLIDER_FIXTURE));return;}
  if(path==='/cad-slider-program.sb3'&&process.env.BW_CAD_SLIDER_PROGRAM_FIXTURE){res.end(await readFile(process.env.BW_CAD_SLIDER_PROGRAM_FIXTURE));return;}
  if(sdkOnly&&path==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
  const prefix='/static/cad-sdk/';
  const base=sdkOnly&&path.startsWith(prefix)?resolve(root,'overlay/scratch-gui/static/cad-sdk'):build;
  const relative=sdkOnly&&path.startsWith(prefix)?path.slice(prefix.length):path==='/'?'index.html':decodeURIComponent(path.slice(1));
  const file=resolve(base,relative);
  if(!file.startsWith(base+sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let activePage;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:ipad?{width:1112,height:834}:{width:1440,height:1000},hasTouch:ipad,isMobile:ipad,serviceWorkers:'block'}),errors=[],requests=[];
 activePage=page;
 page.on('pageerror',error=>{errors.push(error.message);process.stderr.write(error.message+'\n');});page.on('request',request=>requests.push(request.url()));
 page.setDefaultTimeout(60000);
 await page.addInitScript(absent=>{localStorage.setItem('bw-starter-v1-complete','1');if(absent)localStorage.setItem('bw-cad-enabled','1');},expectAbsent);
 trace('Opening CAD check');
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 trace('Page loaded');
 if(sdkOnly){
  await page.waitForFunction(()=>window.ready);
  trace('SDK ready');
  const result=await page.evaluate(async()=>{
   session.add({kind:'box',size:[10,20,30]});
   const geometry=await editor.whenIdle();
   const volume=geometry.volume;
   editor.dispose();editor=sdk.mountCadEditor(document.querySelector('#cad'),{session,wasmURL:'/static/cad-sdk/cad-assets/manifold.wasm'});
   await editor.whenIdle();const undo=session.state.canUndo;session.undo();await editor.whenIdle();
   return {volume,undo,roots:session.state.document.roots.length};
  });
  trace('SDK geometry and remount complete');
  assert.ok(Math.abs(result.volume-6000)<1e-6);assert.equal(result.undo,true);assert.equal(result.roots,0);
  if(process.argv.includes('--shapes-ui')){
   await page.getByRole('button',{name:'Shapes',exact:true}).click();
   trace('SDK Shapes clicked');
   const shapes=page.getByRole('dialog',{name:'Shape library',exact:true});
   await shapes.waitFor({state:'visible'});
   await shapes.getByLabel('Search shapes',{exact:true}).fill('Box');
   await shapes.getByRole('button',{name:'Add Box',exact:true}).click();
   await page.evaluate(()=>editor.whenIdle());
   assert.equal(await page.evaluate(()=>session.state.document.roots.length),1);
  }
  if(process.env.BW_CAD_MOTOR_FIXTURE){
   await page.evaluate(async()=>editor.openFile('hinge.bcad',new Uint8Array(await(await fetch('/motor-fixture.bcad')).arrayBuffer())));
   const before=await page.evaluate(()=>session.serialize());
   await page.getByRole('button',{name:'Simulate',exact:true}).click();
   const panel=page.getByRole('region',{name:'Assembly simulation'});
   const speed=panel.getByRole('spinbutton',{name:/Speed \(degrees\/s\)/});await speed.fill('90');await speed.press('Tab');
   await panel.getByRole('button',{name:'Run simulation',exact:true}).click();
   await page.waitForFunction(()=>Number(document.querySelector('#cad').shadowRoot.querySelector('.simulation-panel').dataset.time)>.2);
   await panel.getByRole('button',{name:'Pause simulation',exact:true}).click();
   assert.ok(Math.abs(parseFloat(await panel.getByRole('status',{name:/Joint angle/}).textContent()))>1);
   await panel.getByRole('button',{name:'Reset simulation',exact:true}).click();
   assert.equal(await page.evaluate(()=>session.serialize()),before);
  }

 }else{
  await page.getByRole('tab',{name:'Robots',exact:true}).waitFor();
  if(process.argv.includes('--robots')){
   await page.getByRole('tab',{name:'Robots',exact:true}).click();
   await page.waitForFunction(()=>window.__bwSimLab?._pane?.lib&&['ready','paused'].includes(window.__bwSimLab.status));
   trace('Robots ready');
   const state=values=>page.evaluate(values=>new Promise(resolve=>window.__bwSimLab._pane.setState(values,resolve)),values);
   await state({status:'ready',mode:'simulate',blockers:[{code:'no-motor'}]});
   trace('Blocker fixture set');
   const notice=page.getByTestId('bw-sim-lab-blockers').first();await notice.waitFor();
   await page.getByTestId('bw-sim-lab-blockers-close').click();
   await state({status:'loading',blockers:[]});await state({status:'ready',blockers:[{code:'no-motor'}]});
   assert.equal(await page.getByTestId('bw-sim-lab-blockers').count(),0);
   await state({mode:'build',selection:[],hidden:[],editGroup:null,buildStatus:{kind:'idle'}});
   assert.equal(await page.getByTestId('bw-sim-lab-help-build').count(),0);
   if(ipad){const a=await page.getByRole('tab',{name:'Robots',exact:true}).boundingBox(),b=await page.getByTestId('bw-chrome-toggle').boundingBox();assert.ok(a.x+a.width<=b.x,`Robots tab overlaps menu toggle: ${JSON.stringify({a,b})}`);}
   await page.getByRole('tab',{name:'Code',exact:true}).click();
  }
  assert.equal(await page.getByRole('tab',{name:'CAD',exact:true}).count(),0);
  assert.equal(requests.some(url=>url.includes('/cad-sdk/')),false);
  if(expectAbsent){
   await page.getByTestId('bw-settings-menu-trigger').click();
   if(!await page.getByLabel('CAD Editor',{exact:true}).isVisible())await page.getByText('Workspace',{exact:true}).click();
   assert.equal(await page.getByLabel('CAD Editor',{exact:true}).count(),0);
  }else{
  const toggle=async value=>{
   trace('Setting CAD '+value);
   await page.getByTestId('bw-settings-menu-trigger').click();
   if(!await page.getByLabel('CAD Editor',{exact:true}).isVisible())await page.getByText('Workspace',{exact:true}).click();
   await page.getByLabel('CAD Editor',{exact:true}).selectOption(value);
  };
  await toggle('1');await page.getByRole('tab',{name:'CAD',exact:true}).waitFor();
  assert.equal(requests.some(url=>url.includes('/cad-sdk/')),false,'enabling alone does not load CAD');
  trace('Opening CAD tab');
  await page.getByRole('tab',{name:'CAD',exact:true}).click();
  await page.waitForFunction(()=>window.__bwCad?.editor);
  // The CAD bridges install from their own lazy chunk after first paint (lib/bw-cad-host.js).
  await page.waitForFunction(()=>window.__bwCadProgramApi&&window.__brickwrightStore?.getState().scratchGui.vm.runtime.cadCircuitSimulation);
  const cad=page.getByTestId('bw-cad-tab');
  // Exercise the shipping host, including the deferred catalogue and Redux preference.
  // Model library comes from the project File menu: the embedded CAD SDK hides its own File
  // menu (embedded:true, since b89a2a68e) and CAD contributes its file actions to the host's
  // File menu (d9aa15eef, docs/CAD-WORKSPACE-UX.md; verify-workspace-menus.mjs takes this route too).
  await page.getByTestId('bw-file-menu-trigger').click();
  await page.getByRole('menuitem',{name:'Model library…',exact:true}).click();
  const models=cad.getByRole('dialog',{name:'Model library',exact:true});
  await models.getByLabel('Model type',{exact:true}).selectOption('source');
  await page.waitForFunction(()=>document.querySelector('[data-testid="bw-cad-tab"] [data-state]')?.shadowRoot?.querySelectorAll('.model-library-card').length>130);
  await models.locator('.model-library-card').first().click();
  assert.ok(await models.locator('.model-library-preview img').isVisible());
  await models.getByRole('button',{name:'Close model library'}).click();
  const sameEditor=await page.evaluate(()=>{window.__bwThemeEditor=window.__bwCad.editor;return window.__bwCad.editor.session.serialize();});
  for(const mode of ['dark','default']){
   await page.getByTestId('bw-settings-menu-trigger').click();
   const preference=page.getByLabel(/Color mode/i);
   if(!await preference.isVisible())await page.getByText('Preferences',{exact:true}).click();
   await preference.selectOption(mode);
   await page.waitForFunction(mode=>window.__bwCad.editor.colorMode===(mode==='dark'?'dark':'light'),mode);
   assert.equal(await page.evaluate(()=>window.__bwCad.editor===window.__bwThemeEditor),true,'theme changes keep the same editor/session');
   assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.serialize()),sameEditor,'theme does not alter history');
  }
  trace('Shipping host loads catalogue previews and changes light/dark mode without losing the session');
  await cad.getByRole('button',{name:'Shapes',exact:true}).click();
  trace('GUI Shapes clicked');
  const library=cad.getByRole('dialog',{name:'Shape library',exact:true});
  await library.waitFor({state:'visible'});
  await library.getByLabel('Search shapes',{exact:true}).fill('Box');
  await library.getByRole('button',{name:'Add Box',exact:true}).click();
  await page.waitForFunction(()=>window.__bwCad.editor.session.state.document.roots.length===1);
  await page.evaluate(()=>window.__bwCad.editor.whenIdle());
  assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),1);
  const text=await page.evaluate(()=>localStorage.getItem('bw-cad-document'));
  assert.ok(JSON.parse(text).roots.length===1);
  // In shipping builds both optional editors are present. Adding/removing FPGA
  // must preserve the selected CAD surface as its numerical tab index shifts.
  await page.getByTestId('bw-settings-menu-trigger').click();
  if(!await page.getByLabel('CAD Editor',{exact:true}).isVisible())await page.getByText('Workspace',{exact:true}).click();
  const fpga=page.getByLabel('FPGA lab (⬢ tab)',{exact:true});
  if(await fpga.count()){
   await fpga.selectOption('1');
   await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-label="CAD"]')?.getAttribute('aria-selected')==='true');
   await page.getByTestId('bw-settings-menu-trigger').click();if(!await page.getByLabel('CAD Editor',{exact:true}).isVisible())await page.getByText('Workspace',{exact:true}).click();
   await page.getByLabel('FPGA lab (⬢ tab)',{exact:true}).selectOption('0');
   await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-label="CAD"]')?.getAttribute('aria-selected')==='true');
   assert.equal(await page.evaluate(()=>localStorage.getItem('bw-cad-document')),text);
  }else await page.getByTestId('bw-settings-menu-trigger').click();

  await toggle('0');assert.equal(await page.getByRole('tab',{name:'CAD',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bw-cad-document')),text);
  await toggle('1');await page.getByRole('tab',{name:'CAD',exact:true}).click();
  await page.waitForFunction(()=>window.__bwCad?.editor);
  assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.canUndo),true);
  // Use the host's global Undo control rather than the SDK's own toolbar.
  await page.getByRole('button',{name:'Undo',exact:true}).first().click();
  await page.evaluate(()=>window.__bwCad.editor.whenIdle());
  assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),0);
  if(process.argv.includes('--program')){
   await page.evaluate(async()=>{await window.__bwCad.editor.openFile('motor.bcad',new Uint8Array(await(await fetch('/motor-fixture.bcad')).arrayBuffer()));await window.__bwCad.editor.whenIdle();});
   const before=await page.evaluate(()=>window.__bwCad.sdk.serializeDocument(window.__bwCad.editor.session.state.document));
   await page.getByRole('tab',{name:'Code',exact:true}).click();
   const result=await page.evaluate(async()=>{const api=window.__bwCadProgramApi;await api.runMotorDegrees('A',720,360);const angle=api.motorAngle('A');await api.stop();return {angle,status:api.status()};});
   assert.ok(Math.abs(result.angle-720)<2,JSON.stringify(result));assert.equal(result.status,'paused');
   assert.equal(await page.evaluate(()=>window.__bwCad.sdk.serializeDocument(window.__bwCad.editor.session.state.document)),before);
   trace('CAD motor program ran while Code tab was visible');
   if(process.env.BW_CAD_PROGRAM_FIXTURE){
    const result=await page.evaluate(async before=>{
     const vm=window.__bwSimLab?._pane?.props?.vm;if(!vm)throw new Error('Open Robots first for the VM diagnostic boundary');
     await vm.loadProject(await(await fetch('/cad-program.sb3')).arrayBuffer());
     window.__bwCad.editor.session.load(window.__bwCad.sdk.parseDocument(before));await window.__bwCad.editor.whenIdle();
     vm.start();vm.greenFlag();await new Promise(resolve=>setTimeout(resolve,100));const until=performance.now()+60000;
     while(vm.runtime.threads.some(t=>t.status!==4)&&performance.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
     const api=window.__bwCadProgramApi,result={angle:api.motorAngle('A'),status:api.status(),threads:vm.runtime.threads.filter(t=>t.status!==4).length};vm.stopAll();return result;
    },before);
    assert.ok(Math.abs(result.angle-720)<2,JSON.stringify(result));assert.equal(result.status,'paused');assert.equal(result.threads,0);
    trace('Real Scratch VM loaded CAD blocks and completed the encoder-based program');
   }
   if(process.env.BW_CAD_SLIDER_FIXTURE&&process.env.BW_CAD_SLIDER_PROGRAM_FIXTURE){
    const result=await page.evaluate(async()=>{
     const vm=window.__bwSimLab?._pane?.props?.vm;if(!vm)throw new Error('Open Robots first for the VM diagnostic boundary');
     const doc=await(await fetch('/slider-fixture.bcad')).text();
     await vm.loadProject(await(await fetch('/cad-slider-program.sb3')).arrayBuffer());
     window.__bwCad.editor.session.load(window.__bwCad.sdk.parseDocument(doc));await window.__bwCad.editor.whenIdle();
     const before=window.__bwCad.editor.session.serialize();vm.start();vm.greenFlag();await new Promise(resolve=>setTimeout(resolve,100));const until=performance.now()+60000;
     while(vm.runtime.threads.some(t=>t.status!==4)&&performance.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
     const api=window.__bwCadProgramApi,result={position:api.sliderPosition('A'),status:api.status(),threads:vm.runtime.threads.filter(t=>t.status!==4).length,same:before===window.__bwCad.editor.session.serialize()};vm.stopAll();return result;
    });
    assert.ok(Math.abs(result.position-10)<.1,JSON.stringify(result));assert.equal(result.status,'paused');assert.equal(result.threads,0);assert.equal(result.same,true);
    trace('Real Scratch VM completed a CAD slider program in mm with unchanged design');
   }

  }
  }
 }
 assert.deepEqual(errors,[]);
 console.log(expectAbsent?'PASS CAD-off build: stored opt-in cannot reveal a tab, setting or fetch the SDK':sdkOnly?'PASS CAD SDK: real WASM box volume, worker, disposal/remount and host-owned undo':'PASS CAD tab: default off, lazy SDK, setting on/off, real shape UI, persistence and host Undo');
}catch(error){
 if(activePage){
  await mkdir(resolve(root,'artifacts'),{recursive:true});
  await writeFile(resolve(root,'artifacts/cad-editor-failure-dom.json'),JSON.stringify(await Promise.race([
   activePage.evaluate(()=>({body:document.body.innerText,cad:document.querySelector('[data-testid="bw-cad-tab"]')?.innerHTML,shadow:(document.querySelector('#cad')??document.querySelector('[data-testid="bw-cad-tab"]')?.querySelector('[data-state]'))?.shadowRoot?.innerHTML})),
   new Promise(resolve=>setTimeout(()=>resolve({diagnostic:'page did not answer DOM query'}),5000))
  ]).catch(error=>({diagnostic:error.message})),null,2)).catch(()=>{});
  await activePage.screenshot({path:resolve(root,'artifacts/cad-editor-failure.png'),fullPage:true,timeout:5000}).catch(()=>{});}
 throw error;
}finally{trace('Closing browser');await browser.close();trace('Closing server');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
