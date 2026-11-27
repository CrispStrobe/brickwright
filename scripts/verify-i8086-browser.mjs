#!/usr/bin/env node
/**
 * Production-browser acceptance for the 8086 ASM journey.
 *
 * One Chromium session drives two unchanged examples through the controls a
 * learner uses. `keys` proves selection, the local assembler, the DOS bench,
 * CGA pixels and live keyboard input. `pins` proves that the same route also
 * reaches the 8255 faces: closing PC0 changes the program's PA0..PA3 outputs.
 *
 * With PROOF_URL this drives an already-served production build. Without it,
 * the script serves packages/scratch-gui/build itself.
 */
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {isHostedCompilerRequest} from './lib/offline-compiler-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const artifacts = resolve(process.env.I8086_BROWSER_ARTIFACTS || 'artifacts/i8086-browser');
const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

async function serveBuild () {
    if (!existsSync(join(build, 'index.html'))) {
        throw new Error(`Build first: ${join(build, 'index.html')} is missing`);
    }
    const server = createServer(async (req, res) => {
        try {
            let requestPath = decodeURIComponent(req.url.split('?')[0]);
            if (requestPath.endsWith('/')) requestPath += 'index.html';
            const file = join(build, normalize(requestPath));
            if (!file.startsWith(build)) throw new Error('path escaped the build');
            const body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('not found');
        }
    });
    const first = Number(process.env.BW_PORT || 8181);
    for (let port = first; port < first + 20; port++) {
        const listening = await new Promise((done, fail) => {
            const onError = error => {
                server.removeListener('listening', onListening);
                if (error.code === 'EADDRINUSE') done(false);
                else fail(error);
            };
            const onListening = () => {
                server.removeListener('error', onError);
                done(true);
            };
            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(port);
        });
        if (listening) return {server, url: `http://localhost:${port}/`};
    }
    throw new Error('no free port for the production build');
}

