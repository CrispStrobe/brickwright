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
    const terminalNet = (id, name) => board.getNets().find(net => net.terminals.some(term =>
        term.part === id && term.terminal.toLowerCase() === name.toLowerCase()));
    const echoPin = vm.runtime.stc?.parts?.find(part => part.type === 'hcsr04')?.echo;
    const gpio = echoPin && terminalNet('board', echoPin.where ?? `P${echoPin.port}.${echoPin.bit}`);
    const trigger = terminalNet(sensor?.id, 'trig');
    const echo = terminalNet(sensor?.id, 'echo');
    if (!trigger || !echo || !gpio) throw new Error('The ultrasonic sensor must have wired trigger and echo GPIO');
    const observed = [];
    const originalLog = console.log;
    let output = [];
    let now = 0;
    const sampleMs = 10;
    const start = board.getTime();
    vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
    vm.runtime.updateCurrentMSecs();
    vm.runtime.ioDevices.clock.resetProjectTimer();
    console.log = value => output.push(value);
    try {
        for (const cm of [40, 120]) {
            circuit.setPartParam(sensor.id, 'distance', cm);
            output = [];
            let gpioPeak = 0;
            const trace = [trigger, echo, gpio].map(net => ({
                id: net.id, high: board.nodeVoltage(net.id) > circuit.vcc / 2, rise: null, pulses: []
            }));
            const recordEdges = event => {
                if (event.type !== 'pin' && event.type !== 'time') return;
                const time = board.getTime();
                gpioPeak = Math.max(gpioPeak, board.nodeVoltage(gpio.id));
                for (const signal of trace) {
                    const high = board.nodeVoltage(signal.id) > circuit.vcc / 2;
                    if (high === signal.high) continue;
                    signal.high = high;
                    if (high) signal.rise = time;
                    else if (signal.rise !== null) signal.pulses.push(Number(time - signal.rise) / 1000);
                }
            };
            board.onChange(recordEdges);
            try {
                const deadline = now + 280;
                for (; now < deadline; now += sampleMs) {
                    await stepFrames(vm, 1, sampleMs);
                    circuit.advanceTo(start + BigInt(Math.round((now + sampleMs) * 1_000_000)));
                }
            } finally {
                board.offChange(recordEdges);
            }
            observed.push({cm, output, triggerUs: trace[0].pulses, echoUs: trace[1].pulses,
                gpioUs: trace[2].pulses, gpioPeak});
        }
    } finally {
        console.log = originalLog;
    }
    const samples = (field, target) => observed.every(run => {
        const values = run[field];
        return values.length >= 2 && values.every(value => value === target(run.cm));
    });
    const maxGpioVolts = gpio.id === echo.id ? circuit.vcc : 3.3;
    return verdict([
        {check: 'wired trigger pulses', expected: '10 µs per pulse', observed: observed.map(run => run.triggerUs),
            ok: samples('triggerUs', () => 10)},
        {check: 'wired echo widths at 40 and 120 cm', expected: [2320, 6960], observed: observed.map(run => run.echoUs),
            ok: samples('echoUs', cm => cm * 58)},
        {check: 'echo reaches MCU input with the same width and within its voltage range',
            expected: {widths: [2320, 6960], peakAtMost: maxGpioVolts},
            observed: observed.map(({gpioUs, gpioPeak}) => ({gpioUs, gpioPeak})),
            ok: samples('gpioUs', cm => cm * 58) && observed.every(run => run.gpioPeak <= maxGpioVolts + 0.001)},
        {check: 'reported whole centimetres at 40 and 120 cm', expected: [40, 120], observed: observed.map(run => run.output),
            ok: samples('output', cm => cm)}
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
