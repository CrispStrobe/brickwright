import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cui = path.join(root, 'node_modules/bw-circuit-ui/src');
const bwb = path.join(root, 'node_modules/bw-board/src');
const examples = path.join(root, 'overlay/scratch-gui/examples');
const structuralKinds = new Set(['breadboard', 'vcc', 'gnd']);
const mcuKinds = new Set(['mcu', 'stc_mcu', 'stc15_mcu', 'arduino_uno', 'arduino_nano',
    'arduino_mega', 'pi_pico', 'attiny85', 'attiny88', 'attiny88_qfn32']);

const circuitFiles = () => {
    const result = [];
    for (const dirent of readdirSync(examples, {withFileTypes: true})) {
        if (!dirent.isDirectory()) continue;
        for (const name of readdirSync(path.join(examples, dirent.name))) {
            if (name === 'circuit.json' || /^circuit\.[\w-]+\.json$/.test(name)) {
                result.push(path.join(dirent.name, name));
            }
        }
    }
    return result.sort();
};

const endpoint = (wire, side) => {
    const raw = wire[side];
    if (raw && typeof raw === 'object') return raw.board
        ? {board: raw.board, hole: raw.hole}
        : {part: raw.part, terminal: raw.terminal};
    return {part: raw, terminal: wire[`${side}Terminal`]};
};

