#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Qualify the exact CP5-style example through real live switch controls.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cp1BrowserFixture} from './lib/cp1-browser-fixture.mjs';
import {switchToLedFirmware} from '../test/fixtures/cp1-panel/synthetic-circuit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = flag => { const i = process.argv.indexOf(flag); return i < 0 ? null : process.argv[i + 1]; };
for (const flag of ['--deps', '--board', '--circuit', '--example']) assert.ok(option(flag), `Pass an explicit ${flag}.`);
const deps = path.resolve(root, option('--deps'));
const compilerDeps = path.resolve(root, option('--compiler-deps') || option('--deps'));
const board = path.resolve(root, option('--board'));
const circuit = path.resolve(root, option('--circuit'));
const example = JSON.parse(await readFile(path.resolve(root, option('--example')), 'utf8'));
const cp1Parts = example.parts.filter(part => part.kind === 'kosmos-cp1');
assert.equal(cp1Parts.length, 1);
const cp1Id = cp1Parts[0].id;
const output = path.resolve(root, option('--out') || 'test-results/cp1-cp5-browser');
await mkdir(output, {recursive: true});
assert.equal(example.parts.filter(part => part.kind === 'switch').length, 8);
assert.equal(example.parts.filter(part => part.kind === 'led').length, 8);
const fixture = await cp1BrowserFixture({root, deps, compilerDeps, board, circuit});
const errors = [], checks = [], measurements = [], layout = [];
let server, browser, page;
try {
    server = await fixture.createServer(fixture.config);
    await server.listen();
    browser = await fixture.chromium.launch({headless: true,
        ...(option('--executable') ? {executablePath: option('--executable')} : {})});
    page = await browser.newPage({viewport: {width: 1440, height: 1100}});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const fitCp1 = async label => {
        await page.locator(`[data-canvas] [data-part-id="${cp1Id}"][data-art-loaded="true"]`).waitFor();
        await page.getByRole('button', {name: 'Fit all parts', exact: true}).click();
        await page.waitForFunction(id => {
            const canvas = document.querySelector('[data-canvas]');
            const image = canvas?.querySelector(`[data-part-id="${id}"] image`);
            if (!image) return false;
            const frame = canvas.getBoundingClientRect(), face = image.getBoundingClientRect();
            return face.width > 0 && face.height > 0 && face.left >= frame.left - 1 &&
                face.top >= frame.top - 1 && face.right <= frame.right + 1 && face.bottom <= frame.bottom + 1;
        }, cp1Id);
        layout.push({label, ...await page.evaluate(id => {
            const canvas = document.querySelector('[data-canvas]');
            const image = canvas.querySelector(`[data-part-id="${id}"] image`);
            const rect = element => {
                const r = element.getBoundingClientRect();
                return {x: r.x, y: r.y, width: r.width, height: r.height};
            };
            return {viewport: {width: innerWidth, height: innerHeight}, canvas: rect(canvas), cp1Face: rect(image)};
        }, cp1Id)});
    };
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/runner.html`, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => typeof window.__cp1Integration?.loadCircuit === 'function');
    await page.evaluate(data => window.__cp1Integration.loadCircuit(data), example);
    await page.waitForFunction(count => window.__cp1Integration.board()?.parts?.length === count, example.parts.length);
    await fitCp1('initial');
    await page.locator('input[type="file"][aria-label="Import monitor ROM"]').setInputFiles({
        name: 'original-byte-echo.rom', mimeType: 'application/octet-stream', buffer: Buffer.from(switchToLedFirmware())
    });
    await page.waitForFunction(() => window.__cp1Integration.phase() === 'paused');
    await page.getByRole('radio', {name: 'Sim mode', exact: true}).click();
    const expand = page.getByRole('button', {name: 'Expand instruments panel', exact: true});
    if (await expand.isVisible()) await expand.click();
    for (let n = 1; n <= 8; n++) {
        const control = page.locator(`[data-switch-control="switch${n}"]`);
        await control.waitFor({state: 'visible'});
        assert.equal(await control.getAttribute('aria-pressed'), 'true');
    }
    checks.push('eight live controls are reachable and display the real closed initial state');
    await page.getByRole('button', {name: 'Run CPU', exact: true}).click();
    await page.waitForFunction(() => window.__cp1Integration.snapshot()?.ports.P2.value === 0);
    const setByte = async value => {
        for (let bit = 0; bit < 8; bit++) {
            const control = page.locator(`[data-switch-control="switch${bit + 1}"]`);
            const closed = (value & (1 << bit)) === 0;
            if ((await control.getAttribute('aria-pressed') === 'true') !== closed) await control.click();
            await page.waitForFunction(({id, expected}) =>
                document.querySelector(`[data-switch-control="${id}"]`)?.getAttribute('aria-pressed') === expected,
            {id: `switch${bit + 1}`, expected: String(closed)});
            assert.equal(await control.getAttribute('aria-pressed'), String(closed));
        }
        await page.waitForFunction(expected => {
            const snapshot = window.__cp1Integration.snapshot();
            return snapshot?.ports.P1.value === expected && snapshot?.ports.P2.value === expected;
        }, value);
        const observed = await page.evaluate(() => {
            const h = window.__cp1Integration, board = h.board();
            return {sameBoard: h.identity().sameBoard, failure: board.transientAnalysisStatus().failure,
                channels: Array.from({length: 8}, (_, bit) => ({
                    channel: bit + 1, current: -board.branchCurrent(`led${bit + 1}`, 'anode'),
                    brightness: h.led(`led${bit + 1}`)
                }))};
        });
        assert.equal(observed.sameBoard, true);
        assert.equal(observed.failure, null);
        for (const row of observed.channels) {
            const high = Boolean(value & (1 << (row.channel - 1)));
            if (high) {
                assert.ok(row.current > 0.001 && row.current < 0.004, `LED${row.channel} carries its current-limited on current`);
                assert.ok(row.brightness > 0.01, `LED${row.channel} is lit`);
            } else {
                assert.ok(Math.abs(row.current) < 1e-6, `LED${row.channel} off current`);
                assert.ok(row.brightness < 1e-6, `LED${row.channel} is dark`);
            }
        }
        measurements.push({inputByte: value, ...observed});
    };
    for (const value of [0, 1, 2, 4, 8, 16, 32, 64, 128, 165, 255, 0]) await setByte(value);
    checks.push('12 walking, mixed and endpoint byte patterns pass from real switch clicks through 8049/8155 to all eight LED branches');
    await setByte(165);
    await page.getByRole('button', {name: 'Pause CPU', exact: true}).click();
    await fitCp1('desktop');
    await page.screenshot({path: path.join(output, 'cp5-desktop.png'), fullPage: true});
    await page.setViewportSize({width: 390, height: 1100});
    // A desktop-mounted designer retains the user's open rails after resize.
    // Use its ordinary controls to make the narrow workbench visible.
    for (const label of ['Collapse Selectors Panel', 'Collapse instruments panel']) {
        const collapse = page.getByRole('button', {name: label, exact: true});
        if (await collapse.isVisible()) await collapse.click();
    }
    for (let n = 1; n <= 8; n++) {
        await page.locator(`[data-switch-control="switch${n}"]`).waitFor({state: 'hidden'});
    }
    await page.waitForFunction(() => document.querySelector('[data-canvas]')?.getBoundingClientRect().width >= 200);
    await fitCp1('narrow');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({path: path.join(output, 'cp5-narrow.png'), fullPage: true});
    checks.push('desktop and 390-pixel workbench evidence with the entire rendered CP1 face inside the fitted canvas and no horizontal page overflow');
    await page.getByRole('button', {name: 'Expand instruments panel', exact: true}).click();
    for (let n = 1; n <= 8; n++) {
        const control = page.locator(`[data-switch-control="switch${n}"]`);
        await control.scrollIntoViewIfNeeded();
        assert.equal(await control.evaluate(element => {
            const r = element.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth &&
                r.top >= 0 && r.bottom <= innerHeight && (hit === element || element.contains(hit));
        }), true, `S${n} is reachable in the narrow instruments pane`);
    }
    checks.push('all eight narrow switch controls can be scrolled into view with unobstructed hit targets');
    const firstSwitch = page.locator('[data-switch-control="switch1"]');
    const paused = await page.evaluate(() => window.__cp1Integration.time());
    await firstSwitch.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-switch-control="switch1"]')?.getAttribute('aria-pressed') === 'true');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await page.evaluate(() => window.__cp1Integration.time()), paused);
    assert.equal(await page.evaluate(() => window.__cp1Integration.snapshot().ports.P2.value), 165);
    await page.getByRole('button', {name: 'Run CPU', exact: true}).click();
    await setByte(164);
    await page.getByRole('button', {name: 'Pause CPU', exact: true}).click();
    await page.locator('[data-switch-control="switch8"]').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({path: path.join(output, 'cp5-narrow-controls.png'), fullPage: true});
    checks.push('narrow keyboard switch toggle changes the live contact while paused, advances neither clock, and reaches firmware/LEDs after resume');
    assert.equal(await page.evaluate(() => window.__cp1Integration.compilerCalls), 0);
    assert.deepEqual(errors, []);
    const result = {status: 'passed', browser: browser.version(), react: fixture.react,
        parts: example.parts.length, wires: example.wires.length, checks, measurements, layout,
        scope: 'Exact CP5-style example, actual CircuitDesigner live controls, Lite host/runner and electrical solver',
        firmware: 'original synthetic 8049 byte echo; not historical-monitor qualification', fullApplicationBuild: false};
    await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({...result, measurements: `${measurements.length} byte observations saved in result.json`}));
} catch (error) {
    if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(path.join(output, 'result.json'), `${JSON.stringify({status: 'failed', message: error.message,
        browserErrors: errors, completedChecks: checks, measurements, layout, react: fixture.react, fullApplicationBuild: false}, null, 2)}\n`);
    throw error;
} finally {
    if (browser) await browser.close();
    if (server) await server.close();
}
