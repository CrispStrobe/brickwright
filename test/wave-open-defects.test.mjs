import {packageSourceFile} from './helpers/package-source.mjs';
/**
 * The lite half of the seven lesson-review waves' open defects.
 *
 * `docs/WAVE-OPEN-DEFECTS.md` is one table of every defect the seven reviews
 * left open, sorted by lessons affected. This gate holds the rows lite owns:
 * each FIXED row is asserted fixed, and the counts in the table are re-derived
 * from the wave JSON rather than trusted, so a lesson that stops naming a
 * defective bench takes the count down with it.
 *
 * Source-text assertions are used where the claim IS about the source — "the
 * GUI never calls bindToVariable" is a claim about calls, and the only honest
 * way to check it without a browser is to look. Where the claim is about
 * behaviour, the behaviour is executed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {ControllerPanel, WIDGET_TYPES, WIDGET_DEFAULTS, DECORATION_TYPES}
    from 'bw-board/controller.js';
import {balancedAfter} from './helpers/js-scope.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUI = path.join(REPO, 'overlay/scratch-gui/src');
const EX = path.join(REPO, 'overlay/scratch-gui/examples');
const DOC = path.join(REPO, 'docs/WAVE-OPEN-DEFECTS.md');
const WAVES = path.join(GUI, 'components/gui/lesson-waves');

const read = rel => readFileSync(path.join(GUI, rel), 'utf8');
const panelView = () => read('components/tw-pseudocode/controller-panel-view.jsx');
const simPane = () => read('components/tw-pseudocode/microbit-sim-pane.jsx');

const allLessons = () => readdirSync(WAVES)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => JSON.parse(readFileSync(path.join(WAVES, f), 'utf8')).lessons);

// ── The document itself ────────────────────────────────────────────────────

test('the open-defect table exists and every row carries an owner and a count', () => {
    assert.ok(existsSync(DOC), 'docs/WAVE-OPEN-DEFECTS.md is missing');
    const rows = readFileSync(DOC, 'utf8')
        .split('\n')
        .filter(l => /^\| \*\*D\d+\*\* \|/.test(l));
    assert.ok(rows.length >= 30, `only ${rows.length} defect rows — the table lost content`);
    const owners = new Set(['lite', 'bw-board', 'bw-circuit-ui', 'sb3-creator']);
    for (const row of rows) {
        const cells = row.split('|').map(c => c.trim());
        const [, id, , owner, lessons] = cells;
        assert.ok([...owners].some(o => owner.includes(o)),
            `${id}: owner ${JSON.stringify(owner)} names no known repo`);
        assert.match(lessons, /^\*\*\d+\*\*$/, `${id}: lessons-affected is not a bare count`);
    }
    // Sorted by lessons affected, descending — that is the document's whole
    // organising claim and it is cheap to hold.
    const counts = rows.map(r => Number(r.split('|')[4].replace(/\D/g, '')));
    for (let i = 1; i < counts.length; i++) {
        assert.ok(counts[i] <= counts[i - 1],
            `the table is not sorted by lessons affected: row ${i + 1} has ${counts[i]} ` +
            `after ${counts[i - 1]}`);
    }

    // The totals in the prose are re-derived, not trusted. The first draft of
    // this document said 48 closed lesson-slots where the rows add to 39 —
    // a summary number nobody had computed, in a document whose entire point
    // is that summary numbers go uncounted.
    const text = readFileSync(DOC, 'utf8');
    const closed = rows.filter(r => /FIXED|EXPIRED/.test(r.split('|')[6]));
    const closedSlots = closed.reduce((n, r) => n + Number(r.split('|')[4].replace(/\D/g, '')), 0);
    const total = counts.reduce((a, b) => a + b, 0);
    assert.ok(text.includes(`**${closedSlots} of the ${total}`),
        `the prose does not say "${closedSlots} of the ${total} lesson-slots" — the rows and ` +
        'the summary disagree');
    for (const [n, word] of [[closed.length, 'closed']]) {
        assert.ok(text.includes(`Ten are closed`) === (n === 10),
            `${n} rows are ${word} but the prose still says Ten`);
    }

    // The per-owner "Closed here" column must name only rows the State column
    // agrees are closed. Two hand-maintained lists of the same set is exactly
    // how a table starts lying.
    const closedIds = new Set(closed.map(r => r.split('|')[1].trim().replace(/\*/g, '')));
    for (const line of text.split('\n')) {
        if (!/^\| (bw-board|lite|bw-circuit-ui|sb3-creator) \|/.test(line)) continue;
        const cells = line.split('|').map(c => c.trim());
        const claimed = cells[4].match(/D\d+/g) || [];
        for (const id of claimed) {
            assert.ok(closedIds.has(id),
                `the owner table says ${cells[1]} closed ${id}, but its row is not marked ` +
                'FIXED or EXPIRED');
        }
    }
});

