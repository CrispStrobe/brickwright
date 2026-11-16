import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';

const source = readFileSync(new URL(
    '../overlay/scratch-vm/src/extensions/crispstrobe/adapter.js', import.meta.url), 'utf8');
let locale = 'en';
const fakeFormatMessage = () => '';
fakeFormatMessage.setup = () => ({locale});
const dependencies = new Map([
    ['../../extension-support/argument-type', {}],
    ['../../extension-support/block-type', {}],
    ['../../extension-support/target-type', {}],
    ['../../util/cast', {}],
    ['format-message', fakeFormatMessage],
    ['./arcade/local-array-result-bindings', createRequire(import.meta.url)('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/local-array-result-bindings.js')]
]);
const adapterModule = {exports: {}};
new Function('require', 'module', 'exports', source)(
    id => dependencies.get(id), adapterModule, adapterModule.exports);

const Extension = adapterModule.exports(`
    (function (Scratch) {
        Scratch.extensions.register({
            getInfo () {
                return {menus: {direction: {items: ['forward', 'backward', 'brake']}}};
            }
        });
    })(Scratch);
`);

test('legacy menu labels are localized without changing serialized values', () => {
    locale = 'en';
    assert.deepEqual(new Extension({}).getInfo().menus.direction.items, ['forward', 'backward', 'brake']);

    locale = 'de-DE';
    assert.deepEqual(new Extension({}).getInfo().menus.direction.items, [
        {text: 'vorwärts', value: 'forward'},
        {text: 'rückwärts', value: 'backward'},
        {text: 'bremsen', value: 'brake'}
    ]);
});
