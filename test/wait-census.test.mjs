/**
 * The browser gates' unconditional sleeping is a number, and it may only shrink.
 *
 * WHY THIS IS A GATE AND NOT JUST A REPORT
 * ----------------------------------------
 * `docs/MEASURED-THRESHOLDS.md` asks, of every number that bounds a verdict,
 * who measured it. `waitForTimeout(N)` is not such a number — it bounds
 * nothing, decides nothing, and a threshold inventory is right to skip it.
 * Which is exactly why nobody has ever had to justify one, and why there are
 * now 261 of them against 153 bounds.
 *
 * A fixed sleep is a guess about how long the app needs, and it is the one kind
 * of guess that cannot be checked by watching: it costs exactly what it was
 * given, every time. Too short is a flake nobody can reproduce. Too long is
 * wall-clock on every CI run forever. The only thing an outside observer can do
 * is refuse to let the total grow silently.
 *
 * So: a ratchet, with the measurement in the source next to it, per the rule
 * that a re-measurement is written back so nobody repeats it.
 *
 * HOW TO CHANGE THESE NUMBERS
 * ---------------------------
 * DOWN, freely — replace a sleep with a wait for the condition it is standing
 * in for (`waitForSelector`, `waitForFunction`), then lower the ceiling to the
 * new total in the same commit.
 *
 * UP only with a reason in the commit message. Adding a browser gate is a
 * legitimate reason. "The test got flaky so I raised the sleep" is the failure
 * this ratchet exists to make visible: it is the cheapest possible fix and it
 * charges every future CI run for it.
 */
import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');

const censusJson = () => JSON.parse(execFileSync('node',
    [path.join(ROOT, 'scripts', 'aggregate-timeouts.mjs'), '--census', '--json'],
    {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26}));

// BASELINE RE-MEASURED 2026-08-28 after this branch was integrated into the
// expanded browser-gate workflow, by
// scripts/aggregate-timeouts.mjs --census. Every ceiling here is the observed
// value with ZERO headroom, which is the correct state for a ratchet: nothing
// can be added without this going red.
//
//   run by CI           106 sleeps  116.880 s across 11 browser-gate scripts
//   TOTAL               153 bounds  261 sleeps  426.640 s
//
// The historical 2026-08-24 measurement remains in docs/WAIT-CENSUS.md. The
// increase is the explicit cost of six gates added since that sweep: Arduboy,
// labwired, debugger-only, example selection, micro:bit and micro:bit debug.
//
// EXACT values below, not the report's rounded ones. Setting `ciSleepMs` from the
// table's "61.9 s" made the ratchet red on the tree it was measured against:
// the true total is 61,930 ms. A ceiling read off a rounded display is a
// threshold whose evidence is a formatting decision.
// RAISED 2026-09-22 for the flag-on FPGA surface gate, which is the legitimate
// reason this ratchet names: a gate was ADDED. scripts/verify-fpga-surface.mjs
// existed and was listed in test/gate-coverage.test.mjs as knowingly unwired;
// the new `fpga-surface` job in build.yml runs it, so its sleeps now cost CI
// time and the census counts them for the first time. NO NEW SLEEP WAS WRITTEN
// — the delta is entirely the price of running a script that was already there.
//
// Measured with scripts/aggregate-timeouts.mjs --census --json, on this branch
// and on origin/main with only .github/workflows/build.yml swapped between the
// two runs, so the difference is the wiring and nothing else:
//
//   before (origin/main)  104 sleeps  111,880 ms
//   after  (this branch)  110 sleeps  120,180 ms
//   delta                  +6 sleeps   +8,300 ms   all in verify-fpga-surface.mjs
//
// TIGHTENED 2026-09-23: `totalSleeps` 261 -> 192, closing the note the previous
// change left here. A ratchet with slack is not a ratchet — 69 sleeps could have
// been added repository-wide without a word, which is the exact silence this file
// exists to break. Main drifted DOWN since the 2026-08-28 sweep (sleeps removed,
// and vendor-absent-by-design retired with its own) and nothing pulled the
// ceiling after it; moving a ceiling down to meet the tree is always allowed.
//
// RE-MEASURED on this tree, all four, so no ceiling here is inherited from an
// older shape of the repository:
//
//   run by CI    110 sleeps  120,180 ms
//   TOTAL        192 sleeps  331,030 ms   (590 bounds, 775 files parsed)
//   scratch       10 _tmp- files with waits
//
// Every number below is now the observed value with ZERO headroom, which is the
// correct state for a ratchet: nothing can be added without this going red.
//
// FALSIFIED, not assumed — and the first attempt at falsifying it FAILED, which
// is worth writing down. A bare `await new Promise(r => setTimeout(r, 1))` added
// to a test file does NOT move this count: the census counts `waitForTimeout(N)`
// callees and nothing else (scripts/aggregate-timeouts.mjs:132, and its header
// says why that is the right subject). One added `waitForTimeout(1)` does trip
// it — "193 fixed sleeps across scripts/ and test/, up from 192" — so the
// ratchet bites, but only on the shape it claims to be about. A `setTimeout`
// that blocks CI is a different (uncounted) problem.
//
// IF THIS IS WHAT BROKE YOUR BUILD: you added a `waitForTimeout`. The fix is to
// wait for the CONDITION it stands in for (waitForSelector / waitForFunction),
// not to raise the number. If you genuinely added a gate, raise it here in the
// same commit with the measurement, as the FPGA entry above does.
//
// RAISED 2026-11-24, `totalSleeps` 192 -> 198, for two browser gates ADDED
// (the reason this ratchet accepts) and one sleep that waits for nothing to
// happen. Main had been red on this since 2026-11-17; the 198 is the census
// on CI run 45318622606, and the per-file delta from the last green tree
// (6e8f065c6) to f91769963 is exactly these:
//
//   +2  verify-cad-fasteners.mjs (2f2a25f00): 20 ms between synthetic CDP
//       touchMove steps, which IS the gesture's speed, and a 300 ms settle
//   +5  verify-editor-trackpad.mjs (65463f90c): wheel/pinch/Stop settles
//   +1  verify-native-benchmarks-browser.mjs (b48989314): 100 ms after Stop
//       in which a stale completion must NOT arrive; there is no condition
//       to wait for when the assertion is an absence over time
//   -1  verify-editor.mjs (38046417d): replaced by a wait for search dismissal
//   -1  _tmp-vdp-asm-probe.mjs (49c2bcc52): replaced by a readiness wait
//
// The CI-run ceilings below did not move (CI passed them). The two added
// gates are manual/local (KNOWN_UNWIRED in test/gate-coverage.test.mjs);
// whoever wires them should replace the trackpad settles with conditions
// first, since that is when they would start costing CI time.
const CEILING = {
    // 2026-11-27 census after replacing the Circuit fixture delay with a model-state wait.
    ciSleepMs: 120_080,
    ciSleeps: 110,
    totalSleeps: 197,
    scratchFiles: 10        // _tmp- scripts that contain waits
};

