#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {openFile} from './lib/sim-lab-scale-gate.mjs';
const shots='artifacts/atlas-switchback/export-browser';mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),errors=[],receipts=[];
const init=async locale=>{
 const page=await browser.newPage({viewport:{width:1600,height:1050},locale,serviceWorkers:'block'});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-right-pane-hidden','1');});
 await page.goto(process.env.PROOF_URL||'http://127.0.0.1:8767/',{waitUntil:'networkidle'});
 await page.getByRole('tab',{name:/^(Robots|Robot Lab|Roboter)$/}).click();await page.waitForFunction(()=>window.__bwSimLab?.status==='ready');return page;
};
try{
 const page=await init('en-US');assert.equal(await page.getByTestId('bw-code-status').count(),0);
 await page.getByTestId('bw-sim-lab-examples').click();const gallery=page.getByTestId('bw-sim-examples');await gallery.getByRole('searchbox').fill('straight-eight');
 await gallery.locator('[data-model="straight-eight.ldr"]').getByRole('button',{name:/^Open model \+ program:/}).click();await gallery.waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__bwSimLab._pane.state.shipped==='straight-eight.ldr'&&!window.__bwSimLab._pane.state.programLoading&&document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'));
 assert.match(await page.locator('input[class*="project-title"]').inputValue(),/Straight Eight/);
 for(const [id,pieces,phases]of [['atlas-arm',237,[45,45,-15]],['switchback-lift',341,[10,-30]],['straight-eight',113,[]]])for(const ext of ['ldr','mpd']){
  const name=`${id}.${ext}`;await openFile(page,{name,buffer:readFileSync(`artifacts/atlas-switchback/fixed-library/models/${name}`)});
  const r=await page.evaluate(()=>{const p=window.__bwSimLab._pane;return {status:p.state.status,pieces:p.session.model.parts.length,phases:p.session.model.parts.filter(p=>p.rotorAngle!==undefined).map(p=>p.rotorAngle),ports:p.session.mechanism.actuators.map(a=>a.port).sort(),issues:p.state.issues.map(i=>i.code),worker:Boolean(p.session.worker),framing:p.view.framingStats()};});
  assert.equal(r.status,'ready');assert.equal(r.pieces,pieces);assert.deepEqual(r.phases,phases);assert.deepEqual(r.ports,id==='straight-eight'?['A']:['A','B','D']);assert.ok(r.worker);assert.ok(r.issues.every(i=>i==='locked-hinges'));
  assert.ok(r.framing.corners.every(p=>p.every(x=>Number.isFinite(x)&&Math.abs(x)<=1)));
  const notes=page.getByTestId('bw-sim-lab-issues');if(r.issues.length){assert.equal(await notes.evaluate(el=>el.open),false,'rigid-mount notes start folded');await notes.locator('summary').click();assert.ok(await notes.locator('li').count()>=r.issues.length);await notes.locator('summary').click();}
  if(id==='switchback-lift'&&ext==='mpd'){
   await page.getByTestId('bw-sim-lab-instructions').click();await page.waitForFunction(()=>window.__bwSimLabInstructions?.status==='ready');
   await page.keyboard.press('End');await page.waitForFunction(()=>window.__bwSimLabInstructions.page===window.__bwSimLabInstructions.steps);await page.keyboard.press('ArrowLeft');
   await page.waitForFunction(()=>window.__bwSimLabInstructions.stats?.step===window.__bwSimLabInstructions.steps-1);
   assert.match(await page.getByTestId('bw-sim-instructions-note').allTextContents().then(xs=>xs.join(' ')),/free payload/);
   await page.keyboard.press('Escape');
  }
  if(ext==='mpd')await page.screenshot({path:`${shots}/${id}-fixed.png`});receipts.push({name,pieces,phases,ports:r.ports,issues:r.issues});console.log(`PASS fixed ${name}: ${pieces} pieces, ports ${r.ports}, preserved rotor angles, worker and framing`);
 }
 await page.getByTestId('bw-sim-lab-instructions').click();await page.waitForFunction(()=>window.__bwSimLabInstructions?.status==='ready');await page.keyboard.press('End');await page.waitForFunction(()=>window.__bwSimLabInstructions.page===window.__bwSimLabInstructions.steps);await page.keyboard.press('Home');await page.waitForFunction(()=>window.__bwSimLabInstructions.page===0);await page.keyboard.press('Escape');
 await page.close();const de=await init('de-DE');
 for(const [id,answer]of [['atlas-arm',/600/],['switchback-lift',/62,83/],['straight-eight',/tan/]]){
  await de.getByTestId('bw-sim-lab-examples').click();const gallery=de.getByTestId('bw-sim-examples');await gallery.getByRole('searchbox').fill(id);await gallery.locator(`[data-model="${id}.ldr"]`).getByRole('button',{name:/^Lektion lesen:/}).click();await gallery.waitFor({state:'hidden'});
  const lesson=de.getByTestId('bw-sim-lesson');await de.waitForFunction(id=>document.querySelector('[data-testid="bw-sim-lesson"]')?.dataset.lesson===id,id);
  await lesson.getByRole('button',{name:'Erklärung zeigen',exact:true}).click();assert.match(await lesson.getByTestId('bw-sim-lesson-answer').textContent(),answer);await lesson.screenshot({path:`${shots}/${id}-lesson-de.png`});await lesson.getByRole('button',{name:'Lektion schließen',exact:true}).click();console.log(`PASS German lesson ${id}`);
 }
 assert.deepEqual(errors,[]);writeFileSync(`${shots}/receipt.json`,JSON.stringify({imports:receipts,germanLessons:3,pageErrors:errors},null,2));
}finally{await browser.close();}
