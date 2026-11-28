// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {conversionFailure} from '../overlay/scratch-gui/src/lib/bw-conversion-error.js';

const refusal = () => Object.assign(new Error('Python conversion refused; the source is preserved.'), {
    code: 'PYTHON_CONVERSION_UNSUPPORTED',
    diagnostics: [
        {code: 'python-floor-division', kind: 'unsupported', severity: 'error', message: 'Floor division is not preserved.',
            sourceSpan: {start: {line: 2, column: 1}, end: {line: 2, column: 18}}},
        {code: 'python-break', kind: 'unsupported', severity: 'error', message: 'Loop break is not preserved.',
            sourceSpan: {start: {line: 5, column: 5}, end: {line: 5, column: 10}}}
    ]
});

test('Python refusals preserve each diagnostic code and exact one-based span beside visible locations', () => {
    const original = refusal();
    const result = conversionFailure(original);
    assert.equal(result.message, original.message);
    assert.equal(result.code, original.code);
    assert.deepEqual(result.diagnostics, original.diagnostics);
    assert.deepEqual(result.sourceSpan, original.diagnostics[0].sourceSpan);
    assert.deepEqual(result.issues, [
        'Line 2, column 1: Floor division is not preserved.',
        'Line 5, column 5: Loop break is not preserved.'
    ]);
    original.diagnostics[0].sourceSpan.start.line = 99;
    assert.equal(result.diagnostics[0].sourceSpan.start.line, 2, 'the report owns its copied span');
    assert.doesNotThrow(() => JSON.stringify(result));
});

test('serialized Python diagnostics retain per-statement reports without requiring Error identity', () => {
    const original = refusal();
    const result = conversionFailure(JSON.stringify({...original, message: original.message}));
    assert.equal(result.diagnostics.length, 2);
    assert.deepEqual(result.issues, conversionFailure(original).issues);
});

test('a malformed optional Python location does not hide its refusal or invent a source coordinate', () => {
    const original = refusal();
    original.diagnostics[0].sourceSpan.start.line = 0;
    const result = conversionFailure(original);
    assert.equal(result.diagnostics[0].sourceSpan, null);
    assert.equal(result.issues[0], original.diagnostics[0].message);
    assert.equal(result.issues[1], 'Line 5, column 5: Loop break is not preserved.');
    assert.deepEqual(conversionFailure({code: original.code, diagnostics: [null], message: 'Refused'}),
        {message: 'Refused', issues: ['Refused']});
});
