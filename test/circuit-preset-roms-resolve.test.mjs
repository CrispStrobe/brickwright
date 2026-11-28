import {packageSourceFile, importPackageSource} from './helpers/package-source.mjs';
/**
 * EVERY PRESET ROM BUTTON IN THE SHIPPED UI RESOLVES TO A FILE.
 *
 * CircuitDesigner.jsx offers fifteen circuit presets that load a ROM, and the
 * loader uses an explicit example path when supplied, otherwise `static/roms/${p.rom}`. SEVEN of the
 * fifteen were not there — cga-gfx, vga, hercules, ega, keyboard, desk and
 * blink. Seven buttons in the shipped editor did nothing but 404. Found by
 * brickwright-lite-ea on 2026-09-07 while measuring P6.
 *
 * WHY NO GATE SAW IT, which is the part worth carrying: the existing ROM census
 * looks for LITERAL paths, and this path is CONSTRUCTED. A grep cannot find a
 * template, so the census was answering "which literal ROM paths exist" while
 * the loader asks "does `static/roms/${p.rom}` resolve". Those are different
 * sets, and the census was green over a UI with seven dead buttons.
 *
 * So this test resolves the path THE WAY THE LOADER DOES, and reads the preset
 * list FROM CircuitDesigner.jsx rather than from a copy. A preset added
 * tomorrow is covered without anyone remembering to add it here — a second list
 * would only be a second thing to forget.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import {parseExpressionAt} from 'acorn';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGNER = packageSourceFile('bw-circuit-ui/components/CircuitDesigner.jsx');
const GUI = join(repo, 'overlay', 'scratch-gui');
const ROMS = join(GUI, 'static', 'roms');
const source = readFileSync(DESIGNER, 'utf8');
const {make6502LcdHelloRom} = await importPackageSource('bw-circuit-ui/model/m6502-lcd-preset.js');

/** Parse the actual expression so nested fields and conditional ROM names stay visible. */
function presets(src = source) {
    const declaration = /\bconst presets\s*=\s*/.exec(src);
    assert.ok(declaration, 'the machine preset declaration is missing');
    const expression = parseExpressionAt(src, declaration.index + declaration[0].length,
        {ecmaVersion: 'latest'});
    const found = new Map();
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'ObjectExpression') {
            const properties = new Map(node.properties.filter(p => p.type === 'Property' && !p.computed)
                .map(p => [p.key.name || p.key.value, p.value]));
            if (properties.has('id') && properties.has('rom')) {
                const create = new Function('lcd', 'make6502LcdHelloRom',
                    'return (' + src.slice(node.start, node.end) + ');');
                // Both supported LCD connector widths choose different real
                // source branches: four-bit bytes are generated, eight-bit
                // bytes are fetched. Every static preset is deduplicated.
                for (const bits of [4, 8]) {
                    const preset = create({bits, at: 0x6000}, make6502LcdHelloRom);
                    const key = JSON.stringify([preset.id, preset.rom, preset.path]);
                    found.set(key, preset);
                }
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    };
    visit(expression);
    return [...found.values()];
}

/** Execute the loader's own URL expression, including explicit example paths. */
function loaderPath(p) {
    const start = source.indexOf('const loadPreset =');
    assert.ok(start >= 0, 'the machine preset loader is missing');
    const declaration = /\bconst url\s*=\s*/.exec(source.slice(start));
    assert.ok(declaration, 'the machine preset URL expression is missing');
    const expression = parseExpressionAt(source, start + declaration.index + declaration[0].length,
        {ecmaVersion: 'latest'});
    const url = new Function('p', 'document', 'URL',
        'return (' + source.slice(expression.start, expression.end) + ');')(
        p, {baseURI: pathToFileURL(GUI + sep).href}, URL);
    const file = fileURLToPath(url);
    assert.ok(file.startsWith(GUI + sep), 'a preset resolved outside the shipped editor');
    return file;
}

function assertPresetAssets(found) {
    const missing = found.filter(p => {
        if (p.makeBytes) {
            assert.equal(typeof p.makeBytes, 'function', p.id + ' has no ROM generator');
            const bytes = p.makeBytes();
            assert.ok(bytes instanceof Uint8Array && bytes.length > 0, p.id + ' generated an empty ROM');
            return false;
        }
        return !existsSync(loaderPath(p));
    }).map(p => p.id + ' -> ' + relative(GUI, loaderPath(p)));
    assert.deepEqual(missing, [],
        'preset button(s) would 404 in the shipped editor:\n  ' + missing.join('\n  '));
}

