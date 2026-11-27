const truthTables = {
    'pc23-transistor-switch': {switches: ['button1'], leds: ['led1'], masks: [0, 1, 0]},
    'pc25-relay-isolator': {switches: ['sw1'], leds: ['led1'], masks: [0, 1, 0]},
    'pc28-logic-interlock': {switches: ['sw_a', 'sw_b'], leds: ['led1'], masks: [0, 0, 0, 1]},
    'pc38-relay-changeover': {switches: ['coil'], leds: ['lednc', 'ledno'], masks: [1, 2, 1]},
    'pc57-inverter-lamp': {switches: ['sw'], leds: ['led'], masks: [1, 0, 1]},
    'pc61-diode-or': {switches: ['a', 'b'], leds: ['led'], masks: [0, 1, 1, 1]},
    'pc72-tagschaltung': {switches: ['ldr_3'], leds: ['led_7'], masks: [0, 1, 0]},
    'pc73-nachtschaltung': {switches: ['ldr_4'], leds: ['led_7'], masks: [1, 0, 1]},
    'pc40-opamp-threshold': {switches: ['pot'], leds: ['led'], masks: [0, 1, 0]},
    'pc44-push-pull-led': {switches: ['sw1', 'sw2'], leds: ['led1', 'led2'], masks: [0, 1, 2]},
    'pc48-ldr-comparator': {switches: ['ldr'], leds: ['led'], masks: [0, 1, 0]},
    'pc36-series-interlock': {switches: ['sw1', 'sw2'], leds: ['led'], masks: [0, 0, 0, 1]},
    'pc39-nmos-switch': {switches: ['gate'], leds: ['led'], masks: [0, 1]},
    'pc45-nand-test': {switches: ['sw1', 'sw2'], leds: ['led'], masks: [1, 1, 1, 0]},
    'pc46-xor-selector': {switches: ['a', 'b'], leds: ['led'], masks: [0, 1, 1, 0]},
    'pc69-nand-inverter': {switches: ['switch_4'], leds: ['led_7'], masks: [1, 0]},
    'pc90-74hc08-and-gate': {dip: 'sw1', leds: ['led1'], masks: [0, 0, 0, 1]},
    'pc91-74hc04-inverter': {dip: 'sw1', leds: ['led1'], masks: [1, 0]},
    'pc92-and-or-xor-compared': {dip: 'sw1', leds: ['led_and', 'led_or', 'led_xor'], masks: [0, 6, 6, 3]},
    'pc93-nand-is-universal': {dip: 'sw1', leds: ['led_not', 'led_and', 'led_or'], masks: [1, 4, 5, 6]},
    'pc94-half-adder': {dip: 'sw1', leds: ['led_sum', 'led_carry'], masks: [0, 1, 1, 2]},
    'pc95-full-adder': {dip: 'sw1', leds: ['led_sum', 'led_carry'], masks: [0, 1, 1, 2, 1, 2, 2, 3]},
    'pc105-instruction-decoder': {dip: 'swi', leds: ['led_lda', 'led_add', 'led_sub', 'led_out', 'led_hlt'],
        masks: [1, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 16]}
};

const settled = (board, milliseconds) => board.advanceTo(board.getTime() + BigInt(milliseconds) * 1_000_000n);

const readLamps = (board, lamps) => lamps.reduce((mask, id, bit) => {
    const current = Math.abs(board.branchCurrent(id, 'anode'));
    if (!Number.isFinite(current)) throw new Error(`No current readback for ${id}`);
    return current > 0.001 ? mask | (1 << bit) : mask;
}, 0);

const segmentPatterns = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const digits = (board, display) => {
    const intensity = board.sevenSegmentBrightness(display);
    if (!intensity) throw new Error(`No seven-segment readback for ${display}`);
    return [...'abcdefg'].filter((segment, index) =>
        (Array.isArray(intensity) ? intensity[index] : intensity[segment]) > 0.05).join('');
};
const adderExamples = new Set(['pc96-four-bit-adder-74hc283', 'pc97-logic-calculator', 'pc98-adder-subtractor',
    'pc99-bcd-two-digit-calculator']);
