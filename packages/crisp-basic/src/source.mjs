/**
 * Prepare source for the CrispBASIC native loader without changing its dialect.
 * The loader receives Latin-1 bytes. Source positions refer to physical editor
 * lines, independently of the optional line numbers used by the interpreter.
 */

export const SOURCE_LIMITS = Object.freeze({
    encoding: 'latin1',
    minBasicLine: 1,
    maxBasicLine: 65279,
    maxLineBytes: 4096
});

/** A source-input problem, before the interpreter attempts to run the program. */
export class SourceError extends Error {
    constructor(message, {code = 'invalid-source', filename = 'main.bas', line = null, column = null} = {}) {
        const where = `${filename}${line === null ? '' : `:${line}`}${column === null ? '' : `:${column}`}`;
        super(`${where}: ${message}`);
        this.name = 'SourceError';
        this.code = code;
        this.filename = filename;
        this.line = line;
        this.column = column;
    }
}

/**
 * @param {string} source BBC BASIC source, either wholly numbered or unnumbered.
 * @param {{filename?: string}} [options]
 * @returns {{source: string, numberedSource: string,
 *   lines: {line: number, basicLine: number, text: string}[],
 *   sourceMap: Object<number, number>, filename: string}}
 *
 * CRLF and CR become LF and one initial Unicode BOM is removed. All other
 * source characters, including keyword case and indentation, are preserved.
 * A final newline terminates the last physical line; it is not another line.
 *
 * Unnumbered source receives sequential numbers, including blank lines.
 * Numbered source must use strictly increasing numbers in 1..65279. Its blank
 * separator lines are omitted from the interpreter input but still count in
 * editor positions. A leading decimal integer, with or without whitespace
 * before its statement, selects numbered syntax; we never guess that such a
 * prefix is an unnumbered expression and silently renumber it.
 *
 * `text` is the unchanged body after any explicit number, including whitespace
 * following that number. For unnumbered input it is the entire physical line.
 * `numberedSource` always ends in LF when it contains at least one line.
 *
 * The 4096-byte limit applies to each PREPARED line, including its decimal
 * number and separator. The interpreter separately enforces its 255-byte
 * tokenized record limit. Raw source length is not a token-length estimate:
 * long keywords may compress into single-byte tokens.
 */
export function prepareSource(source, {filename = 'main.bas'} = {}) {
    if (typeof filename !== 'string' || filename.length === 0 || /[\0\r\n]/.test(filename)) {
        throw new SourceError('filename must be a nonempty single-line string', {
            code: 'invalid-filename', filename: '<source>'
        });
    }
    const fail = (message, code, line = null, column = null) => {
        throw new SourceError(message, {code, filename, line, column});
    };
    if (typeof source !== 'string') fail('source must be a string', 'invalid-source-type');

    const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const physical = normalized === '' ? [] : normalized.split('\n');
    if (normalized.endsWith('\n')) physical.pop();

    // Validate before Buffer.from(..., 'latin1') can truncate Unicode or before
    // raw control bytes can be interpreted as part of the loader's protocol.
    for (let index = 0; index < physical.length; index++) {
        const text = physical[index];
        for (let column = 0; column < text.length; column++) {
            const code = text.codePointAt(column);
            if (code > 255) {
                fail(`source must use Latin-1 characters; U+${code.toString(16).toUpperCase().padStart(4, '0')} is not supported`,
                    'unsupported-character', index + 1, column + 1);
            }
            if ((code < 32 && code !== 9) || (code >= 127 && code <= 159)) {
                fail(`raw control byte 0x${code.toString(16).padStart(2, '0')} is not allowed in source`,
                    'source-control-byte', index + 1, column + 1);
            }
        }
    }

    const classified = physical.map((text, index) => {
        const line = index + 1;
        if (/^[ \t]*$/.test(text)) return {line, text, blank: true};
        if (/^[ \t]*[+-]\d/.test(text)) {
            fail('line numbers must be unsigned decimal integers', 'invalid-line-number', line);
        }
        const match = /^[ \t]*(\d+)(.*)$/.exec(text);
        if (!match) return {line, text, blank: false, numbered: false};
        if (/^\.|^[eE][+-]?\d/.test(match[2])) {
            fail('line numbers must be whole decimal integers', 'invalid-line-number', line);
        }
        const basicLine = Number(match[1]);
        if (!Number.isSafeInteger(basicLine) || basicLine < SOURCE_LIMITS.minBasicLine ||
                basicLine > SOURCE_LIMITS.maxBasicLine) {
            fail(`line number must be in ${SOURCE_LIMITS.minBasicLine}..${SOURCE_LIMITS.maxBasicLine}`,
                'line-number-range', line);
        }
        return {line, text: match[2], blank: false, numbered: true, basicLine};
    });

    const firstStatement = classified.find(record => !record.blank);
    const numbered = firstStatement?.numbered === true;
    for (const record of classified) {
        if (!record.blank && record.numbered !== numbered) {
            fail('numbered and unnumbered source lines cannot be mixed', 'mixed-line-numbering', record.line);
        }
    }
    if (!numbered && physical.length > SOURCE_LIMITS.maxBasicLine) {
        fail(`unnumbered source may contain at most ${SOURCE_LIMITS.maxBasicLine} physical lines`,
            'too-many-lines', SOURCE_LIMITS.maxBasicLine + 1);
    }

    const lines = [];
    const sourceMap = {};
    const prepared = [];
    let previousNumber = 0;
    for (const record of classified) {
        if (numbered && record.blank) continue;
        const basicLine = numbered ? record.basicLine : record.line;
        if (basicLine <= previousNumber) {
            fail('explicit line numbers must be unique and strictly increasing', 'line-number-order', record.line);
        }
        previousNumber = basicLine;
        const output = numbered ? `${basicLine}${record.text}` : `${basicLine} ${record.text}`;
        if (output.length > SOURCE_LIMITS.maxLineBytes) {
            fail(`prepared source line exceeds ${SOURCE_LIMITS.maxLineBytes} Latin-1 bytes including its number`,
                'source-line-too-long', record.line);
        }
        lines.push({line: record.line, basicLine, text: record.text});
        sourceMap[basicLine] = record.line;
        prepared.push(output);
    }

    return {
        source: normalized,
        numberedSource: prepared.length ? `${prepared.join('\n')}\n` : '',
        lines,
        sourceMap,
        filename
    };
}
