// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {decodeTextPixels, fixedTextGlyphs} from './lib/i80386-vga-text.mjs';

const [url, floppy, profile = 'xt'] = process.argv.slice(2);
const at = profile === 'at';
assert.ok(url && floppy && ['xt', 'at'].includes(profile), 'Pass the Brickwright URL, original flop360.img and optionally at.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(60000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
const manager = page.getByTestId('bw-machine-manager');
const canvas = page.getByTestId('bw-machine-canvas');
const screenText = `(() => {
    const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (canvas?.width !== 720 || canvas.height !== 400) return '';
    const rgba = canvas.getContext('2d').getImageData(0, 0, 720, 400).data;
    return (${decodeTextPixels})({mode: 3, width: 720, height: 400, rgba}, ${JSON.stringify(fixedTextGlyphs())});
})()`;

async function waitForScreen (pattern, timeout = 30000) {
    await page.waitForFunction(`${pattern}.test(${screenText})`, null, {polling: 500, timeout});
}

async function command (text) {
    // Leave a frame between make and break on the XT's single-byte latch.
    for (const key of text) {
        await page.keyboard.press(key === ' ' ? 'Space' : key, {delay: 65});
    }
    await page.keyboard.press('Enter', {delay: 65});
}

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption(at ? 'i80386' : 'i8086');
    const row = manager.locator(`[data-machine-media="pdos86${at ? '-at' : ''}"]`);
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    await row.getByTestId('bw-mm-item-info').click();
    assert.equal(await row.getByRole('link', {name: 'flop360.img'}).getAttribute('href'), 'https://www.pdos.org/flop360.img');
    const fileInput = row.getByTestId('bw-mm-local-floppy');
    await fileInput.setInputFiles({name: 'bad.img', mimeType: 'application/octet-stream', buffer: Buffer.alloc(360 * 1024)});
    await run.click();
    await manager.getByText(/flop360[.]img checksum differs/).waitFor();
    await fileInput.setInputFiles(floppy);
    await run.click();
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    const bootStart = Date.now();
    if (process.env.PDOS_FAST_BOOT === '1') {
        await page.waitForFunction(`(() => {
            window.__benchTarget?.runFor(500_000_000);
            return /Welcome to PCOMM/.test(${screenText});
        })()`, null, {polling: 25, timeout: 300000});
    } else {
        await waitForScreen(/Welcome to PCOMM/, 300000);
    }
    await waitForScreen(/A:\\\]/);
    console.log(`PDOS/86 reached PCOMM in ${profile.toUpperCase()} Controller after ${Math.round((Date.now() - bootStart) / 1000)} seconds.`);

    await canvas.click();
    await command('dir');
    await waitForScreen(/README[.]TXT +728/i);
    await waitForScreen(/A:\\\]\s*$/);
    if (at) {
        await command('copy readme.txt check.txt');
        await waitForScreen(/Copied 728 bytes/i);
        await waitForScreen(/A:\\\]\s*$/);
    }
    await command(at ? 'type check.txt' : 'type readme.txt');
    await waitForScreen(/If this scrolled by too fast, try:/);
    await waitForScreen(/A:\\\]\s*$/);

    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    assert.deepEqual(errors, []);
    console.log(at ?
        'DIR listed the floppy, COPY created CHECK.TXT, TYPE read it, and full screen toggled.' :
        'DIR listed the floppy, TYPE read README.TXT, and full screen toggled.');
} catch (error) {
    console.error(errors, await manager.allTextContents());
    if (await canvas.isVisible()) {
        console.error(await page.evaluate(screenText));
        if (process.env.PDOS_FAILURE_SCREEN) await canvas.screenshot({path: process.env.PDOS_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
