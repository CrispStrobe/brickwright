/**
 * Blocks ⇄ Forth for the Code tab's Forth tab: zForth as it runs on the DOS
 * bench (static/roms/forth.exe, DOS_TOOLCHAINS 'forth'). Two halves:
 *
 *   generateForth(project)        blocks → Forth source     {ok, forth, reasons, warnings}
 *   forthToPseudocode(source)     Forth source → pseudocode {pseudocode, warnings} (default export)
 *
 * WHAT ZFORTH IS, MEASURED ON THE BENCH:
 *   - A numeric Forth: cells are floats ("%.14g"), so 7/2 is 3.5, as in Scratch.
 *   - Globals are `var X` (reserves a cell, pushes its address); `X @` reads,
 *     `<v> X !` writes, `<v> X +!` adds. (zForth's `variable` wants a value
 *     first; `var` does not.) The program body lives in a `: main … ; main`
 *     word because zForth's if/else/fi + begin/until are compile-only.
 *   - Reporters compile to RPN: `(a + b)` → `a b +`. Primitives + - * / and the
 *     core.zf words < > <= >= = != and or not. Booleans are 0 / non-0.
 *   - Printing: a number with `.` (trailing space), a literal string with `." "`;
 *     each `say` ends with `cr`.
 *   - Control: `<cond> if … else … fi` (zForth spells `then` as `fi`). The only
 *     loop primitives core.zf gives are `begin … until` (post-test, exits when
 *     the flag is true) and `begin … again` (infinite). zForth has no `do/loop`,
 *     `while/repeat`, or `i`, so a counted REPEAT is built from a counter cell.
 *
 * WHAT THIS SLICE EMITS:
 *   - v1 base (as fe/Tcl began): globals, set/change, arithmetic, comparisons,
 *     and/or/not, say (number or string literal), if / if-else.
 *   - Loops. FOREVER is `begin … again`. REPEAT n counts a `_rK` counter cell
 *     down to zero. REPEAT UNTIL c is a pre-test guard (`begin c if 1 else …body… 0 fi until`).
 *     control_while reuses the REPEAT-UNTIL form with the condition negated.
 *   - No-argument custom blocks, as Forth words `: name … ;`. A word must be
 *     defined before it is used, so the definitions are emitted callees-first
 *     (a topological order); a cycle or self-recursion is refused — zForth,
 *     like standard Forth, compiles a call to its target's address at compile
 *     time, so it cannot forward-reference.
 *
 * STILL REFUSED (a later slice): custom blocks WITH arguments (Forth passes
 * arguments on the stack by position, not by name), join (zForth has no string
 * building), lists, wait, stop/return. Each loop and the counters, markers and
 * `: main` wrapper give the generator and reader one canonical shape so a
 * program round-trips through pseudocode unchanged.
 */
import {collectScripts, decodeInput, field, procName, procPrototype, substackId} from './project-walk.js';

const RESERVED = new Set(['var', 'variable', 'if', 'else', 'fi', 'begin', 'until', 'again', 'dup', 'drop', 'swap',
    'over', 'rot', 'and', 'or', 'not', 'cr', 'emit', 'here', 'allot', 'exit', 'i', 'times', 'main',
    // GPIO bridge words baked into the DOS Forth binary's prelude (dosmain.c):
    // `pin! ( pin value -- )` drives an 8086 OUT to 0x378+pin, `pin@ ( pin -- )`
    // an IN. A write lights the 8-pin GPIO strip widget via onPortAccess.
    'pin!', 'pin@']);
const MARK_VARS = '( --- variables --- )';
const MARK_PROGRAM = '( --- program --- )';
// Loop markers: Forth comments the tokenizer turns into marker tokens, so the
// reader knows a construct's kind without classifying the `begin` body.
const MARK_REPEAT = '( repeat )';
const MARK_FOREVER = '( forever )';
const MARK_UNTIL = '( repeat-until )';

// A Forth `." ..."` string: zForth stops the literal at the closing quote, so a
// double quote cannot appear inside one. Refused upstream (join), but escape
// defensively by dropping any stray quote.
const forthString = s => `." ${String(s).replace(/"/g, '')}"`;

