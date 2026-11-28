#!/usr/bin/env node
/** End-to-end proof for the HEAVY simulation tier.
 *
 *  Everything else about labwired is proven by unit tests against the adapter
 *  and by grepping the bundle. Neither answers the only question that matters:
 *  does picking it in a real browser actually run the project's firmware on it?
 *  This drives the GUI — write an STM32F030 program, open the debugger, choose
 *  the engine, run — and then insists the firmware MOVED, because "the panel
 *  said ready" is exactly the kind of plausible-and-wrong this tier has already
 *  produced once (a Map where an object was expected made a dead CPU look fine).
 *
 *  Skips rather than fails when a precondition is genuinely absent: the 20 MB
 *  engine is an optional deploy artifact, and the F030 build compiles against
 *  the remote stc-compiler. A missing engine or no network is not a regression
 *  in this code, and reporting it as one would train everyone to ignore the gate. */
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const port = 8121;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};

/** THE OTHER BRANCH OF THE HONESTY RULE.
 *
 *  "labwired appears only when the artifact is present" is two claims, and the
 *  interesting one is the negative: a deploy that never fetched the 20 MB engine
 *  must not offer it. That branch was covered only by a Node-side unit test
 *  proving the loader returns null OUTSIDE a browser — which is a different
 *  failure (no document base) from the one that happens in production (the
 *  module 404s). So this mode serves the SAME build with `static/labwired/`
 *  withheld, which is byte-for-byte what a deploy without the artifact looks
 *  like, and insists the picker stays quiet and nothing throws.
 *
 *  One build, both branches: running it against a second, artifact-less build
 *  would leave open whether the two builds differed in some other way. */
const ABSENT = process.argv.includes('--absent');
const shot = process.env.LW_SHOT
    || join(root, 'artifacts', ABSENT ? 'labwired-absent.png' : 'labwired-heavy-tier.png');

/** Drive an ALREADY-SERVED app instead of a local build — the same PROOF_URL
 *  every other gate here takes. It exists for the case a local production build
 *  cannot be made (this box has been OOM-killed mid-webpack more than once), and
 *  for proving the DEPLOY rather than a tree: the artifact is fetched by CI, so
 *  "is the heavy tier live on the site users get" is a different question from
 *  "does it work in my checkout", and only this answers it.
 *
 *  --absent is deliberately refused with it: that branch is proven by WITHHOLDING
 *  the artifact, which this gate can only do from its own server. Silently
 *  running the positive branch instead would report a pass for a claim nobody
 *  checked. */
const PROOF_URL = process.env.PROOF_URL || null;
if (PROOF_URL && ABSENT) {
    console.error('verify-labwired-engine: --absent cannot run against PROOF_URL. The branch is '
        + 'proven by withholding static/labwired/ from the response, which needs this gate\'s own '
        + 'server. Run it without PROOF_URL, against a local build.');
    process.exit(1);
}

if (!PROOF_URL) {
    if (!existsSync(join(build, 'index.html'))) throw new Error('Build first: packages/scratch-gui/build/index.html is missing');

    if (!ABSENT && !existsSync(join(build, 'static', 'labwired', 'labwired_wasm.js'))) {
        console.log('SKIP — verify-labwired-engine: build/static/labwired is absent; run '
            + '`node scripts/sync-labwired-wasm.mjs` and rebuild. (The --absent branch of this '
            + 'gate does not need the artifact and is the one to run in that situation.)');
        process.exit(0);
    }
    // The artifact-less branch is only meaningful against a build that HAS the
    // artifact — otherwise it proves the picker hides an engine that was never
    // there, which is not the claim. Withholding it from a build that has it is.
    if (ABSENT && !existsSync(join(build, 'static', 'labwired', 'labwired_wasm.js'))) {
        console.log('SKIP — verify-labwired-engine --absent: this build has no artifact to '
            + 'withhold, so hiding the picker entry would prove nothing. Fetch it and rebuild.');
        process.exit(0);
    }
}

/** Requests the artifact-less branch refused, so the run can say what it denied. */
const withheld = [];
const server = PROOF_URL ? null : createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        if (path.endsWith('/')) path += 'index.html';
        if (ABSENT && /^\/static\/labwired\//.test(path)) {
            withheld.push(path);
            res.writeHead(404);
            res.end('not found');
            return;
        }
        const file = join(build, normalize(path));
        if (!file.startsWith(build)) throw new Error('escape');
        // Read before the head goes out: writing 200 and then failing to read
        // leaves the catch unable to send a 404, and that throw kills the gate.
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
console.log(`driving ${APP}${PROOF_URL ? ' (PROOF_URL)' : ''}`);

