/**
 * Live proof of the real CP/M 2.2 boot in the GUI (the honest gap the unit
 * tests can't close): they drive the CPU directly and prove the boot LOGIC;
 * this drives the GUI's own run loop and proves the A> prompt actually reaches
 * the browser. Imports a z80 machine with a `cpmsys` boot slot from the Machine
 * Manager, clicks Run, and waits for `A>` to appear in the serial console —
 * with a page-error collector asserted as its own check, because a boot that
 * dies of a JS error can leave stale text on screen, so "A> present" must mean
 * "A> was produced". (Template + traps courtesy of verify-basic-run.mjs.)
 *
 * Needs a built app under packages/scratch-gui/build, which it serves itself.
 * Without one it exits 0 with a note — an environment matter, not a code
 * regression — UNLESS BW_CPM_REQUIRE=1, which the wired CI step sets: there the
 * build exists, so a skip would be a gate reporting success for work it did not
 * do.
 */
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {compareLinuxBootTimings} from './lib/linux-boot-timing.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const ARTIFACTS = join(root, 'artifacts', 'cpm-system');
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.map': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.com': 'application/octet-stream', '.bin': 'application/octet-stream'};

// BW_CPM_REQUIRE=1 REMOVES THE ESCAPE. The skip below exists so a developer
// without a build is not told their code is broken; in CI, where the job builds
// first, an exit 0 on a missing build would be a gate reporting success for
// work it never did. The wired step sets the flag, the same way the flag-on
// FPGA surface gate does.
if (!existsSync(join(build, 'index.html'))) {
    if (process.env.BW_CPM_REQUIRE === '1') {
        console.error('BW_CPM_REQUIRE=1 but there is no build under packages/scratch-gui/build — '
            + 'the gate cannot skip when it is required to run');
        process.exit(1);
    }
    console.log('NOTE: no build under packages/scratch-gui/build — skipping the live CP/M boot proof');
    process.exit(0);
}