describe('the wait census: fixed sleeps are counted, and may only shrink', () => {
    const c = censusJson();
    const isScratch = (f) => /(^|\/)_tmp-/.test(f);
    const ci = new Set(c.ci);
    const ciSleeps = c.census.sleeps.filter((s) => ci.has(s.file));

    test('the census parsed a real tree (instrument before subject)', () => {
        // Every assertion below is a sum over a list, and a broken scan returns
        // an empty list — which reads as "no sleeps at all", the best possible
        // news, from the worst possible cause.
        assert.ok(c.census.parsed >= 100,
            `the census parsed only ${c.census.parsed} files; expected at least 100. `
            + 'The scan is broken and every total below would be a clean sweep over nothing.');
        assert.ok(c.census.bounds.length >= 100,
            `only ${c.census.bounds.length} bounding literals found; expected ~119. The Property `
            + 'visitor has stopped matching `timeout:` and the bounds population is invisible.');
        assert.ok(ciSleeps.length > 0,
            'no fixed sleeps found in any script CI runs. Either CI stopped running the browser '
            + 'gates or the CI_GATES resolution broke; both make the ratchet below vacuous.');
    });

    test('the CI browser gates sleep no longer than the current measured baseline', () => {
        const total = ciSleeps.reduce((a, s) => a + s.value, 0);
        assert.ok(total <= CEILING.ciSleepMs,
            `the scripts CI runs now spend ${(total / 1000).toFixed(1)} s in waitForTimeout() per run, `
            + `up from the measured ${(CEILING.ciSleepMs / 1000).toFixed(1)} s. That time is spent whether `
            + 'or not the app is ready, on every CI run, forever.\n'
            + 'If a gate got flaky, the fix is to wait for the CONDITION (waitForSelector / '
            + 'waitForFunction), not to sleep longer. If you added a gate, raise this ceiling in the '
            + 'same commit and say so.');
        assert.ok(ciSleeps.length <= CEILING.ciSleeps,
            `${ciSleeps.length} fixed sleeps in CI-run scripts, up from ${CEILING.ciSleeps}.`);
    });

    test('the repository-wide sleep count does not grow', () => {
        assert.ok(c.census.sleeps.length <= CEILING.totalSleeps,
            `${c.census.sleeps.length} fixed sleeps across scripts/ and test/, up from `
            + `${CEILING.totalSleeps}. A new one needs the same justification as any other `
            + 'unmeasured number bounding CI.');
    });

    test('the _tmp- scratch scripts do not multiply', () => {
        // 10 tracked files whose names say they are temporary, holding 40 of
        // the repository's 119 bounding literals and 155.5 s of sleeps. They
        // are a third of the "unmeasured timeouts" population and nothing runs
        // them.
        // Not deleted here — that is someone else's call, and several may still
        // be useful probes — but they may not grow while wearing a name that
        // says they are already gone.
        const files = new Set([...c.census.bounds, ...c.census.sleeps]
            .map((r) => r.file).filter(isScratch));
        assert.ok(files.size <= CEILING.scratchFiles,
            `${files.size} \`_tmp-\` scripts now carry waits, up from ${CEILING.scratchFiles}:\n  `
            + [...files].sort().join('\n  ')
            + '\nA file named _tmp- that outlives its afternoon is not temporary, it is untracked '
            + 'debt with a misleading name. Promote it or delete it.');
    });
});
