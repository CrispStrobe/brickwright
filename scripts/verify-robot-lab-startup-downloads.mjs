// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {firefox} from 'playwright';
import {openRobotLabTab, tool} from './lib/sim-lab-toolbar-gate.mjs';

const base = process.argv[2] || 'http://127.0.0.1:8242/';
const modelUrl = name => new URL(`static/sim-lab/models/${name}`, base).href;
const browser = await firefox.launch();
try {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(90000);
    const models = [];
    page.on('request', request => {
        const url = new URL(request.url());
        if (/\/static\/sim-lab\/models\/[^/]+\.ldr$/.test(url.pathname)) models.push(url.origin + url.pathname);
    });
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(base, {waitUntil: 'commit'});
    await openRobotLabTab(page);
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready');
    console.log(`Robot Lab startup requested ${models.length} LDraw examples (${new Set(models).size} distinct)`);
    if (process.env.BW_STARTUP_BASELINE !== '1') assert.deepEqual(models, [modelUrl('driving-base.ldr')]);

    models.length = 0;
    await page.getByTestId('bw-sim-lab-model').selectOption('twistspan.ldr');
    await page.waitForFunction(() => {
        const pane = window.__bwSimLab?._pane;
        return pane?.state.shipped === 'twistspan.ldr' && pane.state.status === 'ready' && !pane.state.programLoading;
    });
    const policy = await page.evaluate(() => window.__bwSimLab._pane.manualControlPolicy());
    assert.equal(policy.available, true);
    assert.ok(policy.manualJog?.A);
    if (process.env.BW_STARTUP_BASELINE !== '1') assert.deepEqual(models, [modelUrl('twistspan.ldr')]);
    await tool(page, 'run');
    await page.waitForFunction(() => Math.abs(window.__bwSimLab.api.encoder('A').angleDeg) > 10);
    await tool(page, 'pause');
    models.length = 0;
    const savedPolicy = await page.evaluate(async () => {
        const {api, _pane: pane} = window.__bwSimLab;
        const saved = pane.lib.serializeModel(pane.session.model, {name: 'my-saved-robot.ldr'});
        const opened = await api.loadModel(saved);
        const {available, manualJog} = pane.manualControlPolicy();
        return {opened: opened.ok, shipped: pane.state.shipped, available, manualJog};
    });
    assert.deepEqual(savedPolicy, {opened: true, shipped: null, available: true, manualJog: policy.manualJog});
    if (process.env.BW_STARTUP_BASELINE !== '1') assert.deepEqual(models, []);
    console.log('PASS Firefox: TwistSpan moves on Run and preserves bounded controls after reopening as a saved assembly');
} finally {
    await browser.close();
}
