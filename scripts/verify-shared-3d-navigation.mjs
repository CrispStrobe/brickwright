// SPDX-License-Identifier: BSD-3-Clause
// Exercise navigation and settings through the embedded editors' public UI.
import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';

const engine = process.env.BW_NAV_BROWSER === 'firefox' ? firefox : chromium;
const browser = await engine.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true
});
console.log(`Checking ${engine.name()} ${browser.version()}`);
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-cad-enabled', '1');
    localStorage.setItem('bw-right-pane-hidden', '1');
    localStorage.setItem('bw-sim-lab-coach-done', '1');
});
const tab = name => page.getByRole('tab', {name, exact: true});
const robots = page.getByTestId('bw-sim-lab-editor-canvas');
const cad = page.getByTestId('cad-canvas');
const position = async canvas => {
    if (canvas === robots) return page.evaluate(() => __bwSimLab.editView.camera);
    return canvas.evaluate(node => {
        const position = JSON.parse(node.dataset.cameraPosition);
        const target = JSON.parse(node.dataset.cameraTarget);
        return {position, target, distance: Math.hypot(...position.map((value, index) => value - target[index]))};
    });
};
const direction = ({position, target}) => position.map((value, index) => value - target[index]);
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const point = async canvas => {
    await canvas.waitFor();
    const box = await canvas.boundingBox();
    return {x: Math.round(box.x + box.width * 0.47), y: Math.round(box.y + box.height * 0.53)};
};
const native = async (canvas, event) => {
    const input = {...await point(canvas), ...event};
    assert.equal(await page.evaluate(detail => {
        window.dispatchEvent(new CustomEvent('brickwright-camera-input', {detail}));
        return detail.handled;
    }, input), true);
};
const wheel = (canvas, overrides = {}) => native(canvas, {
    kind: 'wheel', deltaMode: 0, precise: true, deltaX: 35, deltaY: 45, ...overrides
});
const drag = async canvas => {
    const {x, y} = await point(canvas);
    await page.mouse.move(x, y);
    await page.mouse.down({button: 'right'});
    await page.mouse.move(x + 70, y + 34, {steps: 5});
    await page.mouse.up({button: 'right'});
};
const transition = async (canvas, makeInput, expected) => {
    const before = await position(canvas);
    await makeInput(canvas);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    const after = await position(canvas);
    const change = difference(direction(before), direction(after));
    const zoom = Math.abs(after.distance / before.distance - 1);
    const pan = difference(before.target, after.target);
    const tolerance = before.distance * 0.0001;
    if (expected === 'pan') assert.ok(pan > tolerance && change < tolerance, JSON.stringify({expected, before, after}));
    if (expected === 'orbit') assert.ok(change > tolerance && zoom < 0.01, JSON.stringify({expected, before, after}));
    if (expected === 'zoom') assert.ok(zoom > 0.01, JSON.stringify({expected, before, after}));
};
const openRobots = async () => {
    await tab('Robots').click();
    await cad.waitFor({state: 'hidden'});
    const build = page.getByTestId('bw-sim-lab-mode-build');
    if (!await robots.isVisible()) await build.click();
    await page.waitForFunction(() => window.__bwSimLab?.editView?.camera && __bwSimLab.status === 'ready');
    await robots.waitFor();
};
const openCad = async () => {
    await tab('CAD').click();
    await robots.waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.__bwCad?.editor);
    await cad.waitFor();
};
const selectSetting = async (label, value) => {
    const trigger = page.getByTestId('bw-settings-menu-trigger');
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    const select = page.getByRole('combobox', {name: label, exact: true});
    if (!await select.isVisible()) {
        await page.getByRole('menuitem', {name: '3D navigation', exact: true}).getByText('3D navigation', {exact: true}).click();
    }
    await select.selectOption(value);
};

try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:8225/', {waitUntil: 'commit'});
    for (const [open, canvas] of [[openRobots, robots], [openCad, cad]]) {
        await open();
        const label = canvas === robots ? 'Robots Build' : 'embedded CAD';
        await transition(canvas, wheel, 'pan');
        await transition(canvas, view => wheel(view, {deltaX: 0, deltaY: 35}), 'pan');
        await transition(canvas, view => wheel(view, {shiftKey: true}), 'orbit');
        await transition(canvas, drag, 'orbit');
        await transition(canvas, view => native(view, {kind: 'zoom', factor: 1.2}), 'zoom');
        await transition(canvas, view => wheel(view, {deltaX: 0, deltaY: 120, precise: false}), 'zoom');
        await transition(canvas, async view => {
            const {x, y} = await point(view);
            await page.mouse.move(x, y);
            await page.mouse.wheel(16, 22);
        }, 'pan');
        console.log(`PASS ${label} browser wheel, macOS input, pinch and secondary drag defaults`);
    }

    const mounted = await page.evaluate(() => (window.__testCadView = __bwCad.editor, true));
    assert.equal(mounted, true);
    await selectSetting('Two-finger slide', 'orbit');
    await selectSetting('Secondary-button drag', 'pan');
    assert.equal(await page.evaluate(() => __bwCad.editor === window.__testCadView), true);
    await transition(cad, wheel, 'orbit');
    await transition(cad, drag, 'pan');
    await openRobots();
    await transition(robots, wheel, 'orbit');
    await transition(robots, drag, 'pan');
    await robots.focus();
    await page.keyboard.press('?');
    await page.getByTestId('bw-sim-lab-wheel-mode').selectOption('zoom');
    await page.getByTestId('bw-sim-lab-shortcuts-close').click();
    await transition(robots, wheel, 'zoom');
    await openCad();
    await transition(cad, wheel, 'zoom');
    await page.reload({waitUntil: 'commit'});
    await openCad();
    await transition(cad, wheel, 'zoom');
    await transition(cad, drag, 'pan');
    assert.deepEqual(errors, []);
    console.log('PASS settings update mounted editors, follow tab switches, and persist across reload');
} finally {
    await browser.close();
}
