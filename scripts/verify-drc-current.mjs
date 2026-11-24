#!/usr/bin/env node
/**
 * Browser gate: the DEPLOYED DRC can sum chip current.
 *
 * bw-circuit-ui's drc.js reads its current ratings off the injected engine and
 * falls back to `getMaxCurrent: () => null` when the host did not supply them.
 * circuit-tab.jsx's `setEngine` call omitted `getMaxCurrent` and `PORT_LIMITS`
 * until 2026-08-30, so in the app people actually use, rule 8 (aggregate
 * current) resolved EVERY part to an honest unknown: the sum never reached the
 * limit from ratings, and every warning it did manage to raise (off solved LED
 * currents) carried a "cannot be rated" hedge. Nothing logged, nothing threw,
 * and the isolated tests — which all inject the pair — stayed green.
 *
 * WHAT WAS AND WAS NOT BROKEN, measured on production before the fix. The
 * ENGINE's own budget check (bw-board `checkCurrentBudget`, which holds the
 * ratings by construction) still summed them and surfaced "Up to 125.0 mA at
 * maximum ratings" through the board's render state — once per part, 25 times
 * on bench 2, with no consumer breakdown and no fix. What was crippled is the
 * DRC's rule 8: the one warning that names the largest consumers, states a
 * total rather than a ceiling, and offers a way out. So both benches below key
 * on rule 8's OWN sentence ("Total circuit current is …"), never merely on a
 * chip being present — the engine's generic ceiling raises that chip either
 * way, and a gate that cannot tell them apart is not a gate.
 *
 * A unit test can assert the injection exists. Only a browser can say the
 * BUNDLE ships it, so this gate loads two deliberately-overloaded benches into
 * the real Circuit Designer and reads the warning chip.
 *
 *   BENCH 1 — measured, fully rated. Eight red LEDs, each through 100 Ω from
 *     the 5 V rail to ground: (5 − 1.8)/(100 + 10) = 29.1 mA apiece, 232.7 mA in
 *     total, past the 120 mA chip limit. The DANGER fires either way here —
 *     the current is solved, not rated — but under the fallback its text MUST
 *     read "at least 232.7 mA … Some parts (vcc, gnd, resistor) cannot be rated",
 *     because with `() => null` every passive is an unknown. A clean "218 mA"
 *     with no hedge is therefore a browser-visible fingerprint of the real
 *     ratings being live in the shipped bundle.
 *
 *   BENCH 2 — kind-rated only. 25 IR receivers, 5 mA each = 125 mA, and not one
 *     wire: every milliamp in that sum comes from `getMaxCurrent`, because the
 *     solver has nothing to measure. Under the fallback rule 8 sums 0 mA and
 *     says nothing — the chip still appears, carrying 25 copies of the engine's
 *     generic ceiling and no rule-8 sentence at all, which is exactly what the
 *     production run before the fix printed. This is the half that cannot be
 *     faked by the solver.
 *
 * Both are screenshotted so the claim is inspectable from any CI run.
 *
 * Usage: PROOF_URL=http://localhost:8617/ node scripts/verify-drc-current.mjs
 */
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.PROOF_URL || 'https://crispstrobe.github.io/brickwright-lite/';
const shotDir = join(root, 'artifacts');

const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

/** Bench 1: eight LEDs lit straight off the rail. */
const measuredBench = () => {
    const parts = [
        {id: 'VCC', kind: 'vcc', params: {}, terminals: ['vcc'], x: 70, y: 90},
        {id: 'GND', kind: 'gnd', params: {}, terminals: ['gnd'], x: 70, y: 430},
        {id: 'mcu1', kind: 'mcu', params: {}, terminals: ['P1.0'], x: 760, y: 110},
    ];
    const wires = [];
    for (let i = 0; i < 8; i++) {
        parts.push({id: `R${i}`, kind: 'resistor', params: {ohms: 100}, terminals: ['a', 'b'],
            x: 170 + i * 72, y: 190});
        parts.push({id: `LED${i}`, kind: 'led', params: {vf: 2.0, color: 'red'},
            terminals: ['anode', 'cathode'], x: 170 + i * 72, y: 320});
        wires.push({id: `w${i}a`, netId: `n_rail_${i}`, from: {part: 'VCC', terminal: 'vcc'}, to: {part: `R${i}`, terminal: 'a'}});
        wires.push({id: `w${i}b`, netId: `n_mid_${i}`, from: {part: `R${i}`, terminal: 'b'}, to: {part: `LED${i}`, terminal: 'anode'}});
        wires.push({id: `w${i}c`, netId: 'n_gnd', from: {part: `LED${i}`, terminal: 'cathode'}, to: {part: 'GND', terminal: 'gnd'}});
    }
    return {vcc: 5, parts, wires, holeWires: [], fileOnly: true};
};

