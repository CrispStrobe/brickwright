// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:8242/';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(45000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
    });
    await page.goto(base, {waitUntil: 'commit'});
    await page.getByTitle('Add Extension', {exact: true}).click();
    const search = page.getByPlaceholder('Search', {exact: true});
    await search.fill('CAD');
    for (const poster of ['cad-models', 'cad-shapes']) {
        const banner = page.locator(`img[src$="/${poster}.webp"]`);
        const card = banner.locator('../..');
        const badge = card.locator('img[src$="/cad-cube.svg"]');
        await banner.scrollIntoViewIfNeeded();
        assert.ok(await banner.evaluate(async image => {
            await image.decode();
            return image.naturalWidth > image.naturalHeight && image.clientWidth > 150;
        }));
        assert.ok(await badge.evaluate(async image => {
            await image.decode();
            return image.clientWidth > 0 && image.clientWidth < 100;
        }));
    }
    console.log('PASS both CAD cards have a distinct wide banner and a visible cube inset');
    await page.getByText('Back', {exact: true}).click();

    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await page.getByTestId('bw-circuit-panel-examples').first().click();
    await page.getByPlaceholder(/^Search \d+ examples/).first().fill('Busch Microtronic');
    const lesson = page.locator('[data-example-id="busch-microtronic-wired-io"]:visible');
    const thumbnail = lesson.locator('img[data-example-artwork]');
    await thumbnail.scrollIntoViewIfNeeded();
    assert.ok(await thumbnail.evaluate(async image => {
        await image.decode();
        return image.naturalWidth > 0;
    }));
    await lesson.getByText(/Busch Microtronic 2090: Wired I\/O/).click();

    await page.getByRole('button', {name: 'OK', exact: true}).click();

    const panel = page.locator('[data-microtronic-panel="microtronic"]:visible');
    await panel.getByRole('button', {name: 'Run', exact: true}).click();
    await page.locator('[data-switch-control="input1"]:visible').click();
    await page.waitForFunction(() => {
        const board = window.__board;
        const state = board?.getDeviceState('microtronic');
        return state?.running && (state.output & 7) === 1 && board.ledBrightness('lamp1') > 0.01;
    });
    await page.waitForFunction(() => window.__board?.getDeviceState('microtronic')?.output === 9);
    await page.waitForFunction(() => window.__board?.getDeviceState('microtronic')?.output === 1);

    await panel.getByRole('button', {name: 'Halt', exact: true}).click();
    await panel.getByRole('textbox', {name: 'Microtronic program', exact: true}).fill('00: 1A0\n01: FE0\n02: F00');
    await panel.getByRole('button', {name: 'Run', exact: true}).click();
    await page.waitForFunction(() => {
        const state = window.__board?.getDeviceState('microtronic');
        const part = window.__circuit?.getPart('microtronic');
        return state?.output === 10 && !state.running && part?.params.program.includes('00: 1A0');
    });
    console.log('PASS Brickwright’s gallery loads the front panel, physical I/O, and editable learner program');
} finally {
    await browser.close();
}
