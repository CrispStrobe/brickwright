// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {chromium} from 'playwright';

const [url, rom, fatImage] = process.argv.slice(2);
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
    if (fatImage) {
        await row.getByLabel('xKIM storage type').selectOption('fat');
        await run.click();
        await library.getByText('Choose an xKIM FAT image.', {exact: true}).waitFor();
        const imageInput = row.getByLabel('xKIM FAT image');
        await imageInput.setInputFiles({name: 'invalid.img', mimeType: 'application/octet-stream', buffer: Buffer.alloc(512)});
        await run.click();
        await library.getByText(/choose a valid FAT12, FAT16 or FAT32 volume/).waitFor();
        await imageInput.setInputFiles(fatImage);
    } else {
        await row.getByLabel('xKIM Corsham files').setInputFiles([
            {name: 'HELLO.TXT', mimeType: 'text/plain', buffer: Buffer.from('HELLO FROM BRICKWRIGHT\r\n')},
            {name: 'README.ME', mimeType: 'text/plain', buffer: Buffer.from('SECOND FILE\r\n')}
        ]);
    }
    await run.click();
    await library.waitFor({state: 'hidden'});

    const terminal = page.getByTestId('bw-machine-terminal');
    const output = terminal.getByTestId('bw-serial-console');
    const input = terminal.getByRole('textbox', {name: 'xKIM command'});
    const waitFor = pattern => output.filter({hasText: pattern}).waitFor();
    const submit = async line => {await input.fill(line); await input.press('Enter');};
    await waitFor(/Extended KIM Monitor v1[.]8[\s\S]*>\s*$/);
    const beforeClock = Math.floor(Date.now() / 1000) * 1000;
    await submit('C');
    const clockPattern = /Date: (\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/;
    await waitFor(new RegExp(clockPattern.source + '[\\s\\S]*>\\s*$'));
    const [, month, day, year, hour, minute, second] = (await output.textContent()).match(clockPattern);
    const guestClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
    assert.ok(guestClock >= beforeClock && guestClock <= Date.now(), 'xKIM clock matches current UTC');
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
    await submit('S');
    await waitFor(/>S\s*$/);
    await submit('0200');
    await waitFor(/0200-\s*$/);
    await submit('0200');
    await waitFor(/display to console:\s*$/);
    await submit('SAVE.HEX');
    await waitFor(/SAVE[.]HEX[\s\S]*>\s*$/);
    await submit('T');
    await waitFor(/Enter filename:\s*$/);
    await submit('SAVE.HEX');
    await waitFor(/:010200005AA3[\s\S]*:00000001FF[\s\S]*>\s*$/);

    await submit('E');
    await submit('0200');
    await waitFor(/0200 5A\s*$/);
    await submit('00');
    await waitFor(/0201 00\s*$/);
    await submit('?');
    await waitFor(/0201 00[\s\S]*>\s*$/);
    await submit('L');
    await waitFor(/load from console:\s*$/);
    await submit('SAVE.HEX');
    await waitFor(/load from console: SAVE[.]HEX[\s\S]*>\s*$/);
    await submit('E');
    await submit('0200');
    await waitFor(/0200 5A\s*$/);

    const downloading = page.waitForEvent('download');
    await terminal.getByRole('button', {name: 'Export files', exact: true}).click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), 'xkim-files.zip');
    const archive = await JSZip.loadAsync(await readFile(await download.path()));
    assert.deepEqual(Object.keys(archive.files).sort(), ['HELLO.TXT', 'README.ME', 'SAVE.HEX']);
    assert.equal(await archive.file('SAVE.HEX').async('string'), ':010200005AA3\r\n:00000001FF');
    assert.equal(await archive.file('HELLO.TXT').async('string'), 'HELLO FROM BRICKWRIGHT\r\n');

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
    console.log(`xKIM booted from ${fatImage ? 'a FAT image' : 'loose files'}, read the UTC clock, saved and reloaded Intel HEX, and exported the exact session files through Controller.`);
} catch (error) {
    console.error(await page.getByTestId('bw-serial-console').allTextContents());
    console.error(await page.getByTestId('bw-machine-manager').allTextContents());
    throw error;
} finally {
    await browser.close();
}
