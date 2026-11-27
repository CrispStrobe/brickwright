#!/usr/bin/env node
/** The micro:bit WebUSB flash button, through the real UI (N9).
 *
 *  The unit test (test/microbit-daplink-flash.test.mjs) proves the flash
 *  ALGORITHM against a mock DAP: the exact nRF52833 NVMC erase/program sequence
 *  and the by-name refusal of a wrong part. A real board is manual and recorded
 *  — CI has no probe to grant. So this proves the other half that a mock cannot:
 *  that the "⚡ flash the micro:bit" button is actually wired into the Code tab,
 *  that it appears ONLY where WebUSB exists (T7: the device fact lives in
 *  capabilities.js, and the button honours it), and that pressing it with no
 *  probe granted refuses BY NAME on the status line rather than throwing.
 *
 *  Two contexts:
 *   - WebUSB present, requestDevice rejects (nothing granted) → the button is
 *     shown and the status becomes the same "no port chosen" refusal WebSerial
 *     gives. Judged by the status text.
 *   - WebUSB absent → the button does not render at all.
 *
 *  Skips (exit 0) when there is no local build. Never starts a browser it cannot
 *  drive.
 */
import {openCodeInfo} from './lib-code-actions.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const port = 8131;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};

const PROOF_URL = process.env.PROOF_URL || null;
if (!PROOF_URL && !existsSync(build)) {
    console.log('SKIP — verify-microbit-flash: no local build (packages/scratch-gui/build). Pass PROOF_URL to drive a deployed app.');
    process.exit(0);
}

const server = PROOF_URL ? null : createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        if (path.endsWith('/')) path += 'index.html';
        const file = join(build, normalize(path));
        if (!file.startsWith(build)) throw new Error('escape');
        const body = await readFile(file);
        res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch { if (!res.headersSent) res.writeHead(404); res.end('not found'); }
});
if (server) await new Promise(done => server.listen(port, done));
const APP = PROOF_URL || `http://localhost:${port}/`;
console.log(`driving ${APP}${PROOF_URL ? ' (PROOF_URL)' : ''}`);

const browser = await chromium.launch();
const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

async function waitFor (read, accept, timeoutMs = 60000, stepMs = 250) {
    const end = Date.now() + timeoutMs;
    let last;
    do { try { last = await read(); } catch (e) { last = {error: String((e && e.message) || e)}; }
        if (accept(last)) return last; await new Promise(r => setTimeout(r, stepMs)); } while (Date.now() < end);
    return last;
}

/**
 * Open the app with WebUSB either rejecting every probe (`present`) or absent,
 * drive Code tab → select micro:bit → type a program → micro:bit tab, and stop
 * once the MicroPython bar (which hosts the flash button) is on screen.
 */
