/**
 * Member access in the shared MakeCode importer base (task E14 of
 * docs/OPEN-TASKS-2026-09-29.md, found by E13): translate-base.js, which the
 * micro:bit, EV3 and Arcade importers share.
 *
 * A member no rule knew was returned as its BARE NAME: `s.length` on a
 * `s: string` parameter became the variable `length`, `Math.E` the variable
 * `E`, a property of a class that is not translated (`message.kind = 1`) the
 * variable `kind` — all of which hold 0 and read as a working program. Now:
 *
 *  - every member the dialect has a word for is translated: `.length` of a
 *    text (declared `: string` too, by scope — E12's stringTypedReferences —
 *    and a record field declared `: string`), `s.charAt(i)` and `s[i]`
 *    (`letter i + 1 of s`), `s.concat(t)` (`join`), Math's constants,
 *    arrays' `_pickRandom()` and `unshift(v)`;
 *  - every other member is refused BY NAME, read or written, and never
 *    resolved as a variable (`unknownMember`, `memberTarget`).
 *
 * The rest of MakeCode's text API has no dialect word and was, and stays,
 * refused by name: substr, substring, slice, indexOf, includes (Scratch's
 * `contains` ignores case), split, toUpperCase, toLowerCase, trim, isEmpty,
 * compare, replace, charCodeAt, String.fromCharCode, parseInt (and a
 * number's toString(): Arcade's sprite text pins it refused).
 *
 * Measured three ways — the original in pxt's simulator, the import in
 * Lite's VM, the re-export in the simulator again — for micro:bit, EV3
 * (pxt-ev3 compiles original and re-export, which uses no EV3 API and runs
 * in the micro:bit simulator) and Arcade (pxt-arcade 4.2.1, E9/E10's
 * harness). And over MakeCode's own programs: no property the source reads
 * may come out as a variable of the compiled project.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import util from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {SOURCE, INTEGRATED} from './helpers/bw-integrated.mjs';
import {microbitToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/microbit-translate.js';
import {ev3ToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/ev3-translate.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {exportToMakeCode} from '../overlay/scratch-gui/src/lib/bw-makecode/export.js';
import {exportToMakeCodeEv3} from '../overlay/scratch-gui/src/lib/bw-makecode/export-ev3.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {PXT_GLUE_JS} from '../overlay/scratch-gui/src/lib/bw-makecode/pxt-runtime.js';
import {compileMakeCode, runMakeCodeSim, makeCodeSimAvailable} from '../scripts/lib/makecode-sim.mjs';
import {arcadeSimAvailable, compileArcade, runArcadeSim} from '../scripts/lib/makecode-arcade-sim.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAN_RUN = fs.existsSync(path.join(INTEGRATED, 'node_modules', 'scratch-vm', 'src', 'index.js')) &&
    fs.existsSync(path.join(SOURCE, 'src', 'lib', 'sb3-creator.js'));
const {runProgram, SB3Creator} = CAN_RUN ? await import('./helpers/bw-vm.mjs') : {};
const SKIP_VM = CAN_RUN ? false : 'needs the integrated tree and its scratch-vm — run `npm run integrate` and install';
const SKIP_SIM = SKIP_VM || (makeCodeSimAvailable() ? false : 'MakeCode runtime not synced (npm run sync:makecode)');
const EV3_DIR = path.join(ROOT, 'packages/scratch-gui/static/makecode/ev3');
const SKIP_EV3 = SKIP_SIM || (fs.existsSync(path.join(EV3_DIR, 'pxtworker.js')) ? false : 'pxt-ev3 not synced (npm run sync:makecode)');
const SKIP_ARCADE = SKIP_VM || (arcadeSimAvailable() ? false : 'MakeCode runtime not synced (npm run sync:makecode)');

const TARGETS = {'micro:bit': microbitToPseudocode, EV3: ev3ToPseudocode, Arcade: src => arcadeToPseudocode(src)};
// Arcade reads a parameter through `arcade local p`.
const ref = (target, name) => (target === 'Arcade' ? `\\(arcade local ${name}\\)` : name);

// ── per member: the dialect word ────────────────────────────────────────
const inFunction = body => `let r: any = 0\nfunction d(s: string) {\n    r = ${body}\n}\nd("abc")\n`;
const TRANSLATED = [
    // [what, source, expected line (s, i: the parameters, as ref() writes them)]
    ['s.length on a string parameter', inFunction('s.length'), s => `set r to length of ${s}`],
    ['s.charAt(i) on a string parameter', inFunction('s.charAt(1)'), s => `set r to letter 2 of ${s}`],
    ['s.charAt() with no index', inFunction('s.charAt()'), s => `set r to letter 1 of ${s}`],
    ['s.charAt(i - 1), the export\'s spelling of letter i', 'let r: any = 0\nfunction d(s: string, i: number) {\n    r = s.charAt(i - 1)\n}\nd("abc", 2)\n',
        (s, i) => `set r to letter ${i} of ${s}`],
    ['s[i] on a string parameter', inFunction('s[1]'), s => `set r to letter 2 of ${s}`],
    ['s.concat(t) on a string parameter', inFunction('s.concat("x")'), s => `set r to \\(?${s} join "x"\\)?`],
    ['s.concat(t).length', inFunction('s.concat("x").length'), s => `set r to length of \\(\\(?${s} join "x"\\)?\\)`]
];
for (const [target, translate] of Object.entries(TARGETS)) {
    for (const [what, src, line] of TRANSLATED) {
        test(`${target}: ${what} is its dialect word`, () => {
            const {code, unsupported} = translate(src);
            assert.deepEqual(unsupported, [], code);
            const arcadeConcat = `concatenate text ${ref(target, 's')} with \\("x"\\)`;
            const expected = target === 'Arcade' && what.startsWith('s.concat') ?
                (what.endsWith('.length') ? `set r to length of \\(${arcadeConcat}\\)` : `set r to ${arcadeConcat}`) :
                line(ref(target, 's'), ref(target, 'i'));
            // Arcade value assignments wrap the reporter, not the command.
            const assignment = target === 'Arcade' ?
                `set r to \\(?${expected.slice('set r to '.length)}\\)?` : expected;
            assert.match(code, new RegExp(`^\\s*${assignment}$`, 'm'), code);
        });
    }
}

test('a local or declared text, and a record field declared `: string`, have a length too', () => {
    for (const src of ['let s = "abc"\nlet r = s.length\n', 'let s: string = null\ns = "abc"\nlet r = s.length\n']) {
        const {code, unsupported} = microbitToPseudocode(src);
        assert.deepEqual(unsupported, []);
        assert.match(code, /set r to length of s$/m);
    }
    const {code, unsupported} = microbitToPseudocode('interface Pet { name: string; age: number }\n' +
        'let pet: Pet = { name: "abc", age: 2 }\nlet r = pet.name.length\nlet q = pet.name.charAt(0)\n');
    assert.deepEqual(unsupported, []);
    assert.match(code, /set r to length of \(item pet of array "Pet_name"\)$/m);
    assert.match(code, /set q to letter 1 of \(item pet of array "Pet_name"\)$/m);
});

test('Math\'s constants are their numbers, not variables named E, SQRT2, …', () => {
    const names = ['PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2'];
    for (const [target, translate] of Object.entries(TARGETS)) {
        const {code, unsupported} = translate(names.map((n, i) => `let c${i} = Math.${n}`).join('\n'));
        assert.deepEqual(unsupported, [], target);
        names.forEach((n, i) => {
            const value = n === 'PI' && target !== 'Arcade' ? '3.14159' : String(Math[n]);
            assert.match(code, new RegExp(`set c${i} to \\(?${value.replace('.', '\\.')}\\)?$`, 'm'), `${target} Math.${n}\n${code}`);
        });
    }
});

test('arrays: _pickRandom() and unshift(v) are the arrays words', () => {
    for (const translate of [microbitToPseudocode, ev3ToPseudocode]) {
        const {code, unsupported} = translate('let a = [1, 2]\nlet r = a._pickRandom()\na.unshift(7)\n');
        assert.deepEqual(unsupported, []);
        assert.match(code, /set r to item \(pick random 0 to \(length of array "a"\) - 1\) of array "a"$/m);
        assert.match(code, /^\s*insert 7 at 0 of array "a"$/m);
    }
});

// A Buffer's `.length` is its own word on micro:bit, not a refusal.
test('micro:bit Buffer length reads as the buffer-length word', () => {
    const {code, unsupported} = microbitToPseudocode('let b = serial.readBuffer(0)\nlet r = b.length\n');
    assert.deepEqual(unsupported, []);
    assert.match(code, /set r to length of buffer b$/m);
});

// ── everything else: refused by name, never a variable ─────────────────
const REFUSED = [
    // [source, the refusal names this, a member name that must not be a variable]
    ...['substr(1, 2)', 'substring(1, 2)', 'slice(1, 2)', 'indexOf("b")', 'includes("b")', 'split(",")', 'toUpperCase()',
        'toLowerCase()', 'trim()', 'isEmpty()', 'compare("b")', 'replace("a", "b")', 'charCodeAt(1)']
        .map(call => [inFunction(`s.${call}`), `s.${call.replace(/\(.*/, '')}()`, call.replace(/\(.*/, '')]),
    [inFunction('String.fromCharCode(65)'), 'String.fromCharCode()', 'fromCharCode'],
    // `.length` of a value no rule knows the type of: an untyped parameter. (A Buffer's
    // length is a word now — `length of buffer` — so it is no longer refused.)
    ['let r = 0\nfunction d(v: any) {\n    r = v.length\n}\nd(1)\n', 'v.length — not known to be a text or an array', 'length'],
    // Any other property of a value of no known type.
    ['let r = 0\nfunction d(v: any) {\n    r = v.size + v.width\n}\nd(1)\n', 'v.size — a property this importer has no word for', 'size'],
    // A class the importer refuses (a heritage clause; accessors are lowered now): its properties, read and written.
    ['class B {\n    x = 1\n}\nclass M extends Elsewhere {\n    _k: number\n    get kind() { return this._k }\n    set kind(v: number) { this._k = v }\n}\n' +
        'let m = new M()\nm.kind = 3\nlet r = m.kind\n', 'm.kind = … — a property this importer cannot write', 'kind'],
    ['class B {\n    x = 1\n}\nclass M extends Elsewhere {\n    _k: number\n    get kind() { return this._k }\n}\nlet m = new M()\nlet r = m.kind\n', 'm.kind — a property this importer has no word for', 'kind'],
    ['class B {\n    x = 1\n}\nclass M extends Elsewhere {\n    _k: number\n    get kind() { return this._k }\n}\nlet m = new M()\nm.kind++\n', 'm.kind++ — a property this importer cannot write', 'kind']
];
for (const [src, why, member] of REFUSED) {
    test(`refused by name, not a variable: ${why}`, () => {
        for (const [target, translate] of Object.entries(TARGETS)) {
            if (target === 'Arcade' && /serial\.|class /.test(src)) continue;
            const {code, unsupported} = translate(src);
            if (target === 'Arcade' && why === 's.compare()') {
                assert.deepEqual(unsupported, [], code);
                assert.match(code, /_mcCompareLeft\d+/);
                assert.match(code, /compare value .* op "<" with/);
                const opaqueSource=src.replace('d("abc")','d(unknown)');
                assert.notEqual(opaqueSource,src,'the negative changes the actual argument producer');
                const opaque=translate(opaqueSource);
                assert.ok(opaque.unsupported.length>0, 'unknown input remains refused');
                continue;
            }
            if (target === 'Arcade' && ['s.charCodeAt()', 'String.fromCharCode()'].includes(why)) {
                assert.deepEqual(unsupported, [], code);
                assert.match(code, why === 's.charCodeAt()' ? /char code of text \(arcade local s\) at/ : /text from char code/);
                continue;
            }
            // The micro:bit has words for char codes (char code of … at …, char from code …).
            if (target === 'micro:bit' && ['s.charCodeAt()', 'String.fromCharCode()'].includes(why)) {
                assert.deepEqual(unsupported, [], code);
                assert.match(code, why === 's.charCodeAt()' ? /char code of .* at/ : /char from code/);
                continue;
            }
            assert.ok(unsupported.some(u => u.includes(why)), `${target}: ${JSON.stringify(unsupported)}\n${code}`);
            const lines = code.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
            assert.doesNotMatch(lines, new RegExp(`(^|[\\s(])${member}($|[\\s)])`, 'm'), `${target}: ${member} as a name\n${code}`);
        }
    });
}

test('a refused member names the calls inside it, so the census does not count them lost', () => {
    const cls = 'class B {\n    x = 1\n}\nclass M extends Elsewhere {\n    _k: number\n    get kind() { return this._k }\n    set kind(v: number) { this._k = v }\n}\n';
    const write = microbitToPseudocode(`${cls}let m = new M()\nm.kind = control.deviceSerialNumber()\n`).unsupported;
    assert.ok(write.some(u => u.startsWith('m.kind = …') && u.endsWith('it calls control.deviceSerialNumber()')), JSON.stringify(write));
    const read = microbitToPseudocode('let a = [1]\nlet r = a[input.lightLevel()].kind\n').unsupported;
    assert.ok(read.some(u => /kind — a property .* it calls input\.lightLevel\(\)$/.test(u)), JSON.stringify(read));
});

// ── no silent fallback: a property the source reads is never a variable ─
/** The property names a program reads or writes that it never declares as a name of its own. */
function propertiesOnly (ast) {
    const props = new Set();
    const ids = new Set();
    const walk = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.type === 'Member') props.add(n.name);
        if (n.type === 'Identifier') ids.add(n.name);
        if (n.type === 'Declaration') for (const d of n.decls || []) ids.add(d.name);
        for (const p of n.params || []) ids.add(typeof p === 'string' ? p : p.name);
        if (['ForOf', 'FunctionDeclaration', 'Class', 'Enum', 'Interface'].includes(n.type)) ids.add(n.name);
        for (const f of n.fields || []) ids.add(f.name);
        for (const p of n.props || []) ids.add(p.key);
        for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
    };
    walk(ast);
    return [...props].filter(p => !ids.has(p));
}
/** Programs whose compiled project holds a VARIABLE named after such a property: a member read as a name. */
function propertiesAsVariables (programs, translate) {
    const found = [];
    let checked = 0;
    for (const p of programs) {
        let suspects;
        let out;
        try {
            suspects = propertiesOnly(parseMakeCodeTs(p.ts));
            if (!suspects.length) continue;
            out = translate(p);
        } catch (e) {
            continue;
        }
        const creator = new SB3Creator();
        try {
            creator.parse(out.code);
        } catch (e) {
            continue;
        }
        checked++;
        const vars = new Set(creator.project.targets.flatMap(t => Object.values(t.variables || {}).map(v => v[0])));
        const bad = suspects.filter(s => vars.has(s));
        if (bad.length) found.push(`${p.id}: ${bad.join(', ')}`);
    }
    return {checked, found};
}

test('no member of the probe matrix comes out as a variable', {skip: SKIP_VM}, () => {
    const receivers = {
        'string parameter': e => `let r: any = 0\nfunction d(s: string) {\n    r = ${e}\n}\nd("abc")\n`,
        'text local': e => `let s = "abc"\nlet r: any = 0\nr = ${e}\n`,
        'number local': e => `let s = 7\nlet r: any = 0\nr = ${e}\n`,
        'untyped parameter': e => `let r: any = 0\nfunction d(s: any) {\n    r = ${e}\n}\nd(1)\n`
    };
    const members = ['length', 'charAt(1)', 'charCodeAt(1)', 'substr(1, 2)', 'indexOf("b")', 'includes("b")', 'split(",")',
        'toUpperCase()', 'isEmpty()', 'compare("b")', 'concat("x")', 'width', 'kind'];
    const programs = [];
    for (const [where, make] of Object.entries(receivers)) {
        for (const m of members) programs.push({id: `${where}: s.${m}`, ts: make(`s.${m}`)});
    }
    for (const n of ['E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2', 'PI']) programs.push({id: `Math.${n}`, ts: `let r = Math.${n}\n`});
    for (const [target, translate] of Object.entries(TARGETS)) {
        const {checked, found} = propertiesAsVariables(programs, p => translate(p.ts));
        assert.equal(checked, programs.length, target);
        assert.deepEqual(found, [], target);
    }
});

test('Arcade import corpus (E9\'s 433 inputs): no property comes out as a variable', {skip: SKIP_VM}, () => {
    const corpus = JSON.parse(fs.readFileSync(new URL('./fixtures/makecode/arcade-import-inputs.json', import.meta.url), 'utf8'));
    const programs = corpus.inputs.map((input, k) => ({id: `${input.test}#${k}`, files: corpus.sources[input.files], opts: input.opts,
        ts: typeof corpus.sources[input.files] === 'string' ? corpus.sources[input.files] : corpus.sources[input.files]['main.ts'] || ''}));
    const {checked, found} = propertiesAsVariables(programs, p => arcadeToPseudocode(p.files, p.opts));
    // Before E14: makecode-arcade-created-registration#83, `Player` (SpriteKind.Player as a value).
    assert.ok(checked > 300, `checked ${checked}`);
    assert.deepEqual(found, []);
});

