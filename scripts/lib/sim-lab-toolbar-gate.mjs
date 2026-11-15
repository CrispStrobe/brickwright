// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab as its own editor tab, its icon toolbar and its movable 3D view, for
// scripts/verify-sim-lab-browser.mjs (--part=ui, and the helpers every part uses):
//
//   1. every toolbar control, on the bar or in its More menu, has an accessible name
//      and a tooltip that starts with that name and carries its shortcut when it has
//      one, in English and in German (a de-DE page);
//   2. every Build action is reachable by a click (bar or More) and does what it says,
//      and the shortcuts do the same from the keyboard (W/E, R, T, Ctrl+D, Delete,
//      Ctrl+C/V, Ctrl+A, Ctrl+Z/Y, Ctrl+G, H/Shift+H, I, M, K, F, ?, Esc);
//   3. the camera moves in both modes, with real mouse input only: a left drag on empty
//      space orbits (the target stays), a right drag pans (the target moves with the
//      camera), Shift+drag pans in Simulate, the wheel zooms toward the pointer, the
//      arrows orbit and Shift+arrows pan a focused view, + and - zoom, and the view
//      buttons (Home, Fit, Top, Front, Side) frame the model from their side;
//   4. in Build a drag that starts on a part moves the part and leaves the camera, and
//      with a part selected the arrow keys leave the camera alone.
//
// Internal APIs are only READ (camera pose, part poses, the selection) or used to find
// where something is on screen. No fixed sleeps: every wait is for a condition.

import assert from 'node:assert/strict';
import {resolve} from 'node:path';

/** The tab's accessible name in either language. */
export const ROBOT_LAB_TAB = /^(Robots|Roboter)$/;

/** Shows the Robot Lab tab, as a person does: its tab in the editor's tab list. */
export const openRobotLabTab = async page => {
    const tab = page.getByRole('tab', {name: ROBOT_LAB_TAB});
    // the words on the tab, not only its accessible name (the label once kept the old, long name)
    const label = (await tab.locator('[data-bw-tab-label]').textContent()).trim();
    if (!ROBOT_LAB_TAB.test(label)) throw new Error(`the Robot Lab tab reads "${label}"`);
    await tab.click();
};

/** Clicks (or taps) a toolbar action where a person finds it: on the bar, else in the More menu. */
export const tool = async (page, id, {tap = false} = {}) => {
    const button = page.getByTestId(`bw-sim-lab-${id}`);
    if (!(await button.isVisible())) {
        const more = page.getByTestId('bw-sim-lab-more');
        if (tap) await more.tap(); else await more.click();
        await button.waitFor({state: 'visible', timeout: 5000}).catch(async error => {
            console.error('Toolbar action unavailable after opening More', id, await page.evaluate(() => ({
                menu:window.__bwSimLab?._pane.state.menu,mode:window.__bwSimLab?._pane.state.mode,
                events:window.__bwTapLog?.slice(-16),
                more:document.querySelector('[data-testid="bw-sim-lab-more"]')?.getAttribute('aria-expanded')
            })));
            throw error;
        });
    }
    if (tap) await button.tap(); else await button.click();
};

/** Two animation frames: whatever the last input changed has been drawn. */
const frames = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

/** The view on show's camera: position, target, distance (metres). */
const cameraOf = (page, build) => page.evaluate(b => {
    const v = b ? window.__bwSimLab.editView : window.__bwSimLab._pane.view;
    return v.camera;
}, build);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const EPS = 1e-6;

/** Every toolbar control now on screen (and in the open menu): test id, name, tooltip, shortcut. */
const controlsOf = page => page.evaluate(() => [...document.querySelectorAll('[data-testid="bw-sim-lab-toolbar"] button, [data-testid="bw-sim-lab-toolbar"] select, [data-testid="bw-sim-lab-more-menu"] button, [data-testid="bw-sim-lab-more-menu"] select')]
    .filter(el => el.offsetParent !== null)
    .map(el => ({id: el.dataset.testid || null, label: el.getAttribute('aria-label'), title: el.getAttribute('title') || el.closest('[title]')?.getAttribute('title'),
        keys: el.getAttribute('aria-keyshortcuts'), role: el.getAttribute('role'), checked: el.getAttribute('aria-checked')})));

