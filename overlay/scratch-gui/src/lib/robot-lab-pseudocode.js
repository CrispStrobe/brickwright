// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab's `lab` words, layered over the PINNED sb3-creator compiler
// (docs/SIM-LAB.md "Steering the Lab"; docs/ROBOT-LAB-HUBS-PLAN.md P1). The vendored
// files (sb3-creator.js, sb3-creator-python.js, sb3-creator-javascript.js) stay
// byte-identical to upstream at the pin (test/sb3-creator-vendor-identity.test.mjs);
// everything the Robot Lab adds comes through the two doors lite already has:
//
//   - the COMPILER: `withRobotLab(Base)`, a subclass handed out by the registering
//     door (sb3-creator-register-art.js, where the Peer Sessions words are layered the
//     same way): `lab …` commands and the `when lab …` hat before any generic rule,
//     `lab …` reporters before the vendored reporter rules, the decompiler's three
//     sites, the robotlab 'simulator' driver, and robotlab hats registered with their
//     own arguments (`_robotlab.on("robotlab_whenTouch", fn, "gear", "ground")`) in
//     Python/JS events mode; RUNTIME_EXTENSIONS.robotlab is set at the same door;
//   - the READERS: `readPython` / `readJavaScript` below, which the Code tab calls in
//     place of the vendored defaults. Both vendored readers translate with the ONE
//     shared Translator class (the JavaScript reader imports it from the Python one),
//     so the lift is installed on that class once, here: `_robotlab.<method>(…)` is
//     its `lab` word again, and `_robotlab.on(…)` names the function that is the
//     hat's script.
//
// The word table itself is robotLabDialect.js (one table for all of this).

import {CADLAB_RUNTIME, cadLabWordFor, cadLabWordsOf, cadLabCallToPseudo} from './cadLabDialect.js';
import MENU_ARGS from './extension-menu-table.js';
import pythonToPseudocode, {Translator} from './sb3-creator-python.js';
import javascriptToPseudocode from './sb3-creator-javascript.js';
import {compileArcadeWord} from './arcadeDialect.js';
import {ROBOTLAB_RUNTIME, robotLabWordFor, robotLabWordsOf, robotLabCallToPseudo} from './robotLabDialect.js';
// The LEGO hub words (`pup …`, `boost …`, `wedo …`: legopoweredup, legoboostunified, wedo2unified) ride the
// same door and the same machinery, from their own table (lib/legoHubsDialect.js).
import {legoHubWordFor, legoHubWordsOf, isLegoHubText} from './legoHubsDialect.js';
// Keep compiler acquisition at the registering door. Its Robot Lab layer is
// hoisted below; the registered class is used only when a reader handles a call.
import SB3Creator from './sb3-creator-register-art.js';

/** The `lab` words, then the LEGO hub words, of the given kinds (table order is precedence within each). */
const wordsOf = kinds => [...robotLabWordsOf(kinds), ...cadLabWordsOf(kinds), ...legoHubWordsOf(kinds)];
/** The entry for a robotlab or LEGO hub opcode, or null. */
const wordFor = opcode => robotLabWordFor(opcode) || cadLabWordFor(opcode) || legoHubWordFor(opcode);

// ---- top-level matching (the compiler's own masking rule, which it does not export) ----

/** The line with everything inside quotes and inner parentheses blanked, so literals only match at top level. */
const maskTopLevel = line => {
    let depth = 0;
    let inStr = false;
    let masked = '';
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inStr && ch === '\\' && i + 1 < line.length) { masked += '\u0001\u0001'; i++; continue; }
        if (ch === '"') { inStr = !inStr; masked += ch; continue; }
        if (!inStr && ch === '(') { depth++; masked += depth === 1 ? ch : '\u0001'; continue; }
        if (!inStr && ch === ')') { masked += depth === 1 ? ch : '\u0001'; depth = Math.max(0, depth - 1); continue; }
        masked += (inStr || depth > 0) ? '\u0001' : ch;
    }
    return masked;
};

