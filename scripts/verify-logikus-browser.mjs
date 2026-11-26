#!/usr/bin/env node
// Production-GUI acceptance for Logikus. This gate requires a built editor and
// installed Chromium; an absent build/browser is a failure, never a DOM fallback.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir, readFile, realpath, rm, stat, writeFile} from 'node:fs/promises';
import {dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages/scratch-gui/build');
const artifacts = join(root, 'artifacts/logikus-browser');
const generatedFiles = ['report.json', 'desktop-railway.png', 'desktop-unsafe-replay.png',
    'desktop-all-red-report.png', 'railway-390px.png', 'railway-320px.png', 'failure.png'];
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.ico': 'image/x-icon', '.webp': 'image/webp', '.wasm': 'application/wasm',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};

const within = (directory, filename) => {
    const path = relative(directory, filename);
    return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

/** Serve only files inside this build, including after resolving symlinks. */
export async function serveBuild (directory) {
    const base = await realpath(directory);
    const server = createServer(async (request, response) => {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) {
                response.writeHead(405, {allow: 'GET, HEAD'}); response.end(); return;
            }
            let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
            if (pathname.includes('\0')) throw new Error('Invalid path');
            if (pathname.endsWith('/')) pathname += 'index.html';
            const candidate = resolve(base, `.${pathname}`);
            if (!within(base, candidate)) throw new Error('Path outside build');
            const file = await realpath(candidate);
            if (!within(base, file)) throw new Error('Symlink outside build');
            const body = await readFile(file);
            response.writeHead(200, {
                'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream',
                'content-length': body.length, 'cache-control': 'no-store',
            });
            response.end(request.method === 'HEAD' ? undefined : body);
        } catch {
            response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
            response.end('Not found');
        }
    });
    await new Promise((done, fail) => {
        server.once('error', fail);
        server.listen(0, '127.0.0.1', done);
    });
    return {server, url: `http://127.0.0.1:${server.address().port}/`};
}

