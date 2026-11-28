#!/usr/bin/env node
// The staged interpreter, real editor methods/control JSX and real VduTerminal
// run in Chromium. The surrounding workbench/VM is an intentionally small shell;
// this does not claim a full production GUI bundle or full circuit qualification.
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
const boardSource = dirname(rootRequire.resolve('bw-board/board.js'));
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
    dynamic.set('/adapter.js', "export {createCrispBasicRunner} from '/test-gui/lib/crispbasic-runner.js';");
    dynamic.set('/test/circuit-fixture.js', await readFile(resolve(root, 'scripts/lib/crispbasic-circuit-fixture.mjs')));
    // Mount the production clock-owner handler against the small host shell.
    // The solver, adapter and ownership event code are real; the surrounding
    // React Circuit tab and its unrelated tools are outside this focused gate.
    const circuitSource = await readFile(resolve(gui, 'components/tw-pseudocode/circuit-tab.jsx'), 'utf8');
    const ownerStart = circuitSource.indexOf('        this._couplingHandler = event => {');
    const ownerEnd = circuitSource.indexOf('        this._couplingOpen = ', ownerStart);
    assert.ok(ownerStart >= 0 && ownerEnd > ownerStart, 'Circuit clock-owner harness boundary changed');
    dynamic.set('/test/circuit-owner.js', `export function mountCircuitOwner(runtime) {
        const host = {props: {vm: {runtime}}, state: {}, setState(patch, ready) {
            Object.assign(this.state, patch); ready?.();
        }};
        (function () {${circuitSource.slice(ownerStart, ownerEnd)}}).call(host);
        window.addEventListener('bw-circuit-clock-owner', host._couplingHandler);
        return host;
    }`);
    dynamic.set('/test/react.js', 'export default window.React;');
    dynamic.set('/test/react-dom-client.js', 'export const createRoot = window.ReactDOM.createRoot;');
    dynamic.set('/vendor/react.js', await readFile(resolve(dirname(rootRequire.resolve('react/package.json')), 'umd/react.production.min.js')));
    dynamic.set('/vendor/react-dom.js', await readFile(resolve(dirname(rootRequire.resolve('react-dom/package.json')), 'umd/react-dom.production.min.js')));
    dynamic.set('/vendor/vdu-decoder.js', await readFile(rootRequire.resolve('bw-board/vdu-decoder.js')));
    const html = `<!doctype html><meta charset="utf-8"><base href="/workbench/">
<title>Brickwright CrispBASIC integration verification</title>
<script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script>
<script type="importmap">{"imports":{"react":"/test/react.js","react-dom/client":"/test/react-dom-client.js","bw-board/vdu-decoder.js":"/vendor/vdu-decoder.js","bw-board/":"/vendor/bw-board/"}}</script>
<main id="editor"></main><script type="module">
import {mountCrispBasicEditor} from '/editor.js';
import {createCrispBasicCircuitFixture} from '/test/circuit-fixture.js';
import {mountCircuitOwner} from '/test/circuit-owner.js';
window.circuitFixture = createCrispBasicCircuitFixture();
circuitFixture.runtime.circuitBoard = null;
window.circuitOwner = mountCircuitOwner(circuitFixture.runtime);
window.installCircuitFixture = () => { circuitFixture.runtime.circuitBoard = circuitFixture.board; };
window.unmountEditor = mountCrispBasicEditor(document.getElementById('editor'), {vm: {runtime: circuitFixture.runtime}});
</script>`;
    server = createServer(async (request, response) => {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            let bytes, type = 'text/javascript';
            if (pathname === '/workbench/') { bytes = html; type = 'text/html'; }
            else if (dynamic.has(pathname)) bytes = dynamic.get(pathname);
            else if (pathname.startsWith('/test-gui/lib/') || pathname.startsWith('/vendor/bw-board/')) {
                const isBoard = pathname.startsWith('/vendor/bw-board/');
                const prefix = isBoard ? '/vendor/bw-board/' : '/test-gui/lib/';
                const directory = isBoard ? boardSource : resolve(gui, 'lib');
                const filename = resolve(directory, pathname.slice(prefix.length));
                const rel = relative(directory, filename);
                if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) { response.writeHead(403).end(); return; }
                bytes = await readFile(filename);
                type = mime.get(extname(filename)) || 'application/octet-stream';
            }
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

test('Connect Circuit runs ordinary BASIC against the displayed board and releases it on completion', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.evaluate(() => installCircuitFixture());
    const checkbox = page.locator('[data-testid="bw-crispbasic-connect-circuit"]');
    assert.equal(await checkbox.isChecked(), false);
    await checkbox.check();
    await page.locator('[data-testid="bw-crispbasic-source"]').fill(`PROCpinMode(13,"output")
PROCdigitalWrite(13,1)
PROCpinMode(2,"input-pullup")
PRINT STR$(FNdigitalRead(2))
PROCdelay(25)
PRINT STR$(FNmillis)
INPUT "" a$
PRINT STR$(FNdigitalRead(2))
END
`);
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor.state.basicInputMethod === 'line' ||
        !crispBasicEditor.state.running);
    const paused = await page.evaluate(() => ({
        diagnostic: crispBasicEditor.state.basicDiagnostic,
        waiting: crispBasicEditor.state.basicInputMethod,
        currentMa: -circuitFixture.board.branchCurrent('led', 'anode') * 1000,
        timeNs: circuitFixture.board.timeNs.toString(),
        clockOwned: Boolean(circuitFixture.board._externalClock),
        shownBoard: circuitOwner.state.board === circuitFixture.board
    }));
    assert.equal(paused.diagnostic, null);
    assert.equal(paused.waiting, 'line');
    assert.ok(paused.currentMa > 10 && paused.currentMa < 16, JSON.stringify(paused));
    assert.equal(paused.timeNs, '25000000');
    assert.equal(paused.clockOwned, true);
    assert.equal(paused.shownBoard, true);
    assert.equal(await checkbox.isDisabled(), true);
    await page.evaluate(() => circuitFixture.board.setControl('button', 1));
    await page.locator('[data-testid="bw-crispbasic-input"]').fill('continue');
    await page.locator('[data-testid="bw-crispbasic-send"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    const completed = await page.evaluate(() => ({output: crispBasicEditor.state.output,
        diagnostic: crispBasicEditor.state.basicDiagnostic,
        released: circuitFixture.board._externalClock === null,
        noOwner: !circuitFixture.runtime.bwCrispBasicSimulation,
        inputOnly: circuitFixture.board.getPinStates().every(pin => pin.mode === 'input'),
        power: circuitFixture.board.powered,
        shownBoard: circuitOwner.state.board
    }));
    assert.deepEqual(completed, {output: '1\r\n25\r\n\r\n0\r\n', diagnostic: null,
        released: true, noOwner: true, inputOnly: true, power: false, shownBoard: null});
});

