// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of a built Brickwright app.');
const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?
        {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})
});
try {
    const page = await browser.newPage({viewport: {width: 920, height: 840}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(45_000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '1');
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const openTab = name => page.getByRole('tab', {name, exact: true}).click();
    const blocksTools = page.getByTestId('bw-blocks-actions-trigger');
    await blocksTools.click();
    const blocksMenu = page.getByRole('group', {name: 'More Blocks controls'});
    await blocksMenu.getByRole('button', {name: 'Zoom in'}).click();
    await blocksTools.click();
    await blocksMenu.getByRole('button', {name: 'Read Blocks into Code'}).click();
    await page.getByTestId('bw-code-status').filter({hasText: /read into all languages/i}).waitFor();
    const openCodeMenu = () => page.getByTestId('bw-code-actions-trigger').click();
    await openCodeMenu();
    const codeMenu = page.getByTestId('bw-code-actions-menu');
    await codeMenu.getByRole('button', {name: /To blocks/i}).waitFor();
    await codeMenu.getByRole('button', {name: /From blocks/i}).waitFor();
    assert.equal(await page.getByTestId('bw-open-spike-arena').count(), 0);
    await codeMenu.getByRole('button', {name: /About the Code tab/i}).click();
    await page.locator('[data-code-help]').waitFor();
    assert.equal(await page.locator('[data-code-help]').count(), 1);
    await openCodeMenu();
    const device = codeMenu.getByTestId('bw-device-select-menu');
    assert.equal(await device.locator('optgroup[label="Intel 8049"] option').getAttribute('value'), 'kosmos-cp1');
    await device.selectOption('z80');
    await codeMenu.getByTestId('bw-catalog-toggle').click();
    const catalog = page.getByTestId('bw-catalog-panel');
    await page.locator('[data-catalog="ready"][data-device="z80"]').waitFor();
    const eligible = await catalog.getByTestId('bw-catalog-item').evaluateAll(items => items.map(item => item.title));
    assert.ok(eligible.includes('z80-pd-bench'), 'The Z80 catalog should include authored Z80 examples');
    assert.ok(!eligible.includes('eeprom-start-counter'), 'The Z80 catalog should exclude the I²C EEPROM counter');
    assert.equal(await catalog.locator('[data-testid="bw-catalog-device"]').count(), 0);
    await catalog.getByRole('button', {name: 'Open full examples library'}).click();
    const fullCatalog = page.getByRole('dialog', {name: 'Examples library'});
    await fullCatalog.waitFor();
    const fullBox = await fullCatalog.boundingBox();
    assert.ok(fullBox.width >= 860 && fullBox.height >= 780);
    assert.deepEqual(await fullCatalog.getByTestId('bw-catalog-item').evaluateAll(items => items.map(item => item.title)), eligible);
    await fullCatalog.getByRole('button', {name: 'Close', exact: true}).click();
    await fullCatalog.waitFor({state: 'hidden'});
    await openTab('Circuit');
    await page.locator('[data-toolbar-more]:visible button').first().click();
    const circuitMenu = page.locator('[data-toolbar-more-menu]:visible');
    for (const label of ['Designer', 'Circuit Check', 'Parts list', 'Examples', 'Realistic view', 'Schematic view', 'Board view']) {
        await circuitMenu.getByRole('menuitemradio', {name: new RegExp(label, 'i')}).waitFor();
    }
    await circuitMenu.getByRole('menuitemradio', {name: 'Examples'}).click();
    await circuitMenu.waitFor({state: 'hidden'});
    console.log('Blocks commands, Code commands and help, matched examples, fullscreen library and Circuit commands passed.');
} finally {
    await browser.close();
}
