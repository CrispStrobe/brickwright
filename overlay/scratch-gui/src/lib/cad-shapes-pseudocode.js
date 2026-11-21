// SPDX-License-Identifier: BSD-3-Clause
// The Code tab's `cad …` modelling words (lib/cadShapesDialect.js), layered on the
// vendored compiler the way lib/robot-lab-pseudocode.js layers the `lab` words.
// Shapes are statements; transforms, groups, holes and `count with` are C-blocks
// whose header line ends in `:` (read through the compiler's parseBodyHeader door).
//
// Python and JavaScript (the Code tab's other languages): shapes are `_cadshapes.box(…)`
// calls; a C-block is `with _cadshapes.move(x, y, z):` in Python and
// `_cadshapes.move(x, y, z, () => { … });` in JavaScript, so the body stays a body.
// The readers below turn both back into the `cad …` words. The driver the code carries
// runs the description (each body once) and builds nothing: the model is built by the
// blocks (lib/bw-cad-blocks.js), and its real code is the CAD Script / OpenSCAD / JSCAD
// the CAD shapes "show code" view gives.
import {compileArcadeWord} from './arcadeDialect.js';
import {matchTopLevel} from './robot-lab-pseudocode.js';
import {CADSHAPES_WORDS, cadShapesWordFor, cadShapesWordsOf, isCadShapesLine} from './cadShapesDialect.js';
import {Translator} from './sb3-creator-python.js';

const SLOT = /\{(\w+)(?::([^}]*))?\}/g;
const slotsOf = entry => [...entry.words.matchAll(SLOT)].map(m => m[1]);
const methodOf = entry => entry.op.slice('cadshapes_'.length);

/** SB3Creator.RUNTIME_EXTENSIONS.cadshapes: `_cadshapes.<op>(slots in word order)`. */
export const CADSHAPES_RUNTIME = Object.freeze({
    runtime: 'cadshapes',
    ops: Object.fromEntries(CADSHAPES_WORDS.map(entry => [methodOf(entry), {
        kind: entry.kind === 'loop' ? 'command' : entry.kind, method: methodOf(entry), args: slotsOf(entry),
        ...(entry.kind === 'reporter' ? {neutral: '"not-open"'} : {})
    }]))
});

const BANNER = 'CAD shapes — this code describes a Brickwright CAD model; the stub runs each body once '
    + 'and builds nothing. The blocks build it; "Show CAD code" gives its CAD Script / OpenSCAD / JSCAD.';
const cadShapesDriver = (lang, async) => {
    const bodies = CADSHAPES_WORDS.filter(e => e.kind === 'loop').map(methodOf);
    const shapes = CADSHAPES_WORDS.filter(e => e.kind === 'command').map(methodOf);
    if (lang === 'py') {
        const df = async ? 'async def' : 'def';
        return [`# _cadshapes driver — ${BANNER}`,
            'class _CadshapesDriver:',
            '    class _Body:',
            '        def __enter__(self): return self',
            '        def __exit__(self, *a): return False',
            '    def _body(self, *a): return self._Body()',
            `    ${bodies.join(' = ')} = _body`,
            ...shapes.map(m => `    ${df} ${m}(self, *a): pass`),
            `    ${df} lastStatus(self, *a): return "not-open"`,
            '    def on(self, event, handler): pass',
            '_cadshapes = _CadshapesDriver()'];
    }
    // A C-block method runs its body (the last argument) once.
    return [`// _cadshapes driver — ${BANNER}`, 'const _cadshapes = {',
        `    body: (...a) => (typeof a[a.length - 1] === "function" ? a[a.length - 1]() : undefined),`,
        ...bodies.map(m => `    ${m}: (...a) => _cadshapes.body(...a),`),
        `    ${shapes.map(m => `${m}: () => {}`).join(', ')},`,
        '    lastStatus: () => "not-open", on: (event, handler) => {}', '};'];
};

// ---- readers: `_cadshapes.…` in Python/JavaScript back to `cad …` words ----------------

