/**
 * Check C — a number a lesson teaches must be one its bench produces.
 *
 * `docs/VERIFICATION-AUTOMATION.md` Tier 3.2: "Every value a lesson quotes in
 * prose must appear in that example's assert block, or be derivable from it.
 * That is how 'teaches a number the bench does not produce' gets caught across
 * all 79 without reading them."
 *
 * Derivable is taken seriously here: rather than only reading `EXPECTED.md`, the
 * example is SOLVED and the quoted value is looked for among the node voltages,
 * branch currents, component values, LED brightnesses and waveform properties
 * the engine actually reports. `EXPECTED.md`'s assert block is one more source,
 * not the only one — an example can be right while its documentation is thin,
 * and `50-rc-scope` proved the reverse can happen too.
 *
 * SCOPE, because the noise floor decides whether anyone reads the output:
 *
 *   - only quantities with an ELECTRICAL unit are checked (V, mV, A, mA, uA,
 *     ohm/kohm/Mohm, F/uF/nF/pF, H/mH/uH, Hz/kHz, s/ms/us). A lesson saying
 *     "63.2%", "10-bit" or "1023 counts" is making a claim about arithmetic or
 *     about a converter, not about this bench, and is deliberately ignored.
 *   - a number inside a formula the lesson is teaching ("5000 mV / 1023")
 *     is still checked, which is right: if the bench's reference is not 5 V the
 *     formula is wrong for it.
 *   - tolerance is 2% or 1 mV/1 uA, whichever is larger, so a lesson rounding
 *     4.9 mV from 4.888 mV passes.
 *
 * WHAT IT CANNOT CHECK: whether the number is the RIGHT one to teach, whether
 * the surrounding sentence uses it correctly, and anything in the German copy —
 * only the English prose is read.
 */
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {boot, EXAMPLES, circuitPathOrNull} from './lesson-bench.mjs';

const MS = 1_000_000n;

/** Four significant figures. Keeps the measured pools small enough to compare
 *  pairwise, and matches the precision lesson prose is ever written to. */
const round4 = v => (v === 0 ? 0 : Number(v.toPrecision(4)));

/** unit → multiplier into the base unit of its dimension */
const UNITS = {
    v: ['V', 1], mv: ['V', 1e-3], kv: ['V', 1e3],
    a: ['A', 1], ma: ['A', 1e-3], ua: ['A', 1e-6], 'µa': ['A', 1e-6],
    ohm: ['R', 1], ohms: ['R', 1], 'Ω': ['R', 1], kohm: ['R', 1e3], 'kΩ': ['R', 1e3],
    // `mΩ` is MILLIohm and `MΩ` is MEGohm — SI, and the two differ by 1e9.
    // Until 2026-08-29 this table read `'mΩ': 1e6` and had no `MΩ` at all, so a
    // lesson writing "20 mΩ" was checked against 20 MΩ (found: the multimeter's
    // shunt, which is 0.02 Ω) and one writing "10 MΩ" was not checked at all —
    // the regex is case-sensitive, so `MΩ` matched nothing and fell through
    // silently. A unit the checker cannot see is a claim it cannot refuse.
    // The ASCII spellings keep their old meaning: nobody writes milliohms as
    // `mohm`, and `Mohm` lowercases to the same string.
    'mΩ': ['R', 1e-3], 'MΩ': ['R', 1e6], mohm: ['R', 1e6],
    f: ['C', 1], uf: ['C', 1e-6], 'µf': ['C', 1e-6], nf: ['C', 1e-9], pf: ['C', 1e-12],
    h: ['L', 1], mh: ['L', 1e-3], uh: ['L', 1e-6], 'µh': ['L', 1e-6],
    hz: ['F', 1], khz: ['F', 1e3], mhz: ['F', 1e6],
    s: ['T', 1], ms: ['T', 1e-3], us: ['T', 1e-6], 'µs': ['T', 1e-6]
};

// The trailing guard is a negative lookahead, NOT \b: `Ω`, `µ` and friends are
// not word characters, so `Ω\b` requires the NEXT character to be one and
// silently drops every "10 kΩ and ..." in the corpus. Found by testing the
// extractor on a sentence whose answer was known.
// The leading guard keeps identifier suffixes such as the CP1 opcode P2A
// and dotted pin names from reading as standalone measurements.
const NUMBER = /(?<![\p{L}\p{N}_.])(-?\d+(?:[.,]\d+)?)\s*(MΩ|kΩ|mΩ|Ω|µF|µA|µH|µs|mV|kV|mA|uA|kohm|mohm|ohms?|nF|pF|uF|mH|uH|kHz|MHz|Hz|ms|us|V|A|F|H|s)(?![a-zA-Z0-9µ])/gu;