/**
 * Asserts every control (bar and More menu) is named and has a tooltip with its name and shortcut.
 * @returns {Promise<object[]>} the controls seen
 */
const assertNamed = async (page, where) => {
    let seen = await controlsOf(page);
    if (await page.getByTestId('bw-sim-lab-more').isVisible()) {
        await page.getByTestId('bw-sim-lab-more').click();
        await page.getByTestId('bw-sim-lab-more-menu').waitFor();
        seen = [...seen, ...(await controlsOf(page)).filter(c => !seen.some(s => s.id === c.id))];
        await page.keyboard.press('Escape');
        await page.getByTestId('bw-sim-lab-more-menu').waitFor({state: 'detached', timeout: 5000});
    }
    for (const c of seen) {
        assert.ok(c.label && c.label.trim().length > 1, `${where}: ${c.id} has no accessible name`);
        assert.ok(c.title && c.title.startsWith(c.label), `${where}: ${c.id}'s tooltip "${c.title}" does not name it ("${c.label}")`);
        if (c.keys) assert.ok(c.title.includes(`(${c.keys})`), `${where}: ${c.id}'s tooltip "${c.title}" does not give its shortcut ${c.keys}`);
    }
    return seen;
};

/** A left (or right / Shift) drag on the 3D view, from one fraction of it to another, in small steps. */
const dragOn = async (page, canvasId, from, to, {button = 'left', shift = false} = {}) => {
    const box = await page.getByTestId(canvasId).boundingBox();
    const at = f => [box.x + f[0] * box.width, box.y + f[1] * box.height];
    const [a, b] = [at(from), at(to)];
    await page.mouse.move(a[0], a[1]);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down({button});
    for (let i = 1; i <= 10; i++) await page.mouse.move(a[0] + (b[0] - a[0]) * i / 10, a[1] + (b[1] - a[1]) * i / 10);
    await page.mouse.up({button});
    if (shift) await page.keyboard.up('Shift');
    await frames(page);
};

/** A spot of the Build view with no part under it (the floor or the sky), as a fraction of the canvas. */
const emptySpot = page => page.evaluate(() => {
    const v = window.__bwSimLab.editView;
    const rect = v.canvas.getBoundingClientRect();
    const parts = window.__bwSimLab.editor.model.parts.map(p => v.toScreen(v.debugPoint(p.id)));
    let best = null;
    for (let fx = 0.1; fx <= 0.9; fx += 0.05) {
        for (let fy = 0.1; fy <= 0.9; fy += 0.05) {
            const x = rect.left + fx * rect.width, y = rect.top + fy * rect.height;
            const gap = Math.min(...parts.map(p => Math.hypot(p[0] - x, p[1] - y)));
            if (!best || gap > best.gap) best = {f: [fx, fy], gap};
        }
    }
    return best.f;
});

/**
 * The camera, with real input, in the view on show. In Build the drags start on empty space.
 * @returns {Promise<object>} what each gesture did, for the log
 */
