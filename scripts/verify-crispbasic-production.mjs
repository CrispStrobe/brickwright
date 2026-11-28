#!/usr/bin/env node
// Drive the complete production webpack application. Every served byte comes
// from build/: no source modules, extracted React methods or replacement host.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {dirname, extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import test, {after, before} from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, process.env.CRISP_BASIC_GUI_BUILD || 'packages/scratch-gui/build');
const artifacts = resolve(root, 'artifacts/crispbasic-production');
const rootRequire = createRequire(new URL('../package.json', import.meta.url));
const mime = new Map([
    ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript'], ['.mjs', 'text/javascript'],
    ['.wasm', 'application/wasm'], ['.json', 'application/json'], ['.css', 'text/css'],
    ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
    ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ico', 'image/x-icon'], ['.txt', 'text/plain'],
    ['.wav', 'audio/wav'], ['.mp3', 'audio/mpeg']
]);
const report = {format: 'crispbasic-production-qualification', version: 1,
    commit: process.env.GITHUB_SHA || null, buildDirectory: relative(root, build),
    serviceWorkers: 'blocked (fresh network qualification)', expectedScenarios: 14,
    scenarios: [], serverFailures: []};
let browser, server, origin;

before(async () => {
    await mkdir(artifacts, {recursive: true});
    const html = await readFile(resolve(build, 'index.html'));
    assert.match(html.toString('utf8'), /<script\b[^>]*src=/i, 'build/index.html must load the production bundle');
    await stat(resolve(build, 'static/crispbasic/manifest.json'));
    report.indexSha256 = createHash('sha256').update(html).digest('hex');
    server = createServer(async (request, response) => {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const prefix = ['/workbench/', '/missing-runtime/'].find(value => pathname.startsWith(value));
            if (!prefix) { response.writeHead(404).end(); return; }
            const asset = pathname.slice(prefix.length) || 'index.html';
            if (prefix === '/missing-runtime/' && asset.startsWith('static/crispbasic/')) {
                response.writeHead(404, {'Cache-Control': 'no-store'}).end(); return;
            }
            const filename = resolve(build, asset);
            const rel = relative(build, filename);
            if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
                response.writeHead(403).end(); return;
            }
            const bytes = await readFile(filename);
            response.writeHead(200, {'Content-Type': mime.get(extname(filename)) || 'application/octet-stream',
                'Cache-Control': 'no-store'});
            response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch (error) {
            report.serverFailures.push({url: request.url, code: error.code || error.message});
            response.writeHead(error.code === 'ENOENT' ? 404 : 400).end();
        }
    });
    await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
    origin = `http://127.0.0.1:${server.address().port}`;
    const override = process.env.CRISP_BASIC_PLAYWRIGHT;
    const moduleName = override && isAbsolute(override) ? pathToFileURL(override).href : override;
    const {chromium} = moduleName ? await import(moduleName) : rootRequire('playwright');
    browser = await chromium.launch({headless: true,
        ...(process.env.CRISP_BASIC_CHROMIUM ? {executablePath: process.env.CRISP_BASIC_CHROMIUM} : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage']});
    report.chromium = browser.version();
    report.origin = `${origin}/workbench/`;
}, {timeout: 60000});

after(async () => {
    try { await browser?.close(); }
    finally {
        if (server?.listening) {
            server.closeAllConnections();
            await new Promise((yes, no) => server.close(error => error ? no(error) : yes()));
        }
        report.passed = report.scenarios.filter(value => value.status === 'passed').length;
        report.failed = report.scenarios.filter(value => value.status === 'failed').length;
        report.status = report.passed === report.expectedScenarios && report.failed === 0 ? 'passed' : 'failed';
        await mkdir(artifacts, {recursive: true});
        await writeFile(resolve(artifacts, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
    }
});

const interpreterWorker = worker => /\/static\/crispbasic\/src\/wasm-worker\.mjs(?:\?|$)/.test(worker.url());

async function noInterpreterWorkers (page) {
    const until = Date.now() + 5000;
    while (page.workers().some(interpreterWorker) && Date.now() < until) await delay(20);
    assert.equal(page.workers().filter(interpreterWorker).length, 0, 'run left an interpreter worker alive');
}

// Initialize browser preferences and passive worker observations. Project
// content, source, controls and circuit changes use the visible UI below.
async function appPage (prefix = '/workbench/', keepCircuitMounted = false, enableCad = false) {
    const context = await browser.newContext({viewport: {width: 1600, height: 1000},
        locale: 'en-US', serviceWorkers: 'block'});
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const evidence = {requests: [], otherEngines: [], workers: [], cadRequests: [], cadWorkers: [], pageErrors: [], console: [],
        circuitPresentation: keepCircuitMounted ? 'dedicated tab, no stage portal' : 'default'};
    context.on('request', request => {
        if (request.url().includes('/static/crispbasic/')) evidence.requests.push(request.url());
        if (request.url().includes('/static/cad-sdk/')) evidence.cadRequests.push(request.url());
        if (/bbcbasic\.com|basic\.rom/.test(request.url())) evidence.otherEngines.push(request.url());
    });
    page.on('worker', worker => {
        if (interpreterWorker(worker)) evidence.workers.push(worker.url());
        if (/\/static\/cad-sdk\/assets\/simulation\.worker-/.test(worker.url())) evidence.cadWorkers.push(worker.url());
    });
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    page.on('console', message => {
        if (evidence.console.length < 100 && ['warning', 'error'].includes(message.type())) {
            evidence.console.push({type: message.type(), text: message.text()});
        }
    });
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(({keepCircuitMounted, enableCad}) => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        // Keep the real Designer mounted in its own tab while coding. The
        // default debugger-only stage portal can remount it on a tab switch;
        // that would conflate remount cancellation with the file import below.
        if (keepCircuitMounted) localStorage.setItem('bw-stage-circuit', '0');
        if (enableCad) {
            localStorage.setItem('bw-cad-enabled', '1');
            // Observe the real worker boundary and actual Stop click. Never
            // alter a command, delay a reply or substitute a mechanical result.
            const probe = window.__crispBasicCadProbe = {starts: 0, steps: 0, replies: 0,
                inFlight: 0, failures: [], releases: [], stop: null};
            const pending = new WeakMap();
            const send = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (command, ...options) {
                if (command?.op === 'start' && typeof command.wasmURL === 'string' &&
                    Object.hasOwn(command, 'fixBase')) probe.starts++;
                if (command?.op === 'actuator-step') {
                    let requests = pending.get(this);
                    if (!requests) {
                        requests = new Set(); pending.set(this, requests);
                        this.addEventListener('message', event => {
                            if (!requests.delete(event.data?.request)) return;
                            probe.replies++; probe.inFlight--;
                            if (event.data.error) probe.failures.push(event.data.error);
                        });
                    }
                    requests.add(command.request); probe.steps++; probe.inFlight++;
                }
                return Reflect.apply(send, this, [command, ...options]);
            };
            document.addEventListener('click', event => {
                if (event.composedPath().some(node => node?.dataset?.testid === 'bw-crispbasic-stop')) {
                    probe.stop = {steps: probe.steps, replies: probe.replies, inFlight: probe.inFlight};
                }
            }, true);
            window.addEventListener('bw-circuit-clock-owner', event => {
                const owner = event.detail?.owner;
                if (!event.detail?.board && owner?.board) {
                    // The Designer may resume its own electrical clock once
                    // notified; preserve the exact time of BASIC's handoff.
                    probe.releases.push({timeNs: owner.board.getTime().toString()});
                }
            });
        }
    }, {keepCircuitMounted, enableCad});
    try {
        await page.goto(`${origin}${prefix}`, {waitUntil: 'domcontentloaded', timeout: 60000});
        await page.waitForFunction(() => Boolean(window.__brickwrightStore?.getState?.()?.scratchGui?.vm?.runtime),
            null, {timeout: 60000});
        return {page, context, evidence};
    } catch (error) {
        await page.screenshot({path: resolve(artifacts, 'boot-failure.png')}).catch(() => {});
        await writeFile(resolve(artifacts, 'boot-failure.json'), JSON.stringify(evidence, null, 2));
        await context.close();
        throw error;
    }
}

function scenario (name, body, {prefix = '/workbench/', keepCircuitMounted = false,
    enableCad = false, timeoutMs = 150000} = {}) {
    test(name, {timeout: timeoutMs}, async () => {
        const record = {name, status: 'running'};
        report.scenarios.push(record);
        let app;
        try {
            app = await appPage(prefix, keepCircuitMounted, enableCad);
            await body(app.page, app.evidence, record);
            await noInterpreterWorkers(app.page);
            assert.deepEqual(app.evidence.pageErrors, [], 'production application raised a page error');
            record.status = 'passed';
        } catch (error) {
            record.status = 'failed';
            record.error = error.stack || String(error);
            if (app) await app.page.screenshot({path: resolve(artifacts,
                `failure-${report.scenarios.length}.png`), fullPage: true}).catch(() => {});
            throw error;
        } finally {
            if (app) {
                record.evidence = app.evidence;
                await app.context.close();
            }
        }
    });
}

async function codeTab (page, {basic = true} = {}) {
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-code-editor').locator('.cm-content').waitFor({state: 'visible'});
    if (basic) {
        await page.getByTestId('bw-code-editor').getByRole('button', {name: '📺 BAS', exact: true}).click();
        await page.getByTestId('bw-basic-engine').waitFor({state: 'visible'});
        assert.equal(await page.getByTestId('bw-basic-engine').inputValue(), 'crispbasic');
    }
}

async function editSource (page, source) {
    const editor = page.getByTestId('bw-code-editor').locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(source);
}

// Operation status remains available while the user-facing Info popup is
// closed. Observe the production editor's published state without opening or
// modifying that popup just to wait for asynchronous work.
async function codeStatus (page) {
    return await page.getByTestId('bw-code-editor').getAttribute('data-code-operation-status') || '';
}

async function waitForCodeStatus (page, expected) {
    const expression = expected instanceof RegExp ? {source: expected.source, flags: expected.flags} : null;
    await page.waitForFunction(({expression, text}) => {
        const status = document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || '';
        return expression ? new RegExp(expression.source, expression.flags).test(status) : status.includes(text);
    }, {expression, text: expression ? null : expected});
}

async function openCodeFile (page, filename, source) {
    await page.getByText('File', {exact: true}).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Open code file…', {exact: true}).click();
    await (await chooser).setFiles({name: filename, mimeType: 'text/plain', buffer: Buffer.from(source)});
    await waitForCodeStatus(page, filename);
}

async function finished (page) {
    await page.waitForFunction(() => {
        const run = document.querySelector('[data-testid="bw-basic-run"]');
        const status = document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || '';
        return run && !run.disabled && !document.querySelector('[data-testid="bw-crispbasic-stop"]') &&
            (/^Completed\b/.test(status) || /^CrispBASIC (?:stopped|could not|reached)/.test(status));
    }, null, {timeout: 30000});
}

async function runSource (page, source) {
    await editSource(page, source);
    await page.getByTestId('bw-basic-run').click();
    await finished(page);
    return page.evaluate(() => ({
        output: document.querySelector('[data-testid="bw-basic-output"]')?.textContent,
        status: document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus,
        diagnostic: document.querySelector('[data-testid="bw-crispbasic-diagnostic"]')?.textContent || null
    }));
}

async function successfulOutput (page, source, expected) {
    const result = await runSource(page, source);
    assert.equal(result.diagnostic, null, result.diagnostic || 'unexpected diagnostic');
    assert.equal(result.status, 'Completed.');
    assert.equal(result.output, expected);
    await noInterpreterWorkers(page);
    return result;
}

// The native Circuit JSON importer owns construction of this model and its
// solver board. Fixed nets keep the electrical expectation independent of
// visual wire routing and use the same documented digital Uno terminals.
function circuitJSON (suffix = '', {clamp = false} = {}) {
    const id = value => `${value}${suffix}`;
    const terminal = (part, name) => ({part: id(part), terminal: name});
    const circuit = {vcc: 5,
        parts: [
            {id: id('uno'), kind: 'arduino_uno', x: 80, y: 80, rotation: 0, params: {}, terminals: ['d13', 'd2', 'gnd']},
            {id: id('resistor'), kind: 'resistor', x: 360, y: 100, rotation: 0, params: {ohms: 220}, terminals: ['a', 'b']},
            {id: id('led'), kind: 'led', x: 500, y: 100, rotation: 0, params: {color: 'red'}, terminals: ['anode', 'cathode']},
            {id: id('button'), kind: 'button', x: 360, y: 240, rotation: 0, params: {}, terminals: ['a', 'b']}
        ], wires: [], nets: [
            {id: id('drive'), terminals: [terminal('uno', 'd13'), terminal('resistor', 'a')]},
            {id: id('light'), terminals: [terminal('resistor', 'b'), terminal('led', 'anode')]},
            {id: id('sense'), terminals: [terminal('uno', 'd2'), terminal('button', 'a')]},
            {id: id('ground'), terminals: [terminal('uno', 'gnd'), terminal('led', 'cathode'), terminal('button', 'b')]}
        ]};
    if (clamp) {
        circuit.parts.push({id: id('clamp'), kind: 'resistor', x: 360, y: 320, rotation: 0,
            params: {ohms: 1}, terminals: ['a', 'b']});
        circuit.nets[0].terminals.push(terminal('clamp', 'a'));
        circuit.nets[3].terminals.push(terminal('clamp', 'b'));
    }
    return circuit;
}

async function openCircuit (page, suffix = '', {beforeImport, clamp = false} = {}) {
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.waitForFunction(() => Boolean(window.__circuit && window.__board), null, {timeout: 60000});
    await page.getByText('File', {exact: true}).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Open circuit…', {exact: true}).click();
    const fileChooser = await chooser;
    if (beforeImport) await beforeImport();
    await fileChooser.setFiles({name: `crispbasic${suffix}.json`, mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(circuitJSON(suffix, {clamp})))});
    await page.waitForFunction(id => {
        const runtime = window.__brickwrightStore?.getState?.()?.scratchGui?.vm?.runtime;
        const board = runtime?.circuitBoard;
        return board && board === window.__board && board.parts.some(part => part.id === id) &&
            !runtime.circuitModel?.netlistError;
    }, `uno${suffix}`, {timeout: 30000});
}

function boardState (page) {
    return page.evaluate(() => {
        const runtime = window.__brickwrightStore.getState().scratchGui.vm.runtime;
        const board = runtime.circuitBoard;
        const pins = board.getPinStates();
        return {sameDisplayedBoard: board === window.__board, timeNs: board.getTime().toString(),
            owner: Boolean(runtime.bwCrispBasicSimulation), lease: Boolean(board._externalClock),
            powered: board.powered, pins, inputs: pins.every(pin => pin.mode === 'input'),
            partIds: board.parts.map(part => part.id)};
    });
}

let cadPayloadPromise;
function cadPayload () {
    return cadPayloadPromise ||= (async () => {
        const manifestPath = 'static/cad-sdk/manifest.json';
        const manifestBytes = await readFile(resolve(build, manifestPath));
        const manifest = JSON.parse(manifestBytes);
        const pinned = JSON.parse(await readFile(resolve(root, 'overlay/scratch-gui', manifestPath), 'utf8'));
        assert.equal(manifest.format, 'brickwright-cad-sdk');
        assert.equal(manifest.dirty, false, 'CAD SDK must come from a committed producer');
        assert.deepEqual(manifest, pinned, 'production must contain the pinned CAD SDK');
        for (const [filename, sha256] of Object.entries(manifest.files)) {
            assert.ok(!filename.startsWith('/') && !filename.split('/').includes('..'), 'safe CAD asset path');
            const bytes = await readFile(resolve(build, 'static/cad-sdk', filename));
            assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, `CAD asset differs: ${filename}`);
        }
        const project = await readFile(resolve(build, 'static/circuit-cad/scout-encoder.sb3'));
        const source = await readFile(resolve(root, 'packages/crisp-basic/examples/cad-robot/source.bas'), 'utf8');
        assert.match(source, /PROCdelay\(2\)[\s\S]*PROCdelay\(3\)[\s\S]*PROCdelay\(200\)/);
        report.cad = {producerCommit: manifest.commit, assetCount: Object.keys(manifest.files).length,
            manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
            projectSha256: createHash('sha256').update(project).digest('hex'),
            sourceSha256: createHash('sha256').update(source).digest('hex')};
        return {project, source};
    })();
}

async function openCadRobot (page) {
    const payload = await cadPayload();
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.waitForFunction(() => Boolean(window.__circuit && window.__board), null, {timeout: 60000});
    await page.getByTestId('bw-file-menu-trigger').click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Load from your computer', {exact: true}).click();
    await (await chooser).setFiles({name: 'scout-encoder.sb3', mimeType: 'application/x.scratch.sb3', buffer: payload.project});
    // A successful project upload returns to Blocks and unmounts the old
    // Circuit. Wait for the real uploader to finish, then reopen its public
    // tab before requiring the new model's displayed electrical board.
    await page.waitForFunction(() => {
        const gui = window.__brickwrightStore?.getState?.()?.scratchGui;
        return gui?.projectTitle === 'scout-encoder' &&
            gui.projectState?.loadingState === 'SHOWING_WITHOUT_ID';
    }, null, {timeout: 60000});
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.waitForFunction(() => {
        const runtime = window.__brickwrightStore?.getState?.()?.scratchGui?.vm?.runtime;
        const board = runtime?.circuitBoard;
        return board && board === window.__board && !runtime.circuitModel?.netlistError &&
            ['uno', 'left', 'right'].every(id => board.parts.some(part => part.id === id));
    }, null, {timeout: 60000});
    await page.getByRole('tab', {name: 'CAD', exact: true}).click();
    await page.waitForFunction(() => window.__bwCad?.editor?.session.state.document.id === 'robot-tt-rover',
        null, {timeout: 120000});
    await page.evaluate(() => window.__bwCad.editor.whenIdle());
    await page.getByTestId('bw-cad-program-settings').click();
    const panel = page.getByTestId('bw-cad-circuit-panel');
    await panel.getByRole('combobox', {name: 'Circuit motor', exact: true}).first().waitFor();
    assert.deepEqual(await panel.getByRole('combobox', {name: 'Circuit motor', exact: true})
        .evaluateAll(inputs => inputs.map(input => input.value)), ['left', 'right']);
    assert.deepEqual(await panel.getByRole('combobox', {name: 'CAD joint', exact: true})
        .evaluateAll(inputs => inputs.map(input => input.value)), ['drive-a', 'drive-b']);
    await panel.getByRole('button', {name: 'Close program settings', exact: true}).click();
    const design = await page.evaluate(() => ({text: window.__bwCad.editor.session.serialize(),
        revision: window.__bwCad.editor.session.state.revision}));
    await codeTab(page);
    return {...payload, design};
}

async function connectCadSource (page, source) {
    await openCodeFile(page, 'cad-robot.bas', source);
    await page.getByTestId('bw-crispbasic-connect-circuit').check();
    await page.getByTestId('bw-crispbasic-connect-cad').check();
}

function cadState (page) {
    return page.evaluate(() => {
        const runtime = window.__brickwrightStore.getState().scratchGui.vm.runtime;
        const board = runtime.circuitBoard, simulation = window.__bwCad.editor.simulation;
        const pins = board.getPinStates();
        return {timeNs: board.getTime().toString(), owner: Boolean(runtime.bwCrispBasicSimulation),
            lease: Boolean(board._externalClock), inputs: pins.every(pin => pin.mode === 'input'),
            shafts: ['left', 'right'].map(id => ({id, attached: Boolean(board.getDeviceState(id).externalShaft)})),
            mechanical: simulation.state, frame: simulation.snapshot(), probe: structuredClone(window.__crispBasicCadProbe)};
    });
}

async function cadInputGate (page, prompt) {
    await page.getByTestId('bw-basic-run').click();
    await page.getByTestId('bw-basic-output').filter({hasText: prompt}).waitFor({timeout: 120000});
    await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
    const state = await cadState(page);
    assert.equal(state.owner, true);
    assert.equal(state.lease, true);
    assert.equal(state.mechanical.state, 'running');
    assert.ok(state.shafts.every(shaft => shaft.attached));
    return state;
}

async function continueCadInput (page) {
    await page.getByTestId('bw-crispbasic-input').fill('continue');
    await page.getByTestId('bw-crispbasic-send').click();
}

async function assertCadReleased (page, design) {
    const state = await cadState(page);
    assert.equal(state.owner, false, 'BASIC still reserves the circuit');
    assert.equal(state.lease, false, 'BASIC still owns the electrical clock');
    assert.equal(state.inputs, true, 'BASIC left output pins active');
    assert.ok(state.shafts.every(shaft => !shaft.attached), 'motor ownership survived cleanup');
    assert.equal(state.mechanical.state, 'paused', 'the existing world must remain paused');
    assert.equal(state.probe.inFlight, 0, 'Run finished before its mechanical request settled');
    assert.deepEqual(state.probe.failures, []);
    assert.equal(state.probe.replies, state.probe.steps);
    assert.equal(state.probe.starts, 1, 'release or reacquisition restarted the physics world');
    const preserved = await page.evaluate(() => ({text: window.__bwCad.editor.session.serialize(),
        revision: window.__bwCad.editor.session.state.revision}));
    assert.deepEqual(preserved, design, 'simulation changed the authored design or its history');
    await noInterpreterWorkers(page);
    await delay(40);
    const idle = await cadState(page);
    assert.deepEqual(idle.frame, state.frame, 'released mechanics advanced without an owner');
    assert.equal(idle.probe.steps, state.probe.steps, 'cleanup invented a mechanical step');
    return state;
}

scenario('production CodeMirror generates BBC BASIC from blocks and loads the interpreter only on Run',
    async (page, evidence, record) => {
        await codeTab(page, {basic: false});
        await editSource(page, 'WHEN flag clicked:\n  print "PRODUCTION"\n  REPEAT 3:\n    print "X"\n');
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await page.waitForFunction(() => {
            const vm = window.__brickwrightStore?.getState?.()?.scratchGui?.vm;
            return vm && vm.toJSON().includes('PRODUCTION');
        });
        await codeTab(page);
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.waitForFunction(() => /PRINT[^\n]*PRODUCTION/.test(
            document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.innerText || ''));
        record.generatedSource = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.equal(evidence.requests.length, 0, 'runtime fetched before Run');
        assert.equal(await page.getByTestId('bw-crispbasic-connect-circuit').isChecked(), false);
        await page.getByTestId('bw-basic-run').click();
        await finished(page);
        assert.equal(await page.getByTestId('bw-basic-output').textContent(), 'PRODUCTION\r\nX\r\nX\r\nX\r\n');
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        for (const suffix of ['browser.mjs', 'src/wasm-worker.mjs', 'wasm/crispbasic.mjs', 'wasm/crispbasic.wasm']) {
            assert.ok(evidence.requests.some(url => url.endsWith(`/static/crispbasic/${suffix}`)), `missing runtime request: ${suffix}`);
        }
        assert.ok(evidence.requests.every(url => url.startsWith(`${origin}/workbench/static/crispbasic/`)));
        assert.ok(evidence.workers.length >= 1, 'no real module interpreter worker was observed');
        assert.equal(await page.evaluate(() => crossOriginIsolated), false);
        await page.screenshot({path: resolve(artifacts, 'generated-basic.png'), fullPage: true});
    });

scenario('production portable source round trip survives reopening and preserves its required runtime',
    async (page, evidence, record) => {
        await openCircuit(page);
        await codeTab(page);
        const controllers = page.getByTestId('bw-crispbasic-controller-list');
        await controllers.locator('summary').click();
        assert.equal(await controllers.locator('li').count(), 18);
        record.controllers = await controllers.locator('li').allTextContents();
        assert.ok(record.controllers.some(label => /STM32F030/.test(label)));
        assert.ok(record.controllers.some(label => /ESP8266/.test(label)));
        assert.ok(record.controllers.some(label => /6502/.test(label)));
        assert.ok(record.controllers.some(label => /PyBadge/.test(label)));
        assert.ok(record.controllers.some(label => /STC15/.test(label)));
        await controllers.locator('summary').click();
        await page.getByTestId('bw-basic-portable-library').check();
        await page.getByTestId('bw-crispbasic-connect-circuit').check();
        const original = `REM @bw device arduino-uno
REM @bw pin lamp D13 output
PROCpinMode(13,"output")
PROCdigitalWrite(13,1)
PROCdelay(2)
PROCdigitalToggle(13)
PRINT FNmillis
GCOL 0,2
MOVE 640,512
DRAW 680,552
END
`;
        await openCodeFile(page, 'roundtrip.bas', original);
        await page.getByTestId('bw-basic-run').click();
        await finished(page);
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        const originalOutput = await page.getByTestId('bw-basic-output').textContent();
        assert.equal(originalOutput, '         2\r\n');
        await page.getByTestId('bw-code-editor').getByRole('button', {name: '🧩 Pseudo', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"] .cm-content')
            ?.innerText.startsWith('# @crispbasic-portable 1'));
        const marked = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.equal((marked.match(/# @crispbasic-portable 1/g) || []).length, 1);
        const projectBefore = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON());
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await waitForCodeStatus(page, /To blocks is not qualified/);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), marked);
        await page.getByTestId('bw-code-editor').getByRole('button', {name: '🐍 Py', exact: true}).click();
        await waitForCodeStatus(page, /python is not qualified/);
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), marked);
        // Reopen saved source after discarding the checkbox preference and all
        // derived buffers: the marker alone must retain the runtime contract.
        await page.getByTestId('bw-code-editor').getByRole('button', {name: '📺 BAS', exact: true}).click();
        await page.getByTestId('bw-basic-portable-library').uncheck();
        await openCodeFile(page, 'roundtrip.bw', marked);
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await waitForCodeStatus(page, /To blocks is not qualified/);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        await page.getByTestId('bw-code-editor').getByRole('button', {name: '📺 BAS', exact: true}).click();
        await page.getByTestId('bw-basic-engine').waitFor({state: 'visible'});
        assert.equal(await page.getByTestId('bw-basic-engine').inputValue(), 'crispbasic');
        assert.equal(await page.getByTestId('bw-basic-portable-library').isChecked(), true);
        record.regenerated = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.match(record.regenerated, /PROCdigitalToggle\(13\)/);
        await page.getByTestId('bw-basic-run').click();
        await finished(page);
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        assert.equal(await page.getByTestId('bw-basic-output').textContent(), originalOutput);
        record.pseudocode = marked;
        record.output = originalOutput;
        await page.screenshot({path: resolve(artifacts, 'portable-roundtrip.png'), fullPage: true});
    });

