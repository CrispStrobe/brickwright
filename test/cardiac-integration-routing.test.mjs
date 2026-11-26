// SPDX-License-Identifier: BSD-3-Clause
// Execute the production routing methods with controlled fetch and React-state
// scheduling. These checks do not replace the real engine/browser fixture.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as CardiacProject from '../overlay/scratch-gui/src/lib/cardiac-project.js';
const {CARDIAC_WORKSPACE_KEY, createCardiacWorkspace} = CardiacProject;

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx', import.meta.url), 'utf8');
const method = name => {
    const match = new RegExp(`^    (?:async )?${name} \\([^\\n]*\\) \\{[\\s\\S]*?^    \\}`, 'm').exec(source);
    assert.ok(match, `production method ${name} exists`);
    return match[0];
};
const field = name => {
    const match = new RegExp(`^    ${name} = [^\\n]*=> \\{[\\s\\S]*?^    \\};`, 'm').exec(source);
    assert.ok(match, `production handler ${name} exists`);
    return match[0];
};
const installedHandler = name => {
    const match = new RegExp(`this\\.${name} = [^\\n]*=> \\{[\\s\\S]*?^        \\};`, 'm').exec(source);
    assert.ok(match, `production mounted consumer ${name} exists`);
    return match[0];
};

const nightLight = {id: 'test-cardiac-night-light', files: {
    cardiac: 'cardiac/program.cardiac', deck: 'cardiac/input.deck', circuit: 'cardiac/circuit.json'
}};
const image = {parts: [{id: 'new-cardiac', kind: 'cardiac', params: {}}], wires: []};
const listing = 'ORG 01\nINP 80\nOUT 80\nHRS\n';

function routingFixture ({deferState = false, circuitFailure = false, initialCircuit = {parts: [], wires: []}} = {}) {
    const values = new Map();
    const events = [];
    const scheduled = [];
    const localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
    const browser = {dispatchEvent: event => {
        events.push(event);
        if (event.type === 'bw-machine-extracted') browser.__bwMachineExtracted = event.detail;
    }};
    const Event = class { constructor (type, options = {}) { this.type = type; this.detail = options.detail; } };
    const fetch = async path => ({
        ok: !(circuitFailure && path.endsWith('circuit.json')),
        status: circuitFailure && path.endsWith('circuit.json') ? 404 : 200,
        text: async () => path.endsWith('input.deck') ? '042\n' : listing,
        json: async () => structuredClone(image)
    });
    const methods = ['activateCardiac', 'activateCp1Circuit', 'loadCardiacExample', 'loadExample'].map(method);
    const fields = ['_onCardiacCodeSelection', '_onCp1CodeSelection'].map(field);
    const host = new Function('window', 'localStorage', 'fetch', 'CustomEvent', ...Object.keys(CardiacProject),
        'normalizeDeviceId', 'confirmAsync', 'navigator',
        `return new class {${methods.join('\n')}\n${fields.join('\n')}};`)(
        browser, localStorage, fetch, Event, ...Object.values(CardiacProject),
        value => value || null, async () => true, {language: 'en'});
    host.state = {circuitData: initialCircuit, debugDock: 'top'};
    host.props = {vm: {runtime: {bwDeviceCore: 'avr'}}};
    host.setState = (patch, callback) => {
        const apply = () => {
            Object.assign(host.state, typeof patch === 'function' ? patch(host.state) : patch);
            callback?.();
        };
        if (deferState) scheduled.push(new Promise(resolve => setTimeout(() => {apply(); resolve();}, 0)));
        else apply();
    };
    host._markReactUpdate = () => {};
    host.load = async () => {};
    host.showControllerDock = () => {};
    host.applyControllerLayout = async () => false;
    host.readStc = () => null;
    host.publishExampleTitle = () => {};
    host.applied = [];
    host._applyToLiveCircuit = data => host.applied.push(data);
    const install = name => {
        new Function('window', 'localStorage', ...Object.keys(CardiacProject), installedHandler(name))
            .call(host, browser, localStorage, ...Object.values(CardiacProject));
        return host[name];
    };
    return {host, browser, events, values, localStorage, install,
        flush: async () => {for (let i = 0; i < scheduled.length; i++) await scheduled[i];}};
}

test('a night-light load uses its newly fetched circuit before React commits pending state', async () => {
    const fixture = routingFixture({deferState: true,
        initialCircuit: {parts: [{id: 'old-cardiac', kind: 'cardiac'}], wires: []}});
    const result = await fixture.host.loadCardiacExample(nightLight);
    await fixture.flush();
    assert.equal(result.ok, true, result.error);
    assert.equal(fixture.browser.__bwMachineExtracted?.config?.partId, 'new-cardiac',
        'the new source must attach to the newly loaded part, not a previous React state');
    assert.equal(fixture.host.applied.at(-1)?.parts[0].id, 'new-cardiac');
    const saved = JSON.parse(fixture.values.get(CARDIAC_WORKSPACE_KEY));
    assert.equal(saved.source, listing);
    assert.equal(saved.inputDeck, '042\n');
});

test('a failed circuit fetch cannot replace the previous CARDIAC draft', async () => {
    const fixture = routingFixture({circuitFailure: true});
    const previous = JSON.stringify(createCardiacWorkspace('ORG 10\nCLA unfinished', 'unfinished card'));
    fixture.values.set(CARDIAC_WORKSPACE_KEY, previous);
    const result = await fixture.host.loadCardiacExample(nightLight);
    assert.equal(result.ok, false);
    assert.equal(fixture.values.get(CARDIAC_WORKSPACE_KEY), previous);
    assert.equal(fixture.events.some(event => event.type === 'bw-cardiac-source-load'), false);
    assert.equal(fixture.browser.__bwMachineExtracted, undefined);
});

