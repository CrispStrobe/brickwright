// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Browser gates for the two Q5 promotions (#1683) that had none, Evenhand and RimRun, for the R1 promotion
// Obliquity Orrery (obliquity-tilt-v1, its crank-A disconnection as the control) and for the R2 judge family
// (Cadence, Equinox, Helios, Orion; sim-lab-r2-judges.mjs), R3 Apex and R4 Tempest; each runs the model's own
// law through the real GUI with the qualification registry's judge and thresholds
// (scripts/lib/robot-lab-qualification.mjs, docs/data/robot-lab-qualification.json), its causal control, then the
// checks the nine-intake gate runs: bounded manual control, connected instructions and placement BOM, LDR/MPD
// import, the saved project replayed in a fresh context, and the EN/DE lessons.
//
// The judges are called in their browser mode (native:false), as every browser gate calls its judge: that mode
// relaxes only the minimum track length the native runner records (a browser frame is one accepted worker batch,
// not one fixed step). Every law threshold, gate and control is the registry's own and is not changed here.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {mechanicsInteractions, manualMechanicsInteractions} from './sim-lab-mechanics-gate.mjs';
import {captureRenderedModel, captureUiScreenshot} from './sim-lab-rendered-model-gate.mjs';
import {intakeRoundtrip, projectProgramReady} from './sim-lab-intake-roundtrip.mjs';
import {installBrowserMechanicsRecorder} from './sim-lab-browser-recorder.mjs';
import {openFile} from './sim-lab-scale-gate.mjs';
import {qualificationContracts, QUALIFICATION_JUDGES, disconnectedSource} from './robot-lab-qualification.mjs';
import {p6DisconnectionLoss} from './sim-lab-p6-judges.mjs';
import {obliquityDisconnectionLoss} from './sim-lab-obliquity-judge.mjs';
import {r2DisconnectionLoss} from './sim-lab-r2-judges.mjs';
import {r3DisconnectionLoss} from './sim-lab-r3-judges.mjs';
import {r4DisconnectionLoss} from './sim-lab-r4-judges.mjs';
import {Q5_HELD, heldQ5Contract, heldUsesR4Control, runHeldQ5Checks, assertHeldManualCoverage, withHeldPageErrors, finishHeldCleanup, heldErrorDetails, heldRuntimeSnapshot, heldStartupFailureSnapshot, assertHeldPrivateDirectory, heldModelSource, heldStartupDiagnostic} from './sim-lab-q5-held.mjs';
export {Q5_HELD} from './sim-lab-q5-held.mjs';

export const R2_BROWSER_MODELS = Object.freeze(['cadence-geneva', 'helios-transmission', 'orion-cardan']);
// Cadence's program sweeps 4320° at 30°/s (about 2.7 min per run); the law run, the disconnected run and the
// fresh-context replay together exceed the 8-minute step cap, so its disconnected control is its own gate step
// (`--examples=cadence-geneva-disconnected`, same shard), with the same assertions.
// R3 (2026-11-12): only Apex qualified in the browser. Vesper (law 0.504 mm vs its 0.5 mm bound) and Aster (a hinge
// open 0.55 mm vs its 0.5 mm closure bound at 800°/s) stay experimental; their judges stay registered.
export const R3_BROWSER_MODELS = Object.freeze(['apex']);
// R4: Tempest uses motor-to-carrier pin removal; Solstice stays experimental.
export const R4_BROWSER_MODELS = Object.freeze(['tempest-pendulum']);
export const SEPARATE_CONTROL = Object.freeze(['cadence-geneva']);
export const Q5_BROWSER_MODELS = Object.freeze(['evenhand', 'rimrun', 'obliquity-orrery', ...R2_BROWSER_MODELS, ...R3_BROWSER_MODELS, ...R4_BROWSER_MODELS]);
/** The registry's disconnection-loss measure of an R2 or R3 model. */
const familyLoss = (id, r) => ((R4_BROWSER_MODELS.includes(id) || heldUsesR4Control(id)) ? r4DisconnectionLoss : R3_BROWSER_MODELS.includes(id) ? r3DisconnectionLoss : r2DisconnectionLoss)(id, r);
// One browser frame is one accepted worker batch. With the program clock installed, each VM step (1/30 s)
// advances the world, so a frame spans 30 or 35 ms (whole 5 ms steps) at any speed setting; 1× is used.
export const GATE_SPEED = 1;
const contractOf = id => qualificationContracts([id])[0];