/** The floor is measured, not aspirational: 15 presets name a ROM on 2026-09-07. */
const PRESET_FLOOR = 15;

test('the preset list is actually parsed — a parse that finds nothing cannot pass', () => {
    // lego-ac's addition, and it is the species this repo keeps finding: a
    // check that quantifies over an empty set is green about nothing. Rename a
    // field and the parser may stop collecting it; without
    // this floor, every assertion below would then pass vacuously and the gate
    // would report health while seeing zero presets.
    const found = presets();
    assert.ok(found.length >= PRESET_FLOOR,
        `parsed ${found.length} presets, floor is ${PRESET_FLOOR} — the parse broke, `
        + 'or presets were removed; either way the rest of this file is not testing what it says');
    for (const p of found) {
        assert.ok(p.id && p.rom, 'a parsed preset with an empty id or rom means the parser is drifting');
    }
});

test('every preset ROM resolves the way the loader builds the path', () => {
    assertPresetAssets(presets());
});

test('the loader honors explicit example paths and still checks the default ROM directory', () => {
    const found = presets();
    for (const id of ['vdphello', 'aurora65']) {
        const preset = found.find(p => p.id === id);
        assert.ok(preset && preset.path, id + ' no longer names its example ROM path');
        assert.equal(loaderPath(preset), join(GUI, preset.path));
        // A valid fallback ROM must not hide a missing explicit resource.
        assert.throws(() => assertPresetAssets([{...preset, rom: 'basic.rom',
            path: 'examples/missing-preset-fixture/rom.bin'}]), /would 404/);
    }
    const fallback = found.find(p => p.id === 'basic');
    assert.ok(fallback && !fallback.path, 'the default ROM-path control is missing');
    assert.equal(loaderPath(fallback), join(ROMS, fallback.rom));
    assert.throws(() => assertPresetAssets([{...fallback, rom: 'missing-preset-fixture.bin'}]), /would 404/);
});

test('a generated four-bit LCD preset supplies bytes without a static ROM file', () => {
    const generated = presets().find(p => p.id === 'lcdhello' && p.makeBytes);
    assert.ok(generated, 'the four-bit LCD ROM generator is missing');
    assert.equal(existsSync(loaderPath(generated)), false,
        'a static image now exists for the generated preset — re-aim this control');
    assertPresetAssets([generated]);
    assert.throws(() => assertPresetAssets([{...generated, makeBytes: () => new Uint8Array()}]),
        /generated an empty ROM/);
    assert.throws(() => assertPresetAssets([{...generated, makeBytes: null}]), /would 404/);
});

test('the vendored demo ROMs carry provenance naming their upstream and bytes', () => {
    // A binary blob with no route is the shape brickwright-lite-ea's BIOS
    // finding was about: present, shipped, and unattributable. Seven more blobs
    // arriving without one would repeat it on the same day it was closed.
    const manifest = JSON.parse(
        readFileSync(join(ROMS, 'i8086-demos.provenance.json'), 'utf8'));
    assert.ok(manifest.pinAtBuild, 'the manifest does not say which pin these came from');
    assert.ok(manifest.roms?.length >= 7, `only ${manifest.roms?.length} ROMs recorded`);
    for (const r of manifest.roms) {
        assert.ok(existsSync(join(ROMS, r.rom)), `${r.rom} is recorded but not present`);
        assert.match(r.upstream, /^rom\/[a-z0-9-]+\.bin$/, `${r.rom}: no upstream path`);
        assert.equal(typeof r.bytes, 'number');
        assert.match(r.sha256, /^[0-9a-f]{64}$/, `${r.rom}: no sha256`);
    }
    // And the pin the ROMs were taken at is the pin the engine is at, or the
    // demos were built for a machine this repo does not ship.
    const pin = JSON.parse(readFileSync(join(repo, 'vendor-pins.json'), 'utf8'))['bw-board'];
    assert.equal(manifest.pinAtBuild, pin,
        'the demo ROMs were vendored at a different sha than the engine — one of the two moved alone');
});

test('every vendored i8086 demo ROM is reachable from a preset', () => {
    // The other direction. A ROM nobody can load is dead weight in the bundle,
    // and it is how a "fix" for seven buttons quietly ships an eighth file that
    // no button names.
    const named = new Set(presets().map((p) => p.rom));
    const orphans = readdirSync(ROMS)
        .filter((f) => /^i8086-.*-demo\.bin$/.test(f))
        .filter((f) => !named.has(f));
    assert.deepEqual(orphans, [],
        `vendored but unreachable from any preset: ${orphans.join(', ')}`);
});
