// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {libraryLicenseUrl, libraryMedia} from '../overlay/scratch-gui/src/lib/bw-machines/library-media.js';

const [url] = process.argv.slice(2);
assert.ok(url, 'Pass the URL of a built Brickwright app.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
let phase = 'loading the app';
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const terminal = page.getByTestId('bw-machine-terminal');
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    for (const [id, banner] of [['f83', /8086 Forth 83 Model/i], ['volksforth', /volksFORTH-83 rev[.] 3[.]81[.]41/i]]) {
        const item = libraryMedia.find(entry => entry.id === id);
        phase = `finding ${item.title} in Machines`;
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        const library = page.getByTestId('bw-machine-manager');
        await library.getByRole('combobox', {name: 'Machine type'}).selectOption('i8086');
        const row = library.locator(`[data-machine-media="${id}"]`);
        const notice = libraryLicenseUrl(item);
        await row.getByTestId('bw-mm-item-info').click();
        assert.equal(await row.getByRole('link', {name: item.license, exact: true}).getAttribute('href'), notice);
        phase = `fetching the notice for ${item.title}`;
        const noticeResponse = await page.request.get(notice, {timeout: 30000});
        assert.ok(noticeResponse.ok(), `Missing notice for ${id}`);
        assert.match(await noticeResponse.text(), id === 'f83' ? /public domain/i : /Redistribution and use/i);
        phase = `launching ${item.title}`;
        await row.getByRole('button', {name: 'Run', exact: true}).click();
        await library.waitFor({state: 'hidden'});
        const output = terminal.getByTestId('bw-serial-console');
        const waitFor = pattern => output.filter({hasText: pattern}).waitFor();
        phase = `waiting for the ${item.title} banner`;
        await waitFor(banner);
        if (id === 'volksforth') assert.doesNotMatch(await output.textContent(), /8086 Forth 83 Model/);
        const input = terminal.getByTestId('bw-serial-input');
        const submit = async line => {
            await input.fill(line);
            await input.press('Enter');
        };
        phase = `defining and calling a word in ${item.title}`;
        await submit(': SQUARE DUP * ;');
        await waitFor(/SQUARE DUP \* ;\s+ok/i);
        await submit('7 SQUARE .');
        await waitFor(/SQUARE \.\s+49\s+ok/i);
        phase = `checking full screen and Stop for ${item.title}`;
        await terminal.getByTestId('bw-machine-fullscreen').click();
        await terminal.getByRole('button', {name: 'Exit full screen', exact: true}).click();
        await page.getByTitle('Stop', {exact: true}).click();
        console.log(`${item.title} defined a word and returned 49 in Controller.`);
    }
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(`Failed while ${phase}.`, errors);
    await Promise.allSettled([
        page.getByTestId('bw-machine-manager').allTextContents().then(value => console.error(value)),
        terminal.getByTestId('bw-serial-console').allTextContents().then(value => console.error(value))
    ]);
    throw error;
} finally {
    await browser.close();
}
