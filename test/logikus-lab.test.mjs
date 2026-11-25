// SPDX-License-Identifier: BSD-3-Clause
// The actual React lab, with the actual contact engine and inspection code.
// JSDOM supplies events and focus, not browser layout or pointer capture; those
// two DOM boundaries are explicitly supplied below. This is not browser QA.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as model from '../overlay/scratch-gui/src/lib/logikus/model.js';
import * as presets from '../overlay/scratch-gui/src/lib/logikus/presets.js';
import * as workspaceModule from '../overlay/scratch-gui/src/lib/logikus/workspace.js';
import * as inspection from '../overlay/scratch-gui/src/lib/logikus/inspection.js';
import * as railway from '../overlay/scratch-gui/src/lib/logikus/railway.js';

const gui = createRequire(process.env.BW_INTEGRATED_ROOT ?
    pathToFileURL(resolve(process.env.BW_INTEGRATED_ROOT, 'package.json')) :
    new URL('../packages/scratch-gui/package.json', import.meta.url));
// Use the modern DOM already installed beneath the GUI's sanitizer.
const {JSDOM} = createRequire(gui.resolve('isomorphic-dompurify'))('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>',
    {pretendToBeVisual: true, url: 'http://localhost/'});
const savedGlobals = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, MessageChannel: dom.window.MessageChannel,
    CustomEvent: dom.window.CustomEvent, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window)})) {
    savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
}
// The lab filters invisible elements before trapping focus. JSDOM has no
// layout; report visibility according to real hidden/closed-details semantics.
dom.window.HTMLElement.prototype.getClientRects = function () {
    if (this.closest('[hidden]')) return [];
    let node = this;
    while (node) {
        if (node.tagName === 'DETAILS' && !node.open) {
            const summary = node.querySelector(':scope > summary');
            if (!summary?.contains(this)) return [];
        }
        node = node.parentElement;
    }
    return [{x: 0, y: 0, width: 100, height: 30}];
};