/** Bench 2: 25 IR receivers, nothing wired — a pure ratings sum. */
const ratedBench = () => {
    const parts = [{id: 'mcu1', kind: 'mcu', params: {}, terminals: ['P1.0'], x: 640, y: 90}];
    for (let i = 0; i < 25; i++) {
        parts.push({id: `ir${i}`, kind: 'ir_receiver', params: {},
            x: 90 + (i % 7) * 96, y: 230 + Math.floor(i / 7) * 104});
    }
    return {vcc: 5, parts, wires: [], holeWires: [], fileOnly: true};
};

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

try {
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.waitForSelector('[role="tab"]', {timeout: 90000});
    await page.getByRole('tab', {name: /Circuit/}).click();
    const designer = page.locator('.bw-circuit-designer:visible').last();
    await designer.waitFor({state: 'visible', timeout: 90000});

    // Same host handle the rendering gate uses: the circuit tab's React
    // instance, found by walking the fiber tree for the component that both
    // owns `circuitData` and can load an example.
    const found = await page.evaluate(() => {
        const rootEl = document.querySelector('[class*="gui_body"]') || document.querySelector('[class*="gui"]');
        const key = Object.keys(rootEl || {}).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        const queue = key ? [rootEl[key]] : [];
        for (let i = 0; i < 10000 && queue.length; i++) {
            const fiber = queue.shift();
            if (fiber?.stateNode?.loadExample && Object.hasOwn(fiber.stateNode.state || {}, 'circuitData')) {
                window.__bwDrcCircuitTab = fiber.stateNode;
                return true;
            }
            if (fiber?.child) queue.push(fiber.child);
            if (fiber?.sibling) queue.push(fiber.sibling);
        }
        return false;
    });
    check('the Circuit host is reachable', found);
    if (!found) throw new Error('circuit tab host not found');

    /**
     * Load a bench, open the warning chip, return its rendered findings.
     *
     * NO FIXED SLEEPS — `test/wait-census.test.mjs` ratchets the repository's
     * unconditional sleeping and it may only shrink, which is the right rule:
     * a `waitForTimeout` costs exactly what it was given on every future run
     * and is the one guess that cannot be checked by watching. So each step
     * waits for the condition it is actually standing in for.
     *
     * `settled` is a marker the bench produces in BOTH the broken and the fixed
     * build, so waiting for it is a wait and not an assertion wearing a wait's
     * clothes: it says "the DRC has re-run over the new topology", and the
     * discriminating checks then read settled content. Picking a
     * fix-only marker here would have turned the broken build's honest FAIL
     * into a timeout, which reads as infrastructure trouble rather than as the
     * defect it is.
     */
    const loadAndRead = async (data, settled) => {
        await page.evaluate(value => new Promise(res => {
            window.__bwDrcCircuitTab.setState({circuitData: value}, res);
        }), data);
        const chip = designer.locator('[data-warnings-chip]');
        try {
            await chip.first().waitFor({state: 'visible', timeout: 30000});
        } catch {
            return {chip: false, text: ''};
        }
        // The popover is portalled to document.body (bw-circuit-ui#134) so the
        // scrolling toolbar row cannot clip it; look for it on the page.
        if (await page.locator('[data-warnings-popover]').count() === 0) await chip.first().click();
        const pop = page.locator('[data-warnings-popover]');
        await pop.first().waitFor({state: 'visible', timeout: 30000});
        // The popover renders before the DRC memo has necessarily re-run over
        // the new topology; wait for this bench's own finding to be in it.
        await pop.first().locator(`text=${settled}`).first()
            .waitFor({state: 'visible', timeout: 30000});
        return {chip: true, text: await pop.first().innerText()};
    };

    // ── BENCH 1 ────────────────────────────────────────────────────────────
    // 'Total circuit current is' fires on this bench either way — the LEDs are
    // MEASURED by the solver, so rule 8 reaches a verdict with or without the
    // ratings. What differs is the wording, which is what the checks read.
    const one = await loadAndRead(measuredBench(), 'Total circuit current is');
    check('overloaded LED bench raises the warning chip', one.chip);
    console.log(`  bench 1 findings:\n    ${one.text.replace(/\n/g, '\n    ')}`);
    // 232.7 mA, not 218: the LED knee is vf − 0.020·rd = 1.8 under bw-board's
    // datasheet vf convention, so each branch is (5 − 1.8)/110 = 29.0909 mA and
    // eight of them are 232.727. Both figures below moved by exactly
    // 3.2/3.0 = 1.066667, which is the check that ONLY the knee moved: if any
    // other term had, the total and the per-part number would not share one factor.
    // bw-board 74d42338 (pin a685b220, round 3: "Diodes and LEDs exponential by
    // default") puts each LED on its Shockley curve instead of the knee: 28.9 mA a
    // branch, 231.5 mA in all, reported as 231 mA (CI run 45318622606). Either model's
    // total is accepted; the subject is a SUM past the 120 mA limit, not the LED model.
    check('bench 1 reports an aggregate current past the chip limit',
        /Total circuit current is .*23[123] mA, exceeding the .*120 mA limit/.test(one.text),
        one.text.slice(0, 200));
    check('bench 1 names the LEDs as the largest consumers',
        /led \(29 mA\)/.test(one.text));
    // THE DISCRIMINATOR: with `getMaxCurrent: () => null` every passive on this
    // bench (vcc, gnd, resistor) is unrated, so the text is FORCED to say
    // "at least" and to append the hedge. Their absence is the injection.
    check('bench 1 states a SUM, not a lower bound — the ratings are injected',
        !/cannot be rated/.test(one.text) && !/current is at least/.test(one.text),
        one.text.includes('cannot be rated')
            ? 'the deployed DRC is still on the () => null fallback' : '');
    await mkdir(shotDir, {recursive: true});
    await page.screenshot({path: join(shotDir, 'drc-current-measured.png'), fullPage: false});
    console.log(`screenshot: ${join(shotDir, 'drc-current-measured.png')}`);

    // ── BENCH 2 ────────────────────────────────────────────────────────────
    // 'at maximum ratings' is bw-board's own ceiling, which this bench raises
    // in both builds (and bench 1 never raises, so it cannot be stale text from
    // the previous popover). Rule 8's sentence is the thing under test here and
    // is deliberately NOT the settle marker.
    const two = await loadAndRead(ratedBench(), 'at maximum ratings');
    check('kind-rated-only bench raises the warning chip', two.chip);
    console.log(`  bench 2 findings:\n    ${two.text.replace(/\n/g, '\n    ')}`);
    check('bench 2 sums 25 x 5 mA of rated parts into rule 8 as 125 mA',
        /Total circuit current is 125 mA/.test(two.text),
        /Total circuit current/.test(two.text) ? two.text.slice(0, 160)
            : 'only the engine ceiling is present; rule 8 summed nothing, i.e. '
              + 'getMaxCurrent is still the () => null fallback');
    check('bench 2 calls it a danger past the 120 mA limit',
        /Total circuit current is 125 mA, exceeding the .*120 mA limit/.test(two.text));
    // Was a note, and is a CHECK since bw-circuit-ui dba5c44 was vendored: drc.js
    // used to list a contributor only when `rating > 0.005`, and an ir_receiver is
    // rated EXACTLY 0.005 — the only kind of 133 sitting on that boundary — so this
    // bench summed 25 of them into a 125 mA danger and then named nobody. The part
    // that caused the warning was the one part the warning could not mention.
    // The floor is `>= CONSUMER_LIST_FLOOR_A` now, so the screenshot below shows
    // what it was always meant to show, and this asserts it rather than admiring it.
    // A note next to a screenshot is not a gate: nothing fails when it stops being
    // true, which is how the empty list survived long enough to need a ledger row.
    check('bench 2 names the part that caused the warning',
        /Largest consumers: ir_receiver \(5 mA\)/.test(two.text),
        /Largest consumers:/.test(two.text)
            ? two.text.slice(two.text.indexOf('Largest consumers:'), two.text.indexOf('Largest consumers:') + 120)
            : 'no consumers line at all');
    await page.screenshot({path: join(shotDir, 'drc-current-rated.png'), fullPage: false});
    console.log(`screenshot: ${join(shotDir, 'drc-current-rated.png')}`);

    check('no page errors while running the DRC', pageErrors.length === 0, pageErrors.join(' | '));
} finally {
    await browser.close();
}

if (failures.length) {
    console.error(`\n${failures.length} DRC current-summing failure(s): ${failures.join(', ')}`);
    process.exit(1);
}
console.log('\nDRC current-summing browser gate passed.');
