/**
 * Check C — a number a lesson teaches must be one its bench produces.
 *
 * The whole-catalog run comes back with zero unmatched quantities, and a
 * zero has to be earned. Two things are asserted here so it can be believed:
 *
 *   1. COVERAGE. "0 unmatched" is meaningless without "out of N examined": a
 *      scanner whose extractor silently matched nothing would report exactly
 *      the same clean result. The extractor is tested against a sentence whose
 *      answer is known, and the corpus run is asserted to have examined a
 *      non-trivial number of quantities.
 *   2. MUTATION. Injecting a value no bench produces must make it red across
 *      the catalog.
 *
 * The coverage number is small on purpose and is worth knowing: only 13 of the
 * 79 lessons quote an electrical quantity in their English prose at all. This
 * check therefore protects a narrow seam well and says nothing about the other
 * 66 — which is a fact about how the curriculum is written, not a gap in the
 * check, and it is the reason Check B carries the weight.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {claimsIn, checkLesson} from '../scripts/lesson-numeric-contract.mjs';
import {loadCatalog} from '../scripts/detect-lesson-defects.mjs';
import {classifyElapsed, selfCpuSeconds} from './helpers/timed.mjs';
import {loadavg} from 'node:os';

test('the extractor finds electrical quantities and ignores everything else', () => {
    const claims = claimsIn(
        'For 10 kΩ and 100 µF, τ is 1 s and 63.2% of 5 V is 3.16 V. ' +
        'A 10-bit ADC over 1023 counts gives 4.9 mV per count, and 470 ohm drops 2.3 V at 4.9 mA.');
    const found = claims.map(c => c.raw);
    // Every electrical quantity, including the one whose unit is a non-word
    // character: `Ω\b` needs the NEXT character to be a word character, so a
    // trailing \b silently dropped every "10 kΩ and ..." in the corpus.
    assert.deepEqual(found,
        ['10 kΩ', '100 µF', '1 s', '5 V', '3.16 V', '4.9 mV', '470 ohm', '2.3 V', '4.9 mA']);
    // and nothing dimensionless: 63.2%, 10-bit, 1023 counts are claims about
    // arithmetic and about a converter, not about any bench.
    assert.ok(!found.some(f => /%|bit|count/.test(f)));
    // Tolerance follows the precision of the quote, not a flat percentage.
    assert.equal(claims.find(c => c.raw === '4.9 mV').quantum, 0.5 * 1e-1 * 1e-3);
});

test('pin identifiers and teaching opcodes do not imply measurements', () => {
    assert.deepEqual(claimsIn('Predict P2.0 after P2A 1, write 0x5A, and compare R1.0A with 2A and -0.2 V.')
        .map(claim => claim.raw), ['2A', '-0.2 V']);
});

test('the whole catalog matches, and enough was examined for that to mean something', async () => {
    // Sampled before the work so the discriminator can be given the same window the
    // benches ran in, rather than a guess about it.
    const runStarted = process.hrtime.bigint();
    const cpuStarted = selfCpuSeconds();
    const loadAtStart = loadavg()[0];
    let examined = 0;
    let unmatched = 0;
    let quoting = 0;
    const skipped = {};
    for (const lesson of loadCatalog()) {
        const result = await checkLesson(lesson);
        if (result.skipped) { skipped[result.skipped] = (skipped[result.skipped] || 0) + 1; continue; }
        examined += result.examined.length;
        if (result.examined.length) quoting++;
        unmatched += result.unmatched.length;
        for (const finding of result.unmatched) {
            assert.fail(`${finding.lesson} quotes ${finding.quoted} in ${finding.where}, which ` +
                `${finding.example} does not produce; nearest measured: ` +
                `${(finding.nearest || []).map(v => Number(v).toPrecision(4)).join(', ')}`);
        }
    }
    assert.equal(unmatched, 0);
    assert.ok(examined >= 40, `only ${examined} quantities examined — the extractor has gone quiet`);
    assert.ok(quoting >= 10, `only ${quoting} lessons quote a quantity — the catalog or the extractor changed`);
    // Skips are counted and asserted, not ignored — but only the part that is
    // deterministic. Nine program-only lessons have no bench, and that is a
    // property of the catalog. How many machine benches outrun the 15 s
    // measurement budget is a property of the machine the test runs on, so it
    // is bounded rather than pinned: pinning it made this gate fail on a loaded
    // box, which is a flaky gate, which is a gate people learn to ignore.
    assert.equal(skipped['no-circuit'], 9, 'nine program-only lessons have no bench');
    // WHEN THIS FIRES, SAY WHICH IT WAS. The old message was "raise it or check the
    // box", which names the two possibilities and helps with neither — and "raise
    // it" is the remedy that destroys the check. sb3-creator's PLAN.md §27 calls
    // this the cannot-be-trusted-when-busy shape; test/helpers/timed.mjs is the
    // instrument for it. A bench that outran the budget while COMPUTING is a bench
    // that got slower; one that outran it while starved is a busy machine.
    const truncated = skipped['measurement-truncated'] || 0;
    if (truncated > 4) {
        // The window measured here is the WHOLE catalog walk, not one bench's 15 s.
        // So the sentence is built from the classifier's fields rather than taken
        // from its ready-made message, which would otherwise read "timed out after
        // 1161 s (budget 15000 ms)" and be false about both numbers. What transfers
        // across the two scales is the verdict: over the whole run, was this process
        // computing or starved?
        const wallSeconds = Number(process.hrtime.bigint() - runStarted) / 1e9;
        const cpuSeconds = selfCpuSeconds() - cpuStarted;
        const v = classifyElapsed({
            what: 'the catalog walk', budgetMs: 15_000, wallSeconds, cpuSeconds, loadStart: loadAtStart
        });
        const reading = v.verdict === 'contention'
            ? 'STARVED: over the whole walk this process barely got the CPU, so the 15 s ' +
              'per-bench budget bought less work than it normally does. This is the machine. ' +
              'Re-run on a quieter box; raising the budget would hide a real slowdown later.'
            : v.verdict === 'unknown'
                ? 'the CPU reference was unavailable, so which of the two this is cannot be said here.'
                : 'COMPUTING, not starved: the process spent the CPU it was given. Either these ' +
                  'benches genuinely got slower, or the box is slow enough that 15 s buys less ' +
                  'work than when the ceiling of 4 was set. Compare against a quiet run before ' +
                  'touching either number.';
        assert.fail(
            `${truncated} benches outran the 15 s measurement budget (ceiling 4). ` +
            `Over the whole catalog walk: ${cpuSeconds.toFixed(1)} s of CPU in ` +
            `${wallSeconds.toFixed(1)} s wall (ratio ${v.ratio?.toFixed(3)}), while a deliberately ` +
            `CPU-bound child measured right now achieves ${v.achievable?.toFixed(3)} — ` +
            `${((v.share ?? 0) * 100).toFixed(0)}% of what was going. Load ${v.loadStart.toFixed(1)} ` +
            `-> ${v.loadEnd.toFixed(1)} on ${v.nodes ?? '?'} node processes. Reading: ${reading}`);
    }
    assert.deepEqual(Object.keys(skipped).filter(k =>
        !['no-circuit', 'measurement-truncated'].includes(k)), [],
        'an unexpected skip reason appeared; a skip is not a pass');
});

test('MUTATION: a value the bench cannot produce is caught', async () => {
    const lesson = structuredClone(loadCatalog().find(l => l.id === 'electricity-ohms-law'));
    lesson.copy.en.objective += ' The supply here is 137 V.';
    const result = await checkLesson(lesson);
    assert.ok(result.unmatched.some(f => f.quoted === '137 V'),
        'the check did not notice a 137 V supply on a 5 V bench — it is not checking');
    // and the real numbers in the same lesson still match
    assert.equal(result.unmatched.length, 1);
});
