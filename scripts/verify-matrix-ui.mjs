#!/usr/bin/env node
/**
 * Acceptance for the language x device matrix in the Code tab (plan task T4).
 *
 * Two surfaces read lib/bw-matrix/capabilities.js: the badge beside the device
 * picker (the chosen language on the chosen chip) and the "What runs where"
 * panel (every language on one device per chip family). This gate checks that
 * both are wired to the SAME table the docs are generated from, by asserting
 * three cells whose truth the conformance tests already hold to source:
 *
 *   python x pico       both     (MicroPython native on silicon; lowered via C)
 *   python x stm32f030  lowered  (no interpreter fits; C carries the cell)
 *   asm    x microbit   none     (open: N4 — the hosted chain exists, lite does not route to it)
 *
 * Runs against a production build (npm run build:gui). With no PROOF_URL this
 * serves packages/scratch-gui/build itself; with one it drives whatever is
 * already there, which is how the CI gates are wired.
 *   node scripts/verify-matrix-ui.mjs
 *   PROOF_URL=http://localhost:8617/ node scripts/verify-matrix-ui.mjs
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};

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
            const body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end();
        }
    });
    let port = null;
    for (let p = 8640; p < 8660 && port === null; p++) {
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

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
    page.on('dialog', d => d.accept());
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 60000});

    const info = page.getByTestId('bw-code-info');
    const capabilities = page.getByTestId('bw-code-device-capabilities');
    const popover = page.getByTestId('bw-code-info-popover');
    await info.click();
    check('Code help does not invent a device', (await capabilities.count()) === 0);
    await info.click();
    await device.selectOption('pico');
    check('capabilities are not exposed in a second toolbar button', (await page.getByTestId('bw-matrix-badge').count()) === 0);
    check('Code help stays closed until asked', (await popover.count()) === 0);
    await info.click();
    const capabilityText = (await capabilities.textContent()) || '';
    check('Code help shows the device summary and sentence',
        /lowered via/.test(capabilityText) && /Pseudocode on Raspberry Pi Pico:/.test(capabilityText), capabilityText);
    await info.click();
    await popover.waitFor({state: 'detached', timeout: 5000});

    // The panel: one column per chip family, one row per language.
    await page.getByTestId('bw-matrix-toggle').click();
    const panel = page.getByTestId('bw-matrix-panel');
    await panel.waitFor({state: 'visible', timeout: 15000});
    const pickerDeviceSet = [...new Set(await device.locator('option').evaluateAll(options =>
        // Machine launch actions use their own workspace, outside the compiler matrix.
        options.filter(option => option.value && !option.hasAttribute('data-machine-launch'))
            .map(option => option.value)))].sort();
    const panelDeviceSet = [...new Set(((await panel.getAttribute('data-device-ids')) || '')
        .split(' ').filter(Boolean))].sort();
    check('picker and panel expose the same device set',
        JSON.stringify(pickerDeviceSet) === JSON.stringify(panelDeviceSet),
        `picker=${pickerDeviceSet.join(',')} panel=${panelDeviceSet.join(',')}`);
    const rows = await panel.locator('tbody tr').count();
    const cols = await panel.locator('thead th').count() - 1;
    check('one row per language', rows === 7, `${rows}`);
    check('one column per chip family', cols === 11, `${cols}`);   // riscv32 joined 2026-09-25, esp8266 2026-10-14

    const kind = async (lang, dev) => page.getByTestId(`bw-matrix-cell-${lang}-${dev}`).getAttribute('data-kind');
    const text = async (lang, dev) => (await page.getByTestId(`bw-matrix-cell-${lang}-${dev}`).textContent()) || '';
    check('python x pico is both native and lowered', (await kind('python', 'pico')) === 'both', await text('python', 'pico'));
    check('python x stm32f030 is lowered only', (await kind('python', 'stm32f030')) === 'lowered', await text('python', 'stm32f030'));
    // N4 closed the last cell with no path at all (asm x micro:bit, now hosted
    // nrf52833); an open native path still names its task, in the title.
    check('asm x microbit is native since N4', (await kind('asm', 'microbit')) === 'native', await text('asm', 'microbit'));
    const cMicrobit = (await page.getByTestId('bw-matrix-cell-c-microbit').getAttribute('title')) || '';
    check('an open path names its task (c x microbit: N7)', /open · task N7/.test(cMicrobit), cMicrobit.slice(0, 160));
    check('c x i8086 is native (SmallerC + NASM front end)', /native/.test(await text('c', 'i8086')), await text('c', 'i8086'));

    // Choosing a device that is not its family's first adds a column for it,
    // so the learner sees THEIR chip, not a stand-in.
    await device.selectOption('stc89c52');
    const c89cell = page.getByTestId('bw-matrix-cell-c-stc89c52');
    await c89cell.waitFor({state: 'visible', timeout: 10000});
    const cols2 = await panel.locator('thead th').count() - 1;
    check('a non-representative device gets its own column', cols2 === 12, `${cols2}`);
    const c89 = (await c89cell.getAttribute('title')) || '';
    check('the STC89C52 override reaches the panel', /hosted compiler/.test(c89), c89.slice(0, 120));
    const c60 = (await page.getByTestId('bw-matrix-cell-c-stc12c5a60s2').getAttribute('title')) || '';
    check('the panel carries the verification tier and the oracle\'s census status (T8)', /tier 2a \(emu8051: standing in bw-board CI\)/.test(c60), c60.slice(0, 160));
    check('its sibling still compiles in the browser', /in the browser/.test(c60), c60.slice(0, 120));

    // The panel and the badge must also GO AWAY: toggling off removes the
    // panel, and clearing the device removes the badge. Appearance alone
    // proves nothing about a toggle.
    await page.getByTestId('bw-matrix-toggle').click();
    let gone = true;
    await panel.waitFor({state: 'detached', timeout: 5000}).catch(() => { gone = false; });
    check('toggling again removes the panel', gone);
    await device.selectOption('');
    let badgeGone = true;
    await badge.waitFor({state: 'detached', timeout: 5000}).catch(() => { badgeGone = false; });
    check('clearing the device removes the badge', badgeGone);

    check('no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
} finally {
    await browser.close();
    if (server) server.close();
}
if (failures.length) {
    console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
    process.exit(1);
}
console.log('\nverify-matrix-ui: all checks passed');
