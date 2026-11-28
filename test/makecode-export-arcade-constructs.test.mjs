/**
 * Scratch -> MakeCode Arcade: the constructs past motion and control
 * (task A4 — docs/ARCADE-COMPAT-PLAN.md is the matrix).
 *
 * Each mapping is held BY BEHAVIOUR, not by the words it emits: a small
 * Scratch project is exported, compiled by pxt-arcade's own compiler, and RUN
 * in pxt-arcade's own simulator (scripts/lib/makecode-arcade-sim.mjs, headless,
 * virtual clock). The program leaves a trace — a string variable it builds,
 * the tones it plays, the pixels on screen — and the trace must be Scratch's.
 *
 * And each check is shown to be able to fail: a MUTATION of the emitted
 * TypeScript that undoes the mapping's one essential step (the wait of
 * `broadcast and wait`, the setImage of a costume switch, ...) runs through
 * the same check and must come out different. A check that passes both is
 * measuring nothing.
 *
 * What stays unmapped (the mouse, sampled audio, unsupported pen parameters) must be NAMED —
 * checked here too, as the refusal text, and the program still compiles.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectToArcade, MOUSE_WHY} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {analyseTone, helperSource} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-runtime.js';
import {arcadeSimAvailable, compileArcade, compileArcadeFiles, runArcadeSim} from '../scripts/lib/makecode-arcade-sim.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {default: SB3Creator} = await import(path.join(ROOT, 'overlay/scratch-gui/src/lib/sb3-creator.js'));

const skip = arcadeSimAvailable() ? false :
    'MakeCode runtime not synced (npm run sync:makecode) — no pxt-arcade compiler and simulator';

/** Pseudocode -> {cr, out}; `patch` may rewrite the project before export. */
const exportOf = (src, patch) => {
    const cr = new SB3Creator();
    cr.parse(src);
    if (patch) patch(cr.project);
    const out = projectToArcade(cr.project, {
        name: 'a4',
        costumeSvg: () => null,
        soundData: (t, s) => cr.assets.get(s.assetId)?.data || null
    });
    return {cr, out};
};

/** The exported program + a tail that reports, run in the Arcade simulator. */
const run = async (ts, tail, ms) => {
    const js = await compileArcade(`${ts}\n${tail}\n`);
    const r = await runArcadeSim(js, {ms});
    assert.equal(r.error, null, `the simulator stopped: ${r.error}`);
    return r;
};
const traceAt = (ms, expr = 'trace') => `control.runInParallel(function () {\n    pause(${ms})\n    console.log("TRACE " + ${expr})\n})`;
const traced = r => r.serial.filter(l => l.text.startsWith('TRACE ')).map(l => l.text.slice(6));

/** Hold a mapping: the real output passes `ok`, the mutated output fails it. */
const holds = async (name, ts, mutate, observe, ok) => {
    const real = await observe(ts);
    assert.ok(ok(real), `${name}: ${JSON.stringify(real)}`);
    const broken = mutate(ts);
    assert.notEqual(broken, ts, `${name}: the mutation did not apply — it tests nothing`);
    const seen = await observe(broken);
    assert.ok(!ok(seen), `${name}: the mutated program passes too (${JSON.stringify(seen)}) — the check measures nothing`);
};

const opcodeOf = (project, opcode) => project.targets.flatMap(t => Object.values(t.blocks)).filter(b => b.opcode === opcode);

