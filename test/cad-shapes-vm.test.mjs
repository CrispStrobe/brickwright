// SPDX-License-Identifier: BSD-3-Clause
// The CAD shapes blocks end to end: pseudocode -> SB3 -> the real Scratch VM -> green flag ->
// runtime.cadShapes (lib/bw-cad-blocks.js) -> the pinned Brickwright CAD SDK -> a code body.
import test from 'node:test';
import assert from 'node:assert/strict';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {installCadShapesAPI, blocksToCadProgram} from '../overlay/scratch-gui/src/lib/bw-cad-blocks.js';
import {CAD_READY_EVENT} from '../overlay/scratch-gui/src/lib/bw-cad-program.js';
import {setCadEnabled} from '../overlay/scratch-gui/src/lib/bw-cad-preferences.js';
import {runCreatedProgram} from './helpers/bw-vm.mjs';
import * as sdk from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

const PROGRAM = `WHEN green flag clicked:
  set holes to 4
  set spacing to 12
  cad model "Peg board":
    set pos to (0 - ((holes - 1) * spacing / 2))
    cad box (holes * spacing) by 20 by 4
    REPEAT holes:
      cad move x pos y 0 z 0:
        cad hole:
          cad cylinder radius 3 height 10 sides 48
      change pos by spacing
    IF holes > 3 THEN:
      cad move x 0 y 12 z 0:
        cad text "BW" size 6 height 2
`;

async function run (program, session) {
    const creator = new SB3Creator();
    creator.parse(program);
    assert.deepEqual(creator.warnings || [], []);
    let cleanup = () => {};
    const result = await runCreatedProgram(creator, {frames: 20, observeRun: partial => { if (partial.state === 'constructed') cleanup = installCadShapesAPI(partial.vm.runtime); }});
    cleanup();
    return result;
}

test('a model C-block compiles through the VM and the CAD SDK into one updatable parametric code body', async () => {
    const previousWindow = globalThis.window, previousFlag = process.env.BW_ENABLE_CAD;
    globalThis.window = new EventTarget(); process.env.BW_ENABLE_CAD = '1'; setCadEnabled(true);
    const session = sdk.createCadSession();
    globalThis.__bwCad = {editor: {session, whenIdle: async () => {}}, sdk};
    try {
        window.dispatchEvent(new CustomEvent(CAD_READY_EVENT));
        const first = await run(PROGRAM, session);
        assert.deepEqual(first.errors, []);
        const codes = Object.values(session.state.document.nodes).filter(n => n.kind === 'code');
        assert.equal(codes.length, 1);
        assert.equal(codes[0].name, 'Peg board');
        const source = codes[0].program.source;
        // holes and spacing are read, never set, inside the model: they become parameters.
        assert.match(source, /param holes: scalar = 4;/);
        assert.match(source, /param spacing: scalar = 12;/);
        assert.match(source, /forRange\(k, 0, round\(holes\) - 1, 1,/);
        assert.match(source, /choose\(holes > 3,/);
        assert.match(source, /text2d\("BW"/);
        // Running again with a changed program updates the same body (one object, new source).
        await run(PROGRAM.replace('set holes to 4', 'set holes to 6'), session);
        const again = Object.values(session.state.document.nodes).filter(n => n.kind === 'code');
        assert.equal(again.length, 1);
        assert.equal(again[0].id, codes[0].id);
        assert.match(again[0].program.source, /param holes: scalar = 6;/);
    } finally {
        delete globalThis.__bwCad; globalThis.window = previousWindow;
        if (previousFlag === undefined) delete process.env.BW_ENABLE_CAD; else process.env.BW_ENABLE_CAD = previousFlag;
    }
});

test('the walker reports blocks that cannot be part of a model, by block id', () => {
    const blocks = {
        m: {id: 'm', opcode: 'cadshapes_model', inputs: {SUBSTACK: {block: 's'}}, fields: {}, next: null},
        s: {id: 's', opcode: 'looks_say', inputs: {}, fields: {}, next: null}
    };
    assert.throws(() => blocksToCadProgram(id => blocks[id], 'm', () => null, 'M'), e => e.blockId === 's' && /cannot be used inside a CAD model/.test(e.message));
});

test('extension input defaults match the pinned SDK shape table', async () => {
    const {loadExtensionClass} = await import('./helpers/bw-extensions.mjs');
    const {CADSHAPES_WORDS} = await import('../overlay/scratch-gui/src/lib/cadShapesDialect.js');
    const Ext = loadExtensionClass('cadshapes'), info = new Ext({}).getInfo();
    for (const entry of CADSHAPES_WORDS.filter(e => e.shape)) {
        const block = info.blocks.find(b => b.opcode === entry.op.replace('cadshapes_', ''));
        assert.ok(block, entry.op);
        const defaults = Object.fromEntries(sdk.BLOCK_SHAPES[entry.shape].args);
        for (const [input, arg] of Object.entries(entry.args)) assert.equal(block.arguments[input].defaultValue, defaults[arg], `${entry.op} ${input}`);
    }
    // Every extension block has a word and the reverse.
    const opcodes = info.blocks.filter(b => typeof b === 'object').map(b => `cadshapes_${b.opcode}`).sort();
    assert.deepEqual(opcodes, CADSHAPES_WORDS.map(e => e.op).sort());
});
