// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Robot Lab connection-first building (docs/ROBOT-LAB-UX.md §5), for
// scripts/verify-sim-lab-browser.mjs `--part=editor`, with real mouse moves, clicks,
// wheels and keys. Internal APIs READ results (window.__bwSimLab.highlights(),
// candidate(), ghostTone(), the model, the camera) and say where a point is on screen;
// the only thing they DO is lay out the test parts before the checks (set-up).
//
// Fixture: a Beam 7 (32524) alone at the origin, holes along z, hole axes along y; the
// Home view. Hole numbers in the words on screen count from 1 (h3 is "hole 4 of 7").
//
//   T5  idle: the hole under the pointer lights, alone; 30 px from every hole, none
//   T1  a pin in hand on h3: only free pin holes light (no studs), h3 the one active
//   T4  5 px towards h4, h3 stays (hysteresis); fully on h4, h4
//   T2  a click seats the pin: coaxial, centre on h3's top face, 20 LDU in, one pair
//   T8  Tab changes the target, Shift+Tab comes back
//   T6  a brick over h3: the pin's pose is red where it was aimed; a click is refused
//   T3  a gear (axle hole) finds nothing on pin holes; on an axle seated in h3 it does
//   T7  a Beam 3 dragged onto a seated pin, R: turned 90° about the pin, the pin's point
//       kept; one command, one undo
//   T9  a grouped Beam 3 carrying two pins seats both in Beam 7 at once, one undo step
//   T17 [ on an axle in an axle hole is refused with the quarter-turn rule; on a pin, 15°
//   T10 a click on a lit hole, then the pin's tile: the same seat as T2
//   T16 keyboard only: Enter on the tile, Tab to hole 4, Enter
//   T11b the Studio / LDD mouse: right drag orbits, middle drag slides, a right click puts down the part in hand
//   T11–T15 camera: a middle drag orbits about the point under it, the wheel and a pinch
//       zoom to the pointer, Build looks from below (Simulate does not), a double click
//       centres the view on the clicked point (eased; at once with reduced motion), a trackpad's
//       scroll orbits; the view cube turns the view

import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {tool} from './sim-lab-toolbar-gate.mjs';

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const frames = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const lab = (page, fn, arg) => page.evaluate(fn, arg);
const parts = page => lab(page, () => window.__bwSimLab.editor.model.parts);
const count = async page => (await parts(page)).length;
const statusKind = page => page.getByTestId('bw-sim-lab-build-status').getAttribute('data-kind');
const statusText = page => page.getByTestId('bw-sim-lab-build-status').textContent();
/** A model-frame point (LDU) on screen (client px). */
const screenAt = (page, ldu) => lab(page, p => {
    const v = window.__bwSimLab.editView;
    return v.toScreen([p[0] * 0.0004, -p[1] * 0.0004, -p[2] * 0.0004]);
}, ldu);
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const highlights = page => lab(page, () => window.__bwSimLab.highlights());
const active = async page => (await highlights(page)).filter(h => h.active);
const candidate = page => lab(page, () => window.__bwSimLab.candidate());
const ghostTone = page => lab(page, () => window.__bwSimLab.ghostTone());
const camera = page => lab(page, () => window.__bwSimLab.editView.camera);
/** A connector of a part in the model frame (catalogue metadata). */
const connectorOf = (page, id, connector) => lab(page, ([i, c]) => {
    const p = window.__bwSimLab.editor.model.parts.find(x => x.id === i);
    const m = window.__bwSimLab._pane.lib.CATALOG.get(p.part).connectors.find(x => x.id === c);
    const mul = (R, v) => [0, 1, 2].map(r => R[r * 3] * v[0] + R[r * 3 + 1] * v[1] + R[r * 3 + 2] * v[2]);
    return {type: m.type, length: m.length, position: mul(p.rotation, m.position).map((v, k) => v + p.position[k]), axis: mul(p.rotation, m.axis)};
}, [id, connector]);
/** The end of a hole facing the camera (LDraw: the camera is above, -y). */
const topFace = h => h.position.map((v, i) => v - Math.abs(h.axis[i]) * h.length / 2 * (i === 1 ? 1 : 0));
/** A palette tile, clicked (a part in a closed category is found with the search box, as a person would). */
const tile = async (page, part) => {
    const t = page.getByTestId(`bw-sim-lab-part-${part}`).first();
    if (await t.isVisible()) return {t, searched: false};
    await page.getByTestId('bw-sim-lab-search').fill(part.replace(/\.dat$/, ''));
    const found = page.getByTestId('bw-sim-lab-search-results').getByTestId(`bw-sim-lab-part-${part}`);
    await found.waitFor({timeout: 5000});
    return {t: found, searched: true};
};
const arm = async (page, part) => {
    const {t, searched} = await tile(page, part);
    await t.click();
    await page.waitForFunction(p => window.__bwSimLab._pane.state.placing === p, part);
    if (searched) await page.getByTestId('bw-sim-lab-search-clear').click();
};
const hover = async (page, at) => {
    await page.mouse.move(at[0], at[1], {steps: 4});
    await frames(page);
};
const disarm = async page => {
    await page.getByTestId('bw-sim-lab-editor-canvas').focus();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__bwSimLab._pane.state.placing);
};

