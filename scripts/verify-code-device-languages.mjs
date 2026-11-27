// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {closeCodeActions, openCodeActions} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1800, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const row = page.getByTestId('bw-lang-row');
const tab = name => row.getByRole('button', {name, exact: true});
const target = async device => {
    await openCodeActions(page);
    await page.getByTestId('bw-device-select-menu').selectOption(device);
    await closeCodeActions(page);
};
const hasTabs = async (...names) => {
    const buttons = await row.locator('button[aria-pressed]').evaluateAll(elements =>
        elements.map(el => el.getAttribute('aria-label')).filter(label => /^(🧩|🐍|🟨|🔧|📺|🔩)/u.test(label)));
    assert.deepEqual(buttons, names);
};
const profiles = () => page.getByTestId('bw-basic-profile').locator('option').evaluateAll(items => items.map(item => item.value));
const pseudo = '🧩 Pseudo', py = '🐍 Py', js = '🟨 JS', c = '🔧 C', bas = '📺 BAS', asm = '🔩 ASM';

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await row.waitFor();
    await hasTabs(pseudo, py, js, c, bas, asm);
    await tab(js).click();
    await typeIntoEditor(page, 'console.log("Preserved draft");');
    await target('eater6502');
    await hasTabs(pseudo, c, bas, asm);
    assert.equal(await tab(pseudo).getAttribute('aria-pressed'), 'true');
    assert.equal(await row.getByTestId('bw-lang-more').count(), 0);
    await tab(bas).click();
    assert.deepEqual(await profiles(), ['ms']);
    await target('i8086');
    assert.deepEqual(await profiles(), ['i8086', 'i8086-dos', 'i8086-ubasic']);
    await target('z80');
    assert.deepEqual(await profiles(), ['bbc']);
    await target('pico');
    await hasTabs(pseudo, py, c, bas, asm);
    assert.deepEqual(await profiles(), ['pico-bbcbasic']);

    await openCodeActions(page);
    const menu = page.getByTestId('bw-code-actions-menu');
    await menu.locator('summary').filter({hasText: 'Languages'}).click();
    assert.equal(await menu.getByRole('button', {name: 'JavaScript', exact: true}).count(), 0);
    assert.equal(await menu.getByRole('button', {name: 'BASIC', exact: true}).count(), 1);
    await closeCodeActions(page);

    await typeIntoEditor(page, '10 A=40\n20 PRINT "PICO-CODE ";A+2\n30 END');
    await openCodeActions(page);
    await page.getByTestId('bw-basic-run-menu').click();
    const rows = page.getByTestId('bw-picobb-terminal').locator('.xterm-rows');
    await rows.getByText(/^PICO-CODE\s+42$/).waitFor({timeout: 120000});

    await typeIntoEditor(page, 'PRINT "PICO-FLAG ";6*7');
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    await rows.getByText(/^PICO-FLAG\s+42$/).waitFor({timeout: 120000});

    await target('');
    await tab(js).click();
    await page.waitForFunction(() =>
        document.querySelector('.cm-content')?.cmTile.root.view.state.doc.toString() === 'console.log("Preserved draft");');
    assert.deepEqual(errors, []);
    console.log('Code tabs, overflow, retained draft, four BASIC profile sets, and real PicoBB UART execution passed.');
} finally {
    await browser.close();
}
