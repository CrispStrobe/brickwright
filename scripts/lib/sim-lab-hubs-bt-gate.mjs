// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The EV3 and NXT in the Robot Lab (`--part=hubs-bt` of scripts/verify-sim-lab-browser.mjs;
// docs/ROBOT-LAB-HUBS-PLAN.md P4/P5, docs/ROBOT-LAB-EV3-NXT.md), in the shipped build, with the
// physics in the Web Worker. The extensions dial Scratch Link themselves; the app's WebSocket
// wrapper (lib/virtual-hub/bt-classic-registry.js, installed at boot) hands their socket to the
// Lab's "Virtual EV3" / "Virtual NXT" while the scene has that brick.
//
//   1. NXT bumper bot, through the UI only: choose the model, Load example program (legonxt blocks
//      onto the sprite), Run — legonxt connects to the Virtual NXT; both drive motors turn 360 ± 2°
//      (the TachoCount the brick reports for the move), then the robot drives until the touch
//      sensor's bumper meets the wall, and the motors stop.
//   2. EV3 wall stopper with the stock Scratch EV3 blocks built in the page's VM (per motor: power
//      30, turn this way 0.2 s until distance < 10 in), Run — the `ev3` extension connects to the
//      Virtual EV3 and the robot stops before the wall on its ultrasonic sensor.
//   3. The EV3 wall stopper's DEVICE EV3 example loads into the Code tab and becomes ev3comprehensive
//      blocks (its Run is a known open: docs/ROBOT-LAB-EV3-NXT.md "Known open").
// Judged on simulated time, sampled after every advance (session.onAdvance).

import assert from 'node:assert/strict';

/** The 360° move's accuracy, as the headless test (test/bw-sim-bt-hubs-program.test.mjs). */
export const DEGREES_TOLERANCE = 2;
/**
 * The bumper bot's run ends, pressed or not, after this much simulated time. It presses at about 2.8 s
 * and is done at about 3.8 s. A run that went wrong is judged at this limit: CI run 39327216331's
 * first attempt met the wall about 9.5° askew, where the button's edge touched it and its centre stayed
 * 1.6 mm off it, so the sensor (then one ray from the centre, bw-sim/sensors.js) never read pressed.
 */
export const NXT_RUN_LIMIT_MS = 15000;

const openModel = async (page, file) => {
    await page.getByTestId('bw-sim-lab-model').selectOption(file);
    await page.waitForFunction(f => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === f &&
        window.__bwSimLab._pane.session?.worker, file, {timeout: 60000});
    // Example selection also replaces the Scratch project asynchronously.
    // Wait for that project before constructing or inspecting its blocks.
    await page.waitForFunction(file => {
        const pane = window.__bwSimLab._pane;
        const target = pane.props.vm.editingTarget;
        const opcode = file === 'nxt-bumper-bot.ldr' ? 'legonxt_motorRunDegrees' : 'ev3comprehensive_motorRun';
        return !pane.state.programLoading && target &&
            Object.values(target.blocks._blocks).some(b => b.opcode === opcode);
    }, file, {timeout: 60000});
};

/** Read-only instrument: per advance, the brick's motors, its first input, the robot's x. */
const instrument = page => page.evaluate(() => {
    const pane = window.__bwSimLab._pane;
    const s = pane.session;
    const entry = s.hubs.find(h => h.profile === 'ev3' || h.profile === 'nxt');
    const rec = window.__bwBt = {start: s.time, samples: [], profile: entry.profile};
    s.onAdvance(() => {
        const hub = entry.hub;
        const pose = s.core.bodyPose(entry.body);
        // yaw: the heading's turn about +y (degrees), from the pose's quaternion [x, y, z, w]
        const q = pose.rotation;
        const sample = {t: s.time - rec.start, x: pose.position[0], yaw: Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])) * 180 / Math.PI};
        if (entry.profile === 'nxt') {
            sample.moves = [1, 2].map(i => ({limit: hub.s.outputs[i].tachoLimit, run: hub.s.outputs[i].runState,
                tacho: hub.getOutputState(i).tachoCount, angle: hub.s.outputs[i].angleDeg}));
            sample.touch = hub.getInputValues(0).scaled;
        } else {
            sample.cm = hub.readInput(0, 3, 0, 0, 'READY_SI').values[0];
            sample.angles = [1, 2].map(i => hub.s.outputs[i].angleDeg);
        }
        rec.samples.push(sample);
    });
});

