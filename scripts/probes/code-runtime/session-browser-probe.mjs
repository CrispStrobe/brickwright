// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Exercises the production session + worker builders. No app/UI qualification.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

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
let generator = null;
const generatedPrograms = {};
if (args['generator-root']) {
    const generatorRoot = path.resolve(args['generator-root']);
    const generatorFile = path.join(generatorRoot, 'src/utils/sb3Creator.js');
    const {default: SB3Creator} = await import(pathToFileURL(generatorFile).href);
    const fixtures = {
        concurrent: 'SPRITE Demo:\n  DEFINE later:\n    wait 0.08 seconds\n    say "later"\n  WHEN flag clicked:\n    say "first"\n    later\n    say "last"\n  WHEN flag clicked:\n    say "second"\n',
        input: 'SPRITE Demo:\n  WHEN flag clicked:\n    ask "Name?" and wait\n    say answer\n',
        stop: 'SPRITE Demo:\n  WHEN flag clicked:\n    say "ready"\n    wait 10 seconds\n    say "late"\n'
    };
    for (const [name, source] of Object.entries(fixtures)) {
        const creator = new SB3Creator();
        creator.parse(source);
        const validation = creator.validate();
        if (!validation.isValid || creator.warnings.length) throw new Error(`Invalid generated fixture ${name}: ${JSON.stringify({validation, warnings: creator.warnings})}`);
        const code = creator.generateJavaScript(creator.project, {async: true, execution: 'owned-console-v1'});
        if (!code.includes('codeRun.spawn')) throw new Error('The selected generator does not implement owned-console-v1.');
        generatedPrograms[name] = {source, code,
            sha256: crypto.createHash('sha256').update(code).digest('hex')};
    }
    generator = {
        repository: 'CrispStrobe/sb3-creator',
        head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: generatorRoot, encoding: 'utf8'}).trim(),
        sourceModified: !!execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src/utils'], {cwd: generatorRoot, encoding: 'utf8'}).trim(),
        sourceSha256: crypto.createHash('sha256').update(await fs.readFile(generatorFile)).digest('hex'),
        execution: 'owned-console-v1',
        programs: generatedPrograms
    };
}
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
    scope: 'production session and console workers including registered tasks; selected canonical generator when supplied; static localhost harness, no React/UI, device, simulator, game semantics or platform-matrix qualification',
    generator,
    probeSha256: crypto.createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),
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
    const observed = await page.evaluate(async ({generatedPrograms}) => {
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
                inputProbeIntervalMs: options.inputProbeIntervalMs || 50,
                inputProbeTimeoutMs: options.inputProbeTimeoutMs || 250,
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
                    } else if (!options.noAnswer) {
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
                            pauseBudget: message.pauseBudget, probeId: message.probeId,
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

        await runCase('owned-concurrent-nested-tasks', 'javascript',
            "codeRun.spawn(async task => { console.log('first'); await task.sleep(80); task.spawn(async child => { await child.sleep(30); console.log('nested'); }); console.log('parent'); }); codeRun.spawn(async task => { await task.sleep(20); console.log('second'); }); console.log('entry');", {
            check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === 'entry\nfirst\nsecond\nparent\nnested\n', 'all registered descendants complete before done');
                expect(r.output.some(event => event.text === 'entry\nfirst\n'), 'registered work streams while active');
            }
        });
        await runCase('owned-ignored-rejection-cancels-sibling', 'javascript',
            "codeRun.spawn(async task => { await task.sleep(500); console.log('late'); }); codeRun.spawn(async task => { await task.sleep(20); throw new Error('owned-marker'); });", {
            check: (r, expect) => {
                expect(r.result.status === 'error' && r.result.error.includes('owned-marker'), 'ignored registered rejection fails the run');
                expect(r.result.output === '', 'failed run does not wait for a sibling effect');
            }
        });
        await runCase('owned-input-after-sibling-completion', 'javascript',
            "codeRun.spawn(async task => console.log(await task.input('Name?'))); codeRun.spawn(async task => { await task.sleep(80); console.log('sibling'); });", {
            timeoutMs: 500, answerDelayMs: 750,
            check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === 'sibling\nAda\n', 'remaining sole input owner may wait beyond budget');
                expect(r.wire.some(event => event.type === 'input' && event.pauseBudget === false), 'initial input cannot suspend sibling budget');
                expect(r.wire.some(event => event.type === 'input-state' && event.pauseBudget === true), 'sibling completion pauses the remaining budget');
                expect(r.wire.some(event => event.type === 'input-pong'), 'waiting worker stays responsive to probes');
            }
        });
        await runCase('unawaited-input-busy-loop-watchdog', 'javascript',
            "input('Question?'); while (true) {}", {timeoutMs: 500, noAnswer: true,
            check: (r, expect) => {
                expect(r.result.status === 'timeout' && r.result.reason === 'input-unresponsive', 'input cannot disable every automatic timeout');
                expect(r.input.at(-1) === null && r.parentHeartbeats > 0, 'watchdog clears input with responsive parent');
            }
        });
        await runCase('owned-input-busy-sibling-budget', 'javascript',
            "codeRun.spawn(async task => { await task.input('Question?'); }); codeRun.spawn(() => { while (true) {} });", {
            timeoutMs: 300, inputProbeTimeoutMs: 1000, noAnswer: true,
            check: (r, expect) => {
                expect(r.result.status === 'timeout' && !r.result.reason, 'active execution budget ends busy sibling before input probe deadline');
                expect(r.input.filter(Boolean).length === 1 && r.input.at(-1) === null, 'input belongs to the terminated run');
            }
        });
        await runCase('owned-input-responsive-sibling-budget', 'javascript',
            "codeRun.spawn(async task => { await task.input('Question?'); }); codeRun.spawn(async task => { while (true) await task.sleep(10); });", {
            timeoutMs: 300, noAnswer: true,
            check: (r, expect) => {
                expect(r.result.status === 'timeout' && !r.result.reason, 'responsive siblings still consume execution budget during input');
                expect(r.wire.some(event => event.type === 'input-pong'), 'timeout is not caused by an unresponsive worker');
            }
        });
        await runCase('owned-stop-delay', 'javascript',
            "codeRun.spawn(async task => { console.log('ready'); await task.sleep(5000); console.log('late'); });", {
            stopOnOutput: true, check: (r, expect) => {
                expect(r.result.status === 'stopped' && r.result.output === 'ready\n', 'Stop disposes registered delays');
            }
        });
        await runCase('owned-stop-input', 'javascript',
            "codeRun.spawn(async task => { await task.input('Question?'); console.log('late'); });", {
            stopOnInput: true, check: (r, expect) => {
                expect(r.result.status === 'stopped' && r.result.output === '' && r.input.at(-1) === null, 'Stop disposes owned input without continuing');
            }
        });
        await runCase('owned-prompt-replay-refused', 'javascript',
            "codeRun.spawn(async () => {}); prompt('No replay');", {check: (r, expect) => {
                expect(r.result.status === 'error' && r.result.error.includes('cannot be mixed'), 'owned tasks refuse compatibility replay');
                expect(r.input.length === 0 && !r.wire.some(event => event.type === 'output-reset'), 'no question or replay effects start');
            }
        });
        await runCase('owned-task-flood', 'javascript',
            "codeRun.spawn(() => { while (true) console.log('x'.repeat(100)); });", {maxOutputChars: 4096, check: (r, expect) => {
                expect(r.result.status === 'output-limit' && r.result.output.length === 4096, 'registered task output is capped');
            }
        });
        await runCase('owned-fresh-restart', 'javascript',
            "codeRun.spawn(() => console.log('fresh'));", {check: (r, expect) => {
                expect(r.result.status === 'completed' && r.result.output === 'fresh\n', 'owned run recovers after stop, timeout, rejection and flood');
            }
        });
        for (const [name, orphan] of [
            ['entry', "codeRun.input('Orphan?');"],
            ['task', "codeRun.spawn(task => { task.input('Orphan?'); });"]
        ]) {
            await runCase(`owned-${name}-orphan-input`, 'javascript',
                orphan + " codeRun.spawn(async task => { while (true) await task.sleep(10); });", {noAnswer: true,
                check: (r, expect) => {
                    expect(r.result.status === 'error' && r.result.error.includes('owning entry or task'), 'abandoned input cannot transfer to a sibling');
                    expect(r.input.at(-1) === null && !r.wire.some(event => event.type === 'input-state' && event.pauseBudget === true), 'orphan input does not exempt the remaining task');
                }
            });
        }
        await runCase('owned-completed-scope-refuses-late-registration', 'javascript',
            "let oldApi; codeRun.spawn(task => { oldApi = task; }); codeRun.spawn(async task => { await task.sleep(20); oldApi.spawn(() => console.log('late')); });", {
            check: (r, expect) => {
                expect(r.result.status === 'error' && r.result.error.includes('task has ended') && r.result.output === '', 'completed task API cannot register late effects');
            }
        });
        await runCase('owned-unawaited-input-cannot-keep-working', 'javascript',
            "codeRun.spawn(async task => { task.input('Unawaited'); while (true) await task.sleep(10); });", {noAnswer: true,
            check: (r, expect) => {
                expect(r.result.status === 'error' && r.result.error.includes('Await the pending input'), 'a waiting owner cannot acquire further owned work');
                expect(r.input.at(-1) === null, 'invalid input owner is disposed');
            }
        });
        await runCase('owned-pending-sleep-cannot-hide-behind-input', 'javascript',
            "codeRun.spawn(async task => { task.sleep(1000); await task.input('Early input'); });", {noAnswer: true,
            check: (r, expect) => {
                expect(r.result.status === 'error' && r.result.error.includes('Await pending sleeps'), 'input requires preceding owned waits to finish');
                expect(r.input.length === 0, 'invalid input is refused before a question is posted');
            }
        });

        if (generatedPrograms.concurrent) {
            await runCase('generated-concurrent-flags-and-procedure', 'javascript', generatedPrograms.concurrent.code, {
                check: (r, expect) => {
                    expect(r.result.status === 'completed' && r.result.output === 'first\nsecond\nlater\nlast\n', 'actual upstream generation preserves task/procedure completion');
                }
            });
            await runCase('generated-async-input', 'javascript', generatedPrograms.input.code, {
                timeoutMs: 500, answerDelayMs: 750, check: (r, expect) => {
                    expect(r.result.status === 'completed' && r.result.output === 'Ada\n', 'actual generated input survives a long human wait');
                    expect(r.input.filter(Boolean).length === 1 && !r.wire.some(event => event.type === 'output-reset'), 'generated ask is not compatibility replay');
                }
            });
            await runCase('generated-stop-wait', 'javascript', generatedPrograms.stop.code, {
                stopOnOutput: true, check: (r, expect) => {
                    expect(r.result.status === 'stopped' && r.result.output === 'ready\n', 'Stop terminates actual generated delayed task');
                }
            });
        }

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
    }, {generatedPrograms});
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
