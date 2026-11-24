/**
 * Tier 3 detector — can a lesson checkpoint's observation ever happen?
 *
 * `docs/VERIFICATION-AUTOMATION.md`: reading the corpus one lesson at a time is
 * the wrong shape. Two defects were found by reading seven lessons; there are
 * seventy-nine. Both defects were instances of one class — **the checkpoint asks
 * the learner to observe something the bench it names cannot produce** — and a
 * class is cheap to detect once it is named.
 *
 * The two known instances are this detector's fixture, and
 * `test/lesson-defect-detector.test.mjs` re-runs it against their version-1
 * forms on every test run. If it stops flagging them it is not a detector.
 *
 *   electricity-diode v1     -> 42-diode-rectifier   "Compare input and output
 *                               traces over a full cycle" on a bench with no
 *                               control and no time variation at all.
 *   electricity-capacitor v1 -> 29-capacitor-charge   "Observe voltage and
 *                               current during charge and discharge" on a bench
 *                               whose capacitor voltage never falls.
 *
 * Three checks, reported separately because their confidence is different:
 *
 *   A  OBSERVABLE REACHABILITY — structural, no prose, no judgement. Can the
 *      DOM event a checkpoint listens for ever fire, given what the lesson
 *      loads and what the app dispatches? Zero false positives by construction.
 *
 *   B  DEMAND vs MEASURED CAPABILITY — the prose asks for an action or an
 *      observation; `scripts/bench-capabilities.mjs` says, by solving the
 *      circuit, whether the bench can supply it. Prose matching is a heuristic,
 *      so every finding carries the phrase that triggered it and the bench's
 *      measured capability set, and is meant to be adjudicated, not obeyed.
 *
 *   C  NUMERIC CONTRACT — a quantity quoted in lesson prose must be reproducible
 *      from the bench: present in the example's EXPECTED.md assert block, in its
 *      circuit as a component value, or in the solved node voltages and branch
 *      currents. Catches "teaches a number the bench does not produce".
 *
 * WHAT THIS CANNOT CHECK, stated because a detector that appears to cover more
 * than it does is worse than none:
 *
 *   - whether the pedagogy is sound, or this example the right vehicle;
 *   - prose quality, and the German copy — check B reads ENGLISH ONLY, so a
 *     German translation that demands something different is invisible here;
 *   - which side to fix when a check fires — lesson, example, or engine;
 *   - anything about a lesson whose observation is legitimately off-bench
 *     ("explain in your own words"), which is why a checkpoint with no
 *     `observe` clause is only ever reported under B and C, never under A.
 */
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {boot, EXAMPLES, circuitPathFor, circuitPathOrNull} from './lesson-bench.mjs';
import {benchCapabilities} from './bench-capabilities.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const GUI = path.join(ROOT, 'overlay/scratch-gui/src/components/gui');

/** The lesson observables the app actually dispatches, and what each needs.
 *  Derived by reading the producers, not from PLAN.md's list — PLAN.md's
 *  vocabulary was written before the producers existed and is not a contract. */