/** Set-up: the model emptied, then `list` placed ([part, position, rotation]); returns their ids. */
const layOut = (page, list, {group = null} = {}) => lab(page, ([l, g]) => {
    const ed = window.__bwSimLab.editor;
    const ids = [];
    for (const [part, position, rotation] of l) {
        ed.apply({type: 'place', part, position, rotation, color: 71});
        ids.push(ed.model.parts.at(-1).id);
    }
    if (g) ed.apply({type: 'group', ids: g.map(k => ids[k])});
    window.__bwSimLab.editView.select([]);
    return ids;
}, [list, group]);
const clearModel = page => lab(page, () => {
    const ed = window.__bwSimLab.editor;
    if (ed.model.parts.length) ed.apply({type: 'batch', commands: ed.model.parts.map(p => ({type: 'delete', id: p.id}))});
});

export const connectInteractions = async (page, {shotsDir, shots}) => {
    try {
        return await checks(page, {shotsDir, shots: shots || shotsDir});
    } catch (error) {
        await page.screenshot({path: resolve(shotsDir, 'sim-lab-connect-failure.png'), fullPage: true}).catch(() => {});
        throw error;
    }
};

const checks = async (page, {shotsDir, shots}) => {
    const out = {};
    await page.getByTestId('bw-sim-lab-mode-build').click();
    await page.waitForFunction(() => window.__bwSimLab.mode === 'build' && window.__bwSimLab.status === 'ready' && window.__bwSimLab.editView);
    const canvas = page.getByTestId('bw-sim-lab-editor-canvas');
    await clearModel(page);
    const [beam] = await layOut(page, [['32524.dat', [0, 0, 0], I]]);
    await tool(page, 'view-home');
    await frames(page);
    const h = {};
    for (const k of ['h1', 'h2', 'h3', 'h4']) h[k] = await connectorOf(page, beam, k);
    const q = {};
    for (const k of Object.keys(h)) q[k] = await screenAt(page, topFace(h[k]));
    const pitch = dist(q.h3, q.h4);
    out.pitchPx = pitch;

    // T5. Idle: the hole under the pointer lights, alone; 30 px from every hole, none.
    await hover(page, q.h3);
    let lit = await highlights(page);
    assert.deepEqual(lit.map(x => [x.connectorId, x.active]), [['h3', true]], `idle on h3: ${JSON.stringify(lit)}`);
    await page.screenshot({path: resolve(shots, 'hover-highlight.png'), clip: {x: q.h3[0] - 160, y: q.h3[1] - 110, width: 320, height: 220}});
    const allFaces = [];
    for (const k of ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        const c = await connectorOf(page, beam, k);
        for (const s of [1, -1]) allFaces.push(await screenAt(page, c.position.map((v, i) => v + c.axis[i] * s * c.length / 2)));
    }
    let far = null;
    for (let dy = 0; dy <= 120 && !far; dy += 4) {
        for (const dx of [0, 30, -30, 60, -60]) {
            const p = [q.h3[0] + dx, q.h3[1] - dy];
            if (allFaces.every(f => dist(f, p) >= 30)) { far = p; break; }
        }
    }
    await hover(page, far);
    assert.deepEqual(await highlights(page), [], '30 px from every hole nothing lights');

    // T1. A pin in hand on h3: only free pin holes light (no studs), h3 the one active.
    await arm(page, '2780.dat');
    await hover(page, q.h3);
    lit = await highlights(page);
    const types = await lab(page, ([b, ids]) => ids.map(id => window.__bwSimLab._pane.lib.CATALOG.get(window.__bwSimLab.editor.model.parts.find(p => p.id === b).part)
        .connectors.find(c => c.id === id)?.type), [beam, lit.map(x => x.connectorId)]);
    assert.ok(lit.length >= 2 && lit.every(x => x.partId === beam) && types.every(t => t === 'pinhole'), `pin holes only: ${JSON.stringify({lit, types})}`);
    assert.deepEqual((await active(page)).map(x => x.connectorId), ['h3']);
    assert.equal(await ghostTone(page), 'snap');
    // T4. 5 px towards h4: h3 stays; fully on h4: h4.
    const toward = k => q.h3.map((v, i) => v + (q.h4[i] - v) * k / pitch);
    await hover(page, toward(5));
    assert.deepEqual((await active(page)).map(x => x.connectorId), ['h3'], '5 px towards h4: h3 stays');
    await hover(page, toward(pitch / 2 + 3));
    out.hysteresisKept = (await active(page)).map(x => x.connectorId)[0];
    await hover(page, q.h4);
    assert.deepEqual((await active(page)).map(x => x.connectorId), ['h4'], 'on h4: h4');
    await hover(page, q.h3);
    // T8. Tab: another target (or face); Shift+Tab: back.
    const first = await candidate(page);
    await canvas.focus();
    await page.keyboard.press('Tab');
    const second = await candidate(page);
    assert.notDeepEqual([second.target.connectorId, second.target.entry, second.pose.position], [first.target.connectorId, first.target.entry, first.pose.position], 'Tab: another spot');
    await page.keyboard.press('Shift+Tab');
    const back = await candidate(page);
    assert.deepEqual([back.target.connectorId, back.target.entry, back.pose.position], [first.target.connectorId, first.target.entry, first.pose.position], 'Shift+Tab: back');
    await page.screenshot({path: resolve(shots, 'snapped-ghost.png'), clip: {x: q.h3[0] - 160, y: q.h3[1] - 130, width: 320, height: 240}});

    // T2. A click seats it.
    const n0 = await count(page);
    await page.mouse.click(q.h3[0], q.h3[1]);
    assert.equal(await count(page), n0 + 1, 'one part added');
    const seat = async (id, hole = h.h3) => {
        const pin = await connectorOf(page, id, 'p');
        const dot = pin.axis[0] * hole.axis[0] + pin.axis[1] * hole.axis[1] + pin.axis[2] * hole.axis[2];
        const rel = pin.position.map((v, i) => v - hole.position[i]);
        const along = rel[0] * hole.axis[0] + rel[1] * hole.axis[1] + rel[2] * hole.axis[2];
        const lateral = Math.hypot(...rel.map((v, i) => v - along * hole.axis[i]));
        const engaged = Math.min(pin.length / 2, -along + hole.length / 2) - Math.max(-pin.length / 2, -along - hole.length / 2);
        const pairs = await lab(page, i => window.__bwSimLab._pane.lib.pairedParts(window.__bwSimLab.editor.model, window.__bwSimLab._pane.lib.CATALOG, i), id);
        return {dot, lateral, centreAbove: -(pin.position[1] - hole.position[1]), engaged, pairs};
    };
    const pinId = (await parts(page)).at(-1).id;
    const s2 = await seat(pinId);
    assert.ok(Math.abs(s2.dot) > 0.9999 && s2.lateral <= 0.5, `coaxial: ${JSON.stringify(s2)}`);
    assert.ok(Math.abs(s2.centreAbove - h.h3.length / 2) < 1e-6, `the pin's centre on h3's top face: ${JSON.stringify(s2)}`);
    assert.ok(Math.abs(s2.engaged - 20) < 1e-6, `20 LDU in: ${JSON.stringify(s2)}`);
    assert.deepEqual(s2.pairs, [beam], 'the compiler\'s pair rule finds one pair, with the beam');
    out.t2 = s2;

    // T6. A brick over h4: the pin's pose there is red where it was aimed; a click is refused.
    const brickBottom = await lab(page, () => Math.max(...window.__bwSimLab._pane.lib.CATALOG.get('3001.dat').colliders.filter(c => c.shape === 'box')
        .map(c => c.position[1] + c.halfExtents[1])));
    const f4 = topFace(h.h4);
    const [brick] = await layOut(page, [['3001.dat', [f4[0], f4[1] - brickBottom, f4[2] + 20], I]]);
    await arm(page, '2780.dat');
    await hover(page, q.h4);
    const c6 = await candidate(page);
    assert.ok(c6 && c6.blocked && c6.target.connectorId === 'h4', `blocked on h4: ${JSON.stringify(c6)}`);
    assert.equal(await ghostTone(page), 'blocked');
    await page.screenshot({path: resolve(shots, 'red-ghost.png'), clip: {x: q.h4[0] - 170, y: q.h4[1] - 140, width: 340, height: 260}});
    const n6 = await count(page);
    await page.mouse.click(q.h4[0], q.h4[1]);
    assert.equal(await count(page), n6, 'a blocked click adds nothing');
    assert.equal(await statusKind(page), 'refused');
    await disarm(page);
    await lab(page, id => window.__bwSimLab.editor.apply({type: 'delete', id}), brick);

    // T3. A gear finds nothing on pin holes; on an axle seated in h2 its axle hole fits.
    await arm(page, '3648.dat');
    await hover(page, q.h2);
    assert.deepEqual(await highlights(page), [], 'a gear lights no pin hole');
    assert.equal(await ghostTone(page), 'free');
    await disarm(page);
    await arm(page, '4519.dat');
    await hover(page, q.h2);
    await page.mouse.click(q.h2[0], q.h2[1]);
    const axleId = (await parts(page)).at(-1).id;
    const axle = await connectorOf(page, axleId, 'a');
    const tip = axle.position.map((v, i) => v - Math.abs(axle.axis[i]) * axle.length / 2 * (i === 1 ? 1 : 0));
    const qTip = await screenAt(page, tip);
    await arm(page, '3648.dat');
    await hover(page, qTip);
    const a3 = await active(page);
    assert.ok(a3.length === 1 && a3[0].partId === axleId, `on the axle's tip its connector is the target: ${JSON.stringify(await highlights(page))}`);
    await disarm(page);

    // T17. [ on an axle in an axle hole: refused with the quarter-turn rule; on a pin: 15°, its point kept.
    const gearPose = await lab(page, () => null);
    void gearPose;
    const [gear, ax2] = await layOut(page, [['3648.dat', [0, -40, 140], I], ['4519.dat', [0, -40, 140], [0, 0, -1, 0, 1, 0, 1, 0, 0]]]);
    await lab(page, id => window.__bwSimLab.editView.select([id]), ax2);
    const before17 = (await parts(page)).find(p => p.id === ax2);
    await canvas.focus();
    await page.keyboard.press('[');
    assert.deepEqual((await parts(page)).find(p => p.id === ax2), before17, 'the axle did not turn');
    assert.match(await statusText(page), /quarter turns/, 'the status names the quarter-turn rule');
    await lab(page, id => window.__bwSimLab.editView.select([id]), pinId);
    const p0 = await connectorOf(page, pinId, 'p');
    const r0 = (await parts(page)).find(p => p.id === pinId).rotation;
    await page.keyboard.press(']');
    const p1 = await connectorOf(page, pinId, 'p');
    const r1 = (await parts(page)).find(p => p.id === pinId).rotation;
    const trace = [0, 1, 2].reduce((t, r) => t + [0, 1, 2].reduce((u, c) => u + r0[r * 3 + c] * r1[r * 3 + c], 0), 0);
    assert.ok(Math.abs(Math.acos(Math.min(1, (trace - 1) / 2)) - Math.PI / 12) < 1e-6, 'a 15° turn');
    assert.ok(dist(p0.position, p1.position) < 1e-6, 'the pin\'s point stays');
    await page.keyboard.press('ControlOrMeta+z');
    await lab(page, ids => window.__bwSimLab.editor.apply({type: 'batch', commands: ids.map(id => ({type: 'delete', id}))}), [gear, ax2, axleId]);

    // T7. A Beam 3 dragged onto the seated pin, R mid-drag: 90° about the pin, the pin's point kept; one undo.
    const [b3] = await layOut(page, [['32523.dat', [0, 0, 120], I]]);
    const b3h0 = await connectorOf(page, b3, 'h0');
    const grab = await screenAt(page, topFace(b3h0).map((v, i) => v + (i === 2 ? 4 : 0)));
    const pin = await connectorOf(page, pinId, 'p');
    const pinTip = pin.position.map((v, i) => v - Math.abs(pin.axis[i]) * pin.length / 2 * (i === 1 ? 1 : 0));
    const qPin = await screenAt(page, pinTip);
    const n7 = await lab(page, () => window.__bwSimLab.editor.history?.length ?? null);
    void n7;
    const b3Before = (await parts(page)).find(p => p.id === b3);
    await page.mouse.move(grab[0], grab[1]);
    await page.mouse.down();
    await page.mouse.move(qPin[0], qPin[1], {steps: 12});
    await frames(page);
    const c7 = await candidate(page);
    assert.ok(c7 && c7.target.partId === pinId && !c7.blocked, `snapped onto the pin: ${JSON.stringify(c7)}`);
    const leadBefore = c7.moves.find(m => m.id === b3);
    await page.keyboard.press('r');
    const c7r = await candidate(page);
    assert.ok(c7r && c7r.target.partId === pinId, 'still on the pin after R');
    const turned = c7r.moves.find(m => m.id === b3);
    const tr = [0, 1, 2].reduce((t, r) => t + [0, 1, 2].reduce((u, c) => u + leadBefore.rotation[r * 3 + c] * turned.rotation[r * 3 + c], 0), 0);
    assert.ok(Math.abs(Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) - Math.PI / 2) < 1e-6, 'R turned it 90°');
    const pinAfter = await connectorOf(page, pinId, 'p');
    assert.ok(dist(pin.position, pinAfter.position) <= 0.5, 'the pin stayed');
    await page.mouse.up();
    const b3After = (await parts(page)).find(p => p.id === b3);
    assert.notDeepEqual(b3After.position, b3Before.position, 'released: the beam moved onto the pin');
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual((await parts(page)).find(p => p.id === b3), b3Before, 'one Ctrl+Z puts the beam back');
    await lab(page, id => window.__bwSimLab.editor.apply({type: 'delete', id}), b3);

    // T9. A grouped Beam 3 carrying two pins, its lead pin over Beam 7's h1: both pins seat (h1 and h3), one undo.
    await lab(page, id => window.__bwSimLab.editor.apply({type: 'delete', id}), pinId);
    const PR = [0, -1, 0, 1, 0, 0, 0, 0, 1];
    // Beside Beam 7 and above the floor (the drag carries it from where it is), in view.
    const g9 = await layOut(page, [['32523.dat', [60, -40, 0], I], ['2780.dat', [60, -30, -20], PR], ['2780.dat', [60, -30, 20], PR]], {group: [0, 1, 2]});
    const grab9 = await screenAt(page, [60, -50, -16]);
    const ids9 = g9;
    const before9 = (await parts(page)).filter(p => ids9.includes(p.id));
    await page.mouse.move(grab9[0], grab9[1]);
    await page.mouse.down();
    await page.mouse.move(q.h1[0], q.h1[1], {steps: 14});
    await frames(page);
    const c9 = await candidate(page);
    assert.ok(c9 && !c9.blocked, `the group snaps: ${JSON.stringify({c9, sel: await lab(page, () => window.__bwSimLab.editView.selection),
        status: await statusText(page)})}`);
    const holes9 = c9.pairs.filter(p => p.fixed.part === beam).map(p => p.fixed.connector).sort();
    assert.ok(holes9.length >= 2 && holes9.includes('h1') && holes9.includes('h3'), `two pins seated: ${JSON.stringify(c9.pairs)}`);
    await page.mouse.up();
    const after9 = (await parts(page)).filter(p => ids9.includes(p.id));
    assert.notDeepEqual(after9, before9);
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual((await parts(page)).filter(p => ids9.includes(p.id)), before9, 'one undo step');
    out.t9 = holes9;
    await lab(page, ids => window.__bwSimLab.editor.apply({type: 'batch', commands: [{type: 'ungroup', id: window.__bwSimLab.editor.model.groups[0].id},
        ...ids.map(id => ({type: 'delete', id}))]}), ids9);

    // T10. Target-first: the beam selected (a click), a click on its lit h1, then the pin's tile. (h1, not h3:
    // the selected beam's gizmo sits on its origin, h3, and a press there grabs the gizmo.)
    await page.keyboard.press('Escape');
    await tool(page, 'view-home');
    await frames(page);
    await hover(page, q.h1);
    await page.mouse.click(q.h1[0], q.h1[1]);
    assert.equal(await page.getByTestId('bw-sim-lab-target-chip').count(), 0, 'the first click only selects');
    await page.mouse.move(q.h1[0] + 3, q.h1[1]);
    await page.mouse.move(q.h1[0], q.h1[1]);
    await page.mouse.click(q.h1[0], q.h1[1]);
    await page.getByTestId('bw-sim-lab-target-chip').waitFor({timeout: 5000});
    const n10 = await count(page);
    await page.getByTestId('bw-sim-lab-part-2780.dat').click();
    assert.equal(await count(page), n10 + 1, 'the pin went in');
    const s10 = await seat((await parts(page)).at(-1).id, h.h1);
    assert.deepEqual({...s10, pairs: null}, {...s2, pairs: null}, `the same seat as a click (in h1): ${JSON.stringify({s10, s2})}`);
    assert.deepEqual(s10.pairs, [beam]);
    await page.keyboard.press('ControlOrMeta+z');

    // T16. Keyboard only: Enter on the pin's tile, Tab to hole 4 (h3), Enter.
    const n16 = await count(page);
    await page.getByTestId('bw-sim-lab-part-2780.dat').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__bwSimLab._pane.state.placing === '2780.dat');
    let said = '';
    for (let i = 0; i < 20; i++) {
        const c = await candidate(page);
        said = await page.getByTestId('bw-sim-lab-announce').textContent();
        if (c && c.target.connectorId === 'h3' && c.target.entry === 0) break;
        await page.keyboard.press('Tab');
    }
    assert.match(said, /hole 4 of 7/, `the screen reader heard the hole: ${said}`);
    await page.keyboard.press('Enter');
    assert.equal(await count(page), n16 + 1);
    assert.deepEqual(await seat((await parts(page)).at(-1).id), s2, 'keyboard placement = T2');
    out.announce = said;
    await page.keyboard.press('ControlOrMeta+z');

    // T11. A Shift+middle drag over Q on the beam: Q stays within 2 px.
    await page.keyboard.press('Escape');
    const Q = topFace(h.h2);
    const q11 = await screenAt(page, Q);
    await page.mouse.move(q11[0], q11[1]);
    await page.keyboard.down('Shift');
    await page.mouse.down({button: 'middle'});
    await page.mouse.move(q11[0] + 200, q11[1] + 40, {steps: 20});
    await page.mouse.up({button: 'middle'});
    await page.keyboard.up('Shift');
    const q11b = await screenAt(page, Q);
    assert.ok(dist(q11, q11b) <= 2, `Q stayed under the pointer's start: ${q11} → ${q11b}`);
    out.orbitDriftPx = dist(q11, q11b);
    // T11b. The shared secondary-drag setting: a right drag orbits about Q, a middle drag
    // slides the view; a right click without a drag puts down the part in hand. Then choose secondary drag to pan.
    const secondaryDrag = async value => {
        await canvas.focus();
        await page.keyboard.press('?');
        await page.getByTestId('bw-sim-lab-mouse-preset').selectOption(value);
        await page.getByTestId('bw-sim-lab-shortcuts-close').click();

    };
    await secondaryDrag('orbit');
    const q11c = await screenAt(page, Q);
    const c11 = await camera(page);
    await page.mouse.move(q11c[0], q11c[1]);
    await page.mouse.down({button: 'right'});
    await page.mouse.move(q11c[0] + 200, q11c[1] + 40, {steps: 20});
    await page.mouse.up({button: 'right'});
    const q11d = await screenAt(page, Q);
    const c11b = await camera(page);
    assert.ok(dist(q11c, q11d) <= 2 && dist(c11.position, c11b.position) > 1e-3, `shared navigation: a right drag orbits about Q: ${q11c} → ${q11d}`);
    await page.mouse.move(q11d[0], q11d[1]);
    await page.mouse.down({button: 'middle'});
    await page.mouse.move(q11d[0] + 120, q11d[1], {steps: 12});
    await page.mouse.up({button: 'middle'});
    const c11c = await camera(page);
    assert.ok(dist(c11b.target, c11c.target) > 1e-3 && Math.abs(c11c.distance - c11b.distance) < c11b.distance * 0.01,
        'shared navigation: a middle drag slides the view (the target moves, the distance stays)');
    await arm(page, '2780.dat');
    await page.mouse.move(q11d[0], q11d[1] + 60);
    await page.mouse.click(q11d[0], q11d[1] + 60, {button: 'right'});
    await page.waitForFunction(() => !window.__bwSimLab._pane.state.placing);
    assert.equal(await count(page), n16, 'a right click puts the part down, placing nothing');
    await secondaryDrag('pan');
    // T12. The wheel, and a pinch (Ctrl+wheel), at q over the beam: the point there stays within 2 px.
    await tool(page, 'view-home');
    await frames(page);
    for (const pinch of [false, true]) {
        const q12 = await screenAt(page, Q);
        const n12 = await parts(page);
        await page.mouse.move(q12[0], q12[1]);
        if (pinch) await page.keyboard.down('Control');
        await page.mouse.wheel(0, pinch ? -12 : -200);
        if (pinch) await page.keyboard.up('Control');
        await frames(page);
        const q12b = await screenAt(page, Q);
        assert.ok(dist(q12, q12b) <= 2, `${pinch ? 'pinch' : 'wheel'}: the point stays under the pointer: ${q12} → ${q12b}`);
        assert.deepEqual(await parts(page), n12, 'no part moves');
        out[pinch ? 'pinchDriftPx' : 'wheelDriftPx'] = dist(q12, q12b);
    }
    // T15. A trackpad slide pans, keeping the viewing direction and distance.
    const c15 = await camera(page);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(6, 3);
    await frames(page);
    const c15b = await camera(page);
    assert.ok(dist(c15.target, c15b.target) > 1e-3, 'a trackpad slide pans');
    assert.ok(dist(c15.position.map((v, i) => v - c15.target[i]), c15b.position.map((v, i) => v - c15b.target[i])) < 1e-5,
        'a trackpad pan preserves the viewing direction');
    assert.ok(Math.abs(c15b.distance - c15.distance) < c15.distance * 0.01, 'and keeps the distance');
    // T13. Down with the arrow keys: Build passes 100°.
    await tool(page, 'view-home');
    await canvas.focus();
    await page.keyboard.press('Escape');
    const polar = c => { const o = c.position.map((v, i) => v - c.target[i]); return Math.acos(o[1] / Math.hypot(...o)) * 180 / Math.PI; };
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
    out.buildPolar = polar(await camera(page));
    assert.ok(out.buildPolar > 100, `Build looks from below: ${out.buildPolar.toFixed(1)}°`);
    // T14. A double click on the beam: the view centres on the clicked point at the same distance. Judged on the end
    // CONDITION, never on wall time (a loaded runner stretches frames): eased, an animation starts and the target
    // then reaches the point; with reduced motion the target is there as soon as the double click is handled.
    // The tolerance is what one screen pixel (and the pointer's rounding to whole pixels) spans on the beam's top
    // face at this zoom, measured from the projection, not chosen.
    await tool(page, 'view-home');
    await frames(page);
    for (const reduce of [false, true]) {
        await page.emulateMedia({reducedMotion: reduce ? 'reduce' : 'no-preference'});
        // A point on the beam's top between two holes (solid there: the mesh and the collider agree).
        const P = topFace(h.h1).map((v, i) => v + (i === 2 ? 10 : 0));
        await page.waitForFunction(() => !window.__bwSimLab.editView.debug.animating(), null, {timeout: 30000, polling: 'raf'});
        const qp = await screenAt(page, P);
        const px = [];
        for (const d of [[1, 0, 0], [0, 0, 1]]) px.push(dist(qp, await screenAt(page, P.map((v, i) => v + d[i]))));
        // LDU: one pixel along each of the face's axes (the pointer lands on whole pixels, and the hit is the
        // surface under that pixel, whose span on the face grows with how slanted the face is seen).
        const tol = 1 / px[0] + 1 / px[1] + 0.05;
        const d0 = (await camera(page)).distance;
        await page.mouse.dblclick(qp[0], qp[1]);
        const right = await lab(page, () => ({animating: window.__bwSimLab.editView.debug.animating(), target: window.__bwSimLab.editView.camera.target}));
        const offOf = target => dist(target.map((v, i) => (i ? -v : v) / 0.0004), P);
        if (reduce) {
            assert.equal(right.animating, false, 'reduced motion: no animation');
            assert.ok(offOf(right.target) <= tol, `reduced motion: centred at once (${offOf(right.target).toFixed(2)} LDU off, tolerance ${tol.toFixed(2)})`);
        } else {
            assert.equal(right.animating, true, 'eased: the double click started a camera animation');
            // The end condition: the animation is over (the view's own clock decides when, not this test's).
            await page.waitForFunction(() => !window.__bwSimLab.editView.debug.animating(), null, {timeout: 30000, polling: 'raf'});
        }
        const cam14 = await camera(page);
        assert.ok(offOf(cam14.target) <= tol, `centred on the clicked point: ${offOf(cam14.target).toFixed(2)} LDU off (tolerance ${tol.toFixed(2)})`);
        assert.ok(Math.abs(cam14.distance - d0) < d0 * 1e-6, 'at the same distance');
        out[reduce ? 'focusReducedOff' : 'focusOff'] = offOf(cam14.target);
        out.focusTol = tol;
        // Home eases too while motion is allowed: wait for it to end before aiming the next double click.
        await tool(page, 'view-home');
        await page.waitForFunction(() => !window.__bwSimLab.editView.debug.animating(), null, {timeout: 30000, polling: 'raf'});
    }
    await page.emulateMedia({reducedMotion: 'reduce'});
    // The view cube: its top face looks straight down.
    const cube = await lab(page, () => window.__bwSimLab.editView.debug.viewCube());
    await page.screenshot({path: resolve(shots, 'view-cube.png'), clip: {x: cube.left - 40, y: cube.top - 40, width: cube.size + 60, height: cube.size + 50}});
    let looked = null;
    for (const [fx, fy] of [[0.5, 0.25], [0.5, 0.3], [0.45, 0.2], [0.55, 0.3]]) {
        await page.mouse.click(cube.left + cube.size * fx, cube.top + cube.size * fy);
        await frames(page);
        const c = await camera(page);
        const o = c.position.map((v, i) => v - c.target[i]);
        if (o[1] / Math.hypot(...o) > 0.99) { looked = [fx, fy]; break; }
    }
    assert.ok(looked, 'a click on the view cube\'s top face looks straight down');
    await tool(page, 'view-home');
    // T13 (Simulate): the arrows stop at 90°.
    await page.getByTestId('bw-sim-lab-mode-simulate').click();
    await page.waitForFunction(() => window.__bwSimLab.mode === 'simulate' && window.__bwSimLab.status === 'ready');
    await page.getByTestId('bw-sim-lab-3d-canvas').focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
    out.simulatePolar = polar(await lab(page, () => window.__bwSimLab._pane.view.camera));
    assert.ok(out.simulatePolar <= 90.0001, `Simulate keeps the floor: ${out.simulatePolar.toFixed(1)}°`);
    void shotsDir;
    return out;
};
