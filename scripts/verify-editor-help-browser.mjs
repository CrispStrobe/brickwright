// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true
});
const page = await browser.newPage({viewport: {width: 1600, height: 950}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(90000);
const tab = name => page.getByRole('tab', {name, exact: true});
const help = page.getByTestId('bw-editor-help');
const dialog = page.getByTestId('bw-editor-help-dialog');
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-cad-enabled', '1');
});
try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:8226/', {waitUntil: 'commit'});
    const artworkTab = page.getByRole('tab', {name: /^(Costumes|Backdrops)$/});
    await artworkTab.waitFor();
    const artwork = await artworkTab.getAttribute('aria-label');
    for (const [name, term] of [
        ['Blocks', 'Blocks palette'], [artwork, 'Tools'], ['Sounds', 'Sound list and waveform'],
        ['Code', 'Code and Blocks'], ['Circuit', 'Parts and wires'], ['Robots', 'Two-finger slide'], ['CAD', 'Two-finger slide']
    ]) {
        await tab(name).click();
        assert.equal(await help.getAttribute('aria-label'), `${name} help`);
        await help.click();
        await dialog.waitFor();
        await dialog.getByText(term, {exact: true}).waitFor();
        if (name === 'Robots' || name === 'CAD') {
            assert.match(await dialog.innerText(), /Pan · with Shift Orbit/);
            assert.match(await dialog.innerText(), /Orbit · with Shift Pan/);
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({state: 'hidden'});
        assert.equal(await help.evaluate(node => node === document.activeElement), true);
    }
    await tab('Blocks').click();
    const showRight = page.getByRole('button', {name: 'Show right panel'});
    if (await showRight.isVisible()) await showRight.click();
    await page.locator('button[title="Controller"]:visible').click();
    await page.getByTestId('bw-widgets-help').click();
    const widgets = page.getByTestId('bw-widgets-help-dialog');
    await widgets.getByText('Build a controller', {exact: true}).waitFor();
    await widgets.getByRole('button', {name: 'Close', exact: true}).click();
    await tab('CAD').click();
    await page.evaluate(() => localStorage.setItem('bw-3d-camera-preferences',
        JSON.stringify({trackpadSlide: 'orbit', secondaryDrag: 'pan'})));
    await help.click();
    assert.match(await dialog.innerText(), /Two-finger slide\s+Orbit · with Shift Pan/);
    await dialog.getByRole('button', {name: 'Close', exact: true}).click();
    await page.waitForFunction(() => window.__bwCad?.editor);

    const tools = page.locator('summary[aria-label="More sketch tools"]');
    const sketch = page.getByRole('button', {name: 'Sketch', exact: true});
    const path = page.getByRole('button', {name: 'Sketch path', exact: true});
    await sketch.waitFor();
    assert.equal(await path.isVisible(), false);
    await tools.click();
    await path.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await path.isVisible(), false);
    await tools.click();
    await path.click();
    await page.getByRole('dialog', {name: 'Sketch path', exact: true}).waitFor();
    console.log('PASS editor help, dynamic gesture reference, modal keyboard focus, and embedded sketch dropdown');
} finally {
    await browser.close();
}
