// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {libraryCircuitPrograms} from '../overlay/scratch-gui/src/lib/bw-machines/library-circuits.js';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const index = JSON.parse(await readFile(new URL('../overlay/scratch-gui/examples/index.json', import.meta.url)));
const projects = libraryCircuitPrograms(index);
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const failures = [];

async function check({id, machine}) {
    const page = await browser.newPage({viewport: {width: 1520, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    try {
        await page.goto(url, {waitUntil: 'domcontentloaded'});
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        const dialog = page.getByTestId('bw-machine-manager');
        await dialog.getByRole('combobox', {name: 'Machine type'}).selectOption(machine);
        const item = dialog.locator(`[data-machine-example="${id}"]`);
        await item.getByRole('button', {name: 'Open', exact: true}).click();
        const confirm = page.getByRole('button', {name: 'OK', exact: true});
        const opened = dialog.waitFor({state: 'hidden'});
        await Promise.race([opened, confirm.waitFor().then(() => confirm.click()).then(() => opened)]);
        await page.waitForFunction(example => window.__bwActiveExample?.id === example, id);
        if (machine === 'cp1' || machine === 'cardiac') {
            await page.getByRole('tab', {name: 'Code', exact: true}).click();
            if (machine === 'cp1') {
                await page.locator('[data-cp1-code-editor] .cm-content').waitFor();
                await page.locator('[data-cp1-controller-face]').waitFor();
            } else {
                await page.locator('[data-cardiac-editor] .cm-content').waitFor();
                await page.locator('[data-bw-stage-dock="controller"] [data-cardiac-controller]').waitFor();
            }
        } else {
            await page.waitForFunction(() => window.__board?.parts.length > 0);
        }
        if (id === 'i8086-blink') {
            await page.getByTitle('Go', {exact: true}).click();
            for (const lit of [true, false, true]) {
                await page.waitForFunction(expected => {
                    const board = window.__board;
                    return (board.ledBrightness('led0') > 0.01) === expected &&
                        [1, 2, 3, 4, 5, 6, 7].every(pin => board.ledBrightness(`led${pin}`) === 0);
                }, lit, {timeout: 6000});
            }
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${machine} ${id} · project handoff`);
    } catch (error) {
        failures.push(id);
        console.error(`FAIL ${id}: ${error.message}`);
    } finally {
        await page.close();
    }
}

try {
    await Promise.all(Array.from({length: 4}, async () => {
        while (projects.length) await check(projects.shift());
    }));
} finally {
    await browser.close();
}
assert.deepEqual(failures, []);
