import {extractCp1Machine} from 'bw-board/cp1-extract.js';
import {CP1_TERMINALS} from 'bw-board/devices/cp1.js';
import {getDevice} from 'bw-board/devices.js';
import {CP1_MNEMONICS, parseCp1Program} from '../../overlay/scratch-gui/src/lib/cp1-program.js';

/**
 * A whole CP1 can run an arithmetic/display listing without external wiring:
 * its internal bus belongs to Cp1Machine, not to the circuit solver. Establish
 * that role from the authored circuit, the actual loaded model and the listing;
 * neither the target label nor an empty netlist alone is an admission.
 *
 * This is deliberately conservative about programs. Every assembled cell is
 * inspected, including numeric notation and unreachable code. Port instructions
 * require external-net coverage even when the current program does not reach
 * them. This does not attempt to prove arbitrary self-modifying code safe.
 */
export function isOnboardCp1Circuit ({entry, source, circuit, program, pins = [],
    registeredDevice = getDevice('kosmos-cp1')}) {
    if (entry?.kind !== 'circuit' || entry?.target !== 'kosmos-cp1' ||
        typeof entry.files?.cp1 !== 'string' || !entry.files.cp1.endsWith('.cp1') || pins.length) return false;
    if (!Array.isArray(source?.parts) || source.parts.length !== 1 ||
        source.parts[0].kind !== 'kosmos-cp1') return false;
    // A dangling wire or an unwired peripheral is a defect, not an onboard-only
    // machine. Reject malformed collections as well as any external connection.
    for (const key of ['wires', 'holeWires', 'nets']) {
        if (source[key] != null && (!Array.isArray(source[key]) || source[key].length !== 0)) return false;
    }
    if (!circuit || circuit.netlistError != null || !circuit.board ||
        circuit.resolvedNets?.length !== 0 || circuit.board.nets?.length !== 0) return false;
    const id = source.parts[0].id;
    const realTerminals = terminals => Array.isArray(terminals) && terminals.length === 40 &&
        new Set(terminals).size === 40 && CP1_TERMINALS.every(terminal => terminals.includes(terminal));
    if (!registeredDevice?.gpioFollowsPinStates || !realTerminals(registeredDevice.terminals)) return false;
    for (const parts of [circuit.parts, circuit.board.parts]) {
        if (!Array.isArray(parts) || parts.length !== 1 || parts[0].id !== id ||
            parts[0].kind !== 'kosmos-cp1' || !realTerminals(parts[0].terminals)) return false;
    }
    const machine = extractCp1Machine(source);
    if (!machine.ok) return false;
    for (const loaded of [circuit, circuit.board]) {
        const loadedMachine = extractCp1Machine(loaded);
        if (!loadedMachine.ok || loadedMachine.config.expansion !== machine.config.expansion ||
            loadedMachine.config.clockHz !== machine.config.clockHz) return false;
    }
    const parsed = parseCp1Program(program, {expansion: machine.config.expansion});
    return parsed.ok && parsed.words.some(word => word.opcode !== 0) &&
        !parsed.words.some(word => /^P[1-5][EA]$/.test(CP1_MNEMONICS[word.opcode]));
}
