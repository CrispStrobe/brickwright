// SPDX-License-Identifier: BSD-3-Clause
// Bounded presentation events from completed engine observations, never source text.
const byte = value => Number.isInteger(value) && value >= 0 && value <= 255;
const eventNames = new Set(['cp1.command', 'cp1.halt', 'cp1.error']);

export function cp1LessonObservation (event, partId = null) {
    if (!event || !eventNames.has(event.type) || !/^[a-f0-9]{40}$/.test(event.romSha1 || '') ||
        typeof event.profileId !== 'string' || !event.profileId || !Number.isSafeInteger(event.sequence) ||
        event.sequence < 1 || typeof event.tNs !== 'bigint' || event.tNs < 0n ||
        !byte(event.pc) || !byte(event.accumulator?.opcode) || !byte(event.accumulator?.operand)) return null;
    const command = event.command;
    if (command && ![command.address, command.opcode, command.operand].every(byte)) return null;
    if (event.type === 'cp1.command' && (!command || !['completed', 'halted'].includes(event.outcome))) return null;
    const detail = {
        profileQualified: true, profileId: event.profileId, romSha1: event.romSha1,
        sequence: event.sequence, pc: event.pc, timeNs: event.tNs.toString(),
        accumulatorOpcode: event.accumulator.opcode, accumulatorOperand: event.accumulator.operand,
        comparison: typeof event.comparison?.value === 'boolean' ? event.comparison.value : null,
        partId: typeof partId === 'string' ? partId : null,
        ...(command ? {address: command.address, opcode: command.opcode, operand: command.operand} : {}),
        ...(event.type === 'cp1.command' ? {outcome: event.outcome, commandCycles: event.commandCycles} : {}),
        ...(event.type === 'cp1.halt' ? {reason: event.reason} : {}),
        ...(event.type === 'cp1.error' ? {errorCode: Number.isInteger(event.error?.code) ? event.error.code : null} : {})
    };
    return {event: event.type.replace('.', '-'), detail};
}

/** Keep the latest observation per kind/cell until the next UI publication. */
export function createCp1LessonBatch (partId) {
    const pending = new Map();
    return {
        accept (event) {
            const item = cp1LessonObservation(event, partId);
            if (!item) return;
            const key = `${item.event}:${item.detail.address ?? 'monitor'}`;
            pending.set(key, item);
            // At most 256 commands plus terminal events. Never grow with run time.
            if (pending.size > 260) pending.delete(pending.keys().next().value);
        },
        take () {
            const items = [...pending.values()].sort((a, b) => a.detail.sequence - b.detail.sequence);
            pending.clear();
            return items;
        },
        clear () { pending.clear(); }
    };
}