test('choosing another device detaches CARDIAC before device-kind routing runs', () => {
    const fixture = routingFixture();
    fixture.host.activateCardiac();
    const settings = fixture.install('_settingsHandler');
    settings({detail: {key: 'bw-device-id', value: 'arduino-uno'}});
    assert.notEqual(fixture.browser.__bwMachineExtracted?.kind, 'cardiac');
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'avr');
    assert.equal(fixture.events.at(-1).type, 'bw-cardiac-detached');
});

test('opening standalone CARDIAC from a CP1 session restores the real previous core on exit', async () => {
    const fixture = routingFixture();
    fixture.host.activateCp1Circuit({parts: [{id: 'cp1', kind: 'kosmos-cp1'}]});
    const result = await fixture.host.loadCardiacExample({id: 'echo', files: {cardiac: 'cardiac/program.cardiac'}});
    assert.equal(result.ok, true, result.error);
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'cardiac');
    fixture.host._onCardiacCodeSelection({detail: {active: false}});
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'avr',
        'CP1 must be released before CARDIAC remembers the normal device core');
});

test('opening a CP1 circuit from CARDIAC cannot restore a phantom CARDIAC core on exit', () => {
    const fixture = routingFixture();
    fixture.host.activateCardiac();
    fixture.host.activateCp1Circuit({parts: [{id: 'cp1', kind: 'kosmos-cp1'}]});
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'cp1');
    fixture.host._onCp1CodeSelection({detail: {active: false}});
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'avr',
        'CARDIAC must be released before CP1 remembers the normal device core');
});

test('extracting another machine releases a stale CARDIAC core but preserves a newly assigned core', () => {
    for (const replacementCore of [null, 'z80']) {
        const fixture = routingFixture();
        fixture.values.set(CARDIAC_WORKSPACE_KEY, JSON.stringify(createCardiacWorkspace('HRS')));
        fixture.host.activateCardiac();
        if (replacementCore) fixture.host.props.vm.runtime.bwDeviceCore = replacementCore;
        fixture.install('_machineExtractedHandler')({detail: {kind: 'z80', config: {regions: []}}});
        assert.equal(fixture.browser.__bwMachineExtracted?.kind, 'z80');
        assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, replacementCore || 'avr');
        assert.equal(JSON.parse(fixture.values.get(CARDIAC_WORKSPACE_KEY)).active, false);
    }
});

test('reopening an explicit CP1 circuit wins over either active or inactive CARDIAC drafts', () => {
    for (const active of [true, false]) {
        const fixture = routingFixture();
        fixture.values.set('bw-circuit-autosave', JSON.stringify({parts: [{id: 'cp1', kind: 'kosmos-cp1'}], wires: []}));
        fixture.values.set(CARDIAC_WORKSPACE_KEY, JSON.stringify({...createCardiacWorkspace('ORG 01\nHRS'), active}));
        const restore = fixture.install('_onBundleLoaded');
        restore({detail: {outcome: 'loaded'}});
        assert.equal(fixture.browser.__bwMachineExtracted?.kind, 'cp1');
        assert.equal(fixture.browser.__bwMachineExtracted?.config?.partId, 'cp1');
        assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'cp1');
    }
});

test('an inactive CARDIAC draft cannot steal a normal circuit project on reopen', () => {
    const fixture = routingFixture();
    fixture.values.set('bw-circuit-autosave', JSON.stringify({parts: [{id: 'mcu', kind: 'arduino-uno'}], wires: []}));
    fixture.values.set(CARDIAC_WORKSPACE_KEY, JSON.stringify({...createCardiacWorkspace('ORG 01\nHRS'), active: false}));
    fixture.install('_onBundleLoaded')({detail: {outcome: 'loaded'}});
    assert.notEqual(fixture.browser.__bwMachineExtracted?.kind, 'cardiac');
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'avr');
    assert.equal(fixture.events.some(event => event.type === 'bw-cardiac-selected'), false);
});

test('an explicitly active standalone workspace reopens without needing a circuit part', () => {
    const fixture = routingFixture();
    fixture.values.set(CARDIAC_WORKSPACE_KEY, JSON.stringify({...createCardiacWorkspace('ORG 01\nHRS'), active: true}));
    fixture.install('_onBundleLoaded')({detail: {outcome: 'loaded'}});
    assert.equal(fixture.browser.__bwMachineExtracted?.kind, 'cardiac');
    assert.equal(fixture.browser.__bwMachineExtracted?.config?.partId, undefined);
    assert.equal(fixture.host.props.vm.runtime.bwDeviceCore, 'cardiac');
    assert.equal(fixture.events.some(event => /run-request|cardiac-run$/.test(event.type)), false);
});

test('a refused bundle leaves the currently selected CARDIAC machine intact', () => {
    const fixture = routingFixture();
    fixture.host.activateCardiac('current-card');
    const current = fixture.browser.__bwMachineExtracted;
    const restore = fixture.install('_onBundleLoaded');
    for (const outcome of ['future', 'invalid', 'storage-failed']) restore({detail: {outcome}});
    assert.equal(fixture.browser.__bwMachineExtracted, current);
    assert.equal(fixture.host.applied.length, 0);
});
