// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {openCodeInfo} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const [url] = process.argv.slice(2);
assert.ok(url, 'Pass the URL of a built Brickwright app.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
page.setDefaultTimeout(120000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const library = page.getByTestId('bw-machine-manager');
const terminal = page.getByTestId('bw-machine-terminal');
const output = terminal.getByTestId('bw-serial-console');
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await library.getByRole('combobox', {name: 'Machine type'}).selectOption('i8086');
    await library.locator('[data-machine-media="small-c"]').getByRole('button', {name: 'Run', exact: true}).click();
    await library.waitFor({state: 'hidden'});
    await output.filter({hasText: 'SMALL-C RESULT 42'}).waitFor();
    const editor = page.locator('.cm-content').first();
    await editor.waitFor();
    const source = await editor.evaluate(el => el.cmTile.root.view.state.doc.toString());
    assert.match(source, /6 \* 7/);
    await typeIntoEditor(page, source.replace('6 * 7', '6 * 8'));
    await page.getByTitle('Go', {exact: true}).click();
    await output.filter({hasText: 'SMALL-C RESULT 48'}).waitFor();
    console.log('Small-C built via Machines and rebuilt edited C via the green flag. Controller printed 42 and 48.');
    await terminal.getByTestId('bw-machine-fullscreen').click();
    await terminal.getByRole('button', {name: 'Exit full screen', exact: true}).click();
    await typeIntoEditor(page, source.replace('stdio.h', 'absent.h'));
    await page.getByTitle('Go', {exact: true}).click();
    const info = await openCodeInfo(page);
    await info.getByText(/Small-C compiler failed.*open failure on include file/).waitFor();
    await output.filter({hasText: 'SMALL-C RESULT 48'}).waitFor();
    assert.deepEqual(errors, []);
    console.log('Full screen toggled, and a failed build displayed its diagnostic while preserving the previous Controller output.');
} catch (error) {
    console.error(errors, await library.allTextContents(), await output.allTextContents());
    throw error;
} finally {
    await browser.close();
}
