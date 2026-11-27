// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The LEGO radio hubs in the Robot Lab (`--part=hubs-ble` of scripts/verify-sim-lab-browser.mjs;
// docs/ROBOT-LAB-HUBS-PLAN.md P3, docs/SIM-LAB.md "Powered Up, BOOST and WeDo 2.0 hubs"), in the
// shipped build, through the UI only. For each family: pick the model, Load example program
// (its pup / boost / wedo words become the REAL extension's blocks in the Code tab), Run —
// the pane connects that extension to the scene's virtual hub over the transport the
// extension is set to by default (legopoweredup and wedo2unified: Scratch Link, answered by
// the Scratch Link BLE double; legoboostunified: Web Bluetooth, through the shim), then the
// green flag. Judged on simulated time, sampled after every advance (session.onAdvance), from
// the hub's encoders and the hub body's pose, never from the extension's own state:
//
//   1. Technic Hub bench (legopoweredup): motor A rests at 360 ± 2° after "turn motor A on for
//      360 degrees", then turns back to 0 ± 2°;
//   2. BOOST rover (legoboostunified): the Move Hub drives ahead with its built-in motors A and B (one "AB" block),
//      then turns;
//   3. WeDo 2.0 rover (wedo2unified): the motor runs until the motion sensor sees the wall, then
//      stops, short of it.

import assert from 'node:assert/strict';

/** The Technic Hub bench's accuracy: the bound of test/lab-hubs-extensions.test.mjs. */
export const HUB_DEGREES_TOLERANCE = 2;

/** Opens a shipped model, loads its example into the Code tab as blocks, and instruments the scene. */
const prepare = async (page, {file, extension, mat = null}) => {
    await page.getByTestId('bw-sim-lab-model').selectOption(file);
    await page.waitForFunction(f => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === f &&
        window.__bwSimLab._pane.session, file, {timeout: 60000});

    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'),
        null, {timeout: 60000});
    if (mat) {
        await page.waitForFunction(m => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.session?.mat === m, mat, {timeout: 60000});
    }
    // The status may still read the previous model's "Blocks loaded." while this example compiles: wait for the
    // blocks themselves.
    const loaded = await page.waitForFunction(id => window.__bwSimLab._pane.hubExtension() === id, extension, {timeout: 60000})
        .then(() => true, () => false);
    assert.ok(loaded, `the example's words became ${extension} blocks`);
    // Read-only instrument: the hub's ports and the hub body's floor position after every advance.
    await page.evaluate(() => {
        const s = window.__bwSimLab._pane.session;
        const hub = window.__bwSimLab._pane.radioHub();
        const body = s.hubs.find(h => h.hub === hub).body;
        const rec = window.__bwHubs = {start: s.time, samples: [], protocol: hub.protocol, connected: false};
        s.onAdvance(() => {
            const snap = s.snapshot();
            const i = snap.bodyIds.indexOf(body);
            const q = [3, 4, 5, 6].map(k => snap.bodies[i * 7 + k]);
            const yaw = Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180 / Math.PI;
            rec.samples.push({t: s.time - rec.start, x: snap.bodies[i * 7], z: snap.bodies[i * 7 + 2], yaw,
                a: hub.readPort('A'), b: hub.readPort('B')});
            rec.connected = rec.connected || hub.log.some(e => e.dir === 'down');
        });
    });
};

const samples = page => page.evaluate(() => window.__bwHubs.samples);

const runFor = async (page, ms, wallBudget) => {
    await page.getByTestId('bw-sim-lab-run').click();
    await page.waitForFunction(m => {
        const r = window.__bwHubs;
        return r.samples.length && r.samples[r.samples.length - 1].t > m;
    }, ms, {timeout: wallBudget(ms + 15000)});
    const message = await page.evaluate(() => window.__bwSimLab._pane.state.message || '');
    assert.equal(message, '', 'Run connected the program to the hub');
};

