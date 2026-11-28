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

const makeXtRom = prefix => {
    const rom = new Uint8Array(32768).fill(0xff);
    rom.set([...prefix,
        0x8e, 0xc0,                         // ES = B800h (CGA text memory).
        0xba, 0xd8, 0x03, 0xb0, 0x29, 0xee, // Enable 80-column CGA text video.
        0xb8, 0x41, 0x1f, 0x26, 0xa3, 0, 0, // Show A when the firmware is ready.
        0xe4, 0x60, 0x3c, 0x1e, 0x75, 0xfa, // Poll the XT keyboard for KeyA's make code.
        0xb8, 0x4b, 0x1f, 0x26, 0xa3, 2, 0, 0xf4 // Write K and halt on receipt.
    ]);
    rom.set([0xea, 0, 0, 0, 0xf8], 0x7ff0);
    return rom;
};
const xtRom = makeXtRom([0xb8, 0x00, 0xb8]); // AX = B800.
const rom186 = makeXtRom([0x31, 0xc0, 0x8e, 0xd0, 0xbc, 0, 0x70, 0xb8, 0x00, 0xb8,
    0x60, 0x31, 0xc0, 0x61]); // PUSHA and POPA across a destructive XOR.

const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    for (const [kind, images] of [['zx48', {rom: rom48}], ['zx128', {rom0: editor, rom1: basic}],
        ['gpascal', {rom: gpascal}], ['i8088', {rom: xtRom}], ['i80186', {rom: rom186}]]) {
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
                // gate-shapes-allow: the imported ROM's serial boot text is the contract and persists; this is output evidence, not a closing UI.
                await page.getByTestId('bw-serial-console').getByText(/G-Pascal compiler, version/).waitFor();
            } else if (kind.startsWith('i80')) {
                await page.waitForFunction(() => {
                    const target = window.__benchTarget;
                    return target?.readMem('mem', 0xb8000, 2)[0] === 0x41;
                });
                const topology = await page.evaluate(() => window.__benchTarget.captureCheckpoint().topology);
                assert.equal(JSON.parse(topology).variant, kind === 'i8088' ? '8086' : '80186');
                const controller = page.locator('[data-bw-stage-dock="controller"]');
                const screen = controller.getByTestId('bw-machine-canvas');
                // gate-shapes-allow: persistent canvas readiness; CGA pixels, topology and halted CPU/keyboard memory are asserted around this wait.
                await screen.waitFor();
                await page.waitForFunction(() => {
                    const canvas = document.querySelector('[data-bw-stage-dock="controller"] [data-testid="bw-machine-canvas"]');
                    const pixels = canvas?.getContext('2d').getImageData(0, 0, 8, 8).data;
                    return pixels?.some((channel, index) => index % 4 !== 3 && channel > 150);
                });
                const fullscreen = controller.getByTestId('bw-machine-fullscreen');
                await fullscreen.click();
                assert.equal(await fullscreen.innerText(), 'Exit full screen');
                await screen.click();
                await page.keyboard.press('a');
                await page.waitForFunction(() => {
                    const target = window.__benchTarget;
                    return target?.regs()?.halted && target.readMem('mem', 0xb8002, 2)[0] === 0x4b;
                });
                await fullscreen.click();
                assert.equal(await fullscreen.innerText(), 'Full screen');
            } else {
                const screen = page.getByTestId('bw-machine-canvas');
                // gate-shapes-allow: persistent canvas readiness; exact dimensions/pixels and keyboard RAM transitions are asserted below.
                await screen.waitFor();
                await page.waitForFunction(() => {
                    const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
                    return canvas.width === 288 && canvas.height === 224 &&
                        canvas.getContext('2d').getImageData(16, 16, 1, 1).data[1] > 200;
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
            console.log(kind.startsWith('i80')
                ? `${kind} imports firmware, paints CGA text, and receives a Controller key in full screen`
                : `${kind} imported through Machines and executes its own firmware`);
        } catch (error) {
            console.error(await page.evaluate(() => {
                const target = window.__benchTarget;
                const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
                return {registers: target?.regs(), attribute: target?.readMem('mem', 0x5800, 1)?.[0],
                    canvas: canvas && {width: canvas.width, height: canvas.height,
                        pixel: Array.from(canvas.getContext('2d').getImageData(16, 16, 1, 1).data)}};
            }));
            console.error((await page.locator('body').innerText()).slice(-1500));
            throw error;
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
