// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {openRobotLabTab, tool} from './lib/sim-lab-toolbar-gate.mjs';

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1420, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(120000);
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    const images = new Set();
    const indexes = [];
    const circuitCatalogRequests = [];
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (/\/gallery-artwork\/[a-f0-9]{64}\.(png|svg)$/.test(path)) images.add(path);
        if (/\/gallery-artwork\/.*\.json$/.test(path)) indexes.push(path.split('/').at(-1));
        if (/\/examples\/(index|curriculum)\.json$/.test(path)) circuitCatalogRequests.push(path.split('/').at(-1));
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await openRobotLabTab(page);
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
    assert.equal(images.size, 0);
    assert.deepEqual(indexes, []);
    await tool(page, 'examples');
    const robots = page.getByTestId('bw-sim-examples');
    const robot = robots.getByTestId('bw-sim-example-artwork').first();
    await robot.scrollIntoViewIfNeeded();
    assert.equal(await robot.getAttribute('loading'), 'lazy');
    assert.ok(await robot.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    const robotCards = await robots.getByTestId('bw-sim-example-card').count();
    assert.ok(images.size > 0 && images.size < robotCards);
    assert.equal(indexes.length, 1);
    assert.match(indexes[0], /^robots\.[a-f0-9]{64}\.json$/);
    console.log(`PASS Robot Lab decoded its first cover with ${images.size} image requests for ${robotCards} cards`);
    await robots.getByRole('button', {name: 'Close examples', exact: true}).click();

    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    const openInlineGallery = page.getByRole('button', {name: 'Expand Examples', exact: true}).first();
    await openInlineGallery.waitFor({state: 'visible'});
    assert.equal(indexes.length, 1, 'the Circuit bench does not load the artwork index');
    assert.deepEqual(circuitCatalogRequests, []);
    await page.getByTestId('bw-circuit-panel-examples').first().click();
    const circuitCovers = page.locator('img[data-example-artwork]:visible');
    const circuit = circuitCovers.first();
    const waitForCover = async cover => {
        await cover.scrollIntoViewIfNeeded();
        await page.waitForFunction(image => image.complete && image.naturalWidth > 0, await cover.elementHandle());
    };
    await waitForCover(circuit);
    assert.equal(await circuit.getAttribute('loading'), 'lazy');
    const circuitRequests = [...images].filter(path => path.endsWith('.svg')).length;
    const available = await circuitCovers.evaluateAll(cards => [...new Set(cards.map(card => card.dataset.exampleArtwork))]);
    assert.ok(circuitRequests > 0 && circuitRequests < 64 && available.length > circuitRequests);
    const distant = available.findLast(url => !images.has(new URL(url, page.url()).pathname));
    assert.ok(distant, 'a cover well below the fold is still deferred');
    await waitForCover(page.locator(`img[data-example-artwork="${distant}"]:visible`).first());
    assert.ok(images.has(new URL(distant, page.url()).pathname));
    assert.equal(indexes.length, 2);
    assert.match(indexes[1], /^circuits\.[a-f0-9]{64}\.json$/);
    assert.deepEqual(circuitCatalogRequests, ['index.json']);
    console.log(`PASS Circuit decoded covers on demand, with ${circuitRequests} initial requests for ${available.length} unique covers`);

    await page.getByTestId('bw-circuit-panel-designer').first().click();
    await openInlineGallery.click();
    await page.getByRole('button', {name: /Codex$/}).first().click();
    await page.getByTestId('codex-browser').first().waitFor({state: 'visible'});
    assert.deepEqual(circuitCatalogRequests, ['index.json', 'curriculum.json']);
    assert.equal(indexes.length, 2, 'the two Circuit galleries share their artwork lookup');
    console.log('PASS Circuit bench defers the gallery, and the inline gallery loads the Codex');
} finally {
    await browser.close();
}
