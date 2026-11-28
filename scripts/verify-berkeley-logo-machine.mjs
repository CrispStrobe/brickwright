// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {decodeTextPixels, fixedTextGlyphs} from './lib/i80386-vga-text.mjs';

const [url, boot] = process.argv.slice(2);
assert.ok(url && boot, 'Pass the Brickwright URL and the FreeDOS 1.4 Floppy Edition ZIP or 120m/x86BOOT.img.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(60000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
const drops = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
page.on('requestfailed', request => {
    if (request.url().includes('blogo.exe')) drops.push(request.failure()?.errorText);
});
const manager = page.getByTestId('bw-machine-manager');
const canvas = page.getByTestId('bw-machine-canvas');

const screenText = `(() => {
    const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (canvas?.width !== 720 || canvas.height !== 400) return '';
    const rgba = canvas.getContext('2d').getImageData(0, 0, 720, 400).data;
    return (${decodeTextPixels})({mode: 3, width: 720, height: 400, rgba}, ${JSON.stringify(fixedTextGlyphs())});
})()`;
const waitForText = (pattern, timeout = 20000) =>
    page.waitForFunction(`${pattern}.test(${screenText})`, null, {polling: 250, timeout});

async function command (line) {
    const special = {' ': 'Space', '.': 'Period', '"': 'Shift+Quote', '[': 'BracketLeft', ']': 'BracketRight'};
    for (const character of line) await page.keyboard.press(special[character] || character, {delay: 65});
    await page.keyboard.press('Enter', {delay: 65});
}

function hasSquare () {
    const display = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (display?.width !== 640 || display.height !== 200) return false;
    const {data} = display.getContext('2d').getImageData(320, 58, 61, 43);
    const light = (x, y) => data[(y * 61 + x) * 4] > 170;
    const horizontal = Array.from({length: 61}, (_, x) => light(x, 0) && light(x, 42));
    const vertical = Array.from({length: 43}, (_, y) => light(0, y) && light(60, y));
    return horizontal.every(Boolean) && vertical.every(Boolean) && !light(30, 21);
}

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption('i8086');
    const row = manager.locator('[data-machine-media="berkeley-logo-dos"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    const media = row.getByTestId('bw-mm-freedos-guest-media');
    await media.setInputFiles({name: 'bad.img', mimeType: 'application/octet-stream', buffer: Buffer.alloc(1200 * 1024)});
    await run.click();
    await manager.getByText(/FreeDOS floppy checksum differs/).waitFor();
    await media.setInputFiles(boot);
    const fetched = page.waitForResponse(response => response.url().endsWith('/blogo.exe') && response.ok());
    await run.click();
    await fetched;
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    await waitForText(/Welcome to Berkeley Logo version 3[.]6/, 60000);
    await canvas.click();
    await command('print sum 40 2');
    await waitForText(/^42\s*$/m);
    await command('load "square.lgo');
    await waitForText(/load "square[.]lgo\s*\n\?\s*$/);
    await command('cs square 60 ht');
    await page.waitForFunction(hasSquare, null, {polling: 250, timeout: 15000});
    console.log('Logo reported 42 and the square lesson drew four edges on the 640 × 200 CGA screen.');

    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await page.waitForFunction(hasSquare);
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    await canvas.click();
    await command('textscreen');
    await waitForText(/\?\s*$/);
    assert.deepEqual(errors, []);
    assert.deepEqual(drops, []);
    console.log('Full screen preserved the turtle drawing, and TEXTSCREEN returned to the prompt.');
} catch (error) {
    console.error(errors, drops, await manager.allTextContents());
    if (await canvas.isVisible()) {
        console.error(await page.evaluate(screenText));
        if (process.env.LOGO_FAILURE_SCREEN) await canvas.screenshot({path: process.env.LOGO_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
