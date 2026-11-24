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
    await tool(page, 'show-ports');
    const cases = [
        {file: 'twistspan.ldr', part: 'lower_tie_80', vertices: 9 * 6},
        {file: 'pneumatic-press.ldr', part: 'valve', vertices: 33 * 7}
    ];
    for (const options of cases) {
        await page.getByTestId('bw-sim-lab-model').selectOption(options.file);
        await page.waitForFunction(file => {
            const state = window.__bwSimLab?._pane.state;
            return state?.shipped === file && state.status === 'ready' && state.view3d === 'webgl' && !state.programLoading;
        }, options.file);
        const counts = await page.evaluate(({part, vertices}) => {
            const {view, session} = window.__bwSimLab._pane;
            const body = session.mechanism.bodies.find(item => item.parts.includes(part));
            const snapshot = session.snapshot();
            const offset = snapshot.bodyIds.indexOf(body.id) * 7;
            const gl = view.canvas.getContext('webgl2');
            const {bufferData, bufferSubData} = gl;
            const uploads = {allocated: 0, updated: 0};
            gl.bufferData = function (target, data, ...args) {
                if (target === gl.ARRAY_BUFFER && data instanceof Float32Array && data.length === vertices * 3) uploads.allocated++;
                return bufferData.call(this, target, data, ...args);
            };
            gl.bufferSubData = function (target, start, data, ...args) {
                if (target === gl.ARRAY_BUFFER && data instanceof Float32Array && data.length === vertices * 3) uploads.updated++;
                return bufferSubData.call(this, target, start, data, ...args);
            };
            try {
                for (let frame = 0; frame < 8; frame++) {
                    snapshot.bodies[offset] += 0.001;
                    view.render(snapshot, {force: true});
                }
                return uploads;
            } finally {
                delete gl.bufferData;
                delete gl.bufferSubData;
            }
        }, options);
        console.log(`${options.file}, eight frames deforming the tube: ${JSON.stringify(counts)}`);
        if (process.env.BW_TUBE_BASELINE !== '1') {
            assert.equal(counts.allocated, 0);
            assert.ok(counts.updated > 0, 'changed tube vertices reach the GPU');
        }
    }
    assert.equal(await page.evaluate(() => window.__bwSimLab._pane.view.hoseCount()), 3);
    const startHeight = await page.evaluate(() => window.__bwSimLab.api.pose('rod').position[1]);
    await tool(page, 'run');
    await page.waitForFunction(start => Math.abs(window.__bwSimLab.api.pose('rod').position[1] - start) > 0.015, startHeight);
    console.log('PASS Firefox: Pneumatic Press moves on Run with all three hoses present');
} finally {
    await browser.close();
}
