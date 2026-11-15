// SPDX-License-Identifier: BSD-3-Clause
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
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
  if(sdkOnly&&path==='/motor-fixture.bcad'&&process.env.BW_CAD_MOTOR_FIXTURE){res.setHeader('Content-Type','application/json');res.end(await readFile(process.env.BW_CAD_MOTOR_FIXTURE));return;}
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
   await page.getByText('Workspace',{exact:true}).click();
   assert.equal(await page.getByLabel('CAD Editor',{exact:true}).count(),0);
  }else{
  const toggle=async value=>{
   trace('Setting CAD '+value);
   await page.getByTestId('bw-settings-menu-trigger').click();
   await page.getByText('Workspace',{exact:true}).click();
   await page.getByLabel('CAD Editor',{exact:true}).selectOption(value);
  };
  await toggle('1');await page.getByRole('tab',{name:'CAD',exact:true}).waitFor();
  assert.equal(requests.some(url=>url.includes('/cad-sdk/')),false,'enabling alone does not load CAD');
  trace('Opening CAD tab');
  await page.getByRole('tab',{name:'CAD',exact:true}).click();
  await page.waitForFunction(()=>window.__bwCad?.editor);
  const cad=page.getByTestId('bw-cad-tab');
  await cad.getByRole('button',{name:'Shapes',exact:true}).click();
  const library=cad.getByRole('dialog',{name:'Shape library',exact:true});
  await library.getByLabel('Search shapes',{exact:true}).fill('Box');
  await library.getByRole('button',{name:'Add Box',exact:true}).click();
  await page.evaluate(()=>window.__bwCad.editor.whenIdle());
  assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),1);
  const text=await page.evaluate(()=>localStorage.getItem('bw-cad-document'));
  assert.ok(JSON.parse(text).roots.length===1);
  // In shipping builds both optional editors are present. Adding/removing FPGA
  // must preserve the selected CAD surface as its numerical tab index shifts.
  await page.getByTestId('bw-settings-menu-trigger').click();
  await page.getByText('Workspace',{exact:true}).click();
  const fpga=page.getByLabel('FPGA lab (⬢ tab)',{exact:true});
  if(await fpga.count()){
   await fpga.selectOption('1');
   await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-label="CAD"]')?.getAttribute('aria-selected')==='true');
   await page.getByTestId('bw-settings-menu-trigger').click();await page.getByText('Workspace',{exact:true}).click();
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
  }
 }
 assert.deepEqual(errors,[]);
 console.log(expectAbsent?'PASS CAD-off build: stored opt-in cannot reveal a tab, setting or fetch the SDK':sdkOnly?'PASS CAD SDK: real WASM box volume, worker, disposal/remount and host-owned undo':'PASS CAD tab: default off, lazy SDK, setting on/off, real shape UI, persistence and host Undo');
}catch(error){
 if(activePage){await mkdir(resolve(root,'artifacts'),{recursive:true});await activePage.screenshot({path:resolve(root,'artifacts/cad-editor-failure.png'),fullPage:true}).catch(()=>{});}
 throw error;
}finally{trace('Closing browser');await browser.close();trace('Closing server');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