export const hubsInteractions = async ({browser, errors, openSimLab, wallBudget}) => {
    const out = {};
    const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await openSimLab(page, {program: null});

    // ---- 1. legopoweredup on the Technic Hub, over Scratch Link ------------------------------
    await prepare(page, {file: 'technic-hub-bench.ldr', extension: 'legopoweredup'});
    // 6 s: the turn, the 1 s wait and the turn back, with room for the program's first blocks to reach the hub.
    await runFor(page, 6000, wallBudget);
    {
        const r = await samples(page);
        // The rest is the plateau between the forward turn and the turn back: the 300 ms of samples before the
        // angle first drops 10° below its peak (when the program's first block runs varies with the connection's
        // pace, so a fixed time window would judge the turn itself).
        const peakAt = r.reduce((best, s, i) => (s.a.angleDeg > r[best].a.angleDeg ? i : best), 0);
        const backAt = r.findIndex((s, i) => i > peakAt && s.a.angleDeg < r[peakAt].a.angleDeg - 2.5);
        const until = backAt > 0 ? r[backAt - 1].t : r[r.length - 1].t;
        const rest = r.filter((s, i) => i >= peakAt && s.t >= until - 300 && s.t <= until).map(s => s.a.angleDeg);
        const end = r[r.length - 1].a.angleDeg;
        out.technic = {rest: rest.length ? rest[rest.length - 1] : null, end, samples: r.length,
            transport: await page.evaluate(() => window.__bwSimLab._pane.props.vm.runtime.peripheralExtensions.legopoweredup?._connectionType)};
        assert.ok(rest.length && rest.every(a => Math.abs(a - 360) <= HUB_DEGREES_TOLERANCE), `motor A rests at 360 ± 2°: ${JSON.stringify(out.technic)}`);
        assert.ok(Math.abs(end) <= HUB_DEGREES_TOLERANCE, `and turns back to 0: ${end}`);
    }
    await page.getByTestId('bw-sim-lab-pause').click();

    // ---- 2. legoboostunified on the BOOST Move Hub, over Web Bluetooth ------------------------
    await prepare(page, {file: 'boost-rover.ldr', extension: 'legoboostunified', mat: 'plain'});
    await runFor(page, 6000, wallBudget);
    {
        // The example: "turn motor AB on for 2 seconds" (StartSpeedForTime: the hub's motor mode 'time'), then
        // B backwards and "turn motor AB on for 180 degrees" (a spin on the spot). Phases from the hub, not a clock.
        const r = await samples(page);
        const start = r[0];
        const drive = r.filter(s => s.a.mode === 'time');
        assert.ok(drive.length > 30, 'the timed drive ran');
        const ahead = drive[drive.length - 1];
        const cruise = drive.filter(s => s.t >= drive[0].t + 1000).map(s => s.yaw);
        const end = r[r.length - 1];
        const turned = ((end.yaw - ahead.yaw + 540) % 360) - 180;
        out.boost = {driven: Math.hypot(ahead.x - start.x, ahead.z - start.z), heading: ahead.yaw - start.yaw,
            cruiseSpread: Math.max(...cruise) - Math.min(...cruise), turned};
        assert.ok(out.boost.driven > 0.3, `the rover drove ahead: ${JSON.stringify(out.boost)}`);
        // B starts 50 ms after A (the extension's per-port queue): a heading of ~20° the skew explains
        // (test/lab-hubs-extensions.test.mjs derives it), then held while cruising.
        assert.ok(Math.abs(out.boost.heading) < 30 && out.boost.cruiseSpread < 2, `it holds a heading while cruising: ${JSON.stringify(out.boost)}`);
        assert.ok(Math.abs(turned) > 45, `then spun: ${JSON.stringify(out.boost)}`);
    }
    await page.getByTestId('bw-sim-lab-pause').click();

    // ---- 3. wedo2unified on the WeDo 2.0 hub, over Scratch Link -------------------------------
    await prepare(page, {file: 'wedo-milo.ldr', extension: 'wedo2unified', mat: 'wall'});
    await runFor(page, 5000, wallBudget);
    {
        const r = await samples(page);
        const ran = r.find(s => s.a.state === 'run');
        const stopped = ran && r.find(s => s.t > ran.t && s.a.state !== 'run');
        const end = r[r.length - 1];
        out.wedo = {ranAt: ran?.t ?? null, stoppedAt: stopped?.t ?? null, seenAtStop: stopped?.b?.distanceMm ?? null,
            driven: end.x - r[0].x, rest: end.b.distanceMm};
        assert.ok(ran && stopped, `the motor ran, then stopped: ${JSON.stringify(out.wedo)}`);
        assert.ok(out.wedo.seenAtStop >= 0 && out.wedo.seenAtStop < 90, `it stopped when the sensor saw the wall: ${JSON.stringify(out.wedo)}`);
        assert.ok(out.wedo.driven > 0.3 && out.wedo.rest > 35, `drove to the wall and stopped short of it: ${JSON.stringify(out.wedo)}`);
    }
    await page.close();
    return out;
};
