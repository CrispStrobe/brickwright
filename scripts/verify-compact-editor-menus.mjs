// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of a built Brickwright app.');
const engine = process.env.BW_BROWSER_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({
    ...(engine === chromium && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?
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
    const infoButton = page.getByTestId('bw-code-info');
    const help = page.getByTestId('bw-code-info-popover');
    const unread = page.getByTestId('bw-code-info-count');
    const notices = help.locator('[data-code-notice]');
    await unread.waitFor();
    assert.equal(await page.getByText(/Editable Pseudocode source/).count(), 0);
    assert.equal(await page.getByTestId('bw-code-status').count(), 0);
    const openCodeMenu = () => page.getByTestId('bw-code-actions-trigger').click();
    await openCodeMenu();
    const codeMenu = page.getByTestId('bw-code-actions-menu');
    await codeMenu.getByRole('button', {name: /To blocks/i}).waitFor();
    await codeMenu.getByRole('button', {name: /From blocks/i}).waitFor();
    assert.equal(await page.getByTestId('bw-open-spike-arena').count(), 0);
    await codeMenu.getByRole('button', {name: /About the Code tab/i}).click();
    await help.waitFor();
    await help.getByText(/Editable Pseudocode source/).waitFor();
    await help.getByText(/To blocks converts the active editor/).waitFor();
    await help.getByText(/read .*all languages/i).waitFor();
    await unread.waitFor({state: 'hidden'});
    await help.getByRole('button', {name: 'Clear all notices'}).click();
    assert.equal(await notices.count(), 0);
    await help.getByRole('button', {name: 'Close Code help'}).click();
    await help.waitFor({state: 'hidden'});
    await typeIntoEditor(page, 'THIS IS NOT A SCRATCH INSTRUCTION');
    await openCodeMenu();
    await codeMenu.getByRole('button', {name: /To blocks/i}).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-info-count"]')?.textContent === '2');
    assert.equal(await page.getByTestId('bw-conversion-report').count(), 0);
    await infoButton.click();
    await help.getByTestId('bw-conversion-preserved').filter({hasText: /conversion failed/}).waitFor();
    assert.equal(await notices.count(), 2);
    await notices.first().getByRole('button', {name: 'Dismiss notice'}).click();
    assert.equal(await notices.count(), 1);
    await help.getByRole('button', {name: 'Clear all notices'}).click();
    assert.equal(await notices.count(), 0);
    await page.keyboard.press('Escape');
    await help.waitFor({state: 'hidden'});
    await openCodeMenu();
    await codeMenu.getByRole('button', {name: 'Open debugger'}).click();
    await page.waitForFunction(() => localStorage.getItem('bw-debug-dock') === 'right');
    await openCodeMenu();
    await codeMenu.getByTestId('bw-load-example').selectOption('twinwall');
    await page.waitForFunction(() => localStorage.getItem('bw-debug-dock') === 'off' &&
        localStorage.getItem('bw-right-pane-hidden') === '0');
    await page.locator('[class*="stage-canvas-wrapper"] canvas').first().waitFor();
    assert.equal(await page.locator('[data-right-pane] [data-debug-panel]:visible').count(), 0);
    await openCodeMenu();
    await codeMenu.locator('summary', {hasText: 'Languages'}).click();
    const languages = codeMenu.locator('details').filter({has: page.locator('summary', {hasText: 'Languages'})});
    for (const name of ['Pseudocode', 'Python', 'Tcl', 'Forth', 'CP1', 'CARDIAC']) {
        await languages.getByRole('button', {name, exact: true}).waitFor();
    }
    assert.equal(await languages.locator('button svg').count(), 0);
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
    const mac = await browser.newPage({viewport: {width: 920, height: 840}, locale: 'en-US'});
    mac.setDefaultTimeout(45_000);
    await mac.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', {value: 'MacIntel'});
        window.__TAURI__ = {};
        localStorage.setItem('bw-starter-v1-complete', '1');
    });
    await mac.goto(url, {waitUntil: 'domcontentloaded'});
    await mac.getByRole('tab', {name: 'Code', exact: true}).click();
    await mac.getByTestId('bw-code-actions-trigger').click();
    const macMenu = mac.getByTestId('bw-code-actions-menu');
    const machineRow = macMenu.locator('[data-code-machine-select]').filter({
        has: mac.getByTestId('bw-device-picker-trigger-menu')
    });
    const icon = await machineRow.locator('svg').boundingBox();
    const machineButton = machineRow.getByTestId('bw-device-picker-trigger-menu');
    const label = await machineButton.boundingBox();
    assert.ok(icon.x + icon.width <= label.x);
    assert.ok(icon.y + icon.height / 2 >= label.y && icon.y + icon.height / 2 <= label.y + label.height);
    await machineButton.click();
    const picker = mac.getByTestId('bw-mac-device-menu');
    await picker.waitFor();
    const box = await picker.boundingBox();
    await mac.mouse.click(box.x + 2, box.y + 2);
    assert.equal(await picker.isVisible(), true);
    await mac.mouse.click(3, 3);
    await picker.waitFor({state: 'hidden'});
    console.log('Code notices, Scratch Stage routing, menu rows, Mac backdrop dismissal, examples and Circuit commands passed.');
} finally {
    await browser.close();
}
