// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {readPython, readJavaScript} from '../overlay/scratch-gui/src/lib/robot-lab-pseudocode.js';
import {CADLAB_WORDS} from '../overlay/scratch-gui/src/lib/cadLabDialect.js';
const PROGRAM = `WHEN green flag clicked:
  cad start
  cad set motor A power to 50 %
  cad run motor A at -180 degrees per second
  cad run motor A for 720 degrees at 360 degrees per second
  cad stop motor A coast
  say (cad motor A angle)
  say (cad motor A speed)
  say (cad status)
  cad stop
  cad reset
`;
const compile = text => { const c = new SB3Creator(); c.parse(text); return c.project; };
const semantic = project => project.targets.flatMap(t => Object.values(t.blocks || {}))
    .map(b => ({op:b.opcode, fields:b.fields, values:Object.fromEntries(Object.entries(b.inputs || {}).map(([k,v]) => [k,Array.isArray(v[1]) ? v[1] : typeof v[1]]))}))
    .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
test('CAD motor words compile with every block and correct menu shadows, and round trip in all code views', () => {
    const p = compile(PROGRAM);
    const blocks = p.targets.flatMap(t => Object.values(t.blocks || {}));
    assert.deepEqual([...new Set(blocks.filter(b => /^cadlab_(?!menu_)/.test(b.opcode)).map(b => b.opcode))].sort(), CADLAB_WORDS.map(w=>w.op).sort());
    assert.deepEqual(p.extensions, ['cadlab']);
    assert.ok(blocks.some(b=>b.opcode==='cadlab_menu_motors'));
    assert.deepEqual(semantic(compile(new SB3Creator().decompile(p))), semantic(p));
    for (const [method,reader] of [['generatePython',readPython],['generateJavaScript',readJavaScript]]) {
        const text = new SB3Creator()[method](p,{events:true});
        assert.match(text, /_cadlab\.runMotorDegrees\("A", 720, 360\)/);
        const result = reader(text);
        assert.deepEqual(result.warnings, []);
        assert.deepEqual(semantic(compile(result.pseudocode)),semantic(p));
    }
});
