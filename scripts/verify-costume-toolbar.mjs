// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1435, height: 850}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(45000);
try {
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
        localStorage.removeItem('bw-costume-precision');
    });
    await page.goto(process.argv[2], {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Costumes', exact: true}).click();
    const workspace = page.getByTestId('bw-paint-workspace');
    const toolbar = page.getByTestId('bw-paint-command-row');
    const action = name => toolbar.getByRole('button', {name, exact: true});
    await workspace.waitFor();
    for (const name of ['New Costume', 'Send to CAD', 'Open file…', 'Save file', 'Pixel editor', 'Convert to Bitmap']) {
        const button = action(name);
        await button.waitFor();
        assert.equal(await button.getAttribute('title'), name);
        assert.equal((await button.innerText()).trim(), '', `${name} should be icon-only at this editor width`);
    }
    for (const name of ['Fill', 'Outline']) {
        const button = action(name);
        assert.equal(await button.getAttribute('title'), name);
    }
    const artworkCount = () => page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getCostumes().length);
    const before = await artworkCount();
    await action('New Costume').click();
    await page.waitForFunction(count => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getCostumes().length === count, before + 1);
    await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        vm.updateSvg(vm.editingTarget.currentCostume,
            '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect x="0" y="0" width="40" height="20"/></svg>', 0, 0);
    });
    await action('Send to CAD').click();
    const dialog = page.getByRole('dialog', {name: 'Send to CAD', exact: true});
    await dialog.getByRole('button', {name: 'Add editable sketch', exact: true}).waitFor();
    await dialog.getByRole('button', {name: 'Close', exact: true}).click();
    await dialog.waitFor({state: 'hidden'});
    const stageId = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage().id);
    await page.getByTestId('bw-image-target').selectOption(stageId);
    const newBackdrop = action('New Backdrop');
    await newBackdrop.waitFor();
    const backdrops = await artworkCount();
    await newBackdrop.click();
    await page.waitForFunction(count => {
        const stage = window.__brickwrightStore.getState().scratchGui.vm.editingTarget;
        return stage.isStage && stage.getCostumes().length === count;
    }, backdrops + 1);
    await page.setViewportSize({width: 2050, height: 850});
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-costume-new"]').innerText.includes('New Backdrop'));
    console.log('PASS icon-only toolbar, hover labels, Send to CAD with precision off, new costumes/backdrops, and wide labels');
}finally{
    await browser.close();
}
