#!/usr/bin/env node
import {openCodeActions as openCodeMenu, closeCodeActions as closeCodeMenu, openCodeInfo} from './lib-code-actions.mjs';
import {pixelControl} from './lib-pixel-controls.mjs';
/** Actual Pixel → Code → Blocks → SB3 journey. VM access observes only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import {chromium} from 'playwright';

const base = process.env.BW_BASE_URL || process.env.PROOF_URL || 'http://localhost:8617/';
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] :
    process.env.BW_ARTWORK_REPORT || 'artifacts/code-artwork-browser.json';
await fs.mkdir(path.dirname(out), {recursive: true});
const report = {status: 'running', journey: [], errors: [], consoleErrors: []};
const browser = await chromium.launch(process.env.BW_BROWSER ? {executablePath: process.env.BW_BROWSER} : {});
const page = await browser.newPage({viewport: {width: 1400, height: 1000}, acceptDownloads: true});
page.on('dialog', dialog => dialog.accept());
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') report.consoleErrors.push(message.text());});
const code = () => page.getByRole('tab', {name: 'Code', exact: true});
const editor = () => page.getByTestId('bw-code-editor').locator('.cm-content');
const openCode = async () => {
    await code().click();
    await page.getByTestId('bw-pixel-canvas').waitFor({state: 'hidden'});
    await editor().waitFor({state: 'visible'});
};
const panel = async name => {
    const toggle = page.getByTestId(`bw-pixel-${name}-toggle`);
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
};
const pixels = async () => {
    await page.locator('[role="tab"]', {hasText: /Costume|Kost/}).first().click();
    if (!(await page.getByTestId('bw-pixel-canvas').isVisible())) await page.getByTestId('bw-pixel-toggle').click();
    await page.getByTestId('bw-pixel-canvas').waitFor({state: 'visible'});
};
const paint = async (colour, x, y) => {
    await (await pixelControl(page, `bw-pixel-colour-${colour}`)).click();
    await page.getByTestId('bw-pixel-tool-pencil').click();
    const canvas = page.getByTestId('bw-pixel-canvas');
    const before = await canvas.evaluate(element => element.toDataURL());
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    assert.notEqual(await canvas.evaluate(element => element.toDataURL()), before, 'visible Pixel tool paints');
};
const savePixels = async () => {
    const before = await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        return vm.editingTarget.sprite.costumes[0].asset.assetId;
    });
    await page.getByTestId('bw-pixel-save').click();
    await page.waitForFunction(prior => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        return vm.editingTarget.sprite.costumes[0].asset.assetId !== prior;
    }, before);
};
const archive = async label => {
    await page.getByText('File', {exact: true}).click();
    const pending = page.waitForEvent('download');
    await page.getByText('Save to your computer', {exact: true}).click();
    const download = await pending;
    const file = path.join(path.dirname(out), `code-artwork-${label}.sb3`);
    await download.saveAs(file);
    const zip = await JSZip.loadAsync(await fs.readFile(file));
    const project = JSON.parse(await zip.file('project.json').async('text'));
    const artwork = JSON.parse(await zip.file('brickwright/artwork/v1.json').async('text'));
    const assets = {};
    for (const target of project.targets) {
        for (const costume of target.costumes || []) {
            assets[costume.md5ext] = crypto.createHash('sha256')
                .update(await zip.file(costume.md5ext).async('nodebuffer')).digest('hex');
        }
    }
    return {file, project, artwork, assets};
};
const artworkShape = snapshot => snapshot.project.targets.map(target => ({
    isStage: target.isStage, name: target.name, currentCostume: target.currentCostume,
    costumes: target.costumes.map(costume => Object.fromEntries(['name', 'assetId', 'md5ext', 'dataFormat',
        'bitmapResolution', 'rotationCenterX', 'rotationCenterY'].filter(key => costume[key] !== undefined)
        .map(key => [key, costume[key]])))
}));
const apply = async () => {
    const prior = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.id);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    await page.waitForFunction(id => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const button = document.querySelector('button[title^="Compile this"]');
        return vm.editingTarget?.id !== id && button && !button.disabled;
    }, prior, {timeout: 30000});
    await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Blocks loaded/}).waitFor();
    await page.getByRole('button', {name: 'Close Code help'}).click();
};
try {
    await page.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
    });
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await pixels();
    await panel('layers');
    await page.getByTestId('bw-pixel-add-layer').click();
    await paint(10, 0.42, 0.42);
    await panel('frames');
    await page.getByTestId('bw-pixel-duplicate-frame').click();
    await page.getByTestId('bw-pixel-frame-duration').fill('240');
    await page.getByTestId('bw-pixel-frame-name').fill('Walk');
    await paint(11, 0.61, 0.37);
    await savePixels();
    report.journey.push('authored layers and two-frame animation with visible Pixel controls');
    await openCode();
    await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.getByText('Read the current project into all languages.', {exact: false}).first()
        .waitFor({state: 'visible'});
    const originalCode = await editor().evaluate(element => element.cmTile.root.view.state.doc.toString());
    assert.match(originalCode, /SPRITE /);
    // This second edit occurs after the Code handoff was captured.
    await pixels();
    await paint(3, 0.72, 0.64);
    await savePixels();
    const before = await archive('before');
    const animation = before.artwork.costumes.find(record => record.document.animation);
    assert.equal(animation.document.animation.frames.length, 2);
    assert.equal(animation.document.layers.length, 2);
    await openCode();
    await editor().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(`GLOBAL handoff = 0\n${originalCode.trimEnd()}\n  WHEN flag clicked:\n    set handoff to 17\n`);
    await apply();
    const pane = page.locator('[data-right-pane-toggle]');
    if (await pane.getAttribute('aria-pressed') !== 'true') await pane.click();
    await page.locator('[class*="green-flag_green-flag"]').first().click();
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
        .flatMap(target => Object.values(target.variables)).some(variable => variable.name === 'handoff' && Number(variable.value) === 17));
    const after = await archive('after');
    assert.deepEqual(artworkShape(after), artworkShape(before), 'all sprite/backdrop descriptors remain exact');
    assert.deepEqual(after.assets, before.assets, 'raw asset bytes remain exact, including the edit after From blocks');
    assert.deepEqual(after.artwork, before.artwork, 'palette, layers and frame names/timing remain exact');
    report.journey.push('edited Code executes; To blocks preserves fresh assets and editable source exactly');
    await page.getByText('File', {exact: true}).click();
    await page.getByText('Load from your computer', {exact: true}).click();
    await page.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles(after.file);
    await pixels();
    await panel('frames');
    assert.equal(await page.getByTestId('bw-pixel-frame-name').inputValue(), 'Walk');
    assert.equal(await page.getByTestId('bw-pixel-frame-duration').inputValue(), '240');
    assert.equal(await page.getByTestId('bw-pixel-frame-1').count(), 1);
    const reopened = await archive('reopened');
    assert.deepEqual(reopened.assets, after.assets);
    assert.deepEqual(reopened.artwork, after.artwork);
    report.journey.push('actual SB3 save/reopen retains editable animation and exact artwork');
    await openCode();
    const actions = page.getByTestId('bw-code-actions');
    await openCodeMenu(page);
    await page.getByTestId('bw-open-file').locator('input[type=file]').setInputFiles({name: 'unrelated.bw',
        mimeType: 'text/plain', buffer: Buffer.from('SPRITE Sprite1:\n  WHEN flag clicked:\n    say "new project"\n')});
    await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Loaded unrelated/}).waitFor();
    await page.getByRole('button', {name: 'Close Code help'}).click();
    await closeCodeMenu(page);
    await apply();
    const unrelated = await archive('unrelated');
    assert.ok(!unrelated.artwork.costumes.some(record => record.document.animation),
        'a new unrelated source file cannot inherit the old animation');
    assert.notDeepEqual(unrelated.assets, before.assets);
    report.journey.push('new unrelated source file does not inherit prior artwork');
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.consoleErrors.filter(message => /Workspace Update Error|could not attach artwork|could not repack artwork/.test(message)), []);
    report.assetHashes = before.assets;
    report.costumes = artworkShape(before);
    report.status = 'passed';
} catch (error) {
    report.status = 'failed'; report.failure = error.stack || String(error);
    report.runtime = await page.evaluate(() => {
        const state = window.__brickwrightStore?.getState()?.scratchGui;
        const runtime = state?.vm?.runtime;
        return {device: runtime?.bwDeviceId, stcDevice: runtime?.stc?.device,
            stepping: Boolean(runtime?._steppingInterval), status: state?.vmStatus,
            threads: runtime?.threads.map(thread => ({status: thread.status, stack: thread.stack})),
            targets: runtime?.targets.map(target => ({name: target.getName(), id: target.id,
                variables: Object.values(target.variables),
                scripts: Object.values(target.blocks._blocks).filter(block => block.topLevel)}))};
    }).catch(error => ({error: String(error)}));
    report.body = (await page.locator('body').innerText()).slice(-10000);
    await page.screenshot({path: out.replace(/\.json$/, '') + '-failure.png'}).catch(() => {});
    throw error;
} finally {
    await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    console.log(JSON.stringify({status: report.status, journeys: report.journey.length}));
}
