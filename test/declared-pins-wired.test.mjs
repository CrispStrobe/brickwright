/**
 * Tier 2.1 — declared pins must equal wired pins.
 *
 * docs/VERIFICATION-AUTOMATION.md: "Every `PIN x = P2.1 OUTPUT` in program.bw
 * must be wired in circuit.json; every affordance part (button, pot, switch)
 * must be read or driven by the program, or carry an explicit decorative
 * marker." It needs no per-example authoring, so it scales to the whole corpus.
 *
 * WHAT "WIRED" MEANS, and why this asks the engine.
 * A pad is wired when the engine puts its terminal in a resolved net that has
 * at least two distinct real terminals. It is NOT a walk over `wires`.
 * sb3-creator's test/rail-short.test.mjs documents why a hand-rolled union-find
 * reported 802 shorts in 2,040 files: endpoints come in two dialects MIXED
 * WITHIN ONE FILE — flat {from:'ID', fromTerminal:'t'} and nested
 * {to:{board,hole}} — so keying on part/terminal collapses every breadboard
 * hole into one node. Breadboard topology is real, and it lives in the engine.
 *
 * WHAT "WIRED" MEANS FOR deviceOnly EXAMPLES.
 * A micro:bit or A2 faceplate program is a self-contained board: its pads are
 * on the PCB and there is no circuit to wire them into. Those examples carry no
 * circuit file, so this gate does not ask whether their pads are wired. It
 * asserts the equivalence instead — no circuit IFF deviceOnly — which is what
 * turns "an intro promising a 128x64 OLED for an example with no circuit at
 * all" into a caught defect rather than a silent omission.
 *
 * WHICH ENGINE THIS TESTS.
 * The one lite VENDORS (overlay/scratch-gui/src/lib/{bw-circuit-ui,bw-board}),
 * which is the engine lite ships to users, so a defect here is a defect users
 * get. It needs no sibling checkout and therefore cannot skip in CI. The cost,
 * flagged by bw-audit from the stc12 conformance gap: a vendored-against-
 * vendored comparison cannot see the vendored copy going stale. That is not
 * this gate's job — provenance lives in vendor-pins.json (bw-circuit-ui pinned
 * at 8e666ca) and is gated by test/vendor-manifest-contract.test.mjs. Said out
 * loud so "runs unconditionally" is not mistaken for "compares against
 * upstream".
 *
 * RATCHETS MAY ONLY SHRINK. Fixing an entry deletes it in the same commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
// The emitter's OWN pad mapping, imported not recopied. See INDIRECT_PAD_RESOLVERS.
import {ppiPadTerminal} from '../overlay/scratch-gui/src/lib/bw-asm/pseudocode-8086.js';
import {parseCp1Program} from '../overlay/scratch-gui/src/lib/cp1-program.js';
import {isOnboardCp1Circuit} from './helpers/onboard-cp1-circuit.mjs';

const root = path.resolve(import.meta.dirname, '..');
const cui = path.join(root, 'node_modules/bw-circuit-ui/src');
const bwb = path.join(root, 'node_modules/bw-board/src');
const EXAMPLES = path.join(root, 'overlay/scratch-gui/examples');

/** Parts that provide program-addressable pads. Not only the MCU: eater6502
 *  reaches PB0-PB7 through a W65C22 VIA, and keying on MCU kinds alone
 *  reported eight false unwired pins on a correctly wired bench. */
const PAD_PROVIDERS = new Set(['mcu', 'stc_mcu', 'stc15_mcu', 'arduino_uno', 'arduino_nano',
    'arduino_mega', 'pi_pico', 'attiny85', 'attiny88', 'attiny88_qfn32', 'w65c22', 'microbit']);

/** A core may ADDRESS a pad under a name the board does not use for the
 *  terminal. The w65c22 case above needed only the part, because there the
 *  names already matched: the program says PB0 and the VIA's terminal is pb0.
 *  The Z80 goes one step further -- the program says OUT0 and the '374's
 *  terminal is q0 -- so the name has to be resolved too, or eight correctly
 *  wired LEDs read as eight unwired pins.
 *
 *  TWO LIMITS, measured by mutating this alias rather than assumed:
 *    - Aiming it at the '374's D inputs instead of its Q outputs does NOT go
 *      red, and that is correct: the D pins sit on the Z80 data bus and so are
 *      genuinely wired. "Is this pin wired to something" is true either way.
 *      That OUT0 is the Q side is proved where it can be -- sb3-creator's
 *      machine-roms gate reads the emitted __sfr address and the extracted
 *      latch port and requires them equal, then boots the image and watches
 *      the eight LEDs walk. This gate is not the place for it.
 *    - Aiming it at the wrong CHIP does go red, which is what the per-part
 *      lookup below buys.
 *
 *  Deliberately NOT extended to the 74HC244 input side: that chip is two
 *  4-bit halves (1a0-1a3, 2a0-2a3) and which half IN0 means is a wiring
 *  convention this gate has not measured. An unmeasured alias would turn a
 *  real miss into a silent pass, so IN pins stay unresolved and get flagged. */
const PAD_ALIASES = [
    {part: '74hc374', from: /^out([0-7])$/, to: m => `q${m[1]}`},
];

