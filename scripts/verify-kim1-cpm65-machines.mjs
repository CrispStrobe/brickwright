// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {chromium} from 'playwright';

const [url, archiveDirectory] = process.argv.slice(2);
assert.ok(url && archiveDirectory, 'Pass the frontend URL and the directory containing the three upstream ZIPs.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const library = page.getByTestId('bw-machine-manager');
    const row = library.getByTestId('bw-mm-kim1-cpm65');
    const terminal = page.getByTestId('bw-machine-terminal');
    const output = terminal.getByTestId('bw-serial-console');
    const open = async () => {
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        await library.getByRole('combobox', {name: 'Machine type'}).selectOption('kim1');
    };
    await open();
    const run = row.getByRole('button', {name: 'Run', exact: true});
    await row.getByLabel('CP/M-65 ZIP').setInputFiles({name: 'invalid.zip', mimeType: 'application/zip', buffer: Buffer.alloc(8)});
    await run.click();
    await library.getByText(/Choose the pinned upstream ZIP/).waitFor();
    assert.equal(await terminal.count(), 0);

    for (const [id, label] of [['sdcard', 'SPI SD'], ['sdshield', 'Corsham DSK'], ['k1013', 'K-1013']]) {
        await row.getByLabel('CP/M-65 drive').selectOption(id);
        await row.getByLabel('CP/M-65 ZIP').setInputFiles(join(archiveDirectory, 'kim-1-' + id + '.zip'));
        const info = row.getByTestId('bw-mm-item-info');
        if (await info.getAttribute('aria-expanded') === 'false') await info.click();
        assert.match(await row.getByRole('link', {name: 'upstream ZIP'}).getAttribute('href'),
            new RegExp('davidgiven/cpm65/releases/download/dev/kim-1-' + id + '[.]zip$'));
        await run.click();
        await library.waitFor({state: 'hidden'});
        await terminal.getByText('CP/M-65 · ' + label, {exact: true}).waitFor();
        await output.filter({hasText: /CP\/M-65 for the KIM-1[\s\S]*A>\s*$/}).waitFor({timeout: 90000});
        const input = terminal.getByRole('textbox', {name: 'CP/M-65 command'});
        await input.fill('DIR');
        await input.press('Enter');
        await output.filter({hasText: /A>DIR[\s\S]*HELLO +ASM[\s\S]*A>\s*$/i}).waitFor({timeout: 90000});
        assert.match(await output.textContent(), /DIR[\s\S]*HELLO +ASM/i);
        if (id === 'sdcard') {
            const zoom = terminal.getByTestId('bw-machine-fullscreen');
            await zoom.click();
            await terminal.getByRole('button', {name: 'Exit full screen', exact: true}).click();
        }
        await page.getByTitle('Stop', {exact: true}).click();
        await terminal.waitFor({state: 'hidden'});
        console.log(label + ' booted, listed the guest disk with DIR, and stopped.');
        if (id !== 'k1013') await open();
    }
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(await page.getByTestId('bw-serial-console').allTextContents());
    console.error(await page.getByTestId('bw-machine-manager').allTextContents());
    throw error;
} finally {
    await browser.close();
}
