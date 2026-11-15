// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';

// Import the real VM before installing browser globals (DOMPurify detects window).
const {default: VM} = await importGuiDependency('scratch-vm/src/index.js');
const Spike = loadExtensionClass('spikeprime');

const makeExtension = (vm, locale) => {
    const descriptors = new Map();
    const globals = {
        window: globalThis,
        navigator: {language: locale},
        document: {documentElement: {lang: locale}},
        ReduxStore: {getState: () => ({locales: {locale}})},
        localStorage: {getItem: () => null},
        addEventListener: () => {},
        setInterval: () => 0
    };
    for (const [key, value] of Object.entries(globals)) {
        descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
    }
    try {
        const extension = new Spike(vm.runtime);
        return {extension, info: extension.getInfo()};
    } finally {
        for (const [key, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
};

test('real SPIKE adapter registers all three localized palette headers and ordinary blocks', () => {
    for (const locale of ['en', 'de', 'fr']) {
        const vm = new VM();
        try {
            const {extension, info} = makeExtension(vm, locale);
            // Freeze the locale for this registration, just as one toolbox refresh does.
            extension.getInfo = () => info;
            const service = vm.extensionManager._registerInternalExtension(extension);
            const prepared = vm.extensionManager._prepareExtensionInfo(service, info);
            assert.equal(prepared.blocks.length, info.blocks.length, `${locale}: no metadata was rejected`);
            const headers = prepared.blocks.filter(block => block.blockType === 'label');
            assert.equal(headers.length, 3, `${locale}: all three headers survive registration`);
            const xml = vm.runtime.getBlocksXML().find(category => category.id === 'spikeprime').xml;
            assert.equal((xml.match(/<label /g) || []).length, 3);
            for (const header of headers) assert.ok(xml.includes(header.xml), header.text);
            assert.equal(typeof vm.runtime._primitives.spikeprime_setLightMatrixPixel, 'function');
            assert.match(xml, /spikeprime_setLightMatrixPixel/);
            assert.ok(!Object.keys(vm.runtime._primitives).includes('spikeprime_undefined'));
        } finally {
            vm.quit();
        }
    }
});

test('adapter escapes label text and preserves existing XML and executable metadata', () => {
    const vm = new VM();
    try {
        const {extension} = makeExtension(vm, 'en');
        const text = `A & "B" <C> 'D'`;
        const command = {blockType: 'command', opcode: 'ordinary', text: 'ordinary'};
        const existing = {blockType: 'label', text: 'existing', xml: '<label text="custom"></label>'};
        extension._inst.getInfo = () => ({id: 'spikeprime', blocks: [
            {blockType: 'label', text}, existing, command, '---'
        ]});
        const [label, retained, actualCommand, separator] = extension.getInfo().blocks;
        assert.equal(label.text, text);
        assert.equal(label.xml, '<label text="A &#38; &#34;B&#34; &#60;C&#62; &#39;D&#39;"></label>');
        assert.equal(vm.runtime._convertForScratchBlocks(label, {id: 'spikeprime'}).xml, label.xml);
        assert.strictEqual(retained, existing);
        assert.strictEqual(actualCommand, command);
        assert.equal(separator, '---');
    } finally {
        vm.quit();
    }
});