const asCad = node => {
    const n = node && node.type === 'Await' ? node.value : node;
    return n && n.type === 'Call' && n.func.type === 'Attribute' && n.func.value.type === 'Name' &&
        n.func.value.id === '_cadshapes' ? {method: n.func.attr, args: n.args} : null;
};
/** The `cad …` word of one call, or null when its method or arguments do not fit a word. */
const cadCallToWord = (translator, method, args) => {
    const entry = CADSHAPES_WORDS.find(e => methodOf(e) === method);
    if (!entry || args.length !== slotsOf(entry).length) return null;
    let i = 0, ok = true;
    const word = entry.words.replace(SLOT, (whole, name, kind) => {
        const node = args[i++];
        // A colour is a literal in the blocks (the colour picker), written bare: `cad color #ff0000`.
        if (!kind && node.type === 'Str' && /^#[0-9a-fA-F]{6}$/.test(node.value)) return node.value;
        if (!kind) return translator.expr(node);
        // A variable name or a fixed menu: only a string literal names it.
        if (node.type !== 'Str' || (kind !== 'name' && !kind.split('|').includes(node.value))) ok = false;
        return node.type === 'Str' ? node.value : '';
    });
    return ok ? {entry, word} : null;
};
const LIFT = Symbol.for('brickwright.cadShapesLift');
/** Teaches the shared Translator the `_cadshapes` calls and C-blocks, once (idempotent). */
export const installCadShapesReaders = () => {
    const proto = Translator.prototype;
    if (proto[LIFT]) return false;
    const {stmtCore, exprStmt, callExpr} = proto;
    const header = (translator, call, indent, body) => {
        const found = cadCallToWord(translator, call.method, call.args);
        if (!found || found.entry.kind !== 'loop') {
            translator.warn(`unknown _cadshapes.${call.method} body`);
            return [];
        }
        return [translator.pad(indent) + found.word + ':', ...translator.block(body, indent + 1)];
    };
    proto.stmtCore = function (s, indent) {
        const call = s && s.type === 'With' ? asCad(s.item) : null;
        if (call) return header(this, call, indent, s.body);
        return stmtCore.call(this, s, indent);
    };
    proto.exprStmt = function (e, indent) {
        const call = asCad(e);
        if (call) {
            const last = call.args[call.args.length - 1];
            if (last && last.type === 'ArrowBlock') return header(this, {method: call.method, args: call.args.slice(0, -1)}, indent, last.body);
            const found = cadCallToWord(this, call.method, call.args);
            if (found && found.entry.kind === 'command') return [this.pad(indent) + found.word];
            this.warn(`unknown _cadshapes.${call.method}`);
            return [];
        }
        return exprStmt.call(this, e, indent);
    };
    proto.callExpr = function (node) {
        const call = asCad(node);
        if (call) {
            const found = cadCallToWord(this, call.method, call.args);
            if (found && found.entry.kind === 'reporter') return `(${found.word})`;
            this.warn(`unknown _cadshapes.${call.method} in expression`);
            return '""';
        }
        return callExpr.call(this, node);
    };
    proto[LIFT] = true;
    return true;
};
installCadShapesReaders();

export function withCadShapes (Base) {
    return class CadShapesCreator extends Base {
        /** One `cad …` statement or C-block header (without its colon) as its block, or null. */
        parseCadShapesLine (line, target, kinds) {
            const text = String(line).trim();
            if (!isCadShapesLine(text)) return null;
            const context = {target, extraBlocks: {}, parentId: null};
            const read = s => {
                if (typeof this.refuseSpilledReporter === 'function') this.refuseSpilledReporter(text, s, target);
                return this.parseValue(s, context);
            };
            for (const entry of cadShapesWordsOf(kinds)) {
                const m = matchTopLevel(text, compileArcadeWord(entry).re);
                if (!m) continue;
                const {id, block} = this.createBlock(entry.op);
                context.parentId = id;
                const slots = this.arcadeSlots(entry, m, context, read);
                if (!slots) continue;
                Object.assign(block[id], slots);
                return {block, extraBlocks: context.extraBlocks};
            }
            return null;
        }

        parseCommand (line, target, allowLoop = false) {
            return this.parseCadShapesLine(line, target, ['command']) || super.parseCommand(line, target, allowLoop);
        }

        /** A C-block header such as `cad move x 10 y 0 z 0` (its colon already removed). */
        parseBodyHeader (header, target) {
            const own = this.parseCadShapesLine(header, target, ['loop']);
            if (own) return own;
            return typeof super.parseBodyHeader === 'function' ? super.parseBodyHeader(header, target) : null;
        }

        /** `cad model status`, read whole before the motor words (both start with `cad`). */
        parseReporter (s, context) {
            const text = String(s).trim();
            if (/^cad\s+model\s+status$/i.test(text)) {
                const id = this.pushBlock(context, 'cadshapes_lastStatus');
                return this.valueOfBlock(id);
            }
            return super.parseReporter(s, context);
        }

        drep (b, blocks) {
            const entry = b && cadShapesWordFor(b.opcode);
            if (entry && entry.kind === 'reporter') return this.spellArcade(entry, b, blocks);
            return super.drep(b, blocks);
        }

        /** `_cadshapes.<op>(args)` of a CAD shapes block, its runtime recorded as used. */
        cadShapesCall (b, blocks, valFn) {
            const op = this.runtimeOp(b.opcode);
            if (!this._runtimesUsed) this._runtimesUsed = new Set();
            this._runtimesUsed.add('cadshapes');
            return {method: op.method, args: (op.args || []).map(k => this.runtimeArg(b, k, blocks, valFn))};
        }

        pyStackBlock (b, blocks, level) {
            const entry = b && cadShapesWordFor(b.opcode);
            if (!entry || entry.kind !== 'loop') return super.pyStackBlock(b, blocks, level);
            const pad = '    '.repeat(level);
            const {method, args} = this.cadShapesCall(b, blocks, k => this.pyVal(b.inputs[k], blocks));
            const body = b.inputs.SUBSTACK ? this.pyStackFrom(b.inputs.SUBSTACK[1], blocks, level + 1) : [];
            const real = body.some(l => { const t = l.trim(); return t && !t.startsWith('#'); });
            return [`${pad}with _cadshapes.${method}(${args.join(', ')}):`, ...body, ...(real ? [] : [`${pad}    pass`])];
        }

        jsStackBlock (b, blocks, level) {
            const entry = b && cadShapesWordFor(b.opcode);
            if (!entry || entry.kind !== 'loop') return super.jsStackBlock(b, blocks, level);
            const pad = '  '.repeat(level);
            const {method, args} = this.cadShapesCall(b, blocks, k => this.jsVal(b.inputs[k], blocks));
            const body = b.inputs.SUBSTACK ? this.jsStackFrom(b.inputs.SUBSTACK[1], blocks, level + 1) : [];
            const fn = this._async ? 'async () => {' : '() => {';
            return [`${pad}${this._async ? 'await ' : ''}_cadshapes.${method}(${[...args, fn].join(', ')}`, ...body, `${pad}});`];
        }

        runtimeShim (extId, lang, mode = 'shim') {
            if (extId === 'cadshapes') return cadShapesDriver(lang, this._async);
            return super.runtimeShim(extId, lang, mode);
        }

        decompileStackBlock (b, blocks, level) {
            const entry = b && cadShapesWordFor(b.opcode);
            if (!entry) return super.decompileStackBlock(b, blocks, level);
            const pad = '  '.repeat(level);
            const words = this.spellArcade(entry, b, blocks);
            if (entry.kind !== 'loop') return [`${pad}${words}`];
            const body = b.inputs && b.inputs.SUBSTACK ? this.decompileStackFrom(b.inputs.SUBSTACK[1], blocks, level + 1) : [];
            return [`${pad}${words}:`, ...body];
        }
    };
}
