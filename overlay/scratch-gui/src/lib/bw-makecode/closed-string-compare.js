/** PXT String.compare returns 0, -1 or 1 using case-sensitive value comparison.
 * Capture both actual operands in order; never duplicate their evaluation or
 * infer a String from an annotation that also has another observed producer.
 */
export function closedStringCompare(translator, node) {
    if (node?.type !== 'Call' || node.callee?.type !== 'Member' || node.callee.name !== 'compare') return null;
    const receiver = node.callee.object, args = node.args || [];
    if (args.length !== 1 || !translator.exactStringReferences?.has(receiver) || !translator.exactStringReferences?.has(args[0])) {
        translator.note('String.compare() requires exactly one argument and actual String producers for both operands');
        return 'undefined value';
    }
    if (!translator.pre || translator.inLoopCondition) {
        translator.note('String.compare() requires an evaluation position that preserves both operand captures');
        return 'undefined value';
    }
    const left = translator.freshName('_mcCompareLeft'), right = translator.freshName('_mcCompareRight');
    const result = translator.freshName('_mcCompareResult');
    translator.pre.push(`set ${left} to ${translator.arrayElementValue(receiver)}`);
    translator.pre.push(`set ${right} to ${translator.arrayElementValue(args[0])}`);
    translator.pre.push(
        `IF compare value (${left}) op "===" with (${right}) THEN:`,
        `  set ${result} to (0 + (0))`,
        'ELSE:',
        `  IF compare value (${left}) op "<" with (${right}) THEN:`,
        `    set ${result} to (0 - (1))`,
        '  ELSE:',
        `    set ${result} to (0 + (1))`
    );
    return result;
}
