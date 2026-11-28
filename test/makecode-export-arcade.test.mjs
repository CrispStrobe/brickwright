/**
 * A Scratch project -> MakeCode Arcade (lib/bw-makecode/export-arcade.js).
 *
 * The contract, checked on real programs: every one of lite's 38 Scratch game
 * examples, and every Arcade game a real MakeCode file imports into, exports to
 * TypeScript that MakeCode's OWN Arcade compiler accepts (measured 42/42 on
 * 2026-09-25, after two defects the first run found: variables given text were
 * declared as numbers, and a placeholder literal 0 tripped Static TypeScript's
 * literal narrowing). What has no Arcade counterpart is NAMED, never dropped.
 * The unit cases pin the model mapping: coordinates, keys, touching, costumes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import util from 'node:util';
import {fileURLToPath} from 'node:url';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {pixelsToSvg} from '../overlay/scratch-gui/src/lib/bw-makecode/pixel-image.js';
import {ARCADE_PALETTE, parseImageLiteral} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-assets.js';
import {importArtefact, importProjectFiles} from '../overlay/scratch-gui/src/lib/bw-makecode/index.js';
import JSZip from 'jszip';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram, stepFrames, clearStrayTimers} from './helpers/bw-vm.mjs';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {default: SB3Creator} = await import(path.join(ROOT, 'overlay/scratch-gui/src/lib/sb3-creator.js'));
const games = (await import(path.join(ROOT, 'overlay/scratch-gui/src/lib/sb3-creator-game-examples.js'))).default;

const exportOf = (src, uploads = []) => {
    const cr = new SB3Creator();
    cr.parse(src);
    for (const u of uploads) (u.mode === 'add' ? cr.addCustomSVGCostume(u.sprite, u.svg, u.name) : cr.applyCustomSVG(u.sprite, u.svg));
    return projectToArcade(cr.project, {costumeSvg: (t, c) => {
        const a = cr.assets.get(c.assetId);
        return a && a.type === 'svg' ? a.data : null;
    }, soundData: (t, s) => cr.assets.get(s.assetId)?.data || null});
};

test('a Stage-only Hello world gets a visible Arcade speech bubble', () => {
    const result = exportOf('STAGE:\nWHEN flag clicked:\n    say "Hello world"');
    assert.match(result.files['main.ts'], /let _bwStageSpeech = sprites\.create/);
    assert.match(result.files['main.ts'], /_bwStageSpeech\.sayText\("Hello world"\)/);
    assert.deepEqual(result.unsupported, []);
});

test('the model mapping: coordinates, keys, touching', () => {
    const {ts, unsupported} = exportOf(`SPRITE hero:
WHEN flag clicked:
  go to x: 30 y: -60
  FOREVER:
    IF touching enemy THEN:
      change y by 30
WHEN right arrow key pressed:
  change x by 6

SPRITE enemy:
WHEN flag clicked:
  set x to 90
`);
    assert.match(ts, /heroSprite\.setPosition\(30 \/ 3 \+ 80, 60 - -60 \/ 3\)/, 'Scratch 30,-60 is Arcade 90,80');
    assert.match(ts, /heroSprite\.overlapsWith\(enemySprite\)/);
    assert.match(ts, /heroSprite\.y -= 30 \/ 3/, 'y up in Scratch is y down in Arcade');
    assert.match(ts, /controller\.right\.onEvent\(ControllerButtonEvent\.Pressed, function \(\) \{\n\s+heroSprite\.x \+= 6 \/ 3/);
    assert.match(ts, /enemySprite\.x = 90 \/ 3 \+ 80/);
    assert.deepEqual(unsupported, []);
});

test('a pixel-art costume becomes the sprite\'s image exactly', () => {
    const art = parseImageLiteral('. 2 2 .\n2 5 5 2\n. 2 2 .');
    const {ts} = exportOf('SPRITE gem:\nWHEN flag clicked:\n  wait 1 seconds\n', [{sprite: 'gem', svg: pixelsToSvg(art), mode: 'replace'}]);
    assert.match(ts, /sprites\.create\(img`\n\s+\. 2 2 \.\n\s+2 5 5 2\n\s+\. 2 2 \.\n`, SpriteKind\.Player\)/);
});

test('a custom palette keeps image indices and is written into Arcade project settings', () => {
    const cr = new SB3Creator();
    cr.parse('SPRITE gem:\nWHEN flag clicked:\n  wait 1 seconds\n');
    const image = parseImageLiteral('. 2 .\n2 2 2');
    const palette = [...ARCADE_PALETTE];
    palette[2] = '#123456';
    cr.applyCustomSVG('gem', pixelsToSvg(image, {palette}));
    const out = projectToArcade(cr.project, {
        costumeSvg: (target, costume) => cr.assets.get(costume.assetId)?.data || null,
        costumePalette: () => palette
    });
    assert.match(out.ts, /img`\n\s+\. 2 \.\n\s+2 2 2\n`/);
    assert.equal(JSON.parse(out.files['pxt.json']).palette[2], '#123456');
    assert.deepEqual(out.warnings, []);
});

test('the CLI reads version 2 and animated version 3 palettes for exact Arcade img export', async () => {
    const cr = new SB3Creator();
    cr.parse('SPRITE gem:\nWHEN flag clicked:\n  wait 1 seconds\n');
    const image = parseImageLiteral('. 2 .\n2 2 2');
    const palette = [...ARCADE_PALETTE];
    palette[2] = '#123456';
    const svg = pixelsToSvg(image, {palette});
    cr.applyCustomSVG('gem', svg);
    const costume = cr.project.targets[1].costumes[0];
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(cr.project));
    zip.file(costume.md5ext, svg);
    const layers = [{id: 'pixels', type: 'pixel',
                name: 'Pixels', visible: true, locked: false, opacity: 1,
                content: {kind: 'pixels', value: {width: 3, height: 2, pixels: [...image.pixels]}}}];
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-arcade-palette-'));
    const input = path.join(directory, 'custom.sb3');
    const output = path.join(directory, 'custom.ts');
    try {
        for (const version of [2, 3]) {
            const document = {version, palette, pixelScale: 4, activeLayerId: 'pixels', layers,
                ...(version === 3 ? {animation: {activeFrameId: 'two', frames: [
                    {id: 'one', durationMs: 100, activeLayerId: 'pixels', layers},
                    {id: 'two', durationMs: 100, activeLayerId: 'pixels', layers}]}} : {})};
            zip.file('brickwright/artwork/v1.json', JSON.stringify({format: 'brickwright-artwork', version,
                costumes: [{targetIndex: 1, costumeIndex: 0, renderedMd5ext: costume.md5ext, document}]}));
            fs.writeFileSync(input, await zip.generateAsync({type: 'nodebuffer'}));
            const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/makecode.mjs'),
                'to-ts', input, '-o', output, '--target', 'arcade'], {encoding: 'utf8'});
            assert.equal(result.status, 0, result.stderr);
            assert.match(fs.readFileSync(output, 'utf8'), /img`\n\s+\. 2 \.\n\s+2 2 2\n`/);
        }
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('what has no Arcade counterpart is named and left as a comment where it stood', () => {
    // Thoughts now map to text bubbles. List monitors still have no Arcade
    // counterpart, so retain the named-refusal and source-position guard here.
    const {ts, unsupported} = exportOf('SPRITE s:\nLIST xs\nWHEN flag clicked:\n  say "before"\n  show list xs\n  say "after"\n');
    assert.deepEqual(unsupported, ['show list: Arcade has no list monitors']);
    assert.match(ts, /\.sayText\("before"\)[\s\S]*\/\/ show list: Arcade has no list monitors[\s\S]*\.sayText\("after"\)/);
});

test('thoughts use the mapped Arcade text bubble and explain the presentation change', () => {
    for (const [message, emitted] of [['"hmm"', /sSprite\.sayText\("hmm"\)/],
        ['hmm', /sSprite\.sayText\(s_hmm\)/]]) {
        const {ts, unsupported, warnings} = exportOf(`SPRITE s:\nWHEN flag clicked:\n  think ${message}\n  wait 1 seconds\n`);
        assert.deepEqual(unsupported, []);
        assert.match(ts, emitted);
        assert.ok(warnings.includes('Scratch thoughts use Arcade text bubbles'), JSON.stringify(warnings));
    }
});

// ── Round-trip shapes MakeCode rejected (task F5 of docs/OPEN-TASKS-2026-09-29.md) ──
const F5_SOURCES = {
    // A value-returning function in a game that also stops: its stop guard
    // was a bare \`return\` ("Not all code paths return a value").
    'returning function with a stop guard': [
        'function make (): Sprite {',
        '    let enemy = sprites.create(img`1`, SpriteKind.Enemy)',
        '    place(enemy, 10)',
        '    enemy.vy = 10',
        '    return enemy',
        '}',
        'function place (s: Sprite, edge: number) {',
        '    s.x = randint(edge, 160 - edge)',
        '}',
        'let foe = make()',
        'info.onLifeZero(function () {',
        '    game.gameOver(false)',
        '})'
    ].join('\n'),
    // A sprite created in an interval hat is cloned there; the hat's body
    // spoke of \`self\`, which a plain onUpdateInterval handler lacks.
    'interval hat of a cloned sprite': [
        'let iceSprite: Sprite = null',
        'game.onUpdateInterval(1000, function () {',
        // Art computed by a call keeps the older cloned-sprite translation. (A plain
        // named image we do not carry is created natively with a stand-in instead.)
        '    iceSprite = sprites.create(pickArt(2), SpriteKind.Enemy)',
        '    iceSprite.setPosition(randint(8, 152), 0)',
        '})'
    ].join('\n'),
    // A typed empty array on the fixed-sprite path became a named list, while
    // \`.length\` / \`.push\` read an unset reference variable (a number).
    'named array read by length': [
        'let frameNum = 0',
        'let frameList: Image[] = []',
        'game.onUpdateInterval(500, function () {',
        '    frameNum += 1',
        '    if (frameNum >= frameList.length) {',
        '        frameNum = 0',
        '    }',
        '})'
    ].join('\n')
};

test('the F5 shapes export without a bare return, a free self, or a list read as a number', () => {
    const exported = Object.fromEntries(Object.entries(F5_SOURCES).map(([id, src]) => {
        const r = importProjectFiles({'main.ts': src, 'pxt.json': JSON.stringify({dependencies: {device: '*'}, files: ['main.ts']})},
            {target: 'arcade', name: id});
        return [id, {code: r.code, ts: exportOf(r.code, r.costumes || []).ts}];
    }));
    const returning = exported['returning function with a stop guard'].ts;
    for (const fn of returning.split(/\nfunction /).filter(f => /^\S+ \([^)]*\): \w+ \{/.test(f))) {
        assert.doesNotMatch(fn, /\breturn\s*$/m, `a bare return in a value-returning function:\n${fn}`);
    }
    const interval = exported['interval hat of a cloned sprite'].ts;
    assert.match(interval, /game\.onUpdateInterval\(1000, function \(\) \{\n {4}const w = new _Wait\(\)\n {4}for \(const s of _all_iceSprite\(\)\) _spawnFor\(w, /);
    assert.match(exported['interval hat of a cloned sprite'].code, /go to x: \(arcade math randomRange first \(\(0 \+ \(8\)\)\) second \(\(0 \+ \(152\)\)\) - 80\) \* 3 y: 180/);
    const named = exported['named array read by length'];
    assert.match(named.code, /length of array reference \(frameList\)/);
    assert.doesNotMatch(named.code, /length of array "frameList"/);
});

// ── MakeCode's own compiler, over the whole corpus ─────────────────────────
const STATIC = path.join(ROOT, 'packages/scratch-gui/static/makecode/arcade');
const skip = fs.existsSync(path.join(STATIC, 'pxtworker.js')) ? false : 'MakeCode runtime not synced (npm run sync:makecode) — pxt compiler absent';

test('every lite game and every imported Arcade game exports to TypeScript MakeCode\'s compiler accepts', {skip, timeout: 1200000}, async () => {
    const {PXT_GLUE_JS} = await import(path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-makecode/pxt-runtime.js'));
    const sb = {setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate,
        TextEncoder: util.TextEncoder, TextDecoder: util.TextDecoder, Buffer,
        console: {log () {}, debug () {}, info () {}, warn () {}, error () {}},
        pxtTargetBundle: JSON.parse(fs.readFileSync(path.join(STATIC, 'target.json'), 'utf8'))};
    sb.global = sb;
    sb.self = sb;
    sb.eval = src => vm.runInContext(src, sb, {filename: 'eval'});
    vm.createContext(sb, {codeGeneration: {strings: false, wasm: false}});
    vm.runInContext(fs.readFileSync(path.join(STATIC, 'pxtworker.js'), 'utf8'), sb, {filename: 'pxtworker.js'});
    vm.runInContext(PXT_GLUE_JS, sb, {filename: 'pxt-glue.js'});
    const corpus = Object.entries(games).map(([id, src]) => ({id, src: String(src), uploads: []}));
    for (const f of ['arcade-assets.hex', 'arcade-tilemap.hex', 'arcade-umlaut.hex', 'arcade-shield.hex']) {
        const r = await importArtefact(new Uint8Array(fs.readFileSync(path.join(ROOT, 'test/fixtures/makecode', f))), {name: f});
        corpus.push({id: f, src: r.code, uploads: r.costumes || []});
    }
    // Shapes the corpus audit found MakeCode rejecting after a round trip (F5).
    for (const [id, src] of Object.entries(F5_SOURCES)) {
        const r = importProjectFiles({'main.ts': src, 'pxt.json': JSON.stringify({dependencies: {device: '*'}, files: ['main.ts']})},
            {target: 'arcade', name: id});
        corpus.push({id, src: r.code, uploads: r.costumes || []});
    }
    assert.ok(corpus.length >= 40, `only ${corpus.length} programs`);
    const failed = [];
    for (const c of corpus) {
        const ex = exportOf(c.src, c.uploads);
        const r = JSON.parse(JSON.stringify(await sb.bwMakeCode.compile(ex.files, {})));
        if (!r.success) failed.push(`${c.id}: ${(r.diagnostics[0] || {}).message}`);
    }
    assert.deepEqual(failed, []);
});

test('Arcade maths keeps every argument both ways (min/max/pow kept only the first; abs of a - b was |a| - b)', async () => {
    const {arcadeToPseudocode} = await import(path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js'));
    const {code, unsupported} = arcadeToPseudocode([
        'let a = 0',
        'let b = 0',
        'a = Math.max(0, b - 1)',
        'b = Math.min(a, 10)',
        'a = Math.pow(2, b)',
        'b = Math.abs(a - b)',
        'a = Math.map(b, 0, 10, 0, 100)'
    ].join('\n'));
    // Since task E1 the import writes MakeCode arithmetic through the value
    // words (`calculate value … op "-"`: JavaScript's rules), still with every
    // argument kept.
    assert.match(code, /set a to \(arcade math max first \(\(0 \+ \(0\)\)\) second \(calculate value \(b\) op "-" with \(\(0 \+ \(1\)\)\)\)\)/);
    assert.match(code, /set b to \(arcade math min first \(a\) second \(\(0 \+ \(10\)\)\)\)/);
    assert.match(code, /set a to \(calculate value \(\(0 \+ \(2\)\)\) op "\*\*" with \(b\)\)/);
    assert.match(code, /set b to \(abs of \(calculate value \(a\) op "-" with \(b\)\)\)/);
    // No map reporter off the micro:bit: its definition, and said.
    assert.match(code, /set a to \(\(\(b - 0\) \* \(100 - 0\) \/ \(10 - 0\) \+ 0\)\)/);
    assert.ok(unsupported.some(u => /Math\.map\(\) — written out as its formula/.test(u)), unsupported.join('\n'));
    // The way back from the import's own words (task E2): the value words
    // export as JavaScript's operators (a helper per operator); min and max
    // retain PXT numeric arguments, and power retains the typed operator; every
    // argument kept, nothing refused.
    const back = exportOf(code);
    assert.deepEqual(back.unsupported, []);
    for (const call of [/Math\.max\(<any>\(0 \+ 0\), <any>__bwBinarySubtract\(b, \(0 \+ 1\)\)\)/, /Math\.min\(<any>a, <any>\(0 \+ 10\)\)/, /__bwBinaryPower\(\(0 \+ 2\), b\)/,
        /Math\.abs\(__bwBinarySubtract\(a, b\)\)/, /function __bwBinarySubtract\(left: any, right: any\): number \{ return left - right \}/]) {
        assert.match(back.ts, call);
    }
    // And from the same maths written as Scratch arithmetic.
    const {ts} = exportOf(`SPRITE s:\nWHEN flag clicked:\n${[
        'set a to max of 0 and (b - 1)', 'set b to min of a and 10', 'set a to 2 to the power of b',
        'set b to abs of (a - b)'].map(l => `  ${l}`).join('\n')}\n`);
    // (the export prefixes a sprite's variables with its name)
    for (const call of [/Math\.max\(0, \(\w*b - 1\)\)/, /Math\.min\(\w*a, 10\)/, /Math\.pow\(2, \w*b\)/,
        /Math\.abs\(\(\w*a - \w*b\)\)/]) {
        assert.match(ts, call);
    }
});

// ── What Lite's own export carries comes back as itself (task F8) ───────────
test('stop blocks and not survive export and re-import, without the run-token machinery', () => {
    const src = [
        'DEVICE ARCADE',
        'SPRITE Game:',
        'WHEN flag clicked:',
        '  set n to 0',
        '  REPEAT UNTIL not (n < 10):',
        '    change n by 1',
        '  stop other scripts in sprite',
        '  IF n > 5 THEN:',
        '    stop all',
        'WHEN flag clicked:',
        '  FOREVER:',
        '    change m by 1',
        ''
    ].join('\n');
    const {files} = exportOf(src);
    assert.match(files['main.ts'], /function _stopAll \(\)/);
    const back = importProjectFiles(files, {target: 'arcade', name: 'rt'});
    assert.doesNotMatch(back.code, /_tok|_dead|_stopAll|_stopMark|_som_|_sok_/, back.code);
    assert.match(back.code, /^\s*stop all$/m);
    assert.match(back.code, /^\s*stop other scripts in sprite$/m);
    assert.match(back.code, /arcade repeat while compare value \(Game_n\) op "<" with \(\(0 \+ \(10\)\)\)/);
    assert.doesNotMatch(back.code, /op "===" with \(\(compare value \(1\) op "<" with \(0\)\)\)/, 'a condition came back as a value comparison');
});

// The lift accepts only the exporter's own sprite prologue. Any other Sprite
// route or a prologue that can observe the stop storage keeps the helpers.
test('stop machinery stays unlifted when the sprite prologue is not the exporter recipe', () => {
    const src = ['DEVICE ARCADE', 'SPRITE Game:', 'WHEN flag clicked:', '  set n to 0', '  REPEAT UNTIL not (n < 10):',
        '    change n by 1', '  stop other scripts in sprite', 'WHEN flag clicked:', '  FOREVER:', '    change m by 1', ''].join('\n');
    const {files} = exportOf(src);
    const position = /GameSprite\.setPosition\([^\n]*\)/;
    assert.match(files['main.ts'], position);
    for (const edit of [
        ts => ts.replace(position, 'GameSprite.setPosition(_tokens, 0)'),
        ts => ts.replace(position, 'GameSprite.setPosition(info.life(), 0)'),
        ts => ts.replace(position, m => m + '\nlet Foe = sprites.create(img`\n    5\n`, SpriteKind.Enemy)'),
        ts => ts.replace(position, m => m + '\nGameSprite.x = _stopMark')]) {
        const back = importProjectFiles({...files, 'main.ts': edit(files['main.ts'])}, {target: 'arcade', name: 'rt'});
        assert.match(back.code, /_tok|_stopMark|_som_/, 'a foreign prologue must not lift the stop machinery');
    }
});

// These authored controls use actual PXT input, not the unresolved lab2imgs
// gallery in the structural F5 regression above. Random coordinates are tested
// against the authored bounds; no platform entropy is replaced.
async function checkAuthoredRoutes(source, expected, {duration = 300, originalPrefix = '', requireStopped = false} = {}) {
    const files = typeof source === 'string' ? {'main.ts': source,
        'pxt.json': JSON.stringify({dependencies: {device: '*'}, files: ['main.ts']})} : source;
    const imported = importProjectFiles(files, {target: 'arcade'});
    assert.deepEqual(imported.unsupported, []);
    const originalExpected = Object.fromEntries(Object.entries(expected).map(([key, value]) => [originalPrefix + key, value]));
    const original = await runPxtArcade(files, {fakeClock: true, waitForGlobals: originalExpected});
    for (const [key, value] of Object.entries(originalExpected)) assert.equal(original[key], value, key);
    const runs = [];
    const check = run => {
        assert.deepEqual(run.errors, []); assert.deepEqual(run.creator.warnings, []);
        const vars = Object.fromEntries(run.vm.runtime.targets.flatMap(t => Object.values(t.variables)).map(v => [v.name.replace(/^Game_/, ''), v.value]));
        for (const [key, value] of Object.entries(expected)) assert.equal(vars[key], value, key);
        if (requireStopped) assert.equal(run.vm.runtime.threads.length, 0, 'stop all retires actual VM threads');
    };
    const drive = async run => {
        const clock = createArcadeDiscreteTimers();
        run.vm.runtime.bwArcadeProgramClock = clock;
        run.vm.runtime.updateCurrentMSecs = () => { run.vm.runtime.currentMSecs = clock.now(); };
        run.vm.greenFlag();
        for (let now = 0; now <= duration; now += 20) {
            await clock.advanceTo(now); await run.vm.runtime._step(now ? 20 : 0);
            await clock.advanceTo(now); await new Promise(resolve => setImmediate(resolve));
        }
        check(run);
    };
    try {
        const run = await runProgram(imported.code, {frames: 0, frameAuthority: 'timed', uploads: imported.costumes, storage: true});
        runs.push(run); await drive(run);
        const code = await runProgram(run.creator.decompile(), {frames: 0, frameAuthority: 'timed', uploads: imported.costumes, storage: true});
        runs.push(code); await drive(code);
        const fresh = await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide', {frames: 0, frameAuthority: 'timed', storage: true});
        runs.push(fresh); await fresh.vm.loadProject(Buffer.from(await (await run.vm.saveProjectSb3()).arrayBuffer()));
        fresh.vm.greenFlag(); await drive(fresh);
        const exported = projectToArcade(run.creator.project, {costumeSvg: (_t, c) => run.creator.assets.get(c.assetId)?.data ?? null});
        assert.deepEqual(exported.unsupported, []); assert.deepEqual(exported.warnings, []);
        const back = await runPxtArcade(exported.files, {fakeClock: true, waitForGlobals: originalExpected});
        for (const [key, value] of Object.entries(expected)) assert.equal(back[key] ?? back['Game_' + key], value, key);
        const reimported = importProjectFiles(exported.files, {target: 'arcade'});
        assert.deepEqual(reimported.unsupported, []);
        const again = await runProgram(reimported.code, {frames: 0, frameAuthority: 'timed', uploads: reimported.costumes, storage: true});
        runs.push(again); await drive(again);
    } finally { for (const run of runs) run.vm.quit(); clearStrayTimers(); }
}

test('typed min/max/power/abs and nested arguments retain actual original values through authoring', {skip, timeout: 300000}, async () => {
    await checkAuthoredRoutes('let a=Math.max(0,9-1);let b=Math.min(a,6);let exponentResult=Math.pow(2,b);let distance=Math.abs(a-b);let nested=Math.min(Math.max(-3,distance-5),10);',
        {a: 8, b: 6, exponentResult: 64, distance: 2, nested: -3});
});

test('interval sprite creation and named image arrays execute through actual authoring routes', {skip, timeout: 300000}, async () => {
    await checkAuthoredRoutes('let count=0;let frameNum=0;let frameList:Image[]=[];let lastWidth=0;let lastHeight=0;let bounded=0;game.onUpdateInterval(50,function(){frameNum++;if(frameNum>=frameList.length){frameNum=0}if(count<3){let ice=sprites.create(img`12\n34`,SpriteKind.Enemy);ice.setPosition(randint(8,152),0);lastWidth=ice.width;lastHeight=ice.height;if(ice.x>=8&&ice.x<=152){bounded++}count++}});',
        {count: 3, frameNum: 0, lastWidth: 2, lastHeight: 2, bounded: 3});
});


test('exported stock stop-other and stop-all retain actual native lifecycle behavior', {skip, timeout: 300000}, async () => {
    const src = `DEVICE ARCADE
SPRITE Game:
WHEN flag clicked:
  set n to 0
  set after to 0
  REPEAT UNTIL not (n < 10):
    change n by 1
  stop other scripts in sprite
  IF n > 5 THEN:
    stop all
  set after to 1
WHEN flag clicked:
  FOREVER:
    change m by 1
`;
    const exported = exportOf(src);
    assert.deepEqual(exported.unsupported, []);
    await checkAuthoredRoutes(exported.files, {n: 10, after: 0}, {duration: 400, originalPrefix: 'Game_', requireStopped: true});
});

// Second export of a reimported program: the start script starts each former
// flag script as an `arcade run parallel` handler. In original PXT (the first
// export) every flag script takes its own run token, so `stop other scripts`
// keeps only the run that issued it. A handler that borrowed the start script's
// token would be kept as well and go on counting (original 5, borrowed 15/16).
const STOP_OTHER_ONLY = `DEVICE ARCADE
SPRITE Game:
WHEN flag clicked:
  set n to 0
  REPEAT UNTIL not (n < 5):
    change n by 1
  stop other scripts in sprite
  set atStop to m
  REPEAT UNTIL not (n < 15):
    change n by 1
  IF n > 100 THEN:
    stop all
  set later to m
WHEN flag clicked:
  FOREVER:
    change m by 1
`;
async function secondExportOf (src) {
    const first = exportOf(src);
    assert.deepEqual(first.unsupported, []);
    const imported = importProjectFiles(first.files, {target: 'arcade'});
    assert.deepEqual(imported.unsupported, []);
    const run = await runProgram(imported.code, {frames: 0, frameAuthority: 'timed', uploads: imported.costumes, storage: true});
    try {
        return {first, imported, second: projectToArcade(run.creator.project, {costumeSvg: (_t, c) => run.creator.assets.get(c.assetId)?.data ?? null})};
    } finally { run.vm.quit(); clearStrayTimers(); }
}
const parallelBodies = ts => ts.split('control.runInParallel(function () {\n').slice(1);

test('second export gives each reimported parallel handler its own run token, as original PXT does', {skip, timeout: 300000}, async () => {
    const {first, imported, second} = await secondExportOf(STOP_OTHER_ONLY);
    assert.match(imported.code, /arcade run parallel as "__bwParallel1"/);
    assert.deepEqual(second.unsupported, []);
    const want = {Game_n: 15};
    const original = await runPxtArcade(first.files, {fakeClock: true, waitForGlobals: want});
    assert.deepEqual([original.Game_atStop, original.Game_later], [5, 5], 'original PXT: stop other scripts ends the counter');
    const back = await runPxtArcade(second.files, {fakeClock: true, waitForGlobals: want});
    for (const key of ['Game_n', 'Game_atStop', 'Game_later', 'Game_m']) assert.equal(back[key], original[key], key);
    // Mutation control: the same second export with the handlers' own tokens
    // removed (borrowing the start script's) keeps the counter running.
    let seen = 0;
    const borrowed = second.files['main.ts'].replace(/control\.runInParallel\(function \(\) \{\n    const _t = _tok\(\)\n/g,
        whole => seen++ ? 'control.runInParallel(function () {\n' : whole);
    assert.notEqual(borrowed, second.files['main.ts']);
    const mutant = await runPxtArcade({...second.files, 'main.ts': borrowed}, {fakeClock: true, waitForGlobals: want});
    assert.notEqual(mutant.Game_later, original.Game_later, 'a borrowed token is observable');
});

test('only stop-carrying parallel handlers take a run token on second export', {skip, timeout: 300000}, async () => {
    // Refusal control: without stop machinery no handler takes a token.
    const plain = await secondExportOf('DEVICE ARCADE\nSPRITE Game:\nWHEN flag clicked:\n  set n to 1\nWHEN flag clicked:\n  FOREVER:\n    change m by 1\n');
    assert.deepEqual(plain.second.unsupported, []);
    assert.doesNotMatch(plain.second.files['main.ts'], /_tok\(\)/);
    const stopped = await secondExportOf(STOP_OTHER_ONLY);
    const bodies = parallelBodies(stopped.second.files['main.ts']);
    assert.equal(bodies.length, 3, 'start script plus two handlers');
    for (const body of bodies) assert.match(body, /^    const _t = _tok\(\)\n/);
});

// The second export writes the sprite prologue inside the start script as
// `GameSprite = null` / `GameSprite = sprites.create(...)` after a root
// `let GameSprite: Sprite`. The lift accepts exactly that recipe; every near
// miss below keeps the run-token helpers as user code.
test('stop machinery lifts from the exporter null prologue and only from that exact form', {timeout: 300000}, async () => {
    const {second} = await secondExportOf(STOP_OTHER_ONLY);
    const ts = second.files['main.ts'];
    const pair = /( {4})GameSprite = null\n {4}(GameSprite = sprites\.create\(img`[^`]*`, SpriteKind\.Player\))\n( {4}GameSprite\.setPosition\([^\n]*\))\n/;
    assert.match(ts, /^let GameSprite: Sprite$/m);
    assert.match(ts, pair);
    const lifted = importProjectFiles(second.files, {target: 'arcade', name: 'rt'});
    assert.deepEqual(lifted.unsupported, []);
    assert.doesNotMatch(lifted.code, /_tok|_dead|_stopAll|_stopMark|_som_|_sok_/, lifted.code);
    assert.match(lifted.code, /^\s*stop all$/m);
    assert.match(lifted.code, /^\s*stop other scripts in sprite$/m);
    const nearMisses = {
        'statement between null and create': s => s.replace(pair, (m, i, c, p) => `${i}GameSprite = null\n${i}info.setScore(1)\n${i}${c}\n${p}\n`),
        'create without the null reset': s => s.replace(pair, (m, i, c, p) => `${i}${c}\n${p}\n`),
        'reset to undefined instead of null': s => s.replace(pair, (m, i, c, p) => `${i}GameSprite = undefined\n${i}${c}\n${p}\n`),
        'initialized root declaration': s => s.replace(/^let GameSprite: Sprite$/m, 'let GameSprite: Sprite = null'),
        'root declaration of another type': s => s.replace(/^let GameSprite: Sprite$/m, 'let GameSprite: any'),
        'pair in a nested block': s => s.replace(pair, (m, i, c, p) => `${i}if (Game_n == 0) {\n${i}GameSprite = null\n${i}${c}\n${i}}\n${p}\n`),
        'unrelated assignment between null and create': s => s.replace(pair, (m, i, c, p) => `${i}GameSprite = null\n${i}Game_m = (0 + 0)\n${i}${c}\n${p}\n`),
        'position reads a foreign value': s => s.replace(pair, (m, i, c) => `${i}GameSprite = null\n${i}${c}\n${i}GameSprite.setPosition(info.life(), 0)\n`),
        'pair in a root update handler': s => s.replace(pair, '') + `game.onUpdate(function () {\n${ts.match(pair)[0]}})\n`,
        'position reads the stop storage': s => s.replace(pair, (m, i, c) => `${i}GameSprite = null\n${i}${c}\n${i}GameSprite.setPosition(_tokens, 0)\n`),
        'second creation outside the recipe': s => s.replace(pair, m => `${m}    GameSprite = sprites.create(img\`\n    5\n\`, SpriteKind.Enemy)\n`),
        'receiver is not the declared prologue sprite': s => s.replace(/^let GameSprite: Sprite$/m, 'let GameSprite: Sprite\nlet OtherSprite: Sprite')
            .replace(pair, (m, i, c, p) => `${i}OtherSprite = null\n${i}${c}\n${p}\n`),
        'pair inside a nested parallel handler': s => s.replace(pair, '').replace(/(control\.runInParallel\(function \(\) \{\n {4}const _t = _tok\(\)\n)([\s\S]*?control\.runInParallel\(function \(\) \{\n {4}const _t = _tok\(\)\n)/,
            (m, a, b) => a + b + ts.match(pair)[0])
    };
    for (const [name, edit] of Object.entries(nearMisses)) {
        const edited = edit(ts);
        assert.notEqual(edited, ts, name);
        const back = importProjectFiles({...second.files, 'main.ts': edited}, {target: 'arcade', name: 'rt'});
        assert.match(back.code, /_tok|_stopMark|_som_/, `${name}: a near-miss prologue must not lift the stop machinery`);
    }
});