/** Every ```blocks/```typescript program of a pinned pxt target's docs (the MakeCode census's inputs, --snippets). */
async function docsPrograms (tgz) {
    const {untar, CACHE_DIR} = await import(pathToFileURL(path.join(ROOT, 'scripts/sync-makecode-runtime.mjs')).href);
    const file = path.join(CACHE_DIR, tgz);
    if (!fs.existsSync(file)) return null;
    const programs = [];
    const seen = new Set();
    for (const [name, bytes] of [...untar(fs.readFileSync(file)).entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (!name.startsWith('docs/') || !name.endsWith('.md')) continue;
        [...bytes.toString('utf8').matchAll(/```(blocks|typescript|block)\n([\s\S]*?)```/g)].forEach((m, i) => {
            const key = m[2].replace(/\s+/g, ' ').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            programs.push({id: `${name.replace(/^docs\//, '').replace(/\.md$/, '')}#${i}`, ts: m[2]});
        });
    }
    return programs;
}

test('MakeCode\'s micro:bit and EV3 docs: no property comes out as a variable', {skip: SKIP_SIM, timeout: 300000}, async () => {
    const microbit = await docsPrograms('pxt-microbit-9.1.1.tgz');
    const ev3 = await docsPrograms('pxt-ev3-1.4.41.tgz');
    assert.ok(microbit && ev3, 'the pinned pxt-microbit / pxt-ev3 tarballs (npm run sync:makecode)');
    // Before E14 (1057 checked): projects/infection#0 kind, value, toSerialNumber,
    // fromSerialNumber (a class with accessors); reference/math/constant E, LN2,
    // LN10, SQRT1_2, SQRT2; reference/serial/read-buffer `length` (a Buffer's).
    const mb = propertiesAsVariables(microbit, p => microbitToPseudocode(p.ts));
    assert.ok(mb.checked > 1000, `checked ${mb.checked}`);
    assert.deepEqual(mb.found, []);
    const e = propertiesAsVariables(ev3, p => ev3ToPseudocode(p.ts));
    assert.ok(e.checked > 200, `checked ${e.checked}`);
    assert.deepEqual(e.found, []);
});

// ── behaviour, three ways ───────────────────────────────────────────────
const N = 13;
const READINGS = `${Array.from({length: N}, (_, i) => `let r${i + 1} = 0`).join('\n')}
function len(s: string): number { return s.length }
function atIs(s: string, i: number, c: string): number { if (s.charAt(i) == c) { return 1 } return 2 }
function idxIs(s: string, i: number, c: string): number { if (s[i] == c) { return 1 } return 2 }
function catLen(s: string, t: string): number { return s.concat(t).length }
function catIs(s: string, t: string, c: string): number { if (s.concat(t) == c) { return 1 } return 2 }
function lastIs(s: string, c: string): number { if (s.charAt(s.length - 1) == c) { return 1 } return 2 }
let a = [1, 2]
let one = [5]
r1 = len("hello")
r2 = len("")
r3 = atIs("hello", 1, "e")
r4 = atIs("hello", 9, "")
r5 = idxIs("hello", 4, "o")
r6 = catLen("ab", "cde")
r7 = catIs("ab", "c", "abc")
r8 = lastIs("xyz", "z")
r9 = Math.round(Math.E * 1000)
r10 = Math.round(Math.SQRT2 * 1000)
a.unshift(7)
r11 = a[0] * 10 + a.length
r12 = one._pickRandom()
r13 = len("0")
`;
// pxt-microbit 9.1.1's simulator, measured on READINGS (2026-10-14).
const MAKECODE = [5, 0, 1, 1, 1, 5, 1, 1, 2718, 1414, 73, 5, 1];
// Before E14, Lite's VM (micro:bit and EV3 alike): 13 of 13 wrong, and pxt
// refused the re-export (`s == c` with the parameter typed by a 0).
const BEFORE = [0, 0, 2, 2, 2, 1, 2, 2, 0, 0, 12, 0, 0];
const PRINT = Array.from({length: N}, (_, i) => `serial.writeValue("r${i + 1}", r${i + 1})`).join('\n') + '\n';
const readings = run => {
    const by = {};
    for (const target of run.vm.runtime.targets) {
        for (const v of Object.values(target.variables || {})) if (/^r\d+$/.test(v.name)) by[v.name] = Number(v.value);
    }
    return MAKECODE.map((_, i) => by[`r${i + 1}`]);
};
async function simReadings (ts) {
    const run = await runMakeCodeSim(await compileMakeCode(ts), {ms: 1000});
    assert.equal(run.error, null);
    const by = {};
    for (const line of run.serial) {
        const m = /^(r\d+):(-?\d+)/.exec(line.text.trim());
        if (m) by[m[1]] = Number(m[2]);
    }
    return MAKECODE.map((_, i) => by[`r${i + 1}`]);
}

for (const [name, translate] of [['micro:bit', src => microbitToPseudocode(src + PRINT)], ['EV3', src => ev3ToPseudocode(src)]]) {
    test(`${name}: Lite's VM reads the members as MakeCode does`, {skip: SKIP_VM}, async () => {
        const imported = translate(READINGS);
        assert.deepEqual(imported.unsupported, []);
        const run = await runProgram(imported.code, {frames: 30});
        assert.deepEqual(run.errors, []);
        assert.deepEqual(readings(run), MAKECODE, `before E14 this read ${BEFORE.join(' ')}`);
    });
}

test('micro:bit: the original and the re-export read the same in pxt-microbit\'s simulator', {skip: SKIP_SIM, timeout: 300000}, async () => {
    assert.deepEqual(await simReadings(READINGS + PRINT), MAKECODE);
    const run = await runProgram(microbitToPseudocode(READINGS + PRINT).code, {frames: 30});
    const ex = exportToMakeCode(run.creator.project);
    assert.deepEqual(ex.unsupported, []);
    assert.deepEqual(await simReadings(ex.ts), MAKECODE);
});

let ev3Sandbox = null;
async function compileEv3 (ts) {
    if (!ev3Sandbox) {
        const quiet = () => {};
        const e = {setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate,
            TextEncoder: util.TextEncoder, TextDecoder: util.TextDecoder, Buffer,
            console: {log: quiet, debug: quiet, info: quiet, warn: quiet, error: quiet},
            pxtTargetBundle: JSON.parse(fs.readFileSync(path.join(EV3_DIR, 'target.json'), 'utf8'))};
        e.global = e;
        e.self = e;
        e.eval = src => vm.runInContext(src, e, {filename: 'eval'});
        vm.createContext(e, {codeGeneration: {strings: false, wasm: false}});
        vm.runInContext(fs.readFileSync(path.join(EV3_DIR, 'pxtworker.js'), 'utf8'), e, {filename: 'pxtworker.js'});
        vm.runInContext(PXT_GLUE_JS, e, {filename: 'pxt-glue.js'});
        ev3Sandbox = e;
    }
    const files = {'pxt.json': JSON.stringify({name: 't', dependencies: {ev3: '*'}, files: ['main.ts']}), 'main.ts': ts};
    return JSON.parse(JSON.stringify(await ev3Sandbox.bwMakeCode.compile(files, {})));
}

test('EV3: pxt-ev3 compiles the original and the re-export, which reads as MakeCode does', {skip: SKIP_EV3, timeout: 300000}, async () => {
    assert.equal((await compileEv3(READINGS)).success, true);
    const run = await runProgram(ev3ToPseudocode(READINGS).code, {frames: 30});
    const ex = exportToMakeCodeEv3(run.creator.project);
    assert.deepEqual(ex.unsupported, []);
    const compiled = await compileEv3(ex.ts);
    assert.equal(compiled.success, true, JSON.stringify((compiled.diagnostics || []).slice(0, 3)));
    // No EV3 API in it: pxt-core's semantics, run in the micro:bit simulator.
    assert.deepEqual(await simReadings(`${ex.ts}\n${PRINT}`), MAKECODE);
});

// Arcade (fixed-sprite path: no sprites), logged with console.log.
const ARCADE_FUNCTIONS = {
    len: 'function len(s: string) { return s.length }',
    atIs: 'function atIs(s: string, i: number, c: string) { if (s.charAt(i) == c) { return 1 } return 2 }',
    idxIs: 'function idxIs(s: string, i: number, c: string) { if (s[i] == c) { return 1 } return 2 }',
    catLen: 'function catLen(s: string, t: string) { return s.concat(t).length }'
};
const ARCADE_LINES = [
    ['len("hello")', '5'], ['len("")', '0'], ['atIs("hello", 1, "e")', '1'], ['atIs("hello", 9, "")', '1'],
    ['idxIs("hello", 4, "o")', '1'], ['catLen("ab", "cde")', '5'], ['catLen("", "0")', '1'],
    ['Math.round(Math.E * 1000)', '2718'], ['Math.round(Math.SQRT2 * 1000)', '1414']
];
const arcadeSource = lines => [...new Set(lines.flatMap(([e]) => Object.keys(ARCADE_FUNCTIONS).filter(f => e.startsWith(`${f}(`))))]
    .map(f => ARCADE_FUNCTIONS[f]).concat(lines.map(([e]) => `console.log(${e})`)).join('\n') + '\n';
const arcadeLog = async files => {
    const run = await runArcadeSim(await compileArcade(files), {ms: 500});
    assert.equal(run.error ?? null, null);
    return run.serial.map(line => line.text).join('');
};
async function arcadeImport (source) {
    const imported = arcadeToPseudocode(source);
    assert.doesNotMatch(imported.code, /arcade create template/, 'the fixed-sprite path');
    assert.deepEqual(imported.unsupported, []);
    const creator = new SB3Creator();
    creator.parse(imported.code);
    assert.deepEqual(creator.warnings, []);
    const run = await runProgram(imported.code, {frames: 6});
    assert.deepEqual(run.errors, []);
    return {creator, lite: (run.vm.runtime.bwArcadeDeviceState?.serial ?? '').replace(/\n/g, '')};
}

test('Arcade: pxt-arcade and Lite\'s VM log the same', {skip: SKIP_ARCADE, timeout: 300000}, async () => {
    const source = arcadeSource(ARCADE_LINES);
    const expected = ARCADE_LINES.map(([, v]) => v).join('');
    // Before E14 Lite logged 0 0 2 2 2 1 2 0 0, with charAt/[]/concat refused.
    assert.equal(await arcadeLog(source), expected);
    assert.equal((await arcadeImport(source)).lite, expected);
});

test('Arcade: the export of every member logs the same in pxt-arcade', {skip: SKIP_ARCADE, timeout: 300000}, async () => {
    // Until E17 export-arcade.js refused `letter of` (operator_letter_of as a
    // value), so charAt/[] were left out here; now every line goes out.
    const lines = ARCADE_LINES;
    const {creator, lite} = await arcadeImport(arcadeSource(lines));
    const ex = projectToArcade(creator.project);
    assert.deepEqual(ex.unsupported, []);
    assert.equal(lite, lines.map(([, v]) => v).join(''));
    assert.equal(await arcadeLog(ex.files), lite);
});
