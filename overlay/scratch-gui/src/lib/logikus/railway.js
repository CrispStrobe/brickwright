import {LAMP_COUNT, SWITCH_COUNT, truthTable, validateProgram} from './model.js';
import {programInputs} from './inspection.js';

export const RAILWAY_SWITCHES = Object.freeze([0, 1, 2, 3, 4]);

const binaryValues = (values, count, name) => {
    if (!Array.isArray(values) || values.length !== count ||
        Array.from(values).some(value => ![false, true, 0, 1].includes(value))) {
        throw new Error(`${name} must contain ${count} binary values.`);
    }
    return Array.from(values, Boolean);
};

/**
 * Independent behavioral specification for the railway experiment. The live
 * signals always come from evaluating the edited contact network, never from
 * this oracle. Both requests mean both stop; unrelated lamps remain off.
 */
export function railwayTarget (switches) {
    const [requestA, requestB, crossing, exitA, exitB] =
        binaryValues(switches, SWITCH_COUNT, 'Railway switches');
    return [requestA && !requestB && !crossing && !exitA,
        requestB && !requestA && !crossing && !exitB,
        ...Array(LAMP_COUNT - 2).fill(false)];
}

/**
 * Inspect the actual signal outputs against state safety conditions. These
 * conditions deliberately do not claim correct service: an all-red circuit
 * passes, and the both-requests-stop policy belongs to the behavioral target.
 * Other lamp outputs have no railway meaning and are only checked by target
 * comparison. Codes are stable so the scene can supply localized explanations.
 */
export function railwayViolations (switches, lamps) {
    const [requestA, requestB, crossing, exitA, exitB] =
        binaryValues(switches, SWITCH_COUNT, 'Railway switches');
    const [greenA, greenB] = binaryValues(lamps, LAMP_COUNT, 'Railway lamps');
    const violations = [];
    if (greenA && greenB) violations.push('conflicting-routes');
    if (crossing && (greenA || greenB)) violations.push('crossing-occupied');
    if (greenA && exitA) violations.push('exit-a-occupied');
    if (greenB && exitB) violations.push('exit-b-occupied');
    if (greenA && !requestA) violations.push('route-a-unrequested');
    if (greenB && !requestB) violations.push('route-b-unrequested');
    return violations;
}

/**
 * Exhaustively check the union of the fixed railway inputs and every input in
 * the edited circuit. A removed contact cannot hide a required input; an added
 * S5..S9 or Test contact cannot hide a new dependency. Complete rows reproduce
 * either kind of failure when applied to the normal circuit model.
 */
export function inspectRailway (program) {
    const validated = validateProgram(program);
    const wiredInputs = programInputs(validated);
    const switchIndices = [...new Set([...RAILWAY_SWITCHES, ...wiredInputs.switchIndices])].sort((a, b) => a - b);
    const button = wiredInputs.button;
    const rows = truthTable(validated, {switchIndices, button}).map(row => {
        const expected = railwayTarget(row.switches);
        const different = row.lamps.flatMap((on, index) => on === expected[index] ? [] : [index]);
        const violations = railwayViolations(row.switches, row.lamps);
        return {...row, expected, different, matches: different.length === 0,
            violations, safe: violations.length === 0};
    });
    const safeCount = rows.filter(row => row.safe).length;
    const matched = rows.filter(row => row.matches).length;
    return {switchIndices, button, rows, total: rows.length,
        safeCount, unsafeCount: rows.length - safeCount, matched, mismatched: rows.length - matched,
        safetyCounterexample: rows.find(row => !row.safe) || null,
        counterexample: rows.find(row => !row.matches) || null};
}