export const OBSERVABLES = {
    // containers/controls.jsx, on the green flag / stop button
    'project-run': {producer: 'containers/controls.jsx', needs: 'program'},
    'project-stop': {producer: 'containers/controls.jsx', needs: 'program'},
    // tw-pseudocode/circuit-tab.jsx handleCircuitReady, detail {parts, wires}
    'circuit-ready': {producer: 'tw-pseudocode/circuit-tab.jsx', needs: 'circuit'},
    // tw-pseudocode/circuit-tab.jsx handleDeclarationChange — fires ONLY when the
    // derived pin declarations change, not when the circuit does
    // `bw-circuit-changed` was dispatched from `handleDeclarationChange`, which
    // fires only when the DERIVED PIN DECLARATIONS move — never on an MCU-less
    // bench. Since 2026-08-24 circuit-tab.jsx dispatches it from
    // `onCircuitEdit`, which CircuitDesigner fires from a STRUCTURAL signature
    // of the circuit, so what has to be true is that an edit moves the
    // signature. That is a weaker and correct requirement: a bench whose parts
    // and wires cannot change at all still fails it.
    'circuit-changed': {producer: 'tw-pseudocode/circuit-tab.jsx', needs: 'circuit-edit'},
    // tw-pseudocode/circuit-tab.jsx handleRunnerChange — needs a debug session.
    // A circuit-only lesson can have one: circuit-tab reads `bwDeviceCore` off a
    // `w65c02` or `z80` part on the board, so a machine bench boots from the ROM
    // in its own circuit with no program.bw at all. Gating on loadMode alone
    // flagged three correct lessons.
    'debug-phase': {producer: 'tw-pseudocode/circuit-tab.jsx', needs: 'debuggable'},
    // components/gui/gui.jsx, on peripheral connect/disconnect
    'hardware-state': {producer: 'components/gui/gui.jsx', needs: 'hardware'},
    // guided-lessons.jsx completes this itself when opened from a starter journey
    'starter-loaded': {producer: 'guided-lessons.jsx (initialEvent)', needs: 'starter'}
};

/**
 * Check B's vocabulary. Each entry: a phrase the learner is told to do or see,
 * and the measured bench property that has to be true for it to be possible.
 *
 * Kept deliberately small. Every entry earned its place by matching prose that
 * exists in the corpus, and each one names a property `bench-capabilities.mjs`
 * MEASURES rather than infers from the part list.
 */
/** An instruction to act on, or look at, this bench. */
const OBSERVE_VERB = /\b(observe|measure|watch|compare|record|see|read|note|plot|sketch|predict|calculate|run|close|open|set|move|press|change|adjust|trace|step|probe|capture|count|verify|check|find|identify|test|try|show|display|use the (scope|meter|multimeter)|turn)\b/i;

export const DEMANDS = [
    {
        id: 'alternating-source',
        // the electricity-diode v1 defect
        pattern: /\b(alternating|a\.?c\.?\s+(source|supply|input)|full cycle|positive and negative (input )?halves?|both halves|half-wave|successive (positive )?peaks)\b/i,
        needs: 'alternates',
        why: 'the prose asks for a signal that swings both ways; no node on this bench oscillates'
    },
    {
        id: 'discharge',
        // the electricity-capacitor v1 defect
        pattern: /\bdischarg(e|es|ed|ing)\b/i,
        needs: 'capDischarges',
        why: 'the prose asks for a discharge; no capacitor voltage on this bench ever falls'
    },
    {
        id: 'reverse-the-source',
        pattern: /\brevers(e|ing) (the )?(source|supply|polarity of the source)\b|\bre-?pol(e|ing)\b/i,
        needs: 'hasSourceControl',
        why: 'the prose asks the learner to reverse the source; the bench has no adjustable source'
    },
    {
        id: 'press-a-button',
        // "use the manual button" is the lesson panel's own completion control,
        // and "the extension connection control" is the hub pairing UI. Neither
        // is a thing on the bench.
        pattern: /\bpress(es|ing|ed)?\b(?!.*\bgreen flag\b)|(?<!manual )\bbutton\b/i,
        needs: 'hasButton',
        why: 'the prose asks for a button press; the bench has no button'
    },
    {
        id: 'operate-a-switch',
        pattern: /\b(close|open|flip|throw|toggle)s? (the )?\w*\s?switch\b|\bswitch (it )?(on|off)\b/i,
        needs: 'hasSwitch',
        why: 'the prose asks the learner to work a switch; the bench has none'
    },
    {
        id: 'move-a-wiper',
        pattern: /\b(wiper|potentiometer|move the (pot|slider))\b/i,
        needs: 'hasPot',
        why: 'the prose asks for a pot to be moved; the bench has no potentiometer'
    },
    {
        id: 'observe-a-change',
        pattern: /\b(over time|as time (goes|passes)|transient|the curve|charging curve|watch it (rise|fall|settle))\b/i,
        needs: 'timeVarying',
        why: 'the prose asks for something that changes over time; this bench holds one DC operating point'
    },
    {
        id: 'led-changes-state',
        pattern: /\b(the led (lights|turns on|turns off|goes dark|stays dark)|becomes visibly dim)\b/i,
        needs: 'ledSwitches',
        why: 'the prose asks for an LED to change state; no LED on this bench does'
    },
    {
        id: 'run-the-program',
        // NOT "while it runs": "verify the diode is reverse-biased while it runs"
        // is about a motor, and matching it flagged a lesson that is correct.
        pattern: /\b(green flag|run the program|press run|start the program|run the project)\b/i,
        needs: 'hasProgram',
        why: 'the prose asks the learner to run a program; this lesson loads no program'
    }
];

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

