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
    await page.evaluate(() => window.__bwSimLab.api.loadModel('wall-stopper'));
    await page.waitForFunction(() => {
        const pane = window.__bwSimLab?._pane;
        return pane?.state.status === 'ready' && pane.view?.overlayStats().cables.length > 0;
    });
    await tool(page, 'show-sensors');
    await page.waitForFunction(() => window.__bwSimLab._pane.view.sensorRays().length > 0);
    const result = await page.evaluate(() => {
        const {view, session} = window.__bwSimLab._pane;
        const snapshot = session.snapshot();
        const cables = view.overlayStats().cableAttachments;
        const rays = view.sensorRays();
        const gl = view.canvas.getContext('webgl2');
        const originalBufferData = gl.bufferData;
        const originalBufferSubData = gl.bufferSubData;
        const uploads = {cables: 0, rays: 0, rayUpdates: 0};
        gl.bufferData = function (target, data, ...args) {
            if (target === gl.ARRAY_BUFFER && data instanceof Float32Array) {
                // TubeGeometry uses (32 + 1) * (6 + 1) positions with 3 components.
                if (data.length === 33 * 7 * 3) uploads.cables++;
                if (data.length === rays.length * 6) uploads.rays++;
            }
            return originalBufferData.call(this, target, data, ...args);
        };
        gl.bufferSubData = function (target, offset, data, ...args) {
            if (target === gl.ARRAY_BUFFER && data instanceof Float32Array && data.length === rays.length * 6) uploads.rayUpdates++;
            return originalBufferSubData.call(this, target, offset, data, ...args);
        };
        try {
            for (let frame = 0; frame < 8; frame++) {
                for (let i = 0; i < snapshot.bodies.length; i += 7) snapshot.bodies[i] += 0.005;
                view.render(snapshot, {force: true});
            }
            return {uploads, start: {cables, rays}, end: {cables: view.overlayStats().cableAttachments, rays: view.sensorRays()}};
        } finally {
            delete gl.bufferData;
            delete gl.bufferSubData;
        }
    });
    console.log(`Buffer uploads over eight translated frames: ${JSON.stringify(result.uploads)}`);
    const checkTranslation = (start, end) => {
        assert.equal(start.length, end.length);
        for (let index = 0; index < start.length; index++) {
            for (const endpoint of ['from', 'to']) {
                const a = start[index][endpoint];
                const b = end[index][endpoint];
                assert.ok(Math.hypot(b[0] - a[0] - 0.04, b[1] - a[1], b[2] - a[2]) < 1e-5);
            }
        }
    };
    checkTranslation(result.start.cables, result.end.cables);
    checkTranslation(result.start.rays, result.end.rays);
    if (process.env.BW_OVERLAY_BASELINE !== '1') assert.deepEqual(result.uploads, {cables: 0, rays: 0, rayUpdates: 8});
    console.log('PASS Firefox: cables and sensor rays follow the translated robot');
} finally {
    await browser.close();
}
