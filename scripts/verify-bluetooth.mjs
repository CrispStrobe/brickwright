#!/usr/bin/env node
/**
 * Acceptance for the native Bluetooth path, in a real browser.
 *
 * The unit test (test/native-bluetooth.test.mjs) drives the shim against a DOM
 * double, which proves the protocol but says nothing about whether the panel
 * and the chooser actually RENDER — and "the diagnostics tool cannot be closed
 * on a phone" is exactly the kind of defect a DOM double cannot see. So this
 * runs the production bundle in Chromium, with `navigator.bluetooth` deleted
 * and `window.__TAURI__` faked, which is the environment inside the app.
 *
 *   node scripts/verify-bluetooth.mjs
 *   PROOF_URL=http://localhost:8617/ node scripts/verify-bluetooth.mjs
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};

let server = null;
let url = process.env.PROOF_URL || process.env.BW_URL || null;
if (!url) {
    if (!existsSync(join(build, 'index.html'))) throw new Error('Build first: packages/scratch-gui/build/index.html is missing');
    server = createServer(async (req, res) => {
        try {
            let path = decodeURIComponent(req.url.split('?')[0]);
            if (path.endsWith('/')) path += 'index.html';
            const file = join(build, normalize(path));
            if (!file.startsWith(build)) throw new Error('escape');
            // Read BEFORE the head goes out. Writing 200 and then failing to
            // read leaves the catch unable to send a 404 — writeHead throws
            // once headers are sent, and that throw escapes the handler and
            // kills the gate. A missing asset is one 404 line, not a crash.
            const body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch {
            console.log(`404 ${req.url}`);
            if (!res.headersSent) res.writeHead(404);
            res.end('not found');
        }
    });
    const first = Number(process.env.BW_PORT || 8171);
    let port = null;
    for (let p = first; p < first + 20 && port === null; p++) {
        try {
            await new Promise((done, fail) => {
                server.once('error', fail);
                server.listen(p, () => { server.removeListener('error', fail); done(); });
            });
            port = p;
        } catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
    }
    if (port === null) throw new Error('no free port');
    url = `http://localhost:${port}/`;
}

const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}});

// Be the app, not the browser: no Web Bluetooth, and a Tauri global. Chromium
// DOES implement Web Bluetooth, so without deleting it the shim correctly
// declines to install and this probe would test nothing.
await page.addInitScript(() => {
    // First-run starter overlay; it covers the menu bar and would swallow the
    // Settings click below.
    localStorage.setItem('bw-starter-v1-complete', '1');
    delete Navigator.prototype.bluetooth;
    window.__TAURI__ = {core: {invoke: () => Promise.resolve()}, event: {listen: () => {}}};
});

await page.goto(url, {waitUntil: 'domcontentloaded'});
await page.waitForFunction(() => !!window.__brickwrightDiagnostics, null, {timeout: 60000});

const env = await page.evaluate(() => window.__brickwrightDiagnostics.environment());
check('the shim replaced the missing Web Bluetooth',
    env['Web Bluetooth'] === 'Brickwright native shim', JSON.stringify(env['Web Bluetooth']));
check('requestDevice is callable',
    await page.evaluate(() => typeof navigator.bluetooth.requestDevice === 'function'));

// The route a user actually takes. Dispatching the event directly (below) would
// pass even if the menu item were never wired up, which is the kind of gap that
// leaves a diagnostics tool nobody can reach.
// The trigger by its test id: `[class*="settings"]` matched whichever element first
// carried "settings" in a class name, which stopped being the menu's trigger.
const settingsButton = page.getByTestId('bw-settings-menu-trigger');
let openedFromMenu = false;
if (await settingsButton.count() > 0) {
    await settingsButton.click();
    const item = page.getByText('Connection diagnostics…', {exact: false}).first();
    await item.waitFor({state: 'visible', timeout: 10000}).catch(() => {});
    if (await item.count() > 0) {
        await item.click();
        openedFromMenu = await page.waitForFunction(() =>
            (document.body.innerText || '').includes('Run Bluetooth self-test'), null, {timeout: 10000})
            .then(() => true, () => false);
    }
}
check('Settings → Connection diagnostics opens the panel', openedFromMenu);
if (openedFromMenu) {
    await page.evaluate(() => window.__brickwrightDiagnostics.close());
}

// The panel is the whole answer to "we need more debug info". It has to open,
// show the environment, and — the part a DOM double cannot check — be closable.
await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-open-ble-diagnostics')));
const panelText = await page.evaluate(() => (document.body.innerText || ''));
check('the diagnostics panel opens from the app event',
    panelText.includes('Connection diagnostics'));
check('the panel shows the environment report',
    panelText.includes('native app (Tauri)') && panelText.includes('Brickwright native shim'));
check('the panel captured startup logging',
    await page.evaluate(() => window.__brickwrightDiagnostics.entries().length > 0));

const closeBox = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Close');
    if (!button) return null;
    const r = button.getBoundingClientRect();
    return {top: r.top, right: r.right, width: r.width, height: r.height};
});
check('the panel has a Close button', !!closeBox);
// A control drawn off-screen or under the notch is a trap, not a control.
check('Close is on-screen and finger-sized',
    !!closeBox && closeBox.top >= 0 && closeBox.right <= 1280 && closeBox.width > 30 && closeBox.height > 24,
    JSON.stringify(closeBox));

await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(b => b.textContent === 'Close').click();
});
check('Close dismisses the panel',
    !(await page.evaluate(() => (document.body.innerText || '').includes('Run Bluetooth self-test'))));

// With no native service listening, the self-test must SAY so rather than hang
// or report a bare failure — that message is what a bug report will contain.
const report = await page.evaluate(async () => {
    window.__brickwrightDiagnostics.open();
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Run Bluetooth self-test');
    button.click();
    // Wait for the REPORT, not for the word "self-test" — the button is
    // labelled "Run Bluetooth self-test", so that string is on screen before
    // anything has run and this returned on the first poll every time. It only
    // ever passed because the self-test used to finish inside 250ms; the moment
    // it took longer, the gate asserted against a page with no report on it and
    // blamed Bluetooth.
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 250));
        // The button itself says "self-test" before and after the run. Wait
        // for the actual diagnostic field, or a fast failure can be mistaken
        // for a completed report and the useful error line is lost.
        if (document.body.innerText.includes('local Bluetooth service:')) return document.body.innerText;
    }
    return document.body.innerText;
});
check('the self-test reports the unreachable service by name',
    /local Bluetooth service: UNREACHABLE/.test(report),
    (report.match(/local Bluetooth service:.*/) || ['(no line)'])[0]);

await browser.close();
if (server) server.close();
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