scenario('production portable generation drives the Circuit and To blocks preserves the refused source and project',
    async (page, evidence, record) => {
        // Compile through the ordinary Code importer before loading the Circuit,
        // so any project replacement precedes the board captured by the run.
        await codeTab(page, {basic: false});
        await editSource(page, `DEVICE UNO
PIN lamp = D13 OUTPUT
PIN button = D2 INPUT ACTIVE LOW
WHEN flag clicked:
  print "PORTABLE GENERATOR"
  ask "start gate" and wait
  print (timer * 1000)
  turn on lamp
  wait 0.025 seconds
  print (timer * 1000)
  print read button
  ask "finish gate" and wait
  turn off lamp
`);
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await page.waitForFunction(() => window.__brickwrightStore?.getState?.()?.scratchGui?.vm
            ?.toJSON().includes('PORTABLE GENERATOR'));
        await waitForCodeStatus(page, 'Blocks loaded.');
        await openCircuit(page);
        await codeTab(page);
        const portable = page.getByTestId('bw-basic-portable-library');
        const connected = page.getByTestId('bw-crispbasic-connect-circuit');
        assert.equal(await portable.isChecked(), false, 'portable generation must be an explicit choice');
        assert.equal(await connected.isChecked(), false);
        const sourceBeforeChoice = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        await portable.check();
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), sourceBeforeChoice,
            'a generator preference change must preserve the current source until explicit regeneration');
        assert.equal(await connected.isChecked(), false, 'generation must not acquire a circuit connection');
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.waitForFunction(() => /PROCdigitalWrite\(13,1\)/.test(
            document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.innerText || ''));
        const source = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.match(source, /PROCpinMode\(13,"output"\)/);
        assert.match(source, /PROCpinMode\(2,"input-pullup"\)/);
        assert.match(source, /PROCdelay\(25\)/);
        assert.match(source, /FNdigitalRead\(2\)/);
        assert.match(source, /FNmillis/);
        assert.equal(evidence.requests.length, 0, 'generation must not fetch or start the interpreter');
        await connected.check();
        await page.getByTestId('bw-basic-run').click();
        await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
        const before = await boardState(page);
        assert.equal(before.owner, true);
        assert.equal(before.lease, true);
        await page.getByTestId('bw-crispbasic-input').fill('start');
        await page.getByTestId('bw-crispbasic-send').click();
        await page.getByTestId('bw-basic-output').filter({hasText: 'finish gate'}).waitFor();
        await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
        const observed = await boardState(page);
        assert.equal(observed.owner, true);
        assert.equal(observed.lease, true);
        assert.equal(BigInt(observed.timeNs) - BigInt(before.timeNs), 25000000n);
        observed.currentMa = await page.evaluate(() => -window.__board.branchCurrent('led', 'anode') * 1000);
        assert.ok(observed.currentMa > 10 && observed.currentMa < 16, JSON.stringify(observed));
        await delay(40);
        assert.equal((await boardState(page)).timeNs, observed.timeNs, 'INPUT must hold the owned simulation clock');
        await page.getByTestId('bw-crispbasic-input').fill('finish');
        await page.getByTestId('bw-crispbasic-send').click();
        await finished(page);
        assert.equal(await page.getByTestId('bw-basic-output').textContent(),
            'PORTABLE GENERATOR\r\nstart gate\r\n? \r\n         0\r\n        25\r\n         0\r\nfinish gate\r\n? \r\n');
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        const released = await boardState(page);
        assert.equal(released.owner, false);
        assert.equal(released.lease, false);
        assert.equal(released.inputs, true);
        await noInterpreterWorkers(page);

        const projectBefore = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON());
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await waitForCodeStatus(page, /To blocks cannot preserve/);
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), source);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        assert.match(await page.getByTestId('bw-conversion-report').textContent(), /unsupported|not preserved|refus/i);
        record.portable = {source, before, observed, released,
            refusal: await codeStatus(page),
            projectSha256: createHash('sha256').update(projectBefore).digest('hex')};
        await page.screenshot({path: resolve(artifacts, 'portable-generator-refusal.png'), fullPage: true});
    });

