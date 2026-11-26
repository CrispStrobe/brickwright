// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const gpascal = await readFile(new URL('../node_modules/bw-board/vendor/gpascal/gpascal.bin', import.meta.url));
// Independent fixture: color cell 0, then keep sampling ULA keyboard row 0.
const keyboardRom = Uint8Array.of(0x3e, 0x6a, 0x32, 0x00, 0x58, 0x3e, 0xfe, 0xdb, 0xfe,
    0x32, 0x00, 0x80, 0x18, 0xf7);
const rom48 = new Uint8Array(16384);
rom48.set(keyboardRom);
const editor = new Uint8Array(16384);
editor.set([0x01, 0xfd, 0x7f, 0x3e, 0x10, 0xed, 0x79]); // Page in ROM 1 at the next PC.
const basic = new Uint8Array(16384);
basic.set(keyboardRom, 7);

const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    for (const [kind, images] of [['zx48', {rom: rom48}], ['zx128', {rom0: editor, rom1: basic}],
        ['gpascal', {rom: gpascal}]]) {
        const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.addInitScript(() => {
                localStorage.setItem('bw-starter-v1-complete', '1');
                localStorage.setItem('bw-right-pane-hidden', '1');
            });
            const slots = {};
            for (const [name, bytes] of Object.entries(images)) {
                const mediaUrl = new URL(`machine-fixture/${kind}-${name}.bin`, url).href;
                await page.route(mediaUrl, route => route.fulfill({
                    contentType: 'application/octet-stream', body: Buffer.from(bytes)
                }));
                slots[name] = {url: mediaUrl};
            }
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            await page.getByTestId('bw-file-menu-trigger').click();
            await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
            await page.getByTestId('bw-mm-import-text').fill(JSON.stringify({
                title: `Test ${kind}`, machine: kind, executionMode: 'functional', slots
            }));
            await page.getByTestId('bw-mm-import').click();
            await page.getByTestId('bw-mm-row').filter({hasText: `Test ${kind}`}).getByTestId('bw-mm-run').click();

            if (kind === 'gpascal') {
                await page.getByTestId('bw-serial-console').getByText(/G-Pascal compiler, version/).waitFor();
            } else {
                const screen = page.getByTestId('bw-machine-canvas');
                await screen.waitFor();
                await page.waitForFunction(() => {
                    const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
                    return canvas.width === 288 && canvas.height === 224 &&
                        canvas.getContext('2d').getImageData(16, 16, 1, 1).data[0] > 200;
                });
                const keyReleased = released => (window.__benchTarget?.readMem('mem', 0x8000, 1)[0] & 2) ===
                    (released ? 2 : 0);
                await page.waitForFunction(keyReleased, true);
                await screen.click();
                await page.keyboard.down('z');
                await page.waitForFunction(keyReleased, false);
                await page.keyboard.up('z');
                await page.waitForFunction(keyReleased, true);
            }
            assert.deepEqual(errors, []);
            console.log(`${kind} imported through Machines and executes its own firmware`);
        } catch (error) {
            console.error((await page.locator('body').innerText()).slice(-2500));
            throw error;
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
