#!/usr/bin/env node
// The staged interpreter, real editor methods/control JSX and real VduTerminal
// run in Chromium. The surrounding workbench/VM is an intentionally small shell;
// this does not claim a full production GUI bundle or circuit qualification.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {dirname, extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import test, {before, after} from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {packageCrispBasic, CRISPBASIC_DESTINATION} from './package-crispbasic.mjs';
import {createCrispBasicEditorHarness} from './lib/crispbasic-editor-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRequire = createRequire(new URL('../packages/crisp-basic/package.json', import.meta.url));
const rootRequire = createRequire(new URL('../package.json', import.meta.url));
const gui = resolve(root, 'overlay/scratch-gui/src');
const mime = new Map([['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.wasm', 'application/wasm'], ['.json', 'application/json']]);
let browser, server, origin;
const dynamic = new Map();

before(async () => {
    await packageCrispBasic({check: true});
    const {transform} = packageRequire('esbuild');
    const source = await readFile(resolve(gui, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    // Parse the whole edited component too: the focused harness intentionally
    // includes only the controls and lifecycle methods that it exercises.
    await transform(source, {loader: 'jsx', format: 'esm', target: 'es2020'});
    dynamic.set('/editor.js', (await transform(createCrispBasicEditorHarness(source),
        {loader: 'jsx', format: 'esm', target: 'es2020'})).code);
    dynamic.set('/terminal.js', (await transform(await readFile(resolve(gui,
        'components/tw-pseudocode/vdu-terminal.jsx'), 'utf8'),
    {loader: 'jsx', format: 'esm', target: 'es2020'})).code);
    dynamic.set('/adapter.js', await readFile(resolve(gui, 'lib/crispbasic-runner.js')));
    dynamic.set('/test/react.js', 'export default window.React;');
    dynamic.set('/test/react-dom-client.js', 'export const createRoot = window.ReactDOM.createRoot;');
    dynamic.set('/vendor/react.js', await readFile(resolve(dirname(rootRequire.resolve('react/package.json')), 'umd/react.production.min.js')));
    dynamic.set('/vendor/react-dom.js', await readFile(resolve(dirname(rootRequire.resolve('react-dom/package.json')), 'umd/react-dom.production.min.js')));
    dynamic.set('/vendor/vdu-decoder.js', await readFile(rootRequire.resolve('bw-board/vdu-decoder.js')));
    const html = `<!doctype html><meta charset="utf-8"><base href="/workbench/">
<title>Brickwright CrispBASIC integration verification</title>
<script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script>
<script type="importmap">{"imports":{"react":"/test/react.js","react-dom/client":"/test/react-dom-client.js","bw-board/vdu-decoder.js":"/vendor/vdu-decoder.js"}}</script>
<main id="editor"></main><script type="module">
import {mountCrispBasicEditor} from '/editor.js';
window.unmountEditor = mountCrispBasicEditor(document.getElementById('editor'));
</script>`;
    server = createServer(async (request, response) => {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            let bytes, type = 'text/javascript';
            if (pathname === '/workbench/') { bytes = html; type = 'text/html'; }
            else if (dynamic.has(pathname)) bytes = dynamic.get(pathname);
            else if (pathname.startsWith('/workbench/static/crispbasic/')) {
                const filename = resolve(CRISPBASIC_DESTINATION, pathname.slice('/workbench/static/crispbasic/'.length));
                const rel = relative(CRISPBASIC_DESTINATION, filename);
                if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) { response.writeHead(403).end(); return; }
                bytes = await readFile(filename);
                type = mime.get(extname(filename)) || 'application/octet-stream';
            } else { response.writeHead(404).end(); return; }
            response.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'});
            response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 400).end(); }
    });
    await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
    origin = `http://127.0.0.1:${server.address().port}/workbench/`;
    const override = process.env.CRISP_BASIC_PLAYWRIGHT;
    const moduleName = override && isAbsolute(override) ? pathToFileURL(override).href : override;
    const {chromium} = moduleName ? await import(moduleName) : packageRequire('playwright');
    browser = await chromium.launch({headless: true,
        ...(process.env.CRISP_BASIC_CHROMIUM ? {executablePath: process.env.CRISP_BASIC_CHROMIUM} : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage']});
}, {timeout: 30000});

after(async () => {
    try { await browser?.close(); }
    finally {
        if (server?.listening) {
            server.closeAllConnections();
            await new Promise((yes, no) => server.close(error => error ? no(error) : yes()));
        }
    }
});

async function pageFor (t, setup) {
    const page = await browser.newPage();
    const errors = [], requests = [], workers = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    page.on('worker', worker => { workers.add(worker); worker.once('close', () => workers.delete(worker)); });
    t.after(async () => {
        try {
            await page.evaluate(() => window.unmountEditor?.());
            const until = Date.now() + 3000;
            while ((workers.size || page.workers().length) && Date.now() < until) await delay(10);
            assert.equal(workers.size, 0, 'editor left a live worker after unmount');
            assert.equal(page.workers().length, 0);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
    if (setup) await setup(page);
    await page.goto(origin);
    await page.waitForFunction(() => Boolean(window.crispBasicEditor));
    return {page, requests};
}

async function runSource (page, source) {
    await page.locator('[data-testid="bw-crispbasic-source"]').fill(source);
    const previous = await page.evaluate(() => crispBasicEditor.state.basicOutputRunId);
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(previous => crispBasicEditor.state.basicOutputRunId > previous &&
        !crispBasicEditor.state.running, previous);
    return page.evaluate(() => ({output: crispBasicEditor.state.output,
        raw: crispBasicEditor.state.basicRawOutput, status: crispBasicEditor.state.status,
        diagnostic: crispBasicEditor.state.basicDiagnostic, runId: crispBasicEditor.state.basicOutputRunId}));
}

test('browser loads the engine on Run and executes actual generated BBC BASIC below a URL prefix', {timeout: 15000}, async t => {
    const {page, requests} = await pageFor(t);
    assert.equal(requests.some(url => url.includes('/static/crispbasic/')), false);
    const creator = new SB3Creator();
    creator.parse('WHEN flag clicked:\n  print "HELLO"\n  REPEAT 3:\n    print "X"');
    const generated = creator.generateBASIC(creator.project, {profile: 'bbc', lineNumbers: false});
    assert.equal(generated.ok, true);
    const result = await runSource(page, generated.basic);
    assert.equal(result.output, 'HELLO\r\nX\r\nX\r\nX\r\n');
    assert.equal(result.diagnostic, null);
    assert.ok(requests.some(url => url.endsWith('/workbench/static/crispbasic/browser.mjs')));
    assert.equal(await page.evaluate(() => crossOriginIsolated), false);
    assert.equal(await page.locator('[data-testid="bw-basic-run"]').isEnabled(), true);
});

test('real VDU output paints the mounted renderer and survives an identical second run', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    const source = 'MODE 0\nGCOL 0,1\nMOVE 0,0\nDRAW 640,512\nEND\n';
    const first = await runSource(page, source);
    assert.equal(first.diagnostic, null);
    const pixel = () => page.locator('[data-testid="bw-vdu-terminal"] canvas').evaluate(canvas =>
        [...canvas.getContext('2d').getImageData(80, 192, 1, 1).data]);
    const colour = await pixel();
    assert.ok(colour[0] > 200 && colour[1] < 20 && colour[2] < 20, JSON.stringify(colour));
    const second = await runSource(page, source);
    assert.equal(second.raw, first.raw);
    assert.ok(second.runId > first.runId);
    assert.deepEqual(await pixel(), colour);
});

test('the input form resumes recursion and clears its waiting state', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('PRINT FNask(3)\nEND\nDEF FNask(n%)\nLOCAL a$\nIF n%>0 THEN =FNask(n%-1)\nINPUT "" a$\n=a$\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor.state.basicInputMethod === 'line');
    await page.locator('[data-testid="bw-crispbasic-input"]').fill('Ada');
    await page.locator('[data-testid="bw-crispbasic-send"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    assert.equal(await page.evaluate(() => crispBasicEditor.state.output), '\r\nAda\r\n');
    assert.equal(await page.evaluate(() => crispBasicEditor.state.basicInputMethod), null);
});

test('key input preserves Latin-1 and End input reaches BASIC error handling', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('a$=GET$\nPRINT a$\nEND\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor.state.basicInputMethod === 'key');
    await page.locator('[data-testid="bw-crispbasic-input"]').fill('é');
    await page.locator('[data-testid="bw-crispbasic-send"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    assert.equal(await page.evaluate(() => crispBasicEditor.state.output), 'é\r\n');
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('ON ERROR PRINT "closed":END\nINPUT "" a$\nEND\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor.state.basicInputMethod === 'line');
    await page.locator('[data-testid="bw-crispbasic-end-input"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    assert.equal(await page.evaluate(() => crispBasicEditor.state.output), 'closed\r\n');
    assert.equal(await page.evaluate(() => crispBasicEditor.state.basicDiagnostic), null);
});

test('Stop remains responsive during a tight C loop; Reset and the next run release the old worker', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('REPEAT\nUNTIL FALSE\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor._crispBasicRun?.runner?.state === 'running');
    const ticks = await page.evaluate(async () => {
        let ticks = 0; const timer = setInterval(() => ticks++, 5);
        await new Promise(resolve => setTimeout(resolve, 80)); clearInterval(timer); return ticks;
    });
    assert.ok(ticks >= 3);
    await page.locator('[data-testid="bw-crispbasic-stop"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    await page.locator('[data-testid="bw-crispbasic-reset"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.basicResetting);
    const result = await runSource(page, 'PRINT "fresh"\nEND\n');
    assert.equal(result.output, 'fresh\r\n'); assert.equal(result.diagnostic, null);
});

test('source errors expose the filename and physical line, while Latin-1 stays exact', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.evaluate(() => new Promise(resolve => crispBasicEditor.setState({basicFilename: 'lesson.bas'}, resolve)));
    const error = await runSource(page, '100 REM first\n\n450 ERROR 100,"expected"\n');
    assert.equal(error.diagnostic.line, 3);
    assert.match(error.diagnostic.message, /lesson\.bas:3: expected/);
    const text = await runSource(page, 'PRINT "é"\nVDU 128,255\nEND\n');
    assert.equal(text.output, 'é\r\n\x80\xff');
    assert.equal(text.raw, text.output);
});

test('missing packaged engine produces actionable feedback without a Z80 fallback', {timeout: 15000}, async t => {
    const {page, requests} = await pageFor(t, page => page.route('**/static/crispbasic/browser.mjs', route =>
        route.fulfill({status: 404, body: 'missing runtime'})));
    const result = await runSource(page, 'PRINT "missing"\nEND\n');
    assert.match(result.diagnostic.message, /npm run build:crispbasic/);
    assert.equal(result.output, '');
    assert.equal(requests.some(url => /bbcbasic\.com|basic\.rom/.test(url)), false);
    assert.equal(await page.locator('[data-testid="bw-basic-run"]').isEnabled(), true);
});

test('unmount while awaiting input terminates the interpreter worker', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('INPUT "" a$\nEND\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor.state.basicInputMethod === 'line');
    await page.evaluate(() => window.unmountEditor());
    // pageFor's cleanup asserts browser-level worker ownership is empty.
});
