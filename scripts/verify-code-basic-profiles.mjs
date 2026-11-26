// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const profiles = [
    ['bbc', 'BBC BASIC', false],
    ['ms', '6502 BASIC', false],
    ['i8086', '8086 BASIC (native)', true],
    ['i8086-dos', '8086 BASIC (real MS-DOS 2.0)', true],
    ['i8086-ubasic', 'BASIC (uBASIC on DOS)', false]
];
const failures = [];
try {
    for (const [profile, label, controller] of profiles) {
        const page = await browser.newPage({viewport: {width: 1600, height: 950}, locale: 'en-US', serviceWorkers: 'block'});
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.addInitScript(() => {
            localStorage.setItem('bw-starter-v1-complete', '1');
            localStorage.setItem('bw-right-pane-hidden', '0');
        });
        const output = controller ? page.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-serial-console')
            : page.getByTestId('bw-basic-output');
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            await page.getByRole('tab', {name: 'Code', exact: true}).click();
            await page.getByRole('button', {name: /BAS$/, exact: false}).click();
            await typeIntoEditor(page, '10 PRINT 37*3\n20 END\n');
            await page.getByRole('combobox', {name: /Profile/}).selectOption(profile);
            assert.match(await page.locator('.cm-content').innerText(), /37\*3/);
            const run = page.getByRole('button', {name: /Run BASIC/});
            if (!await run.isVisible()) await page.getByTestId('bw-code-actions-trigger').click();
            await run.click();
            await output.getByText(/\b111\b/).waitFor({timeout: 45000});

            await typeIntoEditor(page, '10 PRINT 67*2\n20 END\n');
            await page.getByTitle('Go', {exact: true}).click();
            await output.getByText(/\b134\b/).waitFor({timeout: 45000});
            if (profile === 'i8086-dos') {
                const text = await output.innerText();
                assert.match(text, /MS-DOS version 2\.00/);
                assert.doesNotMatch(text, /Invalid date|Enter new date: PROG/);
                const input = page.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-serial-input');
                await input.fill('ECHO KEYBOARDOK');
                await input.press('Enter');
                await output.getByText(/\nKEYBOARDOK/).waitFor({timeout: 20000});
            }
            assert.deepEqual(errors, []);
            console.log(`PASS ${label} · preserved source, Run BASIC, green flag${profile === 'i8086-dos' ? ', DOS keyboard' : ''}`);
        } catch (error) {
            const [status, editor, observed] = await Promise.all([
                page.getByTestId('bw-code-status').allTextContents(),
                page.locator('.cm-content').allTextContents(),
                output.allTextContents()
            ]);
            failures.push(label);
            console.error(`FAIL ${label}: ${error.message}\n`, {status, editor, observed, errors});
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
assert.deepEqual(failures, []);
