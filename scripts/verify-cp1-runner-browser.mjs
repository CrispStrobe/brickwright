#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Actual CircuitDesigner + Cp1Host + createDebugRunner + project-bundle proof.
// The surrounding shell and Scratch project.json are fixtures, not the full GUI.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {cp1BrowserFixture} from './lib/cp1-browser-fixture.mjs';
import {switchToLedFirmware} from '../test/fixtures/cp1-panel/synthetic-circuit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = flag => { const index = process.argv.indexOf(flag); return index < 0 ? null : process.argv[index + 1]; };
for (const flag of ['--deps', '--board', '--circuit']) assert.ok(option(flag), `Pass ${flag} with an explicit source/dependency directory.`);
const deps = path.resolve(root, option('--deps'));
const compilerDeps = path.resolve(root, option('--compiler-deps') || option('--deps'));
const board = path.resolve(root, option('--board'));
const circuit = path.resolve(root, option('--circuit'));
const output = path.resolve(root, option('--out') || 'test-results/cp1-runner-browser');
await mkdir(output, {recursive: true});
const fixture = await cp1BrowserFixture({root, deps, compilerDeps, board, circuit});
const errors = [], checks = [], requests = [];
let server, browser, page;
try {
    if (process.argv.includes('--compile-only')) {
        await fixture.build({...fixture.config, build: {outDir: path.join(output, 'compiled'), emptyOutDir: true,
            rollupOptions: {input: path.join(root, 'test/fixtures/cp1-panel/runner.html')}}});
        console.log(JSON.stringify({status: 'compiled', react: fixture.react,
            scope: 'Fixture compilation only; no browser or runtime qualification'}));
    } else {
        server = await fixture.createServer(fixture.config);
        await server.listen();
        const url = `http://127.0.0.1:${server.httpServer.address().port}`;
        browser = await fixture.chromium.launch({headless: true,
            ...(option('--executable') ? {executablePath: option('--executable')} : {})});
        page = await browser.newPage({viewport: {width: 1440, height: 1100}});
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('https://compiler.invalid/**', route => { requests.push(route.request().url()); return route.abort(); });
        await page.goto(`${url}/runner.html`, {waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.__cp1Integration?.board()?.parts?.some(part => part.id === 'trainer'));
        await page.getByRole('button', {name: 'Fit all parts', exact: true}).click();
        await page.locator('[data-cp1-panel]').waitFor();
        assert.equal(await page.getByRole('button', {name: 'Run CPU', exact: true}).isDisabled(), true);
        const rom = Buffer.from(switchToLedFirmware());
        const romInput = page.getByLabel('Import monitor ROM', {exact: true});
        await romInput.setInputFiles({name: 'original-switch-led.rom', mimeType: 'application/octet-stream', buffer: rom});
        await page.waitForFunction(() => window.__cp1Integration.phase() === 'paused');
        const identity = await page.evaluate(() => window.__cp1Integration.identity());
        assert.deepEqual(identity, {sameBoard: true, publishedBoard: true, oneMachine: true, react: fixture.react});
        assert.equal(await page.locator('[data-cp1-semantic="unavailable"]').count(), 1);
        assert.equal(await page.locator('[data-cp1-command-step]').count(), 0);
        checks.push('ROM import attaches one machine to the actual designer board and remains paused');
        checks.push('unknown synthetic firmware exposes raw CPU controls without claiming qualified command debugging');

        await page.getByRole('button', {name: 'Run CPU', exact: true}).click();
        await page.waitForFunction(() => window.__cp1Integration.snapshot()?.ports.P2.value === 255 && window.__cp1Integration.led() > 0.3);
        await page.getByRole('radio', {name: 'Sim mode', exact: true}).click();
        const button = page.locator('[data-cp1-real-circuit] wokwi-pushbutton');
        await button.scrollIntoViewIfNeeded();
        const buttonBox = await button.boundingBox();
        assert.ok(buttonBox, 'the actual circuit button has a visible hit target');
        await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
        await page.mouse.down();
        await page.waitForFunction(() => window.__cp1Integration.snapshot()?.ports.P1.value === 254 &&
            window.__cp1Integration.snapshot()?.ports.P2.value === 254 && window.__cp1Integration.led() === 0);
        await page.mouse.up();
        await page.waitForFunction(() => window.__cp1Integration.snapshot()?.ports.P2.value === 255 && window.__cp1Integration.led() > 0.3);
        checks.push('real canvas button press and release propagate through 8049 firmware to resistor/LED');

        await page.getByRole('button', {name: 'Pause CPU', exact: true}).click();
        const paused = await page.evaluate(() => window.__cp1Integration.time());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(await page.evaluate(() => window.__cp1Integration.time()), paused);
        await page.getByRole('button', {name: 'CPU step', exact: true}).click();
        // A real runner schedules instruction execution on its shared frame.
        // Observe completion instead of assuming the click executes synchronously.
        await page.waitForFunction(before => window.__cp1Integration.phase() === 'paused' &&
            BigInt(window.__cp1Integration.time().machine) > BigInt(before), paused.machine);
        const stepped = await page.evaluate(() => window.__cp1Integration.time());
        assert.ok(BigInt(stepped.machine) > BigInt(paused.machine));
        assert.equal(BigInt(stepped.board) - BigInt(paused.board), BigInt(stepped.machine) - BigInt(paused.machine));
        await page.getByRole('button', {name: 'Reset CPU', exact: true}).click();
        const reset = await page.evaluate(() => window.__cp1Integration.time());
        assert.equal(reset.board, stepped.board, 'reset must not rewind the circuit clock');
        checks.push('pause, 8049 instruction step and reset preserve the shared circuit timeline');

        const source = 'AKO 42\nANZ\nSPU 1\n';
        await page.locator('[data-cp1-source]').fill(source);
        await page.getByRole('button', {name: 'Load cells', exact: true}).click();
        await page.getByRole('status').filter({hasText: 'Loaded 3'}).waitFor();
        assert.deepEqual(await page.evaluate(() => window.__cp1Integration.snapshot().cells.slice(0, 3)
            .map(({opcode, operand}) => ({opcode, operand}))),
        [{opcode: 4, operand: 42}, {opcode: 2, operand: 0}, {opcode: 9, operand: 1}]);
        assert.deepEqual(await page.evaluate(() => window.__cp1Integration.loadedEvents), [{cells: 3, expansion: false}]);
        await page.locator('[data-cp1-source]').fill('draft: AKO missing_label +');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('bw-circuit-autosave'))?.parts?.some(part => part.id === 'trainer'));
        await page.locator('[data-cp1-panel]').focus();
        await page.keyboard.down('5');
        assert.deepEqual(await page.evaluate(() => window.__cp1Integration.snapshot().keys), ['5']);
        const savedDraft = await page.evaluate(() => JSON.parse(localStorage.getItem('bw-cp1-workspace')));
        const downloadWait = page.waitForEvent('download');
        await page.getByRole('button', {name: 'Save fixture .sb3', exact: true}).click();
        await page.keyboard.up('5');
        const download = await downloadWait;
        const archivePath = path.join(output, 'cp1-browser-proof.sb3');
        await download.saveAs(archivePath);
        const archive = await JSZip.loadAsync(await readFile(archivePath));
        const bundle = JSON.parse(await archive.file('brickwright/state.json').async('string'));
        assert.deepEqual(bundle.state.cp1, savedDraft);
        assert.equal(bundle.state.circuit.parts.some(part => part.id === 'trainer'), true);
        assert.deepEqual(Object.keys(bundle.state.cp1).sort(), ['configuration', 'format', 'rom', 'source', 'version']);
        assert.equal(bundle.state.cp1.rom.byteLength, 2048);
        assert.equal(Object.keys(archive.files).some(name => /\.(bin|rom)$/i.test(name)), false);
        checks.push('ordinary .sb3 adapter saves circuit and incomplete source with ROM identity only');
        await page.screenshot({path: path.join(output, 'shared-runner-desktop.png'), fullPage: true});

        await page.evaluate(() => localStorage.clear());
        await page.reload({waitUntil: 'networkidle'});
        assert.equal(await page.evaluate(() => window.__cp1Integration.snapshot()), null);
        await page.getByRole('button', {name: 'Clear fixture circuit', exact: true}).click();
        await page.waitForFunction(() => window.__cp1Integration.board()?.parts?.length === 0);
        await page.getByLabel('Restore fixture .sb3', {exact: true}).setInputFiles(archivePath);
        await page.waitForFunction(() => window.__cp1Integration.restore?.outcome === 'loaded');
        await page.waitForFunction(source => document.querySelector('[data-cp1-source]')?.value === source,
            savedDraft.source);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bw-cp1-workspace'))), savedDraft);
        assert.equal(await page.evaluate(() => window.__cp1Integration.snapshot()), null);
        assert.equal(await page.evaluate(() => window.__cp1Integration.phase()), 'idle');
        assert.equal(await page.getByRole('button', {name: 'Run CPU', exact: true}).isDisabled(), true);
        await page.waitForFunction(() => window.__cp1Integration.board()?.parts?.some(part => part.id === 'trainer'));
        assert.equal(await page.evaluate(() => window.__cp1Integration.vmProjectLoads), 1);
        await page.getByRole('button', {name: 'Fit all parts', exact: true}).click();
        await page.screenshot({path: path.join(output, 'restored-project-desktop.png'), fullPage: true});
        checks.push('fresh-browser project restore preserves the draft without ROM bytes, held keys or automatic execution');
        assert.equal(await page.evaluate(() => window.__cp1Integration.compilerCalls), 0);
        assert.deepEqual(requests, []);
        assert.deepEqual(errors, []);
        const result = {status: 'passed', browser: browser.version(), react: fixture.react, checks,
            scope: 'Actual CircuitDesigner, Cp1Host, createDebugRunner, BoardImpl, .sb3 bundle and loadProjectFile in an authored browser shell with a minimal VM delegate',
            firmware: 'original synthetic 8049 switch-to-LED firmware',
            propTypes: 'validator-only stub', fullApplicationBuild: false};
        await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
        console.log(JSON.stringify(result));
    }
} catch (error) {
    if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(path.join(output, 'result.json'), `${JSON.stringify({status: 'failed',
        message: error.message, browserErrors: errors, completedChecks: checks,
        react: fixture.react, fullApplicationBuild: false}, null, 2)}\n`);
    throw error;
} finally {
    if (browser) await browser.close();
    if (server) await server.close();
}
