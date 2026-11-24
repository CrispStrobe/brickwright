// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(90000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
        localStorage.setItem('bw-right-pane-hidden', '1');
    });
    const requested = new Set();
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path.includes('/cad-sdk/previews/')) requested.add(path);
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'CAD', exact: true}).click();
    await page.waitForFunction(() => window.__bwCad?.editor);
    assert.equal(requested.size, 0);
    await page.getByRole('button', {name: 'Model library', exact: true}).click();
    const library = page.getByRole('dialog', {name: 'Model library', exact: true});
    await library.getByLabel('Model type', {exact: true}).selectOption('models');
    const cards = library.locator('.model-library-card');
    const modelCount = await cards.count();
    assert.ok(modelCount > 200);
    const first = cards.locator('img[src*="/cad-sdk/previews/"]').first();
    await first.waitFor();
    const start = await first.getAttribute('src');
    assert.match(start, /\/cad-sdk\/previews\/[a-f0-9]{64}\.png$/);
    assert.ok(await first.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    const visible = requested.size;
    assert.ok(visible > 0 && visible < 40, `expected viewport-only downloads; saw ${visible}`);
    const card = first.locator('xpath=..');
    const original = await card.elementHandle();
    const title = await card.locator('strong').textContent();
    await card.focus();
    await card.press('Enter');
    assert.ok(await original.evaluate(node => node.isConnected && node.getAttribute('aria-pressed') === 'true'),
        'selection keeps the existing card and its thumbnail');
    assert.ok(await original.evaluate(node => node.getRootNode().activeElement === node), 'selection keeps keyboard focus');
    await library.getByLabel('Search models', {exact: true}).fill(title);
    assert.ok(await original.evaluate(node => node.isConnected), 'a card that still matches a search stays mounted');
    console.log('PASS selecting and narrowing the CAD library retains the matching card');
    await library.getByLabel('Search models', {exact: true}).fill('Adafruit');
    const archive = library.locator('.model-library-list img[data-adafruit-preview][src*="/cad-sdk/previews/"]').first();
    await archive.waitFor();
    assert.ok(await archive.evaluate(image => image.decode().then(() => image.naturalWidth === 256)));
    console.log(`PASS embedded CAD: zero startup PNGs; ${visible} visible-model previews of ${modelCount} model cards; Adafruit preview decoded`);
} finally {
    await browser.close();
}
