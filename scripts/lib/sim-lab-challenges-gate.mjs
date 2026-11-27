// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The mats' challenges (lib/bw-sim/world/challenges.js, the Challenges panel) for
// scripts/verify-sim-lab-browser.mjs (--part=ui), with the Wall stopper and its own example
// program, through clicks only:
//
//   1. Challenges lists one challenge per mat; "Stop at the wall" keeps the wall mat and puts
//      the robot back at the start;
//   2. Run: the example program stops before the wall and the challenge is won, with stars and
//      the gap it left; the world pauses; the best result is kept on this device and listed;
//   4. the Drawing robot (its castor ball a pen) and its own program win "Draw a square" on the plain mat,
//      judged from what the pen drew;
//   3. "Stay in the ring" moves the robot to the sumo mat. There the program stops at once (its
//      distance sensor sees nothing: -1 < 10 cm), so the motors are driven straight on through the
//      Robot Lab API, out of the ring, and the challenge says so.

import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {tool, toolAttribute} from './sim-lab-toolbar-gate.mjs';

const lab = (page, fn, arg) => page.evaluate(fn, arg);

export const challengesInteractions = async (page, {shotsDir}) => {
    try {
        return await checks(page, {shotsDir});
    } catch (error) {
        await page.screenshot({path: resolve(shotsDir, 'sim-lab-challenges-failure.png'), fullPage: true}).catch(() => {});
        throw error;
    }
};

const ready = (page, mat) => page.waitForFunction(m => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.session?.mat === m &&
    window.__bwSimLab._pane.challengeRun, mat, {timeout: 60000});

const finished = page => page.waitForFunction(() => ['done', 'failed'].includes(window.__bwSimLab._pane.state.challengeResult?.status),
    null, {timeout: 90000});

const checks = async (page, {shotsDir}) => {
    const out = {};
    await page.getByTestId('bw-sim-lab-model').selectOption('wall-stopper.ldr');
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === 'wall-stopper.ldr' &&
        window.__bwSimLab._pane.session, null, {timeout: 60000});

    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'), null, {timeout: 60000});
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.session?.mat === 'wall', null, {timeout: 60000});

    // 1. The list, and a challenge on the mat the robot is on.
    await tool(page, 'challenges');
    const panel = page.getByTestId('bw-sim-lab-challenges-panel');
    await panel.waitFor();
    const listed = await panel.locator('li').evaluateAll(lis => lis.map(li => li.dataset.testid));
    assert.equal(listed.length, 6, `one challenge per mat but Warehouse: ${listed}`);
    await page.getByTestId('bw-sim-lab-challenge-start-wall-stop').click();
    await ready(page, 'wall');
    assert.match(await page.getByTestId('bw-sim-lab-challenge-status').textContent(), /without touching it.*Press Run/);

    // 2. The example program wins it.
    await tool(page, 'run');
    await finished(page);
    const won = await lab(page, () => ({...window.__bwSimLab._pane.state.challengeResult, status2: window.__bwSimLab.status}));
    assert.equal(won.status, 'done', `the Wall stopper's program stops at the wall: ${JSON.stringify(won)}`);
    assert.ok(won.value > 0 && won.value < 0.3 && won.stars >= 1, `a gap and stars: ${JSON.stringify(won)}`);
    assert.equal(won.status2, 'paused', 'a finished challenge pauses the world');
    const result = page.getByTestId('bw-sim-lab-challenge-result');
    assert.match(await result.textContent(), /\d+ cm to the wall/);
    assert.equal(await result.getByRole('img').getAttribute('aria-label'), `${won.stars} of 3 stars`);
    await page.screenshot({path: resolve(shotsDir, 'sim-lab-challenges.png')});
    const kept = JSON.parse(await lab(page, () => localStorage.getItem('bw-sim-challenge-best')));
    assert.equal(kept['wall-stop'].stars, won.stars, 'the best result is kept on this device');
    await page.getByTestId('bw-sim-lab-challenge-list').click();
    assert.match(await page.getByTestId('bw-sim-lab-challenge-wall-stop').getByRole('img').getAttribute('aria-label'), /^Best: \d of 3 stars, \d+ cm/);
    out.wallStars = won.stars;
    out.wallGapCm = Math.round(won.value * 100);

    // 3. Another mat's challenge: the robot moves there, and this program loses it.
    await page.getByTestId('bw-sim-lab-challenge-start-sumo-stay').click();
    await ready(page, 'sumo');
    assert.equal(await page.getByTestId('bw-sim-lab-mat').inputValue(), 'sumo', 'the Mat list follows the challenge');
    await tool(page, 'run');
    await page.waitForFunction(() => window.__bwSimLab.status === 'running' && window.__bwSimLab._pane.session.time > 300, null, {timeout: 30000});
    await lab(page, () => Promise.all(['A', 'B'].map(p => window.__bwSimLab.api.setMotorSpeed(p, p === 'A' ? -360 : 360))));
    await finished(page);
    const lost = await lab(page, () => window.__bwSimLab._pane.state.challengeResult);
    assert.deepEqual([lost.status, lost.why], ['failed', 'leftRing'], `driving straight on leaves the ring: ${JSON.stringify(lost)}`);
    assert.equal(await lab(page, () => window.__bwSimLab.status), 'paused');
    assert.match(await page.getByTestId('bw-sim-lab-challenge-result').textContent(), /left the ring/);
    out.sumoLostAtS = lost.timeS;
    // ✕ closes the panel, and the Challenges switch is off again
    await page.getByTestId('bw-sim-lab-challenges-close').click();
    await panel.waitFor({state: 'detached'});
    assert.equal(await panel.count(), 0, 'the panel is gone after ✕');
    assert.equal(await toolAttribute(page, 'challenges', 'aria-checked'), 'false');

    // 4. The Drawing robot draws a square with its own program.
    await page.getByTestId('bw-sim-lab-model').selectOption('drawing-robot.ldr');
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === 'drawing-robot.ldr' &&
        window.__bwSimLab._pane.session, null, {timeout: 60000});

    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'), null, {timeout: 60000});
    await tool(page, 'challenges');
    await panel.waitFor();
    await page.getByTestId('bw-sim-lab-challenge-start-draw-square').click();
    await ready(page, 'plain');
    await tool(page, 'run');
    await page.waitForFunction(() => ['done', 'failed'].includes(window.__bwSimLab._pane.state.challengeResult?.status), null, {timeout: 180000});
    const drawn = await lab(page, () => ({...window.__bwSimLab._pane.state.challengeResult, strokes: window.__bwSimLab.api.drawing().length}));
    assert.equal(drawn.status, 'done', `the Drawing robot's square: ${JSON.stringify(drawn)}`);
    assert.ok(drawn.stars >= 1 && drawn.strokes >= 1, JSON.stringify(drawn));
    assert.match(await page.getByTestId('bw-sim-lab-challenge-result').textContent(), /% off a square/);
    await page.screenshot({path: resolve(shotsDir, 'sim-lab-challenge-square.png')});
    out.squareStars = drawn.stars;
    out.squareOff = Math.round(drawn.value * 100);
    return out;
};