// ── broadcasts ────────────────────────────────────────────────────────────
test('broadcast and wait waits for every receiver, in every sprite', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
SPRITE a:
WHEN flag clicked:
  broadcast "go" and wait
  set trace to (join trace "D")
WHEN I receive "go":
  set trace to (join trace "1")
  wait 0.5 seconds
  set trace to (join trace "2")
SPRITE b:
WHEN I receive "GO":
  wait 0.2 seconds
  set trace to (join trace "3")
`);
    assert.deepEqual(out.unsupported, []);
    await holds('broadcast and wait', out.ts, ts => ts.replace('_await(_broadcast("go"))', '_broadcast("go")'),
        async ts => traced(await run(ts, traceAt(1500), 1600))[0],
        // Both receivers (names match case-insensitively) finish before D.
        trace => trace === '132D');
});

test('a receiver started again while it runs restarts, as Scratch\'s does', {skip, timeout: 300000}, async () => {
    // Scratch: the first run writes x at 0 and 100 ms and is restarted at 150;
    // the second writes four. Six, not eight.
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
SPRITE a:
WHEN flag clicked:
  broadcast "tick"
  wait 0.15 seconds
  broadcast "tick"
WHEN I receive "tick":
  REPEAT 4:
    set trace to (join trace "x")
    wait 0.1 seconds
`);
    await holds('broadcast restart', out.ts, ts => ts.replace(/_g != _gens\[\d+\]/g, 'false'),
        async ts => traced(await run(ts, traceAt(1500), 1600))[0],
        trace => trace === 'xxxxxx');
});

// ── costumes and backdrops ────────────────────────────────────────────────
test('costume switching changes the sprite\'s image, by name, by next and by number', {skip, timeout: 300000}, async () => {
    // No costume art in this harness, so each costume is a placeholder in its
    // own colour: costume1 of sprite "a" is colour 2, "square" is colour 3.
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
SPRITE a:
COSTUME square
WHEN flag clicked:
  switch costume to "square"
  set trace to (join trace (costume number))
  wait 0.1 seconds
  set trace to (join trace "p")
  next costume
  set trace to (join trace (costume number))
  switch costume to "square"
`);
    assert.deepEqual(out.unsupported, []);
    const observe = async ts => {
        const r = await run(ts, [traceAt(50, '"" + trace + aSprite.image.getPixel(0, 0)'),
            traceAt(500, '"" + trace + aSprite.image.getPixel(0, 0)')].join('\n'), 600);
        return traced(r).join(',');
    };
    await holds('switch costume', out.ts, ts => ts.replace('    s.setImage(set[i])\n', ''), observe,
        // by name: square (3); `next` wraps to costume 1 (2); by name again (3).
        seen => seen === '23,2p13');
});

test('backdrop switching shows the backdrop and starts `when backdrop switches to`', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
BACKDROP night
SPRITE a:
WHEN flag clicked:
  wait 0.1 seconds
  switch backdrop to "night"
  set trace to (join trace "S")
WHEN I receive "night":
  wait 0.2 seconds
  set trace to (join trace "H")
`, project => {
        // Scratch's real blocks; the pseudocode has no spelling for them.
        const hat = opcodeOf(project, 'event_whenbroadcastreceived')[0];
        hat.opcode = 'event_whenbackdropswitchesto';
        hat.fields = {BACKDROP: ['night', null]};
        opcodeOf(project, 'looks_switchbackdropto')[0].opcode = 'looks_switchbackdroptoandwait';
    });
    assert.deepEqual(out.unsupported, []);
    // What is ON SCREEN at (0, 0) — no sprite there: the backdrop's own colour
    // (backdrop1 is a plain fill of colour 1, night of colour 2 in this harness).
    const observe = async ts => {
        const r = await run(ts, traceAt(600), 700);
        return `${traced(r)[0]}@${r.screen()[0]}`;
    };
    const ok = seen => seen === 'HS@2';
    await holds('switch backdrop … and wait', out.ts, ts => ts.replace('_await(_setBackdrop(1))', '_setBackdrop(1)'), observe, ok);
    await holds('switch backdrop (the image)', out.ts, ts => ts.replace('    scene.setBackgroundImage(_backdrops[i])\n', ''), observe, ok);
    await holds('when backdrop switches to', out.ts, ts => ts.replace(/if \(name == "night"\) \{\n.*\n/, 'if (false) {\n'), observe, ok);
});

