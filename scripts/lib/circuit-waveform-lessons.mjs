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
        const timingNet = retrigger && outputNet(board, 'timer_555_3', 'threshold');
        let discharge;
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
                const before = board.nodeVoltage(timingNet);
                pulse();
                time += 10;
                discharge = {before, after: board.nodeVoltage(timingNet)};
            }
            return {check: retrigger ? 'the second trigger extends the lit phase' : 'long timer stays lit until about 110 s',
                input: at, expected: plan[index], observed, ok: observed === plan[index]};
        });
        if (retrigger) {
            checks.push({check: 'the retrigger diode discharges the timing capacitor',
                expected: 'fall by at least 0.5 V', observed: discharge, ok: discharge.before - discharge.after >= 0.5});
        }
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
        const [triangleNet, comparatorNet] = ['1_out', '2_out'].map(terminal => outputNet(board, 'lm358_3', terminal));
        const samples = Array.from({length: 140}, () => {
            advanceMs(board, 30);
            return {currents: leds.map(id => current(board, id)), triangle: board.nodeVoltage(triangleNet),
                comparator: board.nodeVoltage(comparatorNet)};
        });
        const waveform = samples.map(sample => sample.currents[0]);
        const low = Math.min(...waveform);
        const high = Math.max(...waveform);
        const rises = waveform.filter((sample, i) => sample > 1 && i > 0 && waveform[i - 1] <= 1).length;
        const limits = field => [Math.min(...samples.map(sample => sample[field])), Math.max(...samples.map(sample => sample[field]))];
        const triangle = limits('triangle');
        const comparator = limits('comparator');
        const intermediate = samples.filter(sample => sample.triangle > triangle[0] + 0.3 &&
            sample.triangle < triangle[1] - 0.3).length;
        checks = [
            {check: 'LED current repeatedly rises and falls (mA)', observed: {low, high, rises},
                ok: low < 0.2 && high > 2 && rises >= 2},
            {check: 'integrator ramps between comparator transitions', observed: {triangle, comparator, intermediate},
                ok: triangle[1] - triangle[0] > 1 && comparator[0] < 0.1 && comparator[1] > 3 && intermediate > 12},
            {check: 'all LEDs follow the same waveform', observed: leds.length,
                ok: samples.every(({currents}) => currents.every(value => Math.abs(value - currents[0]) < 0.01))}
        ];
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
    'pc86-led-sanduhr': {period: 1000, nodes: [26, 31, 36, 41, 46, 51], tilt: 'tilt_sensor_21', filling: true}
};

