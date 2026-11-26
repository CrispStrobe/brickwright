#!/usr/bin/env node
/** CI browser proof: forward run-to halts before code and one selected cursor drives all recorded panes. */
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.env.CI && process.env.BW_ALLOW_LOCAL_BROWSER_PROOF !== '1') {
    throw new Error('This resource-intensive browser proof is CI-only; set BW_ALLOW_LOCAL_BROWSER_PROOF=1 explicitly');
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages/scratch-gui/build');
const artifacts = resolve(process.env.DEBUG_INSPECTION_ARTIFACTS || 'artifacts/debug-run-to-inspection');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2'};

async function serveBuild () {
    if (!existsSync(join(build, 'index.html'))) throw new Error(`Build first: ${build}/index.html is missing`);
    const server = createServer(async (req, res) => {
        try {
            let requestPath = decodeURIComponent(req.url.split('?')[0]);
            if (requestPath.endsWith('/')) requestPath += 'index.html';
            const file = join(build, normalize(requestPath));
            if (!file.startsWith(build)) throw new Error('path escaped build');
            const body = await readFile(file);
            res.writeHead(200, {'content-type': mime[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch { if (!res.headersSent) res.writeHead(404); res.end('not found'); }
    });
    const base = Number(process.env.BW_PORT || 8191);
    for (let port = base; port < base + 20; port++) {
        const listening = await new Promise((done, fail) => {
            const error = value => value.code === 'EADDRINUSE' ? done(false) : fail(value);
            server.once('error', error);
            server.listen(port, () => { server.removeListener('error', error); done(true); });
        });
        if (listening) return {server, url: `http://localhost:${port}/`};
    }
    throw new Error('no free browser-proof port');
}

await mkdir(artifacts, {recursive: true});
const results = [];
const diagnostics = [];
const check = (name, ok, detail = '') => {
    results.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) throw new Error(`${name}: ${detail || 'failed'}`);
};

let browser;
let page;
let server;
let url = process.env.PROOF_URL || process.env.BW_URL;
try {
    if (!url) ({server, url} = await serveBuild());
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1600, height: 1100}});
    page.on('pageerror', error => diagnostics.push(`pageerror: ${error.stack || error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') diagnostics.push(`console.error: ${message.text()}`);
    });
    page.on('requestfailed', request => {
        const reason = request.failure()?.errorText || '';
        if (request.method() === 'HEAD' && /labwired_wasm_bg\.wasm/.test(request.url()) &&
            reason === 'net::ERR_ABORTED') return;
        diagnostics.push(`requestfailed: ${request.method()} ${request.url()} ${reason}`);
    });
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
        localStorage.setItem('bw-debug-dock', 'right');
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-device-select').selectOption('z80');
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.evaluate(() => {
        // A deterministic local ROM enters through the same public event as
        // the ASM tab, avoiding both a hosted assembler and an unlogged board.
        const detail = {rom: Uint8Array.of(0x3e, 0, 0x32, 0, 0x80, 0x3c, 0xc3, 2, 0),
            target: 'z80', slotId: 'rom'};
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
    });
    const panel = page.locator('[data-debug-panel]').first();
    await panel.waitFor({state: 'visible', timeout: 30000});
    check('debug panel mounted after the public machine-media event', await panel.count() === 1);
    await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
        ?.getAttribute('data-debug-phase') === 'running', null, {timeout: 30000});

    await panel.getByRole('button', {name: /Pause/}).click();
    await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
        ?.getAttribute('data-debug-phase') === 'paused', null, {timeout: 10000});
    await panel.locator('[data-debug-history] > summary').click();
    await panel.locator('[data-debug-record]').click();
    await panel.getByRole('button', {name: /Under the hood/}).click();
    const runTo = panel.locator('[data-run-to-address]');
    await runTo.waitFor({state: 'visible', timeout: 10000});
    check('run-to control appeared', await runTo.count() === 1);
    // The capability check can enable the control a moment after it appears;
    // wait (bounded) for the enabled state before judging it.
    await page.waitForFunction(() => document.querySelector('[data-run-to-address]')?.disabled === false,
        null, {timeout: 10000}).catch(() => {});
    check('run-to is capability-gated and enabled on the attached target', !(await runTo.isDisabled()));

    let promptSeen = '';
    page.once('dialog', async dialog => {
        promptSeen = dialog.message();
        const current = Number.parseInt(dialog.defaultValue().replace(/^0x/i, ''), 16);
        const next = current === 2 ? 5 : current === 5 ? 6 : 2;
        await dialog.accept(`0x${next.toString(16)}`);
    });
    // Latch the running phase before the click. This short ROM can go
    // paused -> running -> paused between two animation-frame polls, so a
    // polled wait could miss an honest running render. A MutationObserver sees
    // every attribute change; the gate still requires that running happened.
    await page.evaluate(() => {
        window.__bwSawRunning = false;
        const node = document.querySelector('[data-debug-panel]');
        const seen = () => { if (node?.getAttribute('data-debug-phase') === 'running') window.__bwSawRunning = true; };
        new MutationObserver(seen).observe(node, {attributes: true, attributeFilter: ['data-debug-phase']});
    });
    await runTo.click();
    await page.waitForFunction(() => window.__bwSawRunning === true, null, {timeout: 10000});
    await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
        ?.getAttribute('data-debug-phase') === 'paused', null, {timeout: 10000});
    check('run-to used the address prompt and returned to a paused before-boundary',
        /Run to address.*hex/i.test(promptSeen), promptSeen);
    await page.screenshot({path: join(artifacts, '01-run-to-paused.png'), fullPage: true});

    await panel.getByRole('button', {name: /Step instruction/}).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.querySelector('[data-debug-panel]')
        ?.getAttribute('data-debug-phase') === 'paused', null, {timeout: 10000});
    await panel.locator('[data-debug-timeline-refresh]').click();
    await panel.locator('[data-debug-timeline-latest]:not([disabled])').waitFor({timeout: 10000});
    await panel.locator('[data-debug-timeline-latest]').click();
    const inspection = panel.locator('[data-debug-selected-inspection]');
    await inspection.waitFor({state: 'visible', timeout: 10000});
    check('selected inspection appeared', await inspection.count() === 1);
    // Read the panes once the selection has rendered its recorded evidence,
    // not on the first frame the container is visible.
    await page.waitForFunction(() => {
        const root = document.querySelector('[data-debug-selected-inspection]');
        return root?.getAttribute('data-inspection-provenance') === 'recorded-event'
            && ['registers', 'disassembly', 'memory'].every(k =>
                (root.querySelector(`[data-debug-selected-${k}]`)?.innerText || '').trim().length > 0);
    }, null, {timeout: 10000}).catch(() => {});
    const evidence = await panel.evaluate(node => {
        const timeline = node.querySelector('[data-debug-timeline-controls]')?.innerText || '';
        const root = node.querySelector('[data-debug-selected-inspection]');
        const registers = root?.querySelector('[data-debug-selected-registers]')?.innerText || '';
        const disassembly = root?.querySelector('[data-debug-selected-disassembly]')?.innerText || '';
        const memory = root?.querySelector('[data-debug-selected-memory]')?.innerText || '';
        return {timeline, registers, disassembly, memory,
            provenance: root?.getAttribute('data-inspection-provenance') || ''};
    });
    check('timeline has a canonical selected event cursor', /Timeline:\s*#\d+\s+instruction\/retire/i.test(evidence.timeline),
        evidence.timeline.replace(/\s+/g, ' '));
    check('register pane is synchronized to recorded evidence',
        /recorded event/i.test(evidence.registers) && evidence.registers.trim().split('\n').length > 1,
        evidence.registers.replace(/\s+/g, ' '));
    check('disassembly pane is synchronized to the same recorded selection',
        /recorded event/i.test(evidence.disassembly) && !/No recorded instruction evidence/i.test(evidence.disassembly),
        evidence.disassembly.replace(/\s+/g, ' '));
    check('memory pane renders a truthful recorded-write value or explicit absence',
        /recorded writes/i.test(evidence.memory) && (/→/.test(evidence.memory) || /No recorded memory writes/.test(evidence.memory)),
        evidence.memory.replace(/\s+/g, ' '));
    check('inspection declares recorded-event provenance', evidence.provenance === 'recorded-event', evidence.provenance);
    await inspection.evaluate(node => node.scrollIntoView({block: 'center'}));
    await page.screenshot({path: join(artifacts, '02-synchronized-selected-panes.png'), fullPage: true});
} catch (error) {
    diagnostics.push(`gate: ${error.stack || error.message}`);
    results.push({name: 'complete browser journey', ok: false, detail: error.message});
    if (page) await page.screenshot({path: join(artifacts, 'failure.png'), fullPage: true}).catch(() => {});
} finally {
    await writeFile(join(artifacts, 'report.json'), `${JSON.stringify({url, results, diagnostics}, null, 2)}\n`);
    if (browser) await browser.close();
    if (server) await new Promise(done => server.close(done));
}

const failed = results.filter(result => !result.ok);
const didFail = failed.length > 0 || diagnostics.length > 0;
console.log(didFail ? `\n${failed.length} debugger browser check(s) failed.` : '\nDebugger browser proof passed.');
process.exit(didFail ? 1 : 0);