// ── clones ────────────────────────────────────────────────────────────────
test('clones: created from the sprite, run their own scripts, hear broadcasts, and die when deleted', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
GLOBAL made = 0
GLOBAL ticks = 0
SPRITE a:
WHEN flag clicked:
  REPEAT 3:
    create clone of myself
  wait 0.3 seconds
  broadcast "count" and wait
  broadcast "kill"
WHEN I start as a clone:
  change made by 1
  change x by 30
  FOREVER:
    change ticks by 1
    wait 0.1 seconds
WHEN I receive "count":
  set trace to (join trace "c")
WHEN I receive "kill":
  delete this clone
`);
    assert.deepEqual(out.unsupported, []);
    const observe = async ts => {
        // After the kill: how many clones live, the original still stands, and
        // the clones' forever loops have stopped (ticks no longer move).
        const r = await run(ts, [
            traceAt(1000, '"" + trace + " made " + made + " live " + sprites.allOfKind(_kind_a).length + " orig " + !_gone(aSprite)'),
            traceAt(1000, '"" + ticks'), traceAt(2000, '"" + ticks')].join('\n'), 2100);
        const [state, t1, t2] = traced(r);
        return `${state} ticks ${t1 === t2 ? 'stopped' : 'running'}`;
    };
    await holds('delete this clone', out.ts, ts => ts.replace('        self.destroy()\n', ''), observe,
        seen => seen === 'cccc made 3 live 0 orig true ticks stopped');
    await holds('when I start as a clone', out.ts, ts => ts.replace(/ {4}control\.runInParallel\(function \(\) \{ _cloned_a_\d+\(c\) \}\)\n/, ''),
        async ts => (await observe(ts)).split(' live')[0], seen => seen === 'cccc made 3');
});

test('each clone keeps its own copy of its sprite\'s variables, made from its parent\'s', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
SPRITE a:
LOCAL mine = 0
WHEN flag clicked:
  set mine to 100
  REPEAT 3:
    change mine by 1
    create clone of myself
  wait 0.3 seconds
  broadcast "report" and wait
WHEN I start as a clone:
  change mine by 10
WHEN I receive "report":
  set trace to (join trace mine)
  set trace to (join trace "/")
`);
    assert.deepEqual(out.unsupported, []);
    // The sprite ends at 103; its clones were made at 101, 102, 103 and each added 10.
    const observe = async ts => traced(await run(ts, traceAt(800), 900))[0].split('/').filter(Boolean).sort().join(' ');
    await holds('per-clone variables', out.ts, ts => ts.replace(/for \(const k of \[[^\]]*\]\) c\.data\[k\] = src\.data\[k\]/, 'c.data = src.data'),
        observe, seen => seen === '103 111 112 113');
});

