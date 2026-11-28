// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {readXkimFatImage} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-xkim-fat.js';

const [url, floppy, archive] = process.argv.slice(2);
assert.ok(url && floppy && archive, 'Pass the app URL, FreeDOS 1.4 ZIP or 120m/x86BOOT.img, and the uHex ZIP.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({
    viewport: {width: 1550, height: 980}, locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true
});
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const dialog = page.getByTestId('bw-machine-manager');
const controller = page.getByTestId('bw-machine-console');
const canvas = controller.getByTestId('bw-machine-canvas');
const openMachines = async query => {
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await dialog.getByRole('searchbox', {name: 'Search firmware'}).fill(query);
};
const videoText = () => {
    const bytes = window.__benchTarget?.readMem('mem', 0xb8000, 4000);
    return bytes && String.fromCharCode(...bytes.filter((_, index) => index % 2 === 0));
};
const waitText = text => page.waitForFunction(
    `(() => (${videoText})()?.includes(${JSON.stringify(text)}))()`, null, {polling: 250}
);
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await openMachines('uHex');
    const row = dialog.locator('[data-machine-media="uhex-dos"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.equal(await run.isDisabled(), true);
    await row.getByTestId('bw-mm-freedos-guest-media').setInputFiles(floppy);
    assert.equal(await run.isDisabled(), true);
    await row.getByTestId('bw-mm-freedos-guest-package').setInputFiles(archive);
    await run.click();
    await dialog.waitFor({state: 'hidden'});
    await canvas.waitFor();
    await waitText('BRICKWRIGHT HEX');
    await canvas.click();
    await page.keyboard.press('4');
    await page.keyboard.press('3');
    await waitText('CRICKWRIGHT HEX');
    await page.keyboard.press('Alt+s');
    await waitText('File saved.');
    await page.keyboard.press('Escape');
    await waitText('A:\\>');

    const exported = page.waitForEvent('download');
    await controller.getByRole('button', {name: 'Save image', exact: true}).click();
    const download = await exported;
    const imagePath = await download.path();
    const bytes = await readFile(imagePath);
    assert.equal(bytes.length, 1200 * 1024);
    const sample = readXkimFatImage(bytes).find(file => file.name === 'SAMPLE.BIN');
    assert.equal(new TextDecoder().decode(sample.bytes), 'CRICKWRIGHT HEX LAB\r\n');

    await openMachines('FreeDOS VGA');
    await dialog.getByTestId('bw-mm-free386-floppy').setInputFiles({
        name: download.suggestedFilename(), mimeType: 'application/octet-stream', buffer: bytes
    });
    await page.evaluate(() => { window.__uhexPriorTarget = window.__benchTarget; });
    await dialog.getByTestId('bw-mm-free386-run').click();
    await dialog.waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.__benchTarget && window.__benchTarget !== window.__uhexPriorTarget);
    await waitText('CRICKWRIGHT HEX');
    assert.deepEqual(errors, []);
    console.log('uHex changed byte $42 to $43, saved it on the AT floppy, and reopened it after booting the exported image.');
} catch (error) {
    console.error(errors, await dialog.getByTestId('bw-mm-status').allTextContents(), await page.evaluate(videoText));
    throw error;
} finally {
    await browser.close();
}