const rcExamples = {
    '29-capacitor-charge': ['c1', 1000], 'pc06-rc-charge': ['capacitor_4', 1000],
    'pc16-mini-rc': ['capacitor_4', 1000], 'pc21-rc-smoothing': ['c1', 100]
};
const counterExamples = new Set(['pc101-program-counter', 'pc104-ring-counter']);
const voltage = (board, id, terminal) => {
    const net = board.nets.find(n => n.terminals.some(end => end.part === id && end.terminal === terminal));
    if (!net) throw new Error(`No net for ${id}.${terminal}`);
    return board.nodeVoltage(net.id);
};
const measure = (check, expected, observed, input) => ({check, input, expected, observed, ok: expected === observed});

function checkAdder (id, circuit) {
    const {board} = circuit;
    const binary = ['led0', 'led1', 'led2', 'led3', 'led4'];
    let cases;
    let observe;
    if (id === 'pc96-four-bit-adder-74hc283') {
        cases = Array.from({length: 256}, (_, i) => [i >> 4, i & 15]);
        observe = (a, b) => [a + b, readLamps(board, binary)];
    } else if (id === 'pc98-adder-subtractor') {
        cases = [[7, 2, 0], [7, 2, 1], [2, 7, 1], [15, 1, 0]];
        observe = (a, b, subtract) => [subtract ? (a + (15 ^ b) + 1) : a + b, readLamps(board, binary)];
    } else if (id === 'pc97-logic-calculator') {
        cases = [[0, 0], [5, 3], [4, 5], [9, 1], [15, 15]];
        observe = (a, b) => [segmentPatterns[a + b] ?? '', digits(board, 'disp')];
    } else {
        cases = [[3, 4], [9, 0], [9, 1], [7, 6], [9, 9]];
        observe = (a, b) => {
            const sum = a + b;
            return [segmentPatterns[Math.floor(sum / 10)] + '/' + segmentPatterns[sum % 10],
                digits(board, 'disp_tens') + '/' + digits(board, 'disp_ones')];
        };
    }
    return cases.map(([a, b, mode]) => {
        circuit.setPartParam('swa', 'switches', a);
        circuit.setPartParam('swb', 'switches', b);
        if (mode !== undefined) circuit.setPartParam('swm', 'switches', mode);
        settled(board, 50);
        return measure('wired arithmetic result', ...observe(a, b, mode), [a, b, mode ?? null]);
    });
}

function checkCounter (id, circuit) {
    const {board} = circuit;
    const pc = id === 'pc101-program-counter';
    const leds = pc ? ['led0', 'led1', 'led2', 'led3', 'led_rco']
        : Array.from({length: 6}, (_, bit) => `led_t${bit + 1}`);
    const cases = pc ? Array.from({length: 17}, (_, i) => i === 15 ? 31 : i & 15)
        : Array.from({length: 7}, (_, i) => 1 << (i % 6));
    return cases.map((expected, pulse) => {
        if (pulse) {
            circuit.setPartParam('swc', 'switches', 1);
            settled(board, 25);
            circuit.setPartParam('swc', 'switches', 0);
        }
        settled(board, 25);
        return measure('LEDs after clock pulse', expected, readLamps(board, leds), pulse);
    });
}

