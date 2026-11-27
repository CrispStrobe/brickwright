// SPDX-License-Identifier: BSD-3-Clause
export const cardiacWord = (value, digits = 3) => Number.isFinite(value) ?
    `${value < 0 ? '-' : ''}${String(Math.abs(value)).padStart(digits, '0')}` : '—';
export const cardiacAddress = value => Number.isInteger(value) ? String(value).padStart(2, '0') : '—';

/** Source labels are trustworthy only while the live word matches the listing. */
export function cardiacDebugView (snapshot, assembly) {
    const state = snapshot?.cardiac || snapshot;
    if (!state || !Array.isArray(state.memory) || state.memory.length !== 100) return null;
    const line = assembly?.ok && assembly.listing?.find(item => item.address === state.pc);
    return {...state, sourceLine: line?.value === state.memory[state.pc] ? line.line : null,
        sourceDiffers: !!line && line.value !== state.memory[state.pc]};
}

/** Compare an actual retired instruction, never a second speculative CPU. */
export function checkCardiacPrediction (before, after, pcText, accText) {
    if (!before || !after || !Number.isSafeInteger(before.steps) || !Number.isSafeInteger(after.steps) || after.steps !== before.steps + 1) return {kind: 'waiting'};
    const integerText = text => /^-?\d+$/.test(String(text).trim());
    if (!integerText(pcText) || !integerText(accText)) return {kind: 'missing'};
    const pc = Number(pcText);
    const acc = Number(accText);
    if (pc < 0 || pc > 99 || acc < -9999 || acc > 9999) return {kind: 'invalid'};
    return {kind: pc === after.pc && acc === after.acc ? 'correct' : 'different',
        expectedPc: after.pc, expectedAcc: after.acc, pc, acc};
}
