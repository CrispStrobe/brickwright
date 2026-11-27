// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab steered from code (`--part=api` of scripts/verify-sim-lab-browser.mjs;
// docs/ROBOT-LAB-HUBS-PLAN.md P1, docs/SIM-LAB.md "Steering the Lab"), in the shipped build,
// with the physics in the Web Worker:
//
//   1. a BLOCKS project: robotlab blocks built in the VM as the Blocks editor stores them
//      (when flag clicked → load model motor-bench → run motor A for 360 degrees at
//      180 °/s → set labAngle to (motor A angle), set labStatus to (Robot Lab status)),
//      saved as an .sb3 and loaded back — then the Lab's Run: the model is swapped for the
//      hubless motor bench, its lab-direct hub turns the motor, the block waits on the
//      encoder and the reporter reads 360 ± 2° (the bound test/bw-sim-robot-lab-api.test.mjs
//      derives), and `runtime.robotLab` is the pane's API;
//   2. the same through `lab` WORDS, through the UI only: the Motor bench model, Load example
//      program (its `lab` words become robotlab blocks in the Code tab), Run — the motor turns
//      360°, rests at 360 ± 2° through the program's one-second wait, then runs on at
//      90 °/s for two seconds and brakes. Judged on simulated time, sampled after every
//      advance (session.onAdvance), never on wall-clock sleeps.

import assert from 'node:assert/strict';

/** Run-for-degrees accuracy: the 2° bound derived in test/bw-sim-robot-lab-api.test.mjs (1° window + braking from 10 °/s). */
export const DEGREES_TOLERANCE = 2;

/** Builds, saves and reloads a Blocks project in the page's VM; resolves to what it holds. */
const buildBlocksProject = page => page.evaluate(async () => {
    const pane = window.__bwSimLab._pane;
    const vm = pane.props.vm;
    await vm.extensionManager.loadExtensionURL('robotlab');
    const target = vm.runtime.targets.find(t => !t.isStage);
    const stage = vm.runtime.getTargetForStage();
    stage.createVariable('bwLabAngle', 'labAngle', '');
    stage.createVariable('bwLabStatus', 'labStatus', '');
    // Not yet set by the script: '' (a new variable holds 0, which a wait could not tell from a result).
    stage.variables.bwLabAngle.value = '';
    stage.variables.bwLabStatus.value = '';
    const add = (id, opcode, extra = {}) => target.blocks.createBlock({id, opcode, next: null, parent: null, inputs: {}, fields: {},
        shadow: false, topLevel: false, ...extra});
    const shadow = (id, opcode, parent, field, value) => add(id, opcode, {parent, shadow: true, fields: {[field]: {name: field, value}}});
    const input = (name, block, shadowId = block) => ({[name]: {name, block, shadow: shadowId}});
    add('hat', 'event_whenflagclicked', {topLevel: true, x: 40, y: 40, next: 'load'});
    shadow('loadMenu', 'robotlab_menu_models', 'load', 'models', 'motor-bench');
    add('load', 'robotlab_loadModel', {parent: 'hat', next: 'turn', inputs: input('MODEL', 'loadMenu')});
    shadow('turnMotor', 'robotlab_menu_motors', 'turn', 'motors', 'A');
    shadow('turnDeg', 'math_number', 'turn', 'NUM', '360');
    shadow('turnSpeed', 'math_number', 'turn', 'NUM', '180');
    add('turn', 'robotlab_runMotorDegrees', {parent: 'load', next: 'setAngle',
        inputs: {...input('MOTOR', 'turnMotor'), ...input('DEGREES', 'turnDeg'), ...input('SPEED', 'turnSpeed')}});
    shadow('angleText', 'text', 'setAngle', 'TEXT', '0');
    shadow('angleMotor', 'robotlab_menu_motors', 'angle', 'motors', 'A');
    add('angle', 'robotlab_motorAngle', {parent: 'setAngle', inputs: input('MOTOR', 'angleMotor')});
    add('setAngle', 'data_setvariableto', {parent: 'turn', next: 'setStatus', inputs: input('VALUE', 'angle', 'angleText'),
        fields: {VARIABLE: {name: 'VARIABLE', value: 'labAngle', id: 'bwLabAngle', variableType: ''}}});
    shadow('statusText', 'text', 'setStatus', 'TEXT', '');
    add('status', 'robotlab_labStatus', {parent: 'setStatus'});
    add('setStatus', 'data_setvariableto', {parent: 'setAngle', inputs: input('VALUE', 'status', 'statusText'),
        fields: {VARIABLE: {name: 'VARIABLE', value: 'labStatus', id: 'bwLabStatus', variableType: ''}}});
    // As a saved project: through the .sb3 and back (the extension reloads with it).
    const sb3 = await vm.saveProjectSb3();
    await vm.loadProject(await sb3.arrayBuffer());
    const reloaded = vm.runtime.targets.find(t => !t.isStage);
    return {
        ops: Object.values(reloaded.blocks._blocks).map(b => b.opcode).filter(op => op.startsWith('robotlab_')).sort(),
        hook: vm.runtime.robotLab === window.__bwSimLab.api,
        loaded: vm.extensionManager.isExtensionLoaded('robotlab')
    };
});

const stageVar = (page, name) => page.evaluate(n => {
    const v = window.__bwSimLab._pane.props.vm.runtime.getTargetForStage().lookupVariableByNameAndType(n, '');
    return v ? v.value : null;
}, name);

