const oscillators = {
    'pc27-timer-pulse': {timer: 'u1', frequency: 4.8},
    'pc58-555-audio-pulse': {timer: 'timer', frequency: 4.8},
    'pc68-555-sirene': {timer: 'timer_555_3', sweeps: [['potentiometer_5', 20 / 47, 351], ['potentiometer_5', 1, 152]]},
    'pc65-555-metronom': {timer: 'timer_555_3', sweeps: [['potentiometer_5', 0.5, 1.43], ['potentiometer_5', 1, 0.72]]},
    'pc67-555-tongenerator': {timer: 'timer_555_3', frequency: 686},
    'pc74-ldr-555-blinker': {timer: 'timer_555_3', sweeps: [['ldr_5', 1, 48], ['ldr_5', 0, 0.72]]},
    'pc75-alarmgeber': {timer: 'timer_555_3', trigger: 'button_4', frequency: 686},
    'pc87-stroboskop': {timer: 'timer_555_3', frequency: 7.16},
    'pc100-555-clock': {timer: 'u1', frequency: 1}
};

const outputNet = (board, id, terminal = 'output') => {
    const found = board.nets.find(net => net.terminals.some(end => end.part === id && end.terminal === terminal));
    if (!found) throw new Error(`Missing timer output net for ${id}`);
    return found.id;
};

const advanceMs = (board, ms) => board.advanceTo(board.getTime() + BigInt(Math.round(ms * 1e6)));
const current = (board, id) => Math.abs(board.branchCurrent(id, 'anode')) * 1000;

function frequencyCheck (board, part, expected, input, terminal = 'output', threshold = 2.5, resolution = 48) {
    const net = outputNet(board, part, terminal);
    // Observe at least three rising edges after the initial charge.
    const interval = 1000 / (resolution * expected);
    const rising = [];
    let previous = board.nodeVoltage(net) > threshold;
    for (let sample = 1; sample <= 5 * resolution; sample++) {
        advanceMs(board, interval);
        const high = board.nodeVoltage(net) > threshold;
        if (high && !previous) rising.push(sample * interval);
        previous = high;
        if (rising.length === 4) break;
    }
    const observed = rising.length < 3 ? null : 1000 * (rising.length - 1) / (rising.at(-1) - rising[0]);
    return {check: 'oscillator output frequency (Hz)', input, expected, observed,
        ok: observed !== null && Math.abs(observed - expected) <= 0.22 * expected};
}

export function checkWaveformLesson (bench, circuit) {
    const {board} = circuit;
    const spec = oscillators[bench.id];
    let checks;
    if (spec) {
        checks = [];
        if (spec.sweeps) {
            for (const [id, position, frequency] of spec.sweeps) {
                circuit.setControl(id, position);
                // Allow for the previous setting's capacitor charge.
                advanceMs(board, 2 * 1000 / frequency);
                checks.push(frequencyCheck(board, spec.timer, frequency, position));
            }
        } else {
            if (spec.trigger) circuit.setControl(spec.trigger, 1);
            checks.push(frequencyCheck(board, spec.timer, spec.frequency));
        }
    } else if (chases[bench.id]) {
        checks = checkChase(board, circuit, chases[bench.id]);
    } else if (bench.id === 'pc88-lichtorgel') {
        const leds = [7, 9, 27, 29, 45, 47];
        checks = [[0, 0], [0.9, 6]].map(([level, expected]) => {
            circuit.setPartParam('sound_module_3', 'level', level);
            advanceMs(board, 30);
            const observed = leds.filter(id => current(board, 'led_' + id) > 1).length;
            return {check: 'sound input controls the illuminated bands', input: level,
                expected, observed, ok: observed === expected};
        });
    } else if (bench.id === 'pc63-555-bistabil') {
        checks = [[1, 0, true], [0, 0, true], [0, 1, false], [0, 0, false]].map(([set, reset, expected]) => {
            circuit.setControl('button_6', set);
            circuit.setControl('button_7', reset);
            advanceMs(board, 30);
            const observed = current(board, 'led_9') > 1;
            return {check: 'the 555 holds its last state until the reset button', input: [set, reset],
                expected, observed, ok: observed === expected};
        });
    } else if (bench.id === 'pc64-555-retrigger' || bench.id === 'pc66-555-langzeit') {
        const retrigger = bench.id === 'pc64-555-retrigger';
        const pulse = () => {
            circuit.setControl('button_5', 1);
            advanceMs(board, 10);
            circuit.setControl('button_5', 0);
        };
        pulse();
        const times = retrigger ? [300, 1300, 1600] : [1000, 100000, 130000];
        const plan = [true, true, false];
        let time = 10;
        checks = times.map((at, index) => {
            advanceMs(board, at - time);
            time = at;
            const observed = current(board, 'led_9') > 1;
            if (retrigger && index === 0) {
                pulse();
                time += 10;
            }
            return {check: retrigger ? 'the second trigger extends the lit phase' : 'long timer stays lit until about 110 s',
                input: at, expected: plan[index], observed, ok: observed === plan[index]};
        });
    } else if (bench.id === 'pc47-555-monostable') {
        const lit = () => current(board, 'led') > 1;
        const idle = lit();
        circuit.setControl('button', 1);
        advanceMs(board, 10);
        circuit.setControl('button', 0);
        const samples = [];
        for (let ms = 10; ms <= 1500; ms += 10) {
            if (lit()) samples.push(ms);
            advanceMs(board, 10);
        }
        const pulse = samples.length * 10;
        checks = [
            {check: 'indicator waits unlit for a trigger', observed: idle, ok: !idle},
            {check: 'trigger lights the LED for about 1.1 s', observed: pulse, ok: pulse >= 935 && pulse <= 1265},
            {check: 'LED goes dark when the pulse ends', observed: lit(), ok: !lit()}
        ];
    } else if (bench.id === 'pc84-led-herz' || bench.id === 'pc85-led-lampe-puls') {
        const leds = circuit.parts.filter(part => part.kind === 'led').map(part => part.id);
        const waveform = Array.from({length: 140}, () => {
            advanceMs(board, 30);
            return current(board, leds[0]);
        });
        const low = Math.min(...waveform);
        const high = Math.max(...waveform);
        const rises = waveform.filter((sample, i) => sample > 1 && i > 0 && waveform[i - 1] <= 1).length;
        checks = [{check: 'LED current repeatedly rises and falls (mA)', observed: {low, high, rises},
            ok: low < 0.2 && high > 2 && rises >= 2}];
    } else {
        checks = checkAudio(bench, circuit);
        if (!checks) return null;
    }
    return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
}

