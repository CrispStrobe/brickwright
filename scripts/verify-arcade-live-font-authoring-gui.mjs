#!/usr/bin/env node
// Actual full IDE controls only. Blockly/VM access observes, never mutates.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {openCodeActions, openCodeInfo} from './lib-code-actions.mjs';
import {waitForArcadeStageFrame} from './lib/arcade-stage-frame.mjs';
import {inspectGuiHarnessSource} from './lib/gui-harness-source.mjs';
import {inspectGuiArtifactResponse} from './lib/gui-artifact-response.mjs';
import {makeCodeProjectFile, readMakeCodeProjectText} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';
import {runPxtArcade} from '../test/helpers/pxt-arcade-runtime.mjs';
import {fontAuthoringFiles, fontAuthoringSample, fontOriginalSample} from '../test/fixtures/arcade-live-font-authoring-game.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const base = process.env.PROOF_URL;
assert.ok(base, 'PROOF_URL must identify the admitted full production build');
assert.ok(process.env.BW_GUI_BUILD_RECEIPT, 'An admitted exact-source official build receipt is required');
assert.ok(process.env.BW_GUI_BUILD_ARCHIVE, 'The sole already acquired official archive is required');
const receipt = JSON.parse(await readFile(process.env.BW_GUI_BUILD_RECEIPT, 'utf8'));
const inspected = inspectGuiHarnessSource({root, executable: process.env.BW_GUI_GIT_EXECUTABLE});
const source = inspected.sourceSha;
const pins = JSON.parse(await readFile(path.join(root, 'vendor-pins.json'), 'utf8'));
assert.equal(receipt.sourceSha, source, 'Harness and admitted build must use the exact reviewed source');
assert.equal(receipt.producerSha, pins['sb3-creator']);
assert.equal(receipt.arraysValuesSha, pins['arrays-values']);
assert.equal(receipt.sdk.version, '4.2.1');
assert.equal(receipt.sdk.pxtVersion, '13.2.1');
assert.equal(receipt.sdk.targetCommit, '2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea');
const sdkRoot = path.join(root, 'packages/scratch-gui/static/makecode/arcade');
const targetBytes = await readFile(path.join(sdkRoot, 'target.json'));
const sdkVersions = JSON.parse(targetBytes).versions;
assert.equal(sdkVersions.target, receipt.sdk.version);
assert.equal(sdkVersions.pxt, receipt.sdk.pxtVersion);
assert.equal(sdkVersions.commits, `https://github.com/microsoft/pxt-arcade/commits/${receipt.sdk.targetCommit}`);
assert.equal(digest(targetBytes), receipt.sdk.targetSha256, 'Original comparison SDK target must match admitted production SDK');
assert.equal(digest(await readFile(path.join(sdkRoot, 'pxtworker.js'))), receipt.sdk.workerSha256);
assert.equal(receipt.build.conclusion, 'success');
assert.equal(receipt.build.checkoutSha, source);
for (const key of ['runId', 'jobId', 'artifactId']) assert.match(String(receipt.build[key]), /^\d+$/);
assert.equal(receipt.build.runUrl, `https://github.com/CrispStrobe/brickwright-lite/actions/runs/${receipt.build.runId}`);
assert.equal(digest(await readFile(process.env.BW_GUI_BUILD_ARCHIVE)), receipt.build.archiveSha256);
assert.ok(Object.keys(receipt.assets).length, 'Receipt must inventory the actual extracted build assets');
for (const name of Object.keys(receipt.assets)) assert.ok(Number.isSafeInteger(receipt.assetBytes?.[name]) && receipt.assetBytes[name] >= 0, `Receipt must inventory original extracted asset length ${name}`);
const out = path.resolve(process.env.BW_FONT_GUI_REPORT_DIR || 'test-results/arcade-live-font-authoring-gui');
await mkdir(out, {recursive: true});
const report = {status: 'running', source, sourceTool: inspected.tool, receipt, journeys: [], samples: [], original: [], pageErrors: [], bundleObservations: [],
    boundary: 'Owned live font metric authoring only. Full rendered frames and fixed-field edits are observed through actual IDE controls. Aliased/custom/dynamic/writable font objects and physical cadence remain outside this qualification. Script preparation is not GUI qualification.'};
