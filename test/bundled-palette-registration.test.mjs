// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';

// Import the real VM before installing browser globals (DOMPurify detects window).
const {default: VM} = await importGuiDependency('scratch-vm/src/index.js');

const makeExtension = (vm, locale, name) => {
    const Extension = loadExtensionClass(name);
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
        const extension = new Extension(vm.runtime);
        return {extension, info: extension.getInfo()};
    } finally {
        for (const [key, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
};

for (const [name, count, primitive] of [['ev3dev', 12, 'getScriptCount'], ['ev3comprehensive', 13, 'connect'], ['legorcx', 7, 'setPower']]) {
test(`real ${name} adapter retains localized palette headers and executable blocks`, () => {
    for (const locale of ['en', 'de']) {
        const vm = new VM();
        try {
            const {extension, info} = makeExtension(vm, locale, name);
            // Freeze the locale for this registration, just as one toolbox refresh does.
            extension.getInfo = () => info;
            const service = vm.extensionManager._registerInternalExtension(extension);
            const prepared = vm.extensionManager._prepareExtensionInfo(service, info);
            assert.equal(prepared.blocks.length, info.blocks.length, `${locale}: no metadata was rejected`);
            const headers = prepared.blocks.filter(block => block.blockType === 'label');
            assert.equal(headers.length, count, `${locale}: every header survives registration`);
            const xml = vm.runtime.getBlocksXML().find(category => category.id === info.id).xml;
            assert.equal((xml.match(/<label /g) || []).length, count);
            for (const header of headers) assert.ok(xml.includes(header.xml), header.text);
            assert.equal(typeof vm.runtime._primitives[`${info.id}_${primitive}`], 'function');
            assert.ok(xml.includes(`${info.id}_${primitive}`));
            assert.ok(!Object.keys(vm.runtime._primitives).includes(`${info.id}_undefined`));
            for (const block of prepared.blocks.filter(block => block.opcode)) {
                if (block.blockType !== 'button') assert.equal(typeof vm.runtime._primitives[`${info.id}_${block.opcode}`], 'function', block.opcode);
            }
        } finally {
            vm.quit();
        }
    }
});

}
