// SPDX-License-Identifier: BSD-3-Clause
// Actual React callbacks/DOM with controlled fetch/runner promises. These
// lifecycle controls are explicitly mocked, not actual native engine proof.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const gui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const {JSDOM} = createRequire(gui.resolve('isomorphic-dompurify'))('jsdom');
const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {url: 'http://localhost/'});
const descriptors = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator})) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {configurable: true, value});
}
dom.window.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
dom.window.HTMLDialogElement.prototype.close = function () {this.open = false;};
const React = gui('react'), ReactDOM = gui('react-dom'), {act, Simulate} = gui('react-dom/test-utils');
let fetchImpl, runImpl;
const api = {catalog: {topbench: {title: 'TOPBENCH', files: {}}, whetstone: {title: 'Whetstone validation', files: {}}},
    provenance: {repository: 'CrispStrobe/brickwright-media-lab', commit: 'a'.repeat(40), base: 'projects/x86-benchmarks'},
    fetchAssets: (...args) => fetchImpl(...args), runNativeBenchmark: (...args) => runImpl(...args)};
const source = readFileSync(new URL('../overlay/scratch-gui/src/components/menu-bar/native-benchmarks.jsx', import.meta.url), 'utf8');
const {code} = gui('@babel/core').transformSync(source, {filename: 'native-benchmarks.jsx', babelrc: false, configFile: false,
    presets: [gui.resolve('@babel/preset-react')], plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs')]});
const module = {exports: {}};
new Function('require', 'module', 'exports', code)(name => name.includes('bw-native-benchmarks') ? api : name.endsWith('.css') ? {} : gui(name), module, module.exports);
const Panel = module.exports.default, app = document.querySelector('#app');
const select = id => document.querySelector(`[data-testid="native-benchmark-${id}"]`);
const click = id => act(() => Simulate.click(select(id)));
const open = () => {act(() => ReactDOM.render(React.createElement(Panel), app));
    act(() => window.dispatchEvent(new window.Event('bw-open-native-benchmarks')));};
const flush = async () => {await act(async () => {await new Promise(resolve => setTimeout(resolve, 0));});};
after(() => {
    ReactDOM.unmountComponentAtNode(app); dom.window.close();
    for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
});
test('license precedes Run; live output renders; Stop rejects stale completion and preserves subsequent run', async () => {
    fetchImpl = async (_, options) => {options.onNotice('Exact retained permission'); return {project: 'topbench'};};
    let complete, capturedSignal;
    runImpl = (_, options) => {capturedSignal = options.signal; options.onProgress({steps: 7, retired: 5, stdout: 'live DOS', screen: ['live CGA']});
        return new Promise(resolve => {complete = resolve;});};
    open(); assert.equal(select('run').disabled, true);
    click('fetch'); await flush();
    assert.equal(select('license').textContent, 'Exact retained permission'); assert.equal(select('run').disabled, false);
    click('run'); assert.equal(select('screen').textContent, 'live CGA'); assert.equal(select('stdout').textContent, 'live DOS');
    click('stop'); assert.equal(capturedSignal.aborted, true); assert.match(select('status').textContent, /Stopped/);
    complete({accepted: true, exitCode: 4, stdout: 'stale', screen: ['stale']}); await flush();
    assert.match(select('status').textContent, /Stopped/); assert.equal(select('screen').textContent, 'live CGA');
    runImpl = async () => ({status: 'complete', accepted: true, exitCode: 4, retired: 20, steps: 22, screen: ['new'], stdout: ''});
    click('run'); await flush(); assert.match(select('status').textContent, /Complete/); assert.equal(select('screen').textContent, 'new');
    act(() => ReactDOM.unmountComponentAtNode(app));
});
test('fetch failure, source-only Whetstone and close during fetch never enable stale Run', async () => {
    open(); fetchImpl = async () => {throw Error('hash mismatch');}; click('fetch'); await flush();
    assert.match(select('status').textContent, /Error: hash mismatch/); assert.equal(select('run').disabled, true);
    act(() => Simulate.change(select('project'), {target: {value: 'whetstone'}}));
    fetchImpl = async (_, options) => {options.onNotice('source permission'); return {project: 'whetstone'};};
    click('fetch'); await flush(); assert.equal(select('run').disabled, true); assert.match(select('status').textContent, /unavailable/);
    let finish, signal; fetchImpl = (_, options) => {signal = options.signal; return new Promise(resolve => {finish = resolve;});};
    click('fetch'); act(() => Simulate.click(document.querySelector('button'))); assert.equal(signal.aborted, true);
    finish({project: 'topbench'}); await flush(); assert.equal(document.querySelector('[data-testid="native-benchmarks"]'), null);
    act(() => ReactDOM.unmountComponentAtNode(app));
});
