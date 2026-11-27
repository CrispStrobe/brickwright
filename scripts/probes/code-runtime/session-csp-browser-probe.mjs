// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Qualify the production default Blob-worker factory under explicit HTTP CSP.
// This is a localhost worker/loading probe, not a rendered application test.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
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
const sha256 = content => crypto.createHash('sha256').update(content).digest('hex');
const nativeConfigPath = path.join(appRoot, 'apps/tauri/src-tauri/tauri.conf.json');
const nativeConfigBytes = await fs.readFile(nativeConfigPath);
const nativeConfig = JSON.parse(nativeConfigBytes);
const files = {
    '/code-execution-session.js': path.join(appRoot, 'overlay/scratch-gui/src/lib/code-execution-session.js'),
    '/code-execution-workers.js': path.join(appRoot, 'overlay/scratch-gui/src/lib/code-execution-workers.js'),
    '/skulpt.min.js': requireProbe.resolve('skulpt/dist/skulpt.min.js'),
    '/skulpt-stdlib.js': requireProbe.resolve('skulpt/dist/skulpt-stdlib.js')
};
const contents = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, file]) =>
    [url, await fs.readFile(file)])));
const profiles = {
    'no-csp': null,
    allowed: "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src blob:; connect-src 'self'; base-uri 'none'; object-src 'none'",
    'worker-denied': "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src 'none'; connect-src 'self'; base-uri 'none'; object-src 'none'",
    'eval-denied': "default-src 'none'; script-src 'self'; worker-src blob:; connect-src 'self'; base-uri 'none'; object-src 'none'"
};

