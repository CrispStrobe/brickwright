/**
 * Is an example a self-contained board or machine rather than one missing a circuit?
 *
 * Some examples legitimately ship no circuit file: a micro:bit or a SPIKE hub
 * IS the board, so there is nothing to place beside it. `test/declared-pins-
 * wired.test.mjs` has always known this — it asserts the equivalence "no
 * circuit if and only if device-only" and computes device-ness from three
 * fields. CARDIAC programs without an external adapter circuit likewise run
 * on their own machine, using its input and output strips.
 *
 * The Circuit tab did not know it. `circuit-tab.jsx`'s loadExample tested only
 * `ex.files.circuit` and, finding none, told the learner:
 *
 *     "mb05-lesson" lists no circuit file, so there is nothing to place on the
 *     board.
 *
 * That reads as a fault report for a state that is correct by design, and a
 * lesson sends learners straight into it. The two sides did not disagree about
 * the definition — the surface had no definition at all, which is why the flag
 * on the entry was never the fix.
 *
 * One predicate, imported by both, so they cannot drift apart. Note that
 * `mb05-lesson` carries no `deviceOnly` field of its own and qualifies through
 * `authored`; setting the flag explicitly would change nothing here and would
 * only help a human reading the index.
 */

/**
 * @param {object} example an entry from examples/index.json
 * @returns {boolean} true when the example needs no external circuit
 */
export const isDeviceOnlyExample = example =>
    Boolean(example) && (
        example.deviceOnly === true ||
        example.authored === 'microbit' ||
        example.authored === 'spike' ||
        (example.target === 'cardiac' && typeof example.files?.cardiac === 'string' &&
            example.files.cardiac.length > 0 && !example.files.circuit)
    );

/**
 * What to tell someone who opened an example that ships no circuit.
 * @param {object} example an entry from examples/index.json
 * @returns {{deviceOnly: boolean, message: string}} the explanation, or the fault
 */
export const noCircuitMessage = example => {
    const id = (example && example.id) || 'that example';
    if (isDeviceOnlyExample(example)) {
        if (example.target === 'cardiac') return {
            deviceOnly: true,
            message: `"${id}" runs on the CARDIAC machine with its input and output strips, ` +
                'so there is no external circuit to place. Open the CARDIAC workspace to run it.'
        };
        const device = example.authored === 'spike' ? 'SPIKE hub' : 'micro:bit';
        return {
            deviceOnly: true,
            message: `"${id}" runs on the ${device} itself — the device is the whole board, ` +
                'so there is no circuit to place. Open it from the Code tab and run it there.'
        };
    }
    return {
        deviceOnly: false,
        message: `"${id}" lists no circuit file, so there is nothing to place on the board.`
    };
};
