// SPDX-License-Identifier: BSD-3-Clause
// Original BASIC-to-C compiler. This frontend does not use the BBCSDL parser,
// evaluator or tokenizer, or any third-party BASIC compiler implementation.
import {prepareSource, SourceError} from '../source.mjs';
import {compilerPlatform} from './platform.mjs';
import runtime from './runtime.mjs';

export class CompileError extends SourceError {
    constructor(message, token, filename, code = 'unsupported-syntax') {
        super(message, {filename, line: token?.line ?? 1, column: token?.column ?? 1, code});
        this.name = 'CompileError';
        this.basicLine = token?.basicLine ?? this.line;
        this.diagnostics = [
            {
                severity: 'error',
                code,
                message,
                filename,
                line: this.line,
                column: this.column,
                basicLine: this.basicLine
            }
        ];
    }
}

const functions = new Set([
    'ABS',
    'ACS',
    'ASN',
    'ATN',
    'COS',
    'DEG',
    'EXP',
    'INT',
    'LN',
    'LOG',
    'RAD',
    'RND',
    'SGN',
    'SIN',
    'SQR',
    'TAN',
    'LEN',
    'ASC',
    'CHR$',
    'LEFT$',
    'RIGHT$',
    'MID$',
    'STRING$',
    'INSTR',
    'STR$',
    'VAL'
]);
const forbidden = new Map([
    ['EVAL', 'EVAL requires run-time parsing'],
    ['SYS', 'OS calls are not portable'],
    ['OSCLI', 'OS calls are not portable'],
    ['CALL', 'native calls are not portable'],
    ['USR', 'native calls are not portable'],
    ['DIMDIM', 'dynamic variables are unsupported'],
    ['HIMEM', 'direct interpreter memory access is unsupported'],
    ['LOMEM', 'direct interpreter memory access is unsupported'],
    ['PAGE', 'direct interpreter memory access is unsupported'],
    ['TOP', 'direct interpreter memory access is unsupported'],
    ['LIBRARY', 'dynamic library loading is unsupported'],
    ['INSTALL', 'dynamic library loading is unsupported'],
    ['CHAIN', 'dynamic program loading is unsupported'],
    ['RUN', 'dynamic program loading is unsupported']
]);
// Reserved words must remain tokens even when their feature is outside the
// compiled subset. Otherwise e.g. CLS=1 silently becomes a variable assignment.
// Vocabulary and delimiter behavior follow the pinned BBCSDL language surface;
// recognition below is independent of its tokenizer and token representation.
const unsupportedKeywords = [
    'ADVAL', 'BGET', 'BPUT', 'BY', 'COLOUR', 'COLOR', 'CLEAR', 'CLOSE', 'CLG',
    'CLS', 'COUNT', 'CIRCLE', 'DRAW', 'ENVELOPE', 'ERL', 'EOF', 'ERR', 'EXT',
    'ELLIPSE', 'FILL', 'GCOL', 'MODE', 'MOVE', 'MOUSE', 'OFF', 'ORIGIN',
    'OPENIN', 'OPENOUT', 'OPENUP', 'PRIVATE', 'PTR', 'PLOT', 'POINT', 'POS',
    'REPORT', 'RECTANGLE', 'SPC', 'SOUND', 'SUM', 'SWAP', 'TAB', 'TINT',
    'TRACE', 'VPOS', 'WAIT', 'WIDTH'
];
const delimitedKeywords = new Set([
    'BGET', 'BPUT', 'BY', 'CLEAR', 'CLOSE', 'CLG', 'CLS', 'COUNT', 'ENDPROC',
    'ENDWHILE', 'ENDCASE', 'ENDIF', 'END', 'ERL', 'EOF', 'ERR', 'EXIT', 'EXT',
    'FALSE', 'HIMEM', 'LOMEM', 'OFF', 'OF', 'PAGE', 'PTR', 'PI', 'POS',
    'QUIT', 'RETURN', 'REPORT', 'RUN', 'RND', 'STOP', 'TIME', 'TRUE', 'VPOS', 'WAIT'
]);
const parenthesizedKeywords = new Set(['INSTR', 'LEFT$', 'MID$', 'POINT', 'RIGHT$', 'STRING$', 'TAB']);
const keywords = [
    ...new Set([
        ...functions,
        ...forbidden.keys(),
        ...unsupportedKeywords,
        'PRINT',
        'INPUT',
        'LINE',
        'DIM',
        'LOCAL',
        'DEF',
        'ENDPROC',
        'PROC',
        'FN',
        'FOR',
        'TO',
        'STEP',
        'NEXT',
        'WHILE',
        'ENDWHILE',
        'REPEAT',
        'UNTIL',
        'IF',
        'THEN',
        'ELSE',
        'ENDIF',
        'CASE',
        'OF',
        'WHEN',
        'OTHERWISE',
        'ENDCASE',
        'END',
        'STOP',
        'QUIT',
        'LET',
        'REM',
        'TIME',
        'TRUE',
        'FALSE',
        'PI',
        'AND',
        'OR',
        'EOR',
        'NOT',
        'DIV',
        'MOD',
        'EXIT',
        'ERROR',
        'DATA',
        'READ',
        'RESTORE',
        'GOTO',
        'GOSUB',
        'RETURN',
        'ON',
        'VDU',
        'RND',
        'GET',
        'GET$',
        'INKEY',
        'INKEY$'
    ])
].sort((a, b) => b.length - a.length);

