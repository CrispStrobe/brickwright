import {evaluateProgram, truthTable} from './model.js';

export function programInputs (...programs) {
    const switches = new Set();
    let button = false;
    for (const program of programs.filter(Boolean)) for (const wire of program.wires) {
        for (const node of [wire.from, wire.to]) {
            const match = /^S(\d)\./.exec(node);
            if (match) switches.add(Number(match[1]));
            if (node === 'Ta' || node === 'Tb') button = true;
        }
    }
    return {switchIndices: [...switches].sort((a, b) => a - b), button};
}

/** Enumerate the whole relevant input space, including inputs removed by an
 * incorrect edit. Each mismatch contains a reproducible counterexample.
 */
export function inspectProgram (program, target) {
    const inputs = programInputs(program, target);
    const rows = truthTable(program, inputs).map(row => {
        const expected = target ? evaluateProgram(target, row).lamps : null;
        const different = expected ? row.lamps.map((on, i) => on !== expected[i] ? i : -1).filter(i => i >= 0) : [];
        return {...row, expected, different, matches: different.length === 0};
    });
    return {...inputs, rows, matched: rows.filter(row => row.matches).length,
        counterexample: rows.find(row => !row.matches) || null};
}
