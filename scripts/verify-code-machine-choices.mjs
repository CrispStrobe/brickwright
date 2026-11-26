// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const app = async () => {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '1');
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-lang-row').waitFor();
    return page;
};

try {
    const menuPage = await app();
    const more = menuPage.getByTestId('bw-lang-more');
    const menu = menuPage.getByTestId('bw-lang-more-menu');
    for (const [kind, title] of [['cardiac', 'CARDIAC'], ['cp1', 'CP1']]) {
        const tab = menuPage.getByTestId(`bw-code-${kind}-tab`);
        assert.equal(await tab.count(), 0);
        await more.click();
        await menu.getByRole('menuitem', {name: title, exact: true}).click();
        if (kind === 'cp1') {
            const ok = menuPage.getByRole('button', {name: 'OK', exact: true});
            await Promise.race([tab.waitFor(), ok.waitFor({state: 'visible'}).then(() => ok.click())]);
        }
        await tab.waitFor();
        assert.equal(await tab.getAttribute('aria-pressed'), 'true');
        await more.click();
        await menu.waitFor();
        assert.equal(await menu.getByRole('menuitem', {name: title, exact: true}).count(), 0);
        await menuPage.keyboard.press('Escape');
        await menuPage.getByRole('button', {name: /Pseudo/, exact: false}).first().click();
        await tab.waitFor({state: 'detached'});
    }
    console.log('CP1 and CARDIAC are offered from +, appear while active and hide again when leaving the tab.');
    await menuPage.close();

    const hosted = await app();
    await hosted.getByTestId('bw-device-select').selectOption('riscv32');
    await hosted.getByRole('button', {name: '🔧 C', exact: true}).click();
    const toolbarRoute = hosted.getByTestId('bw-riscv-c-route');
    if (!(await toolbarRoute.isVisible())) await hosted.getByTestId('bw-code-actions-trigger').click();
    const route = hosted.locator('[data-testid^="bw-riscv-c-route"]:visible');
    assert.equal(await route.locator('option[value="server"]').isEnabled(), true);
    await route.selectOption('server');
    await hosted.keyboard.press('Escape');
    await typeIntoEditor(hosted, '#include <stdio.h>\nint main(void) { puts("RISCV HOSTED CODE OK"); return 0; }\n');
    const compiled = hosted.waitForResponse(response => response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/compile') &&
        response.request().postDataJSON()?.target === 'riscv32-gcc');
    const toolbarRun = hosted.getByTestId('bw-run-c-riscv');
    if (!(await toolbarRun.isVisible())) await hosted.getByTestId('bw-code-actions-trigger').click();
    await hosted.locator('[data-testid="bw-run-c-riscv"]:visible,[data-testid="bw-run-c-riscv-menu"]:visible').click();
    const response = await compiled;
    assert.equal(response.ok(), true, `Compiler HTTP status ${response.status()}`);
    await hosted.getByTestId('bw-serial-console').getByText('RISCV HOSTED CODE OK', {exact: false}).waitFor();
    console.log('The built Code tab compiles with hosted RISC-V GCC and runs the returned image to serial output.');
    await hosted.close();
} finally {
    await browser.close();
}
