#!/usr/bin/env node
import {verifyArenaSandbox, verifyEmptyArena} from './lib/arena-sandbox-checks.mjs';
import {privateSpikeEvidenceDirectory} from './lib/private-spike-evidence.mjs';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Full shipped GUI proof. Run after the normal integrated GUI build.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const build = resolve(process.env.BW_SPIKE_BUILD_ROOT || `${root}/packages/scratch-gui/build`);
const evidence = resolve(privateSpikeEvidenceDirectory(), 'gui-browser');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png'};
const server = createServer(async (request, response) => {
    try {
        const name = decodeURIComponent(request.url.split('?')[0]);
        const file = resolve(build, `.${name.endsWith('/') ? `${name}index.html` : name}`);
        if (!file.startsWith(`${build}${sep}`)) throw new Error('invalid path');
        const data = await readFile(file);
        response.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'}); response.end(data);
    } catch { response.writeHead(404); response.end('not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
await mkdir(evidence, {recursive: true});
let browser, page;
const checks = [], errors = [], firmwareRequests = [], simulatorBinaryRequests = [];
const check = (name, detail = null) => { checks.push({name, passed: true, detail}); console.log(`PASS ${name}`); };
try {
    browser = await chromium.launch({headless: true, args: ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']});
    page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', request => {
        const url = new URL(request.url());
        if (!/\.(wasm|mpy)$/i.test(url.pathname)) return;
        // The shared, independently built interpreter core is an application
        // library. It is not a hub firmware image or motor-controller runtime.
        if (url.pathname.endsWith('/labwired_wasm_bg.wasm')) simulatorBinaryRequests.push(request.url());
        else firmwareRequests.push(request.url());
    });
    await page.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-device-select').waitFor({timeout: 60000});
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-load-pseudocode', {detail: {
        code: 'DEVICE SPIKE\nWHEN flag clicked:\n  set movement motors A B\n  move forward 1 cm\n', source: 'spike-browser-proof'
    }})));
    await page.getByTestId('bw-open-spike-arena').waitFor({timeout: 60000});
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'),
        null, {timeout: 60000});
    await page.getByTestId('bw-open-spike-arena').click();
    await page.getByTestId('bw-spike-simulator').waitFor();
    assert.equal(await page.getByTestId('bw-spike-backend').count(), 0);
    await page.waitForFunction(() => window.__bwSpikeArena?.bridge);
    assert.equal(firmwareRequests.length, 0);
    check('native GUI opens without requesting firmware binaries');
    // The extension can already be loaded by the preceding stub program.
    // Clear its completion notice so only the reference solution can satisfy this wait.
    await page.getByTestId('bw-dismiss-code-status').click();
    await page.getByTestId('bw-spike-arena-load-solution').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'),
        null, {timeout: 60000});
    assert.equal(await page.evaluate(() => window.__bwSpikeArena?._pane.spikeLoaded()), true);
    await page.getByTestId('bw-spike-arena-start').click();
    await page.waitForFunction(() => window.__bwSpikeArena?.verdict?.status === 'pass', null, {timeout: 60000});
    const mission = await page.evaluate(() => ({verdict: window.__bwSpikeArena.verdict,
        pose: window.__bwSpikeArena.bridge.sim.pose, timeMs: window.__bwSpikeArena.bridge.sim.timeMs}));
    check('actual Scratch VM reference mission completes through the native backend', mission);
    await page.screenshot({path: `${evidence}/native-mission.png`, fullPage: true});
    await page.getByTestId('bw-spike-arena-reset').click();
    const nativeEnvelope = await page.evaluate(() => {
        const hub = window.__bwSpikeArena._pane.hubState;
        hub.setMotorSpeed('B', 100);
        hub.backend.step(1000);
        return {nominalLimit: hub.backend.maxSpeed('B'), shaftSpeed: hub.data.motors[1].degPerSec};
    });
    assert.equal(nativeEnvelope.nominalLimit, 1110);
    assert.equal(nativeEnvelope.shaftSpeed, 950);
    check('shared GUI hub applies the simulator envelope to a full-speed native command', nativeEnvelope);
    await page.getByTestId('bw-spike-arena-reset').click();
    await page.getByTestId('bw-spike-arena-view-toggle').click();
    await page.waitForFunction(() => ['webgl','fallback'].includes(window.__bwSpikeArena?.view3d));
    const view3d = await page.evaluate(() => window.__bwSpikeArena.view3d);
    assert.equal(view3d, 'webgl', 'software WebGL must render the shared world');
    check('3D arena renders the shared virtual world');
    await page.screenshot({path: `${evidence}/native-3d-arena.png`, fullPage: true});
    await verifyArenaSandbox(page, check, evidence);
    await verifyEmptyArena(browser, page.url(), check, evidence);
    assert.deepEqual(firmwareRequests, [], 'the complete virtual SPIKE flow uses no firmware binaries');
    assert.deepEqual(errors, [], 'no uncaught browser exceptions');
} catch (error) {
    checks.push({name: 'browser proof', passed: false, detail: error.stack});
    if (page) {
        await page.screenshot({path: `${evidence}/failure.png`, fullPage: true}).catch(() => {});
        console.error((await page.locator('body').innerText().catch(() => '')).slice(0, 5000));
    }
    process.exitCode = 1; console.error(error);
} finally {
    await writeFile(`${evidence}/result.json`, JSON.stringify({node: process.version, checks, errors,
        firmwareRequests, simulatorBinaryRequests, build, success: !process.exitCode}, null, 2) + '\n');
    if (browser) await browser.close();
    await new Promise(done => server.close(done));
}
