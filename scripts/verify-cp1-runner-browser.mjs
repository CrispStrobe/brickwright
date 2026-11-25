#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Actual CircuitDesigner + Cp1Host + createDebugRunner + project-bundle proof.
// The surrounding shell and Scratch project.json are fixtures, not the full GUI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
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
        page.setDefaultNavigationTimeout(90_000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('https://compiler.invalid/**', route => { requests.push(route.request().url()); return route.abort(); });
        await page.goto(`${url}/runner.html`, {waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.__cp1Integration?.board()?.parts?.some(part => part.id === 'trainer'));
        await page.getByRole('button', {name: 'Fit all parts', exact: true}).click();
        await page.locator('[data-cp1-panel]').waitFor();
        assert.equal(await page.getByRole('button', {name: 'Run CPU', exact: true}).count(), 0);
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
        assert.equal(await page.getByRole('button', {name: 'Run CPU', exact: true}).count(), 0);
        await page.waitForFunction(() => window.__cp1Integration.board()?.parts?.some(part => part.id === 'trainer'));
        assert.equal(await page.evaluate(() => window.__cp1Integration.vmProjectLoads), 1);
        await page.getByRole('button', {name: 'Fit all parts', exact: true}).click();
        await page.screenshot({path: path.join(output, 'restored-project-desktop.png'), fullPage: true});
        checks.push('fresh-browser project restore preserves the draft without ROM bytes, held keys or automatic execution');
        assert.equal(await page.evaluate(() => window.__cp1Integration.compilerCalls), 0);
        let cassetteRom;
        if (option('--cassette-rom')) {
            const firmware = await readFile(option('--cassette-rom'));
            cassetteRom = createHash('sha1').update(firmware).digest('hex');
            const {encodeCp2Memory} = await import(pathToFileURL(path.join(board, 'src/cp2-tape.js')));
            const {encodeCp2Wave} = await import(pathToFileURL(path.join(board, 'src/cp2-wave.js')));
            const image = new Uint8Array(256);
            image[0] = 255;
            image[255] = 91;
            image[254] = 47;
            const partial = encodeCp2Memory(image).slice(0, 1 + 3 * 16 + 7);
            const waveform = encodeCp2Wave(Uint32Array.from(partial, at => at - 14_400_000));
            await page.close();
            page = await browser.newPage({viewport: {width: 1440, height: 1100}});
            page.setDefaultNavigationTimeout(90_000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.goto(`${url}/runner.html`, {waitUntil: 'networkidle'});
            await page.waitForFunction(() => window.__cp1Integration?.board()?.parts?.some(part => part.id === 'trainer'));
            const builtInPath = path.join(root, 'overlay/scratch-gui/static/roms/cp1-independent-monitor.bin');
            assert.deepEqual(await readFile(builtInPath), firmware);
            const asset = '**/static/roms/cp1-independent-monitor.bin';
            await page.route(asset, route => route.fulfill({body: Buffer.alloc(2048)}));
            const debug = page.locator('[data-cp1-panel]');
            await debug.getByRole('button', {name: 'Use Brickwright monitor', exact: true}).click();
            await debug.getByRole('alert').filter({hasText: 'missing or damaged'}).waitFor();
            assert.equal(await page.evaluate(() => window.__cp1Integration.snapshot()), null);
            await page.unroute(asset);
            await page.route(asset, route => route.fulfill({path: builtInPath}));
            await page.evaluate(() => window.__cp1Integration.setShowSurfaces(true));
            const widgets = page.locator('[data-cp1-controller-face]');
            await widgets.getByRole('button', {name: 'Use Brickwright monitor', exact: true}).click();
            await page.waitForFunction(() => window.__cp1Integration.phase() === 'paused');
            await page.evaluate(() => window.__cp1Integration.setShowSurfaces(false));
            await widgets.waitFor({state: 'detached'});
            checks.push('damaged bundled ROM is refused, and Widgets loads the independent monitor into the shared paused machine');
            await page.getByRole('button', {name: 'Run CPU', exact: true}).click();
            await page.waitForFunction(() => window.__cp1Integration.snapshot().display.digits[0] === 0x73);
            assert.equal(await page.evaluate(() => window.__cp1Integration.snapshot().cp1.profileQualified), true);
            await page.getByText('CP2 cassette', {exact: true}).click();
            await page.getByRole('button', {name: 'Arm recording', exact: true}).click();
            await page.waitForFunction(() => window.__cp1Integration.snapshot().cp2Recording === 'recording');
            await page.getByRole('button', {name: 'Discard recording', exact: true}).click();
            await page.waitForFunction(() => window.__cp1Integration.snapshot().cp2Recording === null);
            await page.getByLabel('Open cassette WAV', {exact: true}).setInputFiles({
                name: 'truncated-original-test.wav', mimeType: 'audio/wav', buffer: Buffer.from(waveform)
            });
            await page.waitForFunction(() => window.__cp1Integration.snapshot().cassettePlaying);
            const cal = page.getByRole('button', {name: 'CAL', exact: true});
            await page.waitForFunction(() => !document.querySelector('[data-cp1-key="CAL"]')?.disabled);
            await cal.scrollIntoViewIfNeeded();
            const bounds = await cal.boundingBox();
            assert.ok(bounds);
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            try {
                await page.waitForFunction(() => window.__cp1Integration.snapshot().display.digits[0] === 0x1c);
            } finally {
                await page.mouse.up();
            }
            await page.waitForFunction(() => window.__cp1Integration.snapshot().display.digits.join(',') === '113,0,128,63,63,39',
                null, {timeout: 120_000});
            const cells = await page.evaluate(() => [0, 127].map(address => {
                const {opcode, operand} = window.__cp1Integration.snapshot().cells[address];
                return [opcode, operand];
            }));
            assert.deepEqual(cells, [[255, 0], [47, 91]]);
            await page.getByRole('button', {name: 'Eject cassette', exact: true}).click();
            await page.waitForFunction(() => window.__cp1Integration.snapshot().cassettePlaying === false);
            await page.screenshot({path: path.join(output, 'cp2-cassette-desktop.png'), fullPage: true});
            checks.push('CP2 controls arm and discard recording, load WAV via CAL, preserve complete bytes on F007, and eject');
        }
        if (process.argv.includes('--curriculum')) {
            const galleryRoot = path.join(root, 'overlay/scratch-gui/examples');
            const curriculum = JSON.parse(await readFile(path.join(galleryRoot, 'curriculum.json'), 'utf8'));
            const examples = JSON.parse(await readFile(path.join(galleryRoot, 'index.json'), 'utf8'));
            const trail = curriculum.trails.find(item => item.id === 'kosmos-cp1');
            const fixture = {id: 'cp1-cp2-sample-logger', chapter: trail.chapters.at(-1)};
            const entry = examples.find(example => example.id === fixture.id);
            for (const [lang, file] of [['en', entry.files.intro], ['de', entry.files.introDE]]) {
                await page.route(`${url}/examples/${file}`, async route => route.fulfill({
                    contentType: 'text/markdown', body: await readFile(path.join(galleryRoot, file), 'utf8')
                }));
                await page.evaluate(data => window.__cp1Integration.setGallery(data), {examples, curriculum, lang});
                const codex = page.getByRole('button', {name: lang === 'en' ? /Codex/ : /Kodex/});
                if (lang === 'en') {
                    const expand = page.getByRole('button', {name: 'Expand Examples', exact: true});
                    if (await expand.isVisible()) await expand.click();
                    await codex.click();
                    await page.getByTestId('codex-trail-kosmos-cp1').click();
                    await page.getByText(fixture.chapter.title.en, {exact: true}).click();
                }
                const fetch = page.waitForResponse(`${url}/examples/${file}`);
                await page.getByTestId(`codex-station-${fixture.id}`).click();
                assert.equal((await fetch).status(), 200);
                const reader = page.getByTestId('codex-reader-modal');
                await reader.getByText(lang === 'en' ? /Use Brickwright monitor/ : /Brickwright-Monitor verwenden/).waitFor();
                await reader.getByTestId('codex-open-bench').click();
                assert.equal(await page.evaluate(() => window.__cp1Integration.galleryPicked), entry.files.cp1);
            }
            checks.push('Codex opens the CP1 trail, renders English and German logger notes, and selects its real CP1 source');
        }
        if (process.argv.includes('--surfaces')) {
            const source = await readFile(path.join(root, 'overlay/scratch-gui/examples/cp1-first-display/program.cp1'), 'utf8');
            await page.evaluate(() => window.__cp1Integration.setShowSurfaces(true));
            const code = page.locator('[data-cp1-code-editor]');
            const controller = page.locator('[data-cp1-controller-face]');
            const debug = page.locator('[data-cp1-panel]');
            if (!await page.evaluate(() => window.__cp1Integration.snapshot())) {
                await controller.getByRole('button', {name: 'Import monitor ROM', exact: true}).waitFor();
                assert.equal(await code.getByRole('button', {name: 'Load cells', exact: true}).isDisabled(), true);
                const rom = option('--cassette-rom') ? await readFile(option('--cassette-rom')) : Buffer.from(switchToLedFirmware());
                await debug.getByLabel('Import monitor ROM', {exact: true}).setInputFiles({
                    name: 'cp1-test.bin', mimeType: 'application/octet-stream', buffer: rom
                });
                await page.waitForFunction(() => window.__cp1Integration.phase() === 'paused');
            }
            const boardBefore = await page.evaluate(() => window.__cp1Integration.identity().sameBoard);
            assert.equal(boardBefore, true);
            // The fixture dispatches the event the production gallery issues after
            // reading the listing. The Code and Widgets views belong to the same host.
            await page.evaluate(value => window.dispatchEvent(new CustomEvent('bw-cp1-source-load', {
                detail: {source: value, expansion: false}
            })), source);
            await page.waitForFunction(value => document.querySelector('[data-cp1-code-editor] [data-cp1-source]')?.value === value,
                source);
            const revised = `${source.trimEnd()}\n; Edited in Code\n`;
            await code.locator('[data-cp1-source]').fill(revised);
            assert.equal(await debug.locator('[data-cp1-source]').inputValue(), revised);
            await debug.locator('[data-cp1-source]').fill(source);
            assert.equal(await code.locator('[data-cp1-source]').inputValue(), source);
            await page.waitForFunction(() => window.__cp1Integration.phase() === 'paused');
            await code.getByRole('button', {name: 'Load cells', exact: true}).click();
            await code.getByRole('status').filter({hasText: 'Loaded'}).waitFor();
            assert.equal(await page.evaluate(() => window.__cp1Integration.snapshot().cells[0].opcode), 4);
            await controller.focus();
            await page.keyboard.down('5');
            assert.deepEqual(await page.evaluate(() => window.__cp1Integration.snapshot().keys), ['5']);
            await page.keyboard.up('5');
            assert.deepEqual(await page.evaluate(() => window.__cp1Integration.snapshot().keys), []);
            const digits = pane => pane.locator('[data-cp1-digit]').evaluateAll(elements => elements.map(el => el.dataset.segments));
            assert.deepEqual(await digits(controller), await digits(debug));
            await page.keyboard.down('5');
            await page.evaluate(() => window.__cp1Integration.setShowSurfaces(false));
            await page.waitForFunction(() => window.__cp1Integration.snapshot().keys.length === 0);
            await page.keyboard.up('5');
            await code.waitFor({state: 'detached'});
            await controller.waitFor({state: 'detached'});
            assert.equal(await page.evaluate(() => window.__cp1Integration.identity().sameBoard), true);
            checks.push('Code and Widgets use one debugger session, synchronize the listing, load its cells, and share the physical keys and display');
        }
        assert.deepEqual(requests, []);
        assert.deepEqual(errors, []);
        const result = {status: 'passed', browser: browser.version(), react: fixture.react, checks,
            scope: 'Actual CircuitDesigner, Cp1Host, createDebugRunner, BoardImpl, .sb3 bundle and loadProjectFile in an authored browser shell with a minimal VM delegate',
            firmware: 'original synthetic 8049 switch-to-LED firmware', cassetteRom,
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