// RimRun fits each roller's acceleration over the ~0.3 s between the gate's open hold and the catches. Browser
// frames are whole worker batches (30 or 35 ms), 8 frames in that window; the native runner samples every
// contract.frameMs (20 ms). The rollers cross a tile joint inside the window (Jolt's internal-edge contact
// between abutting 320 LDU tiles slows them briefly, natively too), and 8 coarse frames weigh that bump enough
// to pull the fit 6.5 % low. So the gate takes the rollers', frame's and catch sliders' poses at every physics
// step and judges them on the registry's own frameMs grid, as the native runner does.
export const STEP_PARTS = Object.freeze({rimrun: ['left_wheel_-1', 'right_wheel_-1', 'hub']});

/** The record on the contract's frameMs grid, from the per-step samples; batch frames supply program state. */
export function onFrameGrid(record, frameMs) {
    const samples = record.stepSamples;
    assert.ok(Array.isArray(samples) && samples.length > 0 && !record.stepGap, 'complete per-step observations');
    const t0 = record.track[0].t, track = [record.track[0]];
    for (const x of samples) {
        if (x.tMs <= t0 || Math.abs(((x.tMs - t0) / frameMs) - Math.round((x.tMs - t0) / frameMs)) > 1e-6) continue;
        const batch = record.track[x.phaseFrom];
        assert.ok(batch && batch.t >= x.tMs - 1e-6, 'each step sample lies inside its accepted batch');
        assert.ok(x.bodies.every(b => b.position && b.rotation) && x.joints.every(j => Number.isFinite(j.coordinate)), 'finite step sample');
        // Contacts are known at batch ends only: a step sample counts a pair in contact if either bracketing
        // batch end saw it, so a judge that waits for separation never admits a step early.
        const before = record.track[x.phaseFrom - 1], pairs = new Map();
        for (const pair of [...(before?.contacts || []), ...(batch.contacts || [])]) pairs.set(pair.join('|'), pair);
        track.push({...batch, t: x.tMs, ...(batch.contacts ? {contacts: [...pairs.values()]} : {}), bodies: Object.fromEntries(x.bodies.map(b => [b.id, {position: b.position, rotation: b.rotation}])),
            joints: Object.fromEntries(x.joints.map(j => [j.id, {position: j.coordinate}]))});
    }
    assert.ok(track.length > 0.9 * (record.track.at(-1).t - t0) / frameMs, 'the grid covers the run');
    // The final batch frame keeps the after-run state the judge reads (variables, held modes).
    const last = record.track.at(-1);
    if (track.at(-1).t < last.t) track.push({...last, bodies: Object.fromEntries(Object.keys(track.at(-1).bodies).map(id => [id, last.bodies[id]])),
        joints: Object.fromEntries(Object.keys(track.at(-1).joints).map(id => [id, last.joints[id]]))});
    return {...record, track, stepSamples: undefined};
}

/** The registry judge for `id`, plus the registry's post-run hold: every contract port held, none busy. */
export function judgeQ5Browser(id, record, contract = contractOf(id)) {
    const judged = STEP_PARTS[id] ? onFrameGrid(record, contract.frameMs) : record;
    const result = QUALIFICATION_JUDGES[contract.judge](judged, {contract});
    const last = record.track.at(-1);
    for (const port of contract.ports) {
        assert.equal(last.busy[port], false, `${id}: port ${port} finished`);
        assert.equal(last.extra.modes[port], 'hold', `${id}: port ${port} held`);
    }
    return result;
}

const runLoaded = async (page, {timeout, afterMs, observeDynamics, speed = GATE_SPEED}) => {
    await page.evaluate(installBrowserMechanicsRecorder, {recordKey: '__bwQ5', captureKey: '__bwCaptureQ5',
        extended: true, observeProgram: true, observeDynamics});
    await page.getByTestId('bw-sim-lab-speed').selectOption(String(speed));
    await page.getByTestId('bw-sim-lab-run').click();
    await page.waitForFunction(holdMs => {
        const pane = window.__bwSimLab?._pane, r = window.__bwQ5;
        return pane?.session && Number.isFinite(r.finishedAt) && pane.session.time - r.finishedAt >= holdMs;
    }, afterMs, {timeout});
    await page.evaluate(() => window.__bwCaptureQ5());
    const r = await page.evaluate(() => window.__bwQ5);
    if (await page.getByTestId('bw-sim-lab-pause').isVisible()) {
        await page.getByTestId('bw-sim-lab-pause').click();
        await page.waitForFunction(() => window.__bwSimLab.status === 'paused');
    }
    return r;
};

