// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';

const engine = process.env.BW_ROBOT_BROWSER === 'firefox' ? firefox : chromium;
const browser = await engine.launch(engine === chromium ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {});
const url = process.argv[2] || 'http://127.0.0.1:8242/';
const open = async () => {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(45000);
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(url, {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Robots', exact: true}).click();
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready' && !window.__bwSimLab._pane.state.programLoading);
    return page;
};
const run = page => page.getByTestId('bw-sim-lab-run').click();
const pause = page => page.getByTestId('bw-sim-lab-pause').click();
const expectMotion = page => page.waitForFunction(() => {
    const pane = window.__bwSimLab?._pane;
    const motors = pane?.api?.motors();
    return pane?.clock?.installed && motors?.some(motor => Math.abs(pane.api.encoder(motor.id)?.angleDeg) > 20);
});
try {
    const page = await open();
    assert.equal(await page.getByTestId('bw-sim-lab-model').inputValue(), 'driving-base.ldr');
    const start = await page.evaluate(() => window.__bwSimLab._pane.api.pose('hub').position);
    await run(page);
    await expectMotion(page);
    await page.waitForFunction(([x, , z]) => {
        const position = window.__bwSimLab?._pane.api.pose('hub').position;
        return position && Math.hypot(position[0] - x, position[2] - z) > .03;
    }, start);
    await pause(page);
    for (const model of ['line-follower.ldr', 'centrifugal-governor.ldr']) {
        await page.getByTestId('bw-sim-lab-model').selectOption(model);
        await page.waitForFunction(model => {
            const pane = window.__bwSimLab?._pane;
            return pane?.state.shipped === model && pane.state.status === 'ready' && !pane.state.programLoading;
        }, model);
        await run(page);
        await expectMotion(page);
        await pause(page);
    }
    await page.close();

    const authored = await open();
    const draft = JSON.stringify({lang: 'pseudocode', code: 'WHEN flag clicked:\n  wait 7 seconds'});
    await authored.evaluate(draft => localStorage.setItem('bw-code-autosave', draft), draft);
    await run(authored);
    await authored.getByTestId('bw-sim-lab-run-needs-program').waitFor();
    assert.equal(await authored.evaluate(() => localStorage.getItem('bw-code-autosave')), draft);
    await authored.getByTestId('bw-sim-lab-load-and-run').click();
    await expectMotion(authored);
    console.log(`PASS ${engine.name()}: first Run moves the starter, model programs move, and an existing Code draft requires an explicit choice`);
} finally {
    await browser.close();
}