/** A word's regex matched at top level; the groups are the ORIGINAL text's (as the compiler's matchTopLevel). */
export const matchTopLevel = (line, re) => {
    const rd = new RegExp(re.source, re.flags.includes('d') ? re.flags : `${re.flags}d`);
    const m = rd.exec(maskTopLevel(line));
    if (!m) return null;
    return m.indices.map(span => (span ? line.slice(span[0], span[1]) : undefined));
};

const isLabLine = text => /^(?:lab|cad|when\s+lab)\s/i.test(text) || isLegoHubText(text);

// ---- the compiler ------------------------------------------------------------------------

/**
 * The compiler with the Robot Lab's words.
 * @param {Function} Base the registered SB3Creator class
 * @returns {Function} its subclass
 */
export function withRobotLab (Base) {
    return class RobotLabCreator extends Base {
        /** A `lab …` statement or `WHEN lab …:` hat as its block, or null (the vendored rules then read the line). */
        parseLabCommand (line, target) {
            let text = String(line).trim();
            let hat = false;
            if (/^when\b/i.test(text)) {
                hat = /:\s*$/.test(text);
                text = text.replace(/\s*:\s*$/, '');
            }
            if (!isLabLine(text)) return null;
            const context = {target, extraBlocks: {}, parentId: null};
            const read = s => {
                // As the compiler's own statements: a reporter spread over the slots is refused by name.
                if (typeof this.refuseSpilledReporter === 'function') this.refuseSpilledReporter(text, s, target);
                return this.parseValue(s, context);
            };
            for (const entry of wordsOf(hat ? ['hat'] : ['command'])) {
                const m = matchTopLevel(text, compileArcadeWord(entry).re);
                if (!m) continue;
                const {id, block} = this.createBlock(entry.op, entry.kind === 'hat' ? {topLevel: true} : {});
                context.parentId = id;
                const slots = this.arcadeSlots(entry, m, context, read);
                if (!slots) continue;
                Object.assign(block[id], slots);
                return {block, extraBlocks: context.extraBlocks};
            }
            return null;
        }

        parseCommand (line, target, allowLoop = false) {
            return this.parseLabCommand(line, target) || super.parseCommand(line, target, allowLoop);
        }

        /** `lab …` reporters, read whole: they hold no operator of their own. */
        parseReporter (s, context) {
            const text = String(s).trim();
            if (/^(?:lab|cad)\s/i.test(text) || isLegoHubText(text)) {
                for (const entry of wordsOf(['reporter', 'boolean'])) {
                    const m = matchTopLevel(text, compileArcadeWord(entry).re);
                    if (!m) continue;
                    const id = this.pushBlock(context, entry.op);
                    const was = context.parentId;
                    context.parentId = id;
                    let slots;
                    try {
                        slots = this.arcadeSlots(entry, m, context, t => this.parseValue(t, context));
                    } finally {
                        context.parentId = was;
                    }
                    if (!slots) { delete context.extraBlocks[id]; continue; }
                    Object.assign(context.extraBlocks[id], slots);
                    return this.valueOfBlock(id);
                }
            }
            return super.parseReporter(s, context);
        }

        /** A hub Boolean word (`nxt touch sensor S1 pressed`) is a condition as it stands. */
        parseCondition (conditionStr, context) {
            const text = this.stripOuterParens(String(conditionStr || '').trim());
            if (isLegoHubText(text) && !/\s(?:and|or)\s|[<>=]/i.test(text)) {
                for (const entry of legoHubWordsOf(['boolean'])) {
                    if (matchTopLevel(text, compileArcadeWord(entry).re)) return this.parseReporter(text, context)[1];
                }
            }
            return super.parseCondition(conditionStr, context);
        }

        drep (b, blocks) {
            const entry = b && wordFor(b.opcode);
            if (entry && entry.kind !== 'command' && entry.kind !== 'hat') return this.spellArcade(entry, b, blocks);
            return super.drep(b, blocks);
        }

        decompileHat (b, blocks) {
            const entry = b && wordFor(b.opcode);
            if (entry && entry.kind === 'hat') return this.spellArcade(entry, b, blocks);
            return super.decompileHat(b, blocks);
        }

        decompileStackBlock (b, blocks, level) {
            const entry = b && wordFor(b.opcode);
            if (entry && entry.kind === 'command') return [`${'  '.repeat(level)}${this.spellArcade(entry, b, blocks)}`];
            return super.decompileStackBlock(b, blocks, level);
        }

        runtimeShim (extId, lang, mode = 'shim') {
            if (extId === 'cadlab' && mode === 'simulator') return cadLabSimulatorDriver(lang);
            if (extId === 'robotlab' && mode === 'simulator') return robotLabSimulatorDriver(lang);
            return super.runtimeShim(extId, lang, mode);
        }

        generatePython (project = this.project, opts = {}) {
            return this.withLabHatArguments(super.generatePython(project, opts), project, 'py');
        }

        generateJavaScript (project = this.project, opts = {}) {
            return this.withLabHatArguments(super.generateJavaScript(project, opts), project, 'js');
        }

        /**
         * Events mode writes a runtime hat as `_robotlab.on("robotlab_whenTouch", handler)`, which
         * loses the hat's own arguments (which part, touching what). They follow the handler here,
         * so the readers can rebuild the hat. The emitter registers hats in its walk's order —
         * the scripted targets in project order, each one's blocks in insertion order — and this
         * walks the same order, so the k-th registration is the k-th robotlab hat.
         */
        withLabHatArguments (code, project, lang) {
            if (typeof code !== 'string' || !code.includes('_robotlab.on(')) return code;
            const targets = (project && project.targets) || [];
            const hats = [];
            for (const t of targets.filter(x => !x.isStage || Object.values(x.blocks || {}).some(b => b.topLevel))) {
                for (const b of Object.values(t.blocks || {})) {
                    const entry = b.topLevel && robotLabWordFor(b.opcode);
                    if (entry && entry.kind === 'hat') hats.push({b, entry, blocks: t.blocks});
                }
            }
            let k = 0;
            return code.replace(/_robotlab\.on\(("robotlab_\w+"), (\w+)\)/g, (whole, opcode, fn) => {
                const hat = hats[k++];
                if (!hat || JSON.parse(opcode) !== hat.b.opcode) return whole;
                const val = key => (lang === 'py' ? this.pyVal(hat.b.inputs[key], hat.blocks) : this.jsVal(hat.b.inputs[key], hat.blocks));
                const args = hat.entry.args.map(key => this.runtimeArg(hat.b, key, hat.blocks, val));
                return `_robotlab.on(${[opcode, fn, ...args].join(', ')})`;
            });
        }
    };
}

