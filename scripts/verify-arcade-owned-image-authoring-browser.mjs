#!/usr/bin/env node
import {pixelControl} from './lib-pixel-controls.mjs';
// PREPARED ONLY. Browser execution requires an admitted official build.
// Product mutations use visible UI events. VM/Blockly/CodeMirror access observes only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {openCodeActions, openCodeInfo} from './lib-code-actions.mjs';
import {inspectGuiHarnessSource} from './lib/gui-harness-source.mjs';
import {inspectGuiArtifactResponse} from './lib/gui-artifact-response.mjs';
import {makeCodeProjectFile,readMakeCodeProjectText} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';
import {ARCADE_PALETTE,svgToPixels} from '../overlay/scratch-gui/src/lib/bw-makecode/pixel-image.js';
import {source as literalSource} from '../test/fixtures/arcade/sdk-image-literal-callables.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.ok(process.env.PROOF_URL,'PROOF_URL must identify an admitted official production artifact');
assert.ok(process.env.BW_GUI_BUILD_RECEIPT&&process.env.BW_GUI_BUILD_ARCHIVE,'Actual official receipt/archive required; no local bundle fallback');
const receipt=JSON.parse(await fs.readFile(process.env.BW_GUI_BUILD_RECEIPT,'utf8'));
const inspected=inspectGuiHarnessSource({root,executable:process.env.BW_GUI_GIT_EXECUTABLE});
assert.equal(receipt.sourceSha,inspected.sourceSha);assert.equal(receipt.build.checkoutSha,inspected.sourceSha);assert.equal(receipt.build.conclusion,'success');
for(const key of ['runId','jobId','artifactId'])assert.match(String(receipt.build[key]),/^\d+$/);assert.equal(receipt.build.runUrl,`https://github.com/CrispStrobe/brickwright-lite/actions/runs/${receipt.build.runId}`);
const pins=JSON.parse(await fs.readFile(path.join(root,'vendor-pins.json'),'utf8'));assert.equal(receipt.producerSha,pins['sb3-creator']);assert.equal(receipt.arraysValuesSha,pins['arrays-values']);
assert.equal(sha(await fs.readFile(process.env.BW_GUI_BUILD_ARCHIVE)),receipt.build.archiveSha256);
assert.ok(Object.keys(receipt.assets).length);for(const name of Object.keys(receipt.assets))assert.ok(Number.isSafeInteger(receipt.assetBytes[name]));
const qualifiedExport=JSON.parse(await fs.readFile(path.join(root,'test/fixtures/arcade/sdk-image-literal-current-export.json'),'utf8'));
const sourceFiles={'main.ts':literalSource,'pxt.json':JSON.stringify({name:'arcade-image-literal-proof',dependencies:{device:'*'},files:['main.ts']})};
const out=path.resolve(process.env.BW_IMAGE_GUI_REPORT_DIR||'test-results/arcade-owned-image-authoring');await fs.mkdir(out,{recursive:true});
const sourceFile=path.join(out,'owned-image-source.mkcd');await fs.writeFile(sourceFile,makeCodeProjectFile(sourceFiles,{target:'arcade',name:'owned-image-source'}));
const report={status:'running',source:inspected.sourceSha,sourceTool:inspected.tool,receipt,journeys:[],samples:[],pageErrors:[],blockErrors:[],bundleObservations:[],boundary:'Visible literal-resource Pixel/Code/Blocks edits, native Game Console/HUD patch observations and portable current export. No exact HUD glyph oracle or offscreen literal-screen pixel claim. No new original execution, local build, runtime state mutation, class palette construction or arbitrary PNG qualification. Preparation alone is not GUI evidence.'};
let browser,page;const responses=[];
const editor=()=>page.getByTestId('bw-code-editor').locator('.cm-content');
const readCode=()=>editor().evaluate(element=>element.cmTile.root.view.state.doc.toString());
const codeTab=async()=>{await page.getByRole('tab',{name:'Code',exact:true}).click();await editor().waitFor({state:'visible'});};
const fresh=async()=>{
 const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true}),tab=await context.newPage();
 tab.on('dialog',dialog=>dialog.accept());tab.on('pageerror',error=>report.pageErrors.push(error.message));
 tab.on('response',response=>{const url=new URL(response.url()),base=new URL(process.env.PROOF_URL);if(url.origin!==base.origin||!url.pathname.endsWith('.js'))return;
  const name=decodeURIComponent(url.pathname.slice(base.pathname.endsWith('/')?base.pathname.length:base.pathname.lastIndexOf('/')+1));
  responses.push(inspectGuiArtifactResponse(response,{name,sha256:receipt.assets[name],bytes:receipt.assetBytes[name]}).then(row=>report.bundleObservations.push(row)).catch(error=>{(report.bundleFailures||=[]).push(String(error));}));});
 await tab.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('bw-starter-v1-complete','1');localStorage.setItem('bw-right-pane-hidden','0');});
 await tab.goto(process.env.PROOF_URL,{waitUntil:'domcontentloaded',timeout:90000});await tab.waitForFunction(()=>!!window.__brickwrightStore?.getState()?.scratchGui?.vm);
 // Error listener is observational and cannot change a block, target or primitive.
 await tab.evaluate(()=>{window.__bwOwnedImageErrors=[];window.__brickwrightStore.getState().scratchGui.vm.runtime.on('BLOCKS_ERROR',e=>window.__bwOwnedImageErrors.push(String(e)));});return tab;
};
const loaded=async()=>{await page.getByText('Blocks loaded.',{exact:true}).waitFor({timeout:60000});await page.waitForFunction(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.bwDeviceId==='arcade'&&document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled===false);};
const apply=async()=>{await page.getByRole('button',{name:/To blocks/}).first().click();await loaded();};
const open=async file=>{await codeTab();await openCodeActions(page);await page.getByTestId('bw-open-file').locator('input[type=file]').setInputFiles(file);await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Imported the Arcade game/}).waitFor({timeout:60000});assert.doesNotMatch(await page.getByTestId('bw-code-status').innerText(),/unsupported|not translated|could not|partial/i);await page.getByRole('button',{name:'Close Code help'}).click();await apply();};
const expected=(changed,original)=>({imageLiteralCalls:3,imageLiteralChanged:changed,imageLiteralOriginal:original,imageLiteralLater:original,imageLiteralOutside:0,imageLiteralAliasSame:true,imageLiteralFresh:true,imageLiteralLaterFresh:true,imageLiteralScore:changed+2*original+10});
// These are visible native HUD observations, not an independent glyph oracle.
// The literal Images are offscreen; only their resulting score is drawn here.
const consolePatches=new Map();let previousConsole=null,consoleButtonsObserved=false;
const showConsole=async()=>{
 await page.getByTitle('Game Console',{exact:true}).click();await page.getByTestId('bw-arcade-device').waitFor({state:'visible'});
 await page.getByTestId('bw-controller-canvas').waitFor({state:'hidden'});
 const canvas=page.getByTestId('bw-arcade-device').locator('canvas');assert.equal(await canvas.count(),1);await canvas.scrollIntoViewIfNeeded();await canvas.waitFor({state:'visible'});
 for(const button of ['up','down','left','right','a','b','start','select'])await page.getByTestId(`bw-arcade-${button}`).waitFor({state:'visible'});
};
const observeConsole=async(label,score)=>{
 assert.ok(Number.isInteger(score)&&score>=10&&score<100,'This fixture has a two-digit, time-independent score HUD');
 const known=consolePatches.get(score)||null,previous=previousConsole?.score!==score?previousConsole?.patch||null:null;
 await page.waitForFunction(({palette,known,previous})=>{
  const canvas=document.querySelector('[data-testid="bw-arcade-device"] canvas');if(!canvas||canvas.width!==160||canvas.height!==128)return false;
  const ctx=canvas.getContext('2d'),rgb=index=>palette[index].slice(1).match(/../g).map(v=>parseInt(v,16)),same=(pixel,color)=>pixel[3]===255&&color.every((v,i)=>pixel[i]===v);
  if(!same(ctx.getImageData(80,0,1,1).data,[2,6,23])||!same(ctx.getImageData(80,127,1,1).data,[2,6,23]))return false;
  // Selected HUD drawScore: font8 two digits, white top row and pink border/ink.
  const top=ctx.getImageData(147,4,13,1).data;for(let x=0;x<13;x++)if(!same(top.slice(x*4,x*4+4),rgb(1)))return false;
  if(!same(ctx.getImageData(146,14,1,1).data,rgb(3)))return false;
  const patch=Array.from(ctx.getImageData(148,5,12,8).data);let ink=0;for(let i=0;i<patch.length;i+=4){const pixel=patch.slice(i,i+4);if(same(pixel,rgb(3)))ink++;else if(!same(pixel,rgb(1)))return false;}if(!ink)return false;
  const text=patch.join(',');return (!known||text===known)&&(!previous||text!==previous);
 },{palette:ARCADE_PALETTE,known,previous},{timeout:15000});
 const observed=await page.getByTestId('bw-arcade-device').locator('canvas').evaluate(canvas=>{const ctx=canvas.getContext('2d');return{width:canvas.width,height:canvas.height,patch:Array.from(ctx.getImageData(148,5,12,8).data),rgba:Array.from(ctx.getImageData(0,0,160,128).data)};});
 const patch=observed.patch.join(',');if(known)assert.equal(patch,known,'Unchanged score HUD survives pane/load transitions');if(previous)assert.notEqual(patch,previous,'Changed score must repaint the actual visible HUD');
 consolePatches.set(score,patch);previousConsole={score,patch};(report.consoleFrames||=[]).push({label,score,width:observed.width,height:observed.height,hudPatchSHA256:sha(Buffer.from(observed.patch)),displaySHA256:sha(Buffer.from(observed.rgba)),boundary:'Actual native HUD geometry, colors and stable/changed patch; no exact glyph or offscreen literal-pixel claim'});
};
const consoleRoundtrip=async score=>{
 await page.getByTitle('Controller',{exact:true}).click();await page.getByTestId('bw-controller-canvas').waitFor({state:'visible'});await page.getByTestId('bw-arcade-device').waitFor({state:'hidden'});
 await showConsole();await observeConsole('Controller switch away/back',score);report.journeys.push('visible Controller pane replaces console, Game Console restores unchanged HUD');
};
const play=async(label,wanted)=>{
 await showConsole();
 await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
 await page.waitForFunction(wanted=>{const values=Object.fromEntries(window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.filter(t=>t.isOriginal).flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));return Object.entries(wanted).every(([k,v])=>values[k]===v);},wanted,{timeout:15000});
 const sample=await page.evaluate(()=>({variables:Object.fromEntries(window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.filter(t=>t.isOriginal).flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value])),errors:window.__bwOwnedImageErrors}));
 assert.deepEqual(sample.errors,[]);report.samples.push({label,wanted,sample});await observeConsole(label,wanted.imageLiteralScore);
 if(!consoleButtonsObserved){
  const button=page.getByTestId('bw-arcade-a');await button.scrollIntoViewIfNeeded();await button.hover();await page.mouse.down();
  try{await page.waitForFunction(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.bwArcadeDeviceState?.buttons?.a===true,{},{timeout:15000});}finally{await page.mouse.up();}
  await page.waitForFunction(()=>window.__brickwrightStore.getState().scratchGui.vm.runtime.bwArcadeDeviceState?.buttons?.a===false,{},{timeout:15000});
  report.consoleInput={control:'actual A pointer down/up',pressed:true,released:true,boundary:'Production input state only; this fixture has no A game handler'};consoleButtonsObserved=true;
 }
 await page.getByTitle('Stop',{exact:true}).first().click();
};
const codePaint=async(from,to)=>{
 await codeTab();await page.getByRole('button',{name:/From blocks/}).first().click();await page.getByText('Read the current project into all languages.',{exact:false}).first().waitFor();
 const code=await readCode(),pattern=new RegExp(`^(.*arcade set image pixel .* color )(\\(?${from}\\)?)(\\s*)$`,'gm');
 const matches=[...code.matchAll(pattern)];assert.equal(matches.length,1,'The actual editable Image mutation must have one concrete Number literal; no fallback source rewrite');
 const next=code.replace(pattern,`$1${to}$3`);await editor().click();await page.keyboard.press('Control+a');await page.keyboard.insertText(next);assert.equal(await readCode(),next);await apply();report.journeys.push(`visible Code Number edit ${from} to ${to}`);
};
const artwork=()=>page.evaluate(()=>{const vm=window.__brickwrightStore.getState().scratchGui.vm,targets=vm.runtime.targets.filter(t=>t.isOriginal);const owner=targets.find(t=>Object.values(t.blocks._blocks).some(b=>b.opcode==='arcade_frameImage')),frame=owner&&Object.values(owner.blocks._blocks).find(b=>b.opcode==='arcade_frameImage'),leaf=owner?.blocks.getBlock(frame?.inputs.TEMPLATE?.block),name=leaf?.fields.TEXT?.value,resource=targets.find(t=>t.getName()===name),costume=resource?.getCostumes()[resource.currentCostume];if(!resource||!costume)throw Error('No actual current literal resource');return {owner:owner.id,target:resource.id,name,assetId:costume.assetId,format:costume.dataFormat,svg:costume.asset?.decodeText()};});
const chooseTarget=async id=>{await page.locator('[data-testid="bw-image-target"]:visible, [data-testid="bw-pixel-more-toggle"]:visible').first().waitFor({state:'visible'});const main=page.getByTestId('bw-image-target');if(await main.isVisible())await main.selectOption(id);else{const toggle=page.getByTestId('bw-pixel-more-toggle');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await page.getByTestId('bw-image-target-pixel').selectOption(id);}};
const paint=async()=>{
 const before=await artwork();await page.getByRole('tab',{name:/Costumes|Backdrops/,exact:true}).click();await chooseTarget(before.target);
 if(!(await page.getByTestId('bw-pixel-canvas').isVisible()))await page.getByTestId('bw-pixel-toggle').click();
 const canvas=page.getByTestId('bw-pixel-canvas');await canvas.waitFor({state:'visible'});
 await page.waitForFunction(palette=>{const c=document.querySelector('[data-testid="bw-pixel-canvas"]');if(!c?.width||!c?.height)return false;const ctx=c.getContext('2d');return [[0,0,1],[1,1,2]].every(([x,y,color])=>{const rgba=ctx.getImageData(Math.floor(c.width*(x+.5)/2),Math.floor(c.height*(y+.5)/2),1,1).data;const rgb=palette[color].slice(1).match(/../g).map(v=>parseInt(v,16));return rgb.every((v,i)=>rgba[i]===v)&&rgba[3]===255;});},ARCADE_PALETTE,{timeout:15000});
 for(const[x,y,color]of [[0,0,3],[1,1,4]]){await (await pixelControl(page, `bw-pixel-colour-${color}`)).click();await page.getByTestId('bw-pixel-tool-pencil').click();await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();assert.ok(box);await canvas.click({position:{x:box.width*(x+.5)/2,y:box.height*(y+.5)/2}});}
 await page.getByTestId('bw-pixel-save').click();await page.waitForFunction(({target,assetId})=>{const t=window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetById(target);return t.getCostumes()[t.currentCostume].assetId!==assetId;},before);
 const after=await artwork();assert.equal(after.format,'svg');const decoded=svgToPixels(after.svg);assert.equal(decoded.width,2);assert.equal(decoded.height,2);assert.equal(decoded.scale,4);assert.deepEqual(Array.from(decoded.pixels),[3,0,0,4]);
 report.artwork={before:{...before,svg:undefined},after:{...after,svg:undefined},svgSHA256:sha(after.svg),pixels:Array.from(decoded.pixels)};await chooseTarget(before.owner);report.journeys.push('actual Pixel canvas pointer strokes and save create current canonical SVG3/0/0/4');
};
const blockPaint=async(from,to)=>{
 await page.getByRole('tab',{name:'Blocks',exact:true}).click();await editor().waitFor({state:'hidden'});
 const locate=()=>page.evaluate(from=>{const ws=window.Blockly?.getMainWorkspace();const rows=ws?.getAllBlocks(false).filter(b=>b.type==='arcade_setImagePixel'&&String(b.getInputTargetBlock('COLOR')?.getFieldValue('NUM'))===String(from));if(rows?.length!==1)throw Error('Missing unique visible Image COLOR numeric field');const field=rows[0].getInputTargetBlock('COLOR').getField('NUM'),r=field.getSvgRoot().getBoundingClientRect();const svg=ws.getParentSvg().getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:rows[0].id,left:svg.left+ws.getMetrics().absoluteLeft,right:svg.right,top:svg.top};},from);
 let position=await locate();const center={x:(position.left+position.right)/2,y:position.top+160};await page.mouse.move(center.x,center.y);await page.mouse.wheel(position.x-center.x,position.y-center.y);
 await page.waitForFunction(id=>{const block=window.Blockly.getMainWorkspace().getBlockById(id),field=block?.getInputTargetBlock('COLOR')?.getField('NUM'),r=field?.getSvgRoot().getBoundingClientRect();return !!r&&block.getSvgRoot().contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},position.id);position=await locate();
 // A missing/unreachable field is an authoring gap, not permission to setFieldValue.
 assert.ok(position.x>0&&position.y>0&&position.x<1600&&position.y<1100,'Image Number field must be visibly reachable without a state workaround');await page.mouse.dblclick(position.x,position.y);const input=page.locator('.blocklyHtmlInput:visible');await input.waitFor();await input.fill(String(to));await input.press('Enter');await page.locator('.blocklyHtmlInput').waitFor({state:'hidden'});
 await page.waitForFunction(({id,to})=>String(window.Blockly.getMainWorkspace().getBlockById(id)?.getInputTargetBlock('COLOR')?.getFieldValue('NUM'))===String(to),{id:position.id,to});report.journeys.push(`visible Blocks COLOR edit ${from} to ${to}`);
};
let deadlineTimer,deadlineExpired=false;
const journey=async()=>{
 browser=await chromium.launch(process.env.BW_BROWSER?{executablePath:process.env.BW_BROWSER,timeout:15000}:{timeout:15000});
 page=await fresh();await codeTab();await page.getByTestId('bw-device-select').selectOption('arcade');await loaded();await open(sourceFile);await play('qualified-source',expected(7,1));await consoleRoundtrip(19);
 await codePaint(7,6);await play('Code-edit',expected(6,1));await paint();await play('Pixel-edit',expected(6,3));
 await blockPaint(6,5);await play('Blocks-edit',expected(5,3));await blockPaint(5,7);await play('restored-qualified-current-state',expected(7,3));
 await codeTab();await page.getByRole('button',{name:/From blocks/}).first().click();await page.getByText('Read the current project into all languages.',{exact:false}).first().waitFor();await openCodeActions(page);
 const[download]=await Promise.all([page.waitForEvent('download'),page.getByTestId('bw-makecode-arcade-export').click()]);const exportedPath=path.join(out,'owned-image-current.mkcd');await download.saveAs(exportedPath);const exported=await fs.readFile(exportedPath),returned=await readMakeCodeProjectText(exported.toString('utf8'),'mkcd');assert.deepEqual(returned.files,qualifiedExport,'Actual visible authoring must reproduce the exact already qualified current export');report.export={bytes:exported.length,sha256:sha(exported),files:returned.files};
 await page.getByText('File',{exact:true}).first().click();const[saved]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).click()]);const sb3=path.join(out,'owned-image.sb3');await saved.saveAs(sb3);const zip=await JSZip.loadAsync(await fs.readFile(sb3));assert.ok(zip.file('project.json'));assert.ok(zip.file('brickwright/artwork/v1.json'));report.sb3={sha256:sha(await fs.readFile(sb3))};
 await page.context().close();page=await fresh();await page.getByText('File',{exact:true}).first().click();const chooser=page.waitForEvent('filechooser');await page.getByText('Load from your computer',{exact:true}).click();await(await chooser).setFiles(sb3);await page.waitForFunction(()=>{const vm=window.__brickwrightStore.getState().scratchGui.vm;return typeof vm.runtime._primitives.arcade_declareCallable==='function'&&vm.runtime.targets.some(t=>Object.values(t.blocks._blocks).some(b=>b.opcode==='arcade_frameImage'))&&vm.runtime.targets.some(t=>Object.values(t.variables).some(v=>v.name==='imageLiteralCalls'));});await play('fresh-SB3',expected(7,3));await consoleRoundtrip(23);const reopened=await artwork();assert.deepEqual(Array.from(svgToPixels(reopened.svg).pixels),[3,0,0,4]);await open(exportedPath);await play('current-export-reimport',expected(7,3));
 await Promise.all(responses);assert.deepEqual(report.bundleFailures||[],[]);assert.ok(report.bundleObservations.length);assert.deepEqual(report.pageErrors,[]);await page.screenshot({path:path.join(out,'owned-image-final.png')});report.status='passed';
};
const boundedCleanup=async(operation,milliseconds)=>{let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned Image GUI cleanup deadline exceeded')),milliseconds);})]);}finally{clearTimeout(timer);}};
try{
 await Promise.race([journey(),new Promise((_,reject)=>{deadlineTimer=setTimeout(()=>{deadlineExpired=true;reject(new Error('Owned Image GUI journey exceeded its 180-second deadline'));},180000);})]);
}catch(error){report.status='failed';report.failure=String(error.stack||error);if(page){report.body=await boundedCleanup(page.evaluate(()=>document.body.innerText),3000).catch(e=>String(e));await page.screenshot({path:path.join(out,'failure.png'),timeout:5000}).catch(()=>{});}throw error;
}finally{
 clearTimeout(deadlineTimer);
 try{if(browser)await boundedCleanup(browser.close(),5000);}catch(error){report.cleanupFailure=String(error);report.status='failed';process.exitCode=1;}
 try{await boundedCleanup(Promise.allSettled(responses),3000);}catch(error){report.responseCleanupFailure=String(error);report.status='failed';process.exitCode=1;}
 if(deadlineExpired)report.status='failed';
 await fs.writeFile(path.join(out,'current.json'),JSON.stringify(report,null,2)+'\n');
}
