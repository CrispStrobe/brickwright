import {openManualControls} from './sim-lab-manual-controls.mjs';
import {tool, toolAttribute} from './sim-lab-toolbar-gate.mjs';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// "Seeing the model" in the Robot Lab, for scripts/verify-sim-lab-browser.mjs:
// port badges, the issues list and "Show how it moves", with real clicks only.
// Internal APIs are used to READ results (the selection, the model's ports,
// what the overlay draws), never to perform the interaction.
//
//   1. Simulate: the driving base's two motors carry badges "A" and "B"; ticking
//      "Show how it moves" draws two red motor axes, the castor's ball joint and
//      the body tints, and red axis pixels appear in the 3D view;
//   2. Build: the same overlay over the editor (count and pixels); a click on
//      motorL's badge opens the port picker, "none" unplugs it: the badge shows
//      "?" and the issue "…is not plugged into the hub yet" appears; clicking the
//      issue selects the motor; clicking the "?" badge and then "A" plugs it back
//      and the issue goes;
//   3. Build → Simulate with both motors unplugged: "Before you press Run" says
//      no motor is plugged in, the badges show "?", and clicking the issue makes
//      the two motors pulse in the 3D view.

import assert from 'node:assert/strict';
import {resolve} from 'node:path';

const overlay = (page, which) => page.evaluate(w => {
    const pane = window.__bwSimLab._pane;
    const view = w === 'build' ? pane.editView : pane.view;
    return view ? view.overlayStats() : null;
}, which);

// Independent port-mouth measurements, transformed from the authored part frame
// and then by the physics housing pose. Never derive expected endpoints from
// the view's anchor helper, badge centres, or the motor output body's transform.
const socketAttachments = async (page, which, ids) => {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.waitForFunction(({which,ids}) => {
        const pane = window.__bwSimLab._pane, view = which === 'build' ? pane.editView : pane.view;
        return window.__bwSimLab.status === 'ready' || window.__bwSimLab.status === 'paused' ?
            ids.every(id => view?.overlayStats().cableAttachments.some(c => c.id === id)) : false;
    }, {which,ids}, {timeout:15000});
    // A paused worker may finish its in-flight batch while the GPU queue
    // still shows the preceding frame. Wait for the independently calculated
    // pose, rather than comparing a new snapshot with old drawn endpoints.
    const observationsHandle = await page.waitForFunction(({which, ids}) => {
        const pane = window.__bwSimLab._pane, session = pane.session;
        const model = which === 'build' ? pane.editor.model : session.runModel;
        const stats = (which === 'build' ? pane.editView : pane.view).overlayStats();
        const snapshot = which === 'build' ? null : session.snapshot();
        const sockets = {A: [-69, -68, 40], B: [69, -68, 40], C: [-69, -68, 0], F: [69, -68, -40]};
        const add = (a,b) => a.map((x,i) => x+b[i]);
        const sub = (a,b) => a.map((x,i) => x-b[i]);
        const rotate = (q,v) => { // quaternion rotation, independent of Three's scene graph
            const [x,y,z,w] = q, [a,b,c] = v;
            const t = [2*(y*c-z*b), 2*(z*a-x*c), 2*(x*b-y*a)];
            return [a+w*t[0]+y*t[2]-z*t[1], b+w*t[1]+z*t[0]-x*t[2], c+w*t[2]+x*t[1]-y*t[0]];
        };
        const point = (part, local) => {
            const r = part.rotation;
            const ldraw = add(part.position, [0,1,2].map(i => r[i*3]*local[0]+r[i*3+1]*local[1]+r[i*3+2]*local[2]));
            const world = ldraw.map((x,i) => x * (i ? -0.0004 : 0.0004));
            if (!snapshot) return world;
            const bodies = session.mechanism.bodies.filter(b => b.parts.includes(part.id));
            const own = session.mechanism.joints.find(j => bodies.some(b => b.id === j.body1) && bodies.some(b => b.id === j.body2));
            const body = bodies.find(b => b.id === own?.body1) || bodies[0];
            const q = body.rotation, offset = rotate([-q[0],-q[1],-q[2],q[3]], sub(world,body.position));
            const i = snapshot.bodyIds.indexOf(body.id)*7, pose = Array.from(snapshot.bodies.slice(i,i+7));
            return add(pose.slice(0,3),rotate(pose.slice(3),offset));
        };
        const observations = ids.map(id => {
            const device = model.parts.find(p => p.id === id);
            const hub = model.parts.find(p => p.id === (device.hub || 'hub'));
            const local = device.part === '37308.dat' ? [0,0,3] : [0,0,143];
            return {id, port:device.port, actual:stats.cableAttachments.find(c => c.id === id),
                from:point(device,local), to:point(hub,sockets[device.port])};
        });
        return observations.every(o => o.actual && ['from','to'].every(end =>
            Math.hypot(...o.actual[end].map((x,i) => x-o[end][i])) < 0.00006)) ? observations : false;
    }, {which,ids}, {timeout:15000});
    const observations = await observationsHandle.jsonValue();
    await observationsHandle.dispose();
    for (const o of observations) {
        assert.ok(o.actual, `${which}: cable ${o.id} is rendered`);
        for (const end of ['from','to']) assert.ok(Math.hypot(...o.actual[end].map((x,i) => x-o[end][i])) < 0.00006,
            `${which}: ${o.id}/${o.port} ${end} is at its physical socket: ${JSON.stringify(o)}`);
    }
    return observations;
};

