// SPDX-License-Identifier: BSD-3-Clause
import {readBenchProgram} from './circuit-functional-coverage.mjs';

export async function checkInductiveLesson (bench, circuit, examples) {
    const {board} = circuit;
    const inductors = board.parts.filter(part => part.kind === 'inductor').map(part => part.id);
    const diodes = board.parts.filter(part => part.kind === 'diode').map(part => part.id);
    const checks = [
        {check: 'explicit winding inductance', expected: 'one inductor', observed: inductors, ok: inductors.length === 1},
        {check: 'no flyback diode', expected: [], observed: diodes, ok: diodes.length === 0}
    ];
    if (checks.some(check => !check.ok)) return {status: 'fail', checks};
    const creator = await readBenchProgram(bench, examples);
    const declaration = creator.project.stc?.pins?.find(pin => pin.name === 'motor_ctrl');
    const transistor = board.parts.find(part => part.kind === 'npn' || part.kind === 'tip120');
    const collector = board.nets.find(net => net.terminals.some(terminal =>
        terminal.part === transistor?.id && ['c', 'collector'].includes(terminal.terminal)))?.id;
    if (!declaration || !collector) throw new Error('Missing motor-control pin or transistor collector');
    const pin = declaration.where ?? `P${declaration.port}.${declaration.bit}`;
    circuit.setPin(pin, 'pushpull', true);
    circuit.advanceTo(board.getTime() + 50_000_000n);
    const on = board.nodeVoltage(collector);
    const windingCurrent = Math.abs(board.getInductorCurrent(inductors[0]));
    // Scope buckets retain the actual peaks between displayed sample times.
    const scope = board.addScopeChannel({type: 'voltage', netId: collector, sampleRateHz: 1_000_000});
    circuit.setPin(pin, 'pushpull', false);
    const start = board.getTime();
    for (let time = 100n; time <= 12_000n; time += 100n) circuit.advanceTo(start + time);
    const {samples} = board.getScopeData(scope);
    const peak = samples.reduce((maximum, sample) => Number.isFinite(sample) ? Math.max(maximum, sample) : maximum,
        -Infinity);
    checks.push(
        {check: 'collector while conducting', expected: 'between 0 V and 1.2 V', observed: on, ok: on > 0 && on <= 1.2},
        {check: 'winding current before opening', expected: 'greater than 0.05 A', observed: windingCurrent,
            ok: windingCurrent > 0.05},
        {check: 'unprotected collector transient', expected: 'greater than 60 V', observed: peak, ok: peak > 60}
    );
    return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
}