// Served as an ordinary external module. Playwright does not inject or evaluate
// the worker implementation: the document loads these imports under its CSP.
async function browserHarness() {
    const violations = [];
    document.addEventListener('securitypolicyviolation', event => violations.push({
        effectiveDirective: event.effectiveDirective,
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        disposition: event.disposition,
        originalPolicy: event.originalPolicy
    }));
    const {createCodeExecutionSession} = await import('/code-execution-session.js');
    const {JAVASCRIPT_WORKER_SOURCE, createPythonWorkerSource} = await import('/code-execution-workers.js');
    const [core, stdlib] = await Promise.all(['/skulpt.min.js', '/skulpt-stdlib.js'].map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
        return response.text();
    }));
    const sources = {javascript: JAVASCRIPT_WORKER_SOURCE, python: createPythonWorkerSource({core, stdlib})};
    const nativeWorker = window.Worker;
    const createObjectURL = URL.createObjectURL.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    const blobOwners = new Map();
    const liveBlobUrls = new Set();
    let active = null;

    // Call-through observation only. The production createBlobWorker function
    // creates the Blob, constructs the real Worker and owns the URL release.
    // No createWorker option, transport replacement, source rewrite or policy
    // bypass is supplied to createCodeExecutionSession.
    URL.createObjectURL = blob => {
        const url = createObjectURL(blob);
        if (active) {
            active.createdUrls++;
            blobOwners.set(url, active);
            liveBlobUrls.add(url);
        }
        return url;
    };
    URL.revokeObjectURL = url => {
        const owner = blobOwners.get(url);
        if (owner) {
            owner.revokedUrls++;
            liveBlobUrls.delete(url);
        }
        return revokeObjectURL(url);
    };
    window.Worker = new Proxy(nativeWorker, {
        construct(target, values) {
            const owner = active;
            if (owner) owner.constructionAttempts++;
            let worker;
            try {
                worker = Reflect.construct(target, values);
            } catch (error) {
                if (owner) owner.constructionError = String(error);
                throw error;
            }
            if (!owner) return worker;
            owner.createdWorkers++;
            const terminate = worker.terminate.bind(worker);
            worker.terminate = () => {
                owner.terminatedWorkers++;
                return terminate();
            };
            const postMessage = worker.postMessage.bind(worker);
            worker.postMessage = (...values) => {
                if (values[0]?.type === 'input-ping') owner.inputPings++;
                return postMessage(...values);
            };
            worker.addEventListener('message', event => {
                const data = event.data;
                if (owner.terminal) owner.messagesAfterTerminal++;
                owner.messages.push({type: data.type, runId: data.runId,
                    requestId: data.requestId, probeId: data.probeId,
                    textLength: data.text?.length});
            });
            worker.addEventListener('error', event => owner.workerErrors.push({message: event.message || null}));
            return worker;
        }
    });
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    window.runCspCase = async fixture => {
        const startedAt = performance.now();
        const firstViolation = violations.length;
        const metrics = {constructionAttempts: 0, createdWorkers: 0, terminatedWorkers: 0,
            createdUrls: 0, revokedUrls: 0, inputPings: 0, messages: [], workerErrors: [],
            messagesAfterTerminal: 0, terminal: false};
        active = metrics;
        const outputs = [];
        const inputs = [];
        const timers = [];
        let heartbeats = 0;
        let lastInput = null;
        let session;
        const heartbeat = setInterval(() => heartbeats++, 10);
        session = createCodeExecutionSession({
            workerSource: sources[fixture.engine],
            code: fixture.code,
            timeoutMs: fixture.timeoutMs || 2500,
            inputProbeIntervalMs: 50,
            inputProbeTimeoutMs: 300,
            flushIntervalMs: 10,
            maxOutputChars: fixture.outputLimit || 65536,
            onOutput: (text, metadata) => {
                outputs.push({text, ...metadata, atMs: performance.now() - startedAt});
                if (fixture.stopOnOutput && text) session.stop('csp-probe-output-stop');
            },
            onInput: input => {
                inputs.push(input ? {...input, atMs: performance.now() - startedAt} : null);
                if (!input) return;
                lastInput = input;
                timers.push(setTimeout(() => {
                    if (fixture.stopOnInput) session.stop('csp-probe-input-stop');
                    else session.replyToInput(input.requestId, 'Ada');
                }, fixture.stopOnInput ? 30 : fixture.answerDelayMs || 20));
            }
        });
        const watchdog = setTimeout(() => session.stop('csp-probe-watchdog'), 8000);
        let result;
        try {
            result = await session.promise;
            metrics.terminal = true;
            // Worker.terminate has no completion acknowledgement. This observes
            // a quiet window and never labels its call duration as stop latency.
            await delay(120);
        } finally {
            clearTimeout(watchdog);
            clearInterval(heartbeat);
            timers.forEach(clearTimeout);
            session.dispose();
            active = null;
        }
        const failures = [];
        const expect = (condition, message) => { if (!condition) failures.push(message); };
        expect(metrics.constructionAttempts === 1, 'production factory must attempt one native worker');
        expect(metrics.createdUrls === 1 && metrics.revokedUrls === 1 && liveBlobUrls.size === 0,
            'production factory must release its single Blob URL');
        expect(metrics.terminatedWorkers === metrics.createdWorkers,
            'every successfully constructed worker must be terminated exactly once');
        expect(metrics.createdWorkers <= 1, 'one session cannot create multiple workers');
        expect(metrics.messagesAfterTerminal === 0, 'no worker message may arrive after settlement');
        expect(metrics.messages.every(message => message.runId === session.id), 'wire run ownership');
        expect(result.reason !== 'csp-probe-watchdog', 'the harness watchdog is not a production outcome');
        expect(result.output.length <= (fixture.outputLimit || 65536), 'bounded final output');
        if (fixture.blocked) {
            expect(['error', 'unavailable'].includes(result.status), 'CSP denial must fail explicitly without timing out');
            expect(result.output === '' && inputs.length === 0, 'denied source must not execute learner effects');
            if (fixture.blocked === 'eval') expect(/unsafe-eval|Content Security Policy|EvalError/i.test(result.error || ''),
                'dynamic compilation denial must retain its CSP diagnostic');
        } else {
            expect(violations.length === firstViolation, 'permitted execution cannot trigger a document CSP violation');
            expect(result.status === (fixture.status || 'completed'), `expected ${fixture.status || 'completed'} status`);
            if (fixture.expectedOutput !== undefined) expect(result.output === fixture.expectedOutput, 'expected learner output');
            if (fixture.stopOnInput) {
                expect(result.reason === 'csp-probe-input-stop', 'Stop owns the input wait');
                expect(inputs.filter(Boolean).length === 1 && inputs.at(-1) === null, 'Stop clears the current input');
            }
            if (fixture.answerDelayMs) {
                expect(inputs.filter(Boolean).length === 1 && inputs.at(-1) === null, 'answered input clears');
                expect(performance.now() - startedAt > fixture.answerDelayMs, 'human wait actually exceeded the execution budget');
                expect(metrics.inputPings > 0 && metrics.messages.some(message => message.type === 'input-pong'),
                    'responsive input probes traverse the default factory worker');
            }
            if (fixture.stopOnOutput) {
                expect(result.reason === 'csp-probe-output-stop', 'Stop owns the busy worker');
                expect(heartbeats > 0, 'parent remains responsive');
            }
            if (fixture.outputLimit) expect(result.output.length === fixture.outputLimit && result.truncated,
                'output cap is reached and reported');
        }
        const lateInputAccepted = lastInput ? session.replyToInput(lastInput.requestId, 'late') : null;
        if (lastInput) expect(lateInputAccepted === false, 'a settled worker cannot accept a late reply');
        return {name: fixture.name, engine: fixture.engine, code: fixture.code, result,
            wallMs: performance.now() - startedAt, outputs, inputs, metrics,
            parentHeartbeats: heartbeats, lateInputAccepted,
            documentViolations: violations.slice(firstViolation), failures, pass: failures.length === 0};
    };
    window.cspProbeCapabilities = {isSecureContext, crossOriginIsolated,
        sharedArrayBuffer: typeof SharedArrayBuffer === 'function', userAgent: navigator.userAgent};
    window.cspHarnessReady = true;
}
const harnessSource = `${browserHarness.toString()}\nawait browserHarness();\n`;
const cspReports = [];
const requests = [];
const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/csp-report' && request.method === 'POST') {
        let body = '';
        for await (const chunk of request) {
            body += chunk;
            if (body.length > 65536) { response.writeHead(413); response.end(); return; }
        }
        try { cspReports.push({profile: url.searchParams.get('profile'), report: JSON.parse(body)}); }
        catch { cspReports.push({profile: url.searchParams.get('profile'), malformedReport: body.slice(0, 1000)}); }
        response.writeHead(204);
        response.end();
        return;
    }
    if (url.pathname === '/') {
        const profile = url.searchParams.get('profile');
        if (!Object.hasOwn(profiles, profile)) { response.writeHead(400); response.end(); return; }
        const policy = profiles[profile];
        if (policy) response.setHeader('Content-Security-Policy', `${policy}; report-uri /csp-report?profile=${profile}`);
        response.setHeader('Content-Type', 'text/html');
        response.setHeader('Cache-Control', 'no-store');
        response.end('<!doctype html><meta charset="utf-8"><title>Code session CSP probe</title><p>Production default-worker loading checks</p><script type="module" src="/harness.mjs"></script>');
        return;
    }
    const source = url.pathname === '/harness.mjs' ? harnessSource : contents[url.pathname];
    if (source !== undefined) {
        requests.push({path: url.pathname, bytes: Buffer.byteLength(source)});
        response.setHeader('Content-Type', 'text/javascript');
        response.setHeader('Cache-Control', 'no-store');
        response.end(source);
    } else {
        response.writeHead(404);
        response.end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const resultPath = path.resolve(args.output || path.join(directory, 'session-csp-browser-results.json'));
const report = {
    schema: 1,
    createdAt: new Date().toISOString(),
    scope: 'production default Blob-worker factory and console sources under explicit localhost HTTP CSP; no React/application build, hosted production policy, native protocol, WebView or device qualification',
    implementation: {
        head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: appRoot, encoding: 'utf8'}).trim(),
        sourceModified: !!execFileSync('git', ['diff', '--name-only', 'HEAD', '--',
            'overlay/scratch-gui/src/lib/code-execution-session.js',
            'overlay/scratch-gui/src/lib/code-execution-workers.js'], {cwd: appRoot, encoding: 'utf8'}).trim(),
        defaultFactory: true,
        instrumentation: 'call-through observation of native Worker construction/terminate and URL create/revoke; no createWorker injection or production-source rewrite'
    },
    probeSha256: sha256(await fs.readFile(fileURLToPath(import.meta.url))),
    harnessSha256: sha256(harnessSource),
    sourceHashes: Object.fromEntries(Object.entries(contents).map(([url, source]) => [url.slice(1), sha256(source)])),
    probeLockSha256: sha256(await fs.readFile(path.join(dependencies, 'package-lock.json'))),
    nativeConfigObservation: {
        path: 'apps/tauri/src-tauri/tauri.conf.json',
        sha256: sha256(nativeConfigBytes),
        csp: nativeConfig.app?.security?.csp,
        interpretation: 'configuration read only; the no-csp profile is a browser baseline, not execution of the native host'
    },
    environment: {node: process.version, platform: process.platform, arch: process.arch,
        skulpt: requireProbe('skulpt/package.json').version,
        playwright: requireProbe('playwright-core/package.json').version,
        chromiumPackage: JSON.parse(await fs.readFile(path.join(dependencies, 'node_modules/@sparticuz/chromium/package.json'), 'utf8')).version,
        suppliedBrowserArgs: ['--no-sandbox'],
        isolationNote: 'no COOP/COEP, no web-security bypass or forced SharedArrayBuffer flag; --no-sandbox is the container process limitation'},
    profiles: [], results: [], pageErrors: [], consoleErrors: []
};
const normal = engine => ({name: 'normal', engine,
    code: engine === 'python' ? "print('hello')\n" : "console.log('hello');",
    expectedOutput: 'hello\n'});
