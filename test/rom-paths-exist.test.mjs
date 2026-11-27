// Every `static/roms/<file>` a source file fetches must actually be there.
//
// WHY THIS EXISTS: debug-runner.js's 8086 branch fetched `bios8086.bin`, a
// name that has never existed in static/roms. It 404ed on every run from the
// day it was written and nothing noticed, because nothing REACHED it — the
// tests construct a machine directly, and the Machine Loader always supplies
// media, so the no-media fallback is the one path a user hits and a suite does
// not. The eighth instance of this lane's recurring defect: a path nothing
// drives is a path nothing tests, and it looks identical to a working one.
//
// A unit test for that branch would not have helped, because the branch is
// correct — it fetches a URL and throws on failure, exactly as intended. What
// was wrong was a STRING, and the only thing that can check a string against
// the filesystem is a check that reads both.
//
// WIDENED 2026-09-07 (lego-ac, from ea's P6 measurement): the first version
// matched only the literal `static/roms/NAME`, and the Machine Loader builds
// `static/roms/${p.rom}` from a PRESET LIST — seven i8086 presets pointed at
// ROMs that were never vendored, the shipped UI 404ed on each, and the gate
// written for exactly that failure could not see them because no line spelled
// the name beside the prefix. The census now also reads:
//   - template literals  `static/roms/${expr}`
//   - concatenation      'static/roms/' + expr
//   - path joins         join(..., 'static', 'roms', expr) / join('static/roms', expr)
// and resolves the variable half through the LIST that feeds it: every
// `rom: 'NAME'` (or "rom": "NAME") property in the SAME FILE is taken as a name
// the constructed path can produce. That is the load-bearing depth of what
// this file can see: a name that arrives from a prop, a JSON fixture, another
// module or a runtime string is out of reach. A template using a literal local
// const is resolved through its actual lexical binding; a constructed path with
// neither that binding nor rom: entries is refused rather than silently omitted.
// The same limit is stated, not solved: a ROM name assembled from parts
// ('i8086-' + kind + '-demo.bin') is invisible here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createRequire} from 'node:module';
import {packageSourceRoot} from './helpers/package-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const overlaySrc = resolve(repo, 'overlay/scratch-gui/src');
const romDir = resolve(repo, 'overlay/scratch-gui/static/roms');
const babel = createRequire(resolve(repo, 'packages/scratch-gui/package.json'))('@babel/core');

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p);
    }
    return out;
}

