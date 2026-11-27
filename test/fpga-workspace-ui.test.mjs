// SPDX-License-Identifier: BSD-3-Clause
// Exercise the actual JSX return with passive element records: no browser,
// worker, circuit, toolchain, download or hardware is started by this control.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-fpga/examples.js';
import {deriveView, viewStyles} from '../overlay/scratch-gui/src/lib/bw-fpga/tab-view.js';

// Hosted jobs resolve the GUI's installed dependencies. A bounded local check
// may explicitly point at an already cached GUI package without installing it.
const require = createRequire(process.env.BW_TEST_BABEL_ROOT
    ? resolve(process.env.BW_TEST_BABEL_ROOT, 'package.json')
    : new URL('../packages/scratch-gui/package.json', import.meta.url));
const babel = require('@babel/core');
const parser = require('@babel/parser');
const jsx = require('@babel/plugin-transform-react-jsx');
const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/fpga-tab.jsx', import.meta.url), 'utf8');
const program = parser.parse(source, {sourceType: 'module', plugins: ['jsx']}).program;
const declaration = name => program.body.flatMap(node => node.declarations || []).find(node => node.id.name === name);
const literal = name => {
    const {start, end} = declaration(name).init;
    return vm.runInNewContext(`(${source.slice(start, end)})`);
};
const locales = literal('L10N');
const workspaceModes = literal('workspaceModes');
const renderNode = declaration('FpgaTab').init.body.body.findLast(node => node.type === 'ReturnStatement').argument;
const renderCode = babel.transformSync(`(${source.slice(renderNode.start, renderNode.end)})`, {
    configFile: false, babelrc: false, plugins: [jsx], comments: false
}).code;
const element = (type, props, ...children) => ({type, props: {...props, children: children.flat(Infinity)}});
const nodes = (node, visibleOnly = false, visible = true) => {
    if (!node || typeof node !== 'object') return [];
    visible = visible && !node.props.hidden;
    const descendantsVisible = visible && node.type !== 'FpgaInfo' && (node.type !== 'Popup' || node.props.open);
    return [...(!visibleOnly || visible ? [node] : []),
        ...node.props.children.flatMap(child => nodes(child, visibleOnly, descendantsVisible))];
};
const find = (tree, id) => nodes(tree).find(node => node.props['data-testid'] === id);
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
    : node && node.props ? node.props.children.map(text).join(' ') : '';
const visibleText = tree => nodes(tree, true).filter(node => node.type !== 'FpgaInfo')
    .flatMap(node => node.props.children.filter(child => typeof child !== 'object')).join(' ');

const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label);

