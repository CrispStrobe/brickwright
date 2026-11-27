#!/usr/bin/env node
/**
 * Offline browser proof for D2, D29, D28 and D25.
 *
 * Three claims, each measured in a real Chromium against a real build, each
 * leaving a screenshot the coordinator can look at:
 *
 *   1. D29 — a write watchpoint set in the UI halts the program at the write,
 *      and the panel says WHICH address and WHAT value.
 *   2. D28 — the Position pane is on screen while stepping, and on the C
 *      target it says in words that there is no call stack to list.
 *   3. D25 — the cycle step advances the cycle counter by EXACTLY one, and
 *      the button is absent on engines that cannot take one.
 *
 * The traps this file already knows about (bw-setup.md, and the existing
 * verify-* scripts here):
 *   - `confirm()` auto-dismisses, so dialogs are accepted explicitly.
 *   - `load` can hang; `domcontentloaded` plus a polled selector is used.
 *   - a stage portal renders a SECOND copy of the circuit UI, so every query
 *     is scoped to the panel under test.
 *   - the starter overlay eats clicks unless its localStorage flag is set.
 *   - never sleep for a state change; poll and report the last value seen.
 *   - THE SCREENSHOTS ARE THE DELIVERABLE, AND A GREEN RUN DOES NOT PROVE
 *     THEY SHOW ANYTHING. Attempt four got all 25 checks to PASS in CI
 *     (run 33364321419) and uploaded three screenshots of which only ONE —
 *     01-frames-locals — actually contained its claim. The debug panel
 *     scrolls inside itself, the document is one screen tall, so `fullPage`
 *     framed the panel's top band; the watchpoint halt line and the derived
 *     cycle readout were both below that panel's own fold. Every check still
 *     passed because they read `innerText`, which returns text the viewport
 *     is not showing. Framing is therefore asserted now (see `frame()`), and
 *     the "+1" claim is photographed on BOTH sides of the click, because one
 *     number in one frame cannot show a delta.
 *
 * Usage:
 *   PROOF_URL=http://localhost:8617/ node scripts/verify-debug-frames-watch.mjs
 *   node scripts/verify-debug-frames-watch.mjs        (serves the build itself)
 *
 * REPRODUCING IT LOCALLY: build the way build.yml builds, all four steps.
 *   node scripts/integrate.mjs
 *   node scripts/apply-vm-overlay.mjs      <- NOT OPTIONAL
 *   node scripts/apply-paint-overlay.mjs
 *   cd packages/scratch-gui && NODE_ENV=production npm run build
 * Skipping apply-vm-overlay costs an hour and looks like a broken feature, not
 * a broken build: its `pre-load declared extensions + URL strip` patch is what
 * stops scratch-vm resolving the declared extension id `stc12` as a RELATIVE
 * URL. Without it the example's load fetches `/stc12`, takes a 404, and leaves
 * the VM with ZERO targets and no thrown error — so the title updates, the
 * circuit solves with all 8 parts, and only `targetCount: 0` (for the full 60 s
 * poll) says anything is wrong. The visible symptom is three checks failing in
 * a row down at `[data-debug-panel]` never appearing, which reads as "the
 * debugger is gone".
 *
 * Screenshots land in artifacts/debug-proof/.
 */
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {isHostedCompilerRequest} from './lib/offline-compiler-policy.mjs';
import {GPL_TOOLCHAIN_ORIGIN as GPL_ORIGIN}
    from '../overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-source.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const BUILD = path.join(repo, 'packages/scratch-gui/build');
const SHOTS = path.join(repo, 'artifacts/debug-proof');

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.hex': 'text/plain', '.bin': 'application/octet-stream', '.map': 'application/json'
};

