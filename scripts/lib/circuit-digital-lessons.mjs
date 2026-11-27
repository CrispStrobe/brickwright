// SPDX-License-Identifier: BSD-3-Clause

const controlLines = ['ep', 'lm', 'cp', 'ce', 'li', 'ei', 'la', 'lb', 'eu', 'su', 'ea', 'lo'];
const fetch = ['ep+lm', 'cp', 'ce+li'];
const microsteps = [
    [0, 'LDA', [...fetch, 'ei+lm', 'ce+la', '']],
    [1, 'ADD', [...fetch, 'ei+lm', 'ce+lb', 'eu+la']],
    [2, 'SUB', [...fetch, 'ei+lm', 'ce+lb', 'eu+la+su']],
    [14, 'OUT', [...fetch, 'ea+lo', '', '']]
];
const names = value => value.split('+').filter(Boolean).sort();

function inspectCircuit (circuit) {
    const {board} = circuit;
    const checks = [];
    const settle = () => {
        circuit.advanceTo(board.getTime() + 50_000n);
        circuit.advanceTo(board.getTime() + 50_000n);
    };
    const set = (id, value) => {
        if (!circuit.parts.some(part => part.id === id)) throw new Error('Missing DIP switch ' + id);
        circuit.setPartParam(id, 'switches', value);
        settle();
    };
    const lit = id => {
        const brightness = board.ledBrightnessNow(id);
        if (!Number.isFinite(brightness)) throw new Error('Missing LED ' + id);
        return brightness > 0.05;
    };
    return {
        checks, board, set, lit, settle,
        record (check, expected, observed) {
            checks.push({check, expected, observed, ok: JSON.stringify(expected) === JSON.stringify(observed)});
        },
        tick (count = 1) {
            for (let i = 0; i < count; i++) {
                set('swc', 1);
                set('swc', 0);
            }
        },
        store (value, wide = false) {
            set('swd', value & 15);
            if (wide) set('swe', value >> 4);
            set('swc', 2);
            set('swc', 0);
        },
        read (prefix, bits = 4) {
            return Array.from({length: bits}, (_, bit) => lit(prefix + bit) ? 1 << bit : 0)
                .reduce((value, bit) => value | bit, 0);
        },
        active (prefix, candidates) {
            return candidates.filter(candidate => lit(prefix + candidate)).sort();
        }
    };
}

function memory (view) {
    view.store(5);
    const first = view.read('led_data');
    view.tick();
    view.store(0);
    const next = view.read('led_addr');
    const second = view.read('led_data');
    view.tick(15);
    view.record('writes two independent cells, then reads the first again', [10, 1, 15, 0, 10],
        [first, next, second, view.read('led_addr'), view.read('led_data')]);
}

function accumulator (view) {
    view.set('swc', 2);
    view.set('swc', 0);
    view.set('swv', 3);
    const totals = [];
    for (let step = 0; step < 3; step++) {
        view.tick();
        totals.push(view.read('led'));
    }
    view.set('swv', 7);
    const held = view.read('led');
    view.set('swc', 2);
    view.set('swc', 0);
    view.record('adds 3 at each clock, holds without a clock and resets', [3, 6, 9, 9, 0],
        [...totals, held, view.read('led')]);
}

function toFirstStep (view, ring) {
    for (let tick = 0; tick < 12; tick++) {
        if (ring ? view.active('led_t', [1, 2, 3, 4, 5, 6]).join() === '1' : view.read('led_s', 3) === 0) return;
        view.tick();
    }
}

function controlMatrix (view, ring) {
    const microcode = ring ? microsteps : [...microsteps, [7, 'unknown opcode', [...fetch, '', '', '']]];
    for (const [opcode, label, table] of microcode) {
        view.set('swi', opcode);
        toFirstStep(view, ring);
        for (let step = 0; step < table.length; step++) {
            const state = ring ? view.active('led_t', [1, 2, 3, 4, 5, 6]) : view.read('led_s', 3);
            view.record('step counter at ' + label + ' T' + (step + 1), ring ? [step + 1] : step, state);
            view.record('control lines at ' + label + ' T' + (step + 1), names(table[step]),
                view.active('led_', controlLines));
            view.tick();
        }
    }
}

function triStateBus (view) {
    const nets = Array.from({length: 4}, (_, bit) => view.board.nets.find(net =>
        net.terminals.some(term => term.part === 'rbus' + bit && term.terminal === 'a')));
    if (nets.some(net => !net)) throw new Error('Missing bus pull-down net');
    view.set('swa', 5);
    view.set('swb', 10);
    for (const [enable, expected] of [[0, [0, 0, 0, 0]], [1, [1, 0, 1, 0]], [2, [0, 1, 0, 1]], [3, ['?', '?', '?', '?']]]) {
        view.set('swe', enable);
        const voltage = nets.map(net => view.board.nodeVoltage(net.id));
        view.record('bus levels with enable mask ' + enable, expected,
            voltage.map(level => level > 3.5 ? 1 : level < 1 ? 0 : '?'));
    }
}