/** Pull every electrical quantity out of a block of prose. */
export function claimsIn(text) {
    const out = [];
    for (const m of text.matchAll(NUMBER)) {
        const key = m[2].toLowerCase();
        const unit = UNITS[key] || UNITS[m[2]];
        if (!unit) continue;
        const digits = m[1].replace(',', '.');
        const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;
        const value = Number(digits) * unit[1];
        // Tolerance follows the PRECISION OF THE QUOTE: "0.07 V" claims the
        // value is nearer 0.07 than 0.06 or 0.08, so half a unit in its last
        // decimal place is the honest window. A flat 2% called a measured
        // 0.0725 V a mismatch for a hint that correctly rounded it.
        const quantum = 0.5 * Math.pow(10, -decimals) * unit[1];
        out.push({raw: m[0], dimension: unit[0], value, quantum, index: m.index});
    }
    return out;
}

/** Everything this bench is measured to produce, by dimension. */
export async function benchQuantities(exampleId, opts = {}) {
    // Same budget discipline as `bench-capabilities.mjs`: one machine bench must
    // not dominate a corpus scan. Truncation is reported, never silent — a
    // shortened pool would turn correct numbers into findings.
    const budgetMs = opts.budgetMs ?? 15_000;
    const started = process.hrtime.bigint();
    const overBudget = () => Number(process.hrtime.bigint() - started) / 1e6 > budgetMs;
    let partial = false;
    const {Circuit} = await boot();
    const rel = circuitPathOrNull(exampleId);
    // A program-only example has no bench to quote numbers from. Report that
    // rather than an empty pool, which would flag every number in the lesson.
    if (!rel) return {noCircuit: true,
        q: {V: new Set(), A: new Set(), R: new Set(), C: new Set(), L: new Set(), F: new Set(), T: new Set()}};
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, rel), 'utf8'));
    const q = {V: new Set(), A: new Set(), R: new Set(), C: new Set(), L: new Set(), F: new Set(), T: new Set()};

    // declared component values — a lesson quoting "10 kOhm" means the part
    for (const part of raw.parts) {
        const p = part.params || {};
        if (typeof p.ohms === 'number') q.R.add(p.ohms);
        if (typeof p.farads === 'number') q.C.add(p.farads);
        if (typeof p.henrys === 'number') q.L.add(p.henrys);
        if (typeof p.volts === 'number') { q.V.add(p.volts); q.V.add(-p.volts); }
        if (typeof p.vf === 'number') q.V.add(p.vf);
        if (typeof p.freq === 'number') { q.F.add(p.freq); q.T.add(1 / p.freq); }
        if (typeof p.amplitude === 'number') { q.V.add(p.amplitude); q.V.add(2 * p.amplitude); }
        if (typeof p.offset === 'number') q.V.add(p.offset);
        if (typeof p.windingR === 'number') q.R.add(p.windingR);
    }
    if (typeof raw.vcc === 'number') q.V.add(raw.vcc);


    // solved values, across every control setting and several times
    const circuit0 = Circuit.fromJSON(structuredClone(raw));
    if (circuit0.netlistError) return {error: circuit0.netlistError, q};
    const controls = circuit0.getControls();
    const settings = [[]];
    // MCU pins are settings too. Half the catalog is `program-and-circuit`, and
    // the numbers those lessons quote — the voltage on a driven output, the
    // level a pull-up holds — only exist once a pin is driven. Without this the
    // pool holds the undriven bench only, and a correct lesson quoting a real
    // measured pin voltage reads as unmatched. (Caught by this check flagging a
    // number written into machines-logic-levels from a driven-pin measurement.)
    const pins = new Set();
    for (const part of raw.parts) {
        for (const pin of part.params?.pins || []) pins.add(pin);
        if (part.kind === 'mcu' || /_mcu$/.test(part.kind)) {
            for (const seatPin of Object.keys(part.seat?.leadMap || {})) pins.add(seatPin);
        }
    }
    // Capped: a full 6502 board exposes dozens of bus pins and driving each of
    // them turns a 0.1 s bench into a minute. Twenty-four covers every
    // single-MCU example in the corpus.
    const pinDrives = [...pins].slice(0, 24);
    for (const c of controls) {
        const declared = raw.parts.find(p => p.id === c.id)?.params?.volts;
        const values = c.kind === 'vsource' ? [declared ?? 5, -(declared ?? 5)] : [0, 1];
        for (const v of values) settings.push([[c.id, v]]);
    }
    if (controls.length > 1) settings.push(controls.map(c => [c.id, 1]));

    for (const setting of [...settings, ...(pinDrives.length ? ['pins-low', 'pins-high'] : [])]) {
        const circuit = Circuit.fromJSON(structuredClone(raw));
        if (circuit.netlistError) continue;
        if (typeof setting === 'string') {
            const high = setting === 'pins-high';
            for (const pin of pinDrives) {
                try { circuit.setPin(pin, 'pushpull', high); } catch { /* not a drivable pin */ }
            }
        } else {
            for (const [id, value] of setting) circuit.setControl(id, value);
        }
        const board = circuit.board;
        let t = 0n;
        for (const ms of [1, 10, 50, 250, 1000, 4000]) {
            if (overBudget()) { partial = true; break; }
            board.advanceTo(t = BigInt(ms) * MS);
            for (const net of board.nets) {
                const v = board.nodeVoltage(net.id);
                if (Number.isFinite(v)) q.V.add(round4(v));
            }
            for (const part of board.parts) {
                for (const terminal of part.terminals || []) {
                    let i;
                    try { i = board.branchCurrent(part.id, terminal); } catch { continue; }
                    if (Number.isFinite(i)) q.A.add(round4(Math.abs(i)));
                }
            }
        }
    }

    // Ohmmeter readings are bench outputs too, and Wave 2 quotes them. They only
    // exist with the power OFF (board.resistance refuses otherwise, deliberately),
    // and they are NOT the declared component values: on 22-series-parallel an
    // LED reads ~2 kohm under the 1 mA test current and the whole network reads
    // 2192 ohm, neither of which appears in any params block. Without this the
    // check flags a correct hint quoting a real measurement. Bounded to the
    // first 12 nets — each reading is a full MNA solve.
    if (!overBudget()) {
        const probe = Circuit.fromJSON(structuredClone(raw));
        if (!probe.netlistError) {
            probe.board.advanceTo(50n * MS);
            probe.board.setPower(false);
            probe.board.advanceTo(60n * MS);
            const nets = probe.board.nets.slice(0, 12).map(n => n.id);
            for (let i = 0; i < nets.length && !overBudget(); i++) {
                for (let j = i + 1; j < nets.length; j++) {
                    // BOTH orders. board.resistance(a, b) is not symmetric: it
                    // makes `b` the solver reference, which disables the
                    // gnd-symbol merge, so the two directions can differ by
                    // orders of magnitude. Probing one way only left the whole
                    // 22-series-parallel network (2191.6 ohm hot-to-gnd) out of
                    // the pool and flagged a correct lesson hint.
                    for (const [x, y] of [[nets[i], nets[j]], [nets[j], nets[i]]]) {
                        let r;
                        try { r = probe.board.resistance(x, y); } catch { continue; }
                        if (typeof r === 'number' && Number.isFinite(r) && r > 0) q.R.add(round4(r));
                    }
                }
            }
        }
    }

    // Voltage DIFFERENCES are what a two-probe meter reads, and what most lesson
    // prose quotes ("2.3 V across the resistor"). Done ONCE, at the end, over a
    // rounded and capped base list: folding differences back into the same set
    // inside the loop is self-feeding and blew past Set's maximum size on the
    // first bench with more than a few nets.
    const base = [...new Set([...q.V].map(round4))].slice(0, 400);
    for (let i = 0; i < base.length; i++) {
        for (let j = i + 1; j < base.length; j++) q.V.add(round4(Math.abs(base[i] - base[j])));
    }
    // RC / RL time constants the bench can exhibit, and the same pairs read as a
    // corner frequency. A filter lesson quotes the corner, not the time constant:
    // 10 kOhm with 100 nF is 1.0 ms and 159.155 Hz, and only the first of those was
    // ever derived, so a correct Bode lesson read as unmatched with an EMPTY nearest
    // list -- the tell that the pool lacked the dimension rather than disagreeing
    // about a value in it. q.F otherwise holds only a source's declared `freq`.
    for (const r of q.R) {
        for (const c of q.C) {
            q.T.add(r * c);
            if (r > 0 && c > 0) q.F.add(1 / (2 * Math.PI * r * c));
        }
        for (const l of q.L) {
            q.T.add(l / r);
            if (r > 0 && l > 0) q.F.add(r / (2 * Math.PI * l));
        }
    }
    // A Bode lesson states its sweep as a decade either side of the corner
    // ("sweep about 15.9 Hz to 1592 Hz" for a 159.155 Hz corner). Those endpoints
    // are derived from the bench by a fixed convention, so they belong in the pool
    // -- but ONLY the two adjacent decades, never an open ladder: a span the author
    // picked freely (25 Hz) still reads as unmatched, which is what keeps this
    // check discriminating rather than merely green.
    for (const f of [...q.F]) {
        if (f > 0) { q.F.add(f / 10); q.F.add(f * 10); }
    }
    for (const key of Object.keys(q)) q[key] = new Set([...q[key]].map(round4));
    return {q, partial};
}