// ── sound ─────────────────────────────────────────────────────────────────
test('a steady-tone sound, notes, rests and tempo play as Arcade tones, on time', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
SPRITE a:
SOUND beep 440
WHEN flag clicked:
  play sound "beep" until done
  play note 69 for 0.5 beats
  set tempo to 120
  play note 60 for 1 beats
  rest for 1 beats
  play sound "beep"
  set trace to (join trace "E")
`);
    assert.deepEqual(out.unsupported, []);
    const observe = async ts => {
        const r = await run(ts, '', 3000);
        const e = r.serial.length;
        return {tones: r.tones.map(t => `${t.t}:${t.freq}x${t.ms}`).join(' '), logs: e};
    };
    // beep = the declared 440 Hz for 0.3 s; A4 for half a beat at 60 bpm;
    // middle C for one beat at 120 bpm; a 250 ms rest; beep again.
    await holds('play sound until done', out.ts, ts => ts.replace('music.playTone(440, 300)\n', 'control.runInParallel(function () { music.playTone(440, 300) })\n'),
        observe, seen => seen.tones === '0:440x300 300:440x500 800:262x500 1800:440x300');
});

test('sampled sounds and drums are named, never dropped', () => {
    const cr = new SB3Creator();
    cr.parse('SPRITE a:\nSOUND voice 300\nWHEN flag clicked:\n  play sound "voice" until done\n  play drum 1 for 0.5 beats\n');
    // Replace the tone with noise: a sampled sound, which Arcade cannot play.
    const asset = cr.assets.get(cr.project.targets[1].sounds.find(s => s.name === 'voice').assetId);
    let seed = 7;
    for (let i = 44; i + 1 < asset.data.length; i += 2) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        asset.data[i] = seed & 0xff;
        asset.data[i + 1] = (seed >> 8) & 0xff;
    }
    const out = projectToArcade(cr.project, {soundData: (t, s) => cr.assets.get(s.assetId)?.data || null});
    assert.ok(out.unsupported.some(u => /play sound "voice": sampled audio — not one steady tone/.test(u)), out.unsupported.join('\n'));
    assert.ok(out.unsupported.some(u => /play drum: .*kept as a rest/.test(u)), out.unsupported.join('\n'));
    assert.match(out.ts, /\/\/ play sound "voice": sampled audio/);
    assert.match(out.ts, /pause\(_beats\(0\.5\)\) {2}\/\/ play drum/);
});

test('the tone detector reads a steady tone and refuses what is not one', () => {
    const cr = new SB3Creator();
    const tone = cr.makeToneWav(523, 0.25).data;
    assert.deepEqual(analyseTone(tone), {freq: 523, ms: 250});
    // A sweep is not one tone, however clean each moment of it is.
    const sweep = cr.makeToneWav(440, 0.5).data;
    const dv = new DataView(sweep.buffer, sweep.byteOffset);
    for (let i = 0; i < (sweep.length - 44) / 2; i++) {
        const t = i / 22050;
        dv.setInt16(44 + (i * 2), Math.sin(2 * Math.PI * (300 + (600 * t)) * t) * 12000, true);
    }
    assert.match(analyseTone(sweep).reason, /not one steady tone/);
    assert.match(analyseTone(new Uint8Array([1, 2, 3])).reason, /no audio data/);
});

// ── lists ─────────────────────────────────────────────────────────────────
test('lists keep Scratch\'s 1-based, forgiving, case-blind rules', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
LIST xs
SPRITE a:
WHEN flag clicked:
  add "a" to xs
  add "b" to xs
  add 3 to xs
  insert "z" at 1 of xs
  delete 2 of xs
  replace item 3 of xs with "c"
  set trace to (join trace (item 1 of xs))
  set trace to (join trace (length of xs))
  set trace to (join trace (item 9 of xs))
  set k to item 7 of xs
  set trace to (join trace k)
  set trace to (join trace (item 5 of xs))
  IF xs contains "C" THEN:
    set trace to (join trace "Y")
  delete all of xs
  set trace to (join trace (length of xs))
`, project => {
        // Scratch's own word for the end of a list (the pseudocode reads it as a variable).
        opcodeOf(project, 'data_itemoflist').find(b => JSON.stringify(b.inputs.INDEX).includes('"5"')).inputs.INDEX = [1, [7, 'last']];
        // `item # of "B" in xs` (the pseudocode reads `#` as a comment).
        const find = opcodeOf(project, 'data_itemoflist').find(b => JSON.stringify(b.inputs.INDEX).includes('"7"'));
        find.opcode = 'data_itemnumoflist';
        find.inputs = {ITEM: [1, [10, 'B']]};
    });
    assert.deepEqual(out.unsupported, []);
    const observe = async ts => traced(await run(ts, traceAt(200), 300))[0];
    // z b c: first z, three long, item 9 is "", "B" is item 2, last is c, contains C, then empty.
    await holds('list item (1-based)', out.ts, ts => ts.replace('    i = Math.floor(i) - 1\n    return i >= 0', '    i = Math.floor(i)\n    return i >= 0'),
        observe, seen => seen === 'z32cY0');
    await holds('list find (case-blind)', out.ts, ts => ts.replace('const t = ("" + v).toLowerCase()', 'const t = "" + v'),
        observe, seen => seen === 'z32cY0');
});

