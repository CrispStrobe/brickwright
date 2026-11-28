// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const [url, rom] = process.argv.slice(2);
assert.ok(url && rom, 'Pass the frontend URL and a locally built upstream xKIM ROM.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(35000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const library = page.getByTestId('bw-machine-manager');
    const openLibrary = async () => {
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        await library.getByRole('combobox', {name: 'Machine type'}).selectOption('kim1');
    };
    await openLibrary();
    const row = library.getByTestId('bw-mm-xkim');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    await row.getByLabel('xKIM ROM').setInputFiles({name: 'invalid.rom', mimeType: 'application/octet-stream', buffer: Buffer.alloc(8)});
    await run.click();
    await library.getByText(/Choose the 8 KiB xKIM ROM/).waitFor();
    await row.getByLabel('xKIM ROM').setInputFiles(rom);
    await row.getByLabel('xKIM Corsham files').setInputFiles([
        {name: 'HELLO.TXT', mimeType: 'text/plain', buffer: Buffer.from('HELLO FROM BRICKWRIGHT\r\n')},
        {name: 'README.ME', mimeType: 'text/plain', buffer: Buffer.from('SECOND FILE\r\n')}
    ]);
    await run.click();
    await library.waitFor({state: 'hidden'});

    const terminal = page.getByTestId('bw-machine-terminal');
    const output = terminal.getByTestId('bw-serial-console');
    const input = terminal.getByRole('textbox', {name: 'xKIM command'});
    const waitFor = pattern => output.filter({hasText: pattern}).waitFor();
    const submit = async line => {await input.fill(line); await input.press('Enter');};
    await waitFor(/Extended KIM Monitor v1[.]8[\s\S]*>\s*$/);
    await submit('D');
    await waitFor(/Disk Directory[\s\S]*HELLO[.]TXT[\s\S]*README[.]ME[\s\S]*>\s*$/);
    await submit('T');
    await waitFor(/Enter filename:\s*$/);
    await submit('MISSING.TXT');
    await waitFor(/Failed to open file[\s\S]*>\s*$/);
    await submit('T');
    await waitFor(/Enter filename:\s*$/);
    await submit('hello.txt');
    await waitFor(/HELLO FROM BRICKWRIGHT[\s\S]*>\s*$/);

    await submit('E');
    await submit('0200');
    await waitFor(/0200 EA\s*$/);
    await submit('5A');
    await waitFor(/0201 00\s*$/);
    await submit('?');
    await waitFor(/0201 00[\s\S]*>\s*$/);
    await submit('E');
    await submit('0200');
    await waitFor(/0200 5A\s*$/);
    await terminal.getByTestId('bw-machine-fullscreen').click();
    await terminal.getByRole('button', {name: 'Exit full screen', exact: true}).click();
    await page.getByTestId('bw-ctl-mode-edit').click();
    await page.getByRole('button', {name: '+ Add Widget', exact: true}).click();
    await page.getByRole('button', {name: 'Button', exact: true}).click();
    const unrelatedWidget = page.getByTestId('bw-ctl-widget-btn1');
    await unrelatedWidget.waitFor();
    await page.getByTestId('bw-ctl-mode-play').click();
    const surface = page.getByRole('combobox', {name: 'Controller surface'});
    await surface.selectOption('widgets');
    await terminal.waitFor({state: 'hidden'});
    await openLibrary();
    await row.getByLabel('xKIM ROM').setInputFiles(rom);
    await run.click();
    await waitFor(/Extended KIM Monitor v1[.]8[\s\S]*>\s*$/);
    assert.equal(await surface.inputValue(), 'terminal');
    assert.doesNotMatch(await output.textContent(), /HELLO FROM BRICKWRIGHT/);
    await page.getByTitle('Stop', {exact: true}).click();
    await terminal.waitFor({state: 'hidden'});
    await unrelatedWidget.waitFor();
    assert.deepEqual(errors, []);
    console.log('xKIM booted, listed and read session files, handled a missing file, and edited RAM through the Controller terminal.');
} catch (error) {
    console.error(await page.getByTestId('bw-serial-console').allTextContents());
    console.error(await page.getByTestId('bw-machine-manager').allTextContents());
    throw error;
} finally {
    await browser.close();
}
