#!/usr/bin/env node
import {pixelControl} from './lib-pixel-controls.mjs';
/** Full production IDE journey. All edits use actual user controls; VM/Blockly
 * access observes only. The original compiler/simulator is a separate oracle.
 * No substitute VM, component proxy, private corpus input or local GUI build.
 */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {openCodeActions, openCodeInfo} from './lib-code-actions.mjs';
import {waitForArcadeStageFrame} from './lib/arcade-stage-frame.mjs';
import {makeCodeProjectFile, readMakeCodeProjectText} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';
import {svgToPixels} from '../overlay/scratch-gui/src/lib/bw-makecode/pixel-image.js';
import {runPxtArcade} from '../test/helpers/pxt-arcade-runtime.mjs';
import {ownedGameFiles, withRetainedTextSprite, INITIAL_SAMPLE, PRESSED_SAMPLE, RESET_SAMPLE} from '../test/fixtures/arcade-owned-text-game.mjs';

const base = process.env.PROOF_URL || process.env.BW_BASE_URL;
if (!base) throw new Error('PROOF_URL must name the freshly built full GUI.');
const out = path.resolve(process.env.BW_OWNED_GAME_REPORT_DIR || 'test-results/arcade-owned-game-gui');
await mkdir(out, {recursive: true});
const report = {status: 'running', source: process.env.GITHUB_SHA || null, journeys: [], native: [],
    original: [], pageErrors: [], blockErrors: [], boundary: 'Owned four-pixel-square art, TextSprite and A/B game; no arbitrary-game promotion or dedicated TextSprite inspector claim.'};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch(process.env.BW_BROWSER ? {executablePath: process.env.BW_BROWSER} : {});
let page;
const expected = (message, pixel, pressed = 0) => ({ready: 1, pressed,
    labelText: pressed ? 'GO1' : message, heroX: pressed ? 48 : 40, heroPixel: pixel});