// ── pen ───────────────────────────────────────────────────────────────────
test('the pen draws the path a sprite moves along, in the pen colour, and clear erases it', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`SPRITE a:
WHEN flag clicked:
  hide
  go to x: -150 y: 0
  set pen color to #ff2121
  pen down
  go to x: 150 y: 0
  pen up
  go to x: 150 y: 90
  wait 1 seconds
  clear
`);
    assert.deepEqual(out.unsupported, []);
    // Row 60 of the screen (Scratch y 0), x 30..130 (Scratch -150..150).
    const row = screen => [...screen.slice((60 * 160) + 30, (60 * 160) + 131)];
    const observe = async ts => {
        const drawn = (await run(ts, '', 600)).screen();
        const cleared = (await run(ts, '', 1500)).screen();
        const col = (60 * 160) + 80;
        return {line: row(drawn).every(c => c === 2), upLine: drawn[(30 * 160) + 130] === 2,
            cleared: row(cleared).every(c => c !== 2), at: drawn[col]};
    };
    await holds('pen line', out.ts, ts => ts.replace('if (s.data["_pd"]) _penLine', 'if (false) _penLine'), observe,
        seen => seen.line && !seen.upLine && seen.cleared);
});

// ── stop (task A5) ────────────────────────────────────────────────────────
// Every option used to be game.over(false): a lose screen that ends the whole
// game. Each mutation below puts that emission (or the one step that makes the
// option work) back, and must come out different.

/** Run without asserting: a mutated program may stop the simulator, and that is a reading too. */
const runLoose = async (ts, tail, ms) => {
    const r = await runArcadeSim(await compileArcade(`${ts}\n${tail}\n`), {ms});
    return {r, trace: traced(r), error: r.error};
};
const OLD_STOP = 'game.over(false)';

test('stop this script returns from the script — or from the custom block — and the game goes on', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
GLOBAL n = 0
SPRITE a:
WHEN flag clicked:
  FOREVER:
    set trace to (join trace "f")
    IF n > 1 THEN:
      stop this script
    change n by 1
    wait 0.1 seconds
WHEN flag clicked:
  wait 0.5 seconds
  jump
  set trace to (join trace "J")
  broadcast "go"
  wait 0.3 seconds
  broadcast "go"
WHEN I receive "go":
  set trace to (join trace "g")
  stop this script
DEFINE jump:
  set trace to (join trace "j")
  stop this script
SPRITE b:
WHEN flag clicked:
  wait 1 seconds
  set trace to (join trace "B")
`);
    assert.deepEqual(out.unsupported, []);
    assert.doesNotMatch(out.ts, /game\.over/);
    const observe = async ts => {
        // The trace, and how many sprites the game's scene still shows: a
        // game-over pushes a new scene, so the game's own two are gone from it.
        const {trace, error} = await runLoose(ts, traceAt(1500, '"" + trace + " sprites " + sprites.allOfKind(SpriteKind.Player).length'), 1600);
        return error ? `error: ${error}` : trace[0];
    };
    // The forever loop ends after its third pass; `stop this script` in `jump`
    // returns to the caller (J runs); a receiver stopped once starts again on
    // the next broadcast; another sprite's script is untouched; the game goes on.
    const ok = seen => seen === 'fffjJggB sprites 2';
    await holds('stop this script (was game.over)', out.ts, ts => ts.split('return  // stop this script').join(OLD_STOP), observe, ok);
    await holds('stop this script (no return)', out.ts, ts => ts.split('return  // stop this script').join(''), observe, ok);
});

test('stop other scripts in sprite ends that sprite\'s other scripts, keeps this one, and hats start them again', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
GLOBAL na = 0
GLOBAL nb = 0
SPRITE a:
WHEN flag clicked:
  FOREVER:
    change na by 1
    wait 0.1 seconds
WHEN flag clicked:
  wait 0.25 seconds
  stop other scripts in sprite
  set trace to (join trace "S")
  wait 0.2 seconds
  set trace to (join trace "s")
  broadcast "go"
WHEN I receive "go":
  set trace to (join trace "g")
SPRITE b:
WHEN flag clicked:
  FOREVER:
    change nb by 1
    wait 0.1 seconds
`);
    assert.deepEqual(out.unsupported, []);
    const observe = async ts => {
        const {trace, error} = await runLoose(ts, [traceAt(500, '"" + trace + " " + na + " " + nb'), traceAt(1000, '"" + trace + " " + na + " " + nb')].join('\n'), 1100);
        if (error) return `error: ${error}`;
        const [early, late] = trace.map(t => t.split(' '));
        return `${late[0]} a ${early[1] === late[1] ? 'stopped' : 'running'} b ${early[2] === late[2] ? 'stopped' : 'running'}`;
    };
    // a's forever loop stopped; the stopping script ran on (s) and its
    // broadcast started a's receiver afresh (g); b never noticed.
    const ok = seen => seen === 'Ssg a stopped b running';
    await holds('stop other scripts (was game.over)', out.ts,
        ts => ts.replace(/_som_a = _tokens {2}\/\/ stop other scripts in sprite\n\s*_sok_a = _t/, OLD_STOP), observe, ok);
    await holds('stop other scripts (the others are not checked)', out.ts, ts => ts.split('(_t <= _som_a && _t != _sok_a)').join('false'), observe, ok);
    await holds('stop other scripts (this one not kept)', out.ts, ts => ts.replace('_sok_a = _t', '_sok_a = 0'), observe, ok);
});