/**
 * The robotlab 'simulator' driver: `_robotlab` IS the Robot Lab API (window.__bwSimLab.api)
 * when the program runs in the page beside an open Lab — every `_robotlab.<method>` of
 * RUNTIME_EXTENSIONS.robotlab is a method of that object, so nothing is translated. Elsewhere
 * (a Web Worker, Python's Skulpt) there is no Lab to reach: neutral, and it says how to run
 * the program in the Lab instead (⇦ To blocks, then the green flag).
 */
export const robotLabSimulatorDriver = lang => {
    const methods = [...new Map(Object.values(ROBOTLAB_RUNTIME.ops).map(op => [op.method, op])).values()];
    const neutralOf = op => (op.kind === 'reporter' ? (op.neutral || '0') : null);
    if (lang === 'py') {
        return [
            '# _robotlab driver — Python cannot reach the Robot Lab from the Code tab\'s console:',
            '# press ⇦ To blocks and run the blocks (green flag) to steer the Lab. Neutral here.',
            'class _RobotlabDriver:',
            ...methods.map(op => `    def ${op.method}(self, *a): return ${neutralOf(op) === null ? 'None' : neutralOf(op)}`),
            '    def on(self, *a): pass',
            '_robotlab = _RobotlabDriver()'
        ];
    }
    return [
        '// _robotlab driver — the Robot Lab API (window.__bwSimLab.api) while the Lab is open in this page;',
        '// neutral otherwise (a Web Worker has no Lab: press ⇦ To blocks and run the blocks instead).',
        'const _robotlab = (typeof globalThis !== "undefined" && globalThis.__bwSimLab && globalThis.__bwSimLab.api) || {',
        ...methods.map(op => `    ${op.method}: () => ${neutralOf(op) === null ? 'undefined' : neutralOf(op)},`),
        '    on: () => () => {},',
        '};'
    ];
};