scenario('production portable toggle drives the retained latch while the clamped net remains low',
    async (page, evidence, record) => {
        await codeTab(page, {basic: false});
        await editSource(page, `DEVICE UNO
PIN lamp = D13 OUTPUT ACTIVE LOW
WHEN flag clicked:
  print "LATCH TOGGLE"
  set lamp high
  print read lamp
  ask "written high" and wait
  toggle lamp
  print read lamp
  ask "toggled low" and wait
  toggle lamp
  print read lamp
  ask "toggled high" and wait
`);
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await page.waitForFunction(() => window.__brickwrightStore?.getState?.()?.scratchGui?.vm
            ?.toJSON().includes('LATCH TOGGLE'));
        await waitForCodeStatus(page, 'Blocks loaded.');
        await openCircuit(page, '', {clamp: true});
        await codeTab(page);
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.waitForFunction(() => /REM toggle lamp/.test(
            document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.innerText || ''));
        record.legacySource = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.doesNotMatch(record.legacySource, /PROCdigitalToggle|PROCdigitalWrite|FNdigitalRead/);
        await page.getByTestId('bw-basic-portable-library').check();
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), record.legacySource);
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.waitForFunction(() => /PROCdigitalToggle\(13\)/.test(
            document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.innerText || ''));
        record.generatedSource = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.equal((record.generatedSource.match(/PROCdigitalToggle\(13\)/g) || []).length, 2);
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), false);
        assert.equal(evidence.requests.length, 0, 'generation must not start the runtime');
        await page.getByTestId('bw-crispbasic-connect-circuit').check();
        await page.getByTestId('bw-basic-run').click();
        record.observations = [];
        for (const [prompt, requested] of [['written high', true], ['toggled low', false], ['toggled high', true]]) {
            await page.getByTestId('bw-basic-output').filter({hasText: prompt}).waitFor();
            await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
            const observed = await boardState(page);
            const pin = observed.pins.find(value => value.pin.toLowerCase() === 'd13');
            assert.equal(pin.mode, 'pushpull');
            assert.equal(pin.driveHigh, requested, prompt);
            assert.equal(observed.owner, true);
            assert.equal(observed.lease, true);
            Object.assign(observed, await page.evaluate(() => ({
                voltage: window.__board.readAnalog('d13'), sensed: window.__board.readPin('d13')
            })));
            assert.ok(observed.voltage < 0.3, JSON.stringify(observed));
            assert.equal(observed.sensed, 0, 'sensing must report the clamp, independently of the latch');
            if (record.observations.length) assert.equal(observed.timeNs, record.observations[0].timeNs,
                'toggle and INPUT must not advance the owned circuit clock');
            record.observations.push(observed);
            await page.getByTestId('bw-crispbasic-input').fill('continue');
            await page.getByTestId('bw-crispbasic-send').click();
        }
        await finished(page);
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        assert.equal(await page.getByTestId('bw-basic-output').textContent(),
            'LATCH TOGGLE\r\n         1\r\nwritten high\r\n? \r\n         1\r\ntoggled low\r\n? \r\n         1\r\ntoggled high\r\n? \r\n');
        record.released = await boardState(page);
        assert.equal(record.released.owner, false);
        assert.equal(record.released.lease, false);
        assert.equal(record.released.inputs, true);
        await noInterpreterWorkers(page);
        const projectBefore = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON());
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await waitForCodeStatus(page, /To blocks cannot preserve/);
        assert.match(await codeStatus(page), /PROCdigitalToggle/);
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), record.generatedSource);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        await page.screenshot({path: resolve(artifacts, 'portable-latch-toggle.png'), fullPage: true});
    });