/** Pixels of the motor-axis red (#dc2626) in a screenshot of the 3D view, decoded by the page. */
const redPixels = async (page, locator) => {
    // The Build view keeps one frame in flight (editor-view3d.js render): wait until it has drawn.
    await page.waitForFunction(() => !window.__bwSimLab.editView || !window.__bwSimLab.editView.drawing, null, {timeout: 30000, polling: 50});
    const png = await locator.screenshot();
    return page.evaluate(async b64 => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] < 90 && d[i + 2] < 90) n++;
        return n;
    }, png.toString('base64'));
};

const badge = (page, id) => page.getByTestId(`bw-sim-lab-port-label-${id}`);
const portOf = (page, id) => page.evaluate(i => window.__bwSimLab.editor.model.parts.find(p => p.id === i).port || null, id);

/** Waits until the pane's overlay toggle and the view agree that the overlay is on/off. */
const setMotion = async (page, which, on) => {
    if ((await toolAttribute(page,'show-motion','aria-checked')) !== String(on)) await tool(page,'show-motion');
    await page.waitForFunction(([w, want]) => {
        const pane = window.__bwSimLab._pane;
        const view = w === 'build' ? pane.editView : pane.view;
        const s = view && view.overlayStats();
        return s && (want ? s.axes > 0 && s.tinted > 0 : s.axes === 0 && s.tinted === 0);
    }, [which, on], {timeout: 15000});
};