test('Stop interrupts a solver delay without advancing or driving the circuit after cleanup', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.evaluate(() => installCircuitFixture());
    await page.locator('[data-testid="bw-crispbasic-connect-circuit"]').check();
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nPROCdelay(50000)\nPRINT "late"\nEND\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => circuitFixture.board.timeNs > 0n);
    await page.locator('[data-testid="bw-crispbasic-stop"]').click();
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    const stopped = await page.evaluate(() => ({time: circuitFixture.board.timeNs.toString(),
        output: crispBasicEditor.state.output, lease: Boolean(circuitFixture.board._externalClock),
        owner: Boolean(circuitFixture.runtime.bwCrispBasicSimulation),
        inputs: circuitFixture.board.getPinStates().every(pin => pin.mode === 'input')}));
    assert.ok(BigInt(stopped.time) > 0n && BigInt(stopped.time) < 50000000000n);
    assert.equal(stopped.output, '');
    assert.equal(stopped.lease, false);
    assert.equal(stopped.owner, false);
    assert.equal(stopped.inputs, true);
    await delay(40);
    assert.equal(await page.evaluate(() => circuitFixture.board.timeNs.toString()), stopped.time);
    const next = await runSource(page, 'PRINT STR$(FNmillis)\nPROCdelay(3)\nPRINT STR$(FNmillis)\nEND\n');
    assert.equal(next.output, '0\r\n3\r\n');
    assert.equal(next.diagnostic, null);
});

test('a missing Circuit board is an explicit refusal and unchecked ordinary BASIC remains usable', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    const checkbox = page.locator('[data-testid="bw-crispbasic-connect-circuit"]');
    await checkbox.check();
    const refused = await runSource(page, 'PROCpinMode(13,"output")\nEND\n');
    assert.ok(refused.diagnostic);
    assert.match(refused.diagnostic.message, /circuit|board/i);
    assert.equal(refused.output, '');
    assert.equal(await page.evaluate(() => Boolean(circuitFixture.runtime.bwCrispBasicSimulation)), false);
    await checkbox.uncheck();
    const ordinary = await runSource(page, 'PRINT "ordinary"\nEND\n');
    assert.equal(ordinary.output, 'ordinary\r\n');
    assert.equal(ordinary.diagnostic, null);
});

test('replacing the active board cancels its BASIC run without changing the replacement board', {timeout: 15000}, async t => {
    const {page} = await pageFor(t);
    await page.evaluate(() => installCircuitFixture());
    await page.locator('[data-testid="bw-crispbasic-connect-circuit"]').check();
    await page.locator('[data-testid="bw-crispbasic-source"]').fill('PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nINPUT "" a$\nPRINT "late"\nEND\n');
    await page.locator('[data-testid="bw-basic-run"]').click();
    await page.waitForFunction(() => crispBasicEditor.state.basicInputMethod === 'line');
    await page.evaluate(async () => {
        const {createCrispBasicCircuitFixture} = await import('/test/circuit-fixture.js');
        const replacement = createCrispBasicCircuitFixture().board;
        replacement.setPower(true);
        replacement.setPin('d13', 'pushpull', true);
        window.replacementBoard = replacement;
        circuitFixture.runtime.circuitBoard = replacement;
        window.dispatchEvent(new CustomEvent('bw-board-ready', {detail: {board: replacement}}));
    });
    await page.waitForFunction(() => !crispBasicEditor.state.running);
    const result = await page.evaluate(() => ({
        output: crispBasicEditor.state.output,
        oldLease: Boolean(circuitFixture.board._externalClock),
        current: circuitFixture.runtime.circuitBoard === replacementBoard,
        power: replacementBoard.powered, time: replacementBoard.timeNs.toString(),
        drive: replacementBoard.getPinStates().find(pin => pin.pin === 'd13')
    }));
    assert.deepEqual(result, {output: '', oldLease: false, current: true,
        power: true, time: '0', drive: {pin: 'd13', mode: 'pushpull', driveHigh: true}});
});
