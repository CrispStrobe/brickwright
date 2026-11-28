// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the assembled Brickwright frontend URL');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    for (const path of ['functional', 'circuit']) {
        const page = await browser.newPage({viewport: {width: 1520, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
        page.setDefaultTimeout(75000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            await page.getByTestId('bw-file-menu-trigger').click();
            await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
            const dialog = page.getByTestId('bw-machine-manager');
            await dialog.getByRole('combobox', {name: 'Machine type'}).selectOption('eater6502');
            await dialog.getByTestId('bw-mm-path-eater6502').selectOption(path);
            const row = dialog.locator('[data-lesson-id="lesson-msbasic-6502"]');
            const wired = path === 'circuit';
            assert.equal(await row.getByTestId(wired ? 'bw-mm-lesson-run' : 'bw-mm-lesson-wired').count(), 0);
            await row.getByTestId(wired ? 'bw-mm-lesson-wired' : 'bw-mm-lesson-run').click();
            await dialog.waitFor({state: 'hidden'});
            if (wired) {
                await page.waitForFunction(() => {
                    const binding = window.__bwMachineBoard;
                    return window.__bwActiveExample?.id === 'eater6502-bench' &&
                        binding?.board && binding.board === window.__board && /designer board attached/.test(binding.why);
                });
                await page.getByRole('tab', {name: 'Circuit', exact: true}).waitFor();
            } else {
                assert.equal(await page.evaluate(() => Boolean(window.__bwMachineBoard?.board)), false);
            }
            const controller = page.locator('[data-bw-stage-dock="controller"]');
            const terminal = controller.getByTestId('bw-serial-console');
            await terminal.getByText(/MICROSOFT BASIC V1\.1/).waitFor();
            await terminal.getByText(/\bOK\b/).waitFor();
            const input = controller.getByTestId('bw-serial-input');
            await input.fill('print "Path check"; 6*7');
            await input.press('Enter');
            await terminal.getByText(/Path check\s+42/).waitFor();
            assert.doesNotMatch(await terminal.textContent(), /\?SN ERROR/);
            assert.deepEqual(errors, []);
            console.log(`PASS Microsoft BASIC ${path} · boot, Controller input and result 42`);
        } catch (error) {
            console.error(errors, await page.getByTestId('bw-mm-status').allTextContents());
            throw error;
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
