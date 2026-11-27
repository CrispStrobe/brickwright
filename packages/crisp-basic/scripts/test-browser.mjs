#!/usr/bin/env node
// Exercise the real headless WASM core in browser module workers.
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname, extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import test, {after, before} from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `<!doctype html><meta charset="utf-8"><title>CrispBASIC browser tests</title>
<script type="module">
import * as crispbasic from '/browser.mjs';
window.crispbasic = crispbasic;
</script>`;
const mime = new Map([
    ['.mjs', 'text/javascript'], ['.js', 'text/javascript'],
    ['.wasm', 'application/wasm'], ['.html', 'text/html'], ['.json', 'application/json']
]);
let browser;
let server;
let origin;

before(async () => {
    await access(resolve(root, '.build/wasm/crispbasic.mjs')).catch(() => {
        throw new Error('Browser tests require the real WASM build. Run npm run build:wasm first.');
    });
    await access(resolve(root, '.build/wasm/crispbasic.wasm'));
    const override = process.env.CRISP_BASIC_PLAYWRIGHT;
    const moduleName = override && isAbsolute(override) ? pathToFileURL(override).href : override || 'playwright';
    let chromium;
    try { ({chromium} = await import(moduleName)); }
    catch (error) {
        throw new Error('Install the package development dependencies and Playwright Chromium, or set ' +
            'CRISP_BASIC_PLAYWRIGHT to an installed Playwright module path.', {cause: error});
    }

    server = createServer(async (request, response) => {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) {
                response.writeHead(405).end();
                return;
            }
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            let bytes;
            let type;
            if (pathname === '/') {
                bytes = fixture;
                type = 'text/html';
            } else {
                const filename = resolve(root, `.${pathname}`);
                const path = relative(root, filename);
                if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
                    response.writeHead(403).end();
                    return;
                }
                bytes = await readFile(filename);
                type = mime.get(extname(filename)) || 'application/octet-stream';
            }
            response.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'});
            response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 400).end();
        }
    });
    await new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolveListen);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({
        headless: true,
        ...(process.env.CRISP_BASIC_CHROMIUM ? {executablePath: process.env.CRISP_BASIC_CHROMIUM} : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
}, {timeout: 30000});

after(async () => {
    try { await browser?.close(); }
    finally {
        if (server?.listening) {
            server.closeAllConnections();
            await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
        }
    }
});

async function pageFor(t) {
    const page = await browser.newPage();
    const errors = [];
    const activeWorkers = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('worker', worker => {
        activeWorkers.add(worker);
        worker.once('close', () => activeWorkers.delete(worker));
    });
    t.after(async () => {
        try {
            const deadline = Date.now() + 3000;
            while ((activeWorkers.size || page.workers().length) && Date.now() < deadline) await delay(10);
            assert.equal(activeWorkers.size, 0, 'the session left browser workers running');
            assert.equal(page.workers().length, 0, 'the browser still owns a worker after disposal');
            assert.deepEqual(errors, [], 'unexpected page errors');
        } finally { await page.close(); }
    });
    await page.goto(origin);
    await page.waitForFunction(() => typeof window.crispbasic?.createWasmSession === 'function');
    return page;
}

test('browser entry runs genuine BASIC without cross-origin isolation', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const session = crispbasic.createWasmSession();
        try {
            const result = await session.run('sum% = 0\nFOR i% = 1 TO 10\nsum% += i%\nNEXT\nPRINT STR$(sum%)\nEND\n');
            return {status: result.status, text: result.text, backend: result.backend,
                state: session.state, error: result.error, isolated: crossOriginIsolated};
        } finally { await session.dispose(); }
    });
    assert.equal(actual.status, 'completed', JSON.stringify(actual.error));
    assert.equal(actual.text, '55\r\n');
    assert.equal(actual.backend, 'bbcsdl-wasm');
    assert.equal(actual.state, 'idle');
    assert.equal(actual.isolated, false);
});

test('browser VDU events preserve bytes and agree with the completed result', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const bytes = [];
        let results = 0;
        const session = crispbasic.createWasmSession({onEvent(event) {
            if (event.type === 'output') bytes.push(...event.bytes);
            if (event.type === 'result') results++;
        }});
        try {
            const result = await session.run('VDU 22,8,25,69,0,1,128,255\nEND\n');
            return {status: result.status, error: result.error, output: [...result.output],
                text: [...result.text].map(char => char.charCodeAt(0)), bytes, results};
        } finally { await session.dispose(); }
    });
    assert.equal(actual.status, 'completed', JSON.stringify(actual.error));
    assert.deepEqual(actual.output, [22, 8, 25, 69, 0, 1, 128, 255]);
    assert.deepEqual(actual.bytes, actual.output);
    assert.deepEqual(actual.text, actual.output);
    assert.equal(actual.results, 1);
});