/** The registry entry the door sets: SB3Creator.RUNTIME_EXTENSIONS.robotlab. */
export {ROBOTLAB_RUNTIME, CADLAB_RUNTIME};
export const cadLabSimulatorDriver = lang => {
    // The block VM is the execution host; generated scripts have the same fallback as Robot Lab.
    const lines = robotLabSimulatorDriver(lang).map(line => line.replaceAll('_robotlab', '_cadlab')
        .replaceAll('_RobotlabDriver', '_CadlabDriver').replaceAll('Robot Lab', 'CAD models')
        .replaceAll('globalThis.__bwSimLab && globalThis.__bwSimLab.api', 'globalThis.__bwCadProgramApi'));
    return lines;
};

// ---- the readers ---------------------------------------------------------------------------

const asLab = node => (node && node.type === 'Call' && node.func.type === 'Attribute' &&
    node.func.value.type === 'Name' && ['_robotlab', '_cadlab'].includes(node.func.value.id) ? {method: node.func.attr, args: node.args, cad: node.func.value.id === '_cadlab'} : null);

/** `_robotlab.on("robotlab_whenTouch", handler, part, other)` as {fn, header}, or null. */
const labRegistration = (translator, statement) => {
    const v = statement && statement.type === 'Expr' ? statement.value : null;
    const call = asLab(v);
    if (!call || call.method !== 'on' || call.args.length < 2 || call.args[1].type !== 'Name') return null;
    const opcode = String(translator.expr(call.args[0])).replace(/^"|"$/g, '');
    const entry = robotLabWordFor(opcode);
    const header = entry ? robotLabCallToPseudo(entry.method, call.args.slice(2).map(x => translator.expr(x)), {hat: true}) : null;
    return {fn: call.args[1].id, header};
};

// Reuse the compiler's registry and word spellings, including the unified SPIKE
// registry installed at the registering door. No second method/argument table.
const HUB_RUNTIMES = new Set(['spikeprime', 'ev3comprehensive', 'legopoweredup', 'legoboostunified', 'wedo2unified']);
const asHub = node => {
    if (node?.type !== 'Call' || node.func?.type !== 'Attribute' || node.func.value?.type !== 'Name') return null;
    const runtime = node.func.value.id.slice(1);
    return node.func.value.id.startsWith('_') && HUB_RUNTIMES.has(runtime) ?
        {runtime, method: node.func.attr, args: node.args, keywords: node.keywords} : null;
};

