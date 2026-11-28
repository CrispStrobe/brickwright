// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {decodeTextPixels, fixedTextGlyphs} from './lib/i80386-vga-text.mjs';

const [url, bootArchive, gameArchive] = process.argv.slice(2);
assert.ok(url && bootArchive && gameArchive, 'Pass the app URL, official FreeDOS 1.4 ZIP and Zmiy 0.85.2 ZIP.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(120000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
const manager = page.getByTestId('bw-machine-manager');
const canvas = page.getByTestId('bw-machine-canvas');

function snake (minRow) {
    const display = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (display?.width !== 720 || display.height !== 400) return false;
    const pixels = display.getContext('2d').getImageData(0, 0, display.width, display.height).data;
    const cells = [];
    for (let y = 2; y < 22; y++) {
        for (let x = 2; x < 78; x++) {
            const offset = ((y * 16 + 8) * display.width + x * 9 + 4) * 4;
            const [r, g, b] = pixels.subarray(offset, offset + 3);
            if (r > 120 && g > 40 && b < 110) cells.push({x, y});
        }
    }
    return cells.length >= 3 && cells.some(cell => cell.y >= minRow) ? cells : false;
}

function pauseVisible (expected) {
    const display = document.querySelector('[data-testid="bw-machine-canvas"]');
    const {data} = display.getContext('2d').getImageData(245, 110, 230, 85);
    let light = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset] > 120 && data[offset + 1] > 120 && data[offset + 2] > 120) light++;
    }
    return (light > 500) === expected;
}

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption('i8086');
    const row = manager.locator('[data-machine-media="zmiy"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    await row.getByTestId('bw-mm-freedos-guest-media').setInputFiles(bootArchive);
    assert.ok(await run.isDisabled());
    const gameInput = row.getByTestId('bw-mm-freedos-guest-package');
    await gameInput.setInputFiles({name: 'bad.zip', mimeType: 'application/zip', buffer: Buffer.alloc(32424)});
    await run.click();
    await manager.getByText(/The Zmiy ZIP checksum differs/).waitFor();
    await gameInput.setInputFiles(gameArchive);
    await run.click();
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    await canvas.click();

    const initial = await (await page.waitForFunction(snake, 2, {polling: 120})).jsonValue();
    const rowBeforeTurn = Math.max(...initial.map(cell => cell.y));
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(snake, rowBeforeTurn + 1, {polling: 120, timeout: 15000});
    console.log('The 8086 booted Zmiy in CGA mode, and ArrowDown turned the snake.');

    await page.keyboard.press('p');
    await page.waitForFunction(pauseVisible, true, {polling: 150, timeout: 15000});
    const at = await page.evaluate(() => Number(window.__benchTarget.timeNs()));
    await page.waitForFunction(at => Number(window.__benchTarget.timeNs()) >= at + 700_000_000, at);
    await page.keyboard.press('Enter');
    await page.waitForFunction(pauseVisible, false, {polling: 150, timeout: 15000});

    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    await canvas.click();
    await page.keyboard.press('Escape');
    const decoder = decodeTextPixels.toString();
    const glyphs = JSON.stringify(fixedTextGlyphs());
    const dosPrompt = `(() => {
        try {
            const text = (${decoder})(window.__benchTarget.video(), ${glyphs});
            return /Zmiy v0[.]85[.]2/.test(text) && /A:\\\\>/.test(text);
        } catch { return false; }
    })()`;
    await page.waitForFunction(dosPrompt, null, {polling: 250, timeout: 25000});
    assert.deepEqual(errors, []);
    console.log('Pause, resume, full screen and Escape back to the FreeDOS prompt worked.');
} catch (error) {
    console.error(errors, await manager.allTextContents());
    if (process.env.ZMIY_FAILURE_SCREEN && await canvas.isVisible()) {
        await canvas.screenshot({path: process.env.ZMIY_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
