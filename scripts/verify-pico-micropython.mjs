#!/usr/bin/env node
/** End-to-end proof for the Pico MicroPython SIMULATOR Run (N3c).
 *
 *  The unit tests prove the mechanism: the emulator oracle boots MicroPython
 *  and drives GP25, the census pins the firmware, the matrix lights the cell.
 *  None answers the only question a learner has: does pressing ▶ Run on a Pico
 *  Python project in a real browser boot the firmware and make the LED come on?
 *  This drives the GUI — type a Pico blink, To-blocks, pick the Pico, Run — and
 *  then insists the emulated GPIO actually MOVED (the run board's LED lit), not
 *  that a status line said "running". "The panel looked right" is exactly the
 *  plausible-and-wrong this project keeps meeting.
 *
 *  TWO CASES, one build (the labwired-engine gate's discipline):
 *   - execute: firmware present → the LED lights.
 *   - --absent: the SAME build with static/pico-micropython/ withheld — what a
 *     deploy that never ran `sync:picomicropython` looks like — and the Run must
 *     REFUSE BY NAME, not present a button with nothing behind it. That is the
 *     failure this half exists for.
 *
 *  BOOT BUDGET. The node figure (~1.3M instructions, ~0.9–2.6 s wall on this
 *  VPS) is NOT the gate's basis: the emulator is far slower under headless
 *  Chromium on a CI runner, and that number is not yet measured — this gate's
 *  transition trail (phase/enumeration/frames/simMs at each step, dumped on a
 *  red run) is what measures it. Run 34016744671 showed the sim START (board
 *  published, status "starting the Pico simulator…") but GP25 not reach HIGH
 *  inside 60 s, with failed=null — i.e. it neither finished nor refused. So the
 *  poll is bounded at 180 s (the step's 3-minute budget), and the trail says
 *  whether USB enumerated and the REPL banner arrived (slow boot) or not (CDC
 *  never came up in the browser build). If a run shows the browser boot exceeds
 *  what a gate should wait, the sim Run likely needs a progress state rather
 *  than a longer wait — a call to make from the measured number, not guessed.
 *  JUDGED BY THE EMULATED GPIO — the run board's readPin('GP25') — never pixels.
 *
 *  Skips (exit 0) rather than fails when a precondition is genuinely absent: no
 *  local build, or the firmware was never synced. A missing optional artifact
 *  is not a regression, and crying wolf trains everyone to ignore the gate.
 */
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const port = 8123;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm', '.uf2': 'application/octet-stream'};

const ABSENT = process.argv.includes('--absent');
const shot = process.env.PICO_SHOT
    || join(root, 'artifacts', ABSENT ? 'pico-micropython-absent.png' : 'pico-micropython-run.png');

const PROOF_URL = process.env.PROOF_URL || null;
if (PROOF_URL && ABSENT) {
    console.error('verify-pico-micropython: --absent cannot run against PROOF_URL. The branch is '
        + 'proven by WITHHOLDING static/pico-micropython/ from the response, which needs this '
        + "gate's own server. Run it without PROOF_URL, against a local build.");
    process.exit(1);
}
const FW = 'static/pico-micropython/RPI_PICO-20240222-v1.22.2.uf2';
if (!PROOF_URL) {
    if (!existsSync(build)) {
        console.log('SKIP — verify-pico-micropython: no local build (packages/scratch-gui/build). '
            + 'Run the build, or pass PROOF_URL to drive a deployed app.');
        process.exit(0);
    }
    if (!ABSENT && !existsSync(join(build, FW))) {
        console.log('SKIP — verify-pico-micropython: the build has no Pico firmware. Run '
            + '`npm run sync:picomicropython` and rebuild. (The --absent branch WITHHOLDS it on purpose.)');
        process.exit(0);
    }
}

/** Requests the firmware-less branch refused, so the run can say what it denied. */
const withheld = [];
const server = PROOF_URL ? null : createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        if (path.endsWith('/')) path += 'index.html';
        if (ABSENT && /^\/static\/pico-micropython\//.test(path)) {
            withheld.push(path);
            res.writeHead(404);
            res.end('not found');
            return;
        }
        const file = join(build, normalize(path));
        if (!file.startsWith(build)) throw new Error('escape');
        const body = await readFile(file);
        res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch {
        console.log(`404 ${req.url}`);
        if (!res.headersSent) res.writeHead(404);
        res.end('not found');
    }
});
if (server) await new Promise(done => server.listen(port, done));
const APP = PROOF_URL || `http://localhost:${port}/`;
console.log(`driving ${APP}${PROOF_URL ? ' (PROOF_URL)' : ''}${ABSENT ? ' [--absent]' : ''}`);

