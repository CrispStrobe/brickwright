/**
 * N1: C on the Z80 bench. The hosted service compiles `sdcc -mz80` for the
 * bench's measured map; the C tab's ▶ Run C on Z80 boots the ROM through the
 * same path an assembled Z80 program takes.
 *
 * The DoD's proof, in Node: the z80-pd-bench example's OWN program, emitted as
 * C by the runner's generateC and compiled by the service (fixture), boots on
 * a machine extracted from the example's OWN circuit -- `jp` at the reset
 * vector ($0000 == 0xC3) -- and walks its light across latch1.Q0..Q7.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {packageSourceRoot} from './helpers/package-source.mjs';
import {scopeAfter} from './helpers/js-scope.mjs';
import {asmTargetForDevice} from '../overlay/scratch-gui/src/lib/bw-asm/assemble-route.js';

// Inspect the actual JSX button, including its enclosing availability condition.
// The menu and toolbar share a renderer; evaluate both IDs and the real gate
// instead of requiring one historical spelling of the JSX attributes.
const guiRequire = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const babel = guiRequire('@babel/core');
function renderedRunButton (source, handler) {
    const matches = [];
    const ast = babel.parseSync(source, {babelrc: false, configFile: false,
        sourceType: 'module', parserOpts: {plugins: ['jsx']}});
    babel.traverse(ast, {
        JSXOpeningElement (nodePath) {
            const node = nodePath.node;
            if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'button') return;
            const onClick = node.attributes.find(attribute => attribute.name?.name === 'onClick')?.value?.expression;
            if (onClick?.type === 'MemberExpression' && !onClick.computed &&
                onClick.object.type === 'ThisExpression' && onClick.property.name === handler) {
                matches.push(nodePath);
            }
        }
    });
    assert.equal(matches.length, 1, handler + ': expected one shared toolbar/menu button');
    const button = matches[0];
    const id = button.node.attributes.find(attribute => attribute.name?.name === 'data-testid')?.value;
    assert.ok(id, handler + ': button is missing its test ID');
    const idExpression = id.type === 'JSXExpressionContainer' ? id.expression : id;
    const readId = new Function('menu', 'return (' + source.slice(idExpression.start, idExpression.end) + ');');
    const condition = button.findParent(nodePath => nodePath.isConditionalExpression());
    assert.ok(condition, handler + ': button must have an availability condition');
    assert.ok(button.node.start >= condition.node.consequent.start &&
        button.node.end <= condition.node.consequent.end, handler + ': button belongs in the admitted branch');
    const gate = condition.node.test;
    const offered = new Function('asmTargetForDevice',
        'return function () { return (' + source.slice(gate.start, gate.end) + '); };')(asmTargetForDevice);
    return {
        testId: readId,
        offered: (lang, device, libraryProgram = null) => Boolean(offered.call({
            state: {lang, libraryProgram}, currentDevice: () => device
        }))
    };
}


const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(REPO, 'overlay/scratch-gui/src');
const EX = path.join(REPO, 'overlay/scratch-gui/examples/z80-pd-bench');
const fx = JSON.parse(readFileSync(path.join(REPO, 'test/fixtures/matrix-n1-n4-images.json'), 'utf8'))
    .images['z80-pd-bench'];
const BW = packageSourceRoot('bw-board');

test('the fixture is still what the example\'s program emits', async () => {
    const {default: SB3Creator} = await import(pathToFileURL(path.join(SRC, 'lib/sb3-creator.js')).href);
    const creator = new SB3Creator();
    creator.parse(readFileSync(path.join(EX, 'program.bw'), 'utf8'));
    assert.equal(creator.generateC(creator.project, {debug: false}), fx.c,
        'z80-pd-bench/program.bw no longer emits the fixture\'s C: recompile it (see the fixture\'s "about")');
});

test('the compiled ROM boots on the extracted bench and walks the latch', async () => {
    const rom = Uint8Array.from(Buffer.from(fx.rom_base64, 'base64'));
    assert.equal(rom[0], 0xc3, 'no `jp` at the Z80 reset vector');
    const {extractZ80Machine} = await import(pathToFileURL(path.join(BW, 'z80-extract.js')).href);
    const {createZ80Adapter} = await import(pathToFileURL(path.join(BW, 'z80-adapter.js')).href);
    const ex = extractZ80Machine(JSON.parse(readFileSync(path.join(EX, 'circuit.json'), 'utf8')));
    assert.ok(ex.ok, ex.reasons.join('; '));
    const adapter = createZ80Adapter({config: {clockHz: 7_372_800, regions: ex.regions, ports: ex.ports}, rom});
    const edges = {};
    adapter.attachBoard({advanceTo () {}, setPin (pin) { edges[pin] = (edges[pin] || 0) + 1; }});
    for (let i = 0; i < 100; i++) adapter.advanceNs(10_000_000);          // 1 s
    // `wait 0.1 seconds` per step, eight steps a lap: Q0 lights, goes dark,
    // and lights again within the second; every latch bit is visited.
    assert.ok(edges['latch1.Q0'] >= 3, `latch1.Q0 changed ${edges['latch1.Q0'] || 0} times in 1 s`);
    for (let q = 0; q < 8; q++) assert.ok(edges[`latch1.Q${q}`] >= 1, `latch1.Q${q} never changed`);
});

test('the C tab offers ▶ Run C on Z80, compiled by the one hosted compile', () => {
    const src = readFileSync(path.join(SRC, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    const button = renderedRunButton(src, 'runCOnZ80');
    assert.equal(button.testId(false), 'bw-run-c-z80');
    assert.equal(button.testId(true), 'bw-run-c-z80-menu');
    for (const device of ['z80', 'zx48', 'zx128']) {
        assert.equal(button.offered('c', device), true, device + ': authored C can run');
        assert.equal(button.offered('c', device, {id: 'library-program'}), false,
            device + ': a loaded library program must not be overwritten by the C route');
        for (const lang of ['pseudocode', 'asm', 'basic']) {
            assert.equal(button.offered(lang, device), false, device + ': wrong source language ' + lang);
        }
    }
    for (const device of [null, 'i8086', 'pico', 'z80-extra']) {
        assert.equal(button.offered('c', device), false, String(device) + ': not a Z80 target');
    }
    const fn = scopeAfter(src, 'async runCOnZ80 ()');
    assert.match(fn, /await this\.hostedCompileC\(source, 'z80', 'bin'\)/);
    assert.match(fn, /target: 'z80', slotId: 'rom'/, 'the ROM must take the assembled-Z80 path');
    assert.doesNotMatch(fn, /fetch\(/);
    for (const key of ['runCZ80', 'runCZ80Title', 'runCZ80Building', 'runCZ80Built',
        'runCZ80Refused', 'runCZ80Unavailable']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
});
