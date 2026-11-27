import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createCp1Adapter} from 'bw-board/cp1-adapter.js';
import {createCp1SemanticObserver} from 'bw-board/cp1-semantics.js';
import {parseCp1Scenarios, runCp1Scenario} from './cp1-documented-scenarios.mjs';
import {parseCp1Program} from '../../overlay/scratch-gui/src/lib/cp1-program.js';

const romPath = new URL('../../overlay/scratch-gui/static/roms/cp1-independent-monitor.bin', import.meta.url);
const cellLessons = {
    'cp1-descending-sum': {start: 10, cells: [[30, 0, 0], [31, 0, 28]]},
    'cp1-crate-division': {start: 20, cells: [[39, 0, 2], [40, 0, 9]]},
    'cp1-lookup-card': {start: 38, accumulator: 123, cells: [[51, 0, 58]]},
    'cp1-instruction-patch': {start: 66, accumulator: 197}
};
const digitMasks = [63, 6, 91, 79, 102, 109, 125, 39, 127, 111];
const accumulatorDisplay = value => [119, 63, 191, ...String(value).padStart(3, '0').split('').map(digit => digitMasks[digit])];
const wiredLessons = new Set([
    'cp1-first-display', 'cp1-switch-input', 'cp1-blink', 'cp1-cp5-binary', 'cp1-gray-indicator',
    'cp1-cp3-cp4-relay-sequence', 'cp1-cp4-relay-signals', 'cp1-cp4-relay-bank'
]);