test('stop other scripts in a clone ends that clone\'s scripts only', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL n0 = 0
GLOBAL n1 = 0
GLOBAL n2 = 0
SPRITE c:
LOCAL id = 0
WHEN flag clicked:
  set id to 1
  create clone of myself
  set id to 2
  create clone of myself
  set id to 0
  FOREVER:
    change n0 by 1
    wait 0.1 seconds
WHEN I start as a clone:
  FOREVER:
    IF id = 1 THEN:
      change n1 by 1
    IF id = 2 THEN:
      change n2 by 1
    wait 0.1 seconds
WHEN I receive "cut":
  IF id = 1 THEN:
    stop other scripts in sprite
SPRITE d:
WHEN flag clicked:
  wait 0.3 seconds
  broadcast "cut"
`);
    assert.deepEqual(out.unsupported, []);
    const observe = async ts => {
        const at = ms => traceAt(ms, '"" + n0 + " " + n1 + " " + n2');
        const {trace, error} = await runLoose(ts, [at(500), at(1000)].join('\n'), 1100);
        if (error) return `error: ${error}`;
        const [early, late] = trace.map(t => t.split(' '));
        return early.map((v, i) => (v === late[i] ? 'stopped' : 'running')).join(' ');
    };
    // The original and clone 2 run on; clone 1's loop is ended.
    const ok = seen => seen === 'running stopped running';
    await holds('stop other scripts in a clone (one mark for every instance)', out.ts,
        ts => ts.replace('    s.data["_sm"] = _tokens\n    s.data["_sk"] = t\n',
            '    for (const x of _all_c()) {\n        x.data["_sm"] = _tokens\n        x.data["_sk"] = t\n    }\n'), observe, ok);
});

test('stop all ends every script, deletes the clones, clears bubbles — and the game goes on', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
GLOBAL trace = ""
GLOBAL ticks = 0
GLOBAL starts = 0
SPRITE a:
WHEN flag clicked:
  change starts by 1
  create clone of myself
  create clone of myself
  FOREVER:
    change ticks by 1
    wait 0.1 seconds
WHEN I start as a clone:
  FOREVER:
    change ticks by 1
    wait 0.1 seconds
WHEN I receive "again":
  set trace to (join trace "R")
SPRITE b:
WHEN flag clicked:
  say "hi"
  wait 0.35 seconds
  set trace to (join trace "X")
  stop all
`);
    assert.deepEqual(out.unsupported, []);
    assert.doesNotMatch(out.ts, /game\.over/);
    const observe = async ts => {
        // After the stop, something starts a hat (a key press in a game; the
        // sim has no keys, so the tail broadcasts): its script must run.
        const tail = [
            'control.runInParallel(function () {\n    pause(700)\n    _broadcast("again")\n})',
            traceAt(500, '"" + ticks'),
            traceAt(1000, '"" + trace + " ticks " + ticks + " clones " + sprites.allOfKind(_kind_a).length + " starts " + starts + " sprites " + sprites.allOfKind(SpriteKind.Player).length')
        ].join('\n');
        const {r, trace, error} = await runLoose(ts, tail, 1100);
        if (error) return `error: ${error}`;
        const [t1, state] = trace;
        // A speech bubble is a box in colour 1 (white); nothing else here uses it
        // (its text is colour 15, black, which reads back as the black of 0).
        const bubble = r.screen().some(c => c === 1) ? 1 : 0;
        return state && `${state.replace(/ticks (\d+)/, (m, n) => `ticks ${n === t1 ? 'stopped' : 'running'}`)} bubble ${bubble}`;
    };
    // The game's two sprites stay in the game's scene (not a game-over scene),
    // the flag scripts did not run again (not a restart), and the hat ran.
    const ok = seen => seen === 'XR ticks stopped clones 0 starts 1 sprites 2 bubble 0';
    await holds('stop all (was game.over)', out.ts, ts => ts.replace('    _stopAll()\n    return\n', `    ${OLD_STOP}\n`), observe, ok);
    await holds('stop all (scripts not ended)', out.ts, ts => ts.replace('    _stopMark = _tokens\n', ''), observe, ok);
    await holds('stop all (clones kept)', out.ts, ts => ts.replace('    sprites.destroyAllSpritesOfKind(_kind_a)\n', ''), observe, ok);
    await holds('stop all (bubbles kept)', out.ts, ts => ts.replace('    bSprite.sayText("")\n', ''), observe, ok);
});