/**
 * A device whose declared pads live on a SUPPORT CHIP under different terminal
 * names than the program writes. Every other device in the corpus is direct:
 * an STC's terminal literally IS "p2.0", the 6502's IS "pb0", so the flat
 * name-match above is right by construction. The 8086 is the first that is not
 * — the pads are on a separate 8255, and a blink written for an 8051 keeps its
 * `PIN led = P2.0` when it reseats onto the 8086, where that pad is the 8255's
 * `pb0`.
 *
 * `resolve` is the EMITTER'S OWN mapping (pseudocode-8086.js's ppiPadTerminal),
 * imported rather than recopied, so this gate cannot pass while disagreeing with
 * what actually runs, nor go stale the day the emitter's rule changes. `part`
 * names the chip the resolved terminal must be wired ON, the way PAD_ALIASES
 * pins the '374 — a terminal of that name elsewhere in the circuit does not
 * count. A resolver returning null for a pad it cannot place (P0 has no 8255
 * home, a bit past 7 is off the port) makes the gate FLAG that pad, never
 * excuse it: an indirect device with an unmappable declared pad is a real miss.
 */
const INDIRECT_PAD_RESOLVERS = {
    i8086: {part: 'i8255', resolve: ppiPadTerminal},
};

/** Every terminal name a declared pad could legitimately be wired as. */
const padResolves = (row, pad) => {
    if (row.wired.has(pad)) return true;
    for (const a of PAD_ALIASES) {
        const m = pad.match(a.from);
        if (!m) continue;
        // The aliased terminal must be wired ON THAT PART, not merely present
        // somewhere in the circuit under the same name.
        if (row.wiredOn?.get(a.part)?.has(a.to(m))) return true;
    }
    const indirect = INDIRECT_PAD_RESOLVERS[row.device];
    if (indirect) {
        const term = indirect.resolve(pad);
        if (term == null) return false;   // unmappable pad -> flagged, not waved through
        return row.wiredOn?.get(indirect.part)?.has(term) === true;
    }
    return false;
};
const INFRA = new Set(['breadboard', 'breadboard_full', 'breadboard_half', 'breadboard_mini', 'meter']);

/** Interactive or observable parts a learner expects to do something. */
const AFFORDANCE = new Set(['button', 'potentiometer', 'switch', 'slide_switch', 'dip_switch',
    'dip_switch_spst', 'dip_switch_dpst', 'keypad_4x4', 'tilt_switch', 'tilt_sensor', 'ldr',
    'led', 'rgb_led', 'buzzer', 'piezo', 'bargraph', 'seven_segment', 'servo', 'dc_motor',
    'relay', 'neopixel', 'ssd1306', 'char_lcd_i2c', 'max7219', 'pir', 'sound_module']);

/** Power and ground legs are not pads a program reads or drives. Counting them
 *  made every LED whose cathode meets the MCU's GND pin look "on a pad" — 96
 *  false positives that collapsed to 4 once rails were excluded. */
const isRail = (t) => /^(gnd\d*|gnd_\d+|vcc|vdd|vss|v\+|v-|5v|3v3|vin|vbus|vsys|aref|avcc|agnd|rst|reset|xtal\d*)$/i.test(t);

/** Pads that are wired on the PCB and correctly absent from the circuit. */
const ON_PCB_PADS = new Map([
    ['pico01-blink:gp25', 'the Pico\'s onboard LED is on the PCB. bw-board\'s board.js '
        + 'synthesises its net for a seated pi_pico whether or not gp25 is wired.'],
]);

/**
 * Declared pins wired to nothing. RATCHET — may only shrink.
 *
 * This was 13 arduino-sk-* entries of one class: the circuit is a bare board
 * plus power, with the components the program declares simply absent.
 *
 * They were NOT waiting on bw-bundle's repair, and recording them that way
 * would have been wrong: its fix changes a pin's MODE (OUTPUT to PWM/TONE) and
 * the actuation verb, and wires nothing. What actually closed them was
 * REBUILDING THE BENCH FROM ITS OWN PROGRAM, which is a different repair in a
 * different repo — sb3-creator, with bw-board's servo/sensor/panel inference
 * behind it.
 *
 * SHRANK 2026-09-21 from 13 to 2, in two steps. Eight went with the rebuilt
 * benches at sb3-creator 06a78ba2. Three more — p03-love-o-meter,
 * p05-servo-mood and p12-knock-lock — went at 8e1f4d11, where each example's
 * base bench stopped being a copy of its mega variant and became the Uno the
 * catalog names as authored; the parts were in the Uno bench all along and the
 * gate had been reading the wrong file.
 *
 * EMPTY since 2026-09-21, at sb3-creator b7bfd2b7. The last two were the only
 * ones whose benches genuinely lacked the hardware, and both were built
 * upstream rather than exempted here: p04 gained the three pots and the
 * rgb_led its page had always described (it had held ONE pot), and p15 gained
 * the optocoupler its lesson is about — bw-board has registered the device all
 * along — and moved off D13, which was not even the pad its program declares.
 * This gate reported both dead before they were removed: "0 example(s)
 * declared-but-unwired, 2 ratcheted".
 *
 * An empty ratchet is the goal state, not a reason to delete the check: the
 * next example that declares a pin reaching nothing now reds on arrival.
 */
const KNOWN_UNWIRED = new Map([]);

/** Affordance wired to a pad the program never declares. RATCHET — may only shrink. */
const KNOWN_UNREAD = new Map([
    ['arduino-02-blink-without-delay:btn1', 'button on d2, fully wired, no program reads it — '
        + 'a control that looks live and is not. Lesson-named (debug-timing-bugs, wave 5).'],
    ['61-console-pong:s1', 'button on p3.0, not declared'],
    ['61-console-pong:s4', 'button on p3.7, not declared'],
    ['61-console-pong:s5', 'button on p3.6, not declared'],
    // A servo is addressed by CHANNEL, not by its pin: `set 1 angle to 90` lowers
    // to bw_servo_set(1, …) and the driver owns the pin (OCR1A for channel 1).
    // So the pad is genuinely never named by a pin-level operation, and this
    // check cannot see the drive — the same undecidability the 74HC595 note
    // above records, for the same reason.
]);

