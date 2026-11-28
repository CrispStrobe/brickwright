// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const [url, rom, program] = process.argv.slice(2);
assert.ok(url && rom && program, 'Pass the app URL, locally built xKIM ROM and Media Lab TIMER.HEX.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const terminal = page.getByTestId('bw-machine-terminal');
const output = terminal.getByTestId('bw-serial-console');
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const library = page.getByTestId('bw-machine-manager');
    const row = library.getByTestId('bw-mm-xkim');
    const input = terminal.getByRole('textbox', {name: 'xKIM command'});
    const waitFor = pattern => output.filter({hasText: pattern}).waitFor();
    const submit = async line => {
        await input.fill(line);
        await input.press('Enter');
    };
    for (const wire of ['none', 'irq', 'nmi']) {
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        await library.getByRole('combobox', {name: 'Machine type'}).selectOption('kim1');
        const timer = row.getByRole('combobox', {name: 'xKIM timer output'});
        if (wire === 'none') assert.equal(await timer.inputValue(), 'none');
        await timer.selectOption(wire);
        await row.getByLabel('xKIM ROM').setInputFiles(rom);
        await row.getByLabel('xKIM Corsham files').setInputFiles(program);
        await row.getByRole('button', {name: 'Run', exact: true}).click();
        await library.waitFor({state: 'hidden'});
        await waitFor(/Extended KIM Monitor v1[.]8[\s\S]*>\s*$/);

        await submit('L');
        await waitFor(/load from console:\s*$/);
        await submit('TIMER.HEX');
        await waitFor(/TIMER[.]HEX[\s\S]*Success![\s\S]*>\s*$/);
        await submit('J');
        await waitFor(/>J\s*$/);
        await submit('0200');
        await waitFor(wire === 'none' ? /NO TIMER INTERRUPT[\s\S]*>\s*$/ : /TIMER OK[\s\S]*>\s*$/);
        await page.getByTitle('Stop', {exact: true}).click();
        await terminal.waitFor({state: 'hidden'});
        console.log(`xKIM timer ${wire} matched the guest's interrupt check.`);
    }
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(await output.allTextContents());
    console.error(errors);
    throw error;
} finally {
    await browser.close();
}
