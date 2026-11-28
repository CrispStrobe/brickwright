// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the assembled Brickwright frontend URL');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1520, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.setDefaultTimeout(60000);
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    for (const path of ['circuit', 'functional']) {
        const wired = path === 'circuit';
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        const dialog = page.getByTestId('bw-machine-manager');
        await dialog.getByRole('searchbox', {name: 'Search firmware'}).fill('Z80 ACIA Echo');
        await dialog.getByTestId('bw-mm-path-z80').selectOption(path);
        const row = dialog.locator('[data-lesson-id="lesson-z80-acia-echo"]');
        assert.equal(await row.getByTestId(wired ? 'bw-mm-lesson-run' : 'bw-mm-lesson-wired').count(), 0);
        await row.getByTestId(wired ? 'bw-mm-lesson-wired' : 'bw-mm-lesson-run').click();
        await dialog.waitFor({state: 'hidden'});
        if (wired) {
            await page.waitForFunction(() => {
                const binding = window.__bwMachineBoard;
                return window.__bwActiveExample?.id === 'z80-bench' && binding?.board &&
                    binding.board === window.__board && /designer board attached/.test(binding.why);
            });
        } else {
            await page.waitForFunction(() => window.__bwMachineBoard?.why === 'library machine map' &&
                window.__bwMachineBoard.board === null);
        }
        const controller = page.locator('[data-bw-stage-dock="controller"]');
        const output = controller.getByTestId('bw-serial-console');
        const input = controller.getByTestId('bw-serial-input');
        await page.waitForFunction(() => window.__benchTarget?.regs()?.pc >= 8);
        for (const line of [`ACIA ${path} Z80?`, 'second line 42!']) {
            await input.fill(line);
            await input.press('Enter');
            await output.filter({hasText: line}).waitFor();
            assert.ok((await output.textContent()).split('\n').includes(line));
        }
        if (!wired) assert.doesNotMatch(await output.textContent(), /ACIA circuit/);
        console.log(`PASS Z80 ${path} · the MC6850 echoed both Controller lines`);
    }
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(errors, await page.getByTestId('bw-mm-status').allTextContents());
    console.error(await page.getByTestId('bw-serial-console').allTextContents());
    throw error;
} finally {
    await browser.close();
}