export const cameraInteractions = async (page, {build}) => {
    const canvasId = build ? 'bw-sim-lab-editor-canvas' : 'bw-sim-lab-3d-canvas';
    const where = build ? 'Build' : 'Simulate';
    const out = {};
    // The named views: Top looks straight down, Front along the floor from the front, Side from the side.
    for (const [id, axis] of [['view-top', 1], ['view-front', 2], ['view-side', 0]]) {
        await tool(page, id);
        await frames(page);
        const c = await cameraOf(page, build);
        const off = c.position.map((v, i) => v - c.target[i]);
        const share = Math.abs(off[axis]) / Math.hypot(...off);
        assert.ok(share > 0.99, `${where}: ${id} looks along axis ${axis} (share ${share.toFixed(3)})`);
    }
    await tool(page, 'view-home');
    await frames(page);
    const home = await cameraOf(page, build);
    const start = build ? await emptySpot(page) : [0.12, 0.2];
    const end = [Math.min(0.9, start[0] + 0.25), Math.min(0.9, start[1] + 0.12)];
    // Build uses middle drag for orbit; empty-space left drag selects.
    await dragOn(page, canvasId, start, end, {button: build ? 'middle' : 'left'});
    const orbited = await cameraOf(page, build);
    assert.ok(dist(orbited.position, home.position) > 0.01, `${where}: the orbit gesture turns the view`);
    assert.ok(dist(orbited.target, home.target) < EPS, `${where}: orbiting keeps the target`);
    assert.ok(Math.abs(orbited.distance - home.distance) < 1e-4, `${where}: orbiting keeps the distance`);
    out.orbitM = dist(orbited.position, home.position);
    // Pan: a right drag slides camera and target together.
    await dragOn(page, canvasId, start, end, {button: 'right'});
    const panned = await cameraOf(page, build);
    assert.ok(dist(panned.target, orbited.target) > 0.005, `${where}: a right drag pans (the target moves)`);
    assert.ok(Math.abs(panned.distance - orbited.distance) < 1e-4, `${where}: panning keeps the distance`);
    out.panM = dist(panned.target, orbited.target);
    if (!build) {
        // Simulate: Shift+drag pans too (in Build, Shift+drag draws a selection box).
        await dragOn(page, canvasId, start, end, {shift: true});
        const shifted = await cameraOf(page, build);
        assert.ok(dist(shifted.target, panned.target) > 0.005, `${where}: Shift+drag pans`);
    }
    // Zoom: the wheel, toward the pointer.
    const before = await cameraOf(page, build);
    const box = await page.getByTestId(canvasId).boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(0, -400);
    await page.waitForFunction(([b, d]) => {
        const v = b ? window.__bwSimLab.editView : window.__bwSimLab._pane.view;
        return v.camera.distance < d * 0.95;
    }, [build, before.distance], {timeout: 5000});
    out.zoom = (await cameraOf(page, build)).distance / before.distance;
    // Keys on the focused view: arrows orbit, Shift+arrows pan, + / - zoom.
    await page.getByTestId(canvasId).focus();
    if (build) await page.keyboard.press('Escape'); // nothing selected
    let k0 = await cameraOf(page, build);
    await page.keyboard.press('ArrowLeft');
    let k1 = await cameraOf(page, build);
    assert.ok(dist(k1.position, k0.position) > 1e-4 && dist(k1.target, k0.target) < EPS, `${where}: ← orbits the focused view`);
    await page.keyboard.press('Shift+ArrowRight');
    k0 = k1;
    k1 = await cameraOf(page, build);
    assert.ok(dist(k1.target, k0.target) > 1e-4, `${where}: Shift+→ pans`);
    await page.keyboard.press('-');
    k0 = k1;
    k1 = await cameraOf(page, build);
    assert.ok(k1.distance > k0.distance * 1.1, `${where}: - zooms out`);
    // Fit and Home frame the model again.
    await tool(page, 'view-fit');
    await tool(page, 'view-home');
    await frames(page);
    const back = await cameraOf(page, build);
    assert.ok(dist(back.position, home.position) < 1e-3, `${where}: Home brings the first view back`);
    return out;
};

