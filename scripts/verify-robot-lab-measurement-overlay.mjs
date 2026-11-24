// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {firefox} from 'playwright';
import {openRobotLabTab, tool} from './lib/sim-lab-toolbar-gate.mjs';

const browser = await firefox.launch();
try {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(60000);
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await openRobotLabTab(page);
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
    await page.getByTestId('bw-sim-lab-model').selectOption('crank-rocker.ldr');
    await page.waitForFunction(() => {
        const state = window.__bwSimLab?._pane.state;
        return state?.shipped === 'crank-rocker.ldr' && state.status === 'ready' && !state.programLoading;
    });
    await tool(page, 'measurements');
    const panel = page.getByTestId('bw-sim-lab-measurements-panel');
    await panel.getByTestId('bw-sim-measurement-teaching-preset').click();
    await panel.getByTestId('bw-sim-lab-measurements-shown').check();
    const overlay = page.getByTestId('bw-sim-lab-measurement-overlay');
    const label = overlay.locator('[data-measurement-id="lesson-0"] text');
    await label.waitFor();
    const changes = await overlay.evaluate(async svg => {
        const waitFrames = async count => {
            for (let i = 0; i < count; i++) await new Promise(resolve => requestAnimationFrame(resolve));
        };
        await waitFrames(4);
        let mutations = 0;
        const observer = new MutationObserver(records => { mutations += records.length; });
        observer.observe(svg, {attributes: true, childList: true, characterData: true, subtree: true});
        try {
            await waitFrames(12);
            return mutations;
        } finally {
            observer.disconnect();
        }
    });
    console.log(`Measurement SVG mutations over 12 idle frames: ${changes}`);
    assert.equal(changes, 0);
    const before = await label.evaluate(node => [node.getAttribute('x'), node.getAttribute('y')]);
    await page.getByTestId('bw-sim-lab-3d-canvas').press('ArrowRight');
    await page.waitForFunction(([x, y]) => {
        const node = document.querySelector('[data-testid="bw-sim-lab-measurement-overlay"] [data-measurement-id="lesson-0"] text');
        return node && (node.getAttribute('x') !== x || node.getAttribute('y') !== y);
    }, before);
    const value = await label.textContent();
    await tool(page, 'run');
    await page.evaluate(() => window.__bwSimLab.api.setMotorSpeed('A', 60));
    await page.waitForFunction(before => {
        const node = document.querySelector('[data-testid="bw-sim-lab-measurement-overlay"] [data-measurement-id="lesson-0"] text');
        return node && node.textContent !== before && window.__bwSimLab._pane.state.replayFrames >= 2;
    }, value);
    await tool(page, 'pause');
    await page.getByTestId('bw-sim-lab-replay-slider').fill('0');
    await label.waitFor({state: 'detached'});
    await tool(page, 'run');
    await label.waitFor();
    console.log('PASS Firefox: measurements follow camera and live readings, hide during replay and return on Run');
} finally {
    await browser.close();
}