await mkdir(artifacts, {recursive: true});
const results = [];
const diagnostics = [];
const record = (name, ok, detail = '') => {
    results.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

let server = null;
let browser = null;
let page = null;
let url = process.env.PROOF_URL || process.env.BW_URL || null;
const hostedCompilerRequests = [];
let interceptionControls = 0;
const waitForCodeIdle = async () => page.waitForFunction(() => {
    const control = document.querySelector('[data-testid="bw-device-select"]');
    if (!control) return false;
    const key = Object.keys(control).find(name =>
        name.startsWith('__reactFiber') || name.startsWith('__reactInternalInstance'));
    let fiber = key && control[key];
    for (let depth = 0; fiber && depth < 64; depth++, fiber = fiber.return) {
        const node = fiber.stateNode;
        if (node && typeof node.loadAsmExample === 'function' && typeof node.setDevice === 'function') {
            return !node.state.busy;
        }
    }
    return false;
}, null, {timeout: 15000});

try {
    if (!url) ({server, url} = await serveBuild());
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1600, height: 1050}});
    for (const name of ['bw-board.MIT.txt', 'bw-circuit-ui.MPL-2.0.txt', 'bw-packages.sources.json']) {
        const response = await page.request.get(new URL(`static/licenses/${name}`, url).href);
        const expected = await readFile(join(root, 'overlay/scratch-gui/static/licenses', name));
        record(`the production server preserves package notice ${name}`, response.ok() &&
            Buffer.from(await response.body()).equals(expected));
    }
    page.on('dialog', dialog => dialog.accept());
    page.on('pageerror', error => diagnostics.push(`pageerror: ${error.stack || error.message}`));
    page.on('requestfailed', request => diagnostics.push(
        `requestfailed: ${request.method()} ${request.url()} — ${request.failure()?.errorText || 'unknown'}`));
    page.on('response', response => {
        if (response.status() >= 400) diagnostics.push(
            `http ${response.status()}: ${response.request().method()} ${response.url()}`);
    });
    page.on('console', message => {
        if (message.type() === 'error' || message.type() === 'warning') {
            diagnostics.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    await page.addInitScript(() => {
        // Initialize only once so the later reload really tests persistence.
        if (!sessionStorage.getItem('bw-i8086-browser-initialized')) {
            localStorage.clear();
            sessionStorage.clear();
            sessionStorage.setItem('bw-i8086-browser-initialized', '1');
        }
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-debug-diagnostics', '1');
    });

    // Keep the built app and its lazy chunks local, but make a hosted compiler
    // physically unreachable. The synthetic request is the positive control:
    // zero journey requests means something only after the interceptor proves
    // that it can see and stop one with the same method/origin/path shape.
    const appOrigin = new URL(url).origin;
    await page.route(requestUrl => {
        try { return new URL(requestUrl).origin !== appOrigin; } catch { return false; }
    }, route => {
        const request = route.request();
        if (!isHostedCompilerRequest(request, url)) return route.continue();
        if (new URL(request.url()).searchParams.get('bw-i8086-proof-control') === '1') {
            interceptionControls++;
        }
        else hostedCompilerRequests.push(request.url());
        return route.abort('blockedbyclient');
    });

    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.evaluate(async () => {
        try {
            await fetch('https://stc-compiler.vercel.app/compile?bw-i8086-proof-control=1', {
                method: 'POST', body: '{}'
            });
        } catch { /* the route must abort this request */ }
    });
    record('offline interceptor catches a foreign compiler POST', interceptionControls === 1,
        `caught ${interceptionControls}`);

    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 15000});
    await device.selectOption('i8086');
    await page.waitForFunction(() =>
        document.querySelector('[data-testid="bw-device-select"]')?.value === 'i8086',
    null, {timeout: 15000});
    await waitForCodeIdle();
    await page.getByTestId('bw-lang-row').getByRole('button', {name: /ASM/}).click();

    const examples = page.getByTestId('bw-asm-examples');
    await examples.waitFor({state: 'visible', timeout: 15000});
    await examples.selectOption('keys');
    await page.waitForFunction(() =>
        /A Program That Waits For You/.test(document.querySelector('.cm-content')?.textContent || ''),
    null, {timeout: 15000});
    record('the shipped keyboard example loads through the picker', true);

    await page.getByTestId('bw-asm-assemble').click();
    await page.waitForFunction(() => /Assembled \d+ bytes in this browser.*booting the 8086 bench/.test(
        document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || ''),
    null, {timeout: 30000});
    record('the ASM button reports the local route and boots the 8086 bench', true);

    await page.getByRole('tab', {name: /Circuit/}).click();

    const surface = page.getByRole('combobox', {name: 'Controller surface'});
    await surface.selectOption('terminal');
    await page.waitForFunction(() => /Type something\. ESC quits\./.test(
        document.querySelector('[data-testid="bw-serial-console"]')?.textContent || ''),
    null, {timeout: 30000});
    record('the running program prints its prompt', true);

    // Read the actual canvas. DOM text alone would stay green if the CGA face
    // stopped painting; requiring dark and foreground samples rejects both a
    // blank canvas and a one-colour fill.
    await surface.selectOption('screen');
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        if (!canvas || !canvas.width || !canvas.height) return false;
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let dark = 0;
        let foreground = 0;
        for (let i = 0; i < data.length; i += 16) {
            const light = data[i] + data[i + 1] + data[i + 2];
            if (light < 24) dark++;
            else foreground++;
        }
        return dark > 100 && foreground > 40;
    }, null, {timeout: 30000, polling: 'raf'});
    const canvasSize = await page.getByTestId('bw-machine-canvas').evaluate(
        canvas => `${canvas.width}x${canvas.height}`);
    record('the CGA face contains background and rendered foreground pixels', true, canvasSize);

    await page.getByTestId('bw-machine-canvas').click();
    await page.keyboard.press('Shift+KeyZ');
    await surface.selectOption('terminal');
    await page.waitForFunction(() => /Z\s+5A/.test(
        document.querySelector('[data-testid="bw-serial-console"]')?.textContent || ''),
    null, {timeout: 20000});
    record('a typed Z reaches INT 21h and the program answers with 5A', true);

    // A second unchanged example gives the DOS bench a port-driving program.
    // Reusing this page also exercises replacement and runner teardown rather
    // than paying for (and hiding behind) a fresh app load.
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await examples.selectOption('pins');
    await page.waitForFunction(() =>
        /An LED and a Switch on the 8255/.test(document.querySelector('.cm-content')?.textContent || ''),
    null, {timeout: 15000});
    record('the shipped 8255 example replaces the first example', true);

    await page.getByTestId('bw-asm-assemble').click();
    await page.getByRole('tab', {name: /Circuit/}).click();
    await surface.selectOption('widgets');
    const gpio = page.getByTestId('bw-ctl-bargraph-PC GPIO');
    await gpio.waitFor();
    const initialPortA = Number((await gpio.innerText()).trim());
    await page.waitForFunction(before => {
        const output = document.querySelector('[data-testid="bw-ctl-bargraph-PC GPIO"]');
        return output && (Number(output.textContent) & 0x80) !== (before & 0x80);
    }, initialPortA, {timeout: 10000});
    record('the running 8255 program changes a driven output', true, String(initialPortA));

    const pc0 = page.getByTestId('bw-ctl-button-PC switch');
    await pc0.waitFor({state: 'visible', timeout: 15000});
    await pc0.click();
    await page.waitForFunction(() => {
        const output = document.querySelector('[data-testid="bw-ctl-bargraph-PC GPIO"]');
        return output && (Number(output.textContent) & 0x0f) === 0x0f;
    },
    null, {timeout: 5000, polling: 'raf'});
    record('closing 8255 PC0 makes the program drive PA0..PA3 high', true);

    // Open the real Settings surface. The lab must not replace or mutate the
    // paused project target while its private CPUs execute bundled programs.
    const projectState = await page.evaluate(() => {
        const target = window.__benchTarget;
        if (!target) throw new Error('No real project target to protect');
        target.halt(); window.__labProjectTarget = target;
        return JSON.stringify({regs: target.regs(), time: String(target.timeNs()),
            mem: Array.from(target.readMem('mem', 0, 256))});
    });
    await page.getByText('Settings', {exact: true}).click();
    await page.getByText('8086 execution diagnostics…', {exact: true}).click();
    const lab = page.getByTestId('i8086-lab');
    await lab.waitFor({state: 'visible'});
    const executionStatus = page.getByTestId('i8086-execution-status');
    const activeBeforePreference = await executionStatus.textContent();
    record('actual constructed DOS target is reported as Auto / DOS-services / JavaScript',
        /Active request: auto/.test(activeBeforePreference) &&
        /8086\s*\/\s*dos-services\s*\/\s*javascript/.test(activeBeforePreference));
    await page.getByTestId('i8086-execution-mode').selectOption('wired');
    record('browser execution preference persists without relabelling the existing target',
        await page.evaluate(() => localStorage.getItem('bw-i8086-execution')) === 'wired' &&
        await executionStatus.textContent() === activeBeforePreference);
    await page.getByTestId('i8086-memory-mode').selectOption('reference');
    record('reference byte preference persists without selecting an experimental backend',
        await page.evaluate(() => localStorage.getItem('bw-i8086-memory')) === 'reference');
    await page.getByTestId('i8086-lab-run').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="i8086-lab-status"]')?.textContent
        .startsWith('Complete —'), null, {timeout: 60000});
    const rows = await page.getByTestId('i8086-lab-results').locator('tbody tr').allTextContents();
    record('bundled benchmark actually compares JS, decoded and Wasm with matching states',
        rows.length === 3 && rows.every(row => /matched/.test(row)) && rows.some(row => /wasm/.test(row)), rows.join(' | '));
    const executionCounts = JSON.parse(await page.getByTestId('i8086-lab-results').locator('pre').textContent());
    record('sandbox Wasm result contains real compiled-loop execution, not only fallback',
        executionCounts.find(row => row.mode === 'wasm')?.samples.every(sample =>
            sample.compilations > 0 && sample.loopIterations > 0));
    record('sandbox leaves the project target, registers, time and RAM unchanged', await page.evaluate(before => {
        const target = window.__benchTarget;
        return target === window.__labProjectTarget && before === JSON.stringify({regs: target.regs(),
            time: String(target.timeNs()), mem: Array.from(target.readMem('mem', 0, 256))});
    }, projectState));
    await page.screenshot({path: join(artifacts, 'execution-diagnostics.png'), fullPage: true});
    await page.getByTestId('i8086-lab-run').click();
    await page.getByTestId('i8086-lab-cancel').click();
    await page.waitForFunction(() => /cancelled/.test(document.querySelector('[data-testid="i8086-lab-status"]')?.textContent || ''),
        null, {timeout: 15000});
    record('benchmark cancellation returns control without an accepted result', true);
    await page.getByTestId('i8086-memory-mode').selectOption('optimized');
    await page.keyboard.press('Escape');
    await lab.waitFor({state: 'hidden'});
    record('Escape closes the diagnostics dialog', true);
    record('closed sandbox leaves no hidden dialog controls in the document', await lab.count() === 0);

    // Use the real assemble/attach route again: Wired must refuse this new DOS
    // construction, not relabel it as wired or quietly start a functional core.
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-asm-assemble').click();
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.getByText('Settings', {exact: true}).click();
    await page.getByText('8086 execution diagnostics…', {exact: true}).click();
    await page.waitForFunction(() => {
        const text = document.querySelector('[data-testid="i8086-execution-status"]')?.textContent || '';
        return /Refused: no-matching-implementation/.test(text) && /no functional substitute/.test(text);
    }, null, {timeout: 30000});
    record('real project reconstruction refuses Wired without claiming an active backend',
        /No active 8086\/80186/.test(await executionStatus.textContent()));

    // A real navigation exercises persisted storage, not only the in-memory
    // session override. The fresh page starts with no active target claim.
    await page.reload({waitUntil: 'domcontentloaded', timeout: 90000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.getByText('Settings', {exact: true}).click();
    await page.getByText('8086 execution diagnostics…', {exact: true}).click();
    record('Wired preference survives a browser reload',
        await page.getByTestId('i8086-execution-mode').inputValue() === 'wired');
    await page.getByTestId('i8086-execution-mode').selectOption('auto');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await device.selectOption('i8086');
    await waitForCodeIdle();
    await page.getByTestId('bw-lang-row').getByRole('button', {name: /ASM/}).click();
    await examples.selectOption('keys');
    await page.waitForFunction(() => /A Program That Waits For You/.test(
        document.querySelector('.cm-content')?.textContent || ''), null, {timeout: 15000});
    // Hold only the return of the real completed VM load. The guest/archive is
    // not replaced: retargeting stays busy until this explicit gate is released.
    await page.evaluate(() => {
        const control = document.querySelector('[data-testid="bw-device-select"]');
        if (!control) throw new Error('device control missing for pending-compile proof');
        const key = Object.keys(control).find(name =>
            name.startsWith('__reactFiber') || name.startsWith('__reactInternalInstance'));
        let fiber = key && control[key];
        let importer;
        for (let depth = 0; fiber && depth < 64; depth++, fiber = fiber.return) {
            const node = fiber.stateNode;
            if (node && typeof node.loadAsmExample === 'function' && typeof node.setDevice === 'function' && node.props?.vm) {
                importer = node;
                break;
            }
        }
        if (!importer) throw new Error('actual Code importer missing for pending-compile proof');
        if (importer.state.busy) throw new Error('unexpected compile already pending');
        const vm = importer.props.vm;
        const original = vm.loadProject;
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const proof = {importer, held: false, consumed: false, before: importer.state.buffers.asm};
        const wrapper = async function (...args) {
            const result = await original.apply(this, args);
            if (!proof.consumed) {
                proof.consumed = true;
                proof.held = true;
                await gate;
            }
            return result;
        };
        proof.cleanup = () => {
            release();
            if (vm.loadProject === wrapper) vm.loadProject = original;
        };
        window.__bwAsmCompileProof = proof;
        vm.loadProject = wrapper;
    });
    try {
        await device.selectOption('i8086');
        await page.waitForFunction(() => window.__bwAsmCompileProof?.held &&
            window.__bwAsmCompileProof.importer.state.busy, null, {timeout: 15000});
        record('ASM example picker is disabled while a real completed VM load awaits publication',
            await examples.isDisabled());
        await page.evaluate(async () => {
            const proof = window.__bwAsmCompileProof;
            if (!proof.before || !/A Program That Waits For You/.test(proof.before)) {
                throw new Error('original authored ASM source missing');
            }
            proof.chosen = proof.importer._asmExamples().find(example => example.id === 'pins').source;
            await proof.importer.loadAsmExample('pins');
        });
        await page.waitForFunction(() => {
            const proof = window.__bwAsmCompileProof;
            return proof.importer.state.busy && proof.importer.state.buffers.asm === proof.chosen;
        }, null, {timeout: 15000});
        record('accepted method request owns newer ASM source while VM publication is pending',
            await page.evaluate(() => {
                const proof = window.__bwAsmCompileProof;
                proof.acceptedBuffers = proof.importer.state.buffers;
                proof.acceptedStatus = proof.importer.state.status;
                return proof.chosen !== proof.before && proof.importer.state.busy;
            }));
    } finally {
        await page.evaluate(() => window.__bwAsmCompileProof?.cleanup());
    }
    await page.waitForFunction(() => !window.__bwAsmCompileProof.importer.state.busy,
        null, {timeout: 15000});
    record('old VM completion preserves accepted ASM buffer identity, source and feedback',
        await page.evaluate(() => {
            const proof = window.__bwAsmCompileProof;
            return proof.importer.state.buffers === proof.acceptedBuffers &&
                proof.importer.state.buffers.asm === proof.chosen &&
                proof.importer.state.status === proof.acceptedStatus;
        }));
    await page.evaluate(() => { delete window.__bwAsmCompileProof; });
    await examples.selectOption('pins');
    await page.waitForFunction(() => /An LED and a Switch on the 8255/.test(
        document.querySelector('.cm-content')?.textContent || ''), null, {timeout: 15000});
    await page.getByTestId('bw-asm-assemble').click();
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.getByText('Settings', {exact: true}).click();
    await page.getByText('8086 execution diagnostics…', {exact: true}).click();
    await page.waitForFunction(() => /Active request: auto.*dos-services.*javascript/.test(
        document.querySelector('[data-testid="i8086-execution-status"]')?.textContent || ''),
    null, {timeout: 30000});
    record('Auto successfully reconstructs the DOS-services target after explicit refusal', true);

    record('the 8086 journey made no hosted compiler request', hostedCompilerRequests.length === 0,
        hostedCompilerRequests.join(' | '));
    record('the browser raised no uncaught page error',
        !diagnostics.some(line => line.startsWith('pageerror:')),
        diagnostics.filter(line => line.startsWith('pageerror:')).join(' | '));
} catch (error) {
    diagnostics.push(`gate: ${error.stack || error.message || error}`);
    if (page) {
        const state = await page.evaluate(() => ({
            pending: window.__bwPendingMedia && {
                type: window.__bwPendingMedia.type,
                target: window.__bwPendingMedia.detail?.target,
                bytes: window.__bwPendingMedia.detail?.rom?.length
            },
            consoles: document.querySelectorAll('[data-testid="bw-serial-console"]').length,
            debugPanels: document.querySelectorAll('[data-debug-panel-crash]').length,
            debugSlots: document.querySelectorAll('[data-debug-host-slot]').length,
            rightPane: localStorage.getItem('bw-right-pane-hidden')
        })).catch(e => ({diagnosticError: e.message}));
        diagnostics.push(`browser-state: ${JSON.stringify(state)}`);
    }
    record('the complete 8086 browser journey finishes', false, error.message || String(error));
} finally {
    if (page) {
        await page.evaluate(() => {
            window.__bwAsmCompileProof?.cleanup();
            delete window.__bwAsmCompileProof;
        }).catch(error => diagnostics.push(`pending-compile cleanup: ${error.message}`));
        await page.screenshot({path: join(artifacts, 'final.png'), fullPage: true}).catch(error => {
            diagnostics.push(`screenshot: ${error.message}`);
        });
    }
    const report = {
        url, scenarios: results.length, passed: results.filter(result => result.ok).length,
        interceptionControls, hostedCompilerRequests, results, diagnostics
    };
    await writeFile(join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (browser) await browser.close();
    if (server) await new Promise(done => server.close(done));
}

const failures = results.filter(result => !result.ok);
console.log(failures.length ? `\n${failures.length} 8086 browser check(s) failed.` :
    '\nAll 8086 production-browser checks passed.');
process.exit(failures.length ? 1 : 0);