/** The stock Scratch EV3 extension's program, built in the page's VM as the Blocks editor stores it. */
const buildStockEv3 = page => page.evaluate(async () => {
    const vm = window.__bwSimLab._pane.props.vm;
    await vm.extensionManager.loadExtensionURL('ev3');
    const target = vm.editingTarget;
    let n = 0;
    const id = p => `bwgate${p}${++n}`;
    const add = (opcode, extra = {}) => {
        const b = id('b');
        target.blocks.createBlock({id: b, opcode, next: null, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: false, ...extra});
        return b;
    };
    const shadow = (opcode, parent, field, value) => add(opcode, {parent, shadow: true, fields: {[field]: {name: field, value: String(value)}}});
    for (const port of ['1', '2']) {
        const hat = add('event_whenflagclicked', {topLevel: true, x: 40 + 300 * Number(port), y: 40});
        const power = add('ev3_motorSetPower', {parent: hat});
        target.blocks._blocks[power].inputs = {
            PORT: {name: 'PORT', block: shadow('ev3_menu_motorPorts', power, 'motorPorts', port), shadow: null},
            POWER: {name: 'POWER', block: shadow('math_number', power, 'NUM', 30), shadow: null}};
        for (const k of ['PORT', 'POWER']) target.blocks._blocks[power].inputs[k].shadow = target.blocks._blocks[power].inputs[k].block;
        const wait = add('control_wait', {parent: power});
        const waitN = shadow('math_positive_number', wait, 'NUM', 0.5);
        target.blocks._blocks[wait].inputs = {DURATION: {name: 'DURATION', block: waitN, shadow: waitN}};
        const loop = add('control_repeat_until', {parent: wait});
        const turn = add('ev3_motorTurnClockwise', {parent: loop});
        const turnPort = shadow('ev3_menu_motorPorts', turn, 'motorPorts', port);
        const turnTime = shadow('math_number', turn, 'NUM', 0.2);
        target.blocks._blocks[turn].inputs = {PORT: {name: 'PORT', block: turnPort, shadow: turnPort}, TIME: {name: 'TIME', block: turnTime, shadow: turnTime}};
        const lt = add('operator_lt', {parent: loop});
        const distance = add('ev3_getDistance', {parent: lt});
        const ten = shadow('text', lt, 'TEXT', 10);
        const blank = shadow('text', lt, 'TEXT', '');
        target.blocks._blocks[lt].inputs = {OPERAND1: {name: 'OPERAND1', block: distance, shadow: blank}, OPERAND2: {name: 'OPERAND2', block: ten, shadow: ten}};
        target.blocks._blocks[loop].inputs = {CONDITION: {name: 'CONDITION', block: lt, shadow: null}, SUBSTACK: {name: 'SUBSTACK', block: turn, shadow: null}};
        target.blocks._blocks[hat].next = power;
        target.blocks._blocks[power].next = wait;
        target.blocks._blocks[wait].next = loop;
    }
    vm.emitWorkspaceUpdate();
    return Object.values(target.blocks._blocks).filter(b => b.opcode.startsWith('ev3_')).length;
});

