/**
 * Live Playwright/chromium check for the Machine Manager UI (design §4.6).
 *
 * Opens the code-tab device dropdown's "Manage machines…" entry, confirms the
 * library modal renders, imports a machine from a pasted manifest, and confirms
 * the row appears — with zero page errors across the trip. Same serve+launch
 * shape as verify-matrix-ui.mjs: a production build (npm run build:gui), served
 * here unless PROOF_URL points at a running one.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.map': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};

let url = process.env.PROOF_URL || null;
let server = null;
if (!url) {
    if (!existsSync(join(build, 'index.html'))) throw new Error('Build first: packages/scratch-gui/build/index.html is missing');
    server = createServer(async (req, res) => {
        try {
            let path = decodeURIComponent((req.url || '/').split('?')[0]);
            if (path === '/' || path.endsWith('/')) path += 'index.html';
            const file = join(build, normalize(path));
            if (!file.startsWith(build)) throw new Error('escape');
            const body = await readFile(file);
            res.writeHead(200, {'content-type': MIME[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch { res.writeHead(404); res.end('not found'); }
    });
    let port = null;
    for (let p = 8660; p < 8680 && port === null; p++) {
        try {
            await new Promise((done, fail) => {
                server.once('error', fail);
                server.listen(p, () => { server.removeListener('error', fail); done(); });
            });
            port = p;
        } catch { /* busy */ }
    }
    if (port === null) throw new Error('no free port');
    url = `http://localhost:${port}/`;
}

const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

const MANIFEST = JSON.stringify({
    title: 'MM Test 8086', machine: 'i8086', machineConfig: 'PCXT8086',
    slots: {floppy: 'test.img'}, boot: true
});

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
});
try {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
    page.on('dialog', d => d.accept());
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String((e && e.message) || e)));
    await page.addInitScript(() => {
        try {
            localStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');
            sessionStorage.clear();
            indexedDB.deleteDatabase('bw-machines');
        } catch { /* private mode */ }
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 60000});

    // The dropdown offers "Manage machines…" and selecting it opens the modal.
    await device.selectOption('__manage__');
    const modal = page.getByTestId('bw-machine-manager');
    await modal.waitFor({state: 'visible', timeout: 15000});
    check('the "Manage machines…" entry opens the library modal', await modal.isVisible());

    // Import a machine from a pasted manifest; a row must appear.
    await page.getByTestId('bw-mm-import-text').fill(MANIFEST);
    await page.getByTestId('bw-mm-import').click();
    const row = page.getByTestId('bw-mm-row').filter({hasText: 'MM Test 8086'});
    await row.waitFor({state: 'visible', timeout: 10000});
    check('importing a manifest adds it to the library', (await row.count()) >= 1);
    const status = (await page.getByTestId('bw-mm-status').textContent()) || '';
    check('the import reports success', /import/i.test(status), status);

    // Run + Close controls are present on the row / modal.
    check('the row exposes a Run control', (await page.getByTestId('bw-mm-run').count()) >= 1);
    await page.getByTestId('bw-mm-close').click();
    await modal.waitFor({state: 'detached', timeout: 5000}).catch(() => {});
    check('closing the modal removes it', (await page.getByTestId('bw-machine-manager').count()) === 0);

    check('no page errors across the trip', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} finally {
    await browser.close();
    if (server) server.close();
}

if (failures.length) { console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`); process.exit(1); }
console.log('\nall machine-manager UI checks passed');
