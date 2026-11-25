#!/usr/bin/env node
/**
 * Real-browser CP1 component gate, with explicit test dependency and engine roots.
 * It uses only original synthetic firmware and never reads a historical ROM.
 * Run: node scripts/verify-cp1-panel-browser.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board --executable /usr/bin/chromium
 * This gate must report failure if the environment cannot launch a browser.
 */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cp1BrowserFixture} from './lib/cp1-browser-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const option=flag=>{const i=process.argv.indexOf(flag);return i<0?null:process.argv[i+1];};
if(!option('--deps')||!option('--board'))throw Error('Pass explicit --deps <node_modules> and --board <bw-board checkout> paths.');
const deps=path.resolve(root,option('--deps'));
const compilerDeps=path.resolve(root,option('--compiler-deps')||option('--deps'));
const board=path.resolve(root,option('--board'));
const output=path.resolve(root,option('--out')||'test-results/cp1-panel-browser');
const fixture=await cp1BrowserFixture({root,deps,compilerDeps,board});
const errors=[];
let browser,server,page;
await mkdir(output,{recursive:true});
try{
 server=await fixture.createServer(fixture.config);
 await server.listen();
 const address=server.httpServer.address();
 const url=`http://127.0.0.1:${address.port}`;
 browser=await fixture.chromium.launch({headless:true,...(option('--executable')?{executablePath:option('--executable')}:{})});
 page=await browser.newPage({viewport:{width:980,height:1180}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto(`${url}/?mode=host`,{waitUntil:'networkidle'});
 await page.locator('[data-cp1-panel]').waitFor();
 assert.equal(await page.locator('[data-cp1-physical-key]').count(),30);
 assert.equal(await page.locator('[data-cp1-digit]').count(),6);
 const panel=page.locator('[data-cp1-panel]');
 assert.equal(await panel.getByText('Raw masks',{exact:false}).count(),0);
 assert.match(await panel.locator('[title^="Raw masks"]').getAttribute('title'),/79 79 F9/);
 assert.equal(await panel.getByText('Command debugging needs a qualified monitor ROM',{exact:false}).count(),0);
 assert.equal(await panel.locator('header [data-cp1-semantic="unavailable"]').count(),1);
 const monitorRows=()=>panel.locator('header').evaluate(header=>{
  const centers=[...header.children].map(control=>{
   const r=control.getBoundingClientRect();
   return (r.top+r.bottom)/2;
  });
  return Math.max(...centers)-Math.min(...centers);
 });
 assert.ok(await monitorRows()<=1,'monitor controls share one row');

 assert.equal(await page.locator('[data-cp1-digit="2"]').getAttribute('data-segments'),'249');
 const source='VALUE EQU 42\nORG 0\nstart: AKO VALUE\ndisplay: ANZ\nSPU display\n';
 const editor=page.locator('[data-cp1-source]');
 await editor.fill('unfinished: AKO ');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bw-cp1-workspace')).source),'unfinished: AKO ');
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await editor.inputValue(),'unfinished: AKO ');
 await editor.fill(source);
 await page.getByRole('button',{name:'Load cells',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Loaded 3'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__cp1Harness.readCell(2)),{opcode:9,operand:1});
 await page.evaluate(()=>{window.__cp1Harness.failLoad=true;});
 await page.getByRole('button',{name:'Load cells',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Synthetic loader rejection'}).first().waitFor();
 assert.doesNotMatch(await page.getByRole('status').innerText(),/Loaded/);
 await page.evaluate(()=>{window.__cp1Harness.failLoad=false;});
 await page.locator('[data-cp1-panel]').focus();
 await page.keyboard.down('4');
 const digit=page.locator('[data-cp1-physical-key="upper-4"]');
 const box=await digit.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.keyboard.up('4');
 assert.deepEqual(await page.evaluate(()=>window.__cp1Harness.snapshot().keys),['4']);
 await digit.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
 assert.deepEqual(await page.evaluate(()=>window.__cp1Harness.snapshot().keys),[]);
 await page.locator('[data-cp1-panel]').focus();await page.keyboard.down('1');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('1');
 assert.deepEqual(await page.evaluate(()=>window.__cp1Harness.snapshot().keys),[]);
 await page.getByRole('button',{name:'Ports',exact:true}).click();
 await page.getByRole('checkbox',{name:'P1 input bit 0',exact:true}).uncheck();
 assert.equal(await page.evaluate(()=>window.__cp1Harness.snapshot().ports.P1.input),254);
 await page.evaluate(()=>{window.__cp1Harness.inputMode='circuit';window.__cp1Harness.refresh();});
 await page.getByRole('checkbox',{name:'P1 input bit 0',exact:true}).waitFor({state:'detached'});
 assert.equal(await page.getByRole('checkbox',{name:'P1 input bit 0',exact:true}).count(),0);
 await page.getByRole('button',{name:'Memory',exact:true}).click();
 await page.getByLabel('Cell',{exact:true}).fill('127');await page.getByLabel('Opcode',{exact:true}).fill('0');await page.getByLabel('Operand',{exact:true}).fill('99');
 await page.getByRole('button',{name:'Write cell',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.__cp1Harness.readCell(127)),{opcode:0,operand:99});
 await page.getByRole('button',{name:'Program',exact:true}).click();
 await page.evaluate(()=>{window.__cp1Harness.holdConfigure=true;});
 const cp3=page.getByRole('checkbox',{name:'CP3 expansion (256 cells)',exact:true});
 // The controlled checkbox continues showing the applied configuration while
 // this deliberately delayed request is pending. A check() expects an immediate
 // state change, so use the actual click and verify each state in order.
 await cp3.click();
 await page.waitForFunction(()=>window.__cp1Harness.configureWaits.length===1 &&
  document.querySelector('label input[type="checkbox"]')?.disabled);
 assert.equal(await cp3.isChecked(),false);
 assert.equal(await cp3.isDisabled(),true);
 await editor.fill('ORG 255\nDATA 2 ; keep this draft');
 assert.equal(await page.getByRole('button',{name:'Load cells',exact:true}).isDisabled(),true);
 await page.evaluate(()=>window.__cp1Harness.resolveConfigure());
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bw-cp1-workspace')).configuration.expansion===true);
 await page.waitForFunction(()=>document.querySelector('label input[type="checkbox"]')?.checked===true);
 assert.equal(await cp3.isChecked(),true);
 assert.equal(await editor.inputValue(),'ORG 255\nDATA 2 ; keep this draft');
 assert.equal(await page.evaluate(()=>window.__cp1Harness.config().partId),'cp1-proof');
 await page.getByRole('button',{name:'Load cells',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Loaded 1'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__cp1Harness.readCell(255)),{opcode:0,operand:2});
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.goto(`${url}/?mode=panel&locale=de&theme=dark`,{waitUntil:'networkidle'});
 await page.setViewportSize({width:390,height:1180});
 assert.equal(await page.getByRole('button',{name:'CPU-Schritt',exact:true}).count(),1);
 assert.ok(await monitorRows()<=1,'narrow monitor controls share one row');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:path.join(output,'mobile-de-dark.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const result={status:'passed',browser:browser.version(),react:fixture.react,scope:'Actual component browser behavior with original synthetic 8049 firmware and real CP1 machine',checks:['raw displays and hover diagnostics','single-row monitor controls','thirty keys','incomplete-source reload','RAM load','load refusal','pointer/keyboard ownership','blur release','manual/circuit inputs','RAM editing','async CP3 source preservation','German narrow layout'],propTypes:'validator-only stub',fullApplicationBuild:false};
 await writeFile(path.join(output,'result.json'),`${JSON.stringify(result,null,2)}\n`);
 console.log(JSON.stringify(result));
}catch(error){
 if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(path.join(output,'result.json'),`${JSON.stringify({status:'failed',message:error.message,browserErrors:errors,fullApplicationBuild:false},null,2)}\n`);
 throw error;
}finally{if(browser)await browser.close();if(server)await server.close();}