async function openToMicropythonBar (present) {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    const pageErrors = [];
    page.on('pageerror', e => { pageErrors.push(String(e).slice(0, 200)); console.log(`PAGEERR ${String(e).slice(0, 160)}`); });
    // Pin the WebUSB fact BEFORE the app loads: either a usb whose requestDevice
    // rejects (a granted-nothing probe), or no usb at all. defineProperty on the
    // instance shadows the Navigator.prototype getter Chromium may ship.
    await page.addInitScript((hasUsb) => {
        try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1'); } catch (e) { /* private mode */ }
        try {
            Object.defineProperty(navigator, 'usb', {
                configurable: true,
                value: hasUsb
                    ? {requestDevice: () => Promise.reject(new DOMException('No device selected.', 'NotFoundError'))}
                    : undefined
            });
        } catch (e) { /* leave the platform's usb as-is */ }
    }, present);

    await page.goto(APP, {waitUntil: PROOF_URL ? 'domcontentloaded' : 'networkidle', timeout: 60000});
    // Reach the Code tab exactly as the Pico gate does — the tab role plus a
    // hasText OPTION, never a `text=` engine wedged into a CSS comma list
    // (Playwright rejects that as a CSS parse error before the page is driven).
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();

    const deviceSelect = page.locator('select[title*="Target device"]').first();
    await waitFor(() => deviceSelect.count(), c => c > 0, 60000);
    await deviceSelect.selectOption('microbit');

    // setDevice is asynchronous: it may retarget the starter before committing
    // DEVICE MICROBIT. Wait until that operation has released the language row
    // before editing, or its late commit can overwrite the program typed here.
    const microbitTab = page.locator('button', {hasText: 'micro:bit'}).first();
    await waitFor(() => microbitTab.count(), c => c > 0, 60000);
    const deviceReady = await waitFor(() => microbitTab.isEnabled().catch(() => false), v => v === true, 60000);
    if (deviceReady !== true) throw new Error('micro:bit device selection never released the language row');
    const cm = page.locator('.cm-content:visible, textarea:visible').first();
    await waitFor(() => cm.isVisible().catch(() => false), v => v === true, 60000);
    await cm.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText('DEVICE MICROBIT\nPIN led = P0 OUTPUT\n\nWHEN flag clicked:\n  turn on led\n  print "hi"\n');
    const sourceReady = await waitFor(() => cm.innerText().catch(() => ''),
        text => /DEVICE MICROBIT/.test(text) && /print "hi"/.test(text), 60000);
    if (!/DEVICE MICROBIT/.test(sourceReady || '') || !/print "hi"/.test(sourceReady || '')) {
        throw new Error('the pseudocode editor did not commit the micro:bit fixture');
    }

    // The tab conversion produces the read-only MicroPython preview; that is
    // the buffer the flash controls consume. Do not type into that preview.
    await microbitTab.click();
    const bar = page.locator('[data-testid="bw-micropython-bar"]').first();
    await waitFor(() => bar.count(), c => c > 0, 60000);
    return {page, pageErrors};
}

let skip = null;
try {
    // ── Context 1: WebUSB present but nothing granted ──
    const {page, pageErrors} = await openToMicropythonBar(true);
    const flashBtn = page.locator('[data-testid="bw-microbit-flash-webusb"]').first();
    const shown = await waitFor(() => flashBtn.isVisible().catch(() => false), v => v === true, 30000);
    check('the "flash the micro:bit" button appears when WebUSB is available', shown === true);

    if (shown === true) {
        const enabled = await waitFor(() => flashBtn.isEnabled().catch(() => false), v => v === true, 60000);
        if (enabled !== true) throw new Error('generated MicroPython never enabled the WebUSB flash control');
        await flashBtn.click();
        const status = (await openCodeInfo(page)).getByTestId('bw-code-status');
        // The device-first handler maps a rejected requestDevice straight to the
        // by-name refusal — no firmware picker, no throw.
        const text = await waitFor(
            () => status.innerText().catch(() => ''),
            t => /No port chosen|Kein Port gewählt/.test(t), 30000);
        check('flashing with no probe granted refuses by name on the status line',
            /No port chosen|Kein Port gewählt/.test(text), `status: ${JSON.stringify(String(text).slice(0, 80))}`);
    }
    check('nothing threw while wiring/pressing the flash button', pageErrors.length === 0, pageErrors.join(' // ').slice(0, 200));
    await page.close();

    // ── Context 2: WebUSB absent → the button must not render ──
    const {page: page2, pageErrors: errs2} = await openToMicropythonBar(false);
    // The .hex download button proves the bar itself is present; the WebUSB
    // button beside it must be gone, not merely hidden.
    await waitFor(() => page2.locator('[data-testid="bw-microbit-download-hex"]').count(), c => c > 0, 30000);
    const webusbCount = await page2.locator('[data-testid="bw-microbit-flash-webusb"]').count();
    check('the WebUSB flash button does NOT render when WebUSB is absent', webusbCount === 0,
        `found ${webusbCount}`);
    check('nothing threw in the no-WebUSB context', errs2.length === 0, errs2.join(' // ').slice(0, 200));
    await page2.close();

    await browser.close();
    if (server) server.close();
    if (failures.length) { console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`); process.exit(1); }
    console.log('\nOK — the micro:bit flash button is WebUSB-gated in the real UI and refuses by name when no probe is granted.');
    process.exit(0);
} catch (e) {
    await browser.close().catch(() => {});
    if (server) server.close();
    if (skip) { console.log(`SKIP — ${skip}`); process.exit(0); }
    console.error(`verify-microbit-flash threw: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
}
