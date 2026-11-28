// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const [url, boot, archive] = process.argv.slice(2);
assert.ok(url && boot && archive, 'Pass the Brickwright URL, FreeDOS Floppy Edition ZIP or 120m/x86BOOT.img, and swauth.zip.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(60000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
const archiveRequests = [];
page.on('request', request => {
    if (request.url().includes('swauth.zip')) archiveRequests.push(request.url());
});
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
const manager = page.getByTestId('bw-machine-manager');
const canvas = page.getByTestId('bw-machine-canvas');

function playerVisible (inAir) {
    const display = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (display?.width !== 320 || display.height !== 200) return false;
    const context = display.getContext('2d');
    // The novice camera keeps the plane centred while the landscape scrolls.
    const {data} = context.getImageData(150, 50, 20, 85);
    let colour = 0, first = 135, last = 0;
    for (let index = 0; index < data.length; index += 4) {
        const [r, g, b] = data.subarray(index, index + 3);
        if (Math.max(r, g, b) - Math.min(r, g, b) < 65) continue;
        const row = 50 + Math.floor(index / 80);
        first = Math.min(first, row);
        last = Math.max(last, row);
        colour++;
    }
    const minimapBorder = context.getImageData(250, 181, 1, 1).data[0];
    return minimapBorder > 160 && colour > 30 && last - first < 17 &&
        (inAir ? last < 118 : first >= 124);
}

function landscapeChanged (previous) {
    const display = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (display?.width !== 320 || display.height !== 200) return false;
    const data = display.getContext('2d').getImageData(0, 115, 145, 64).data;
    return data.some((byte, index) => byte !== previous[index]);
}

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption('i8086');
    const row = manager.locator('[data-machine-media="sopwith-dos"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    await row.getByTestId('bw-mm-freedos-guest-media').setInputFiles(boot);
    assert.ok(await run.isDisabled());
    const game = row.getByTestId('bw-mm-freedos-guest-package');
    await game.setInputFiles({name: 'wrong.zip', mimeType: 'application/zip', buffer: Buffer.alloc(41262)});
    await run.click();
    await manager.getByText(/The Sopwith ZIP checksum differs/).waitFor();
    await game.setInputFiles(archive);
    await run.click();
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    await page.waitForFunction(playerVisible, false, {polling: 200, timeout: 60000});
    await canvas.click();

    const landscape = await canvas.evaluate(display =>
        Array.from(display.getContext('2d').getImageData(0, 115, 145, 64).data));
    await page.keyboard.down('x');
    try {
        await page.waitForFunction(landscapeChanged, landscape, {polling: 100, timeout: 10000});
    } finally {
        await page.keyboard.up('x');
    }
    await page.keyboard.press('Comma', {delay: 130});
    await page.waitForFunction(playerVisible, true, {polling: 100, timeout: 15000});

    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    await page.waitForFunction(() => {
        const display = document.querySelector('[data-testid="bw-machine-canvas"]');
        return display?.width === 320 && display.height === 200;
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(archiveRequests, []);
    console.log('CGA novice flight booted. X made the terrain scroll, comma lifted the plane, and full screen toggled.');
} catch (error) {
    console.error(errors, await manager.allTextContents());
    if (process.env.SOPWITH_FAILURE_SCREEN && await canvas.isVisible()) {
        await canvas.screenshot({path: process.env.SOPWITH_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