scenario('production undefined polling refuses and disables Run even after an error-banner newline',
    async (page, evidence, record) => {
        await codeTab(page, {basic: false});
        await editSource(page, 'DEVICE UNO\nPIN button = D2 INPUT\nWHEN flag clicked:\n  print "POLLING REFUSAL"\n  wait until read button\n');
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await page.waitForFunction(() => window.__brickwrightStore?.getState?.()?.scratchGui?.vm
            ?.toJSON().includes('POLLING REFUSAL'));
        await waitForCodeStatus(page, 'Blocks loaded.');
        await codeTab(page);
        await page.getByTestId('bw-basic-portable-library').check();
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.getByTestId('bw-basic-generation-warnings').filter({hasText: /wait until.*polling interval/}).waitFor();
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), true);
        await page.getByTestId('bw-code-editor').locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.press('Enter');
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), true,
            'a newline edit must not turn a generation-refusal banner into an executable program');
        const source = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        const projectBefore = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON());
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await waitForCodeStatus(page, /CrispBASIC: wait until/);
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), source);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), true);
        assert.equal(evidence.workers.length, 0);
        assert.equal(evidence.requests.length, 0);
        record.refusedSource = source;
        record.diagnostic = await page.getByTestId('bw-basic-generation-warnings').textContent();
        await page.screenshot({path: resolve(artifacts, 'portable-polling-refusal.png'), fullPage: true});
    });

