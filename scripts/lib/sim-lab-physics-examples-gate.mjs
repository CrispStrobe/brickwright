// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {MODELS} from '../../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {MODEL_LESSONS} from '../../overlay/scratch-gui/src/lib/bw-sim/model/example-catalog.js';

// All changes go through visible controls. Internal hooks only observe worker results.
export const physicsExamplesInteractions = async (page, {openSimLab, shotsDir, timeout}) => {
    mkdirSync(shotsDir, {recursive: true});
    await openSimLab(page, {program: null});
    const open = page.getByTestId('bw-sim-lab-examples');
    const gallery = page.getByTestId('bw-sim-examples');
    await open.click();
    await gallery.getByRole('combobox', {name: 'Model size', exact: true}).selectOption('large');
    const expectedLarge=MODELS.map(m=>m.id||m.file).filter(key=>MODEL_LESSONS[key].pieces>50).sort();
    const foundLarge = [];
    const next = gallery.getByRole('button', {name: 'Next page', exact: true});
    for (;;) {
        foundLarge.push(...await gallery.getByTestId('bw-sim-example-card').evaluateAll(cards =>
            cards.map(card => card.dataset.model)));
        if (!await next.count() || await next.isDisabled()) break;
        await next.click();
    }
    assert.deepEqual(foundLarge.sort(), expectedLarge);
    await gallery.getByRole('combobox', {name: 'Physics topic', exact: true}).selectOption('chains');
    assert.equal(await gallery.getByTestId('bw-sim-example-card').count(), 1);
    assert.match(await gallery.textContent(), /59 pieces/);
    await page.screenshot({path: resolve(shotsDir, 'examples-large-chain.png')});
    await gallery.getByRole('button', {name: /^Open model \+ program:/}).click();
    await gallery.waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' &&
        window.__bwSimLab._pane.state.modelFile === 'chain-transmission.ldr');
    assert.match(await page.locator('.cm-content').first().textContent(), /1080/);
    await page.evaluate(() => {
        const s = window.__bwSimLab._pane.session;
        const input = s.mechanism.actuators[0].joint;
        const outputBody = s.mechanism.bodies.find(b => b.parts.includes('sprocketBig')).id;
        const output = s.mechanism.joints.find(j => j.body2 === outputBody).id;
        const rec = window.__bwWorkshop = {worker: s.worker, start: s.time, input: 0, output: 0, end: 0};
        s.onAdvance(() => {
            const a = s.core.jointState(input).angle;
            rec.end = a;
            if (a > rec.input) { rec.input = a; rec.output = s.core.jointState(output).angle; }
        });
    });
    await page.getByTestId('bw-sim-lab-run').click();
    await page.waitForFunction(() => window.__bwSimLab._pane.session.time - window.__bwWorkshop.start >= 14000, null, {timeout});
    const result = await page.evaluate(() => window.__bwWorkshop);
    assert.equal(result.worker, true);
    assert.ok(Math.abs(result.input / (2 * Math.PI) - 3) < 0.03, JSON.stringify(result));
    assert.ok(Math.abs(result.output / result.input - 2 / 3) < 0.005, JSON.stringify(result));
    assert.ok(Math.abs(result.end) < 0.06, JSON.stringify(result));
    await page.screenshot({path: resolve(shotsDir, 'chain-transmission.png')});

    // The gallery also replaces a Build model and returns to simulation with its program.
    await page.getByTestId('bw-sim-lab-mode-build').click();
    await open.click();
    await gallery.getByRole('searchbox').fill('flywheel');
    assert.deepEqual(await gallery.getByTestId('bw-sim-example-card').evaluateAll(es =>
        es.map(e => e.dataset.model).sort()), ['counterturn.ldr', 'flywheel-differential.ldr']);
    const flywheel = gallery.locator('[data-testid="bw-sim-example-card"][data-model="flywheel-differential.ldr"]');
    assert.match(await flywheel.textContent(), /56 pieces/);
    await flywheel.getByRole('button', {name: /^Open model \+ program:/}).click();
    await gallery.waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' &&
        window.__bwSimLab._pane.state.modelFile === 'flywheel-differential.ldr' &&
        window.__bwSimLab._pane.state.mode === 'simulate' && !window.__bwSimLab._pane.editor);
    await page.screenshot({path: resolve(shotsDir, 'flywheel-differential.png')});
    await open.click();
    await gallery.getByRole('searchbox').fill('no such mechanism');
    assert.equal(await gallery.getByTestId('bw-sim-example-card').count(), 0);
    await page.keyboard.press('Escape');
    await gallery.waitFor({state: 'hidden'});
    assert.equal(await open.evaluate(e => e === document.activeElement), true);
    return result;
};

export const germanPhysicsExamplesInteractions = async (page, {openSimLab, shotsDir}) => {
    await openSimLab(page, {program: null});
    await page.getByTestId('bw-sim-lab-examples').click();
    const gallery = page.getByTestId('bw-sim-examples');
    assert.equal(await gallery.getAttribute('aria-label'), 'Beispiele im Roboter-Labor');
    await gallery.getByRole('combobox', {name: 'Modellgröße', exact: true}).selectOption('large');
    await gallery.getByRole('searchbox').fill('Schwungrad');
    assert.deepEqual(await gallery.getByTestId('bw-sim-example-card').evaluateAll(es =>
        es.map(e => e.dataset.model).sort()), ['counterturn.ldr', 'flywheel-differential.ldr']);
    assert.match(await gallery.locator('[data-testid="bw-sim-example-card"][data-model="flywheel-differential.ldr"]').textContent(), /56 Teile/);
    const bounds = await gallery.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width + 1);
    await page.screenshot({path: resolve(shotsDir, 'examples-german.png')});
    await gallery.getByRole('button', {name: 'Beispiele schließen', exact: true}).click();
};
