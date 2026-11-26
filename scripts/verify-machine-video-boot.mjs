import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
// Local full-stack proof. Build the GUI first. The ELKS lesson fetches its
// pinned floppy by default. ELKS_IMG can substitute a local copy of that image.
const dist = fileURLToPath(new URL('../packages/scratch-gui/build', import.meta.url));
await readFile(resolve(dist, 'index.html'));
const localImage = process.env.ELKS_IMG ? await readFile(process.env.ELKS_IMG) : null;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
    '.json': 'application/json', '.svg': 'image/svg+xml'};
const server = createServer(async (req, res) => {
    try {
        const route = new URL(req.url, 'http://localhost').pathname;
        const file = resolve(dist, '.' + (route === '/' ? '/index.html' : route));
        if (!file.startsWith(dist + sep)) throw new Error('invalid route');
        const body = await readFile(file);
        res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch { res.writeHead(404).end(); }
});
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
let browser;
try {
    browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
    const page = await browser.newPage({viewport: {width: 1800, height: 1100}});
    page.on('dialog', dialog => dialog.accept());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (localImage) {
        await page.route('https://raw.githubusercontent.com/CrispStrobe/brickwright-media-lab/*/projects/elks/fd1440-fat.img',
            route => route.fulfill({body: localImage, contentType: 'application/octet-stream',
                headers: {'Access-Control-Allow-Origin': '*'}}));
    }
    await page.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', {value: undefined});
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '1');
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByText('Machines…', {exact: true}).click();
    const lesson = page.locator('[data-lesson-id="lesson-elks-i8086"]');
    await lesson.getByTestId('bw-mm-lesson-run').click();
    const canvas = page.getByTestId('bw-machine-canvas');
    await canvas.waitFor({timeout: 60000});
    const button = page.getByTestId('bw-machine-fullscreen');
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        if (!canvas) return false;
        const {data} = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < data.length; index += 4) {
            if (data[index] > 64 || data[index + 1] > 64 || data[index + 2] > 64) return true;
        }
        return false;
    }, null, {timeout: 90000});
    const before = await canvas.boundingBox();
    await button.click();
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        const box = canvas.getBoundingClientRect();
        const dock = canvas.closest('[data-testid="bw-controller-canvas"]');
        return box.width >= innerWidth - 3 && box.top <= 36 && Math.abs(box.bottom - innerHeight) <= 1 &&
            dock.scrollHeight === dock.clientHeight;
    }, null, {timeout: 5000});
    assert.equal(await button.innerText(), 'Exit full screen');
    const full = await canvas.boundingBox();
    await page.waitForFunction(() => document.activeElement?.dataset.testid === 'bw-machine-console');
    await button.click();
    await button.getByText('Full screen', {exact: true}).waitFor();
    const after = await canvas.boundingBox();
    assert.deepEqual(after, before, 'exit restores the docked geometry');
    assert.deepEqual(errors, []);
    console.log('ELKS canvas before / full screen / restored', before, full, after);
} finally {
    await browser?.close();
    await new Promise(resolveClosed => server.close(resolveClosed));
}