test('stop other scripts in stage keeps the stage\'s own mark; an option the exporter does not know is named', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`STAGE:
WHEN flag clicked:
  stop other scripts in sprite
SPRITE a:
WHEN flag clicked:
  stop this script
`, project => {
        const stops = opcodeOf(project, 'control_stop');
        stops[0].fields.STOP_OPTION = ['other scripts in stage', null];
        stops[1].fields.STOP_OPTION = ['everything else', null];
    });
    assert.match(out.ts, /_som_stage = _tokens {2}\/\/ stop other scripts in stage\n\s*_sok_stage = _t/);
    assert.deepEqual(out.unsupported, ['stop everything else']);
    const r = await compileArcadeFiles(out.files);
    assert.ok(r.success, JSON.stringify(r.diagnostics.slice(0, 3)));
});

// ── the mouse: a named refusal ───────────────────────────────────────────
test('the mouse is refused by name, with the reason, and the program still compiles', {skip, timeout: 300000}, async () => {
    const {out} = exportOf(`SPRITE a:
WHEN flag clicked:
  set n to mouse x
  IF mouse down? THEN:
    go to mouse-pointer
WHEN sprite clicked:
  change x by 3
`);
    for (const what of ['mouse x', 'mouse down?', 'go to mouse-pointer', 'when this sprite clicked']) {
        assert.ok(out.unsupported.includes(`${what}: ${MOUSE_WHY}`), `${what} not named: ${out.unsupported.join('\n')}`);
    }
    const r = await compileArcadeFiles(out.files);
    assert.ok(r.success, JSON.stringify(r.diagnostics.slice(0, 3)));
});

test('what stays unmapped keeps a specific name: pen saturation, list monitors, computed clone targets', () => {
    const {out} = exportOf(`SPRITE a:
LIST xs
WHEN flag clicked:
  change pen saturation by 10
  show list xs
  create clone of a
`, project => {
        // The clone target obscured by a variable reporter: known only at run time.
        opcodeOf(project, 'control_create_clone_of')[0].inputs.CLONE_OPTION = [3, [12, 'who', 'whoId'], 'none'];
    });
    const text = out.unsupported.join('\n');
    assert.match(text, /pen hue, saturation, brightness and transparency/);
    assert.match(text, /show list: Arcade has no list monitors/);
    assert.match(text, /create clone of a computed sprite name/);
});


const penSource = 'GLOBAL whichParameter = "color"\nSPRITE a:\nWHEN flag clicked:\n  change pen color by 10\n';
const penExport = patch => exportOf(penSource, project => {
    const block = opcodeOf(project, 'pen_changePenColorParamBy')[0];
    assert.ok(block, 'the actual parser produced the pen parameter block');
    if (patch) patch(block, project);
});

