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
    await examples.locator('[data-machine-example="cardiac-echo"]').getByRole('button', {name: 'Open', exact: true}).click();
    await manager.waitFor({state: 'hidden'});
    await page.locator('[data-cardiac-editor]:visible').waitFor();
    await page.getByTestId('bw-code-editor').locator('[data-cardiac-editor] .cm-editor').waitFor();
    assert.equal(await page.getByRole('combobox', {name: 'Example program'}).inputValue(), 'cardiac-echo');
    const toolbar = page.getByTestId('bw-lang-row').locator('[data-cardiac-code-tools]');
    await toolbar.getByRole('button', {name: 'Run source + cards', exact: true}).click();
    const controller = page.locator('[data-cardiac-controller]:visible');
    await controller.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-cardiac-controller]')?.dataset.cardiacStatus === 'halted');
    assert.match(await controller.getByTestId('cardiac-output').textContent(), /042/);
    assert.match(await controller.getByTestId('cardiac-input-queue').textContent(), /1 read/);
    assert.equal(await controller.locator('details').filter({hasText: 'You are the processor'}).evaluate(node => node.open), false);
    const widget = page.getByTestId('bw-ctl-widget-cardiac');
    await widget.locator('[data-cardiac-controller]').waitFor();
    const coverage = await widget.evaluate(element => element.clientWidth / element.parentElement.closest('[data-testid="bw-controller-canvas"]').clientWidth);
    assert.ok(coverage > .9);
    await page.getByRole('button', {name: 'Edit', exact: true}).last().click();
    const header = page.getByTestId('bw-ctl-machine-header-cardiac');
    await header.scrollIntoViewIfNeeded();
    const bounds = await header.boundingBox();
    const originalX = await widget.evaluate(element => element.offsetLeft);
    await page.mouse.move(bounds.x + 30, bounds.y + 10);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 70, bounds.y + 10, {steps: 4});
    await page.mouse.up();
    await page.waitForFunction(original =>
        document.querySelector('[data-testid="bw-ctl-widget-cardiac"]')?.offsetLeft > original, originalX);
    await page.getByTestId('bw-ctl-insp-ok').click();
    const remove = page.getByTestId('bw-ctl-remove-cardiac');
    const add = page.getByRole('button', {name: '+ Add Widget', exact: true});
    await add.click();
    await page.getByRole('button', {name: 'Button', exact: true}).click();
    await page.getByTestId('bw-ctl-widget-btn1').waitFor();
    await remove.click();
    await widget.waitFor({state: 'hidden'});
    await add.click();
    await page.getByRole('button', {name: 'CARDIAC display', exact: true}).click();
    await widget.locator('[data-cardiac-controller]').waitFor();
    await page.getByTestId('bw-ctl-widget-btn1').waitFor();
    assert.match(await widget.getByTestId('cardiac-output').textContent(), /042/);
    console.log('The CARDIAC firmware catalog opens and runs an authored program in Code and Controller.');
} finally {
    await browser.close();
}