function fixture (overrides = {}) {
    const state = {
        React: {createElement: element, Fragment: 'Fragment', Suspense: 'Suspense'},
        FpgaInfo: 'FpgaInfo', Icon: 'Icon', Popup: 'Popup', Row: 'Row', FpgaGateBuilderRf: 'Canvas',
        FpgaSchematic: 'Schematic', FpgaWaveform: 'Waveform', L10N: locales,
        pickLocale: locale => locale === 'de' ? 'de' : 'en', props: {locale: 'en'}, T: locales.en,
        tools: {button: {}, primary: {}, pressed: {}, stop: {}}, toolbar: {}, selector: {}, field: {},
        EXAMPLES, selectedExample: EXAMPLES[0], exampleId: EXAMPLES[0].id,
        workspace: 'design', workspaceMenuOpen: false, workspaceModes, editor: 'canvas', realization: 'demo', buildTarget: 'service',
        simulationView: 'schematic', controllerDisplay: 'leds', cmosGate: 'nand', icGate: 'and',
        icCircuit: 'half_adder', LOGIC_IC_GATES: ['and', 'or'], IC_CIRCUITS: {half_adder: {label: 'Half adder'}},
        circuitLabel: spec => spec.label, tr: (locale, key) => key,
        hdl: 'module top; endmodule', text: 'constraints', seed: {nodes: []},
        hdlScreen: {refusals: [], warnings: []}, warnings: [], refusals: [], bindings: [],
        netlistText: '{}', top: 'top', netValues: {}, inputs: {}, inputPorts: ['a'],
        clockPort: 'clk', clockCycles: 3, autoRun: false, mirrored: false, outputPins: [15, 16],
        guideDismissed: false, demoMsg: null, synth: null, artefacts: null, local: {ok: true, available: true}, localBusy: false, building: false,
        flash: {available: false}, flashMsg: null, backend: 'auto',
        catalog: [{id: 'hosted', label: 'Hosted'}], probe: {available: [], probes: []},
        selection: {accepted: false, code: 'no-backend', reason: 'No backend'},
        offerable: (catalog, available) => catalog.filter(entry => available.includes(entry.id)),
        plan: {ops: [], unset: []}, simNote: null, canonical: '', webUsbSupported: () => false,
        wireDemoBoard: () => {}, realizeGate: () => {}, realizeIcGate: () => {}, realizeIcCircuit: () => {},
        ...overrides
    };
    for (const name of ['Workspace', 'WorkspaceMenuOpen', 'Editor', 'ExampleId', 'Realization', 'BuildTarget', 'SimulationView',
        'GuideDismissed', 'ControllerDisplay', 'CmosGate', 'IcGate', 'IcCircuit', 'Hdl', 'Text', 'Synth', 'Seed', 'ClockCycles',
        'AutoRun', 'Mirrored', 'Inputs', 'NetlistText', 'Local', 'LocalBusy', 'Building', 'FlashMsg', 'Backend']) {
        const key = name[0].toLowerCase() + name.slice(1);
        state[`set${name}`] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
    }
    state.render = () => {
        state.T = locales[state.props.locale];
        state.selectedExample = EXAMPLES.find(example => example.id === state.exampleId);
        // The REAL derivation and tokens, exactly as the tab computes them.
        state.ui = viewStyles(state.tools);
        state.view = deriveView(state);
        return vm.runInNewContext(renderCode, state);
    };
    return state;
}

test('examples use one real selector and Load carries the complete chosen design', () => {
    const state = fixture();
    let tree = state.render();
    assert.equal(find(tree, 'bw-fpga-example').type, 'select');
    assert.equal(find(tree, 'bw-fpga-example').props.children.length, EXAMPLES.length);
    assert.ok(!nodes(tree).some(node => node.type === 'button' && EXAMPLES.some(example => text(node) === example.label)));
    find(tree, 'bw-fpga-example').props.onChange({target: {value: EXAMPLES.at(-1).id}});
    tree = state.render();
    find(tree, 'bw-fpga-load-example').props.onClick();
    assert.equal(state.hdl, EXAMPLES.at(-1).verilog);
    assert.equal(state.text, EXAMPLES.at(-1).cst);
    assert.equal(state.seed, EXAMPLES.at(-1).model);
    assert.equal(state.synth, null);
});

test('workspace and view choices preserve all mounted editors and session values', () => {
    const state = fixture();
    for (const mode of ['build', 'simulate', 'design']) {
        const before = state.render();
        find(before, `bw-fpga-workspace-${mode}`).props.onClick();
        const tree = state.render();
        for (const panel of ['design', 'build', 'simulate']) {
            assert.equal(find(tree, `bw-fpga-panel-${panel}`).props.hidden, panel !== mode);
        }
        for (const type of ['Canvas', 'Schematic', 'Waveform']) {
            assert.equal(nodes(tree).filter(node => node.type === type).length, 1, `${type} stays mounted`);
        }
        assert.equal(state.clockCycles, 3);
        assert.equal(state.netlistText, '{}');
        assert.equal(state.hdl, 'module top; endmodule');
    }
    find(state.render(), 'bw-fpga-editor').props.onChange({target: {value: 'verilog'}});
    assert.equal(find(state.render(), 'bw-fpga-canvas-editor').props.hidden, true);
    assert.equal(find(state.render(), 'bw-fpga-verilog-editor').props.hidden, false);
    find(state.render(), 'bw-fpga-simulation-view').props.onChange({target: {value: 'waveforms'}});
    assert.equal(find(state.render(), 'bw-fpga-waveform-view').props.hidden, false);
    assert.equal(find(state.render(), 'bw-fpga-schematic-view').props.hidden, true);
});