function makeNamer (taken) {
    const map = new Map();
    return raw => {
        const key = String(raw);
        if (map.has(key)) return map.get(key);
        let n = key.replace(/[^A-Za-z0-9_]/g, '_');
        if (!n || /^[\d_]/.test(n)) n = `v${n}`;
        while (RESERVED.has(n) || taken.has(n)) n += '_';
        taken.add(n);
        map.set(key, n);
        return n;
    };
}

/** Every custom-block call reachable from a stack (through next + substacks). */
function callsIn (startId, blocks) {
    const codes = new Set();
    const seen = new Set();
    const visit = id => {
        const b = blocks[id];
        if (!b || seen.has(id)) return;
        seen.add(id);
        if (b.opcode === 'procedures_call' && b.mutation) codes.add(String(b.mutation.proccode));
        for (const key of ['SUBSTACK', 'SUBSTACK2']) { const s = substackId(b, key); if (s) visit(s); }
        if (b.next) visit(b.next);
    };
    visit(startId);
    return codes;
}

/**
 * Blocks → Forth.
 * @param {object} project serialized SB3 project
 * @returns {{ok: boolean, forth: string, reasons: string[], warnings: string[]}}
 */
export function generateForth (project) {
    const reasons = [];
    const warnings = [];
    const refuse = r => { if (!reasons.includes(r)) reasons.push(r); };
    const taken = new Set();
    const varName = makeNamer(taken);
    const procWord = makeNamer(taken);

    // Counter cells the generator introduces for REPEAT n. User variables can
    // never start with "_" (makeNamer rewrites a leading "_" to "v_"), so a
    // "_rK" name is unambiguously generator-internal.
    const counters = [];
    let counterSeq = 0;
    const newCounter = () => { const n = `_r${counterSeq++}`; counters.push(n); return n; };

    const {flags, procs, other} = collectScripts(project);
    if (flags.length > 1) {
        refuse(`Forth runs one script at a time: this project has ${flags.length} "when flag clicked" scripts`);
    }
    for (const o of other) {
        if (/^(argument_|procedures_prototype)/.test(o.block.opcode)) continue;
        refuse(`no Forth form for the script starting with ${o.block.opcode}`);
    }

    // ---- custom blocks: no-argument definitions become Forth words ----------
    const procByCode = new Map();
    const usable = [];
    for (const p of procs) {
        const proto = procPrototype(p.block, p.blocks);
        const label = procName(proto.proccode);
        if (proto.argumentNames.length) {
            refuse(`Forth custom block "${label}" takes arguments (Forth passes arguments on the stack by position, not by name) — not supported yet`);
            continue;
        }
        if (!p.block.next) {
            refuse(`Forth custom block "${label}" is empty — give it at least one block`);
            continue;
        }
        const info = {proccode: proto.proccode, label, word: procWord(label), def: p, bodyStart: p.block.next};
        procByCode.set(proto.proccode, info);
        usable.push(info);
    }

    // ---- expressions → RPN (a list of whitespace-joined tokens) ----------
    const expr = (input, blocks) => {
        const d = decodeInput(input, blocks);
        switch (d.kind) {
        case 'num': return String(d.value);
        case 'str':
            refuse('Forth cannot use text as a number here (zForth values are numeric)');
            return '0';
        case 'var': return `${varName(d.name)} @`;
        case 'list': refuse(`Forth programs here have no Scratch lists ("${d.name}")`); return '0';
        case 'block': return reporter(d.block, blocks);
        default: return '0';
        }
    };
    const reporter = (b, blocks) => {
        const e = k => expr(b.inputs[k], blocks);
        switch (b.opcode) {
        case 'operator_add': return `${e('NUM1')} ${e('NUM2')} +`;
        case 'operator_subtract': return `${e('NUM1')} ${e('NUM2')} -`;
        case 'operator_multiply': return `${e('NUM1')} ${e('NUM2')} *`;
        case 'operator_divide': return `${e('NUM1')} ${e('NUM2')} /`;
        case 'operator_gt': return `${e('OPERAND1')} ${e('OPERAND2')} >`;
        case 'operator_lt': return `${e('OPERAND1')} ${e('OPERAND2')} <`;
        case 'operator_equals': return `${e('OPERAND1')} ${e('OPERAND2')} =`;
        case 'operator_and': return `${e('OPERAND1')} ${e('OPERAND2')} and`;
        case 'operator_or': return `${e('OPERAND1')} ${e('OPERAND2')} or`;
        case 'operator_not': return `${e('OPERAND')} not`;
        // GPIO input: `pin@ ( pin -- value )` reads 0x378+pin.
        case 'bwgpio_readpin': return `${field(b, 'PIN')} pin@`;
        case 'operator_mod': refuse('Forth mod is not supported yet'); return '0';
        case 'operator_join':
            refuse('Forth cannot join text (zForth has no string building) — say the parts separately');
            return '0';
        case 'data_variable': return `${varName(field(b, 'VARIABLE'))} @`;
        default:
            refuse(`no Forth form for the reporter ${b.opcode}`);
            return '0';
        }
    };

    // ---- statements (each returns a line array) --------------------------
    const stack = (id, blocks) => {
        const out = [];
        let b = blocks[id];
        while (b) { out.push(...statement(b, blocks)); b = blocks[b.next]; }
        return out;
    };
    const body = (b, key, blocks) => {
        const sid = substackId(b, key);
        return sid ? stack(sid, blocks) : [];
    };
    const sayStatement = (input, blocks) => {
        const d = decodeInput(input, blocks);
        if (d.kind === 'str') return [`${forthString(d.value)} cr`];
        if (d.kind === 'block' && d.block.opcode === 'operator_join') {
            refuse('Forth cannot join text (zForth has no string building) — say the parts separately');
            return [];
        }
        return [`${expr(input, blocks)} . cr`];
    };
    // REPEAT UNTIL c: a pre-test guard. Run the body while c is false; the
    // begin…until flag is `1` when c is true (stop), `0` otherwise (loop).
    const untilLoop = (cond, inner) => [
        MARK_UNTIL,
        'begin',
        `  ${cond} if`,
        '    1',
        '  else',
        ...inner.map(l => `    ${l}`),
        '    0',
        '  fi',
        'until'
    ];
    const statement = (b, blocks) => {
        const e = k => expr(b.inputs[k], blocks);
        switch (b.opcode) {
        case 'data_setvariableto': return [`${e('VALUE')} ${varName(field(b, 'VARIABLE'))} !`];
        case 'data_changevariableby': return [`${e('VALUE')} ${varName(field(b, 'VARIABLE'))} +!`];
        // GPIO output: `pin! ( pin value -- )` OUTs to 0x378+pin, lighting the
        // Widgets pane's GPIO strip via the i8086 bench's onPortAccess bridge.
        case 'bwgpio_setpin': return [`${field(b, 'PIN')} ${e('VALUE')} pin!`];
        case 'looks_say': case 'looks_think': case 'stc12_print':
            return sayStatement(b.inputs.MESSAGE ? b.inputs.MESSAGE : b.inputs.VALUE, blocks);
        case 'control_if': {
            const inner = body(b, 'SUBSTACK', blocks);
            return [`${e('CONDITION')} if`, ...inner.map(l => `  ${l}`), 'fi'];
        }
        case 'control_if_else': {
            const t = body(b, 'SUBSTACK', blocks);
            const f = body(b, 'SUBSTACK2', blocks);
            return [`${e('CONDITION')} if`, ...t.map(l => `  ${l}`), 'else', ...f.map(l => `  ${l}`), 'fi'];
        }
        case 'control_repeat': {
            const c = newCounter();
            const times = e('TIMES');
            const inner = body(b, 'SUBSTACK', blocks);
            // count the cell down to zero; the guard skips the body once it hits 0.
            return [
                MARK_REPEAT,
                `${times} ${c} !`,
                'begin',
                `  ${c} @ 0 > if`,
                ...inner.map(l => `    ${l}`),
                '  fi',
                `  -1 ${c} +!`,
                `  ${c} @ 0 <=`,
                'until'
            ];
        }
        case 'control_forever': {
            const inner = body(b, 'SUBSTACK', blocks);
            return [MARK_FOREVER, 'begin', ...inner.map(l => `  ${l}`), 'again'];
        }
        case 'control_repeat_until':
            return untilLoop(e('CONDITION'), body(b, 'SUBSTACK', blocks));
        case 'control_while':
            // while c = repeat until (not c): run the body while c is true.
            return untilLoop(`${e('CONDITION')} not`, body(b, 'SUBSTACK', blocks));
        case 'control_wait': case 'looks_sayforsecs': case 'looks_thinkforsecs':
            refuse('Forth has no clock (no wait)');
            return [];
        case 'control_stop':
            refuse('Forth has no way to "stop" here (no return or exit)');
            return [];
        case 'procedures_call': {
            const info = b.mutation && procByCode.get(String(b.mutation.proccode));
            if (!info) { refuse('Forth cannot call this custom block (no supported definition for it)'); return []; }
            return [info.word];
        }
        default:
            refuse(`no Forth form for the block ${b.opcode}`);
            return [];
        }
    };

    // ---- proc bodies, emitted callees-first ------------------------------
    const procLines = [];
    const emitted = new Set();
    const remaining = new Set(usable);
    let progress = true;
    while (progress && remaining.size) {
        progress = false;
        for (const info of [...remaining]) {
            const deps = callsIn(info.bodyStart, info.def.blocks);
            const unmet = [...deps].some(code => procByCode.has(code) && !emitted.has(code));
            if (unmet) continue;
            const lines = stack(info.bodyStart, info.def.blocks);
            procLines.push(`: ${info.word}`, ...lines.map(l => `  ${l}`), ';');
            emitted.add(info.proccode);
            remaining.delete(info);
            progress = true;
        }
    }
    for (const info of remaining) {
        refuse(`Forth custom block "${info.label}" calls itself or forms a cycle — a Forth word must be defined before it is used`);
    }

    const mainLines = flags.length === 1 ? stack(flags[0].block.next, flags[0].blocks) : [];

    // User-variable `var` cells, then the loop counters.
    const varLines = [];
    const seen = new Set();
    for (const target of (project && project.targets) || []) {
        for (const [name] of Object.values(target.variables || {})) {
            const n = varName(name);
            if (seen.has(n)) continue;
            seen.add(n);
            varLines.push(`var ${n}`);
        }
    }
    for (const c of counters) varLines.push(`var ${c}`);

    if (reasons.length) return {ok: false, forth: '', reasons, warnings};
    const out = [];
    if (varLines.length) out.push(MARK_VARS, ...varLines);
    out.push(MARK_PROGRAM);
    out.push(...procLines);
    // The program body lives inside a `: main … ; main` word: zForth's if/else/fi
    // and begin/until are compile-only (they only run inside a definition), and
    // `var` globals stay reachable from it. An empty body still defines main so
    // the shape is uniform.
    out.push(': main', ...mainLines.map(l => `  ${l}`), ';', 'main');
    return {ok: true, forth: `${out.join('\n')}\n`, reasons, warnings};
}