/** Values written in the example's machine-readable assert block. */
export function assertBlockQuantities(exampleId) {
    const dir = path.join(EXAMPLES, exampleId);
    const file = path.join(dir, 'EXPECTED.md');
    const out = {V: new Set(), A: new Set(), R: new Set(), C: new Set(), L: new Set(), F: new Set(), T: new Set()};
    if (!existsSync(file)) return out;
    const text = readFileSync(file, 'utf8');
    const block = /```assert\n([\s\S]*?)```/.exec(text);
    if (!block) return out;
    for (const line of block[1].split('\n')) {
        let m = /^\s*net\s+\S+\s+V\s+(-?[\d.]+)/.exec(line);
        if (m) { out.V.add(Number(m[1])); continue; }
        m = /^\s*current\s+\S+\s+mA\s+(-?[\d.]+)/.exec(line);
        if (m) { out.A.add(Number(m[1]) * 1e-3); continue; }
    }
    return out;
}

/** Absolute floor per dimension. A 2%-only rule can never match a quoted zero
 *  ("set the source to 0 V"), and 2% of a microamp is not a real distinction. */
const FLOOR = {V: 1e-3, A: 1e-6, R: 0.5, C: 1e-12, L: 1e-9, F: 0.5, T: 1e-6};

const matches = (value, dimension, pool, quantum = 0) => {
    const tol = Math.max(Math.abs(value) * 0.02, FLOOR[dimension] ?? 0, quantum);
    for (const candidate of pool) {
        // `!== null`, not truthiness: a matched candidate of 0 is a match, and
        // returning it bare made every quoted "0 V" read as unmatched.
        if (Math.abs(candidate - value) <= Math.max(tol, Math.abs(candidate) * 0.02)) return {candidate};
    }
    return null;
};