export async function checkCp1Lesson (bench, circuit, examples) {
    const cells = cellLessons[bench.id];
    if (!bench.cp1) return null;
    const docs = bench.expected ? await readFile(join(examples, bench.expected), 'utf8') : '';
    const scenarios = parseCp1Scenarios(docs);
    if (!scenarios.length && !cells && !wiredLessons.has(bench.id)) return null;
    const part = circuit.parts.find(item => item.kind === 'kosmos-cp1');
    if (!part) throw new Error('Missing CP1 machine');
    const expansion = part.params?.expansion === true;
    const [rom, source] = await Promise.all([readFile(romPath), readFile(join(examples, bench.cp1), 'utf8')]);
    const program = parseCp1Program(source, {expansion});
    if (!program.ok) throw new Error(JSON.stringify(program.errors));
    const options = {rom, expansion, partId: part.id};
    if (scenarios.length) {
        const authoredCircuit = circuit.toJSON();
        const checks = scenarios.flatMap((scenario, index) => {
            const target = index === 0 ? circuit : circuit.constructor.fromJSON(authoredCircuit);
            if (index !== 0) target.setPower(true);
            return runCp1Scenario(scenario, program, target, options).map(check => ({scenario: index + 1, ...check}));
        });
        return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
    }
    const adapter = createCp1Adapter(options);
    adapter.attachBoard(circuit.board);
    const {machine} = adapter;
    const advance = ms => adapter.advanceNs(ms * 1_000_000);
    const checks = [];
    const observe = (label, expected, observed) => checks.push({label, expected, observed,
        ok: JSON.stringify(expected) === JSON.stringify(observed)});
    const key = name => {
        machine.setKey(name, true);
        advance(40);
        machine.setKey(name, false);
        advance(40);
    };
    advance(300);
    const semantic = cells ? createCp1SemanticObserver(machine) : null;
    for (const {address, opcode, operand} of program.words) machine.writeCell(address, opcode, operand);
    const lit = id => Math.abs(circuit.board.branchCurrent(id, 'anode')) > 0.001;
    const gray = bench.id === 'cp1-gray-indicator';
    const entry = cells?.start ?? (gray ? 8 : 0);
    for (const name of [...String(entry).padStart(3, '0'), 'PC']) key(name);
    if (!gray) key('RUN');
    if (cells) {
        let halted = false;
        for (let elapsed = 0; elapsed <= 3000; elapsed += 25) {
            const state = semantic.snapshot();
            halted = state.execution === 'halted' && state.lastEvent?.kind === 'halt';
            if (halted || state.execution === 'error') break;
            advance(25);
        }
        semantic.destroy();
        observe('Teaching program completed HLT', true, halted);
        for (const [name, opcode, operand] of cells.cells ?? []) {
            const address = typeof name === 'number' ? name : program.symbols[name.toUpperCase()];
            if (address === undefined) throw new Error(`Unknown assembly symbol ${name}`);
            observe(`Cell ${name}`, {opcode, operand}, machine.readCell(address));
        }
        if (cells.accumulator !== undefined) {
            key('ACC');
            advance(50);
            observe('Accumulator display', accumulatorDisplay(cells.accumulator), machine.getDisplay().digits);
        }
    } else if (bench.id === 'cp1-first-display') {
        advance(200);
        observe('Display A00.042', accumulatorDisplay(42), machine.getDisplay().digits);
    } else if (bench.id === 'cp1-switch-input') {
        for (const pressed of [0, 1, 0]) {
            circuit.setControl('switch', pressed);
            advance(220);
            const bit = 1 - pressed;
            observe(`P1.0 with switch ${pressed ? 'pressed' : 'released'}`, bit, machine.getPortState(1).value & 1);
            observe(`Display A00.00${bit}`, accumulatorDisplay(bit), machine.getDisplay().digits);
        }
    } else if (bench.id === 'cp1-blink') {
        const phases = [];
        const led = circuit.parts.find(item => item.kind === 'led');
        if (!led) throw new Error('Missing CP1 blink LED');
        for (let sample = 0; sample < 24; sample++) {
            advance(40);
            const high = Boolean(machine.getPortState(2).latch & 1);
            const lit = circuit.ledBrightness(led.id) > 0.02;
            if (high === lit && phases.at(-1) !== high) phases.push(high);
        }
        observe('At least two complete output/LED cycles', true, phases.length >= 5);
    } else if (bench.id === 'cp1-gray-indicator') {
        const changes = [];
        machine.setKey('RUN', true);
        for (let ms = 0; ms < 1000 && changes.length < 8; ms += 5) {
            if (ms === 40) machine.setKey('RUN', false);
            advance(5);
            const value = machine.getPortState(2).latch;
            if (value === 0xff && !changes.length) continue;
            if (changes.at(-1)?.value === value) continue;
            changes.push({value, ms, lamps: Array.from({length: 3}, (_, bit) => lit(`led${bit}`))});
        }
        const sequence = [248, 249, 251, 250, 254, 255, 253, 252];
        observe('Gray sequence at port 2', sequence, changes.map(change => change.value));
        observe('The three wired indicators follow the Gray sequence',
            sequence.map(value => Array.from({length: 3}, (_, bit) => Boolean(value & (1 << bit)))),
            changes.map(change => change.lamps));
        const dwell = changes.slice(1).map((change, index) => change.ms - changes[index].ms);
        checks.push({label: 'Seven Gray transitions at 70–105 ms intervals', observed: dwell,
            ok: dwell.length === 7 && dwell.every(ms => ms >= 70 && ms <= 105)});
    } else if (bench.id === 'cp1-cp4-relay-bank') {
        for (const mask of [0, 85, 170, 255]) {
            for (let bit = 0; bit < 8; bit++) circuit.setControl(`switch${bit + 1}`, (mask >> bit) & 1);
            advance(180);
            observe(`Port 2 latches relay mask ${mask}`, mask, machine.getPortState(2).latch);
            const relayMask = Array.from({length: 8}, (_, bit) => bit).reduce((bits, bit) =>
                Math.abs(circuit.board.branchCurrent(`load${bit + 1}`, 'a')) > 0.001 ? bits | (1 << bit) : bits, 0);
            observe(`Isolated relay load current mask ${mask}`, mask, relayMask);
        }
    } else if (bench.id === 'cp1-cp3-cp4-relay-sequence' || bench.id === 'cp1-cp4-relay-signals') {
        const expansionSequence = bench.id === 'cp1-cp3-cp4-relay-sequence';
        const port = expansionSequence ? 4 : 2;
        const phases = [];
        if (!expansionSequence) {
            advance(120);
            observe('Both lamps wait unlit for a request', [false, false], [lit('entry-lamp'), lit('exit-lamp')]);
            circuit.setControl('request', 1);
        }
        for (let sample = 0; sample < 90 && phases.length < 3; sample++) {
            advance(20);
            const value = machine.getPortState(port).latch;
            if (value === 0 && !phases.length) continue;
            if (phases.at(-1)?.value === value) continue;
            advance(15);
            phases.push({value, lamps: [lit('entry-lamp'), lit('exit-lamp')]});
        }
        observe('The three programmed phases reach the isolated relay lamps', [
            {value: 1, lamps: [true, false]}, {value: 2, lamps: [false, true]}, {value: 0, lamps: [false, false]}
        ], phases);
    } else if (bench.id === 'cp1-cp5-binary') {
        for (const pattern of [0, 1, 128, 165, 255, 0]) {
            for (let bit = 0; bit < 8; bit++) circuit.setControl(`switch${bit + 1}`, 1 - ((pattern >> bit) & 1));
            advance(270);
            observe(`CP5 saved input byte ${pattern}`, {opcode: 0, operand: pattern}, machine.readCell(32));
            observe(`CP5 output byte ${pattern}`, pattern, machine.getPortState(2).latch);
            const lit = Array.from({length: 8}, (_, bit) => circuit.ledBrightness(`led${bit + 1}`) > 0.02);
            observe(`CP5 indicator pattern ${pattern}`, Array.from({length: 8}, (_, bit) => Boolean(pattern & (1 << bit))), lit);
        }
    }
    return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
}
