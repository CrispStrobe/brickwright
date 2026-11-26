// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
});
try {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await page.getByTestId('bw-circuit-panel-examples').first().click();
    await page.getByPlaceholder(/^Search \d+ examples/).first().fill('Busch Microtronic');
    await page.locator('[data-example-id="busch-microtronic-wired-io"]:visible')
        .getByText(/Busch Microtronic 2090: Wired I\/O/).click();
    await page.getByRole('button', {name: 'OK', exact: true}).click();

    const panel = page.locator('[data-microtronic-panel="microtronic"][data-microtronic-view="front"]:visible');
    const mode = panel.getByRole('combobox', {name: 'Microtronic execution mode'});
    assert.equal(await mode.inputValue(), 'documented-behavior');
    await mode.selectOption('tms1600');
    await page.waitForFunction(() => window.__board?.getDeviceState('microtronic')?.model === 'tms1600');

    await panel.getByRole('button', {name: 'Run', exact: true}).click();
    const instruments = page.getByRole('button', {name: 'Expand instruments panel', exact: true});
    if (await instruments.isVisible()) await instruments.click();
    await page.locator('[data-switch-control="input1"]:visible').click();
    await page.waitForFunction(() => {
        const board = window.__board;
        const state = board?.getDeviceState('microtronic');
        return state?.running && state.nativeInstructions > state.executed &&
            (state.output & 7) === 1 && board.ledBrightness('lamp1') > 0.01;
    });
    await page.waitForFunction(() => window.__board?.getDeviceState('microtronic')?.output === 9);
    await panel.getByRole('button', {name: 'Halt', exact: true}).click();

    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-code-microtronic-tab').click();
    const code = page.locator('[data-microtronic-view="code"]:visible');
    await code.locator('.cm-content').waitFor();
    await typeIntoEditor(page, '@ 00\n1A0\nFE0\nF00');
    await code.getByRole('button', {name: 'Load program', exact: true}).click();
    await panel.getByRole('button', {name: 'Step', exact: true}).click();
    await page.waitForFunction(() => {
        const state = window.__board?.getDeviceState('microtronic');
        return state?.model === 'tms1600' && state.pc === 1 && state.registers[0] === 10;
    });
    await panel.getByRole('button', {name: 'Step', exact: true}).click();
    await page.waitForFunction(() => window.__board?.getDeviceState('microtronic')?.output === 10);
    assert.equal(await page.evaluate(() => window.__circuit.getPart('microtronic').params.executionMode), 'tms1600');
    console.log('PASS native TMS1600 ROM from the Brickwright gallery, wired I/O, and .MIC entry and stepping');
} finally {
    await browser.close();
}