/** A registry call is admitted only if its word recompiles with every argument intact. */
const hubCallToPseudo = (translator, call, command) => {
    const reg = SB3Creator.RUNTIME_EXTENSIONS[call.runtime];
    const found = Object.entries(reg?.ops || {}).filter(([, op]) => op.method === call.method);
    if (found.length !== 1 || call.keywords?.length) return null;
    const [name, op] = found[0];
    if ((op.kind === 'command') !== command || !['command', 'reporter', 'boolean'].includes(op.kind) ||
        call.args.length !== (op.args || []).length) return null;
    const opcode = `${call.runtime}_${name}`;
    const args = call.args.map(arg => translator.expr(arg));
    const block = {opcode, inputs: {}, fields: {}};
    const blocks = {};
    for (const [i, key] of (op.args || []).entries()) {
        const text = args[i];
        const quoted = /^"(?:[^"\\]|\\.)*"$/.test(text);
        const numeric = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text);
        const menu = MENU_ARGS[opcode]?.[key];
        if (menu && !menu.startsWith('+') && !quoted && !numeric) return null;
        if (quoted || numeric) block.fields[key] = [quoted ? JSON.parse(text) : text, null];
        if (menu && quoted) {
            const field = menu.replace(/^\+/, '');
            blocks[key] = {opcode: `${call.runtime}_menu_${field}`, shadow: true, inputs: {},
                fields: {[field]: [JSON.parse(text), null]}};
            block.inputs[key] = [1, key];
        } else if (quoted || numeric) block.inputs[key] = [1, [quoted ? 10 : 4, quoted ? JSON.parse(text) : text]];
        else {
            blocks[key] = {opcode: 'argument_reporter_string_number', inputs: {}, fields: {VALUE: [text, null]}};
            block.inputs[key] = [1, key];
        }
    }
    const creator = new SB3Creator();
    const word = command ? creator.decompileStackBlock(block, blocks, 0).join('\n') : creator.drep(block, blocks);
    // Unsupported spellings, invalid fixed menus and dropped/changed arguments
    // are refused by name, rather than being accepted as a different program.
    try {
        const device = call.runtime === 'spikeprime' ? 'SPIKE' : call.runtime === 'ev3comprehensive' ? 'EV3' : null;
        creator.parse(`${device ? `DEVICE ${device}\n` : ''}WHEN flag clicked:\n  ${command ? word : `say (${word})`}\n`);
        const target = creator.project.targets.find(t => Object.values(t.blocks).some(b => b.opcode === opcode));
        const candidates = Object.values(target?.blocks || {}).filter(b => b.opcode === opcode);
        if (candidates.length !== 1) return null;
        const normalize = text => creator.stripOuterParens(String(text).trim());
        if (!(op.args || []).every((key, i) => normalize(creator.runtimeArg(candidates[0], key, target.blocks,
            k => creator.dval(candidates[0].inputs[k], target.blocks))) === normalize(args[i]))) return null;
    } catch { return null; }
    if (call.runtime === 'ev3comprehensive') translator.hubDevices.add('EV3');
    if (call.runtime === 'spikeprime') translator.hubDevices.add('SPIKE');
    return word;
};

const LIFT = Symbol.for('brickwright.robotLabLift');

