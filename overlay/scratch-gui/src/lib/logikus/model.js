/**
 * An ideal-contact model of the Kosmos Logikus patchboard.
 *
 * Each slider operates five electrically independent contact pairs. In state
 * 1 the A/C/E/G/I rows close; in state 0 B/D/F/H/K close. A row's a and b
 * terminals are connected by its contact, not to the other rows in the bank.
 * Wires and closed contacts conduct in both directions. Q is the source;
 * lamps have an implicit return, which must NOT connect their input terminals.
 * Multiple sockets on one real terminal are represented by one graph node.
 * This educational model does not model resistance, current or battery sag.
 */

export const SWITCH_COUNT = 10;
export const LAMP_COUNT = 10;
export const MAX_WIRES = 512;
export const CONTACT_BANKS = Object.freeze([
    Object.freeze(['A', 'B']), Object.freeze(['C', 'D']),
    Object.freeze(['E', 'F']), Object.freeze(['G', 'H']), Object.freeze(['I', 'K'])
]);
export const CONTACT_ROWS = Object.freeze(CONTACT_BANKS.flat());

export function contactEndpoint (index, row, side) {
    if (!Number.isInteger(index) || index < 0 || index >= SWITCH_COUNT ||
        !CONTACT_ROWS.includes(row) || !['a', 'b'].includes(side)) {
        throw new Error('Invalid Logikus contact.');
    }
    return `S${index}.${row}${side}`;
}

export const ENDPOINTS = Object.freeze([
    'Q', 'Ta', 'Tb', ...Array.from({length: LAMP_COUNT}, (_, i) => `L${i}`),
    ...Array.from({length: SWITCH_COUNT}, (_, i) => CONTACT_ROWS.flatMap(row =>
        ['a', 'b'].map(side => contactEndpoint(i, row, side)))).flat()
]);
const endpointSet = new Set(ENDPOINTS);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createEmptyProgram () {
    return {
        version: 1,
        title: 'My Logikus circuit',
        switchLabels: Array.from({length: SWITCH_COUNT}, (_, i) => `S${i}`),
        lampLabels: Array.from({length: LAMP_COUNT}, (_, i) => `L${i}`),
        wires: []
    };
}

/** Validate untrusted JSON and return a bounded, independent canonical copy. */
export function validateProgram (input) {
    if (!isRecord(input)) throw new Error('A Logikus program must be an object.');
    if (input.version !== 1) throw new Error('Unsupported Logikus program version.');
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120) {
        throw new Error('The circuit title must contain 1 to 120 characters.');
    }
    const labels = (value, name, count) => {
        if (!Array.isArray(value) || value.length !== count ||
            Array.from(value).some(label => typeof label !== 'string' || label.length > 48)) {
            throw new Error(`${name} must contain ${count} labels of at most 48 characters.`);
        }
        return value.slice();
    };
    const switchLabels = labels(input.switchLabels, 'switchLabels', SWITCH_COUNT);
    const lampLabels = labels(input.lampLabels, 'lampLabels', LAMP_COUNT);
    if (!Array.isArray(input.wires) || input.wires.length > MAX_WIRES) {
        throw new Error(`A Logikus program may contain at most ${MAX_WIRES} wires.`);
    }
    const ids = new Set();
    const pairs = new Set();
    const wires = Array.from(input.wires, (wire, index) => {
        if (!isRecord(wire) || typeof wire.id !== 'string' ||
            !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(wire.id)) {
            throw new Error(`Wire ${index + 1} needs an identifier of 1 to 64 letters, digits or . _ : -.`);
        }
        if (ids.has(wire.id)) throw new Error(`Duplicate wire identifier: ${wire.id}.`);
        ids.add(wire.id);
        if (!endpointSet.has(wire.from) || !endpointSet.has(wire.to)) {
            throw new Error(`Wire ${wire.id} refers to an unknown terminal.`);
        }
        if (wire.from === wire.to) throw new Error(`Wire ${wire.id} must join two different terminals.`);
        const pair = [wire.from, wire.to].sort().join('|');
        if (pairs.has(pair)) throw new Error(`Wire ${wire.id} duplicates an existing connection.`);
        pairs.add(pair);
        return {id: wire.id, from: wire.from, to: wire.to};
    });
    return {version: 1, title: input.title, switchLabels, lampLabels, wires};
}

const binary = (value, name) => {
    if (![false, true, 0, 1].includes(value)) throw new Error(`${name} must be 0 or 1.`);
    return value === true || value === 1;
};