const React = gui('react'), ReactDOM = gui('react-dom');
const {act, Simulate} = gui('react-dom/test-utils');
const styleNames = new Proxy({}, {get: (_, name) => name === '__esModule' ? false : String(name)});
function loadComponent (filename) {
    const source = readFileSync(new URL(`../overlay/scratch-gui/src/components/tw-pseudocode/${filename}`, import.meta.url), 'utf8');
    const code = gui('@babel/core').transformSync(source, {filename, babelrc: false, configFile: false,
        presets: [gui.resolve('@babel/preset-react')], plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
    const module = {exports: {}};
    new Function('require', 'module', 'exports', code)(name => {
        if (name.endsWith('/logikus/model.js')) return model;
        if (name.endsWith('/logikus/presets.js')) return presets;
        if (name.endsWith('/logikus/workspace.js')) return workspaceModule;
        if (name.endsWith('/logikus/inspection.js')) return inspection;
        if (name.endsWith('/logikus/railway.js')) return railway;
        if (name.endsWith('/download-blob.js')) return async () => {};
        if (name === './logikus-lab.css') return styleNames;
        if (name === './logikus-railway.jsx') return loadComponent('logikus-railway.jsx');
        return gui(name);
    }, module, module.exports);
    return module.exports;
}
const Lab = loadComponent('logikus-lab.jsx').default;
const makeWorkspace = id => workspaceModule.createWorkspace({program: presets.getPreset(id).program, presetId: id});
const flush = callback => act(async () => { callback?.(); await Promise.resolve(); await Promise.resolve(); });
const deferred = () => {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return {promise, resolve};
};

after(() => {
    dom.window.close();
    for (const [key, descriptor] of savedGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    }
});

function fixture (t, initial = makeWorkspace('half-adder'), {locale = 'en'} = {}) {
    const launcher = document.createElement('button'); launcher.textContent = 'Open lab';
    document.body.appendChild(launcher); launcher.focus();
    const container = document.createElement('div'); document.body.appendChild(container);
    const errors = [], changes = [], testWrites = [];
    let live, setWorkspace, setButton, closed = false;
    function Harness () {
        const [workspace, updateWorkspace] = React.useState(initial);
        const [button, updateButton] = React.useState(false);
        const [error, updateError] = React.useState('');
        live = {workspace, button}; setWorkspace = updateWorkspace; setButton = updateButton;
        return React.createElement(Lab, {workspace, button, locale, error,
            onChange: next => { const checked = workspaceModule.validateWorkspace(next); changes.push(checked); updateWorkspace(checked); },
            onTest: down => { testWrites.push(down); updateButton(down); },
            onError: failure => { errors.push(failure); updateError(failure.message); },
            onClose: () => {}, onInstall: () => {}});
    }
    act(() => { ReactDOM.render(React.createElement(Harness), container); });
    const lab = () => document.querySelector('[data-testid="bw-logikus-lab"]');
    const byText = text => [...lab().querySelectorAll('button')].find(button => button.textContent.trim() === text);
    const click = target => {
        const element = typeof target === 'string' ? byText(target) : target;
        assert.ok(element, `control exists: ${target}`); assert.equal(element.disabled, false);
        act(() => { Simulate.click(element); });
    };
    const close = () => {
        if (closed) return;
        closed = true;
        act(() => { ReactDOM.unmountComponentAtNode(container); });
        container.remove();
    };
    t.after(() => { close(); launcher.remove(); assert.deepEqual(errors, []); });
    return {lab, byText, click, launcher, errors, changes, testWrites, close,
        get current () { return live; },
        replace: next => act(() => setWorkspace(workspaceModule.validateWorkspace(next))),
        release: () => act(() => setButton(false)),
        switch: i => lab().querySelector(`button[role="switch"][aria-label^="S${i} "]`),
        lamp: i => lab().querySelector(`button[aria-label^="L${i} "]`),
        testButton: () => lab().querySelector('button.testButton'),
        importFile: pending => {
            const input = lab().querySelector('input[type="file"]');
            act(() => { Simulate.change(input, {target: {files: [{size: 100, text: () => pending.promise}], value: 'selected'}}); });
        }
    };
}

test('the actual half-adder face shows carry, not sum, for 1 + 1', t => {
    const f = fixture(t);
    assert.equal(f.lamp(0).getAttribute('data-on'), 'false');
    assert.equal(f.lamp(1).getAttribute('data-on'), 'false');
    f.click(f.switch(0));
    assert.equal(f.lamp(0).getAttribute('data-on'), 'true');
    f.click(f.switch(1));
    assert.equal(f.lamp(0).getAttribute('data-on'), 'false');
    assert.equal(f.lamp(1).getAttribute('data-on'), 'true');
    assert.equal(f.switch(1).getAttribute('aria-checked'), 'true');
    f.click(f.lamp(1));
    assert.match(f.lab().querySelector('#logikus-operate').textContent, /Carry \(2\).*complete path/);
    f.click('Wire');
    assert.equal(f.lab().querySelectorAll('button[aria-label^="Terminal "]').length, 213);
    assert.equal(f.lab().querySelectorAll('svg line').length, 50);
    for (const path of f.lab().querySelectorAll('svg path')) assert.doesNotMatch(path.getAttribute('d'), /NaN|undefined/);
});

test('removing a real wire produces a reproducible counterexample, and Undo repairs it', t => {
    const f = fixture(t, makeWorkspace('and'));
    f.click('Wire');
    const remove = f.lab().querySelector('button[aria-label="Remove wire Q S0.Aa"]');
    remove.closest('details').open = true;
    f.click(remove);
    assert.equal(f.current.workspace.program.wires.length, 2);
    f.click('Test all states');
    assert.match(f.lab().textContent, /3 \/ 4 states match the goal/);
    f.click('Show counterexample');
    assert.deepEqual(f.current.workspace.switches.slice(0, 2), [1, 1]);
    assert.equal(f.lamp(0).getAttribute('data-on'), 'false');
    assert.ok(f.lab().querySelector('#logikus-wire'));
    f.click('Undo');
    assert.equal(f.current.workspace.program.wires.length, 3);
    f.click('Test all states');
    assert.match(f.lab().textContent, /4 \/ 4 states match the goal/);
    assert.equal(f.byText('Show counterexample'), undefined);
});

test('generating a report from the empty table retains keyboard focus inside the lab', t => {
    const f = fixture(t, makeWorkspace('lamp'));
    f.click('Truth table');
    const trigger = f.lab().querySelector('#logikus-table button');
    assert.equal(trigger.textContent, 'Test all states');
    trigger.focus();
    f.click(trigger);
    assert.equal(trigger.isConnected, false, 'the empty table is replaced by its report');
    assert.equal(document.activeElement.id, 'logikus-tab-table');
    assert.equal(document.activeElement.getAttribute('aria-selected'), 'true');
    assert.match(f.lab().querySelector('#logikus-table').textContent, /2 \/ 2 states match the goal/);
});

test('changing only the goal clears the old report, and an unknown imported goal stays ungraded', t => {
    const f = fixture(t, makeWorkspace('lamp'));
    f.click('Test all states');
    assert.match(f.lab().textContent, /2 \/ 2 states match the goal/);
    f.replace({...f.current.workspace, presetId: 'and'});
    assert.doesNotMatch(f.lab().textContent, /2 \/ 2 states match the goal/);
    assert.match(f.lab().querySelector('#logikus-table').textContent, /Check every possibility/);
    f.click('Test all states');
    assert.match(f.lab().textContent, /3 \/ 4 states match the goal/);
    f.replace({...f.current.workspace, presetId: 'my-own-experiment'});
    f.click('Test all states');
    assert.match(f.lab().textContent, /2 states enumerated/);
    assert.doesNotMatch(f.lab().querySelector('#logikus-table').textContent, /states match the goal/);
});

test('Test preserves independent keyboard and pointer owners, ignores secondary pointers, and releases', t => {
    const workspace = makeWorkspace('code-lock'); workspace.switches = [...'1011101101'].map(Number);
    const f = fixture(t, workspace), button = f.testButton(), captures = [];
    button.setPointerCapture = id => captures.push(id);
    const simulate = (name, data) => act(() => { Simulate[name](button, data); });
    simulate('pointerDown', {button: 2, pointerId: 1});
    simulate('pointerDown', {button: 0, isPrimary: false, pointerId: 2});
    assert.deepEqual(captures, []); assert.equal(f.current.button, false);
    simulate('keyDown', {key: ' '});
    simulate('keyDown', {key: ' ', repeat: true});
    simulate('pointerDown', {button: 0, pointerId: 7});
    assert.equal(f.lamp(0).getAttribute('data-on'), 'true');
    simulate('pointerUp', {pointerId: 7});
    assert.equal(f.current.button, true, 'keyboard still owns the hold');
    simulate('keyUp', {key: ' '});
    assert.equal(f.current.button, false); assert.equal(f.lamp(0).getAttribute('data-on'), 'false');
    simulate('pointerDown', {button: 0, pointerId: 8});
    simulate('keyDown', {key: 'Enter'});
    simulate('keyUp', {key: 'Enter'});
    assert.equal(f.current.button, true, 'pointer still owns the hold');
    simulate('pointerCancel', {pointerId: 8}); assert.equal(f.current.button, false);
    simulate('pointerDown', {button: 0, pointerId: 9});
    simulate('lostPointerCapture', {pointerId: 9}); assert.equal(f.current.button, false);
    simulate('keyDown', {key: 'Enter'});
    simulate('blur', {}); assert.equal(f.current.button, false);
    simulate('pointerDown', {button: 0, pointerId: 10});
    f.release();
    simulate('pointerUp', {pointerId: 10});
    assert.equal(f.current.button, false, 'an external release cannot revive stale owners');
});

test('the collapsed Rename summary is reachable at the end of the focus trap', t => {
    const f = fixture(t);
    const close = f.byText('Close'), summary = f.lab().querySelector('.labels > summary');
    assert.equal(document.activeElement, close);
    const key = shiftKey => {
        const event = new window.KeyboardEvent('keydown', {key: 'Tab', shiftKey, bubbles: true, cancelable: true});
        act(() => { document.activeElement.dispatchEvent(event); });
        return event;
    };
    assert.equal(key(true).defaultPrevented, true);
    assert.equal(document.activeElement, summary, 'Shift+Tab reaches the actual last control, including summary');
    assert.equal(key(false).defaultPrevented, true);
    assert.equal(document.activeElement, close);
    f.close(); assert.equal(document.activeElement, f.launcher);
});

test('an import finishing after a new edit cannot replace the newer design', async t => {
    const f = fixture(t, makeWorkspace('lamp')), pending = deferred();
    f.importFile(pending);
    f.click('Half adder: 1 + 1 = 10');
    await flush(() => pending.resolve(JSON.stringify(makeWorkspace('or'))));
    assert.equal(f.current.workspace.presetId, 'half-adder');
    assert.equal(f.current.workspace.program.wires.length, 9);
});

test('only the newest import can apply, and an unmounted lab ignores pending file reads', async t => {
    const f = fixture(t, makeWorkspace('lamp')), first = deferred(), second = deferred();
    f.importFile(first); f.importFile(second);
    await flush(() => second.resolve(JSON.stringify(makeWorkspace('not'))));
    assert.equal(f.current.workspace.presetId, 'not');
    await flush(() => first.resolve(JSON.stringify(makeWorkspace('or'))));
    assert.equal(f.current.workspace.presetId, 'not');
    const final = deferred(); f.importFile(final);
    const count = f.changes.length;
    f.close();
    await flush(() => final.resolve(JSON.stringify(makeWorkspace('and'))));
    assert.equal(f.changes.length, count);
});

test('the railway scene and normal switch panel share actual circuit inputs and outputs', t => {
    const f = fixture(t, makeWorkspace('railway'));
    const scene = () => f.lab().querySelector('[data-testid="logikus-railway"]');
    const input = i => scene().querySelector(`[data-input="${i}"]`);
    const signal = i => scene().querySelector(`[data-signal="${i}"]`);
    assert.equal(signal(0).getAttribute('data-green'), 'false');
    f.click(input(0));
    assert.equal(f.current.workspace.switches[0], 1);
    assert.equal(f.switch(0).getAttribute('aria-checked'), 'true');
    assert.equal(f.lamp(0).getAttribute('data-on'), 'true');
    assert.equal(signal(0).getAttribute('data-green'), 'true');
    f.click(f.switch(4));
    assert.equal(input(4).getAttribute('aria-checked'), 'true');
    assert.equal(signal(0).getAttribute('data-green'), 'true', 'unrelated exit B does not stop route A');
    f.click(input(1));
    assert.equal(signal(0).getAttribute('data-green'), 'false');
    assert.equal(signal(1).getAttribute('data-green'), 'false', 'two requests stop both signals');
    f.click(input(0)); f.click(input(4));
    assert.equal(signal(1).getAttribute('data-green'), 'true');
    f.click(signal(1));
    assert.equal(f.lamp(1).getAttribute('data-selected'), 'true');
    const inspect = scene().querySelector('button:not([role="switch"]):not([data-signal])');
    inspect.focus(); f.click(inspect);
    assert.ok(f.lab().querySelector('#logikus-wire'));
    assert.equal(document.activeElement.id, 'logikus-tab-wire', 'the disappearing trigger transfers keyboard focus');
    assert.equal(f.lamp(1).getAttribute('data-selected'), 'true', 'Wire keeps the selected signal path');
});

test('a learner can bypass occupancy, reproduce an unsafe state and undo the fault', t => {
    const f = fixture(t, makeWorkspace('railway'));
    f.click('Wire');
    f.click(f.lab().querySelector('[aria-label="Terminal S2.Ba"]'));
    f.click(f.lab().querySelector('[aria-label="Terminal S2.Bb"]'));
    f.click('Operate');
    f.click(f.switch(0)); f.click(f.switch(2));
    const scene = f.lab().querySelector('[data-testid="logikus-railway"]');
    assert.equal(scene.querySelector('[data-signal="0"]').getAttribute('data-green'), 'true',
        'the scene must show the faulty wiring, not an ideal Boolean target');
    assert.match(scene.querySelector('[role="status"]').textContent, /crossing is occupied/);
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="railway-safety-result"]').textContent, /30 \/ 32/);
    assert.match(f.lab().querySelector('[data-testid="logikus-target-result"]').textContent, /30 \/ 32/);
    const replay = f.byText('Show unsafe state');
    replay.focus(); f.click(replay);
    assert.deepEqual(f.current.workspace.switches.slice(0, 5), [1, 0, 1, 0, 0]);
    assert.ok(f.lab().querySelector('#logikus-wire'));
    assert.equal(document.activeElement.id, 'logikus-tab-wire');
    assert.equal(f.lamp(0).getAttribute('data-on'), 'true');
    assert.equal(f.lamp(0).getAttribute('data-selected'), 'true');
    assert.ok(model.evaluateProgram(f.current.workspace.program, {switches: f.current.workspace.switches}).paths[0]);
    f.click('Undo');
    f.click('Truth table');
    assert.equal(f.lab().querySelector('[data-testid="railway-safety-result"]'), null, 'an edit invalidates the old report');
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="railway-safety-result"]').textContent, /32 \/ 32/);
    assert.equal(f.byText('Show unsafe state'), undefined);
    assert.equal(f.byText('Show counterexample'), undefined);
    f.click('Redo');
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="railway-safety-result"]').textContent, /30 \/ 32/);
});

