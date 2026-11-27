import {openManualControls} from './sim-lab-manual-controls.mjs';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Choose the shipped rover, load its example, and run it through the real GUI and worker.
// Internal hooks only observe the simulation; all commands use visible controls.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {instructionsInteractions} from './sim-lab-instructions-gate.mjs';

export const surveyRoverInteractions = async (page, {openSimLab, shotsDir, timeout}) => {
    mkdirSync(shotsDir, {recursive: true});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await openSimLab(page, {program: null});
    await page.getByTestId('bw-sim-lab-model').selectOption('survey-rover.ldr');
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready' &&
        window.__bwSimLab._pane.state.modelFile === 'survey-rover.ldr', null, {timeout: 60000});

    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'),
        null, {timeout: 60000});
    assert.match(await page.locator('.cm-content').first().textContent(), /set motor stop action C hold/);
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.session?.mat === 'plain',
        null, {timeout: 60000});
    await page.getByTestId('bw-sim-lab-3d-canvas').waitFor();
    await page.screenshot({path: resolve(shotsDir, 'survey-rover.png')});
    await page.evaluate(() => {
        const session = window.__bwSimLab._pane.session;
        const hub = session.bridge.hubBody;
        const head = session.mechanism.actuators.find(a => a.port === 'C').joint;
        const rec = window.__bwSurveyRover = {start: session.time, worker: session.worker,
            initial: session.core.bodyPose(hub).position.slice(), outward: 0, returned: 0, low: 0, high: 0, end: 0, upright: 1};
        session.onAdvance(() => {
            const pose = session.core.bodyPose(hub);
            const angle = session.core.jointState(head).angle * 180 / Math.PI;
            const d = Math.hypot(...pose.position.map((v, i) => v - rec.initial[i]));
            const [x, , z] = pose.rotation;
            rec.outward = Math.max(rec.outward, d); rec.returned = d;
            rec.low = Math.min(rec.low, angle); rec.high = Math.max(rec.high, angle); rec.end = angle;
            rec.upright = Math.min(rec.upright, 1 - 2 * (x * x + z * z));
        });
    });
    await page.getByTestId('bw-sim-lab-run').click();
    await page.waitForFunction(() => window.__bwSimLab._pane.session.time - window.__bwSurveyRover.start >= 13000,
        null, {timeout});
    const r = await page.evaluate(() => window.__bwSurveyRover);
    assert.equal(r.worker, true);
    assert.ok(r.outward > 0.085 && r.outward < 0.12, JSON.stringify(r));
    assert.ok(r.returned < 0.015, JSON.stringify(r));
    assert.ok(r.low < -25 && r.high > 25 && r.low > -35 && r.high < 35, JSON.stringify(r));
    assert.ok(Math.abs(r.end) < 3 && r.upright > 0.98, JSON.stringify(r));
    await openManualControls(page, {override: true});
    const toggle = page.getByTestId('bw-sim-lab-mixer-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    const sliders = page.getByTestId('bw-sim-lab-mixer-slider');
    assert.deepEqual(await sliders.evaluateAll(els => els.map(e => e.dataset.port).sort()), ['A', 'B', 'C']);
    for (const slider of await sliders.all()) assert.equal(await slider.isEnabled(), true);
    await page.screenshot({path: resolve(shotsDir, 'survey-rover-motors.png')});
    await toggle.click();
    // Draw every instruction page and the printable manual, including the complete bill of materials.
    await instructionsInteractions(page, {shotsDir, printFullPage: false});
    return r;
};