test('static pen hue exports relative and absolute palette changes with an explicit approximation warning', () => {
    for (const [opcode, relative] of [['pen_changePenColorParamBy', true], ['pen_setPenColorParamTo', false]]) {
        const {out} = penExport(block => { block.opcode = opcode; });
        assert.deepEqual(out.unsupported, []);
        assert.ok(out.warnings.includes('Scratch pen hue is quantized to the Arcade palette.'));
        const call = out.ts.match(/_scratchPenHue\([^,\n]+,\s*10,\s*(true|false),\s*__bwScratchHueTable\)/);
        assert.ok(call, 'the exported statement calls the real hue helper and generated palette table');
        assert.equal(call[1], String(relative), opcode);
    }
});

test('unsupported pen parameters, dynamic menu choices and legacy opcodes stay named refusals', () => {
    const variants = [];
    for (const opcode of ['pen_changePenColorParamBy', 'pen_setPenColorParamTo']) {
        for (const parameter of ['saturation', 'brightness', 'transparency']) variants.push({
            label: opcode + ' ' + parameter,
            patch: (block, project) => {
                block.opcode = opcode;
                const menu = project.targets.flatMap(target => Object.entries(target.blocks))
                    .find(([id]) => id === block.inputs.COLOR_PARAM[1])?.[1];
                assert.ok(menu, 'the original pen menu shadow exists');
                menu.fields.colorParam[0] = parameter;
            }
        });
        variants.push({
            label: opcode + ' dynamic parameter',
            patch: (block, project) => {
                block.opcode = opcode;
                const variable = project.targets.flatMap(target => Object.entries(target.variables))
                    .find(([, value]) => value[0] === 'whichParameter');
                assert.ok(variable, 'the dynamic menu uses an actual project variable');
                block.inputs.COLOR_PARAM = [3, [12, 'whichParameter', variable[0]], block.inputs.COLOR_PARAM[1]];
            }
        });
    }
    for (const opcode of ['pen_setPenHueToNumber', 'pen_changePenHueBy',
        'pen_setPenShadeToNumber', 'pen_changePenShadeBy']) variants.push({
        label: opcode,
        patch: block => {
            block.opcode = opcode;
            block.inputs = {[opcode.includes('Shade') ? 'SHADE' : 'HUE']: block.inputs.VALUE};
        }
    });
    for (const {label, patch} of variants) {
        const {out} = penExport(patch);
        assert.match(out.unsupported.join('\n'), /pen hue, saturation, brightness and transparency/, label);
        assert.doesNotMatch(out.ts, /_scratchPenHue\(/, label + ' cannot silently become a supported hue change');
    }
});

test('the emitted hue helper wraps changes and keeps the original palette base; broken variants fail', () => {
    const source = helperSource(new Set(['penHue'])).at(-1);
    const execute = text => new Function(text
        .replace('(sprite: Sprite, value: number, relative: boolean, table: number[][])',
            '(sprite, value, relative, table)')
        .replace('const base: number', 'const base')
        .replace('const previous: number', 'const previous') + '\nreturn _scratchPenHue;')();
    const table = Array.from({length: 100}, (_, hue) => Array.from({length: 16}, (_, base) => (hue + base) % 16));
    const observe = implementation => {
        const sprite = {data: {_pc: 3}}, states = [];
        for (const [value, relative] of [[95, true], [10, true], [-10, false], [-195, true], [200, false]]) {
            implementation(sprite, value, relative, table);
            states.push([sprite.data._pcHue, sprite.data._pcBase, sprite.data._pc]);
        }
        return states;
    };
    const expected = [95, 5, 90, 95, 0].map(hue => [hue, 3, table[hue][3]]);
    assert.deepEqual(observe(execute(source)), expected);
    for (const [before, after] of [
        ['previous + value', 'value'],
        ['((relative ? previous + value : value) % 100 + 100) % 100', '(relative ? previous + value : value)'],
        ['[base]', '[sprite.data["_pc"]]']
    ]) {
        const mutated = source.replace(before, after);
        assert.notEqual(mutated, source, 'each mutation changes the actual emitted helper');
        const implementation = execute(mutated);
        assert.throws(() => assert.deepEqual(observe(implementation), expected),
            'a wrong hue, lost wrap or changed base must fail the same observation');
    }
});
