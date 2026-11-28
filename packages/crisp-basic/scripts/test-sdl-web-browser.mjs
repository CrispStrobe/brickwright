#!/usr/bin/env node
// Packaging parity: the full SDL host loaded as separate runtime/source files
// is compared byte-for-byte with the generated single document while offline.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {bundleSDLWeb} from '../src/bundle-sdl-web.mjs';
import {prepareSource} from '../src/source.mjs';
import {serveBundle} from '../src/serve-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimePack = resolve(process.env.CRISP_BASIC_SDL_WEB_PACK || join(root, '.build/sdl-web'));
let browser, temporary, runtimeJS, runtimeWasm;
const headers = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
};
before(async () => {
    const override = process.env.CRISP_BASIC_PLAYWRIGHT;
    const {chromium} = await import(override && isAbsolute(override) ? pathToFileURL(override).href : override || 'playwright');
    temporary = await mkdtemp(join(tmpdir(), 'crisp-sdl-browser-'));
    const receipt = JSON.parse(await readFile(join(runtimePack, 'build.json'), 'utf8'));
    [runtimeJS, runtimeWasm] = await Promise.all([
        readFile(join(runtimePack, receipt.module)), readFile(join(runtimePack, receipt.wasm))
    ]);
    browser = await chromium.launch({headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        ...(process.env.CRISP_BASIC_CHROMIUM ? {executablePath: process.env.CRISP_BASIC_CHROMIUM} : {})});
});
after(async () => {
    if (browser) await browser.close();
    if (temporary) await rm(temporary, {recursive: true, force: true});
});

const fixtures = [
    {name: 'EVAL and raw memory', source: 'DIM m% 4\n?m%=65\nPRINT "SDL:";EVAL("6*7");CHR$(?m%)\nEND', text: 'SDL:42A\r\n'},
    {name: 'structured control and dynamic LOCAL', source: 'DIM a%(2)\nFOR i%=0 TO 2:a%(i%)=i%*i%:NEXT\nPROCsum\nEND\nDEF PROCsum\nLOCAL i%\nFOR i%=0 TO 2:PRINT ;FNdouble(a%(i%)):NEXT\nENDPROC\nDEF FNdouble(x%)=x%*2', text: '0\r\n2\r\n8\r\n'},
    {name: 'SDL graphics and point readback', source: 'MODE 8\nGCOL 0,1\nRECTANGLE FILL 0,0,100,100\nPRINT POINT(20,20)\nEND', tail: '         1\r\n'},
    {name: 'upstream WebAssembly SYS wrapper', source: 'DIM v% 3\nSYS "SDL_memset",v%,90,3\nPRINT ;?v%\nEND', text: '90\r\n'},
    {name: 'queued keyboard INPUT', source: 'INPUT "" name$\nPRINT name$\nEND', input: 'Ada\n', tail: 'Ada\r\n'},
    {name: 'binary resources and virtual output files', source: 'f%=OPENIN("data/input.bin")\nREPEAT\nx%=BGET#f%\nPRINT ;x%\nUNTIL EOF#f%\nCLOSE#f%\nf%=OPENOUT("result.bin")\nBPUT#f%,254\nCLOSE#f%\nEND',
        asset: [0, 13, 255, 65], text: '0\r\n13\r\n255\r\n65\r\n', file: '/result.bin', fileBytes: [254]},
    {name: 'SOUND and ENVELOPE produce PCM samples', source: 'ENVELOPE 1,1,0,0,0,0,0,0,126,0,-126,-126,126,126\nSOUND 1,1,53,10\nWAIT 30\nPRINT "sound complete"\nEND', text: 'sound complete\r\n', audio: true},
    {name: 'raw VDU byte capture', source: 'VDU 0,255\nPRINT "bytes"\nEND', bytes: [0, 255, 98, 121, 116, 101, 115, 13, 10]},
    {name: 'optional Box2D is an explicit unknown SYS', source: 'ON ERROR PRINT "unavailable:";ERR:END\nSYS "B2D_GetProcAddress"\nEND', text: 'unavailable:51\r\n'},
    {name: 'upstream WebAssembly assembler refusal', source: 'ON ERROR PRINT REPORT$:END\nDIM code% 32\nP%=code%\n[\n]\nEND', text: 'Assembler code is not supported in WebAssembly\r\n'}
];

