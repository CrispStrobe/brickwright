import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import JSZip from 'jszip';
import {ControllerPanel} from 'bw-board/controller.js';
import * as workspaceModule from '../overlay/scratch-gui/src/lib/logikus/workspace.js';
import * as presets from '../overlay/scratch-gui/src/lib/logikus/presets.js';
import * as bridgeModule from '../overlay/scratch-gui/src/lib/logikus/controller-bridge.js';
import * as controllerInputs from '../overlay/scratch-gui/src/lib/controller-inputs.js';
import {attachBrickwrightState, inspectBrickwrightState, applyBrickwrightInspection,
    rollbackBrickwrightInspection, BUNDLE_PATH, BUNDLE_FORMAT, BUNDLE_VERSION} from
    '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const gui = createRequire(process.env.BW_INTEGRATED_ROOT ?
    pathToFileURL(resolve(process.env.BW_INTEGRATED_ROOT, 'package.json')) :
    new URL('../packages/scratch-gui/package.json', import.meta.url));
const React = gui('react'), {create, act} = gui('react-test-renderer');
const code = gui('@babel/core').transformSync(readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/logikus-host.jsx', import.meta.url), 'utf8'), {
    filename: 'logikus-host.jsx', babelrc: false, configFile: false,
    presets: [gui.resolve('@babel/preset-react')],
    plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs'), gui.resolve('@babel/plugin-transform-dynamic-import')]
}).code;
const flush = callback => act(async () => { await callback?.(); await Promise.resolve(); });
const fromPreset = (id = 'half-adder', switches = Array(10).fill(0)) => workspaceModule.createWorkspace({
    program: presets.getPreset(id).program, presetId: id, switches, controller: true
});
const zipFor = async state => {
    const zip = new JSZip();
    zip.file('project.json', '{"targets":[]}');
    if (state !== undefined) zip.file(BUNDLE_PATH, JSON.stringify({format: BUNDLE_FORMAT,
        version: BUNDLE_VERSION, state}));
    return zip;
};

