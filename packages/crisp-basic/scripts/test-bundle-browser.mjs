#!/usr/bin/env node
// Genuine offline browser evidence: file: page, network disabled, actual WASM.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {isAbsolute, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import test, {after, before} from 'node:test';
import {bundle as createBundle} from '../src/bundle.mjs';
const bundle = (source, options) => createBundle(source, {...options, profile: 'headless'});
import {createWasmSession} from '../src/wasm-session.mjs';
import {corpus} from '../tests/wasm-corpus.mjs';

let browser, directory;
before(async () => {
    const override = process.env.CRISP_BASIC_PLAYWRIGHT;
    const moduleName = override && isAbsolute(override) ? pathToFileURL(override).href : override || 'playwright';
    const {chromium} = await import(moduleName);
    directory = await mkdtemp(join(tmpdir(), 'crisp-bundle-browser-'));
    browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
        ...(process.env.CRISP_BASIC_CHROMIUM ? {executablePath: process.env.CRISP_BASIC_CHROMIUM} : {})});
});
after(async () => {
    try { await browser?.close(); }
    finally { if (directory) await rm(directory, {recursive: true, force: true}); }
});

for (const [index, fixture] of corpus.entries()) {
    test(`offline page byte parity: ${fixture.name}`, async t => {
        const session = createWasmSession({timeoutMs: 10000});
        t.after(() => session.dispose());
        const direct = await session.run(fixture.source, {filename: 'program.bas', input: fixture.input ?? ''});
        assert.equal(direct.status, 'completed', JSON.stringify(direct.error));
        const artifact = await bundle(fixture.source, {filename: 'program.bas', target: 'web',
            output: join(directory, `program-${index}.html`)});
        const context = await browser.newContext({offline: true});
        t.after(() => context.close());
        const page = await context.newPage();
        const network = [], errors = [];
        page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pathToFileURL(artifact.path).href);
        await page.waitForFunction(() => Boolean(window.crispbasicBundle));
        const result = await page.evaluate(async input => {
            const result = await window.crispbasicBundle.run({input, interactive: false});
            return {...result, output: Array.from(result.output)};
        }, fixture.input ?? '');
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.exitCode, direct.exitCode);
        assert.deepEqual(result.output, Array.from(direct.output));
        assert.deepEqual(result.output, fixture.bytes ?? [...Buffer.from(fixture.text, 'latin1')]);
        assert.deepEqual(network, []);
        assert.deepEqual(errors, []);
    });
}

test('offline interactive input, cancellation, rerun and byte download API', async t => {
    const artifact = await bundle('INPUT "" name$\nPRINT name$\nEND', {filename: 'interactive.bas',
        target: 'web', output: join(directory, 'interactive.html')});
    const context = await browser.newContext({offline: true});
    t.after(() => context.close());
    const page = await context.newPage();
    await page.goto(pathToFileURL(artifact.path).href);
    await page.waitForFunction(() => Boolean(window.crispbasicBundle));
    const result = await page.evaluate(async () => {
        const cancelled = window.crispbasicBundle.run();
        window.crispbasicBundle.stop();
        const stopped = await cancelled;
        const pending = window.crispbasicBundle.run();
        window.crispbasicBundle.writeInput('Ada\n');
        window.crispbasicBundle.endInput();
        const finished = await pending;
        return {stopped: stopped.status, finished: finished.status, output: Array.from(finished.output)};
    });
    assert.deepEqual(result, {stopped: 'cancelled', finished: 'completed', output: [...Buffer.from('\r\nAda\r\n')]});
});
