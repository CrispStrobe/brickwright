// SPDX-License-Identifier: BSD-3-Clause
// Arcade palette structure: sections, basic/"show more" split, hidden plumbing, rail sub-categories.
// Presentation only: every opcode stays registered, so saved projects and the importer are unaffected.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {quietConsole} from './helpers/quiet-console.mjs';

quietConsole();
const {VM} = await import('./helpers/spike-arena-vm.mjs');
const {loadExtensionClass, bundledExtensionIds} = await import('./helpers/bw-extensions.mjs');
const Arcade = loadExtensionClass(bundledExtensionIds().get('arcade'));
const palette = createRequire(import.meta.url)('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/palette.js');

const makeVm = () => {
    const vm = new VM();
    const extension = new Arcade(vm.runtime);
    vm.extensionManager._loadedExtensions.set('arcade', vm.extensionManager._registerInternalExtension(extension));
    return {vm, extension};
};
const sections = blocks => {
    const result = new Map();
    let current = null;
    for (const block of blocks) {
        if (block && block.blockType === 'label') { current = {label: block, blocks: [], button: null}; result.set(block.text, current); }
        else if (block && block.blockType === 'button') current.button = block;
        else if (block && block.opcode) current.blocks.push(block);
    }
    return result;
};

test('every Arcade opcode is placed in a section or is plumbing or a hidden alias, exactly once', () => {
    const {extension} = makeVm();
    const listed = palette.SECTIONS.flatMap(section => [...section[3], ...section[4]]).filter(name => name !== '---');
    assert.equal(new Set(listed).size, listed.length, 'an opcode is listed twice');
    const opcodes = extension.getInfo().blocks.filter(block => block && block.opcode).map(block => block.opcode);
    const unplaced = opcodes.filter(name => !listed.includes(name) && !palette.PLUMBING.has(name) && !palette.HIDDEN_ALIASES.has(name));
    assert.deepEqual(unplaced, [], 'new Arcade blocks need a section in arcade/palette.js (or PLUMBING if the importer alone emits them, or HIDDEN_ALIASES for a pure duplicate)');
    assert.deepEqual([...listed, ...palette.PLUMBING, ...palette.HIDDEN_ALIASES].filter(name => !opcodes.includes(name)), []);
    assert.deepEqual([...palette.HIDDEN_ALIASES].filter(name => listed.includes(name) || palette.PLUMBING.has(name)), [], 'a hidden alias is listed in a section or in PLUMBING');
});

test('reset and completed music, prompt and high-score commands have their owning palette section', () => {
    for (const [opcode, owner] of [['resetGame','game'], ['askForNumberLength','game'], ['askForStringLength','game'], ['setGameStats','game'], ['withoutNullSprites','sprites'], ['playNoteMelody','music'], ['highScore','info']]) {
        const section = palette.SECTIONS.find(row => row[0] === owner);
        assert.ok([...section[3], ...section[4]].includes(opcode), opcode);
    }
});

test('sections show 5 to 10 basic blocks, hide the rest, and keep plumbing out of the palette', () => {
    const {extension} = makeVm();
    const info = extension.getInfo();
    const bySection = sections(info.blocks);
    assert.equal(bySection.size, palette.SECTIONS.length);
    for (const [name, section] of bySection) {
        const visible = section.blocks.filter(block => !block.hideFromPalette).length;
        assert.ok(visible >= 5 && visible <= 10, `${name} shows ${visible} basic blocks`);
        assert.ok(section.button, `${name} has a show-more button`);
        assert.ok(section.blocks.some(block => block.hideFromPalette));
    }
    for (const name of [...palette.PLUMBING, ...palette.HIDDEN_ALIASES]) assert.equal(info.blocks.find(block => block && block.opcode === name).hideFromPalette, true, name);
    assert.equal(info.id, 'arcade');
});

test('the toggle expands one section, is remembered, and tolerates missing storage', () => {
    palette.resetForTests();
    const store = new Map();
    const storage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
    const host = {_runtime: {requestToolboxExtensionsUpdate () { host.updates = (host.updates || 0) + 1; }}};
    const make = () => ({blocks: [{opcode: 'setSpriteFlag'}, {opcode: 'followSprite'}]});
    let info = palette.arrange(host, make(), storage);
    const button = info.blocks.find(block => block.blockType === 'button' && block.func === 'ARCADE_PALETTE_sprites');
    assert.ok(info.blocks.find(block => block.opcode === 'followSprite').hideFromPalette);
    button.callback();
    assert.equal(host.updates, 1);
    assert.deepEqual(JSON.parse(store.get(palette.STORAGE_KEY)), ['sprites']);
    info = palette.arrange(host, make(), storage);
    assert.equal(info.blocks.find(block => block.opcode === 'followSprite').hideFromPalette, undefined);
    palette.resetForTests();
    assert.doesNotThrow(() => palette.arrange(host, make(), {getItem () { throw new Error('blocked'); }, setItem () { throw new Error('blocked'); }}).blocks[0].callback);
    palette.resetForTests();
});

test('the runtime emits one rail category per section; hidden blocks stay registered and the toggle refreshes', async () => {
    palette.resetForTests();
    const {vm, extension} = makeVm();
    const xml = vm.runtime.getBlocksXML();
    assert.deepEqual(xml.map(entry => /^<category [^>]*?id="([^"]*)"/.exec(entry.xml)[1]),
        ['arcade', ...palette.SECTIONS.slice(1).map(section => `arcade_${section[0]}`)]);
    for (const entry of xml) assert.match(entry.xml, /^<category [^>]*>[\s\S]*<\/category>$/);
    assert.ok(!xml.some(entry => entry.xml.includes('arcade_followSprite')));
    assert.equal(typeof vm.runtime._primitives.arcade_followSprite, 'function');
    let updates = 0;
    vm.runtime.on('TOOLBOX_EXTENSIONS_NEED_UPDATE', () => updates++);
    vm.runtime.bwButtonCallbacks.ARCADE_PALETTE_sprites();
    assert.equal(updates, 1);
    await vm.extensionManager.refreshBlocks({throwOnError: true});
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(vm.runtime.getBlocksXML()[0].xml.includes('arcade_followSprite'));
    palette.resetForTests();
});
