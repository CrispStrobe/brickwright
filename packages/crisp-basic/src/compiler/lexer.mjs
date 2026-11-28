// SPDX-License-Identifier: BSD-3-Clause AND Zlib
// CrispBASIC compiler: tokenization.
//
// The interpreter tokenizes each line with BBCSDL's lexan()/tokit() before
// execution, and that tokenization defines what a line *means* (for example
// "TOTAL" becomes the keyword TO followed by "TAL"). This module reimplements
// those two routines' rules in JavaScript so the compiler sees exactly the
// interpreter's token stream. The keyword table order, the delimiter flags and
// the mode bits follow bbmain.c of BBCSDL (Copyright (c) R. T. Russell,
// zlib licence; see native/BBCSDL-LICENSE.txt), pinned in upstream.lock.json.
// This is a modified, translated adaptation, not the original source.

// [spelling, needsDelimiter]. Order matters: the first matching entry wins.
const KEYWORDS = [
    ['AND'], ['ABS'], ['ACS'], ['ADVAL'], ['ASC'], ['ASN'], ['ATN'], ['BGET', 1], ['BPUT', 1], ['BY', 1],
    ['COLOUR'], ['COLOR', 0, 'COLOUR'], ['CALL'], ['CASE'], ['CHAIN'], ['CHR$'], ['CLEAR', 1], ['CLOSE', 1],
    ['CLG', 1], ['CLS', 1], ['COS'], ['COUNT', 1], ['CIRCLE'], ['DATA'], ['DEG'], ['DEF'], ['DIV'], ['DIM'],
    ['DRAW'], ['ENDPROC', 1], ['ENDWHILE', 1], ['ENDCASE', 1], ['ENDIF', 1], ['END', 1], ['ENVELOPE'],
    ['ELSE'], ['EVAL'], ['ERL', 1], ['ERROR'], ['EOF', 1], ['EOR'], ['ERR', 1], ['EXIT', 1], ['EXP'],
    ['EXT', 1], ['ELLIPSE'], ['FOR'], ['FALSE', 1], ['FILL'], ['FN'], ['GOTO'], ['GET$'], ['GET'], ['GOSUB'],
    ['GCOL'], ['HIMEM', 1], ['INPUT'], ['IF'], ['INKEY$'], ['INKEY'], ['INT'], ['INSTR('], ['INSTALL'],
    ['LINE'], ['LOMEM', 1], ['LOCAL'], ['LEFT$('], ['LEN'], ['LET'], ['LOG'], ['LN'], ['MID$('], ['MODE'],
    ['MOD'], ['MOVE'], ['MOUSE'], ['NEXT'], ['NOT'], ['ON'], ['OFF', 1], ['OF', 1], ['ORIGIN'], ['OR'],
    ['OPENIN'], ['OPENOUT'], ['OPENUP'], ['OSCLI'], ['OTHERWISE'], ['PRINT'], ['PAGE', 1], ['PRIVATE'],
    ['PTR', 1], ['PI', 1], ['PLOT'], ['POINT('], ['PROC'], ['POS', 1], ['QUIT', 1], ['RETURN', 1], ['REPEAT'],
    ['REPORT', 1], ['READ'], ['REM'], ['RUN', 1], ['RAD'], ['RESTORE'], ['RIGHT$('], ['RND', 1],
    ['RECTANGLE'], ['STEP'], ['SGN'], ['SIN'], ['SQR'], ['SPC'], ['STR$'], ['STRING$('], ['SOUND'],
    ['STOP', 1], ['SUM'], ['SWAP'], ['SYS'], ['TAN'], ['TAB('], ['THEN'], ['TIME', 1], ['TINT'], ['TO'],
    ['TRACE'], ['TRUE', 1], ['UNTIL'], ['USR'], ['VDU'], ['VAL'], ['VPOS', 1], ['WHILE'], ['WHEN'],
    ['WAIT', 1], ['WIDTH']
].map(([spelling, delimited = 0, name = spelling]) => ({spelling, delimited: Boolean(delimited), name}));

