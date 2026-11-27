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
import {repeatAuthoringFiles, repeatSample, editRepeatDelayCode} from '../test/fixtures/arcade-controller-repeat-authoring-game.mjs';

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
const out = path.resolve(process.env.BW_REPEAT_GUI_REPORT_DIR || 'test-results/arcade-controller-repeat-authoring-gui');
await mkdir(out, {recursive: true});
const report = {status: 'running', source, sourceTool: inspected.tool, receipt, journeys: [], samples: [], original: [], pageErrors: [], bundleObservations: [],
    boundary: 'Owned fixed controller repeat-property authoring only. Host timing is observed, never offset; counts saturate by authored source for stable image comparison. Button aliases, menu/start/select, all corpus games and hardware remain outside this journey. Script preparation is not GUI qualification.'};
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
    await tab.evaluate(() => { window.__bwRepeatErrors = []; window.__brickwrightStore.getState().scratchGui.vm.runtime.on('BLOCKS_ERROR', error => window.__bwRepeatErrors.push(String(error))); });
    return tab;
};
const apply = async () => {
    const prior = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    await page.waitForFunction(id => { const next = window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id; return Boolean(next && next !== id); }, prior);
    await page.getByText('Blocks loaded.', {exact: true}).waitFor();
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    await page.waitForFunction(() => window.Blockly?.getMainWorkspace()?.getAllBlocks(false).some(block => block.type === 'arcade_setButtonRepeatProperty'));
};
const openFile = async file => {
    await codeTab(); await openCodeActions(page);
    await page.getByTestId('bw-open-file').locator('input[type=file]').setInputFiles(file);
    await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Imported the Arcade game/}).waitFor({timeout: 60000});
    assert.doesNotMatch(await page.getByTestId('bw-code-status').innerText(), /unsupported|not translated|could not|partial/i);
    await page.getByRole('button', {name: 'Close Code help'}).click();
    assert.doesNotMatch(await readCode(), /# unsupported:/);
};
const fieldInfo = spec => page.evaluate(({opcode, input, value, blockId, player, property}) => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.getAllBlocks(false).find(block => block.type === opcode && (!blockId || block.id===blockId) && (!player || block.getFieldValue('PLAYER')===player) && (!property || block.getFieldValue('PROPERTY')===property) && (value === undefined || String(block.getFieldValue(input)) === value || block.getInputTargetBlock(input)?.getDescendants(false).some(node => node.inputList.flatMap(i => i.fieldRow).some(f => String(f.getValue()) === value))));
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
const editNumber = async (spec, value) => {
    const field = await reachField(spec); await page.mouse.click(field.x, field.y);
    const input = page.locator('input.blocklyHtmlInput'); await input.waitFor({state: 'visible'}); await input.fill(String(value)); await input.press('Enter');
    await input.waitFor({state: 'hidden'});
    await page.waitForFunction(({id, name, value}) => String(window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue(name)) === value, {...field, value: String(value)});
};
const editMenu = async (spec, choice, required) => {
    const field = await reachField(spec); await page.mouse.click(field.x, field.y);
    const items = page.getByRole('menuitemcheckbox'); await items.first().waitFor({state: 'visible'});
    const labels = await items.allTextContents(); for (const text of required) assert.ok(labels.includes(text), `${text} is a real visible choice`);
    await page.getByRole('menuitemcheckbox', {name: choice, exact: true}).click();
    await items.first().waitFor({state: 'hidden'});
    await page.waitForFunction(({id, name, choice}) => window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue(name) === choice, {...field, choice});
    report.journeys.push({action: 'visible dropdown edit', opcode: spec.opcode, choice, labels});return field.id;
};
const observe = () => page.evaluate(() => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const variables = Object.fromEntries(vm.runtime.targets.filter(t => t.isOriginal).flatMap(t => Object.values(t.variables)).map(v => [v.name.replace(/^(?:Game_)+/, ''), v.value]));
    return {variables, errors: window.__bwRepeatErrors};
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
const original = async (files, options, held) => {
    const sample = repeatSample({...options, held});
    const source = files['main.ts'];
    const actualName = key => new RegExp(`\\b(?:let|var|const)\\s+((?:Game_)*${key})\\b`).exec(source)?.[1] || key;
    const actualSample = Object.fromEntries(Object.entries(sample).map(([key, value]) => [actualName(key), value]));
    const sequence = (button, count, released) => [
        {button, held: true, waitForGlobals: {[actualName(count)]: 2}},
        {button, held: false, waitForGlobals: {[actualName(released)]: 1}},
        {button, held: true, waitForGlobals: {[actualName(count)]: 4}},
        {button, held: false, waitForGlobals: {[actualName(released)]: 2}}
    ];
    const result = await runPxtArcade(files, {buttonActions: {afterGlobals: {[actualName('ready')]: 1},
        steps: held ? [...sequence(5, 'first', 'firstReleased'), ...sequence(13, 'second', 'secondReleased')] : []},
        waitForGlobals: actualSample, inspectDisplay: true, waitForDisplay: true});
    const globals = Object.fromEntries(Object.entries(result).map(([key, value]) => [key.replace(/^(?:Game_)+/, ''), value]));
    for (const [key, value] of Object.entries(sample)) assert.equal(globals[key], value, `original ${key}`);
    report.original.push({sample, screenSha256: digest(Buffer.from(Uint32Array.from(result.$display.screen).buffer))}); return result.$display.screen;
};
const holdButton = async (player, button, variable, releasedVariable) => {
    await page.getByTestId('bw-arcade-player').selectOption(String(player));
    const locator=page.getByTestId(`bw-arcade-${button}`),rect=await locator.boundingBox();
    assert.ok(rect,'Actual controller-pane button is visible');
    // Hold until an authored callback observation, never a guessed host sleep.
    const waitCount=count=>page.waitForFunction(({key,count})=>{
        const vars=window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.filter(t=>t.isOriginal).flatMap(t=>Object.values(t.variables));
        return vars.some(v=>v.name.replace(/^(?:Game_)+/,'')===key && v.value===count);
    },{key:variable,count});
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
    await waitCount(2);await page.mouse.up();await waitSample({[releasedVariable]:1});
    await page.mouse.down();await waitCount(4);await page.mouse.up();await waitSample({[releasedVariable]:2});
    report.journeys.push({action:'Actual controller pane hold/release/repress',player,button});
};
const cycle = async (label, options, files) => {
    if (!await page.getByTestId('bw-arcade-a').isVisible()) await page.getByTitle('Game Console',{exact:true}).click();
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    await waitSample(repeatSample(options));
    const initial=await observe();assert.deepEqual(initial.errors,[]);
    const initialFrame=await compareFrame(await original(files,options,false));
    await page.getByTitle('Game Console',{exact:true}).click();
    await holdButton(1,'a','first','firstReleased');await holdButton(2,'b','second','secondReleased');
    await waitSample(repeatSample({...options,held:true}));
    const held=await observe();assert.deepEqual(held.errors,[]);
    const heldFrame=await compareFrame(await original(files,options,true));
    report.samples.push({label,initial,held,initialFrame,heldFrame});
    await page.getByTitle('Stop',{exact:true}).first().click();
};
const paletteCreate = async () => {
    await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.bwButtonCallbacks.ARCADE_PALETTE_controller()); // setButtonRepeatProperty is a hidden "show more" block
    await page.locator('.scratchCategoryId-arcade').click();
    let point;
    for (let attempt = 0; attempt < 80; attempt++) {
        point = await page.evaluate(() => {
            const flyout = window.Blockly.getMainWorkspace().getFlyout().getWorkspace(), block = flyout.getAllBlocks(false).find(b => b.type === 'arcade_setButtonRepeatProperty');
            const rect = block?.getSvgRoot().getBoundingClientRect(); return rect && {x: rect.x + 40, y: rect.y + rect.height / 2};
        });
        assert.ok(point, 'New repeat-property command is present in actual Arcade flyout');
        if (point.y > 130 && point.y < 900) break;
        await page.mouse.move(220, 500); await page.mouse.wheel(0, point.y > 900 ? 450 : -450);
        await page.waitForFunction(previousY => {
            const flyout = window.Blockly.getMainWorkspace().getFlyout().getWorkspace();
            const block = flyout.getAllBlocks(false).find(value => value.type === 'arcade_setButtonRepeatProperty');
            const rect = block?.getSvgRoot().getBoundingClientRect();
            return Boolean(rect && rect.y !== previousY);
        }, point.y);
    }
    assert.ok(point.y > 130 && point.y < 900, 'Repeat property is reachable by real palette scrolling');
    const before = await page.evaluate(() => window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b => b.type === 'arcade_setButtonRepeatProperty').map(b => b.id));
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(700, 350, {steps: 20}); await page.mouse.up();
    await page.waitForFunction(ids => window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b => b.type === 'arcade_setButtonRepeatProperty').some(b => !ids.includes(b.id)), before);
    // Remove the selected orphan through the normal keyboard to keep the game executable.
    await page.keyboard.press('Delete');
    await page.waitForFunction(ids => window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b => b.type === 'arcade_setButtonRepeatProperty').every(b => ids.includes(b.id)), before);
    report.journeys.push('Real Arcade palette scroll, repeat-property drag into workspace, keyboard delete');
};
try {
    const files=repeatAuthoringFiles(),fixture=path.join(out,'repeat-authoring.mkcd');
    await writeFile(fixture,makeCodeProjectFile(files,{target:'arcade'}));report.fixtureSha256=digest(await readFile(fixture));
    page=await fresh();await codeTab();await page.getByTestId('bw-device-select').selectOption('arcade');
    // Retargeting loads a new project asynchronously. Wait for its visible
    // completion before opening a file owned by that new stage.
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwDeviceId === 'arcade' && document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled === false);
    await openFile(fixture); await apply();
    const types=await page.evaluate(()=>window.Blockly.getMainWorkspace().getAllBlocks(false).map(b=>b.type));
    for(const opcode of ['arcade_buttonRepeatProperty','arcade_setButtonRepeatProperty','arcade_setButtonRepeatDefaults'])assert.ok(types.includes(opcode),`${opcode} is a real imported block`);
    await cycle('unchanged-import',{},files);await paletteCreate();
    // Actual fixed menus, including all advertised public roles, are reachable.
    const delayBlockId=await editMenu({opcode:'arcade_setButtonRepeatProperty',input:'PLAYER',value:'1',property:'repeatDelay'},'2',['1','2','3','4']);
    await editMenu({opcode:'arcade_setButtonRepeatProperty',input:'PLAYER',value:'2',blockId:delayBlockId},'1',['1','2','3','4']);
    await editMenu({opcode:'arcade_setButtonRepeatProperty',input:'BUTTON',value:'A',blockId:delayBlockId},'B',['A','B','up','down','left','right']);
    await editMenu({opcode:'arcade_setButtonRepeatProperty',input:'BUTTON',value:'B',blockId:delayBlockId},'A',['A','B','up','down','left','right']);
    // Scratch Blocks factors the shared unit suffix out of static options.
    // Verify both the visible unit and the actual canonical field choices.
    const prop=await reachField({opcode:'arcade_setButtonRepeatProperty',input:'PROPERTY',value:'repeatDelay',blockId:delayBlockId});
    await page.mouse.click(prop.x,prop.y);const choices=page.getByRole('menuitemcheckbox');await choices.first().waitFor({state:'visible'});
    assert.deepEqual(await choices.allTextContents(),['delay','interval']);
    const propertyDisplay=await page.evaluate(({id,name})=>{
        const block=window.Blockly.getMainWorkspace().getBlockById(id);
        return {suffix:block.getField(name).suffixField,text:block.getSvgRoot().textContent};
    },prop);
    assert.equal(propertyDisplay.suffix,'(ms)');
    assert.match(propertyDisplay.text,/\(ms\)/,'property block keeps the visible millisecond unit');
    await page.getByRole('menuitemcheckbox',{name:'interval',exact:true}).click();
    await page.waitForFunction(id=>window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue('PROPERTY')==='repeatInterval',delayBlockId);
    const back=await reachField({opcode:'arcade_setButtonRepeatProperty',input:'PROPERTY',value:'repeatInterval',blockId:delayBlockId});
    await page.mouse.click(back.x,back.y);await page.getByRole('menuitemcheckbox',{name:'delay',exact:true}).click();
    await page.waitForFunction(id=>window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue('PROPERTY')==='repeatDelay',delayBlockId);
    await editNumber({opcode:'arcade_setButtonRepeatProperty',input:'VALUE',value:'60',blockId:delayBlockId},40);
    await editNumber({opcode:'arcade_setButtonRepeatProperty',input:'VALUE',value:'20',player:'1',property:'repeatInterval'},30);
    const edited={delay:40,interval:30};await cycle('visible-block-edits',edited,repeatAuthoringFiles(edited));
    await codeTab();await page.getByRole('button',{name:/From blocks/}).first().click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString().includes('repeat property'));
    const code=await readCode();report.codeFromBlocks=code;
    assert.match(code,/repeat property repeatDelay to .*40/);assert.match(code,/repeat property repeatInterval to .*30/);
    // Change the actual property command and every saved-default copy in visible Code.
    await editor().click();await page.keyboard.press('Control+a');const editedCode=editRepeatDelayCode(code);report.editedCode=editedCode;await page.keyboard.insertText(editedCode);
    assert.equal(await readCode(),editedCode);await apply();
    const finalOptions={delay:60,interval:30},finalFiles=repeatAuthoringFiles(finalOptions);
    await cycle('Code-to-Blocks',finalOptions,finalFiles);
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Save to your computer', {exact: true}).click()]);
    const archive = path.join(out, 'repeat-authoring.sb3'); await download.saveAs(archive);
    const bytes = await readFile(archive), zip = await JSZip.loadAsync(bytes); assert.ok(zip.file('project.json')); report.sb3 = {sha256: digest(bytes), bytes: bytes.length};
    await page.context().close(); page = await fresh(); await page.getByText('File', {exact: true}).first().click();
    const chooser = page.waitForEvent('filechooser'); await page.getByText('Load from your computer', {exact: true}).click(); await (await chooser).setFiles(archive);
    await page.waitForFunction(() => typeof window.__brickwrightStore.getState().scratchGui.vm.runtime._primitives.arcade_setButtonRepeatProperty === 'function');
    await cycle('fresh-SB3-reopen', finalOptions, finalFiles);
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => {
        const code = document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString();
        return Boolean(code && code.includes('repeat property') && code.includes('repeatDelay'));
    });
    await openCodeActions(page);
    const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const exportedPath = path.join(out, 'repeat-authoring-export.mkcd'); await exported.saveAs(exportedPath);
    const exportedBytes = await readFile(exportedPath), embedded = await readMakeCodeProjectText(exportedBytes.toString('utf8'), 'mkcd');
    report.export = {sha256: digest(exportedBytes), bytes: exportedBytes.length};
    await original(embedded.files, finalOptions, false); await original(embedded.files, finalOptions, true);
    await openFile(exportedPath); await apply(); await cycle('actual-export-reimport', finalOptions, embedded.files);
    await Promise.all(bodyChecks); assert.deepEqual(report.bundleFailures || [], []); assert.ok(report.bundleObservations.length); assert.deepEqual(report.pageErrors, []);
    await page.screenshot({path: path.join(out, 'repeat-authoring.png')}); report.status = 'passed';
} catch (error) {
    report.status = 'failed'; report.failure = String(error.stack || error);
    if (page) { report.failureSample = await observe().catch(e => ({error: String(e)})); report.body = (await page.evaluate(() => document.body?.innerText || '').catch(e => `Body observation failed: ${String(e)}`)).slice(-14000); await page.screenshot({path: path.join(out, 'failure.png')}).catch(() => {}); }
    throw error;
} finally {
    await Promise.allSettled(bodyChecks); await writeFile(path.join(out, 'current.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close();
}
