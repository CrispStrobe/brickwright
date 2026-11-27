// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of the Brickwright frontend');
const engine = process.env.BW_BROWSER_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({headless: true,
    executablePath: engine === chromium ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined});
try {
    const page = await browser.newPage({viewport: {width: 1260, height: 840}, locale: 'en-US', serviceWorkers: 'block'});
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', {value: 'MacIntel'});
        window.__TAURI__ = {};
        localStorage.setItem('bw-starter-v1-complete', '1');
    });
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const trigger = page.getByTestId('bw-device-picker-trigger');
    await trigger.waitFor({state: 'attached'});
    assert.match(await trigger.innerText(), /^Scratch stage\s+▾$/);
    assert.equal(await trigger.evaluate(button => getComputedStyle(button).whiteSpace), 'nowrap');

    await page.getByTestId('bw-code-actions-trigger').click();
    const menu = page.getByTestId('bw-code-actions-menu');
    const examples = menu.getByTestId('bw-load-example');
    await examples.waitFor();
    assert.equal(await menu.locator('[data-code-menu-group]').first().getAttribute('aria-label'), 'Examples');
    const games = examples.locator('optgroup[label="Games"] option');
    assert.ok(await games.count() > 30);
    assert.ok((await games.allTextContents()).every(title => !/\s[–—-]\s/.test(title)));
    assert.match(await games.first().innerText(), /Nova Grid$/);
    await page.keyboard.press('Escape');

    await trigger.click();
    const picker = page.getByTestId('bw-mac-device-menu');
    await picker.waitFor();
    const scratch = picker.getByRole('menuitemradio', {name: 'Scratch stage', exact: true});
    const cp1 = picker.getByRole('menuitemradio', {name: 'Kosmos CP1', exact: true});
    assert.equal(await scratch.getAttribute('aria-checked'), 'true');
    assert.equal(await cp1.evaluate(button => button.previousElementSibling?.textContent), 'Intel 8049');
    assert.deepEqual(await cp1.evaluate(button => {
        const style = getComputedStyle(button);
        return [style.textAlign, style.whiteSpace];
    }), ['left', 'nowrap']);
    await cp1.press('Enter');
    await picker.waitFor({state: 'hidden'});
    await page.getByTestId('bw-code-cp1-tab').waitFor();
    console.log(`PASS ${engine.name()} single-line machine picker, CP1 keyboard launch, and examples first`);
} finally {
    await browser.close();
}
