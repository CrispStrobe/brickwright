// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    const dialog = page.getByTestId('bw-machine-manager');
    await dialog.getByRole('searchbox', {name: 'Search firmware'}).fill('Tali Forth');
    const row = dialog.locator('[data-machine-media="tali-forth-65c02"]');
    await row.getByTestId('bw-mm-item-info').click();
    await row.getByText(/Choose ACIA in Controller/).waitFor();
    assert.match(await row.getByRole('link', {name: 'LicenseRef-Public-Domain'}).getAttribute('href'), /LICENSE\.upstream$/);
    await row.getByRole('button', {name: 'Run', exact: true}).click();
    await dialog.waitFor({state: 'hidden'});

    const controller = page.locator('[data-bw-stage-dock="controller"]');
    const surface = controller.getByRole('combobox', {name: 'Controller surface'});
    await surface.selectOption('terminal');
    const output = controller.getByTestId('bw-serial-console');
    const input = controller.getByTestId('bw-serial-input');
    await output.getByText(/BrickWright Tali Forth 2 - 65C02/).waitFor();
    const command = async (line, receipt) => {
        const replies = () => output.textContent().then(text => [...text.matchAll(new RegExp(receipt.source, 'gm'))].length);
        const before = await replies();
        await input.fill(line);
        await input.press('Enter');
        await page.waitForFunction(({before, pattern}) => {
            const text = document.querySelector('[data-testid="bw-serial-console"]')?.textContent || '';
            return [...text.matchAll(new RegExp(pattern, 'gm'))].length > before;
        }, {before, pattern: receipt.source});
    };
    await command('decimal', / ok/);
    await command(': square dup * ;', / ok/);
    await command('7 square . cr', /^7 square \. cr 49 $/);
    await command(': square dup * 1 + ;', / ok/);
    await command('7 square . cr', /^7 square \. cr 50 $/);
    await command(': pixel >r 64 * + 12288 + r> swap c! ;', / ok/);
    await command(': checker 32 0 do 64 0 do i j + 1 and 255 * i j rot pixel loop loop ;', / ok/);
    await command('checker', / ok/);
    await command('0 0 85 pixel', / ok/);
    await command('170 24576 c! 24576 c@ . cr', /^170 24576 c! 24576 c@ \. cr 170 $/);

    await surface.selectOption('screen');
    const canvas = controller.getByTestId('bw-machine-canvas');
    await canvas.waitFor();
    await page.waitForFunction(() => {
        const frame = document.querySelector('[data-bw-stage-dock="controller"] [data-testid="bw-machine-canvas"]');
        if (frame?.width !== 64 || frame.height !== 32) return false;
        const data = frame.getContext('2d').getImageData(0, 0, 64, 32).data;
        return data[0] === 85 && data[4] === 255;
    });
    const gray = await canvas.evaluate(node => Array.from(node.getContext('2d').getImageData(0, 0, 64, 32).data)
        .filter((_, index) => index % 4 === 0));
    assert.deepEqual(gray, Array.from({length: 2048}, (_, index) => index === 0 ? 85 :
        (Math.floor(index / 64) + index % 64) % 2 * 255));
    const fullScreen = controller.getByTestId('bw-machine-fullscreen');
    await fullScreen.click();
    assert.equal(await fullScreen.innerText(), 'Exit full screen');
    await fullScreen.click();
    await surface.selectOption('terminal');
    await command('7 square . cr', /^7 square \. cr 50 $/);
    assert.deepEqual(errors, []);
    console.log('Tali Forth in Machines accepted definitions and VIA I/O, rendered all 2048 real framebuffer pixels, and kept its dictionary across Controller views.');
} catch (error) {
    console.error(await page.getByTestId('bw-serial-console').allTextContents());
    console.error(await page.getByTestId('bw-machine-manager').getByRole('alert').allTextContents());
    throw error;
} finally {
    await browser.close();
}