scenario('production file import preserves error lines, Latin-1 and recursive input suspension', async page => {
    await codeTab(page);
    await openCodeFile(page, 'production-error.bas', '100 REM first\n\n450 ERROR 100,"expected"\n');
    await page.getByTestId('bw-basic-run').click();
    await finished(page);
    assert.match(await page.getByTestId('bw-crispbasic-diagnostic').textContent(), /production-error\.bas:3: expected/);
    await successfulOutput(page, 'PRINT "é"\nVDU 128,255\nEND\n', 'é\r\n\x80\xff');
    await editSource(page, 'PRINT FNask(3)\nEND\nDEF FNask(n%)\nLOCAL a$\nIF n%>0 THEN =FNask(n%-1)\nINPUT "" a$\n=a$\n');
    await page.getByTestId('bw-basic-run').click();
    await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
    await page.getByTestId('bw-crispbasic-input').fill('Ada');
    await page.getByTestId('bw-crispbasic-send').click();
    await finished(page);
    assert.equal(await page.getByTestId('bw-basic-output').textContent(), '\r\nAda\r\n');
    assert.equal(await page.getByTestId('bw-crispbasic-input-form').count(), 0);
    assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
});

scenario('production VDU renderer paints the expected pixels on identical repeated runs', async (page, evidence, record) => {
    await codeTab(page);
    const source = 'MODE 0\nGCOL 0,1\nMOVE 0,0\nDRAW 640,512\nEND\n';
    const colours = [];
    for (let index = 0; index < 2; index++) {
        const result = await runSource(page, source);
        assert.equal(result.diagnostic, null);
        const canvas = page.getByTestId('bw-vdu-terminal').locator('canvas');
        await canvas.waitFor({state: 'visible'});
        const colour = await canvas.evaluate(node => [...node.getContext('2d').getImageData(80, 190, 1, 1).data]);
        assert.ok(colour[0] > 200 && colour[1] < 20 && colour[2] < 20, JSON.stringify(colour));
        colours.push(colour);
    }
    assert.deepEqual(colours[1], colours[0]);
    record.pixel = colours[0];
    await page.screenshot({path: resolve(artifacts, 'vdu-drawing.png'), fullPage: true});
});

