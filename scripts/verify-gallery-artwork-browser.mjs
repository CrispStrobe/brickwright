// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {openRobotLabTab, tool} from './lib/sim-lab-toolbar-gate.mjs';

const base = process.argv[2] || 'http://127.0.0.1:8242/';
const expectIndex = (actual, kind) => {
    const url = new URL(actual);
    const prefix = new URL(`static/thumbnails/gallery-artwork/${kind}.`, base);
    assert.equal(url.origin, prefix.origin);
    assert.ok(url.pathname.startsWith(prefix.pathname), `index must use ${prefix.href}`);
    assert.match(url.pathname.slice(prefix.pathname.length), /^[a-f0-9]{64}\.json$/);
};
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1420, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(120000);
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    const images = new Set();
    const indexes = [];
    const circuitCatalogRequests = [];
    page.on('request', request => {
        const url = new URL(request.url());
        const path = url.pathname;
        if (/\/gallery-artwork\/[a-f0-9]{64}\.(png|svg)$/.test(path)) images.add(path);
        if (/\/gallery-artwork\/.*\.json$/.test(path)) indexes.push(url.origin + path);
        if (/\/examples\/(index|curriculum)\.json$/.test(path)) circuitCatalogRequests.push(url.origin + path);
    });
    await page.goto(base, {waitUntil: 'commit'});
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
    const robotCards = robots.getByTestId('bw-sim-example-card');
    const firstModel = await robotCards.first().getAttribute('data-model');
    assert.equal(await robotCards.count(), 24);
    assert.ok(images.size > 0 && images.size < await robotCards.count());
    assert.equal(indexes.length, 1);
    expectIndex(indexes[0], 'robots');
    console.log(`PASS Robot Lab decoded its first cover with ${images.size} image requests for 24 mounted cards`);
    const modelPager = robots.getByRole('group', {name: 'Model pages', exact: true});
    await modelPager.getByRole('button', {name: 'Next page', exact: true}).click();
    assert.equal(await robotCards.count(), 24);
    assert.notEqual(await robotCards.first().getAttribute('data-model'), firstModel);
    const robotSearch = robots.getByRole('searchbox');
    await robotSearch.fill('flywheel-differential');
    const laterModel = robots.locator('[data-model="flywheel-differential.ldr"]');
    const laterArtwork = laterModel.getByTestId('bw-sim-example-artwork');
    await laterArtwork.scrollIntoViewIfNeeded();
    assert.ok(await laterArtwork.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    await robotSearch.fill('');
    assert.equal(await robotCards.first().getAttribute('data-model'), firstModel);
    assert.equal(await modelPager.getByRole('button', {name: 'Previous page', exact: true}).isDisabled(), true);
    console.log('PASS Robot Lab keeps 24 cards mounted per page and searches the full catalog');
    await robots.getByRole('button', {name: 'Close examples', exact: true}).click();
    await robots.waitFor({state: 'hidden'});

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
    expectIndex(indexes[1], 'circuits');
    assert.deepEqual(circuitCatalogRequests, [new URL('examples/index.json', base).href]);
    console.log(`PASS Circuit decoded covers on demand, with ${circuitRequests} initial requests for ${available.length} unique covers on the page`);

    const cards = page.locator('[data-examples-selector-content]:visible [data-example-id]');
    const firstId = await cards.first().getAttribute('data-example-id');
    assert.equal(await cards.count(), 32, 'Circuit mounts a single page of cards');
    const pager = page.getByRole('group', {name: 'Example pages', exact: true}).first();
    await pager.getByRole('button', {name: 'Next page', exact: true}).click();
    assert.equal(await cards.count(), 32);
    assert.notEqual(await cards.first().getAttribute('data-example-id'), firstId);
    const search = page.getByPlaceholder(/^Search \d+ examples/).first();
    await search.fill('lab-motorboat');
    const lateExample = cards.and(page.locator('[data-example-id="lab-motorboat"]'));
    assert.equal(await cards.count(), 1);
    await waitForCover(lateExample.locator('img'));
    await lateExample.getByText(/^Motor-boating:/).click();
    await page.getByText(/^Open .Motor-boating:/).waitFor({state: 'visible'});
    await page.getByRole('button', {name: 'Cancel', exact: true}).click();
    await search.fill('');
    assert.equal(await cards.first().getAttribute('data-example-id'), firstId);
    assert.equal(await pager.getByRole('button', {name: 'Previous page', exact: true}).isDisabled(), true);
    console.log('PASS Circuit pages keep 32 cards mounted, and search finds a late entry in the full catalog');

    await page.getByTestId('bw-circuit-panel-designer').first().click();
    await openInlineGallery.click();
    await page.getByRole('button', {name: /Codex$/}).first().click();
    await page.getByTestId('codex-browser').first().waitFor({state: 'visible'});
    assert.deepEqual(circuitCatalogRequests, ['index.json', 'curriculum.json']
        .map(name => new URL(`examples/${name}`, base).href));
    assert.equal(indexes.length, 2, 'the two Circuit galleries share their artwork lookup');
    console.log('PASS Circuit bench defers the gallery, and the inline gallery loads the Codex');
} finally {
    await browser.close();
}
