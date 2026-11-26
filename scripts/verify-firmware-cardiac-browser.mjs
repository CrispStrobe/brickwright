// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of a built Brickwright app.');
const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true
});
try {
    const page = await browser.newPage({viewport: {width: 1530, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(60_000);
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Circuit', exact: true}).waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-open-machine-manager', {
        detail: {kind: 'cardiac'}
    })));
    const manager = page.getByTestId('bw-machine-manager');
    await manager.waitFor();
    assert.equal(await manager.getByRole('combobox', {name: 'Machine type'}).inputValue(), 'cardiac');
    assert.equal(await manager.getByTestId('bw-mm-local-386').count(), 0);
    const examples = manager.getByTestId('bw-mm-circuit-programs');
    await examples.getByText('Example programs (6)').click();
    await examples.getByText('CARDIAC: A number makes a round trip', {exact: true})
        .locator('..').getByRole('button', {name: 'Open', exact: true}).click();
    await manager.waitFor({state: 'hidden'});
    await page.locator('[data-cardiac-editor]:visible').waitFor();
    await page.locator('[data-cardiac-editor]').getByRole('button', {name: 'Run source + cards', exact: true}).click();
    const controller = page.locator('[data-cardiac-controller]:visible');
    await controller.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-cardiac-controller]')?.dataset.cardiacStatus === 'halted');
    assert.match(await controller.getByTestId('cardiac-output').textContent(), /042/);
    console.log('The CARDIAC firmware catalog opens and runs an authored program in Code and Controller.');
} finally {
    await browser.close();
}