test('every shipped circuit resolves every wire endpoint into a real electrical net', async () => {
    assert.ok(existsSync(path.join(cui, 'model/circuit.js')));
    const {setEngine} = await import(path.join(cui, 'engine.js'));
    const {BoardImpl} = await import(path.join(bwb, 'board.js'));
    const {inferNetlist, checkWiring} = await import(path.join(bwb, 'infer-netlist.js'));
    const {hasDevice, getDevice} = await import(path.join(bwb, 'devices.js'));
    (await import(path.join(bwb, 'register-all.js'))).registerAllDevices();
    const getCircuitDevice = kind => kind === 'stc_mcu' ? null : getDevice(kind);
    setEngine({
        BoardImpl,
        inferNetlist,
        checkWiring,
        hasDevice,
        getDevice: getCircuitDevice
    });
    const {registerSidecar} = await import(path.join(cui, 'model/parts-registry.js'));
    for (const name of readdirSync(path.join(cui, 'parts-data'))) {
        if (!name.endsWith('.json')) continue;
        const sidecar = JSON.parse(readFileSync(path.join(cui, 'parts-data', name), 'utf8'));
        if (sidecar.kind) registerSidecar(sidecar);
    }
    const {Circuit} = await import(path.join(cui, 'model/circuit.js'));
    const {resolveTerminal} = await import(path.join(cui, 'model/terminal-aliases.js'));
    const failures = [];
    const files = circuitFiles();

    for (const rel of files) {
        const data = JSON.parse(readFileSync(path.join(examples, rel), 'utf8'));
        const sourceParts = new Map((data.parts || []).map(part => [part.id, part]));
        for (const wire of data.wires || []) for (const side of ['from', 'to']) {
            const ep = endpoint(wire, side);
            if (ep.board) {
                if (sourceParts.get(ep.board)?.kind !== 'breadboard' || !ep.hole) {
                    failures.push(`${rel}: ${side} points to missing board/hole ${ep.board || '?'}.${ep.hole || '?'}`);
                }
            } else if (!sourceParts.has(ep.part) || !ep.terminal) {
                failures.push(`${rel}: ${side} points to missing terminal ${ep.part || '?'}.${ep.terminal || '?'}`);
            }
        }
        for (const jumper of data.holeWires || []) {
            if (sourceParts.get(jumper.boardId)?.kind !== 'breadboard' || !jumper.a || !jumper.b) {
                failures.push(`${rel}: jumper ${jumper.ref || '?'} points into nowhere`);
            }
        }

        let circuit;
        try {
            circuit = Circuit.fromJSON(data);
        } catch (error) {
            failures.push(`${rel}: loader threw ${error.message}`);
            continue;
        }
        if (circuit.netlistError != null) {
            failures.push(`${rel}: engine rejected circuit (${circuit.netlistError})`);
            continue;
        }
        const parts = circuit.board?.parts || [];
        const nets = circuit.board?.nets || [];
        const loadedParts = new Map(parts.map(part => [part.id, part]));
        if (!parts.length) {
            failures.push(`${rel}: canonical board is empty`);
            continue;
        }

        for (const wire of data.wires || []) for (const side of ['from', 'to']) {
            const ep = endpoint(wire, side);
            if (ep.board) continue;
            const part = loadedParts.get(ep.part);
            const terminal = part ? resolveTerminal(part.kind, ep.terminal, part.terminals || []) : ep.terminal;
            const resolved = nets.some(net => net.terminals.some(item =>
                item.part === ep.part && String(item.terminal).toLowerCase() === String(terminal).toLowerCase()));
            if (!resolved) failures.push(`${rel}: ${side} ends in nowhere at ${ep.part}.${ep.terminal}`);
        }

        const mcu = parts.find(part => mcuKinds.has(part.kind));
        if (mcu) {
            const adjacency = new Map();
            const link = (a, b) => {
                if (!adjacency.has(a)) adjacency.set(a, new Set());
                if (!adjacency.has(b)) adjacency.set(b, new Set());
                adjacency.get(a).add(b);
                adjacency.get(b).add(a);
            };
            for (const net of nets) {
                const ids = [...new Set(net.terminals.map(item => item.part))];
                for (let i = 1; i < ids.length; i++) link(ids[0], ids[i]);
            }
            const reached = new Set([mcu.id]);
            const queue = [mcu.id];
            while (queue.length) {
                for (const next of adjacency.get(queue.shift()) || []) {
                    if (!reached.has(next)) {
                        reached.add(next);
                        queue.push(next);
                    }
                }
            }
            for (const part of parts) {
                if (!structuralKinds.has(part.kind) && part.id !== mcu.id && !reached.has(part.id)) {
                    failures.push(`${rel}: ${part.id} (${part.kind}) is unreachable from ${mcu.id}`);
                }
            }
        }

        if (!rel.startsWith('33-inductive-no-flyback/') && !rel.startsWith('pc26-motor-clamp/')) {
            for (const load of parts.filter(part => part.kind === 'dc_motor' || part.kind === 'relay')) {
                const lowTerminal = load.kind === 'relay' ? 'coil_b' : 'b';
                const highTerminal = load.kind === 'relay' ? 'coil_a' : 'a';
                const low = nets.find(net => net.terminals.some(item => item.part === load.id && item.terminal === lowTerminal));
                const high = nets.find(net => net.terminals.some(item => item.part === load.id && item.terminal === highTerminal));
                const protectedBy = parts.filter(part => part.kind === 'diode').find(diode =>
                    low?.terminals.some(item => item.part === diode.id && item.terminal === 'anode') &&
                    high?.terminals.some(item => item.part === diode.id && item.terminal === 'cathode'));
                if (!protectedBy) failures.push(`${rel}: ${load.id} lacks a correctly oriented flyback diode`);
            }
        }
    }

    // 1193 -> 1198 on 2026-08-27: pc111-pc114 and pc117 extend the physical
    // logic-computer ladder through a diode keypad, control ROM, conditional
    // jump, ALU flags, and the integrated microcoded machine. pc115/pc116 stay
    // held back upstream until their required part/pin model lands.
    // 1171 -> 1193 on 2026-08-26: repin to the current sb3-creator corpus,
    // including the complete C1-C10 logic-computer ladder and soldered-key PCB.
    // 1092 -> 1093 on 2026-08-25: pc89-rl-step, the pure RL bench that closed D8.
    // 1198 -> 1199 on 2026-08-27: pc118-eight-bit-machine, which arrived with
    // the sb3-creator gallery sync to 4c714d3 — one circuit.json, and the only
    // new example in that sync.
    // 1201 -> 1183 on 2026-09-08: the active-low lesson split removes 29
    // circuit.<device>.json files from architecture-specific lessons 06, 32
    // and 46, then adds 11 for portable lesson 56. The flat twins are outside
    // this glob and are measured separately by led-polarity-census.mjs.
    // 1200 -> 1201 on 2026-09-07: i8086-blink, the first gallery circuit for the
    // 8086 (an 8086 + 8255 PPI + eight LEDs, adapted from the reseat fixture) — P7.
    // 1199 -> 1200 on 2026-08-30: logic-74c922-keypad adds the physical
    // matrix-keypad-to-encoder circuit used by the product browser gate.
    // 1170 -> 1171 on 2026-08-26: aurora65-workstation, the complete
    // OLED + PS/2 + VIA + SimpleVGA circuit/ROM/controller example.
    // 1094 -> 1170 on 2026-08-25: the stm32f030 retarget axis (sb3-creator
    // 9aef707) — ~75 F030 benches plus the PWM/TONE allocation repair, which
    // returned the tone family's benches to the 8051s and removed 86 orphans
    // for devices those examples never actually retargeted to. Net +76.
    // 1093 -> 1094 on 2026-08-25: 71-calculator-pcb, which arrived with the
    // sb3-creator gallery sync to 73d3174 — one circuit.json, and the only new
    // file in that sync the glob counts (eater6502-bench/rom.bin is the other
    // new file and is not a circuit).
    // 1183 -> 1203 on 2026-09-21: the 26-example rebuild (sb3-creator 2be3fe2b).
    // Nine examples that had only device-specific variants gained a portable
    // base circuit.json — 03-night-light, 04-thermostat, 16-ldr-bargraph,
    // 53-servo-sweep, 54-motor-driver, 79-a2-sampler, 80-a2-lcd-moving-text,
    // 81-8051-lcd1602-parallel, 82-a2-led-row — and eleven arduino-sk projects
    // (p03, p05, p06, p07, p08, p09, p10, p11, p12, p13, p14) gained an
    // explicit circuit.arduino-uno.json, because their base bench is no longer
    // an Uno. 9 + 11 = 20, and no file was removed.
    // 1203 -> 1192 on 2026-09-21: the nine base circuit.json files the rebuild
    // had written for examples whose catalog entry names a device-specific
    // circuit are gone (five of them; the app never referenced them and they
    // hijacked the physics gate away from the authored bench), the five
    // arduino-sk circuit.arduino-uno.json files became their example's base,
    // and 54-motor-driver's attiny88 bench went with the device. One file
    // arrives: arduino-sk-p08-hourglass regains circuit.stm32f030.json, which
    // its Uno base makes retargetable again. -12 +1.
    // 1192 -> 1216 on 2026-09-27: the validated ATtiny88 retarget axis adds
    // 24 device-specific benches. The three Arduino examples whose authored
    // circuits reserve PC4/PC5 for an external EEPROM are deliberately absent:
    // remapping those wires would change the lesson rather than retarget it.
    // 1216 -> 1217 on 2026-09-28: sb3-creator's PRECHIN A2 learning-board
    // preset (board-prechin-a2-learning-board/circuit.json), which arrives with
    // the pin that brings SPIKE App 3 Python.
    // This is a floor on COVERAGE, not a claim about corpus size — it exists so a
    // glob that silently stops matching cannot report zero failures. It moves
    // only when the corpus does, and the commit that moves it says which example.
    // 1217 -> 1349 on 2026-10-05 (task B10, sb3-creator #49 at pin 0f14aedb):
    // thirteen portable sensor and game examples, 132 circuit files between
    // them (one authored STC12 base + 8-11 device benches each): sense-pir-alarm,
    // sense-clap-switch, sense-noise-counter, sense-noise-light,
    // sense-light-barrier, sense-auto-dimmer, sense-twilight-switch,
    // morse-buzzer-message, binary-counter-buttons, dice-pips, reaction-duel,
    // two-toggle-keys, idea-generator. None removed.
    // 1349 -> 1395 on 2026-10-06 (task B11, sb3-creator #52 at c8edc8cc): +110
    // -64. Added: the eight new examples' benches (clock-ds3231,
    // eeprom-start-counter, guess-the-number, i2c-scanner, melody-lists,
    // random-lucky-light, sense-distance-alarm, sense-thermometer-1wire; 74)
    // and the ATmega/Pico/STM32 benches of seven tone examples now that tone
    // lowers there (07-buzzer-siren, arduino-02-tone-keyboard/-melody/
    // -multiple/-pitch-follower, arduino-sk-p06-light-theremin,
    // arduino-sk-p07-keyboard; 36). Removed: the ATtiny benches of 40 printing
    // examples, since print/ask are refused on the UART-less ATtinys (64).
    // 1395 -> 1488 on 2026-10-06 (task B12, sb3-creator #55 at 70488a68): +93.
    // 87 ATtiny85/ATtiny88 benches for 53 examples that print, ask or play a
    // tone (the ATtinys do all three now), and chip-thermometer's 6.
    // 1488 -> 1509 on 2026-10-06 (task B13, sb3-creator #57 at 85973b6a): +21.
    // 34 new benches (33 analog examples on the ATtiny85, whose ADC pins became
    // reachable, and chip-thermometer's ATtiny88), 13 removed (servo/motor on the
    // ATtinys, and disp-rgb-light's NeoPixel off every non-8051 board).
    // Three analog school circuits extend the cohort; every endpoint above remains checked.
    for (const id of ["school-intercom-101455", "school-led-people-dog", "school-miniorgan-107056"]) assert.ok(files.includes(id + '/circuit.json'), id);
    // Four separately saved AA/NiMH variants extend 1512 to 1516 circuits.
    for (const suffix of ['2aa', '2nimh', '3aa-220', '3nimh']) {
        assert.ok(files.includes(`school-led-people-dog-${suffix}/circuit.json`), suffix);
    }
    // 1516 -> 1604 on 2026-11-23 (sb3-creator e1e126ae -> e248ce71, #186-#189): +88,
    // one circuit.json for each new lab-* example. None removed.
    assert.ok(files.includes('lab-airflow-sensor/circuit.json') && files.includes('lab-beats/circuit.json'), 'lab-* cohort');
    // 1604 -> 1609 on 2026-11-23 (sb3-creator fc0e1c94 -> 01e1280, #191): +5, the
    // radio benches lab-crystal-set, lab-one-transistor-radio, lab-radio-loudspeaker,
    // lab-radio-whistle and lab-reflex-radio. None removed.
    for (const id of ['lab-crystal-set', 'lab-one-transistor-radio', 'lab-radio-loudspeaker',
        'lab-radio-whistle', 'lab-reflex-radio']) assert.ok(files.includes(id + '/circuit.json'), id);
    // 1609 -> 1647 on 2026-11-24 (sb3-creator 539a3d9 -> cafdfb1, #193): +38, the round-4
    // lab benches: 10 on room fields and junction noise, 8 sensing transducers, 12 optics
    // and 8 radio. None removed.
    for (const id of ['lab-hum-finder', 'lab-thermocouple', 'lab-light-guide', 'lab-am-transmitter'])
        assert.ok(files.includes(id + '/circuit.json'), id);
    // 1647 -> 1646 on 2026-11-24 (sb3-creator cafdfb1 -> c048a55, #195): -1,
    // lab-shortwave-regen withdrawn (read robustly it squegged instead of beating
    // against its beacon). Nothing added.
    // 1646 -> 1650 on 2026-11-24 (sb3-creator c048a55 -> 2dace04, #196-#199): lab-shortwave-regen
    // back (the engine now tracks the receiver's own carrier and it beats against its
    // beacon), lab-broadcast-pickup and lab-mosfet-regen new, and one more circuit
    // variant from the DIP/module reseat (#198).
    for (const id of ['lab-shortwave-regen', 'lab-broadcast-pickup', 'lab-mosfet-regen'])
        assert.ok(files.includes(id + '/circuit.json'), id);
    assert.equal(files.length, 1650, 'the gate must cover the complete vendored corpus');
    assert.deepEqual(failures, []);
});

