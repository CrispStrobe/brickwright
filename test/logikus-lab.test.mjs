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
const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/logikus-lab.jsx', import.meta.url), 'utf8');
const code = gui('@babel/core').transformSync(source, {filename: 'logikus-lab.jsx', babelrc: false, configFile: false,
    presets: [gui.resolve('@babel/preset-react')], plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
const module = {exports: {}};
const styleNames = new Proxy({}, {get: (_, name) => name === '__esModule' ? false : String(name)});
new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('/logikus/model.js')) return model;
    if (name.endsWith('/logikus/presets.js')) return presets;
    if (name.endsWith('/logikus/workspace.js')) return workspaceModule;
    if (name.endsWith('/logikus/inspection.js')) return inspection;
    if (name.endsWith('/download-blob.js')) return async () => {};
    if (name === './logikus-lab.css') return styleNames;
    return gui(name);
}, module, module.exports);
const Lab = module.exports.default;
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

function fixture (t, initial = makeWorkspace('half-adder')) {
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
        return React.createElement(Lab, {workspace, button, locale: 'en', error,
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
