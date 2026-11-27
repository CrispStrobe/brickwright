// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

const base = process.argv[2];
assert.ok(base, 'Pass a Brickwright build with CAD and FPGA enabled');
const engine = process.env.BW_BROWSER_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({headless: true,
    executablePath: engine === chromium ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-right-pane-hidden', '1');
});

const setting = async label => {
    const settings = page.getByTestId('bw-settings-menu-trigger');
    await settings.click();
    const option = page.getByRole('combobox', {name: label});
    if (!await option.isVisible()) {
        await page.getByRole('menuitem', {name: 'Workspace', exact: true}).press('ArrowRight');
    }
    await option.waitFor();
    return option;
};

try {
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    const cad = page.getByRole('tab', {name: 'CAD', exact: true});
    const fpga = page.getByRole('tab', {name: 'FPGA', exact: true});
    const blocks = page.getByRole('tab', {name: 'Blocks', exact: true});
    await blocks.waitFor();
    assert.equal(await cad.count(), 0);
    assert.equal(await fpga.count(), 0);

    const cadOption = await setting('CAD Editor');
    assert.equal(await cadOption.inputValue(), '0');
    await cadOption.selectOption('1');
    await cad.click();
    const cadTools = page.locator('.command-menu summary:visible').first();
    await cadTools.waitFor();

    const fpgaOption = await setting(/FPGA lab/);
    assert.equal(await fpgaOption.inputValue(), '0');
    await fpgaOption.selectOption('1');
    await fpga.waitFor();
    await cadTools.waitFor();
    assert.equal(await cad.getAttribute('aria-selected'), 'true', 'enabling FPGA keeps CAD selected');
    await fpga.click();
    await page.getByTestId('bw-fpga-workspace-design').waitFor();

    // Optional editor preferences persist across a normal reload.
    await page.reload({waitUntil: 'domcontentloaded'});
    await cad.waitFor();
    await fpga.waitFor();
    await blocks.click();
    for (const [name, id, poster, inset] of [
        ['CAD models', 'cadlab', 'cad-models.webp', 'cad-cube.svg'],
        ['CAD shapes', 'cadshapes', 'cad-shapes.webp', 'cad-shapes-mark.svg']
    ]) {
        await page.getByTitle('Add Extension', {exact: true}).click();
        const title = page.getByText(name, {exact: true});
        const card = title.locator('xpath=../..');
        const illustration = card.locator(`img[src$="/${poster}"]`);
        const badge = card.locator(`img[src$="/${inset}"]`);
        const assets = await Promise.all([illustration, badge].map(image => image.evaluate(async el => {
            await el.decode();
            const rect = el.getBoundingClientRect();
            return {width: el.naturalWidth, height: el.naturalHeight, renderedWidth: rect.width};
        })));
        assert.ok(assets[0].width > 400 && assets[0].width > assets[0].height && assets[0].renderedWidth > 160, name);
        assert.ok(assets[1].width > 0 && assets[1].height > 0 && assets[1].renderedWidth > 0 &&
            assets[1].renderedWidth < assets[0].renderedWidth / 2, `${name} inset`);
        await title.click();
        await page.waitForFunction(extension => window.__brickwrightStore?.getState().scratchGui.vm
            .extensionManager.isExtensionLoaded(extension), id);
    }

    await fpga.click();
    await (await setting(/FPGA lab/)).selectOption('0');
    await fpga.waitFor({state: 'hidden'});
    assert.equal(await page.getByRole('tab', {name: /Circuit/}).getAttribute('aria-selected'), 'true');
    await cad.click();
    await (await setting('CAD Editor')).selectOption('0');
    await cad.waitFor({state: 'hidden'});
    assert.equal(await page.getByRole('tab', {name: 'Robots', exact: true}).getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()} CAD gallery assets, extension loading, and Workspace CAD/FPGA toggles`);
} finally {
    await browser.close();
}