export async function runSmoke () {
    let sourceCommit = null;
    try {
        sourceCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'],
            {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    } catch { /* A source archive may have no Git metadata. Do not invent a revision. */ }
    const report = {
        target: 'production GUI', startedAt: new Date().toISOString(),
        sourceCommit, githubSha: process.env.GITHUB_SHA || null,
        build: relative(root, build), ok: false, scenarios: [], screenshots: [],
        pageErrors: [], consoleErrors: [], failedRequests: [],
    };
    let browser, page, server, current = 'build and browser prerequisites';
    const screenshot = async name => {
        assert.ok(generatedFiles.includes(`${name}.png`), 'Screenshot has a declared output name');
        const path = join(artifacts, `${name}.png`);
        await page.screenshot({path, fullPage: true, animations: 'disabled'});
        report.screenshots.push(relative(root, path));
    };
    const scenario = async (name, action) => {
        current = name;
        const entry = {name, ok: false};
        report.scenarios.push(entry);
        console.log(`Logikus: ${name}`);
        const errorCount = report.pageErrors.length;
        try {
            entry.evidence = await action();
            assert.equal(report.pageErrors.length, errorCount, `Uncaught browser error during ${name}`);
            entry.ok = true;
        } catch (error) {
            entry.error = error.stack || String(error);
            throw error;
        }
    };

    try {
        await mkdir(artifacts, {recursive: true});
        // Remove only this gate's declared outputs, so a failed prerequisite
        // cannot leave old success screenshots in a newly uploaded artifact.
        for (const name of generatedFiles) await rm(join(artifacts, name), {force: true});
        const index = join(build, 'index.html');
        const indexStat = await stat(index).catch(() => null);
        assert.ok(indexStat?.isFile(),
            `Build the production editor first: ${index} is missing`);
        report.buildIndex = {bytes: indexStat.size, modifiedAt: indexStat.mtime.toISOString(),
            sha256: createHash('sha256').update(await readFile(index)).digest('hex')};
        ({server, url: report.url} = await serveBuild(build));
        const {chromium} = await import('playwright');
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
        browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
        report.browserVersion = browser.version();
        const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'en-US'});
        page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.on('pageerror', error => report.pageErrors.push({scenario: current, message: error.message, stack: error.stack}));
        page.on('console', message => {
            if (message.type() === 'error') report.consoleErrors.push({scenario: current, message: message.text()});
        });
        page.on('requestfailed', request => report.failedRequests.push({scenario: current,
            url: request.url(), error: request.failure()?.errorText}));
        await page.addInitScript(() => {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');
        });

        const lab = page.getByTestId('bw-logikus-lab');
        const railway = lab.getByTestId('logikus-railway');
        const input = index => lab.getByRole('switch', {name: new RegExp(`^S${index} `)});
        const sceneInput = index => railway.getByRole('switch', {name: new RegExp(`^Railway input S${index}:`)});
        const lamp = index => lab.locator(`button[aria-label^="L${index} "]`);
        const signal = index => railway.locator(`button[data-signal="${index}"]`);
        const attribute = async (locator, name, value) => {
            await locator.and(page.locator(`[${name}="${String(value)}"]`)).waitFor({state: 'visible'});
            assert.equal(await locator.getAttribute(name), String(value));
        };
        const lamps = async (a, b) => {
            await attribute(lamp(0), 'data-on', a);
            await attribute(lamp(1), 'data-on', b);
        };
        const selectRailway = async () => {
            await lab.getByRole('button', {name: 'Railway crossing interlock', exact: true}).click();
            await railway.waitFor({state: 'visible'});
        };
        const testAll = () => lab.getByRole('button', {name: 'Test all states', exact: true}).first().click();
        const verdict = async (id, text) => {
            await lab.getByTestId(id).getByText(text, {exact: true}).waitFor({state: 'visible'});
        };
        const addBypass = async () => {
            await lab.getByRole('tab', {name: 'Wire', exact: true}).click();
            await lab.getByRole('combobox', {name: /^From/}).selectOption('S2.Ba');
            await lab.getByRole('combobox', {name: /^To/}).selectOption('S2.Bb');
            await lab.getByRole('button', {name: 'Add wire', exact: true}).click();
        };
        const openFromWidgets = async () => {
            const launcher = page.getByTestId('bw-open-logikus');
            await launcher.waitFor({state: 'visible', timeout: 60000});
            await launcher.click();
            await lab.waitFor({state: 'visible', timeout: 60000});
            await lab.getByRole('heading', {name: 'Logikus Lab', exact: true}).waitFor();
        };

        await scenario('Open Logikus through the production Widgets controls', async () => {
            await page.goto(report.url, {waitUntil: 'domcontentloaded', timeout: 60000});
            const paneToggle = page.locator('[data-right-pane-toggle]');
            await paneToggle.waitFor({state: 'visible', timeout: 60000});
            if (await paneToggle.getAttribute('aria-pressed') !== 'true') await paneToggle.click();
            await attribute(paneToggle, 'aria-pressed', true);
            const compact = page.getByTestId('bw-right-pane-view');
            const expanded = page.locator('[data-right-pane] [title="Controller"]:visible, [data-right-pane] [title="Widgets"]:visible');
            await page.waitForFunction(() => [...document.querySelectorAll(
                '[data-testid="bw-right-pane-view"], [data-right-pane] [title="Controller"], [data-right-pane] [title="Widgets"]'
            )].some(element => element.getClientRects().length));
            if (await compact.isVisible()) {
                const labels = await compact.locator('option').allTextContents();
                const label = labels.find(value => ['Widgets', 'Controller'].includes(value));
                assert.ok(label, `Widgets option missing from ${JSON.stringify(labels)}`);
                await compact.selectOption({label});
            } else {
                await expanded.first().click();
            }
            await openFromWidgets();
            await selectRailway();
            return {entry: 'right pane → Widgets → Logikus Lab'};
        });

        await scenario('Railway requests and occupancy use the same live inputs and outputs', async () => {
            await lamps(false, false);
            await sceneInput(0).click();
            await attribute(input(0), 'aria-checked', true);
            await lamps(true, false); await attribute(signal(0), 'data-green', true);
            await input(2).click();
            await attribute(sceneInput(2), 'aria-checked', true);
            await lamps(false, false); await attribute(signal(0), 'data-green', false);
            await sceneInput(2).click();
            await attribute(input(2), 'aria-checked', false);
            await sceneInput(1).click();
            await lamps(false, false);
            await input(0).click();
            await attribute(sceneInput(0), 'aria-checked', false);
            await lamps(false, true);
            await sceneInput(3).click(); await lamps(false, true);
            await sceneInput(4).click(); await lamps(false, false);
            await lab.getByRole('button', {name: 'Reset inputs', exact: true}).click();
            await sceneInput(0).click();
            await lamps(true, false);
            await railway.getByRole('heading', {name: 'Two routes, one crossing', exact: true}).scrollIntoViewIfNeeded();
            await screenshot('desktop-railway');
            return {verified: ['A request', 'occupied crossing', 'both requests stop', 'B request', 'independent exits']};
        });

        await scenario('The inner truth-table action preserves focus and reports all 32 states', async () => {
            await lab.getByRole('tab', {name: 'Truth table', exact: true}).click();
            const trigger = lab.getByRole('tabpanel').getByRole('button', {name: 'Test all states', exact: true});
            await trigger.focus();
            await page.keyboard.press('Enter');
            await page.locator('#logikus-tab-table:focus').waitFor({state: 'visible'});
            await verdict('railway-safety-result', '32 / 32 states have no unsafe permissions');
            await verdict('logikus-target-result', '32 / 32 states match the goal');
            return {focused: 'logikus-tab-table', safety: '32/32', target: '32/32'};
        });

        await scenario('A real wire bypass yields a reproducible unsafe state and Undo repairs it', async () => {
            await addBypass();
            await testAll();
            await lab.getByRole('button', {name: 'Show unsafe state', exact: true}).click();
            await page.locator('#logikus-tab-wire:focus').waitFor({state: 'visible'});
            const actual = [];
            for (let i = 0; i < 5; i++) actual.push(Number(await input(i).getAttribute('aria-checked') === 'true'));
            assert.deepEqual(actual, [1, 0, 1, 0, 0], 'Replay uses S0…S4 = 10100');
            await attribute(lamp(0), 'aria-pressed', true);
            await lamps(true, false);
            await lab.getByRole('button', {name: 'Terminal S2.Ba', exact: true}).scrollIntoViewIfNeeded();
            await screenshot('desktop-unsafe-replay');
            await lab.getByRole('button', {name: 'Undo', exact: true}).click();
            // Undo restores the edit snapshot's inputs too. Apply the same
            // counterexample again to prove the repaired contact now stops A.
            for (let i = 0; i < 5; i++) {
                const desired = i === 0 || i === 2;
                if ((await input(i).getAttribute('aria-checked') === 'true') !== desired) await input(i).click();
            }
            await lamps(false, false);
            await testAll();
            await verdict('railway-safety-result', '32 / 32 states have no unsafe permissions');
            await verdict('logikus-target-result', '32 / 32 states match the goal');
            return {replay: '10100', faultyL0: true, repairedL0: false};
        });

        await scenario('Disconnected signals pass safety but fail four valid route requests', async () => {
            await lab.getByRole('tab', {name: 'Wire', exact: true}).click();
            const summary = lab.locator('summary').filter({hasText: 'wires · edit connections'});
            if (!await summary.evaluate(element => element.parentElement.open)) await summary.click();
            for (const index of [0, 1]) {
                await lab.getByRole('button', {name: new RegExp(`^Remove wire \\S+ L${index}$`)}).click();
            }
            await testAll();
            await verdict('railway-safety-result', '32 / 32 states have no unsafe permissions');
            await verdict('logikus-target-result', '28 / 32 states match the goal');
            await lab.getByTestId('railway-safety-result').scrollIntoViewIfNeeded();
            await screenshot('desktop-all-red-report');
            return {safety: '32/32', target: '28/32'};
        });

        await scenario('Native pointer capture and keyboard ownership keep Hold Test momentary', async () => {
            await lab.getByRole('button', {name: 'The ten-bit code lock', exact: true}).click();
            for (const [index, value] of [...'1011101101'].entries()) if (value === '1') await input(index).click();
            const test = lab.getByRole('button', {name: /^(Hold Test|Test contact closed)$/});
            const observation = await test.evaluateHandle(element => {
                const events = [];
                const names = ['pointerdown', 'gotpointercapture', 'pointerup', 'pointercancel', 'lostpointercapture'];
                const record = event => events.push({type: event.type, id: event.pointerId, trusted: event.isTrusted,
                    onButton: event.target === element, captured: element.hasPointerCapture(event.pointerId)});
                for (const name of names) element.addEventListener(name, record, {passive: true});
                return {snapshot: () => [...events], stop: () => {
                    for (const name of names) element.removeEventListener(name, record);
                }};
            });
            try {
                await test.scrollIntoViewIfNeeded();
                await test.focus();
                const box = await test.boundingBox(), dialog = await lab.boundingBox();
                assert.ok(box && dialog, 'Test button and dialog have rendered bounds');
                const center = {x: box.x + box.width / 2, y: box.y + box.height / 2};
                const outside = {x: dialog.x + dialog.width - 16, y: dialog.y + 16};
                assert.ok(outside.x < box.x || outside.x > box.x + box.width ||
                    outside.y < box.y || outside.y > box.y + box.height, 'Release point is outside Test');
                await page.mouse.move(center.x, center.y); await page.mouse.down();
                await attribute(test, 'aria-pressed', true); await attribute(lamp(0), 'data-on', true);
                await page.mouse.move(outside.x, outside.y);
                await page.waitForFunction(observer => observer.snapshot().some(event =>
                    event.type === 'gotpointercapture' && event.trusted && event.captured), observation);
                await page.mouse.up();
                await attribute(test, 'aria-pressed', false); await attribute(lamp(0), 'data-on', false);
                await page.waitForFunction(observer => observer.snapshot().some(event =>
                    event.type === 'lostpointercapture' && event.trusted && !event.captured), observation);

                await page.keyboard.down('Space');
                await attribute(test, 'aria-pressed', true);
                await page.mouse.move(center.x, center.y); await page.mouse.down();
                await page.mouse.move(outside.x, outside.y); await page.mouse.up();
                await attribute(test, 'aria-pressed', true);
                await page.keyboard.up('Space'); await attribute(test, 'aria-pressed', false);

                await page.mouse.move(center.x, center.y); await page.mouse.down();
                await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
                await attribute(test, 'aria-pressed', true);
                await page.mouse.move(outside.x, outside.y); await page.mouse.up();
                await attribute(test, 'aria-pressed', false); await attribute(lamp(0), 'data-on', false);
                const events = await observation.evaluate(observer => observer.snapshot());
                assert.ok(events.some(event => event.type === 'pointerup' && event.trusted && event.onButton),
                    'Native capture delivers the outside release to Test');
                return {buttonBounds: box, releasePoint: outside, events,
                    mixedOwners: ['keyboard survives pointer release', 'pointer survives keyboard release']};
            } finally {
                await observation.evaluate(observer => observer.stop());
                await observation.dispose();
            }
        });

        await scenario('Use in Widgets closes the lab and reopening preserves the edited circuit', async () => {
            await selectRailway();
            await addBypass();
            await input(0).click(); await input(2).click();
            await lamps(true, false);
            await lab.getByRole('button', {name: 'Use in Widgets', exact: true}).click();
            await lab.waitFor({state: 'hidden'});
            await openFromWidgets();
            await railway.waitFor({state: 'visible'});
            await attribute(sceneInput(0), 'aria-checked', true);
            await attribute(sceneInput(2), 'aria-checked', true);
            await lamps(true, false); await attribute(signal(0), 'data-green', true);
            await lab.getByRole('tab', {name: 'Wire', exact: true}).click();
            assert.equal(await lab.getByRole('button', {name: 'Remove wire S2.Ba S2.Bb', exact: true, includeHidden: true}).count(), 1);
            await selectRailway();
            return {preservedInputs: '10100', preservedBypass: 'S2.Ba ↔ S2.Bb', actualL0: true};
        });

        await scenario('Railway and lower controls remain reachable at 390 px and 320 px', async () => {
            const evidence = [];
            for (const viewport of [{width: 390, height: 844}, {width: 320, height: 740}]) {
                await page.setViewportSize(viewport);
                await railway.getByRole('heading', {name: 'Two routes, one crossing', exact: true}).scrollIntoViewIfNeeded();
                const bounds = await lab.evaluate(element => {
                    const rect = element.getBoundingClientRect(), main = element.querySelector('main');
                    return {x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
                        width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
                        mainWidth: main.clientWidth, mainScrollWidth: main.scrollWidth, mainHeight: main.clientHeight};
                });
                assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.right <= viewport.width + 1 &&
                    bounds.bottom <= viewport.height + 1, `Dialog fits ${viewport.width}px: ${JSON.stringify(bounds)}`);
                assert.ok(bounds.mainHeight > 100, `Main panel has usable height at ${viewport.width}px`);
                assert.ok(bounds.mainScrollWidth <= bounds.mainWidth + 2,
                    `Main panel does not overflow horizontally at ${viewport.width}px: ${JSON.stringify(bounds)}`);
                await sceneInput(0).click();
                await attribute(input(0), 'aria-checked', true); await attribute(signal(0), 'data-green', true);
                await sceneInput(0).click();
                const rename = lab.locator('summary').filter({hasText: 'Rename the panel, switches and lamps'});
                await rename.click();
                const lastInput = lab.getByLabel('L9', {exact: true});
                await lastInput.scrollIntoViewIfNeeded();
                const reached = await lastInput.evaluate(element => {
                    const rect = element.getBoundingClientRect(), main = element.closest('main');
                    const visible = main.getBoundingClientRect();
                    return {top: rect.top, bottom: rect.bottom, mainTop: visible.top,
                        mainBottom: visible.bottom, scrollTop: main.scrollTop, viewportHeight: innerHeight};
                });
                assert.ok(reached.scrollTop > 0 && reached.top >= reached.mainTop - 1 &&
                    reached.bottom <= Math.min(reached.mainBottom, reached.viewportHeight) + 1,
                `Last label control is reachable at ${viewport.width}px: ${JSON.stringify(reached)}`);
                await rename.click();
                await railway.getByRole('heading', {name: 'Two routes, one crossing', exact: true}).scrollIntoViewIfNeeded();
                await screenshot(`railway-${viewport.width}px`);
                evidence.push({viewport, bounds, reached});
            }
            return {mode: 'responsive viewport resizing of the production GUI', viewports: evidence};
        });
        assert.deepEqual(report.pageErrors, [], 'No uncaught errors in the production GUI');
        report.ok = true;
    } catch (error) {
        report.failure = {scenario: current, message: error.message || String(error), stack: error.stack};
        console.error(`Logikus browser failure (${current}): ${error.stack || error}`);
        if (page && !page.isClosed()) {
            try { await screenshot('failure'); }
            catch (failure) { report.screenshotError = failure.message; }
        }
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close().catch(error => { report.browserCloseError = error.message; });
        if (server) await new Promise(done => { server.close(done); server.closeAllConnections(); });
        report.finishedAt = new Date().toISOString();
        await writeFile(join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
        console.log(`Logikus browser ${report.ok ? 'passed' : 'failed'}: ${relative(root, join(artifacts, 'report.json'))}`);
    }
    return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runSmoke();
