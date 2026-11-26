import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseAssertions} from './vendor/sb3-assert-blocks.mjs';
import {driveAndRead} from './polarity-oracle.mjs';

const powerSources = new Set(['vcc', 'gnd', 'vsource', 'solar_cell', 'earth']);
const sameTerminal = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const supplyAliases = terminal => ({
    pos: ['pos', 'vcc'], vcc: ['vcc', 'pos'], neg: ['neg', 'gnd'], gnd: ['gnd', 'neg']
}[terminal] ?? [terminal]);

export async function readBenchProgram ({device, program}, examples, source) {
    const {SB3Creator} = await import('../../test/helpers/bw-vm.mjs');
    source ??= await readFile(join(examples, program), 'utf8');
    const authored = source.match(/^DEVICE\s+(\S+)/im)?.[1].toLowerCase().replaceAll('_', '-');
    if (device && authored !== device) {
        const result = SB3Creator.retargetPseudocode(source, device);
        if (!result.ok) throw new Error(`Retarget refused: ${result.reasons.join(', ')}`);
        source = result.pseudocode;
    }
    const creator = new SB3Creator();
    creator.parse(source);
    return creator;
}

const verdict = (scope, checks) => checks.length
    ? {scope, status: checks.every(check => check.ok) ? 'pass' : 'fail', checks} : null;

export async function checkDocumentedPhysics ({expected}, circuit, examples) {
    if (!expected) return null;
    let text;
    try {
        text = await readFile(join(examples, expected), 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
    const {board} = circuit;
    const parts = new Map(board.parts.map(part => [part.id, part]));
    const checks = [];
    for (const assertion of parseAssertions(text)) {
        if (assertion.kind === 'net') {
            const at = assertion.label.lastIndexOf('.');
            if (at < 1) continue;
            const partId = assertion.label.slice(0, at);
            // An MCU pin like P1.3 occupies two dot-separated segments.
            const id = parts.has(partId) ? partId : assertion.label.slice(0, assertion.label.indexOf('.'));
            const pin = assertion.label.slice(id.length + 1);
            const net = board.nets.find(candidate => candidate.terminals.some(terminal =>
                terminal.part === id && supplyAliases(pin).some(alias => sameTerminal(terminal.terminal, alias))));
            // Reaching a battery, supply or reference symbol proves the rail's
            // state rather than an I/O or circuit function.
            if (net?.terminals.some(terminal => {
                const kind = parts.get(terminal.part)?.kind;
                return powerSources.has(kind) || /battery/.test(kind);
            })) continue;
            // The corpus uses 1 ms for its machine-readable operating point.
            const observed = net ? board.nodeVoltage(net.id) ?? null : null;
            checks.push({source: 'authored', assertion: assertion.raw, observed,
                ok: Number.isFinite(observed) && Math.abs(observed - assertion.expected) <= assertion.tolerance});
        } else if (assertion.kind === 'current') {
            const terminals = parts.get(assertion.partId)?.terminals;
            if (terminals?.length !== 2) continue;
            const observed = board.branchCurrent(assertion.partId, terminals[0]) * 1000;
            checks.push({source: 'authored', assertion: assertion.raw, observed,
                ok: Number.isFinite(observed) && Math.abs(observed - assertion.expected) <= assertion.tolerance});
        }
    }
    return verdict('documented-physics', checks);
}

const pairs = {
    led: ['LED', ['output', 'pwm']],
    button: ['BTN', ['input']],
    switch: ['SW', ['input']],
    slide_switch: ['SW', ['input']],
    tilt_sensor: ['TILT', ['input'], 'tilted'],
    potentiometer: ['POT', ['analog']],
    ldr: ['LDR', ['analog']],
    thermistor: ['NTC', ['analog']]
};

// This original Arduino example names program outputs by header number and
// the authored LED parts by physical order. Retargeting preserves the names.
const partAliases = {'arduino-03-analog-write-mega': {led1: 'led2', led2: 'led3', led3: 'led4'}};

export async function checkDeclaredIO (bench, circuit, examples) {
    if (!bench.program) return null;
    const parts = circuit.board.parts.filter(part => pairs[part.kind]);
    if (parts.length === 0) return null;
    const source = await readFile(join(examples, bench.program), 'utf8');
    if (!/^PIN\s/im.test(source)) return null;
    const creator = await readBenchProgram(bench, examples, source);
    const pins = new Map((creator.project.stc?.pins ?? []).map(pin => [pin.name.toLowerCase(), pin]));
    const checks = [];
    for (const part of parts) {
        const [prefix, directions, param] = pairs[part.kind];
        const id = part.id.toLowerCase();
        const prefixTag = `${prefix.toLowerCase()}_`;
        const name = partAliases[bench.id]?.[id] ?? (id.startsWith(prefixTag) ? id.slice(prefixTag.length) : id);
        const pin = pins.get(name);
        if (!directions.includes(pin?.direction)) continue;
        const coordinate = pin.where ?? `P${pin.port}.${pin.bit}`;
        if (part.kind === 'led') {
            const expected = pin.activeLow ? 'active-low' : 'active-high';
            const observed = driveAndRead(circuit, coordinate, [part.id]);
            circuit.setPin(coordinate, 'input', false);
            checks.push({source: 'electrical-io', part: part.id, pin: coordinate, expected,
                observed, ok: observed.wiring === expected});
        } else {
            const {board} = circuit;
            const original = param ? part.params[param] ?? 0 : board.getControl(part.id);
            const set = value => param ? circuit.setPartParam(part.id, param, value) : circuit.setControl(part.id, value);
            const analog = pin.direction === 'analog';
            const levels = [];
            try {
                for (const position of [0, 1]) {
                    set(position);
                    levels.push(analog ? board.readAnalog(coordinate) : board.readPin(coordinate));
                }
            } finally {
                if (Number.isFinite(original)) set(original);
            }
            // A pull-up, a pull-down and a rotated potentiometer are all valid
            // circuit parts. The paired reaction must reach the program's pin.
            checks.push({source: 'electrical-io', part: part.id, pin: coordinate, observed: levels,
                expected: analog ? 'at least 0.5 V of input travel' : 'digital input switches on press',
                ok: analog ? levels.every(Number.isFinite) && Math.abs(levels[0] - levels[1]) > 0.5
                    : levels[0] !== levels[1]});
        }
    }
    return verdict('electrical-io', checks);
}