const PROGRAM = `DEVICE STM32F030
PIN led1 = PA0 OUTPUT

WHEN flag clicked:
  forever:
    turn on led1
    wait 0.2 seconds
    turn off led1
    wait 0.2 seconds
`;

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1400, height: 900}});
page.on('console', m => { if (m.type() === 'error') console.log(`browser error ${m.text().slice(0, 160)}`); });
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(String(e).slice(0, 200)); console.log(`PAGEERR ${String(e).slice(0, 160)}`); });
const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};
/** The panel's phase word and its message, read as a pair. Scraping the whole
 *  document instead picks up <style> text, which is how an earlier version of
 *  this gate reported a CSS rule as the status. */
const statusText = () => page.evaluate(() => {
    const st = [...document.querySelectorAll('strong')]
        .find(n => /^(error|ready|running|paused|building|attaching|idle|stepping)$/i.test(n.textContent.trim()));
    return st ? st.parentElement.innerText.replace(/\n/g, ' | ') : '';
});

let skip = null;
try {
    await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-debug-dock', 'solo');
        localStorage.setItem('bw-stage-circuit', '1');
    });
    // domcontentloaded, not networkidle: a deployed page keeps chattering (service
    // worker, telemetry) and networkidle can simply never arrive.
    await page.goto(APP, {waitUntil: PROOF_URL ? 'domcontentloaded' : 'networkidle', timeout: 60000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    // The VM is not a global: it lives in the redux store, and the gates that
    // need it lift it onto window themselves. Same handle as the others use.
    await page.waitForFunction(() => {
        const st = window.__brickwrightStore;
        const vm = st && st.getState && st.getState().scratchGui && st.getState().scratchGui.vm;
        if (vm && vm.runtime) { window.__vm = vm; return true; }
        return false;
    }, {timeout: 60000});
    await page.waitForTimeout(2000);

    // Seed the program: typing alone declares nothing — "To blocks" is what
    // parses it onto the runtime and sets the device.
    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    // Wait for the CodeMirror editor, type, assert the text is in it (scripts/lib/type-into-editor.mjs).
    await typeIntoEditor(page, PROGRAM);
    await page.waitForTimeout(600);
    await page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first().click({timeout: 2500});
    await page.waitForTimeout(2500);
    // The DEVICE line parses the program; it does not pick the board. That is
    // the device dropdown, and until it is set the runtime has no bwDeviceId —
    // so the debugger would build for "no chips" and the engine choice below
    // would be meaningless.
    await page.evaluate(() => {
        for (const sel of document.querySelectorAll('select')) {
            const opt = [...sel.options].find(o => /STM32F030/i.test(o.textContent));
            if (!opt) continue;
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', {bubbles: true}));
            return;
        }
    });
    await page.waitForTimeout(2500);
    const device = await page.evaluate(() => {
        const rt = window.__vm && window.__vm.runtime;
        return rt ? String(rt.bwDeviceId) : '(no vm)';
    });
    check('the program registered an STM32F030 device', /stm32/i.test(device), device);

    await page.locator('[role="tab"]', {hasText: 'Blocks'}).first().click();
    await page.waitForTimeout(2500);

    // The dock ships collapsed, and a collapsed Run is in the DOM but not
    // visible — clicking it throws rather than doing nothing, which is how
    // this gate spent a run reporting "no status" instead of "never pressed".
    // It must happen BEFORE the picker is touched: selectOption requires a
    // VISIBLE element, and the engine picker lives inside this same dock.
    for (const t of ['\u2039', '\u2303']) {
        try { await page.locator(`button:text-is("${t}")`).first().click({timeout: 2500, force: true}); await page.waitForTimeout(1500); break; } catch {}
    }
    const run = page.locator('[data-debug-panel]:visible [data-debug-run]').first();
    if (!await run.isVisible()) await page.getByRole('button', {name: 'Open debugger', exact: true}).first().click();
    // gate-shapes-allow: this persistent Run control is a prerequisite; persisted engine identity, PA0 edge counts and the withheld-artifact branch establish the actual states.
    await run.waitFor();
    check('the Run control is reachable', await run.isEnabled());

    // The picker only lists the heavy tier once its engine has answered; the
    // probe is async, so this is a wait, not an assertion about first paint.
    const picker = page.locator('select').filter({has: page.locator('option')}).filter({hasText: /simulat|emulat|labwired/i}).first();
    let labels = [];
    for (let i = 0; i < 30; i++) {
        labels = await page.evaluate(() => [...document.querySelectorAll('select option')].map(o => o.textContent.trim()));
        if (labels.some(l => /labwired/i.test(l))) break;
        // In the artifact-less branch the entry never arrives, and waiting the
        // full 30 s for that is the point: an entry that appears late is still
        // an entry, so the negative claim needs the same window the positive
        // one gets. Nothing is short-circuited here.
        await page.waitForTimeout(1000);
    }
    const offered = labels.some(l => /labwired/i.test(l));

    if (ABSENT) {
        // The whole negative branch, and then out. Three things have to be true
        // together — an app that hid the entry by falling over would satisfy the
        // first alone.
        check('with the artifact withheld the picker does NOT offer labwired',
            !offered, labels.join(' | ').slice(0, 200));
        check('the server actually withheld it, so the branch was exercised',
            withheld.length > 0, withheld.join(', ') || 'NOTHING was requested — the probe '
            + 'never ran, so this proves nothing about hiding the entry');
        check('the other engines are still offered', labels.length > 1, String(labels.length));
        check('the light STM32 tier is still there to fall back to',
            labels.some(l => /STM32F030|ARM/i.test(l)) || labels.length > 1,
            labels.join(' | ').slice(0, 160));
        // A caught 404 is the DESIGNED path — lib/labwired-engine.js turns the
        // failed import into `null` and a reason. What must not happen is an
        // uncaught rejection reaching the page, which is what a missing catch or
        // a probe outside the try would produce.
        check('nothing threw: the missing engine is an answer, not an exception',
            pageErrors.length === 0, pageErrors.join(' // ').slice(0, 200));
        await mkdir(dirname(shot), {recursive: true});
        await page.screenshot({path: shot, fullPage: false});
        console.log(`\nscreenshot: ${shot}`);
        console.log(`withheld:   ${withheld.join(', ')}`);
        await browser.close();
        if (server) server.close();
        if (failures.length) {
            console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
            process.exit(1);
        }
        console.log('\nOK — no artifact, no entry, no error. The picker does not offer what it cannot load.');
        process.exit(0);
    }

    check('the picker offers the labwired tier', offered, labels.join(' | ').slice(0, 200));
    if (!offered) throw new Error('no labwired option — nothing further to verify');

    // Select it through Playwright, not by assigning .value: React tracks a
    // select's value internally and ignores a change event whose value it
    // believes it already has, so the hand-rolled version silently left the
    // kind on its default — and the run below quietly used the LIGHT tier while
    // this gate reported success.
    const engineSelect = page.locator('select')
        .filter({has: page.locator('option[value="labwired"]')}).first();
    await engineSelect.selectOption('labwired');
    await page.waitForTimeout(800);

    // Assert the APP's state, not a string this script just produced. The
    // picker's onChange persists the choice per device, so localStorage is
    // independent evidence that React actually took the change.
    const persisted = await page.evaluate(() => {
        const rt = window.__vm && window.__vm.runtime;
        const dev = rt && rt.bwDeviceId;
        return dev ? localStorage.getItem(`bw-emulator-pref:${dev}`) : null;
    });
    check('selecting it really sets the labwired kind', persisted === 'labwired', String(persisted));

    // Run. The F030 image is compiled remotely, so this is where "no network"
    // shows up — as a skip below, not as a failed check.
    await run.click();
    check('Run was actually pressed', true);

    // The attach message is TRANSIENT: setStatus('ready', '… on labwired …')
    // is replaced by setStatus('running') within a frame or two. Polling for it
    // every 1.5s caught it only sometimes, which made this gate flaky by
    // construction — the engine was fine and the check was wrong. So sample
    // fast and remember everything seen, rather than asking "what does it say
    // NOW" and hoping the timing lands.
    const seen = [];
    let status = '';
    for (let i = 0; i < 300; i++) {
        await page.waitForTimeout(200);
        status = await statusText();
        if (status && seen[seen.length - 1] !== status) seen.push(status);
        if (seen.some(t => /bytes on labwired/i.test(t))) break;
        if (/^error/i.test(status)) break;
        if (i % 10 === 9) {
            const whole = await page.evaluate(() => document.body.innerText.slice(0, 4000));
            if (/compil\w+ failed|network|fetch failed|could not reach/i.test(whole)) {
                skip = `the F030 build did not complete (likely no route to the compiler): ${whole.match(/[^\n]*(?:failed|network)[^\n]*/i)?.[0]?.slice(0, 120)}`;
                break;
            }
        }
    }
    if (skip) throw new Error('SKIP');
    const everSaid = re => seen.some(t => re.test(t));
    const trail = seen.join('  ·  ').slice(0, 220);

    if (process.env.LW_DEBUG) {
        console.log('--- phase strongs ---', await page.evaluate(() =>
            [...document.querySelectorAll('strong')].map(n => n.textContent.trim()).join(' | ')));
        console.log('--- trail ---', JSON.stringify(seen));
    }

    // What is NOT asserted here, and why, so nobody re-adds it and wonders:
    //
    //   * the "N bytes on labwired" message. attach() sets it and start() calls
    //     setStatus('running') in the same tick, so React never paints it. No
    //     polling rate can catch a frame that does not exist. It cost a while to
    //     work that out from an assertion that "sometimes passed".
    //   * the program counter. Registers are rendered by the debug DRAWER, not
    //     this panel, so scraping the panel for a PC finds nothing whether the
    //     CPU moved or not — an assertion that fails for the wrong reason is
    //     worse than one that is absent.
    //
    // What is left is what actually discriminates. BOTH bugs this gate was
    // written for ended here: the shadowed `session` binding threw "Cannot read
    // properties of null (reading 'start')" and left the phase on error, and the
    // missing timeNs delegation threw "w.timeNs is not a function" as an uncaught
    // page error. Reaching a clean `running` on a verified labwired kind is
    // precisely the state neither could produce.
    check('the labwired attach reaches a running session', everSaid(/^running/i), trail);
    check('it never lands in the error phase', !everSaid(/^error/i), trail);
    check('nothing threw while attaching the engine',
        pageErrors.length === 0, pageErrors.join(' // ').slice(0, 200));

    // ─── the part that makes this a proof rather than a status reading ───
    //
    // "running" is the panel's word for its own intent. The firmware moving is
    // a different claim, and it is the one the Map-instead-of-object trap
    // falsified last time: every register read came back undefined, the CPU
    // looked fine, and the pads sat at zero forever while the panel said
    // running. So sample the BOARD — the same object `runner.pins()` renders
    // the pin table from — and require PA0 to change. That level is only there
    // if the firmware executed, the adapter read the pad through the correct
    // register map, and boundary A published it to our circuit. Nothing else
    // produces it.
    const observed = await page.evaluate(async () => {
        const rt = window.__vm && window.__vm.runtime;
        const board = rt && rt.bwRunBoard;
        if (!board) return {error: 'runtime.bwRunBoard is not set — the attach never built a board'};
        const leds = typeof board.getLeds === 'function' ? board.getLeds() : [];
        const levels = [];
        const brights = [];
        for (let i = 0; i < 70; i++) {
            try { levels.push(board.readPin('pa0')); } catch { levels.push(null); }
            try { if (leds.length) brights.push(Number(board.ledBrightness(leds[0]).toFixed(2))); } catch { brights.push(null); }
            await new Promise(r => setTimeout(r, 100));
        }
        return {leds, levels, brights};
    });
    if (observed.error) {
        check('the board the heavy tier drives is reachable', false, observed.error);
    } else {
        const distinct = [...new Set(observed.levels.filter(v => v !== null))];
        const edges = observed.levels.reduce((n, v, i) =>
            n + (i > 0 && v !== observed.levels[i - 1] ? 1 : 0), 0);
        check('PA0 actually moves on the board while the heavy tier runs',
            distinct.length > 1 && edges >= 2,
            `${edges} level changes over 7 s, levels seen {${distinct.join(',')}}, `
            + `led brightness {${[...new Set(observed.brights.filter(v => v !== null))].join(',')}}`);
        console.log(`note  PA0 trace (100 ms/sample): ${observed.levels.join('')}`);
        console.log(`note  LED parts on the inferred bench: ${observed.leds.join(', ') || '(none)'}`);
    }

    // The caveats have to be READABLE, not merely present in a source file.
    // Both are properties of the engine and both are wrong-answer generators —
    // a 20 ms wait that elapses in 10 ms is the kind of thing a learner blames
    // on their own program.
    const caveatText = await page.evaluate(() => document.body.innerText);
    // The 2x-clock caveat RETIRED 2026-08-31 with the level-pend repair
    // (labwired-core 0c0cd0ec): this very gate's PA0 edge count halved from
    // 23 to 11 per 7 s window the first time it ran the repaired engine —
    // the formerly double-speed ms clock, now exact. So the timing sentence
    // must be ABSENT: its return means either a stale vendored engine or
    // restored stale text.
    check('the analog caveat is stated, and the retired timing caveat stays retired',
        /analog inputs are not injected/i.test(caveatText)
        && !/double speed/i.test(caveatText),
        [/analog inputs are not injected/i.test(caveatText) ? 'analog: yes' : 'analog: MISSING',
            /double speed/i.test(caveatText) ? 'timing: PRESENT (should be retired)' : 'timing: retired'].join(', '));

    await mkdir(dirname(shot), {recursive: true});
    await page.screenshot({path: shot, fullPage: false});
    console.log(`\nscreenshot: ${shot}`);
} catch (e) {
    if (String(e.message) !== 'SKIP') {
        if (!failures.length) failures.push(String(e.message).slice(0, 160));
        else console.log(`(aborted: ${String(e.message).slice(0, 160)})`);
    }
} finally {
    await browser.close();
    if (server) server.close();
}

if (skip) {
    console.log(`\nSKIP — ${skip}`);
    process.exit(0);
}
if (failures.length) {
    console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
    process.exit(1);
}
console.log('\nOK — the heavy tier runs the project it was handed.');