// Pseudo-variables that have separate "left" (assignment) tokens.
const LEFT_FORMS = new Set(['PTR', 'PAGE', 'TIME', 'LOMEM', 'HIMEM']);
// Tokens after which an encoded line number may follow.
const LINE_NUMBER_AFTER = new Set(['GOTO', 'GOSUB', 'RESTORE', 'TRACE', 'THEN', 'ELSE']);
// Tokens that switch the tokenizer back to "left" (statement-start) mode.
const LEFT_MODE_AFTER = new Set(['THEN', 'ELSE', 'REPEAT', 'ERROR', 'CLOSE', 'MOUSE', 'MOVE', 'SYS']);

const BIT0 = 1, BIT3 = 8, BIT4 = 16, BIT5 = 32, BIT6 = 64, BIT7 = 128;

export const range1 = c => (c >= '_' && c <= 'z') || (c >= '@' && c <= 'Z') || (c >= '0' && c <= '9');
export const range2 = c => (c >= '_' && c <= 'z') || (c >= '@' && c <= 'Z');

/** Match a keyword at text[index] using tokit's rules (uppercase only). */
function tokit(text, index) {
    const first = text[index];
    for (const keyword of KEYWORDS) {
        const spelling = keyword.spelling;
        if (first < spelling[0]) break;
        if (first !== spelling[0]) continue;
        let k = 1, i = index + 1;
        while (k < spelling.length && text[i] === spelling[k]) { k++; i++; }
        const next = text[i] ?? '\r';
        if (next === '.' && k < spelling.length + 1) {
            // An abbreviation such as P. — the dot is consumed.
            return {keyword, end: i + 1, abbreviated: true};
        }
        if (k === spelling.length && (!keyword.delimited || !range1(next))) {
            return {keyword, end: i, abbreviated: false};
        }
    }
    return null;
}

/**
 * Tokenize one prepared line body (without its line number).
 * @returns {Array<{t:'kw', k:string, left?:boolean, abbreviated?:boolean, col:number}|
 *   {t:'ch', c:string, col:number}|{t:'lino', value:number, col:number}>}
 */
export function tokenizeLine(text) {
    const cells = [];
    let mode = BIT0; // left mode at the start of a line
    let i = 0;
    while (i < text.length) {
        const al = text[i];
        if (!range1(al)) mode &= ~(BIT3 | BIT5);
        if (al !== ' ' && al !== ',') {
            if (al >= 'g' || al === '@' || al === '_' || al === '`' || al >= 'G') mode &= ~BIT3;
            if (al === '"') mode ^= BIT7;
            if (mode & BIT4) {
                mode &= ~BIT4;
                const match = al === '+' ? null : /^ *(\d+)/.exec(text.slice(i));
                if (match && Number(match[1]) !== 0) {
                    mode |= BIT4;
                    cells.push({t: 'lino', value: Number(match[1]) & 0xffff, col: i});
                    i += match[0].length;
                }
                continue;
            }
            if (mode <= 1) {
                let cell = null;
                const left = mode === 1;
                if (left) {
                    mode = 0;
                    if (al === '*') mode |= BIT6;
                }
                if (!(left && al === '*') && al >= 'A' && al <= 'z') {
                    const match = tokit(text, i);
                    if (match) {
                        cell = {t: 'kw', k: match.keyword.name, col: i,
                            ...(match.abbreviated ? {abbreviated: true} : {}),
                            ...(left && LEFT_FORMS.has(match.keyword.name) ? {left: true} : {})};
                        i = match.end;
                    }
                }
                if (cell) {
                    const k = cell.k;
                    if (left && k === 'DATA') mode |= BIT6;
                    if (k === 'REM') mode |= BIT6;
                    if (k === 'FN' || k === 'PROC') mode |= BIT5;
                    if (LINE_NUMBER_AFTER.has(k)) mode |= BIT4;
                    if (LEFT_MODE_AFTER.has(k)) mode |= BIT0;
                    cells.push(cell);
                    continue;
                }
                if (range2(al)) mode |= BIT5;
                if (al === '&') mode |= BIT3;
                if (al === ':') mode |= BIT0;
            }
        }
        cells.push({t: 'ch', c: al, col: i});
        i++;
    }
    return cells;
}

export const KEYWORD_NAMES = Object.freeze(KEYWORDS.map(entry => entry.name));
