#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Real host/portals, runner, circuit controls and portable project round trip.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {cardiacBrowserFixture} from './lib/cardiac-browser-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = flag => { const i = process.argv.indexOf(flag); return i < 0 ? null : process.argv[i + 1]; };
for (const flag of ['--deps', '--board', '--circuit']) assert.ok(option(flag), `Pass ${flag} with an explicit source/dependency directory.`);
const deps = path.resolve(root, option('--deps'));
const compilerDeps = path.resolve(root, option('--compiler-deps') || option('--deps'));
const board = path.resolve(root, option('--board')), circuit = path.resolve(root, option('--circuit'));
const example = path.resolve(root, option('--example') || 'overlay/scratch-gui/examples/cardiac-night-light/circuit.json');
const output = path.resolve(root, option('--out') || 'test-results/cardiac-browser');
await mkdir(output, {recursive: true});
const fixture = await cardiacBrowserFixture({root, deps, compilerDeps, board, circuit, example});
const errors = [], checks = [], compilerRequests = [];
let server, browser, page;
const program = 'ORG 01\nENTRY start\nstart: CLA value\nADD value\nSTO result\nOUT result\nHRS 00\nORG 80\nvalue: DAT 21\nresult: DAT 0\n';
const dirtySource = 'ORG 01\nCLA unfinished_label +\n; preserve this unfinished draft\n';