test('controller placement remains physically possible across the shipped corpus', async () => {
    const {registerSidecar} = await import(path.join(cui, 'model/parts-registry.js'));
    for (const name of readdirSync(path.join(cui, 'parts-data'))) {
        if (!name.endsWith('.json')) continue;
        const sidecar = JSON.parse(readFileSync(path.join(cui, 'parts-data', name), 'utf8'));
        if (sidecar.kind) registerSidecar(sidecar);
    }
    const {resolveSeatedParts} = await import(path.join(cui, 'interaction/seat-geometry.js'));
    const {partBounds} = await import(path.join(cui, 'interaction/hittest.js'));
    const failures = [];

    for (const rel of circuitFiles()) {
        const data = JSON.parse(readFileSync(path.join(examples, rel), 'utf8'));
        for (const part of data.parts || []) {
            if ((part.kind === 'arduino_uno' || part.kind === 'arduino_mega') && part.seat) {
                failures.push(`${rel}: ${part.id} is too large to claim a breadboard seat`);
            }
        }
        if (path.basename(rel) === 'circuit.json') continue;
        const parts = resolveSeatedParts(data.parts || []);
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
            const a = parts[i];
            const b = parts[j];
            if (!a.seat || !b.seat || a.seat.boardId !== b.seat.boardId ||
                a.kind === 'breadboard' || b.kind === 'breadboard') continue;
            const aa = partBounds(a);
            const bb = partBounds(b);
            const overlapX = Math.min(aa.maxX, bb.maxX) - Math.max(aa.minX, bb.minX);
            const overlapY = Math.min(aa.maxY, bb.maxY) - Math.max(aa.minY, bb.minY);
            if (overlapX > 1 && overlapY > 1) {
                failures.push(`${rel}: ${a.id} overlaps ${b.id} by ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}`);
            }
        }
    }
    assert.deepEqual(failures, []);
});