const results = [];
const record = (name, ok, detail) => {
    results.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Poll until `ok(v)`; return the last value either way, never throw on timeout. */
async function waitFor(read, ok, timeoutMs = 30000, stepMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let last;
    for (;;) {
        try { last = await read(); } catch (e) { last = {error: String(e && e.message)}; }
        if (ok(last)) return last;
        if (Date.now() > deadline) return last;
        await new Promise(r => setTimeout(r, stepMs));
    }
}

async function serve() {
    if (!existsSync(path.join(BUILD, 'index.html'))) {
        console.error(`Build first: ${path.join(BUILD, 'index.html')} is missing`);
        process.exit(2);
    }
    const server = createServer(async (req, res) => {
        try {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
            const file = path.join(BUILD, rel);
            // Read BEFORE writeHead so a missing asset is one 404 line, not a crash.
            if (!file.startsWith(BUILD)) { res.writeHead(403).end(); return; }
            const body = await readFile(file);
            res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    // Concurrent agent sessions run these side by side; scan past a busy port.
    const base = Number(process.env.BW_PORT || 8141);
    for (let p = base; p < base + 20; p++) {
        const got = await new Promise(resolve => {
            server.once('error', () => resolve(null));
            server.listen(p, () => resolve(p));
        });
        if (got) return {server, url: `http://localhost:${got}/`};
    }
    console.error('no free port'); process.exit(2);
}

const main = async () => {
    await mkdir(SHOTS, {recursive: true});
    const {chromium} = await import('playwright');

    let server = null;
    let url = process.env.PROOF_URL || process.env.BW_URL;
    if (!url) ({server, url} = await serve());
    console.log(`driving ${url}`);

    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: 1600, height: 1100}});
    const hostedCompilerRequests = [];
    // WHERE THE TOOLCHAIN CAME FROM, recorded so the opt-in run can assert it
    // rather than leave it inferred. Since 2026-09-07 no SDCC byte is in this
    // build, so a successful local compile can only mean the GPL origin served
    // it — but "can only mean" is reasoning, and this gate should measure.
    const gplToolchainRequests = [];
    // Keep localhost available for the production bundle and its WASM assets,
    // but make the hosted compiler physically unreachable. Abort before the
    // request leaves Chromium and retain its URL as failure evidence.
    //
    // Matched by ORIGIN rather than `**/*`, and this NARROWING CANNOT WEAKEN D2.
    // isHostedCompilerRequest already requires a foreign origin itself (POST +
    // origin !== app origin + path /compile), so every request this filter now
    // skips is one the predicate would have answered false for anyway. The set
    // of URLs that can reach `hostedCompilerRequests` is identical either way;
    // only the ones that could never have been recorded stop being routed.
    //
    // Why it matters: this build pulls tens of MB — a 14.7 MB vendor chunk over
    // localhost, and (since the toolchain stopped shipping in this BSD-3 app)
    // four SDCC wasm stages plus a 3.3 MB runtime pack from the GPL origin —
    // and handing every one of those responses back through the driver is what
    // took the renderer down. NOTE the change: those SDCC assets used to be
    // local, and this comment said so until 2026-09-08. A dead renderer then loses the run's whole report,
    // which is the failure the crash handler below exists to name.
    const appOrigin = new URL(url).origin;
    await page.route(u => {
        // Unparseable means not foreign-by-evidence: leave it alone, exactly as
        // isHostedCompilerRequest's own catch does.
        try { return new URL(u).origin !== appOrigin; } catch { return false; }
    }, route => {
        if (isHostedCompilerRequest(route.request(), url)) {
            hostedCompilerRequests.push(route.request().url());
            return route.abort('blockedbyclient');
        }
        // Not blocked — the GPL toolchain must be reachable for the opt-in run
        // to compile at all. Only recorded.
        if (/\/static\/sdcc-wasm\//.test(route.request().url())) {
            gplToolchainRequests.push(route.request().url());
        }
        return route.continue();
    });
    page.on('dialog', d => d.accept());          // confirm() would auto-DISMISS
    await page.addInitScript(() => {
        try {
            localStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');  // else it eats clicks
            localStorage.setItem('bw-right-pane-hidden', '0');
        } catch { /* private mode */ }
    });

    /** Put the element that CARRIES a claim inside the shutter's rectangle,
     *  and measure whether it landed there.
     *
     *  THE FIRST CI-GREEN RUN OF THIS GATE WROTE THREE SCREENSHOTS OF WHICH
     *  ONLY ONE SHOWED ITS CLAIM (run 33364321419, all 25 checks PASS). The
     *  debug panel scrolls INSIDE itself and the document is exactly one
     *  screen tall, so `fullPage` — which only grows the DOCUMENT — captured
     *  the panel's top band while the watchpoint-halt line and the derived
     *  cycle readout sat below that panel's own fold. Nothing caught it,
     *  because every check reads `innerText`, and innerText does not care
     *  what is on screen: the text is in the DOM whether or not a human could
     *  ever have seen it. That is the exact failure mode two earlier lanes
     *  refused to land — evidence that is asserted rather than shown.
     *
     *  So framing is now a CHECK, not an assumption. `scrollIntoView` reaches
     *  an overflow:hidden container too, which `scrollIntoViewIfNeeded` will
     *  not; the rect is then compared against the viewport, and the result is
     *  reported in the ok-list beside the claim it frames. A future layout
     *  change that pushes the evidence off-frame turns this gate RED instead
     *  of quietly shipping a screenshot of the wrong part of the panel. */
    const frame = async locator => {
        if (!(await locator.count())) return {ok: false, detail: 'the element is not rendered'};
        await locator.evaluate(node => node.scrollIntoView({block: 'center', inline: 'nearest'}))
            .catch(() => {});
        const measure = () => locator.evaluate(node => {
            const r = node.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            return {
                ok: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= vh &&
                    r.left >= 0 && r.right <= vw,
                detail: `${Math.round(r.width)}x${Math.round(r.height)} at `
                    + `${Math.round(r.left)},${Math.round(r.top)} of ${vw}x${vh}`,
                text: (node.innerText || '').replace(/\s+/g, ' ').slice(0, 110)
            };
        }).catch(e => ({ok: false, detail: `unreadable: ${e && e.message}`, text: ''}));
        // Condition-wait, not a sleep: a smooth scroll needs frames, and this
        // asks for the state those frames produce. NOT ONE waitForTimeout IN
        // THIS FILE — see the note further down.
        const seen = await waitFor(measure, v => v && v.ok, 5000, 100);
        return {...seen, detail: `${seen.detail}${seen.ok ? '' : ' — OFF FRAME'} · "${seen.text}"`};
    };

    /** Screenshot, saying so if it cannot. A crashed page throws here, and a
     *  throw on the last line of a check loses the whole run's report.
     *  `reveal`, when given, is the claim-bearing locator to frame first. */
    const shoot = async (name, reveal) => {
        const framed = reveal ? await frame(reveal) : null;
        try {
            await page.screenshot({path: path.join(SHOTS, name), fullPage: true});
        } catch (e) {
            console.log(`could not write ${name}: ${e && e.message}`);
        }
        return framed;
    };

    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message)));
    // A renderer that dies takes every later read with it, and Playwright then
    // reports whatever ran NEXT ("Target crashed" from a screenshot 120 s
    // later) rather than the event itself. Name it where it happens.
    let crashed = false;
    page.on('crash', () => { crashed = true; errors.push('THE RENDERER CRASHED'); });
    // The local-compiler failure path console.warn()s its reason while the
    // panel shows only a generic line. Keep the last of them.
    const console_ = [];
    page.on('console', m => {
        if (m.type() !== 'warning' && m.type() !== 'error') return;
        console_.push(`${m.type()}: ${m.text()}`.slice(0, 300));
        if (console_.length > 40) console_.shift();
    });

    // OPT IN TO THE IN-PAGE COMPILER, EXPLICITLY, because as of 2026-09-07 it is
    // no longer installed by default: SDCC is GPL-2.0-or-later and stopped
    // shipping inside this BSD-3 app, so it is fetched only when a user asks.
    //
    // This is NOT the gate being relaxed to accommodate the change it was built
    // to catch — that would be the worst thing to do here, and D2 below is
    // unchanged, word for word. What changed is the world the assertion is made
    // about: "the 8051 build made exactly zero hosted compiler requests" was a
    // statement about the default and is now a statement about a user who opted
    // in. The capability is identical; reaching it takes one parameter.
    //
    // `?localCompiler=on` is the URL half of localToolchainEnabled, and it is
    // load-bearing rather than a convenience: it is how this gate reaches the
    // same toolchain mode without driving the persistent Settings control.
    //
    // BW_DEFAULT_ROUTE=1 runs this SAME drive without the opt-in, to prove the
    // other half of the contract: that a learner who has not asked for the
    // toolchain reaches the hosted compiler AND IS TOLD SO. Two contracts, one
    // drive — duplicating five hundred lines of project-load-and-Run to assert
    // the opposite outcome would be two gates that drift apart, and the drive is
    // not the thing that differs between them.
    const defaultRoute = process.env.BW_DEFAULT_ROUTE === '1';
    const optedInUrl = defaultRoute
        ? url
        : `${url}${url.includes('?') ? '&' : '?'}localCompiler=on`;
    await page.goto(optedInUrl, {waitUntil: 'domcontentloaded', timeout: 90000});

    // SELF-PROOF, before anything is claimed from a zero.
    //
    // D2 asserts that `hostedCompilerRequests` is EMPTY. An empty list has two
    // causes that look identical from outside: the app made no hosted request
    // (the claim), or the interception never fired (a vacuous pass). A route
    // matched on a predicate is especially exposed — a filter that matches
    // nothing is silent, and silence is what both look like. So drive one
    // request that MUST be caught, and fail loudly here if it is not.
    //
    // `.invalid` is reserved by RFC 2606 and resolves nowhere, so if the
    // interception is broken this leaks no traffic; it just fails to be seen.
    const SELF_PROOF = 'https://bw-route-selfproof.invalid/compile';
    await page.evaluate(u => fetch(u, {method: 'POST', body: '{}'}).catch(() => {}), SELF_PROOF);
    const interceptionLive = hostedCompilerRequests.includes(SELF_PROOF);
    record('D2 precondition: the hosted-compiler interception is live',
        interceptionLive,
        interceptionLive ? 'a synthetic foreign POST /compile was caught and aborted'
            : 'THE ROUTE SAW NOTHING — D2\'s zero below would mean nothing');
    // The real claim starts from zero; the proof request is not part of it.
    hostedCompilerRequests.length = 0;

    await page.waitForSelector('[role="tab"]', {timeout: 60000});

    // ── get a C-target debug session running ────────────────────────────
    //
    // Load the EXAMPLE rather than typing a program. The first version of this
    // script typed pseudocode into CodeMirror and it half-converted:
    // CodeMirror auto-indents, so the leading spaces compounded, the FOREVER
    // body was lost, and the project that reached the compiler was `set
    // counter to 0` and nothing else. The image then built with no yield
    // states, symbol extraction failed ("bw_task0: no code address for the
    // case labels of states [0]"), and the runner attached WITHOUT the 8051
    // debug target — which reported no watchpoints and no cycle step, and the
    // proof duly "failed" for a reason that had nothing to do with either
    // feature. A known-good bench removes the whole class of that mistake.
    //
    // `05-counter` is `debug-watches`'s own bench: DEVICE STC12C5A60S2, a
    // counter variable, and a button. Exactly the target D29's row was about.
    // NOT ONE waitForTimeout IN THIS FILE, deliberately. test/wait-census.test.mjs
    // ratchets the fixed sleeping CI does, and the first version of this script
    // added seven sleeps totalling 9.1 s — which the ratchet caught to the
    // millisecond (116.9 s -> 126.0 s, 261 -> 268). Every one of them was
    // standing in for a condition that can be waited on directly.
    //
    // GETTING A SESSION TOOK THREE ATTEMPTS AND EACH FAILED DIFFERENTLY. Worth
    // recording, because each failure looked like a broken feature:
    //
    //  1. Typing the program with leading indentation. CodeMirror auto-indents,
    //     so the spaces COMPOUNDED and the FOREVER body nested wrong; what
    //     reached the compiler was `set counter to 0` and nothing else, the
    //     image built with no yield states, symbol extraction failed, and the
    //     runner attached WITHOUT the 8051 target — reporting no watchpoints
    //     and no cycle step, i.e. exactly the two defects under test.
    //  2. Loading the 05-counter example and reading the Blocks tab. The blocks
    //     canvas was empty and the tab said "Costumes" — a SPRITE was selected.
    //     BrickWright programs live on the STAGE; the program was there all
    //     along, in a workspace nobody was looking at.
    //  3. Typing an unindented program with no circuit. The debugger refuses:
    //     "needs a program and a chip to drive". A program alone is not a
    //     session — the chip comes from the circuit.
    //
    // So: load the example, which carries BOTH halves, and select the stage.
    // `05-counter` is `debug-watches`'s own bench — DEVICE STC12C5A60S2 with a
    // counter variable and a button, the exact target D29's row was about.
    await page.locator('[role="tab"]', {hasText: /Circuit/i}).first().click();
    const search = page.locator('input[placeholder*="earch"], input[type="search"]').first();
    // SWALLOWED-PRECONDITION, triaged 2026-09-02: filtering is a convenience. If the search box
    // never appears the example row below is still located, with its own 30s visible wait, so a
    // real failure is caught there rather than passing silently.
    // gate-shapes-allow
    try {
        await search.waitFor({state: 'visible', timeout: 30000});
        await search.fill('counter');
    } catch { /* the example list may not be searchable in this build */ }

    const row = page.locator('text=/counter/i').first();
    await row.waitFor({state: 'visible', timeout: 30000});
    await row.click();

    // The example row opens cui's own confirm dialog (device chooser), not a
    // native confirm — accept it explicitly when it appears.
    // SWALLOWED-PRECONDITION, triaged 2026-09-02: the chooser is genuinely optional, and the
    // title wait below is the hard assertion — an unaccepted chooser blocks the load and fails
    // there. The swallow is bounded by a downstream check, which is what makes it legitimate.
    // gate-shapes-allow
    try {
        const okBtn = page.locator('button:visible', {hasText: /^OK$/}).first();
        await okBtn.waitFor({timeout: 8000});
        await okBtn.click();
    } catch { /* some examples load without the chooser */ }

    // The load is done when the project is named after the example.
    const title = await waitFor(
        () => page.evaluate(() => {
            const el = document.querySelector('input[class*="title-field"], [class*="project-title"] input');
            return el ? el.value : '';
        }),
        t => /counter/i.test(t || ''), 60000, 500);
    record('the example bench loaded', /counter/i.test(title || ''), `project title: "${title}"`);

    // Keep the example's real solved circuit, but author the canonical program
    // through the public Code surface. The gallery currently selects a sprite
    // whose editor is empty; trusting that selection made this gate test zero
    // blocks. `insertText` sends the whole string without CodeMirror adding
    // indentation to an already-indented multiline paste.
    //
    // WAIT for the Stage to EXIST before selecting it. The project title lands
    // before its targets do: measured `{"hasVm":true,"targetCount":0}` at this
    // point, so `targets.find(isStage)` found nothing, the sprite stayed
    // selected, the typed program went into a sprite's workspace (0 blocks on
    // the stage), and `[data-debug-panel]` — which only the Stage renders —
    // never appeared at all. One asked-for condition instead of one assumed
    // one; a store that never populates still fails, and says which half.
    const selectedStage = await waitFor(
        () => page.evaluate(() => {
            const state = window.__brickwrightStore?.getState();
            const vm = state?.scratchGui?.vm;
            const targets = vm?.runtime?.targets || [];
            const stage = targets.find(target => target && target.isStage);
            if (!vm || !stage) return {id: null, stateKeys: Object.keys(state || {}),
                guiKeys: Object.keys(state?.scratchGui || {}), hasVm: !!vm,
                targetCount: targets.length};
            vm.setEditingTarget(stage.id);
            return {id: stage.id, targetCount: targets.length};
        }),
        v => !!(v && v.id), 60000, 250);
    record('the Stage target is selected for the hardware program', !!selectedStage.id,
        selectedStage.id ? `${selectedStage.id} of ${selectedStage.targetCount} targets`
            : JSON.stringify(selectedStage));
    await page.locator('[role="tab"]', {hasText: /^Code$/i}).first().click();
    const cm = page.locator('.cm-content').first();
    await cm.waitFor({state: 'visible', timeout: 30000});
    await cm.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(`DEVICE STC12C5A60S2
CLOCK 11059200

PIN led = P1.0 OUTPUT ACTIVE LOW
PIN button = P3.2 INPUT ACTIVE LOW

WHEN flag clicked:
  set count to 0
  FOREVER:
    wait until read button
    change count by 1
    turn on led
    wait 0.25 seconds
    turn off led
    wait 0.25 seconds`);
    const authored = await page.evaluate(() => {
        const el = document.querySelector('.cm-content');
        return el ? el.innerText : '';
    });
    record('the counter program is in the editor',
        /DEVICE\s+STC12/i.test(authored) && /FOREVER/i.test(authored) && /change\s+count\s+by\s+1/i.test(authored),
        `${authored.length} chars`);

    await page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first().click({force: true});
    await page.locator('[role="tab"]', {hasText: /^Blocks$/i}).first().click();

    // Count blocks in the MAIN workspace, which means excluding the palette.
    // `document.querySelector('.blocklyBlockCanvas')` returns the FLYOUT's
    // canvas first, so the scoped count read 0 while the unscoped one read 107
    // — the palette. Measured both ways in the same run before believing
    // either: the earlier unscoped version reported 107 blocks on a project
    // whose workspace held two.
    const blocks = await waitFor(
        () => page.evaluate(() => {
            const all = [...document.querySelectorAll('.blocklyDraggable')];
            return all.filter(b => !b.closest('.blocklyFlyout')).length;
        }),
        n => n > 3, 60000, 500);
    record('the program is on the stage workspace', blocks > 3,
        `${blocks} blocks in the workspace canvas`);

    // Does a CHIP exist? The debugger refuses without one, and its refusal
    // ("needs a program and a chip to drive") reads the same whether the
    // circuit failed to load or the program did — so ask the documented
    // diagnosis hooks directly rather than inferring from the refusal.
    const boardInfo = await page.evaluate(() => {
        const b = window.__activeBoard || window.__board;
        const c = window.__circuit;
        const parts = c && c.parts ? c.parts : (b && b.parts) || null;
        return {
            hasBoard: !!b,
            hasCircuit: !!c,
            partCount: Array.isArray(parts) ? parts.length : null,
            kinds: Array.isArray(parts) ? [...new Set(parts.map(p => p && p.kind))].slice(0, 12) : null
        };
    });
    record('a chip is on the board for the debugger to drive',
        !!(boardInfo.hasBoard && boardInfo.hasCircuit && boardInfo.kinds && boardInfo.kinds.includes('mcu')),
        JSON.stringify(boardInfo));

    // The dock is driven by the real settings event, not by clicking Settings.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-settings-change',
        {detail: {key: 'bw-debug-dock', value: 'right'}})));

    const debugPanel = page.locator('[data-debug-panel]:visible').first();
    // gate-shapes-allow: precondition for the innerText reads below; an absent panel throws here.
    await debugPanel.waitFor({state: 'visible', timeout: 30000});
    // Both readers return a STRING on every path. waitFor() hands back its last
    // value on timeout, and when that value was an exception object the report
    // read `last phase=[object Object]` — a line that says nothing about either
    // the phase or the throw. A failing read now says so in words.
    const panelText = () => debugPanel.innerText().catch(e => `«unreadable: ${e && e.message}»`);
    const phase = () => debugPanel.getAttribute('data-debug-phase')
        .catch(e => `«unreadable: ${e && e.message}»`);

    const ready = await waitFor(panelText, t => /Speed|Tempo/.test(t) && /Run|Start/.test(t), 60000);
    record('the debug panel is on screen', /Speed|Tempo/.test(ready), `${ready.length} chars`);

    // Start the session so a target exists. The route above makes a hosted
    // compile impossible; success therefore proves the shipped local pipeline.
    const clickByText = async re => {
        const button = debugPanel.locator('button', {hasText: re}).first();
        await button.waitFor({state: 'visible', timeout: 15000});
        await button.click();
    };

    // Keep every distinct (phase, status line) the panel passes through, not
    // only the value at the deadline. setStatus() narrates the whole build —
    // 'reading the project…', 'compiling…', 'local 8051 compiler unavailable'
    // (those words live in lib/bw-debug/runner-status-l10n.js now and follow
    // the reader's language; nothing here MATCHES on them — the trace is read
    // by a person when a run goes red)
    // — and five red CI runs reported none of it, because a poll that keeps
    // only its last read throws the narration away. The trace is the answer to
    // "where did this stop?", and it is free: the poll was happening anyway.
    const trace = [];
    const phaseAndMessage = async () => {
        const p = await phase();
        const line = `${p} — ${(await panelText()).replace(/\s+/g, ' ').slice(0, 110)}`;
        if (trace[trace.length - 1] !== line) trace.push(line);
        return p;
    };
    await clickByText(/^\s*▶?\s*(Run|Start)\s*$/i);
    // 'error' ends the wait too: polling only for success turns a build that
    // failed in two seconds into a two-minute timeout.
    const running = await waitFor(phaseAndMessage, p => p === 'running' || p === 'error', 120000);
    const attached = running === 'running';
    if (!defaultRoute) {
        record('a debug session attached', attached,
            attached ? 'phase=running'
                : `last phase=${running}${crashed ? ' — THE RENDERER CRASHED' : ''}`);
    } else {
        // NOT attaching is the CORRECT outcome here, and asserting the opposite
        // was my first mistake in this mode: the run below blocks every hosted
        // /compile so the offline claim cannot be faked, and with no opt-in the
        // build needs exactly that request. So it must fail, and it must fail
        // for a reason the app names. A session that DID attach would mean the
        // toolchain ran without being asked for — the compliance defect itself.
        record('default: no session attached, because the build needed a network this gate blocks',
            !attached, `phase=${running}`);
    }
    if (defaultRoute) {
        // THE DEFAULT DIRECTION, which until now was asserted only in unit tests.
        // SDCC is GPL-2+ and no longer ships in this app, so with no opt-in the
        // build MUST reach the service — and the app must say so. A silent
        // hosted round trip is the thing intercept.js's header forbids, and it
        // is what I reintroduced through a second setting before the
        // unification; this is the check that would have caught it.
        record('default: the 8051 build DID reach the hosted compiler',
            hostedCompilerRequests.length > 0,
            hostedCompilerRequests.length ? hostedCompilerRequests.join(' | ') : 'no POST /compile');
        // READ THE PANEL, NOT THE TRACE. `trace` stores each line as
        // `phase — panelText().slice(0, 110)`, and 110 characters of this panel
        // is the button bar: "▶ Run ⏸ Pause ⏭ Step …". The status sits past it,
        // so asserting against the trace tested the truncation, not the message
        // — the third time tonight a window measured in CHARACTERS has decided
        // a result (see shipped-lesson-images' 2200-char slice, and species 32's
        // note on stand-ins). The trace is for humans reading a failure; the
        // assertion reads the panel itself.
        // TWO MESSAGES CAN BE SHOWING, and which one depends on how far the
        // build got. The status line during the attempt reads "in-page 8051
        // compiler not installed — using the compiler service"; the refusal
        // after the blocked request reads "the in-page compiler is not
        // installed, so this build needed the service at …". Requiring a phrase
        // only one of them uses would fail on WORDING rather than on behaviour,
        // so assert what both must carry: that it is not installed, and which
        // service the build therefore needed.
        const said = `${trace.join(' | ')} | ${await panelText()}`.replace(/\s+/g, ' ');
        // PRINT THE MATCH, NOT A SLICE OF THE HAYSTACK. The first green run
        // reported this check as PASS with a detail showing the tail of the
        // panel — "POSITION … Nothing to show yet" — which does not contain the
        // phrase the check is about. The assertion was right and its evidence
        // was unreadable, which is how a reader ends up trusting a check they
        // cannot verify. Quote the sentence that matched.
        const quote = (re, fallback) => {
            const at = said.search(re);
            return at === -1 ? fallback : said.slice(Math.max(0, at - 60), at + 140);
        };
        record('default: and the app said which route it took',
            /not installed/.test(said) && /(compiler service|service at)/.test(said),
            quote(/not installed/, 'no "not installed" anywhere in the panel or trace'));
        record('default: and named the way back',
            /Settings/.test(said) && /C Compiler/.test(said) && /Download compiler/.test(said),
            quote(/C Compiler/, 'the working Settings → C Compiler → Download compiler route was not offered'));

        // STOP HERE. Everything below drives a live session — stepping, frames,
        // watchpoints — and presupposes a build that completed. In this mode
        // there deliberately is none, so continuing would assert the opt-in
        // contract against a run that was never meant to satisfy it. The three
        // records above ARE this mode's contract.
        await shoot('default-route-hosted.png');
        await browser.close();
        if (server) server.close();
        const dfFailed = results.filter(r => !r.ok);
        console.log(`\n${results.length - dfFailed.length}/${results.length} checks passed`);
        console.log(`screenshots: ${SHOTS}`);
        process.exit(dfFailed.length ? 1 : 0);
    } else {
        // THE LOCAL ROUTE, MEASURED RATHER THAN INFERRED. Nothing GPL is in this
        // build, so an opt-in compile that reached no hosted service must have
        // fetched the toolchain from its own GPL origin. Assert exactly that,
        // because "must have" stops being true the moment someone reintroduces
        // a bundled copy — and D2 alone would still pass if they did.
        const fromGpl = gplToolchainRequests.filter(u => u.startsWith(GPL_ORIGIN));
        record('the toolchain was fetched from the GPL origin, not from this app',
            fromGpl.length > 0 && fromGpl.length === gplToolchainRequests.length,
            gplToolchainRequests.length
                ? `${fromGpl.length}/${gplToolchainRequests.length} from ${GPL_ORIGIN} — e.g. ${fromGpl[0] || gplToolchainRequests[0]}`
                : 'no toolchain request seen at all — is it bundled again?');

        // Unchanged assertion, behind the opt-in above. A user who asks for the
        // in-page compiler still gets a build that touches no network.
        record('D2: the 8051 build made exactly zero hosted compiler requests',
            hostedCompilerRequests.length === 0,
            hostedCompilerRequests.length ? hostedCompilerRequests.join(' | ') : '0 POST /compile requests');
    }
    if (!attached) {
        console.log(`panel trace:\n  ${trace.join('\n  ')}`);
        if (console_.length) console.log(`console:\n  ${console_.join('\n  ')}`);
        await shoot('00-attach-failed.png');
        console.log('\nCannot proceed without a session. See 00-attach-failed.png');
        await browser.close(); if (server) server.close();
        process.exit(1);
    }

    // ── D28: the Position pane, while paused ────────────────────────────
    await clickByText(/^\s*⏸?\s*(Pause)\s*$/i);
    const paused = await waitFor(phase, p => p === 'paused', 20000);
    record('the session is paused before inspecting or stepping', paused === 'paused',
        `phase=${paused}`);

    await debugPanel.getByRole('button', {name: /About this stack|Über diesen Stapel/}).click();
    const frames = await debugPanel.evaluate(el => {
        el = el.querySelector('[data-debug-frames]');
        if (!el) return null;
        return {
            kind: el.getAttribute('data-frames-kind'),
            why: (el.querySelector('[data-frames-why]') || {}).innerText || '',
            rows: [...el.querySelectorAll('[data-frame-row]')].map(r => r.innerText),
            vars: [...el.querySelectorAll('[data-frame-var]')].map(r => r.innerText)
        };
    });
    record('D28: the Position pane is rendered', !!frames, frames ? `kind=${frames.kind}` : 'absent');
    if (frames) {
        const refuses = /cooperative scheduler, not a stack machine/i.test(frames.why);
        record('D28: it REFUSES to show a call stack, in words', refuses,
            refuses ? frames.why.slice(0, 90) + '…' : `why="${frames.why.slice(0, 120)}"`);
        record('D28: it lists the scheduler position', frames.rows.length > 0,
            `${frames.rows.length} task row(s): ${frames.rows.join(' | ').slice(0, 120)}`);
        record('D28: and the program variables with their addresses', frames.vars.length > 0,
            frames.vars.join(' | ').slice(0, 120));
    }
    const framed01 = await shoot('01-frames-locals.png',
        debugPanel.locator('[data-debug-frames]').first());
    record('01-frames-locals.png SHOWS the Position pane, refusal text and all',
        !!(framed01 && framed01.ok), framed01 ? framed01.detail : 'nothing to frame');

    // ── D25: one cycle step moves the counter by exactly one ────────────
    // The drawer holds the engineer's controls; open it first.
    await clickByText(/under the hood|unter der haube/i);
    // Everything below lives inside the drawer's `open` branch, so a failed
    // toggle would read as "the feature is missing". Confirm it opened.
    const drawerOpen = await waitFor(
        () => debugPanel.locator('[data-watchpoints]').count().then(n => n > 0), v => v, 10000);
    record('the under-the-hood drawer opened', drawerOpen,
        drawerOpen ? 'watchpoints pane present' : 'toggle did not open the drawer');

    const cycleBtn = debugPanel.locator('[data-step-cycle]').first();
    const hasCycleBtn = await cycleBtn.count() > 0;
    record('D25: the cycle-step button is present on the C target', hasCycleBtn,
        hasCycleBtn ? 'rendered' : 'missing — the emu8051 target should declare `cycle`');

    // The drawer's clock pane is where the derived count is printed. It has no
    // data-attribute of its own, so it is located by the text it renders —
    // `5,529,625 cycles @ 11.059 MHz` — which is also exactly the string a
    // human has to be able to read off the screenshot.
    const cycleReadout = debugPanel
        .locator('div', {hasText: /^[\d.,]+ (cycles|Zyklen) @ [\d.]+ MHz$/}).last();

    if (hasCycleBtn) {
        const readCycles = () => debugPanel.evaluate(el => {
            const m = (el.innerText || '').match(/([\d.,]+)\s*(cycles?|Zyklen)\s*@/i);
            return m ? Number(m[1].replace(/[.,]/g, '')) : null;
        });
        const before = await readCycles();
        // ONE NUMBER IN ONE FRAME CANNOT SHOW A DELTA. The claim under test is
        // "+1", so the evidence is a pair: the same readout photographed either
        // side of the click. A single after-shot would be a screenshot of a
        // number nobody can check, which is how the first green run of this
        // gate produced three unreadable claims and passed anyway.
        const framedBefore = await shoot('02-cycle-step-before.png', cycleReadout);
        record('02-cycle-step-before.png SHOWS the derived cycle count before the step',
            !!(framedBefore && framedBefore.ok),
            framedBefore ? framedBefore.detail : 'nothing to frame');
        await cycleBtn.click();
        // Wait for the number to MOVE rather than for a fixed 600 ms. This is
        // strictly better than a sleep here: it cannot pass by reading a stale
        // value, and it cannot fail because the box was busy.
        const after = await waitFor(readCycles, v => v !== null && v !== before, 15000, 100);
        const delta = (before != null && after != null) ? after - before : null;
        record('D25: one cycle step advances the cycle count by EXACTLY 1', delta === 1,
            `before=${before} after=${after} delta=${delta}`);
    }
    const framed02 = await shoot('02-cycle-step.png', cycleReadout);
    record('02-cycle-step.png SHOWS the derived cycle count after the step',
        !!(framed02 && framed02.ok), framed02 ? framed02.detail : 'nothing to frame');

    // ── D29: a watchpoint halts at the write and names the byte ──────────
    // `counter` lives in iram; the drawer's watch button prompts for the hex
    // address. The prompt is answered through the dialog handler.
    const varsNow = await debugPanel.evaluate(el => {
        el = el.querySelector('[data-debug-frames]');
        return el ? [...el.querySelectorAll('[data-frame-var]')].map(r => r.innerText) : [];
    });
    const m = varsNow.map(v => v.match(/^([^\n]+)[\s\S]*?(iram)\s+0x([0-9A-F]+)/i)).find(Boolean);
    record('D29: a rendered IRAM variable supplies the watch address', !!m,
        m ? `${m[1].trim()} at ${m[2]} 0x${m[3]}` : `variables: ${varsNow.join(' | ')}`);
    const watchAddr = m ? parseInt(m[3], 16) : null;
    if (watchAddr === null) {
        await browser.close(); if (server) server.close();
        process.exit(1);
    }
    console.log(`watching ${m[1].trim()} at ${m[2]} 0x${m[3]}`);

    page.removeAllListeners('dialog');
    page.on('dialog', d => d.accept(watchAddr.toString(16)));

    const addWatch = debugPanel.locator('[data-add-watchpoint]').first();
    const hasAddWatch = await addWatch.count() > 0;
    record('D29: the watchpoint control is offered on this build', hasAddWatch,
        hasAddWatch ? 'rendered' : 'missing — the vendored WASM does export _emu_dbg_set_bp_write');

    if (hasAddWatch) {
        await addWatch.click();
        // The armed entry is the condition; the prompt is answered by the
        // dialog handler above, so this resolves as soon as React repaints.
        const entry = debugPanel.locator('[data-watchpoint-entry]').first();
        await entry
            .waitFor({state: 'visible', timeout: 15000}).catch(() => {});
        const entryText = await entry.count() ? await entry.innerText() : '';
        const armedAtAddress = new RegExp(`(?:0x)?0*${watchAddr.toString(16)}\\b`, 'i').test(entryText);
        record('D29: the watchpoint is armed and listed at that address', armedAtAddress,
            entryText || 'no entry');

        // Resume: the very next write to that byte must stop us.
        await clickByText(/^\s*▶?\s*(Run|Start)\s*$/i);
        const resumed = await waitFor(phase, p => p === 'running', 15000, 25);
        record('D29: the session resumed with the watch armed', resumed === 'running',
            `phase=${resumed}`);
        const pressed = await page.evaluate(() => {
            const board = window.__activeBoard || window.__board;
            const circuit = window.__circuit;
            const button = circuit && Array.isArray(circuit.parts) &&
                circuit.parts.find(p => p && p.kind === 'button');
            if (!board || typeof board.setControl !== 'function' || !button) return null;
            board.setControl(button.id, 1);
            return button.id;
        });
        record('D29: the example button is pressed through the active solved board', !!pressed,
            pressed || 'no active-board button control');
        const hit = await waitFor(
            () => debugPanel.evaluate(root => {
                const el = root.querySelector('[data-watch-hit]');
                return el ? el.innerText : '';
            }),
            t => /0x/i.test(t), 30000);

        const named = /0x/i.test(hit);
        record('D29: the run halted at the write and the panel NAMED the byte', named,
            named ? hit.replace(/\s+/g, ' ').slice(0, 160) : 'no [data-watch-hit] appeared');
        // The claim in the brief is "which address and what value" — check both.
        const hasAddr = new RegExp(`0x0*${watchAddr.toString(16)}`, 'i').test(hit);
        const hasVals = /(was|war)\s+0x[0-9A-F]+/i.test(hit) && /(now|jetzt)\s+0x[0-9A-F]+/i.test(hit);
        record('D29: the report carries the watched ADDRESS', hasAddr, hit.slice(0, 120));
        record('D29: and both sides of the VALUE transition', hasVals, hit.slice(0, 120));
    }
    const framed03 = await shoot('03-watchpoint-hit.png',
        debugPanel.locator('[data-watch-hit]').first());
    record('03-watchpoint-hit.png SHOWS the halt line naming the byte and both values',
        !!(framed03 && framed03.ok), framed03 ? framed03.detail : 'nothing to frame');

    record('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

    await browser.close();
    if (server) server.close();

    const failed = results.filter(r => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    console.log(`screenshots: ${SHOTS}`);
    process.exit(failed.length ? 1 : 0);
};

main().catch(e => { console.error(e); process.exit(1); });