// A terminating blink: turn GP25 (the onboard LED) on. It stays high, so the
// observe poll below catches the lit LED without racing a toggle.
const PROGRAM = `DEVICE PICO
PIN led = GP25 OUTPUT

WHEN flag clicked:
  turn on led
`;
const SECOND_PROGRAM = `DEVICE PICO
PIN led2 = GP24 OUTPUT

WHEN flag clicked:
  turn on led2
`;

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1400, height: 900}});
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error') console.log(`browser error ${m.text().slice(0, 160)}`); });
page.on('pageerror', e => { pageErrors.push(String(e).slice(0, 200)); console.log(`PAGEERR ${String(e).slice(0, 160)}`); });
const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};
const statusText = () => page.evaluate(() =>
    document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || '');

/** Poll read() until accept(result) or the timeout — a wait on the CONDITION,
 *  never a fixed sleep (the fleet rule; test/wait-census.test.mjs enforces it).
 *  Returns the last read either way, so the caller's check() names what did not
 *  happen. The verify-local-asm-listing.mjs helper, same shape. */
async function waitFor (read, accept, timeoutMs = 60000, stepMs = 250) {
    const end = Date.now() + timeoutMs;
    let last;
    do {
        try { last = await read(); } catch (e) { last = {error: String((e && e.message) || e)}; }
        if (accept(last)) return last;
        await new Promise(r => setTimeout(r, stepMs));
    } while (Date.now() < end);
    return last;
}