test('an always-red railway reports safety success and target failure separately', t => {
    const initial = makeWorkspace('railway');
    initial.program.wires = initial.program.wires.filter(wire => !/^L[01]$/.test(wire.to));
    const f = fixture(t, initial);
    f.click('Test all states');
    const safety = f.lab().querySelector('[data-testid="railway-safety-result"]');
    const behavior = f.lab().querySelector('[data-testid="logikus-target-result"]');
    assert.equal(safety.getAttribute('data-pass'), 'true');
    assert.match(safety.textContent, /32 \/ 32/);
    assert.equal(behavior.getAttribute('data-pass'), 'false');
    assert.match(behavior.textContent, /28 \/ 32/);
    assert.equal(f.byText('Show unsafe state'), undefined);
    const replay = f.byText('Show counterexample');
    replay.focus(); f.click(replay);
    assert.ok(f.lab().querySelector('#logikus-wire'));
    assert.equal(document.activeElement.id, 'logikus-tab-wire');
    const expected = railway.railwayTarget(f.current.workspace.switches);
    const selected = expected.findIndex(Boolean);
    assert.ok(selected === 0 || selected === 1);
    assert.equal(f.lamp(selected).getAttribute('data-selected'), 'true');
    assert.equal(f.lamp(selected).getAttribute('data-on'), 'false');
});

