// SPDX-License-Identifier: BSD-3-Clause
// Presentation of engine-owned observations. This module never advances a CPU.
import {parseCp1Program} from './cp1-program.js';

const cellAddress = (value, capacity) => Number.isInteger(value) && value >= 0 && value < capacity;
const byte = value => Number.isInteger(value) && value >= 0 && value <= 255;

export function cp1DebugView (snapshot, source = '', {expansion = false} = {}) {
    const capacity = expansion ? 256 : 128;
    const semantic = snapshot && snapshot.cp1;
    const qualified = Boolean(semantic && semantic.available === true && semantic.profileQualified === true);
    const executing = Boolean(semantic && semantic.execution === 'running');
    const observed = Boolean(semantic && ['ready', 'running', 'halted', 'error'].includes(semantic.execution));
    const candidate = executing ? semantic.command && semantic.command.address : semantic && semantic.pc;
    const currentAddress = qualified && observed && cellAddress(candidate, capacity) ? candidate : null;
    const accumulator = qualified && semantic.accumulator && byte(semantic.accumulator.opcode) &&
        byte(semantic.accumulator.operand) ? {...semantic.accumulator} : null;
    const parsed = parseCp1Program(source, {expansion});
    const breakpoints = qualified && Array.isArray(semantic.breakpoints) ?
        [...new Set(semantic.breakpoints.filter(value => cellAddress(value, capacity)))].sort((a, b) => a - b) : [];
    const rows = parsed.ok ? parsed.words.map(word => {
        const cell = snapshot && snapshot.cells && snapshot.cells[word.address];
        const matchesMemory = Boolean(cell && cell.opcode === word.opcode && cell.operand === word.operand);
        // A running command retains the bytes it entered with. Self-modifying
        // firmware can replace that RAM cell before the command completes.
        const matchesCommand = !executing || Boolean(semantic.command &&
            semantic.command.opcode === word.opcode && semantic.command.operand === word.operand);
        return {...word, source: parsed.sourceMap[word.address].source, matchesMemory,
            current: currentAddress === word.address && matchesMemory && matchesCommand,
            breakpoint: breakpoints.includes(word.address)};
    }) : [];
    const current = rows.find(row => row.current) || null;
    return {
        qualified, currentAddress, accumulator, current, rows, breakpoints,
        sourceValid: parsed.ok,
        sourceMismatch: currentAddress !== null && !current,
        pc: qualified && cellAddress(semantic.pc, capacity) ? semantic.pc : null,
        comparison: qualified && typeof semantic.comparison?.value === 'boolean' ? semantic.comparison.value : null,
        execution: qualified ? semantic.execution : 'unavailable',
        atCommandBoundary: qualified && semantic.atCommandBoundary === true,
        profileId: qualified ? semantic.profileId : null,
        reason: semantic && semantic.reason || '',
        step: qualified && semantic.step || null,
        lastEvent: qualified && semantic.lastEvent || null
    };
}
