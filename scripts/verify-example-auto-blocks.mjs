#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {hiddenStageBubble} from './lib/hidden-stage-bubble-gate.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1600, height: 1050}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
    });
    await page.goto(process.env.PROOF_URL || 'http://127.0.0.1:8767/', {waitUntil: 'networkidle'});
    // Go directly to Robots: visiting Code first would mask a lost handoff to
    // its not-yet-mounted lazy importer.
    await page.getByRole('tab', {name: /^(Robots|Robot Lab)$/}).click();
    await page.waitForFunction(() => window.__bwSimLab?.status === 'ready', null, {timeout: 90000});
    await hiddenStageBubble(page);
    assert.equal(await page.getByTestId('bw-code-editor').count(), 0, 'Code has not mounted');
    let previousScripts = [];
    for (const id of ['pendulum-array', 'clutch-bench']) {
        await page.getByTestId('bw-sim-lab-examples').click();
        const gallery = page.getByTestId('bw-sim-examples');
        await gallery.getByRole('searchbox').fill(id);
        await gallery.locator(`[data-model="${id}.ldr"]`)
            .getByRole('button', {name: /^Open model \+ program:/}).click();
        await gallery.waitFor({state: 'hidden'});
        await page.waitForFunction(({id, previousScripts}) => {
            const vm = window.__brickwrightStore?.getState()?.scratchGui?.vm;
            return window.__bwSimLab._pane.state.shipped === `${id}.ldr` &&
                document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.') &&
                vm?.runtime.targets.some(t => t.blocks.getScripts().some(script => !previousScripts.includes(script))) &&
                window.__bwSimLab._pane.spikeLoaded();
        }, {id, previousScripts}, {timeout: 30000});
        const loaded = await page.evaluate(() => {
            const vm = window.__brickwrightStore.getState().scratchGui.vm;
            return {opcodes: vm.runtime.targets.flatMap(t => Object.values(t.blocks._blocks).map(b => b.opcode)),
                status: window.__bwSimLab.status};
        });
        assert.ok(loaded.opcodes.some(opcode => /motor/i.test(opcode)), 'actual motor blocks are installed');
        assert.equal(loaded.status, 'ready', 'loading does not start the machine');
        previousScripts = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.flatMap(t => t.blocks.getScripts()));
        console.log(`PASS ${id}: model + program selection creates runnable SPIKE blocks without visiting Code (${loaded.opcodes.length} blocks)`);
    }
    assert.deepEqual(errors, []);
    mkdirSync('artifacts/atlas-switchback', {recursive: true});
    await page.screenshot({path: 'artifacts/atlas-switchback/robot-example-auto-blocks.png'});
} catch (error) {
    console.log(await page.evaluate(() => ({status: document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus,
        code: document.querySelector('.cm-content')?.textContent?.slice(0, 300),
        importerError: document.querySelector('[data-pseudocode-importer-load-error]')?.textContent,
        scripts: window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.targets.map(t => t.blocks.getScripts()),
        errors: document.querySelector('[data-testid="bw-sim-lab-message"]')?.textContent})));
    console.log(errors);
    await page.screenshot({path: 'artifacts/atlas-switchback/robot-auto-blocks-failure.png'});
    throw error;
} finally {
    await browser.close();
}
