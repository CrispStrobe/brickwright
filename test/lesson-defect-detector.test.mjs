/**
 * The Tier-3 detector must be able to fail — proven against the real defects.
 *
 * `docs/VERIFICATION-AUTOMATION.md`: "Mutation-prove every detector.
 * Re-introduce the exact defect it guards, confirm red, restore. A detector
 * that has never failed is not evidence."
 *
 * The mutation here is not synthetic. Both fixtures are the actual version-1
 * lesson objects, read out of git history at the commit before each was
 * repaired, so what is proven is that the detector catches the two defects a
 * human found by reading — the two that motivated building it.
 *
 * The negative half matters as much: the repaired version-2 forms must come
 * back clean. A detector that flags the fix as well as the defect gets ignored,
 * and the guard that separates them (prose that DISCUSSES a phenomenon versus
 * prose that asks the learner to OBSERVE it) is the fragile part, so it is
 * pinned here rather than trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {detect, loadCatalog, OBSERVABLES, DEMANDS} from '../scripts/detect-lesson-defects.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * The pre-repair lesson objects, VENDORED under test/fixtures/lesson-v1/ rather
 * than read out of git at test time.
 *
 * The first version of this file ran `git show <rev>^:…`. That passes on a
 * developer checkout and fails on every CI run: actions/checkout@v4 clones at
 * depth 1, so the parent commit is not in the runner's object store and git
 * exits with "fatal: invalid object name". It was the only failing file on lite
 * main, and it was mine. Reported by bw-bundle, confirmed against
 * .github/workflows/build.yml, which has no fetch-depth.
 *
 * Vendoring fixes more than the clone depth: a gate that reads git history also
 * breaks on the next squash, rebase or force-push, and these two objects are the
 * evidence the whole detector rests on. Each fixture carries its own provenance
 * — the sha it came from and the command to re-derive it.
 */
const lessonFixture = id => {
    const file = path.join(ROOT, 'test/fixtures/lesson-v1', `${id}.v1.json`);
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(doc.lesson, `${file} has no lesson object`);
    assert.ok(doc._provenance?.extractedFrom, `${file} has lost its provenance record`);
    return doc.lesson;
};

// ── Instrument check ────────────────────────────────────────────────────────
test('instrument: the fixtures really are the pre-repair forms', () => {
    // If these are not version 1 pointing at the old bench, the "mutation" below
    // is measuring something else entirely. Checked against the CURRENT catalog
    // rather than against git, so it holds on a depth-1 clone: the fixture must
    // be version 1 on the old example AND the live lesson must have moved on.
    const diode = lessonFixture('electricity-diode');
    const cap = lessonFixture('electricity-capacitor');
    assert.equal(diode.version, 1);
    assert.equal(diode.exampleId, '42-diode-rectifier');
    assert.equal(cap.version, 1);
    assert.equal(cap.exampleId, '29-capacitor-charge');
    // and the current ones are the repairs
    const now = Object.fromEntries(loadCatalog().map(l => [l.id, l]));
    assert.equal(now['electricity-diode'].exampleId, 'pc31-bridge-rectifier');
    assert.equal(now['electricity-capacitor'].exampleId, 'pc29-capacitor-discharge');
});

