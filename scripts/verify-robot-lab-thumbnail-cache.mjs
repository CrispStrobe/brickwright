// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {firefox} from 'playwright';
import {openRobotLabTab} from './lib/sim-lab-toolbar-gate.mjs';

const browser = await firefox.launch();
try {
    const page = await browser.newPage({viewport: {width: 1450, height: 920}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(120000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        window.__bwThumbnailHits = [];
        const match = Cache.prototype.match;
        Cache.prototype.match = async function (request, options) {
            const response = await match.call(this, request, options);
            if (response && typeof request === 'string' && request.includes('/__brickwright-rendered-thumbnails/')) {
                window.__bwThumbnailHits.push(decodeURIComponent(request));
            }
            return response;
        };
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    const openBuild = async () => {
        await openRobotLabTab(page);
        await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
        await page.getByTestId('bw-sim-lab-mode-build').click();
        await page.waitForFunction(() => window.__bwSimLab?._pane.state.mode === 'build' && window.__bwSimLab.status === 'ready');
    };
    await openBuild();
    const first = page.getByTestId('bw-sim-lab-thumb').first();
    await first.waitFor();
    const part = await first.evaluate(image => image.closest('[data-part]').dataset.part);
    const src = await first.getAttribute('src');
    assert.match(src, /^data:image\/png;base64,/);
    await page.waitForFunction(async part => {
        const cache = await caches.open('brickwright-rendered-thumbnails-v1');
        return (await cache.keys()).some(request => decodeURIComponent(request.url).includes(`:${part}@`));
    }, part);
    await page.reload({waitUntil: 'commit'});
    await openBuild();
    const thumb = page.locator(`[data-part="${part}"] img[data-testid="bw-sim-lab-thumb"]`).first();
    await thumb.waitFor();
    assert.equal(await thumb.getAttribute('src'), src);
    assert.ok(await page.evaluate(part => window.__bwThumbnailHits.some(key => key.includes(`:${part}@`)), part));
    console.log(`PASS Firefox: ${part} restored from persistent thumbnail cache after page reload`);
} finally {
    await browser.close();
}