test('potentiometer controls do not cover neighbouring parts in any shipped bench', async () => {
    const {resolveSeatedParts} = await import(path.join(cui, 'interaction/seat-geometry.js'));
    const {partBounds} = await import(path.join(cui, 'interaction/hittest.js'));
    const failures = [];

    for (const rel of circuitFiles()) {
        const data = JSON.parse(readFileSync(path.join(examples, rel), 'utf8'));
        const parts = resolveSeatedParts(data.parts || []);
        for (const pot of parts.filter(part => part.kind === 'potentiometer')) {
            let bounds = partBounds(pot);
            const a = pot._seatTerminals?.a;
            const b = pot._seatTerminals?.b;
            if (pot.seat && a && b) {
                const scale = Math.min(Math.abs(b.x - a.x) / 40, 1.4);
                bounds = {
                    minX: pot.x - 30 * scale,
                    maxX: pot.x + 30 * scale,
                    minY: a.y - 60 * scale,
                    maxY: a.y
                };
            }
            for (const neighbour of parts) {
                if (neighbour === pot || structuralKinds.has(neighbour.kind)) continue;
                const other = partBounds(neighbour);
                const overlapX = Math.min(bounds.maxX, other.maxX) - Math.max(bounds.minX, other.minX);
                const overlapY = Math.min(bounds.maxY, other.maxY) - Math.max(bounds.minY, other.minY);
                if (overlapX > 1 && overlapY > 1) {
                    failures.push(`${rel}: ${pot.id} covers ${neighbour.id} by ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}`);
                }
            }
        }
    }
    assert.deepEqual(failures, []);
});