// ── Mutation proof ──────────────────────────────────────────────────────────
test('MUTATION: the version-1 diode lesson is flagged — a static bench cannot show a cycle', async () => {
    const report = await detect({lessons: [lessonFixture('electricity-diode')]});
    const blocking = report.findings.filter(f => f.severity === 'blocking');
    assert.ok(blocking.length >= 1,
        'the detector did not flag the defect it was built for — it is not a detector');
    assert.ok(blocking.some(f => f.evidence.demand === 'alternating-source'),
        `expected an alternating-source finding, got ${JSON.stringify(blocking.map(f => f.evidence.demand))}`);
    // The evidence must name the measurement, not merely assert a verdict.
    const one = blocking.find(f => f.evidence.demand === 'alternating-source');
    // The distinction that matters is NOT "is the bench static?" — and this
    // number has now moved in both directions, which is the point. Admitting the
    // LED operating point (bw-board 157caed0 — an LED is solved on the diode's
    // junction terms instead of refused by kind) and making vcc a turnable
    // supply (ebf77e9e) took 42-diode-rectifier from ONE distinct DC state to
    // THREE across its control extremes. bw-board 0a3b3bd9 then took the supply
    // back out of getControls — a rail sets the operating point, it is not a
    // stimulus the learner turns — and with no controllable part left on this
    // bench the count returns to ONE.
    //
    // Nothing about the DEFECT moved while that number went 1 -> 3 -> 1, and a
    // "does anything differ?" check would have passed the bench in the middle of
    // that journey. What fails throughout is specifically that no node ever
    // ALTERNATES — swings both ways over time — so a half-wave-rectifier
    // lesson's demand cannot be met on a DC bench however many static states it
    // settles into. The count is asserted exactly so that a change of this kind
    // has to be read and explained rather than absorbed.
    assert.equal(one.evidence.measured.stateCount, 1,
        '42-diode-rectifier settles into one DC state: nothing on it is controllable');
    assert.equal(one.evidence.measured.alternates, false,
        'the defect: no node on this DC bench alternates, so the demand is unmet');
    assert.ok(one.evidence.phrase, 'the finding must quote the prose that triggered it');
});

test('MUTATION: the version-1 capacitor lesson is flagged — a charge-only bench cannot discharge', async () => {
    const report = await detect({lessons: [lessonFixture('electricity-capacitor')]});
    const blocking = report.findings.filter(f => f.severity === 'blocking');
    assert.ok(blocking.some(f => f.evidence.demand === 'discharge'),
        `expected a discharge finding, got ${JSON.stringify(blocking.map(f => f.evidence.demand))}`);
    const one = blocking.find(f => f.evidence.demand === 'discharge');
    // The distinction that matters: the bench DOES vary with time (the cap
    // charges), so a "is anything moving?" check would have passed it. What
    // fails is specifically that no capacitor voltage ever falls.
    assert.equal(one.evidence.measured.timeVarying, true);
    assert.equal(one.evidence.measured.capDischarges, false);
});

test('NEGATIVE CONTROL: both repaired lessons come back clean', async () => {
    const now = Object.fromEntries(loadCatalog().map(l => [l.id, l]));
    const report = await detect({lessons: [now['electricity-diode'], now['electricity-capacitor']]});
    assert.deepEqual(report.findings, [],
        'the repaired lessons must not be flagged — a detector that cannot tell a fix ' +
        'from a defect will be switched off');
});

test('NEGATIVE CONTROL: the hypothetical guard is what separates them', async () => {
    // electricity-diode v2 says "explain what would happen with an alternating
    // source" — correct teaching on a DC bench. Strip the hypothetical marker
    // and the same sentence becomes an instruction the bench cannot satisfy,
    // and the detector must then fire. This pins the guard: if it ever swallows
    // the imperative form too, this test goes red.
    const now = Object.fromEntries(loadCatalog().map(l => [l.id, l]));
    const lesson = structuredClone(now['electricity-diode']);
    const explain = lesson.checkpoints.find(c => c.id === 'explain');
    explain.copy.en.action = 'Compare the load waveform with an alternating source over a full cycle';
    const report = await detect({lessons: [lesson]});
    assert.ok(report.findings.some(f => f.evidence.demand === 'alternating-source'),
        'the guard is swallowing an imperative, not just a hypothetical');
});

