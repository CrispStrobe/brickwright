#!/usr/bin/env node
// Served-GUI smoke for the Widgets machine console. No media is bundled: a
// synthetic VGA frame and input collectors exercise the same mirror/input seam
// the experimental 386 runner calls after boot.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.env.PROOF_URL || 'http://127.0.0.1:8777/';
const browser = await chromium.launch({headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    // Desktop webviews can omit the browser's element fullscreen API.
    await page.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', {value: undefined});
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof window.bwMirrorMachineVideo === 'function');
    const dismiss = page.getByTestId('bw-starter-backdrop').getByRole('button', {name: 'Not now'});
    if (await dismiss.count()) await dismiss.click();
    await page.evaluate(() => {
        window.__widgetProof = {keys: [], mouse: [], stopCalls: 0};
        const originalStop = window.bwStopMachineVideo;
        if (typeof originalStop === 'function') {
            window.bwStopMachineVideo = (...args) => {
                window.__widgetProof.stopCalls++;
                return originalStop(...args);
            };
        }
        let frame = 0;
        window.bwMirrorMachineVideo({
            widget: {name: 'Proof VGA', type: 'simplevga', source: 'video',
                config: {width: 64, height: 48}},
            videoFn: () => {
                const rgba = new Uint8ClampedArray(64 * 48 * 4);
                for (let i = 0; i < rgba.length; i += 4) {
                    rgba[i] = 40; rgba[i + 1] = 80; rgba[i + 2] = 160; rgba[i + 3] = 255;
                }
                return {width: 64, height: 48, rgba, frame: frame++, signal: true};
            },
            keyInFn: code => window.__widgetProof.keys.push(code),
            mouseInFn: event => window.__widgetProof.mouse.push(event),
        });
    });
    const consoleFace = page.getByTestId('bw-machine-console');
    try {
        await consoleFace.waitFor();
    } catch (error) {
        const evidence = await page.evaluate(() => ({
            dock: localStorage.getItem('bw-debug-dock'),
            consoleCount: document.querySelectorAll('[data-testid="bw-machine-console"]').length,
            debugPanels: document.querySelectorAll('[data-debug-panel]').length,
            stopCalls: window.__widgetProof?.stopCalls ?? null,
        }));
        throw new Error(`machine console did not become visible: ${JSON.stringify(evidence)}`, {cause: error});
    }
    const canvas = page.getByTestId('bw-machine-canvas');
    const box = await canvas.boundingBox();
    assert.ok(box.width >= 300 && box.height >= 300, 'Widgets VGA fills the pane');
    await canvas.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.down('Shift');
    const fullScreenButton = page.getByTestId('bw-machine-fullscreen');
    await fullScreenButton.click();
    await fullScreenButton.getByText('Exit full screen', {exact: true}).waitFor();
    const fullBox = await canvas.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(fullBox.width >= viewport.width - 3 && fullBox.height >= viewport.height * 0.85,
        `full screen fills viewport: ${JSON.stringify(fullBox)}`);
    assert.ok(await consoleFace.evaluate(element => element === document.activeElement));
    await page.keyboard.press('b');
    await page.keyboard.up('Shift');
    await fullScreenButton.click();
    await fullScreenButton.getByText('Full screen', {exact: true}).waitFor();
    assert.deepEqual(await canvas.boundingBox(), box, 'exit restores the docked geometry');
    await canvas.hover({position: {x: 50, y: 50}});
    await page.mouse.move(box.x + 80, box.y + 70);
    await page.mouse.down({button: 'right'});
    await page.mouse.up({button: 'right'});
    const observed = await page.evaluate(() => window.__widgetProof);
    assert.deepEqual(observed.keys, [0x1d, 0x1e, 0x9e, 0x9d, 0x2a, 0xaa, 0x30, 0xb0],
        'set-1 make/break and blur release reach the runner');
    assert.ok(observed.mouse.some(event => event.dx !== 0 || event.dy !== 0));
    assert.ok(observed.mouse.some(event => event.buttons === 2), 'right button uses PS/2 bit 1');
    assert.deepEqual(errors, [], 'browser has no page errors');
    console.log(JSON.stringify({ok: true, canvas: {width: box.width, height: box.height},
        fullscreen: {width: fullBox.width, height: fullBox.height},
        keys: observed.keys, mousePackets: observed.mouse.length}));
} finally {
    await browser.close();
}