test('browser runtime errors map numbered and unnumbered source to editor lines', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const results = await page.evaluate(async () => {
        const session = crispbasic.createWasmSession();
        try {
            return await Promise.all([
                ['REM first\n\nERROR 100, "browser failure"\n', 'plain.bas'],
                ['100 REM first\n\n450 ERROR 100, "browser failure"\n', 'numbered.bas']
            ].map(async ([source, filename], index) => {
                // Independent sessions also exercise separate module memories.
                const target = index ? crispbasic.createWasmSession() : session;
                try {
                    const result = await target.run(source, {filename});
                    return {status: result.status, text: result.text, error: result.error};
                } finally { if (index) await target.dispose(); }
            }));
        } finally { await session.dispose(); }
    });
    for (const [index, result] of results.entries()) {
        assert.equal(result.status, 'error');
        assert.equal(result.error.kind, 'basic');
        assert.equal(result.error.code, 100);
        assert.equal(result.error.line, 3);
        assert.equal(result.error.basicLine, index ? 450 : 3);
        assert.equal(result.error.filename, index ? 'numbered.bas' : 'plain.bas');
        assert.match(result.error.message, /browser failure/);
        assert.equal(result.text, '');
    }
});

test('browser source validation rejects invalid source with its original position', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const session = crispbasic.createWasmSession();
        try {
            try { await session.run('10 PRINT "first"\nPRINT "mixed"\n', {filename: 'mixed.bas'}); }
            catch (error) {
                return {name: error.name, code: error.code, line: error.line, filename: error.filename, state: session.state};
            }
            throw new Error('Invalid source unexpectedly ran');
        } finally { await session.dispose(); }
    });
    assert.deepEqual(actual, {name: 'SourceError', code: 'mixed-line-numbering', line: 2,
        filename: 'mixed.bas', state: 'idle'});
});

test('asynchronous browser INPUT preserves nested PROC and recursive FN frames', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        let inputRequests = 0;
        let answered = false;
        let timer;
        const session = crispbasic.createWasmSession({onEvent(event) {
            if (event.type === 'input' && event.method === 'line') {
                inputRequests++;
                if (!answered) {
                    answered = true;
                    timer = setTimeout(() => { session.writeInput('8\n'); session.endInput(); }, 30);
                }
            }
        }});
        try {
            const result = await session.run(`PROCouter(40)
END
DEF PROCouter(base%)
LOCAL answer%
answer% = FNread(base%, 2)
PRINT STR$(answer%)
ENDPROC
DEF FNread(base%, depth%)
LOCAL reply$
IF depth% = 0 THEN
    INPUT "" reply$
    = base% + VAL(reply$)
ENDIF
= FNread(base% + 1, depth% - 1)
`, {interactive: true});
            return {status: result.status, error: result.error, text: result.text, inputRequests};
        } finally { clearTimeout(timer); await session.dispose(); }
    });
    assert.equal(actual.status, 'completed', JSON.stringify(actual.error));
    assert.equal(actual.text.trim(), '50');
    assert.ok(actual.inputRequests >= 1);
});

test('browser fixed input and explicit EOF have distinct outcomes', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const session = crispbasic.createWasmSession();
        try {
            const program = 'INPUT "" name$\nPRINT "hello " + name$\nEND\n';
            const fixed = await session.run(program, {input: 'Ada\n'});
            const eof = await session.run(program);
            return {fixed: {status: fixed.status, text: fixed.text, error: fixed.error},
                eof: {status: eof.status, error: eof.error}};
        } finally { await session.dispose(); }
    });
    assert.equal(actual.fixed.status, 'completed', JSON.stringify(actual.fixed.error));
    assert.match(actual.fixed.text, /hello Ada\r\n$/);
    assert.equal(actual.eof.status, 'error');
    assert.match(actual.eof.error.message, /input|end.of.file|EOF/i);
});

test('browser output budget stops a printing loop at the exact byte limit', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        let streamed = 0;
        const session = crispbasic.createWasmSession({maxOutputBytes: 137, onEvent(event) {
            if (event.type === 'output') streamed += event.bytes.length;
        }});
        try {
            const result = await session.run('REPEAT\nPRINT "abcdefghij"\nUNTIL FALSE\n');
            return {status: result.status, length: result.output.length, streamed, state: session.state};
        } finally { await session.dispose(); }
    });
    assert.deepEqual(actual, {status: 'output-limit', length: 137, streamed: 137, state: 'idle'});
});

test('browser deadline terminates a running tight loop while the page stays responsive', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        let ticks = 0;
        const ticker = setInterval(() => ticks++, 10);
        const session = crispbasic.createWasmSession();
        try {
            const warmup = await session.run('END\n');
            if (warmup.status !== 'completed') throw new Error(JSON.stringify(warmup));
            const start = performance.now();
            const result = await session.run('PRINT "ready"\nREPEAT\nUNTIL FALSE\n', {timeoutMs: 1500});
            return {status: result.status, text: result.text, elapsed: performance.now() - start,
                ticks, state: session.state};
        } finally { clearInterval(ticker); await session.dispose(); }
    });
    assert.equal(actual.status, 'timeout');
    assert.match(actual.text, /^ready\r\n/);
    assert.ok(actual.elapsed < 7000, `deadline took ${actual.elapsed}ms`);
    assert.ok(actual.ticks > 0, 'the interpreter blocked the browser page');
    assert.equal(actual.state, 'idle');
});