test('every selectable example × MCU combination resolves to an overlap-free bench', async () => {
    const normalize = value => String(value || '').trim().toLowerCase().replace(/_/g, '-');
    const {resolveSeatedParts} = await import(path.join(cui, 'interaction/seat-geometry.js'));
    const {partBounds} = await import(path.join(cui, 'interaction/hittest.js'));
    const index = JSON.parse(readFileSync(path.join(examples, 'index.json'), 'utf8'));
    const audited = new Set(circuitFiles());
    const checkedRetargets = new Set();
    const failures = [];
    let authored = 0;
    let retargeted = 0;

    for (const example of index) {
        if (!example.files?.program || !example.files?.circuit) continue;
        const source = readFileSync(path.join(examples, example.files.program), 'utf8');
        const authoredDevice = normalize((source.match(/^DEVICE\s+([\w-]+)/im) || [])[1]);
        const benches = new Map(Object.entries(example.benches || {}).map(([device, bench]) => [normalize(device), bench]));
        for (const target of example.devices || []) {
            const device = normalize(target);
            const isAuthored = device === authoredDevice;
            const bench = isAuthored ? example.files.circuit : benches.get(device);
            if (!bench) {
                failures.push(`${example.id}@${device}: selectable target has no matching bench`);
                continue;
            }
            if (!audited.has(bench)) {
                failures.push(`${example.id}@${device}: ${bench} is outside the collision-audited corpus`);
                continue;
            }
            if (!isAuthored && !checkedRetargets.has(bench)) {
                checkedRetargets.add(bench);
                const data = JSON.parse(readFileSync(path.join(examples, bench), 'utf8'));
                const parts = resolveSeatedParts(data.parts || []).filter(part => part.kind !== 'breadboard');
                for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
                    const a = partBounds(parts[i]);
                    const b = partBounds(parts[j]);
                    const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
                    const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
                    if (overlapX > 1 && overlapY > 1) {
                        failures.push(`${bench}: ${parts[i].id} covers ${parts[j].id} by ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}`);
                    }
                }
            }
            if (isAuthored) authored++;
            else retargeted++;
        }
    }

    assert.deepEqual(failures, []);
    assert.deepEqual({authored, retargeted, total: authored + retargeted}, {
        // 115/903 -> 116/884 on 2026-09-08: lessons 06, 32 and 46 stop
        // advertising retargets whose target lacks the sinking asymmetry being
        // taught; portable lesson 56 adds one authored and ten retargeted
        // combinations. Net: +1 authored, -19 retargeted.
        // 116 -> 115 (total 1019 -> 1018) on 2026-09-08: i8086-blink was authored
        // in lite with an authored:i8086 field during P7, but is now VENDORED from
        // sb3-creator in the canonical single-device shape (no authored, no
        // benches, circuit.json), so it contributes to neither count. The P7-era
        // bump is reverted by the re-sync, not lost.
        // 884 -> 883 (total 1000 -> 999) on 2026-09-21: 54-motor-driver stops
        // advertising attiny88. Its rebuilt bench drives the motor from a PWM
        // pin, and the attiny88 retarget convention offers none, so the
        // dry-run refuses the device by name rather than shipping a bench that
        // cannot exist. One retargeted combination, no authored one.
        // 883 -> 907 (total 999 -> 1023) on 2026-09-27: the ATtiny88 retarget
        // axis contributes the same 24 electrically validated benches counted
        // above; the three EEPROM-conflicting Arduino candidates remain
        // intentionally unavailable.
        // 116/907 -> 129/1026 (total 1023 -> 1155) on 2026-10-05 (task B10,
        // sb3-creator #49): the thirteen new examples above, each authored once
        // and retargeted onto its 8-11 benches: +13 authored, +119 retargeted,
        // the same 132 files the corpus count gained, none overlapping.
        // 129/1026 -> 137/1064 (total 1155 -> 1201) on 2026-10-06 (task B11,
        // sb3-creator #52 + #53): the eight new examples, +8 authored and +66
        // retargeted; seven tone examples gain their ATmega/Pico/STM32 benches,
        // +34; 40 printing examples lose their ATtiny targets, -62. #53 moved
        // arduino-sk-p07-keyboard's pull-downs off the Uno/Mega outlines.
        // 137/1064 -> 138/1156 (total 1201 -> 1294) on 2026-10-06 (task B12,
        // sb3-creator #55): chip-thermometer, +1 authored and +5 retargeted;
        // 53 examples gain ATtiny targets, +87.
        // 138/1156 -> 138/1177 (total 1294 -> 1315) on 2026-10-06 (task B13,
        // sb3-creator #57): +34 ATtiny benches, -13 refused combinations.
        authored: 138,
        retargeted: 1177,
        total: 1315
    });
});

