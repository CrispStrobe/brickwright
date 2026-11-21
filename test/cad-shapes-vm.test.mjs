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

const COLORED = `WHEN green flag clicked:
  cad model "Robot":
    cad color #ff0000:
      cad box 10 by 10 by 10
    cad move x 20 y 0 z 0:
      cad color #0000ff:
        cad box 10 by 10 by 10
`;

test('colours become one code object each; live preview rebuilds after an edit; code exports keep colours', async () => {
    const previousWindow = globalThis.window, previousFlag = process.env.BW_ENABLE_CAD;
    globalThis.window = new EventTarget(); process.env.BW_ENABLE_CAD = '1'; setCadEnabled(true);
    const session = sdk.createCadSession();
    globalThis.__bwCad = {editor: {session, whenIdle: async () => {}}, sdk};
    let cleanup = () => {};
    try {
        const creator = new SB3Creator();
        creator.parse(COLORED);
        const result = await runCreatedProgram(creator, {frames: 20, observeRun: partial => {
            if (partial.state === 'constructed') cleanup = installCadShapesAPI(partial.vm.runtime);
        }});
        assert.deepEqual(result.errors, []);
        const codes = () => session.state.document.roots.map(id => session.state.document.nodes[id]);
        assert.deepEqual(codes().map(n => [n.name, n.color]), [['Robot', '#ff0000'], ['Robot (#0000ff)', '#0000ff']]);
        const api = result.vm.runtime.cadShapes;
        const target = result.vm.runtime.targets.find(t => Object.values(t.blocks._blocks).some(b => b.opcode === 'cadshapes_model'));
        const blocks = Object.values(target.blocks._blocks);
        const model = blocks.find(b => b.opcode === 'cadshapes_model');
        assert.equal(api.modelName(model.id, target), 'Robot');
        // Live preview: an edit (the blue box's width) rebuilds the model without running the script.
        api.setLive(model.id, target, true);
        assert.equal(api.isLive(model.id), true);
        const blue = blocks.filter(b => b.opcode === 'cadshapes_box')[1];
        target.blocks.changeBlock({id: blue.inputs.WIDTH.block, element: 'field', name: 'NUM', value: '30'});
        await new Promise(resolve => setTimeout(resolve, 900));
        assert.match(codes()[1].program.source, /box\(30, 10, 10\)/);
        assert.equal(codes().length, 2);
        api.setLive(model.id, target, false);
        // Show CAD code: all three languages, colours kept natively in OpenSCAD and JSCAD.
        assert.match(await api.exportModel(model.id, target, undefined, 'cadcode'), /box\(30, 10, 10\)/);
        assert.match(await api.exportModel(model.id, target, undefined, 'openscad'), /color\("#0000ff"\) \{/);
        assert.match(await api.exportModel(model.id, target, undefined, 'jscad'), /colorize\(\[0,0,1\]/);
    } finally {
        cleanup();
        delete globalThis.__bwCad; globalThis.window = previousWindow;
        if (previousFlag === undefined) delete process.env.BW_ENABLE_CAD; else process.env.BW_ENABLE_CAD = previousFlag;
    }
});

test('the code dialog shows each language, offers copy and download, and the menu sits on model blocks', async () => {
    const {createRequire} = await import('node:module');
    const requireGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
    const jsdom = requireGui('jsdom');
    const window = (jsdom.JSDOM ? new jsdom.JSDOM('<!doctype html><body></body>').window : jsdom.jsdom('<!doctype html><body></body>').defaultView);
    const {showCadCodeDialog, installCadShapesMenu, enclosingModel} = await import('../overlay/scratch-gui/src/lib/bw-cad-blocks-menu.js');
    const asked = [];
    const dialog = showCadCodeDialog({name: 'Peg board', locale: 'de', doc: window.document,
        exportModel: async format => { asked.push(format); if (format === 'jscad') throw new Error('kaputt'); return `code:${format}`; }});
    await new Promise(resolve => setTimeout(resolve, 0));
    const pre = window.document.querySelector('.bw-cadcode pre');
    assert.equal(pre.textContent, 'code:cadcode');
    assert.match(window.document.querySelector('.bw-cadcode h2').textContent, /CAD-Code von „Peg board“/);
    await dialog.select('openscad');
    assert.equal(pre.textContent, 'code:openscad');
    await dialog.select('jscad');
    assert.equal(pre.className, 'bw-error');
    assert.ok([...window.document.querySelectorAll('.bw-cadcode footer button')].slice(0, 2).every(b => b.disabled), 'no copy/download of an error');
    assert.deepEqual(asked, ['cadcode', 'openscad', 'jscad']);
    const escape = window.document.createEvent('Event');
    escape.initEvent('keydown', true, true);
    escape.key = 'Escape';
    window.document.dispatchEvent(escape);
    assert.equal(window.document.querySelector('.bw-cadcode'), null);

    // The menu: model blocks (and blocks inside them) get the three items, other blocks none.
    const shown = [];
    const ScratchBlocks = {ContextMenu: {show: (e, options) => shown.push(options)},
        BlockSvg: {prototype: {showContextMenu_ (e) { ScratchBlocks.ContextMenu.show(e, [{text: 'Duplicate'}]); }}}};
    const live = new Set();
    const target = {blocks: {getBlock: id => (id === 'm' ? {} : null)}};
    const fakeVm = {editingTarget: target, runtime: {cadShapes: {modelName: () => 'M', isLive: id => live.has(id),
        setLive: (id, t, on) => (on ? live.add(id) : live.delete(id)), build: async () => {}, exportModel: async () => ''}}};
    const menu = installCadShapesMenu(ScratchBlocks, fakeVm, () => 'en');
    const model = {id: 'm', type: 'cadshapes_model', getSurroundParent: () => null};
    const inside = {id: 'b', type: 'cadshapes_box', getSurroundParent: () => model};
    const other = {id: 'x', type: 'looks_say', getSurroundParent: () => null};
    assert.equal(enclosingModel(inside), model);
    for (const block of [inside, other]) ScratchBlocks.BlockSvg.prototype.showContextMenu_.call(block, {});
    assert.deepEqual(shown[0].map(o => o.text), ['Duplicate', 'Build CAD model', 'Show CAD code…', 'Live preview']);
    assert.deepEqual(shown[1].map(o => o.text), ['Duplicate']);
    shown[0][3].callback();
    assert.ok(live.has('m'));
    menu.uninstall();
    ScratchBlocks.BlockSvg.prototype.showContextMenu_.call(inside, {});
    assert.deepEqual(shown[2].map(o => o.text), ['Duplicate']);
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
