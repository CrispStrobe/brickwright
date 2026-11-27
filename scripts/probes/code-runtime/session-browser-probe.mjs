// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Exercises the production session + worker builders. No app/UI qualification.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map(argument => {
    const value = argument.replace(/^--/, '');
    const split = value.indexOf('=');
    return split < 0 ? [value, true] : [value.slice(0, split), value.slice(split + 1)];
}));
const directory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(args['app-root'] || path.join(directory, '../../..'));
const dependencies = path.resolve(args['runtime-probe-dir'] || directory);
const requireProbe = createRequire(path.join(dependencies, 'package.json'));
const {chromium: launcher} = requireProbe('playwright-core');
const chromiumModule = requireProbe('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
const files = {
    '/code-execution-session.js': path.join(appRoot, 'overlay/scratch-gui/src/lib/code-execution-session.js'),
    '/code-execution-workers.js': path.join(appRoot, 'overlay/scratch-gui/src/lib/code-execution-workers.js'),
    '/skulpt.min.js': requireProbe.resolve('skulpt/dist/skulpt.min.js'),
    '/skulpt-stdlib.js': requireProbe.resolve('skulpt/dist/skulpt-stdlib.js')
};
const contents = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, file]) => [url, await fs.readFile(file)])));
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost').pathname;
    if (url === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><meta charset="utf-8"><title>Production code session probe</title><p>Bounded worker checks</p>');
    } else if (contents[url]) {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(contents[url]);
    } else {
        response.writeHead(404);
        response.end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const pageErrors = [];
const report = {
    schema: 1,
    createdAt: new Date().toISOString(),
    implementationClaim: 'e1ef0cb79343dd7c592e6b645bc9d93bdd873910',
    scope: 'production session and console workers, static localhost harness; no React/UI, device, simulator, generated detached-task or platform-matrix qualification',
    sourceHashes: Object.fromEntries(Object.entries(contents).map(([url, source]) => [url.slice(1), crypto.createHash('sha256').update(source).digest('hex')])),
    environment: {node: process.version, platform: process.platform, arch: process.arch,
        skulpt: requireProbe('skulpt/package.json').version,
        playwright: requireProbe('playwright-core/package.json').version,
        chromiumPackage: JSON.parse(await fs.readFile(path.join(dependencies, 'node_modules/@sparticuz/chromium/package.json'), 'utf8')).version,
        suppliedBrowserArgs: ['--no-sandbox']}
};
try {
    browser = await launcher.launch({executablePath: args.browser || await chromium.executablePath(), args: ['--no-sandbox'], headless: true});
    report.environment.browserVersion = browser.version();
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const observed = await page.evaluate(async () => {
        const {createCodeExecutionSession} = await import('/code-execution-session.js');
        const {JAVASCRIPT_WORKER_SOURCE, createPythonWorkerSource} = await import('/code-execution-workers.js');
        const [core, stdlib] = await Promise.all(['/skulpt.min.js', '/skulpt-stdlib.js'].map(url => fetch(url).then(response => response.text())));
        const sources = {javascript: JAVASCRIPT_WORKER_SOURCE, python: createPythonWorkerSource({core, stdlib})};
        const results = [];
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const capabilities = {isSecureContext, crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer === 'function', userAgent: navigator.userAgent};

        async function runCase(name, engine, code, options = {}) {
            const startedAt = performance.now();
            const output = [];
            const input = [];
            const wire = [];
            const answerTimers = [];
            let created = 0;
            let terminated = 0;
            let released = 0;
            let heartbeats = 0;
            let session;
            let lastRequest;
            const heartbeat = setInterval(() => heartbeats++, 10);
            session = createCodeExecutionSession({
                workerSource: sources[engine], code,
                timeoutMs: options.timeoutMs || 2500,
                maxOutputChars: options.maxOutputChars || 65536,
                flushIntervalMs: 10,
                onOutput: (text, metadata) => {
                    output.push({text, ...metadata, atMs: performance.now() - startedAt});
                    if (options.stopOnOutput && text) session.stop('probe-infinite-stop');
                },
                onInput: request => {
                    input.push(request ? {...request, atMs: performance.now() - startedAt} : null);
                    if (!request) return;
                    lastRequest = request;
                    if (options.stopOnInput) {
                        answerTimers.push(setTimeout(() => session.stop('probe-input-stop'), 30));
                    } else {
                        const answerIndex = input.filter(Boolean).length - 1;
                        const answer = options.answers?.[answerIndex] ?? 'Ada';
                        answerTimers.push(setTimeout(() => session.replyToInput(request.requestId, answer), options.answerDelayMs || 20));
                    }
                },
                createWorker: source => {
                    created++;
                    const url = URL.createObjectURL(new Blob([source], {type: 'application/javascript'}));
                    const worker = new Worker(url);
                    const terminate = worker.terminate.bind(worker);
                    worker.terminate = () => { terminated++; return terminate(); };
                    worker.addEventListener('message', event => {
                        const message = event.data;
                        wire.push({type: message.type, runId: message.runId, requestId: message.requestId,
                            prompt: message.prompt, textLength: message.text?.length,
                            textPreview: message.text?.slice(0, 200), atMs: performance.now() - startedAt});
                    });
                    return {worker, release: () => { released++; URL.revokeObjectURL(url); }};
                }
            });
            const watchdog = setTimeout(() => session.stop('probe-watchdog'), 8000);
            let result;
            try { result = await session.promise; }
            finally {
                clearTimeout(watchdog);
                clearInterval(heartbeat);
                answerTimers.forEach(clearTimeout);
            }
            const record = {name, engine, code, result, wallMs: performance.now() - startedAt,
                output, input, wire, created, terminated, released, parentHeartbeats: heartbeats,
                lateInputAccepted: lastRequest ? session.replyToInput(lastRequest.requestId, 'late reply') : null,
                failures: []};
            const expect = (condition, message) => { if (!condition) record.failures.push(message); };
            expect(created === 1 && terminated === 1 && released === 1, 'worker and URL must be owned/released once');
            expect(wire.every(event => event.runId === session.id), 'every worker message carries its runId');
            expect(wire.filter(event => event.type === 'out').every(event => event.textLength <= 4096), 'worker output chunks are bounded');
            expect(result.output.length <= (options.maxOutputChars || 65536), 'parent output is bounded');
            if (lastRequest) expect(record.lateInputAccepted === false, 'late input cannot reach a settled run');
            if (options.check) options.check(record, expect);
            record.pass = record.failures.length === 0;
            results.push(record);
            return record;
        }

        for (const engine of ['javascript', 'python']) {
            const python = engine === 'python';
            const print = text => python ? `print(${JSON.stringify(text)})\n` : `console.log(${JSON.stringify(text)});\n`;
            await runCase('normal', engine, print('hello'), {check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === 'hello\n', 'normal output/completion');
            }});
            await runCase('guest-error', engine, print('before error') + (python ? "raise ValueError('probe-marker')\n" : "throw new Error('probe-marker');"), {check: (r, expect) => {
                expect(r.result.status === 'error' && r.result.error.includes('probe-marker'), 'guest failure is shown');
                expect(r.result.output === 'before error\n', 'output flushes before error');
            }});
            await runCase('live-streaming', engine, python ?
                "import time\nprint('before')\ntime.sleep(0.15)\nprint('after')\n" :
                "console.log('before'); await new Promise(resolve => setTimeout(resolve, 150)); console.log('after');", {check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === 'before\nafter\n', 'stream program completes');
                expect(r.output.some(event => event.text === 'before\n'), 'output arrives before the later print');
            }});
            await runCase('input-wait-exceeds-execution-timeout', engine, python ?
                "print('before')\nread = input\nname = read('Name?')\nprint('hello ' + name)\n" :
                "console.log('before'); const name = await input('Name?'); console.log('hello ' + name);", {
                timeoutMs: 500, answerDelayMs: 750,
                check: (r, expect) => {
                    expect(r.result.status === 'completed' && r.result.output === 'before\nhello Ada\n', 'human waiting time does not exhaust execution budget');
                    expect(r.wallMs > 750 && r.input.filter(Boolean).length === 1, 'input actually waited beyond the configured execution timeout');
                    expect(r.output.some(event => event.text === 'before\n'), 'output is visible before input reply');
                }
            });
            await runCase('stop-during-input', engine, python ? "input('Waiting?')\nprint('must not run')\n" :
                "await input('Waiting?'); console.log('must not run');", {stopOnInput: true, check: (r, expect) => {
                expect(r.result.status === 'stopped' && r.result.reason === 'probe-input-stop', 'Stop settles a pending input run');
                expect(!r.result.output.includes('must not run') && r.input.at(-1) === null, 'Stop clears input without continuing user code');
            }});
            await runCase('stop-infinite-loop', engine, python ?
                "print('x' * 4096)\nwhile True:\n    pass\n" :
                "console.log('x'.repeat(4096)); while (true) {}", {stopOnOutput: true, check: (r, expect) => {
                expect(r.result.status === 'stopped' && r.result.reason === 'probe-infinite-stop', 'Stop terminates an executing infinite loop');
                expect(r.parentHeartbeats > 0, 'parent remained responsive during execution');
            }});
            await runCase('output-flood', engine, python ? "while True:\n    print('x' * 100)\n" :
                "while (true) { console.log('x'.repeat(100)); }", {maxOutputChars: 4096, check: (r, expect) => {
                expect(r.result.status === 'output-limit' && r.result.output.length === 4096, 'flood reaches a bounded named output limit');
                expect(r.wire.filter(event => event.type === 'out').length <= 2, 'worker batches flood before crossing to parent');
            }});
            await runCase('fresh-restart', engine, print('42'), {check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === '42\n', 'fresh worker succeeds after stopped/flooded workers');
            }});
        }
        await runCase('sync-prompt-replay-two-questions-and-random', 'javascript',
            "console.log('random', Math.random()); const first = prompt('First?'); console.log('first', first); const second = prompt('Second?'); console.log('answer', first, second, Math.random());", {
            answers: ['Ada', 'Lovelace'],
            check: (r, expect) => {
                expect(r.result.status === 'completed', 'synchronous prompt program completes in worker');
                expect(r.input.filter(Boolean).map(event => event.prompt).join('|') === 'First?|Second?', 'each question is asked exactly once');
                expect(r.wire.filter(event => event.type === 'output-reset').length === 2, 'two replay attempts reset visible output');
                expect(r.result.output.split('\n').filter(Boolean).length === 3 && r.result.output.includes('answer Ada Lovelace '), 'replay does not duplicate final output');
                const randoms = r.wire.filter(event => event.type === 'out').map(event => /^random ([^\n]+)/.exec(event.textPreview)?.[1]).filter(Boolean);
                expect(randoms.length === 3 && new Set(randoms).size === 1, 'Math.random values repeat across attempts');
                expect(r.result.totalOutputChars > r.result.output.length, 'replay does not replenish total-output budget');
            }
        });
        await runCase('explicit-top-level-await-and-returned-promise', 'javascript',
            "console.log('before'); await new Promise(resolve => setTimeout(resolve, 80)); console.log('after'); return new Promise(resolve => setTimeout(() => { console.log('returned'); resolve(); }, 40));", {
            check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === 'before\nafter\nreturned\n', 'completion awaits explicit tasks and adopted return Promise');
                expect(r.output.some(event => event.text === 'before\n'), 'the awaited task streams while active');
            }
        });

        let resolveSource;
        let lazyWorkersCreated = 0;
        const lazySource = new Promise(resolve => { resolveSource = resolve; });
        const lazy = createCodeExecutionSession({workerSource: () => lazySource, code: '',
            createWorker: () => { lazyWorkersCreated++; throw new Error('cancelled load must not create a worker'); }});
        await delay(20);
        lazy.dispose();
        const lazyResult = await lazy.promise;
        resolveSource(JAVASCRIPT_WORKER_SOURCE);
        await delay(30);
        const failures = [];
        if (lazyWorkersCreated !== 0 || lazyResult.status !== 'stopped' || lazyResult.reason !== 'disposed') failures.push('lazy source resolution escaped cancellation');
        results.push({name: 'lazy-source-dispose', engine: 'host', result: lazyResult, lazyWorkersCreated, failures, pass: failures.length === 0});
        return {capabilities, results};
    });
    Object.assign(report, observed);
} catch (error) {
    report.fatalError = String(error.stack || error);
} finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}
report.pageErrors = pageErrors;
report.summary = {passed: report.results?.filter(result => result.pass).length || 0,
    total: report.results?.length || 0,
    failed: report.results?.filter(result => !result.pass).map(result => ({name: result.name, engine: result.engine, failures: result.failures})) || []};
const output = path.resolve(args.output || path.join(directory, 'session-browser-results.json'));
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({output, summary: report.summary, pageErrors, fatalError: report.fatalError}));
if (report.fatalError || pageErrors.length || !report.summary.total || report.summary.failed.length) process.exitCode = 1;
