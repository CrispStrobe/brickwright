// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CADSHAPES_WORDS} from '../overlay/scratch-gui/src/lib/cadShapesDialect.js';
import pythonToPseudocode from '../overlay/scratch-gui/src/lib/sb3-creator-python.js';
import javascriptToPseudocode from '../overlay/scratch-gui/src/lib/sb3-creator-javascript.js';
import {execFileSync, spawnSync} from 'node:child_process';
import vm from 'node:vm';

export const PEG_BOARD = `WHEN green flag clicked:
  set pos to 0
  cad model "Peg board":
    cad box (holes * 12) by 20 by 4
    REPEAT holes:
      cad move x pos y 0 z 0:
        cad hole:
          cad cylinder radius 3 height 10 sides 48
        cad move x 0 y 0 z 4:
          cad star points 5 radius 3 inner 1.5 height 2
      change pos by 12
    cad count with i from 1 to 3 by 1:
      cad rotate x 0 y 0 z (i * 30):
        cad mirror y:
          cad group:
            cad wedge 2 by 3 by 4
            cad intersect:
              cad sphere radius 2 sides 24
              cad hull:
                cad cone radius 1 top 0 height 3 sides 24
    cad scale x 1 y 1 z 2:
      cad color #ff8800:
        cad half sphere radius 2 sides 24
      cad tube radius 4 wall 1 height 2 sides 24
      cad torus radius 4 thickness 1 sides 24
      cad roof 2 by 2 by 2
      cad round roof 2 by 2 by 1
      cad pyramid base 2 height 2
      cad polygon radius 2 sides 6 height 2
      cad heart size 4 height 1
      cad paraboloid radius 2 height 3 sides 24
      cad text "Hi" size 5 height 1
  say (cad model status)
`;
const compile = text => { const c = new SB3Creator(); c.parse(text); return c; };
const blocksOf = project => project.targets.flatMap(t => Object.values(t.blocks || {}));
const semantic = project => blocksOf(project)
    .map(b => ({op: b.opcode, fields: Object.fromEntries(Object.entries(b.fields || {}).map(([k, v]) => [k, v[0]])), values: Object.fromEntries(Object.entries(b.inputs || {}).map(([k, v]) => [k, Array.isArray(v[1]) ? (v[1][0] === 12 || v[1][0] === 13 ? v[1].slice(0, 2) : v[1]) : typeof v[1]]))}))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

test('every CAD shapes word compiles to its block, with C-block bodies, and round trips through pseudocode', () => {
    const c = compile(PEG_BOARD);
    assert.deepEqual(c.warnings || [], []);
    const p = c.project, blocks = blocksOf(p);
    const used = new Set(blocks.map(b => b.opcode).filter(op => op.startsWith('cadshapes_')));
    assert.deepEqual([...used].sort(), CADSHAPES_WORDS.map(w => w.op).sort());
    const byOp = op => blocks.find(b => b.opcode === op);
    const model = byOp('cadshapes_model');
    assert.equal(model.inputs.NAME[1][1], 'Peg board');
    assert.equal(model.inputs.SUBSTACK[1], Object.entries(p.targets.find(t => t.blocks[model.inputs.SUBSTACK[1]]).blocks).find(([, b]) => b.opcode === 'cadshapes_box')[0]);
    assert.ok(byOp('cadshapes_hole').inputs.SUBSTACK, 'hole has a body');
    assert.deepEqual(byOp('cadshapes_mirror').fields.AXIS, ['y', null]);
    assert.deepEqual(byOp('cadshapes_countWith').inputs.VAR, [1, [10, 'i']]);
    const text = new SB3Creator().decompile(p);
    assert.match(text, /cad move x pos y 0 z 0:\n\s+cad hole:\n\s+cad cylinder radius 3 height 10 sides 48/);
    assert.match(text, /cad text "Hi" size 5 height 1/);
    const again = semantic(compile(text).project), first = semantic(p);
    for (let i = 0; i < first.length; i++) assert.deepEqual(again[i], first[i], `${text}`);
    assert.equal(again.length, first.length);
});

test('motor words of the cadlab dialect still read alongside the modelling words', () => {
    const c = compile('WHEN green flag clicked:\n  cad start\n  cad model "M":\n    cad box 1 by 2 by 3\n  cad stop\n');
    assert.deepEqual(c.warnings || [], []);
    const ops = blocksOf(c.project).map(b => b.opcode);
    for (const op of ['cadlab_startSimulation', 'cadlab_stopSimulation', 'cadshapes_model', 'cadshapes_box']) assert.ok(ops.includes(op), op);
});

test('Python and JavaScript views keep C-block bodies and read back to the same blocks', () => {
    const c = compile(PEG_BOARD), first = semantic(c.project);
    const py = c.generatePython(c.project), js = c.generateJavaScript(c.project);
    assert.match(py, /with _cadshapes\.model\("Peg board"\):\n\s+_cadshapes\.box\(\(holes \* 12\), 20, 4\)/);
    assert.match(py, /with _cadshapes\.hole\(\):\n\s+_cadshapes\.cylinder\(3, 10, 48\)/);
    assert.match(py, /with _cadshapes\.color\("#ff8800"\):/);
    assert.match(js, /_cadshapes\.move\(pos, 0, 0, \(\) => \{\n\s+_cadshapes\.hole\(\(\) => \{/);
    for (const [language, read, source] of [['Python', pythonToPseudocode, py], ['JavaScript', javascriptToPseudocode, js]]) {
        const back = read(source);
        assert.deepEqual(back.warnings, [], language);
        const again = semantic(compile(back.pseudocode).project);
        assert.equal(again.length, first.length, language);
        for (let i = 0; i < first.length; i++) assert.deepEqual(again[i], first[i], `${language}\n${back.pseudocode}`);
    }
    // The generated code runs: each body once, through the driver stub.
    const logs = [];
    vm.runInNewContext(js, {console: {log: m => logs.push(m)}});
    assert.deepEqual(logs, ['not-open']);
    if (spawnSync('python3', ['--version']).status === 0) {
        assert.equal(execFileSync('python3', ['-c', py], {encoding: 'utf8'}).trim(), 'not-open');
    }
});

test('unknown _cadshapes calls and bodies are refused by name, not guessed', () => {
    const back = pythonToPseudocode('def when_flag_clicked():\n    with _cadshapes.wobble(1):\n        pass\n    with _cadshapes.group():\n        _cadshapes.box(1, 2)\n\nwhen_flag_clicked()\n');
    assert.ok(back.warnings.some(w => /_cadshapes\.wobble/.test(w)), back.warnings.join());
    assert.ok(back.warnings.some(w => /_cadshapes\.box/.test(w)), back.warnings.join());
    const mirror = javascriptToPseudocode('function when_flag_clicked() {\n  _cadshapes.mirror("w", () => { _cadshapes.box(1, 2, 3); });\n}\nwhen_flag_clicked();\n');
    assert.ok(mirror.warnings.some(w => /_cadshapes\.mirror/.test(w)), mirror.warnings.join());
});
