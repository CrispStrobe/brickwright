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
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (/\/gallery-artwork\/[a-f0-9]{64}\.(png|svg)$/.test(path)) images.add(path);
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await openRobotLabTab(page);
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
    assert.equal(images.size, 0);
    await tool(page, 'examples');
    const robots = page.getByTestId('bw-sim-examples');
    const robot = robots.getByTestId('bw-sim-example-artwork').first();
    await robot.scrollIntoViewIfNeeded();
    assert.equal(await robot.getAttribute('loading'), 'lazy');
    assert.ok(await robot.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    assert.ok(images.size > 0 && images.size < await robots.getByTestId('bw-sim-example-card').count());
    await robots.getByRole('button', {name: 'Close examples', exact: true}).click();

    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await page.getByTestId('bw-circuit-panel-examples').first().click();
    const circuit = page.locator('img[src*="/gallery-artwork/"][src$=".svg"]').first();
    await circuit.scrollIntoViewIfNeeded();
    assert.equal(await circuit.getAttribute('loading'), 'lazy');
    assert.ok(await circuit.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    console.log('PASS Chromium: Robot Lab and Circuit gallery artwork decoded after opening the galleries');
} finally {
    await browser.close();
}