const browser = await chromium.launch(process.env.BW_BROWSER ? {executablePath: process.env.BW_BROWSER} : {});
let page;
const bodyChecks = [];
const editor = () => page.getByTestId('bw-code-editor').locator('.cm-content');
const codeTab = async () => { await page.getByRole('tab', {name: 'Code', exact: true}).click(); await editor().waitFor({state: 'visible'}); };
const readCode = () => editor().evaluate(element => element.cmTile.root.view.state.doc.toString());
const fresh = async () => {
    const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
    const tab = await context.newPage();
    tab.on('dialog', dialog => dialog.accept());
    tab.on('pageerror', error => report.pageErrors.push(error.message));
    tab.on('response', response => {
        const url = new URL(response.url()), prefix = new URL(base);
        if (url.origin !== prefix.origin || !(/\.js$/.test(url.pathname) || /\/makecode\/arcade\/target\.json$/.test(url.pathname))) return;
        bodyChecks.push((async () => {
            const name = decodeURIComponent(url.pathname.slice(prefix.pathname.endsWith('/') ? prefix.pathname.length : prefix.pathname.lastIndexOf('/') + 1));
            const observed = await inspectGuiArtifactResponse(response, {name, sha256: receipt.assets[name], bytes: receipt.assetBytes[name]});
            if (observed.method === 'HEAD') (report.bundleHeaders ||= []).push(observed);
            else report.bundleObservations.push(observed);
        })().catch(error => { (report.bundleFailures ||= []).push(String(error)); }));
    });
    await tab.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1'); localStorage.setItem('bw-right-pane-hidden', '0'); });
    await tab.goto(base, {waitUntil: 'domcontentloaded', timeout: 90000});
    await tab.waitForFunction(() => !!window.__brickwrightStore?.getState()?.scratchGui?.vm, null, {timeout: 60000});
    await tab.evaluate(() => { window.__bwFontErrors = []; window.__brickwrightStore.getState().scratchGui.vm.runtime.on('BLOCKS_ERROR', error => window.__bwFontErrors.push(String(error))); });
    return tab;
};
const apply = async () => {
    const prior = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    await page.waitForFunction(id => { const next = window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id; return Boolean(next && next !== id); }, prior);
    await page.getByText('Blocks loaded.', {exact: true}).waitFor();
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    await page.waitForFunction(() => window.Blockly?.getMainWorkspace()?.getAllBlocks(false).some(block => block.type === 'arcade_fontMetric'));
};
const openFile = async file => {
    await codeTab(); await openCodeActions(page);
    await page.getByTestId('bw-open-file').locator('input[type=file]').setInputFiles(file);
    await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Imported the Arcade game/}).waitFor({timeout: 60000});
    assert.doesNotMatch(await page.getByTestId('bw-code-status').innerText(), /unsupported|not translated|could not|partial/i);
    await page.getByRole('button', {name: 'Close Code help'}).click();
    assert.doesNotMatch(await readCode(), /# unsupported:/);
};
const fieldInfo = spec => page.evaluate(({opcode, input, value, id, otherFields={}}) => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.getAllBlocks(false).find(block => block.type === opcode && (!id || block.id===id) && Object.entries(otherFields).every(([name,wanted])=>String(block.getFieldValue(name))===wanted) && (value === undefined || String(block.getFieldValue(input)) === value || block.getInputTargetBlock(input)?.getDescendants(false).some(node => node.inputList.flatMap(i => i.fieldRow).some(f => String(f.getValue()) === value))));
    const child = block?.getInputTargetBlock(input);
    // Fixed native menus live on the command/reporter itself; accepting menus
    // live on its connected shadow. Edit the real field in either case.
    const direct = block?.getField(input);
    const candidates = direct ? [{node: block, field: direct}] : [];
    const walk = node => { if (!node) return; for (const input of node.inputList) for (const field of input.fieldRow) if (field.name) candidates.push({node, field}); for (const next of node.getChildren(false)) walk(next); };
    walk(child);
    const selected = candidates.find(({field}) => value === undefined || String(field.getValue()) === value);
    const field = selected?.field;
    if (!field) throw new Error(`Missing ${opcode}.${input} field`);
    const rect = field.getSvgRoot().getBoundingClientRect(), svg = workspace.getParentSvg().getBoundingClientRect();
    return {id: selected.node.id, name: field.name, value: field.getValue(), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, left: svg.left + workspace.getMetrics().absoluteLeft, right: svg.right, top: svg.top};
}, spec);
const reachField = async spec => {
    const field = await fieldInfo(spec), center = {x: (field.left + field.right) / 2, y: field.top + 160};
    await page.mouse.move(center.x, center.y); await page.mouse.wheel(field.x - center.x, field.y - center.y);
    await page.waitForFunction(({id, name}) => {
        const block = window.Blockly.getMainWorkspace().getBlockById(id), field = block?.getField(name), rect = field?.getSvgRoot().getBoundingClientRect();
        return Boolean(rect && block.getSvgRoot().contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)));
    }, field);
    return fieldInfo(spec);
};
const editMenu = async (spec, choice, required) => {
    const field = await reachField(spec); await page.mouse.click(field.x, field.y);
    const items = page.getByRole('menuitemcheckbox'); await items.first().waitFor({state: 'visible'});
    const labels = await items.allTextContents(); for (const text of required) assert.ok(labels.includes(text), `${text} is a real visible choice`);
    await page.getByRole('menuitemcheckbox', {name: choice, exact: true}).click();
    await items.first().waitFor({state: 'hidden'});
    await page.waitForFunction(({id, name, choice}) => window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue(name) === choice, {...field, choice});
    report.journeys.push({action: 'visible dropdown edit', opcode: spec.opcode, choice, labels});
};
const observe = () => page.evaluate(() => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const variables = Object.fromEntries(vm.runtime.targets.filter(t => t.isOriginal).flatMap(t => Object.values(t.variables)).map(v => [v.name.replace(/^(?:Game_)+/, ''), v.value]));
    return {variables, errors: window.__bwFontErrors};
});
const waitSample = sample => page.waitForFunction(sample => {
    const variables = Object.fromEntries(window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.filter(t => t.isOriginal).flatMap(t => Object.values(t.variables)).map(v => [v.name.replace(/^(?:Game_)+/, ''), v.value]));
    return Object.entries(sample).every(([key, value]) => variables[key] === value);
}, sample);
const compareFrame = async original => {
    await page.getByTitle('Scratch Stage', {exact: true}).click();
    const pixels = await waitForArcadeStageFrame(page, original);
    return digest(Buffer.from(Uint32Array.from(pixels).buffer));
};
const originals=new Map();
const original=async(files,variant)=>{
 const key=digest(Buffer.from(JSON.stringify(files))),sample=fontAuthoringSample(variant);
 if(originals.has(key))return originals.get(key);
 const expected=fontOriginalSample(files,variant);
 const result=await runPxtArcade(files,{waitForGlobals:expected,inspectDisplay:true,waitForDisplay:true,onCompilation:async value=>{await writeFile(path.join(out,key+'-compilation.json'),JSON.stringify(value));}});
 for(const[name,value]of Object.entries(expected))assert.equal(result[name],value,'original '+name);
 const screen=result.$display.screen;assert.equal(screen.length,19200);report.original.push({variant,inputSha256:key,screenSha256:digest(Buffer.from(Uint32Array.from(screen).buffer))});await writeFile(path.join(out,key+'-original-result.json'),JSON.stringify(result));originals.set(key,screen);return screen;
};
const cycle=async(label,variant,files)=>{
 await page.locator('[class*="green-flag_green-flag"]:visible').first().click();await waitSample(fontAuthoringSample(variant));
 const sample=await observe();assert.deepEqual(sample.errors,[]);const frame=await compareFrame(await original(files,variant));report.samples.push({label,variant,sample,frame});await page.getByTitle('Stop',{exact:true}).first().click();
};
try{
 const files=fontAuthoringFiles(),fixture=path.join(out,'font-authoring.mkcd');await writeFile(fixture,makeCodeProjectFile(files,{target:'arcade'}));report.fixtureSha256=digest(await readFile(fixture));
 page=await fresh();await codeTab();await page.getByTestId('bw-device-select').selectOption('arcade');
    // Retargeting loads a new project asynchronously. Wait for its visible
    // completion before opening a file owned by that new stage.
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwDeviceId === 'arcade' && document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled === false);
    await openFile(fixture); await apply();
 const schema=await page.evaluate(()=>window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b=>b.type==='arcade_fontMetric').map(b=>({id:b.id,FONT:b.getFieldValue('FONT'),PROPERTY:b.getFieldValue('PROPERTY'),fontInput:!!b.getInput('FONT')?.connection,propertyInput:!!b.getInput('PROPERTY')?.connection})));
 assert.equal(schema.length,6);for(const item of schema){assert.equal(item.fontInput,false);assert.equal(item.propertyInput,false);}report.fieldSchema=schema;
 await cycle('unchanged-import','baseline',files);
 const selected=await fieldInfo({opcode:'arcade_fontMetric',input:'FONT',value:'font5',otherFields:{PROPERTY:'charHeight'}});
 await editMenu({opcode:'arcade_fontMetric',input:'FONT',id:selected.id,value:'font5'},'font8',['font5','font8','font12']);
 await editMenu({opcode:'arcade_fontMetric',input:'PROPERTY',id:selected.id,value:'charHeight'},'charWidth',['charWidth','charHeight']);
 await cycle('visible-field-edits','blocks',fontAuthoringFiles('blocks'));
 await codeTab();await page.getByRole('button',{name:/From blocks/}).first().click();await page.waitForFunction(()=>document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString().includes('set h5 to (arcade font "font8" metric "charWidth")'));
 const code=await readCode();report.codeFromBlocks=code;const needle='set h5 to (arcade font "font8" metric "charWidth")';assert.equal(code.split(needle).length,2);
 const edited=code.replace(needle,'set h5 to (arcade font "font8" metric "charHeight")');await editor().click();await page.keyboard.press('Control+a');await page.keyboard.insertText(edited);assert.equal(await readCode(),edited);report.editedCode=edited;await apply();await cycle('visible-Code-to-Blocks','code',fontAuthoringFiles('code'));
 await page.getByText('File',{exact:true}).first().click();const[download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save to your computer',{exact:true}).click()]);const archive=path.join(out,'font-authoring.sb3');await download.saveAs(archive);const bytes=await readFile(archive),zip=await JSZip.loadAsync(bytes);assert.ok(zip.file('project.json'));report.sb3={sha256:digest(bytes),bytes:bytes.length};
 await page.context().close();page=await fresh();await page.getByText('File',{exact:true}).first().click();const chooser=page.waitForEvent('filechooser');await page.getByText('Load from your computer',{exact:true}).click();await(await chooser).setFiles(archive);await page.waitForFunction(()=>typeof window.__brickwrightStore.getState().scratchGui.vm.runtime._primitives.arcade_fontMetric==='function');await cycle('fresh-SB3-reopen','code',fontAuthoringFiles('code'));
 await codeTab();await page.getByRole('button',{name:/From blocks/}).first().click();await page.waitForFunction(()=>document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString().includes('set h5 to (arcade font "font8" metric "charHeight")'));
 await openCodeActions(page);const[exported]=await Promise.all([page.waitForEvent('download'),page.getByTestId('bw-makecode-arcade-export').click()]);const exportedPath=path.join(out,'font-authoring-export.mkcd');await exported.saveAs(exportedPath);const exportedBytes=await readFile(exportedPath),embedded=await readMakeCodeProjectText(exportedBytes.toString('utf8'),'mkcd');report.export={sha256:digest(exportedBytes),bytes:exportedBytes.length};await original(embedded.files,'code');await openFile(exportedPath);await apply();await cycle('actual-export-reimport','code',embedded.files);
 await Promise.all(bodyChecks);assert.deepEqual(report.bundleFailures||[],[]);assert.ok(report.bundleObservations.length);assert.deepEqual(report.pageErrors,[]);await page.screenshot({path:path.join(out,'font-authoring.png')});report.status='passed';
}catch(error){report.status='failed';report.failure=String(error.stack||error);if(page){report.failureSample=await observe().catch(e=>({error:String(e)}));report.body=(await page.evaluate(() => document.body?.innerText || '').catch(e => `Body observation failed: ${String(e)}`)).slice(-14000);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}throw error;
}finally{await Promise.allSettled(bodyChecks);await writeFile(path.join(out,'current.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