test('realization selector exposes only its actual action and routes the chosen gate', () => {
    const state = fixture();
    const actions = {transistors: 'bw-fpga-build-transistors', ic: 'bw-fpga-build-ic', circuit: 'bw-fpga-build-circuit'};
    for (const [mode, id] of Object.entries(actions)) {
        find(state.render(), 'bw-fpga-realization').props.onChange({target: {value: mode}});
        const tree = state.render();
        for (const other of Object.values(actions)) assert.equal(Boolean(find(tree, other)), other === id);
    }
    state.realization = 'transistors';
    let actual;
    state.realizeGate = gate => { actual = gate; };
    find(state.render(), 'bw-fpga-cmos-gate').props.onChange({target: {value: 'nor'}});
    find(state.render(), actions.transistors).props.onClick();
    assert.equal(actual, 'nor');
});

test('failures and warnings remain visible in every workspace; help stays opt-in', () => {
    const state = fixture({
        hdlScreen: {refusals: [{spdx: 'GPL', reason: 'licence-refusal'}], warnings: [{reason: 'licence-warning'}]},
        warnings: [{port: 'led', reason: 'pin-warning'}], refusals: [{port: 'x', reason: 'pin-refusal'}],
        local: {ok: false, code: 'worker-gone', reason: 'worker-failure'},
        synth: {ok: false, code: 'synthesis-failed', reason: 'build-failure'}, demoMsg: {ok: false, text: 'circuit-failure'}
    });
    for (const workspace of ['design', 'build', 'simulate']) {
        state.workspace = workspace;
        const tree = state.render();
        const visible = visibleText(tree);
        for (const reason of ['licence-refusal', 'licence-warning', 'pin-warning', 'pin-refusal', 'worker-failure', 'build-failure', 'circuit-failure']) {
            assert.ok(visible.includes(reason), `${reason} remains visible in ${workspace}`);
        }
        assert.ok(!visible.includes(locales.en.fpgaDesc1), 'overview prose is inside labelled information');
    }
});

test('build availability guards and browser download consent survive presentation choices', async () => {
    const state = fixture({workspace: 'build'});
    const button = label => nodes(state.render()).find(node => node.type === 'button' && text(node).trim() === label);
    assert.equal(button(locales.en.synthesiseBtn).props.disabled, true);
    state.selection = {accepted: true, selected: {label: 'Hosted', endpoint: 'owned-service'}, reason: 'available'};
    let request;
    state.synthesise = async data => { request = data; return {ok: true, simNetlist: {modules: {top: {}}}}; };
    await button(locales.en.synthesiseBtn).props.onClick();
    assert.equal(request.constraints, state.text);
    assert.equal(request.files[0].source, state.hdl);
    assert.equal(request.endpoint, 'owned-service');
    assert.ok(state.netlistText.includes('modules'));
    state.hdl = '';
    assert.equal(button(locales.en.synthesiseBtn).props.disabled, true);
    assert.equal(button(locales.en.synthesiseHereBtn).props.disabled, true);
    state.local = {code: 'not-downloaded', available: false};
    let consent;
    state.localClient = {download: async data => { consent = data.consent; return {result: {ok: true}}; }};
    button(locales.en.downloadToolchain).props.onClick();
    await Promise.resolve();
    assert.equal(consent, true);
});

test('successful artifacts stay reachable and flashing remains capability-gated', () => {
    const state = fixture({synth: {ok: true}, artefacts: {bitstream: {bytes: 42, url: 'blob:owned'}}});
    for (const workspace of ['design', 'build', 'simulate']) {
        state.workspace = workspace;
        assert.ok(nodes(state.render(), true).some(node => node.type === 'a' && node.props.download === 'design.fs'));
        assert.ok(!nodes(state.render()).some(node => node.type === 'button' && text(node).trim() === locales.en.flashToBoard));
    }
    state.flash.available = true;
    assert.ok(nodes(state.render(), true).some(node => node.type === 'button' && text(node).trim() === locales.en.flashToBoard));
    state.artefacts = {netlist: {modules: 1, url: 'blob:netlist'}};
    assert.ok(nodes(state.render(), true).some(node => node.type === 'a' && node.props.download === 'design.json'));
});