/** Teaches the shared Translator the `_robotlab` calls, once (idempotent). */
export const installRobotLabReaders = () => {
    const proto = Translator.prototype;
    if (proto[LIFT]) return false;
    const {callExpr, exprStmt, program, resolveHat} = proto;
    proto.callExpr = function (node) {
        const hub = asHub(node);
        if (hub) {
            const word = hubCallToPseudo(this, hub, false);
            if (word) return `(${word})`;
            this.warn(`unsupported _${hub.runtime}.${hub.method} in expression`);
            return '""';
        }
        const call = asLab(node);
        if (call) {
            const word = (call.cad ? cadLabCallToPseudo : robotLabCallToPseudo)(call.method, call.args.map(x => this.expr(x)));
            if (word) return `(${word})`;
            this.warn(`unknown _robotlab.${call.method} in expression`);
            return '""';
        }
        return callExpr.call(this, node);
    };
    proto.exprStmt = function (eRaw, indent) {
        const e = eRaw && eRaw.type === 'Await' ? eRaw.value : eRaw;
        const hub = asHub(e);
        if (hub) {
            const word = hubCallToPseudo(this, hub, true);
            if (word) return [this.pad(indent) + word];
            this.warn(`unsupported _${hub.runtime}.${hub.method}`);
            return [];
        }
        const call = asLab(e);
        if (call) {
            const word = (call.cad ? cadLabCallToPseudo : robotLabCallToPseudo)(call.method, call.args.map(x => this.expr(x)));
            if (word) return [this.pad(indent) + word];
            this.warn(`unknown _robotlab.${call.method}`);
            return [];
        }
        return exprStmt.call(this, eRaw, indent);
    };
    // A plain Python or JavaScript file runs its statements in source order.
    // Code generated from Blocks already carries its own sections and hats.
    const startupStatements = new Set(['Assign', 'AugAssign', 'Del', 'Expr', 'If', 'While', 'For']);
    const nameStartupVariables = (translator, body) => {
        const names = new Set();
        const visit = node => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'Name') names.add(node.id);
            Object.values(node).forEach(visit);
        };
        visit(body);
        for (const name of ['x', 'y']) {
            if (!names.has(name)) continue;
            let replacement = `${name}_var`;
            while (names.has(replacement)) replacement += '_';
            translator.renameMap.set(name, replacement);
            translator.warn(`Variable "${name}" is named "${replacement}" in Blocks to distinguish it from the sprite coordinate.`);
        }
    };
    const startup = Symbol('startup');
    const block = proto.block;
    proto.block = function (statements, indent) {
        const lines = block.call(this, statements, indent);
        if (statements[startup] && !lines.length) this.emptyStartup = true;
        return lines;
    };
    proto.program = function (ast) {
        // The hats' registrations are read first (the emitter writes them after the handlers).
        this.labHats = new Map();
        this.hubDevices = new Set();
        const body = ast.body.filter(statement => {
            const hub = statement.type === 'Expr' && asHub(statement.value);
            if (hub) {
                this.warn(`unsupported top-level _${hub.runtime}.${hub.method}`);
                return false;
            }
            const reg = labRegistration(this, statement);
            if (!reg) return true;
            if (reg.header) this.labHats.set(reg.fn, reg.header);
            else this.warn('unknown Robot Lab event');
            return false;
        });
        const hasProjectStructure = body.some(s =>
            (s.type === 'Def' && this.resolveHat(s.name, s.args)) ||
            (s.type === 'Expr' && this.asScratch(s.value)) ||
            (s.type === 'Assign' && s.target.type === 'Name' && s.target.id === 'scratch'));
        const statements = hasProjectStructure ? [] : body.filter(s => startupStatements.has(s.type));
        let text;
        if (statements.length) {
            nameStartupVariables(this, body);
            statements[startup] = true;
            const definitions = body.filter(s => !startupStatements.has(s.type));
            text = program.call(this, {...ast, body: [...definitions,
                {type: 'Def', name: 'when_flag_clicked', args: [], body: statements}]});
            if (this.emptyStartup) {
                text = text.replace(/^[ \t]*WHEN flag clicked:\n[ \t]*say ""\n/m, '');
                if (/^SPRITE Main:\s*$/.test(text)) return '\n';
            }
        } else text = program.call(this, {...ast, body});
        // Native hub words require their DEVICE context. The runtime emitter
        // names the extension but does not emit a scratch.device marker.
        const declared = /^DEVICE\s+(\S+)/m.exec(text)?.[1].toUpperCase();
        const devices = [...this.hubDevices];
        if (devices.length > 1 || (declared && devices.length && devices[0] !== declared)) {
            this.warn(`incompatible hub DEVICE contexts: ${[declared, ...devices].filter(Boolean).join(', ')}`);
            return '\n';
        }
        return devices.length && !declared ? `DEVICE ${devices[0]}\n${text}` : text;
    };
    proto.resolveHat = function (name, args) {
        return (this.labHats && this.labHats.get(name)) || resolveHat.call(this, name, args);
    };
    proto[LIFT] = true;
    return true;
};
installRobotLabReaders();

/** The Code tab's Python reader: the vendored one, with the Robot Lab lift installed. */
export const readPython = source => pythonToPseudocode(source);

/** The Code tab's JavaScript reader: the vendored one, with the Robot Lab lift installed. */
export const readJavaScript = source => javascriptToPseudocode(source);
