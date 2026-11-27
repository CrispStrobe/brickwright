#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {openManualControls} from './lib/sim-lab-manual-controls.mjs';

const shots = 'artifacts/robot-lab-compact';
mkdirSync(shots, {recursive: true});
const browser = await chromium.launch();
const errors = [];
try {
    for (const locale of ['en-US', 'de-DE']) {
        const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale, serviceWorkers: 'block'});
        page.setDefaultTimeout(90000);
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');
        });
        await page.emulateMedia({reducedMotion: 'reduce'});
        await page.goto(process.env.PROOF_URL || 'http://127.0.0.1:8767/', {waitUntil: 'networkidle'});
        await page.getByRole('tab', {name: /^(Robots|Roboter)$/}).click();
        await page.waitForFunction(() => window.__bwSimLab?.status === 'ready', null, {timeout: 90000});
        await page.getByTestId('bw-sim-lab-model').scrollIntoViewIfNeeded();
        let releaseProgram;
        const blockedProgram = new Promise(resolve => { releaseProgram = resolve; });
        await page.route('**/sim-lab/programs/centrifugal-governor.bw', async route => {
            await blockedProgram;
            await route.continue();
        });
        const programRequested = page.waitForRequest('**/sim-lab/programs/centrifugal-governor.bw');
        try {
            await page.getByTestId('bw-sim-lab-model').selectOption('centrifugal-governor.ldr');
            await programRequested;
            assert.ok(await page.getByTestId('bw-sim-lab-run').isDisabled(), 'Run waits for automatic program loading');
        } finally { releaseProgram(); }
        await page.waitForFunction(() => {
            const p = window.__bwSimLab._pane;
            return p.state.shipped === 'centrifugal-governor.ldr' && p.state.status === 'ready' && !p.state.programLoading && p.spikeLoaded() &&
                /Blocks loaded|Blöcke geladen/.test(document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || '');
        }, null, {timeout: 90000});
        const title = await page.evaluate(() => {
            const p = window.__bwSimLab._pane;
            return {actual: window.__brickwrightStore.getState().scratchGui.projectTitle,
                expected: p.shippedModel().title[p.locale] || p.shippedModel().title.en};
        });
        assert.equal(title.actual, title.expected, 'example selection names the project');
        assert.ok((await page.locator('input[type="text"]').evaluateAll(es => es.map(e => e.value))).includes(title.expected),
            'the title is visible in the app header');
        assert.equal(await page.getByTestId('bw-sim-lab-example').count(), 0, 'no separate program-load button');
        assert.equal(await page.getByTestId('bw-sim-lab-mixer').count(), 0, 'manual bar occupies no height by default');
        assert.equal(await page.getByTestId('bw-sim-lab-info').count(), 0, 'long explanation stays closed');
        assert.equal(await page.getByTestId('bw-sim-lab-lesson').textContent(), '', 'lesson is an accessible icon');

        for (const width of [1600, 1024, 768]) {
            await page.setViewportSize({width, height: 1000});
            await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
            const geometry = await page.getByTestId('bw-sim-lab-toolbar').evaluate(bar => {
                const rects = [...bar.querySelectorAll('button, select, [role="status"]')]
                    .map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
                const centres = rects.map(r => r.y + r.height / 2);
                return {height: bar.getBoundingClientRect().height, scroll: bar.scrollWidth > bar.clientWidth,
                    spread: Math.max(...centres) - Math.min(...centres), overflow: getComputedStyle(bar).overflowX};
            });
            assert.ok(geometry.height <= 56 && geometry.spread < 3, `one action row: ${JSON.stringify(geometry)}`);
            assert.equal(geometry.overflow, 'auto');
            const paneWidth = await page.evaluate(() => window.__bwSimLab._pane.state.paneWidth);
            if (paneWidth < 1200) assert.equal(await page.getByTestId('bw-sim-lab-mode-switch').locator('button span').count(), 0);
            await page.getByTestId('bw-sim-lab-help').click();
            const help = page.getByTestId('bw-sim-lab-help-popover');
            await help.waitFor();
            const bounds = await help.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.height > 80, 'popup escapes scrolling clip');
            await page.keyboard.press('Escape');
            await page.screenshot({path: `${shots}/${locale}-${width}.png`});
            console.log(`PASS ${locale} ${width}: single row, responsive icons, scrolling, visible Help`);
        }

        await page.setViewportSize({width: 1600, height: 1000});
        await openManualControls(page, {motors: true});
        const drive = await page.getByTestId('bw-sim-lab-drive-forward').boundingBox();
        const motors = await page.getByTestId('bw-sim-lab-mixer-toggle').boundingBox();
        assert.ok(Math.abs(drive.y + drive.height / 2 - motors.y - motors.height / 2) < 2, 'Motors and Drive share a row');
        const sliders = page.getByTestId('bw-sim-lab-mixer-slider');
        assert.equal(await sliders.count(), 1);
        assert.ok(await sliders.first().isDisabled(), 'manual power starts off');
        await page.screenshot({path: `${shots}/${locale}-override-off.png`});
        await page.getByTestId('bw-sim-lab-mixer-override').check();
        assert.ok(await sliders.first().isEnabled());
        assert.equal(await page.evaluate(() => window.__bwSimLab.status), 'paused', 'override pauses code');
        const angle = () => page.evaluate(() => {
            const p = window.__bwSimLab._pane;
            return p.api.encoder(p.api.motors()[0].id).angleDeg;
        });
        const before = await angle();
        await sliders.first().focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
        assert.equal(await sliders.first().inputValue(), '30');
        await page.waitForFunction(before => {
            const p = window.__bwSimLab._pane;
            return Math.abs(p.api.encoder(p.api.motors()[0].id).angleDeg - before) > 15;
        }, before, {timeout: 30000});
        await page.getByTestId('bw-sim-lab-mixer-override').uncheck();
        assert.ok(await sliders.first().isDisabled());
        await page.getByTestId('bw-sim-lab-controls-close').click();
        assert.equal(await page.getByTestId('bw-sim-lab-mixer').count(), 0);

        await page.getByTestId('bw-sim-lab-speed').selectOption('4');
        // Manual motion may leave physics running; Pause before starting its program.
        if (await page.getByTestId('bw-sim-lab-pause').count()) await page.getByTestId('bw-sim-lab-pause').click();
        await page.getByTestId('bw-sim-lab-run').click();
        await page.waitForFunction(() => window.__bwSimLab._pane.clock?.installed &&
            window.__bwSimLab._pane.clock.timeScale === 4 && window.__bwSimLab._pane.clock.stats.steps >= 3,
        null, {timeout: 60000});
        assert.equal(await page.evaluate(() => window.__bwSimLab._pane.state.manualOverride), false);
        console.log(`PASS ${locale}: explicit manual override moves the physical shaft, stops on disable, folds away; Run uses 4× clock`);

        await page.getByTestId('bw-sim-lab-examples').click();
        const gallery = page.getByTestId('bw-sim-examples');
        await gallery.getByRole('searchbox').fill('clutch-bench');
        await gallery.locator('[data-model="clutch-bench.ldr"]').getByRole('button', {name: /Open model \+ program:|Modell \+ Programm öffnen:/}).click();
        await gallery.waitFor({state: 'hidden'});
        await page.waitForFunction(() => window.__bwSimLab._pane.state.shipped === 'clutch-bench.ldr' &&
            window.__bwSimLab.status === 'ready', null, {timeout: 60000});
        assert.match(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.projectTitle), /clutch|Kupplung/i);
        await page.screenshot({path: `${shots}/${locale}-example-selected.png`});
        await page.close();
    }
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(error);
    for (const page of browser.contexts().flatMap(c => c.pages())) {
        console.log(await page.evaluate(() => {
            const p = window.__bwSimLab?._pane;
            return {status: p?.state.status, message: p?.state.message, override: p?.state.manualOverride,
                scale: p?.state.timeScale, time: p?.session?.time, clock: p?.clock?.stats,
                installed: p?.clock?.installed, inert: p?.clockInert,
                connected: p?.props.vm.getPeripheralIsConnected('spikeprime')};
        }));
        await page.screenshot({path: `${shots}/failure.png`});
    }
    console.log(errors);
    throw error;
} finally {
    await browser.close();
}
