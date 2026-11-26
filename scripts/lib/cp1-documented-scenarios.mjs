import {createCp1Adapter} from 'bw-board/cp1-adapter.js';
import {createCp1SemanticObserver} from 'bw-board/cp1-semantics.js';

// CP1 lesson pages with numbered Verification sections use this line format.
// Any unrecognized line inside the section rejects the scenario explicitly.
export function parseCp1Scenarios (text) {
    return text.split(/^### \d+\. Verification\s*$/m).slice(1).map(section => {
        const lines = section.trim().split('\n').map(line => line.trim()).filter(Boolean);
        const entry = lines.shift()?.match(/^Start at `([^`]+)` and (run to HLT|inspect the bounded trace)\.$/);
        if (!entry) throw new Error('Missing CP1 verification entry point');
        const scenario = {entry: entry[1], halt: entry[2] === 'run to HLT', stimuli: [], presets: [], cells: [], latches: []};
        for (const line of lines) {
            let match;
            if ((match = line.match(/^- Set P([1-5]) to (0x[0-9a-f]{2}) at `([^`]+)`\.$/i))) {
                scenario.stimuli.push({port: Number(match[1]), value: Number(match[2]), symbol: match[3]});
            } else if ((match = line.match(/^- Preset `([^`]+)` to (\d{2})\.(\d{3})\.$/))) {
                scenario.presets.push([match[1], Number(match[2]), Number(match[3])]);
            } else if ((match = line.match(/^- Expected `([^`]+)` = (\d{2})\.(\d{3})\.$/))) {
                scenario.cells.push([match[1], Number(match[2]), Number(match[3])]);
            } else if ((match = line.match(/^- Expected PC `(\d+)`\.$/))) {
                scenario.pc = Number(match[1]);
            } else if ((match = line.match(/^- Expected accumulator `(\d{2})\.(\d{3})`\.$/))) {
                scenario.accumulator = {opcode: Number(match[1]), operand: Number(match[2])};
            } else if ((match = line.match(/^- P([1-5]) latch = (0x[0-9a-f]{2})\.$/i))) {
                scenario.latches.push([Number(match[1]), Number(match[2])]);
            } else if ((match = line.match(/^- ANZ values: ((?:\d{2}\.\d{3})(?:, \d{2}\.\d{3})*)\.$/))) {
                scenario.displays = match[1].split(', ');
            } else {
                throw new Error(`Unrecognized CP1 verification line: ${line}`);
            }
        }
        if (!scenario.accumulator || scenario.pc === undefined || (!scenario.halt && !scenario.displays)) {
            throw new Error('CP1 verification requires expected accumulator, PC and a terminal condition');
        }
        return scenario;
    });
}

export function runCp1Scenario (spec, program, circuit, options) {
    const adapter = createCp1Adapter(options);
    adapter.attachBoard(circuit.board);
    const {machine} = adapter;
    const advance = ms => adapter.advanceNs(ms * 1_000_000);
    const address = name => {
        const value = program.symbols[name.toUpperCase()];
        if (value === undefined) throw new Error(`Unknown assembly symbol ${name}`);
        return value;
    };
    const checks = [];
    const observe = (label, expected, observed) => checks.push({label, expected, observed,
        ok: JSON.stringify(expected) === JSON.stringify(observed)});
    advance(300);
    for (const word of program.words) machine.writeCell(word.address, word.opcode, word.operand);
    for (const [symbol, opcode, operand] of spec.presets) machine.writeCell(address(symbol), opcode, operand);
    const semantic = createCp1SemanticObserver(machine);
    const stimuli = spec.stimuli.map(item => ({...item, address: address(item.symbol)}));
    const partIds = new Set(circuit.parts.map(part => part.id));
    const displays = [];
    const wrongLevels = [];
    let stimulusIndex = 0;
    let previousBoundary;
    let traceState;
    const stopStimulus = machine.addExecutionListener(event => {
        const next = stimuli[stimulusIndex];
        if (!next || event.kind !== 'before-step') return;
        const state = semantic.controlState();
        if (state.atCommandBoundary && state.boundaryId !== previousBoundary && next.address === state.pc) {
            previousBoundary = state.boundaryId;
            stimulusIndex++;
            for (let bit = 0; bit < 8; bit++) {
                const id = `switch-p${next.port}-${bit}`;
                if (!partIds.has(id)) continue;
                const expected = (next.value >> bit) & 1;
                circuit.setControl(id, 1 - expected);
                const pin = `${options.partId}.P${next.port}.${bit}`;
                const observed = Number(circuit.board.readPin(pin));
                if (observed !== expected) wrongLevels.push({stimulus: stimulusIndex, pin, expected, observed});
            }
        }
    });
    const stopTrace = semantic.onEvent(event => {
        if (event.kind === 'command' && event.command?.opcode === 2) {
            const {opcode, operand} = event.accumulator;
            displays.push(`${String(opcode).padStart(2, '0')}.${String(operand).padStart(3, '0')}`);
            if (!spec.halt && displays.length === spec.displays.length) traceState = event;
        }
    });
    try {
        for (const name of [...String(address(spec.entry)).padStart(3, '0'), 'PC', 'RUN']) {
            machine.setKey(name, true);
            advance(40);
            machine.setKey(name, false);
            advance(40);
        }
        let state;
        for (let elapsed = 0; elapsed <= 8000; elapsed += 25) {
            state = semantic.snapshot();
            if (traceState || state.lastEvent?.kind === 'halt' || state.execution === 'error') break;
            advance(25);
        }
        observe('Documented HLT or bounded trace', true, spec.halt ? state.lastEvent?.reason === 'hlt' : Boolean(traceState));
        observe('Applied documented physical stimuli', stimuli.length, stimulusIndex);
        if (stimuli.length) observe('Switch levels reach their CP1 pins', [], wrongLevels);
        observe('Teaching PC', spec.pc, (traceState ?? state).pc);
        observe('Accumulator', spec.accumulator, (traceState ?? state).accumulator);
        for (const [symbol, opcode, operand] of spec.cells) {
            observe(`Cell ${symbol}`, {opcode, operand}, machine.readCell(address(symbol)));
        }
        for (const [port, latch] of spec.latches) observe(`Port ${port} latch`, latch, machine.getPortState(port).latch);
        if (spec.displays) observe('ANZ values', spec.displays, displays.slice(0, spec.halt ? displays.length : spec.displays.length));
        return checks;
    } finally {
        stopStimulus();
        stopTrace();
        semantic.destroy();
    }
}
