import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTACT_BANKS, CONTACT_ROWS, ENDPOINTS, MAX_WIRES, contactEndpoint,
    createEmptyProgram, evaluateProgram, truthTable, validateProgram}
    from '../overlay/scratch-gui/src/lib/logikus/model.js';
import {LOGIKUS_PRESETS, getPreset} from '../overlay/scratch-gui/src/lib/logikus/presets.js';

const settings = value => Array.from({length: 10}, (_, i) => Boolean((value >> (9 - i)) & 1));
const programWith = edges => ({...createEmptyProgram(),
    wires: edges.map(([from, to], i) => ({id: `wire-${i}`, from, to}))});

test('the contact inventory has exactly ten sliders, five independent banks and no J row', () => {
    assert.equal(ENDPOINTS.length, 213);
    assert.equal(new Set(ENDPOINTS).size, 213);
    assert.deepEqual(CONTACT_BANKS, [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G', 'H'], ['I', 'K']]);
    assert.equal(contactEndpoint(9, 'K', 'b'), 'S9.Kb');
    assert.throws(() => contactEndpoint(10, 'A', 'a'), /Invalid/);
    assert.throws(() => contactEndpoint(0, 'J', 'a'), /Invalid/);
    assert.throws(() => contactEndpoint(0, 'A', 'c'), /Invalid/);
});

test('every slider closes all five selected contacts without connecting its rows together', () => {
    for (let switchIndex = 0; switchIndex < 10; switchIndex++) {
        const program = programWith(CONTACT_ROWS.flatMap((row, i) => [
            ['Q', contactEndpoint(switchIndex, row, 'a')],
            [contactEndpoint(switchIndex, row, 'b'), `L${i}`]
        ]));
        for (const state of [false, true]) {
            const switches = Array(10).fill(!state);
            switches[switchIndex] = state;
            const result = evaluateProgram(program, {switches});
            assert.deepEqual(result.lamps, CONTACT_ROWS.map((_, i) => i % 2 === (state ? 0 : 1)),
                `S${switchIndex} at ${Number(state)}`);
            assert.equal(result.closedContacts.length, 50);
        }
        // Energizing one selected bank cannot energize another selected bank.
        for (const state of [0, 1]) {
            const selected = CONTACT_BANKS.map(pair => pair[state ? 0 : 1]);
            const independent = programWith([
                ['Q', contactEndpoint(switchIndex, selected[0], 'a')],
                [contactEndpoint(switchIndex, selected[0], 'b'), 'L0'],
                ...selected.slice(1).map((row, i) => [contactEndpoint(switchIndex, row, 'b'), `L${i + 1}`])
            ]);
            const switches = Array(10).fill(0); switches[switchIndex] = state;
            assert.deepEqual(evaluateProgram(independent, {switches}).lamps,
                [true, false, false, false, false, false, false, false, false, false]);
        }
    }
});

test('wires and contacts conduct in either direction; lamps do not share their input terminals', () => {
    const program = programWith([['S2.Ab', 'Q'], ['L4', 'S2.Aa'], ['L4', 'L5']]);
    const switches = Array(10).fill(0); switches[2] = 1;
    const result = evaluateProgram(program, {switches});
    assert.deepEqual(result.lamps, [false, false, false, false, true, true, false, false, false, false]);
    assert.deepEqual(result.paths[4], ['wire-0', 'wire-1']);
    assert.deepEqual(result.paths[5], ['wire-0', 'wire-1', 'wire-2']);
    assert.equal(result.paths[0], null);
    switches[2] = 0;
    assert.ok(evaluateProgram(program, {switches}).lamps.every(on => !on));
});

test('Test only joins Ta to Tb; a powered dangling lead does not imply a lit lamp', () => {
    const program = programWith([['Q', 'Ta'], ['Tb', 'L0'], ['Q', 'S0.Aa']]);
    const released = evaluateProgram(program);
    assert.equal(released.lamps[0], false);
    assert.deepEqual(released.poweredWires, ['wire-0', 'wire-2']);
    assert.equal(released.paths[0], null);
    const pressed = evaluateProgram(program, {button: 1});
    assert.equal(pressed.lamps[0], true);
    assert.deepEqual(pressed.paths[0], ['wire-0', 'wire-1']);
    assert.deepEqual(pressed.poweredWires, ['wire-0', 'wire-1', 'wire-2']);
    assert.deepEqual(evaluateProgram(programWith([['Tb', 'L0']]), {button: true}).poweredNodes, ['Q']);
});

test('rewiring changes the evaluated circuit, and loops terminate without inventing power', () => {
    const program = programWith([
        ['Q', 'S0.Aa'], ['S0.Ab', 'S1.Aa'], ['S1.Ab', 'L0'],
        ['S1.Aa', 'S2.Aa'], ['S2.Ab', 'S0.Ab']
    ]);
    const switches = Array(10).fill(0); switches[0] = 1; switches[1] = 1; switches[2] = 1;
    assert.equal(evaluateProgram(program, {switches}).lamps[0], true);
    program.wires = program.wires.filter(wire => wire.id !== 'wire-0');
    assert.ok(evaluateProgram(program, {switches}).lamps.every(on => !on), 'isolated powered-looking loop stays dark');
    program.wires.push({id: 'rewire', from: 'Q', to: 'L0'});
    assert.equal(evaluateProgram(program).lamps[0], true, 'a wire is genuinely editable');
});

const expectedOutputs = (id, s, button) => {
    const [a, b, c, d] = s;
    const outputs = {
        lamp: [a], and: [a && b], or: [a || b], not: [!a], xor: [a !== b],
        'half-adder': [a !== b, a && b],
        majority: [[a, b, c].filter(Boolean).length >= 2],
        river: [a && !c && (!b || !d), !a && c && (b || d)],
        'code-lock': [button && s.map(Number).join('') === '1011101101']
    };
    return [...outputs[id], ...Array(10 - outputs[id].length).fill(false)];
};

for (const preset of LOGIKUS_PRESETS) {
    test(`${preset.id}: all 1024 slider settings match an independent Boolean specification`, () => {
        for (let value = 0; value < 1024; value++) {
            const switches = settings(value);
            for (const button of preset.usesButton ? [false, true] : [false]) {
                assert.deepEqual(evaluateProgram(preset.program, {switches, button}).lamps,
                    expectedOutputs(preset.id, switches, button), `${value.toString(2).padStart(10, '0')}, Test=${button}`);
            }
        }
    });
}

test('the river circuit recognizes a complete legal seven-crossing solution', () => {
    const route = ['0000', '1010', '0010', '1110', '0100', '1101', '0101', '1111'];
    const program = getPreset('river').program;
    for (let i = 0; i < route.length; i++) {
        const switches = [...route[i]].map(Number).concat(Array(6).fill(0));
        assert.deepEqual(evaluateProgram(program, {switches}).lamps.slice(0, 2), [false, false], route[i]);
        if (!i) continue;
        const previous = route[i - 1];
        const changed = [...route[i]].map((bit, index) => bit !== previous[index]);
        assert.equal(changed[0], true, 'farmer crosses on every move');
        assert.ok(changed.filter(Boolean).length <= 2, 'at most one passenger');
        changed.forEach((moves, index) => {
            if (moves) assert.equal(previous[index], previous[0], 'passenger starts beside farmer');
        });
    }
});

test('truth tables enumerate selected switch bits and optional Test, without touching live settings', () => {
    const program = getPreset('code-lock').program;
    const rows = truthTable(program, {switchIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], button: true});
    assert.equal(rows.length, 2048);
    assert.equal(rows.filter(row => row.lamps[0]).length, 1);
    assert.deepEqual(rows.find(row => row.lamps[0]), {
        switches: [...'1011101101'].map(bit => bit === '1'), button: true,
        lamps: [true, false, false, false, false, false, false, false, false, false]
    });
    const selected = truthTable(getPreset('or').program, {switchIndices: [1, 0]});
    assert.deepEqual(selected.map(row => [row.switches[1], row.switches[0], row.lamps[0]]),
        [[false, false, false], [false, true, true], [true, false, true], [true, true, true]]);
    assert.equal(truthTable(getPreset('half-adder').program).length, 4);
    assert.equal(truthTable(createEmptyProgram()).length, 1);
    for (const switchIndices of [[0, 0], [10], [-1], ['0'], [0.5], Array(1), Array.from({length: 11}, (_, i) => i)]) {
        assert.throws(() => truthTable(program, {switchIndices}), /unique indices/);
    }
    assert.throws(() => truthTable(program, {button: 'yes'}), /true or false/);
});

test('program import validates bounds, terminals, unique IDs and unique undirected connections', () => {
    const valid = getPreset('half-adder').program;
    const invalid = [null, [], {...valid, version: 2}, {...valid, title: ''}, {...valid, title: 'x'.repeat(121)},
        {...valid, switchLabels: []}, {...valid, lampLabels: Array(10)},
        {...valid, switchLabels: Array(10).fill('x'.repeat(49))},
        {...valid, wires: null}, {...valid, wires: Array(MAX_WIRES + 1).fill(valid.wires[0])},
        {...valid, wires: Array(1)},
        {...valid, wires: [{id: 'bad', from: 'S10.Aa', to: 'L0'}]},
        {...valid, wires: [{id: 'bad', from: 'S0.Ja', to: 'L0'}]},
        {...valid, wires: [{id: 'bad', from: 'Q', to: 'Q'}]},
        {...valid, wires: [{id: 'x'.repeat(65), from: 'Q', to: 'L0'}]},
        {...valid, wires: [{id: 'bad id', from: 'Q', to: 'L0'}]},
        {...valid, wires: [{id: 'dup', from: 'Q', to: 'L0'}, {id: 'dup', from: 'Q', to: 'L1'}]},
        {...valid, wires: [{id: 'one', from: 'Q', to: 'L0'}, {id: 'two', from: 'L0', to: 'Q'}]}
    ];
    for (const program of invalid) assert.throws(() => validateProgram(program));
    assert.throws(() => validateProgram(invalid.at(-1)), /duplicates an existing connection/);
    const imported = validateProgram(JSON.parse(JSON.stringify(valid)));
    assert.deepEqual(imported, valid);
    imported.wires[0].to = 'L9'; imported.switchLabels[0] = 'Changed';
    assert.notDeepEqual(imported, valid);
    assert.notEqual(valid.switchLabels[0], 'Changed');
});

test('inputs are strict binary values and neither evaluation nor returned presets mutate their source', () => {
    const program = getPreset('half-adder').program;
    const inputs = {switches: Array(10).fill(false), button: false};
    const before = JSON.stringify({program, inputs});
    evaluateProgram(program, inputs);
    truthTable(program);
    assert.equal(JSON.stringify({program, inputs}), before);
    const copy = getPreset('half-adder'); copy.program.wires.length = 0; copy.copy.en.title = 'Changed';
    assert.ok(getPreset('half-adder').program.wires.length > 0);
    assert.notEqual(getPreset('half-adder').copy.en.title, 'Changed');
    assert.throws(() => getPreset('missing'), /Unknown/);
    for (const input of [null, [], {switches: [1]}, {switches: Array(10)},
        {switches: Array(10).fill('1')}, {switches: Array(10).fill(2)}, {button: '1'}]) {
        assert.throws(() => evaluateProgram(program, input));
    }
    assert.equal(evaluateProgram(program, {switches: [1, 1, ...Array(8).fill(0)], button: 0}).lamps[1], true);
});

// Independent connectivity oracle: union-find has no traversal order, no
// source-first queue, and no path bookkeeping in common with the implementation.
function oracle (program, switches, button) {
    const roots = new Map(ENDPOINTS.map(node => [node, node]));
    const root = node => { while (roots.get(node) !== node) node = roots.get(node); return node; };
    const join = (a, b) => roots.set(root(a), root(b));
    program.wires.forEach(wire => join(wire.from, wire.to));
    for (let i = 0; i < 10; i++) {
        for (const row of switches[i] ? ['A', 'C', 'E', 'G', 'I'] : ['B', 'D', 'F', 'H', 'K']) {
            join(`S${i}.${row}a`, `S${i}.${row}b`);
        }
    }
    if (button) join('Ta', 'Tb');
    const source = root('Q');
    return new Set(ENDPOINTS.filter(node => root(node) === source));
}

test('edited arbitrary patch graphs match independent connectivity, including cycles and reverse feeds', () => {
    let seed = 20261125;
    const next = limit => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
    for (let sample = 0; sample < 40; sample++) {
        const program = createEmptyProgram();
        const pairs = new Set();
        while (program.wires.length < 120) {
            const from = ENDPOINTS[next(ENDPOINTS.length)], to = ENDPOINTS[next(ENDPOINTS.length)];
            const pair = [from, to].sort().join('|');
            if (from === to || pairs.has(pair)) continue;
            pairs.add(pair);
            program.wires.push({id: `w${program.wires.length}`, from, to});
        }
        const switches = settings(next(1024)), button = Boolean(next(2));
        const expected = oracle(program, switches, button);
        const actual = evaluateProgram(program, {switches, button});
        assert.deepEqual(new Set(actual.poweredNodes), expected, `graph ${sample}`);
        assert.deepEqual(actual.lamps, Array.from({length: 10}, (_, i) => expected.has(`L${i}`)));
        assert.deepEqual(actual.poweredWires, program.wires.filter(w => expected.has(w.from)).map(w => w.id));
        actual.paths.forEach((path, i) => {
            if (!actual.lamps[i]) return assert.equal(path, null);
            const route = {...program, wires: program.wires.filter(wire => path.includes(wire.id))};
            assert.equal(oracle(route, switches, button).has(`L${i}`), true,
                `reported path must independently connect Q to L${i}`);
        });
    }
});
