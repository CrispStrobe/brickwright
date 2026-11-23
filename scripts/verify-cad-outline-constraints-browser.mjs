// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-outline-constraints-browser.mjs <app-url>');
const dir=await mkdtemp(join(tmpdir(),'bw-outline-constraints-'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const tab=page=>page.getByRole('tab',{name:'CAD',exact:true});
const file=page=>page.getByTestId('bw-file-menu-trigger');
const rounded=points=>points.map(point=>point.map(value=>Math.round(value*1e6)/1e6+0));
function requireRadius(profile,radius){
 const [a,b]=profile.points,bulge=profile.bulges[0];
 const chord=Math.hypot(b[0]-a[0],b[1]-a[1]);
 assert.ok(bulge>0&&bulge<=1+1e-8);
 assert.ok(Math.abs(chord*(bulge+1/bulge)/4-radius)<1e-6);
}
async function setReach(page,expression,{create=false}={}){
 await page.getByRole('button',{name:'Parameters',exact:true}).tap();
 const parameters=page.getByRole('dialog',{name:'Model parameters'});
 if(create){
  await parameters.getByRole('button',{name:'Add parameter',exact:true}).tap();
  await parameters.getByLabel('Parameter name',{exact:true}).fill('reach');
 }
 const input=parameters.getByLabel('Parameter expression',{exact:true});
 await input.fill(expression);
 await input.blur();
 await parameters.getByRole('button',{name:'Apply parameters',exact:true}).tap();
 await parameters.getByRole('status',{name:'Parameter status'}).filter({hasText:'Parameters applied'}).waitFor();
 await parameters.getByRole('button',{name:'Close parameters',exact:true}).tap();
}
async function open(){
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,acceptDownloads:true,serviceWorkers:'block'});
 page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  localStorage.setItem('bw-starter-v1-complete','1');
  localStorage.setItem('bw-cad-enabled','1');
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
 });
 await page.goto(url);
 await tab(page).tap();
 await page.waitForFunction(()=>window.__bwCad?.editor);
 return page;
}