/** Build: a drag that starts on a part moves the part; the camera stays where it was. */
const partDragKeepsCamera = async page => {
    const id = await page.evaluate(() => { window.__bwSimLab.editView.placeAt('32524.dat', [0.25, 0, 0.1]); return window.__bwSimLab.editor.model.parts.at(-1).id; });
    await page.keyboard.press('Escape');
    await frames(page);
    const name = await page.evaluate(i => window.__bwSimLab._pane.partName(window.__bwSimLab.editor.model.parts.find(p => p.id === i).part), id);
    // Everything in view, then aim like a person: around the part's middle until the status names it.
    await tool(page, 'view-home');
    await frames(page);
    const centre = await page.evaluate(i => { const v = window.__bwSimLab.editView; return v.toScreen(v.debugPoint(i)); }, id);
    let at = null;
    for (const [dx, dy] of [[0, 0], [0, -6], [0, 6], [-8, 0], [8, 0], [-12, -6], [12, -6], [-12, 6], [12, 6], [0, -12], [0, 12]]) {
        const p = [centre[0] + dx, centre[1] + dy];
        await page.mouse.move(p[0], p[1]);
        if ((await page.getByTestId('bw-sim-lab-build-status').textContent()).startsWith(`${name}:`)) { at = p; break; }
    }
    assert.ok(at, `a spot on ${id} to press`);
    const cam = await cameraOf(page, true);
    const pos = await page.evaluate(i => window.__bwSimLab.editor.model.parts.find(p => p.id === i).position, id);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(at[0] + 6 * i, at[1] + 2 * i);
    await page.mouse.up();
    await frames(page);
    const moved = await page.evaluate(i => window.__bwSimLab.editor.model.parts.find(p => p.id === i).position, id);
    assert.ok(dist(moved, pos) >= 10, `a drag on the part moves it (${JSON.stringify(pos)} → ${JSON.stringify(moved)})`);
    const after = await cameraOf(page, true);
    assert.ok(dist(after.position, cam.position) < EPS && dist(after.target, cam.target) < EPS, 'dragging a part leaves the camera');
    // With a part selected, the arrows are not camera keys.
    await page.getByTestId('bw-sim-lab-editor-canvas').focus();
    await page.keyboard.press('ArrowLeft');
    const still = await cameraOf(page, true);
    assert.ok(dist(still.position, after.position) < EPS, 'with a part selected the arrows leave the camera');
    return {id, movedLdu: dist(moved, pos)};
};

const partsOf = page => page.evaluate(() => window.__bwSimLab.editor.model.parts.length);
const selectedOf = page => page.evaluate(() => window.__bwSimLab.editView.selection.length);
export const toolAttribute = async (page, id, attribute) => {
    const button=page.getByTestId(`bw-sim-lab-${id}`);
    const inMore=!(await button.isVisible());
    if(inMore) await page.getByTestId('bw-sim-lab-more').click();
    const pressed=await button.getAttribute(attribute);
    if(inMore) await page.getByTestId('bw-sim-lab-more').click();
    return pressed;
};
const pressedOf = (page,id) => toolAttribute(page,id,'aria-pressed');

