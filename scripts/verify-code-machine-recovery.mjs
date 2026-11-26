// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-right-pane-hidden', '0');
});
const controller = page.locator('[data-bw-stage-dock="controller"]');
const openLanguage = async name => {
    await page.getByTestId('bw-lang-more').click();
    await page.getByTestId('bw-lang-more-menu').getByRole('menuitem', {name, exact: true}).click();
};
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await openLanguage('CP1');
    const cp1 = page.locator('[data-cp1-code-editor] .cm-content');
    await cp1.waitFor({timeout: 30000});
    const cp1Source = await cp1.innerText();
    assert.match(cp1Source, /AKO/);
    await page.getByRole('button', {name: /BAS$/}).click();
    await typeIntoEditor(page, '10 PRINT 73*2\n20 END\n');
    await page.getByRole('combobox', {name: /Profile/}).selectOption('i8086-dos');
    await page.getByTitle('Go', {exact: true}).click();
    const dos = controller.getByTestId('bw-serial-console');
    await dos.filter({hasText: /MS-DOS version 2\.00[\s\S]*146/}).waitFor({timeout: 45000});

    await openLanguage('CP1');
    await cp1.filter({hasText: /AKO/}).waitFor();
    assert.equal(await cp1.innerText(), cp1Source);
    await controller.locator('[data-cp1-controller-face]').waitFor();
    assert.equal(await controller.getByTestId('bw-serial-console').count(), 0);
    console.log('PASS returning to CP1 after real DOS restores the editor and Controller.');

    await openLanguage('CARDIAC');
    const cardiac = controller.locator('[data-cardiac-controller]');
    await cardiac.waitFor();
    await page.getByRole('combobox', {name: 'Example program'}).selectOption('cardiac-echo');
    await page.getByTitle('Debugger', {exact: true}).click();
    await cardiac.waitFor({state: 'hidden'});
    await page.getByTitle('Go', {exact: true}).click();
    try {
        await cardiac.getByTestId('cardiac-output').filter({hasText: '042'}).waitFor({timeout: 12000});
    } catch (error) {
        console.error(await page.evaluate(() => ({
            machine: window.__bwMachineExtracted?.kind,
            pane: [...document.querySelectorAll('[data-bw-stage-dock]')].map(el => el.getAttribute('data-bw-stage-dock')),
            cardiac: [...document.querySelectorAll('[data-cardiac-host], [data-cardiac-editor], [data-cardiac-controller]')].map(el =>
                [el.getClientRects().length, el.dataset.cardiacStatus, el.innerText.slice(0, 600)]),
            runtime: window.__brickwrightStore?.getState()?.scratchGui.vm.runtime.bwDeviceCore
        })));
        throw error;
    }
    assert.equal(await controller.getByTestId('bw-ctl-widget-cardiac').count(), 1);
    console.log('PASS selecting CARDIAC shows its widget and the green flag returns to it and runs the cards.');

    await page.evaluate(() => localStorage.setItem('bw-reload-proof', 'preserved'));
    await page.getByTestId('bw-workspace-reload').click();
    await page.waitForURL(next => next.searchParams.has('bw-hard-reload'));
    assert.equal(await page.evaluate(() => localStorage.getItem('bw-reload-proof')), 'preserved');
    assert.deepEqual(errors, []);
    console.log('PASS the workspace reload button reloads while preserving preferences.');
} finally {
    await browser.close();
}