function checkChase (board, circuit, spec) {
    if (spec.input) circuit.setControl(spec.input, 1);
    if (spec.tilt) circuit.setPartParam(spec.tilt, 'tilted', 1);
    const maskNow = () => spec.nodes.reduce((bits, id, bit) =>
        current(board, 'led_' + id) > 1 ? bits | (1 << bit) : bits, 0);
    const sequence = [maskNow()];
    for (let sample = 0; sample < (spec.nodes.length + 3) * 12; sample++) {
        advanceMs(board, spec.period / 12);
        const mask = maskNow();
        if (sequence.at(-1) !== mask) sequence.push(mask);
    }
    const count = spec.nodes.length;
    const chasing = Array.from({length: count}, (_, index) => 1 << index);
    if (spec.filling) {
        const fill = [0, ...chasing.map(bit => (bit << 1) - 1), 0];
        circuit.setPartParam(spec.tilt, 'tilted', 0);
        advanceMs(board, 2 * spec.period);
        const reset = maskNow();
        circuit.setPartParam(spec.tilt, 'tilted', 1);
        const afterReset = [];
        for (let sample = 0; sample < 30; sample++) {
            advanceMs(board, spec.period / 12);
            const mask = maskNow();
            if (afterReset.at(-1) !== mask) afterReset.push(mask);
        }
        return [
            {check: 'hourglass fills in order and wraps', expected: fill, observed: sequence,
                ok: fill.every((mask, index) => sequence[index] === mask)},
            {check: 'returning the hourglass to reset clears it', expected: 0, observed: reset, ok: reset === 0},
            {check: 'the next tilt restarts filling from the first LED', expected: [0, 1], observed: afterReset,
                ok: afterReset[0] === 0 && afterReset[1] === 1}
        ];
    }
    const active = sequence.filter(Boolean);
    const checks = [{check: 'chaser lights each position in turn', observed: active,
        ok: chasing.every(mask => active.includes(mask)) && active.every(mask => (mask & (mask - 1)) === 0)}];
    if (spec.tilt) {
        checks.push({check: 'wheel advances through all six positions in order and wraps', observed: active,
            ok: active.length > count && active.every((mask, index) =>
                mask === chasing[(chasing.indexOf(active[0]) + index) % count])});
        circuit.setPartParam(spec.tilt, 'tilted', 0);
        advanceMs(board, 250);
        const resting = maskNow();
        const stopped = Array.from({length: 5}, () => {
            advanceMs(board, spec.period);
            return maskNow();
        });
        checks.push({check: 'the level sensor stops the wheel and holds the last LED', observed: stopped,
            ok: resting !== 0 && stopped.every(mask => mask === resting)});
    }
    return checks;
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
    case 'school-miniorgan-107056': {
        const speaker = outputNet(board, 'resistor_9', 'a');
        const note = (ms, threshold) => {
            const scope = board.addScopeChannel({type: 'digital', netId: speaker, threshold});
            try {
                advanceMs(board, ms);
                const {transitions, count} = board.getScopeData(scope);
                const rising = [];
                for (let sample = 0; sample < count; sample++) {
                    if (transitions[sample * 2 + 1] === 1) rising.push(transitions[sample * 2]);
                }
                return rising;
            } finally {
                board.removeScopeChannel(scope);
            }
        };
        const keys = [28, 35, 41, 47, 53, 59, 65, 71];
        const pitches = [261.3, 293.82, 329.93, 349.36, 391.82, 440.8, 493.98, 523];
        const checks = keys.map((key, index) => {
            circuit.setControl('button_' + key, 1);
            advanceMs(board, 6);
            // Narrow speaker pulses can fall between fixed display samples.
            // The digital scope timestamps real threshold crossings at solver steps.
            const rising = note(15, 1);
            circuit.setControl('button_' + key, 0);
            advanceMs(board, 6);
            const expected = pitches[index];
            const observed = rising.length < 3 ? null : 1e9 * (rising.length - 1) / (rising.at(-1) - rising[0]);
            return {check: 'speaker pulse frequency (Hz)', input: key, expected, observed,
                ok: observed !== null && Math.abs(observed - expected) <= 0.01 * expected};
        });
        const quiet = note(15, 1).length;
        checks.push({check: 'all keys released stops sustained speaker pulses', expected: 0, observed: quiet, ok: quiet === 0});
        return checks;
    }
    case 'lab-meissner-squegg': {
        const run = (position, reverse, settleMs) => {
            const probe = circuit.constructor.fromJSON(circuit.toJSON());
            probe.setControl('potentiometer_7', position);
            if (reverse) {
                probe.setControl('slide_switch_12', 1);
                probe.setControl('slide_switch_13', 1);
            }
            probe.setPower(true);
            const runtime = probe.board;
            const tank = outputNet(runtime, 'tuning_cap_5', 'b');
            const detector = outputNet(runtime, 'diode_16', 'cathode');
            advanceMs(runtime, settleMs);
            const samples = Array.from({length: 100}, () => {
                advanceMs(runtime, 0.02);
                const rf = runtime._radio?.bandAmplitudes(tank) ?? [];
                return {tank: Math.max(0, ...rf.map(band => band.volts)), detector: runtime.nodeVoltage(detector)};
            });
            const limits = name => [Math.min(...samples.map(sample => sample[name])),
                Math.max(...samples.map(sample => sample[name]))];
            const failure = runtime.transientAnalysisStatus().failure ?? runtime._radio?.error;
            if (failure) throw new Error(`RF or transient solve failed at bias ${position}`);
            return {tank: limits('tank'), detector: limits('detector'), tone: runtime.buzzerTone('earphone_19')};
        };
        const bursts = run(0.05, false, 5);
        const steady = run(0.3, false, 22);
        const reversed = run(0.3, true, 5);
        return [
            {check: 'weak bias produces radio bursts and an audible receiver tone',
                expected: 'tank drops below 0.01 V, peaks near 9 V, detector swings by over 1 V, tone from 700 to 1100 Hz',
                observed: bursts, ok: bursts.tank[0] < 0.01 && bursts.tank[1] > 8.6 && bursts.tank[1] < 10 &&
                    bursts.detector[1] - bursts.detector[0] > 1 && bursts.tone.on && Math.abs(bursts.tone.hz - 900) <= 200},
            {check: 'stronger bias sustains a steady carrier without an audio envelope',
                expected: 'near 8.9 V RF with less than 0.01 V RF variation and 0.05 V detector variation',
                observed: steady, ok: Math.abs(steady.tank[0] - 8.89) < 0.1 &&
                    steady.tank[1] - steady.tank[0] < 0.01 && steady.detector[1] - steady.detector[0] < 0.05 && !steady.tone.on},
            {check: 'reversing the feedback winding stops RF and audio', expected: 'less than 1 mV RF and silent',
                observed: reversed, ok: reversed.tank[1] < 0.001 && !reversed.tone.on}
        ];
    }
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