test('renamed railway labels keep fixed semantic ports and German scene copy', t => {
    const initial = makeWorkspace('railway');
    initial.program.switchLabels[0] = 'Renamed input';
    initial.program.lampLabels[0] = 'Renamed output';
    const f = fixture(t, initial, {locale: 'de-DE'});
    const scene = f.lab().querySelector('[data-testid="logikus-railway"]');
    assert.match(scene.textContent, /Zwei Fahrwege, eine Kreuzung/);
    const input = scene.querySelector('[data-input="0"]');
    assert.match(input.getAttribute('aria-label'), /S0: Fahrweg A anfordern/);
    f.click(input);
    assert.equal(f.current.workspace.switches[0], 1);
    assert.match(f.lamp(0).getAttribute('aria-label'), /Renamed output: an/);
    assert.match(scene.querySelector('[data-signal="0"]').textContent, /FAHRT/);
    f.click('Alle Zustände testen');
    assert.match(f.lab().querySelector('[data-testid="railway-safety-result"]').textContent, /Sicherheitsprüfungen/);
    assert.match(f.lab().querySelector('[data-testid="logikus-target-result"]').textContent, /Zielverhalten/);
});

test('a railway import restores the scene and leaving the preset removes railway reports', async t => {
    const f = fixture(t, makeWorkspace('half-adder')), pending = deferred();
    const imported = makeWorkspace('railway');
    imported.switches[1] = 1;
    f.importFile(pending);
    await flush(() => pending.resolve(JSON.stringify(imported)));
    assert.equal(f.current.workspace.presetId, 'railway');
    assert.equal(f.lab().querySelector('[data-signal="1"]').getAttribute('data-green'), 'true');
    f.click('Test all states');
    assert.ok(f.lab().querySelector('[data-testid="railway-safety-result"]'));
    f.click('Half adder: 1 + 1 = 10');
    assert.equal(f.lab().querySelector('[data-testid="logikus-railway"]'), null);
    f.click('Test all states');
    assert.equal(f.lab().querySelector('[data-testid="railway-safety-result"]'), null);
    assert.match(f.lab().querySelector('[data-testid="logikus-target-result"]').textContent, /4 \/ 4/);
});

