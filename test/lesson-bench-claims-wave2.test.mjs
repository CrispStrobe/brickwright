/**
 * Wave 2 lesson review — "Measure rather than guess", as a gate.
 *
 * Same contract as `test/lesson-bench-claims.test.mjs` for Wave 1: every verdict
 * in `docs/LESSON-REVIEW-WAVE-2.md` is a number that came out of the engine, and
 * this file re-derives it so a verdict cannot quietly stop being true.
 *
 * Wave 2 is the instrument wave, so most of its claims are about whether a
 * reading is trustworthy. Two of them are about a reading that does not exist at
 * all, and those are pinned as OPEN DEFECT tests that fail when someone fixes
 * the engine — the same shape Wave 1 used for the transistor ammeter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {boot, load, EXAMPLES, circuitPathFor} from '../scripts/lesson-bench.mjs';
import {bundleSource} from '../scripts/spike/bundled-upstream.mjs';

const MS = 1_000_000n;
const ROOT = path.resolve(import.meta.dirname, '..');
const near = (actual, expected, tol, what) => assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: measured ${Number(actual).toFixed(4)}, expected ${expected} +-${tol}`);
const volts = (board, part, terminal) => {
    for (const net of board.nets) {
        if (net.terminals.some(t => t.part === part && t.terminal === terminal)) {
            return board.nodeVoltage(net.id);
        }
    }
    assert.fail(`${part}.${terminal} is on no net`);
};
const netId = (board, part, terminal) => {
    for (const net of board.nets) {
        if (net.terminals.some(t => t.part === part && t.terminal === terminal)) return net.id;
    }
    return null;
};
const milliamps = (board, part, terminal) => board.branchCurrent(part, terminal) * 1000;

// The wave's own copy, so a claim about a hint is read from the file the app
// ships rather than restated here.
const WAVE = JSON.parse(readFileSync(path.join(ROOT,
    'overlay/scratch-gui/src/components/gui/lesson-waves/measurement-2.json'), 'utf8'));
const lesson = id => {
    const found = WAVE.lessons.find(l => l.id === id);
    assert.ok(found, `${id} is no longer in measurement-2.json`);
    return found;
};

// ── measurement-voltage → 73-voltmeter ──────────────────────────────────────
test('measurement-voltage: the probe spans the full ADC range', async () => {
    const {board, circuit} = await load('73-voltmeter');
    let t = 0n;
    const at = position => {
        circuit.setControl('probe1', position);
        board.advanceTo(t += 20n * MS);
        return volts(board, 'nano', 'a0');
    };
    near(at(0), 0, 0.01, 'wiper at 0%');
    near(at(0.5), 2.5, 0.01, 'wiper at 50%');
    near(at(1), 5.0, 0.01, 'wiper at 100%');
    // The lesson's "about 4.9 mV per count" is 5000/1023 = 4.888 mV.
    near(5000 / 1023, 4.888, 0.002, 'one ADC count');
    assert.equal(Math.round(at(1) / 5 * 1023), 1023, 'full scale reaches the top count');
});

test('RESOLVED UPSTREAM: 73-voltmeter\'s OLED renders — the verbs and the dispatcher both exist now', async () => {
    // This was an OPEN DEFECT when Wave 2 was reviewed at 3e87340f5, and it was
    // true of that tree: the devices extension declared 37 opcodes and not one
    // oled verb, and board.js had no setDeviceControl. Both landed while the
    // review was in flight — 6f8d11c5c vendored the dispatcher, 802fc1050 added
    // eleven OLED/TFT opcodes — so the assertion is inverted rather than deleted,
    // and now guards the fix instead of the defect.
    //
    // READ THROUGH THE UNWRAPPER, NOT THE BUNDLE TEXT (2026-09-20). This used
    // to readFileSync the bundle and scan it for `opcode: '<verb>'`. That held
    // only while the bundle happened to be readable JavaScript with the same
    // quoting as its author used. `devices` is now vendored from
    // CrispStrobe/extensions, and vendor-bundles.mjs renders a bundle as
    // makeExt(<source as a JSON string>) — so every quote inside arrives
    // escaped, the file reads `opcode: \"oledclear\"`, and a regex written for
    // single quotes matched ZERO of the 48 opcodes present. The sentinel fired
    // saying the extension had "lost oledclear again" when nothing had been
    // lost; only the encoding moved. This is the second time a punctuation-
    // shaped scan has been fooled by the JSON re-encoding (the first counted
    // stc12's 30 opcodes as 1), so it reads through the repo's own unwrapper,
    // which EVALUATES the bundle with a stubbed adapter and hands back the
    // source the extension is actually built from.
    const ext = bundleSource('devices');
    assert.ok(ext, 'the devices bundle did not unwrap — the sentinel below would sweep over nothing');
    const declared = [...ext.matchAll(/opcode: *["']([a-z0-9_]+)["']/g)].map(m => m[1]);
    // Floor: an empty or tiny surface makes every `includes` below vacuous.
    assert.ok(declared.length >= 40,
        `only ${declared.length} opcodes parsed out of the devices source — the reader is broken, ` +
        'and an absent verb below would be indistinguishable from an unreadable file');
    for (const verb of ['oledclear', 'oledcursor', 'oledprint']) {
        assert.ok(declared.includes(verb), `the devices extension has lost ${verb} again`);
    }
    // Proven by executing the dispatcher, not by looking the symbols up.
    const {board} = await load('73-voltmeter');
    board.advanceTo(50n * MS);
    assert.equal(typeof board.setDeviceControl, 'function');
    for (const [verb, value] of [['clear', 1], ['cursor', [0, 0]], ['print', 'VOLTMETER']]) {
        assert.equal(board.setDeviceControl('oled1', verb, value), true,
            `the ssd1306 model refused ${verb} — 73-voltmeter's screen is dark again`);
    }
});

// ── measurement-current-burden → 74-ammeter ─────────────────────────────────
test('measurement-current-burden: Vshunt/I recovers the shunt at every load', async () => {
    const {board, circuit} = await load('74-ammeter');
    let t = 0n;
    for (const position of [0.25, 0.5, 0.75]) {
        circuit.setControl('load1', position);
        board.advanceTo(t += 20n * MS);
        const vShunt = volts(board, 'shunt1', 'a');
        const current = -milliamps(board, 'shunt1', 'a') / 1000;
        near(vShunt / current, 10, 0.001, `shunt recovered at load ${position}`);
    }
    // and the lesson's I = V/(Rload + Rshunt) holds: 1k pot at 50% is 500 ohm.
    circuit.setControl('load1', 0.5);
    board.advanceTo(t += 20n * MS);
    near(-milliamps(board, 'shunt1', 'a'), 5000 / 510, 0.01, 'I = 5 V / (500 + 10)');
});

test('measurement-current-burden: 74-ammeter\'s LCD renders what the program prints', async () => {
    // Was an OPEN DEFECT, and the narrowing mattered. The original finding was
    // "setDeviceControl is defined nowhere", true at 3e87340f5 and fixed by
    // 6f8d11c5c. What was left was one device model: of the four display kinds
    // this corpus uses, char_lcd_i2c was the ONLY one without a control()
    // handler — and it is the kind 74-ammeter seats. Fixed at the source
    // 2026-08-24 (bw-board 6df60a5); the lesson is version 3 and asks for the
    // display again.
    const {getDevice} = await import(path.join(ROOT,
        'node_modules/bw-board/src/devices.js'));
    const {board} = await load('74-ammeter');
    board.advanceTo(50n * MS);
    assert.equal(board.parts.find(p => p.id === 'lcd1').kind, 'char_lcd_i2c');

    for (const kind of ['char_lcd', 'hd44780', 'ssd1306', 'char_lcd_i2c']) {
        assert.equal(typeof getDevice(kind)?.control, 'function',
            `${kind} has lost its control handler — a display kind without one is blank in ` +
            'simulation with nothing to say why, which is what cost this lesson its screen');
    }

    // Executed rather than inferred: the verbs the lesson's program issues.
    for (const [verb, value] of [['clear', 1], ['cursor', [0, 0]], ['print', 'I = 9.80 mA'],
        ['cursor', [1, 0]], ['print', 'Vsh 98.0 mV']]) {
        assert.equal(board.setDeviceControl('lcd1', verb, value), true,
            `the I2C LCD refused ${verb}`);
    }
    assert.deepEqual(board.getDeviceState('lcd1').display,
        ['I = 9.80 mA     ', 'Vsh 98.0 mV     '],
        'the verb path must write the same display rows the I2C decode writes');
});

// ── measurement-resistance → 22-series-parallel ─────────────────────────────
test('measurement-resistance: no bare parallel pair is exposed to the probes', async () => {
    const {board} = await load('22-series-parallel');
    board.advanceTo(50n * MS);
    assert.equal(board.resistance(netId(board, 'r1', 'a'), netId(board, 'r1', 'b')),
        'requires-power-off', 'the ohmmeter refuses while powered, as the lesson says');
    board.setPower(false);
    board.advanceTo(60n * MS);
    near(board.resistance(netId(board, 'r1', 'a'), netId(board, 'r1', 'b')), 470, 1, 'one resistor alone');
    // Both LED-dominated readings moved with the junction model, not with the
    // bench: bw-board 74d42338 made LEDs exponential by default, and an
    // ohmmeter's answer across a diode is V/I at its test current. 1806 -> 1664 Ω
    // for one LED, 1982 -> 1803 Ω rail to rail (both -8..-9%, past their bands). Tolerances unchanged; the lesson's measure
    // hint was re-quoted with them.
    near(board.resistance(netId(board, 'led1', 'anode'), netId(board, 'led1', 'cathode')),
        1663.7607, 60, 'one LED alone, under the 1 mA test current');
    near(board.resistance(netId(board, 'vcc1', 'vcc'), netId(board, 'gnd1', 'gnd')),
        1803.0017, 40, 'the whole network, rail to rail');
    // The v1 hint's 470||470 = 235 ohm is nowhere on this bench.
    assert.ok(Math.abs(board.resistance(netId(board, 'vcc1', 'vcc'), netId(board, 'gnd1', 'gnd')) - 235) > 100,
        'if 235 ohm ever appears here, the v1 hint was right and the review is wrong');
    // The two parallel branch tops are the SAME node.
    assert.equal(netId(board, 'r3', 'a'), netId(board, 'r4', 'a'));
});

// ── measurement-continuity → 76-multimeter ──────────────────────────────────
test('measurement-continuity: connected and open pairs are both available', async () => {
    const {board} = await load('76-multimeter');
    board.advanceTo(50n * MS);
    board.setPower(false);
    board.advanceTo(60n * MS);
    near(board.resistance(netId(board, 'sr0', 'a'), netId(board, 'sr0', 'b')), 220, 1,
        'across one segment resistor — connected');
    assert.ok(board.resistance(netId(board, 'vcc1', 'vcc'), netId(board, 'gnd1', 'gnd')) < 1000,
        'rail to rail is a low-resistance path');
    assert.ok(board.resistance(netId(board, 'btn1', 'a'), netId(board, 'btn1', 'b')) > 1e8,
        'the released MODE button is open');
    assert.ok(board.resistance(netId(board, 'stc151', 'p0.0'), netId(board, 'stc151', 'p0.1')) > 1e8,
        'two unrelated MCU pins are open');
});

// ── measurement-range-error → 76-multimeter ─────────────────────────────────
test('measurement-range-error: the volts divider is exactly the documented /4', async () => {
    const {board, circuit} = await load('76-multimeter');
    let t = 0n;
    for (const position of [0.2, 0.6, 0.9]) {
        circuit.setControl('vsrc1', position);
        board.advanceTo(t += 20n * MS);
        near(volts(board, 'vsrc1', 'wiper') / volts(board, 'stc151', 'p1.0'), 4, 0.001,
            `divider ratio at pot ${position}`);
    }
});

// The OPEN DEFECT sentinel that stood here — "the LM358 stage never reaches its
// documented x46.5" — fired on 2026-08-29 at the bw-board `4ae89b5` vendor bump
// and was retired per its own instruction. bw-board `999eb66`+`187694f` replaced
// the damped integrator's output-step halt with a secant solve on the INPUT
// error. What replaces the sentinel is the measurement it was waiting for.
test('measurement-range-error: the amps stage delivers its documented gain, and saturates where the part does', async () => {
    const {board, circuit} = await load('76-multimeter');
    const documented = 1 + 100000 / 2200;   // 46.4545...
    // RE-DERIVED 2026-11-24. bw-board 1d74deb1 (round 2, 2026-11-23) made the
    // LM358 a finite-gain macromodel with the datasheet's 100 dB open-loop gain
    // (TI SLOS068) and 50 Ω output resistance, so the stage realises the
    // textbook FINITE-gain formula, 0.046% under the ideal — the same oracle
    // bw-board's own analog-amps.test.mjs adopted. With u = A0·(v+ − v−), the
    // output u − Rout·Vout·GL and v− = β·Vout, loaded only by its own feedback
    // pair (the ADC pin is high-Z):
    //   gain = A0 / (1 + Rout/(Rf + Rg) + A0·β)  = 46.43296468
    // Measured 46.43296444 at every load: still hand arithmetic, still 1e-6,
    // still input-independent, which was the D18 point.
    const A0 = 1e5, ROUT = 50, RF = 100000, RG = 2200;
    const realised = A0 / (1 + ROUT / (RF + RG) + A0 * RG / (RF + RG));
    let t = 0n;
    const gainAt = position => {
        circuit.setControl('load1', position);
        board.advanceTo(t += 20n * MS);
        return {
            gain: volts(board, 'amp1', '1_out') / volts(board, 'shunt1', 'a'),
            out: volts(board, 'amp1', '1_out'),
            shunt: volts(board, 'shunt1', 'a')
        };
    };
    // Everywhere the output fits inside the swing the gain is the arithmetic,
    // to ten figures, and it does NOT depend on the input any more.
    for (const position of [0.25, 0.5, 0.75, 0.9, 0.95]) {
        const {gain} = gainAt(position);
        near(gain, realised, 1e-6, `closed-loop gain at load ${position}`);
    }
    // The lesson's own numbers, which its `test` hint quotes.
    near(gainAt(0.5).out * 1000, 92.83, 0.01, 'amplifier output at 100 mA, in mV');
    near(gainAt(0.75).out * 1000, 185.58, 0.01, 'amplifier output at 200 mA, in mV');
    // The last click of the pot is the exercise: x46.43 of 98.0 mV asks for
    // 4.552 V, and the macromodel's smooth clamp holds the top swing about
    // 1.5 V under the rail (ground-sensing-opamp.js, VCC − 1.5 V).
    const full = gainAt(1);
    near(full.shunt * 1000, 98.04, 0.01, 'shunt drop at full pot travel, in mV');
    assert.ok(full.shunt * documented > 4.5,
        'full travel should ask for more than the amplifier can swing');
    near(full.out, 3.4983, 0.001, 'the saturated output, one swing below the 5 V rail');
    near(full.gain, 35.6831, 0.001, 'and the realised gain there');
    // The hints were re-worded when this became true, so the content version moves.
    assert.equal(lesson('measurement-range-error').version, 3,
        'the measurement-range-error hints changed, so its content version must move with it');
    for (const lang of ['en', 'de']) {
        const test_ = lesson('measurement-range-error').checkpoints.find(c => c.id === 'test');
        assert.ok(/46[.,]4545/.test(test_.copy[lang].hint),
            `the ${lang} test hint must quote the resistors' arithmetic`);
        assert.ok(/46[.,]433/.test(test_.copy[lang].hint),
            `the ${lang} test hint must quote the gain the bench now delivers`);
        assert.ok(!/46[.,]5 (predicts|93)|erreicht seine Verstärkung nicht/.test(test_.copy[lang].hint),
            `the ${lang} test hint still describes the defect that was fixed`);
    }
});

// ── measurement-function-generator / scope-* → 49, 50 ───────────────────────
test('measurement-function-generator: the generator is 0-5 V, 5 Vpp, 1 ms, and its controls are live', async () => {
    const {Circuit} = await boot();
    const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circuitPathFor('49-function-generator-sine')), 'utf8'));
    // The declared key must stay `freq`: mna.js reads p.freq and ignores
    // `frequency`, which is how this bench ran at 1 kHz whatever its file said.
    assert.ok('freq' in raw.parts.find(p => p.id === 'fg1').params,
        'the generator declares `freq`; `frequency` is silently ignored by mna.js');

    const shape = data => {
        const circuit = Circuit.fromJSON(data);
        let min = Infinity;
        let max = -Infinity;
        let prev = null;
        let first = null;
        let last = null;
        let crossings = 0;
        for (let i = 1; i <= 2000; i++) {
            circuit.board.advanceTo(BigInt(i * 17) * 1000n);
            const v = volts(circuit.board, 'fg1', 'pos');
            min = Math.min(min, v);
            max = Math.max(max, v);
            const rel = v - 2.5;
            if (prev !== null && prev < 0 && rel >= 0) {
                if (first === null) first = i * 17;
                last = i * 17;
                crossings++;
            }
            prev = rel;
        }
        return {min, max, period: crossings > 1 ? (last - first) / (crossings - 1) : NaN};
    };
    const shipped = shape(structuredClone(raw));
    near(shipped.min, 0, 0.01, 'valley');
    near(shipped.max, 5, 0.01, 'peak');
    near(shipped.period, 1000, 1, 'period in us');

    // The `test` checkpoint says to change one control at a time. All three must move it.
    const quieter = structuredClone(raw);
    quieter.parts.find(p => p.id === 'fg1').params.amplitude = 1.0;
    near(shape(quieter).max - shape(quieter).min, 2.0, 0.02, 'amplitude control is live');
    const slower = structuredClone(raw);
    slower.parts.find(p => p.id === 'fg1').params.freq = 250;
    near(shape(slower).period, 4000, 4, 'frequency control is live');
});

test('measurement-scope-probes-scale: the RC output is small but visible against the input', async () => {
    const {board} = await load('50-rc-scope');
    let iMin = Infinity;
    let iMax = -Infinity;
    let oMin = Infinity;
    let oMax = -Infinity;
    for (let i = 1; i <= 6000; i++) {
        board.advanceTo(BigInt(i * 13) * 1000n);
        if (i * 13 < 60000) continue;          // let the DC transient settle
        const vi = volts(board, 'fg1', 'pos');
        const vo = volts(board, 'c1', 'a');
        iMin = Math.min(iMin, vi); iMax = Math.max(iMax, vi);
        oMin = Math.min(oMin, vo); oMax = Math.max(oMax, vo);
    }
    near(iMax - iMin, 5.0, 0.05, 'input Vpp');
    // EXPECTED.md predicts 5.0 x 0.157 = 0.78 V. This is the number the
    // `frequency` -> `freq` fix restored; before it the bench gave 0.084 V.
    near(oMax - oMin, 0.786, 0.02, 'output Vpp across the capacitor');
    near((oMax + oMin) / 2, 2.5, 0.02, 'the DC offset passes through');
    // At the lesson's suggested 1 V/div the output is under one division, and
    // the scope's V/div is global rather than per channel — recorded because the
    // lesson's own advice warns against a tiny trace without saying so.
    assert.ok((oMax - oMin) < 1.0 && (oMax - oMin) > 0.5,
        'the output sits under one division at 1 V/div');
});

// ── measurement-rc-cursors → 43-rc-timing ───────────────────────────────────
test('measurement-rc-cursors: tau is 1 s and 63.2% is 3.16 V, exactly as taught', async () => {
    const {board} = await load('43-rc-timing');
    const landmarks = {};
    for (const ms of [500, 1000, 2000, 3000]) {
        board.advanceTo(BigInt(ms) * MS);
        landmarks[ms] = volts(board, 'c1', 'a');
    }
    near(landmarks[500], 1.9673, 0.01, '0.5 tau');
    near(landmarks[1000], 3.1606, 0.01, '1 tau — the lesson quotes 3.16 V');
    near(landmarks[2000], 4.3233, 0.01, '2 tau');
    near(landmarks[3000], 4.7511, 0.01, '3 tau');
});

test('RESOLVED (was OPEN DEFECT): the discharge switch makes the RC step repeatable', async () => {
    // The sentinel fired on 2026-08-25: sb3-creator ac83352 gave the bench a
    // switch. It is a DISCHARGE switch (c1.a -> switch -> 1 kΩ -> gnd), not the
    // charge switch this review asked for, and the difference is load-bearing:
    // a charge switch open at rest would make this bench read 0 V in its first
    // DC operating point, and this is the bench Wave 6 uses to demonstrate the
    // engine reading the SUPPLY there (its D23 sentinel, still open, and
    // signals-rc-response's hint both depend on it). A bench change that stops
    // a live defect reproducing on the only bench that shows it is not a fix.
    const {board, circuit} = await load('43-rc-timing');
    // The only SWITCH on the bench is the discharge switch — not a charge switch,
    // whose open-at-rest state would read 0 V in the first DC operating point and
    // defeat the benches that show the engine reading the SUPPLY at rest (Wave 6's
    // D23 sentinel, signals-rc-response's hint). vcc is ALSO a control now — a
    // supply you can turn (bw-board ebf77e9e) — which is orthogonal to this claim:
    // it is the source, not a switch, and the charge-from-rest landmarks below
    // prove the rest state still reads that supply rather than 0 V.
    const controls = circuit.getControls().map(c => (typeof c === 'string' ? {id: c, kind: 'switch'} : c));
    const switchIds = controls.filter(c => c.kind === 'switch' || c.kind === 'button').map(c => c.id);
    assert.deepEqual(switchIds, ['sw_discharge'],
        'the only switch on the bench is the discharge switch, not a charge switch');

    // 1. The charge from t=0 is UNTOUCHED. An open switch stamps 1e-12 S, and
    //    these are the same four landmarks the test above pins — asserted here
    //    too, because "adding a branch changed nothing" is the claim that makes
    //    this repair safe, and it is worth failing loudly if it stops holding.
    let t = 0n;
    const at = ms => { board.advanceTo(t = BigInt(ms) * MS); return volts(board, 'c1', 'a'); };
    near(at(500), 1.9673, 0.001, '0.5 tau with the discharge branch present');
    near(at(1000), 3.1606, 0.001, '1 tau');
    near(at(2000), 4.3233, 0.001, '2 tau');
    near(at(3000), 4.7511, 0.001, '3 tau');

    // 2. Closing it drains toward the divider floor, not to zero: the charging
    //    resistor stays connected, so the floor is 5 * 1k/11k with a time
    //    constant of (1k || 10k) * 100 uF = 90.9 ms. A tenth of a second is
    //    therefore NOT enough to clear the capacitor — measured 1.8847 V at
    //    100 ms against 0.4721 V at 500 ms — which is why the restored hint
    //    tells the learner to hold it closed for about half a second.
    circuit.setControl('sw_discharge', 1);
    const tClosed = t;
    board.advanceTo(t = tClosed + 100n * MS);
    const oneTau = volts(board, 'c1', 'a');
    assert.ok(oneTau > 1.5,
        `one discharge time constant leaves ${oneTau.toFixed(4)} V — still most of the charge`);
    board.advanceTo(t = tClosed + 500n * MS);
    const v0 = volts(board, 'c1', 'a');
    near(v0, 5 * 1000 / 11000, 0.05,
        'half a second closed: the cap is at the 10k/1k divider floor, 0.4545 V');

    // 3. Reopening runs the step AGAIN, and the rise obeys the GENERAL form —
    //    not the from-zero one. Getting that wrong is the trap the restored hint
    //    warns about, so it is pinned to the millivolt rather than to a band.
    circuit.setControl('sw_discharge', 0);
    const t0 = t;
    for (const secs of [0.5, 1, 2, 3]) {
        board.advanceTo(t = t0 + BigInt(Math.round(secs * 1000)) * MS);
        near(volts(board, 'c1', 'a'), 5 + ((v0 - 5) * Math.exp(-secs)), 0.002,
            `recharge at ${secs} tau follows Vf+(V0-Vf)e^(-t/RC)`);
    }
});

test('both RC lessons were restored when their bench was, in both languages', () => {
    // The pairing this campaign keeps getting wrong in one direction or the
    // other: a bench repaired while its lesson keeps the workaround, or an
    // English hint restored beside a stale German one. Both are checked here.
    const cursors = lesson('measurement-rc-cursors');
    assert.equal(cursors.version, 3,
        'the measurement-rc-cursors hint changed, so its content version must move with it');
    const measure = cursors.checkpoints.find(c => c.id === 'measure').copy;
    for (const [lang, stale, fresh] of [
        ['en', /no switch|reload the example/, /discharge switch/],
        ['de', /keinen Schalter|lade das Beispiel neu/, /Entlade-?[Ss]chalter/]]) {
        assert.ok(!stale.test(measure[lang].hint),
            `the ${lang} hint still tells the learner to reload; the bench has a control now`);
        assert.match(measure[lang].hint, fresh, `the ${lang} hint names the control`);
    }
    // And the number that was wrong when the hint was first restored: the fall
    // has a 0.1 s time constant but settles at 0.45 V rather than 0 V, so "it
    // falls to about 0.45 V in a tenth of a second" was false by 1.4 V.
    assert.ok(!/0\.45 V in a tenth of a second/.test(measure.en.hint),
        'one discharge time constant leaves the capacitor at 1.88 V, not at the floor');
});

test('OPEN DEFECT: the ohmmeter answers differently depending on which probe is which', async () => {
    // DIRECTIONAL BY DESIGN, not a bug — the distinction was bw-bundle's and it
    // is the right one. board.resistance(a, b) makes `b` the solver reference,
    // and mna.js then switches ground symbols out of that solve deliberately:
    // "a dangling gnd must not become a shunt path" (mna.js ~354). The
    // consequence is still learner-visible, which is why it stays pinned — a
    // real 2.2 kohm path reads as open if the probes go on the other way round,
    // on the exact measurement measurement-resistance asks for.
    const {board} = await load('22-series-parallel');
    board.advanceTo(50n * MS);
    board.setPower(false);
    board.advanceTo(60n * MS);
    const hot = netId(board, 'vcc1', 'vcc');
    const gnd = netId(board, 'gnd1', 'gnd');
    // 1803.0 +-40, and the tolerance is wide ON PURPOSE: this number is
    // dominated by the LEDs' low-bias behaviour under the ohmmeter's test
    // current, not by the four 470 ohm resistors. It has followed the junction
    // model every time that moved — 2181.8 before the 2026-09-13 vf-convention
    // correction (c100c32da), 1981.8 after it, 1803.0 since bw-board 74d42338
    // made LEDs exponential
    // (a real model change, -9%, not a refinement the band should absorb). A
    // quantity set by the diode model does not deserve a 0.2% pin; +-40 still
    // fails if the network changes.
    near(board.resistance(hot, gnd), 1803.0017, 40, 'probed hot-to-ground — the real path');
    assert.ok(board.resistance(gnd, hot) > 1e6,
        'the ohmmeter has become symmetric. Re-measure, update ' +
        'docs/LESSON-REVIEW-WAVE-2.md and the measurement-resistance hint, then delete this test.');
    // A pair with no ground symbol on either side is symmetric, which is what
    // makes this the gnd-merge rule rather than a general solver asymmetry.
    const a = netId(board, 'r1', 'b');
    const b = netId(board, 'r2', 'a');
    near(board.resistance(a, b), board.resistance(b, a), 1, 'a non-ground pair reads the same both ways');
});
