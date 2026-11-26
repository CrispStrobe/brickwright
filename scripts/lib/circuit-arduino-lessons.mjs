// SPDX-License-Identifier: BSD-3-Clause

const stringLessons = new Set([
    'append', 'case', 'chars', 'compare', 'constructors', 'indexof', 'length',
    'length-trim', 'replace', 'startswith', 'substring', 'toint'
].map(name => 'arduino-08-string-' + name));

const outputFor = id => {
    if (stringLessons.has(id) || id === 'arduino-08-char-analysis') return ['String operations demo', 'Hello, World!', '13'];
    if (id === 'arduino-04-ascii-table') {
        return ['ASCII Table', ...Array.from({length: 94}, (_, index) => String(33 + index))];
    }
    return null;
};

const toneScenarios = {
    'arduino-02-tone-melody': {
        parts: ['speaker'],
        durations: [250, 250, 250, 250, 250, 250, 250],
        phases: [[262], [196], [220], [196], [0], [247], [262], [0]]
    },
    'arduino-02-tone-multiple': {
        parts: ['spk1', 'spk2', 'spk3'],
        durations: [200, 500, 300, 200, 500],
        phases: [[440, 0, 0], [0, 523, 0], [0, 0, 659], [440, 0, 0], [0, 523, 0], [0, 0, 659]]
    }
};

function verdict (checks) {
    return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
}

async function checkProgramOutput (expected, vm, stepFrames) {
    const observed = [];
    const originalLog = console.log;
    // The shipped stc12_print block writes to the console in a simulated project.
    // Capture the real output after loader diagnostics and before VM teardown.
    console.log = (...args) => observed.push(args.map(String).join(' '));
    try {
        await stepFrames(vm, 10);
    } finally {
        console.log = originalLog;
    }
    return verdict([
        {check: 'simulated program output', expected, observed, ok: observed.length === expected.length &&
            expected.every((line, index) => observed[index] === line)},
        {check: 'program terminates', expected: 0, observed: vm.runtime.threads.length,
            ok: vm.runtime.threads.length === 0}
    ]);
}

async function checkTones (scenario, circuit, vm, stepFrames) {
    const {board} = circuit;
    const buzzerIds = scenario.parts.map(name =>
        circuit.parts.find(part => part.kind === 'buzzer' && (part.declName === name || part.id === name))?.id);
    if (buzzerIds.some(id => !id)) return verdict([{
        check: 'wired buzzers', expected: scenario.parts, observed: buzzerIds, ok: false
    }]);
    let now = 0;
    vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
    vm.runtime.updateCurrentMSecs();
    vm.runtime.ioDevices.clock.resetProjectTimer();
    const start = board.getTime();
    const changes = [];
    const sampleMs = 10;
    const toleranceMs = 35;
    const deadline = scenario.durations.reduce((total, duration) => total + duration + toleranceMs, 0) + 50;
    for (; now <= deadline && changes.length < scenario.phases.length; now += sampleMs) {
        await stepFrames(vm, 1, sampleMs);
        circuit.advanceTo(start + BigInt(now + sampleMs) * 1_000_000n);
        const states = buzzerIds.map(id => {
            const tone = board.buzzerTone(id);
            return tone.on ? tone.hz : 0;
        });
        if (changes.at(-1)?.states.some((previous, index) => states[index] !== previous) || !changes.length) {
            changes.push({ms: now, states});
        }
    }
    const observed = changes.map(change => change.states);
    const durations = changes.slice(1).map(({ms}, index) => ms - changes[index].ms);
    return verdict([
        {check: 'wired buzzer tones (Hz)', expected: scenario.phases, observed,
            ok: observed.length === scenario.phases.length && scenario.phases.every((phase, index) =>
                phase.every((hz, buzzer) => hz ? Math.abs(hz - observed[index][buzzer]) <= hz * 0.05 :
                    observed[index][buzzer] === 0))},
        {check: 'tone phase duration (ms)', expected: scenario.durations, observed: durations, toleranceMs,
            ok: durations.length === scenario.durations.length && scenario.durations.every((duration, index) =>
                Math.abs(duration - durations[index]) <= toleranceMs)}
    ]);
}

async function checkUltrasonic (circuit, vm, stepFrames) {
    const {board} = circuit;
    const sensor = circuit.parts.find(part => part.kind === 'ultrasonic');
    const terminalNet = name => board.nets.find(net => net.terminals.some(term =>
        term.part === sensor?.id && term.terminal === name));
    const trigger = terminalNet('trig');
    if (!trigger || !terminalNet('echo')) throw new Error('The ultrasonic sensor must have wired trigger and echo');
    const observed = [];
    const originalLog = console.log;
    let output = [];
    const sampleMs = 0.5;
    let now = 0;
    const start = board.getTime();
    vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
    vm.runtime.updateCurrentMSecs();
    vm.runtime.ioDevices.clock.resetProjectTimer();
    console.log = value => output.push(value);
    try {
        for (const cm of [40, 120]) {
            circuit.setPartParam(sensor.id, 'distance', cm);
            output = [];
            const deadline = now + 280;
            const pulses = [];
            let rise = null;
            for (; now < deadline; now += sampleMs) {
                await stepFrames(vm, 1, sampleMs);
                circuit.advanceTo(start + BigInt(Math.round((now + sampleMs) * 1_000_000)));
                const high = board.nodeVoltage(trigger.id) > circuit.vcc / 2;
                if (high && rise === null) {
                    rise = now;
                } else if (!high && rise !== null) {
                    pulses.push((now - rise) * 1000);
                    rise = null;
                }
            }
            const device = board.getDeviceState(sensor.id);
            observed.push({cm, output, pulses, echoUs: Number(device._echoEndNs - device._echoStartNs) / 1000});
        }
    } finally {
        console.log = originalLog;
    }
    const widths = observed.map(({echoUs}) => echoUs);
    const values = observed.map(({output: samples}) => samples);
    return verdict([
        {check: 'wired sensor echo width in us for 40 and 120 cm', expected: [2320, 6960], observed: widths,
            ok: widths[0] === 2320 && widths[1] === 6960},
        {check: 'program reports different readings at 40 and 120 cm', expected: 'distance-dependent numeric output',
            observed: values, ok: values.every(samples => samples.length >= 2 && samples.every(Number.isFinite)) &&
                values[0].at(-1) < values[1].at(-1)},
        {check: 'no trigger stays high for a full 0.5 ms frame', expected: '10 us trigger pulse (shorter than 0.5 ms)',
            observed: observed.map(({pulses}) => pulses), ok: observed.every(({pulses}) => pulses.length === 0)}
    ]);
}

export async function checkArduinoLesson (bench, circuit, examples, startProgram) {
    const output = outputFor(bench.id);
    const tones = toneScenarios[bench.id];
    const ultrasonic = bench.id === 'arduino-06-ping';
    if (!output && !tones && !ultrasonic) return null;
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        const result = output ? await checkProgramOutput(output, vm, runtime.stepFrames) : tones ?
            await checkTones(tones, circuit, vm, runtime.stepFrames) :
            await checkUltrasonic(circuit, vm, runtime.stepFrames);
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        return result;
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}
