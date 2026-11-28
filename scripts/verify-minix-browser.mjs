// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
const screenText = pattern => {
    const bytes = window.__benchTarget?.readMem('mem', 0xb8000, 4000);
    const text = bytes ? Array.from({length: 25}, (_, row) => String.fromCharCode(...Array.from({length: 80},
        (_, col) => bytes[(row * 80 + col) * 2] || 32)).trimEnd()).join('\n') : '';
    return pattern ? new RegExp(pattern.source, pattern.flags).test(text) : text;
};
const waitScreen = (pattern, timeout = 120000) => page.waitForFunction(screenText,
    {source: pattern.source, flags: pattern.flags}, {timeout});
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-right-pane-hidden', '1');
});

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    const dialog = page.getByTestId('bw-machine-manager');
    await dialog.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    const row = dialog.locator('[data-machine-media="minix-2.0"]');
    await row.getByTestId('bw-mm-item-info').click();
    await row.getByText(/press = to boot MINIX/).waitFor();
    assert.match(await row.getByRole('link', {name: 'BSD-3-Clause'}).getAttribute('href'),
        /\/[0-9a-f]{40}\/projects\/minix-2\.0\/LICENSE$/);
    await row.getByRole('button', {name: 'Run', exact: true}).click();
    await dialog.waitFor({state: 'hidden'});

    const controller = page.locator('[data-bw-stage-dock="controller"]');
    const canvas = controller.getByTestId('bw-machine-canvas');
    await canvas.waitFor();
    await waitScreen(/Minix boot monitor/i);
    await page.waitForFunction(() => {
        const node = document.querySelector('[data-bw-stage-dock="controller"] [data-testid="bw-machine-canvas"]');
        return node?.getContext('2d').getImageData(0, 0, node.width, node.height).data
            .some((value, i) => i % 4 !== 3 && value > 70);
    });
    const fullScreen = controller.getByTestId('bw-machine-fullscreen');
    await fullScreen.click();
    assert.equal(await fullScreen.innerText(), 'Exit full screen');
    await canvas.click();
    await page.keyboard.press('Equal');
    await waitScreen(/login:/);
    assert.match(await page.evaluate(screenText), /Executing in 16-bit protected mode/i);
    await page.keyboard.type('root', {delay: 50});
    await page.keyboard.press('Enter');
    await waitScreen(/^#\s*$/m);
    await fullScreen.click();
    assert.equal(await fullScreen.innerText(), 'Full screen');
    await canvas.click();
    await page.keyboard.type('ls /', {delay: 35});
    await page.keyboard.press('Enter');
    await waitScreen(/\bbin\s+etc\s+fd1\s+root\s+usr\b/, 20000);
    await page.keyboard.type('echo brickwright shell works', {delay: 35});
    await page.keyboard.press('Enter');
    await waitScreen(/^brickwright shell works$/m, 20000);
    assert.deepEqual(errors, []);
    console.log('Machines launched MINIX on the free 386. Controller displayed the boot monitor, logged in, and listed the root directory and ran a shell command after leaving full screen.');
} catch (error) {
    console.error(await page.evaluate(screenText).catch(() => 'Screen unavailable'));
    const manager = page.getByTestId('bw-machine-manager');
    if (await manager.isVisible()) console.error(await manager.getByRole('alert').allTextContents());
    throw error;
} finally {
    await browser.close();
}