/** Affordance with no wires at all. RATCHET — may only shrink. */
const KNOWN_UNCONNECTED = new Map([]);

const declaredPins = (src) => [...src.matchAll(/^\s*PIN\s+([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9._]+)\s+([A-Z]+)/gm)]
    .map((m) => ({name: m[1], pad: m[2], mode: m[3]}));
const hasProgramText = (src) => typeof src === 'string' && src.split(/\r?\n/)
    .some(line => line.trim() && !/^\s*(?:#|\/\/)/.test(line));

/** The DEVICE the program dispatches on — the same token the emitter reads, so
 *  an indirect-pad resolver keys on what actually runs. */
const declaredDevice = (src) => (src.match(/^\s*DEVICE\s+(\S+)/m) || [])[1];

let ENGINE = null;
async function engine () {
    if (ENGINE) return ENGINE;
    for (const p of [path.join(cui, 'model/circuit.js'), path.join(bwb, 'board.js')]) {
        assert.ok(existsSync(p), `vendored engine missing at ${p} — this gate compares against `
            + 'the engine lite ships; without it there is nothing to compare and it must fail, not skip');
    }
    const {setEngine} = await import(path.join(cui, 'engine.js'));
    const {BoardImpl} = await import(path.join(bwb, 'board.js'));
    const {inferNetlist, checkWiring} = await import(path.join(bwb, 'infer-netlist.js'));
    const {hasDevice, getDevice} = await import(path.join(bwb, 'devices.js'));
    // Before any board is built: an unpopulated device registry resolves almost
    // nothing and reads as "the whole corpus is unwired" (bw-lessons, and the
    // 44-circuit blast radius of 2026-08-20).
    (await import(path.join(bwb, 'register-all.js'))).registerAllDevices();
    setEngine({BoardImpl, inferNetlist, checkWiring, hasDevice, getDevice});
    const {registerSidecar} = await import(path.join(cui, 'model/parts-registry.js'));
    for (const f of readdirSync(path.join(cui, 'parts-data'))) {
        if (!f.endsWith('.json')) continue;
        try {
            const sc = JSON.parse(readFileSync(path.join(cui, 'parts-data', f), 'utf8'));
            if (sc.kind) registerSidecar(sc);
        } catch { /* the sidecar repo has its own gate */ }
    }
    ENGINE = await import(path.join(cui, 'model/circuit.js'));
    return ENGINE;
}

/** Everything the corpus walk derives, computed once. */
const {isDeviceOnlyExample, noCircuitMessage} = await import(
    path.join(root, 'overlay/scratch-gui/src/lib/example-device-only.js'));

async function survey () {
    const {Circuit, resetIds} = await engine();
    const index = JSON.parse(readFileSync(path.join(EXAMPLES, 'index.json'), 'utf8'));
    const rows = [];
    for (const e of index) {
        const progRel = e.files?.program;
        const circRel = e.files?.circuit;
        const progPath = progRel && path.join(EXAMPLES, progRel);
        const progSrc = progPath && existsSync(progPath) ? readFileSync(progPath, 'utf8') : null;
        const pins = progSrc ? declaredPins(progSrc) : [];
        const device = progSrc ? declaredDevice(progSrc) : undefined;
        // main's shared predicate, not the inlined expression this branch
        // forked from: example-device-only.js is now the ONE definition and
        // the Circuit tab imports the same one.
        const deviceOnly = isDeviceOnlyExample(e);
        const row = {id: e.id, pins, device, deviceOnly, hasProgram: hasProgramText(progSrc),
            hasCircuit: !!(circRel && existsSync(path.join(EXAMPLES, circRel)))};
        rows.push(row);
        if (!row.hasCircuit) continue;
        let c;
        let source;
        try {
            resetIds();
            const raw = JSON.parse(readFileSync(path.join(EXAMPLES, circRel), 'utf8'));
            source = raw.circuit || raw;
            c = Circuit.fromJSON(source);
        } catch (err) { row.loadError = err.message.slice(0, 80); continue; }
        const cp1Path = e.files?.cp1 && path.join(EXAMPLES, e.files.cp1);
        const cp1Program = cp1Path && existsSync(cp1Path) ? readFileSync(cp1Path, 'utf8') : null;
        row.onboardCp1 = isOnboardCp1Circuit({entry: e, source, circuit: c, program: cp1Program, pins});
        const byId = new Map(c.parts.map((p) => [p.id, p]));
        const wired = new Set();        // every terminal in a multi-terminal net
        // ...and the same, kept per PART KIND. `wired` is a flat set of names,
        // so it cannot tell the '374's q0 from the Z80's d0; an alias checked
        // against it passes while pointing at the wrong silicon (measured: an
        // alias aimed at the latch's D inputs instead of its Q outputs stayed
        // green). Alias resolution uses this instead.
        const wiredOn = new Map();      // part kind -> terminals wired on it
        const padsOf = new Map();       // part id -> signal pads it shares a net with
        const anyWire = new Set();
        for (const net of (c.resolvedNets || [])) {
            const real = net.terminals.filter((t) => typeof t.part === 'string'
                && !t.part.startsWith('@bb:') && !INFRA.has(byId.get(t.part)?.kind));
            const uniq = [...new Set(real.map((t) => `${t.part}.${String(t.terminal).toLowerCase()}`))];
            if (uniq.length < 2) continue;
            const pads = new Set(real.filter((t) => PAD_PROVIDERS.has(byId.get(t.part)?.kind))
                .map((t) => String(t.terminal).toLowerCase()).filter((t) => !isRail(t)));
            for (const t of real) {
                const term = String(t.terminal).toLowerCase();
                wired.add(term);
                const kind = byId.get(t.part)?.kind;
                if (kind) {
                    if (!wiredOn.has(kind)) wiredOn.set(kind, new Set());
                    wiredOn.get(kind).add(term);
                }
                anyWire.add(t.part);
                if (!padsOf.has(t.part)) padsOf.set(t.part, new Set());
                for (const p of pads) padsOf.get(t.part).add(p);
            }
        }
        row.wired = wired;
        row.wiredOn = wiredOn;
        row.parts = c.parts;
        row.padsOf = padsOf;
        row.anyWire = anyWire;
        row.declaredPads = new Set(pins.map((p) => p.pad.toLowerCase()));
    }
    return rows;
}

const ROWS = await survey();

/**
 * bw-audit's rule, learned from a mutation that silently changed nothing: assert
 * the instrument's own yield BEFORE trusting any verdict it produces. A detector
 * that matches nothing makes every downstream assertion pass vacuously and looks
 * exactly like success.
 */
// Report lines go through t.diagnostic(): a child's console.log is RAW on the runner's stdout pipe
// and is the deserialize flake (docs/GATES-THAT-CANNOT-FAIL.md, species 26).
test('INSTRUMENT: the corpus walk actually derived something', t => {
    const report = (...a) => t.diagnostic(a.join(' '));
    const withPins = ROWS.filter((r) => r.pins.length);
    const withPrograms = ROWS.filter((r) => r.hasProgram);
    const withCircuit = ROWS.filter((r) => r.hasCircuit);
    const resolved = ROWS.filter((r) => r.wired && r.wired.size > 0);
    const onboard = ROWS.filter((r) => r.onboardCp1);
    const failed = ROWS.filter((r) => r.loadError);
    report(`\nTier 2.1 survey: ${ROWS.length} index entries, ${withPrograms.length} contain program text, `
        + `${withPins.length} declare pins, `
        + `${withCircuit.length} have a circuit, ${resolved.length} resolved a non-empty netlist, `
        + `${onboard.length} validated CP1 listings use only the machine's internal wiring`);
    for (const r of failed.slice(0, 10)) report(`  load failed: ${r.id} — ${r.loadError}`);
    assert.equal(failed.length, 0, `${failed.length} circuit(s) failed to load`);

    // Thresholds are PROPORTIONS of counts taken in this same run, not fixed
    // numbers. bw-audit's ">= 25 opcodes" was right at 28 and would have gone
    // on passing if the emitter grew to 200 while the deriver found 30. A
    // constant floor stops tracking the corpus the moment the corpus moves.
    const entries = JSON.parse(readFileSync(path.join(EXAMPLES, 'index.json'), 'utf8')).length;
    assert.equal(ROWS.length, entries,
        `walked ${ROWS.length} of ${entries} index entries — the walk is dropping examples`);

    // Every external circuit must resolve a non-empty netlist. The CP1's
    // arithmetic/display-only lessons have a whole-system connector and no
    // external parts; their registered model, machine configuration and parsed
    // non-I/O listing are validated separately above. An empty registry,
    // stripped peripheral circuit or port-I/O program cannot enter that role.
    // No unexplained empty circuit is allowed (the former tolerance was one).
    const unresolved = withCircuit.filter((r) => (!r.wired || r.wired.size === 0) && !r.onboardCp1);
    assert.equal(unresolved.length, 0,
        `${unresolved.length} circuit(s) resolved an EMPTY netlist: `
        + `${unresolved.slice(0, 5).map((r) => r.id).join(', ')} — a registry that never `
        + 'populated produces exactly this');

    // TERMINAL DEGRADATION IS SILENT, and a non-empty-netlist check cannot see
    // it. Measured 2026-08-23: with NEITHER the sidecar registry nor
    // registerAllDevices, a keypad_4x4 resolves to ["a","b"] — still forming
    // nets, still "resolved", every pad wrong. And each registration MASKS the
    // other's absence, so removing either one alone leaves this gate green;
    // only removing both degrades. That is why this asserts real pin counts
    // rather than trusting either bootstrap step to have run.
    const MULTI_PIN = new Set(['keypad_4x4', 'ssd1306', 'char_lcd_i2c', 'hd44780', 'max7219',
        'seven_segment', 'mcu', 'stc_mcu', 'stc15_mcu', 'arduino_uno', 'arduino_nano',
        'arduino_mega', 'pi_pico', 'w65c22', 'attiny88', 'attiny88_qfn32', 'kosmos-cp1']);
    const degraded = [];
    for (const r of ROWS) {
        for (const p of (r.parts || [])) {
            // Exactly the default pair, not merely a short list: generated
            // benches legitimately TRIM an MCU to the pins they use, e.g.
            // ["P2.1","P2.2"], and flagging those made this fire on a healthy
            // corpus. Degradation has a signature — the literal a/b fallback.
            const t = (p.terminals || []).map((x) => String(x).toLowerCase());
            if (MULTI_PIN.has(p.kind) && t.length === 2 && t[0] === 'a' && t[1] === 'b') {
                degraded.push(`${r.id}:${p.id}(${p.kind})=${JSON.stringify(p.terminals)}`);
            }
        }
    }
    assert.deepEqual(degraded.slice(0, 10), [],
        `${degraded.length} multi-pin part(s) resolved to two or fewer terminals — the default `
        + '["a","b"] fallback. Neither the sidecar registry nor bw-board devices supplied '
        + 'real pins, and every pad this gate checks would be wrong');

    // Declared pins are the gate's whole input; if the extractor stops matching
    // the dialect, every check below passes over nothing. Keep the quarter
    // threshold on actual program text: pure analog and CP1 lessons have no
    // pseudocode, or a comment-only program.bw explaining their separate panel.
    // Adding those lessons cannot dilute the PIN extractor's measured yield.
    assert.ok(withPins.length / withPrograms.length >= 0.25,
        `only ${withPins.length}/${withPrograms.length} examples with program text declare pins — below a quarter, `
        + 'suspect the PIN extractor rather than the corpus');
    assert.ok(withCircuit.length / ROWS.length >= 0.5,
        `only ${withCircuit.length}/${ROWS.length} examples resolved a circuit path`);
});

test('an example with no circuit is a deviceOnly board, not a missing circuit', () => {
    const offenders = ROWS.filter((r) => !r.hasCircuit && !r.deviceOnly)
        .map((r) => `${r.id}: declares ${r.pins.length} pin(s) and has no circuit, and is not deviceOnly`);
    assert.deepEqual(offenders, [], `${offenders.length} example(s) promise hardware with no circuit to wire it into`);
});

test('every declared pin is wired to something', t => {
    const report = (...a) => t.diagnostic(a.join(' '));
    const found = [];
    for (const r of ROWS) {
        if (!r.hasCircuit || !r.wired) continue;
        const missing = r.pins.filter((p) => {
            const pad = p.pad.toLowerCase();
            return !padResolves(r, pad) && !ON_PCB_PADS.has(`${r.id}:${pad}`);
        });
        if (missing.length) found.push({id: r.id, detail: missing.map((p) => `${p.name}@${p.pad}`).join(' ')});
    }
    const unexpected = found.filter((f) => !KNOWN_UNWIRED.has(f.id));
    const fixed = [...KNOWN_UNWIRED.keys()].filter((id) => !found.some((f) => f.id === id));
    report(`declared-but-unwired: ${found.length} example(s), ${KNOWN_UNWIRED.size} ratcheted`);
    for (const f of unexpected) report(`  NEW  ${f.id}: ${f.detail}`);
    assert.deepEqual(unexpected.map((f) => f.id), [],
        `${unexpected.length} example(s) declare a pin wired to nothing`);
    assert.deepEqual(fixed, [], `ratchet entr(ies) no longer reproduce — delete them: ${fixed.join(', ')}`);
});

test('every affordance part is wired to something', t => {
    const report = (...a) => t.diagnostic(a.join(' '));
    const found = [];
    for (const r of ROWS) {
        if (!r.hasCircuit || !r.parts) continue;
        for (const p of r.parts) {
            if (!AFFORDANCE.has(p.kind)) continue;
            if (p.decorative || p.params?.decorative) continue;
            if (!r.anyWire.has(p.id)) found.push(`${r.id}:${p.id}`);
        }
    }
    const unexpected = found.filter((k) => !KNOWN_UNCONNECTED.has(k));
    const fixed = [...KNOWN_UNCONNECTED.keys()].filter((k) => !found.includes(k));
    for (const f of unexpected) report(`  NEW unconnected affordance: ${f}`);
    assert.deepEqual(unexpected, [], `${unexpected.length} affordance part(s) carry no wires at all`);
    assert.deepEqual(fixed, [], `ratchet entr(ies) no longer reproduce — delete them: ${fixed.join(', ')}`);
});

test('every affordance on a pad is read or driven by the program', t => {
    const report = (...a) => t.diagnostic(a.join(' '));
    const found = [];
    for (const r of ROWS) {
        if (!r.hasCircuit || !r.parts || !r.declaredPads.size) continue;
        for (const p of r.parts) {
            if (!AFFORDANCE.has(p.kind)) continue;
            if (p.decorative || p.params?.decorative) continue;
            const pads = r.padsOf.get(p.id);
            // No pad at all means driven indirectly — through a 74HC595 or a
            // transistor — and not decidable from declarations. Counting those
            // produced 96 false positives.
            if (!pads || pads.size === 0) continue;
            if (![...pads].some((t) => r.declaredPads.has(t))) {
                found.push({key: `${r.id}:${p.id}`, detail: `${p.kind} on [${[...pads].join(',')}]`});
            }
        }
    }
    const unexpected = found.filter((f) => !KNOWN_UNREAD.has(f.key));
    const fixed = [...KNOWN_UNREAD.keys()].filter((k) => !found.some((f) => f.key === k));
    report(`affordance-not-read: ${found.length}, ${KNOWN_UNREAD.size} ratcheted`);
    for (const f of unexpected) report(`  NEW  ${f.key}: ${f.detail}`);
    assert.deepEqual(unexpected.map((f) => f.key), [],
        `${unexpected.length} affordance(s) sit on a pad no program reads`);
    assert.deepEqual(fixed, [], `ratchet entr(ies) no longer reproduce — delete them: ${fixed.join(', ')}`);
});

/**
 * A declared name implies a part kind. `PIN ldr = A0 ANALOG` wired to a
 * potentiometer is the light-theremin defect: electrically the bench "works",
 * because a pot and an LDR are both a resistance to the ADC, so only the
 * lesson is wrong. A wired/unwired check cannot see it — A0 IS wired.
 *
 * Conservative by construction: it fires only when the name clearly implies a
 * kind AND some affordance of a DIFFERENT kind sits on that pad AND no part of
 * the implied kind does. A pad with nothing recognisable on it says nothing.
 */
const NAME_IMPLIES = [
    [/^(ldr|photocell|photoresistor|lightsensor)/i, new Set(['ldr'])],
    [/^(pot|poti|potentiometer|knob)/i, new Set(['potentiometer'])],
    [/^(btn|button|key|push)/i, new Set(['button', 'keypad_4x4'])],
    [/^(speaker|buzzer|piezo|sounder|tone)/i, new Set(['buzzer', 'piezo'])],
    [/^(servo)/i, new Set(['servo'])],
    [/^(motor|fan)/i, new Set(['dc_motor', 'gearmotor'])],
    [/^(tilt)/i, new Set(['tilt_switch', 'tilt_sensor'])],
    [/^(relay)/i, new Set(['relay'])],
    // Sensor modules that drive their own output (bw-board #404 infers them
    // from these names). A button standing in for a PIR "works" -- the pin
    // reads a level -- and only the lesson is wrong, the LDR-as-knob species.
    [/^(pir|motion|presence)/i, new Set(['pir'])],
    [/^(sound|noise|clap|mic|loud)/i, new Set(['sound_module'])],
];

/**
 * Declared names standing in for a part the circuit does not have. RATCHET.
 *
 * All three are one root cause, and it is a GENERATOR choice, not three
 * authoring slips: bench synthesis maps an ANALOG pin to a potentiometer
 * whatever the pin is called, so the part arrives literally named `POT_ldr`.
 * An `ldr` kind exists in the catalog (src/parts-data/ldr.json), so this is a
 * substitution, not a limitation. Fixing it upstream clears all three at once;
 * fix the synthesis rather than the three benches.
 *
 * Why nothing caught it before: a pot and an LDR are both a resistance to the
 * ADC, so the bench reads a plausible number and only the teaching is wrong.
 * Both intros promise "a light-dependent resistor (LDR)" and tell the learner
 * to cover it with their hand.
 */
const KNOWN_KIND_MISMATCH = new Map([
]);

test('a declared name matches the kind of part on its pad', t => {
    const report = (...a) => t.diagnostic(a.join(' '));
    const found = [];
    for (const r of ROWS) {
        if (!r.hasCircuit || !r.parts || !r.padsOf) continue;
        // pad -> affordance kinds sitting on it
        const kindsOnPad = new Map();
        for (const p of r.parts) {
            if (!AFFORDANCE.has(p.kind)) continue;
            for (const pad of (r.padsOf.get(p.id) || [])) {
                if (!kindsOnPad.has(pad)) kindsOnPad.set(pad, new Set());
                kindsOnPad.get(pad).add(p.kind);
            }
        }
        for (const pin of r.pins) {
            const rule = NAME_IMPLIES.find(([re]) => re.test(pin.name));
            if (!rule) continue;
            const onPad = kindsOnPad.get(pin.pad.toLowerCase());
            if (!onPad || onPad.size === 0) continue;          // nothing recognisable there
            if ([...onPad].some((k) => rule[1].has(k))) continue; // the right kind is present
            found.push({key: `${r.id}:${pin.name}`,
                detail: `${pin.name}@${pin.pad} implies ${[...rule[1]].join('/')}, found ${[...onPad].join('/')}`});
        }
    }
    const unexpected = found.filter((f) => !KNOWN_KIND_MISMATCH.has(f.key));
    const fixed = [...KNOWN_KIND_MISMATCH.keys()].filter((k) => !found.some((f) => f.key === k));
    report(`name-vs-kind mismatches: ${found.length}, ${KNOWN_KIND_MISMATCH.size} ratcheted`);
    for (const f of found) report(`  ${KNOWN_KIND_MISMATCH.has(f.key) ? 'known' : 'NEW  '} ${f.key}: ${f.detail}`);
    assert.deepEqual(unexpected.map((f) => f.key), [],
        `${unexpected.length} declared name(s) do not match the part on their pad`);
    assert.deepEqual(fixed, [], `ratchet entr(ies) no longer reproduce — delete them: ${fixed.join(', ')}`);
});

// ── Canaries: re-introduce each defect, assert the detector fires ──
async function onboardCp1Fixture (id = 'cp1-first-display') {
    const index = JSON.parse(readFileSync(path.join(EXAMPLES, 'index.json'), 'utf8'));
    const entry = index.find(example => example.id === id);
    assert.ok(entry, `${id} must be a real catalog example`);
    const source = JSON.parse(readFileSync(path.join(EXAMPLES, entry.files.circuit), 'utf8'));
    const program = readFileSync(path.join(EXAMPLES, entry.files.cp1), 'utf8');
    const {Circuit, resetIds} = await engine();
    resetIds();
    return {entry, source, program, circuit: Circuit.fromJSON(source)};
}

test('CANARY: onboard CP1 admission rejects broken metadata, structure and device registration', async () => {
    const fixture = await onboardCp1Fixture();
    assert.equal(isOnboardCp1Circuit(fixture), true, 'the real internal-display lesson must be recognised');
    const mutations = [
        ['wrong target', f => { f.entry.target = 'arduino-uno'; }],
        ['wrong lesson kind', f => { f.entry.kind = 'program'; }],
        ['no CP1 listing', f => { delete f.entry.files.cp1; }],
        ['declared external pad', f => { f.pins = [{name: 'led', pad: 'P1.0'}]; }],
        ['no authored computer', f => { f.source.parts = []; }],
        ['unwired peripheral', f => { f.source.parts.push({id: 'led', kind: 'led'}); }],
        ['dangling wire', f => { f.source.wires.push({from: 'cp1', fromTerminal: 'P1.0', to: 'missing'}); }],
        ['hole jumper', f => { f.source.holeWires.push({boardId: 'missing', a: 'a1', b: 'b1'}); }],
        ['malformed nets', f => { f.source.nets = {}; }],
        ['unsupported clock', f => { f.source.parts[0].params.clockHz = 1000000; }],
        ['invalid expansion', f => { f.source.parts[0].params.expansion = 'true'; }],
        ['missing device registration', f => { f.registeredDevice = null; }],
        ['fallback device terminals', f => { f.registeredDevice = {gpioFollowsPinStates: true, terminals: ['a', 'b']}; }],
        ['netlist error', f => { f.circuit.netlistError = 'unregistered device'; }],
        ['empty canonical board', f => { f.circuit.board.parts = []; }],
        ['fallback loaded terminals', f => { f.circuit.parts[0].terminals = ['a', 'b']; }],
        ['fallback board terminals', f => { f.circuit.board.parts[0].terminals = ['a', 'b']; }]
    ];
    for (const [name, mutate] of mutations) {
        const changed = await onboardCp1Fixture();
        mutate(changed);
        assert.equal(isOnboardCp1Circuit(changed), false, name);
    }
});

test('CANARY: CP1 port instructions and stripped peripheral lessons still require external nets', async () => {
    const fixture = await onboardCp1Fixture();
    const {Circuit} = await engine();
    // Enable CP3 in both authored and loaded views so expansion port controls
    // fail for requiring external wires, not for an invalid machine setup.
    fixture.source.parts[0].params.expansion = true;
    fixture.circuit = Circuit.fromJSON(fixture.source);
    assert.equal(isOnboardCp1Circuit(fixture), true, 'CP3 still permits an internal-display listing');
    for (const program of ['', 'DATA 42', 'NOT_AN_INSTRUCTION',
        'P1E 1', 'P1A 1', 'P2A 1', 'P3E 1', 'P4A 1', 'P5A 1', '17.001']) {
        if (/^P|^17\./.test(program)) {
            assert.equal(parseCp1Program(program, {expansion: true}).ok, true,
                `${program} must be a valid I/O instruction for this negative control`);
        }
        assert.equal(isOnboardCp1Circuit({...fixture, program}), false, JSON.stringify(program));
    }
    const wired = await onboardCp1Fixture('cp1-blink');
    assert.equal(isOnboardCp1Circuit(wired), false, 'a real wired lesson remains on the electrical path');
    wired.source.wires = [];
    wired.source.holeWires = [];
    wired.circuit = Circuit.fromJSON(wired.source);
    assert.equal(isOnboardCp1Circuit(wired), false, 'stripping wires leaves real peripherals to validate');
    wired.source.parts = wired.source.parts.filter(part => part.kind === 'kosmos-cp1');
    wired.circuit = Circuit.fromJSON(wired.source);
    assert.equal(isOnboardCp1Circuit(wired), false, 'stripping the peripherals cannot erase the port-I/O listing');
    assert.equal(isOnboardCp1Circuit(await onboardCp1Fixture()), true,
        'the positive control must still be admitted after the negative cases');
});

test('CANARY: the PIN extractor reads program declarations and ignores comment-only lessons', () => {
    const program = '# PIN ignored = D7 INPUT\nDEVICE arduino-uno\n'
        + 'PIN led = D13 OUTPUT\n  PIN button = P1.0 INPUT\nPIN knob = A0 ANALOG\n';
    assert.equal(hasProgramText(program), true);
    assert.deepEqual(declaredPins(program), [
        {name: 'led', pad: 'D13', mode: 'OUTPUT'},
        {name: 'button', pad: 'P1.0', mode: 'INPUT'},
        {name: 'knob', pad: 'A0', mode: 'ANALOG'}
    ]);
    for (const comments of ['', '# Open program.cp1 in its panel.\n', '// Analog circuit, no program.\n']) {
        assert.equal(hasProgramText(comments), false);
        assert.deepEqual(declaredPins(comments), []);
    }
    assert.equal(hasProgramText('WHEN flag clicked:\n set value to 1'), true,
        'a program with no DEVICE or PIN declaration must remain in the yield denominator');
});

test('CANARY: an unwired declared pin is detected', () => {
    const wired = new Set(['d13', 'gnd', 'vcc']);
    const pins = [{name: 'led', pad: 'D13'}, {name: 'btn', pad: 'D2'}];
    const missing = pins.filter((p) => !wired.has(p.pad.toLowerCase()));
    assert.deepEqual(missing.map((p) => p.pad), ['D2'], 'the wired/unwired split must fire on D2 and spare D13');
});

test('CANARY: rails are excluded, and excluding them is what makes the pad test meaningful', () => {
    assert.ok(isRail('gnd') && isRail('GND2') && isRail('vcc') && isRail('5v') && isRail('gnd_1'),
        'rail names must be recognised');
    assert.ok(!isRail('d2') && !isRail('p1.0') && !isRail('gp25') && !isRail('pa0'),
        'signal pads must NOT be treated as rails — that would empty the pad set and pass vacuously');
});

test('CANARY: an indirect-pad device resolves through the emitter, and an unmappable pad is flagged', () => {
    // The 8086 is the corpus's first device whose declared pad (P2.0, an 8051
    // port name kept across the reseat) is NOT the physical terminal (pb0, on
    // the 8255). The gate must map through the emitter's rule, and must FLAG —
    // never excuse — a pad the rule cannot place, or it becomes a gate that
    // silently waves 8086 pins through.
    assert.equal(ppiPadTerminal('P2.0'), 'pb0', 'P2 is 8255 port B');
    assert.equal(ppiPadTerminal('P1.3'), 'pa3');
    assert.equal(ppiPadTerminal('P3.0'), 'pc0');
    assert.equal(ppiPadTerminal('P0.0'), null, 'P0 has no 8255 home');
    assert.equal(ppiPadTerminal('P2.8'), null, 'a bit past 7 is off the port');
    const row = {device: 'i8086', wired: new Set(['pb0']),
        wiredOn: new Map([['i8255', new Set(['pb0'])]])};
    assert.equal(padResolves(row, 'p2.0'), true, 'a wired 8255 port-B pad resolves');
    assert.equal(padResolves(row, 'p2.1'), false, 'an 8255 pad that is NOT wired must not resolve');
    assert.equal(padResolves(row, 'p0.0'), false, 'an unmappable pad is flagged, not waved through');
    // A terminal of the resolved name on the WRONG chip does not count.
    const wrongChip = {device: 'i8086', wired: new Set(['pb0']),
        wiredOn: new Map([['resistor', new Set(['pb0'])]])};
    assert.equal(padResolves(wrongChip, 'p2.0'), false, 'pb0 must be wired on the 8255, not merely present');
    // And the live example carries exactly this shape.
    const blink = ROWS.find((r) => r.id === 'i8086-blink');
    assert.ok(blink && blink.device === 'i8086', 'i8086-blink must be surveyed as an i8086 example');
    assert.deepEqual(blink.pins.map((p) => p.pad), ['P2.0'], 'i8086-blink declares P2.0');
    assert.ok(padResolves(blink, 'p2.0'), 'i8086-blink P2.0 must resolve to a wired 8255 terminal');
});

test('CANARY: the ratchets are live, not decorative', () => {
    // Every ratchet key must name a real example, or the ratchet is silently
    // excusing nothing while looking like it excuses something.
    const ids = new Set(ROWS.map((r) => r.id));
    const stale = [...KNOWN_UNWIRED.keys()].filter((id) => !ids.has(id));
    assert.deepEqual(stale, [], `ratchet names example(s) that do not exist: ${stale.join(', ')}`);
    for (const k of [...KNOWN_UNREAD.keys(), ...KNOWN_UNCONNECTED.keys()]) {
        assert.ok(ids.has(k.split(':')[0]), `ratchet key ${k} names a missing example`);
    }
    // A POPULATION FLOOR IS THE WRONG INSTRUMENT HERE. This line used to read
    // `KNOWN_UNWIRED.size > 0 && KNOWN_UNREAD.size > 0`, which made the goal
    // state — every defect fixed — indistinguishable from the cheat it was
    // written to stop, and reddened the gate the moment the last entry was
    // legitimately removed. The property actually wanted is that the DETECTOR
    // still fires, so drive it: a row declaring a pad that resolves to nothing
    // must be reported, exactly as the gate reports it at line ~385.
    const vacuous = {id: 'synthetic', device: 'arduino-uno', wired: new Set(), wiredOn: new Map(),
        pins: [{name: 'ghost', pad: 'D7', mode: 'OUTPUT'}]};
    const flagged = vacuous.pins.filter((pin) => {
        const pad = pin.pad.toLowerCase();
        return !padResolves(vacuous, pad) && !ON_PCB_PADS.has(`${vacuous.id}:${pad}`);
    });
    assert.deepEqual(flagged.map((p) => p.pad), ['D7'],
        'the declared-but-unwired detector no longer fires on a pin wired to nothing — '
        + 'an empty KNOWN_UNWIRED would then mean the check is dead, not that the corpus is clean');

    // ...AND THE OTHER TWO, which the first version of this replacement left
    // with no liveness test at all. Swapping the floor out covered
    // KNOWN_UNWIRED and silently dropped the (bad) cover KNOWN_UNREAD and
    // KNOWN_UNCONNECTED had, so for those two it was a loss rather than a fix
    // — a check that looks present and holds nothing, which is the shape this
    // canary exists to prevent. Each detector is driven by the same predicate
    // its own test uses, so a detector that stops firing is caught here even
    // while its ratchet is empty.

    // ONE PREDICATE PER DETECTOR, BOTH DIRECTIONS THROUGH IT. Writing the
    // fires/does-not-fire cases as two separate inline filters looked
    // thorough and was not: mutating the first to ignore `anyWire` left this
    // whole canary GREEN, because with an empty anyWire that clause is
    // vacuously true and the second case was reading a different expression.
    // A mutation has to reach every case, so each detector is expressed once.
    const affordanceKind = [...AFFORDANCE][0];

    // UNCONNECTED: an affordance part carrying no wires at all.
    const unconnectedIn = (row) => row.parts.filter((p) => AFFORDANCE.has(p.kind)
        && !p.decorative && !p.params?.decorative && !row.anyWire.has(p.id)).map((p) => p.id);
    const orphanPart = [{id: 'p1', kind: affordanceKind}];
    assert.deepEqual(unconnectedIn({parts: orphanPart, anyWire: new Set()}), ['p1'],
        'the unconnected-affordance detector no longer fires on a part with no wires — '
        + 'an empty KNOWN_UNCONNECTED would mean the check is dead, not that the corpus is clean');
    assert.deepEqual(unconnectedIn({parts: orphanPart, anyWire: new Set(['p1'])}), [],
        'the unconnected detector fires on a WIRED part — it is not reading anyWire, so it '
        + 'would report every affordance in the corpus');

    // UNREAD: an affordance sitting on a pad no program declares.
    const unreadIn = (row) => row.parts.filter((p) => {
        const pads = row.padsOf.get(p.id);
        return pads && pads.size && ![...pads].some((t) => row.declaredPads.has(t));
    }).map((p) => p.id);
    const onD9 = {parts: orphanPart, padsOf: new Map([['p1', new Set(['d9'])]])};
    assert.deepEqual(unreadIn({...onD9, declaredPads: new Set(['d2'])}), ['p1'],
        'the affordance-not-read detector no longer fires on a part whose pad nothing declares — '
        + 'an empty KNOWN_UNREAD would mean the check is dead, not that the corpus is clean');
    assert.deepEqual(unreadIn({...onD9, declaredPads: new Set(['d9'])}), [],
        'the not-read detector fires on a pad the program DOES declare');
    assert.deepEqual(unreadIn({parts: orphanPart, padsOf: new Map(), declaredPads: new Set()}), [],
        'a part with no pad at all must not be reported — indirect drive through a 595 or a '
        + 'transistor is not decidable from declarations, and counting it produced 96 false positives');
});