scenario('production Stop interrupts a tight interpreter loop and Reset permits a fresh run', async page => {
    await codeTab(page);
    await editSource(page, 'REPEAT\nUNTIL FALSE\n');
    await page.getByTestId('bw-basic-run').click();
    await waitForCodeStatus(page, 'CrispBASIC is running.');
    const ticks = await page.evaluate(async () => {
        let ticks = 0;
        const timer = setInterval(() => ticks++, 5);
        await new Promise(resolve => setTimeout(resolve, 100));
        clearInterval(timer);
        return ticks;
    });
    assert.ok(ticks >= 3, `main browser thread did not remain responsive: ${ticks}`);
    await page.getByTestId('bw-crispbasic-stop').click();
    await finished(page);
    await noInterpreterWorkers(page);
    await page.getByTestId('bw-crispbasic-reset').click();
    await waitForCodeStatus(page, 'CrispBASIC reset.');
    assert.equal(await page.getByTestId('bw-basic-output').textContent(), '…');
    assert.equal(await page.getByTestId('bw-vdu-terminal').count(), 0);
    await successfulOutput(page, 'PRINT "fresh production run"\nEND\n', 'fresh production run\r\n');
});

scenario('production Circuit import connects the displayed electrical solver and releases it on completion',
    async (page, evidence, record) => {
        await openCircuit(page);
        await codeTab(page);
        const checkbox = page.getByTestId('bw-crispbasic-connect-circuit');
        assert.equal(await checkbox.isChecked(), false);
        await checkbox.check();
        await editSource(page, 'PRINT STR$(FNmillis)\nPROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\n' +
            'PROCpinMode(2,"input-pullup")\nPRINT STR$(FNdigitalRead(2))\nPROCdelay(25)\n' +
            'PRINT STR$(FNmillis)\nINPUT "" a$\nEND\n');
        await page.getByTestId('bw-basic-run').click();
        await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
        const paused = await boardState(page);
        paused.currentMa = await page.evaluate(() => -window.__board.branchCurrent('led', 'anode') * 1000);
        assert.equal(paused.sameDisplayedBoard, true);
        assert.equal(paused.owner, true);
        assert.equal(paused.lease, true);
        assert.ok(paused.currentMa > 10 && paused.currentMa < 16, JSON.stringify(paused));
        assert.equal(await checkbox.isDisabled(), true);
        assert.equal(await page.getByTestId('bw-basic-output').textContent(), '0\r\n1\r\n25\r\n');
        // INPUT is a stable observation point: it must not advance solver time.
        await delay(40);
        assert.equal((await boardState(page)).timeNs, paused.timeNs);
        await page.getByTestId('bw-crispbasic-input').fill('continue');
        await page.getByTestId('bw-crispbasic-send').click();
        await finished(page);
        const released = await boardState(page);
        assert.equal(released.lease, false);
        assert.equal(released.owner, false);
        assert.equal(released.inputs, true);
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        await successfulOutput(page, 'PRINT STR$(FNmillis)\nPROCdelay(3)\nPRINT STR$(FNmillis)\nEND\n', '0\r\n3\r\n');
        assert.ok(BigInt((await boardState(page)).timeNs) >= BigInt(paused.timeNs) + 3000000n);
        record.electrical = {paused, released};
        await page.screenshot({path: resolve(artifacts, 'connected-circuit.png'), fullPage: true});
    });