const openExample = async (page, {openSimLab}, key) => {
    await openSimLab(page, {program: null});
    await page.getByTestId('bw-sim-lab-examples').click();
    const gallery = page.getByTestId('bw-sim-examples');
    await gallery.getByRole('checkbox', {name: /Include experimental/}).check();
    await gallery.getByRole('searchbox').fill(key.replace(/\.ldr$/, ''));
    const card = gallery.locator(`[data-model="${key}"]`);
    assert.equal(await card.count(), 1, `${key}: one gallery card`);
    await card.getByRole('button', {name: /^Open model \+ program:/}).click();
    await gallery.waitFor({state: 'hidden'});
    await page.waitForFunction(file => window.__bwSimLab.status === 'ready' && window.__bwSimLab._pane.state.modelFile === file &&
        window.__bwSimLab._pane.session?.worker, key, {timeout: 60000});
};

// Evenhand's disconnected control: the registry's own part removal (the inner counterweight pin), loaded as an
// LDraw file under the same example program. The arm still runs its poses, the elbow carries a gravity load
// again (p6DisconnectionLoss), and the registry judge refuses the run.
async function evenhandDisconnected(browser, opts, c) {
    const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'}), errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('dialog', d => d.accept());
    try {
        await openExample(page, opts, 'evenhand.ldr');
        const program = await page.evaluate(projectProgramReady);
        assert.ok(program.some(t => t.operations.length), 'the example program is loaded');
        const source = readFileSync('overlay/scratch-gui/static/sim-lab/models/evenhand.ldr', 'utf8');
        const cut = disconnectedSource(source, c.disconnect);
        await openFile(page, {name: 'evenhand-disconnected.ldr', buffer: Buffer.from(cut)});
        assert.equal(await page.evaluate(() => window.__bwSimLab.status), 'ready');
        assert.deepEqual(await page.evaluate(projectProgramReady), program, 'the same program drives the disconnected arm');
        const parts = await page.evaluate(() => window.__bwSimLab._pane.session.model.parts.map(p => p.id));
        for (const id of c.disconnect) assert.ok(!parts.includes(id), `${id} removed`);
        const r = await runLoaded(page, {...opts, afterMs: c.afterMs, observeDynamics: true});
        writeFileSync(resolve(opts.shotsDir, 'evenhand-disconnected-track.json'), JSON.stringify(r));
        const input = r.mechanism.joints.find(j => j.motor?.port === c.ports[0]);
        const travel = Math.max(...r.track.map(f => Math.abs(f.joints[input.id].angle))) * 180 / Math.PI;
        assert.ok(travel > c.disconnectInputDeg, `input genuinely still turns: ${travel}°`);
        const loss = p6DisconnectionLoss('evenhand', r);
        assert.ok(loss.lost, 'disconnection loses the law: ' + JSON.stringify(loss));
        assert.throws(() => judgeQ5Browser('evenhand', r, c), 'the registry judge refuses the disconnected arm');
        await captureRenderedModel(page, resolve(opts.shotsDir, 'evenhand-disconnected.png'));
        assert.deepEqual(errors, []);
        console.log(`PASS evenhand disconnected control: inner counterweight pin removed, input ${travel.toFixed(1)}°, ${JSON.stringify(loss)}, judge refuses`);
        return {inputTravelDeg: travel, loss};
    } finally { await page.close(); }
}

