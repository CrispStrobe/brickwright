import {openManualControls} from './sim-lab-manual-controls.mjs';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {installBrowserMechanicsRecorder} from './sim-lab-browser-recorder.mjs';
import {judgeMechanicsRun} from './sim-lab-mechanics-judge.mjs';
import JSZip from 'jszip';
import {exportedProject} from './sim-lab-integral-gate.mjs';

const DEFAULT_MACHINES = ['crank-rocker', 'parallel-lift', 'screw-crane', 'pivot-rover'];
const PROGRAM_MACHINES = [...DEFAULT_MACHINES, 'crane'];
// Export through the real GUI and reopen in a fresh context. This checks the
// saved crane definition, separately from the completed motion qualification.
const craneProjectRoundtrip = async (page, {openSimLab, shotsDir}) => {
    await page.getByTestId('bw-sim-lab-reset').click();
    await page.waitForFunction(() => window.__bwSimLab.status === 'ready');
    const before = await page.evaluate(() => window.__bwSimLab.projectRecord);
    assert.match(before.ldraw, /!BW ROPE hoistCord/);
    const project = resolve(shotsDir, 'crane-roundtrip.sb3');
    await page.getByText('File', {exact: true}).first().click();
    await exportedProject(page, project);
    const bytes = readFileSync(project);
    assert.ok(bytes.length > 0 && bytes.length <= 8 * 1024 * 1024, 'bounded saved crane project');
    const zip = await JSZip.loadAsync(bytes, {checkCRC32: true});
    const sidecar = zip.file('brickwright/state.json');
    assert.ok(sidecar, 'saved crane has its actual sidecar');
    const text = await sidecar.async('text');
    assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
    assert.deepEqual(JSON.parse(text).state.simLab, before, 'exported bytes preserve the rope model');
    const reopened = await page.context().browser().newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
    const errors = [];
    reopened.on('pageerror', e => errors.push(e.message));
    reopened.on('dialog', d => d.accept());
    try {
        await openSimLab(reopened, {program: null});
        await reopened.getByText('File', {exact: true}).first().click();
        await reopened.getByText('Load from your computer', {exact: true}).click();
        await reopened.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles(project);
        await reopened.getByRole('tab', {name: /^(Robots|Robot Lab)$/}).click();
        await reopened.waitForFunction(() => window.__bwSimLab?.status === 'ready' &&
            window.__bwSimLab._pane.session?.mechanism.couplings.some(c => c.kind === 'rope'));
        assert.deepEqual(await reopened.evaluate(() => window.__bwSimLab.projectRecord), before);
        const restored = await reopened.evaluate(() => {
            const m = window.__bwSimLab._pane.session.mechanism;
            return {ports: m.actuators.map(a => a.port).sort(), ropes: m.couplings.filter(c => c.kind === 'rope')};
        });
        assert.deepEqual(restored.ports, ['A', 'B', 'C']);
        assert.equal(restored.ropes.length, 1);
        assert.deepEqual(restored.ropes[0].parts, ['hoistDrum', 'tipGuide', 'hookLink']);
        assert.equal(restored.ropes[0].radiusM, 0.0028);
        assert.deepEqual(errors, []);
        console.log('PASS crane actual GUI save/CRC-sidecar/fresh-context reopen: rope and three motors preserved');
    } finally { await reopened.close(); }
};
export const mechanicsInteractions = async (page, {openSimLab, shotsDir, timeout,
    models = PROGRAM_MACHINES, judge = judgeMechanicsRun, simulatedMs = 18000,
    simulatedMsFor = () => simulatedMs, completeWhenPausedFor = () => false, completionHoldMsFor = () => null,
    fileFor = id => `${id}.ldr`, keyFor = id => fileFor(id), programMarker = null, speed = 1, observeProgram = false, captureModel = null, extendedObservations = false, observeDynamics = false, stepParts = null, includeExperimental = false, startupDiagnosticFor = null}) => {
    mkdirSync(shotsDir, {recursive: true});
    await openSimLab(page, {program: null});
    const results = {};
    for (const id of models) {
        await page.getByTestId('bw-sim-lab-examples').click();
        const gallery = page.getByTestId('bw-sim-examples');
        // Intake candidates remain explicitly experimental until qualification.
        // Exercise the real gallery control rather than altering the registry.
        if (includeExperimental) await gallery.getByRole('checkbox', {name: /Include experimental/}).check();
        await gallery.getByRole('searchbox').fill(id);
        const card = gallery.locator(`[data-model="${keyFor(id)}"]`);
        assert.equal(await card.count(), 1);
        await card.getByRole('button', {name: /^Open model \+ program:/}).click();
        try { await gallery.waitFor({state: 'hidden'}); }
        catch (error) {
            const state = await page.evaluate(() => {
                const p = window.__bwSimLab?._pane;
                return {status: window.__bwSimLab?.status, pane: p ? {status:p.state.status, message:p.state.message,
                    info:p.state.info, modelFile:p.state.modelFile, shipped:p.state.shipped,
                    programLoading:p.state.programLoading, view3d:p.state.view3d} : null,
                    gallery:document.querySelector('[data-testid="bw-sim-examples"]')?.innerText,
                    resources:performance.getEntriesByType('resource').filter(e=>/sim-lab|ldraw|worker/.test(e.name)).slice(-30).map(e=>({name:e.name,duration:e.duration,responseEnd:e.responseEnd}))};
            });
            writeFileSync(resolve(shotsDir, id+'-gallery-failure.json'),JSON.stringify(state,null,2)+'\n');
            await page.screenshot({path:resolve(shotsDir,id+'-gallery-failure.png')}).catch(()=>{});
            throw error;
        }
        await page.waitForFunction(({file, key}) => window.__bwSimLab.status === 'ready' &&
            window.__bwSimLab._pane.state.modelFile === file && window.__bwSimLab._pane.state.shipped === key &&
            window.__bwSimLab._pane.session?.worker, {file: fileFor(id), key: keyFor(id)}, {timeout: 60000});
        if (programMarker) await page.waitForFunction(marker => [...document.querySelectorAll('.cm-content')].some(el =>
            el.textContent.includes(marker)), programMarker(id), {timeout: 30000});
        await page.getByTestId('bw-sim-lab-3d-canvas').waitFor();
        await (captureModel ? captureModel(page,resolve(shotsDir, `${id}.png`)) : page.screenshot({path: resolve(shotsDir, `${id}.png`)}));
        const startupDiagnostic = startupDiagnosticFor ? await startupDiagnosticFor(page, id) : null;
        await page.evaluate(installBrowserMechanicsRecorder,{recordKey:'__bwMechanics',captureKey:'__bwCaptureMechanics',extended:extendedObservations,observeProgram,observeDynamics,stepParts,
            ...(startupDiagnostic ? {startupDiagnostic} : {})});
        await page.getByTestId('bw-sim-lab-speed').selectOption(String(speed));
        await page.getByTestId('bw-sim-lab-run').click();
        const simulatedForThis = simulatedMsFor(id);
        // The pane briefly drops its session while a model or program reloads; a
        // predicate that dereferences it then fails the whole gate with a TypeError
        // instead of waiting for the next frame.
        await page.waitForFunction(({ms, paused, holdMs}) => {
            const pane=window.__bwSimLab?._pane;if(!pane?.session)return false;
            if(holdMs!==null)return Number.isFinite(window.__bwMechanics.finishedAt)&&pane.session.time-window.__bwMechanics.finishedAt>=holdMs;
            if(!paused)return pane.session.time-window.__bwMechanics.start>=ms;
            return pane.session.time-window.__bwMechanics.start>1000&&window.__bwSimLab.status==='paused'&&
                !pane.props.vm.runtime.threads.some(t=>t.status!==4);
        }, {ms:simulatedForThis,paused:completeWhenPausedFor(id),holdMs:completionHoldMsFor(id)}, {timeout});
        if(completeWhenPausedFor(id))await page.evaluate(()=>window.__bwCaptureMechanics());
        const r = await page.evaluate(() => window.__bwMechanics);
        if (observeProgram || id === 'crane') writeFileSync(resolve(shotsDir, id+'-actual-track.json'), JSON.stringify(r));
        results[id] = await judge(id, r);
        // Capture the measured final pose without racing a continuously redrawn
        // software WebGL surface. The next model selection starts a fresh run.
        if (await page.getByTestId('bw-sim-lab-pause').isVisible()) {
            await page.getByTestId('bw-sim-lab-pause').click();
            await page.waitForFunction(() => window.__bwSimLab.status === 'paused');
        }
        await openManualControls(page, {motors: true});
        const mixer = page.getByTestId('bw-sim-lab-mixer-toggle');
        if (await mixer.getAttribute('aria-expanded') !== 'true') await mixer.click();
        assert.deepEqual(await page.locator('[data-testid="bw-sim-lab-mixer-slider"], [data-testid="bw-sim-lab-mixer-jog"]').evaluateAll(es => es.map(e => e.dataset.port).sort()),
            r.mechanism.actuators.map(a => a.port).sort());
        for (const slider of await page.getByTestId('bw-sim-lab-mixer-slider').all()) assert.ok(await slider.isDisabled(), 'program control keeps manual sliders off');
        await (captureModel ? captureModel(page,resolve(shotsDir, `${id}-finished.png`)) : page.screenshot({path: resolve(shotsDir, `${id}-finished.png`)}));
        await mixer.click();
        if (id === 'crane') await craneProjectRoundtrip(page, {openSimLab, shotsDir});
        console.log(`PASS motorised mechanics ${id}: ${JSON.stringify(results[id])}`);
    }
    writeFileSync(resolve(shotsDir, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
    return results;
};

export const manualMechanicsInteractions = async (page, {openSimLab, shotsDir, models = DEFAULT_MACHINES, jogSign = () => 1, jogMs = 250, keyFor = id => `${id}.ldr`, captureModel = null, minimumJogRadians = .03}) => {
    mkdirSync(shotsDir, {recursive: true});
    await openSimLab(page, {program: null});
    const results = {};
    for (const id of models) {
        await page.getByTestId('bw-sim-lab-model').selectOption(keyFor(id));
        await page.waitForFunction(file => window.__bwSimLab.status === 'ready' &&
            window.__bwSimLab._pane.state.modelFile === file, `${id}.ldr`, {timeout: 60000});
        const framing = await page.evaluate(() => window.__bwSimLab._pane.view.framingStats());
        assert.ok(framing.corners.every(p => p.every(Number.isFinite) && Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1 && Math.abs(p[2]) <= 1),
            `${id}: initial camera includes the whole model: ${JSON.stringify(framing)}`);
        await openManualControls(page, {override: true});
        const toggle = page.getByTestId('bw-sim-lab-mixer-toggle');
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        await page.getByTestId('bw-sim-lab-mixer-stop-all').click();
        const sliders = page.getByTestId('bw-sim-lab-mixer-slider');
        const ports = await sliders.evaluateAll(es => es.map(e => e.dataset.port));
        const angle = port => page.evaluate(p => {
            const s = window.__bwSimLab._pane.session;
            return s.core.jointState(s.mechanism.actuators.find(a => a.port === p).joint).angle;
        }, port);
        const advance = (ms = 250) => page.evaluate(ms => new Promise(done => {
            const s = window.__bwSimLab._pane.session; const t = s.time;
            const off = s.onAdvance(() => { if (s.time - t >= ms) { off(); done(); } });
        }), ms);
        results[id] = {};
        for (const port of ports) {
            const slider = page.locator(`[data-testid="bw-sim-lab-mixer-slider"][data-port="${port}"]`);
            const before = await angle(port);
            await slider.focus();
            const sign = jogSign(id, port);
            await page.keyboard.press(sign < 0 ? 'ArrowLeft' : 'ArrowRight');
            assert.equal(await slider.inputValue(), String(sign * 5));
            await advance(jogMs);
            const delta = await angle(port) - before;
            assert.ok(Math.abs(delta) > 0.03, `${id} motor ${port} responds to its slider: ${delta}`);
            await page.locator(`[data-testid="bw-sim-lab-mixer-stop"][data-port="${port}"]`).click();
            assert.equal(await slider.inputValue(), '0');
            await advance();
            const stopped = await angle(port);
            await advance();
            assert.ok(Math.abs(await angle(port) - stopped) < 3 * Math.PI / 180,
                `${id}: motor ${port} holds after Stop`);
            results[id][port] = delta * 180 / Math.PI;
        }
        for (const control of await page.getByTestId('bw-sim-lab-mixer-jog').all()) {
            const port=await control.getAttribute('data-port'),before=await angle(port);
            const choices=control.locator('button[data-target]');
            let choice=null;
            for(const button of await choices.all())if(!await button.isDisabled()){choice=button;break;}
            assert.ok(choice,`${id}: at least one bounded jog is available`);
            const target=Number(await choice.getAttribute('data-target'));assert.ok(Number.isFinite(target));
            await choice.click();
            await page.waitForFunction(()=>window.__bwSimLab._pane.manualJogs.size===0,null,{timeout:15000});
            const after=await angle(port);assert.ok(Math.abs(after-before)>minimumJogRadians,`${id}: bounded ${port} actually moves`);
            assert.ok(Math.abs(after*180/Math.PI-target)<=2,`${id}: bounded ${port} reaches its requested target`);
            results[id][port]=(after-before)*180/Math.PI;
        }
        await page.getByTestId('bw-sim-lab-mixer-stop-all').click();
        assert.ok((await sliders.evaluateAll(es => es.map(e => e.value))).every(v => v === '0'));
        // Passive mechanisms may keep moving after their motor holds. As in the
        // program capture above, pause only after proving every manual response,
        // so WebKit captures a stable WebGL surface instead of racing its redraw.
        const fontState = await page.evaluate(() => ({status:document.fonts.status,
            faces:[...document.fonts].map(f=>({family:f.family,status:f.status}))}));
        if (await page.getByTestId('bw-sim-lab-pause').isVisible()) {
            await page.getByTestId('bw-sim-lab-pause').click();
            await page.waitForFunction(() => window.__bwSimLab.status === 'paused');
        }
        writeFileSync(resolve(shotsDir, `${id}-manual-capture-state.json`),JSON.stringify({before:fontState,
            after:await page.evaluate(()=>({fonts:document.fonts.status,simulation:window.__bwSimLab.status}))},null,2)+'\n');
        await (captureModel ? captureModel(page,resolve(shotsDir, `${id}-manual.png`)) : page.screenshot({path: resolve(shotsDir, `${id}-manual.png`)}));
        await toggle.click();
        console.log(`PASS manual motor controls ${id}: ${JSON.stringify(results[id])}`);
    }
    writeFileSync(resolve(shotsDir, 'manual-measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
    return results;
};