try{
 const page=await open(),workers=[];
 page.on('worker',worker=>workers.push(worker.url()));
 await setReach(page,'40',{create:true});
 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 const sketch=page.getByRole('dialog',{name:'Sketch and extrusion'});
 await sketch.getByLabel('Profile',{exact:true}).selectOption('outline');
 const coordinates=sketch.getByLabel('Outline points X, Y (mm)');
 await coordinates.fill('0, 0, 0.25\n38, 3\n35, 22\n2, 20');
 await sketch.getByText('Outline constraints',{exact:true}).tap();
 async function add(kind,edge,value){
  await sketch.getByLabel('Constraint',{exact:true}).selectOption(kind);
  await sketch.getByLabel('Constrained segment').selectOption(String(edge));
  if(kind==='length')await sketch.getByLabel('Segment length (mm)').fill(String(value));
  else if(kind==='radius')await sketch.getByLabel('Arc radius (mm)').fill(String(value));
  else if(value!==undefined)await sketch.getByLabel('Second segment').selectOption(String(value));
  await sketch.getByRole('button',{name:'Add constraint',exact:true}).tap();
 }
 for(const args of [
  ['horizontal',0],['vertical',1],['parallel',0,2],['perpendicular',2,3],
  ['length',0,'reach'],['equal',0,2],['length',1,20],['radius',0,'reach / 2'],['tangent',0,1]
 ])await add(...args);
 const solve=sketch.getByRole('button',{name:'Solve outline',exact:true});
 await solve.tap();
 await sketch.getByText('Outline solved. Fully constrained.',{exact:true}).waitFor();
 assert.ok(workers.some(url=>url.includes('outline-constraints.worker')));
 const expected=await coordinates.inputValue();
 assert.deepEqual(rounded(expected.split('\n').map(row=>row.split(',').slice(0,2).map(Number))),[[0,0],[40,0],[40,20],[0,20]]);
 await add('length',0,45);
 await solve.tap();
 await sketch.getByText('Could not solve these outline constraints. Check dimensions and segment choices.',{exact:true}).waitFor();
 assert.equal(await coordinates.inputValue(),expected);
 await sketch.getByRole('button',{name:'Remove constraint 10',exact:true}).tap();
 assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length),0);
 await sketch.getByRole('button',{name:'Create extrusion',exact:true}).tap();
 await sketch.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 await sketch.getByLabel('Profile',{exact:true}).selectOption('outline');
 await coordinates.fill('100, 0\n110, 0, 0.16\n116, 2, 0.15\n120, 10\n120, 20\n100, 20');
 await coordinates.blur();
 await sketch.getByText('Outline constraints',{exact:true}).tap();
 await add('arc-tangent',2,1);
 await solve.tap();
 await sketch.getByText('Outline solved.',{exact:true}).waitFor();
 await sketch.getByRole('button',{name:'Create extrusion',exact:true}).tap();
 await sketch.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await file(page).tap();
 const [download]=await Promise.all([
  page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).tap()
 ]);
 const project=join(dir,'outline.sb3');
 await download.saveAs(project);
 const zip=await JSZip.loadAsync(await readFile(project));
 const saved=JSON.parse(await zip.file(CAD_PROJECT_PATH).async('text'));
 assert.equal(saved.version,34);
 assert.equal(saved.roots.length,2);
 const id=saved.nodes[saved.roots[0]].sketchId;
 const compoundId=saved.nodes[saved.roots[1]].sketchId;
 const compound=saved.sketches[compoundId].profile;
 const [,first,shared,last]=compound.vertexIds;
 assert.deepEqual(compound.relations,[{kind:'arc-tangent',edge:[shared,last],other:[first,shared]}]);
 assert.equal(compound.bulges[1],.16);
 const firstEnd=Math.atan2(2,6)+2*Math.atan(compound.bulges[1]);
 const secondStart=Math.atan2(8,4)-2*Math.atan(compound.bulges[2]);
 assert.ok(Math.abs(firstEnd-secondStart)<1e-9);
 const profile=saved.sketches[id].profile;
 assert.deepEqual(rounded(profile.points),[[0,0],[40,0],[40,20],[0,20]]);
 assert.equal(profile.vertexIds.length,4);
 assert.equal(profile.relations.length,9);
 assert.equal(profile.relations[4].length,'reach');
 assert.equal(profile.relations[7].radius,'reach / 2');
 const [a,b,c]=profile.vertexIds;
 assert.deepEqual(profile.relations[8],{kind:'tangent',edge:[a,b],other:[b,c]});
 assert.ok(Math.abs(profile.bulges[0]-1)<1e-8);
 requireRadius(profile,20);
 await page.close();

 const restored=await open();
 await file(restored).tap();
 const [picker]=await Promise.all([
  restored.waitForEvent('filechooser'),restored.getByText('Load from your computer',{exact:true}).tap()
 ]);
 restored.on('dialog',dialog=>dialog.accept());
 await picker.setFiles(project);
 await tab(restored).tap();
 await restored.waitForFunction(id=>window.__bwCad?.editor.session.state.document.id===id,saved.id);
 await restored.evaluate(()=>window.__bwCad.editor.whenIdle());
 const readProfile=()=>restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,id);
 assert.deepEqual(await readProfile(),profile);
 assert.deepEqual(await restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,compoundId),compound);
 const revision=await restored.evaluate(()=>window.__bwCad.editor.session.state.revision);
 await setReach(restored,'55');
 const solved=await readProfile();
 assert.deepEqual(rounded(solved.points),[[0,0],[55,0],[55,20],[0,20]]);
 assert.deepEqual(solved.vertexIds,profile.vertexIds);
 assert.deepEqual(solved.relations,profile.relations);
 requireRadius(solved,27.5);
 assert.equal(await restored.evaluate(()=>window.__bwCad.editor.session.state.revision),revision+1);
 await restored.getByRole('button',{name:'Command palette',exact:true}).tap();
 const palette=restored.getByRole('dialog',{name:'Command palette'});
 const search=palette.getByRole('combobox',{name:'Search CAD commands'});
 await search.fill('Model source');
 await search.blur();
 await palette.getByRole('option',{name:'Model source',exact:true}).tap();
 const source=restored.getByRole('region',{name:'Model source',exact:true});
 const draft=source.getByLabel('Design source',{exact:true});
 const original=await draft.inputValue();
 const code=original.replace('expression: "55"','expression: "58"')+'\n// Keep this rover sketch note\n';
 assert.ok(original.includes('expression: "55"'));
 await draft.fill(code);
 await draft.blur();
 const sourceStatus=source.getByRole('status',{name:'Model source status'});
 await source.getByRole('button',{name:'Preview model source',exact:true}).tap();
 await sourceStatus.filter({hasText:'No history entry'}).waitFor();
 assert.deepEqual(await readProfile(),solved);
 await source.getByRole('button',{name:'Apply model source',exact:true}).tap();
 await sourceStatus.filter({hasText:'one history step'}).waitFor();
 const fromSource=await readProfile();
 assert.deepEqual(rounded(fromSource.points),[[0,0],[58,0],[58,20],[0,20]]);
 assert.deepEqual(fromSource.vertexIds,profile.vertexIds);
 requireRadius(fromSource,29);
 assert.match(await draft.inputValue(),/Keep this rover sketch note/);
 assert.equal(await restored.evaluate(()=>window.__bwCad.editor.session.state.revision),revision+2);
 await source.getByRole('button',{name:'Close model source',exact:true}).tap();
 const object=restored.getByTestId('object-name').first();
 if(!await object.isVisible())await restored.getByRole('button',{name:'Objects',exact:true}).tap();
 await object.tap();
 const edit=restored.getByRole('button',{name:'Edit sketch & extrusion',exact:true});
 if(!await edit.isVisible())await restored.getByRole('button',{name:'Properties',exact:true}).tap();
 await edit.tap();
 const reopened=restored.getByRole('dialog',{name:'Sketch and extrusion'});
 await reopened.getByRole('button',{name:'Remove constraint 9',exact:true}).tap();
 await reopened.getByRole('button',{name:'Edit constraint 5',exact:true}).tap();
 const dimension=reopened.getByLabel('Segment length (mm)');
 assert.equal(await dimension.inputValue(),'reach');
 await dimension.fill('56');
 await reopened.getByRole('button',{name:'Update constraint',exact:true}).tap();
 await reopened.getByRole('button',{name:'Solve outline',exact:true}).tap();
 await reopened.getByText('Outline solved. Fully constrained.',{exact:true}).waitFor();
 await reopened.getByRole('button',{name:'Apply sketch changes',exact:true}).tap();
 await reopened.waitFor({state:'hidden'});
 const edited=await readProfile();
 assert.deepEqual(rounded(edited.points),[[0,0],[56,0],[56,20],[0,20]]);
 assert.deepEqual(edited.vertexIds,profile.vertexIds);
 assert.equal(Number(edited.relations[4].length),56);
 assert.equal(edited.relations.length,8);
 requireRadius(edited,29);
 console.log('PASS retained arc-to-arc and arc-to-line tangency, SB3 reopen, parameter and source solves, and editing saved constraints');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
