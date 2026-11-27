// SPDX-License-Identifier: BSD-3-Clause

export async function checkInductiveLesson (bench, circuit, examples, startProgram) {
    const {board} = circuit;
    const inductors = board.parts.filter(part => part.kind === 'inductor').map(part => part.id);
    const diodes = board.parts.filter(part => part.kind === 'diode').map(part => part.id);
    const checks = [
        {check: 'explicit winding inductance', expected: 'one inductor', observed: inductors, ok: inductors.length === 1},
        {check: 'no flyback diode', expected: [], observed: diodes, ok: diodes.length === 0}
    ];
    if (checks.some(check => !check.ok)) return {status: 'fail', checks};
    const transistor = board.parts.find(part => part.kind === 'tip120');
    const collector = board.getNets().find(net => net.terminals.some(terminal =>
        terminal.part === transistor?.id && terminal.terminal === 'collector'))?.id;
    if (!collector) throw new Error('Missing TIP120 collector');
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        const declaration = vm.runtime.stc?.pins?.find(pin => pin.name === 'motor_ctrl');
        if (!declaration) throw new Error('Missing motor-control pin');
        const pin = declaration.where ?? `P${declaration.port}.${declaration.bit}`;
        let now = 0;
        vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
        vm.runtime.updateCurrentMSecs();
        vm.runtime.ioDevices.clock.resetProjectTimer();
        await runtime.stepFrames(vm, 1, 1);
        const driveOn = board.getPinState(pin)?.driveHigh;
        circuit.advanceTo(board.getTime() + 1_000_000_000n);
        const on = board.nodeVoltage(collector);
        const windingCurrent = Math.abs(board.getInductorCurrent(inductors[0]));
        // Scope buckets retain the transient peak between displayed sample times.
        const scope = board.addScopeChannel({type: 'voltage', netId: collector, sampleRateHz: 1_000_000});
        now = 1001;
        await runtime.stepFrames(vm, 1, 1);
        const driveOff = board.getPinState(pin)?.driveHigh;
        const start = board.getTime();
        for (let time = 100n; time <= 12_000n; time += 100n) circuit.advanceTo(start + time);
        const {samples} = board.getScopeData(scope);
        const peak = samples.reduce((maximum, sample) => Number.isFinite(sample) ? Math.max(maximum, sample) : maximum,
            -Infinity);
        checks.push(
            {check: 'program switches the motor at the mapped GPIO', expected: [true, false], observed: [driveOn, driveOff],
                ok: driveOn === true && driveOff === false},
            {check: 'collector while conducting', expected: 'between 0 V and 1.2 V', observed: on, ok: on > 0 && on <= 1.2},
            {check: 'winding current before opening', expected: 'greater than 0.05 A', observed: windingCurrent,
                ok: windingCurrent > 0.05},
            {check: 'unprotected collector transient', expected: 'greater than 60 V', observed: peak, ok: peak > 60}
        );
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}