/** Build: every action by a click, and the shortcuts by key, each with its effect. */
const buildActions = async page => {
    const canvas = page.getByTestId('bw-sim-lab-editor-canvas');
    const keys = async combo => { await canvas.focus(); await page.keyboard.press(combo); await frames(page); };
    // Gizmo modes: by click, and W / E.
    await tool(page, 'mode-rotate');
    assert.equal(await pressedOf(page, 'mode-rotate'), 'true', 'Turn with rings is pressed after a click');
    await keys('w');
    assert.equal(await pressedOf(page, 'mode-move'), 'true', 'W switches back to Move');
    await keys('e');
    assert.equal(await pressedOf(page, 'mode-rotate'), 'true', 'E switches to Turn');
    await tool(page, 'mode-move');
    // Select all (click), Esc (key) clears; Ctrl+A (key), Cancel (click) clears.
    const n = await partsOf(page);
    await tool(page, 'select-all');
    assert.equal(await selectedOf(page), n, 'Select all selects every part');
    await keys('Escape');
    assert.equal(await selectedOf(page), 0, 'Esc clears the selection');
    await keys('ControlOrMeta+a');
    assert.equal(await selectedOf(page), n, 'Ctrl+A selects every part');
    await tool(page, 'cancel');
    assert.equal(await selectedOf(page), 0, 'Cancel clears the selection');
    // One part to work on: a beam on open floor, selected.
    let id = await page.evaluate(() => { window.__bwSimLab.editView.placeAt('32524.dat', [-0.3, 0, -0.2]); return window.__bwSimLab.editor.model.parts.at(-1).id; });
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    const rot = () => page.evaluate(i => window.__bwSimLab.editor.model.parts.find(p => p.id === i)?.rotation.join(','), id);
    const turns = [['turn', 'r'], ['turn-back', 'Shift+r'], ['tip', 't']];
    for (const [action, key] of turns) {
        let r0 = await rot();
        await tool(page, action);
        assert.notEqual(await rot(), r0, `${action} (click) turns the part`);
        r0 = await rot();
        await keys(key);
        assert.notEqual(await rot(), r0, `${action} (${key}) turns the part`);
    }
    // Undo / redo by click and by key.
    const r0 = await rot();
    await tool(page, 'undo');
    assert.notEqual(await rot(), r0, 'Undo (click) takes the last turn back');
    await tool(page, 'redo');
    assert.equal(await rot(), r0, 'Redo (click) does it again');
    await keys('ControlOrMeta+z');
    assert.notEqual(await rot(), r0, 'Ctrl+Z undoes');
    await keys('ControlOrMeta+y');
    assert.equal(await rot(), r0, 'Ctrl+Y redoes');
    // Duplicate, delete, copy / paste: by click and by key.
    let count = await partsOf(page);
    await tool(page, 'duplicate');
    assert.equal(await partsOf(page), count + 1, 'Duplicate (click) adds a copy');
    await keys('ControlOrMeta+d');
    assert.equal(await partsOf(page), count + 2, 'Ctrl+D adds a copy');
    await tool(page, 'delete');
    assert.equal(await partsOf(page), count + 1, 'Delete (click) removes the selection');
    // Work on with a beam that is still there (Delete took whichever was selected).
    id = await page.evaluate(i => {
        const parts = window.__bwSimLab.editor.model.parts;
        return parts.some(p => p.id === i) ? i : parts.filter(p => p.part === '32524.dat').at(-1).id;
    }, id);
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    count = await partsOf(page);
    await tool(page, 'copy');
    await tool(page, 'paste');
    await page.waitForFunction(c => window.__bwSimLab.editor.model.parts.length === c + 1, count, {timeout: 5000});
    await keys('Delete');
    assert.equal(await partsOf(page), count, 'Delete (key) removes the pasted copy');
    // Group / ungroup: two parts.
    const two = await page.evaluate(i => [i, window.__bwSimLab.editor.model.parts.find(p => p.id !== i && p.part === '32524.dat')?.id ||
        window.__bwSimLab.editor.model.parts.find(p => p.id !== i).id], id);
    await page.evaluate(ids => window.__bwSimLab.editView.select(ids), two);
    const groups = () => page.evaluate(() => (window.__bwSimLab.editor.model.groups || []).length);
    const g0 = await groups();
    await tool(page, 'group');
    assert.equal(await groups(), g0 + 1, 'Group (click) makes a group');
    await tool(page, 'ungroup');
    assert.equal(await groups(), g0, 'Ungroup (click) takes it apart');
    await keys('ControlOrMeta+g');
    assert.equal(await groups(), g0 + 1, 'Ctrl+G groups');
    await keys('ControlOrMeta+Shift+g');
    assert.equal(await groups(), g0, 'Ctrl+Shift+G ungroups');
    // Hide / show all / isolate: by click and key.
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    await tool(page, 'hide');
    await page.getByTestId('bw-sim-lab-hidden-count').waitFor();
    await tool(page, 'show-all');
    await page.getByTestId('bw-sim-lab-hidden-count').waitFor({state: 'detached'});
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    await keys('h');
    await page.getByTestId('bw-sim-lab-hidden-count').waitFor();
    await keys('Shift+h');
    await page.getByTestId('bw-sim-lab-hidden-count').waitFor({state: 'detached'});
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    await tool(page, 'isolate');
    await page.getByTestId('bw-sim-lab-hidden-count').waitFor();
    await tool(page, 'show-all');
    await page.getByTestId('bw-sim-lab-hidden-count').waitFor({state: 'detached'});
    // Mirror: a straight beam is its own mirror image — the action runs and the status says so.
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    await tool(page, 'mirror-x');
    await tool(page, 'mirror-z');
    // Measure and eyedropper are tools: pressed while on, Esc ends them; M and K start them.
    for (const [action, key] of [['measure', 'm'], ['eyedropper', 'k']]) {
        await tool(page, action);
        assert.equal(await pressedOf(page, action), 'true', `${action} (click) is on`);
        await keys('Escape');
        await page.waitForFunction(() => !window.__bwSimLab._pane.state.pick, null, {timeout: 5000});
        await keys(key);
        await page.waitForFunction(() => window.__bwSimLab._pane.state.pick, null, {timeout: 5000});
        await keys('Escape');
    }
    // F fits the selection (the camera moves to it).
    await page.evaluate(i => window.__bwSimLab.editView.select([i]), id);
    const c0 = await cameraOf(page, true);
    await keys('f');
    assert.ok(dist((await cameraOf(page, true)).position, c0.position) > 1e-4, 'F fits the selection');
    // Panels: the parts panel and the properties close and open from the toolbar.
    const visible = testId => page.getByTestId(testId).isVisible();
    const palette = await visible('bw-sim-lab-palette');
    await tool(page, 'parts-toggle');
    await page.waitForFunction(was => Boolean(document.querySelector('[data-testid="bw-sim-lab-palette"]')?.offsetParent) !== was, palette, {timeout: 5000});
    await tool(page, 'parts-toggle');
    await page.waitForFunction(was => Boolean(document.querySelector('[data-testid="bw-sim-lab-palette"]')?.offsetParent) === was, palette, {timeout: 5000});
    const props = await visible('bw-sim-lab-properties-panel');
    await tool(page, 'properties');
    await page.waitForFunction(was => Boolean(document.querySelector('[data-testid="bw-sim-lab-properties-panel"]')) !== was, props, {timeout: 5000});
    await tool(page, 'properties');
    await page.waitForFunction(was => Boolean(document.querySelector('[data-testid="bw-sim-lab-properties-panel"]')) === was, props, {timeout: 5000});
    // The overlay switches.
    for (const sw of ['show-ports', 'show-motion']) {
        const was = await toolAttribute(page, sw, 'aria-checked');
        await tool(page, sw);
        assert.notEqual(await toolAttribute(page, sw, 'aria-checked'), was, `${sw} switches`);
        await tool(page, sw);
    }
    // The grid step.
    if (!(await page.getByTestId('bw-sim-lab-grid').isVisible())) await page.getByTestId('bw-sim-lab-more').click();
    await page.getByTestId('bw-sim-lab-grid').selectOption('20');
    assert.equal(await page.evaluate(() => window.__bwSimLab._pane.state.grid), 20, 'the grid list sets the step');
    if (await page.getByTestId('bw-sim-lab-more-menu').isVisible()) await page.keyboard.press('Escape');
    // The shortcut sheet: its button, and ?.
    await tool(page, 'shortcuts');
    await page.getByTestId('bw-sim-lab-shortcut-sheet').waitFor();
    await page.getByTestId('bw-sim-lab-shortcuts-close').click();
    await keys('?');
    await page.getByTestId('bw-sim-lab-shortcut-sheet').waitFor();
    await page.getByTestId('bw-sim-lab-shortcuts-close').click();
    await page.getByTestId('bw-sim-lab-shortcut-sheet').waitFor({state: 'detached'});
};