const normalized = record => Object.fromEntries(Object.entries(record).map(([name, value]) => [name.replace(/^Game_/, ''), value]));
const observe = () => page.evaluate(() => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const variables = Object.fromEntries(vm.runtime.targets.filter(target => target.isOriginal)
        .flatMap(target => Object.values(target.variables)).map(variable => [variable.name.replace(/^Game_/, ''), variable.value]));
    return Object.fromEntries(['ready', 'pressed', 'labelText', 'heroX', 'heroPixel'].map(name => [name, variables[name]]));
});
const waitSample = sample => page.waitForFunction(sample => {
    const variables = Object.fromEntries(window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
        .filter(target => target.isOriginal).flatMap(target => Object.values(target.variables))
        .map(variable => [variable.name.replace(/^Game_/, ''), variable.value]));
    return Object.entries(sample).every(([name, value]) => variables[name] === value);
}, sample, {timeout: 20000});
const editor = () => page.getByTestId('bw-code-editor').locator('.cm-content');
const codeTab = async () => {
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await editor().waitFor({state: 'visible'});
};
const readCode = () => editor().evaluate(element => element.cmTile.root.view.state.doc.toString());
const applyBlocks = async () => {
    const prior = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage().id);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    await page.waitForFunction(id => {
        // loadProject removes the old stage before installing the new one.
        const next=window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id;
        return Boolean(next && next !== id);
    },
        prior, {timeout: 30000});
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({state: 'visible'});
    await page.waitForFunction(() => {
        const button = document.querySelector('button[title^="Compile this"]');
        return button && !button.disabled;
    });
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    await editor().waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.Blockly?.getMainWorkspace()?.getAllBlocks(false)
        .some(block => block.type === 'arcade_textSpriteCreate'));
};
const freshPage = async () => {
    const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
    const tab = await context.newPage();
    tab.on('dialog', dialog => dialog.accept());
    tab.on('pageerror', error => report.pageErrors.push(error.message));
    await tab.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await tab.goto(base, {waitUntil: 'domcontentloaded', timeout: 90000});
    await tab.waitForFunction(() => !!window.__brickwrightStore?.getState()?.scratchGui?.vm, null, {timeout: 60000});
    await tab.evaluate(() => {
        window.__bwOwnedGameErrors = [];
        window.__brickwrightStore.getState().scratchGui.vm.runtime.on('BLOCKS_ERROR', error =>
            window.__bwOwnedGameErrors.push(String(error)));
    });
    return tab;
};
const openFile = async file => {
    await codeTab(); await openCodeActions(page);
    await page.getByTestId('bw-open-file').locator('input[type=file]').setInputFiles(file);
    await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Imported the Arcade game/}).waitFor({state: 'visible', timeout: 60000});
    assert.doesNotMatch(await page.getByTestId('bw-code-status').innerText(), /unsupported|not translated|could not|partial/i);
    await page.getByRole('button', {name: 'Close Code help'}).click();
    assert.doesNotMatch(await readCode(), /# unsupported:/);
};
// The real renderer must present the expected complete frame. No fixed sleep
// or forced renderer draw substitutes for the visible production presentation.
const waitFrame = async original => {
    await page.getByTitle('Scratch Stage', {exact: true}).click();
    return waitForArcadeStageFrame(page, original);
};
const oracle = async (files, sample, pressed = false) => {
    const result = await runPxtArcade(withRetainedTextSprite(files), {
        buttonActions: {afterGlobals: normalized({ready: 1}), steps: pressed ? [
            {button: 5, held: true, delay: 80}, {button: 5, held: false, delay: 80}
        ] : []}, waitForGlobals: sample, inspectDisplay: true, waitForDisplay: true
    });
    const values = normalized(result);
    for (const [name, value] of Object.entries(sample)) assert.equal(values[name], value, `original ${name}`);
    report.original.push({sample, screenSha256: digest(Buffer.from(Uint32Array.from(result.$display.screen).buffer)),
        updates: result.$display.updatesAfterReady});
    return result.$display.screen;
};
const cycle = async (label, message, pixel, originalFiles) => {
    if (!await page.getByTestId('bw-arcade-a').isVisible()) await page.getByTitle('Game Console', {exact: true}).click();
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    const initial = expected(message, pixel); await waitSample(initial);
    const initialFrame = await waitFrame(await oracle(originalFiles, initial));
    await page.getByTitle('Game Console', {exact: true}).click();
    await page.getByTestId('bw-arcade-a').click();
    const pressed = expected(message, pixel, 1); await waitSample(pressed);
    const pressedFrame = await waitFrame(await oracle(originalFiles, pressed, true));
    await page.getByTitle('Game Console', {exact: true}).click();
    await page.getByTestId('bw-arcade-b').click();
    await waitSample(expected('RESET', pixel));
    report.native.push({label, initial, pressed, reset: await observe(),
        initialScreenSha256: digest(Buffer.from(Uint32Array.from(initialFrame).buffer)),
        pressedScreenSha256: digest(Buffer.from(Uint32Array.from(pressedFrame).buffer))});
    const errors = await page.evaluate(() => window.__bwOwnedGameErrors);
    assert.deepEqual(errors, []); report.journeys.push(`${label}: green flag, visible A/B and matching original label/art presentation`);
};
const stop = () => page.getByTitle('Stop', {exact: true}).first().click();

