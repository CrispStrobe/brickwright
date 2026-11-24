import {packageSourceRoot} from './helpers/package-source.mjs';
/**
 * Wave 7 — "Computers from wires upward" — claims gate.
 *
 * Wave 7's benches are whole computers, so this gate drives the surfaces the
 * app drives: `scripts/lesson-bench.mjs` for the analogue benches (the same
 * `bw-circuit-ui` over `bw-board` the browser runs), `extract6502Machine` /
 * `extractZ80Machine` for the bus extract behind the designer's "Build
 * Machine" button, `m6502-debug` for what the debugger can report, and lite's
 * own trace referee for the two MCU programs.
 *
 * A NOTE ON ONE NEAR-MISS, because it shaped this gate: reading
 * `DebugStatus.jsx` alone says the machine debugger shows a halt flag, a step
 * button and a millisecond counter, and three lessons would then be asking for
 * registers and memory that do not exist. They do exist —
 * `ArchitectureFace.jsx` renders A/X/Y/SP/PC, the P flags, the address and data
 * buses, IR, the live disassembly at PC and the cycle count, and
 * `debug-drawer.jsx` renders a paged memory view and the stack. Wave 1 recorded
 * the same trap with the scope and the flyback spike: check the instrument the
 * learner would actually use before calling a lesson impossible.
 *
 * Tests named OPEN DEFECT assert a defect STILL REPRODUCES; each names the
 * lesson hint to soften and this document to update when it is fixed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {boot, load, terminalVolts, EXAMPLES, fmt} from '../scripts/lesson-bench.mjs';
import {SOURCE} from './helpers/bw-integrated.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const GUI = path.join(REPO, 'overlay/scratch-gui/src');
const CUI = packageSourceRoot('bw-circuit-ui');
const BWB = packageSourceRoot('bw-board');
const WAVE = JSON.parse(readFileSync(
    path.join(GUI, 'components/gui/lesson-waves/machines-7.json'), 'utf8'));

const MS = 1000n * 1000n;
const lesson = id => {
    const found = WAVE.lessons.find(l => l.id === id);
    assert.ok(found, `${id} is no longer in machines-7.json`);
    return found;
};
const checkpoint = (id, cp) => {
    const found = lesson(id).checkpoints.find(c => c.id === cp);
    assert.ok(found, `${id} has no "${cp}" checkpoint`);
    return found;
};
const circuitOf = id => JSON.parse(readFileSync(path.join(EXAMPLES, id, 'circuit.json'), 'utf8'));
const near = (actual, expected, tol, what) =>
    assert.ok(Math.abs(actual - expected) <= tol,
        `${what}: measured ${fmt(actual)}, expected ${expected} ± ${tol}`);

await boot();
const {extract6502Machine} = await import(path.join(BWB, 'm6502-extract.js'));
const {extractZ80Machine} = await import(path.join(BWB, 'z80-extract.js'));
const {createM6502Adapter} = await import(path.join(BWB, 'm6502-adapter.js'));
const {createM6502DebugTarget} = await import(path.join(BWB, 'm6502-debug.js'));
const SB3Creator = (await import(path.join(SOURCE, 'src/lib/sb3-creator.js'))).default;
const {interpretTrace} = await import(path.join(SOURCE, 'src/lib/trace-oracle.js'));

test('instrument: Wave 7 still has the ten lessons this gate measures', () => {
    assert.equal(WAVE.wave, 'machines-7');
    assert.deepEqual(WAVE.lessons.map(l => l.id).sort(), [
        'machines-6502-execution', 'machines-address-decode', 'machines-buses',
        'machines-clocks', 'machines-contention', 'machines-gates-registers',
        'machines-interrupts-performance', 'machines-logic-levels',
        'machines-memory-maps', 'machines-source-asm'
    ]);
    assert.equal(WAVE.lessons.reduce((n, l) => n + l.checkpoints.length, 0), 20);
});

// ── machines-logic-levels / 06-active-low-high ─────────────────────────────

// Was an OPEN DEFECT: "the active-high level the lesson quotes depends on the
// port mode." The mode dependence is real and PERMANENT — the STC12's default
// quasi-bidirectional pin drives high through a weak pull-up that cannot source
// an LED, so a driven-high P1.1 reads ~2.1 V and its active-high LED stays dark,
// where a push-pull pin reaches ~4.9 V and lights it. That is not a bug to fix;
// it is 8051 hardware. The defect was that the LESSON quoted one mode's level as
// if it were the level. It no longer does: the `measure` hint quotes both modes
// and makes the dependence the point ("different electrical level: that is the
// whole lesson"), and the example's intro/EXPECTED both call the active-high LED
// faint on this bench and disclaim a generic push-pull claim. So this ADJUDICATES
// rather than waits: it pins the electrical reality AND that the lesson teaches
// it. Falsified — re-measure Wave 7 — if a quasi pin ever sources an LED (a model
// change) or the lesson stops disclosing the mode dependence.
test('ADJUDICATED (was OPEN DEFECT): the active-high level depends on port mode, and the lesson teaches that', async () => {
    assert.equal(lesson('machines-logic-levels').exampleId, '06-active-low-high');
    // The bench: an active-low LED from the rail through P1.0, an active-high
    // LED from P1.1 to ground.
    const read = async mode => {
        const {board} = await load('06-active-low-high');
        board.setPin('P1.0', mode, false);
        board.setPin('P1.1', mode, true);
        board.advanceTo(50n * MS);
        const v = terminalVolts(board);
        return {
            low: v['mcu1.P1.0'], high: v['mcu1.P1.1'],
            lowLed: board.ledBrightness('led_low'), highLed: board.ledBrightness('led_high')
        };
    };
    // RE-DERIVED 2026-11-24 for bw-board 74d42338 (exponential LEDs by
    // default): an LED on a pin conducts more at a given drive than the
    // piecewise knee let it, so the push-pull pin carries a little more current
    // (brightness 0.1546 -> 0.1587, its drop across the pin 0.0773 -> 0.0794 V),
    // and the quasi pin's weak pull-up is pulled lower by the LED it cannot
    // source (1.9284 -> 1.7251 V). Tolerances unchanged; the mode dependence —
    // the thing this test adjudicates — is unchanged and slightly larger.
    const pushpull = await read('pushpull');
    near(pushpull.low, 0.0794, 5e-4, 'P1.0 driven low, push-pull');
    near(pushpull.high, 4.9206, 5e-4, 'P1.1 driven high, push-pull');
    near(pushpull.lowLed, 0.1587, 5e-4, 'the active-low LED');
    near(pushpull.highLed, 0.1587, 5e-4, 'the active-high LED, push-pull');

    // The 8051's default port mode is quasi-bidirectional: a weak pull-up that
    // cannot source an LED. Same pin, same "high", 2.8 V lower.
    const quasi = await read('quasi');
    near(quasi.low, 0.0794, 5e-4, 'P1.0 driven low is the same in either mode');
    near(quasi.high, 1.7251, 5e-4, 'P1.1 driven high, quasi-bidirectional');
    near(quasi.highLed, 0.0076, 5e-4, 'and the active-high LED is essentially dark');
    assert.ok(quasi.highLed < pushpull.highLed / 20,
        'a quasi pin now sources the active-high LED as well as push-pull — the hardware ' +
        'premise of this lesson changed, re-measure Wave 7');

    // The adjudication's other half: the lesson must TEACH the dependence, not
    // quote one mode's level as if it were the level. Pin the disclosure so a
    // revert to a single-mode number fires here.
    const hint = checkpoint('machines-logic-levels', 'measure').copy.en.hint;
    assert.match(hint, /push-pull/i, 'the measure hint must name the push-pull level it quotes');
    assert.match(hint, /quasi-bidirectional/i, 'and the default quasi-bidirectional mode');
    assert.match(hint, /cannot source|weak pull-up|essentially dark/i,
        'and say the default mode cannot source the active-high LED — the whole point of the lesson');
});

// ── machines-gates-registers / 20-shift-register-binary ────────────────────

test('machines-gates-registers: all four signals move, and the bitop dialect is one form now', () => {
    // Was an OPEN DEFECT: over 3 s of program time the example produced 208
    // clock edges, 26 latch edges and ZERO data edges, so every byte shifted in
    // was 0x00 and all eight LEDs stayed dark — while its lesson asks the
    // learner to correlate all four signals.
    //
    // Fixed upstream 2026-08-24 by rewriting the bit test from the PREFIX form
    // to the INFIX one: `IF (val bitand 128) > 0` where it was
    // `IF bitand val 128 > 0`. The example is repaired and the lesson is
    // version 3. The COMPILER defect underneath it is not, and the second half
    // of this test pins what it actually is — which is not what Wave 7
    // concluded.
    assert.equal(lesson('machines-gates-registers').exampleId, '20-shift-register-binary');
    const creator = new SB3Creator();
    creator.parse(readFileSync(path.join(EXAMPLES, '20-shift-register-binary/program.bw'), 'utf8'));
    const trace = interpretTrace(creator.project,
        {horizonMs: 3000, stimulus: [], adc: {bits: 10, vref: 5}, maxSteps: 4_000_000});
    assert.deepEqual([...new Set(trace.unsupported)], [],
        'the referee now refuses an opcode here — this measurement is no longer comparable');
    const byPin = {};
    for (const e of trace.events) byPin[e.pin] = (byPin[e.pin] || 0) + 1;
    assert.ok(byPin.clock > 100, `the clock line runs: ${byPin.clock} edges`);
    assert.ok(byPin.latch > 10, `the latch line runs: ${byPin.latch} edges`);
    assert.ok(byPin.data > 10,
        `the data line must move, or the register is fed a constant zero again: ${byPin.data} edges`);

    // D26's shape changed on 2026-08-29, and the change is what the two halves
    // of this assertion block record. Wave 7 read it as "a bitops reporter
    // compared against a number"; the first re-measurement read it as two forms
    // with COMPLEMENTARY holes (prefix worked bare and failed compared, infix
    // the other way round). Both readings were downstream of a defect neither
    // saw: the referee's own truth test was INVERTED — `num("true")` is 0 — so a
    // bare value in condition position was answered four different ways by four
    // backends and the disagreement was invisible. sb3-creator `32b1e1a`
    // promoted one `boolishTruthTest` to all of them and REFUSED the prefix
    // spelling by name rather than evaluating it to something.
    //
    // Measured here against the vendored compiler and referee:
    //
    //   bitand val 128 > 0      prefix, compared   refused, with the naming warning
    //   (bitand val 128) > 0    prefix, compared   refused, with the naming warning
    //   bitand val 128          prefix, bare       refused, with the naming warning
    //   val bitand 128 > 0      infix,  compared   fires
    //   (val bitand 128) > 0    infix,  compared   fires     <- the shipped form
    //   (val bitand 128)        infix,  bare       fires     <- was the second hole
    //   not (val bitand 128)    infix, negated     correctly does NOT fire (128 is truthy)
    //   not (val bitand 1)      infix, negated     fires (0 is falsy)
    //
    // There is one dialect now, and the prefix spelling is a diagnosed typo
    // rather than a silent zero. What is still open lives upstream and is a
    // different shape: `not <cond>` in VALUE position is a phantom variable, and
    // `cToPseudocode` emits that shape — pinned as an OPEN DEFECT test in
    // sb3-creator, because it needs a dialect decision and not a patch.
    const probe = cond => {
        const c = new SB3Creator();
        c.parse(['DEVICE STC12C5A60S2', 'CLOCK 11059200', 'PIN data = P1.0 OUTPUT', '',
            'WHEN flag clicked:', '  set val to 128', `  IF ${cond} THEN:`,
            '    turn on data', '  ELSE:', '    turn off data', '  wait 0.2 seconds'].join('\n'));
        return {
            events: interpretTrace(c.project,
                {horizonMs: 400, stimulus: [], adc: {bits: 10, vref: 5}, maxSteps: 400_000}).events,
            warnings: c.warnings || [],
        };
    };
    const fires = cond => probe(cond).events.length > 0;
    // The prefix spelling is refused, and the refusal SAYS what to write instead.
    for (const cond of ['bitand val 128 > 0', '(bitand val 128) > 0', 'bitand val 128']) {
        const r = probe(cond);
        assert.equal(r.events.length, 0,
            `the prefix form ${cond} now evaluates — the dialect gained a second spelling, ` +
            'update docs/LESSON-REVIEW-WAVE-7.md and docs/WAVE-OPEN-DEFECTS.md D26');
        const text = r.warnings.map(w => (typeof w === 'string' ? w : w.message || '')).join(' ');
        assert.match(text, /reads as a VARIABLE NAME/,
            `${cond} is silently false again instead of diagnosed — that silence WAS the defect`);
        assert.match(text, /infix in this dialect/, `${cond}: the warning must name the fix`);
    }
    // The infix form works in all three positions now — bare included, which was
    // the second of the two holes.
    assert.equal(fires('val bitand 128 > 0'), true, 'infix, compared');
    assert.equal(fires('(val bitand 128) > 0'), true,
        'the INFIX form the example ships must work, or the example regresses');
    assert.equal(fires('(val bitand 128)'), true,
        'infix bare — this was the second hole and it is closed');
    // And negation in CONDITION position is right in both directions, which is
    // what distinguishes the remaining open half (value position) from this one.
    assert.equal(fires('not (val bitand 128)'), false, '128 bitand 128 is truthy, so `not` is false');
    assert.equal(fires('not (val bitand 1)'), true, '128 bitand 1 is 0, so `not` is true');
});

// ── machines-clocks / ttl-clock-module ─────────────────────────────────────

test('machines-clocks: the oscillator itself is measurable and tunable', async () => {
    assert.equal(lesson('machines-clocks').exampleId, 'ttl-clock-module');
    const measure = async pos => {
        const {board} = await load('ttl-clock-module');
        board.setControl('pot1', pos);
        const net = board.nets.find(n =>
            n.terminals.some(t => t.part === 'u1' && t.terminal === 'output')).id;
        let t = 0n;
        let prev = null;
        const edges = [];
        for (let i = 0; i < 3000 && edges.length < 9; i++) {
            t += 200n * 1000n;               // 200 us
            board.advanceTo(t);
            const hi = board.nodeVoltage(net) > 2.5;
            if (prev !== null && hi !== prev) edges.push({t: Number(t) / 1e6, rise: hi});
            prev = hi;
        }
        assert.ok(edges.length >= 6, `only ${edges.length} edges at pot ${pos}`);
        const periods = [];
        for (let i = 2; i < edges.length; i++) {
            if (edges[i].rise === edges[i - 2].rise) periods.push(edges[i].t - edges[i - 2].t);
        }
        const period = periods.reduce((a, b) => a + b, 0) / periods.length;
        const firstRise = edges.find(e => e.rise);
        const nextFall = edges.find(e => !e.rise && e.t > firstRise.t);
        return {period, high: nextFall.t - firstRise.t};
    };
    const slow = await measure(0.1);
    const mid = await measure(0.5);
    const fast = await measure(0.9);
    near(slow.period, 127.10, 0.5, 'period at pot 10 %');
    near(mid.period, 71.09, 0.5, 'period at pot 50 %');
    near(fast.period, 15.00, 0.5, 'period at pot 90 %');
    for (const [name, m] of [['slow', slow], ['mid', mid], ['fast', fast]]) {
        const duty = (m.high / m.period) * 100;
        assert.ok(duty > 45 && duty < 55, `${name} duty cycle is ${duty.toFixed(1)} %`);
    }
    // One cycle fits the scope's fixed 81.92 ms record only above about 12 Hz.
    assert.ok(slow.period > 81.92, 'the slowest setting no longer overruns the scope record');
    assert.ok(mid.period < 81.92 && fast.period < 81.92);
});

// The OPEN DEFECT sentinel that stood here — "the clock module has no
// downstream state and its step button drives nothing" — fired on 2026-08-29 at
// the sb3-creator `86a5bab` vendor bump and was retired per its own
// instruction. sb3-creator `56bd1ce` gave the bench a D flip-flop wired as a
// divide-by-two and put the step button on its clock. Both halves of
// machines-clocks are restored (v4), and EXPECTED.md's claim is now true rather
// than aspirational.
test('machines-clocks: the step button clocks state, and the state holds after the press', async () => {
    const {board, circuit} = await load('ttl-clock-module');
    const kinds = new Set(board.parts.map(p => p.kind));
    assert.deepEqual([...kinds].sort(), [
        '555', 'button', 'capacitor', 'dff', 'gnd', 'led', 'potentiometer', 'resistor', 'vcc'
    ], 'the clock module changed parts — re-measure Wave 7');

    // Topology first: the button reaches the flip-flop's clock, and the
    // flip-flop is wired as a divide-by-two (D on its own Q-bar).
    const net = (part, terminal) => board.nets.find(n =>
        n.terminals.some(t => t.part === part && t.terminal === terminal));
    assert.deepEqual(net('btn1', 'b').terminals.map(t => `${t.part}.${t.terminal}`).sort(),
        ['btn1.b', 'ff1.clk', 'r3.a'],
        'the step button no longer reaches the flip-flop clock — re-measure Wave 7');
    assert.deepEqual(net('ff1', 'd').terminals.map(t => `${t.part}.${t.terminal}`).sort(),
        ['ff1.d', 'ff1.q_bar'], 'D must be tied to Q-bar, or it is not a divide-by-two');
    assert.ok(net('ff1', 'q').terminals.some(t => t.part === 'r4'),
        'Q must reach the second LED, or the transition is not observable');
    // The oscillator itself is still un-haltable, and the lesson says so.
    assert.ok(net('u1', 'reset').terminals.some(t => t.part === 'vcc1'),
        'u1.reset is no longer strapped to VCC — re-measure Wave 7');

    // Behaviour: one press is one edge is one state change, and the state HOLDS
    // after the button is released. That holding is what makes it storage.
    const MS_ = 1_000_000n;
    let t = 0n;
    const q = () => board.nodeVoltage(net('ff1', 'q').id);
    board.advanceTo(t += 5n * MS_);
    near(q(), 0, 5e-4, 'Q at rest');
    const seen = [];
    for (let i = 0; i < 4; i++) {
        circuit.setControl('btn1', 1);
        board.advanceTo(t += 5n * MS_);
        const pressed = q();
        circuit.setControl('btn1', 0);
        board.advanceTo(t += 5n * MS_);
        assert.ok(Math.abs(q() - pressed) < 5e-4,
            `press ${i + 1}: Q moved when the button was RELEASED — it is following, not storing`);
        seen.push(Number(q().toFixed(4)));
    }
    // 4.4064 V. The flip-flop drives 5 V behind R_OUT = 50 Ω into 220 Ω and a
    // red LED. It read 4.4643 before the 2026-09-13 vf-convention correction,
    // 4.4286 after it, and 4.4064 since bw-board 74d42338 made LEDs
    // exponential: at 11.87 mA the red LED (vf 1.9 at 20 mA) drops less
    // than its rated vf, so more of the 5 V lands on the resistances. Toggle
    // and hold are unchanged — this is a level, not a behaviour.
    //
    // sb3-creator 9f50f601 re-derived EXPECTED.md for exponential LEDs, and
    // the lesson's measure hint now quotes 4.4064 (EN/DE, checked below).
    // ttl-clock-module/intro.md still says 4.4643; that text is sb3-creator's.
    assert.deepEqual(seen, [4.4064, 0, 4.4064, 0],
        'four presses must toggle Q twice — a divide-by-two is also a frequency divider');

    // EXPECTED.md's claim is now the measured one.
    const expected = readFileSync(path.join(EXAMPLES, 'ttl-clock-module/EXPECTED.md'), 'utf8');
    assert.match(expected, /clocks a D flip-flop wired as a divide-by-two/,
        'ttl-clock-module/EXPECTED.md no longer describes the repaired bench');
    assert.match(expected, /4\.4064/, 'and it must carry the voltage this test measures');
    assert.ok(!/manual step button injects a single\s+pulse/.test(expected),
        'the old aspirational claim is back in EXPECTED.md');
});

// ── The 6502 / Z80 benches ─────────────────────────────────────────────────

test('machines-memory-maps and machines-address-decode: the map the lessons ask for is produced and displayed', () => {
    assert.equal(lesson('machines-memory-maps').exampleId, 'eater6502-full-build');
    assert.equal(lesson('machines-address-decode').exampleId, 'eater6502-bench');
    for (const id of ['eater6502-bench', 'eater6502-full-build']) {
        const r = extract6502Machine(circuitOf(id));
        assert.ok(r.ok, `${id}: ${(r.reasons || []).join('; ')}`);
        assert.deepEqual(r.lines, [
            'MAP RAM $0000-$3FFF',
            'MAP ROM $8000-$FFFF',
            'CHIP via = W65C22 AT $6000',
            'CHIP acia = W65C51 AT $5000'
        ], `${id}: the extracted map changed — re-measure Wave 7`);
        // Mirrors and the hole: exactly what the lessons ask the learner to derive.
        assert.ok(r.notes.some(n => /via mirrors through \$6000-\$7FFF/.test(n)));
        assert.ok(r.notes.some(n => /acia mirrors through \$5000-\$5FFF/.test(n)));
        assert.ok(r.notes.some(n => /4096 addresses decode to nothing \(open bus\)/.test(n)));
    }
    // And the designer renders all three — lines, notes and reasons — under
    // the "Build Machine" button.
    const designer = readFileSync(path.join(CUI, 'components/CircuitDesigner.jsx'), 'utf8');
    assert.match(designer, /data-build-machine/);
    assert.match(designer, /machineResult\.lines && machineResult\.lines\.map/);
    assert.match(designer, /machineResult\.notes && machineResult\.notes\.length > 0/);
    assert.match(designer, /machineResult\.reasons\.map/);
});

test('machines-contention: the evidence the lesson asks for is exact, down to the address', () => {
    assert.equal(lesson('machines-contention').exampleId, 'eater6502-contention-bug');
    const r = extract6502Machine(circuitOf('eater6502-contention-bug'));
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, [
        'bus contention at $2000: ram and via are both selected — the decode must make them exclusive'
    ], 'the contention report changed — re-measure Wave 7');
});

test('machines-contention: the edit its checkpoint asks for now reaches the lesson', async () => {
    // Was an OPEN DEFECT, and the third of three: `bw-circuit-changed` was
    // dispatched only when the derived PIN DECLARATIONS moved, and this bench
    // has no MCU, so no wiring edit could raise it. Wave 1 found it on
    // starter-circuit-path, Wave 6 on signals-resonance, Wave 7 on
    // machines-contention — one defect, three discoveries.
    //
    // Fixed 2026-08-24: CircuitDesigner fires `onCircuitEdit` from a STRUCTURAL
    // signature of the circuit, and circuit-tab.jsx dispatches the DOM event
    // from there.
    assert.deepEqual(checkpoint('machines-contention', 'repair').observe, {event: 'circuit-changed'});
    const {circuitSignature} = await import(path.join(CUI, 'model/circuit-signature.js'));
    const raw = circuitOf(lesson('machines-contention').exampleId);

    const base = circuitSignature(raw.parts, raw.wires);

    // A WIRING edit, which is what this checkpoint actually asks for — and on a
    // 6502 bench it is the only edit there is: every part on it carries an empty
    // `params`, so a param-based probe would assert nothing here. (It did, in the
    // first draft of this test, and failed for the right reason.)
    assert.ok((raw.wires || []).length, 'the bench has no wires to edit');
    const cut = structuredClone(raw);
    cut.wires = cut.wires.slice(0, -1);
    assert.notEqual(circuitSignature(cut.parts, cut.wires), base,
        'breaking a wire must move the circuit signature, or this checkpoint goes back to ' +
        'being completable only by its manual button');

    // A PARAM edit too, where the bench has one — the other half of what
    // `starter-circuit-path`'s hint suggests.
    const swapped = structuredClone(raw);
    const part = swapped.parts.find(p => p.params && Object.keys(p.params).length);
    if (part) {
        const key = Object.keys(part.params)[0];
        part.params[key] = typeof part.params[key] === 'number' ? part.params[key] * 2 : 'changed';
        assert.notEqual(circuitSignature(swapped.parts, swapped.wires), base,
            'editing a part param must move the signature too');
    }

    const tab = readFileSync(path.join(GUI, 'components/tw-pseudocode/circuit-tab.jsx'), 'utf8');
    assert.match(tab, /onCircuitEdit=\{this\.handleCircuitEdit\}/,
        'circuit-tab.jsx no longer subscribes to onCircuitEdit — re-measure and update ' +
        'docs/LESSON-REVIEW-WAVE-7.md');
});

test('D7 CLOSED for the two 6502 benches: they ship an image and the example load supplies it', () => {
    // This WAS an OPEN DEFECT sentinel reading "the machine benches boot with
    // an empty ROM". D7 fixed the cause for two of its three lessons, so the
    // sentinel is converted rather than deleted: what is fixed is asserted as
    // fixed, and what is still open is still pinned below.
    for (const id of ['machines-6502-execution', 'machines-source-asm', 'machines-interrupts-performance']) {
        assert.match(JSON.stringify(checkpoint(id, lesson(id).checkpoints[1].id).observe),
            /debug-phase/, `${id} no longer observes the debugger`);
    }

    // 1. The two 6502 benches now DECLARE an image, and it is a real one.
    //    The old form of this check looked at the 28c256 part's params and so
    //    could not see a declared file at all -- which is why the fix did not
    //    trip it. The declaration is what the loader reads, so that is what
    //    this measures.
    const index = JSON.parse(readFileSync(path.join(EXAMPLES, 'index.json'), 'utf8'));
    const entry = id => (Array.isArray(index) ? index : index.examples).find(e => e.id === id);
    for (const id of ['eater6502-blink', 'eater6502-vdp-hello']) {
        assert.equal(entry(id).files.rom, `${id}/rom.bin`,
            `${id} no longer declares its image -- D7 has regressed`);
        const rom = readFileSync(path.join(EXAMPLES, id, 'rom.bin'));
        assert.equal(rom.length, 0x8000, `${id}: 32 KB`);
        assert.ok(rom.some(b => b !== 0xEA && b !== 0x00),
            `${id}: an image of pure fill is the defect this replaced`);
    }

    // 2. Loading such an example dispatches it onto the media path. The
    //    dispatch is READ from the shipped source rather than described here;
    //    test/example-rom-autoload.test.mjs executes it.
    const tabSrc = readFileSync(path.join(GUI, 'components/tw-pseudocode/circuit-tab.jsx'), 'utf8');
    assert.match(tabSrc, /const romPath = ex\.files && ex\.files\.rom;/,
        'the example ROM autoload is gone from circuit-tab.jsx -- D7 has regressed');
    assert.match(tabSrc, /bw-machine-media-load/,
        'the autoload no longer uses the media event the presets use');

    // 3. And the panel applies pending media BEFORE it syncs project tokens.
    //    That order is the whole reason this works: the comment there records
    //    an auto-run token that once built a second runner with no media,
    //    won state.runner, and showed a black VDP while the real program ran
    //    unseen. If the order flips, the image loses to the empty boot again.
    const panel = readFileSync(path.join(GUI, 'components/tw-pseudocode/debug-panel.jsx'), 'utf8');
    const applyAt = panel.indexOf('window.__bwPendingMedia');
    const tokensAt = panel.indexOf('this.syncProjectTokens({}, true);', applyAt);
    assert.ok(applyAt > 0 && tokensAt > applyAt,
        'pending media is no longer applied before syncProjectTokens -- the empty-ROM '
        + 'runner will win the race again; re-measure Wave 7');

    // 4. STILL OPEN, and pinned so it cannot rot: the RUNNER itself skips the
    //    build for machine targets and still boots empty on its own. The
    //    example load is what supplies the image; nothing compiles the
    //    example's own program for these targets yet (that is D12's ASM
    //    emitter, not D7).
    const runner = readFileSync(path.join(GUI, 'lib/bw-debug/debug-runner.js'), 'utf8');
    // The pin's guarantee: interpreter and boot-media machine targets take
    // the `null` arm and never call build(). The line grew a user-firmware
    // branch (2026-08-25 — arbitrary .bin/.hex loading), an 8086 boot-media
    // arm (2026-09-04, widened to the 386), a riscv32 arm (2026-09-27 — the
    // RISC-V bench's program is always bootMedia: an assembled image, a shipped
    // RTOS or a booted Linux), and an rp2040js boot-media arm (2026-10-05 — a
    // pico-sdk .uf2 booted from flash, PicoBB); the 6502 arm is unchanged. The
    // user-firmware arm became `await` when builtFromUserFirmware turned async
    // (01207acd8, 2026-09-28 — addressed LabWired images); the null arm did not move.
    assert.match(runner, /selectedKind === 'z80' \|\| selectedKind === 'eater6502' \|\|\n\s*selectedKind === 'riscv32' \|\|\n\s*\(\(selectedKind === 'i8086' \|\| selectedKind === 'i80386'\) && bootMedia\) \|\|\n\s*\(selectedKind === 'rp2040js' && bootMedia\)\) \? null\n\s*: userFirmware \? await builtFromUserFirmware\(selectedKind\)\n\s*: await build\(\)/,
        'the machine path now builds an image -- re-measure Wave 7');
    // The sentence moved into lib/bw-debug/runner-status-l10n.js when the
    // status line was translated, so the runner carries the KEY and the table
    // carries the words. Both halves are read: a key pointing at nothing would
    // pass a check on either one alone.
    assert.match(runner, /S\('ready\.emptyRom'\)/,
        'the empty-ROM status line is no longer written here -- re-measure Wave 7');
    assert.match(readFileSync(path.join(GUI, 'lib/bw-debug/runner-status-l10n.js'), 'utf8'),
        /'ready\.emptyRom':[\s\S]{0,200}?extracted machine booted with an empty ROM/,
        'the empty-ROM status line changed -- re-measure Wave 7');

    // 5. AND D37 IS CLOSED TOO, by moving the lesson rather than the wiring.
    //    This clause used to pin the interrupts lesson to z80-bench and say a
    //    ROM could not help it. Both halves of that were wrong, and measuring
    //    is what corrected them: the CPU interrupt inputs are not unconnected,
    //    they are tied to VCC (held inactive, correct idle wiring); and the
    //    simulator never needed a wire at all, because M6502Machine polls every
    //    chip's irqAsserted. What was missing was a PROGRAM. eater6502-bench
    //    now ships one, so the lesson moved to the bench that can answer it.
    assert.equal(lesson('machines-interrupts-performance').exampleId, 'eater6502-bench',
        'the interrupts lesson moved bench again -- re-measure Wave 7');
    assert.equal(entry('eater6502-bench').files.rom, 'eater6502-bench/rom.bin',
        'the interrupts bench stopped declaring its image -- D37 has regressed');
    // z80-bench still ships none, and still on purpose: its only I/O is an
    // MC6850 ACIA and the emitter's Z80 pin axis is a '374 latch / '244 buffer.
    assert.equal(entry('z80-bench').files.rom, undefined,
        'z80-bench now declares an image -- if it gained a program axis, re-measure Wave 7');

    // 6. The presets that give the learner a bigger program, all bundled, no
    //    network. The lessons still name them, now as an option rather than a
    //    requirement.
    const designer = readFileSync(path.join(CUI, 'components/CircuitDesigner.jsx'), 'utf8');
    for (const rom of ['taliforth-py65mon.bin', 'basic.rom', 'lcd-hello.bin', 'z80-mirror.bin']) {
        assert.ok(designer.includes(rom), `the ${rom} preset is gone -- re-measure Wave 7`);
    }
});

test('machines-6502-execution: the debugger reports everything the checkpoint asks for', async () => {
    // Nearly mis-called: DebugStatus.jsx alone shows none of this. The faces do.
    const m = extract6502Machine(circuitOf('eater6502-blink'));
    const rom = new Uint8Array(readFileSync(
        path.join(GUI, '../static/roms/lcd-hello.bin')));
    assert.equal(rom.length, 32768, 'the LCD Hello preset changed size — re-measure');
    const adapter = createM6502Adapter({config: {regions: m.regions, chips: m.chips}, rom});
    adapter.attachBoard({advanceTo () {}, setPin () {}});
    const target = createM6502DebugTarget(adapter, {});
    assert.deepEqual(target.capabilities().steps, ['insn', 'over', 'out'],
        'the 6502 step granularities changed — re-measure Wave 7');
    assert.deepEqual(target.capabilities().breakpoints, ['code', 'write']);
    const regs = target.regs();
    for (const key of ['pc', 'a', 'x', 'y', 'sp', 'p', 'cycles']) {
        assert.ok(key in regs, `the 6502 register report lost ${key}`);
    }
    assert.equal(regs.pc, 0x8000, 'the preset boots at its ROM base');
    assert.equal(target.disasm(0x8000).text, 'LDA #$FF');
    // And the faces that render them.
    const face = readFileSync(path.join(CUI, 'components/ArchitectureFace.jsx'), 'utf8');
    assert.match(face, /regs\.cycles != null \? `\$\{regs\.cycles\} cyc`/,
        'ArchitectureFace no longer shows the cycle count — re-measure Wave 7');
    assert.match(face, /debugState\.disasm\(r\.pc\)/);
    const drawer = readFileSync(path.join(GUI, 'components/tw-pseudocode/debug-drawer.jsx'), 'utf8');
    assert.match(drawer, /renderMemory/, 'the debug drawer lost its memory view');
    assert.match(drawer, /readMemoryPage\(runner, spec, page\)/,
        'the rendered memory view must use the bounded reader');
    const memorySource = readFileSync(path.join(GUI, 'lib/bw-debug/memory-view.js'), 'utf8');
    const {readMemoryPage} = await import(`data:text/javascript,${encodeURIComponent(memorySource)}`);
    const requests = [];
    const spec = {id: 'mem', addressMin: 0, addressMax: 0xffff, maxReadBytes: 128};
    const memory = readMemoryPage({readMem: (...args) => {
        requests.push(args); return Array.from({length: args[2]}, (_, i) => i);
    }}, spec, 0x1ff);
    assert.deepEqual(requests, [['mem', 0xff80, 128]]);
    assert.equal(memory.error, null);
    assert.deepEqual(memory.bytes, Array.from({length: 128}, (_, i) => i));
    assert.ok(readMemoryPage({readMem: () => { throw new Error('refused read'); }}, spec, 0).error);
    const outside = readMemoryPage({readMem: () => assert.fail('out-of-range read')}, spec, 0x200);
    assert.deepEqual(outside.bytes, []);
    assert.ok(outside.error);
});

// D25 was adjudicated 2026-08-29 rather than simply fixed, and this test
// changed shape with it. The row said "no cycle-level step" and named the
// 6502; measured, `W65C02.step()` fetches an opcode and runs `_exec` to
// completion, so this core has no sub-instruction state to stop in and a
// cycle step on it could only be an instruction step with a different label —
// the D5 lie. A real cycle step shipped on the one core that HAS clocks to
// stop between (emu8051: `tick()` is one oscillator clock), proven in
// test/debug-watchpoint-cycle.test.mjs at 3 cycle steps against 2 instruction
// steps.
//
// So this test no longer asserts an absence waiting to be filled. It pins the
// ADJUDICATION: the 6502 must keep refusing, and the refusal must keep saying
// why. If someone rewrites the core into a cycle-stepped state machine, the
// first assertion fires and machines-buses can be restored.
test('ADJUDICATED (was OPEN DEFECT): the 6502 refuses a cycle step by name, and the scope still cannot resolve a bus at CPU speed', async () => {
    assert.equal(lesson('machines-buses').exampleId, 'eater6502-bench');
    // "Single-step the clock": the finest CPU step here is one INSTRUCTION, and
    // the circuit-side step button advances 50 ms — 50 000 cycles at 1 MHz.
    const m = extract6502Machine(circuitOf('eater6502-bench'));
    const adapter = createM6502Adapter({config: {regions: m.regions, chips: m.chips}});
    adapter.attachBoard({advanceTo () {}, setPin () {}});
    const target = createM6502DebugTarget(adapter, {});
    assert.ok(!target.capabilities().steps.includes('cycle'),
        'the 6502 core became cycle-steppable — restore the clock-stepping exercise to ' +
        'machines-buses, re-measure Wave 7, and delete this test');
    // A refusal that explains is the whole point of the adjudication: a
    // learner who asks "why can I not step a cycle here?" must get the
    // architecture answer, not silence.
    const refusal = target.step('cycle');
    assert.match(refusal.unsupported, /no cycle step/i,
        'the 6502 must refuse `cycle` by name rather than ignoring it');
    assert.match(refusal.unsupported, /instruction step with a different label/i,
        'and the refusal must explain, or the absence reads as an oversight');
    const designer = readFileSync(path.join(CUI, 'components/CircuitDesigner.jsx'), 'utf8');
    assert.match(designer, /Advance one 50 ms tick/,
        "the circuit-side step button's granularity changed — re-measure Wave 7");
    // And the scope: 10 us per sample against a 1 us bus cycle.
    const {board} = await load('eater6502-bench');
    const netId = board.nets[0].id;
    const handle = board.addScopeChannel({type: 'voltage', netId});
    board.advanceTo(10n * MS);
    assert.equal(Number(board.getScopeData(handle).sampleIntervalNs), 10_000,
        'the scope cadence changed — re-measure Wave 7');
    const cpuClockHz = 1_000_000;   // CLOCK 1000000 in the eater6502 programs
    assert.ok((1e9 / 10_000) < cpuClockHz,
        'the scope now samples faster than the CPU clock — restore the pin-edge route to ' +
        'machines-buses and machines-interrupts-performance and delete this test');
});

test('machines-interrupts-performance: its bench ships an interrupt program with a handler of its own', () => {
    // D37. The lesson asks what an interrupt costs; until this bench shipped a
    // program, nothing in the gallery raised one. The NUMBERS it can now be
    // asked for are asserted where they can be executed -- sb3-creator's
    // machine-roms-boot gate boots this image and measures the period, the
    // jitter and the foreground deficit. What belongs HERE is only that the
    // lesson and the bench still agree about which image that is.
    assert.equal(lesson('machines-interrupts-performance').exampleId, 'eater6502-bench');
    const rom = readFileSync(path.join(EXAMPLES, 'eater6502-bench', 'rom.bin'));
    assert.equal(rom.length, 0x8000, 'the interrupts bench image changed size — re-measure Wave 7');
    const vec = (a) => rom[a - 0x8000] | (rom[a - 0x8000 + 1] << 8);
    assert.equal(vec(0xFFFC), 0x8000, 'RESET -> $8000');
    assert.notEqual(vec(0xFFFE), vec(0xFFFC),
        'the IRQ vector points back at RESET — there is no handler, and the lesson asks for one');
    assert.equal(rom[vec(0xFFFE) - 0x8000 + 6], 0x40, 'the handler must end in RTI');
    // The copy quotes the VIA's own period. If the image stops arming T1 from
    // a $0FFF latch, the 4097 cycles in that hint describe a different program.
    assert.ok([...rom.slice(0, 0x40)].join(',').includes('169,15,141,5,96'),
        'the image no longer loads $0F into T1C-H — the hint\'s 4097 cycles is stale');
});

test('z80-bench still extracts as the machine it draws, and keeps its BBC BASIC fallback', () => {
    const r = extractZ80Machine(circuitOf('z80-bench'));
    assert.ok(r.ok, `z80-bench: ${(r.reasons || []).join('; ')}`);
    const rom = r.regions.find(x => x.kind === 'rom');
    const ram = r.regions.find(x => x.kind === 'ram');
    assert.deepEqual([rom.start, rom.end], [0x0000, 0x7fff], 'z80-bench ROM range');
    assert.deepEqual([ram.start, ram.end], [0x8000, 0xffff], 'z80-bench RAM range');
    const runner = readFileSync(path.join(GUI, 'lib/bw-debug/debug-runner.js'), 'utf8');
    assert.match(runner, /S\('boot\.bbcbasic'\)/,
        'the Z80 fallback is no longer taken here — re-measure Wave 7');
    assert.match(readFileSync(path.join(GUI, 'lib/bw-debug/runner-status-l10n.js'), 'utf8'),
        /'boot\.bbcbasic':[\s\S]{0,120}?BBC BASIC/,
        'the Z80 fallback changed — re-measure Wave 7');
    assert.match(runner, /S\('boot\.extractedZ80'\)/,
        'the extracted-Z80 boot no longer announces itself — re-measure Wave 7');
});

// ── The lesson copy this review wrote, in both languages ───────────────────

test('the Wave 7 revisions are present, EN and DE, at the content version this review recorded', () => {
    assert.deepEqual(Object.fromEntries(WAVE.lessons.map(l => [l.id, l.version])), {
        'machines-logic-levels': 3,
        'machines-gates-registers': 3,
        'machines-clocks': 4,
        'machines-buses': 2,
        'machines-memory-maps': 1,
        'machines-address-decode': 1,
        'machines-6502-execution': 3,
        'machines-source-asm': 3,
        'machines-contention': 2,
        'machines-interrupts-performance': 3
    }, 'a Wave 7 lesson changed content version — update docs/LESSON-REVIEW-WAVE-7.md with it');

    const says = (id, cp, field, en, de) => {
        const copy = checkpoint(id, cp).copy;
        assert.match(copy.en[field], en, `${id}/${cp}: the English ${field} lost its Wave 7 revision`);
        assert.match(copy.de[field], de, `${id}/${cp}: the German ${field} lost its Wave 7 revision`);
    };
    says('machines-logic-levels', 'measure', 'hint', /push-pull|quasi/i, /Push-Pull|quasi/i);
    says('machines-gates-registers', 'trace', 'action', /correlate data, clock, latch/i, /ordne Daten, Takt, Latch/i);
    // v4 (D27 closed): the bench grew a divide-by-two, so both halves the
    // checkpoint was worded around — single-step and downstream transition — are
    // demands again instead of disclosures.
    says('machines-clocks', 'measure', 'action', /step button/i, /Schritt-Taster/i);
    // The alternation that stood here (/divide-by-two|4\.4643/) could not see
    // its number die: the concept kept it green while the bench moved to 4.4286
    // and then 4.4064. As its own note asked, the gate now asserts the CLAIM and
    // the quoted FIGURE separately, and the figure is the one the step-button
    // test above measures (re-quoted 2026-11-24, exponential LEDs).
    says('machines-clocks', 'measure', 'hint', /divide-by-two/, /Zweiteiler/);
    says('machines-clocks', 'measure', 'hint', /4\.4064 V/, /4,4064 V/);
    says('machines-buses', 'trace', 'action', /instruction|per-cycle|cycle-level/i, /Befehl|Zyklus/i);
    says('machines-6502-execution', 'step', 'action', /load a program|preset/i, /Programm laden|Preset/i);
    says('machines-source-asm', 'trace', 'hint', /preset|hosted/i, /Preset|gehostet/i);
    says('machines-contention', 'repair', 'hint', /Build Machine/, /Build Machine/);
    // The action no longer sends the learner to a preset: the bench brings
    // its own interrupt program, which is the whole of D37.
    says('machines-interrupts-performance', 'measure', 'action', /Timer 1|interrupt program/i, /Timer 1|Interruptprogramm/i);
});