const chases = {
    'pc81-led-lauflicht': {period: 660, nodes: [22, 27, 32, 37, 42, 47, 52, 57, 62, 67]},
    'pc82-mini-roulette': {period: 145, nodes: [32, 37, 42, 47, 52, 57, 62, 67, 72, 77], input: 'button_9'},
    'pc83-gluecksrad': {period: 145, nodes: [32, 37, 42, 47, 52, 57], tilt: 'tilt_sensor_9'},
    'pc86-led-sanduhr': {period: 1000, nodes: [26, 31, 36, 41, 46, 51], filling: true}
};

function checkChase (board, circuit, spec) {
    if (spec.input) circuit.setControl(spec.input, 1);
    if (spec.tilt) circuit.setPartParam(spec.tilt, 'tilted', 1);
    const sequence = [];
    for (let sample = 0; sample < (spec.nodes.length + 3) * 12; sample++) {
        advanceMs(board, spec.period / 12);
        const mask = spec.nodes.reduce((bits, id, bit) =>
            current(board, 'led_' + id) > 1 ? bits | (1 << bit) : bits, 0);
        if (sequence.at(-1) !== mask && mask) sequence.push(mask);
    }
    const allLit = (1 << spec.nodes.length) - 1;
    return [{check: spec.filling ? 'hourglass fills all indicator positions before wrapping'
        : 'chaser lights each position in turn',
    observed: sequence, ok: spec.filling ? sequence.includes(allLit)
        : spec.nodes.every((_, bit) => sequence.includes(1 << bit)) && sequence.every(mask => (mask & (mask - 1)) === 0)}];
}

function span (board, id, a, b, count = 80, interval = 0.05) {
    const plus = outputNet(board, id, a);
    const minus = b && outputNet(board, id, b);
    const values = Array.from({length: count}, () => {
        advanceMs(board, interval);
        return board.nodeVoltage(plus) - (minus ? board.nodeVoltage(minus) : 0);
    });
    return Math.max(...values) - Math.min(...values);
}

function checkAudio (bench, circuit) {
    const {board} = circuit;
    switch (bench.id) {
    case 'lab-tone-keys':
        return [[0, 0, 402], [0, 1, 676], [1, 0, 1058], [1, 1, 1333]].map(([left, right, expected]) => {
            circuit.setControl('key1', left);
            circuit.setControl('key2', right);
            return frequencyCheck(board, 'timer', expected, [left, right]);
        });
    case 'lab-light-link':
        return [[0, 0, true], [1, 0, false], [0, 1, false]].map(([steady, blocked, audio]) => {
            circuit.setControl('steady_btn', steady);
            circuit.setControl('block_btn', blocked);
            advanceMs(board, 70);
            const observed = span(board, 'speaker', 'a', 'b');
            return {check: 'only modulated light produces an audible electrical signal', input: [steady, blocked],
                expected: audio ? 'above 3 V peak-to-peak' : 'below 0.15 V peak-to-peak', observed,
                ok: audio ? observed > 3 : observed < 0.15};
        });
    case 'lab-listening-amp':
        advanceMs(board, 800);
        return [[0.5, 1], [1, 2]].map(([level, expected]) => {
            circuit.setControl('pot', level);
            advanceMs(board, 600);
            const observed = span(board, 'u1', '1_out', null);
            return {check: 'gain and sensitivity at the amplifier output', input: level, expected, observed,
                ok: Math.abs(observed - expected) < expected * 0.3};
        });
    case 'lab-phase-shift': {
        advanceMs(board, 150);
        const running = span(board, 'amp', 'out', null);
        const quiet = circuit.constructor.fromJSON(circuit.toJSON());
        quiet.setPower(true);
        quiet.setControl('gain', 0.1);
        advanceMs(quiet.board, 150);
        const damped = span(quiet.board, 'amp', 'out', null);
        return [{check: 'oscillation sustains at mid gain and dies at low gain',
            observed: {running, damped}, ok: running > 8 && damped < 0.08}];
    }
    case 'school-miniorgan-107056':
        return [[28, 261.3], [71, 523.0]].map(([key, expected]) => {
            circuit.setControl('button_' + key, 1);
            advanceMs(board, 25);
            const check = frequencyCheck(board, 'resistor_9', expected, key, 'a', 1, 350);
            circuit.setControl('button_' + key, 0);
            advanceMs(board, 20);
            return check;
        });
    case 'school-intercom-101455': {
        advanceMs(board, 1000);
        const receiving = span(board, 'resistor_93', 'a', 'b');
        circuit.setPartParam('vsource_84', 'amplitude', 0);
        advanceMs(board, 200);
        const silent = span(board, 'resistor_93', 'a', 'b');
        return [{check: 'an electrical tone at station A reaches the speaker at station B',
            observed: {receiving, silent}, ok: receiving > 0.01 && silent < receiving * 0.2}];
    }
    default:
        return null;
    }
}
