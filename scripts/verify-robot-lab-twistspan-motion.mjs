// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';

const engine = process.env.BW_ROBOT_BROWSER === 'firefox' ? firefox : chromium;
const browser = await engine.launch(engine === chromium ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {});
const stalled = process.env.BW_STALL_RENDER_FENCE === '1';
try {
    const page = await browser.newPage({viewport: {width: 1242, height: 758}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(90000);
    await page.addInitScript(stall => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        if (!stall) return;
        const prototype = WebGL2RenderingContext.prototype;
        const original = prototype.getSyncParameter;
        window.__bwStalledRenderPolls = 0;
        prototype.getSyncParameter = function (fence, parameter) {
            if (parameter === this.SYNC_STATUS && this.canvas.closest?.('[data-testid="bw-sim-lab-main"]')) {
                window.__bwStalledRenderPolls++;
                return this.UNSIGNALED;
            }
            return original.call(this, fence, parameter);
        };
    }, stalled);
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Robots', exact: true}).click();
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
    await page.getByTestId('bw-sim-lab-model').selectOption('twistspan.ldr');
    await page.waitForFunction(() => {
        const state = window.__bwSimLab?._pane.state;
        return state?.shipped === 'twistspan.ldr' && state.status === 'ready' && !state.programLoading && state.view3d === 'webgl';
    });
    const before = await page.evaluate(() => window.__bwSimLab._pane.view.partScreenPoint('lower_tie_80'));
    assert.ok(before && Number.isFinite(before.x));
    await page.getByTestId('bw-sim-lab-run').click();
    await page.waitForFunction(() => {
        const {api} = window.__bwSimLab;
        return Math.abs(api.encoder('A').angleDeg - 20) < 1 && Math.abs(api.pose('payload_bar').headingDeg) > 5;
    });
    const physics = await page.evaluate(() => ({
        motor: window.__bwSimLab.api.encoder('A').angleDeg,
        payload: window.__bwSimLab.api.pose('payload_bar').headingDeg,
        time: window.__bwSimLab._pane.session.time
    }));
    console.log(`TwistSpan physics: ${JSON.stringify(physics)}`);
    if (stalled) assert.ok(await page.evaluate(() => window.__bwStalledRenderPolls > 0));
    await page.waitForFunction(previous => {
        const point = window.__bwSimLab._pane.view.partScreenPoint('lower_tie_80');
        return point && Math.hypot(point.x - previous.x, point.y - previous.y) > 2;
    }, before, {timeout: 15000});
    console.log(`PASS ${engine.name()}: TwistSpan motor, suspended beam and displayed mesh move${stalled ? ' with a stalled GPU fence' : ''}`);
} finally {
    await browser.close();
}