// ── D1: 28 checkpoints observe an event that fires before they are read ────

test('D1 count: the checkpoints that observe circuit-ready are still 28 lessons', () => {
    const lessons = allLessons().filter(l =>
        (l.checkpoints || []).some(c => c.observe && c.observe.event === 'circuit-ready'));
    assert.equal(lessons.length, 28,
        `${lessons.length} lessons observe circuit-ready, not the 28 the table records — ` +
        're-measure docs/WAVE-OPEN-DEFECTS.md');
});

test('D1 FIXED: circuit-ready arms a checkpoint rather than completing it', () => {
    const src = read('components/gui/guided-lessons.jsx');
    assert.match(src, /const ARMING_EVENTS = new Set\(\['circuit-ready'\]\)/,
        'guided-lessons.jsx no longer names circuit-ready as an ARMING event. It fires once ' +
        'when the example loads, so a checkpoint that COMPLETES on it ticks itself before ' +
        'the learner has measured anything.');
    assert.match(src, /const arming = ARMING_EVENTS\.has\(checkpoint\.observe\.event\)/,
        'the observable listener no longer asks whether the event is an arming one');
    // SAME BLOCK, not the same LINE. The old assertion pinned the exact
    // one-line spelling, so inserting any statement into the block -- which the
    // React update-source work does routinely -- split the line and turned this
    // red while the behaviour was untouched. Species 1 running BACKWARDS: a
    // source-text match tracking spelling rather than behaviour, producing a
    // false failure instead of a false pass. `\{?[^}]*?` accepts the braced and
    // unbraced forms and allows inserted statements, while forbidding a closing
    // brace between condition and effect -- so the effect must still be INSIDE
    // the condition, which is the actual claim.
    assert.match(src, /if \(arming\)\s*\{?[^}]*?setArmed\(/,
        'an arming event no longer arms — check that it does not complete() instead');
});

// ── D5: the faceplate mode ─────────────────────────────────────────────────

test('D5 FIXED: every shipped layout with an operable control opens in play mode', () => {
    const INPUTS = new Set(['button', 'slider', 'joystick', 'dpad', 'dial', 'keypad', 'keyboard']);
    const dead = [];
    let noController = 0; // examples without a controller.json: reported below, not a silent skip
    for (const dir of readdirSync(EX, {withFileTypes: true}).filter(d => d.isDirectory())) {
        const file = path.join(EX, dir.name, 'controller.json');
        if (!existsSync(file)) { noController++; continue; }
        const data = JSON.parse(readFileSync(file, 'utf8'));
        if (!(data.widgets || []).some(w => INPUTS.has(w.type))) continue;
        if (data.mode !== 'play') dead.push(dir.name);
    }
    assert.deepEqual(dead, [],
        'these faceplates open in edit mode, where every input control renders disabled: ' +
        dead.join(', '));
});

test('D5 FIXED: the mode survives a save, and both restore paths apply it', () => {
    const panel = new ControllerPanel();
    panel.addWidget('go', 'button');
    panel.setMode('play');
    assert.equal(ControllerPanel.fromJSON(panel.toJSON()).mode, 'play',
        'the panel model drops the mode on a round trip, so the example fix is lost on ' +
        'the first save');
    assert.match(read('components/gui/gui.jsx'), /controllerPanel\.setMode\(restored\.mode\)/,
        'the PROJECT_LOADED restore does not apply the mode');
    assert.match(read('components/tw-pseudocode/pseudocode-importer.jsx'),
        /panel\.setMode\(layout\.mode\)/,
        'the example importer does not apply the mode');
});

// ── D14 / D15: the widget inspector ────────────────────────────────────────

test('D14 FIXED: the inspector edits functional config, not only decoration', () => {
    const view = panelView();
    const edited = new Set([...view.matchAll(/onConfig\(\{\s*\[?([A-Za-z.]+)/g)].map(m => m[1]));
    assert.ok(edited.has('f.key'),
        'the inspector no longer renders a generic config field. It once edited only ' +
        '`color`, `fontSize`, `src` and `text` — all decoration — while a button\'s ' +
        '`toggle` and a slider\'s range were reachable only by hand-editing JSON.');
    assert.match(view, /CONFIG_FIELDS = \{/, 'the config-field table is gone');
    assert.match(view, /button:\s*\[\{ key: 'toggle'/,
        'a button\'s toggle contract has no editor again');
});

test('D14 FIXED: every configurable key of every widget type has an editor or a stated reason', () => {
    // The table in the view is UI (labels, ordering, step sizes); THIS is the
    // contract. A widget type that grows a config key and no editor fails here
    // rather than quietly becoming JSON-only, which is exactly how the whole
    // functional half went missing unnoticed.
    const view = panelView();
    const fieldsFor = type => {
        const block = view.match(new RegExp(`\\n    ${type}: (\\[[^\\]]*\\]|\\[[\\s\\S]*?\\n    \\]),`));
        if (!block) return [];
        return [...block[1].matchAll(/key: '([A-Za-z]+)'/g)].map(m => m[1]);
    };
    const nonField = new Set([...balancedAfter(view, 'NON_FIELD_CONFIG_KEYS = new Set(')
        .matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]));
    assert.ok(nonField.size > 0, 'NON_FIELD_CONFIG_KEYS is gone — the exclusions are unstated again');

    const missing = [];
    for (const type of Object.values(WIDGET_TYPES)) {
        const editable = new Set(fieldsFor(type));
        for (const key of Object.keys(WIDGET_DEFAULTS[type] || {})) {
            if (editable.has(key) || nonField.has(key)) continue;
            missing.push(`${type}.${key}`);
        }
    }
    assert.deepEqual(missing, [],
        'these config keys have no inspector field and no stated reason not to: ' +
        missing.join(', '));
});

test('D15 FIXED: a widget can be re-bound from the app, to each target the model has', () => {
    const view = panelView();
    for (const call of ['bindToVariable', 'bindToPart', 'bindToPin', 'bindToProgram', 'unbind']) {
        assert.match(view, new RegExp(`panel\\.${call}\\(`),
            `the panel UI never calls ${call}. Removing a widget and adding it back then ` +
            'silently converts a variable binding into a program binding, and only ' +
            'reloading the example restores it.');
    }
    assert.match(view, /onBind=\{/, 'the inspector is not handed a bind callback');
    assert.match(view, /data-testid="bw-ctl-insp-bind-target"/, 'there is no target selector');
});

test('D15: the decoration types the inspector hides a binding for match the model', () => {
    const view = panelView();
    const declared = [...view.match(/DECORATION_NAMES = new Set\(\[([^\]]*)\]\)/)[1]
        .matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    assert.deepEqual(declared.sort(), [...DECORATION_TYPES].sort(),
        'the view\'s decoration list has drifted from the model\'s DECORATION_TYPES');
});

// ── D16: the micro:bit simulator's sensors ─────────────────────────────────

test('D16 FIXED: the sim pane posts set_value, so a simulated sensor can be varied', () => {
    const pane = simPane();
    const sent = new Set([...pane.matchAll(/postMessage\(\{kind: '([a-z_]+)'/g)].map(m => m[1]));
    assert.ok(sent.has('set_value'),
        'MicrobitSimPane posts ' + [...sent].sort().join(', ') + ' and not set_value, so the ' +
        'temperature is 21 °C and the light level 127 for ever');
    assert.match(pane, /data-testid="bw-microbit-sensors"/, 'there is no sensor control strip');
});

test('D16 FIXED: the ranges come from the simulator, not from a second declaration', () => {
    const pane = simPane();
    // A hard-coded range here would be a second copy of a contract the bundle
    // already states, free to drift from it — and the lesson this fix serves
    // (interactive-sensor-capability) is precisely about reading a sensor's
    // unit, range and default off the thing that implements it.
    assert.ok(!/-5,\s*50|0,\s*255/.test(pane),
        'the pane hard-codes a sensor range instead of reading the simulator\'s ready frame');
    assert.match(pane, /readSensors/, 'the ready-frame reader is gone');
    for (const id of ['temperature', 'lightLevel', 'soundLevel', 'gesture']) {
        assert.ok(pane.includes(`'${id}'`), `${id} is no longer offered a control`);
    }
});

test('D16: every sensor the pane offers is one the simulator can actually set', () => {
    const sim = readFileSync(
        path.join(GUI, '../static/microbit-sim/build/simulator.js'), 'utf8');
    const pane = simPane();
    const offered = [...balancedAfter(pane, 'const SENSOR_IDS =')
        .matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]);
    assert.ok(offered.length >= 6, `only ${offered.length} sensors offered`);
    for (const id of offered) {
        assert.ok(sim.includes(`case "${id}":`),
            `the pane offers a control for ${id}, which the simulator's setValue switch ` +
            'does not handle — the write would be silently dropped');
    }
});

test('D16: the pane clamps before posting, because the simulator THROWS out of range', () => {
    const pane = simPane();
    assert.match(pane, /Math\.max\(s\.min, Math\.min\(s\.max/,
        'an unclamped set_value does not just fail: RangeSensor.setValue throws, and the ' +
        'simulator\'s message listener has no try/catch around the dispatch, so it takes ' +
        'the listener down and every later message with it');
});

// ── D33: a widget type an example declared, and the restore that emptied ───

test('D33 FIXED: every type every shipped layout declares is a type the panel has', () => {
    const bad = [];
    for (const dir of readdirSync(EX, {withFileTypes: true}).filter(d => d.isDirectory())) {
        const file = path.join(EX, dir.name, 'controller.json');
        if (!existsSync(file)) continue;
        for (const w of JSON.parse(readFileSync(file, 'utf8')).widgets || []) {
            if (!WIDGET_DEFAULTS[w.type]) bad.push(`${dir.name}: ${w.type}`);
        }
    }
    assert.deepEqual(bad, [],
        'addWidget throws on these, and both restore loops remove every existing widget ' +
        'BEFORE they add any: ' + bad.join(', '));
});

test('D33 FIXED: one bad widget no longer empties the panel', () => {
    // Both restore paths call addWidget in a loop AFTER removing every widget
    // that was there. A throw inside that loop used to reach an outer bare
    // `catch` and leave the panel with nothing at all. The claim being checked
    // is "every addWidget call site in a restore loop is individually
    // guarded", so it is checked by looking at what precedes each call.
    for (const [file, rel] of [
        ['components/tw-pseudocode/pseudocode-importer.jsx', 'the example importer'],
        ['components/gui/gui.jsx', 'the PROJECT_LOADED restore']
    ]) {
        const src = read(file);
        const sites = [...src.matchAll(/\.addWidget\(/g)].map(m => m.index);
        assert.ok(sites.length > 0, `${rel} no longer calls addWidget`);
        for (const at of sites) {
            const before = src.slice(Math.max(0, at - 220), at);
            assert.match(before, /\btry\s*\{/,
                `${rel} calls addWidget with no try in the preceding lines, so one bad ` +
                'widget empties the panel it has already cleared');
        }
    }
});

test('D33 FIXED: the terminal face is tail-anchored, and the panel renders it', () => {
    const panel = new ControllerPanel();
    panel.addWidget('screen', 'terminal', {rows: 2, cols: 6});
    panel.setTerminalText('screen', 'one\ntwo\nthree');
    assert.deepEqual(panel.getTerminalRows('screen'), ['two   ', 'three ']);
    const view = panelView();
    assert.match(view, /function TerminalWidget\(\{ widget \}\)/, 'the panel has no terminal face');
    assert.match(view, /<TerminalWidget widget=\{widget\} \/>/, 'the terminal face is never rendered');
    assert.match(view, /const out = wrapped\.slice\(-rows\)/,
        'the terminal face is not tail-anchored: a growing transcript anchored at line 0 ' +
        'freezes on the first screenful');
    assert.match(view, /widget\.type === 'terminal'/, 'the terminal face is never mounted');
});

// ── D19 / D17 / D34: bw-board fixes, checked through lite's vendored copy ──
//
// The measurements live in bw-board's own gate. What matters HERE is that the
// vendored copy is the fixed one — lite ships what it vendored, not what
// upstream has.

test('the vendored bw-board carries the fixes lite depends on', () => {
    const bwb = rel => readFileSync(packageSourceFile(`bw-board/${rel}`), 'utf8');
    assert.match(bwb('mna.js'), /bjtRegions\.get\(part\.id\) === 'saturated'/,
        'D19: the vendored solver still reports beta*Ib on a saturated collector');
    assert.match(bwb('mna.js'), /part\.kind === 'button' \|\| part\.kind === 'switch'/,
        'D19: the vendored solver still reports a flat 0 for a button terminal');
    assert.match(bwb('devices/i2c-parts.js'), /control\(part, state, verb, value\)/,
        'D17: the vendored char_lcd_i2c has no control handler');
    // `branchCurrents(part, state, read)` gained a fourth parameter, tSeconds,
    // in bw-board 93703dad (2026-11-23: the back-EMF is a ramp across the step,
    // so the reported current reads the EMF at the solve's time). The reporting
    // did not go away; the exact-signature probe went stale. Match the hook by
    // name and its first three parameters, and hold the BEHAVIOUR below.
    assert.match(bwb('devices/dc-motor.js'), /branchCurrents\(part, state, read\b/,
        'D19: the vendored dc_motor reports no terminal currents');
});

test('D19: a running dc_motor reports the current of the series loop it is in', async () => {
    // pc26-motor-clamp: vsource -> sw1 -> l1 -> motor1 -> ground. One series
    // loop, so the motor's terminals must carry exactly the switch's current,
    // and it must not be zero while the switch is closed. Measured 0.8998 A at
    // 10 ms on bw-board 489ca7c6 (9 V over the 10 Ω winding, back-EMF rising).
    const {load} = await import('../scripts/lesson-bench.mjs');
    const {board, circuit} = await load('pc26-motor-clamp');
    circuit.setControl('sw1', 1);
    board.advanceTo(10_000_000n);
    const motor = board.branchCurrent('motor1', 'b');
    const sw = board.branchCurrent('sw1', 'b');
    assert.ok(Math.abs(motor) > 0.5, `the running motor reports ${motor} A — no terminal current`);
    assert.ok(Math.abs(motor - sw) < 1e-6,
        `motor1.b ${motor} A disagrees with sw1.b ${sw} A in the same series loop`);
    assert.ok(Math.abs(board.branchCurrent('motor1', 'a') + motor) < 1e-9,
        'what enters one motor terminal must leave the other');
});