async function referenceServer(fixture) {
    // Deliberately do not reuse the page renderer or its embedded payload.
    const html = `<!doctype html><link rel="icon" href="data:,"><button id="start">Start</button><canvas id="canvas" width="640" height="500"></canvas><script src="/runtime.js"></script><script>
document.getElementById('start').onclick=async()=>{
 try {
  const program=new Uint8Array(await(await fetch('/program.bas')).arrayBuffer());
  const asset=new Uint8Array(await(await fetch('/asset.bin')).arrayBuffer());
  const m=await createCrispBasicSDL({canvas:document.getElementById('canvas'),arguments:['/program.bas'],
   mainScriptUrlOrBlob:location.origin+'/runtime.js',locateFile:n=>'/runtime.wasm',print:()=>{},printErr:()=>{},
   preRun:[m=>{m.FS.mkdirTree('/lib');m.FS.mkdirTree('/data');m.FS.writeFile('/program.bas',program);m.FS.writeFile('/data/input.bin',asset);
    m.ENV.CRISP_BASIC_SOURCE='/program.bas';m.ENV.CRISP_BASIC_BATCH='1';m.ENV.CRISP_BASIC_CAPTURE_VDU='1';}]});
  if(m._crisp_sdl_startup_failed())throw Error('reference initialization failed');
  for(const ch of ${JSON.stringify(fixture.input || '')}.replace(/\\r\\n?/g,'\\n')) {
   const byte=ch==='\\n'?13:ch.charCodeAt(0);while(!m._crisp_sdl_write_key(byte))await new Promise(r=>setTimeout(r,5));
  }
  const timer=setInterval(()=>{if(!m._crisp_sdl_finished())return;clearInterval(timer);
   const p=m._crisp_sdl_output(),n=m._crisp_sdl_output_length();
   window.referenceResult={status:'completed',exitCode:m._crisp_sdl_exit_code(),output:Array.from(m.HEAPU8.slice(p,p+n))};},10);
 }catch(e){window.referenceResult={status:'failed',error:String(e)};}
};</script>`;
    const routes = new Map([
        ['/', [Buffer.from(html), 'text/html']], ['/runtime.js', [runtimeJS, 'text/javascript']],
        ['/runtime.wasm', [runtimeWasm, 'application/wasm']],
        ['/program.bas', [Buffer.from(prepareSource(fixture.source).numberedSource, 'latin1'), 'application/octet-stream']],
        ['/asset.bin', [Buffer.from(fixture.asset || []), 'application/octet-stream']]
    ]);
    const server = createServer((request, response) => {
        const route = routes.get(request.url);
        response.writeHead(route ? 200 : 404, {...headers, 'Content-Type': route?.[1] || 'text/plain'});
        response.end(route?.[0] || 'Not found');
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return {url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve))};
}

async function observeAudio(context) {
    await context.addInitScript(() => {
        window.observedAudioSamples = 0;
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        const original = Audio.prototype.createScriptProcessor;
        Audio.prototype.createScriptProcessor = function(...args) {
            const node = original.apply(this, args);
            node.addEventListener('audioprocess', event => setTimeout(() => {
                for (const sample of event.outputBuffer.getChannelData(0)) {
                    if (sample !== 0) window.observedAudioSamples++;
                }
            }, 0));
            return node;
        };
    });
}

