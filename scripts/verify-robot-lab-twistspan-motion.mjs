// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';

const engine = process.env.BW_ROBOT_BROWSER === 'firefox' ? firefox : chromium;
const browser = await engine.launch(engine === chromium ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {});
const stallMode = process.env.BW_STALL_RENDER_FENCE;
try {
    const page = await browser.newPage({viewport: {width: 1242, height: 758}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(90000);
    await page.addInitScript(mode => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        if (mode !== '1' && mode !== 'late') return;
        const prototype = WebGL2RenderingContext.prototype;
        const original = prototype.getSyncParameter;
        window.__bwStallRenderFence = mode === '1';
        window.__bwStalledRenderPolls = 0;
        prototype.getSyncParameter = function (fence, parameter) {
            if (window.__bwStallRenderFence && parameter === this.SYNC_STATUS && this.canvas.closest?.('[data-testid="bw-sim-lab-main"]')) {
                window.__bwStalledRenderPolls++;
                return this.UNSIGNALED;
            }
            return original.call(this, fence, parameter);
        };
    }, stallMode);
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Robots', exact: true}).click();
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
    await page.getByTestId('bw-sim-lab-model').selectOption('twistspan.ldr');
    await page.waitForFunction(() => {
        const state = window.__bwSimLab?._pane.state;
        return state?.shipped === 'twistspan.ldr' && state.status === 'ready' && !state.programLoading && state.view3d === 'webgl';
    });
    if (process.env.BW_CHECK_IDLE_RENDER === '1') {
        const idle = await page.evaluate(async () => {
            const {session, view} = window.__bwSimLab._pane;
            const waitFrames = async count => {
                for (let i = 0; i < count; i++) await new Promise(resolve => requestAnimationFrame(resolve));
            };
            await waitFrames(12);
            const before = view.renderStats().frames;
            const snapshot = session.snapshot;
            let snapshots = 0;
            session.snapshot = function () {
                snapshots++;
                return snapshot.call(this);
            };
            try {
                await waitFrames(12);
                return {draws: view.renderStats().frames - before, snapshots};
            } finally {
                delete session.snapshot;
            }
        });
        console.log(`Idle TwistSpan over 12 animation frames: ${JSON.stringify(idle)}`);
        assert.deepEqual(idle, {draws: 0, snapshots: 0});
        const beforeOrbit = await page.evaluate(() => window.__bwSimLab._pane.view.renderStats().frames);
        await page.getByTestId('bw-sim-lab-3d-canvas').press('ArrowRight');
        await page.waitForFunction(before => window.__bwSimLab._pane.view.renderStats().frames > before, beforeOrbit);
    }
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
    const expectRenderedMovement = previous => page.waitForFunction(start => {
        const point = window.__bwSimLab._pane.view.partScreenPoint('lower_tie_80');
        return point && Math.hypot(point.x - start.x, point.y - start.y) > 2;
    }, previous, {timeout: 25000});
    await expectRenderedMovement(before);
    if (stallMode === 'late') {
        const atStall = await page.evaluate(() => {
            window.__bwStallRenderFence = true;
            return window.__bwSimLab._pane.view.partScreenPoint('lower_tie_80');
        });
        await page.waitForFunction(() => window.__bwStalledRenderPolls > 0);
        await expectRenderedMovement(atStall);
    }
    if (process.env.BW_CHECK_REPLAY === '1') {
        await page.getByTestId('bw-sim-lab-pause').click();
        const slider = page.getByTestId('bw-sim-lab-replay-slider');
        await slider.waitFor();
        const paused = await page.evaluate(() => window.__bwSimLab._pane.view.partScreenPoint('lower_tie_80'));
        await slider.fill('0');
        await page.waitForFunction(() => window.__bwSimLab._pane.state.replayAt === 0);
        await expectRenderedMovement(paused);
        await page.getByTestId('bw-sim-lab-run').click();
        await page.waitForFunction(() => window.__bwSimLab._pane.state.replayAt === null);
        console.log('PASS: pausing, displaying the first recorded pose, and returning to the live run');
    }
    if (stallMode === '1') assert.ok(await page.evaluate(() => window.__bwStalledRenderPolls > 0));
    const scenario = stallMode === 'late' ? ' after a GPU fence stalls mid-run' :
        stallMode === '1' ? ' with a stalled GPU fence' : '';
    console.log(`PASS ${engine.name()}: TwistSpan motor, suspended beam and displayed mesh move${scenario}`);
} finally {
    await browser.close();
}
