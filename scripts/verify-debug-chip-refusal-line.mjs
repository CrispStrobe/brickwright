#!/usr/bin/env node
/**
 * CI-only production-browser proof: a program's chip refusal reaches the panel.
 *
 * The 8255 accepts a mode-1 control word and runs it as mode 0. From the
 * program's side that is indistinguishable from a port that implemented the
 * handshake, so a driver waiting on the strobe acknowledgement waits on a status
 * bit that never moves. This drives that from the Code tab, through the real
 * runner, and reads the line off the panel.
 *
 * THIS FILE PREVIOUSLY CLAIMED THE OPPOSITE, and the retraction belongs here
 * rather than in a commit nobody re-reads. It said no route a user can reach
 * produces a durable refusal, because the ASM tab boots "a chipless DOS bench".
 * That was wrong, and it was wrong because of my program, not the bench.
 *
 * The DOS bench carries ppi1, pit1 and spk, with the 8255 based at 60h — so its
 * control register is port 63h. My first gate wrote the 8237 command to port 08h
 * and my second wrote the 8255 mode word to port 03h, which is the control
 * register of an 8255 based at ZERO: BREADBOARD8086's layout, the one the unit
 * test uses. Both writes decoded to nothing on the bench that was running. I read
 * "no rows" as "no chips", and the bench's own header comment — "a different
 * machine, no chips, INT 21h behind a trap page" — agreed with me. It describes
 * the bench's original shape; the caller merges declared chips now and the base
 * config carries three.
 *
 * A source comment confirming a wrong measurement is the shape this repo has
 * spent the week cataloguing. I reached it by reading instead of probing, in the
 * file where a probe was two minutes' work.
 *
 * WHAT REMAINS TRUE from that investigation: the no-media route boots the XT
 * BIOS whose only refusal is pic1's, present for four steps out of 1,579,840
 * while the 8259 init sequence is incomplete and then correctly cleared. That is
 * measured and unaffected. What was wrong was concluding from it that no route
 * works.
 *
 * THE DRIVE MIRRORS verify-i8086-browser.mjs — select i8086, the ASM tab, type,
 * Assemble — rather than inventing a path. The absent case runs FIRST so the
 * block's appearance is evidence about the program rather than about the page.
 */
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.env.CI && process.env.BW_ALLOW_LOCAL_BROWSER_PROOF !== '1') {
    throw new Error('This resource-intensive browser proof is CI-only; set BW_ALLOW_LOCAL_BROWSER_PROOF=1 explicitly');
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const artifacts = resolve(process.env.CHIP_REFUSAL_ARTIFACTS || 'artifacts/debug-chip-refusal-line');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2'};

const serveBuild = async () => {
    if (!existsSync(join(build, 'index.html'))) throw new Error(`Build first: ${build}/index.html is missing`);
    const server = createServer(async (req, res) => {
        try {
            let requestPath = decodeURIComponent(req.url.split('?')[0]);
            if (requestPath.endsWith('/')) requestPath += 'index.html';
            const file = join(build, normalize(requestPath));
            if (!file.startsWith(build)) throw new Error('path escaped build');
            const body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('not found');
        }
    });
    const first = Number(process.env.BW_PORT || 8231);
    for (let port = first; port < first + 20; port++) {
        const listening = await new Promise((done, fail) => {
            const onError = error => error.code === 'EADDRINUSE' ? done(false) : fail(error);
            server.once('error', onError);
            server.listen(port, () => { server.removeListener('error', onError); done(true); });
        });
        if (listening) return {server, url: `http://localhost:${port}/`};
    }
    throw new Error('no free browser-proof port');
};

await mkdir(artifacts, {recursive: true});
let server;
let browser;
let page;
let url = process.env.PROOF_URL || process.env.BW_URL || null;
const checks = [];
const diagnostics = [];
const check = (name, ok, detail = '') => {
    checks.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
};
const snap = async name => {
    const path = join(artifacts, `${name}.png`);
    await page.screenshot({path, fullPage: true});
    check(`artifact ${name}`, existsSync(path));
};
const recordRequestFailure = request => {
    const reason = request.failure()?.errorText || '';
    // The app deliberately aborts its optional labwired WASM HEAD probe once
    // capability detection has its answer. It is not a failed app resource.
    if (request.method() === 'HEAD' && /labwired_wasm_bg\.wasm/.test(request.url()) &&
        reason === 'net::ERR_ABORTED') return;
    diagnostics.push(`requestfailed: ${request.method()} ${request.url()} ${reason}`);
};

try {
    if (!url) ({server, url} = await serveBuild());
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1600, height: 1050}});
    page.on('dialog', dialog => dialog.accept());
    page.on('pageerror', error => diagnostics.push(`pageerror: ${error.stack || error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') diagnostics.push(`console.error: ${message.text()}`);
    });
    page.on('requestfailed', recordRequestFailure);
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
        localStorage.setItem('bw-debug-dock', 'right');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});

    /** Put a program in the ASM editor and boot the 8086 bench from it. */
    const assemble = async (source) => {
        await page.getByRole('tab', {name: 'Code', exact: true}).click();
        const device = page.getByTestId('bw-device-select');
        await device.waitFor({state: 'visible', timeout: 20000});
        await device.selectOption('i8086');
        await page.waitForFunction(() =>
            document.querySelector('[data-testid="bw-device-select"]')?.value === 'i8086',
        null, {timeout: 20000});
        await page.getByTestId('bw-lang-row').getByRole('button', {name: /ASM/}).click();
        const editor = page.locator('.cm-content').first();
        await editor.click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Backspace');
        await page.keyboard.insertText(source);
        await page.getByTestId('bw-asm-assemble').click();
        await page.waitForFunction(() => /Assembled \d+ bytes in this browser/.test(
            document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || ''),
        null, {timeout: 40000});
        await page.getByRole('tab', {name: /Circuit/}).click();
        await page.locator('[data-debug-panel]:visible').first().waitFor({timeout: 40000});
    };
    const panelState = () => page.locator('[data-debug-panel]').first()
        .getAttribute('data-debug-chip-refusal-state');
    const refusalLines = () => page.evaluate(() =>
        [...document.querySelectorAll('[data-debug-chip-refusal]')].map(n => n.textContent.trim()));

    // ---- the absent case, first ------------------------------------------
    // A program that asks for nothing the model declines. If a block rendered
    // here, every check below would be worthless.
    await assemble(' mov al, 00h\n mov bl, al\nhere:\n jmp here\n');
    const cleanState = await panelState();
    check('a program that refuses nothing leaves the collector empty',
        cleanState === 'empty', `state was ${JSON.stringify(cleanState)}`);
    const cleanBlocks = await page.locator('[data-debug-chip-refusals]').count();
    check('and no block renders', cleanBlocks === 0, `found ${cleanBlocks}`);
    await snap('clean-program-no-refusal');

    // ---- the refusing case -------------------------------------------------
    // The DOS bench bases its 8255 at 60h, so the control register is 63h. A0h
    // selects mode 1 on group A: what a driver writes wanting the strobed
    // handshake, which the 8255 takes and runs as mode 0. Port 63h and not 03h —
    // 03h is the same register on a breadboard based at zero, and writing it
    // here decodes to nothing, which is how the first two versions of this gate
    // spent two CI runs proving the panel was broken when it was not.
    await assemble(' mov al, 0A0h\n out 63h, al\nhere:\n jmp here\n');
    try {
        await page.locator('[data-debug-chip-refusal]').first().waitFor({timeout: 40000});
    } catch (timeout) {
        const trail = await page.evaluate(() => ({
            state: document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-chip-refusal-state'),
            blocks: document.querySelectorAll('[data-debug-chip-refusals]').length,
            lines: document.querySelectorAll('[data-debug-chip-refusal]').length,
            phase: document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase'),
            status: document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus?.slice(0, 160)
        }));
        const verdict = trail.state === 'none'
            ? 'THIS BENCH HAS NO COLLECTOR — the attached machine exposes no chipRefusals(), so '
              + 'no program could produce a line here. Wrong bench, not a wrong chip.'
            : trail.state === 'empty'
                ? 'THE COLLECTOR IS PRESENT AND FOUND NOTHING — the program did not reach a '
                  + 'refusal. Check the PORT against the bench: this bench bases its 8255 at 60h '
                  + '(control 63h); BREADBOARD8086 bases it at 0 (control 03h). A write to an '
                  + 'undecoded port refuses nothing and looks exactly like a broken panel.'
                : 'THE MODEL RETURNED ROWS AND THE PANEL DID NOT RENDER THEM — the fault is the '
                  + 'render, not the collector.';
        throw new Error(`${verdict}\n  trail: ${JSON.stringify(trail)}\n  ${timeout.message}`);
    }
    const lines = await refusalLines();
    check('the mode-1 control word produces exactly one chip-refusal line',
        lines.length === 1, JSON.stringify(lines));
    const [line] = lines;
    check('the line names the part that refused', /^ppi1:/.test(line), line);
    check('the line carries the SYMPTOM, not only the feature',
        /waits on a bit that never moves/.test(line), line);
    // The gate can only see rendered text, so it pins the number; the unit test
    // carries the assertion that survives a contract move (rendered address ==
    // the collector's row). This number is the VENDORED CONTRACT'S and moves
    // with the pin: 03h until bw-board 2e7143af7, 63h after, because the DOS
    // bench bases its 8255 at 60h and `at` became the bus port rather than the
    // register offset.
    check('the line carries the address, in the space the row declares',
        /port 63h/.test(line),
        `${line} — if this says 03h the vendored pin predates 2e7143af7`);
    check('one occurrence prints no count', !/refusals/.test(line), line);
    const part = await page.locator('[data-debug-chip-refusal]').first()
        .getAttribute('data-debug-chip-refusal-part');
    check('the line is keyed by part so a joiner can use it', part === 'ppi1', String(part));
    const state = await panelState();
    check('the panel state reports the row count once there is one', state === '1', String(state));
    await snap('mode-1-refusal-line');

    check('no page errors or failed requests', diagnostics.length === 0,
        diagnostics.slice(0, 4).join(' | '));
    await writeFile(join(artifacts, 'result.json'),
        JSON.stringify({url, cleanState, lines, checks, diagnostics}, null, 2));
    console.log(`\nChip-refusal line: ${checks.filter(c => c.ok).length}/${checks.length} checks passed.`);
} catch (error) {
    if (page) await page.screenshot({path: join(artifacts, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(join(artifacts, 'failure.txt'),
        `${error.stack || error}\n\ndiagnostics:\n${diagnostics.join('\n')}\n`).catch(() => {});
    throw error;
} finally {
    if (browser) await browser.close();
    if (server) await new Promise(done => server.close(done));
}