test('browser AbortSignal cancels an executing tight loop and the session remains reusable', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const controller = new AbortController();
        let observedOutput = false;
        let timer;
        const session = crispbasic.createWasmSession({onEvent(event) {
            if (event.type === 'output' && !observedOutput) {
                observedOutput = true;
                timer = setTimeout(() => controller.abort(), 30);
            }
        }});
        try {
            const cancelled = await session.run('PRINT "ready"\nREPEAT\nUNTIL FALSE\n', {signal: controller.signal});
            const next = await session.run('PRINT "reused"\nEND\n');
            return {status: cancelled.status, observedOutput, next: {status: next.status, text: next.text}};
        } finally { clearTimeout(timer); await session.dispose(); }
    });
    assert.equal(actual.status, 'cancelled');
    assert.equal(actual.observedOutput, true);
    assert.deepEqual(actual.next, {status: 'completed', text: 'reused\r\n'});
});

test('browser reset cancels suspended input and awaits its worker before another run', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        let ready;
        const requested = new Promise(resolveInput => { ready = resolveInput; });
        const session = crispbasic.createWasmSession({onEvent(event) {
            if (event.type === 'input') ready();
        }});
        try {
            const pending = session.run('INPUT "" name$\nEND\n', {interactive: true});
            await requested;
            await session.reset();
            const stopped = await pending;
            const state = session.state;
            const next = await session.run('PRINT "reset"\nEND\n');
            return {stopped: stopped.status, state, next: {status: next.status, text: next.text}};
        } finally { await session.dispose(); }
    });
    assert.deepEqual(actual, {stopped: 'cancelled', state: 'idle', next: {status: 'completed', text: 'reset\r\n'}});
});

test('repeated browser runs start with fresh interpreter memory', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const session = crispbasic.createWasmSession();
        try {
            const first = await session.run('secret% = 99\nEND\n');
            const second = await session.run('PRINT secret%\nEND\n');
            const third = await session.run('PRINT "fresh"\nEND\n');
            return {first: first.status, second: {status: second.status, error: second.error},
                third: {status: third.status, text: third.text}};
        } finally { await session.dispose(); }
    });
    assert.equal(actual.first, 'completed');
    assert.equal(actual.second.status, 'error');
    assert.match(actual.second.error.message, /variable/i);
    assert.deepEqual(actual.third, {status: 'completed', text: 'fresh\r\n'});
});

test('concurrent browser sessions keep input and interpreter memory separate', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        const sessions = [];
        const timers = [];
        try {
            const pending = ['Ada', 'Lin'].map((name, index) => {
                let answered = false;
                const session = crispbasic.createWasmSession({onEvent(event) {
                    if (event.type === 'input' && !answered) {
                        answered = true;
                        timers.push(setTimeout(() => { session.writeInput(`${name}\n`); session.endInput(); }, 20 + index * 10));
                    }
                }});
                sessions.push(session);
                return session.run(`value% = ${index + 1}\nINPUT "" name$\nPRINT name$ + ":" + STR$(value%)\nEND\n`, {interactive: true});
            });
            return (await Promise.all(pending)).map(result => ({status: result.status, text: result.text.trim(), error: result.error}));
        } finally {
            for (const timer of timers) clearTimeout(timer);
            await Promise.all(sessions.map(session => session.dispose()));
        }
    });
    assert.deepEqual(actual.map(result => [result.status, result.text]), [['completed', 'Ada:1'], ['completed', 'Lin:2']]);
});

test('concurrent browser disposal calls both settle the active run and close the session', {timeout: 15000}, async t => {
    const page = await pageFor(t);
    const actual = await page.evaluate(async () => {
        let ready;
        const requested = new Promise(resolveInput => { ready = resolveInput; });
        const session = crispbasic.createWasmSession({onEvent(event) {
            if (event.type === 'input') ready();
        }});
        try {
            let settled = false;
            const pending = session.run('INPUT "" name$\nEND\n', {interactive: true}).then(result => {
                settled = true;
                return result;
            });
            await requested;
            const observations = await Promise.all([session.dispose(), session.dispose()].map(async disposal => {
                await disposal;
                return {settled, state: session.state};
            }));
            let rejection;
            try { await session.run('END\n'); }
            catch (error) { rejection = error.message; }
            return {observations, status: (await pending).status, rejection};
        } finally { await session.dispose(); }
    });
    assert.deepEqual(actual.observations, [{settled: true, state: 'disposed'}, {settled: true, state: 'disposed'}]);
    assert.equal(actual.status, 'cancelled');
    assert.match(actual.rejection, /disposed/i);
});
