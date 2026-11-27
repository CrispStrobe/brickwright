// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';
import {blinkMachines, blinkSource} from '../overlay/scratch-gui/src/lib/bw-asm/blink-machines.js';

const url = process.argv[2];
assert.ok(url, 'Pass the production frontend URL');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});

async function codePage () {
    const page = await browser.newPage({viewport: {width: 1360, height: 860}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(15000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    return page;
}

async function verifyBlink (machine, initialFlag) {
    const page = await codePage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const picker = page.getByTestId('bw-blink-machine-dialog');
    const assemble = page.getByTestId('bw-asm-assemble');
    const flag = page.getByTitle('Go', {exact: true});
    const status = page.getByTestId('bw-code-status');
    try {
        await page.getByRole('button', {name: /ASM$/}).click();
        await page.getByTestId('bw-asm-examples').selectOption('blink0');
        await (initialFlag ? flag : assemble).click();
        await picker.waitFor();
        const choices = await picker.locator('option').evaluateAll(options => options.map(option => option.value));
        assert.deepEqual(choices, blinkMachines.map(option => option.id));
        if (machine.id === 'stc60') {
            await picker.getByRole('button', {name: 'Cancel', exact: true}).click();
            await picker.waitFor({state: 'hidden'});
            assert.equal(await page.evaluate(() => Boolean(window.__bwPendingMedia)), false);
            assert.match(await page.locator('.cm-content').innerText(), /Choose a machine/);
            await assemble.click();
        }
        await picker.locator('select').selectOption(machine.id);
        await picker.getByRole('button', {name: 'Create and run', exact: true}).click();
        await picker.waitFor({state: 'hidden'});
        const label = machine.label.split(' · ')[1];
        const widget = page.getByTestId(`bw-ctl-bargraph-Blink 0 · ${label}`);
        await widget.waitFor({timeout: 35000});
        // Require transitions of the emulated output, including a second pulse.
        for (const value of ['1', '0', '1']) {
            await widget.getByText(value, {exact: true}).waitFor({timeout: 12000});
        }
        assert.match(await page.locator('.cm-content').innerText(), /BW-BLINK0/);
        await page.evaluate(() => { window.blinkFirstRun = window.__bwPendingMedia?.detail; });
        await (initialFlag ? assemble : flag).click();
        await page.waitForFunction(() => window.__bwPendingMedia?.detail !== window.blinkFirstRun &&
            window.__bwPendingMedia?.detail?.asmBlink?.id === window.blinkFirstRun?.asmBlink?.id);
        await widget.getByText('1', {exact: true}).waitFor();
        if (machine.circuit) {
            assert.equal(await page.evaluate(() => window.blinkFirstRun.asmBlink.board ===
                window.__bwPendingMedia.detail.asmBlink.board), true);
        }
        assert.equal(await picker.isVisible(), false);
        if (machine.id === 'z80-virtual') {
            const before = await page.evaluate(() => window.__bwPendingMedia.detail.asmBlink.id);
            await typeIntoEditor(page, blinkSource('6502'));
            await flag.click();
            await picker.waitFor();
            assert.deepEqual(await picker.locator('option').evaluateAll(options => options.map(option => option.value)),
                ['6502-wired', '6502-virtual']);
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.__bwPendingMedia.detail.asmBlink.id), before);
            console.log('PASS incompatible Z80 stays running when the 6502 selector is cancelled');
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${machine.label} · pulses, alternate Run control, compatible machine reuse`);
    } catch (error) {
        throw new Error(`${machine.label}: ${error.message}\nCode status: ${await status.allTextContents()}\nPage errors: ${errors.join(', ')}`);
    } finally {
        await page.close();
    }
}

async function verifyMenu () {
    const page = await codePage();
    try {
        await page.setViewportSize({width: 950, height: 720});
        await page.getByRole('button', {name: / C$/}).click();
        const trigger = page.getByTestId('bw-code-actions-trigger');
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        const menu = page.getByTestId('bw-code-actions-menu');
        await menu.waitFor();
        const rows = ['About the Code tab', 'Show the language and device matrix', 'Open debugger'];
        for (const name of rows) {
            const row = menu.getByRole('button', {name, exact: true});
            assert.equal(await row.count(), 1);
            const {width, height, icons, nestedWidth} = await row.evaluate(element => ({
                width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
                icons: element.querySelectorAll('svg').length, nestedWidth: element.parentElement.getBoundingClientRect().width
            }));
            assert.ok(width > 200 && width >= nestedWidth - 2 && height <= 40 && icons === 1, name);
        }
        const disclosure = menu.locator('summary').filter({hasText: 'Languages'});
        await disclosure.click();
        await menu.getByRole('button', {name: /ASM$/}).click();
        await menu.waitFor({state: 'hidden'});
        await trigger.click();
        await menu.getByTestId('bw-asm-assemble-menu').waitFor();
        await page.keyboard.press('Escape');
        await menu.waitFor({state: 'hidden'});
        console.log('PASS Code overflow · full-width icon rows, language disclosure, ASM action, keyboard dismissal');
    } finally {
        await page.close();
    }
}

try {
    const machines = blinkMachines.filter(machine => !process.env.BW_BLINK_MACHINE || machine.id === process.env.BW_BLINK_MACHINE);
    await verifyMenu();
    const queue = machines.map((machine, index) => [machine, index % 2 !== 0]);
    const failures = [];
    await Promise.all(Array.from({length: Math.min(queue.length, 2)}, async () => {
        while (queue.length) {
            try {
                await verifyBlink(...queue.shift());
            } catch (error) {
                console.error(error);
                failures.push(error);
            }
        }
    }));
    assert.equal(failures.length, 0);
} finally {
    await browser.close();
}
