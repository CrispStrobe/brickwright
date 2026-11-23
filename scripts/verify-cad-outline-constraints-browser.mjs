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
 async function add(kind,edge,value,dialog=sketch){
  await dialog.getByLabel('Constraint',{exact:true}).selectOption(kind);
  await dialog.getByLabel('Constrained segment').selectOption(String(edge));
  if(kind==='length')await dialog.getByLabel('Segment length (mm)').fill(String(value));
  else if(kind==='radius')await dialog.getByLabel('Arc radius (mm)').fill(String(value));
  else if(value!==undefined)await dialog.getByLabel('Second segment').selectOption(String(value));
  await dialog.getByRole('button',{name:'Add constraint',exact:true}).tap();
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

 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 await sketch.getByLabel('Profile',{exact:true}).selectOption('region');
 const loops=sketch.getByLabel('Region loops (mm)');
 await loops.fill('200, 0 | 250, 0 | 250, 70 | 200, 70\n210, 10 | 220, 10 | 220, 20 | 210, 20\nCIRCLE 241, 40, reach < 56 mm ? 8 mm : 25 mm');
 await loops.blur();
 await sketch.getByText('Region loop constraints',{exact:true}).tap();
 const loopPicker=sketch.getByLabel('Constrained loop',{exact:true});
 const kind=sketch.getByRole('combobox',{name:'Constraint',exact:true});
 const segment=sketch.getByRole('combobox',{name:'Constrained segment',exact:true});
 const addConstraint=sketch.getByRole('button',{name:'Add constraint',exact:true});
 const loopStatus=sketch.getByRole('status',{name:'Outline constraint status'});
 await sketch.locator('summary:visible').filter({hasText:/^Outline constraints$/}).tap();
 const loopLength=sketch.getByRole('textbox',{name:'Segment length (mm)',exact:true});
 await kind.selectOption('length');
 await loopLength.fill('reach + 10 mm');
 await loopLength.blur();
 await addConstraint.tap();
 await kind.selectOption('vertical');
 await segment.selectOption('1');
 await addConstraint.tap();
 await solve.tap();
 await loopStatus.filter({hasText:'Outline solved'}).waitFor();
 await loopPicker.selectOption({label:'Outline loop 2'});
 await sketch.locator('summary:visible').filter({hasText:/^Outline constraints$/}).tap();
 await kind.selectOption('length');
 await loopLength.fill('reach / 4');
 await loopLength.blur();
 await addConstraint.tap();
 await solve.tap();
 await loopStatus.filter({hasText:'Outline solved'}).waitFor();
 await sketch.getByText('Region loop positions',{exact:true}).tap();
 await sketch.getByLabel('Reference loop',{exact:true}).selectOption({label:'Outline loop 1'});
 await sketch.getByLabel('Positioned loop',{exact:true}).selectOption({label:'Outline loop 2'});
 await sketch.getByLabel('Reference anchor',{exact:true}).selectOption({label:'Edge 1 midpoint'});
 const xOffset=sketch.getByLabel('X offset (mm)',{exact:true});
 const offsetExpression='reach / 4 + 1 mm - (reach + 10 mm) / 2';
 await xOffset.fill(offsetExpression);
 await xOffset.blur();
 await sketch.getByRole('button',{name:'Add loop position',exact:true}).tap();
 assert.ok((await loops.inputValue()).includes('\n211, 10'));
 await sketch.getByRole('button',{name:'Create extrusion',exact:true}).tap();
 await sketch.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await page.getByRole('button',{name:'Sketch',exact:true}).tap();
 await sketch.getByLabel('Profile',{exact:true}).selectOption('region');
 await loops.fill('310, 0 | 385, 0 | 385, 40 | 310, 40\n320, 10 | 330, 10 | 330, 20 | 320, 20\n350, 10 | 358, 10 | 358, 20 | 350, 20');
 await loops.blur();
 await sketch.getByText('Region loop constraints',{exact:true}).tap();
 await loopPicker.selectOption({label:'Outline loop 2'});
 await sketch.locator('summary:visible').filter({hasText:/^Outline constraints$/}).tap();
 await kind.selectOption('length');
 await loopLength.fill('reach / 4');
 await loopLength.blur();
 await addConstraint.tap();
 await solve.tap();
 await loopStatus.filter({hasText:'Outline solved'}).waitFor();
 await sketch.getByText('Region edge matches',{exact:true}).tap();
 await sketch.getByLabel('Edge reference loop',{exact:true}).selectOption({label:'Outline loop 2'});
 await sketch.getByLabel('Edge target loop',{exact:true}).selectOption({label:'Outline loop 3'});
 await sketch.getByRole('button',{name:'Add edge length match',exact:true}).tap();
 await sketch.getByRole('status',{name:'Region edge match status'}).filter({hasText:'Region edge matches solved'}).waitFor();
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
 assert.equal(saved.version,38);
 assert.equal(saved.roots.length,4);
 const id=saved.nodes[saved.roots[0]].sketchId;
 const compoundId=saved.nodes[saved.roots[1]].sketchId;
 const compound=saved.sketches[compoundId].profile;
 const [,first,shared,last]=compound.vertexIds;
 assert.deepEqual(compound.relations,[{kind:'arc-tangent',edge:[shared,last],other:[first,shared]}]);
 assert.equal(compound.bulges[1],.16);
 const firstEnd=Math.atan2(2,6)+2*Math.atan(compound.bulges[1]);
 const secondStart=Math.atan2(8,4)-2*Math.atan(compound.bulges[2]);
 assert.ok(Math.abs(firstEnd-secondStart)<1e-9);
 const regionId=saved.nodes[saved.roots[2]].sketchId;
 const storedRegion=saved.sketches[regionId].profile;
 assert.equal(storedRegion.kind,'region');
 const cutout=storedRegion.loops[1];
 assert.equal(storedRegion.loops[0].relations[0].length,'reach + 10 mm');
 assert.deepEqual(cutout.relations,[{kind:'length',edge:cutout.vertexIds.slice(0,2),length:'reach / 4'}]);
 assert.deepEqual(storedRegion.placements,[{reference:storedRegion.loops[0].id,target:cutout.id,
  referenceEdge:storedRegion.loops[0].vertexIds.slice(0,2),offset:[offsetExpression,10]}]);
 const matchId=saved.nodes[saved.roots[3]].sketchId;
 const matchedRegion=saved.sketches[matchId].profile;
 assert.deepEqual(matchedRegion.edgeMatches,[{reference:matchedRegion.loops[1].id,referenceEdge:matchedRegion.loops[1].vertexIds.slice(0,2),
  target:matchedRegion.loops[2].id,targetEdge:matchedRegion.loops[2].vertexIds.slice(0,2)}]);
 const edgeLength=loop=>Math.hypot(loop.points[1][0]-loop.points[0][0],loop.points[1][1]-loop.points[0][1]);
 assert.ok(Math.abs(edgeLength(matchedRegion.loops[2])-10)<1e-6);
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
 const readRegion=()=>restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,regionId);
 const readMatchedRegion=()=>restored.evaluate(id=>window.__bwCad.editor.session.state.document.sketches[id].profile,matchId);
 assert.deepEqual(await readRegion(),storedRegion);
 assert.deepEqual(await readMatchedRegion(),matchedRegion);
 const revision=await restored.evaluate(()=>window.__bwCad.editor.session.state.revision);
 await setReach(restored,'55');
 const solved=await readProfile();
 assert.deepEqual(rounded(solved.points),[[0,0],[55,0],[55,20],[0,20]]);
 assert.deepEqual(solved.vertexIds,profile.vertexIds);
 assert.deepEqual(solved.relations,profile.relations);
 requireRadius(solved,27.5);
 const resizedCutout=(await readRegion()).loops[1];
 assert.deepEqual(resizedCutout.vertexIds,cutout.vertexIds);
 assert.ok(Math.abs(resizedCutout.points[0][0]-214.75)<1e-6);
 assert.ok(Math.abs(resizedCutout.points[1][0]-228.5)<1e-6);
 assert.ok(Math.abs(edgeLength((await readMatchedRegion()).loops[2])-13.75)<1e-6);
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
 assert.ok(Math.abs((await readRegion()).loops[0].points[1][0]-268)<1e-6);
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
 assert.ok(Math.abs((await readRegion()).loops[1].points[1][0]-230)<1e-6);
 assert.ok(Math.abs(edgeLength((await readMatchedRegion()).loops[2])-14.5)<1e-6);
 const dragRevision=await restored.evaluate(()=>window.__bwCad.editor.session.state.revision);
 await restored.getByRole('button',{name:'Sketch',exact:true}).tap();
 await reopened.getByLabel('Profile',{exact:true}).selectOption('outline');
 const draftCoordinates=reopened.getByLabel('Outline points X, Y (mm)');
 const initial='0, 0\n40, 0\n40, 20\n0, 20';
 await draftCoordinates.fill(initial);
 await reopened.getByText('Outline constraints',{exact:true}).tap();
 await add('horizontal',0,undefined,reopened);
 await add('length',0,40,reopened);
 await add('vertical',1,undefined,reopened);
 await reopened.getByText('Outline constraints',{exact:true}).tap();
 const touch=await restored.context().newCDPSession(restored);
 async function startTouchDrag(handle,dx,dy){
  await handle.scrollIntoViewIfNeeded();
  const [start,end]=await handle.evaluate((circle,{dx,dy})=>{
   const x=circle.cx.baseVal.value,y=circle.cy.baseVal.value,matrix=circle.getScreenCTM();
   return [new DOMPoint(x,y),new DOMPoint(x+dx,y-dy)].map(point=>{
    const screen=point.matrixTransform(matrix);
    return {x:screen.x,y:screen.y};
   });
  },{dx,dy});
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  await reopened.locator('.sketch-snap-marker').waitFor();
 }
 await startTouchDrag(reopened.locator('[data-resize="vertex"][data-vertex="2"]'),8,6);
 assert.equal(await draftCoordinates.inputValue(),initial);
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await reopened.getByRole('status',{name:'Sketch status'}).filter({hasText:'Outline solved'}).waitFor();
 const dragged=rounded((await draftCoordinates.inputValue()).split('\n').map(row=>row.split(',').map(Number)));
 assert.deepEqual(dragged.slice(0,2),[[0,0],[40,0]]);
 assert.equal(dragged[2][0],40);
 assert.ok(Math.abs(dragged[2][1]-26)<.5);
 assert.equal(await restored.evaluate(()=>window.__bwCad.editor.session.state.revision),dragRevision);
 await reopened.getByRole('button',{name:'Close sketch',exact:true}).tap();
 await restored.getByRole('button',{name:'Sketch',exact:true}).tap();
 await reopened.getByLabel('Profile',{exact:true}).selectOption('region');
 const regionRows=reopened.getByLabel('Region loops (mm)');
 await regionRows.fill('0, 0 | 75, 0 | 75, 40 | 0, 40\n10, 10 | 22, 10 | 22, 20 | 10, 20\n40, 10 | 48, 10 | 48, 20 | 40, 20');
 await reopened.getByText('Region edge matches',{exact:true}).tap();
 await reopened.getByLabel('Edge reference loop',{exact:true}).selectOption({label:'Outline loop 2'});
 await reopened.getByLabel('Edge target loop',{exact:true}).selectOption({label:'Outline loop 3'});
 await reopened.getByRole('button',{name:'Add edge length match',exact:true}).tap();
 await reopened.getByRole('status',{name:'Region edge match status'}).filter({hasText:'Region edge matches solved'}).waitFor();
 await reopened.getByText('Region edge matches',{exact:true}).tap();
 const beforeRegionDrag=await regionRows.inputValue();
 await startTouchDrag(reopened.locator('[data-resize="vertex"][data-loop="1"][data-vertex="1"]'),6,0);
 assert.equal(await regionRows.inputValue(),beforeRegionDrag);
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await reopened.getByRole('status',{name:'Sketch status'}).filter({hasText:'Outline solved'}).waitFor();
 const [reference,dependent]=(await regionRows.inputValue()).split('\n').slice(1).map(row=>({
  points:row.split('|').map(point=>point.split(',').map(Number))
 }));
 assert.ok(Math.abs(edgeLength(reference)-18)<.5);
 assert.ok(Math.abs(edgeLength(reference)-edgeLength(dependent))<1e-6);
 assert.equal(await restored.evaluate(()=>window.__bwCad.editor.session.state.revision),dragRevision);
 await reopened.getByRole('button',{name:'Close sketch',exact:true}).tap();
 console.log('PASS constrained outline and region touch drag, region anchors, arc tangency, SB3 reopen, and source propagation');
}finally{
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