// ======================================================================
// Forth → pseudocode
// ======================================================================

class ForthReadError extends Error {}

/** Tokenise Forth: words, `( … )` comments (dropped, except the markers kept as
 *  marker tokens), and `." … "` string literals as one `{str}` token. */
function tokenize (src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    let line = 1;
    const MARKS = {[MARK_VARS]: 'vars', [MARK_PROGRAM]: 'program',
        [MARK_REPEAT]: 'repeat', [MARK_FOREVER]: 'forever', [MARK_UNTIL]: 'repeat-until'};
    while (i < n) {
        const c = src[i];
        if (c === '\n') { line++; i++; continue; }
        if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
        if (c === '(') {
            const j = src.indexOf(')', i);
            const text = src.slice(i, j < 0 ? n : j + 1).trim();
            if (MARKS[text]) toks.push({t: 'mark', v: MARKS[text], line});
            i = j < 0 ? n : j + 1;
            continue;
        }
        if (c === '.' && src[i + 1] === '"') {
            // ." string"
            const j = src.indexOf('"', i + 2);
            if (j < 0) throw new ForthReadError(`line ${line}: unclosed ." string`);
            toks.push({t: 'str', v: src.slice(i + 2, j).replace(/^ /, ''), line});
            i = j + 1;
            continue;
        }
        let j = i;
        while (j < n && !' \t\r\n('.includes(src[j])) j++;
        toks.push({t: 'word', v: src.slice(i, j), line});
        i = j;
    }
    return toks;
}