// Obliquity Orrery's disconnected control (R1): the registry's own part removal (crank_pin_A, crank A's coupler pin),
// loaded as an LDraw file under the same example program. Motor A still sweeps every station, the Earth no longer
// orbits, δ no longer follows the law at the encoder's orbit position (obliquityDisconnectionLoss), and the registry
// judge refuses the run.
async function orreryDisconnected(browser, opts, c) {
    const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'}), errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('dialog', d => d.accept());
    try {
        await openExample(page, opts, 'obliquity-orrery.ldr');
        const program = await page.evaluate(projectProgramReady);
        assert.ok(program.some(t => t.operations.length), 'the example program is loaded');
        const source = readFileSync('overlay/scratch-gui/static/sim-lab/models/obliquity-orrery.ldr', 'utf8');
        const cut = disconnectedSource(source, c.disconnect);
        await openFile(page, {name: 'obliquity-orrery-disconnected.ldr', buffer: Buffer.from(cut)});
        assert.equal(await page.evaluate(() => window.__bwSimLab.status), 'ready');
        assert.deepEqual(await page.evaluate(projectProgramReady), program, 'the same program drives the disconnected orrery');
        const parts = await page.evaluate(() => window.__bwSimLab._pane.session.model.parts.map(p => p.id));
        for (const id of c.disconnect) assert.ok(!parts.includes(id), `${id} removed`);
        const r = await runLoaded(page, {...opts, afterMs: c.afterMs, observeDynamics: false});
        writeFileSync(resolve(opts.shotsDir, 'obliquity-orrery-disconnected-track.json'), JSON.stringify(r));
        const input = r.mechanism.joints.find(j => j.motor?.port === c.ports[0]);
        const travel = Math.max(...r.track.map(f => Math.abs(f.joints[input.id].angle))) * 180 / Math.PI;
        assert.ok(travel > c.disconnectInputDeg, `input genuinely still turns: ${travel}°`);
        const loss = obliquityDisconnectionLoss(r);
        assert.ok(loss.lost, 'disconnection loses the law: ' + JSON.stringify(loss));
        assert.throws(() => judgeQ5Browser('obliquity-orrery', r, c), 'the registry judge refuses the disconnected orrery');
        await captureRenderedModel(page, resolve(opts.shotsDir, 'obliquity-orrery-disconnected.png'));
        assert.deepEqual(errors, []);
        console.log(`PASS obliquity-orrery disconnected control: crank A's coupler pin removed, input ${travel.toFixed(1)}°, ${JSON.stringify(loss)}, judge refuses`);
        return {inputTravelDeg: travel, loss};
    } finally { await page.close(); }
}

// The R2, R3 and R4 controls remove each registry's own parts and require the law to be lost.
async function r2Disconnected(browser, opts, c, id) {
    const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'}), errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('dialog', d => d.accept());
    let primary, hasPrimary = false;
    try {
        await openExample(page, opts, id + '.ldr');
        const program = await page.evaluate(projectProgramReady);
        assert.ok(program.some(t => t.operations.length), 'the example program is loaded');
        const source = heldUsesR4Control(id) ? heldModelSource(id) : readFileSync('overlay/scratch-gui/static/sim-lab/models/' + id + '.ldr', 'utf8');
        const cut = disconnectedSource(source, c.disconnect);
        await openFile(page, {name: id + '-disconnected.ldr', buffer: Buffer.from(cut)});
        assert.equal(await page.evaluate(() => window.__bwSimLab.status), 'ready');
        assert.deepEqual(await page.evaluate(projectProgramReady), program, 'the same program drives the disconnected model');
        const parts = await page.evaluate(() => window.__bwSimLab._pane.session.model.parts.map(p => p.id));
        for (const part of c.disconnect) assert.ok(!parts.includes(part), `${part} removed`);
        const r = await runLoaded(page, {...opts, afterMs: c.afterMs, observeDynamics: false});
        writeFileSync(resolve(opts.shotsDir, id + '-disconnected-track.json'), JSON.stringify(r));
        const input = r.mechanism.joints.find(j => j.motor?.port === c.ports[0]);
        const travel = Math.max(...r.track.map(f => Math.abs(f.joints[input.id].angle))) * 180 / Math.PI;
        assert.ok(travel > c.disconnectInputDeg, `input genuinely still turns: ${travel}°`);
        const loss = familyLoss(id, r);
        assert.ok(loss.lost, 'disconnection loses the law: ' + JSON.stringify(loss));
        assert.throws(() => judgeQ5Browser(id, r, c), `the registry judge refuses the disconnected ${id}`);
        await captureRenderedModel(page, resolve(opts.shotsDir, id + '-disconnected.png'));
        assert.deepEqual(errors, []);
        console.log(`PASS ${id} disconnected control: ${c.disconnect.join(', ')} removed, input ${travel.toFixed(1)}°, ${JSON.stringify(loss)}, judge refuses`);
        return {inputTravelDeg: travel, loss};
    } catch (error) {
        primary = error;
        hasPrimary = true;
        throw error;
    } finally {
        if (heldUsesR4Control(id)) await finishHeldCleanup(primary, [
            async () => writeFileSync(resolve(opts.shotsDir, id + '-disconnected-runtime.json'), JSON.stringify(await page.evaluate(heldRuntimeSnapshot), null, 2) + '\n'),
            () => writeFileSync(resolve(opts.shotsDir, id + '-disconnected-page-errors.json'), JSON.stringify(errors, null, 2) + '\n'),
            () => page.close()
        ], hasPrimary);
        else await page.close();
    }
}