// ── The detector's own contract ─────────────────────────────────────────────
test('every observable the catalog uses has a named producer in the app', () => {
    const used = new Set();
    for (const lesson of loadCatalog()) {
        for (const checkpoint of lesson.checkpoints) {
            if (checkpoint.observe) used.add(checkpoint.observe.event);
        }
    }
    for (const event of used) {
        assert.ok(OBSERVABLES[event],
            `the catalog observes "${event}" but the detector knows no producer for it. ` +
            `Either the app grew one — add it to OBSERVABLES — or no lesson can ever see it.`);
    }
});

test('every demand names a bench property the prober actually measures', async () => {
    const {benchCapabilities} = await import('../scripts/bench-capabilities.mjs');
    const sample = await benchCapabilities('pc29-capacitor-discharge');
    const derived = new Set(['hasSourceControl', 'hasButton', 'hasSwitch', 'hasPot', 'hasProgram']);
    for (const demand of DEMANDS) {
        assert.ok(demand.needs in sample || derived.has(demand.needs),
            `demand ${demand.id} needs "${demand.needs}", which nothing measures — ` +
            `it would be permanently undefined, so the demand could never be satisfied`);
    }
});

// ── The false positives the first sweep produced, pinned ────────────────────
//
// The detector's first run over all 79 lessons produced eleven blocking
// findings, seven of which were wrong. Each wrong one named a distinct way the
// prose heuristic can misfire, and each was fixed by narrowing something. Those
// narrowings are the fragile part of this file — a later widening would quietly
// bring the noise back and the report would stop being read — so each is
// pinned by the case that produced it.
const findingsFor = async (id, checkpoint) => {
    const lesson = loadCatalog().find(l => l.id === id);
    assert.ok(lesson, `${id} is gone; this regression case needs rewriting`);
    const report = await detect({lessons: [lesson]});
    return report.findings.filter(f => f.checkpoint === checkpoint);
};

test('not a defect: the lesson panel\'s own "manual button" is not a bench affordance', async () => {
    // starter-lego-extension: "if no hub is available, use the manual button"
    assert.deepEqual(await findingsFor('starter-lego-extension', 'connect'), []);
});

test('not a defect: "while it runs" is about the motor, not about a program', async () => {
    // electricity-motor-flyback v2: "verify that the diode is reverse-biased
    // while it runs" on a circuit-only lesson.
    assert.deepEqual(await findingsFor('electricity-motor-flyback', 'trace'), []);
});

test('not a defect: a real-hardware safety rule is not an observation of this bench', async () => {
    // measurement-resistance: "Do this only with power removed and stored
    // energy discharged" — 22-series-parallel has no capacitor at all.
    assert.deepEqual(await findingsFor('measurement-resistance', 'explain'), []);
});

test('not a defect: a controller faceplate\'s buttons count as buttons', async () => {
    // retro-console and mb05-faceplate-matrix are program-only with no circuit,
    // but ship a controller.json carrying dpad and button widgets.
    assert.deepEqual(await findingsFor('interactive-input-controls', 'predict'), []);
    assert.deepEqual(await findingsFor('interactive-two-way-binding', 'predict'), []);
});