test('new selectors and information controls have English and German labels', () => {
    for (const locale of ['en', 'de']) {
        const tree = fixture({props: {locale}}).render();
        assert.ok(text(find(tree, 'bw-fpga-workspace-design')).includes(locales[locale].designWorkspace));
        assert.ok(text(find(tree, 'bw-fpga-workspace-build')).includes(locales[locale].buildWorkspace));
        assert.ok(text(find(tree, 'bw-fpga-workspace-simulate')).includes(locales[locale].simulateWorkspace));
        for (const node of nodes(tree).filter(node => node.type === 'FpgaInfo')) assert.ok(node.props.label);
        assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.de).sort());
    }
});

test('steps show their completion and the next-step buttons move through the flow', () => {
    const state = fixture({hdl: 'module t; endmodule', synth: {ok: true}, artefacts: {netlist: {modules: 1, url: 'blob:n'}}, clockCycles: 0});
    let tree = state.render();
    assert.ok(text(find(tree, 'bw-fpga-workspace-design')).includes('✓'));
    assert.ok(text(find(tree, 'bw-fpga-workspace-build')).includes('✓'));
    assert.ok(!text(find(tree, 'bw-fpga-workspace-simulate')).includes('✓'), 'stepping the clock is what completes Simulate');
    find(tree, 'bw-fpga-next-build').props.onClick();
    assert.equal(state.workspace, 'build');
    // A finished build offers the way on from every other workspace, and not on Simulate itself.
    tree = state.render();
    find(tree, 'bw-fpga-next-simulate').props.onClick();
    assert.equal(state.workspace, 'simulate');
    assert.equal(find(state.render(), 'bw-fpga-next-simulate'), undefined);
});

test('a running build is announced and a failure carries its next step', () => {
    const state = fixture({building: true,
        selection: {accepted: true, selected: {label: 'Hosted', endpoint: 'e'}, reason: 'ok'}});
    let tree = state.render();
    const busy = find(tree, 'bw-fpga-busy');
    assert.ok(busy, 'a hosted build in flight shows a busy status');
    assert.ok(text(busy).includes('Hosted'));
    assert.equal(button(tree, locales.en.synthesising).props.disabled, true, 'the button cannot be pressed twice');
    state.building = false;
    state.synth = {ok: false, code: 'unreachable', reason: 'no route'};
    tree = state.render();
    assert.equal(find(tree, 'bw-fpga-busy'), undefined);
    const problems = text(find(tree, 'bw-fpga-problems'));
    assert.ok(problems.includes('no route') && problems.includes(locales.en.synthFailedNext));
});

test('heads-ups are collapsed behind one count while blockers stay open', () => {
    const state = fixture({warnings: [{port: 'a', reason: 'w1'}, {port: 'b', reason: 'w2'}],
        refusals: [{port: 'clk', reason: 'r1'}]});
    let tree = state.render();
    assert.equal(find(tree, 'bw-fpga-headsup').type, 'details');
    assert.ok(text(find(tree, 'bw-fpga-headsup')).includes('Notes (3)'));
    assert.equal(find(tree, 'bw-fpga-problems'), undefined, 'a pin that cannot reach the board is a note, not an alarm');
    state.synth = {ok: false, code: 'synthesis-failed', reason: 'bad'};
    tree = state.render();
    assert.equal(find(tree, 'bw-fpga-problems').type, 'div', 'blockers are not inside a closed disclosure');
});

test('an empty Simulate step says what to do and offers the way', () => {
    const state = fixture({workspace: 'simulate', netlistText: ''});
    const go = find(state.render(), 'bw-fpga-goto-build');
    assert.ok(go);
    go.props.onClick();
    assert.equal(state.workspace, 'build');
});