/** The disconnected control of a SEPARATE_CONTROL model, run as its own gate step. */
export async function q5SeparateControl(page, opts, id) {
    assert.ok(SEPARATE_CONTROL.includes(id), 'a model whose control is a separate step');
    mkdirSync(opts.shotsDir, {recursive: true});
    const control = await r2Disconnected(page.context().browser(), opts, contractOf(id), id);
    writeFileSync(resolve(opts.shotsDir, id + '-q5-control.json'), JSON.stringify({id, control}, null, 2) + '\n');
    return control;
}

// RimRun's causal control: the shipped rimrun-swapped scene (ballast layouts exchanged between lanes) under the
// same program and the same judge. The judge passes and the inner-ballast roller leads in the other lane.
async function rimrunSwapped(browser, opts, c, main) {
    const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'}), errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('dialog', d => d.accept());
    try {
        const results = await mechanicsInteractions(page, {...opts, models: ['rimrun-swapped'], includeExperimental: true,
            judge: (id, r) => judgeQ5Browser('rimrun', r, c), captureModel: captureRenderedModel, extendedObservations: true,
            observeProgram: true, completionHoldMsFor: () => c.afterMs, speed: GATE_SPEED, stepParts: STEP_PARTS.rimrun});
        const swapped = results['rimrun-swapped'];
        assert.equal(main.innerLane, 'left', 'the supplied scene carries the inner ballast on the left');
        assert.equal(swapped.innerLane, 'right', 'the inner ballast is in the other lane');
        for (const x of [main, swapped]) assert.ok(x.leadMm >= 5, `lead ${x.leadMm} mm`);
        assert.deepEqual(errors, []);
        console.log(`PASS rimrun-swapped causal control: lead moves with the ballast ${JSON.stringify({main: {innerLane: main.innerLane, ratio: main.ratio, leadMm: main.leadMm}, swapped: {innerLane: swapped.innerLane, ratio: swapped.ratio, leadMm: swapped.leadMm}})}`);
        return swapped;
    } finally { await page.close(); }
}