function memoryWalker (view) {
    const input = [3, 9, 5, 12];
    for (const value of input) {
        view.store(value);
        view.tick();
    }
    view.tick(12);
    const observed = input.map(() => {
        const state = [view.read('led_addr'), view.read('led_data'), view.read('led_bus')];
        view.tick();
        return state;
    });
    view.record('memory data, address register and bus follow four clocked cells',
        input.map((value, address) => [address, value, address]), observed);
}

function fetchCycle (view) {
    const program = [7, 12, 11];
    for (const value of program) {
        view.store(value);
        view.tick(3);
    }
    view.tick(39);
    for (const [address, opcode] of ['add', 'out', 'sub'].entries()) {
        view.record('T1 drives the address into MAR', [[1], address, address],
            [view.active('led_t', [1, 2, 3]), view.read('led_bus'), view.read('led_addr')]);
        view.tick();
        view.record('T2 bus is idle', [[2], 0], [view.active('led_t', [1, 2, 3]), view.read('led_bus')]);
        view.tick();
        const word = program[address];
        view.record('T3 latches and decodes ' + opcode, [[3], word, word, [opcode]],
            [view.active('led_t', [1, 2, 3]), view.read('led_bus'), view.read('led_ir'),
                view.active('led_', ['add', 'lda', 'out', 'sub'])]);
        view.tick();
    }
}

function machine (view, wide) {
    const program = wide ? [3, 0x13, 0x30, 100] : [3, 7, 12, 5];
    for (const word of program) {
        view.store(word, wide);
        view.tick(6);
    }
    view.tick(12 * 6);
    view.record('the program counter wrapped back to address zero', 0, view.read('led_addr'));
    view.tick(3 * 6);
    const expected = wide ? 200 : 10;
    const width = wide ? 8 : 4;
    view.record('LDA, ADD and OUT copy the sum into the accumulator and the output register', [expected, expected],
        [view.read('led_a', width), view.read('led_out', width)]);
}

function diodeKeypad (view) {
    const banks = ['k03', 'k47', 'k89'];
    const observed = [];
    for (let digit = 0; digit < 10; digit++) {
        const bank = Math.floor(digit / 4);
        banks.forEach((name, index) => view.set(name, index === bank ? 1 << (digit % 4) : 0));
        observed.push(view.read('led_b'));
    }
    view.record('single-key decimal encoding', Array.from({length: 10}, (_, digit) => digit), observed);
    banks.forEach(name => view.set(name, 0));
    view.record('releasing keys shows zero like key zero', 0, view.read('led_b'));
    view.set('k03', 6);
    view.record('simultaneous keys one and two electrically OR to three', 3, view.read('led_b'));
}

function conditionalJump (view) {
    for (const [opcode, label, wants] of [[3, 'JZ', [false, true, false, true]], [4, 'JC', [false, false, true, true]],
        [0, 'LDA', [null, null, null, null]]]) {
        view.set('swi', opcode);
        for (let flags = 0; flags < 4; flags++) {
            view.set('swf', flags);
            toFirstStep(view, false);
            view.record(label + ' fetch is independent of its flags', ['ep', 'lm'], view.active('led_', [...controlLines, 'lp']));
            view.tick(3);
            const want = wants[flags];
            const lines = want === null ? ['ei', 'lm'] : want ? ['ei', 'lp'] : [];
            view.record(label + ' T4 with Z/C switch mask ' + flags, lines,
                view.active('led_', [...controlLines, 'lp']));
        }
    }
}

function alu (view) {
    for (const [a, b, subtract] of [[200, 100, false], [255, 1, false], [0, 1, true], [5, 5, true], [15, 1, false]]) {
        view.set('a_lo', a & 15);
        view.set('a_hi', a >> 4);
        view.set('b_lo', b & 15);
        view.set('b_hi', b >> 4);
        view.set('swm', Number(subtract));
        const value = (subtract ? a - b : a + b) & 255;
        view.record(`${a} ${subtract ? '-' : '+'} ${b}: sum, carry/no borrow and zero`,
            [value, subtract ? a >= b : a + b > 255, value === 0],
            [view.read('led_s', 8), view.lit('led_carry'), view.lit('led_zero')]);
    }
}

const scripts = {
    'pc102-ram-16x4': memory,
    'pc103-accumulator': accumulator,
    'pc106-control-matrix': view => controlMatrix(view, true),
    'pc107-the-bus': triStateBus,
    'pc108-memory-walker': memoryWalker,
    'pc109-fetch-cycle': fetchCycle,
    'pc110-the-machine': view => machine(view, false),
    'pc111-diode-keypad': diodeKeypad,
    'pc112-control-rom': view => controlMatrix(view, false),
    'pc113-conditional-jump': conditionalJump,
    'pc114-alu-flags': alu,
    'pc117-microcoded-machine': view => machine(view, false),
    'pc118-eight-bit-machine': view => machine(view, true)
};

export function checkDigitalLesson (bench, circuit) {
    if (!Object.hasOwn(scripts, bench.id)) return null;
    const view = inspectCircuit(circuit);
    view.settle();
    scripts[bench.id](view);
    return {status: view.checks.every(result => result.ok) ? 'pass' : 'fail', checks: view.checks};
}
