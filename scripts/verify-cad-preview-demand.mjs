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
    await page.evaluate(() => {
        const decode = window.atob;
        window.__cadLibraryDecode = {files: 0, bytes: 0};
        const parse = JSON.parse;
        window.__cadLibraryManifestParses = {count: 0, characters: 0};
        JSON.parse = function (text, reviver) {
            const result = parse.call(this, text, reviver);
            if (typeof text === 'string' && /^\s*\{\s*"format"\s*:\s*"brickwright-(?:local-(?:example|fixture)-library|model-library)"/.test(text)) {
                window.__cadLibraryManifestParses.count++;
                window.__cadLibraryManifestParses.characters += text.length;
            }
            return result;
        };
        window.atob = value => {
            const binary = decode(value);
            if (binary.length >= 84 && (binary.length - 84) % 50 === 0) {
                window.__cadLibraryDecode.files++;
                window.__cadLibraryDecode.bytes += binary.length;
            }
            return binary;
        };
    });
    await page.getByRole('button', {name: 'Model library', exact: true}).click();
    const library = page.getByRole('dialog', {name: 'Model library', exact: true});
    await library.getByLabel('Model type', {exact: true}).selectOption('models');
    const cards = library.locator('.model-library-card');
    const first = library.locator('.model-library-card:has(.model-card-meta) img[src*="/cad-sdk/previews/"]').first();
    await first.waitFor();
    const modelCount = Number(await library.locator('.model-library-list').getAttribute('data-model-count'));
    assert.ok(modelCount > 200);
    assert.equal(await cards.count(), 36);
    const firstTitle = await cards.first().locator('strong').textContent();
    const start = await first.getAttribute('src');
    assert.match(start, /\/cad-sdk\/previews\/[a-f0-9]{64}\.png$/);
    assert.ok(await first.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    const visible = requested.size;
    assert.ok(visible > 0 && visible < 40, `expected viewport-only downloads; saw ${visible}`);
    const card = first.locator('xpath=..');
    const original = await card.elementHandle();
    const originalPreview = await first.elementHandle();
    const title = await card.locator('strong').textContent();
    await card.focus();
    await card.press('Enter');
    assert.ok(await original.evaluate(node => node.isConnected && node.getAttribute('aria-pressed') === 'true'),
        'selection keeps the existing card and its thumbnail');
    assert.ok(await original.evaluate(node => node.getRootNode().activeElement === node), 'selection keeps keyboard focus');
    await library.getByLabel('Search models', {exact: true}).fill(title);
    assert.ok(await original.evaluate(node => node.isConnected), 'a card that still matches a search stays mounted');
    console.log('PASS selecting and narrowing the CAD library retains the matching card');
    const search = library.getByLabel('Search models', {exact: true});
    await search.fill('');
    const forward = library.getByRole('button', {name: 'Next page', exact: true});
    const back = library.getByRole('button', {name: 'Previous page', exact: true});
    await forward.click();
    assert.equal(await cards.count(), 36);
    assert.notEqual(await cards.first().locator('strong').textContent(), firstTitle);
    assert.equal(await original.evaluate(node => node.isConnected), false);
    await back.click();
    assert.equal(await cards.count(), 36);
    assert.ok(await original.evaluate(node => node.isConnected && node.getAttribute('aria-pressed') === 'true'),
        'returning to the prior page restores the loaded card and its selection');
    assert.ok(await originalPreview.evaluate(image => image.isConnected && image.complete && image.naturalWidth > 0),
        'returning to the prior page restores the decoded thumbnail');
    console.log('PASS returning to a page reuses its loaded thumbnail and selected card');
    await forward.click();
    await search.fill('5128 MacroPad');
    const archive = library.locator('.model-library-list img[data-adafruit-preview][src*="/cad-sdk/previews/"]').first();
    await archive.waitFor();
    assert.match(await archive.getAttribute('data-adafruit-preview'), /5128 MacroPad/);
    assert.ok(await archive.evaluate(image => image.decode().then(() => image.naturalWidth === 256)));
    await search.fill('');
    assert.equal(await cards.first().locator('strong').textContent(), firstTitle);
    assert.ok(await back.isDisabled());
    console.log(`PASS embedded CAD: 36 mounted cards of ${modelCount} models; ${visible} initial previews; later pages and archive search work`);
    assert.deepEqual(await page.evaluate(() => window.__cadLibraryDecode), {files: 0, bytes: 0},
        'opening, searching and selecting in the gallery must not decode bundled STL geometry');
    const manifests = await page.evaluate(() => window.__cadLibraryManifestParses);
    assert.equal(manifests.count, 10, 'each catalog manifest should be parsed once');
    console.log(`PASS cold CAD catalog: ${manifests.count} parses, ${manifests.characters} manifest characters`);
    await search.fill('10 mm geometric cube fixture');
    await library.getByRole('button', {name: /^10 mm geometric cube fixture · /}).click();
    await page.context().setOffline(true);
    await library.getByRole('button', {name: 'Insert editable source', exact: true}).click();
    await library.getByText(/Editable source inserted with provenance/).waitFor();
    await page.waitForFunction(() => window.__bwCad.editor.session.state.document.roots.length > 0);
    console.log('PASS bundled file decoding stays out of browsing and editable source still inserts offline');
} finally {
    await browser.close();
}
