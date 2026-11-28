// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createFreedosGuest, dosText} from '../overlay/scratch-gui/src/lib/bw-machines/freedos-guest.js';
import {buildFat16} from '../node_modules/bw-board/scripts/lib/i80386-free-bios-fat16.mjs';
import {decodeTextPixels, fixedTextGlyphs} from './lib/i80386-vga-text.mjs';

const [url, media] = process.argv.slice(2);
assert.ok(url && media, 'Pass an app URL and official FreeDOS 1.4 Floppy Edition ZIP or 120m/x86BOOT.img.');
const marker = 'PAIRED AT DATA DISK OK';
const guest = await createFreedosGuest(new Blob([await readFile(media)]), {
    title: 'AT data disk probe',
    readFiles: () => [],
    startup: ['TYPE C:\\MARKER.TXT']
});
const {bytes: floppy} = await guest.fetcher(guest.config.slots.floppy);
const geometry = {cylinders: 500, heads: 8, sectors: 17};
const {image: hdd} = buildFat16({
    geometry,
    volLabel: 'AT PROBE',
    files: [
        {name: 'FILL    BIN', bytes: new Uint8Array(28 * 1024 * 1024)},
        {name: 'MARKER  TXT', bytes: dosText([marker])}
    ]
});
const manifest = {
    title: guest.config.title,
    machine: 'i80386',
    bios: guest.config.bios,
    video: guest.config.video,
    slots: {
        floppy: {...guest.config.slots.floppy, url: '/probe-boot.img'},
        hdd: {url: '/probe-data.img', geometry}
    },
    bootOrder: ['floppy', 'hdd'],
    widgets: guest.config.widgets
};
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(60000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
await page.route('**/probe-boot.img', route => route.fulfill({body: Buffer.from(floppy)}));
await page.route('**/probe-data.img', route => route.fulfill({body: Buffer.from(hdd)}));
const manager = page.getByTestId('bw-machine-manager');

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByTestId('bw-mm-import-text').fill(JSON.stringify(manifest));
    await manager.getByTestId('bw-mm-import').click();
    const row = manager.getByTestId('bw-mm-row').filter({hasText: 'AT data disk probe'});
    await row.getByTestId('bw-mm-run').click();
    await manager.waitFor({state: 'hidden'});
    await page.getByTestId('bw-machine-canvas').waitFor();

    const glyphs = JSON.stringify(fixedTextGlyphs());
    await page.waitForFunction(`(() => {
        try {
            const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
            if (canvas?.width !== 720 || canvas.height !== 400) return false;
            const rgba = canvas.getContext('2d').getImageData(0, 0, 720, 400).data;
            const text = (${decodeTextPixels})({mode: 3, width: 720, height: 400, rgba}, ${glyphs});
            return text.includes(${JSON.stringify(marker)});
        } catch { return false; }
    })()`, null, {polling: 300, timeout: 120000});
    assert.deepEqual(errors, []);
    console.log('FreeDOS booted from A: and read the marker beyond 28 MiB on the paired C: drive in Controller.');
} catch (error) {
    console.error(errors, await manager.allTextContents());
    if (process.env.DATA_DISK_FAILURE_SCREEN) {
        await page.screenshot({path: process.env.DATA_DISK_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