export const insightInteractions = async (page, {shotsDir}) => {
    // ---- 1. Simulate -------------------------------------------------------------------
    const canvas = page.getByTestId('bw-sim-lab-3d-canvas');
    await canvas.waitFor({timeout: 30000});
    await page.waitForFunction(() => window.__bwSimLab._pane.view?.overlayStats().ports === 2, null, {timeout: 15000});
    assert.equal(await badge(page, 'motorL').textContent(), 'A');
    assert.equal(await badge(page, 'motorR').textContent(), 'B');
    assert.ok((await toolAttribute(page,'show-ports','aria-checked')) === 'true', '"Show ports" is on in Simulate');
    // A cable from each plugged-in motor to the hub.
    await page.waitForFunction(() => window.__bwSimLab._pane.view.overlayStats().cables.length === 2, null, {timeout: 5000});
    assert.deepEqual((await overlay(page, 'simulate')).cables.slice().sort(), ['motorL', 'motorR'], 'a cable from each motor to the hub');
    await socketAttachments(page, 'simulate', ['motorL', 'motorR']);
    assert.equal((await toolAttribute(page,'show-motion','aria-checked')) === 'true', false, '"Show how it moves" starts off');
    // "Show ports" off hides the badges, on brings them back.
    await tool(page,'show-ports');
    await page.waitForFunction(() => window.__bwSimLab._pane.view.overlayStats().ports === 0, null, {timeout: 5000});
    assert.equal(await badge(page, 'motorL').isVisible(), false, 'no badge while "Show ports" is off');
    assert.deepEqual((await overlay(page, 'simulate')).cables, [], 'and no cable');
    await tool(page,'show-ports');
    await page.waitForFunction(() => window.__bwSimLab._pane.view.overlayStats().ports === 2, null, {timeout: 5000});
    const simBefore = await redPixels(page, canvas);
    await setMotion(page, 'simulate', true);
    const sim = await overlay(page, 'simulate');
    assert.equal(sim.motorAxes, 2, `two motor axes: ${JSON.stringify(sim)}`);
    assert.equal(sim.axes, 2, 'the driving base has no other hinge');
    assert.equal(sim.balls, 1, 'the castor ball joint');
    assert.ok(sim.tinted >= 4, `parts tinted by body: ${JSON.stringify(sim)}`);
    const simAfter = await redPixels(page, canvas);
    assert.ok(simAfter > simBefore + 30, `the motor axes are drawn (red pixels ${simBefore} → ${simAfter})`);
    await page.screenshot({path: resolve(shotsDir, 'sim-lab-insight-simulate.png'), fullPage: true});
    // Off again: the overlay and the tints go away.
    await setMotion(page, 'simulate', false);
    console.log(`PASS Simulate: port badges A/B; "Show how it moves" draws ${sim.motorAxes} motor axes, 1 ball joint, ` +
        `${sim.tinted} tinted meshes (${simAfter - simBefore} red axis pixels)`);

    // Run and drive through actual controls: cables travel with housings,
    // not the spinning wheel/output bodies. Pause before comparing one pose.
    const beforeDrive = await socketAttachments(page, 'simulate', ['motorL', 'motorR']);
    await openManualControls(page);
    // Drive starts the clock itself. Do not race its manual takeover against
    // an unrelated asynchronous Run/connect/green-flag sequence.
    await page.getByTestId('bw-sim-lab-drive-forward').hover();
    const t0 = await page.evaluate(() => window.__bwSimLab._pane.session.time);
    await page.mouse.down();
    try { await page.waitForFunction(t => window.__bwSimLab._pane.session.time > t+1000, t0, {timeout:60000}); }
    finally { await page.mouse.up(); }
    await tool(page, 'pause');
    await page.waitForFunction(() => window.__bwSimLab.status === 'paused');
    const afterDrive = await socketAttachments(page, 'simulate', ['motorL', 'motorR']);
    assert.ok(Math.hypot(...afterDrive[0].actual.from.map((x,i) => x-beforeDrive[0].actual.from[i])) > 0.01,
        'the driven motor housing and its cable moved by more than 1 cm');
    console.log('PASS moving motor cables follow physical housings and selected hub sockets');

    // ---- 2. Build --------------------------------------------------------------------
    await page.getByTestId('bw-sim-lab-mode-build').click();
    const editor = page.getByTestId('bw-sim-lab-editor-canvas');
    await editor.waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab.editView?.overlayStats().ports === 2 &&
        window.__bwSimLab.editView.overlayStats().cables.length === 2,
        null, {timeout: 60000});
    assert.equal(await badge(page, 'motorL').textContent(), 'A');
    await socketAttachments(page, 'build', ['motorL','motorR']);
    // Move A to the physically different F socket through the existing picker.
    await badge(page, 'motorL').click();
    await page.getByTestId('bw-sim-lab-port-pick-F').click();
    await page.waitForFunction(() => window.__bwSimLab.editor.model.parts.find(p => p.id === 'motorL').port === 'F');
    await socketAttachments(page, 'build', ['motorL','motorR']);
    await badge(page, 'motorL').click();
    await page.getByTestId('bw-sim-lab-port-pick-A').click();
    await socketAttachments(page, 'build', ['motorL','motorR']);
    const buildBefore = await redPixels(page, editor);
    await setMotion(page, 'build', true);
    const built = await overlay(page, 'build');
    assert.equal(built.motorAxes, 2, `Build: two motor axes: ${JSON.stringify(built)}`);
    assert.equal(built.balls, 1);
    assert.ok(built.tinted >= 10, `Build: every part tinted by its body: ${JSON.stringify(built)}`);
    const buildAfter = await redPixels(page, editor);
    assert.ok(buildAfter > buildBefore + 30, `Build: the motor axes are drawn (red pixels ${buildBefore} → ${buildAfter})`);
    await page.screenshot({path: resolve(shotsDir, 'sim-lab-insight-build.png'), fullPage: true});
    console.log(`PASS Build: "Show how it moves" draws ${built.motorAxes} motor axes over the editor, ${built.tinted} parts tinted ` +
        `(${buildAfter - buildBefore} red axis pixels)`);

    // Unplug motorL through its badge: the picker opens next to it, "none" takes the port away.
    await badge(page, 'motorL').click();
    const picker = page.getByTestId('bw-sim-lab-port-picker');
    await picker.waitFor({timeout: 5000});
    assert.deepEqual(await page.evaluate(() => window.__bwSimLab.editView.selection), ['motorL'], 'the badge selects its motor');
    await page.getByTestId('bw-sim-lab-port-pick-none').click();
    await page.waitForFunction(() => !window.__bwSimLab.editor.model.parts.find(p => p.id === 'motorL').port, null, {timeout: 5000});
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-sim-lab-port-label-motorL"]')?.textContent === '?',
        null, {timeout: 5000});
    const issue = page.getByTestId('bw-sim-lab-issue-motor-without-port');
    await issue.waitFor({timeout: 5000});
    assert.match(await issue.textContent(), /is not plugged into the hub yet/);
    assert.equal(await issue.getAttribute('data-parts'), 'motorL');
    // Clear the selection (Esc on the canvas), then the issue selects the motor again.
    await editor.click({position: {x: 5, y: 5}});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bwSimLab.editView.selection.length === 0, null, {timeout: 5000});
    await issue.click();
    await page.waitForFunction(() => window.__bwSimLab.editView.selection.join() === 'motorL', null, {timeout: 5000});
    await page.screenshot({path: resolve(shotsDir, 'sim-lab-insight-issue.png'), fullPage: true});
    console.log('PASS Build: unplugging motorL from its badge shows "?" and the issue; clicking the issue selects the motor');

    // The "?" badge opens the picker; "A" plugs it back in and the issue goes.
    await badge(page, 'motorL').click();
    await picker.waitFor({timeout: 5000});
    await page.getByTestId('bw-sim-lab-port-pick-A').click();
    assert.equal(await portOf(page, 'motorL'), 'A');
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-sim-lab-port-label-motorL"]')?.textContent === 'A',
        null, {timeout: 5000});
    await issue.waitFor({state: 'detached', timeout: 5000});
    assert.equal(await picker.count(), 0, 'the picker closes once a port is chosen');
    console.log('PASS Build: the "?" badge opens the port picker, choosing A plugs the motor in and clears the issue');

    // ---- 3. Both motors unplugged, then Simulate: warned before Run, the issue pulses them.
    for (const id of ['motorL', 'motorR']) {
        await badge(page, id).click();
        await picker.waitFor({timeout: 5000});
        await page.getByTestId('bw-sim-lab-port-pick-none').click();
        await page.waitForFunction(i => !window.__bwSimLab.editor.model.parts.find(p => p.id === i).port, id, {timeout: 5000});
    }
    // "Before you press Run" is a Simulate warning: since 155ef476d the pane does not show it in
    // Build (renderBlockers returns null there; Build lists the issue in its notes instead).
    const blockers = page.getByTestId('bw-sim-lab-blockers');
    assert.equal(await blockers.count(), 0, 'no Run warning while building');
    await page.getByTestId('bw-sim-lab-mode-simulate').click();
    await page.waitForFunction(() => window.__bwSimLab.mode === 'simulate' && window.__bwSimLab.status === 'ready' &&
        window.__bwSimLab._pane.view?.overlayStats().ports === 2, null, {timeout: 60000});
    await blockers.waitFor({timeout: 5000});
    assert.match(await blockers.textContent(), /Before you press Run:.*No motor is plugged into the hub/);
    assert.equal(await badge(page, 'motorL').textContent(), '?');
    assert.equal(await badge(page, 'motorR').textContent(), '?');
    const noMotor = blockers.getByTestId('bw-sim-lab-issue-no-motor');
    assert.equal(await noMotor.getAttribute('data-parts'), 'motorL motorR');
    await noMotor.click();
    // Both motors pulse: each one's housing and its turning drive hub.
    await page.waitForFunction(() => window.__bwSimLab._pane.view.overlayStats().pulsing === 4, null, {timeout: 5000});
    await page.screenshot({path: resolve(shotsDir, 'sim-lab-insight-blockers.png'), fullPage: true});
    // The pulse ends by itself.
    await page.waitForFunction(() => window.__bwSimLab._pane.view.overlayStats().pulsing === 0, null, {timeout: 10000});
    console.log('PASS Simulate: with no motor plugged in, "Before you press Run" says so; clicking it pulses both motors');
    assert.deepEqual((await overlay(page, 'simulate')).cables, [], 'unplugged devices have no cable');
    // A rotated colour sensor has a captive lead exit too, independent of its
    // optical sensing face. Check motors and sensor in both real renderers.
    await page.getByTestId('bw-sim-lab-model').selectOption('line-follower.ldr');
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === 'line-follower.ldr' &&
        window.__bwSimLab._pane.view?.overlayStats().cables.length === 3, null, {timeout:60000});
    await socketAttachments(page, 'simulate', ['motorL','motorR','sens']);
    await page.screenshot({path:resolve(shotsDir,'sim-lab-cable-sensor-simulate.png')});
    await page.getByTestId('bw-sim-lab-mode-build').click();
    await page.waitForFunction(() => window.__bwSimLab.editView?.overlayStats().cables.length === 3, null, {timeout:60000});
    await socketAttachments(page, 'build', ['motorL','motorR','sens']);
    await page.screenshot({path:resolve(shotsDir,'sim-lab-cable-sensor-build.png')});
    console.log('PASS motor/sensor socket anchors in Simulate and Build, changed port F, unplug and visibility');
};
