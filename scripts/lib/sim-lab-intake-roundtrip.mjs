// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {installBrowserMechanicsRecorder} from './sim-lab-browser-recorder.mjs';
import {SIX_INTAKES} from './sim-lab-six-intake-contracts.mjs';
import {captureRenderedModel} from './sim-lab-rendered-model-gate.mjs';
import {finishHeldCleanup, assertHeldPrivateDirectory} from './sim-lab-q5-held.mjs';
import {openFile} from './sim-lab-scale-gate.mjs';
import {exportedProject} from './sim-lab-integral-gate.mjs';
import {intakeIdentity, writeIntakeReceipt, readIntakeReceipt} from './sim-lab-intake-receipt.mjs';
import {continueCompletedIntake} from './sim-lab-intake-continuation.mjs';

// Project import can reset the selected editor tab. Wait for the saved real
// program and the loading overlay to finish before acting on the new GUI.
// Ignore shadow ids: Scratch expands inline literals into new shadow blocks.
export function projectProgramReady(expected=null){
 const vm=window.__bwIntakeProjectVm||window.__bwSimLab?._pane?.props.vm;
 const targets=vm?.runtime.targets.map(t=>{
  const counts={};for(const b of Object.values(t.blocks?._blocks||{}))if(!b.shadow&&typeof b.opcode==='string')counts[b.opcode]=(counts[b.opcode]||0)+1;
  return{name:t.getName(),operations:Object.entries(counts).sort(([a],[b])=>a.localeCompare(b))};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 if(expected===null)return targets;
 return targets&&JSON.stringify(targets)===JSON.stringify(expected)&&
  ![...document.querySelectorAll('[class*="loader_background"]')].some(e=>e.offsetWidth||e.offsetHeight);
}

export async function captureIntakeProject(page,opts,id){
 await page.getByTestId('bw-sim-lab-reset').click();
 await page.waitForFunction(()=>window.__bwSimLab.status==='ready');
 const record=await page.evaluate(()=>window.__bwSimLab.projectRecord);
 const program=await page.evaluate(projectProgramReady);assert.ok(program.some(t=>t.operations.length),'actual saved program contains blocks');
 const expected=await page.evaluate(()=>window.__bwSimLab._pane.session.model.parts);
 assert.match(record.ldraw,/^0 Author: (?:CrispStrobe|Christian Ströbele)/m);
 const project=resolve(opts.shotsDir,id+'.sb3');
 await page.getByText('File',{exact:true}).click();await exportedProject(page,project);
 const source=opts.modelSourceFor ? opts.modelSourceFor(id) : readFileSync('overlay/scratch-gui/static/sim-lab/models/'+id+'.ldr','utf8');
 for(const [name,text]of [[id+'.ldr',source],[id+'.mpd','0 FILE '+id+'.ldr\n'+source+'\n0 NOFILE\n']]){
  await openFile(page,{name,buffer:Buffer.from(text)});
  const actual=await page.evaluate(()=>({status:window.__bwSimLab.status,parts:window.__bwSimLab._pane.session.model.parts}));
  assert.equal(actual.status,'ready');assert.deepEqual(actual.parts,expected);
 }
 const receiptPath=resolve(opts.shotsDir,id+'-intake.json');
 writeIntakeReceipt(receiptPath,{id,identity:intakeIdentity(id,opts.buildDir),project,record,expected,program});
 console.log(`PASS ${id}: original post-run project exported and bound for fresh-context replay`);
 return receiptPath;
}

export async function replayIntakeProject(browser,opts,id,judge,receiptPath){
 if(opts.retainPageErrors)assertHeldPrivateDirectory(opts.shotsDir);
 const {project,record,program,expected}=readIntakeReceipt(receiptPath,{id,identity:intakeIdentity(id,opts.buildDir)});
 const reopened=await browser.newPage({viewport:{width:1600,height:1050},serviceWorkers:'block'}),errors=[];
 reopened.on('pageerror',e=>errors.push(e.message));reopened.on('dialog',d=>d.accept());
 let primary,hasPrimary=false;
 try{
  await opts.openSimLab(reopened,{program:null});
  await reopened.evaluate(()=>{window.__bwIntakeProjectVm=window.__bwSimLab._pane.props.vm;});
  await reopened.getByText('File',{exact:true}).click();await reopened.getByText('Load from your computer',{exact:true}).click();
  await reopened.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles(project);
  const projectLoadBudgetMs=120000,loadingStarted=Date.now();
  try{await reopened.waitForFunction(projectProgramReady,program,{timeout:projectLoadBudgetMs});}
  catch(error){
   const state=await reopened.evaluate(()=>({status:window.__bwSimLab?.status,modelFile:window.__bwSimLab?._pane?.state.modelFile,
    loaders:[...document.querySelectorAll('[class*="loader_background"]')].map(e=>({visible:!!(e.offsetWidth||e.offsetHeight),text:e.innerText})),
    targets:window.__bwIntakeProjectVm.runtime.targets.map(t=>({name:t.getName(),blocks:Object.keys(t.blocks._blocks).length})),
    selectedTabs:[...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map(e=>e.innerText)}));
   writeFileSync(resolve(opts.shotsDir,id+'-project-load-failure.json'),JSON.stringify({projectLoadBudgetMs,elapsedMs:Date.now()-loadingStarted,error:String(error),state,errors},null,2)+'\n');throw error;
  }
  writeFileSync(resolve(opts.shotsDir,id+'-project-load.json'),JSON.stringify({projectLoadBudgetMs,elapsedMs:Date.now()-loadingStarted,programShape:program},null,2)+'\n');
  await reopened.getByRole('tab',{name:/^(Robots|Robot Lab)$/}).click();
  await reopened.waitForFunction(count=>window.__bwSimLab?.status==='ready'&&window.__bwSimLab._pane.session.model.parts.length===count,expected.length);
  assert.deepEqual(await reopened.evaluate(()=>window.__bwSimLab.projectRecord),record);
  await reopened.evaluate(installBrowserMechanicsRecorder,{recordKey:'__bwIntakeReopened',captureKey:'__bwCaptureIntakeReopened',extended:SIX_INTAKES.includes(id)||opts.extendedObservations===true,observeProgram:true,observeDynamics:opts.observeDynamics===true,stepParts:opts.stepParts??null});
  await reopened.getByTestId('bw-sim-lab-speed').selectOption(String(opts.replaySpeed??4));await reopened.getByTestId('bw-sim-lab-run').click();
  await reopened.waitForFunction(()=>{
   const p=window.__bwSimLab._pane;return p.session.time>1000&&!p.props.vm.runtime.threads.some(t=>t.status!==4);
  },null,{timeout:opts.timeout});
  const continuation=await reopened.evaluate(continueCompletedIntake);
  writeFileSync(resolve(opts.shotsDir,id+'-continuation.json'),JSON.stringify(continuation,null,2)+'\n');
  // Completion alone does not observe passive support after the motors stop.
  // Keep the ordinary simulation advancing for the declared hold interval.
  await reopened.waitForFunction(afterMs=>{
   const r=window.__bwIntakeReopened;
   return Number.isFinite(r.finishedAt)&&r.track.at(-1)?.t-r.finishedAt>=afterMs;
  },opts.afterMs??1000,{timeout:opts.timeout});
  await reopened.evaluate(()=>window.__bwCaptureIntakeReopened());
  const r=await reopened.evaluate(()=>window.__bwIntakeReopened);
  writeFileSync(resolve(opts.shotsDir,id+'-reopened-track.json'),JSON.stringify(r));await judge(id,r);
  assert.deepEqual(errors,[]);
  // Capture the accepted final state after the full hold has been recorded.
  if(await reopened.evaluate(()=>window.__bwSimLab.status==='running'))await reopened.getByTestId('bw-sim-lab-pause').click();
  await captureRenderedModel(reopened,resolve(opts.shotsDir,id+'-reopened.png'));
  console.log(`PASS ${id}: raw LDR/MPD, actual project save, fresh-context reopen and complete saved program`);
 }catch(error){primary=error;hasPrimary=true;throw error;}
 finally{
  if(opts.retainPageErrors)await finishHeldCleanup(primary,[
   ()=>writeFileSync(resolve(opts.shotsDir,id+'-reopened-page-errors.json'),JSON.stringify(errors,null,2)+'\n'),
   ()=>reopened.close()
  ],hasPrimary);
  else await reopened.close();
 }
}

export async function intakeRoundtrip(page,opts,id,judge){
 const receiptPath=await captureIntakeProject(page,opts,id);
 if(!opts.captureOnly)await replayIntakeProject(page.context().browser(),opts,id,judge,receiptPath);
}