const pseudoString = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const PSEUDO_CLASH = new Set(['x', 'y']);
const BIN = {'+': '+', '-': '-', '*': '*', '/': '/', '<': '<', '>': '>', '=': '=', 'and': 'and', 'or': 'or'};

/**
 * Forth → pseudocode (the importer's reader contract: returns
 * {pseudocode, warnings} or throws). Reads the canonical shape the generator
 * writes: an RPN stack machine rebuilds each expression, `if/else/fi` nests
 * statement lists, loop markers introduce FOREVER / REPEAT / REPEAT UNTIL, and
 * every `: word … ;` other than `main` is a DEFINE custom block.
 */
export default function forthToPseudocode (source) {
    const warnings = [];
    const globals = new Set();
    const procNames = new Set();  // defined words other than main (custom blocks)
    const procBlocks = [];        // {name, lines} for each custom block, in order
    let mainBody = null;
    const startup = [];
    let mainCalled = false;
    const toks = tokenize(String(source || ''));
    let pos = 0;
    const rename = name => {
        if (PSEUDO_CLASH.has(name)) {
            const w = `variable "${name}" renamed to "${name}_var" (pseudocode reads "set ${name}" as motion)`;
            if (!warnings.includes(w)) warnings.push(w);
            return `${name}_var`;
        }
        return name;
    };

    const peek = () => toks[pos];
    const next = () => toks[pos++];
    const pad = d => '  '.repeat(d);
    const expectWord = w => {
        const t = next();
        if (!t || t.t !== 'word' || t.v !== w) {
            throw new ForthReadError(`line ${(t || {}).line}: expected "${w}", saw "${(t || {}).v}"`);
        }
    };

    // Read one RPN expression, stopping (without consuming) when `stop(token)`
    // is true, and return {s} (its infix form).
    const readExpr = stop => {
        const es = [];
        for (;;) {
            const t = peek();
            if (!t || stop(t)) break;
            next();
            if (t.t === 'str') throw new ForthReadError(`line ${t.line}: string inside a numeric expression`);
            const w = t.v;
            if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(w)) { es.push({s: w}); continue; }
            if (w === 'not') { es.push({s: `(not ${es.pop().s})`}); continue; }
            if (BIN[w]) { const b = es.pop(); const a = es.pop(); es.push({s: `(${a.s} ${BIN[w]} ${b.s})`}); continue; }
            if (w === 'pin@') { es.push({s: `(read pin ${es.pop().s})`}); continue; } // GPIO input reporter
            if (w === '@') continue; // the `@` of a var read `X @`
            if (peek() && peek().t === 'word' && peek().v === '@') { // bare word then @ = var read
                next();
                es.push({s: rename(w)});
                globals.add(rename(w));
                continue;
            }
            throw new ForthReadError(`line ${t.line}: unexpected "${w}" in an expression`);
        }
        if (es.length !== 1) throw new ForthReadError('a Forth expression did not reduce to one value');
        return es[0];
    };

    // FOREVER: `begin … again`.
    const readForever = depth => {
        expectWord('begin');
        const inner = [];
        for (;;) {
            const t = peek();
            if (!t) throw new ForthReadError('( forever ) without again');
            if (t.t === 'word' && t.v === 'again') { next(); break; }
            const s = readStatement(depth + 1);
            if (s === null) { next(); continue; }
            inner.push(...s);
        }
        return [`${pad(depth)}FOREVER:`, ...inner];
    };

    // REPEAT n: `<times> _rK ! begin _rK @ 0 > if …body… fi -1 _rK +! _rK @ 0 <= until`.
    const readRepeat = depth => {
        const times = readExpr(t => t.t === 'word' && t.v.startsWith('_') &&
            toks[pos + 1] && toks[pos + 1].v === '!');
        const counter = next().v;
        expectWord('!');
        expectWord('begin');
        expectWord(counter); expectWord('@'); expectWord('0'); expectWord('>'); expectWord('if');
        const inner = [];
        for (;;) {
            const t = peek();
            if (!t) throw new ForthReadError('( repeat ) guard without fi');
            if (t.t === 'word' && t.v === 'fi') { next(); break; }
            const s = readStatement(depth + 1);
            if (s === null) { next(); continue; }
            inner.push(...s);
        }
        expectWord('-1'); expectWord(counter); expectWord('+!');
        expectWord(counter); expectWord('@'); expectWord('0'); expectWord('<='); expectWord('until');
        return [`${pad(depth)}REPEAT ${times.s}:`, ...inner];
    };

    // REPEAT UNTIL c: `begin <c> if 1 else …body… 0 fi until`.
    const readUntil = depth => {
        expectWord('begin');
        const cond = readExpr(t => t.t === 'word' && t.v === 'if');
        expectWord('if'); expectWord('1'); expectWord('else');
        const inner = [];
        for (;;) {
            const t = peek();
            if (!t) throw new ForthReadError('( repeat-until ) without fi');
            // the else-branch ends with a bare `0` immediately before `fi`.
            if (t.t === 'word' && t.v === '0' && toks[pos + 1] && toks[pos + 1].t === 'word' &&
                toks[pos + 1].v === 'fi') { next(); break; }
            const s = readStatement(depth + 1);
            if (s === null) { next(); continue; }
            inner.push(...s);
        }
        expectWord('fi'); expectWord('until');
        return [`${pad(depth)}REPEAT UNTIL ${cond.s}:`, ...inner];
    };

    const parseIf = (cond, depth) => {
        const out = [`${pad(depth)}IF ${cond.s} THEN:`];
        for (;;) {
            const tk = peek();
            if (!tk) throw new ForthReadError('if without fi');
            if (tk.t === 'word' && (tk.v === 'else' || tk.v === 'fi')) break;
            const s = readStatement(depth + 1);
            if (s === null) break;
            out.push(...s);
        }
        if (peek() && peek().t === 'word' && peek().v === 'else') {
            next();
            out.push(`${pad(depth)}ELSE:`);
            for (;;) {
                const tk = peek();
                if (!tk) throw new ForthReadError('else without fi');
                if (tk.t === 'word' && tk.v === 'fi') break;
                const s = readStatement(depth + 1);
                if (s === null) break;
                out.push(...s);
            }
        }
        if (!(peek() && peek().t === 'word' && peek().v === 'fi')) throw new ForthReadError('if without fi');
        next(); // consume fi
        return out;
    };

    // Parse one statement; returns an array of pseudocode lines at `depth`, or
    // null at a block terminator (else/fi/until/again/;) which the caller
    // consumes.
    function readStatement (depth) {
        const estack = [];
        const popExpr = () => {
            if (!estack.length) throw new ForthReadError(`line ${(peek() || {}).line}: empty Forth stack`);
            return estack.pop();
        };
        for (;;) {
            const tk = peek();
            if (!tk) return null;
            if (tk.t === 'mark') {
                if (tk.v === 'repeat') { next(); return readRepeat(depth); }
                if (tk.v === 'forever') { next(); return readForever(depth); }
                if (tk.v === 'repeat-until') { next(); return readUntil(depth); }
                next(); continue; // vars / program markers
            }
            if (tk.t === 'str') {
                next();
                if (peek() && peek().t === 'word' && peek().v === 'cr') next();
                return [`${pad(depth)}say ${pseudoString(tk.v)}`];
            }
            const w = tk.v;
            if (w === 'else' || w === 'fi' || w === 'until' || w === 'again' || w === ';') return null;
            next();
            if (w === 'cr') continue;
            if (w === 'pin@') { estack.push({s: `(read pin ${popExpr().s})`}); continue; } // GPIO input reporter
            if (w === 'pin!') { // GPIO output: ( pin value -- ) drives 0x378+pin
                const val = popExpr();
                const pin = popExpr();
                const lvl = val.atom && val.s === '1' ? 'high'
                    : (val.atom && val.s === '0' ? 'low' : null);
                return [lvl ? `${pad(depth)}set pin ${pin.s} ${lvl}`
                    : `${pad(depth)}set pin ${pin.s} to ${val.s}`];
            }
            if (procNames.has(w)) return [`${pad(depth)}${w}`]; // a custom-block call
            if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(w)) { estack.push({s: w, atom: true}); continue; }
            if (w === '@') continue;
            if (w === 'not') { estack.push({s: `(not ${popExpr().s})`}); continue; }
            if (BIN[w]) {
                const b = popExpr(); const a = popExpr();
                estack.push({s: `(${a.s} ${BIN[w]} ${b.s})`});
                continue;
            }
            if (w === '.') {
                const v = popExpr();
                if (peek() && peek().t === 'word' && peek().v === 'cr') next();
                return [`${pad(depth)}say ${v.s}`];
            }
            if (w === 'if') return parseIf(popExpr(), depth);
            // otherwise a bare word: a variable read or write.
            const nxt = peek();
            if (nxt && nxt.t === 'word' && nxt.v === '@') {
                next();
                estack.push({s: rename(w)});
                globals.add(rename(w));
                continue;
            }
            if (nxt && nxt.t === 'word' && (nxt.v === '!' || nxt.v === '+!')) {
                const op = next().v;
                const target = rename(w);
                globals.add(target);
                const val = popExpr();
                return [op === '!' ? `${pad(depth)}set ${target} to ${val.s}`
                    : `${pad(depth)}change ${target} by ${val.s}`];
            }
            throw new ForthReadError(`line ${tk.line}: unexpected Forth word "${w}"`);
        }
    }

    // A `: word … ;` definition. `main` is the flag body; anything else is a
    // custom block.
    const parseDefinition = () => {
        next(); // consume ':'
        const nm = next();
        if (!nm || nm.t !== 'word') throw new ForthReadError(': without a name');
        const name = nm.v;
        if (name !== 'main') procNames.add(name);
        const lines = [];
        for (;;) {
            const t = peek();
            if (!t) throw new ForthReadError(`: ${name} without ;`);
            if (t.t === 'word' && t.v === ';') { next(); break; }
            const s = readStatement(1);
            if (s === null) { next(); continue; }
            lines.push(...s);
        }
        if (name === 'main') mainBody = lines;
        else procBlocks.push({name, lines});
    };

    // ---- top level: var decls, `: word … ;` defs, the `main` invocation -----
    while (pos < toks.length) {
        const tk = peek();
        if (tk.t === 'mark') { next(); continue; }
        if (tk.t === 'word' && tk.v === 'var') {
            next();
            const nm = next();
            if (!nm || nm.t !== 'word') throw new ForthReadError('variable without a name');
            if (!nm.v.startsWith('_')) globals.add(rename(nm.v)); // skip generator counter cells
            continue;
        }
        if (tk.t === 'word' && tk.v === ':') { parseDefinition(); continue; }
        if (tk.t === 'word' && tk.v === 'main' && mainBody) {
            next();
            startup.push(...mainBody);
            mainCalled = true;
            continue;
        }
        const before = pos;
        const s = readStatement(1);
        if (s === null) { const t = next(); warnings.push(`unexpected "${(t || {}).v}" at top level`); continue; }
        startup.push(...s);
        if (pos === before) next();
    }

    const lines = [];
    const globalLines = [...globals].sort().map(g => `GLOBAL ${g}`);
    if (globalLines.length) lines.push(...globalLines, '');
    for (const pb of procBlocks) lines.push(`DEFINE ${pb.name}:`, ...pb.lines, '');
    const realMain = mainCalled ? startup : [...startup, ...(mainBody || [])];
    if (realMain.length) lines.push('WHEN flag clicked:', ...realMain);
    if (!realMain.length && !procBlocks.length && String(source || '').trim()) {
        warnings.push('no Forth the blocks can represent was found');
    }
    return {pseudocode: `${lines.join('\n').replace(/\n+$/, '')}\n`, warnings};
}
