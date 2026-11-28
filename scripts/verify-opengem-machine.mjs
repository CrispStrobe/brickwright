// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const [url, media] = process.argv.slice(2);
assert.ok(url && media, 'Pass the built app URL and the official FreeDOS 1.4 ZIP or 120m/x86BOOT.img.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(120000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
const manager = page.getByTestId('bw-machine-manager');
const canvas = page.getByTestId('bw-machine-canvas');

function hasDesktop (menuOpen) {
    const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (canvas?.width !== 640 || canvas.height !== 480) return false;
    const context = canvas.getContext('2d');
    const ink = (x, y, width, height) => {
        const {data} = context.getImageData(x, y, width, height);
        let count = 0;
        for (let offset = 0; offset < data.length; offset += 4) {
            if (data[offset] < 80 && data[offset + 1] < 80 && data[offset + 2] < 80) count++;
        }
        return count;
    };
    // Menu captions and the A: icon distinguish the desktop from startup frames.
    const menuCaptions = ink(10, 0, 172, 16);
    const floppyIcon = ink(552, 26, 79, 33);
    const dropdown = ink(20, 21, 290, 95);
    const diskContents = ink(45, 355, 480, 76);
    return menuCaptions >= 110 && menuCaptions < 1500 && floppyIcon >= 90 && floppyIcon < 900 && diskContents > 350 &&
        (menuOpen ? menuCaptions > 650 && dropdown > 170 : dropdown < 50);
}

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    const row = manager.locator('[data-machine-media="opengem"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    await row.getByTestId('bw-mm-item-info').click();
    assert.equal(await row.getByRole('link', {name: 'GPL-2.0-or-later'}).count(), 1);
    assert.equal(await row.getByRole('link', {name: 'CuteMouse'}).count(), 1);
    await row.getByTestId('bw-mm-freedos-guest-media').setInputFiles(media);
    await run.click();
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    await page.waitForFunction(hasDesktop, false, {polling: 250});
    const startNs = await page.evaluate(() => Number(window.__benchTarget.timeNs()));
    await page.waitForFunction(start => Number(window.__benchTarget.timeNs()) >= start + 7_000_000_000, startNs);
    console.log('OpenGEM booted to its 640 × 480 desktop in Controller.');

    const bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.move(bounds.x + 18, bounds.y + 30, {steps: 30});
    await page.waitForFunction(hasDesktop, true, {polling: 100, timeout: 15000});
    console.log('Controller mouse movement opened a guest desktop menu.');

    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    await page.getByTestId('bw-machine-console').getByRole('button', {name: 'Save image', exact: true}).waitFor();
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(errors, await manager.allTextContents());
    if (process.env.OPENGEM_FAILURE_SCREEN && await canvas.isVisible()) {
        await canvas.screenshot({path: process.env.OPENGEM_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
