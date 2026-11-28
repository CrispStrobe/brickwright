// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {readXkimFatImage} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-xkim-fat.js';

const [url, bootArchive, gameArchive] = process.argv.slice(2);
assert.ok(url && bootArchive && gameArchive, 'Pass the app URL, official FreeDOS 1.4 ZIP and Sudoku86 1.0.3 ZIP.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1480, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(120000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
const manager = page.getByTestId('bw-machine-manager');
const controller = page.getByTestId('bw-machine-console');
const canvas = page.getByTestId('bw-machine-canvas');
const press = key => page.keyboard.press(key, {delay: 100});

async function guestTick (duration = 160_000_000) {
    const start = await page.evaluate(() => Number(window.__benchTarget.timeNs()));
    await page.waitForFunction(end => Number(window.__benchTarget.timeNs()) >= end, start + duration,
        {timeout: 15000, polling: 100});
}

function gameGrid () {
    const display = document.querySelector('[data-testid="bw-machine-canvas"]');
    if (display?.width !== 320 || display.height !== 200) return [];
    const context = display.getContext('2d');
    return Array.from({length: 81}, (_, index) => {
        const x = index % 9;
        const y = Math.floor(index / 9);
        const left = 90 + x * 21 + Math.floor(x / 3);
        const top = 17 + y * 18 + Math.floor(y / 3);
        const glyph = context.getImageData(left + 7, top + 3, 9, 13).data;
        let ink = 0;
        for (let i = 0; i < glyph.length; i += 4) {
            if (glyph[i] < 100 && glyph[i + 1] < 100 && glyph[i + 2] < 100) ink++;
        }
        return ink;
    });
}

async function waitForCells (indices, filled) {
    await page.waitForFunction(
        `(() => {
            const ink = (${gameGrid})();
            return ${JSON.stringify(indices)}.every(index => ${filled ? 'ink[index] >= 40 && ink[index] < 100' : 'ink[index] < 20'});
        })()`, null, {polling: 100, timeout: 15000});
}

async function savedGame () {
    await controller.focus();
    await press('F5');
    // The DOS program writes the save and keeps its confirmation on screen for one guest second.
    await guestTick(2_000_000_000);
    const downloading = page.waitForEvent('download', {timeout: 15000});
    await controller.getByRole('button', {name: 'Save image', exact: true}).click();
    const disk = await readFile(await (await downloading).path());
    const saved = readXkimFatImage(disk).find(file => file.name === 'SUDOKU86.SAV');
    assert.equal(saved?.bytes.length, 163, 'F5 wrote the original Sudoku86 save file.');
    return Buffer.from(saved.bytes);
}

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    const row = manager.locator('[data-machine-media="sudoku86"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    await row.getByTestId('bw-mm-freedos-guest-media').setInputFiles(bootArchive);
    assert.ok(await run.isDisabled());
    const gameInput = row.getByTestId('bw-mm-freedos-guest-package');
    await gameInput.setInputFiles({name: 'bad.zip', mimeType: 'application/zip', buffer: Buffer.alloc(248034)});
    await run.click();
    await manager.getByText(/The Sudoku86 ZIP checksum differs/).waitFor();
    await gameInput.setInputFiles(gameArchive);
    await run.click();
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    await page.waitForFunction(() => {
        const display = document.querySelector('[data-testid="bw-machine-canvas"]');
        if (display?.width !== 320 || display.height !== 200) return false;
        const data = display.getContext('2d').getImageData(90, 17, 189, 162).data;
        let lit = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] + data[i + 1] + data[i + 2] > 200) lit++;
        }
        return lit > 1000;
    }, null, {polling: 200, timeout: 45000});
    await guestTick(600_000_000);
    console.log('Sudoku86 reached its 320 × 200 puzzle screen in Controller.');

    const first = await page.evaluate(gameGrid);
    await controller.focus();
    await press('7');
    await page.waitForFunction(() => {
        const display = document.querySelector('[data-testid="bw-machine-canvas"]');
        const [red, green, blue] = display.getContext('2d').getImageData(37, 131, 1, 1).data;
        return red > 95 && red > green && blue < 55;
    }, null, {timeout: 12000});

    const bounds = await canvas.boundingBox();
    const moveTo = (x, y, steps = 1) => page.mouse.move(
        bounds.x + x * bounds.width / 320, bounds.y + y * bounds.height / 200, {steps});
    await moveTo(160, 100);
    // Cross several squares so a randomly selected puzzle can always supply an editable one.
    for (const [x, y] of [[160, 100], [181, 118], [202, 100], [224, 82], [245, 100], [224, 118]]) {
        await moveTo(x, y, 10);
        await guestTick();
        await page.mouse.down();
        await guestTick();
        await page.mouse.up();
        await guestTick();
    }
    const edited = await page.evaluate(gameGrid);
    const entered = edited.flatMap((ink, index) => first[index] < 20 && ink >= 40 ? [index] : []);
    assert.ok(entered.length, 'Controller mouse placed a digit in an editable square.');
    const saved = await savedGame();
    assert.equal(saved[0], 7, 'Controller keyboard selected digit 7.');
    const savedCells = entered.filter(index => (saved.readUInt16BE(1 + 2 * index) & 0x200f) === 7);
    assert.ok(savedCells.length, 'The exported floppy contains the mouse-entered digit.');
    console.log('Controller mouse placed a 7 and the exported floppy contained that move.');

    await controller.focus();
    await press('c');
    await waitForCells(savedCells, false);
    await press('F7');
    await waitForCells(savedCells, true);
    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    assert.deepEqual(errors, []);
    console.log('F7 restored the saved cells after clearing them, and full screen toggled.');
} catch (error) {
    console.error(errors, await manager.allTextContents());
    if (process.env.SUDOKU_FAILURE_SCREEN && await canvas.isVisible()) {
        await canvas.screenshot({path: process.env.SUDOKU_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