const input = engine => ({name: 'long-input', engine, timeoutMs: 500, answerDelayMs: 750,
    code: engine === 'python' ? "name = input('Name?')\nprint('hello ' + name)\n" :
        "codeRun.spawn(async task => { const name = await task.input('Name?'); console.log('hello ' + name); });",
    expectedOutput: 'hello Ada\n'});
const stoppedInput = engine => ({name: 'stop-input', engine, stopOnInput: true, status: 'stopped',
    code: engine === 'python' ? "input('Waiting?')\nprint('late')\n" :
        "codeRun.spawn(async task => { await task.input('Waiting?'); console.log('late'); });",
    expectedOutput: ''});
let browser;
try {
    browser = await launcher.launch({executablePath: args.browser || await chromium.executablePath(),
        args: ['--no-sandbox'], headless: true});
    report.environment.browserVersion = browser.version();
    const context = await browser.newContext();
    const page = await context.newPage();
    let activeProfile;
    page.on('pageerror', error => report.pageErrors.push({profile: activeProfile, error: String(error)}));
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({profile: activeProfile, text: message.text()});
    });
    async function runProfile(name, cases, phase = name) {
        activeProfile = phase;
        const response = await page.goto(`http://127.0.0.1:${server.address().port}/?profile=${name}`);
        await page.waitForFunction(() => window.cspHarnessReady === true, null, {timeout: 10000});
        const servedPolicy = response.headers()['content-security-policy'] || null;
        const expectedPolicy = profiles[name] ? `${profiles[name]}; report-uri /csp-report?profile=${name}` : null;
        if (servedPolicy !== expectedPolicy) throw new Error(`CSP response mismatch for ${name}`);
        const capabilities = await page.evaluate(() => window.cspProbeCapabilities);
        if (capabilities.crossOriginIsolated || capabilities.sharedArrayBuffer) throw new Error('Unexpected isolation/shared-memory capability');
        report.profiles.push({name, phase, servedPolicy, capabilities});
        for (const fixture of cases) {
            const result = await page.evaluate(fixture => window.runCspCase(fixture), fixture);
            report.results.push({profile: name, phase, ...result});
        }
    }
    await runProfile('no-csp', [normal('javascript'), normal('python')]);
    await runProfile('allowed', [
        {name: 'owned-completion', engine: 'javascript',
            code: "codeRun.spawn(async task => { await task.sleep(40); console.log('child'); }); console.log('entry');",
            expectedOutput: 'entry\nchild\n'},
        input('javascript'), input('python'), stoppedInput('javascript'), stoppedInput('python'),
        {name: 'stop-busy-worker', engine: 'javascript', code: "console.log('x'.repeat(4096)); while (true) {}",
            stopOnOutput: true, status: 'stopped'},
        {name: 'output-limit', engine: 'javascript',
            code: "globalThis.oldRun = 42; while (true) console.log('x'.repeat(100));", outputLimit: 1024, status: 'output-limit'},
        {name: 'fresh-worker-after-limit', engine: 'javascript', code: "console.log(typeof oldRun);", expectedOutput: 'undefined\n'}
    ]);
    await runProfile('worker-denied', ['javascript', 'python'].map(engine => ({...normal(engine), blocked: 'worker'})));
    await runProfile('eval-denied', ['javascript', 'python'].map(engine => ({...normal(engine), blocked: 'eval'})));
    // Same browser/context after denial. Navigation deliberately installs a new
    // permitted document policy; the test does not disable enforcement in place.
    await runProfile('allowed', [normal('javascript'), normal('python')], 'allowed-after-denial');
    await context.close();
} catch (error) {
    report.fatalError = String(error.stack || error);
} finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}
report.cspReports = cspReports;
report.servedRequests = requests;
report.negativeEvidence = ['worker-denied', 'eval-denied'].map(profile => {
    const expectedDirective = profile === 'worker-denied' ? 'worker-src' : 'script-src';
    const reports = cspReports.filter(entry => entry.profile === profile).map(entry => entry.report?.['csp-report']).filter(Boolean);
    const matchingReports = reports.filter(entry => entry['effective-directive'] === expectedDirective &&
        entry.disposition === 'enforce' &&
        (profile !== 'eval-denied' || entry['blocked-uri'] === 'eval'));
    const documentEvents = report.results.filter(result => result.profile === profile)
        .flatMap(result => result.documentViolations || []).filter(event => event.effectiveDirective === expectedDirective && event.disposition === 'enforce');
    const failures = [];
    if (!matchingReports.length) failures.push(`No enforced ${expectedDirective} CSP report received`);
    if (profile === 'worker-denied' && !documentEvents.length) failures.push('No document worker-src violation event observed');
    return {profile, expectedDirective, matchingReportCount: matchingReports.length,
        documentEventCount: documentEvents.length, failures, pass: failures.length === 0};
});
report.summary = {passed: report.results.filter(result => result.pass).length,
    total: report.results.length,
    failed: report.results.filter(result => !result.pass).map(({profile, name, engine, failures}) => ({profile, name, engine, failures})),
    negativeEvidencePassed: report.negativeEvidence.filter(item => item.pass).length,
    negativeEvidenceTotal: report.negativeEvidence.length};
await fs.writeFile(resultPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({output: resultPath, summary: report.summary, pageErrors: report.pageErrors,
    negativeEvidence: report.negativeEvidence, fatalError: report.fatalError}));
if (report.fatalError || report.pageErrors.length || report.summary.total !== 16 ||
    report.summary.failed.length || report.negativeEvidence.some(item => !item.pass)) process.exitCode = 1;