/** CPU parts circuit-tab.jsx recognises on the board (`bwDeviceCore`). A bench
 *  carrying one runs, and is debuggable, without any program.bw. */
const MACHINE_CPU_KINDS = new Set(['w65c02', 'z80', 'r6507', 'mos6532']);

/**
 * A bench's affordances are not only its circuit parts. Eleven examples ship a
 * `controller.json` faceplate whose widgets are what the learner presses, and
 * three of those lessons were flagged for "no button" while their panel carried
 * thirty-seven of them. Widget kinds are read from the corpus, not guessed.
 */
const WIDGET_CAPABILITY = {
    button: 'hasButton', dpad: 'hasButton', keypad: 'hasButton', keyboard: 'hasButton',
    slider: 'hasPot', gauge: null, matrix: null, lcd: null, mono_lcd: null,
    oled: null, rgb_light: null, terminal: null
};

const panelCapabilities = exampleId => {
    const file = path.join(EXAMPLES, exampleId, 'controller.json');
    const out = {hasButton: false, hasPot: false, widgets: []};
    if (!existsSync(file)) return out;
    for (const widget of readJson(file).widgets || []) {
        out.widgets.push(widget.type);
        const capability = WIDGET_CAPABILITY[widget.type];
        if (capability) out[capability] = true;
    }
    return out;
};

export function loadCatalog() {
    const waves = ['electricity-1', 'measurement-2', 'languages-3', 'interactive-4',
        'debugging-5', 'signals-6', 'machines-7', 'cp1-8'];
    const lessons = [...readJson(path.join(GUI, 'lessons.json')).lessons];
    for (const wave of waves) {
        lessons.push(...readJson(path.join(GUI, 'lesson-waves', `${wave}.json`)).lessons);
    }
    return lessons;
}

const exampleIndex = () => {
    const raw = readJson(path.join(EXAMPLES, 'index.json'));
    return new Map((Array.isArray(raw) ? raw : raw.examples).map(e => [e.id, e]));
};

/** Examples reachable from the first-run chooser. `starter-loaded` is completed
 *  by guided-lessons.jsx only when the lesson is opened through one of these, so
 *  a lesson whose example is not a journey target can never see it.
 *  A missing file FAILS rather than skipping — a skip is not a pass. */
const starterExamples = () => {
    const file = path.join(GUI, 'starter-journeys.json');
    if (!existsSync(file)) {
        throw new Error(`starter-journeys.json not found at ${file}; the starter-loaded ` +
            `check cannot run, and refuses to skip quietly`);
    }
    const raw = readJson(file);
    const list = Array.isArray(raw) ? raw : (raw.journeys || raw.starters || []);
    return new Set(list.map(j => j.exampleId));
};

/** Sentence containing the match.
 *
 *  Splitting on a bare "." is wrong and was: "Calculate voltage at 0, 0.5T, 1T,
 *  2T, and 3T for charging and discharging" got cut at the decimal point, the
 *  fragment no longer contained "Calculate", and a REAL defect (a discharge
 *  asked of a charge-only bench) stopped being reported. Only a period followed
 *  by whitespace or end-of-string ends a sentence here. */
