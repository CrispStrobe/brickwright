/**
 * Wave 1 lesson review — the measurements the review rests on, as a gate.
 *
 * `docs/LESSON-REVIEW-WAVE-1.md` says, of each lesson in the "Electricity you
 * can see" wave, whether the bench it names can produce the observation its
 * checkpoints ask for. Every "yes" in that document is a number that came out
 * of the engine. This file re-derives those numbers so the verdicts cannot go
 * stale silently: change a resistor in a shipped circuit, or change the engine,
 * and the claim that a lesson is teachable fails here rather than in a
 * classroom.
 *
 * It also pins the two defects that could not be fixed in the lesson copy —
 * the transistor ammeter and the dead `circuit-changed` observable — so that
 * whoever fixes them is told to update the review instead of leaving it wrong.
 *
 * Instrument checks, because a bench that reports nothing looks exactly like a
 * bench that reports zero:
 *   - a negative control per solve claim (reverse the diode, drop the supply),
 *     so a solver that returned a constant would fail;
 *   - `registerAllDevices()` before any board, checked by asserting a device
 *     model actually loaded — an unpopulated registry produced a whole false
 *     blast-radius report on 2026-08-20;
 *   - `ledBrightness` is a 20 ms MOVING AVERAGE, so every brightness assertion
 *     is taken after the window has filled. Read one step after a change and it
 *     reports the previous state, which is not a defect and is not a reading.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {boot, load, EXAMPLES, circuitPathFor} from '../scripts/lesson-bench.mjs';

const MS = 1_000_000n;
const near = (actual, expected, tol, what) => assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: measured ${Number(actual).toFixed(4)}, expected ${expected} +-${tol}`);

const volts = (board, part, terminal) => {
    for (const net of board.nets) {
        if (net.terminals.some(t => t.part === part && t.terminal === terminal)) {
            return board.nodeVoltage(net.id);
        }
    }
    assert.fail(`${part}.${terminal} is on no net — the bench does not have it`);
};
const milliamps = (board, part, terminal) => board.branchCurrent(part, terminal) * 1000;

// RE-DERIVED 2026-11-24 for bw-board 74d42338 (round 3, pinned since lite's
// a685b220 move): diodes and LEDs are EXPONENTIAL (Shockley) by default. An
// LED's `vf` stays the TOTAL drop at its rated 20 mA (junction + rs, with Is
// solved to make that exact — mna.js shockleyParams), and below 20 mA the
// drop falls by n·Vt·ln(20 mA / I) + rs·(20 mA − I). The old piecewise knee
// (vf − 0.020·rd, a flat 1.8 V for the red LED) over-states the drop at the
// few-mA currents these benches run, so every LED branch current here ROSE by
// 0.5–5%. Red LED card: vf 2.0, n 1.8, rs 10 Ω (parts-library.js). Values are
// the measured ones; tolerances are unchanged. Nothing was widened.
const fresh = async id => {
    const {board, circuit, data} = await load(id);
    return {board, circuit, data};
};

// ── Instrument check: the engine is real and the registry is populated ──────
test('instrument: the device registry is populated before any board is built', async () => {
    const {BoardImpl} = await boot();
    assert.equal(typeof BoardImpl, 'function');
    const {getDevice, registeredKinds} = await import(path.join(
        path.resolve(import.meta.dirname, '..'),
        'node_modules/bw-board/src/devices.js'));
    // dc_motor and switch come from registerAllDevices(); with an empty registry
    // pc26-motor-clamp solves to a bench with no motor and reads as "0 V, fine".
    // (`npn` is deliberately NOT checked: it is a BUILTIN element kind stamped
    // by board.js, so it is absent from the registry even when the registry is
    // fully populated — asserting on it tests nothing about registration.)
    assert.ok(getDevice('dc_motor'), 'registerAllDevices() did not run');
    assert.ok(registeredKinds().length > 100,
        `registry holds only ${registeredKinds().length} kinds — it is not populated`);
});

// ── electricity-polarity → 28-diode-polarity ────────────────────────────────
test('electricity-polarity: the bench reverses a DIODE, and both LEDs face the same way', async () => {
    const {board} = await fresh('28-diode-polarity');
    board.advanceTo(50n * MS);

    // Both LEDs forward-biased — there are not "two LED directions" to identify.
    assert.ok(volts(board, 'led1', 'anode') > volts(board, 'led1', 'cathode') + 0.5);
    assert.ok(volts(board, 'led2', 'anode') > volts(board, 'led2', 'cathode') + 0.5);
    // d1 forward, d2 reverse — that is the whole lesson.
    assert.ok(volts(board, 'd1', 'anode') > volts(board, 'd1', 'cathode'), 'd1 is forward');
    assert.ok(volts(board, 'd2', 'cathode') > volts(board, 'd2', 'anode'), 'd2 is reverse');

    near(milliamps(board, 'r1', 'b'), 5.4734, 0.01, 'forward branch current');
    near(milliamps(board, 'r2', 'b'), 0, 0.001, 'reverse branch current');
    near(volts(board, 'd1', 'anode'), 2.4275, 0.01, 'V at d1 anode');
    near(volts(board, 'd2', 'cathode'), 5.0, 0.01, 'V at d2 cathode (blocked, sits at VCC)');
    near(board.ledBrightness('led1'), 0.2737, 0.001, 'green LED brightness');
    near(board.ledBrightness('led2'), 0, 0.001, 'red LED brightness');
});

test('negative control: truly reversing d1 extinguishes led1, turning d2 forward lights led2', async () => {
    const {Circuit} = await boot();
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circuitPathFor('28-diode-polarity')), 'utf8'));
    // A seated part's orientation lives in BOTH its breadboard leadMap and its
    // wire terminals. Flipping only the wires SHORTS the diode (6.25 mA, measured)
    // instead of reversing it — which is what makes this a control and not a
    // restatement: get the mutation wrong and the numbers say so.
    const flip = (data, id) => {
        const part = data.parts.find(p => p.id === id);
        const m = part.seat.leadMap;
        [m.anode, m.cathode] = [m.cathode, m.anode];
        for (const w of data.wires) {
            if (w.to === id) w.toTerminal = w.toTerminal === 'anode' ? 'cathode' : 'anode';
            if (w.from === id) w.fromTerminal = w.fromTerminal === 'anode' ? 'cathode' : 'anode';
        }
        return data;
    };
    const solve = data => {
        const c = Circuit.fromJSON(data);
        c.board.advanceTo(50n * MS);
        return [c.board.ledBrightness('led1'), c.board.ledBrightness('led2')];
    };
    const [onA, offA] = solve(structuredClone(raw));
    assert.ok(onA > 0.2 && offA < 0.001, 'shipped: green on, red off');
    const [offB, offB2] = solve(flip(structuredClone(raw), 'd1'));
    assert.ok(offB < 0.001 && offB2 < 0.001, 'd1 reversed: both dark');
    const [onC, onC2] = solve(flip(structuredClone(raw), 'd2'));
    assert.ok(onC > 0.2 && onC2 > 0.2, 'd2 forward: both lit');
});

// ── electricity-resistance → 45-led-current-comparison ──────────────────────
test('electricity-resistance: three branches are ordered and separable by eye', async () => {
    const {board} = await fresh('45-led-current-comparison');
    board.advanceTo(50n * MS);
    near(milliamps(board, 'r1', 'b'), 13.9854, 0.01, '220 ohm branch');
    near(milliamps(board, 'r2', 'b'), 6.7717, 0.01, '470 ohm branch');
    near(milliamps(board, 'r3', 'b'), 3.2520, 0.01, '1k branch');
    const b = ['led1', 'led2', 'led3'].map(id => board.ledBrightness(id));
    assert.ok(b[0] > b[1] && b[1] > b[2], `brightness must be monotone, got ${b}`);
    assert.ok(b[0] - b[2] > 0.4, 'the brightest and dimmest must be tellable apart');
});

// ── electricity-ohms-law → 34-ohms-law ──────────────────────────────────────
test('electricity-ohms-law: the hand calculation is ~8.4% low, because a real LED drops less than its rated Vf', async () => {
    const {board} = await fresh('34-ohms-law');
    board.advanceTo(50n * MS);
    const measured = milliamps(board, 'r1', 'b');
    const naive = (5 - 2) / 1000 * 1000;     // the lesson's I = (Vsupply - Vled) / R
    // Hand oracle (exponential LED, red card vf 2.0 @ 20 mA, n 1.8, rs 10 Ω):
    //   V_led = 2.0 + n·Vt·ln(I / 20 mA) + rs·(I − 20 mA)
    //         = 2.0 + 0.04653·ln(3.252/20) + 10·(0.003252 − 0.020)
    //         = 2.0 − 0.0845 − 0.1675 = 1.7480 V
    //   I     = (5 − 1.7480) / 1000 = 3.2520 mA  — self-consistent.
    // Was (5 − 1.8) / 1010 = 3.1683 mA under the piecewise knee (vf − 0.020·rd).
    near(measured, 3.2520, 0.01, 'branch current');
    near(volts(board, 'r1', 'b'), 1.7480, 0.01, 'V at the LED anode');
    // THE TEACHING POINT MOVED, AND IT MOVED TOWARDS THE TRUTH. This read
    // "differ by ~1%" while the solver shared the lesson's own simplification:
    // both put a flat 2.0 V across the LED, so of course they nearly agreed.
    // The engine now models the device, a real LED at 3 mA drops well under its
    // 20 mA rating, and the honest gap is 5.6% — the learner's estimate is LOW,
    // which is the thing worth explaining. With the exponential junction
    // (bw-board 74d42338) the drop at 3 mA is lower still, and the gap is 8.4%:
    // same sign, same explanation, a bigger number.
    //
    // CONSEQUENCE OUTSIDE THIS REPO: the shipped lesson states the old figures
    // (34-ohms-law/EXPECTED.md: "(5.0 - 2.0) / 1000 = 3.0 mA"). That text is
    // sb3-creator's and is now wrong for this bench. Reported with the count.
    const errorPct = Math.abs(measured - naive) / naive * 100;
    near(errorPct, 8.40, 0.1, 'the gap the lesson has to explain');
    assert.ok(measured > naive, 'the measurement must exceed the naive estimate, not fall short');
});

// ── electricity-series-parallel → 22-series-parallel ────────────────────────
test('electricity-series-parallel: the supply carries all THREE branches, not just the parallel pair', async () => {
    const {board} = await fresh('22-series-parallel');
    board.advanceTo(50n * MS);
    const series = milliamps(board, 'r1', 'b');
    const p1 = milliamps(board, 'r3', 'b');
    const p2 = milliamps(board, 'r4', 'b');
    // Raw current is signed positive OUT of the probed terminal (bw-circuit-ui
    // 4aea457, "Align CUI raw currents with positive-OUT contract", checked
    // against the ngspice oracle). OUT of the supply terminal IS the current
    // the rail delivers, so this no longer negates. The magnitude is unchanged.
    const supply = milliamps(board, 'vcc1', 'vcc');
    near(series, 3.4544, 0.01, 'series branch');
    near(p1, 6.7717, 0.01, 'parallel branch 1');
    near(p2, 6.7717, 0.01, 'parallel branch 2');
    near(supply, 16.9977, 0.01, 'supply current');
    near(supply, series + p1 + p2, 0.01, 'Isupply = Iseries + Ip1 + Ip2 (the v2 hint)');
    // The v1 hint said Isource = Ibranch1 + Ibranch2. It is false here by the
    // series branch, and there is no node on this bench where it holds.
    assert.ok(Math.abs(supply - (p1 + p2)) > 3,
        'if this ever becomes true, the v1 hint was right and the review is wrong');
});

// ── electricity-button → 11-toggle-button ───────────────────────────────────
test('electricity-button: the pull-up gives a defined level in both button states', async () => {
    const {board, circuit} = await fresh('11-toggle-button');
    let t = 50n * MS;
    board.advanceTo(t);
    near(volts(board, 'MCU', 'P3.2'), 5.0, 0.01, 'input released');
    near(milliamps(board, 'R_PU_btn', 'a'), 0, 0.001, 'pull-up current released');
    circuit.setControl('BTN_btn', 1);
    board.advanceTo(t += 50n * MS);
    near(volts(board, 'MCU', 'P3.2'), 0.0, 0.01, 'input pressed');
    near(-milliamps(board, 'R_PU_btn', 'a'), 0.5, 0.001, 'pull-up current pressed');
});

// ── electricity-capacitor (already v2) → pc29-capacitor-discharge ───────────
test('electricity-capacitor: charge and discharge are separate paths, and the tail flattens far above 0 V', async () => {
    const {board, circuit} = await fresh('pc29-capacitor-discharge');
    let t = 10n * MS;
    board.advanceTo(t);
    near(volts(board, 'cap', 'a'), 0, 0.01, 'capacitor starts empty');
    circuit.setControl('charge', 1);
    board.advanceTo(t = 4010n * MS);
    assert.ok(volts(board, 'cap', 'a') > 4.8, 'charge path reaches near 5 V');
    circuit.setControl('charge', 0);
    circuit.setControl('discharge', 1);
    board.advanceTo(t += 1n * MS);
    // Positive-OUT: forward LED current ENTERS the anode, so the raw reading is
    // negative and its forward magnitude is the explicit negative of it.
    const first = -milliamps(board, 'led', 'anode');
    assert.ok(first > 2.5, `discharge starts with real LED current, got ${first} mA`);
    board.advanceTo(t += 4000n * MS);
    const at4s = volts(board, 'cap', 'a');
    board.advanceTo(t += 4000n * MS);
    // The revised lesson's teaching point: it does NOT decay to 0 V.
    //
    // THERE IS NO KNEE ANY MORE (bw-board 74d42338, exponential LEDs). Under
    // the piecewise model the tail stopped dead at vf − 0.020·rd = 1.8 V
    // (1.7784 measured). A real LED's current falls exponentially with its
    // voltage instead of switching off, so the discharge never stops — it
    // SLOWS: measured 1.6481 V at 4 s, 1.4879 V at 8 s, 1.4180 V at 16 s, with
    // the LED carrying 17 µA at 8 s. Each doubling of the time takes off less
    // than the one before, which is what "flattens" means for a real diode.
    // The lesson's point — it does not decay to 0 V — holds, and the
    // assertion below now checks the flattening itself, not just a level.
    //
    // pc29-capacitor-discharge/intro.md and EXPECTED.md still say it "stops
    // near 2 V"; that text is sb3-creator's and is now off by ~0.5 V.
    near(volts(board, 'cap', 'a'), 1.4879, 0.05, 'discharge tail at 8 s, far above 0 V');
    assert.ok(at4s - volts(board, 'cap', 'a') < 0.25,
        `the tail must be flattening: 4 s -> 8 s fell ${at4s - volts(board, 'cap', 'a')} V`);
});

// ── electricity-inductor → pc52-inductor-filter ─────────────────────────────
test('electricity-inductor: at rest the two nodes are 0.2 mV apart; the difference lives on an edge', async () => {
    const {Circuit} = await boot();
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circuitPathFor('pc52-inductor-filter')), 'utf8'));

    const atRest = Circuit.fromJSON(structuredClone(raw));
    atRest.board.advanceTo(50n * MS);
    const before = volts(atRest.board, 'r', 'b');
    const after = volts(atRest.board, 'load', 'a');
    assert.ok(Math.abs(before - after) < 0.001,
        `as the lesson OPENS the traces must be indistinguishable, got ${before} vs ${after}`);

    // v2 tells the learner to make an edge. It has to be worth looking at.
    const stepped = Circuit.fromJSON(structuredClone(raw));
    let t = 20n * MS;
    stepped.setControl('src', 0);
    stepped.board.advanceTo(t);
    stepped.setControl('src', 5);
    stepped.board.advanceTo(t + 20n * 1000n);   // +20 us
    const edgeBefore = volts(stepped.board, 'r', 'b');
    const edgeAfter = volts(stepped.board, 'load', 'a');
    assert.ok(edgeBefore - edgeAfter > 3,
        `20 us after the edge the two nodes must be far apart, got ${edgeBefore} vs ${edgeAfter}`);
});

// ── electricity-diode (already v2) → pc31-bridge-rectifier ──────────────────
test('electricity-diode: reversing the source keeps load polarity and costs two diode drops', async () => {
    const {board, circuit} = await fresh('pc31-bridge-rectifier');
    let t = 50n * MS;
    const readOut = () => ({
        out: volts(board, 'r1', 'a'),
        load: milliamps(board, 'r1', 'b'),
        conducting: ['d1', 'd2', 'd3', 'd4'].filter(d => Math.abs(milliamps(board, d, 'anode')) > 0.01)
    });
    circuit.setControl('src', 9);
    board.advanceTo(t);
    const pos = readOut();
    circuit.setControl('src', -9);
    board.advanceTo(t += 50n * MS);
    const neg = readOut();

    assert.deepEqual(pos.conducting, ['d1', 'd4'], '+9 V selects one diagonal');
    assert.deepEqual(neg.conducting, ['d2', 'd3'], '-9 V selects the other');
    near(pos.out, 7.7262, 0.01, 'bridge output at +9 V');
    near(neg.out, pos.out, 0.001, 'bridge output is unchanged by reversing the source');
    near(neg.load, pos.load, 0.001, 'load current is unchanged, and never reverses');
    // Two drops of the generic silicon diode card (vf 0.7 @ 20 mA, n 1.752,
    // rs 0.568 Ω) at the 7.7 mA load current: 0.637 V each on the exponential
    // junction (bw-board 74d42338), was 0.692 V on the piecewise knee.
    near(9 - pos.out, 1.2738, 0.01, 'the output is short of the source by exactly two forward drops');
});

// ── electricity-transistor-switch → 38-npn-switch ───────────────────────────
test('electricity-transistor-switch: the switch really switches', async () => {
    const {board, circuit} = await fresh('38-npn-switch');
    let t = 50n * MS;
    board.advanceTo(t);
    near(volts(board, 'q1', 'base'), 0.005, 0.01, 'base at cutoff');
    near(milliamps(board, 'r1', 'b'), 0, 0.001, 'load branch at cutoff');
    circuit.setControl('btn1', 1);
    board.advanceTo(t += 50n * MS);
    near(volts(board, 'q1', 'base'), 0.704, 0.01, 'base on');
    near(volts(board, 'q1', 'collector'), 0.07829, 0.002, 'collector on');
    near(milliamps(board, 'r1', 'b'), 6.6113, 0.01, 'load branch on');
    // ledBrightness averages over a 20 ms window whose samples are recorded at
    // each advance boundary, so one 50 ms hop leaves the window holding the OLD
    // state and reads 0. Step it, the way the app's animation loop does.
    for (let i = 0; i < 4; i++) board.advanceTo(t += 10n * MS);
    near(board.ledBrightness('led1'), 0.33056, 0.001, 'LED on (after the 20 ms window fills)');
});

test('electricity-transistor-switch: every reading in the load loop agrees', async () => {
    // Was an OPEN DEFECT: `branchCurrent` reported beta*Ib on a saturated
    // collector — 43.0 mA against 5.8 mA in the same series loop — and a flat 0
    // on a button carrying 0.43 mA. Fixed at the source 2026-08-24 (bw-board):
    // the BJT extraction now uses the same Vce clamp the stamp uses in
    // saturation, and button/switch/dc_motor terminals report their current.
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circuitPathFor('38-npn-switch')), 'utf8'));
    const {Circuit} = await boot();

    const off = Circuit.fromJSON(structuredClone(raw));
    off.board.advanceTo(50n * MS);
    near(volts(off.board, 'q1', 'base'), 0.005, 0.002, 'base with the button released');
    // 4.0146 V, was 4.497. With the transistor off the collector node hangs
    // on the LED's LEAKAGE: the only path out of it is q1's cut-off junction.
    // The piecewise LED dropped ~0.5 V there; the exponential one carries that
    // sub-microamp current at ~1 V, as a real LED does. The switch claim (the
    // collector is high, the LED dark) is unchanged.
    near(volts(off.board, 'q1', 'collector'), 4.0146, 0.01, 'collector with the button released');

    const on = Circuit.fromJSON(structuredClone(raw));
    on.setControl('btn1', 1);
    on.board.advanceTo(50n * MS);
    near(volts(on.board, 'q1', 'base'), 0.6957, 0.002, 'base pressed');
    near(volts(on.board, 'q1', 'collector'), 0.07829, 0.002, 'collector pressed');

    // One series loop, therefore one current. This is the claim the lesson's
    // version 3 hint makes and the one that was false before the repair.
    const load = milliamps(on.board, 'r1', 'b');
    near(load, 6.6113, 0.01, 'load resistor');
    // Both of these terminals are ENTERED by the loop current, so under the
    // positive-OUT contract they read negative; the loop agreement is on their
    // forward magnitudes. r1.b is left as-is because the current leaves it.
    for (const [part, terminal] of [['led1', 'anode'], ['q1', 'collector']]) {
        near(-milliamps(on.board, part, terminal), load, 0.01,
            `${part}.${terminal} must agree with the load resistor in the same series loop`);
    }
    // And the base loop, including the button that used to read zero.
    const base = milliamps(on.board, 'rb1', 'b');
    near(base, 0.4304, 0.01, 'base resistor');
    near(milliamps(on.board, 'btn1', 'b'), base, 0.001,
        'a closed button must carry the current of the branch it is in');
});

// ── electricity-motor-flyback → pc26-motor-clamp ────────────────────────────
test('electricity-motor-flyback: the bench opens unpowered, and the spike needs the scope', async () => {
    const {Circuit} = await boot();
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circuitPathFor('pc26-motor-clamp')), 'utf8'));

    // As it opens: switch OFF, every node at 0 V. Nothing to "verify while powered".
    const idle = Circuit.fromJSON(structuredClone(raw));
    idle.board.advanceTo(50n * MS);
    near(volts(idle.board, 'sw1', 'b'), 0, 0.001, 'switched node with the switch open');
    near(volts(idle.board, 'd1', 'cathode'), 0, 0.001, 'diode cathode with the switch open');

    // Closed: the diode is reverse-biased, which is what the checkpoint asks for.
    const run = Circuit.fromJSON(structuredClone(raw));
    let t = 0n;
    run.setControl('sw1', 1);
    run.board.advanceTo(t += 10n * MS);
    assert.ok(volts(run.board, 'd1', 'cathode') > volts(run.board, 'd1', 'anode') + 8,
        'diode must be reverse-biased while the motor runs');

    // Read on the UI's control path (advanceBy 1 ms) there is no spike to see.
    run.setControl('sw1', 0);
    run.board.advanceTo(t += 1n * MS);
    assert.ok(volts(run.board, 'sw1', 'b') > -1,
        'a 1 ms sample shows no spike — this is why the v2 hint names the scope');

    // With a 100 kHz scope channel — what ScopePanel attaches — it is there.
    const scoped = Circuit.fromJSON(structuredClone(raw));
    const net = scoped.board.nets.find(n =>
        n.terminals.some(x => x.part === 'sw1' && x.terminal === 'b'));
    const handle = scoped.board.addScopeChannel({type: 'voltage', netId: net.id, sampleRateHz: 100_000});
    let u = 0n;
    scoped.setControl('sw1', 1);
    scoped.board.advanceTo(u += 21n * MS);
    scoped.setControl('sw1', 0);
    scoped.board.advanceTo(u += 6n * MS);
    const d = scoped.board.getScopeData(handle);
    let lo = Infinity;
    for (let i = 0; i < d.samples.length; i += 2) if (!Number.isNaN(d.samples[i])) lo = Math.min(lo, d.samples[i]);
    assert.equal(Number(d.sampleIntervalNs), 10_000, 'scope samples at 10 us');
    // THE CLAMP IS 8x TIGHTER NOW, AND THAT IS THE CORRECTION, NOT A REGRESSION.
    // A flyback diode holds the kick at one forward drop below ground: knee + I·Rs,
    // where the knee is vf − 0.020·rd = 0.7 − 0.020·0.568 = 0.6886 V. Measured
    // −1.1997 V, so I ≈ (1.1997 − 0.6886) / 0.568 ≈ 0.90 A through the inductor —
    // consistent, and hand-checkable.
    //
    // This asserted `lo < -8` while silicon's bulk resistance was 10 Ω, which is 18x
    // the real 1N4148's 0.568 and made the clamped spike look eight times larger
    // than a real diode allows. Reaching −8 V through 0.568 Ω would need 12.9 A.
    // The lesson's point is unchanged and better served: the diode CLAMPS the kick.
    assert.ok(lo < -0.9 && lo > -2,
        `the clamped spike must sit near one forward drop below ground, saw ${lo} V`);
});

// ── starter-circuit-path → 47-battery-led ───────────────────────────────────
test('starter-circuit-path: the loop is closed and the numbers are the ones a learner traces', async () => {
    const {board} = await fresh('47-battery-led');
    board.advanceTo(50n * MS);
    near(volts(board, 'bat1', 'pos'), 9.0, 0.01, 'battery +');
    near(volts(board, 'bat1', 'neg'), 0.0, 0.01, 'battery -');
    near(milliamps(board, 'r1', 'b'), 7.1724, 0.01, 'loop current');
    assert.ok(board.ledBrightness('led1') > 0.3, 'the LED is lit');
});

test('starter-circuit-path: the edits its checkpoint asks for now reach the lesson', async () => {
    // Was an OPEN DEFECT. `bw-circuit-changed` was dispatched only from
    // `handleDeclarationChange`, and CircuitDesigner called that only when the
    // DERIVED PIN DECLARATIONS moved. On this bench — battery, resistor, LED,
    // no MCU — they never do, so a resistance change and a broken wire, the two
    // edits the hint suggests, were both silent.
    //
    // Fixed 2026-08-24: `onCircuitEdit` fires from a structural signature of the
    // circuit instead, and circuit-tab.jsx dispatches the DOM event from there.
    // The declaration fact below is unchanged and is exactly why the second
    // producer had to exist.
    const {Circuit} = await boot();
    const root = path.resolve(import.meta.dirname, '..');
    const cui = path.join(root, 'node_modules/bw-circuit-ui/src');
    const {circuitToDeclarations} = await import(path.join(cui, 'model/declarations.js'));
    const {circuitSignature} = await import(path.join(cui, 'model/circuit-signature.js'));
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circuitPathFor('47-battery-led')), 'utf8'));
    const of = data => {
        const c = Circuit.fromJSON(data);
        return {
            decl: JSON.stringify(circuitToDeclarations(c.parts, c.wires, c.resolvedNets)),
            sig: circuitSignature(c.parts, c.wires)
        };
    };
    const base = of(structuredClone(raw));
    const changedResistance = structuredClone(raw);
    changedResistance.parts.find(p => p.id === 'r1').params.ohms = 470;
    const brokenWire = structuredClone(raw);
    brokenWire.wires = brokenWire.wires.slice(0, -1);

    for (const [label, data] of [['a resistance change', changedResistance], ['a broken wire', brokenWire]]) {
        const now = of(data);
        assert.equal(now.decl, base.decl,
            `${label} still moves no declaration on an MCU-less bench — that is the reason ` +
            'the circuit signal exists, and if it stops being true this test can be simplified');
        assert.notEqual(now.sig, base.sig,
            `${label} must move the circuit signature, or starter-circuit-path's change ` +
            'checkpoint goes back to being completable only by its manual button');
    }

    // And the host must actually dispatch from the new producer.
    const tab = readFileSync(path.join(root,
        'overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx'), 'utf8');
    assert.match(tab, /handleCircuitEdit \(detail\) \{[\s\S]*?bw-circuit-changed/,
        'circuit-tab.jsx no longer dispatches bw-circuit-changed from onCircuitEdit');
    assert.match(tab, /onCircuitEdit=\{this\.handleCircuitEdit\}/,
        'the designer is no longer given the onCircuitEdit callback');
});

// ── instrument-voltage-divider → 52-battery-voltage-divider ─────────────────
test('instrument-voltage-divider: the midpoint is exactly what the formula predicts', async () => {
    const {board} = await fresh('52-battery-voltage-divider');
    board.advanceTo(50n * MS);
    near(volts(board, 'r1', 'b'), 4.5, 0.01, 'midpoint');
    near(volts(board, 'bat1', 'pos'), 9.0, 0.01, 'supply');
    near(milliamps(board, 'r1', 'b'), 0.45, 0.001, 'divider current');
    // "An ideal voltmeter draws almost no current" — here it draws none at all:
    // the meter part is filtered out of the engine netlist before the solve.
    const {getMeterReading} = await import(path.join(
        path.resolve(import.meta.dirname, '..'),
        'node_modules/bw-circuit-ui/src/model/meter-reading.js'));
    assert.equal(typeof getMeterReading, 'function');
});
