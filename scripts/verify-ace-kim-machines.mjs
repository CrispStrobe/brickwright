// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the assembled Brickwright frontend URL.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(35000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    const library = page.getByTestId('bw-machine-manager');
    await library.getByRole('combobox', {name: 'Machine type'}).selectOption('kim1');
    const item = library.locator('[data-machine-media="ace-kim"]');
    await item.getByTestId('bw-mm-item-info').click();
    const licenses = await item.getByRole('link', {name: /MIT/}).evaluateAll(links => links.map(link => link.href));
    assert.equal(licenses.length, 2);
    assert.match(licenses[0], /\/ace-kim\/LICENSE[.]bios$/);
    assert.match(licenses[1], /\/ace-kim\/LICENSE[.]kc-monitor$/);
    await item.getByRole('button', {name: 'Run', exact: true}).click();
    await library.waitFor({state: 'hidden'});

    const widget = page.getByTestId('bw-ctl-widget-ace-kim');
    const lcd = widget.locator('[data-ace-kim-lcd]');
    const keypad = widget.getByRole('group', {name: 'ACE KIM keypad'});
    const waitForDisplay = pattern => lcd.filter({hasText: pattern}).waitFor();
    await waitForDisplay(/ESC TO START/);
    await keypad.getByRole('button', {name: 'ESC', exact: true}).click();
    await waitForDisplay(/\$0800: \$00/);
    await keypad.press('Insert');
    await waitForDisplay(/INS/);
    await keypad.getByRole('button', {name: '5', exact: true}).click();
    await waitForDisplay(/\$0800: \$05/);
    await keypad.press('a');
    await waitForDisplay(/\$0800: \$5A/);
    await keypad.press('ArrowLeft');
    await waitForDisplay(/\$07FF/);
    await keypad.press('ArrowRight');
    await waitForDisplay(/\$0800: \$5A/);

    await widget.getByTestId('bw-machine-fullscreen').click();
    await widget.getByRole('button', {name: 'Exit full screen', exact: true}).click();
    await page.getByRole('button', {name: 'Edit', exact: true}).last().click();
    const add = page.getByRole('button', {name: '+ Add Widget', exact: true});
    await add.click();
    await page.getByRole('button', {name: 'Button', exact: true}).click();
    await page.getByTestId('bw-ctl-widget-btn1').waitFor();
    await page.getByTestId('bw-ctl-remove-ace-kim').click();
    await widget.waitFor({state: 'hidden'});
    await add.click();
    await page.getByRole('button', {name: 'ACE KIM', exact: true}).click();
    await waitForDisplay(/\$0800: \$5A/);
    await page.getByTestId('bw-ctl-widget-btn1').waitFor();
    await page.getByRole('button', {name: 'Play', exact: true}).last().click();
    await widget.getByRole('button', {name: 'Reset ACE KIM', exact: true}).click();
    await waitForDisplay(/ESC TO START/);

    await page.getByTitle('Stop', {exact: true}).click();
    await widget.getByText('Disconnected', {exact: true}).waitFor();
    assert.deepEqual(errors, []);
    console.log('ACE KIM booted from Machines, accepted mouse and keyboard, showed $5A at $0800, survived widget re-addition, reset, and stopped.');
} catch (error) {
    console.error(await page.locator('[data-ace-kim-lcd]').allTextContents());
    console.error(await page.getByTestId('bw-machine-manager').allTextContents());
    throw error;
} finally {
    await browser.close();
}