export function checkPassiveLesson (bench, circuit) {
    const {board} = circuit;
    const spec = truthTables[bench.id];
    let checks;
    if (spec) {
        checks = spec.masks.map((expected, input) => {
            if (spec.dip) circuit.setPartParam(spec.dip, 'switches', input);
            else spec.switches.forEach((id, bit) => circuit.setControl(id, (input >> bit) & 1));
            settled(board, 50);
            const observed = readLamps(board, spec.leds);
            return {check: 'wired output truth table', input, expected, observed, ok: expected === observed};
        });
    } else if (adderExamples.has(bench.id)) {
        checks = checkAdder(bench.id, circuit);
    } else if (counterExamples.has(bench.id)) {
        checks = checkCounter(bench.id, circuit);
    } else if (bench.id.startsWith('school-led-people-dog')) {
        const current = (id, terminal) => board.branchCurrent(id, terminal) * 1000;
        const feed = current('resistor_9', 'b');
        const load = -current('led_17', 'anode') - current('resistor_10', 'a');
        const stray = Math.abs(current('resistor_4', 'a')) + Math.abs(current('diode_19', 'anode'));
        const lit = ['led_16', 'led_17', 'led_18'].map(id => -current(id, 'anode'));
        checks = [
            {check: 'open arm and tail carry less than 0.01 mA', observed: stray, ok: stray < 0.01},
            {check: 'shared-arm current is the sum of both loads (mA)', expected: load, observed: feed,
                ok: Math.abs(feed - load) < 0.01},
            {check: 'all three main figures conduct from the selected battery', observed: lit,
                ok: lit.every(branch => branch > 0.01)}
        ];
    } else if (bench.id === 'pc22-diode-selector') {
        checks = [[5, 5, 2.699], [0, 5, 2.668], [5, 0, 2.668], [0, 0, 0]].map(([a, b, expected]) => {
            circuit.setPartParam('src_a', 'volts', a);
            circuit.setPartParam('src_b', 'volts', b);
            settled(board, 2);
            const observed = Math.abs(board.branchCurrent('led1', 'anode')) * 1000;
            return {check: 'the enabled sources feed the same LED (mA)', input: [a, b],
                expected, observed, ok: Math.abs(observed - expected) < 0.12};
        });
    } else if (bench.id === '32-source-vs-sink') {
        board.setPin('P1.0', 'quasi', false);
        board.setPin('P1.1', 'quasi', true);
        settled(board, 50);
        const ma = id => Math.abs(board.branchCurrent(id, 'anode')) * 1000;
        const sink = ma('led_sink');
        const source = ma('led_source');
        checks = [{check: 'quasi-bidirectional output sinks far more current than it sources (mA)',
            observed: {sink, source}, ok: sink > 2 && source < 0.3 && sink > 10 * source}];
    } else if (bench.id === '46-port-overcurrent') {
        const bits = Array.from({length: 8}, (_, i) => i);
        for (const bit of bits) board.setPin(`P1.${bit}`, 'quasi', false);
        settled(board, 50);
        const lamps = bits.map(bit => Math.abs(board.branchCurrent(`d${bit}`, 'anode')) * 1000);
        const total = lamps.reduce((sum, branch) => sum + branch, 0);
        checks = [{check: 'each branch stays below 20 mA while the sum exceeds 120 mA',
            observed: {lamps, total}, ok: lamps.every(branch => branch > 1 && branch < 20) && total > 120}];
    } else if (bench.id === '44-darlington-motor' || bench.id === 'pc53-buzzer-switch') {
        const darlington = bench.id === '44-darlington-motor';
        checks = [0, 1, 0].map((pressed, sample) => {
            circuit.setControl(darlington ? 'btn1' : 'button', pressed);
            settled(board, 50);
            const tone = board.buzzerTone(darlington ? 'buzz1' : 'buzzer');
            return measure('buzzer sounds only while the button is pressed', Boolean(pressed), tone.on, sample);
        });
    } else if (bench.id === 'pc31-bridge-rectifier') {
        checks = [9, -9].map(volts => {
            circuit.setPartParam('src', 'volts', volts);
            settled(board, 2);
            const observed = Math.abs(board.branchCurrent('led', 'anode')) * 1000;
            return {check: 'rectifier LED current (mA)', volts, expected: 5.924, observed, ok: Math.abs(observed - 5.924) < 0.2};
        });
    } else if (rcExamples[bench.id]) {
        const [cap, tauMs] = rcExamples[bench.id];
        checks = [0.5, 1, 2, 5].map(tau => {
            board.advanceTo(BigInt(tauMs * tau) * 1_000_000n);
            const expected = 5 * (1 - Math.exp(-tau));
            const observed = voltage(board, cap, 'a') - voltage(board, cap, 'b');
            return {check: 'capacitor follows the documented RC time constant',
                elapsedMs: tau * tauMs, expected, observed, ok: Math.abs(observed - expected) < 0.09};
        });
    } else if (bench.id === 'pc35-capacitor-bypass' || bench.id === 'pc70-schmitt-trigger') {
        const bypass = bench.id === 'pc35-capacitor-bypass';
        const id = bypass ? 'led' : 'led_7';
        const samples = bypass ? [[100, false], [300, true]] : [[100, true], [1500, false]];
        checks = samples.map(([ms, expected]) => {
            board.advanceTo(BigInt(ms) * 1_000_000n);
            return measure('lamp reacts to the RC voltage crossing its threshold', expected, Boolean(readLamps(board, [id])), ms);
        });
    } else if (bench.id === 'pc51-series-capacitors') {
        settled(board, 1000);
        const [first, second] = ['c1', 'c2'].map(id => Math.abs(voltage(board, id, 'a') - voltage(board, id, 'b')));
        const ratio = first / second;
        // The 1 MΩ series resistor gives a 66.7 s time constant, so measure
        // the voltage ratio during charging and require a real voltage rise.
        checks = [{check: 'series capacitor voltage ratio is inverse to capacitance',
            expected: 2, observed: ratio, voltages: [first, second],
            ok: Math.abs(ratio - 2) < 0.05 && first + second > 0.1}];
    } else if (bench.id === 'pc43-bleeder-discharge') {
        settled(board, 5000);
        const charged = voltage(board, 'cap', 'a') - voltage(board, 'cap', 'b');
        // Open the charge branch to model disconnecting its supply.
        circuit.setPartParam('charge', 'ohms', 1e12);
        settled(board, 10_000);
        const observed = (voltage(board, 'cap', 'a') - voltage(board, 'cap', 'b')) / charged;
        checks = [{check: 'the capacitor discharges through the 10-second bleeder time constant',
            expected: 1 / Math.E, observed, ok: charged > 4 && Math.abs(observed - 1 / Math.E) < 0.05}];
    } else if (bench.id === 'pc59-nor-memory' || bench.id === 'pc71-nand-entpreller' || bench.id === 'pc76-alarmschaltung') {
        const nor = bench.id === 'pc59-nor-memory';
        const alarm = bench.id === 'pc76-alarmschaltung';
        const [set, reset] = nor ? ['set', 'reset'] : alarm ? ['switch_5', 'button_6'] : ['button_5', 'button_6'];
        checks = [[1, 0, true], [0, 0, true], [0, 1, false], [0, 0, false]].map(([s, r, expected]) => {
            circuit.setControl(set, s);
            circuit.setControl(reset, r);
            settled(board, 20);
            const observed = alarm ? board.buzzerTone('buzzer_10').on : Boolean(readLamps(board, [nor ? 'q' : 'led_10']));
            return measure('the latch sets, holds, then resets and holds', expected, observed, [s, r]);
        });
    } else if (bench.id === 'pc56-inductor-freewheel') {
        circuit.setControl('sw', 1);
        settled(board, 30);
        const current = id => Math.abs(board.branchCurrent(id, id === 'l' ? 'a' : 'anode'));
        const charged = current('l');
        circuit.setControl('sw', 0);
        let diode = 0;
        for (let sample = 0; sample < 20; sample++) {
            board.advanceTo(board.getTime() + 5_000n);
            diode = Math.max(diode, current('d'));
        }
        settled(board, 150);
        const tail = current('l');
        checks = [{check: 'the diode takes winding current at turn-off and lets it decay',
            observed: {charged, diode, tail}, ok: charged > 0.005 && diode > 0.001 && tail < 0.001}];
    } else if (bench.id === 'pc62-motor-indicator') {
        checks = [0, 1, 0].map(pressed => {
            circuit.setControl('sw', pressed);
            settled(board, 300);
            const observed = Boolean(readLamps(board, ['led']));
            const speed = Math.abs(board.getDeviceState('motor').omega);
            return {check: 'the switch powers the load and its separate indicator', input: pressed,
                expected: Boolean(pressed), observed, speed, ok: observed === Boolean(pressed) && (!pressed || speed > 0)};
        });
    } else {
        return null;
    }
    return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
}
