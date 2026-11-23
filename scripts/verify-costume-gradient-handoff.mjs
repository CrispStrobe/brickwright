// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const [url, originalArrow] = process.argv.slice(2);
if (!url) throw new Error('Pass the Brickwright build URL and optionally the Arrow1 SVG path.');
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${body}</svg>`;
const paint = '<defs><linearGradient id="arrow.paint"><stop offset="0" stop-color="pink"/>' +
    '<stop offset="1" stop-color="purple"/></linearGradient></defs>';
const arrow = originalArrow ? await readFile(originalArrow, 'utf8') : svg(paint +
    '<path fill="url(#arrow.paint)" d="M0 14Q0 10 4 10H31L31 0L59 20L31 40V30H4Q0 30 0 26Z"/>');

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1000, height: 750}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(45000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
    });
    await page.goto(url, {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Costumes', exact: true}).click();
    const handoff = page.getByRole('dialog', {name: 'Send to CAD', exact: true});
    const quad = handoff.getByRole('img', {name: 'Closed profile preview', exact: true});
    const artwork = handoff.getByRole('img', {name: 'Original artwork', exact: true});
    const open = () => page.getByTestId('bw-costume-precision').click();
    const putArtwork = source => page.evaluate(source => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        vm.updateSvg(vm.editingTarget.currentCostume, source, 0, 0);
    }, source);
    await open();
    await quad.waitFor();
    assert.ok(await artwork.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    const region = handoff.getByLabel('Region', {exact: true});
    assert.ok(await region.locator('option').count() > 3);
    await handoff.getByText('Only the selected profile is sent to CAD.', {exact: true}).waitFor();
    const initial = await quad.locator('path').getAttribute('d');
    const first = await region.inputValue();
    await region.selectOption({value: first === '0' ? '1' : '0'});
    assert.notEqual(await quad.locator('path').getAttribute('d'), initial);
    await handoff.getByRole('button', {name: 'Close', exact: true}).click();
    await putArtwork(arrow);
    await open();
    await quad.waitFor();
    assert.ok(await artwork.evaluate(image => image.decode().then(() => image.naturalWidth > 0)));
    assert.equal(await region.locator('option').count(), 1);
    assert.equal(await handoff.getByRole('checkbox', {name: 'Approximate curves', exact: true}).isChecked(), true);
    const outline = await quad.locator('path').getAttribute('d');
    assert.match(outline, /^M .* Z$/);
    await handoff.getByRole('button', {name: 'Add editable sketch', exact: true}).click();
    await handoff.getByText(/Sketch added to CAD/).waitFor();
    await handoff.getByRole('button', {name: 'Preview extrusion', exact: true}).click();
    const extrusion = page.getByRole('dialog', {name: 'Sketch and extrusion', exact: true});
    await extrusion.getByRole('button', {name: 'Create extrusion', exact: true}).click();
    await extrusion.waitFor({state: 'hidden'});
    const body = await page.evaluate(async () => {
        const {editor} = window.__bwCad;
        const result = await editor.whenIdle();
        return {count: result.bodies.length, volume: result.bodies[0].volume};
    });
    assert.equal(body.count, 1);
    assert.ok(body.volume > 0);
    const fixtures = [
        svg('<defs><radialGradient id="paint"><stop offset="0"/></radialGradient></defs>' +
            '<rect width="10" height="8" style="fill:url(#paint)"/>'),
        svg(paint + '<rect width="10" height="8" fill="url(https://invalid.test/paint.svg#paint)"/>'),
        svg(paint + '<rect width="10" height="8" fill="url(#missing)"/>'),
        svg('<defs><linearGradient id="local" href="https://invalid.test/paint.svg#paint"/></defs>' +
            '<rect width="10" height="8" fill="url(#local)"/>')
    ];
    const results = await page.evaluate(fixtures => fixtures.map(source => {
        try { return window.__bwCad.sdk.readCostumeProfiles(source).profiles[0]?.size; }
        catch (error) { return error.message; }
    }), fixtures);
    assert.deepEqual(results[0], [10, 8]);
    for (const message of results.slice(1)) assert.match(message, /SVG external references/);
    console.log(`PASS starter robot region comparison, ${originalArrow ? 'shipped Arrow1' : 'curved gradient arrow'} extrusion, and local paint restrictions`);
} finally {
    await browser.close();
}