scenario('production Circuit Stop and circuit-file replacement revoke a waiting run without late output',
    async (page, evidence, record) => {
        await openCircuit(page);
        await codeTab(page);
        await page.getByTestId('bw-crispbasic-connect-circuit').check();
        const source = 'PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nINPUT "" a$\nPRINT "late"\nEND\n';
        await editSource(page, source);
        await page.getByTestId('bw-basic-run').click();
        await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
        await page.getByTestId('bw-crispbasic-stop').click();
        await finished(page);
        const stopped = await boardState(page);
        record.cleanup = {stopped};
        assert.equal(stopped.owner, false);
        assert.equal(stopped.lease, false);
        assert.equal(stopped.inputs, true);
        await noInterpreterWorkers(page);
        await page.getByTestId('bw-basic-run').click();
        await page.getByTestId('bw-crispbasic-input').waitFor({state: 'visible'});
        const oldBoard = await page.evaluateHandle(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard);
        try {
            await openCircuit(page, '-replacement', {beforeImport: async () => {
                assert.equal(await page.getByTestId('bw-crispbasic-input-form').count(), 1,
                    'tab navigation canceled the run before circuit replacement');
                const beforeImport = await boardState(page);
                record.cleanup.beforeImport = beforeImport;
                assert.equal(beforeImport.owner, true, 'BASIC lost board ownership before circuit replacement');
                assert.equal(beforeImport.lease, true, 'BASIC lost the solver clock before circuit replacement');
                assert.equal(await oldBoard.evaluate(board => board === window.__board &&
                    board === window.__brickwrightStore.getState().scratchGui.vm.runtime.circuitBoard), true,
                'navigation replaced the captured board before the file was imported');
            }});
            await codeTab(page);
            await finished(page);
            record.cleanup.oldBoardAfterImport = await oldBoard.evaluate(board => ({
                lease: Boolean(board._externalClock), pins: board.getPinStates(),
                powered: board.powered, timeNs: board.getTime().toString()
            }));
            assert.equal(record.cleanup.oldBoardAfterImport.lease, false);
            const replaced = await boardState(page);
            record.cleanup.replaced = replaced;
            assert.equal(replaced.owner, false);
            assert.equal(replaced.lease, false);
            assert.equal(replaced.inputs, true);
            assert.ok(replaced.partIds.includes('uno-replacement'));
            assert.ok(!(await page.getByTestId('bw-basic-output').textContent()).includes('late'));
            await noInterpreterWorkers(page);
            await successfulOutput(page, 'PRINT STR$(FNmillis)\nEND\n', '0\r\n');
        } finally { await oldBoard.dispose(); }
    }, {keepCircuitMounted: true});

