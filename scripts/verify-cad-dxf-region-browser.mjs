// SPDX-License-Identifier: BSD-3-Clause
import {chromium} from 'playwright';
import {copyFile, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [url = 'http://127.0.0.1:8165/', input, output, pdfOutput] = process.argv.slice(2);
const fixture = ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1021','9','$INSUNITS','70',4,'0','ENDSEC',
 '0','SECTION','2','TABLES','0','TABLE','2','LAYER',
 '0','LAYER','2','Cut perimeter','70',4,'62',5,'420',16711935,'370',35,
 '0','LAYER','2','Bohrungen Ä','70',0,'62',1,'290',0,'0','ENDTAB','0','ENDSEC',
 '0','SECTION','2','ENTITIES','0','CIRCLE','8','Bohrungen Ä','10',10,'20',15,'40',2,'30',10,'210',0,'220',.6,'230',.8,
 '0','LWPOLYLINE','8','Cut perimeter','90',4,'70',1,'43',1.5,'10',0,'20',0,'10',40,'20',0,'10',40,'20',30,'10',0,'20',30,'38',10,'210',0,'220',.6,'230',.8,
 '0','CIRCLE','8','Bohrungen Ä','10',30,'20',15,'40',3,'30',10,'210',0,'220',.6,'230',.8,
 '0','TEXT','8','Annotations','1','Fabrication notes',
 '0','CIRCLE','8','Bohrungen Ä','67',1,'10',110,'20',130,'40',15,
 '0','TEXT','8','Paper sheet','410','Sheet 1','1','Title block',
 '0','ENDSEC','0','EOF'].join('\n');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,acceptDownloads:true,serviceWorkers:'block'});
 page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  localStorage.setItem('bw-starter-v1-complete','1');
  localStorage.setItem('bw-cad-enabled','1');
  // Exercise downloads in Playwright without handing the file to the OS share UI.
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
 });
 await page.goto(url);
 await page.getByRole('tab',{name:'CAD',exact:true}).tap();
 await page.waitForFunction(()=>window.__bwCad?.editor);
 const cad=page.getByTestId('bw-cad-tab');
 const openParameters=cad.getByRole('button',{name:'Parameters',exact:true});
 const parameters=cad.getByRole('dialog',{name:'Model parameters'});
 const expression=parameters.getByLabel('Parameter expression',{exact:true});
 const applyParameters=parameters.getByRole('button',{name:'Apply parameters'});
 const closeParameters=parameters.getByRole('button',{name:'Close parameters'});
 await openParameters.tap();
 await parameters.getByRole('button',{name:'Add parameter'}).tap();
 await parameters.getByLabel('Parameter name',{exact:true}).fill('spacing');
 await expression.fill('20');
 await applyParameters.tap();
 await closeParameters.tap();
 await cad.getByRole('button',{name:'Sketch',exact:true}).tap();
 const dialog=cad.getByRole('dialog',{name:'Sketch and extrusion'});
 await dialog.getByText('Import DXF outline',{exact:true}).tap();
 await dialog.getByLabel('Choose DXF file').setInputFiles(input || {
  name:'Motor plate.dxf', mimeType:'application/dxf', buffer:Buffer.from(fixture)
 });
 const loops=dialog.getByLabel('Region loops (mm)');
 const importLayers=dialog.getByRole('button',{name:'Import selected layers',exact:true});
 if(!input){
  const layers=dialog.getByRole('group',{name:'DXF layers',exact:true});
  await dialog.getByText('Paper-space layout entities were skipped.',{exact:true}).waitFor();
  assert.equal(await layers.getByRole('checkbox',{name:'Paper sheet',exact:true}).count(),0);
  await layers.getByRole('checkbox',{name:'Annotations',exact:true}).tap();
  assert.ok(await layers.getByRole('checkbox',{name:'Bohrungen Ä',exact:true}).isChecked());
  assert.ok(await layers.getByRole('checkbox',{name:'Cut perimeter',exact:true}).isChecked());
  await importLayers.tap();
  await dialog.getByText('The source plane was unfolded into the selected sketch plane at actual size.',{exact:true}).waitFor();
  await dialog.getByText('DXF widths use X, Y, bulge, start width, end width. The solid follows the centerline.',{exact:true}).waitFor();
 }else{
  await Promise.race([loops.waitFor({state:'visible'}),importLayers.waitFor({state:'visible'})]);
  if(await importLayers.isVisible())await importLayers.tap();
 }
 await loops.waitFor({state:'visible'});
 const original=await loops.inputValue();
 if(!input)assert.match(original,/40, 30, 0, 1.5, 1.5/);
 const vertex=dialog.locator('[data-resize="vertex"][data-loop="1"][data-vertex="2"]');
 const cdp=await page.context().newCDPSession(page);
 const moveTouch=async(handle,dx,dy=0,release=true)=>{
  await handle.scrollIntoViewIfNeeded();
  const [start,end]=await handle.evaluate((handle,[dx,dy])=>{
   const x=handle.cx.baseVal.value,y=handle.cy.baseVal.value,matrix=handle.getScreenCTM();
   return [[x,y],[x+dx,y-dy]].map(([x,y])=>{
    const point=new DOMPoint(x,y).matrixTransform(matrix);
    return {x:point.x,y:point.y};
   });
  },[dx,dy]);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  if(release)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 };
 await moveTouch(vertex,4);
 assert.match(await loops.inputValue(),/44, 30/);
 await moveTouch(vertex,-4);
 assert.equal(await loops.inputValue(),original);
 assert.match(original,/^CIRCLE 10, 15, 2\n.*\nCIRCLE 30, 15, 3$/);
 assert.equal((await dialog.locator('.sketch-top').getAttribute('d')).match(/M /g).length,3);
 const rootCount=()=>page.evaluate(()=>window.__bwCad.editor.session.state.document.roots.length);
 assert.equal(await rootCount(),0);
 const create=dialog.getByRole('button',{name:'Create extrusion'});
 await loops.fill(original.replace('CIRCLE 10, 15, 2','CIRCLE 0, 15, 4'));
 assert.ok(await create.isDisabled());
 assert.match(await dialog.getByRole('status',{name:'Sketch status'}).innerText(),/separate holes/);
 const edited=original.replace('CIRCLE 10, 15, 2','CIRCLE 20 mm - spacing / 2, 15, 4').replace('CIRCLE 30, 15, 3','CIRCLE 20 mm + spacing / 2, 15, 3');
 await loops.fill(edited);
 await create.tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 const profile=await page.evaluate(()=>Object.values(window.__bwCad.editor.session.state.document.sketches)[0].profile);
 assert.equal(profile.kind,'region');
 assert.deepEqual(profile.loops.map(({id,kind,radius})=>[id,kind,radius]),[['dxf-loop-1','circle',4],['dxf-loop-2','outline',undefined],['dxf-loop-3','circle',3]]);
 assert.deepEqual(profile.loops.map(loop=>loop.dxfLayer),['Bohrungen Ä','Cut perimeter','Bohrungen Ä']);
 if(!input)assert.deepEqual(profile.loops.map(loop=>loop.dxfLayerStyle),[
  {color:1,plot:false},{color:5,trueColor:16711935,flags:4,lineweight:35},{color:1,plot:false}
 ]);
 await openParameters.tap();
 await expression.fill('28');
 await applyParameters.tap();
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 await closeParameters.tap();
 const exportButton=cad.getByRole('button',{name:'Export sketch as DXF'});
 if(!await exportButton.isVisible())await cad.getByRole('button',{name:'Properties',exact:true}).tap();
 const [download]=await Promise.all([page.waitForEvent('download'),exportButton.tap()]);
 const path=await download.path();
 assert.ok(path, 'Expected a local DXF download');
 const exported=await readFile(path,'utf8');
 assert.match(exported,/\$INSUNITS\r\n70\r\n4/);
 assert.match(exported,/8\r\nBohrungen Ä\r\n100\r\nAcDbCircle\r\n10\r\n6\r\n20\r\n15\r\n30\r\n0\r\n40\r\n4/);
 assert.match(exported,/8\r\nBohrungen Ä\r\n100\r\nAcDbCircle\r\n10\r\n34\r\n20\r\n15\r\n30\r\n0\r\n40\r\n3/);
 assert.match(exported,/8\r\nCut perimeter\r\n100\r\nAcDbPolyline/);
 assert.doesNotMatch(exported,/Fabrication notes|Annotations/);
 if(!input){
  assert.match(exported,/2\r\nCut perimeter\r\n70\r\n4\r\n62\r\n5/);
  assert.match(exported,/420\r\n16711935\r\n370\r\n35/);
  assert.match(exported,/43\r\n1.5/);
  assert.match(exported,/2\r\nBohrungen Ä\r\n70\r\n0\r\n62\r\n1\r\n6\r\nCONTINUOUS\r\n290\r\n0/);
 }
 if(output)await copyFile(path,output);
 const [pdfDownload]=await Promise.all([
  page.waitForEvent('download'), cad.getByRole('button',{name:'Export drilling template (PDF)'}).tap()
 ]);
 const pdfPath=await pdfDownload.path();
 assert.ok(pdfPath, 'Expected a local PDF download');
 const pdf=await readFile(pdfPath,'utf8');
 assert.match(pdf,/^%PDF-1\.6/);
 assert.match(pdf,/15 16 m 65 16 l S/);
 assert.match(pdf,/\n91 [\d.]+ m 91 [\d.]+ l S/);
 assert.match(pdf,/\n119 [\d.]+ m 119 [\d.]+ l S/);
 if(pdfOutput)await copyFile(pdfPath,pdfOutput);
 await cad.getByRole('button',{name:'Edit sketch & extrusion'}).tap();
 assert.equal(await loops.inputValue(),edited);
 await dialog.getByRole('button',{name:'Close sketch'}).tap();
 const undo=cad.getByRole('button',{name:'Undo',exact:true});
 await undo.tap();
 assert.equal(await page.evaluate(()=>window.__bwCad.editor.session.state.document.parametric.parameters.spacing.expression),'20');
 await undo.tap();
 assert.equal(await rootCount(),0);
 await page.evaluate(()=>{
  const session=window.__bwCad.editor.session;
  session.addSketch({kind:'rectangle',id:'guide-rectangle',width:40,depth:30},{name:'Rectangle guide'});
  session.addSketch({kind:'circle',id:'guide-circle',center:[17.5,15],radius:5,segments:12},{name:'Circle guide'});
 });
 await cad.getByRole('button',{name:'Sketch',exact:true}).tap();
 await dialog.getByLabel('Profile',{exact:true}).selectOption('outline');
 await dialog.getByText('Sketch snap references',{exact:true}).tap();
 await dialog.getByLabel('Reference sketch',{exact:true}).selectOption({label:'Rectangle guide'});
 await dialog.getByLabel('Second reference sketch',{exact:true}).selectOption({label:'Circle guide'});
 const snapVertex=dialog.locator('[data-resize="vertex"][data-vertex="1"]');
 await moveTouch(snapVertex,-27.2,15.2,false);
 assert.equal(await dialog.locator('.sketch-snap-label').textContent(),'Intersection');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await dialog.getByLabel('Outline points X, Y (mm)').inputValue(),'0, 0\n12.5, 15\n30, 30\n0, 30');
 assert.equal(await rootCount(),0);
 await create.tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 assert.equal(await rootCount(),1);
 await undo.tap();
 assert.equal(await rootCount(),0);
 await cad.getByRole('button',{name:'Sketch',exact:true}).tap();
 await dialog.getByLabel('Profile',{exact:true}).selectOption('outline');
 await dialog.getByRole('checkbox',{name:'Edit edge curves'}).check();
 await moveTouch(dialog.locator('[data-resize="curve"][data-edge="0"]'),0,-10);
 assert.equal(await dialog.getByLabel('Outline points X, Y (mm)').inputValue(),'0, 0, 0.5\n40, 0\n30, 30\n0, 30');
 await cdp.detach();
 await create.tap();
 await dialog.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());
 const curve=await page.evaluate(()=>{
  const d=window.__bwCad.editor.session.state.document;
  const node=d.nodes[d.roots[0]];
  return d.sketches[node.sketchId].profile.bulges;
 });
 assert.deepEqual(curve,[.5,0,0,0]);
 await undo.tap();
 assert.equal(await rootCount(),0);
 console.log('PASS embedded CAD tablet viewport: tilted DXF with model-space and layer filtering, holes in preview, touch-dragged vertex, invalid edit, retained layer styles and widths, named hole spacing, 1:1 DXF and PDF exports, reference intersection snap, touching and curving an edge, reopen, Undo');
} finally {await browser.close();}
