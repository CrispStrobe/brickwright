// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tab = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
const gallery = 'overlay/scratch-gui/examples/';
const index = JSON.parse(read(`${gallery}index.json`));

// Execute the production source loading path without booting the full editor.
function cp1Loader () {
    const events = [];
    const state = {machineBooted: false};
    const host = {props: {vm: {runtime: {}}}, setState: patch => Object.assign(state, patch)};
    const storage = new Map();
    const localStorage = {setItem: (key, value) => storage.set(key, value)};
    const window = {dispatchEvent: event => {
        events.push(event);
        if (event.type === 'bw-machine-extracted') {
            assert.ok(storage.has('bw-cp1-workspace'), 'the lazy panel can read the persisted source');
            window.__bwMachineExtracted = event.detail;
            state.machineBooted = true;
        }
    }};
    const fetch = async path => ({ok: true, text: async () => read(`overlay/scratch-gui/${path}`)});
    const activation = tab.slice(tab.indexOf('    activateCp1Circuit (data)'),
        tab.indexOf('\n    }', tab.indexOf('    activateCp1Circuit (data)')) + 6);
    const begin = tab.indexOf('            if (ex.files?.cp1) {');
    const end = tab.indexOf('            // The program first:', begin);
    assert.ok(activation.includes('bw-cp1-circuit-detached') && begin >= 0 && end > begin);
    const load = new Function('window', 'localStorage', 'fetch', `
        return {${activation}, async load(ex, data) { ${tab.slice(begin, end)} }};
    `)(window, localStorage, fetch);
    Object.assign(host, load);
    return {load: host.load.bind(host), events, state, storage, window, runtime: host.props.vm.runtime};
}

for (const [id, expansion] of [['cp1-first-display', false], ['cp1-cp4-relay-signals', false], ['cp1-cp4-relay-bank', false], ['cp1-cp2-sample-logger', true]]) {
    test(`${id} opens the original listing with the authored machine configuration`, async () => {
        const entry = index.find(ex => ex.id === id);
        const circuit = JSON.parse(read(`${gallery}${entry.files.circuit}`));
        const fixture = cp1Loader();
        await fixture.load(entry, circuit);
        const draft = JSON.parse(fixture.storage.get('bw-cp1-workspace'));
        assert.equal(draft.source, read(`${gallery}${entry.files.cp1}`));
        assert.deepEqual(draft.configuration, {expansion, clockHz: 6000000});
        assert.equal(draft.rom, null);
        assert.deepEqual(fixture.events.map(event => event.type), ['bw-machine-extracted', 'bw-cp1-source-load']);
        assert.equal(fixture.events[0].detail.config.partId, 'cp1');
        assert.equal(fixture.events[1].detail.source, draft.source);
        assert.equal(fixture.runtime.bwDeviceCore, 'cp1');

        fixture.window.__bwPendingMedia = {detail: {kind: 'cp1'}};
        await fixture.load({files: {}}, {parts: [{kind: 'z80'}]});
        assert.equal(fixture.events.at(-1).type, 'bw-cp1-circuit-detached');
        assert.equal(fixture.window.__bwMachineExtracted, undefined);
        assert.equal(fixture.window.__bwPendingMedia, undefined);
        assert.equal(fixture.runtime.bwDeviceCore, undefined);
        assert.equal(fixture.state.machineBooted, false);
    });
}