try {
    const compiled = {...fixture.config, build: {...fixture.config.build, outDir: path.join(output, 'compiled'), emptyOutDir: true,
        rollupOptions: {input: path.join(root, 'test/fixtures/cardiac-lab/index.html')}}};
    // Execute an immutable built fixture. Development dependency re-optimization
    // can reload React roots while a supplier is being edited in parallel.
    await fixture.build(compiled);
    if (process.argv.includes('--compile-only')) {
        console.log(JSON.stringify({status: 'compiled', react: fixture.react,
            scope: 'Fixture compilation only; no browser execution qualification'}));
    } else {
        server = await fixture.preview({...compiled, preview: {host: '127.0.0.1', port: 0}});
        const url = `http://127.0.0.1:${server.httpServer.address().port}`;
        browser = await fixture.chromium.launch({headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
            ...(option('--executable') ? {executablePath: path.resolve(option('--executable'))} : {})});
        page = await browser.newPage({viewport: {width: 1440, height: 1100}, acceptDownloads: true});
        page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(90000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(`${message.text()}${message.location().url ? ` @ ${message.location().url}` : ''}`);
        });
        await page.route('https://compiler.invalid/**', route => { compilerRequests.push(route.request().url()); return route.abort(); });
        await page.goto(url, {waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.__cardiacIntegration?.snapshot() && window.__cardiacIntegration.phase() === 'paused');
        const code = page.locator('[data-test-code-slot] [data-cardiac-editor]');
        const controller = page.locator('[data-test-controller-slot] [data-cardiac-controller]');
        await code.waitFor(); await controller.waitFor();
        assert.equal(await page.locator('[data-cardiac-host]').count(), 1);
        assert.equal(await page.getByTestId('cardiac-source').count(), 1);
        assert.equal(await controller.getByTestId('cardiac-ir').innerText(), '—', 'An unfetched instruction is not a fabricated 000');
        assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.identity()),
            {sameBoard: true, publishedBoard: true, oneMachine: true, react: fixture.react});
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.compilerCalls), 0);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bw-cardiac-workspace')).active), true);
        checks.push('One real CardiacHost owns Code and Controller portals and adopts the existing CircuitDesigner machine without compiling Scratch blocks');

        // Execute source and its explicit card deck through normal product controls.
        await code.getByLabel(/Example program/).selectOption('cardiac-echo');
        await controller.getByTestId('cardiac-input-deck').fill('42');
        await code.getByRole('button', {name: 'Run source + cards', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot()?.halted && window.__cardiacIntegration.snapshot().output.join(',') === '42');
        assert.equal(await controller.getByTestId('cardiac-output').innerText(), '042');
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().steps), 3);
        assert.equal(await controller.getByTestId('cardiac-acc').innerText(), '0000');
        checks.push('Assemble + queue + run executes echo42 and displays decimal output through the production runner');

        // Waiting cannot invent zero, retire INP, or spin a second clock.
        await controller.getByTestId('cardiac-input-deck').fill('');
        await code.getByRole('button', {name: 'Run source + cards', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot()?.waiting && window.__cardiacIntegration.phase() === 'paused');
        const waiting = await page.evaluate(() => ({state: window.__cardiacIntegration.snapshot(), time: window.__cardiacIntegration.time()}));
        assert.equal(waiting.state.steps, 0); assert.equal(waiting.state.pc, 1); assert.equal(waiting.state.ir, null);
        assert.deepEqual(waiting.state.output, []); assert.deepEqual(waiting.state.inputQueue, []);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.time()), waiting.time);
        await controller.getByTestId('cardiac-input-deck').fill('-7');
        await controller.getByRole('button', {name: 'Queue cards', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().inputQueue.join(',') === '-7');
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().steps), 0);
        await controller.getByRole('button', {name: 'Continue', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().halted);
        assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.snapshot().output), [-7]);
        checks.push('An empty reader waits at the unexecuted INP without a fake zero; an explicit negative card resumes correctly and pause freezes Board time');

        // These are the actual events sent by Brickwright's global run controls.
        const counting = 'ORG 01\nCLA value\nagain: ADD one\nSTO value\nJMP again\nORG 80\nvalue: DAT 0\none: DAT 1\nENTRY 01\n';
        await code.getByTestId('cardiac-source').fill(counting);
        await controller.getByTestId('cardiac-input-deck').fill('');
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-cardiac-run-request')));
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().steps >= 6 && window.__cardiacIntegration.snapshot().memory[1] === 180);
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-cardiac-stop-request')));
        await page.waitForFunction(() => window.__cardiacIntegration.phase() === 'paused');
        const globallyStopped = await page.evaluate(() => ({state: window.__cardiacIntegration.snapshot(), time: window.__cardiacIntegration.time()}));
        assert.ok(globallyStopped.state.memory[80] > 0); assert.equal(globallyStopped.state.halted, false);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(await page.evaluate(() => ({state: window.__cardiacIntegration.snapshot(), time: window.__cardiacIntegration.time()})), globallyStopped);
        checks.push('Real global CARDIAC run/stop request events assemble the current source and pause the shared clock without resetting live RAM');

        // Before-execution breakpoint followed by a learner's manual prediction.
        await code.getByTestId('cardiac-source').fill(program);
        await code.getByRole('button', {name: 'Assemble & load', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().memory[1] === 180 && window.__cardiacIntegration.snapshot().steps === 0);
        await controller.getByTestId('cardiac-cell-02').click();
        await controller.getByRole('button', {name: 'Toggle breakpoint', exact: true}).click();
        await controller.getByRole('button', {name: 'Continue', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().lastBreakpoint === 2);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().steps), 1);
        assert.equal(await controller.getByTestId('cardiac-acc').innerText(), '0021');
        await controller.getByLabel('Predicted next PC (00–99)', {exact: true}).fill('03');
        await controller.getByLabel('Predicted next accumulator (−9999…9999)', {exact: true}).fill('42');
        await controller.getByRole('button', {name: 'Step & compare', exact: true}).click();
        await controller.locator('[data-cardiac-prediction="correct"]').waitFor();
        assert.equal(await controller.getByTestId('cardiac-pc').innerText(), '03');
        assert.equal(await controller.getByTestId('cardiac-acc').innerText(), '0042');
        assert.match(await controller.locator('[data-cardiac-last-instruction]').innerText(), /ADD/);
        await controller.getByRole('button', {name: 'Continue', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().halted);
        assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.snapshot().output), [42]);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().memory[81]), 42);
        checks.push('A decimal memory breakpoint stops before ADD; Step & compare verifies PC03/ACC0042 and exposes the actual read/write trace');

        // A refused ordinary project load announces an outcome, not a restore.
        // Keep RAM, output and queued cards nonempty so a silent reset is visible.
        await controller.getByTestId('cardiac-input-deck').fill('123 -7');
        await controller.getByRole('button', {name: 'Queue cards', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().inputQueue.length === 2);
        const refusalBefore = await page.evaluate(() => ({snapshot: window.__cardiacIntegration.snapshot(),
            time: window.__cardiacIntegration.time(), workspace: localStorage.getItem('bw-cardiac-workspace'),
            vmLoads: window.__cardiacIntegration.vmProjectLoads}));
        for (const outcome of ['future', 'invalid']) {
            const zip = new JSZip();
            zip.file('project.json', JSON.stringify({targets: [{isStage: true, name: 'Stage', blocks: {}, costumes: [], sounds: []}]}));
            zip.file('brickwright/state.json', JSON.stringify({format: 'brickwright-state', version: outcome === 'future' ? 999 : 2,
                state: outcome === 'future' ? {} : {cardiac: {...JSON.parse(refusalBefore.workspace), profile: 'unsupported-test-profile'}}}));
            const refusal = await page.evaluate(bytes => window.__cardiacIntegration.tryProject(bytes),
                Array.from(await zip.generateAsync({type: 'uint8array'})));
            assert.equal(refusal.accepted, false);
            assert.equal(await page.evaluate(() => window.__cardiacIntegration.restore.outcome), outcome);
        }
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded', {detail: {outcome: 'storage-failed'}})));
        assert.deepEqual(await page.evaluate(() => ({snapshot: window.__cardiacIntegration.snapshot(),
            time: window.__cardiacIntegration.time(), workspace: localStorage.getItem('bw-cardiac-workspace'),
            vmLoads: window.__cardiacIntegration.vmProjectLoads})), refusalBefore);
        checks.push('Future/invalid archives through the real loader and a storage-failed announcement preserve live RAM, queue, output, clock and active workspace');

        // An invalid draft is deliberately portable independently of the loaded image.
        await code.getByTestId('cardiac-source').fill(dirtySource);
        await code.locator('[data-cardiac-dirty]').waitFor();
        assert.equal(await code.getByRole('button', {name: 'Run source + cards', exact: true}).isDisabled(), true);
        const savedDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('bw-cardiac-workspace')));
        assert.equal(savedDraft.source, dirtySource);
        assert.equal(savedDraft.active, true);
        assert.equal(savedDraft.loadedProgram.words.find(cell => cell.address === 81).value, 0);
        let downloadWait = page.waitForEvent('download');
        await code.getByRole('button', {name: 'Save workspace', exact: true}).click();
        let download = await downloadWait;
        const workspacePath = path.join(output, 'dirty-workspace.bwcardiac.json');
        await download.saveAs(workspacePath);
        assert.deepEqual(JSON.parse(await readFile(workspacePath, 'utf8')), savedDraft);
        await code.getByTestId('cardiac-source').fill(program);
        await code.getByLabel('Open source / workspace', {exact: true}).setInputFiles(workspacePath);
        await page.waitForFunction(source => document.querySelector('[data-testid="cardiac-source"]')?.value === source, dirtySource);
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().steps === 0);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().memory[81]), 0);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.phase()), 'paused');
        checks.push('Saving and reopening an unfinished workspace preserves the invalid draft and the independently loaded image, paused');

        // The ordinary .sb3 bundle carries authored program state, never CPU memory/trays.
        await controller.getByRole('button', {name: 'Continue', exact: true}).click();
        await page.waitForFunction(() => window.__cardiacIntegration.snapshot().halted);
        await page.waitForFunction(() => {
            const saved = JSON.parse(localStorage.getItem('bw-circuit-autosave'));
            return saved?.parts?.find(part => part.id === 'cardiac')?.params?.program?.words?.some(cell => cell.address === 1 && cell.value === 180);
        });
        downloadWait = page.waitForEvent('download');
        await page.getByRole('button', {name: 'Save fixture .sb3', exact: true}).click();
        download = await downloadWait;
        const archivePath = path.join(output, 'cardiac-browser-proof.sb3'); await download.saveAs(archivePath);
        const archive = await JSZip.loadAsync(await readFile(archivePath));
        const bundle = JSON.parse(await archive.file('brickwright/state.json').async('string'));
        assert.deepEqual(bundle.state.cardiac, savedDraft);
        assert.deepEqual(Object.keys(bundle.state.cardiac).sort(), ['active', 'format', 'inputDeck', 'inputMode', 'loadedProgram', 'profile', 'source', 'version']);
        assert.equal(bundle.state.cardiac.active, true);
        assert.deepEqual(bundle.state.circuit.parts.find(part => part.id === 'cardiac').params.program, savedDraft.loadedProgram);
        await page.screenshot({path: path.join(output, 'shared-lab-desktop.png'), fullPage: true});
        await page.evaluate(() => localStorage.clear()); await page.reload({waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.__cardiacIntegration?.phase() === 'paused');
        await page.getByLabel('Restore fixture .sb3', {exact: true}).setInputFiles(archivePath);
        await page.waitForFunction(() => window.__cardiacIntegration.restore?.outcome === 'loaded' && window.__cardiacIntegration.phase() === 'paused');
        await page.waitForFunction(source => document.querySelector('[data-testid="cardiac-source"]')?.value === source, dirtySource);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bw-cardiac-workspace'))), savedDraft);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().memory[81]), 0);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().steps), 0);
        assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.snapshot().inputQueue), []);
        assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.snapshot().output), []);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bw-cardiac-workspace')).active), true);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.vmProjectLoads), 1);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.identity().oneMachine), true);
        checks.push('The real .sb3 bundle/load path restores circuit + dirty source + initial image in a fresh browser without replaying live STO, outputs or execution');

        // Move the actual Wokwi potentiometer with keyboard input, then sample once.
        await code.getByLabel(/Example program/).selectOption('cardiac-night-light');
        await code.getByRole('button', {name: 'Assemble & load', exact: true}).click();
        await controller.getByLabel(/Input source/).selectOption('circuit');
        await page.getByRole('button', {name: 'Fit all parts', exact: true}).click();
        await page.getByRole('radio', {name: 'Sim mode', exact: true}).click();
        const knob = page.locator('[data-pot-control="light-level"] wokwi-potentiometer svg[role="slider"]');
        const emitted = [];
        for (const key of ['Home', 'End']) {
            await knob.scrollIntoViewIfNeeded(); await knob.click(); await page.keyboard.press(key);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
            assert.deepEqual(await page.evaluate(() => window.__cardiacIntegration.snapshot().inputQueue), []);
            const before = await page.evaluate(() => window.__cardiacIntegration.snapshot());
            await controller.getByRole('button', {name: 'Sample circuit once', exact: true}).click();
            await page.waitForFunction(() => window.__cardiacIntegration.snapshot().inputQueue.length === 1);
            const sampled = await page.evaluate(() => window.__cardiacIntegration.snapshot());
            assert.equal(sampled.steps, before.steps);
            assert.equal(sampled.inputQueue[0], Math.round(Math.max(0, Math.min(5, sampled.inputVoltage)) * 999 / 5));
            assert.deepEqual(sampled.inputSources, ['circuit']);
            const expected = sampled.inputQueue[0] < 500 ? 1 : 0;
            await controller.getByRole('button', {name: 'Continue', exact: true}).click();
            await page.waitForFunction(count => window.__cardiacIntegration.snapshot().waiting && window.__cardiacIntegration.snapshot().output.length === count,
                emitted.length + 1);
            emitted.push(expected);
            assert.equal(await page.evaluate(() => window.__cardiacIntegration.snapshot().lastOutput), expected);
            const observed = await page.evaluate(() => ({lit: window.__cardiacIntegration.led(), current: window.__cardiacIntegration.current()}));
            if (expected) { assert.ok(observed.lit > 0.05); assert.ok(Math.abs(observed.current) > 0.001); }
            else assert.ok(observed.lit < 0.001);
        }
        assert.deepEqual([...new Set(emitted)].sort(), [0, 1]);
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.identity().oneMachine), true);
        checks.push('Actual potentiometer Home/End events reach the solver; deliberate samples cross the 500 threshold and switch the real resistor/LED through the same CPU');
        await page.screenshot({path: path.join(output, 'night-light-desktop.png'), fullPage: true});

        // Exercise the native CARDIAC surfaces at a narrow width, in the longer
        // German translation. Circuit canvas responsiveness is separately owned.
        await page.setViewportSize({width: 390, height: 844});
        await page.evaluate(() => window.__cardiacIntegration.setLocale('de'));
        await controller.getByRole('button', {name: 'Schaltung einmal abtasten', exact: true}).waitFor();
        assert.equal(await controller.getByRole('button', {name: 'Fortsetzen', exact: true}).count(), 1);
        assert.equal(await controller.getByRole('button', {name: 'Ein Befehl', exact: true}).count(), 1);
        assert.equal(await code.getByLabel(/Beispielprogramm/).count(), 1);
        assert.equal(await controller.getByTestId('cardiac-pc').innerText(), '01');
        const narrow = await page.locator('[data-cardiac-editor], [data-cardiac-controller]').evaluateAll(panels => panels.map(panel => {
            const rect = panel.getBoundingClientRect();
            const clipped = [...panel.querySelectorAll('.registers span, button, input, select')]
                .filter(element => getComputedStyle(element).display !== 'inline' && element.getClientRects().length && element.scrollWidth > element.clientWidth + 1)
                .map(element => element.textContent.trim() || element.getAttribute('aria-label') || element.tagName);
            return {left: rect.left, right: rect.right, viewport: innerWidth, width: panel.clientWidth,
                scrollWidth: panel.scrollWidth, clipped};
        }));
        for (const panel of narrow) {
            assert.ok(panel.left >= -1 && panel.right <= panel.viewport + 1, JSON.stringify(panel));
            assert.ok(panel.scrollWidth <= panel.width + 1, JSON.stringify(panel));
            assert.deepEqual(panel.clipped, [], JSON.stringify(panel));
        }
        assert.equal(await controller.getByRole('button').filter({has: page.locator('b')}).count(), 100);
        await code.screenshot({path: path.join(output, 'code-german-narrow.png')});
        await controller.screenshot({path: path.join(output, 'controller-german-narrow.png')});
        checks.push('At 390px, the German Code and Controller surfaces retain all 100 memory cells and translated controls without clipped native controls or horizontal panel overflow');
        assert.equal(await page.evaluate(() => window.__cardiacIntegration.compilerCalls), 0);
        assert.deepEqual(compilerRequests, []); assert.deepEqual(errors, []);
        const result = {status: 'passed', browser: browser.version(), react: fixture.react, checks,
            scope: 'Real CardiacHost, CardiacSurfaces, createDebugRunner, CircuitDesigner, BoardImpl, workspace export and .sb3 bundle/load inside an authored browser shell',
            circuitSource: example, propTypes: 'validator-only shim', vm: 'minimum archive-loading delegate', fullApplicationBuild: false};
        await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
        console.log(JSON.stringify(result));
    }
} catch (error) {
    if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png'), fullPage: true}).catch(() => {});
    const observed = page && !page.isClosed() ? await page.evaluate(() => ({snapshot: window.__cardiacIntegration?.snapshot?.(),
        phase: window.__cardiacIntegration?.phase?.(), html: document.body.innerText.slice(-15000)})).catch(() => null) : null;
    await writeFile(path.join(output, 'result.json'), `${JSON.stringify({status: 'failed', message: error.message,
        browserErrors: errors, compilerRequests, completedChecks: checks, observed, react: fixture.react, fullApplicationBuild: false}, null, 2)}\n`);
    throw error;
} finally {
    if (browser) await browser.close();
    if (server?.close) await server.close();
    else if (server?.httpServer) await new Promise(resolve => server.httpServer.close(resolve));
}
