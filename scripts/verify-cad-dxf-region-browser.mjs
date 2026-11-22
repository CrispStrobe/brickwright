// SPDX-License-Identifier: BSD-3-Clause
import {chromium} from 'playwright';
import {copyFile, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [url = 'http://127.0.0.1:8165/', input, output, pdfOutput] = process.argv.slice(2);
const fixture = ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1021','9','$INSUNITS','70',4,'0','ENDSEC',
 '0','SECTION','2','ENTITIES','0','CIRCLE','8','Bohrungen Ä','10',10,'20',15,'40',2,
 '0','LWPOLYLINE','8','Cut perimeter','90',4,'70',1,'10',0,'20',0,'10',40,'20',0,'10',40,'20',30,'10',0,'20',30,
 '0','CIRCLE','8','Bohrungen Ä','10',30,'20',15,'40',3,'0','ENDSEC','0','EOF'].join('\n');
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
 await dialog.getByLabel('Choose DXF file').setInputFiles(input ?? {
  name:'Motor plate.dxf', mimeType:'application/dxf', buffer:Buffer.from(fixture)
 });
 const loops=dialog.getByLabel('Region loops (mm)');
 await loops.waitFor({state:'visible'});
 const original=await loops.inputValue();
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
 console.log('PASS embedded CAD tablet viewport: third-party DXF, holes in preview, invalid edit, retained layers, named hole spacing, 1:1 DXF and PDF exports, reopen, Undo');
} finally {await browser.close();}