export async function q5BrowserInteractions(page, opts, id) {
    assert.ok(Q5_BROWSER_MODELS.includes(id) || Object.hasOwn(Q5_HELD, id), 'a Q5 browser model');
    const held = Object.hasOwn(Q5_HELD, id);
    const c = held ? heldQ5Contract(id) : contractOf(id), observeDynamics = Boolean(c.observeDynamics);
    if (held) {
        // All held outputs, including screenshots and generic helper files, live
        // under a newly created exclusive directory; never overwrite a prior run.
        assertHeldPrivateDirectory(dirname(opts.shotsDir));
        mkdirSync(opts.shotsDir, {mode: 0o700});
    } else mkdirSync(opts.shotsDir, {recursive: true});
    if (held && opts.heldIdentity) writeFileSync(resolve(opts.shotsDir, id + '-identity.json'), JSON.stringify(opts.heldIdentity, null, 2) + '\n');
    const measureMain = async () => (await mechanicsInteractions(page, {
        ...opts, ...(held ? {includeExperimental: true} : {}), models: [id],
        startupDiagnosticFor: held ? (loadedPage, loadedId) => loadedPage.evaluate(heldStartupDiagnostic, loadedId) : null,
        judge: (_, r) => judgeQ5Browser(id, r, c), captureModel: captureRenderedModel,
        extendedObservations: true, observeDynamics, stepParts: STEP_PARTS[id] ?? null, completionHoldMsFor: () => c.afterMs, speed: GATE_SPEED, observeProgram: true
    }))[id];
    const mainCheck = async () => {
        if (!held) return measureMain();
        let primary, hasPrimary = false;
        try { return await measureMain(); }
        catch (error) { primary = error; hasPrimary = true; throw error; }
        finally { await finishHeldCleanup(primary, [
            ...(hasPrimary ? [async () => writeFileSync(resolve(opts.shotsDir, id + '-base-startup-partial.json'), JSON.stringify(await page.evaluate(heldStartupFailureSnapshot), null, 2) + '\n')] : []),
            async () => writeFileSync(resolve(opts.shotsDir, id + '-base-runtime.json'), JSON.stringify(await page.evaluate(heldRuntimeSnapshot), null, 2) + '\n'),
            async () => {
                if (await page.evaluate(() => window.__bwSimLab?.status) === 'running') {
                    await page.getByTestId('bw-sim-lab-pause').click();
                    await page.waitForFunction(() => window.__bwSimLab.status === 'paused');
                }
            }
        ], hasPrimary); }
    };
    const controlCheck = main => id === 'evenhand' ? evenhandDisconnected(page.context().browser(), opts, c)
        : id === 'obliquity-orrery' ? orreryDisconnected(page.context().browser(), opts, c)
        : SEPARATE_CONTROL.includes(id) ? {separateStep: id + '-disconnected'}
        : heldUsesR4Control(id) || [...R2_BROWSER_MODELS, ...R3_BROWSER_MODELS, ...R4_BROWSER_MODELS].includes(id) ? r2Disconnected(page.context().browser(), opts, c, id)
        : rimrunSwapped(page.context().browser(), opts, c, main);
    const checkDownstream = async () => {
    let main, control;
    if (held) {
        try {
            ({main, control} = await runHeldQ5Checks(mainCheck, () => controlCheck(), c));
        } catch (error) {
            await finishHeldCleanup(error, [() => writeFileSync(resolve(opts.shotsDir, id + '-held-failure.json'), JSON.stringify({
                message: error.message,
                failures: (error.errors || [error]).map(heldErrorDetails),
                observations: error.observations
            }, null, 2) + '\n')], true);
            throw error;
        }
    } else { main = await mainCheck(); control = await controlCheck(main); }
    const manual = await manualMechanicsInteractions(page, {...opts, models: [id], captureModel: captureRenderedModel});
    if (held) assertHeldManualCoverage(id, manual, c);
    await page.getByTestId('bw-sim-lab-instructions').click();
    await page.waitForFunction(() => window.__bwSimLabInstructions?.status === 'ready', null, {timeout: 120000});
    const plan = await page.evaluate(() => window.__bwSimLabInstructions.plan);
    const parts = plan.steps.flatMap(s => s.parts);
    assert.equal(parts.length, c.parts, `${id}: every placement in the instructions`);
    assert.equal(new Set(parts).size, c.parts, `${id}: each placement once`);
    assert.ok(plan.steps.every(s => !s.loose && s.parts.length >= 1 && s.parts.length <= 6), `${id}: connected steps of 1–6 parts`);
    await page.keyboard.press('End');
    await page.waitForFunction(() => window.__bwSimLabInstructions.page === window.__bwSimLabInstructions.steps);
    assert.equal(await page.getByTestId('bw-sim-instructions-bom').getByTestId('bw-sim-instructions-part')
        .evaluateAll(es => es.reduce((n, e) => n + Number(e.dataset.count), 0)), c.parts, `${id}: placement BOM`);
    await captureUiScreenshot(page, {path: resolve(opts.shotsDir, id + '-bom.png')}, page.getByTestId('bw-sim-instructions'));
    await page.keyboard.press('Escape');
    await intakeRoundtrip(page, {...opts, ...(held ? {retainPageErrors: true, modelSourceFor: heldModelSource} : {}), extendedObservations: true, observeDynamics, afterMs: c.afterMs, replaySpeed: GATE_SPEED, stepParts: STEP_PARTS[id] ?? null}, id,
        (_, r) => judgeQ5Browser(id, r, c));
    writeFileSync(resolve(opts.shotsDir, id + '-q5-browser.json'), JSON.stringify({id, judge: c.judge, main, control, manual,
        instructions: {steps: plan.steps.length, parts: parts.length}}, null, 2) + '\n');
    };
    if (held) await withHeldPageErrors(page,
        errors => writeFileSync(resolve(opts.shotsDir, id + '-main-page-errors.json'), JSON.stringify(errors, null, 2) + '\n'), async () => {
            let primary, hasPrimary = false;
            try { return await checkDownstream(); }
            catch (error) { primary = error; hasPrimary = true; throw error; }
            finally { await finishHeldCleanup(primary, [async () => writeFileSync(
                resolve(opts.shotsDir, id + '-main-runtime.json'), JSON.stringify(await page.evaluate(heldRuntimeSnapshot), null, 2) + '\n')], hasPrimary); }
        });
    else await checkDownstream();
    console.log(`${held ? 'OBSERVATION ONLY (no producer/source qualification)' : 'PASS'} ${id}: registry law (${c.judge}), ${id === 'rimrun' ? 'rimrun-swapped' : 'disconnected'} control, bounded manual control, connected instructions, placement BOM, LDR/MPD and fresh saved-project replay`);
}