scenario('production BASIC drives the shipped Scout project and a second run resumes the same CAD world',
    async (page, evidence, record) => {
        const {source, design} = await openCadRobot(page);
        const prompt = 'CAD program ready';
        await connectCadSource(page, `INPUT "${prompt}" ready$\n${source}`);
        record.designSha256 = createHash('sha256').update(design.text).digest('hex');
        record.runs = [];
        let previous;
        for (let run = 0; run < 2; run++) {
            const gate = await cadInputGate(page, prompt);
            if (previous) assert.deepEqual(gate.frame, previous.frame,
                'reacquiring the clock changed the retained world before BASIC advanced it');
            await continueCadInput(page);
            await finished(page);
            assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
            assert.equal(await codeStatus(page), 'Completed.');
            const output = await page.getByTestId('bw-basic-output').textContent();
            assert.match(output, /Elapsed ms:\s*205\r\n/);
            assert.match(output, /Encoder:\s*[01]\r\n/);
            const settled = await assertCadReleased(page, design);
            assert.equal(settled.probe.releases.length, run + 1);
            assert.equal(BigInt(settled.probe.releases.at(-1).timeNs) - BigInt(gate.timeNs), 205000000n);
            assert.ok(Math.abs(settled.frame.time - gate.frame.time - 0.205) < 1e-9,
                '205 exact electrical milliseconds must produce 41 mechanical steps');
            assert.equal(settled.probe.steps - gate.probe.steps, 41);
            for (const joint of ['drive-a', 'drive-b']) {
                assert.ok(settled.frame.angles[joint] - gate.frame.angles[joint] > 0.01,
                    `the electrical motor did not turn CAD ${joint}`);
            }
            record.runs.push({gate, settled, output});
            previous = settled;
        }
        assert.equal(evidence.cadWorkers.length, 1, 'both runs must use one retained physics worker');
        assert.ok(evidence.cadRequests.some(url => /simulation\.worker-/.test(url)));
        await page.screenshot({path: resolve(artifacts, 'cad-basic-resumed.png'), fullPage: true});
        await page.getByRole('tab', {name: 'CAD', exact: true}).click();
        await page.screenshot({path: resolve(artifacts, 'cad-basic-preserved-world.png'), fullPage: true});
    }, {keepCircuitMounted: true, enableCad: true, timeoutMs: 240000});

scenario('production BASIC Stop releases pins and motor ownership without discarding or stepping CAD',
    async (page, evidence, record) => {
        const {source, design} = await openCadRobot(page);
        const endless = source.replace(/\bEND\s*$/, 'REPEAT\nPROCdelay(5)\nUNTIL FALSE\n');
        assert.notEqual(endless, source, 'the finite CAD example must end with END');
        const prompt = 'CAD stop ready';
        await connectCadSource(page, `INPUT "${prompt}" ready$\n${endless}`);
        const gate = await cadInputGate(page, prompt);
        await continueCadInput(page);
        await page.waitForFunction(() => window.__crispBasicCadProbe.steps >= 45, null, {timeout: 30000});
        await page.getByTestId('bw-crispbasic-stop').click();
        await finished(page);
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        assert.match(await codeStatus(page), /CrispBASIC stopped/);
        const stopped = await assertCadReleased(page, design);
        assert.ok(stopped.probe.stop, 'no actual Stop control click was observed');
        assert.equal(stopped.probe.steps, stopped.probe.stop.steps, 'Stop cleanup submitted another physics step');
        assert.equal(stopped.probe.releases.length, 1);
        assert.ok(stopped.frame.time > gate.frame.time);
        const mechanicalNs = BigInt(Math.round((stopped.frame.time - gate.frame.time) * 1e9));
        assert.equal(BigInt(stopped.probe.releases[0].timeNs) - BigInt(gate.timeNs), mechanicalNs,
            'Stop must reconcile the final completed mechanics with its owned electrical clock');
        assert.ok(Math.abs(stopped.frame.time - stopped.probe.steps * 0.005) < 1e-9);
        record.stopped = {gate, settled: stopped, hadPendingCommandAtClick: stopped.probe.stop.inFlight > 0};

        const resumePrompt = 'CAD resume ready';
        await connectCadSource(page, `INPUT "${resumePrompt}" ready$\n${source}`);
        const resumed = await cadInputGate(page, resumePrompt);
        assert.deepEqual(resumed.frame, stopped.frame, 'Stop caused the next run to restart CAD');
        await continueCadInput(page);
        await finished(page);
        assert.equal(await page.getByTestId('bw-crispbasic-diagnostic').count(), 0);
        assert.match(await page.getByTestId('bw-basic-output').textContent(), /Elapsed ms:\s*205\r\n/);
        const settled = await assertCadReleased(page, design);
        assert.equal(settled.probe.releases.length, 2);
        assert.equal(settled.probe.steps - resumed.probe.steps, 41);
        assert.ok(Math.abs(settled.frame.time - resumed.frame.time - 0.205) < 1e-9);
        assert.equal(evidence.cadWorkers.length, 1);
        record.resumed = {gate: resumed, settled};
        record.designSha256 = createHash('sha256').update(design.text).digest('hex');
        await page.screenshot({path: resolve(artifacts, 'cad-basic-stop-resume.png'), fullPage: true});
    }, {keepCircuitMounted: true, enableCad: true, timeoutMs: 240000});

scenario('production Connect Circuit refuses an absent supported board and ordinary BASIC stays usable', async page => {
    await codeTab(page);
    const checkbox = page.getByTestId('bw-crispbasic-connect-circuit');
    await checkbox.check();
    const refused = await runSource(page, 'PROCpinMode(13,"output")\nEND\n');
    assert.match(refused.diagnostic || '', /circuit|board|controller/i);
    assert.equal(await page.evaluate(() => Boolean(window.__brickwrightStore.getState().scratchGui.vm.runtime.bwCrispBasicSimulation)), false);
    await checkbox.uncheck();
    await successfulOutput(page, 'PRINT "ordinary"\nEND\n', 'ordinary\r\n');
});

scenario('production missing runtime reports the build instruction without silently loading another engine',
    async (page, evidence) => {
        await codeTab(page);
        const result = await runSource(page, 'PRINT "must not run"\nEND\n');
        assert.match(result.diagnostic || '', /build:crispbasic/);
        assert.ok(!result.output.includes('must not run'));
        assert.ok(evidence.requests.some(url => url.includes('/missing-runtime/static/crispbasic/')));
        assert.deepEqual(evidence.otherEngines, []);
        assert.equal(evidence.workers.length, 0);
        assert.equal(await page.getByTestId('bw-basic-engine').inputValue(), 'crispbasic');
        await page.screenshot({path: resolve(artifacts, 'missing-runtime.png'), fullPage: true});
    }, {prefix: '/missing-runtime/'});
