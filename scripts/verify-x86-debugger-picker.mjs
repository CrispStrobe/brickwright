// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    for (const [kind, variant] of [['i8086', '8086'], ['i80286', '80286'], ['i80386', null]]) {
        const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US'});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.addInitScript(() => {
                localStorage.setItem('bw-starter-v1-complete', '1');
                localStorage.setItem('bw-right-pane-hidden', '1');
            });
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            await page.getByRole('tab', {name: 'Code', exact: true}).click();
            await page.getByTestId('bw-open-circuit-debugger').click();
            const panel = page.locator('[data-debug-panel]:visible');
            await panel.locator('[data-debug-target-controls] select:not(#bw-debug-speed)').first().selectOption(kind);
            await panel.locator('[data-debug-run]').click();
            await page.waitForFunction(() => {
                const target = window.__benchTarget;
                const regs = target?.regs();
                return regs && (regs.cycles > 1000 || regs.eip > 1000) && target.video()?.width > 0;
            }, null, {timeout: 20000});
            const screen = page.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-machine-canvas');
            await screen.waitFor();
            assert.equal(await page.locator('[data-vdp-screen]').count(), 0);
            if (variant) {
                const topology = await page.evaluate(() => window.__benchTarget.captureCheckpoint().topology);
                assert.equal(JSON.parse(topology).variant, variant);
            }
            assert.deepEqual(errors, []);
            console.log(`${kind} from Debugger → Run executes the bundled BIOS and drives video`);
        } catch (error) {
            console.error(await page.locator('[data-debug-panel]:visible').innerText({timeout: 2000}).catch(() => 'Debugger closed'));
            throw error;
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