/**
 * Numbers that describe the INSTRUMENT rather than the bench: a timebase window
 * to try, a display refresh interval, an ADC's volts-per-count. They are not
 * claims about what this circuit produces, and checking them against the
 * circuit's own quantities produces noise, not findings.
 */
// `of simulation` / `simulated time` are deliberately narrow: a sweep point's COST
// is a fact about the run budget, not about the circuit. Bare `simulat` would match
// 92 places catalog-wide and blunt the check wherever a lesson merely says a real
// measured value was taken in simulation; these two phrases match four sentences.
// `input impedance` joined the list on 2026-08-29 with D21: a placed meter's
// 10 MOhm is a property of the INSTRUMENT, exactly like the ADC's volts-per-count
// already on this list, and it is the number `signals-loading` exists to teach.
// It is deliberately the two-word phrase and not bare `impedance`, which would
// exempt every sentence in `signals-complex-impedance`.
const INSTRUMENT_CONTEXT = /\b(timebase|window|per div|v\/div|refresh|display|adc|counts?|resolution|sample|per count|bit|fit in|fits in|of simulation|simulated time|input impedance)\b/i;

/**
 * Check one lesson's quoted numbers against its bench.
 *
 * @param {object} lesson
 * @returns {Promise<Array>} unmatched claims
 */
export async function checkLesson(lesson) {
    // Counted and returned, because "0 unmatched" is only meaningful next to
    // "out of N examined": a scanner that extracted nothing reports the same
    // clean result as one that checked everything and found nothing wrong.
    const examined = [];
    const bench = await benchQuantities(lesson.exampleId);
    if (bench.error) return {unmatched: [{lesson: lesson.id, error: bench.error}], examined: [], skipped: 'error'};
    // Nothing to check a number against; and a truncated pool cannot support
    // "the bench does not produce this". Both are reported as SKIPPED with a
    // reason rather than as a clean pass — a skip is not a pass.
    if (bench.noCircuit) return {unmatched: [], examined: [], skipped: 'no-circuit'};
    if (bench.partial) return {unmatched: [], examined: [], skipped: 'measurement-truncated'};
    const asserted = assertBlockQuantities(lesson.exampleId);
    const unmatched = [];
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
    const scan = (where, text) => {
        for (const claim of claimsIn(text)) {
            examined.push(claim.raw);
            const pool = new Set([...bench.q[claim.dimension], ...asserted[claim.dimension]]);
            if (matches(claim.value, claim.dimension, pool, claim.quantum) !== null) continue;
            if (INSTRUMENT_CONTEXT.test(sentenceAround(text, claim.index))) continue;
            unmatched.push({
                lesson: lesson.id, version: lesson.version, example: lesson.exampleId,
                where, quoted: claim.raw, dimension: claim.dimension, value: claim.value,
                nearest: [...pool].sort((a, b) =>
                    Math.abs(a - claim.value) - Math.abs(b - claim.value)).slice(0, 3)
            });
        }
    };
    scan('objective', lesson.copy.en.objective);
    for (const checkpoint of lesson.checkpoints) {
        for (const key of ['action', 'explain', 'hint']) {
            scan(`${checkpoint.id}.${key}`, checkpoint.copy.en[key] || '');
        }
    }
    return {unmatched, examined, skipped: null};
}