for (const [index, fixture] of fixtures.entries()) {
    test('offline full SDL: ' + fixture.name, {timeout: 60000}, async () => {
        const reference = await referenceServer(fixture);
        const referenceContext = await browser.newContext();
        let expected;
        try {
            const page = await referenceContext.newPage();
            await page.goto(reference.url);
            await page.locator('#start').click();
            await page.waitForFunction(() => window.referenceResult, undefined, {timeout: 20000});
            expected = await page.evaluate(() => window.referenceResult);
            assert.equal(expected.status, 'completed', expected.error);
            assert.equal(expected.exitCode, 0);
            const bytes = Buffer.from(expected.output);
            if (fixture.text !== undefined) assert.equal(bytes.toString('latin1'), fixture.text);
            if (fixture.tail !== undefined) assert.ok(bytes.toString('latin1').endsWith(fixture.tail));
            if (fixture.bytes !== undefined) assert.deepEqual([...bytes], fixture.bytes);
        } finally { await referenceContext.close(); await reference.close(); }
        const asset = join(temporary, `asset-${index}.bin`);
        if (fixture.asset) await writeFile(asset, Buffer.from(fixture.asset));
        const output = join(temporary, `fixture-${index}.html`);
        await bundleSDLWeb(fixture.source, {filename: `fixture-${index}.bas`, output, runtimePack,
            assets: fixture.asset ? [{source: asset, path: 'data/input.bin'}] : []});
        const server = await serveBundle(output, {port: 0});
        const context = await browser.newContext();
        try {
            await observeAudio(context);
            const page = await context.newPage();
            const requests = [], pageErrors = [];
            page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
            page.on('pageerror', error => pageErrors.push(error.message));
            await page.goto(server.url);
            assert.equal(await page.evaluate(() => crossOriginIsolated), true);
            await context.setOffline(true);
            await page.locator('#capture').check();
            await page.locator('#start').click();
            if (fixture.input) await page.evaluate(input => window.crispbasicSDL.writeInput(input), fixture.input);
            await page.waitForFunction(() => ['completed', 'failed'].includes(window.crispbasicSDL.status), undefined, {timeout: 20000});
            const actual = await page.evaluate(() => ({status: crispbasicSDL.status, exitCode: crispbasicSDL.exitCode,
                output: [...crispbasicSDL.output], errors: crispbasicSDL.errors}));
            assert.equal(actual.status, 'completed', JSON.stringify(actual.errors));
            assert.equal(actual.exitCode, expected.exitCode);
            assert.deepEqual(actual.output, expected.output);
            assert.deepEqual(requests, [server.url], 'the document must be the only HTTP request');
            assert.deepEqual(pageErrors, []);
            if (fixture.file) assert.deepEqual(await page.evaluate(path => [...crispbasicSDL.readFile(path)], fixture.file), fixture.fileBytes);
            if (fixture.audio) assert.ok(await page.evaluate(() => observedAudioSamples > 0), 'SDL should produce nonzero PCM audio');
        } finally { await context.close(); await server.close(); }
    });
}

test('full SDL file-origin diagnostic and explicit Stop', {timeout: 40000}, async () => {
    const output = join(temporary, 'stop.html');
    await bundleSDLWeb('REPEAT\nUNTIL FALSE', {filename: 'stop.bas', output, runtimePack});
    const context = await browser.newContext();
    const server = await serveBundle(output, {port: 0});
    try {
        const page = await context.newPage();
        await page.goto(pathToFileURL(output).href);
        const failed = await page.evaluate(() => crispbasicSDL.run());
        assert.equal(failed.status, 'failed');
        assert.match(failed.error, /crispbasic serve/);
        await page.goto(server.url);
        await page.locator('#start').click();
        await page.waitForFunction(() => crispbasicSDL.status === 'running');
        await page.locator('#stop').click();
        assert.equal(await page.evaluate(() => crispbasicSDL.status), 'cancelled');
    } finally { await context.close(); await server.close(); }
});

test('full SDL capture is opt-in and ordinary execution is unbounded', {timeout: 30000}, async () => {
    const output = join(temporary, 'default.html');
    await bundleSDLWeb('PRINT "visible on canvas"\nEND', {filename: 'default.bas', output, runtimePack});
    const server = await serveBundle(output, {port: 0});
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.goto(server.url);
        assert.equal(await page.locator('#capture').isChecked(), false);
        const result = await page.evaluate(async () => {
            const result = await crispbasicSDL.run();
            return {...result, output: [...result.output], execution: crispbasicSDL.metadata.execution};
        });
        assert.equal(result.status, 'completed');
        assert.equal(result.exitCode, 0);
        assert.equal(result.captured, false);
        assert.deepEqual(result.output, []);
        assert.equal(result.execution.outputLimit, false);
        assert.equal(result.execution.timeout, false);
    } finally { await context.close(); await server.close(); }
});

test('source-loader failure resolves the completion promise with its diagnostic', {timeout: 30000}, async () => {
    const output = join(temporary, 'invalid.html');
    await bundleSDLWeb('PRINT "' + 'A'.repeat(300) + '"\nEND', {filename: 'invalid.bas', output, runtimePack});
    const server = await serveBundle(output, {port: 0});
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.goto(server.url);
        const result = await page.evaluate(() => crispbasicSDL.run({capture: true}));
        assert.equal(result.status, 'failed');
        assert.equal(result.exitCode, 65);
        assert.match(result.error, /source line 1: Tokenized line or program exceeds capacity/);
    } finally { await context.close(); await server.close(); }
});
