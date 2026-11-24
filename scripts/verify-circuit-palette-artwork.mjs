// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1420, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(120000);
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    const palette = page.locator('[data-parts-palette]:visible').first();
    const near = palette.locator('[data-palette-kind="pi_pico"]').first();
    const scope = palette.locator('[data-palette-kind="oscilloscope"]').first();
    const waitForArtwork = async card => {
        await card.scrollIntoViewIfNeeded();
        const image = await card.locator('img').elementHandle();
        await page.waitForFunction(el => el.complete && el.naturalWidth > 0, image);
    };

    await waitForArtwork(near);
    const before = await palette.locator('img').count();
    console.log(`Parts palette has ${before} image elements across ${await palette.locator('[data-palette-kind]').count()} cards before visiting instruments`);
    assert.equal(await scope.locator('img').count(), 0, 'offscreen oscilloscope art should be deferred');
    assert.ok(before > 0 && before < 30, 'the initial palette should only render artwork for a small portion of the cards');
    await waitForArtwork(scope);
    await palette.getByRole('textbox').fill('oscilloscope');
    await waitForArtwork(scope);
    console.log('PASS Circuit palette loads artwork on scroll and finds it again through search');
} finally {
    await browser.close();
}
