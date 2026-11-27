// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {openCodeActions} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = process.env.BW_BROWSER_ENGINE === 'webkit' ?
    await webkit.launch() : await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const app = async () => {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
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
    const arduboy = await app();
    await typeIntoEditor(arduboy, 'DEVICE ARDUBOY\nGLOBAL score = 0\nSTAGE:\nWHEN flag clicked:\n    set score to 42\n');
    await openCodeActions(arduboy);
    const codeMenu = arduboy.getByTestId('bw-code-actions-menu');
    await codeMenu.getByRole('button', {name: /To blocks$/i}).click();
    await arduboy.waitForFunction(() => {
        const runtime = window.__brickwrightStore?.getState().scratchGui.vm.runtime;
        return runtime?.stc?.device === 'arduboy' &&
            Object.values(runtime.getTargetForStage()?.blocks?._blocks || {}).some(block => block.opcode === 'data_setvariableto');
    });
    await arduboy.close();
    console.log('To blocks applied the Arduboy device and loaded the Scratch script.');

    const python = await app();
    // Expose desktop-only controls without launching a NuttX or Renode backend.
    await python.evaluate(() => { window.__TAURI_INTERNALS__ = {}; });
    await python.getByRole('button', {name: '🐍 Py', exact: true}).click();
    await typeIntoEditor(python, 'print("Python still runs inline")');
    const run = python.getByTestId('bw-code-run');
    assert.match(await run.innerText(), /Run Python/);
    await openCodeActions(python);
    const targets = python.getByTestId('bw-python-run-on');
    assert.match(await targets.locator('summary').innerText(), /Run on/);
    const nuttx = targets.getByRole('button', {name: 'NuttX'});
    const micropython = targets.getByRole('button', {name: 'MicroPython image…'});
    assert.equal(await nuttx.isVisible(), false);
    assert.equal(await micropython.isVisible(), false);
    await targets.locator('summary').click();
    await nuttx.waitFor({state: 'visible'});
    await micropython.waitFor({state: 'visible'});
    assert.equal(await python.getByTestId('bw-code-action-row').getByText(/NuttX|MicroPython image/).count(), 0);
    await python.keyboard.press('Escape');
    await run.click();
    await python.getByText('Python still runs inline', {exact: true}).waitFor();
    console.log('Python ran inline. The desktop targets are available under Run on.');
} finally {
    await browser.close();
}