const sentenceAround = (text, index) => {
    const boundary = /[.!?](\s|$)/g;
    let start = 0;
    let end = text.length;
    let m;
    while ((m = boundary.exec(text)) !== null) {
        if (m.index < index) start = m.index + m[0].length;
        else { end = m.index; break; }
    }
    return text.slice(start, end);
};

/**
 * Prose that DISCUSSES a phenomenon is not prose that asks the learner to
 * observe it. "explain what would happen with an alternating source" is correct
 * teaching on a DC bench; "compare traces over a full cycle" is not. Without
 * this guard the detector flags the repaired electricity-diode v2, which is
 * exactly the false positive that would make it ignorable.
 */
const HYPOTHETICAL = /\b(would|were|imagine|suppose|if you|hypothetical|in a real|on real hardware|do not|never|instead of|rather than|is not|are not|cannot|has no|have no|there is no|without a|lacks)\b|\bno \w+ path\b/i;

/** Does an ordinary circuit edit move the derived declarations? Measured. */
async function circuitEditIsVisible(exampleId) {
    const {Circuit} = await boot();
    const cui = path.join(ROOT, 'node_modules/bw-circuit-ui/src');
    // The SAME function CircuitDesigner compares against, not a re-derivation:
    // a second copy of the rule would be free to disagree with the one that
    // decides whether the host is notified.
    const {circuitSignature} = await import(path.join(cui, 'model/circuit-signature.js'));
    const raw = readJson(path.join(EXAMPLES, circuitPathFor(exampleId)));
    const decl = data => {
        const c = Circuit.fromJSON(data);
        return circuitSignature(c.parts, c.wires);
    };
    const base = decl(structuredClone(raw));
    const edits = [];
    const resistor = raw.parts.find(p => p.kind === 'resistor');
    if (resistor) {
        const d = structuredClone(raw);
        d.parts.find(p => p.id === resistor.id).params.ohms *= 2;
        edits.push(['double a resistor', d]);
    }
    if ((raw.wires || []).length) {
        const d = structuredClone(raw);
        d.wires = d.wires.slice(0, -1);
        edits.push(['remove one wire', d]);
    }
    const moved = edits.filter(([, d]) => decl(d) !== base).map(([label]) => label);
    return {base, tried: edits.map(([l]) => l), moved};
}

/**
 * Run all three checks over the whole catalog.
 *
 * @param {{lessons?: object[], only?: Set<string>}} [opts]
 */