test('Undo and Redo across railway and other experiments cannot render a stale table', t => {
    const f = fixture(t, makeWorkspace('railway'));
    f.click('Half adder: 1 + 1 = 10');
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="logikus-target-result"]').textContent, /4 \/ 4/);
    f.click('Undo');
    assert.equal(f.current.workspace.presetId, 'railway');
    assert.equal(f.lab().querySelector('[data-testid="logikus-target-result"]'), null);
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="railway-safety-result"]').textContent, /32 \/ 32/);
    f.click('Redo');
    assert.equal(f.current.workspace.presetId, 'half-adder');
    assert.equal(f.lab().querySelector('[data-testid="railway-safety-result"]'), null);
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="logikus-target-result"]').textContent, /4 \/ 4/);
});

test('importing railway over a populated nonrailway table never renders incompatible rows', async t => {
    const f = fixture(t, makeWorkspace('half-adder')), pending = deferred();
    f.click('Test all states');
    f.importFile(pending);
    await flush(() => pending.resolve(JSON.stringify(makeWorkspace('railway'))));
    assert.equal(f.current.workspace.presetId, 'railway');
    assert.equal(f.lab().querySelector('[data-testid="logikus-target-result"]'), null);
    f.click('Test all states');
    assert.match(f.lab().querySelector('[data-testid="railway-safety-result"]').textContent, /32 \/ 32/);
});

test('unsafe replay highlights the incorrect signal when the other green is legitimate', t => {
    const initial = makeWorkspace('railway');
    initial.program.wires.push({id: 'fault-entry', from: 'Q', to: 'S0.Ca'},
        {id: 'fault-exit', from: 'S0.Cb', to: 'L1'});
    const f = fixture(t, initial);
    f.click('Test all states');
    f.click('Show unsafe state');
    assert.deepEqual(f.current.workspace.switches.slice(0, 5), [1, 0, 0, 0, 0]);
    assert.equal(f.lamp(0).getAttribute('data-on'), 'true');
    assert.equal(f.lamp(1).getAttribute('data-on'), 'true');
    assert.equal(f.lamp(1).getAttribute('data-selected'), 'true', 'the extra green B is the counterexample');
});
