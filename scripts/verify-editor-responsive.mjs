#!/usr/bin/env node
import {openCodeActions as openCodeMenu, openCodeInfo} from './lib-code-actions.mjs';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import assert from 'node:assert/strict';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, extname, sep} from 'node:path';
import {chromium, firefox} from 'playwright';
import {verifyEditorTouch, verifyEditorChrome} from './lib/editor-touch-checks.mjs';
import {privateSpikeEvidenceDirectory} from './lib/private-spike-evidence.mjs';

const browserName = process.env.BW_BROWSER || 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName));
const mutation = process.env.BW_EDITOR_MUTATION || '';
assert.ok(['', 'rigid-column', 'lost-image-draft'].includes(mutation));
const evidence = `${privateSpikeEvidenceDirectory()}/editor-responsive-${browserName}${mutation ? `-${mutation}` : ''}`;
await mkdir(evidence, {recursive: true});
let server;
let proofUrl = process.env.PROOF_URL;
if (!proofUrl) {
    const build = resolve(process.env.BW_EDITOR_BUILD_ROOT || 'packages/scratch-gui/build');
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png'};
    server = createServer(async (request, response) => {
        try {
            const path = decodeURIComponent(request.url.split('?')[0]);
            const file = resolve(build, `.${path.endsWith('/') ? `${path}index.html` : path}`);
            if (!file.startsWith(`${build}${sep}`)) throw new Error('invalid path');
            const data = await readFile(file);
            response.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            response.end(data);
        } catch { response.writeHead(404); response.end('not found'); }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    proofUrl = `http://127.0.0.1:${server.address().port}/`;
}
const headless = process.env.BW_HEADLESS !== '0';
const browser = await (browserName === 'firefox' ? firefox : chromium).launch({headless,
    ...(browserName === 'chromium' ? {args: ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader']} : {})});
const page = await browser.newPage({viewport: {width: 1400, height: 1000}, serviceWorkers: 'block'});
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
const check = (name, detail = null) => { checks.push({name, detail}); console.log(`PASS ${name}`); };
try {
    await page.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await page.goto(proofUrl, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: /Costumes|Backdrops/, exact: true}).click();
    const targets = page.getByTestId('bw-image-target');
    await targets.waitFor({timeout: 60000});
    const choices = await targets.locator('option').evaluateAll(options =>
        options.map(option => ({id: option.value, name: option.textContent})));
    const backdrop = choices.find(option => option.name === 'Backdrops');
    const sprite = choices.find(option => option.id !== backdrop?.id);
    assert.ok(sprite && backdrop, 'both sprite costumes and stage backdrops must be available');
    await targets.selectOption(backdrop.id);
    await page.getByRole('tab', {name: 'Backdrops', exact: true}).waitFor();
    await targets.selectOption(sprite.id);
    await page.getByRole('tab', {name: 'Costumes', exact: true}).waitFor();
    check('image editor manually switches between sprite costumes and stage backdrops');

    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-device-select').waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-load-pseudocode', {detail: {
        code: 'DEVICE SPIKE\nWHEN flag clicked:\n  set motor speed A 30\n  start motor A forward\n',
        source: 'responsive-editor-proof'
    }})));
    await page.getByTestId('bw-open-spike-arena').waitFor();
    await page.getByRole('button', {name: /To blocks/}).click();
    await openCodeInfo(page);
    await page.getByTestId('bw-conversion-report').waitFor({timeout: 60000});
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-status"]')?.textContent.includes('Blocks loaded.'),
        null, {timeout: 60000});
    assert.match(await page.getByTestId('bw-code-status').innerText(), /Blocks loaded/);
    await page.getByRole('button', {name: 'Close Code help'}).click();
    if (mutation === 'rigid-column') {
        await page.addStyleTag({content: '[data-editor-pane] {flex: 1 0 620px !important; min-width: 620px !important;}'});
    }
    const editor = page.getByTestId('bw-code-editor');
    const divider = page.getByRole('separator', {name: 'Resize the stage column'});
    for (const fraction of [0.5, 0.75]) {
        const row = await page.locator('[data-workspace-columns]').boundingBox();
        const grab = await divider.boundingBox();
        await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
        await page.mouse.down();
        await page.mouse.move(row.x + row.width * (1 - fraction), grab.y + grab.height / 2, {steps: 12});
        await page.mouse.up();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const widths = await page.locator('[data-workspace-columns]').evaluate(element => ({
            row: element.getBoundingClientRect().width,
            right: element.querySelector('[data-right-pane]').getBoundingClientRect().width,
            left: element.querySelector('[data-editor-pane]').getBoundingClientRect().width
        }));
        assert.ok(Math.abs(widths.right / widths.row - fraction) < 0.025, JSON.stringify(widths));
        const dimensions = await editor.evaluate(element => ({width: element.clientWidth, scroll: element.scrollWidth}));
        assert.ok(dimensions.scroll <= dimensions.width + 2, JSON.stringify(dimensions));
        assert.ok(widths.left > 120, 'the main editor remains usable');
        check(`right pane reaches ${fraction * 100}% with conversion notices available`, widths);
    }
    const tabList = page.locator('[role="tablist"]');
    assert.notEqual(await tabList.getAttribute('data-bw-tab-icons-only'), null,
        'a narrow desktop editor switches to icons rather than squeezing labels');
    assert.equal(await tabList.locator('[data-bw-tab-label]').evaluateAll(labels =>
        labels.filter(label => getComputedStyle(label).display !== 'none').length), 0);
    await page.getByRole('tab', {name: 'Code', exact: true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', {name: 'Circuit', exact: true}).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    check('narrow desktop tabs keep accessible names and keyboard switching in icon-only mode');
    await page.screenshot({path: `${evidence}/right-pane-75-percent.png`});
    const rightWidth = () => page.locator('[data-right-pane]').evaluate(element => element.getBoundingClientRect().width);
    const originalWidth = await rightWidth();
    await divider.focus();
    await page.keyboard.press('ArrowLeft');
    assert.ok(await rightWidth() > originalWidth + 5);
    await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs(await rightWidth() - originalWidth) < 2);
    check('keyboard divider adjustment grows and shrinks the right pane');
    await openCodeInfo(page);
    await page.getByTestId('bw-dismiss-code-status').click();
    assert.equal(await page.getByText('Blocks loaded.', {exact: true}).count(), 0);
    await page.getByTestId('bw-dismiss-conversion-report').click();
    assert.equal(await page.getByTestId('bw-conversion-report').count(), 0);
    check('status and conversion report can both be dismissed');
    await page.getByRole('button', {name: 'Close Code help'}).click();
    await page.setViewportSize({width: 900, height: 800});
    await page.waitForFunction(() => window.innerWidth === 900);
    const narrow = await editor.evaluate(element => ({width: element.clientWidth, scroll: element.scrollWidth,
        codeHeight: element.querySelector('.cm-editor')?.getBoundingClientRect().height}));
    assert.ok(narrow.scroll <= narrow.width + 2, JSON.stringify(narrow));
    assert.ok(narrow.codeHeight > 120, JSON.stringify(narrow));
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    check('narrow main editor keeps its tabs and code usable', narrow);
    await page.setViewportSize({width: 1400, height: 1000});

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-open-lessons')));
    const library = page.getByTestId('bw-lessons-library');
    await library.waitFor();
    const handle = page.getByTestId('bw-lessons-drag-handle');
    const before = await library.boundingBox();
    const header = await handle.boundingBox();
    await page.mouse.move(header.x + 75, header.y + 20);
    await page.mouse.down();
    await page.mouse.move(header.x + 575, header.y + 20, {steps: 12});
    await page.mouse.up();
    const after = await library.boundingBox();
    assert.ok(after.x - before.x > 400, 'lessons move away from the left editor');
    await page.getByTestId('bw-lessons-collapse').click();
    await page.getByTestId('bw-lessons-collapsed').waitFor();
    assert.ok((await page.getByTestId('bw-lessons-collapsed').boundingBox()).height < 90);
    await page.getByTestId('bw-lessons-collapse').click();
    await library.waitFor();
    assert.ok(Math.abs((await library.boundingBox()).x - after.x) < 2);
    check('lessons move, collapse and expand without returning to the left edge');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    assert.ok((await library.boundingBox()).x > after.x);
    await page.getByRole('button', {name: 'Close lessons', exact: true}).click();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-open-lessons')));
    await library.waitFor();
    assert.ok((await library.boundingBox()).x >= after.x, 'lesson position survives close and reopen');
    check('lesson position supports keyboard movement and survives reopening');
    await page.getByRole('button', {name: 'Close lessons', exact: true}).click();
    await page.getByTestId('bw-device-select').selectOption('microbit');
    await page.getByRole('button', {name: '🤖 micro:bit', exact: true}).click();
    assert.equal(await page.getByTestId('bw-microbit-flash').innerText(), '▶ Run');
    assert.equal(await page.getByTestId('bw-microbit-download-hex').isVisible(), false);
    await openCodeMenu(page);
    assert.equal(await page.getByTestId('bw-microbit-download-hex').isVisible(), true);
    assert.match(await page.getByTestId('bw-microbit-download-hex').innerText(), /Export firmware \(\.hex\)/);
    check('simulator Run is compact and firmware export is clearly labelled in the file menu');
    assert.equal(await page.getByTestId('bw-global-undo').locator('svg').count(), 1);
    assert.deepEqual(errors, [], 'no uncaught browser exceptions');
    if (browserName === 'chromium') {
        await verifyEditorTouch(browser, proofUrl, evidence, check);
        await verifyEditorChrome(browser, proofUrl, evidence, check);
    }
} catch (error) {
    process.exitCode = 1;
    console.error(error);
    await page.screenshot({path: `${evidence}/failure.png`}).catch(() => {});
    checks.push({failure: error.stack});
} finally {
    await writeFile(`${evidence}/result.json`, JSON.stringify({browserName, version: browser.version(), headless,
        mutation, checks, errors, success: !process.exitCode}, null, 2));
    await browser.close();
    if (server) await new Promise(done => server.close(done));
}