test('MUTATION: a decimal point must not end a sentence', async () => {
    // The third real defect this detector found: signals-rc-response v1 asked
    // the learner to "Calculate voltage at 0, 0.5T, 1T, 2T, and 3T for charging
    // and discharging" on 43-rc-timing, which has no discharge path at all.
    //
    // It is pinned here because it went MISSING once. Splitting sentences on a
    // bare "." cut the fragment at the decimal point in "0.5T", the observation
    // verb "Calculate" fell outside it, and the finding quietly vanished
    // between two runs of the sweep. Only adjudicating a disappearance caught
    // it. The fixture is the pre-repair text, reconstructed on the repaired
    // lesson so it survives the lesson moving between wave files.
    const lesson = structuredClone(loadCatalog().find(l => l.id === 'signals-rc-response'));
    const predict = lesson.checkpoints.find(c => c.id === 'predict');
    predict.copy.en.action = 'Calculate voltage at 0, 0.5\u03c4, 1\u03c4, 2\u03c4, and 3\u03c4 for charging and discharging.';
    predict.copy.en.hint = 'State initial value, final value, R and C before substituting.';
    // The real 43-rc-timing GREW a discharge switch on 2026-08-25, so the
    // original specimen no longer reproduces on the shipped bench. The
    // property this pins is the DETECTOR's, not the corpus's: inject the
    // pre-switch bench capabilities so the sentence-split regression stays
    // caught even with a healthy corpus.
    const noDischarge = new Map([[lesson.exampleId, {
        partial: false, stateCount: 15, controls: [], controlKinds: [],
        timeVarying: true, alternates: false, capDischarges: false,
        ledSwitches: false, hasCapacitor: true, hasInductor: false
    }]]);
    const report = await detect({lessons: [lesson], capabilities: noDischarge});
    assert.ok(report.findings.some(f => f.evidence.demand === 'discharge'),
        'the 43-rc-timing discharge defect must be reported for the v1 text');
    // and the repaired text must not be — on the REAL (now-discharging) bench
    const clean = await detect({lessons: [loadCatalog().find(l => l.id === 'signals-rc-response')]});
    assert.deepEqual(clean.findings, [], 'the repaired v2 text must come back clean');
});

// ── The corpus ratchet ──────────────────────────────────────────────────────
//
// Running the detector over all 79 lessons is the point of building it, so the
// result is a gate rather than a report someone remembers to run. The list below
// is the residue after the 2026-08-23 sweep: every entry is a defect that could
// not be repaired from the lesson side, and every one is written up in
// `docs/LESSON-ACHIEVABILITY-SWEEP.md`.
//
// **Ratchets only shrink.** Fixing one removes it here in the same commit; the
// second assertion below fails if an entry stops reproducing, so a fix cannot
// leave the documentation behind.
// Empty as of 2026-08-24, and that is the whole point of a ratchet.
//
// It held three entries, all one defect found three times: `bw-circuit-changed`
// was dispatched only when the derived pin declarations moved, so no MCU-less
// bench could raise it, and `starter-circuit-path/change`,
// `signals-resonance/sweep` and `machines-contention/repair` were each
// discovered independently by Waves 1, 6 and 7. The CircuitDesigner change the
// entry asked for landed (bw-circuit-ui `a4aa9ec`, an `onCircuitEdit` callback
// fired from a structural signature of the circuit), the detector now checks
// that signature instead, and all three heal.
const KNOWN_UNACHIEVABLE = new Set([]);

test('corpus ratchet: no lesson checkpoint is unachievable except the known three', async () => {
    const report = await detect();
    const blocking = report.findings.filter(f => f.severity === 'blocking')
        .map(f => `${f.lesson}/${f.checkpoint}`);
    const unexpected = blocking.filter(k => !KNOWN_UNACHIEVABLE.has(k));
    assert.deepEqual(unexpected, [],
        `new unachievable checkpoints. Run \`node scripts/detect-lesson-defects.mjs\` ` +
        `for the evidence, fix the lesson or the bench, and only add to ` +
        `KNOWN_UNACHIEVABLE if the fix genuinely belongs elsewhere.`);

    const healed = [...KNOWN_UNACHIEVABLE].filter(k => !blocking.includes(k));
    assert.deepEqual(healed, [],
        `these are on the ratchet but no longer reproduce — delete them from ` +
        `KNOWN_UNACHIEVABLE and update docs/LESSON-ACHIEVABILITY-SWEEP.md in the ` +
        `same commit, so the ratchet keeps shrinking`);

    // Coverage, stated rather than implied: a run that scanned nothing would
    // satisfy both assertions above.
    assert.equal(report.lessons, 87, 'the sweep must cover the whole catalog, including the eight CP1 lessons');
    assert.ok(report.checkpoints >= 180, `only ${report.checkpoints} checkpoints scanned`);
});