// Shape 1: `static/roms/NAME` in a string literal (optionally /static/roms or ./static/roms).
const REF = /['"`](?:\.?\/)?static\/roms\/([A-Za-z0-9_.\-]+)['"`]/g;
// Shape 2: a constructed path — the variable half is resolved through the file's rom: list.
const CONSTRUCTED = [
    /`(?:\.?\/)?static\/roms\/\$\{([^}]+)\}/g,                          // `static/roms/${p.rom}`
    /['"](?:\.?\/)?static\/roms\/['"]\s*\+\s*([A-Za-z_$][\w$.]*)/g,       // 'static/roms/' + name
    /join\([^)]*?['"]static['"]\s*,\s*['"]roms['"]\s*,\s*([^)'"]+)\)/g,     // join(x, 'static', 'roms', name)
    /join\([^)]*?['"]static\/roms['"]\s*,\s*([^)'"]+)\)/g                  // join('static/roms', name)
];
const EXAMPLE_OVERRIDE = /\bpath\s*:\s*['"](examples\/[A-Za-z0-9_./-]+)['"]/;
// The list a constructed path draws from: `rom: 'NAME'` / "rom": "NAME" properties.
const LIST_ENTRY = /\b["']?rom["']?\s*:\s*['"]([A-Za-z0-9_.\-]+)['"]/g;
const isComment = line => /^\s*(\/\/|\*|\/\*)/.test(line);

/**
 * Every ROM name a source text can fetch, by shape. Pure; exported for the
 * mutation tests below.
 * @returns {{literal: string[], constructed: {line: number, column: number, expr: string}[], listNames: string[]}}
 */
export function censusRomRefs (text) {
    const literal = [], constructed = [], listNames = [], examplePaths = [];
    text.split('\n').forEach((line, i) => {
        if (isComment(line)) return;
        for (const m of line.matchAll(REF)) literal.push(m[1]);
        for (const re of CONSTRUCTED) for (const m of line.matchAll(re)) {
            constructed.push({line: i + 1, column: m.index, expr: m[1].trim()});
        }
        const override = line.match(EXAMPLE_OVERRIDE);
        for (const m of line.matchAll(LIST_ENTRY)) {
            if (override) examplePaths.push(override[1]);
            else listNames.push(m[1]);
        }
    });
    return {literal, constructed, listNames, examplePaths};
}

// A locally bound filename is as finite as a preset entry. Resolve the actual
// lexical const binding, not a same-spelled variable elsewhere in the file.
// Anything dynamic, reassigned, shadowed by a parameter or declared after the
// use remains unresolvable and fails the existing completeness assertion.
function constantRomNames(text) {
    const names = new Map();
    let ast;
    try {
        ast = babel.parseSync(text, {babelrc: false, configFile: false,
            parserOpts: {plugins: ['jsx']}});
    } catch {
        return names;
    }
    babel.traverse(ast, {TemplateLiteral(path) {
        const {node} = path;
        if (node.quasis.length !== 2 || node.expressions.length !== 1 ||
            !/^(?:\.?\/)?static\/roms\/$/.test(node.quasis[0].value.cooked) ||
            node.quasis[1].value.cooked !== '' || node.expressions[0].type !== 'Identifier') return;
        const binding = path.scope.getBinding(node.expressions[0].name);
        const init = binding?.path.node.init;
        if (binding?.kind !== 'const' || !binding.constant || init?.type !== 'StringLiteral' ||
            binding.path.node.start >= node.start || !/^[A-Za-z0-9_.-]+$/.test(init.value)) return;
        names.set(`${node.loc.start.line}:${node.loc.start.column}`, init.value);
    }});
    return names;
}

/** The names a file can fetch, and the constructed paths whose source it cannot see. */
export function resolveRomNames (text) {
    const {literal, constructed, listNames, examplePaths} = censusRomRefs(text);
    const names = new Set(literal);
    const unresolvable = [];
    if (constructed.length) {
        const constants = constantRomNames(text);
        for (const ref of constructed) {
            const local = constants.get(`${ref.line}:${ref.column}`);
            if (local) names.add(local);
            else if (listNames.length === 0) unresolvable.push(ref);
            else for (const n of listNames) names.add(n);
        }
    }
    return {names: [...names], unresolvable, constructed: constructed.length, listNames: listNames.length, examplePaths};
}

test('every static/roms file the app and installed Circuit UI can fetch — literal or built from a preset list — exists', () => {
    const missing = [];
    const seen = new Set();
    const blind = [];
    let constructedSeen = 0;
    // CircuitDesigner and its preset list now belong to the installed package.
    // Keep that source in the census; deleting copied UI must not delete proof.
    const uiFiles = walk(packageSourceRoot('bw-circuit-ui'));
    assert.ok(uiFiles.some(file => file.endsWith('/components/CircuitDesigner.jsx')),
        'the installed Machine Loader must participate in the ROM census');
    for (const file of [...walk(overlaySrc), ...uiFiles]) {
        const text = readFileSync(file, 'utf8');
        const {names, unresolvable, constructed, examplePaths} = resolveRomNames(text);
        constructedSeen += constructed;
        for (const u of unresolvable) blind.push(`${relative(repo, file)}:${u.line} builds static/roms/${'$'}{${u.expr}} without a finite rom: list or immutable local filename`);
        for (const path of examplePaths) {
            if (!existsSync(join(repo, 'overlay/scratch-gui', path))) missing.push(`${relative(repo, file)} fetches ${path}`);
        }
        for (const name of names) {
            seen.add(name);
            if (!existsSync(join(romDir, name))) missing.push(`${relative(repo, file)} fetches static/roms/${name}`);
        }
    }
    assert.ok(seen.size > 0,
        'the scan found no static/roms references at all, which means the pattern '
        + 'stopped matching rather than that everything is fine — a green result '
        + 'from a scan that reads nothing is the failure this file is about');
    assert.ok(constructedSeen > 0,
        'the scan found no CONSTRUCTED static/roms path — the Machine Loader builds one from its '
        + 'preset list; if that moved, the widened half of this census is reading nothing');
    assert.deepEqual(blind, [],
        'constructed static/roms path(s) whose name source this census cannot see — provide a finite '
        + 'rom: list or immutable local filename, or the 404 is invisible again:\n  ' + blind.join('\n  '));
    assert.deepEqual(missing, [],
        'these paths 404 at runtime, and only for the user:\n  ' + missing.join('\n  '));
});

test('the widened census can fail, each shape by name (mutation)', () => {
    const tpl = "const presets = [{ id: 'a', rom: 'present.bin' }, { id: 'b', rom: 'absent.bin' }];\nconst url = new URL(`static/roms/${p.rom}`, base);";
    assert.deepEqual(resolveRomNames(tpl).names.sort(), ['absent.bin', 'present.bin'], 'a template path resolves through the rom: list');
    const concat = "const u = 'static/roms/' + name; const list = [{rom: 'x.bin'}];";
    assert.deepEqual(resolveRomNames(concat).names, ['x.bin']);
    const joined = "const p = join(root, 'static', 'roms', file); const l = { \"rom\": \"y.rom\" };";
    assert.deepEqual(resolveRomNames(joined).names, ['y.rom']);
    const blind = "const url = `static/roms/${props.rom}`;";
    assert.equal(resolveRomNames(blind).unresolvable.length, 1, 'a constructed path with no list in the file is refused, not passed');
    const comment = "// const url = `static/roms/${p.rom}`; rom: 'ghost.bin'";
    assert.deepEqual(resolveRomNames(comment), {names: [], unresolvable: [], constructed: 0, listNames: 0, examplePaths: []}, 'comment lines never count');
    const override = "const p = {rom: 'rom.bin', path: 'examples/hello/rom.bin'};";
    assert.deepEqual(resolveRomNames(override).examplePaths, ['examples/hello/rom.bin']);
    assert.deepEqual(resolveRomNames(override).names, []);
    const literalSlash = "fetch('/static/roms/z.bin')";
    assert.deepEqual(resolveRomNames(literalSlash).names, ['z.bin']);
});

test('immutable local ROM names resolve by lexical binding and dynamic names still fail', () => {
    const source = "const name = 'outer.bin'; function a() { const name = 'inner.bin'; return `static/roms/${name}`; }\n"
        + "function b() { return `static/roms/${name}`; }";
    assert.deepEqual(resolveRomNames(source).names.sort(), ['inner.bin', 'outer.bin']);
    for (const text of [
        "const name = 'outer.bin'; function a(name) { return `static/roms/${name}`; }",
        "let name = 'mutable.bin'; const url = `static/roms/${name}`;",
        "const name = getName(); const url = `static/roms/${name}`;",
        "const url = `static/roms/${name}`; const name = 'late.bin';",
        "const name = 'one.bin'; name = 'two.bin'; const url = `static/roms/${name}`;"
    ]) {
        const result = resolveRomNames(text);
        assert.deepEqual(result.names, []);
        assert.equal(result.unresolvable.length, 1);
    }
    const sameLine = "const name = 'outer.bin'; function good() { return `static/roms/${name}`; } function bad(name) { return `static/roms/${name}`; }";
    assert.deepEqual(resolveRomNames(sameLine).names, ['outer.bin']);
    assert.equal(resolveRomNames(sameLine).unresolvable.length, 1,
        'a resolved sibling expression cannot hide the shadowed use on the same line');
});

test('the four 8086 ROMs are present and are the size their load address assumes', () => {
    // romAt is computed as 0x100000 - length so the reset vector at FFFF0h
    // lands inside the image. A ROM of an unexpected size does not fail to
    // load — it loads at the wrong address and executes open bus, which on
    // screen is a machine that never started.
    for (const [name, bytes] of [
        ['i8086-bios.bin', 65536],
        ['i8086-serial-monitor.bin', 32768],
        ['i8086-cga-demo.bin', 32768],
        ['i8086-timer-demo.bin', 32768],
    ]) {
        const p = join(romDir, name);
        assert.ok(existsSync(p), `${name} is missing`);
        const size = statSync(p).size;
        assert.equal(size, bytes, `${name} is ${size} bytes, expected ${bytes}`);
        const at = 0x100000 - size;
        assert.ok(at + size - 1 === 0xfffff,
            `${name} at ${at.toString(16)} must end at FFFFF so the reset vector is inside it`);
    }
});