function tokenize(prepared) {
    const result = [];
    for (const record of prepared.lines) {
        const {text, line, basicLine} = record;
        let i = 0;
        const add = (kind, value, column) => result.push({kind, value, line, basicLine, column: column + 1});
        while (i < text.length) {
            if (/\s/.test(text[i])) {
                i++;
                continue;
            }
            const start = i,
                ch = text[i];
            if (ch === '"') {
                let value = '';
                i++;
                for (;;) {
                    if (i === text.length)
                        throw new CompileError(
                            'unterminated string',
                            {line, basicLine, column: start + 1},
                            prepared.filename,
                            'syntax'
                        );
                    if (text[i] === '"') {
                        if (text[i + 1] === '"') {
                            value += '"';
                            i += 2;
                            continue;
                        }
                        i++;
                        break;
                    }
                    value += text[i++];
                }
                add('string', value, start);
                continue;
            }
            const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/.exec(text.slice(i));
            if (number) {
                i += number[0].length;
                add('number', number[0], start);
                continue;
            }
            if (ch === '&' || (ch === '%' && /[01]/.test(text[i + 1] ?? ''))) {
                const m = (ch === '&' ? /^&[\da-fA-F]+/ : /^%[01]+/).exec(text.slice(i));
                if (!m)
                    throw new CompileError(
                        'invalid numeric literal',
                        {line, basicLine, column: start + 1},
                        prepared.filename,
                        'syntax'
                    );
                const value = BigInt((ch === '&' ? '0x' : '0b') + m[0].slice(1));
                if (value > 0xffffffffffffffffn)
                    throw new CompileError(
                        'numeric literal exceeds 64 bits',
                        {line, basicLine, column: start + 1},
                        prepared.filename,
                        'numeric-range'
                    );
                add('number', BigInt.asIntN(value <= 0xffffffffn ? 32 : 64, value).toString(), start);
                i += m[0].length;
                continue;
            }
            if (/[A-Za-z_]/.test(ch)) {
                const fn = /^(PROC|FN)([A-Za-z_][A-Za-z_0-9]*(?:\$|%%|%|#)?)/.exec(text.slice(i));
                if (fn) {
                    add('name', fn[0], start);
                    i += fn[0].length;
                    continue;
                }
                const kw = keywords.find((word) => {
                    if (!text.startsWith(word, i)) return false;
                    const next = text[i + word.length] ?? '';
                    if (parenthesizedKeywords.has(word)) return next === '(';
                    return !delimitedKeywords.has(word) || !/[A-Za-z_0-9@`]/.test(next);
                });
                if (kw) {
                    if (kw === 'REM') {
                        i = text.length;
                        break;
                    }
                    add('keyword', kw, start);
                    i += kw.length;
                    continue;
                }
                const name = /^[A-Za-z_][A-Za-z_0-9]*(?:\$|%%|%|#)?/.exec(text.slice(i))[0];
                add('name', name, start);
                i += name.length;
                continue;
            }
            const op = /^(?:>>>|>>|<<|<=|>=|<>|\+=|-=|\*=|\/=|[+\-*/^=<>(),:;~'!?\[\]$|@])/.exec(
                text.slice(i)
            );
            if (!op)
                throw new CompileError(
                    `unsupported source character ${JSON.stringify(ch)}`,
                    {line, basicLine, column: start + 1},
                    prepared.filename
                );
            add('operator', op[0], start);
            i += op[0].length;
        }
        add('eol', '\n', text.length);
    }
    result.push({
        kind: 'eof',
        value: '<eof>',
        line: prepared.lines.at(-1)?.line ?? 1,
        basicLine: prepared.lines.at(-1)?.basicLine ?? 1,
        column: 1
    });
    return result;
}

const precedence = new Map([
    ['OR', 1],
    ['EOR', 1],
    ['AND', 2],
    ['=', 3],
    ['<>', 3],
    ['<', 3],
    ['>', 3],
    ['<=', 3],
    ['>=', 3],
    ['<<', 4],
    ['>>', 4],
    ['>>>', 4],
    ['+', 5],
    ['-', 5],
    ['*', 6],
    ['/', 6],
    ['DIV', 6],
    ['MOD', 6],
    ['^', 8]
]);

class Parser {
    constructor(prepared) {
        this.tokens = tokenize(prepared);
        this.i = 0;
        this.filename = prepared.filename;
        this.definitions = [];
        this.context = null;
        this.statementLevel = 0;
    }
    get token() {
        return this.tokens[this.i];
    }
    is(value) {
        return !['string', 'number', 'name'].includes(this.token.kind) && this.token.value === value;
    }
    take(value) {
        if (this.is(value)) return this.tokens[this.i++];
        return null;
    }
    error(message, token = this.token, code = 'unsupported-syntax') {
        throw new CompileError(message, token, this.filename, code);
    }
    expect(value) {
        const t = this.take(value);
        if (!t) this.error(`expected ${value}, found ${this.token.value}`, this.token, 'syntax');
        return t;
    }
    endStatement() {
        return this.token.kind === 'eof' || this.token.kind === 'eol' || this.is(':') || this.is('ELSE');
    }
    separators() {
        while (this.take(':') || this.take('\n')) {}
    }
    list(end, parse) {
        const out = [];
        if (!this.is(end)) {
            do {
                out.push(parse());
            } while (this.take(','));
        }
        this.expect(end);
        return out;
    }
    expression(min = 0) {
        let t = this.token,
            left;
        if (t.kind === 'keyword' && forbidden.has(t.value))
            this.error(forbidden.get(t.value), t, 'forbidden-feature');
        if (t.kind === 'operator' && ['!', '?', '$', '|', '[', ']', '@'].includes(t.value))
            this.error(
                'indirection, assembler and dynamic variables are not supported by the compiler',
                t,
                'forbidden-feature'
            );
        if (this.take('+') || this.take('-') || this.take('NOT'))
            left = {kind: 'unary', op: t.value, value: this.expression(9), t};
        else if (this.take('(')) {
            left = this.expression();
            this.expect(')');
        } else if (t.kind === 'number' || t.kind === 'string') {
            this.i++;
            left = {kind: t.kind, value: t.value, t};
        } else if (t.kind === 'keyword' && ['TRUE', 'FALSE', 'PI', 'TIME'].includes(t.value)) {
            this.i++;
            left = {kind: 'constant', value: t.value, t};
        } else if (t.kind === 'keyword' && functions.has(t.value)) {
            this.i++;
            let args = [];
            let hex = false;
            if (t.value === 'STR$') hex = !!this.take('~');
            if (this.take('(')) args = this.list(')', () => this.expression());
            else if (t.value !== 'RND') args = [this.expression(9)];
            left = {kind: 'builtin', name: t.value, args, hex, t};
        } else if (t.kind === 'name') {
            this.i++;
            if (t.value.startsWith('PROC')) this.error('a PROC call is not an expression', t, 'syntax');
            const hasArgs = !!this.take('('),
                args = hasArgs ? this.list(')', () => this.expression()) : [];
            if (t.value.startsWith('FN')) left = {kind: 'call', name: t.value, args, t};
            else left = {kind: 'variable', name: t.value, indices: hasArgs ? args : null, t};
        } else this.error(`unsupported expression ${t.value}`, t);
        while (
            ['keyword', 'operator'].includes(this.token.kind) &&
            precedence.has(this.token.value) &&
            precedence.get(this.token.value) >= min
        ) {
            t = this.tokens[this.i++];
            const p = precedence.get(t.value);
            left = {kind: 'binary', op: t.value, left, right: this.expression(p + 1), t};
        }
        return left;
    }
    variable(allowTime = false, localArray = false) {
        const t = this.token;
        if (allowTime && this.take('TIME')) return {kind: 'time', t};
        if (t.kind !== 'name' || /^(PROC|FN)/.test(t.value)) this.error('expected a static variable name', t);
        this.i++;
        let indices = null;
        if (this.take('(')) indices = this.list(')', () => this.expression());
        if (indices?.length === 0 && !localArray)
            this.error('whole-array and dynamic-variable operations are unsupported', t, 'forbidden-feature');
        return {kind: 'variable', name: t.value, indices, t};
    }
    sequence(stops = []) {
        const out = [];
        this.separators();
        while (this.token.kind !== 'eof' && !stops.includes(this.token.value) && !this.pendingNext?.length) {
            const statement = this.statement();
            out.push(statement);
            if (statement.kind !== 'noop' && !this.endStatement() && !stops.includes(this.token.value))
                this.error(`unexpected ${this.token.value} after statement`, this.token, 'syntax');
            if (this.pendingNext?.length) break;
            this.separators();
        }
        return out;
    }
    inline(stops = ['ELSE']) {
        const out = [];
        while (this.token.kind !== 'eol' && this.token.kind !== 'eof' && !stops.includes(this.token.value)) {
            out.push(this.statement());
            if (!this.take(':')) break;
        }
        return out;
    }
    definition(t) {
        if (this.context) this.error('nested definitions are unsupported', t);
        const name = this.token;
        if (name.kind !== 'name' || !/^(PROC|FN)/.test(name.value))
            this.error('DEF requires a PROC or FN name', name, 'syntax');
        this.i++;
        const params = this.take('(') ? this.list(')', () => this.variable()) : [];
        if (params.some((x) => x.indices))
            this.error('array parameters require an explicit reference ABI and are not supported', name);
        if (new Set(params.map((p) => p.name)).size !== params.length)
            this.error('duplicate parameter', name, 'syntax');
        const def = {kind: 'definition', name: name.value, params, body: [], t};
        this.context = def;
        if (this.take('=')) {
            if (name.value.startsWith('PROC')) this.error('a PROC cannot return a value', name, 'type');
            def.body = [{kind: 'return', value: this.expression(), t}];
        } else {
            if (!this.endStatement())
                this.error('expected newline or colon after definition', this.token, 'syntax');
            this.separators();
            def.body = this.sequence(name.value.startsWith('PROC') ? ['ENDPROC'] : ['DEF']);
            if (name.value.startsWith('PROC')) this.expect('ENDPROC');
        }
        this.context = null;
        if (this.definitions.some((d) => d.name === def.name))
            this.error(`duplicate definition ${def.name}`, t, 'syntax');
        this.definitions.push(def);
        return {kind: 'noop', t};
    }
    statement() {
        this.statementLevel++;
        try {
            return this.parseStatement();
        } finally {
            this.statementLevel--;
        }
    }
    parseStatement() {
        const t = this.token;
        if (forbidden.has(t.value)) this.error(forbidden.get(t.value), t, 'forbidden-feature');
        if (['[', ']', '!', '?', '$', '|', '*', '@'].includes(t.value))
            this.error(
                'assembler, indirection, dynamic variables and OS commands are forbidden',
                t,
                'forbidden-feature'
            );
        if (this.take('DEF')) {
            if (!this.context && !this.mainTerminated)
                this.error(
                    'DEF may only follow an unconditional top-level END or QUIT; execution into a definition is unsupported',
                    t,
                    'definition-fallthrough'
                );
            return this.definition(t);
        }
        if (this.take('PRINT')) {
            const items = [];
            while (!this.endStatement()) {
                if (this.take(';')) items.push({kind: 'semicolon'});
                else if (this.take(',')) items.push({kind: 'comma'});
                else if (this.take("'")) items.push({kind: 'newline'});
                else {
                    const hex = !!this.take('~');
                    items.push({kind: 'value', value: this.expression(), hex});
                }
            }
            return {kind: 'print', items, t};
        }
        if (this.take('INPUT')) {
            const lineMode = !!this.take('LINE');
            let prompt = null,
                question = true;
            if (this.token.kind === 'string') {
                prompt = this.expression(99);
                question = false;
                if (this.take(',')) question = true;
                else this.take(';');
            }
            const variables = [];
            do {
                variables.push(this.variable());
            } while (this.take(','));
            if (lineMode && variables.some((v) => !v.name.endsWith('$')))
                this.error('INPUT LINE requires string variables', t, 'type');
            return {kind: 'input', variables, prompt, question, lineMode, t};
        }
        if (this.take('DIM')) {
            const variables = [];
            do {
                const v = this.variable();
                if (!v.indices)
                    this.error(
                        'DIM raw memory and dynamic variables are forbidden',
                        v.t,
                        'forbidden-feature'
                    );
                variables.push(v);
            } while (this.take(','));
            return {kind: 'dim', variables, t};
        }
        if (this.take('LOCAL')) {
            if (!this.context) this.error('LOCAL is only valid inside PROC or FN', t, 'syntax');
            const variables = [];
            do {
                variables.push(this.variable(false, true));
            } while (this.take(','));
            if (variables.some((v) => v.indices?.length))
                this.error('LOCAL array declarations must use empty ()', t, 'syntax');
            return {kind: 'local', variables, t};
        }
        if (this.take('IF')) {
            const condition = this.expression();
            this.expect('THEN');
            let yes,
                no = [];
            if (this.token.kind === 'eol') {
                yes = this.sequence(['ELSE', 'ENDIF']);
                if (this.take('ELSE')) no = this.sequence(['ENDIF']);
                this.expect('ENDIF');
            } else {
                yes = this.inline();
                if (this.take('ELSE')) no = this.inline([]);
            }
            return {kind: 'if', condition, yes, no, t};
        }
        if (this.take('FOR')) {
            const variable = this.variable();
            if (variable.indices || variable.name.endsWith('$'))
                this.error('FOR requires a numeric scalar', t, 'type');
            this.expect('=');
            const start = this.expression();
            this.expect('TO');
            const end = this.expression();
            const step = this.take('STEP') ? this.expression() : {kind: 'number', value: '1', t};
            const body = this.sequence(['NEXT']);
            let next;
            if (this.pendingNext?.length) next = this.pendingNext.shift();
            else {
                this.expect('NEXT');
                if (this.token.kind === 'name') {
                    const names = [];
                    do {
                        names.push(this.variable());
                    } while (this.take(','));
                    next = names.shift();
                    this.pendingNext = names;
                }
            }
            if (next && (next.name !== variable.name || next.indices))
                this.error(`NEXT must match ${variable.name}`, next.t, 'syntax');
            return {kind: 'for', variable, start, end, step, body, t};
        }
        if (this.take('WHILE')) {
            const condition = this.expression(),
                body = this.sequence(['ENDWHILE']);
            this.expect('ENDWHILE');
            return {kind: 'while', condition, body, t};
        }
        if (this.take('REPEAT')) {
            const body = this.sequence(['UNTIL']);
            this.expect('UNTIL');
            return {kind: 'repeat', condition: this.expression(), body, t};
        }
        if (this.take('CASE')) {
            const value = this.expression();
            this.expect('OF');
            this.separators();
            const branches = [];
            let otherwise = [];
            while (this.take('WHEN')) {
                const values = [];
                do {
                    values.push(this.expression());
                } while (this.take(','));
                const body = this.sequence(['WHEN', 'OTHERWISE', 'ENDCASE']);
                branches.push({values, body});
            }
            if (this.take('OTHERWISE')) otherwise = this.sequence(['ENDCASE']);
            this.expect('ENDCASE');
            return {kind: 'case', value, branches, otherwise, t};
        }
        if (this.take('EXIT')) {
            const loop = this.token.value;
            if (!['FOR', 'WHILE', 'REPEAT'].includes(loop))
                this.error('EXIT must specify FOR, WHILE or REPEAT', t);
            this.i++;
            return {kind: 'exit', loop: loop.toLowerCase(), t};
        }
        if (this.take('ENDPROC')) {
            if (!this.context?.name.startsWith('PROC')) this.error('ENDPROC outside PROC', t, 'syntax');
            return {kind: 'return', value: null, t};
        }
        if (this.take('=')) {
            if (!this.context?.name.startsWith('FN')) this.error('function result outside FN', t, 'syntax');
            return {kind: 'return', value: this.expression(), t};
        }
        if (this.take('END')) {
            if (!this.context && this.statementLevel === 1) this.mainTerminated = true;
            return {kind: 'end', t};
        }
        if (this.take('STOP'))
            this.error('STOP has interpreter-specific diagnostic output; use END for a compiled program', t);
        if (this.take('QUIT')) {
            if (!this.context && this.statementLevel === 1) this.mainTerminated = true;
            return {
                kind: 'quit',
                value: this.endStatement() ? {kind: 'number', value: '0', t} : this.expression(),
                t
            };
        }
        if (this.take('ERROR')) {
            const code = this.expression();
            this.expect(',');
            return {kind: 'error', code, value: this.expression(), t};
        }
        if (t.kind === 'name' && t.value.startsWith('PROC')) {
            this.i++;
            const args = this.take('(') ? this.list(')', () => this.expression()) : [];
            return {kind: 'procedure', name: t.value, args, t};
        }
        this.take('LET');
        if (this.token.kind === 'name' || this.is('TIME')) {
            const variable = this.variable(true);
            const op = this.token.value;
            if (!['=', '+=', '-=', '*=', '/='].includes(op))
                this.error('expected an assignment operator', this.token, 'syntax');
            this.i++;
            return {kind: 'assign', variable, op, value: this.expression(), t};
        }
        this.error(`statement ${this.token.value} is outside the compiled subset`, t);
    }
}

function cstring(value) {
    return (
        '"' + Array.from(value, (ch) => `\\${ch.charCodeAt(0).toString(8).padStart(3, '0')}`).join('') + '"'
    );
}
const variableKind = (name) =>
    name.endsWith('$') ? 2 : name.endsWith('%%') ? 4 : name.endsWith('%') ? 1 : name.endsWith('#') ? 3 : 0;

class Generator {
    constructor(prepared, parser, target, numericProfile) {
        this.prepared = prepared;
        this.parser = parser;
        this.target = target;
        this.numericProfile = numericProfile;
        this.variables = new Map();
        this.arrays = new Map();
        this.serial = 0;
        this.lines = [];
        this.indent = 0;
        this.loops = [];
        this.caseValues = [];
        this.definition = null;
    }
    error(message, t, code = 'unsupported-syntax') {
        throw new CompileError(message, t, this.prepared.filename, code);
    }
    emit(line = '') {
        this.lines.push('    '.repeat(this.indent) + line);
    }
    fresh(prefix = 't') {
        return `cb_${prefix}_${++this.serial}`;
    }
    name(variable) {
        if (this.numericProfile === 'binary64' && variable.name.endsWith('%%'))
            this.error(
                '64-bit integer variables are not yet supported by the binary64 target profile',
                variable.t,
                'target-precision'
            );
        const table = variable.indices === null ? this.variables : this.arrays;
        if (!table.has(variable.name))
            table.set(variable.name, `cb_${variable.indices === null ? 'v' : 'a'}_${table.size}`);
        return table.get(variable.name);
    }
    temp(code) {
        const name = this.fresh();
        this.emit(`cb_value ${name} = ${code};`);
        return name;
    }
    mayInput(node, seen = new Set()) {
        if (!node || typeof node !== 'object') return false;
        if (Array.isArray(node)) return node.some((value) => this.mayInput(value, seen));
        if (node.kind === 'input') return true;
        if (['call', 'procedure'].includes(node.kind) && !seen.has(node.name)) {
            const definition = this.parser.definitions.find((d) => d.name === node.name);
            if (definition) {
                const next = new Set(seen);
                next.add(node.name);
                if (this.mayInput(definition.body, next)) return true;
            }
        }
        return Object.entries(node).some(([key, value]) => key !== 't' && this.mayInput(value, seen));
    }
    numeric(value) {
        const v = this.expression(value);
        const n = this.fresh('n');
        this.emit(`long double ${n} = cb_number(${v});`);
        this.emit(`cb_release(${v});`);
        return n;
    }
    pointer(variable) {
        const name = this.name(variable);
        if (variable.indices === null) return `&${name}`;
        if (!variable.indices.length) this.error('whole-array value is unsupported', variable.t);
        const indices = variable.indices.map((v) => this.numeric(v));
        const arr = this.fresh('indices');
        this.emit(`long double ${arr}[] = {${indices.join(', ')}};`);
        const p = this.fresh('element');
        this.emit(`cb_var *${p} = cb_element(&${name}, ${indices.length}, ${arr});`);
        return p;
    }
    expression(e) {
        switch (e.kind) {
            case 'number': {
                if (/[.Ee]/.test(e.value)) return this.temp(`cb_numeric_text(${cstring(e.value)})`);
                const value = BigInt(e.value);
                if (value >= -9223372036854775808n && value <= 9223372036854775807n)
                    return this.temp(
                        `cb_integer_value(${value === -9223372036854775808n ? 'INT64_MIN' : `INT64_C(${value})`})`
                    );
                return this.temp(`cb_numeric_text(${cstring(e.value)})`);
            }
            case 'string':
                return this.temp(
                    `cb_string_value((const unsigned char *)${cstring(e.value)}, ${e.value.length})`
                );
            case 'constant':
                return this.temp(
                    e.value === 'TIME'
                        ? 'cb_time_get()'
                        : e.value === 'PI'
                          ? 'cb_number_value(3.141592653589793238462643383279502884L)'
                          : `cb_integer_value(${e.value === 'TRUE' ? '-1' : '0'})`
                );
            case 'variable':
                return this.temp(`cb_get(${this.pointer(e)})`);
            case 'unary': {
                const v = this.expression(e.value);
                return this.temp(`cb_unary(${cstring(e.op)}, ${v})`);
            }
            case 'binary': {
                const left = this.expression(e.left),
                    right = this.expression(e.right);
                return this.temp(`cb_binary(${cstring(e.op)}, ${left}, ${right})`);
            }
            case 'builtin': {
                const arities = {
                    LEFT$: [1, 2],
                    RIGHT$: [1, 2],
                    MID$: [2, 3],
                    STRING$: [2],
                    INSTR: [2, 3],
                    RND: [0, 1]
                };
                if (!(arities[e.name] ?? [1]).includes(e.args.length))
                    this.error(`wrong number of arguments to ${e.name}`, e.t, 'arity');
                const values = e.args.map((a) => this.expression(a));
                return this.temp(
                    `cb_builtin(${cstring(e.name)}, ${e.args.length}, ${values[0] ?? 'cb_number_value(0)'}, ${values[1] ?? 'cb_number_value(0)'}, ${values[2] ?? 'cb_number_value(0)'}, ${e.hex ? 1 : 0})`
                );
            }
            case 'call':
                return this.call(e);
            default:
                throw new Error(`unknown expression node ${e.kind}`);
        }
    }
    call(e) {
        const pinFns = {FNdigitalRead: [1, 'cb_pin_read'], FNmillis: [0, 'cb_millis']};
        const pinProcs = {
            PROCpinMode: [2, 'cb_pin_mode'],
            PROCdigitalWrite: [2, 'cb_pin_write'],
            PROCdigitalToggle: [1, 'cb_pin_toggle'],
            PROCdelay: [1, 'cb_delay']
        };
        const builtin = (e.kind === 'procedure' ? pinProcs : pinFns)[e.name];
        const def = this.parser.definitions.find((d) => d.name === e.name);
        if (!def && !builtin) this.error(`undefined ${e.name}`, e.t, 'undefined-procedure');
        const count = def ? def.params.length : builtin[0];
        if (e.args.length !== count) this.error(`${e.name} expects ${count} argument(s)`, e.t, 'arity');
        let scope;
        if (def) {
            scope = this.fresh('parameters');
            this.emit(`cb_scope_record *${scope} = NULL;`);
            for (const parameter of def.params) this.emit(`cb_capture(&${scope}, &${this.name(parameter)});`);
        }
        const values = e.args.map((v) => this.expression(v));
        const call = `${def ? `cb_function_${this.parser.definitions.indexOf(def)}` : builtin[1]}(${(def ? [scope, ...values] : values).join(', ')})`;
        if (e.kind === 'procedure') {
            this.emit(`${call};`);
            return null;
        }
        const result = this.temp(call);
        this.emit(`cb_line = ${e.t.line};`);
        return result;
    }
    block(body) {
        for (const s of body) {
            // Reuse temporary storage between BASIC statements, especially on AVR.
            this.emit('{');
            this.indent++;
            this.statement(s);
            this.indent--;
            this.emit('}');
        }
    }
    statement(s) {
        this.emit(`cb_line = ${s.t.line};`);
        switch (s.kind) {
            case 'noop':
                break;
            case 'assign': {
                const time = s.variable.kind === 'time';
                const p = time ? null : this.pointer(s.variable);
                let value = this.expression(s.value);
                if (s.op !== '=') {
                    const old = this.temp(time ? 'cb_time_get()' : `cb_get(${p})`);
                    value = this.temp(`cb_binary(${cstring(s.op[0])}, ${old}, ${value})`);
                }
                this.emit(time ? `cb_time_set(${value});` : `cb_set(${p}, ${value});`);
                break;
            }
            case 'dim':
                for (const v of s.variables) {
                    const name = this.name(v),
                        dims = v.indices.map((x) => this.numeric(x));
                    const b = this.fresh('bounds');
                    this.emit(`long double ${b}[] = {${dims.join(', ')}};`);
                    this.emit(`cb_dimension(&${name}, ${variableKind(v.name)}, ${dims.length}, ${b});`);
                }
                break;
            case 'local':
                for (const v of s.variables) {
                    const n = this.name(v);
                    this.emit(
                        v.indices === null
                            ? `cb_local(&cb_scope, &${n});`
                            : `cb_local_array(&cb_scope, &${n});`
                    );
                }
                break;
            case 'procedure':
                this.call(s);
                break;
            case 'print': {
                const savedWidth = this.fresh('print_width');
                this.emit(`unsigned int ${savedWidth} = cb_print_width;`);
                this.emit('cb_print_begin();');
                for (const item of s.items) {
                    if (item.kind === 'value') {
                        const v = this.expression(item.value);
                        this.emit(`cb_print(${v}, ${item.hex ? 1 : 0});`);
                    } else this.emit(`cb_print_${item.kind}();`);
                }
                if (!['semicolon', 'comma'].includes(s.items.at(-1)?.kind)) this.emit('cb_newline();');
                this.emit(`cb_print_width = ${savedWidth};`);
                break;
            }
            case 'input': {
                if (s.variables.some((variable) => this.mayInput(variable.indices)))
                    this.error(
                        'INPUT invoked by a subscript function would re-enter the interpreter input buffer; evaluate the index in a preceding statement',
                        s.t,
                        'reentrant-input'
                    );
                const prompt = s.prompt
                    ? this.expression(s.prompt)
                    : 'cb_string_value((const unsigned char *)"",0)';
                this.emit(`cb_input_begin(${prompt}, ${s.question ? 1 : 0}, ${s.lineMode ? 1 : 0});`);
                for (const v of s.variables) {
                    const p = this.pointer(v);
                    this.emit(`cb_set(${p}, cb_input(${variableKind(v.name)}));`);
                }
                this.emit('cb_input_end();');
                break;
            }
            case 'if': {
                const v = this.expression(s.condition);
                this.emit(`if (cb_truth(${v})) {`);
                this.indent++;
                this.block(s.yes);
                this.indent--;
                if (s.no.length) {
                    this.emit('} else {');
                    this.indent++;
                    this.block(s.no);
                    this.indent--;
                }
                this.emit('}');
                break;
            }
            case 'for': {
                const p = this.pointer(s.variable),
                    start = this.expression(s.start);
                this.emit(`cb_set(${p}, ${start});`);
                const end = this.expression(s.end),
                    step = this.expression(s.step),
                    label = this.fresh('exit_for');
                this.emit(`cb_for_validate(${end}, ${step});`);
                this.emit('{');
                this.indent++;
                this.emit('for (;;) {');
                this.indent++;
                this.loops.push({kind: 'for', label, depth: this.loops.length + 1});
                this.block(s.body);
                this.loops.pop();
                this.emit(`if (!cb_for_next(${p}, ${end}, ${step})) break;`);
                this.indent--;
                this.emit('}');
                this.indent--;
                this.emit('}');
                this.emit(`${label}:;`);
                break;
            }
            case 'while':
            case 'repeat': {
                const label = this.fresh(`exit_${s.kind}`);
                this.emit('for (;;) {');
                this.indent++;
                if (s.kind === 'while') {
                    const c = this.expression(s.condition);
                    this.emit(`if (!cb_truth(${c})) break;`);
                }
                this.loops.push({kind: s.kind, label, depth: this.loops.length + 1});
                this.block(s.body);
                this.loops.pop();
                if (s.kind === 'repeat') {
                    const c = this.expression(s.condition);
                    this.emit(`if (cb_truth(${c})) break;`);
                }
                this.indent--;
                this.emit('}');
                this.emit(`${label}:;`);
                break;
            }
            case 'exit': {
                const loop = this.loops.findLast((l) => l.kind === s.loop);
                if (!loop) this.error(`EXIT ${s.loop.toUpperCase()} outside that loop`, s.t, 'syntax');
                for (const value of this.caseValues)
                    if (value.depth >= loop.depth) this.emit(`cb_release(${value.name});`);
                this.emit(`goto ${loop.label};`);
                break;
            }
            case 'case': {
                const value = this.expression(s.value),
                    matched = this.fresh('matched');
                this.emit(`int ${matched} = 0;`);
                this.caseValues.push({name: value, depth: this.loops.length});
                for (const branch of s.branches) {
                    this.emit(`if (!${matched}) {`);
                    this.indent++;
                    const hit = this.fresh('hit');
                    this.emit(`int ${hit} = 0;`);
                    for (const match of branch.values) {
                        this.emit(`if (!${hit}) {`);
                        this.indent++;
                        const v = this.expression(match);
                        this.emit(`${hit} = cb_equal(${value}, ${v});`);
                        this.emit(`cb_release(${v});`);
                        this.indent--;
                        this.emit('}');
                    }
                    this.emit(`if (${hit}) {`);
                    this.indent++;
                    this.emit(`${matched} = 1;`);
                    this.block(branch.body);
                    this.indent--;
                    this.emit('}');
                    this.indent--;
                    this.emit('}');
                }
                if (s.otherwise.length) {
                    this.emit(`if (!${matched}) {`);
                    this.indent++;
                    this.block(s.otherwise);
                    this.indent--;
                    this.emit('}');
                }
                this.caseValues.pop();
                this.emit(`cb_release(${value});`);
                break;
            }
            case 'return': {
                const value = s.value ? this.expression(s.value) : null;
                for (const item of this.caseValues) this.emit(`cb_release(${item.name});`);
                this.emit('cb_restore(&cb_scope);');
                this.emit(value ? `return ${value};` : 'return;');
                break;
            }
            case 'end':
                this.emit('exit(0);');
                break;
            case 'quit': {
                const v = this.numeric(s.value);
                this.emit(`exit((int)cb_int32(${v}) & 255);`);
                break;
            }
            case 'error': {
                const code = this.numeric(s.code),
                    value = this.expression(s.value);
                this.emit(`cb_basic_error(${code}, ${value});`);
                break;
            }
            default:
                throw new Error(`unknown statement node ${s.kind}`);
        }
    }
    build(main) {
        this.emit('static void cb_program(void) {');
        this.indent++;
        this.block(main);
        this.indent--;
        this.emit('}');
        for (let i = 0; i < this.parser.definitions.length; i++) {
            const def = this.parser.definitions[i];
            this.definition = def;
            const isFn = def.name.startsWith('FN');
            this.emit(
                `static ${isFn ? 'cb_value' : 'void'} cb_function_${i}(${['cb_scope_record *cb_scope', ...def.params.map((p, j) => `cb_value cb_arg_${j}`)].join(', ')}) {`
            );
            this.indent++;
            def.params.forEach((p, j) => {
                const n = this.name(p);
                this.emit(`cb_set(&${n}, cb_arg_${j});`);
            });
            this.block(def.body);
            this.emit('cb_restore(&cb_scope);');
            if (isFn) {
                this.emit('cb_fail("function reached its end without a result");');
                this.emit('return cb_number_value(0);');
            }
            this.indent--;
            this.emit('}');
        }
        const declarations = [...this.variables]
            .map(
                ([name, c]) =>
                    `static cb_var ${c} = {${variableKind(name)}, ${/^[A-Z]%$/.test(name) ? 1 : 0}, {0, 0, NULL, ${[1, 4].includes(variableKind(name)) ? 1 : 0}, 0}};`
            )
            .concat([...this.arrays].map(([, c]) => `static cb_array ${c} = {0, 0, 0, NULL, NULL};`));
        const prototypes = this.parser.definitions.map(
            (d, i) =>
                `static ${d.name.startsWith('FN') ? 'cb_value' : 'void'} cb_function_${i}(${['cb_scope_record *', ...d.params.map(() => `cb_value`)].join(', ')});`
        );
        return [
            ...declarations,
            ...prototypes,
            ...this.lines,
            'int main(void) { cb_platform_init(); cb_program(); return 0; }',
            ''
        ].join('\n');
    }
}

/** Compile without invoking a C toolchain. The returned C99 translation unit
 * contains generated statements and a small independent support runtime. */
export function compileSource(
    source,
    {
        filename = 'main.bas',
        target = 'native',
        numericProfile = target === 'native' ? 'native-bbcsdl' : 'binary64'
    } = {}
) {
    if (!['native', 'pico', 'arduino-uno'].includes(target))
        throw new TypeError(`unknown compiler target ${target}`);
    if (!['native-bbcsdl', 'binary64', 'extended'].includes(numericProfile))
        throw new TypeError(`unknown numeric profile ${numericProfile}`);
    if (target !== 'native' && numericProfile !== 'binary64')
        throw new TypeError('board targets require the binary64 numeric profile');
    const prepared = prepareSource(source, {filename});
    const parser = new Parser(prepared),
        main = parser.sequence();
    if (parser.pendingNext?.length)
        parser.error(
            'NEXT contains variables without enclosing FOR loops',
            parser.pendingNext[0].t,
            'syntax'
        );
    if (parser.token.kind !== 'eof') parser.error(`unexpected ${parser.token.value}`, parser.token, 'syntax');
    const generator = new Generator(prepared, parser, target, numericProfile),
        body = generator.build(main);
    const prelude = `/* Generated by CrispBASIC's independent C99 compiler.\n * Source: ${filename.replace(/[\r\n*\/]/g, '_')}\n * The generated program does not contain or invoke a BASIC interpreter.\n */\n#include <stdint.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <math.h>\n#include <float.h>\n#include <limits.h>\n#include <stddef.h>\nstatic unsigned long cb_line;\nstatic void cb_fail(const char *message);\n`;
    const numeric = `\n${numericProfile === 'binary64' ? '#define CB_REAL_BINARY64 1' : numericProfile === 'native-bbcsdl' ? '#if defined(__arm__) || defined(__aarch64__) || defined(__EMSCRIPTEN__)\n#define CB_REAL_BINARY64 1\n#endif\n#if defined(__aarch64__)\n#define CB_NATIVE_AARCH64 1\n#elif defined(__arm__)\n#define CB_NATIVE_ARMV7 1\n#endif' : ''}
#ifdef CB_REAL_BINARY64
#if FLT_RADIX != 2 || DBL_MANT_DIG != 53 || DBL_MIN_EXP != -1021 || DBL_MAX_EXP != 1024
#error "CrispBASIC binary64 profile requires IEEE binary64 double; AVR builds need -mdouble=64 -mlong-double=64 and matching avr-libc"
#endif
typedef char cb_binary64_requires_8_byte_double[(sizeof(double) == 8) ? 1 : -1];
typedef double cb_real;
#else
typedef long double cb_real;
#endif
`;
    return {
        c:
            prelude +
            numeric +
            compilerPlatform(target) +
            '\n' +
            runtime.replace(/\blong double\b/g, 'cb_real') +
            '\n' +
            body.replace(/\blong double\b/g, 'cb_real'),
        sourceMap: prepared.sourceMap,
        diagnostics: [],
        metadata: {
            compiler: 'crispbasic-c99',
            target,
            filename,
            independentImplementation: true,
            interpreterEmbedded: false,
            numericProfile,
            variables: generator.variables.size,
            arrays: generator.arrays.size,
            procedures: parser.definitions.length
        }
    };
}