/**
 * The tab, the toolbar and the camera on a page with the Robot Lab open in Simulate.
 * @param {import('playwright').Page} page
 * @param {{shotsDir: string, labels: object, full?: boolean}} options `labels`: id → expected accessible name (the page's language)
 */
export const toolbarInteractions = async (page, {shotsDir, labels, full = true}) => {
    const result = {};
    // The tab is selected and the Lab fills it.
    const tab = page.getByRole('tab', {name: ROBOT_LAB_TAB});
    assert.equal(await tab.getAttribute('aria-selected'), 'true', 'the Robot Lab tab is the selected tab');
    const lab = await page.getByTestId('bw-sim-lab').boundingBox();
    const panel = await page.getByTestId('bw-robot-lab-tab').boundingBox();
    assert.ok(lab.width >= panel.width - 2 && lab.height >= panel.height - 2, `the Lab fills its tab: ${JSON.stringify({lab, panel})}`);
    // No wall of text: the description is behind Help, not above the view.
    assert.equal(await page.getByTestId('bw-sim-lab-help-popover').count(), 0);
    await page.getByTestId('bw-sim-lab-help').click();
    await page.getByTestId('bw-sim-lab-help-popover').waitFor();
    assert.match(await page.getByTestId('bw-sim-lab-help-popover').textContent(), /LEGO®/);
    await page.mouse.click(5, (await page.getByTestId('bw-sim-lab-main').boundingBox()).y + 40);
    await page.getByTestId('bw-sim-lab-help-popover').waitFor({state: 'detached', timeout: 5000});
    // Names and tooltips, Simulate.
    const sim = await assertNamed(page, 'Simulate');
    for (const [id, name] of Object.entries(labels.simulate)) {
        const c = sim.find(x => x.id === `bw-sim-lab-${id}`);
        assert.ok(c, `Simulate: ${id} is on the toolbar or in More`);
        assert.equal(c.label, name, `Simulate: ${id} is called "${name}"`);
    }
    // The File menu offers Open and the three Save formats.
    const fileMenu=page.getByTestId('bw-sim-lab-file-menu');
    if(await fileMenu.isVisible()) await fileMenu.click();
    else await page.getByTestId('bw-sim-lab-more').click();
    for (const id of ['open', 'save-ldr', 'save-mpd', 'save-io']) await page.getByTestId(`bw-sim-lab-${id}`).waitFor();
    await page.keyboard.press('Escape');
    await page.getByTestId('bw-sim-lab-file-list').waitFor({state: 'detached', timeout: 5000});
    await page.getByTestId('bw-sim-lab-more-menu').waitFor({state: 'detached', timeout: 5000});
    await page.screenshot({path: resolve(shotsDir, 'robot-lab-tab-simulate.png')});
    if (full) result.simulateCamera = await cameraInteractions(page, {build: false});

    // Build.
    await page.getByTestId('bw-sim-lab-mode-build').click();
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab.editor, null, {timeout: 120000});
    await frames(page);
    const build = await assertNamed(page, 'Build');
    result.buildControls = build;
    for (const [id, name] of Object.entries(labels.build)) {
        const c = build.find(x => x.id === `bw-sim-lab-${id}`);
        assert.ok(c, `Build: ${id} is on the toolbar or in More`);
        assert.equal(c.label, name, `Build: ${id} is called "${name}"`);
    }
    for (const id of ['mode-move', 'mode-rotate', 'turn', 'turn-back', 'tip', 'group', 'ungroup', 'duplicate', 'delete', 'cancel', 'copy', 'paste',
        'select-all', 'undo', 'redo', 'view-home', 'view-fit', 'view-top', 'view-front', 'view-side', 'show-ports', 'show-motion', 'mirror-x',
        'mirror-z', 'hide', 'isolate', 'show-all', 'measure', 'eyedropper', 'parts-toggle', 'properties', 'shortcuts']) {
        assert.ok(build.some(c => c.id === `bw-sim-lab-${id}`), `Build: ${id} is reachable (bar or More)`);
    }
    // File: its menu on the bar, or its rows (Open, Save as) in More.
    assert.ok(build.some(c => c.id === 'bw-sim-lab-file-menu') || build.some(c => c.id === 'bw-sim-lab-open'), 'Build: the File actions are reachable');
    await page.screenshot({path: resolve(shotsDir, 'robot-lab-tab-build.png')});
    if (full) {
        result.buildCamera = await cameraInteractions(page, {build: true});
        result.partDrag = await partDragKeepsCamera(page);
        await buildActions(page);
    }
    await page.getByTestId('bw-sim-lab-mode-simulate').click();
    await page.waitForFunction(() => window.__bwSimLab.mode === 'simulate' && window.__bwSimLab.status === 'ready', null, {timeout: 120000});
    return result;
};