const server = createServer(async (req, res) => {
    try {
        let path = decodeURIComponent((req.url || '/').split('?')[0]);
        if (path === '/' || path.endsWith('/')) path += 'index.html';
        const file = join(build, normalize(path));
        if (!file.startsWith(build)) throw new Error('escape');
        const body = await readFile(file);
        res.writeHead(200, {'content-type': MIME[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
});
let port = null;
for (let p = 8700; p < 8720 && port === null; p++) {
    try { await new Promise((ok, no) => { server.once('error', no); server.listen(p, () => { server.removeListener('error', no); ok(); }); }); port = p; } catch { /* busy */ }
}
const url = `http://localhost:${port}/`;

// A z80 machine whose `cpmsys` slot boots the REAL CP/M 2.2 (the ROMs are in the
// build's static/roms; the slot file rides onto drive A: beside BBC BASIC).
const MANIFEST = JSON.stringify({
    title: 'CP/M 2.2 live', machine: 'z80',
    slots: {cpmsys: 'static/roms/bbcbasic.com'}, boot: true
});

const diagnostics = [];
const failures = [];
const check = (cond, msg, detail = '') => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}${detail ? ` — ${detail}` : ''}`);
    if (!cond) failures.push(msg);
};
// An EXPRESSION THAT CALLS ITSELF. `page.evaluate` takes a string as an
// expression, so a bare arrow function is evaluated to a function object and
// serialises back as `undefined` — every read here was undefined, the stability
// loop threw on `undefined.includes`, its catch swallowed that, and the final
// read then died on `undefined.replace`. The trailing `()` is the whole fix.
const SERIAL = `(() => {
    const el = document.querySelector('[data-testid="bw-serial-console"]');
    return el ? el.textContent : '';
})()`;

const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
try {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => diagnostics.push(`pageerror: ${e.stack || e.message}`));
    page.on('console', m => { if (m.type() === 'error') diagnostics.push(`console.error: ${m.text()}`); });
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1'); indexedDB.deleteDatabase('bw-machines'); } catch { /* */ } });

    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 60000});
    await device.selectOption('__manage__');
    await page.getByTestId('bw-machine-manager').waitFor({state: 'visible', timeout: 15000});
    await page.getByTestId('bw-mm-import-text').fill(MANIFEST);
    await page.getByTestId('bw-mm-import').click();
    await page.getByTestId('bw-mm-row').filter({hasText: 'CP/M 2.2 live'}).waitFor({state: 'visible', timeout: 10000});
    console.log('ok   CP/M machine imported; clicking Run');
    await page.getByTestId('bw-mm-run').first().click();

    // The serial console appears once the machine speaks; wait for it, then for
    // 'A>' to appear AND the text to stop growing (streamed output arrives in
    // pieces — assert on stability, not the first match).
    await page.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-serial-console')
        .waitFor({state: 'visible', timeout: 30000});
    let sawAprompt = false, stableText = '';
    try {
        // A> present AND the text unchanged between two polls — streamed output
        // arrives in pieces, so the first match is not the last word. This is
        // one CONDITION WAIT rather than a sleep loop: waitForFunction's own
        // polling interval is the sample gap, so the script adds nothing to the
        // repository's fixed-sleep census.
        await page.waitForFunction(`(() => {
            const el = document.querySelector('[data-testid="bw-serial-console"]');
            const now = el ? el.textContent : '';
            const prev = window.__bwSerialPrev;
            window.__bwSerialPrev = now;
            return now.includes('A>') && prev === now;
        })()`, null, {timeout: 90000, polling: 300});
        stableText = await page.evaluate(SERIAL);
        sawAprompt = stableText.includes('A>');
    } catch { /* fall through to the checks with whatever we have */ }
    if (!stableText) stableText = await page.evaluate(SERIAL);

    // THE HIGHEST-VALUE CHECK: no page errors. A boot that died of a JS error
    // can leave stale text, so this is what makes "A> present" mean "A> produced".
    check(!diagnostics.some(l => l.startsWith('pageerror:')), 'no page errors during the CP/M boot',
        diagnostics.filter(l => l.startsWith('pageerror:')).slice(0, 2).join(' | '));
    check(sawAprompt, 'the real CP/M 2.2 A> prompt reached the serial console',
        String(stableText || '(nothing)').replace(/\s+/g, ' ').slice(-160));

    // A> ALONE IS A PROMPT, NOT A SYSTEM. Type DIR and read the catalogue back:
    // that exercises the BDOS, the mounted drive A:, and the 8.3 names the boot
    // path derives — the last of which was broken (a machine titled
    // "CP/M 2.2 live" produced `CPM2.2LI.COM`, two dots, and the boot refused
    // by name before a prompt ever appeared). A gate that stops at A> would
    // have stayed green through that, since the refusal happens earlier.
    let dirText = '';
    if (sawAprompt) {
        const input = page.getByTestId('bw-serial-input');
        if (await input.count()) {
            await input.fill('DIR');
            await page.getByTestId('bw-serial-send').click();
            try {
                await page.waitForFunction(`(() => {
                    const el = document.querySelector('[data-testid="bw-serial-console"]');
                    const now = el ? el.textContent : '';
                    const prev = window.__bwDirPrev;
                    window.__bwDirPrev = now;
                    return /BBCBASIC/.test(now) && prev === now;
                })()`, null, {timeout: 60000, polling: 300});
            } catch { /* checked below on whatever arrived */ }
            dirText = await page.evaluate(SERIAL);
        }
        check(/BBCBASIC/.test(dirText), 'DIR lists the disk CP/M was handed — BBCBASIC is on drive A:',
            dirText.replace(/\s+/g, ' ').slice(-200));
        check(/CPM22LIV/.test(dirText),
            'the machine title became a LEGAL 8.3 name — "CP/M 2.2 live" is CPM22LIV.COM, not CPM2.2LI.COM',
            dirText.replace(/\s+/g, ' ').slice(-200));
    }

    await mkdir(ARTIFACTS, {recursive: true});
    await writeFile(join(ARTIFACTS, 'serial.txt'), (dirText || stableText) || '(no serial output)');
    await page.screenshot({path: join(ARTIFACTS, 'cpm-system.png'), fullPage: true});
} catch (e) {
    check(false, 'the CP/M boot flow ran without throwing', String(e.message || e).slice(0, 160));
}

// Also exercise the built-in lesson's Run button from the default Blocks workspace.
try {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bw-starter-v1-complete', '1');
            localStorage.setItem('bw-right-pane-hidden', '1');
        });
        await page.goto(url, {waitUntil: 'domcontentloaded'});
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByText('Machines…', {exact: true}).click();
        await page.getByRole('combobox', {name: 'Machine type'}).selectOption('z80');
        await page.locator('[data-lesson-id="lesson-cpm-z80"]').getByTestId('bw-mm-lesson-run').click();
        const output = page.locator('[data-testid="bw-serial-console"]:visible').first();
        const input = page.locator('[data-testid="bw-serial-input"]:visible').first();
        const expectOutput = text => page.waitForFunction(pattern =>
            [...document.querySelectorAll('[data-testid="bw-serial-console"]')]
                .some(el => el.getClientRects().length && new RegExp(pattern).test(el.textContent)),
        text.source, {timeout: 30_000});
        await output.waitFor({state: 'visible', timeout: 30_000});
        await expectOutput(/A>/);
        for (const [command, response] of [
            ['DIR', /A:\s+BBCBASIC/], ['BBCBASIC', /BBC BASIC/], ['PRINT 2+2', /(?:^|\n)\s*4(?:\s|$)/]
        ]) {
            await input.fill(command);
            await input.press('Enter');
            await expectOutput(response);
        }
        check(!/BBCBASIC\s+2(?:\s|$)/.test(await output.innerText()),
            'the built-in lesson lists one copy of BBCBASIC.COM');
        check(true, 'the built-in CP/M lesson opens its console and runs BBC BASIC');
    } finally {
        await page.close();
    }
} catch (error) {
    check(false, 'the built-in CP/M lesson opens its console and runs BBC BASIC', String(error.message || error));
}

// ─── LINUX ON RISC-V — the Machine Manager's lesson row ─────────────────────
// Same surface, second machine: a fresh page (no CP/M state), the built-in
// "Linux on RISC-V" row, its GPL licence line and source link, Run. The kernel,
// initramfs and post-boot snapshot are fetched from brickwright-media-lab (raw
// CDN at a pinned commit) and sha256-checked by the app before anything runs —
// nothing GPL is in this build. Run OPENS AT THE PROMPT: bw-board restores the
// snapshot (a refusal would fall back to a cold boot and log it — that log is a
// failure here), and the boot log is replayed into the lesson's TERMINAL
// (xterm.js, linux-terminal.jsx). Then a person's keys are typed into it:
// `uname -a`, Ctrl-C into a running `sleep`, Up to recall history, Backspace,
// a paste into `wc -c`, and output that only a terminal emulator draws right
// (SGR colour, `clear`, a carriage return). What is read back is the RENDERED
// screen — xterm's rows — not a transcript. Last, "Boot from scratch" on a
// fresh page boots the real kernel all the way to the prompt. Every wait is a
// condition (waitForFunction), none a sleep. The times printed are the ones a
// learner sees: button click → prompt, fetch included.
const LINUX_ARTIFACTS = join(root, 'artifacts', 'linux-riscv');
// The terminal's visible rows, as drawn (xterm's DOM renderer), trailing blanks trimmed.
const SCREEN = `(() => {
    const rows = document.querySelectorAll('[data-testid="bw-linux-terminal"] .xterm-rows > div');
    return Array.from(rows, r => r.textContent.replace(/\\u00a0/g, ' ').replace(/\\s+$/, '')).join('\\n');
})()`;
/** Wait until the rendered screen, with the prompt on its last non-empty row, matches `re`. */
const screenShows = (page, re, timeout = 60000) => page.waitForFunction(`(() => {
    const screen = ${SCREEN}.replace(/\\n+$/, '');
    const prev = window.__bwScreenPrev;
    window.__bwScreenPrev = screen;
    return ${re}.test(screen) && /bwb#$/.test(screen) && prev === screen;
})()`, null, {timeout, polling: 100}).then(() => true, () => false);
const timing = {};
// One lesson start: a fresh page, the row, a button, the terminal ready and the
// prompt at its tail — still there one poll later (the shell is waiting, not
// mid-print).
async function startLinux(button, inspectRow = null) {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    const errors = [], warnings = [];
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => errors.push(`pageerror: ${e.stack || e.message}`));
    page.on('console', m => { if (/Linux snapshot refused/.test(m.text())) warnings.push(m.text()); });
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1'); indexedDB.deleteDatabase('bw-machines'); } catch { /* */ } });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 60000});
    await device.selectOption('__manage__');
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption('riscv32');
    const row = page.getByTestId('bw-mm-lesson').filter({hasText: 'Linux on RISC-V'});
    await row.waitFor({state: 'visible', timeout: 15000});
    if (inspectRow) await inspectRow(row);
    const t0 = Date.now();
    await row.getByTestId(button).click();
    // The modal closes once the media are fetched and verified; a refusal
    // (a sha256 mismatch names the slot) keeps it open with the reason.
    await page.getByTestId('bw-machine-manager').waitFor({state: 'detached', timeout: 60000}).catch(async () => {
        const why = await page.getByTestId('bw-mm-status').textContent().catch(() => '');
        throw new Error(`the Linux lesson did not start (${button}): ${why}`);
    });
    const fetched = (Date.now() - t0) / 1000;
    await page.waitForFunction(`(() => {
        const el = document.querySelector('[data-bw-stage-dock="controller"] [data-testid="bw-linux-terminal"]');
        return !!el && el.dataset.terminalState === 'ready';
    })()`, null, {timeout: 60000, polling: 100});
    const up = await screenShows(page, /BWB-LINUX-USERSPACE-UP|bwb#/, 120000);
    const prompt = (Date.now() - t0) / 1000;
    return {page, errors, warnings, fetched, prompt, up};
}
try {
    // ── Run: the post-boot snapshot ──
    const run = await startLinux('bw-mm-lesson-run', async row => {
        await row.getByTestId('bw-mm-item-info').click();
        const licence = await row.getByTestId('bw-mm-lesson-licence').textContent();
        check(/GPL-2\.0/.test(licence) && /LGPL-2\.1/.test(licence) && /brickwright-media-lab/.test(licence),
            'the Linux lesson row carries its GPL/LGPL licence line and names where the media come from',
            licence.replace(/\s+/g, ' ').slice(0, 160));
        const href = await row.getByTestId('bw-mm-lesson-source').getAttribute('href');
        check(href === 'https://github.com/CrispStrobe/brickwright-media-lab/releases/tag/riscv32-linux-v1',
            'the source link points at the release that carries the corresponding source', href || '(none)');
        check(await row.getByTestId('bw-mm-lesson-cold').count() === 1, 'the row offers "Boot from scratch" beside Run');
    });
    const {page} = run;
    const linuxErrors = run.errors;
    const term = page.getByTestId('bw-linux-terminal');
    check(await page.getByTestId('bw-serial-input').count() === 0,
        'the Linux console is a terminal: no line-input box beside it');
    check(!run.warnings.length, 'Run opened the post-boot snapshot (no refusal, no fallback to a cold boot)', run.warnings.join(' | '));
    check(run.up, `Linux at the bwb# prompt in the terminal from the snapshot — ${run.prompt.toFixed(1)} s from Run (media fetched + verified in ${run.fetched.toFixed(1)} s)`);
    timing.snapshot = {fetchedSeconds: run.fetched, promptSeconds: run.prompt};
    // The restored machine printed nothing yet: what is on screen above the
    // prompt is the boot log the snapshot carries, replayed into the terminal.
    const opened = await page.evaluate(SCREEN);
    check(/BWB-LINUX-USERSPACE-UP/.test(opened),
        'the boot log is in the terminal (replayed from the snapshot), not only the prompt', JSON.stringify(opened.slice(-160)));

    // KEYS, NOT A LINE. Click the terminal (xterm takes focus), then type as a
    // person does: each key a keydown the terminal turns into bytes for the
    // guest, which echoes and edits. `clear` first, so every answer below is
    // read off a screen that held nothing else — and `clear` itself only works
    // if ESC [ H / ESC [ J are drawn as cursor-home and erase.
    await term.click();
    const kb = page.keyboard;
    const cmd = async line => { await kb.type(line); await kb.press('Enter'); };
    const screen = () => page.evaluate(SCREEN);
    await cmd('clear');
    check(await screenShows(page, /^bwb#$/), 'clear (ESC[H ESC[J) leaves only the prompt on the rendered screen',
        JSON.stringify((await screen()).slice(0, 120)));

    await cmd('uname -a');
    const UNAME = /bwb# uname -a\nLinux \S+ 6\.1\.\d+ [^\n]*riscv32 GNU\/Linux\n/;
    check(await screenShows(page, UNAME),
        'uname -a typed into the terminal answers "Linux … riscv32 GNU/Linux" on the next row',
        JSON.stringify((await screen()).slice(-240)));

    await cmd('clear');
    await screenShows(page, /^bwb#$/);
    await cmd('echo SLEEPING; sleep 100');
    await page.waitForFunction(`/\\nSLEEPING\\n?$/.test(${SCREEN}.replace(/\\n+$/, ''))`, null, {timeout: 30000, polling: 100});
    await kb.press('Control+c');
    check(await screenShows(page, /sleep 100\nSLEEPING\n\^C\nbwb#$/, 30000),
        'Ctrl-C in the terminal interrupts a running sleep 100: ^C and a fresh prompt',
        JSON.stringify((await screen()).slice(-200)));

    await cmd('clear');
    await screenShows(page, /^bwb#$/);
    await cmd('echo hist-$((6*7))');
    await screenShows(page, /\nhist-42\nbwb#$/);
    await kb.press('ArrowUp');
    await kb.press('Enter');
    check(await screenShows(page, /hist-42\nbwb# echo hist-\$\(\(6\*7\)\)\nhist-42\nbwb#$/),
        'Up in the terminal recalls the last command from ash\'s history, and Enter runs it again',
        JSON.stringify((await screen()).slice(-200)));

    await kb.type('echo abX');
    await kb.press('Backspace');
    await kb.type('c');
    await kb.press('Enter');
    check(await screenShows(page, /bwb# echo abc\nabc\nbwb#$/),
        'Backspace erases on the guest\'s line (the screen shows echo abc, and abc)',
        JSON.stringify((await screen()).slice(-200)));

    // What only an emulator draws: colour (SGR 31 → a red cell) and a bare CR
    // returning to column 0 so X overwrites the a.
    await cmd('clear');
    await screenShows(page, /^bwb#$/);
    await cmd("printf '\\033[31mRED\\033[0m abc\\rX\\n'");
    check(await screenShows(page, /\nXED abc\nbwb#$/),
        'a carriage return overwrites the row in place (RED abc, then \\r X → "XED abc")',
        JSON.stringify((await screen()).slice(-200)));
    const red = await page.evaluate(`(() => {
        const spans = document.querySelectorAll('[data-testid="bw-linux-terminal"] .xterm-rows span');
        const hit = Array.from(spans).find(s => s.textContent.includes('ED') && s.classList.contains('xterm-fg-1'));
        return hit ? hit.className : null;
    })()`);
    check(!!red, 'SGR 31 is drawn as colour: the RED cells carry xterm-fg-1', String(red));

    // A PASTE, as the browser delivers one (a clipboard event on the terminal's
    // textarea): 2048 bytes in 32 lines, fed to the guest a FIFO at a time.
    await cmd('clear');
    await screenShows(page, /^bwb#$/);
    await cmd('stty -echo; echo PASTE-NOW; wc -c; stty echo');
    await page.waitForFunction(`/\\nPASTE-NOW$/.test(${SCREEN}.replace(/\\n+$/, ''))`, null, {timeout: 30000, polling: 100});
    const pasted = Array.from({length: 32}, (_, i) => `${String(i).padStart(4, '0')}${'-'.repeat(59)}\n`).join('');
    await page.evaluate(text => {
        const ta = document.querySelector('[data-testid="bw-linux-terminal"] textarea');
        const data = new DataTransfer();
        data.setData('text/plain', text);
        ta.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
    }, pasted);
    await kb.press('Control+d');
    check(await screenShows(page, new RegExp(`PASTE-NOW\\n${pasted.length}\\nbwb#$`), 60000),
        `a ${pasted.length}-byte paste arrives whole (wc -c says ${pasted.length})`,
        JSON.stringify((await screen()).slice(-200)));

    check(!linuxErrors.length, 'no page errors while opening Linux from the snapshot and typing into it', linuxErrors.slice(0, 2).join(' | '));
    await mkdir(LINUX_ARTIFACTS, {recursive: true});
    await writeFile(join(LINUX_ARTIFACTS, 'screen.txt'), (await screen()) || '(empty screen)');
    await page.screenshot({path: join(LINUX_ARTIFACTS, 'linux-riscv.png'), fullPage: true});
    await page.close();

    // ── Boot from scratch: the whole kernel boot ──
    const cold = await startLinux('bw-mm-lesson-cold');
    timing.cold = {fetchedSeconds: cold.fetched, promptSeconds: cold.prompt};
    check(cold.up, `Boot from scratch reached the bwb# prompt — ${cold.prompt.toFixed(1)} s from the click (media fetched + verified in ${cold.fetched.toFixed(1)} s)`);
    check(!cold.errors.length, 'no page errors during the cold Linux boot', cold.errors.slice(0, 2).join(' | '));
    // Compare the same existing media-ready boundary. The snapshot downloads
    // more bytes, and sequential runs can see different CDN/cache latency.
    // Click-to-prompt and fetch times remain in the artifact; they are not an
    // engine-speed claim. Preserve the strict half-time boot threshold.
    timing.comparison = compareLinuxBootTimings(timing.snapshot, timing.cold);
    const {snapshotSeconds, coldSeconds, passes} = timing.comparison;
    check(passes,
        `after media readiness the snapshot reaches the prompt in under half the cold boot's time (${snapshotSeconds.toFixed(3)} s vs ${coldSeconds.toFixed(3)} s)`);
    await cold.page.close();
    await writeFile(join(LINUX_ARTIFACTS, 'timing.json'), JSON.stringify(timing, null, 2));
} catch (e) {
    check(false, 'the Linux lesson flow ran without throwing', String(e.message || e).slice(0, 200));
} finally {
    await browser.close();
    server.close();
}

if (diagnostics.length) console.log('\n--- diagnostics ---\n' + diagnostics.slice(0, 8).join('\n'));
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log('\nCP/M 2.2 boots to A>, and Linux on RISC-V to a terminal that takes keys, Ctrl-C, history and a paste, in the browser.');