export async function detect(opts = {}) {
    const lessons = opts.lessons || loadCatalog();
    const index = exampleIndex();
    const starters = starterExamples();
    const findings = [];
    const capCache = new Map();
    let checkpoints = 0;

    for (const lesson of lessons) {
        if (opts.only && !opts.only.has(lesson.id)) continue;
        const entry = index.get(lesson.exampleId);
        const loadsProgram = lesson.loadMode !== 'circuit-only';
        const loadsCircuit = lesson.loadMode !== 'program-only';
        const add = (checkpoint, check, severity, message, evidence) => findings.push({
            lesson: lesson.id, version: lesson.version, example: lesson.exampleId,
            checkpoint: checkpoint ? checkpoint.id : '(lesson)',
            check, severity, message, evidence
        });

        if (!entry) {
            add(null, 'A', 'blocking', `names ${lesson.exampleId}, which is not in examples/index.json`, {});
            continue;
        }

        // The bench's measured capabilities — solved once per example.
        // opts.capabilities injects an override (tests: a mutated bench —
        // the discharge mutation lost its real-world specimen the day
        // 43-rc-timing grew its switch, and the property must outlive the
        // corpus happening to contain a broken bench).
        let cap = (opts.capabilities && opts.capabilities.get(lesson.exampleId)) ||
            capCache.get(lesson.exampleId);
        if (!cap) {
            // Progress on stderr. Solving sixty-odd benches takes long enough
            // that a silent run is indistinguishable from a hung one — and this
            // line was written once, silently failed to apply, and cost twenty
            // minutes of diagnosing a hang that was not happening.
            const t0 = process.hrtime.bigint();
            if (opts.progress !== false) process.stderr.write(`  solving ${lesson.exampleId}`);
            try {
                cap = await benchCapabilities(lesson.exampleId);
            } catch (error) {
                cap = {error: error.message};
            }
            capCache.set(lesson.exampleId, cap);
            if (opts.progress !== false) {
                const secs = Number(process.hrtime.bigint() - t0) / 1e9;
                process.stderr.write(` ${secs.toFixed(1)}s\n`);
            }
        }
        if (cap.error) {
            add(null, 'A', 'blocking', `its example does not solve: ${cap.error}`, {});
            continue;
        }
        if (cap.noCircuit && loadsCircuit) {
            add(null, 'A', 'blocking',
                `loadMode is ${lesson.loadMode}, but ${lesson.exampleId} ships no circuit file`, {});
        }
        const programFile = entry.files && entry.files.program;
        const programSource = programFile && existsSync(path.join(EXAMPLES, programFile))
            ? readFileSync(path.join(EXAMPLES, programFile), 'utf8') : '';
        const programIsPlaceholder = !/^\s*(WHEN|EVERY|PIN|DEVICE)/mi.test(programSource);
        const panel = panelCapabilities(lesson.exampleId);
        const props = {
            ...cap,
            panelWidgets: panel.widgets,
            hasSourceControl: cap.controlKinds.includes('vsource'),
            hasButton: cap.controlKinds.includes('button') || panel.hasButton,
            hasSwitch: cap.controlKinds.includes('switch'),
            hasPot: cap.controlKinds.includes('potentiometer') || panel.hasPot,
            hasProgram: loadsProgram && !!programFile && !programIsPlaceholder
        };

        for (const checkpoint of lesson.checkpoints) {
            checkpoints++;

            // ── A. Can the observable ever fire? ────────────────────────────
            const observe = checkpoint.observe;
            if (observe) {
                const spec = OBSERVABLES[observe.event];
                if (!spec) {
                    add(checkpoint, 'A', 'blocking',
                        `observes "${observe.event}", which nothing in the app dispatches`,
                        {known: Object.keys(OBSERVABLES)});
                } else {
                    if (spec.needs === 'program' && !loadsProgram) {
                        add(checkpoint, 'A', 'blocking',
                            `observes ${observe.event} but loadMode is ${lesson.loadMode}, so no program is loaded to run`,
                            {producer: spec.producer});
                    }
                    if (spec.needs === 'circuit' && !loadsCircuit) {
                        add(checkpoint, 'A', 'blocking',
                            `observes ${observe.event} but loadMode is ${lesson.loadMode}, so no circuit is loaded`,
                            {producer: spec.producer});
                    }
                    if (spec.needs === 'hardware' && lesson.environment === 'simulation') {
                        add(checkpoint, 'A', 'blocking',
                            `observes ${observe.event}, which only fires on a real peripheral connect, ` +
                            `but the lesson declares environment "simulation"`,
                            {producer: spec.producer});
                    }
                    if (spec.needs === 'debuggable' && !loadsProgram && !cap.partKinds.some(
                        kind => MACHINE_CPU_KINDS.has(kind))) {
                        add(checkpoint, 'A', 'review',
                            `observes ${observe.event}, which needs a debug session, but loadMode is ${lesson.loadMode}`,
                            {producer: spec.producer});
                    }
                    if (spec.needs === 'starter' && !starters.has(lesson.exampleId)) {
                        add(checkpoint, 'A', 'review',
                            `observes starter-loaded, but ${lesson.exampleId} is not a starter-journey target`,
                            {journeyExamples: [...starters]});
                    }
                    if (spec.needs === 'circuit-edit' && circuitPathOrNull(lesson.exampleId)) {
                        const moved = await circuitEditIsVisible(lesson.exampleId);
                        if (!moved.moved.length) {
                            add(checkpoint, 'A', 'blocking',
                                `observes circuit-changed, and no edit this scanner can make to ` +
                                `the bench moves its circuit signature`,
                                {signature: moved.base, tried: moved.tried});
                        }
                    }
                    if (observe.match && observe.match.minimumParts != null) {
                        const file = circuitPathOrNull(lesson.exampleId);
                        const parts = file ? readJson(path.join(EXAMPLES, file)).parts.length : 0;
                        if (parts < observe.match.minimumParts) {
                            add(checkpoint, 'A', 'blocking',
                                `requires minimumParts ${observe.match.minimumParts}, the bench has ${parts}`, {parts});
                        }
                    }
                }
            }

            // ── B. Does the bench supply what the prose asks for? ───────────
            const copy = checkpoint.copy.en;
            const imperative = `${copy.action} ${copy.hint}`;
            const background = copy.explain || '';
            for (const demand of DEMANDS) {
                const inImperative = demand.pattern.exec(imperative);
                const inBackground = demand.pattern.exec(background);
                if (!inImperative && !inBackground) continue;
                if (props[demand.needs]) continue;
                const hit = inImperative || inBackground;
                const source = inImperative ? imperative : background;
                const sentence = sentenceAround(source, hit.index);
                if (HYPOTHETICAL.test(sentence)) continue;
                // The prose has to ask the learner to DO or SEE the thing on
                // this bench. "Do this only with power removed and stored energy
                // discharged" is a safety rule about real hardware, not a
                // discharge to observe here — and matching it flagged two
                // correct lessons. The capacitor fixture keeps firing because
                // its sentence begins "Observe voltage and current during
                // charge and discharge".
                if (demand.wantsObservation !== false && !OBSERVE_VERB.test(sentence)) continue;
                // A truncated bench measurement cannot support a blocking
                // verdict: "not measured" is not "cannot happen".
                const severity = props.partial ? 'review'
                    : (inImperative ? 'blocking' : 'review');
                add(checkpoint, 'B', severity,
                    `${demand.why}`,
                    {
                        demand: demand.id,
                        phrase: hit[0],
                        sentence: sentenceAround(source, hit.index).trim(),
                        where: inImperative ? 'action/hint' : 'explain',
                        measured: {
                            partial: props.partial || false,
                            stateCount: props.stateCount, controls: props.controlKinds,
                            timeVarying: props.timeVarying, alternates: props.alternates,
                            capDischarges: props.capDischarges, ledSwitches: props.ledSwitches
                        }
                    });
            }
        }
    }
    return {lessons: opts.only ? [...opts.only].length : lessons.length, checkpoints, findings};
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    const only = process.argv.length > 2 ? new Set(process.argv.slice(2)) : undefined;
    const report = await detect({only});
    const bySeverity = {blocking: [], review: []};
    for (const f of report.findings) bySeverity[f.severity].push(f);
    for (const severity of ['blocking', 'review']) {
        if (!bySeverity[severity].length) continue;
        console.log(`\n=== ${severity.toUpperCase()} (${bySeverity[severity].length}) ===`);
        for (const f of bySeverity[severity]) {
            console.log(`[${f.check}] ${f.lesson} v${f.version} / ${f.checkpoint}  (${f.example})`);
            console.log(`    ${f.message}`);
            if (f.evidence.phrase) console.log(`    triggered by: "${f.evidence.phrase}" in ${f.evidence.where}`);
            if (f.evidence.measured) console.log(`    bench: ${JSON.stringify(f.evidence.measured)}`);
            if (f.evidence.declarations) console.log(`    declarations: ${f.evidence.declarations} (tried: ${f.evidence.tried.join(', ')})`);
        }
    }
    console.log(`\nscanned ${report.lessons} lessons, ${report.checkpoints} checkpoints — ` +
        `${bySeverity.blocking.length} blocking, ${bySeverity.review.length} to review`);
}
