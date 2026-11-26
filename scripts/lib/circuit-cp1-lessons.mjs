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
const wiredLessons = new Set(['cp1-first-display', 'cp1-switch-input', 'cp1-blink', 'cp1-cp5-binary']);

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
    for (const name of [...String(cells?.start ?? 0).padStart(3, '0'), 'PC', 'RUN']) key(name);
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
