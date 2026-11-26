// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the frontend assembled with CAD and FPGA');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1170, height: 800}, locale: 'en-US', serviceWorkers: 'block'});
const checks = [];
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-right-pane-hidden', '1');
    localStorage.setItem('bw-cad-enabled', '1');
    localStorage.setItem('bw-fpga-enabled', '1');
});
const check = async (label, menu) => {
    await menu.waitFor();
    const appearance = await menu.evaluate(node => {
        const style = getComputedStyle(node);
        return [style.backgroundColor, style.borderRadius, style.scrollbarWidth];
    });
    assert.deepEqual(appearance, ['rgb(255, 255, 255)', '8px', 'thin'], label);
    checks.push(label);
    await page.keyboard.press('Escape');
};
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-code-actions-trigger').click();
    await check('Code', page.getByTestId('bw-code-actions-menu'));
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.getByRole('button', {name: 'More circuit controls'}).first().click();
    await check('Circuit', page.locator('[data-toolbar-more-menu]:visible').first());
    await page.getByRole('tab', {name: 'Robots', exact: true}).click();
    await page.getByTestId('bw-sim-lab-more').click();
    await check('Robots', page.getByTestId('bw-sim-lab-more-menu'));
    await page.getByRole('tab', {name: /CAD/}).click();
    await page.locator('.command-menu summary:visible').first().click();
    await check('CAD', page.locator('.command-menu[open] .command-popup:visible').first());
    const fpga = page.getByRole('tab', {name: /FPGA/});
    await fpga.click();
    await page.getByTestId('bw-fpga-info-help-button').waitFor();
    assert.equal(await fpga.getAttribute('aria-selected'), 'true');
    console.log(`Shared popup styling verified for ${checks.join(', ')}. FPGA opens in the full build.`);
} finally {
    await browser.close();
}