// Mount the shipping Host with real React, ControllerPanel, circuit evaluator
// and bundle transaction. Only the lazy visual pane is replaced by a probe:
// this tests its callbacks/lifetime without claiming browser layout coverage.
async function fixture (initial = fromPreset(), {parentFirst = false} = {}) {
    const previous = Object.fromEntries(['window', 'document', 'localStorage'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const oldLive = workspaceModule.getLiveWorkspace();
    const oldGeneration = workspaceModule.getWorkspaceGeneration();
    workspaceModule.setLiveWorkspace(undefined);
    const values = new Map([[workspaceModule.LOGIKUS_STORAGE_KEY, JSON.stringify(initial)]]);
    let blocked = false;
    globalThis.window = new EventTarget();
    globalThis.document = new EventTarget();
    document.hidden = false;
    globalThis.localStorage = {
        get length () { return values.size; }, key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => {
            if (blocked && key === workspaceModule.LOGIKUS_STORAGE_KEY) throw new Error('Storage quota exceeded');
            values.set(key, String(value));
        },
        removeItem: key => values.delete(key)
    };
    const panel = new ControllerPanel();
    panel.addWidget('existing', 'slider', {min: -10, max: 10}, {x: 8, y: 12});
    panel.bindToVariable('existing', 'speed');
    const installer = bridgeModule.connectLogikusController(panel, {getWorkspace: () => initial, onInputs () {}});
    installer.install(initial); installer.dispose();
    values.set('bw-ctl-widgets', JSON.stringify(panel.toJSON()));
    const runtime = new EventEmitter();
    const vm = {runtime};
    const restorePanel = () => {
        const raw = values.get('bw-ctl-widgets');
        const restored = raw ? ControllerPanel.fromJSON(JSON.parse(raw)) : null;
        controllerInputs.clearControllerPanel(panel);
        if (restored) {
            for (const widget of restored.getWidgets()) {
                const added = panel.addWidget(widget.name, widget.type, widget.config, widget.layout);
                added.binding = widget.binding;
            }
            panel.setMode(restored.mode);
        }
    };
    if (parentFirst) window.addEventListener('bw-project-bundle-loaded', restorePanel);
    let mounts = 0;
    function Probe (props) {
        const [instance] = React.useState(() => ++mounts);
        return React.createElement('logikus-probe', {...props, instance});
    }
    const module = {exports: {}};
    new Function('require', 'module', 'exports', code)(name => {
        if (name === './logikus-lab.jsx') return {__esModule: true, default: Probe};
        if (name.endsWith('/logikus/workspace.js')) return workspaceModule;
        if (name.endsWith('/logikus/presets.js')) return presets;
        if (name.endsWith('/logikus/controller-bridge.js')) return bridgeModule;
        if (name.endsWith('/controller-inputs.js')) return controllerInputs;
        return gui(name);
    }, module, module.exports);
    let renderer;
    await flush(() => { renderer = create(React.createElement(module.exports.default, {panel, vm, locale: 'en'})); });
    if (!parentFirst) window.addEventListener('bw-project-bundle-loaded', restorePanel);
    const open = async detail => {
        await flush(() => window.dispatchEvent(new CustomEvent('bw-logikus-open', {detail})));
        // Drain the transformed dynamic import and React's Suspense retry.
        await flush(() => new Promise(done => setImmediate(done)));
    };
    const lab = () => {
        const probes = renderer.root.findAllByType('logikus-probe');
        assert.equal(probes.length, 1, `Expected open lab: ${JSON.stringify(renderer.toJSON())}`);
        return probes[0].props;
    };
    const load = async next => {
        const freshPanel = new ControllerPanel();
        if (next) {
            const bridge = bridgeModule.connectLogikusController(freshPanel, {getWorkspace: () => next, onInputs () {}});
            bridge.install(next); bridge.dispose();
        }
        const zip = await zipFor(next ? {logikus: next, controller: freshPanel.toJSON()} : undefined);
        const inspected = await inspectBrickwrightState(await zip.generateAsync({type: 'arraybuffer'}));
        let applied;
        await flush(() => {
            applied = applyBrickwrightInspection(inspected);
            window.dispatchEvent(new CustomEvent('bw-project-bundle-loaded', {detail: applied}));
        });
        return applied;
    };
    return {panel, runtime, values, open, lab, load,
        blockStorage: () => { blocked = true; },
        saved: () => JSON.parse(values.get(workspaceModule.LOGIKUS_STORAGE_KEY)),
        async saveArchive () {
            let saved;
            await flush(async () => {
                const base = await (await zipFor()).generateAsync({type: 'blob'});
                saved = await attachBrickwrightState(base);
            });
            return JSON.parse(await (await JSZip.loadAsync(await saved.arrayBuffer())).file(BUNDLE_PATH).async('text'));
        },
        async close () {
            await flush(() => renderer.unmount());
            workspaceModule.setLiveWorkspace(oldLive);
            workspaceModule.setWorkspaceGeneration(oldGeneration);
            for (const [key, descriptor] of Object.entries(previous)) {
                if (descriptor) Object.defineProperty(globalThis, key, descriptor);
                else delete globalThis[key];
            }
        }
    };
}

test('closing the pane keeps controller inputs live; collect saves their exact stable values', async () => {
    const f = await fixture();
    try {
        await f.open();
        await flush(() => f.lab().onClose());
        await flush(() => {
            f.panel.setSliderInput('logikus_S0', 1);
            f.panel.setSliderInput('logikus_S1', 1);
        });
        assert.deepEqual(f.saved().switches, [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert.equal(f.panel.getValue('logikus_L1'), 1);
        assert.deepEqual((await f.saveArchive()).state.logikus.switches, f.saved().switches);
        assert.deepEqual(f.panel.getWidget('existing').binding, {target: 'variable', variableName: 'speed'});
    } finally { await f.close(); }
});

test('program replacement releases Test before publishing new outputs', async () => {
    const f = await fixture(fromPreset('code-lock', [...'1011101101'].map(Number)));
    try {
        await f.open();
        await flush(() => f.lab().onTest(true));
        assert.equal(f.panel.getValue('logikus_L0'), 1);
        const next = structuredClone(f.lab().workspace);
        next.presetId = null;
        for (const wire of next.program.wires) {
            if (wire.to === 'L0') wire.to = 'L1';
            if (wire.from === 'L0') wire.from = 'L1';
        }
        const lit = [];
        f.panel.addListener((kind, detail) => { if (kind === 'input' && detail.name === 'logikus_L1') lit.push(detail.value); });
        await flush(() => f.lab().onChange(next));
        assert.equal(f.lab().button, false);
        assert.equal(f.panel.getWidget('logikus_test').state.pressed, false);
        assert.ok(!lit.includes(1), 'the new wiring never runs with the previous held button');
    } finally { await f.close(); }
});

test('project load survives parent-first controller teardown and retires old pane callbacks/history', async () => {
    const f = await fixture(fromPreset('code-lock', [...'1011101101'].map(Number)), {parentFirst: true});
    try {
        await f.open();
        const old = f.lab();
        await flush(() => old.onTest(true));
        const next = fromPreset('half-adder', [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
        await f.load(next);
        assert.deepEqual(f.saved(), next, 'old button release cannot overwrite the imported workspace');
        assert.notEqual(f.lab().instance, old.instance, 'a fresh pane cannot retain another project’s undo history');
        assert.equal(f.panel.getValue('logikus_L1'), 1);
        await flush(() => { old.onChange(old.workspace); old.onClose(); });
        assert.deepEqual(f.saved(), next, 'late callbacks from the retired pane cannot overwrite the project');
        assert.equal(f.lab().workspace.presetId, 'half-adder');
        await f.load(null);
        assert.equal(f.values.has(workspaceModule.LOGIKUS_STORAGE_KEY), false);
        assert.equal(workspaceModule.getLiveWorkspace(), null);
    } finally { await f.close(); }
});

test('external lesson presets retire the pane while its own ordinary edits stay undoable', async () => {
    const f = await fixture();
    try {
        await f.open();
        const old = f.lab();
        await flush(() => old.onChange({...old.workspace, switches: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]}));
        assert.equal(f.lab().instance, old.instance);
        await f.open({presetId: 'xor'});
        assert.notEqual(f.lab().instance, old.instance);
        assert.equal(f.lab().workspace.presetId, 'xor');
    } finally { await f.close(); }
});

test('storage failure still exports the current in-memory circuit and rollback restores its generation', async () => {
    const f = await fixture();
    try {
        await f.open();
        const original = f.saved();
        f.blockStorage();
        await flush(() => f.lab().onChange({...f.lab().workspace, switches: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]}));
        assert.deepEqual(f.saved(), original, 'the test really left localStorage stale');
        assert.match(f.lab().error, /save failed/i);
        const live = f.lab().workspace;
        assert.deepEqual((await f.saveArchive()).state.logikus, live, 'SB3 exports the circuit visible to the user');

        // Use another storage object to exercise the transaction independently
        // of the fixture's deliberately exhausted browser storage.
        const store = new Map([[workspaceModule.LOGIKUS_STORAGE_KEY, JSON.stringify(original)]]);
        const storage = {get length () { return store.size; }, key: index => [...store.keys()][index],
            getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key)};
        const generation = workspaceModule.getWorkspaceGeneration();
        const applied = applyBrickwrightInspection({outcome: 'legacy', state: {}}, storage);
        assert.equal(workspaceModule.getLiveWorkspace(), undefined);
        assert.equal(workspaceModule.getWorkspaceGeneration(), generation + 1);
        assert.equal(rollbackBrickwrightInspection(applied, storage).rolledBack, true);
        assert.deepEqual(workspaceModule.getLiveWorkspace(), live);
        assert.equal(workspaceModule.getWorkspaceGeneration(), generation);
    } finally { await f.close(); }
});
