// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(60000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
    });
    const requests = [];
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (/\/cad-sdk\/assets\/printability-[^/]+\.js$/.test(path)) requests.push(path);
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'CAD', exact: true}).click();
    await page.waitForFunction(() => window.__bwCad?.editor);
    const revision = await page.evaluate(async () => {
        const {editor} = window.__bwCad;
        editor.session.add({kind: 'box', size: [10, 10, 0.5]});
        await editor.whenIdle();
        return editor.session.state.revision;
    });
    assert.deepEqual(requests, [], 'ordinary CAD work does not load printability analysis');
    await page.getByText('File', {exact: true}).filter({visible: true}).click();
    await page.getByText('Check printability…', {exact: true}).filter({visible: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Check printability', exact: true});
    await dialog.getByText(/0\.5 mm \(limit 0\.8 mm\)/).waitFor();
    assert.equal(requests.length, 1, 'the first check loads the analysis chunk once');
    await dialog.getByLabel('Minimum wall (mm)', {exact: true}).fill('0.4');
    await dialog.getByRole('button', {name: 'Run check', exact: true}).click();
    await dialog.getByText(/limit 0\.4 mm/).waitFor();
    assert.equal(requests.length, 1, 'a second check reuses the loaded analysis');
    assert.equal(await page.evaluate(() => window.__bwCad.editor.session.state.revision), revision);
    console.log('PASS Brickwright File menu runs on-demand printability checks without changing project history');
} finally {
    await browser.close();
}
