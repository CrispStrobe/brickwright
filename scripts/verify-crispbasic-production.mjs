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
    serviceWorkers: 'blocked (fresh network qualification)', expectedScenarios: 10,
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

// Only browser preferences are initialized. Project content, source, controls
// and circuit changes all go through the application's visible UI below.
async function appPage (prefix = '/workbench/', keepCircuitMounted = false) {
    const context = await browser.newContext({viewport: {width: 1600, height: 1000},
        locale: 'en-US', serviceWorkers: 'block'});
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const evidence = {requests: [], otherEngines: [], workers: [], pageErrors: [], console: [],
        circuitPresentation: keepCircuitMounted ? 'dedicated tab, no stage portal' : 'default'};
    context.on('request', request => {
        if (request.url().includes('/static/crispbasic/')) evidence.requests.push(request.url());
        if (/bbcbasic\.com|basic\.rom/.test(request.url())) evidence.otherEngines.push(request.url());
    });
    page.on('worker', worker => { if (interpreterWorker(worker)) evidence.workers.push(worker.url()); });
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    page.on('console', message => {
        if (evidence.console.length < 100 && ['warning', 'error'].includes(message.type())) {
            evidence.console.push({type: message.type(), text: message.text()});
        }
    });
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(keepCircuitMounted => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        // Keep the real Designer mounted in its own tab while coding. The
        // default debugger-only stage portal can remount it on a tab switch;
        // that would conflate remount cancellation with the file import below.
        if (keepCircuitMounted) localStorage.setItem('bw-stage-circuit', '0');
    }, keepCircuitMounted);
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

function scenario (name, body, {prefix = '/workbench/', keepCircuitMounted = false} = {}) {
    test(name, {timeout: 150000}, async () => {
        const record = {name, status: 'running'};
        report.scenarios.push(record);
        let app;
        try {
            app = await appPage(prefix, keepCircuitMounted);
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

async function openCodeFile (page, filename, source) {
    await page.getByText('File', {exact: true}).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Open code file…', {exact: true}).click();
    await (await chooser).setFiles({name: filename, mimeType: 'text/plain', buffer: Buffer.from(source)});
    await page.waitForFunction(name => document.querySelector('[data-testid="bw-code-status"]')?.textContent
        .includes(name), filename);
}

async function finished (page) {
    await page.waitForFunction(() => {
        const run = document.querySelector('[data-testid="bw-basic-run"]');
        const status = document.querySelector('[data-testid="bw-code-status"]')?.textContent || '';
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
        status: document.querySelector('[data-testid="bw-code-status"] > span')?.textContent,
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
function circuitJSON (suffix = '') {
    const id = value => `${value}${suffix}`;
    const terminal = (part, name) => ({part: id(part), terminal: name});
    return {vcc: 5,
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
}

async function openCircuit (page, suffix = '', {beforeImport} = {}) {
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.waitForFunction(() => Boolean(window.__circuit && window.__board), null, {timeout: 60000});
    await page.getByText('File', {exact: true}).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Open circuit…', {exact: true}).click();
    const fileChooser = await chooser;
    if (beforeImport) await beforeImport();
    await fileChooser.setFiles({name: `crispbasic${suffix}.json`, mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(circuitJSON(suffix)))});
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
        await page.getByTestId('bw-code-status').filter({hasText: 'Blocks loaded.'}).waitFor();
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
        await page.getByTestId('bw-code-status').filter({hasText: /To blocks cannot preserve/}).waitFor();
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), source);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        assert.match(await page.getByTestId('bw-conversion-report').textContent(), /unsupported|not preserved|refus/i);
        record.portable = {source, before, observed, released,
            refusal: await page.getByTestId('bw-code-status').textContent(),
            projectSha256: createHash('sha256').update(projectBefore).digest('hex')};
        await page.screenshot({path: resolve(artifacts, 'portable-generator-refusal.png'), fullPage: true});
    });

scenario('production portable toggle generation refuses and disables Run while default hardware comments remain inert',
    async (page, evidence, record) => {
        await codeTab(page, {basic: false});
        await editSource(page, 'DEVICE UNO\nPIN lamp = D13 OUTPUT\nWHEN flag clicked:\n  print "TOGGLE REFUSAL"\n  toggle lamp\n');
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await page.waitForFunction(() => window.__brickwrightStore?.getState?.()?.scratchGui?.vm
            ?.toJSON().includes('TOGGLE REFUSAL'));
        await page.getByTestId('bw-code-status').filter({hasText: 'Blocks loaded.'}).waitFor();
        await codeTab(page);
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.waitForFunction(() => /REM toggle lamp/.test(
            document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.innerText || ''));
        record.legacySource = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        assert.doesNotMatch(record.legacySource, /PROCdigitalWrite|FNdigitalRead/);
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), false);

        await page.getByTestId('bw-basic-portable-library').check();
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), record.legacySource);
        await page.getByRole('button', {name: /From blocks/}).first().click();
        await page.getByTestId('bw-basic-generation-warnings').filter({hasText: /toggle.*output latch/}).waitFor();
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), true);
        await page.getByTestId('bw-code-editor').locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.press('Enter');
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), true,
            'a newline edit must not turn a generation-refusal banner into an executable program');
        const source = await page.getByTestId('bw-code-editor').locator('.cm-content').innerText();
        const projectBefore = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON());
        await page.getByRole('button', {name: /To blocks/}).first().click();
        await page.getByTestId('bw-code-status').filter({hasText: /CrispBASIC: toggle/}).waitFor();
        assert.equal(await page.getByTestId('bw-code-editor').locator('.cm-content').innerText(), source);
        assert.equal(await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.toJSON()), projectBefore);
        assert.equal(await page.getByTestId('bw-basic-run').isDisabled(), true);
        assert.equal(evidence.workers.length, 0);
        assert.equal(evidence.requests.length, 0);
        record.refusedSource = source;
        record.diagnostic = await page.getByTestId('bw-basic-generation-warnings').textContent();
        await page.screenshot({path: resolve(artifacts, 'portable-toggle-refusal.png'), fullPage: true});
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
        const colour = await canvas.evaluate(node => [...node.getContext('2d').getImageData(80, 192, 1, 1).data]);
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
    await page.getByTestId('bw-code-status').filter({hasText: 'CrispBASIC is running.'}).waitFor();
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
    await page.getByTestId('bw-code-status').filter({hasText: 'CrispBASIC reset.'}).waitFor();
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