export const hubsBtInteractions = async ({browser, errors, openSimLab, wallBudget}) => {
    const out = {};
    // ---- 1. NXT bumper bot through the UI -------------------------------------------------------
    {
        const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await openSimLab(page, {program: null});
        await openModel(page, 'nxt-bumper-bot.ldr');
        assert.equal(await page.evaluate(() => window.__bwSimLab._pane.session.worker), true, 'the physics runs in the Web Worker');

        await page.waitForFunction(() => window.__bwSimLab._pane.props.vm.extensionManager.isExtensionLoaded('legonxt') &&
            Object.values(window.__bwSimLab._pane.props.vm.editingTarget.blocks._blocks).some(b => b.opcode === 'legonxt_motorRunDegrees'),
        null, {timeout: 60000});
        // Load example program also puts the robot on the mat its program is written for: the Wall.
        await page.waitForFunction(() => window.__bwSimLab._pane.state.mat === 'wall' && window.__bwSimLab.status === 'ready' &&
            window.__bwSimLab._pane.session, null, {timeout: 60000});
        await instrument(page);
        await page.getByTestId('bw-sim-lab-run').click();
        // Judged on the end state, not at a fixed time: the run is over once the bumper has been pressed
        // and the motors have stood still for half a second (about 3.5 s of simulated time: 360° ~1 s,
        // the 2 s wait, the drive to the wall), or after NXT_RUN_LIMIT_MS of simulated time without that.
        await page.waitForFunction(limit => {
            const r = window.__bwBt.samples;
            const last = r[r.length - 1];
            if (!last) return false;
            if (last.t > limit) return true;
            const pressed = r.find(p => p.touch === 1);
            if (!pressed || last.t < pressed.t + 1000) return false;
            const before = r.find(p => p.t >= last.t - 500);
            return [0, 1].every(k => Math.abs(last.moves[k].angle - before.moves[k].angle) < 3);
        }, NXT_RUN_LIMIT_MS, {timeout: wallBudget(NXT_RUN_LIMIT_MS), polling: 250});
        const r = await page.evaluate(() => window.__bwBt.samples);
        // A connection that failed (the program then runs late, or not at all) is named first.
        assert.equal(await page.evaluate(() => window.__bwSimLab._pane.state.message || ''), '', 'no connection message');
        const moved = r.filter(p => p.moves.every(m => m.limit === 360 && m.run === 0)).at(-1);
        assert.ok(moved, 'the 360° moves ran and ended');
        out.nxt = {tacho: moved.moves.map(m => m.tacho)};
        for (const m of moved.moves) assert.ok(Math.abs(m.tacho - 360) <= DEGREES_TOLERANCE, `TachoCount ${m.tacho} after the 360° move`);
        const pressed = r.find(p => p.touch === 1);
        const end = r.at(-1);
        assert.ok(pressed, `the bumper was pressed (by ${Math.round(end.t)} ms of simulated time; robot at x ${end.x.toFixed(4)} m turned ${end.yaw.toFixed(1)}°, ` +
            `motors at ${end.moves.map(m => Math.round(m.angle)).join('° and ')}°)`);
        const last = r.at(-1);
        const before = r.find(p => p.t >= last.t - 500);
        out.nxt.pressedAtMs = Math.round(pressed.t);
        for (const k of [0, 1]) assert.ok(Math.abs(last.moves[k].angle - before.moves[k].angle) < 3, 'the motors stopped on the touch');
        assert.equal(last.touch, 1, 'it stays against the wall');
        await page.close();
    }
    // ---- 2. EV3 wall stopper, stock Scratch EV3 blocks -------------------------------------------
    {
        const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await openSimLab(page, {program: null});
        await openModel(page, 'ev3-wall-stopper.ldr');
        await page.evaluate(() => window.__bwSimLab._pane.setMat('wall'));
        await page.waitForFunction(() => window.__bwSimLab._pane.state.mat === 'wall' && window.__bwSimLab.status === 'ready' &&
            window.__bwSimLab._pane.session, null, {timeout: 60000});
        assert.equal(await buildStockEv3(page), 10, 'two scripts of stock EV3 blocks');
        await instrument(page);
        await page.getByTestId('bw-sim-lab-run').click();
        await page.waitForFunction(() => {
            const r = window.__bwBt;
            return r.samples.length && r.samples[r.samples.length - 1].t > 7000;
        }, null, {timeout: wallBudget(7000)});
        const r = await page.evaluate(() => window.__bwBt.samples);
        const last = r.at(-1);
        const before = r.find(p => p.t >= last.t - 1000);
        out.ev3 = {travelled: last.x - r[0].x, cm: last.cm};
        assert.ok(out.ev3.travelled > 0.2, `it drove at the wall: ${JSON.stringify(out.ev3)}`);
        assert.ok(last.cm > 2 && last.cm < 25.4, `stopped before the wall within 10 in: ${last.cm} cm`);
        assert.ok(Math.abs(last.x - before.x) < 0.005, 'stood still for its last second');
        await page.close();
    }
    // ---- 3. the DEVICE EV3 example becomes ev3comprehensive blocks -------------------------------
    {
        const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await openSimLab(page, {program: null});
        await openModel(page, 'ev3-wall-stopper.ldr');

        await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'),
            null, {timeout: 60000});
        assert.match(await page.locator('.cm-content').first().textContent(), /wait until \(ev3 distance 4 cm\) < 15/);
        out.device = await page.evaluate(() => {
            const vm = window.__bwSimLab._pane.props.vm;
            return {loaded: vm.extensionManager.isExtensionLoaded('ev3comprehensive'),
                ops: Object.values(vm.editingTarget.blocks._blocks).map(b => b.opcode).filter(op => op.startsWith('ev3comprehensive_') && !op.includes('_menu_')).sort()};
        });
        assert.equal(out.device.loaded, true, 'DEVICE EV3 loads ev3comprehensive');
        assert.deepEqual(out.device.ops, ['ev3comprehensive_motorRun', 'ev3comprehensive_motorStop', 'ev3comprehensive_ultrasonicSensor']);
        await page.close();
    }
    return out;
};
