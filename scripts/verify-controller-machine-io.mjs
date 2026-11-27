// SPDX-License-Identifier: BSD-3-Clause
import {openCodeInfo} from './lib-code-actions.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

// Forward the actual build request to a test deployment when rehearsing rollout.
if (process.env.BW_CPM_TEST_COMPILER) {
    await page.route('https://stc-compiler.vercel.app/compile', async route => {
        if (route.request().postDataJSON().target !== 'z80-cpm') return route.fallback();
        const response = await route.fetch({url: new URL('/compile', process.env.BW_CPM_TEST_COMPILER).href});
        return route.fulfill({response, headers: {...response.headers(), 'access-control-allow-origin': '*'}});
    });
}

const manager = async machine => {
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption(machine);
};
const dock = page.locator('[data-bw-stage-dock="controller"]');
const terminal = dock.getByTestId('bw-machine-terminal');
const linux = terminal.getByTestId('bw-linux-terminal');
const read = (selector, pattern, timeout = 60000) => page.waitForFunction(
    ({selector, pattern, flags}) => new RegExp(pattern, flags).test(document.querySelector(selector)?.innerText || ''),
    {selector, pattern: pattern.source, flags: pattern.flags}, {timeout});
const shell = pattern => read('[data-bw-stage-dock="controller"] .xterm-rows', pattern, 150000);
const serial = pattern => read('[data-bw-stage-dock="controller"] [data-testid="bw-serial-console"]', pattern);
const fullscreen = async () => {
    await terminal.getByRole('button', {name: 'Full screen', exact: true}).click();
    const bounds = await terminal.boundingBox();
    assert.ok(bounds.width >= 1420 && bounds.height >= 880, JSON.stringify(bounds));
    await terminal.getByRole('button', {name: 'Exit full screen', exact: true}).click();
};

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await manager('riscv32');
    await page.locator('[data-lesson-id="lesson-linux-riscv32"]').getByTestId('bw-mm-lesson-run').click();
    await shell(/bwb#/);
    assert.equal(await page.locator('[data-debugger-solo-pane]:visible').count(), 0,
        'Controller owns the right pane while the debugger stays mounted');
    assert.equal(await terminal.getByText('uname -a', {exact: false}).count(), 0);
    await terminal.getByRole('button', {name: 'Screen help'}).click();
    await terminal.getByRole('note').getByText('try uname -a', {exact: false}).waitFor();
    await terminal.getByRole('button', {name: 'Screen help'}).click();
    await linux.locator('textarea').focus();
    await page.keyboard.type('uname -a');
    await page.keyboard.press('Enter');
    await shell(/Linux .+riscv32/);
    await fullscreen();
    await page.getByTitle('Debugger', {exact: true}).click();
    assert.equal(await page.getByTestId('bw-linux-terminal').count(), 0, 'Linux terminal belongs to Controller');
    await page.getByTitle('Controller', {exact: true}).click();
    await shell(/Linux .+riscv32/);
    console.log('Linux boot, keyboard, help, full screen, debugger separation and retained session passed.');

    await manager('z80');
    await page.getByRole('searchbox', {name: 'Search firmware'}).fill('CP/M Sieve');
    await page.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    await serial(/2 3 5 7 11 13 17 19 23 29 31 37 41 43 47/);
    await read('.cm-content', /static unsigned char composite/);
    await fullscreen();
    await page.evaluate(() => { window.previousSieveTarget = window.__benchTarget; });
    await page.getByTitle('Go', {exact: true}).click();
    await page.waitForFunction(() => window.__benchTarget && window.__benchTarget !== window.previousSieveTarget);
    await serial(/2 3 5 7 11 13 17 19 23 29 31 37 41 43 47/);
    console.log('CP/M Sieve opened the exact C source, ran in Controller and restarted from Code.');

    const source = await page.locator('.cm-content .cm-line').allTextContents();
    assert.ok(source.some(line => line.includes('#define N 50')));
    await typeIntoEditor(page, source.join('\n').replace('#define N 50', '#define N 60'));
    await page.getByTitle('Go', {exact: true}).click();
    await serial(/47 53 59/);
    await page.evaluate(() => { window.editedSieveTarget = window.__benchTarget; });
    await typeIntoEditor(page, 'void main(void) { syntax error; }');
    await page.getByTitle('Go', {exact: true}).click();
    await openCodeInfo(page);
    await read('[data-testid="bw-code-status"]', /main\.c:1/);
    await page.getByRole('button', {name: 'Close Code help'}).click();
    assert.ok(await page.evaluate(() => window.__benchTarget === window.editedSieveTarget),
        'A failed build preserves the running CP/M guest');
    await serial(/47 53 59/);
    console.log('Edited CP/M C printed the new primes through 59. A syntax error left the guest intact.');

    await page.getByTestId('bw-lang-more').click();
    await page.getByTestId('bw-lang-more-menu').getByRole('menuitem', {name: /Tcl/}).click();
    const empty = page.getByRole('button', {name: /Open an empty tcl editor/i});
    await Promise.race([empty.waitFor().then(() => empty.click()),
        page.getByRole('button', {name: '○ Tcl', exact: true, pressed: true}).waitFor()]);
    await typeIntoEditor(page, 'puts "ACTIVE-TCL-FLAG-123"');
    await page.getByTitle('Go', {exact: true}).click();
    await read('[data-testid="bw-tcl-output"]', /ACTIVE-TCL-FLAG-123/);
    assert.deepEqual(errors, []);
    console.log('The green flag ran the current Tcl source with the prior CP/M guest attached.');
} finally {
    await browser.close();
}
