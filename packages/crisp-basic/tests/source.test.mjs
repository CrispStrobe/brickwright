import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSource, SourceError, SOURCE_LIMITS} from '../src/source.mjs';

const sourceFailure = (source, code, line, options) => {
    assert.throws(() => prepareSource(source, options), error => {
        assert.ok(error instanceof SourceError);
        assert.equal(error.code, code);
        assert.equal(error.line, line);
        assert.equal(error.filename, options?.filename ?? 'main.bas');
        return true;
    });
};

test('structured source keeps case, strings and indentation while adding a source map', () => {
    const source = 'message$ = "Hello, CrispBASIC"\nIF TRUE THEN\n    PRINT message$\nENDIF\n';
    const result = prepareSource(source, {filename: 'greeting.bas'});
    assert.equal(result.source, source);
    assert.equal(result.numberedSource,
        '1 message$ = "Hello, CrispBASIC"\n2 IF TRUE THEN\n3     PRINT message$\n4 ENDIF\n');
    assert.equal(result.filename, 'greeting.bas');
    assert.deepEqual(result.sourceMap, {1: 1, 2: 2, 3: 3, 4: 4});
    assert.deepEqual(result.lines[2], {line: 3, basicLine: 3, text: '    PRINT message$'});
});

test('CRLF and standalone CR normalize to LF without adding a phantom final line', () => {
    const result = prepareSource('PRINT 1\r\nPRINT 2\rPRINT 3\n');
    assert.equal(result.source, 'PRINT 1\nPRINT 2\nPRINT 3\n');
    assert.equal(result.numberedSource, '1 PRINT 1\n2 PRINT 2\n3 PRINT 3\n');
    assert.equal(result.lines.length, 3);
    assert.equal(prepareSource('PRINT 1').numberedSource, '1 PRINT 1\n');
});

test('an initial BOM is removed; a BOM inside a program is rejected', () => {
    assert.equal(prepareSource('\uFEFFPRINT "ok"').source, 'PRINT "ok"');
    sourceFailure('PRINT "ok"\nREM \uFEFF', 'unsupported-character', 2);
});

test('blank unnumbered lines retain editor line identity, including consecutive blanks', () => {
    const result = prepareSource('\n\nPRINT 1\n \n\t\n');
    assert.equal(result.numberedSource, '1 \n2 \n3 PRINT 1\n4  \n5 \t\n');
    assert.deepEqual(result.sourceMap, {1: 1, 2: 2, 3: 3, 4: 4, 5: 5});
    assert.equal(result.lines.length, 5);
    assert.deepEqual(prepareSource('').lines, []);
    assert.equal(prepareSource('').numberedSource, '');
    assert.equal(prepareSource('\n').numberedSource, '1 \n');
});

test('explicit line numbers survive with blank separators mapped back to editor lines', () => {
    const result = prepareSource('\n10PRINT "x"\n\n  20  GOTO 40\n\t\n40 END\n');
    assert.equal(result.numberedSource, '10PRINT "x"\n20  GOTO 40\n40 END\n');
    assert.deepEqual(result.sourceMap, {10: 2, 20: 4, 40: 6});
    assert.deepEqual(result.lines, [
        {line: 2, basicLine: 10, text: 'PRINT "x"'},
        {line: 4, basicLine: 20, text: '  GOTO 40'},
        {line: 6, basicLine: 40, text: ' END'}
    ]);
});

test('mixed numbering is rejected in either order and reports the physical editor line', () => {
    sourceFailure('10 PRINT 1\n\nPRINT 2', 'mixed-line-numbering', 3, {filename: 'mixed.bas'});
    sourceFailure('PRINT 1\n\n20 PRINT 2', 'mixed-line-numbering', 3);
});

test('duplicate, descending, zero and out-of-range numbers cannot corrupt source maps', () => {
    sourceFailure('10 PRINT 1\n10 PRINT 2', 'line-number-order', 2);
    sourceFailure('20 PRINT 1\n10 PRINT 2', 'line-number-order', 2);
    sourceFailure('0 PRINT 1', 'line-number-range', 1);
    sourceFailure('65280 PRINT 1', 'line-number-range', 1);
    sourceFailure('99999999999999999999999 PRINT 1', 'line-number-range', 1);
    assert.deepEqual(prepareSource('1 PRINT 1\n65279 END').sourceMap, {1: 1, 65279: 2});
});