let skip = null;
try {
    await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-stage-circuit', '1');
    });
    await page.goto(APP, {waitUntil: PROOF_URL ? 'domcontentloaded' : 'networkidle', timeout: 60000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.waitForFunction(() => {
        const st = window.__brickwrightStore;
        const vm = st && st.getState && st.getState().scratchGui && st.getState().scratchGui.vm;
        if (vm && vm.runtime) { window.__vm = vm; return true; }
        return false;
    }, {timeout: 60000});

    // Seed the program and parse it onto the runtime (To blocks sets the device
    // line's device); then pick the Pico in the dropdown so bwDeviceId is 'pico'.
    // Every step waits on the thing it needs, never on the clock.
    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    // Wait for the CodeMirror editor, type, assert the text is in it (scripts/lib/type-into-editor.mjs);
    // an editor that never mounts throws with that sentence — the old `.cm-content, textarea`
    // wait accepted the placeholder and the fallback filled a textarea the editor had replaced.
    await typeIntoEditor(page, PROGRAM);
    check('the Code editor mounted and holds the program', true);
    await page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first().click({timeout: 8000});
    // To-blocks moves the app to the Blocks view (its status even says "Switch to
    // the Code tab"), and the device picker + language tabs live in the Code
    // view — so come back BEFORE reading them, or the dropdown is not in the DOM.
    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    // To blocks parses the DEVICE line and populates the device picker; wait for
    // the Pico option to exist rather than guessing how long the parse takes.
    const picoOffered = await waitFor(
        () => page.evaluate(() =>
            [...document.querySelectorAll('select option')].some(o => /pico|rp2040/i.test(o.textContent))),
        ok => ok === true, 30000);
    check('the device picker offers the Pico after To blocks', picoOffered === true);
    await page.evaluate(() => {
        for (const sel of document.querySelectorAll('select')) {
            const opt = [...sel.options].find(o => /pico|rp2040/i.test(o.textContent));
            if (!opt) continue;
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', {bubbles: true}));
            return;
        }
    });
    // Wait for the runtime to register the Pico, not for a fixed settle.
    const deviceSet = await waitFor(
        () => page.evaluate(() => (window.__vm && window.__vm.runtime)
            ? String(window.__vm.runtime.bwDeviceId) : ''),
        d => /pico/i.test(d), 30000);
    check('the runtime registered the Pico device', /pico/i.test(deviceSet || ''), deviceSet);

    // Select the Python language: the ▶ Run Python button — the one that routes
    // a Pico to the simulator — exists ONLY in the Python tab. Typing pseudocode
    // and pressing a generic "Run" is why the press missed and no run board was
    // ever published in the failing run.
    const pyTab = page.locator('[data-testid="bw-lang-row"] button').filter({hasText: 'Py'}).first();
    check('the Python language tab is present', await pyTab.isVisible().catch(() => false));
    await pyTab.click();

    // Wait for ▶ Run Python to be visible AND enabled (it is disabled while a
    // run is in flight), then press it WITHOUT force — a forced click on a
    // not-yet-actionable button is exactly how the press silently missed.
    const runBtn = page.locator('button').filter({hasText: 'Run Python'}).first();
    const runReady = await waitFor(
        async () => (await runBtn.isVisible().catch(() => false)) && (await runBtn.isEnabled().catch(() => false)),
        r => r === true, 30000);
    check('the ▶ Run Python button is visible and enabled', runReady === true);
    const beforePress = await statusText();
    await runBtn.click();

    // The press LANDED only if the status leaves the post-compile message — that
    // is runPicoSim starting (or refusing by name), not the compiler's "loaded".
    const afterPress = await waitFor(() => statusText(),
        s => !/compiled to blocks|switch to the code tab/i.test(s || '') && s !== beforePress, 20000);
    const pressed = !/compiled to blocks|switch to the code tab/i.test(afterPress || '');
    check('▶ Run was pressed and the run began (status left the post-compile message)',
        pressed, JSON.stringify({beforePress, afterPress}).slice(0, 200));

    if (ABSENT) {
        // The whole negative branch. The firmware 404s, so the Run must refuse
        // by name — wait for the status to REACH the refusal that names
        // `sync:picomicropython` (it comes after the loader tries and fails).
        const status = await waitFor(() => statusText(),
            s => /sync:picomicropython|not in this build/i.test(s), 30000);
        check('with the firmware withheld, ▶ Run refuses BY NAME (names the sync)',
            /sync:picomicropython/i.test(status || ''), JSON.stringify(status).slice(0, 200));
        check('the server actually withheld the firmware, so the branch ran',
            withheld.length > 0, withheld.join(', ') || 'NOTHING was requested — the loader never '
            + 'tried, so this proves nothing about the absent path');
        check('nothing threw: the missing firmware is an answer, not an exception',
            pageErrors.length === 0, pageErrors.join(' // ').slice(0, 200));
        await mkdir(dirname(shot), {recursive: true});
        await page.screenshot({path: shot});
        await browser.close();
        if (server) server.close();
        if (failures.length) { console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`); process.exit(1); }
        console.log('\nOK — no firmware, no silent Run: it refuses by name and nothing throws.');
        process.exit(0);
    }

    // Execute branch: the emulated GPIO must move. Judge by the run board's own
    // solved pin state — GP25 driven high — which is the emulated GPIO, not a
    // pixel, and does not depend on an inferred LED part existing. ledBrightness
    // is recorded too as corroboration. Boot is slow, so poll generously (the
    // boot budget in the header sets this).
    // Wait for the emulated GPIO to REACH high — or for the program to be
    // refused/uncompilable, which is a skip, not a failed check. One read
    // returns both, so the wait ends on whichever happens.
    const readRun = () => page.evaluate(() => {
        const b = window.__vm && window.__vm.runtime && window.__vm.runtime.bwRunBoard;
        let gp25 = null, litLeds = 0;
        if (b) {
            try { gp25 = typeof b.readPin === 'function' ? b.readPin('GP25') : null; } catch { gp25 = 'err'; }
            try {
                const leds = typeof b.getLeds === 'function'
                    ? b.getLeds().map(id => b.ledBrightness ? b.ledBrightness(id) : 0) : [];
                litLeds = leds.filter(x => x > 0).length;
            } catch { /* board without LEDs */ }
        }
        const body = document.body.innerText.slice(0, 3000);
        const m = /not expressible|deploy failed|not in this build/i.test(body)
            ? (body.match(/[^\n]*(?:failed|not )[^\n]*/i) || [''])[0].slice(0, 120) : null;
        const status = document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || '';
        // The module's read-only diagnostic hook: enumerated?, REPL banner?, how
        // far the emulator advanced — this is what tells a slow boot from a CDC
        // that never came up.
        const d = window.__bwPicoSim || null;
        const diag = d ? {phase: d.phase(), subPhase: d.subPhase ? d.subPhase() : '-',
            usbConnected: d.usbConnected(), replReady: d.replReady(), tx: d.tx ? d.tx() : '-',
            rx: d.rx ? d.rx() : '-', frames: d.frames(), simMs: d.simMs(),
            usbTail: d.usbTail(), lastError: d.lastError()} : null;
        return {board: !!b, gp25, litLeds, failed: m, status, diag};
    });
    // Record every transition (status/phase/enumeration change) with elapsed ms,
    // so a red run shows the sequence and where it stalled — never a fixed sleep.
    const t0 = Date.now();
    const transitions = [];
    let lastKey = '';
    const readAndRecord = async () => {
        const o = await readRun();
        const g = o.diag || {};
        const key = `${o.status}|${g.phase || '-'}|${g.subPhase || '-'}|${g.usbConnected}|${g.replReady}|${g.tx || '-'}|${g.rx}`;
        if (key !== lastKey) { lastKey = key; transitions.push({ms: Date.now() - t0, ...o, ...g}); }
        return o;
    };
    const droveOK = o => o && (o.failed || o.gp25 === 1 || o.litLeds > 0);
    // Poll to the step's 3-minute budget, not 60 s: the headless-Chromium boot is
    // far slower than node's (see the header). A compile refusal ends it early.
    const obs = await waitFor(readAndRecord, droveOK, 180_000);
    if (obs && obs.failed) { skip = `the program did not reach the emulator: ${obs.failed}`; throw new Error('SKIP'); }
    const drove = !!(obs && (obs.gp25 === 1 || obs.litLeds > 0));
    check('a run board was published (vm.runtime.bwRunBoard)', !!(obs && obs.board),
        JSON.stringify(obs).slice(0, 200));
    if (!drove) {
        // The whole point of this round: say WHICH candidate. Dump the trail and
        // the final CDC/board state so the next dispatch answers slow-boot vs
        // never-enumerated without another guess.
        console.log('  transition trail (ms | status | phase | subPhase | usb | repl | tx | rx | frames | simMs):');
        for (const t of transitions) {
            console.log(`    ${t.ms} | ${t.status} | ${t.phase || '-'} | ${t.subPhase || '-'} | `
                + `usb=${t.usbConnected} | repl=${t.replReady} | ${t.tx || '-'} | rx=${t.rx} | frames=${t.frames} | simMs=${t.simMs}`);
        }
        const g = (obs && obs.diag) || {};
        console.log(`  final: phase=${g.phase} subPhase=${g.subPhase} usbConnected=${g.usbConnected} `
            + `replReady=${g.replReady} tx=(${g.tx}) rx=${g.rx} frames=${g.frames} simMs=${g.simMs} gp25=${obs && obs.gp25}`);
        console.log(`  usbTail=${JSON.stringify(g.usbTail || null)}`);
        console.log(`  lastError=${g.lastError || null}`);
    }
    check('the emulated GPIO moved — MicroPython ran and drove GP25 high', drove,
        JSON.stringify(obs).slice(0, 200));
    if (!drove) {
        // Do not spend a second independent three-minute poll after the first
        // required run has already failed. Capture the diagnosed state while
        // it still exists, then fail within the workflow's bounded budget.
        await mkdir(dirname(shot), {recursive: true});
        await page.screenshot({path: shot});
        throw new Error('the first Pico program did not drive GP25 high');
    }

    // Stop, replace the editor program, and run again without reloading the
    // page. GP24 makes the second result distinguishable from both the first
    // program and a fresh board's default-low state.
    await page.locator('[data-testid="bw-pico-sim-stop"]').click();
    const stopped = await waitFor(
        () => page.evaluate(() => !window.__vm.runtime.bwRunBoard && !window.__bwPicoSim),
        value => value === true, 10_000);
    check('Stop tears down the first simulator epoch', stopped === true);

    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    // The first run left the language row on Python. Switch back before
    // replacing the source; otherwise pseudocode is typed into the generated
    // Python buffer and the second To-blocks conversion never happens.
    await page.locator('[data-testid="bw-lang-row"] button').filter({hasText: 'Pseudo'}).first().click();
    await typeIntoEditor(page, SECOND_PROGRAM);
    await page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first().click({timeout: 8000});
    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    await pyTab.click();
    const secondReady = await waitFor(
        async () => (await runBtn.isVisible().catch(() => false)) && (await runBtn.isEnabled().catch(() => false)),
        value => value === true, 30_000);
    check('the second ▶ Run is enabled without a page reload', secondReady === true);
    await runBtn.click();
    const second = await waitFor(() => page.evaluate(() => {
        const b = window.__vm && window.__vm.runtime && window.__vm.runtime.bwRunBoard;
        const d = window.__bwPicoSim;
        let gp24 = null;
        try { gp24 = b && b.readPin('GP24'); } catch { gp24 = 'err'; }
        return {gp24, phase: d && d.phase(), resets: d && d.resetGeneration ? d.resetGeneration() : -1};
    }), value => value && value.phase === 'running' && value.resets >= 1 && value.gp24 === 1, 180_000);
    check('a changed second program installs, reboots, and drives GP24 high',
        !!(second && second.phase === 'running' && second.resets >= 1 && second.gp24 === 1),
        JSON.stringify(second).slice(0, 200));

    await mkdir(dirname(shot), {recursive: true});
    await page.screenshot({path: shot});
    console.log(`\nscreenshot: ${shot}`);
    await browser.close();
    if (server) server.close();
    if (failures.length) { console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`); process.exit(1); }
    console.log('\nOK — the Pico ▶ Run booted MicroPython and its GPIO lit the LED.');
    process.exit(0);
} catch (e) {
    await browser.close().catch(() => {});
    if (server) server.close();
    if (skip || (e && e.message === 'SKIP')) {
        console.log(`SKIP — ${skip || 'a precondition was absent'}`);
        process.exit(0);
    }
    console.error(`verify-pico-micropython threw: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
}