function normalizeInputs (input) {
    if (!isRecord(input)) throw new Error('Logikus inputs must be an object.');
    const values = input.switches === undefined ? Array(SWITCH_COUNT).fill(false) : input.switches;
    if (!Array.isArray(values) || values.length !== SWITCH_COUNT) {
        throw new Error(`Logikus needs ${SWITCH_COUNT} binary switch settings.`);
    }
    return {switches: Array.from(values, (value, i) => binary(value, `S${i}`)),
        button: binary(input.button === undefined ? false : input.button, 'Test button')};
}

function evaluateValidated (program, inputs) {
    const adjacency = new Map(ENDPOINTS.map(node => [node, []]));
    const connect = (from, to, wireId = null) => {
        adjacency.get(from).push({to, wireId});
        adjacency.get(to).push({to: from, wireId});
    };
    for (const wire of program.wires) connect(wire.from, wire.to, wire.id);
    const closedContacts = [];
    inputs.switches.forEach((state, switchIndex) => {
        CONTACT_BANKS.forEach((pair, bank) => {
            const row = pair[state ? 0 : 1];
            const from = contactEndpoint(switchIndex, row, 'a');
            const to = contactEndpoint(switchIndex, row, 'b');
            connect(from, to);
            closedContacts.push({from, to, switchIndex, row, bank});
        });
    });
    if (inputs.button) connect('Ta', 'Tb');

    const parents = new Map([['Q', null]]);
    const queue = ['Q'];
    for (let i = 0; i < queue.length; i++) {
        const from = queue[i];
        for (const edge of adjacency.get(from)) {
            if (parents.has(edge.to)) continue;
            parents.set(edge.to, {from, wireId: edge.wireId});
            queue.push(edge.to);
        }
    }
    const lamps = Array.from({length: LAMP_COUNT}, (_, i) => parents.has(`L${i}`));
    const paths = lamps.map((on, index) => {
        if (!on) return null;
        const wires = [];
        let node = `L${index}`;
        while (node !== 'Q') {
            const edge = parents.get(node);
            if (edge.wireId !== null) wires.push(edge.wireId);
            node = edge.from;
        }
        return wires.reverse();
    });
    return {
        lamps,
        poweredNodes: queue,
        // Source-connected wires can include dangling leads: this is electrical
        // reachability, not a current measurement. paths contains a complete
        // source-to-lamp route (wire IDs only), or null for an unlit lamp.
        poweredWires: program.wires.filter(wire => parents.has(wire.from)).map(wire => wire.id),
        paths,
        closedContacts,
        inputs: {switches: inputs.switches.slice(), button: inputs.button}
    };
}

export function evaluateProgram (program, inputs = {}) {
    return evaluateValidated(validateProgram(program), normalizeInputs(inputs));
}

/**
 * Enumerate all settings of the chosen switches; all other switches stay 0.
 * The first selected switch is the most significant bit. With button:true,
 * also enumerate the Test button as the final bit (at most 2^11 = 2048 rows).
 * Otherwise the button stays released. By default include switches referenced
 * by a wire, in S0..S9 order. This function never changes the live inputs.
 */
export function truthTable (program, {switchIndices, button = false} = {}) {
    const validated = validateProgram(program);
    if (typeof button !== 'boolean') throw new Error('Include Test must be true or false.');
    const referenced = new Set(validated.wires.flatMap(wire => [wire.from, wire.to])
        .filter(node => node.startsWith('S')).map(node => Number(node[1])));
    const indices = switchIndices === undefined ? [...referenced].sort((a, b) => a - b) : switchIndices;
    if (!Array.isArray(indices) || indices.length > SWITCH_COUNT ||
        Array.from(indices).some(index => !Number.isInteger(index) || index < 0 || index >= SWITCH_COUNT) ||
        new Set(indices).size !== indices.length) {
        throw new Error('Truth table switches must be unique indices from 0 to 9.');
    }
    const bits = indices.length + (button ? 1 : 0);
    return Array.from({length: 2 ** bits}, (_, combination) => {
        const switches = Array(SWITCH_COUNT).fill(false);
        indices.forEach((index, position) => {
            switches[index] = Boolean((combination >> (bits - position - 1)) & 1);
        });
        const pressed = button && Boolean(combination & 1);
        return {switches, button: pressed,
            lamps: evaluateValidated(validated, {switches, button: pressed}).lamps};
    });
}