test('numeric prefixes have explicit semantics instead of guessed expression rewrites', () => {
    assert.equal(prepareSource('0010PRINT 42').numberedSource, '10PRINT 42\n');
    assert.equal(prepareSource('10').numberedSource, '10\n');
    assert.equal(prepareSource('10 END').lines[0].basicLine, 10);
    sourceFailure('1.5 PRINT 1', 'invalid-line-number', 1);
    sourceFailure('1e3 PRINT 1', 'invalid-line-number', 1);
    sourceFailure('-10 PRINT 1', 'invalid-line-number', 1);
    sourceFailure('+10 PRINT 1', 'invalid-line-number', 1);
    sourceFailure('PRINT 1\n123', 'mixed-line-numbering', 2);
});

test('Latin-1 literals round-trip as single bytes and Unicode is never silently truncated', () => {
    const result = prepareSource('PRINT "Grüße £éÿ"');
    assert.equal(Buffer.from(result.numberedSource, 'latin1').toString('latin1'), result.numberedSource);
    sourceFailure('PRINT "hello"\nPRINT "€"', 'unsupported-character', 2);
    sourceFailure('REM 🧱', 'unsupported-character', 1);
    sourceFailure('REM \ud800', 'unsupported-character', 1);
});

test('source control bytes cannot enter the loader while ordinary tabs remain intact', () => {
    for (const byte of [0, 1, 8, 11, 12, 14, 27, 31, 127, 128, 159]) {
        sourceFailure(`PRINT "a${String.fromCharCode(byte)}b"`, 'source-control-byte', 1);
    }
    assert.equal(prepareSource('\tPRINT "ok"').numberedSource, '1 \tPRINT "ok"\n');
});

test('raw byte limit includes generated line number but does not approximate token compression', () => {
    const body = `REM ${'a'.repeat(SOURCE_LIMITS.maxLineBytes - 6)}`;
    assert.equal(prepareSource(body).numberedSource.length, SOURCE_LIMITS.maxLineBytes + 1);
    sourceFailure(`${body}a`, 'source-line-too-long', 1);
    const longKeywords = 'PRINT 1:'.repeat(100);
    assert.ok(longKeywords.length > 251);
    assert.equal(prepareSource(longKeywords).lines[0].text, longKeywords);
    const numbered = `65279 REM ${'a'.repeat(SOURCE_LIMITS.maxLineBytes - 10)}`;
    assert.equal(prepareSource(numbered).numberedSource.length, SOURCE_LIMITS.maxLineBytes + 1);
    sourceFailure(`${numbered}a`, 'source-line-too-long', 1);
});

test('line numbering limit counts blank physical lines and ignores the terminating newline', () => {
    const atLimit = '\n'.repeat(SOURCE_LIMITS.maxBasicLine);
    const result = prepareSource(atLimit);
    assert.equal(result.lines.length, SOURCE_LIMITS.maxBasicLine);
    assert.equal(result.sourceMap[65279], 65279);
    sourceFailure(`${atLimit}\n`, 'too-many-lines', SOURCE_LIMITS.maxBasicLine + 1);
});

test('source diagnostics carry stable code, filename, line and column', () => {
    assert.throws(() => prepareSource('PRINT "ok"\nREM €', {filename: 'lesson.bas'}), error => {
        assert.equal(error.name, 'SourceError');
        assert.equal(error.code, 'unsupported-character');
        assert.equal(error.filename, 'lesson.bas');
        assert.equal(error.line, 2);
        assert.equal(error.column, 5);
        assert.match(error.message, /^lesson\.bas:2:5:/);
        return true;
    });
    sourceFailure(null, 'invalid-source-type', null);
    assert.throws(() => prepareSource('PRINT 1', {filename: ''}), {code: 'invalid-filename'});
});