test('every shipped part is placed: it has coordinates or a breadboard seat', () => {
    // THE A2 BOARD SHIPPED WITH ALL 29 PARTS AT (0,0) and nothing said so. What
    // eventually said so was "potentiometer controls do not cover neighbouring
    // parts", reporting `pot_a0 covers mcu by 60.0x52.0` — which is what a stack
    // of 29 parts looks like through a gate that only inspects potentiometers.
    // i8086-blink had the same defect in 18 of its 25 parts and was invisible,
    // because it contains no potentiometer. A gate that catches this by accident
    // catches it only when the example happens to hold the right component.
    //
    // A part is PLACED if it carries coordinates or a `seat` naming the
    // breadboard holes its leads sit in — the pc* examples use seats and leave
    // x/y at 0 legitimately, which is why the seat is not merely tolerated here
    // but is the other half of the rule.
    const unplaced = [];
    for (const rel of circuitFiles()) {
        const doc = JSON.parse(readFileSync(path.join(examples, rel), 'utf8'));
        const parts = doc.parts || [];
        // THE THRESHOLD IS ONE, AND THAT IS MEASURED, NOT ASSUMED. This started
        // at "three or more", on the reasoning that a single part sitting at the
        // origin might be a real placement rather than a pile. Nothing in the
        // corpus needs that tolerance: all 2161 shipped circuit files have ZERO
        // parts with neither coordinate nor seat, so a threshold of 3 was slack
        // no example was using, and it let a two-part regression through in
        // silence. If a part ever does belong at exactly (0,0), say so with a
        // seat or with x: 0, y: 0 made explicit by a neighbouring offset — the
        // rule asks for evidence of placement, not for a particular coordinate.
        const loose = parts.filter(p =>
            !(p.x || p.y) && !p.seat);
        if (loose.length >= 1) unplaced.push(`${rel}: ${loose.length}/${parts.length} parts have neither coordinates nor a seat`);
    }
    assert.deepEqual(unplaced, [],
        'example(s) whose parts are stacked at the origin — they render as one pile:\n  '
        + unplaced.join('\n  '));
});