export const apiInteractions = async ({browser, errors, openSimLab, wallBudget}) => {
    const out = {};
    // ---- 1. a Blocks project drives the motor bench's motor --------------------------------
    {
        const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await openSimLab(page, {program: null});
        const built = await buildBlocksProject(page);
        assert.equal(built.hook, true, 'runtime.robotLab is the pane\'s Robot Lab API');
        assert.equal(built.loaded, true, 'the robotlab extension came back with the .sb3');
        assert.deepEqual(built.ops, ['robotlab_labStatus', 'robotlab_loadModel', 'robotlab_menu_models', 'robotlab_menu_motors',
            'robotlab_menu_motors', 'robotlab_motorAngle', 'robotlab_runMotorDegrees'], 'the blocks survived the save');
        // The Lab's Run presses the green flag for a Robot Lab program.
        await page.getByTestId('bw-sim-lab-run').click();
        await page.waitForFunction(() => {
            const v = window.__bwSimLab._pane.props.vm.runtime.getTargetForStage().lookupVariableByNameAndType('labStatus', '');
            return v && v.value !== '' && v.value !== 0;
        }, null, {timeout: wallBudget(15000)});
        const state = await page.evaluate(() => {
            const pane = window.__bwSimLab._pane;
            const s = pane.session;
            return {file: pane.state.modelFile, hubs: s.hubs.map(h => h.profile), worker: s.worker,
                encoder: window.__bwSimLab.api.encoder('A'), motors: window.__bwSimLab.api.motors()};
        });
        const angle = Number(await stageVar(page, 'labAngle'));
        out.blocks = {angle, status: await stageVar(page, 'labStatus'), ...state};
        assert.equal(state.file, 'motor-bench.ldr', `load model swapped the model: ${JSON.stringify(state)}`);
        assert.deepEqual(state.hubs, ['lab-direct'], 'a hubless model runs on the lab-direct hub');
        assert.equal(state.worker, true, 'the physics runs in the Web Worker');
        assert.ok(Math.abs(angle - 360) <= DEGREES_TOLERANCE, `the motor angle reporter read ${angle}° after run for 360 degrees`);
        assert.ok(Math.abs(state.encoder.angleDeg - 360) <= DEGREES_TOLERANCE, `encoder ${JSON.stringify(state.encoder)}`);
        assert.equal(out.blocks.status, 'running', 'Robot Lab status');
        await page.close();
    }
    // ---- 2. the same through `lab` words, through the UI only -------------------------------
    {
        const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await openSimLab(page, {program: null});
        await page.getByTestId('bw-sim-lab-model').selectOption('motor-bench.ldr');
        await page.waitForFunction(() => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === 'motor-bench.ldr' &&
            window.__bwSimLab._pane.session, null, {timeout: 60000});

        await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.'),
            null, {timeout: 60000});
        assert.match(await page.locator('.cm-content').first().textContent(), /lab run motor A for 360 degrees at 180 degrees per second/,
            'the example\'s lab words are in the Code tab');
        assert.ok(await page.evaluate(() => window.__bwSimLab._pane.robotLabLoaded()), 'the words became robotlab blocks');
        // Read-only instrument: the encoder after every advance of simulated time.
        await page.evaluate(() => {
            const s = window.__bwSimLab._pane.session;
            const api = window.__bwSimLab.api;
            const rec = window.__bwApiWords = {start: s.time, samples: []};
            s.onAdvance(() => {
                const e = api.encoder('A');
                rec.samples.push([s.time - rec.start, e.angleDeg, e.speedDps]);
            });
        });
        await page.getByTestId('bw-sim-lab-run').click();
        // The program: 360° (≈ 2.2 s), a 1 s wait, 2 s at 90 °/s, brake. 6 s of simulated time covers it.
        await page.waitForFunction(() => {
            const r = window.__bwApiWords;
            return r.samples.length && r.samples[r.samples.length - 1][0] > 6500;
        }, null, {timeout: wallBudget(6500)});
        const r = await page.evaluate(() => window.__bwApiWords.samples);
        // The rest after the degrees: the longest run of samples slower than 1 °/s with the shaft past 300°.
        let best = {ms: 0, angle: null};
        let from = null;
        for (const [t, a, v] of r) {
            if (Math.abs(v) < 1 && a > 300 && a < 420) {
                if (from === null) from = [t, a];
                if (t - from[0] > best.ms) best = {ms: t - from[0], angle: a};
            } else from = null;
        }
        const final = r[r.length - 1];
        out.words = {restMs: best.ms, restAngle: best.angle, final: final[1], finalSpeed: final[2], samples: r.length};
        assert.ok(best.ms >= 800, `the motor rested through the one-second wait: ${JSON.stringify(out.words)}`);
        assert.ok(Math.abs(best.angle - 360) <= DEGREES_TOLERANCE, `it rested at ${best.angle}° after run for 360 degrees`);
        // Then 2 s at 90 °/s (ramped at 1500 °/s²): about 180° more, and braked to rest.
        assert.ok(final[1] - best.angle > 150 && final[1] - best.angle < 200, `ran on ${final[1] - best.angle}° at 90 °/s for 2 s`);
        assert.ok(Math.abs(final[2]) < 1, `braked: ${final[2]} °/s`);
        await page.close();
    }
    return out;
};
