import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ControllerPanel} from 'bw-board/controller.js';
import {bindPanelToBoard} from 'bw-board/controller-binding.js';
import {clearControllerPanel} from '../overlay/scratch-gui/src/lib/controller-inputs.js';
import {scopeAfter} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass, codeDocumentLabels} from './helpers/code-document-editor.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const uploader = read('../overlay/scratch-gui/src/lib/sb-file-uploader-hoc.jsx');
// The load sequence itself, shared by the web file input and the desktop app's native
// documents (Open dialog, Recent Projects, file associations).
const loader = read('../overlay/scratch-gui/src/lib/bw-project-load.js');
const nativeBridge = read('../overlay/scratch-gui/src/lib/tauri-bridge.js');
const code = read('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx');
const circuit = read('../overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
const gui = read('../overlay/scratch-gui/src/components/gui/gui.jsx');

describe('mounted project consumers obey replacement outcomes', () => {
    test('the project loader announces legacy, invalid and future outcomes, not only found bundles', () => {
        assert.match(loader, /if \(bundle && typeof window !== 'undefined'\)/);
        assert.doesNotMatch(loader, /bundle && bundle\.found/,
            'restoring this guard makes vanilla loads invisible to mounted tabs');
        assert.match(loader, /bw-project-bundle-loaded/);
    });

    test('the project loader preflights compatibility and can roll back before reporting success', () => {
        const inspectAt = loader.indexOf('inspectBrickwrightState(rawFile)');
        const loadAt = loader.indexOf('vm.loadProject(rawFile)');
        assert.ok(inspectAt >= 0 && inspectAt < loadAt,
            'sidecar compatibility must be known before Scratch mutates its VM');
        assert.match(loader, /outcome === 'invalid'.*outcome === 'future'/s);
        assert.match(loader, /rollbackBrickwrightInspection\(bundle\)/,
            'a VM rejection must restore the auxiliary project snapshot');
    });

    test('every project-file path loads through the one loader, never the VM directly', () => {
        // Before the native documents landed, the app's file-association path called
        // vm.loadProject itself and skipped the preflight, the rollback and the tab refresh.
        for (const [name, source, call] of [
            ['the web file input', uploader, /loadProjectFile\(this\.props\.vm, /],
            ['the native documents', nativeBridge, /loadProjectFile\(vm, /]
        ]) {
            assert.match(source, call, `${name} must load through lib/bw-project-load.js`);
            assert.doesNotMatch(source, /\bvm\.loadProject\(/,
                `${name} must not call vm.loadProject around the shared loader`);
        }
    });

    test('Code explicitly clears every authored buffer on loaded empty or legacy state', () => {
        assert.match(code, /outcome === 'legacy'.*outcome === 'loaded'/s);
        // Follow the actual bundle consumer through the shared document reset,
        // rather than requiring its former inline Object.fromEntries spelling.
        const Editor = codeDocumentEditorClass(code,
            `handleBundle (event) ${scopeAfter(code, 'this._onBundleLoaded = event => {')}`);
        for (const outcome of ['loaded', 'legacy']) {
            const controls = [];
            const component = Object.assign(new Editor(), {props: {},
                state: {lang: 'javascript', buffers: Object.fromEntries(
                    Object.keys(codeDocumentLabels).map(lang => [lang, `old ${lang}`]))},
                readAutosave: () => null, publishGameControls: value => controls.push(value),
                setState (patch) {Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);}});
            component.handleBundle({detail: {outcome}});
            assert.deepEqual(component.state.buffers, Object.fromEntries(
                Object.keys(codeDocumentLabels).map(lang => [lang, ''])), 'every old authored buffer is cleared');
            assert.equal(component.state.codeDocument.lang, 'pseudocode');
            assert.equal(component.state.codeDocument.code, '');
            assert.equal(component.state.codeDocument.target, null);
            assert.deepEqual(controls, [null]);
        }
        const labels = /const LANG_LABEL = \{([^}]*)\}/.exec(code);
        assert.ok(labels, 'LANG_LABEL not found');
        for (const language of ['pseudocode', 'python', 'javascript', 'c', 'basic', 'asm',
            'micropython']) {
            assert.match(labels[1], new RegExp(`\\b${language}:`), `${language} is not cleared`);
        }
        assert.match(code, /publishGameControls\(null\)/);
        assert.match(code, /preserved-not-applied|report\?\.action/,
            'future/invalid compatibility must be visible rather than silent');
    });

    test('Circuit and Controller both clear when their incoming section is absent', () => {
        // This asserted the LITERAL `circuitData: {version: 1, parts: [], wires: []}`
        // and went red the moment that object was given a name — a gate that
        // tracked one spelling rather than the behaviour underneath it. Restated
        // as the invariant that actually matters, which is also strictly more
        // than the old line checked: every branch that decides what the circuit
        // now IS must reach the LIVE model as well as React state.
        //
        // vm.runtime.circuitModel is not the Designer's private state —
        // bw-debug's debug-runner and the circuit VM extension resolve the board
        // through it — but the Designer is what assigns it, and circuit-tab's
        // render drops the Designer entirely when the debugger is docked 'right'
        // (the default) while the Code tab is active. React state alone therefore
        // leaves a running program on the previous project's board.
        const applied = [...circuit.matchAll(
            /this\.setState\(\{circuitData: (\w+)\}\);\s*\n\s*this\._applyToLiveCircuit\(\1\);/g)];
        assert.equal(applied.length, 2,
            'both the restore and the replacement branch must hand their circuit to ' +
            `vm.runtime.circuitModel, not only to setState — found ${applied.length}`);
        assert.match(circuit, /\{version: 1, parts: \[\], wires: \[\]\}/,
            'replacement must still produce an empty bench');
        // Execute the actual mounted consumer rather than require an inline
        // spelling of its clearing loop. The helper also releases bound inputs.
        //
        // WHICH consumer moved: b15ff59f0 (2026-11-17) took Widgets restoration
        // out of circuit-tab's `_onBundleLoaded` and gave it to gui.jsx, which
        // stays mounted when the Circuit tab is hidden — circuit-tab now only
        // restores the circuit. This subtest kept executing circuit-tab's body,
        // which no longer touches the panel, so it went red for a deliberate
        // move rather than a regression. It now executes the GUI's consumer:
        // the bundle event routes `loaded`/`legacy` (and only those) into
        // `onProjectLoad`, and that body is what clears and restores.
        const circuitConsumer = /this\._onBundleLoaded = event => \{([\s\S]*?)\n        \};/.exec(circuit);
        assert.ok(circuitConsumer, 'circuit-tab still consumes the bundle announcement');
        assert.doesNotMatch(circuitConsumer[1], /controllerPanel|clearControllerPanel|bw-ctl-widgets/,
            'circuit-tab restores Widgets again — two consumers would clear the panel twice');
        assert.match(gui, /const onBundle=event=>\{if\(\['loaded','legacy'\]\.includes\(event\.detail\?\.outcome\)\)onProjectLoad\(\);\};/,
            'the GUI no longer routes loaded/legacy bundle outcomes into its Widgets restore');
        assert.match(gui, /window\.addEventListener\('bw-project-bundle-loaded',onBundle\)/,
            'the GUI no longer listens for the bundle announcement');
        const body = /const onProjectLoad = \(\) => \{([\s\S]*?)\n        \};/.exec(gui);
        assert.ok(body, 'mounted bundle consumer is present');
        for (const outcome of ['loaded', 'legacy']) {
            const panel = new ControllerPanel();
            panel.addWidget('old-key', 'button', {});
            panel.bindToPart('old-key', 'old-switch');
            panel.setMode('play');
            const writes = [];
            const binding = bindPanelToBoard(panel, {setControl: (...args) => writes.push(args)});
            panel.setButtonInput('old-key', true);
            const props = {vm: {runtime: {controllerPanel: panel}}};
            const storage = {getItem: () => null, setItem () {}};
            const restore = new Function('props', 'localStorage', 'ControllerPanel', 'clearControllerPanel',
                'controllerPanel', body[1]);
            const apply = (event, store) => restore(props, store, ControllerPanel, clearControllerPanel, panel);
            try {
                apply({detail: {outcome}}, storage, clearControllerPanel);
                assert.deepEqual(panel.getWidgetNames(), [], 'an absent section removes old widgets');
                assert.deepEqual(writes.at(-1), ['old-switch', 0], 'replacement releases the old circuit input');
                if (outcome === 'loaded') {
                    const data = {version: 1, mode: 'play', hideBindings: true, widgets: [
                        {name: 'trim1', type: 'slider', config: {min: 0, max: 1, value: .7},
                            binding: {target: 'part', partId: 'new-trimmer', param: 'position'}}
                    ]};
                    storage.getItem = key => key === 'bw-ctl-widgets' ? JSON.stringify(data) : null;
                    apply({detail: {outcome}}, storage, clearControllerPanel);
                    assert.deepEqual(panel.getWidgetNames(), ['trim1']);
                    assert.equal(panel.getValue('trim1'), .7);
                    assert.equal(panel.mode, 'play');
                    assert.equal(panel.hideBindings, true);
                    assert.deepEqual(panel.getWidget('trim1').binding, data.widgets[0].binding);
                }
            } finally { binding.dispose(); }
        }
    });
});

test('hidden Circuit replacement preserves the saved supply and live model identity',async()=>{
 const {Circuit}=await import('bw-circuit-ui/model/circuit.js');
 const {setEngine}=await import('bw-circuit-ui/engine.js');
 const {BoardImpl}=await import('bw-board/board.js');
 const {inferNetlist,checkWiring}=await import('bw-board/infer-netlist.js');
 setEngine({BoardImpl,inferNetlist,checkWiring});
 const body=/this\._applyToLiveCircuit = data => \{([\s\S]*?)\n        \};/.exec(circuit);
 assert.ok(body,'test executes the actual hidden host replacement');
 const model=new Circuit(5),host={props:{vm:{runtime:{circuitModel:model}}},_Circuit:Circuit};
 const announcements=[],browser={dispatchEvent:event=>announcements.push(event.type)};
 const apply=new Function('data','window','CustomEvent',body[1]).bind(host);
 const load=data=>apply(data,browser,class {constructor(type){this.type=type;}});
 for(const vcc of [4.5,9,5]){
  const incoming=new Circuit(vcc),v=incoming.addPart('vcc',{},0,0),g=incoming.addPart('gnd',{},0,100),r=incoming.addPart('resistor',{ohms:1000},0,50);
  incoming.addWire(v.id,'vcc',r.id,'a');
  incoming.addWire(r.id,'b',g.id,'gnd');
  load(incoming.toJSON());assert.equal(host.props.vm.runtime.circuitModel,model);
  assert.equal(host.props.vm.runtime.circuitBoard,model.board);
  assert.equal(browser.__board,model.board);
  assert.equal(model.vcc,vcc);assert.equal(model.board.vcc,vcc);
  model.advanceTo(1_000_000n);
  assert.ok(Math.abs(model.board.branchCurrent(r.id,'a')+vcc/1000)<1e-9);
 }
 load({vcc:4.5,parts:[],wires:[]});assert.equal(model.vcc,4.5);assert.equal(model.board.vcc,4.5);
 load({parts:[],wires:[]});assert.equal(model.vcc,5);assert.equal(model.board.vcc,5);
 assert.equal(host.props.vm.runtime.circuitBoard,model.board);
 assert.deepEqual(announcements,Array(5).fill('bw-board-ready'));
});
