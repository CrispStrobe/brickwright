#!/usr/bin/env node
/** CI-only production-browser proof for record/checkpoint/reverse/fork history. */
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {clickPauseUnlessPaused} from './lib/debug-browser-controls.mjs';

if (!process.env.CI && process.env.BW_ALLOW_LOCAL_BROWSER_PROOF !== '1') {
    throw new Error('This resource-intensive browser proof is CI-only; set BW_ALLOW_LOCAL_BROWSER_PROOF=1 explicitly');
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const artifacts = resolve(process.env.DEBUG_HISTORY_ARTIFACTS || 'artifacts/debug-history-browser');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2'};

const serveBuild = async () => {
    if (!existsSync(join(build, 'index.html'))) throw new Error(`Build first: ${build}/index.html is missing`);
    const server = createServer(async (req, res) => {
        try {
            let requestPath = decodeURIComponent(req.url.split('?')[0]);
            if (requestPath.endsWith('/')) requestPath += 'index.html';
            const file = join(build, normalize(requestPath));
            if (!file.startsWith(build)) throw new Error('path escaped build');
            const body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('not found');
        }
    });
    const first = Number(process.env.BW_PORT || 8191);
    for (let port = first; port < first + 20; port++) {
        const listening = await new Promise((done, fail) => {
            const onError = error => error.code === 'EADDRINUSE' ? done(false) : fail(error);
            server.once('error', onError);
            server.listen(port, () => { server.removeListener('error', onError); done(true); });
        });
        if (listening) return {server, url: `http://localhost:${port}/`};
    }
    throw new Error('no free browser-proof port');
};

await mkdir(artifacts, {recursive: true});
let server;
let browser;
let page;
let url = process.env.PROOF_URL || process.env.BW_URL || null;
const checks = [];
const diagnostics = [];
let refusalText = '';
const check = (name, ok, detail = '') => {
    checks.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
};
const snap = async name => {
    const path = join(artifacts, `${name}.png`);
    await page.screenshot({path, fullPage: true});
    check(`artifact ${name}`, existsSync(path));
};
const recordRequestFailure = request => {
    const reason = request.failure()?.errorText || '';
    // The app deliberately aborts its optional labwired WASM HEAD probe once
    // capability detection has its answer. It is not a failed app resource.
    if (request.method() === 'HEAD' && /labwired_wasm_bg\.wasm/.test(request.url()) &&
        reason === 'net::ERR_ABORTED') return;
    diagnostics.push(`requestfailed: ${request.method()} ${request.url()} ${reason}`);
};


// One original 30 s setup budget: device selection must finish applying before
// a real ROM reaches the debugger. DOM change dispatch is not that acknowledgement.
async function prepareHistoryMachine (page) {
    const deadline = Date.now() + 30000;
    const remaining = () => {
        const ms = deadline - Date.now();
        if (ms <= 0) throw new Error('debug history machine setup exceeded 30000 ms');
        return ms;
    };
    await page.evaluate(() => {
        const state = {applied: false, events: []};
        state.listener = event => {
            if (event.detail?.key !== 'bw-device-id') return;
            if (state.events.length < 8) state.events.push(String(event.detail.value).slice(0, 64));
            state.applied = event.detail.value === 'z80';
        };
        window.__bwDebugHistorySetup = state;
        window.addEventListener('bw-settings-change', state.listener);
    });
    try {
        await page.getByTestId('bw-device-select').selectOption('z80', {timeout: remaining()});
        await page.waitForFunction(() => window.__bwDebugHistorySetup?.applied === true,
            null, {timeout: remaining()});
        const circuit = page.getByRole('tab', {name: /Circuit/});
        await circuit.click({timeout: remaining()});
        // The debugger panel mounts in response to media; it cannot be a
        // prerequisite for delivering that media. Wait for the selected tab,
        // then use that committed state immediately to deliver the ROM.
        await circuit.and(page.locator('[aria-selected="true"]')).waitFor({state: 'visible', timeout: remaining()});
        await page.evaluate(() => {
            if (!window.__bwDebugHistorySetup?.applied) throw new Error('Z80 applied-device acknowledgement missing');
            const detail = {rom: Uint8Array.of(0x3e, 0, 0x32, 0, 0x80, 0x3c, 0xc3, 2, 0),
                target: 'z80', slotId: 'rom'};
            window.__bwPendingMedia = {type: 'asm', detail};
            window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        });
        const panel = page.locator('[data-debug-panel]:visible').first();
        await panel.locator('[data-debug-record]:not([disabled])').waitFor({state: 'attached', timeout: remaining()});
        return await page.evaluate(() => ({deviceApplied: window.__bwDebugHistorySetup.applied,
            events: window.__bwDebugHistorySetup.events}));
    } finally {
        // Preserve the original setup error if its page has already closed.
        await page.evaluate(() => {
            const state = window.__bwDebugHistorySetup;
            if (state) window.removeEventListener('bw-settings-change', state.listener);
            delete window.__bwDebugHistorySetup;
        }).catch(() => {});
    }
}

try {
    if (!url) ({server, url} = await serveBuild());
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1600, height: 1050}});
    page.on('dialog', dialog => dialog.accept());
    page.on('pageerror', error => diagnostics.push(`pageerror: ${error.stack || error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') diagnostics.push(`console.error: ${message.text()}`);
    });
    page.on('requestfailed', recordRequestFailure);
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
        localStorage.setItem('bw-debug-dock', 'right');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    // The Z80 runner has a complete checkpoint contract. The 8086 pins bench intentionally
    // refuses recording because its live schematic input source is unlogged.
    const setup = await prepareHistoryMachine(page);
    check('Z80 device is applied before debugger media delivery', setup.deviceApplied,
        JSON.stringify(setup.events));
    const panel = page.locator('[data-debug-panel]:visible').first();

    const pause = panel.getByRole('button', {name: /Pause/});
    // Record is enabled by the runner's capabilities, Pause only by the phase.
    // Wait for the panel's own phase attribute to read running (the state the
    // Pause click requires), not for an arbitrary moment after Record enables.
    await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
        ?.getAttribute('data-debug-phase') === 'running', null, {timeout: 30000});
    await pause.click();
    await page.waitForFunction(() => !document.querySelector('[data-debug-record]')?.disabled,
        null, {timeout: 15000});
    await panel.locator('[data-debug-history] > summary').click();
    await panel.locator('[data-debug-record]').click();
    await page.waitForFunction(() => /Recording/.test(
        document.querySelector('[data-debug-record]')?.textContent || '') &&
        !document.querySelector('[data-debug-checkpoint]')?.disabled, null, {timeout: 15000});
    check('recording starts with checkpoint capability', true);
    await panel.getByRole('button', {name: /Under the hood/}).click();

    const run = panel.locator('[data-debug-run]');
    const stepRecorded = async () => {
        await panel.getByRole('button', {name: /Step instruction/}).click();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() =>
            requestAnimationFrame(resolve))));
        await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
            ?.getAttribute('data-debug-phase') === 'paused', null, {timeout: 10000});
    };
    await stepRecorded();
    await panel.locator('[data-debug-checkpoint]').click();
    await page.waitForFunction(() => !document.querySelector('[data-debug-restore]')?.disabled,
        null, {timeout: 15000});
    check('manual checkpoint is retained and restorable', true);
    await snap('checkpoint');

    await stepRecorded();
    await stepRecorded();
    await panel.locator('[data-debug-record]').click();
    await page.waitForFunction(() => /Record/.test(
        document.querySelector('[data-debug-record]')?.textContent || '') &&
        !/Recording/.test(document.querySelector('[data-debug-record]')?.textContent || ''),
    null, {timeout: 15000});
    await panel.locator('[data-debug-reverse-step]:not([disabled])').waitFor({timeout: 15000});
    await panel.locator('[data-debug-reverse-step]').click();
    await page.waitForFunction(() => !document.querySelector('[data-debug-reverse-refusal]') &&
        !document.querySelector('[data-debug-run]')?.disabled, null, {timeout: 20000});
    check('reverse step reaches an earlier verified retire without refusal', true);
    await snap('reversed');

    // Forward execution after reverse is the public automatic-fork workflow.
    // A child recording starts at the restored boundary; its Recording label
    // is browser-visible evidence that branching did not mutate the parent log.
    await run.click();
    await page.waitForFunction(() => /Recording/.test(
        document.querySelector('[data-debug-record]')?.textContent || ''), null, {timeout: 15000});
    const forkPausePath = await pause.evaluate(clickPauseUnlessPaused);
    await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
        ?.getAttribute('data-debug-phase') === 'paused', null, {timeout: 15000});
    check('forward execution after reverse creates an active child recording', true,
        `pause path=${forkPausePath}`);
    await snap('forked');
    await panel.locator('[data-debug-record]').click();
    check('browser emitted no console, page, or request failure', diagnostics.length === 0,
        diagnostics.join(' | '));
} catch (error) {
    // PRINT IT. This pushed straight into `checks` without going through
    // `check()`, which is the only thing that logs — so a failing run printed
    // its passing checks, then "Debug history browser proof FAILED.", and
    // nothing whatever about what failed. The reason existed only inside
    // report.json, an uploaded artifact somebody has to go and download.
    //
    // Measured 2026-09-11: three CI runs reported this failure and none of them
    // said the gate timed out waiting for a reverse step that was refusing. An
    // instrument that knows the answer and does not print it costs more than one
    // that cannot tell.
    diagnostics.push(`gate: ${error.stack || error.message || error}`);
    checks.push({name: 'complete workflow', ok: false, detail: error.message || String(error)});
    console.log(`FAIL: complete workflow — ${error.message || String(error)}`);
} finally {
    // READ THE REFUSAL OFF THE PAGE BEFORE CLOSING IT. The gate waits for a
    // refusal element to be ABSENT, so on failure the element is present and
    // carries the reason in plain text. That reason was previously visible only
    // by opening final.png by eye — which is how "the reverse step refuses with
    // `replayed event stream diverged`" stayed unknown across three CI runs.
    if (page) {
        refusalText = await page.evaluate(() => {
            const el = document.querySelector('[data-debug-reverse-refusal]');
            return el ? el.textContent.trim() : '';
        }).catch(() => '');
    }
    if (page) await page.screenshot({path: join(artifacts, 'final.png'), fullPage: true})
        .catch(error => diagnostics.push(`screenshot: ${error.message}`));
    const report = {url, checks, diagnostics, refusalText,
        passed: checks.filter(item => item.ok).length, failed: checks.filter(item => !item.ok).length};
    await writeFile(join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (browser) await browser.close();
    if (server) await new Promise(done => server.close(done));
}

const failed = checks.some(item => !item.ok) || diagnostics.length > 0;
if (failed) {
    // The whole reason, on stdout, where the CI log is. Anything the page put in
    // front of the user at the moment of failure is the most useful line here —
    // a reverse step that REFUSES looks identical to one that hangs, from the
    // outside, and the refusal text is what tells them apart.
    for (const item of checks.filter(c => !c.ok)) {
        console.log(`  failed check: ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
    }
    for (const line of diagnostics) console.log(`  diagnostic: ${line}`);
    if (refusalText) console.log(`  ON-SCREEN REFUSAL: ${refusalText}`);
    console.log(`  report: ${join(artifacts, 'report.json')}`);
}
console.log(failed ? '\nDebug history browser proof FAILED.' : '\nDebug history browser proof passed.');
process.exit(failed ? 1 : 0);
