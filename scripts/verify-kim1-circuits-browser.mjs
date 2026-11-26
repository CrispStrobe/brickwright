// SPDX-License-Identifier: BSD-3-Clause
// Qualify the KIM-1 through the built Brickwright app, not a substitute panel.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:8242/';
const output = path.resolve(process.env.BW_KIM1_APP_OUT || 'artifacts/kim1-app');
await mkdir(output, {recursive: true});
const checks = [], pageErrors = [];
const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?
        {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})
});
let page, buildManifest = null;
const sourceCommit = process.env.GITHUB_SHA || null;
const packageCommits = {board: process.env.BW_KIM1_BOARD_SHA || null, ui: process.env.BW_KIM1_UI_SHA || null};
if (process.env.CI) {
    assert.match(sourceCommit || '', /^[0-9a-f]{40}$/);
    for (const sha of Object.values(packageCommits)) assert.match(sha || '', /^[0-9a-f]{40}$/);
}
try {
    page = await browser.newPage({viewport: {width: 1440, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(45000);
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    const manifestResponse = await page.request.get(new URL('brickwright-build.json', base).href);
    assert.equal(manifestResponse.status(), 200);
    buildManifest = await manifestResponse.json();
    assert.equal(buildManifest.schema, 2);
    assert.equal(buildManifest.product, 'Brickwright');
    if (sourceCommit) assert.equal(buildManifest.commit, sourceCommit.slice(0, 7));
    assert.ok(Number.isFinite(Date.parse(buildManifest.builtAt)));
    assert.deepEqual(buildManifest.distributionPolicy, {
        remoteExtensions: 'allow', executableToolchains: 'allow', machineImages: 'allow'
    });
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await page.getByTestId('bw-circuit-panel-examples').first().click();
    await page.getByPlaceholder(/^Search \d+ examples/).first().fill('KIM-1');
    const card = page.locator('[data-example-id="kim1-wired-io"]:visible');
    await card.getByText('KIM-1: Wired I/O', {exact: true}).click();
    const confirmation = page.getByRole('button', {name: 'OK', exact: true});
    await confirmation.click();
    const panel = page.locator('[data-kim1-panel="kim1"]:visible');
    await panel.waitFor();
    await page.locator('[data-canvas] [data-part-id="kim1"][data-art-loaded="true"]').waitFor();
    assert.equal(await panel.locator('[data-kim1-key]').count(), 23);
    checks.push('The source-bound Brickwright build opens the KIM-1 gallery lesson, artwork and all 23 front-panel keys');

    await panel.locator('[data-kim1-key="GO"]').click();
    await page.locator('[data-switch-control="input0"]:visible').click();
    await page.locator('[data-switch-control="input2"]:visible').click();
    await page.waitForFunction(() => {
        const board = window.__board, state = board?.getDeviceState('kim1');
        return state?.running && (state.portB & 15) === 5 && (state.portA & 15) === 5 &&
            board.ledBrightness('lamp0') > 0.01 && board.ledBrightness('lamp2') > 0.01 &&
            board.ledBrightness('lamp1') === 0;
    });
    checks.push('Two real switches reach the CPU through PB and light the matching external PA LEDs');
    await page.screenshot({path: path.join(output, 'kim1-brickwright-desktop.png'), fullPage: true});

    await panel.locator('[data-kim1-key="ST"]').click();
    await panel.getByRole('textbox', {name: 'KIM-1 program', exact: true}).fill('0200: A9 2A 8D 00 03 00');
    await panel.locator('[data-kim1-key="GO"]').click();
    await page.waitForFunction(() => {
        const state = window.__board?.getDeviceState('kim1');
        return state?.ram[0x300] === 42 && state.cpu.a === 42 && !state.running;
    });
    checks.push('A newly entered NMOS program executes and stores 42 in RAM');

    const accepted = await page.evaluate(() => window.__circuit.getPart('kim1').params.program);
    await panel.getByRole('textbox', {name: 'KIM-1 program', exact: true}).fill('0200: not-a-byte');
    await panel.locator('[data-kim1-load]').click();
    await panel.getByRole('alert').waitFor();
    assert.equal(await page.evaluate(() => window.__circuit.getPart('kim1').params.program), accepted);
    await panel.getByRole('textbox', {name: 'KIM-1 program', exact: true}).fill('0200: A9 17 A2 42 00');
    await panel.locator('[data-kim1-load]').click();
    await panel.locator('[data-kim1-sst]').check();
    await panel.locator('[data-kim1-key="GO"]').click();
    assert.deepEqual(await page.evaluate(() => {
        const state = window.__board.getDeviceState('kim1');
        return [state.cpu.a, state.pc, state.running];
    }), [0x17, 0x0202, false]);
    assert.equal(await panel.locator('[data-kim1-display]').getAttribute('data-kim1-display'), '0202A2');
    await panel.locator('[data-kim1-sst]').uncheck();
    checks.push('Invalid source is rejected atomically, and SST exposes the next instruction on the display');

    for (const key of ['AD', '0', '3', '0', '0', 'DA', 'A', '5', '+']) {
        await panel.locator('[data-kim1-key="' + key + '"]').click();
    }
    assert.deepEqual(await page.evaluate(() => {
        const state = window.__board.getDeviceState('kim1');
        return [state.ram[0x300], state.address];
    }), [0xa5, 0x0301]);
    await panel.locator('[data-kim1-key="RS"]').click();
    assert.equal(await page.evaluate(() => window.__board.getDeviceState('kim1').ram[0x300]), 0xa5);
    const saved = await page.evaluate(() => window.__circuit.toJSON());
    assert.match(saved.parts.find(part => part.id === 'kim1').params.program, /0300: A5/);
    checks.push('Keypad memory edits and RS retention reach the serialized app circuit');

    await panel.locator('input[accept*=".ptp"]').setInputFiles({
        name: 'authored.ptp', mimeType: 'text/plain',
        buffer: Buffer.from(';032000A94200010E\r\n;0000010001\r\n')
    });
    await page.waitForFunction(() => document.querySelector('[data-kim1-panel="kim1"] textarea')?.value.startsWith(';03'));
    await panel.locator('[data-kim1-load]').click();
    await page.waitForFunction(() => window.__board?.getDeviceState('kim1')?.expansion?.[0x2000] === 0xa9);
    assert.match(await panel.getByRole('textbox', {name: 'KIM-1 program', exact: true}).inputValue(), /2000: A9 42 00/);
    checks.push('An uploaded paper tape is checked and installed in expansion RAM');

    const images = Buffer.alloc(2048);
    // This authored ROM outputs a zero on the first 6530-driven digit.
    const fixture = Buffer.from([0xa9,0x7f,0x8d,0x41,0x17,0xa9,0x1e,0x8d,0x43,0x17,
        0xa9,0x3f,0x8d,0x40,0x17,0xa9,8,0x8d,0x42,0x17,0x4c,0x14,0x1c]);
    fixture.copy(images, 1024);
    images[2045] = 0x1c;
    await panel.getByText('Firmware and TTY', {exact: true}).click();
    await panel.locator('[data-kim1-rom-input]').setInputFiles({
        name: 'authored.rom', mimeType: 'application/octet-stream', buffer: images
    });
    await page.waitForFunction(() => window.__board?.getDeviceState('kim1')?.segments?.[0] === 0x3f);
    assert.equal(await panel.locator('[data-kim1-display]').getAttribute('data-kim1-display'), '0     ');
    await panel.getByRole('button', {name: 'Learning monitor', exact: true}).click();
    await page.waitForFunction(() => window.__board?.getDeviceState('kim1')?.roms === null);
    checks.push('A session-mounted ROM drives the display through the 6530');

    await panel.getByRole('button', {name: 'Use Brickwright ROM', exact: true}).click();
    await page.waitForFunction(() => window.__board?.getDeviceState('kim1')?.romSource === 'brickwright');
    await page.waitForFunction(() =>
        document.querySelector('[data-kim1-panel="kim1"] [data-kim1-display]')?.getAttribute('data-kim1-display') === '000000');
    await panel.getByRole('button', {name: 'Learning monitor', exact: true}).click();
    await page.waitForFunction(() => window.__board?.getDeviceState('kim1')?.roms === null);
    checks.push('The bundled Brickwright ROM boots and drives the six display digits');

    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(output, 'kim1-brickwright-panel.png'), fullPage: true});
    assert.deepEqual(pageErrors, []);
    const result = {status: 'passed', application: 'Brickwright', fullApplicationBuild: true,
        sourceCommit, packageCommits, buildManifest, browser: browser.version(), checks};
    await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
} catch (error) {
    if (page) await page.screenshot({path: path.join(output, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(path.join(output, 'failure.json'), JSON.stringify({
        status: 'failed', sourceCommit, packageCommits, buildManifest,
        checks, pageErrors, error: String(error.stack || error)
    }, null, 2) + '\n');
    throw error;
} finally {
    await browser.close();
}