try {
    const files = ownedGameFiles();
    const fixture = path.join(out, 'owned-label-game.mkcd');
    await writeFile(fixture, makeCodeProjectFile(files, {target: 'arcade'}));
    report.fixtureSha256 = digest(await readFile(fixture));
    page = await freshPage();
    await codeTab();
    await page.getByTestId('bw-device-select').selectOption('arcade');
    report.bundleScripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
    await openFile(fixture);
    assert.match(await readCode(), /arcade create text sprite/);
    await applyBlocks(); await cycle('imported-game', 'READY', 7, files); await stop();

    // Edit the native source using CodeMirror's normal keyboard input.
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"] .cm-content')
        ?.cmTile.root.view.state.doc.toString().includes('arcade create text sprite'));
    const source = await readCode(); assert.match(source, /"READY"/);
    await editor().click(); await page.keyboard.press('Control+a');
    await page.keyboard.insertText(source.replace('"READY"', '"START"'));
    await applyBlocks();

    // Blockly only supplies the field's coordinates; the user click/input edits it.
    const field = await page.evaluate(() => {
        const workspace = window.Blockly.getMainWorkspace();
        const block = workspace.getAllBlocks(false).find(block => block.type === 'arcade_textSpriteCreate');
        const shadow = block.getInputTargetBlock('TEXT'); const field = shadow.getField('TEXT');
        const rect = field.getSvgRoot().getBoundingClientRect(), svg = workspace.getParentSvg().getBoundingClientRect();
        return {id: shadow.id, value: field.getValue(), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
            left: svg.left + workspace.getMetrics().absoluteLeft, right: svg.right, top: svg.top, bottom: svg.bottom};
    });
    assert.equal(field.value, 'START');
    const center = {x: (field.left + field.right) / 2, y: field.top + 150};
    await page.mouse.move(center.x, center.y); await page.mouse.wheel(field.x - center.x, field.y - center.y);
    await page.waitForFunction(id => {
        const workspace = window.Blockly.getMainWorkspace(), block = workspace.getBlockById(id);
        const field = block.getField('TEXT'), rect = field.getSvgRoot().getBoundingClientRect();
        return block.getSvgRoot().contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }, field.id);
    const point = await page.evaluate(id => {
        const rect = window.Blockly.getMainWorkspace().getBlockById(id).getField('TEXT').getSvgRoot().getBoundingClientRect();
        return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
    }, field.id);
    await page.mouse.click(point.x, point.y);
    const input = page.locator('input.blocklyHtmlInput'); await input.waitFor({state: 'visible'});
    await input.fill('PLAY'); await input.press('Enter');
    await page.waitForFunction(id => window.Blockly.getMainWorkspace().getBlockById(id).getFieldValue('TEXT') === 'PLAY', field.id);
    report.journeys.push('Code keyboard edit READY→START and visible Blocks field edit START→PLAY');

    // The Game Console occupies the target pane. Use the visible Stage action
    // before choosing artwork, just as a user returning from play would.
    await page.getByTitle('Scratch Stage', {exact: true}).click();
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
        .some(target => target.isOriginal && target.getName() === 'hero' && target.getCostumes().length > 0));
    const artwork = await page.evaluate(() => {
        const targets = window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.filter(target => target.isOriginal);
        const hero = targets.find(target => target.getName() === 'hero');
        return {targets: targets.map(target => ({name: target.getName(),
            costumes: target.getCostumes().map(costume => ({name: costume.name, assetId: costume.assetId}))})),
        svg: hero.getCostumes()[0].asset.decodeText()};
    });
    const heroPixels = svgToPixels(artwork.svg);
    assert.ok(heroPixels, 'the original hero artwork survived the Code and Blocks edits');
    assert.equal(heroPixels.width, 4); assert.equal(heroPixels.height, 4); assert.equal(heroPixels.pixels[5], 7);
    report.artworkBeforePaint = {targets: artwork.targets, svgSha256: digest(Buffer.from(artwork.svg)),
        width: heroPixels.width, height: heroPixels.height, pixel: heroPixels.pixels[5]};
    const heroSelector = page.locator('[class*="sprite-selector-item_sprite-selector-item"]').filter({hasText: 'hero'}).first();
    await heroSelector.waitFor({state: 'visible'});
    report.journeys.push('Visible Scratch Stage action restores the sprite pane; original hero artwork remains after Code and Blocks edits');

    // Select the real imported sprite and paint its actual imported costume.
    await heroSelector.click();
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getName() === 'hero');
    await page.getByRole('tab', {name: /Costumes/, exact: true}).click();
    if (!await page.getByTestId('bw-pixel-canvas').isVisible()) await page.getByTestId('bw-pixel-toggle').click();
    const canvas = page.getByTestId('bw-pixel-canvas'); await canvas.waitFor({state: 'visible'});
    // Selecting a costume can precede its async decoder. Observe this actual
    // four-pixel source before drawing, so an old/default canvas cannot pass.
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="bw-pixel-canvas"]');
        if (!canvas?.width || !canvas.getClientRects().length) return false;
        const context = canvas.getContext('2d');
        const data = context.getImageData(Math.floor(canvas.width * .375), Math.floor(canvas.height * .375), 1, 1).data;
        return data[0] === 0x78 && data[1] === 0xdc && data[2] === 0x52;
    });
    await (await pixelControl(page, 'bw-pixel-colour-3')).click(); await page.getByTestId('bw-pixel-tool-pencil').click();
    const box = await canvas.boundingBox();
    await canvas.click({position: {x: box.width * 1.5 / 4, y: box.height * 1.5 / 4}});
    const previousAsset = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getCostumes()[0].assetId);
    await page.getByTestId('bw-pixel-save').click();
    await page.waitForFunction(id => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getCostumes()[0].assetId !== id, previousAsset);
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    const editedFiles = ownedGameFiles({message: 'PLAY', edited: true});
    await cycle('authored-blocks-and-costume', 'PLAY', 3, editedFiles); await stop();
    report.journeys.push('Costumes Pixel pencil edit changes a real runtime sprite pixel');

    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Save to your computer', {exact: true}).click()]);
    const archive = path.join(out, 'owned-label-game.sb3'); await download.saveAs(archive);
    const bytes = await readFile(archive); const zip = await JSZip.loadAsync(bytes);
    const project = JSON.parse(await zip.file('project.json').async('text'));
    const hero = project.targets.find(target => target.name === 'hero'); assert.ok(hero);
    const costume = hero.costumes[0], image = svgToPixels(await zip.file(costume.md5ext).async('text'));
    assert.equal(image.width, 4); assert.equal(image.height, 4); assert.equal(image.pixels[5], 3);
    report.sb3 = {bytes: bytes.length, sha256: digest(bytes), heroCostume: costume.md5ext};
    await page.context().close(); page = await freshPage();
    await page.getByText('File', {exact: true}).first().click();
    await page.getByText('Load from your computer', {exact: true}).click();
    await page.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles(archive);
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
        .some(target => target.isOriginal && target.getName() === 'hero'));
    await page.waitForFunction(() => typeof window.__brickwrightStore.getState().scratchGui.vm.runtime
        ._primitives.arcade_textSpriteCreate === 'function');
    await cycle('fresh-GUI-SB3-reopen', 'PLAY', 3, editedFiles); await stop();

    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"] .cm-content')
        ?.cmTile.root.view.state.doc.toString().includes('arcade create text sprite'));
    // The previous Code buffer can already contain a text-sprite command while
    // From blocks is still regenerating it. Wait for the actual edited source,
    // then retain the same exact assertion and original export qualification.
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"] .cm-content')
        ?.cmTile.root.view.state.doc.toString().includes('arcade create text sprite text "PLAY"'));
    report.reopenedCode = await readCode(); assert.match(report.reopenedCode, /"PLAY"/);
    await openCodeActions(page);
    const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const exportPath = path.join(out, 'owned-label-game-export.mkcd'); await exported.saveAs(exportPath);
    const exportBytes = await readFile(exportPath); const embedded = await readMakeCodeProjectText(exportBytes.toString('utf8'), 'mkcd');
    assert.equal(embedded.meta.cloudId, 'pxt/arcade');
    report.export = {bytes: exportBytes.length, sha256: digest(exportBytes)};
    await writeFile(path.join(out, 'export-main.ts'), embedded.files['main.ts']);
    await oracle(embedded.files, expected('PLAY', 3)); await oracle(embedded.files, expected('PLAY', 3, 1), true);
    report.journeys.push('actual MakeCode export compiles/runs original TextSprite and matching A action');
    await openFile(exportPath); await applyBlocks();
    await cycle('MakeCode-export-reimport', 'PLAY', 3, editedFiles);
    report.blockErrors = await page.evaluate(() => window.__bwOwnedGameErrors);
    assert.deepEqual(report.blockErrors, []); assert.deepEqual(report.pageErrors, []);
    await page.screenshot({path: path.join(out, 'authored-game.png')});
    report.status = 'passed';
} catch (error) {
    report.status = 'failed'; report.failure = String(error.stack || error);
    if (page) {
        report.failureSample = await observe().catch(error => ({error: String(error)}));
        report.body = (await page.locator('body').innerText()).slice(-14000);
        await page.screenshot({path: path.join(out, 'failure.png')}).catch(() => {});
    }
    throw error;
} finally {
    await writeFile(path.join(out, 'current.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
}
