// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {advanceDebugPhase} from '../overlay/scratch-gui/src/lib/bw-debug/debug-phase-transition.js';
import {shouldRefreshDesignerDebugState} from '../overlay/scratch-gui/src/lib/bw-debug/debug-ui-refresh.js';
import {applyBenchTemperature} from '../overlay/scratch-gui/src/lib/bench-temperature.js';

const requireGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const babel = requireGui('@babel/core');
const requireBabel = createRequire(requireGui.resolve('@babel/core'));
const parser = requireBabel('@babel/parser');
const generate = requireBabel('@babel/generator').default;
const React = requireGui('react');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const parse = source => parser.parse(source, {sourceType: 'module', plugins: ['jsx']});
const circuitAst = parse(read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx'));
const panelAst = parse(read('overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'));
const compile = source => babel.transformSync(source, {
    babelrc: false, configFile: false,
    plugins: [requireGui.resolve('@babel/plugin-transform-react-jsx')]
}).code;
const classNamed = (ast, name) => {
    const node = ast.program.body.find(item => item.type === 'ClassDeclaration' && item.id.name === name);
    assert.ok(node, `missing actual class ${name}`);
    return node;
};
const methodNamed = (node, name) => {
    const method = node.body.body.find(item => item.key?.name === name);
    assert.ok(method, `missing actual method ${name}`);
    return method;
};
const topLevel = (ast, name) => {
    const node = ast.program.body.find(item => item.id?.name === name ||
        item.declarations?.some(declaration => declaration.id.name === name));
    assert.ok(node, `missing actual declaration ${name}`);
    return generate(node).code;
};
const circuitClass = classNamed(circuitAst, 'CircuitTab');

// Compile the component's declarations and complete methods, including its
// constructor and render. Only external services are fixtures; none of the
// dock, portal, or status decisions below are reimplemented in a test helper.
const circuitCode = compile(['PanelBoundary', 'HostMount', 'stcDrives',
    'DEBUG_LIVE_REFRESH_MS', 'CIRCUIT_DOCKS', 'DEVICE_DOCKS', 'CircuitTab']
    .map(name => topLevel(circuitAst, name)).join('\n'));
const factoryCode = `const {React, ReactDOM, document, window, localStorage,
    DebugPanel, loadBenchTemperature, getReactPerformanceProbe, profileReactSubtree,
    pt, advanceDebugPhase, shouldRefreshDesignerDebugState, applyBenchTemperature} = env;
    ${circuitCode}\nreturn CircuitTab;`;
const makeCircuit = new Function('env', factoryCode);

// These are the actual final visibility statements in componentDidUpdate.
// Running them separately avoids mounting the unrelated VM/event services.
const updateBody = methodNamed(circuitClass, 'componentDidUpdate').body.body;
const portalNow = updateBody.find(node => node.type === 'VariableDeclaration' &&
    node.declarations.some(declaration => declaration.id.name === 'portalNow'));
const hostVisibility = updateBody.find(node => node.type === 'IfStatement' &&
    generate(node.test).code === 'this._stageHost');
assert.ok(portalNow && hostVisibility, 'actual component update must own stage-host visibility');
const visibilityCode = `${generate(portalNow).code}\n${generate(hostVisibility).code}`;
const applyHostVisibility = new Function(visibilityCode);

const circuitDocks = ['top', 'right', 'off', 'solo'];
const deviceDocks = ['controller', 'microbit', 'arcade', 'cpx', 'arduboy', 'makecode', 'spikearena'];
function storageWith (values = {}) {
    const entries = new Map(Object.entries(values));
    return {getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value))};
}
function fixture ({dock, storage = storageWith({'bw-debug-dock': dock, 'bw-stage-circuit': '1'}), visible = false,
    buildCircuit = makeCircuit, window = {}} = {}) {
    const connected = new Set();
    const document = {contains: node => connected.has(node),
        createElement: () => ({dataset: {}, style: {}})};
    const ReactDOM = {createPortal: (children, container, key) => ({portal: true, children, container, key})};
    const Panel = () => null;
    const CircuitTab = buildCircuit({React, ReactDOM, document, window, localStorage: storage, DebugPanel: Panel,
        loadBenchTemperature: () => 25, getReactPerformanceProbe: () => null,
        profileReactSubtree: (_react, _name, element) => element, pt: (_locale, key) => key,
        advanceDebugPhase, shouldRefreshDesignerDebugState, applyBenchTemperature});
    const host = new CircuitTab({isVisible: visible, locale: 'en', vm: {runtime: {}}});
    // React is not mounting this host in these method tests. Apply its real
    // methods' setState writes synchronously, without replacing those methods.
    host.setState = change => Object.assign(host.state,
        typeof change === 'function' ? change(host.state, host.props) : change);
    host._stageHost = {dataset: {}, style: {}};
    connected.add(host._stageHost);
    return {host, storage, connected, Panel};
}
function elementsOfType (tree, type, found = []) {
    if (Array.isArray(tree)) tree.forEach(child => elementsOfType(child, type, found));
    else if (tree && typeof tree === 'object') {
        if (tree.type === type) found.push(tree);
        elementsOfType(tree.portal ? tree.children : tree.props?.children, type, found);
    }
    return found;
}
const portals = tree => (Array.isArray(tree) ? tree : [tree]).filter(item => item?.portal);

test('the actual constructor restores every circuit and device dock, including a saved controller', () => {
    for (const dock of [...circuitDocks, ...deviceDocks]) {
        assert.equal(fixture({dock}).host.state.debugDock, dock, `saved ${dock}`);
    }
});

test('invalid or inaccessible saved settings retain the ordinary right-dock default', () => {
    for (const dock of [undefined, null, '', 'controller-copy', 'constructor', 0]) {
        assert.equal(fixture({dock}).host.state.debugDock, 'right');
    }
    const storage = {getItem () {throw new Error('storage unavailable');}};
    assert.equal(fixture({storage}).host.state.debugDock, 'right');
});

test('Scratch owns the pane on fresh load and after leaving a running debugger', () => {
    const {host} = fixture({storage: storageWith({'bw-debug-dock': 'right'})});
    host.state.Designer = () => null;
    assert.equal(host._stagePortalOn(), false);
    host.state.showInStage = true;
    host.render();
    applyHostVisibility.call(host);
    assert.equal(host._stageHost.style.display, 'block');
    const debugHost = host._debugHost;
    for (const visible of [false, true]) {
        host.props.isVisible = visible;
        host.state.showInStage = false;
        const shown = portals(host.render());
        applyHostVisibility.call(host);
        assert.equal(host._stageHost.style.display, 'none');
        assert.deepEqual(shown.map(portal => portal.container), [debugHost]);
    }
});

test('setDock switches in both directions and persists only recognized pane modes', () => {
    const {host, storage} = fixture({dock: 'right'});
    for (const dock of deviceDocks) {
        host.setDock(dock);
        assert.equal(host.state.debugDock, dock);
        assert.equal(storage.getItem('bw-debug-dock'), dock);
        host.setDock('right');
        assert.equal(host.state.debugDock, 'right');
        assert.equal(storage.getItem('bw-debug-dock'), 'right');
    }
    for (const dock of [null, '', 'device', 'controller-copy', {}, 7]) {
        host.setDock(dock);
        assert.equal(host.state.debugDock, 'right');
        assert.equal(storage.getItem('bw-debug-dock'), 'right');
    }
    storage.setItem = () => {throw new Error('storage full');};
    host.setDock('controller');
    assert.equal(host.state.debugDock, 'controller', 'a storage failure must not block the visible pane change');
});

test('the actual stage predicate suppresses every device owner and honors visibility and host lifetime', () => {
    const {host, connected} = fixture();
    for (const dock of circuitDocks) {
        host.setDock(dock);
        assert.equal(host._stagePortalOn(), true, dock);
    }
    for (const dock of deviceDocks) {
        host.setDock(dock);
        assert.equal(host._stagePortalOn(), false, dock);
    }
    host.setDock('right');
    host.props.isVisible = true;
    assert.equal(host._stagePortalOn(), false);
    host.props.isVisible = false;
    host.state.showInStage = false;
    assert.equal(host._stagePortalOn(), false);
    host.state.showInStage = true;
    connected.delete(host._stageHost);
    assert.equal(host._stagePortalOn(), false, 'a detached host is not a stage surface');
    host._stageHost = null;
    assert.equal(host._stagePortalOn(), false);
});

test('actual render gives device modes no designer debugger or stage portal and retains the keyed panel', () => {
    const {host, Panel} = fixture();
    const Designer = () => null;
    host.state.Designer = Designer;
    const debugHost = host._ensureDebugHost();
    const callback = host.handleRunnerChange;
    for (const visible of [false, true]) {
        host.props.isVisible = visible;
        for (const dock of deviceDocks) {
            host.setDock(dock);
            const tree = host.render();
            const designer = elementsOfType(tree, Designer);
            assert.equal(designer.length, 1);
            assert.equal(designer[0].props.debugDock, 'off', `${dock}, Circuit visible=${visible}`);
            assert.equal(designer[0].props.debuggerOn, false);
            assert.equal(designer[0].props.debuggerPanel, null);
            const renderedPortals = portals(tree);
            assert.equal(renderedPortals.length, 1, 'the device owner must not receive a circuit stage portal');
            assert.equal(renderedPortals[0].key, 'debug-panel');
            assert.equal(renderedPortals[0].container, debugHost);
            assert.equal(elementsOfType(tree, Panel)[0].props.onRunnerChange, callback);
            applyHostVisibility.call(host);
            assert.equal(host._stageHost.style.display, 'none');
        }
    }
});

test('designer loading retains the same active panel when switching from debugger to a device pane', () => {
    const {host} = fixture({dock: 'right'});
    host.state.machineBooted = true;
    const first = portals(host.render()).find(portal => portal.key === 'debug-panel');
    assert.ok(first);
    for (const dock of deviceDocks) {
        host.setDock(dock);
        const next = portals(host.render());
        assert.equal(next.length, 1);
        assert.equal(next[0].container, first.container);
        assert.equal(next[0].key, first.key);
        applyHostVisibility.call(host);
        assert.equal(host._stageHost.style.display, 'none');
    }
});

test('real React reconciles the actual dock renders without remounting or destroying the runner', () => {
    // Existing legacy jsdom leaves a timer on modern Node. Bound this real
    // reconciliation in a child, close its window, and exit after assertions.
    // The runner is a counted fixture; the CircuitTab render/HostMount and its
    // portal keys, targets, visibility statements and callbacks are production.
    const script = `
        const assert = require('node:assert/strict');
        const document = require(${JSON.stringify(requireGui.resolve('jsdom'))})
            .jsdom('<div id="app"></div><div id="stage"></div>');
        globalThis.window = document.defaultView;
        globalThis.document = document;
        globalThis.CustomEvent = document.defaultView.CustomEvent;
        Object.defineProperty(globalThis, 'navigator',
            {value: document.defaultView.navigator, configurable: true});
        // The installed legacy jsdom predates HTMLElement.dataset. Supply
        // that DOM API, leaving the actual _ensureDebugHost method intact.
        Object.defineProperty(document.defaultView.HTMLElement.prototype, 'dataset', {
            get () {
                const element = this;
                const attribute = key => 'data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
                return new Proxy({}, {
                    get: (_target, key) => element.getAttribute(attribute(key)),
                    set: (_target, key, value) => {element.setAttribute(attribute(key), String(value)); return true;}
                });
            }
        });

        const React = require(${JSON.stringify(requireGui.resolve('react'))});
        const ReactDOM = require(${JSON.stringify(requireGui.resolve('react-dom'))});
        const makeCircuit = new Function('env', ${JSON.stringify(factoryCode)});
        const applyHostVisibility = new Function(${JSON.stringify(visibilityCode)});
        const storageWith = ${storageWith.toString()};
        const instances = [];
        let mounts = 0, unmounts = 0, destroyed = 0;
        class LivePanel extends React.Component {
            constructor (props) {
                super(props);
                const board = {};
                this.runner = {board: () => board, destroy: () => {destroyed++;}};
                instances.push(this);
            }
            componentDidMount () {
                mounts++;
                this.props.onRunnerChange(this.runner, {phase: 'running', session: {}});
            }
            componentWillUnmount () {
                unmounts++;
                this.props.onRunnerGone();
                this.runner.destroy();
            }
            render () {return React.createElement('button', {'data-live-runner': true}, 'Run');}
        }
        const CircuitTab = makeCircuit({React, ReactDOM, document, window,
            localStorage: storageWith({'bw-debug-dock': 'right', 'bw-right-pane-hidden': '0', 'bw-stage-circuit': '1'}),
            DebugPanel: LivePanel, loadBenchTemperature: () => 25,
            getReactPerformanceProbe: () => null,
            profileReactSubtree: (_react, _name, element) => element,
            pt: (_locale, key) => key,
            advanceDebugPhase: ${advanceDebugPhase.toString()},
            shouldRefreshDesignerDebugState: ${shouldRefreshDesignerDebugState.toString()},
            applyBenchTemperature: ${applyBenchTemperature.toString()}});
        const host = new CircuitTab({isVisible: false, locale: 'en', vm: {runtime: {}}});
        host.setState = change => Object.assign(host.state,
            typeof change === 'function' ? change(host.state, host.props) : change);
        host._stageHost = document.getElementById('stage');
        const app = document.getElementById('app');
        const Designer = props => React.createElement('div', {'data-designer': true}, props.debuggerPanel);
        const paint = () => {
            ReactDOM.render(React.createElement(React.Fragment, null, host.render()), app);
            applyHostVisibility.call(host);
        };
        paint();
        const debugHost = host._debugHost;
        const runner = instances[0].runner;
        assert.equal(host._lastDebugRunner, runner, 'actual runner callback adopts this fixture');
        for (const loaded of [false, true]) {
            host.state.Designer = loaded ? Designer : null;
            for (const visible of [false, true]) {
                host.props.isVisible = visible;
                for (const dock of ['right', ...${JSON.stringify(deviceDocks)}, 'right']) {
                    host.setDock(dock);
                    paint();
                    assert.equal(mounts, 1, 'panel remounted in ' + dock);
                    assert.equal(unmounts, 0, 'panel detached in ' + dock);
                    assert.equal(destroyed, 0, 'runner destroyed in ' + dock);
                    assert.equal(host._debugHost, debugHost);
                    assert.equal(host._lastDebugRunner, runner);
                    assert.equal(instances[0].runner, runner);
                    assert.equal(debugHost.querySelectorAll('[data-live-runner]').length, 1);
                    if (dock !== 'right') assert.equal(host._stageHost.style.display, 'none');
                }
            }
        }
        host.props.isVisible = true;
        for (const dock of ['top', 'controller', 'solo', 'arcade', 'right']) {
            host.setDock(dock);
            paint();
            assert.equal(mounts, 1);
            assert.equal(unmounts, 0);
            assert.equal(host._lastDebugRunner, runner);
        }
        ReactDOM.unmountComponentAtNode(app);
        assert.equal(unmounts, 1);
        assert.equal(destroyed, 1);
        document.defaultView.close();
        process.stdout.write('actual portal reconciliation passed\\n');
        process.exit(0);
    `;
    const output = execFileSync(process.execPath, ['--input-type=commonjs'],
        {input: script, encoding: 'utf8', timeout: 10000, stdio: 'pipe'});
    assert.match(output, /actual portal reconciliation passed/);
});

function allNodes (node, predicate, found = []) {
    if (!node || typeof node !== 'object') return found;
    if (predicate(node)) found.push(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => allNodes(child, predicate, found));
        else if (value && typeof value === 'object') allNodes(value, predicate, found);
    }
    return found;
}
const panelRender = methodNamed(classNamed(panelAst, 'DebugPanel'), 'render');
const cueDeclaration = panelRender.body.body.find(node => node.type === 'VariableDeclaration' &&
    node.declarations.some(declaration => declaration.id.name === 'noImageLoaded'));
const cueExpressions = allNodes(panelRender, node => node.type === 'ConditionalExpression' &&
    node.test.type === 'Identifier' && node.test.name === 'noImageLoaded');
assert.ok(cueDeclaration);
assert.equal(cueExpressions.length, 1, 'one actual empty-image status expression belongs to the render');
assert.equal(allNodes(cueExpressions[0], node => node.type === 'JSXAttribute' &&
    node.name.name === 'data-debug-no-image').length, 1);
const cueCode = compile(`function renderCue () {
    ${generate(panelRender.body.body[0]).code}
    ${generate(panelRender.body.body[1]).code}
    ${generate(cueDeclaration).code}
    return ${generate(cueExpressions[0]).code};
}`);
const renderCue = new Function('React', `${cueCode}\nreturn renderCue;`)(React);
const l10n = new Function(`${topLevel(panelAst, 'L10N')}\nreturn L10N;`)();
function cueFixture ({phase = 'idle', runner = null, firmware = null, bootMedia = null, locale = 'en'} = {}) {
    return {state: {ui: {phase}, runner}, _userFirmware: firmware, _bootMedia: bootMedia,
        tx: key => l10n[locale][key]};
}

test('the actual idle-empty status renders an honest localized cue', () => {
    for (const locale of ['en', 'de']) {
        const cue = renderCue.call(cueFixture({locale}));
        assert.equal(cue.type, 'span');
        assert.equal(cue.props['data-debug-no-image'], true);
        assert.equal(cue.props.children, l10n[locale].noImageLoaded);
        assert.ok(cue.props.children.length > 20);
    }
});

test('picked firmware suppresses the cue even before a runner exists, and clearing it restores the cue', () => {
    const panel = cueFixture();
    assert.ok(renderCue.call(panel));
    for (const firmware of [{name: 'blink.elf', bytes: Uint8Array.of(0x7f, 0x45, 0x4c, 0x46)},
        {name: 'flash.bin', bytes: Uint8Array.of(0xe9)}, {bytes: Uint8Array.of(1)}]) {
        panel._userFirmware = firmware;
        assert.equal(renderCue.call(panel), null);
    }
    panel._userFirmware = null;
    assert.ok(renderCue.call(panel));
});

test('boot media is loaded input even when no debugger runner is present yet', () => {
    assert.equal(renderCue.call(cueFixture({bootMedia: {kind: 'floppy', bytes: Uint8Array.of(1)}})), null);
});

test('active and stopped runner ownership prevents a false no-image cue', () => {
    const runner = {};
    for (const phase of ['idle', 'ready', 'running', 'paused', 'stepping', 'error']) {
        assert.equal(renderCue.call(cueFixture({phase, runner})), null, phase);
    }
});

test('building, attaching, ready, and error statuses are not mislabeled as an empty debugger', () => {
    for (const phase of ['building', 'attaching', 'ready', 'running', 'paused', 'stepping', 'error']) {
        assert.equal(renderCue.call(cueFixture({phase})), null, phase);
    }
});

test('Controller keeps the entire pane with a live machine and retains the debugger runner', () => {
    for (const live of [{machineBooted: true}, {stc: {pins: [{name: 'led1'}]}}]) {
        const {host} = fixture({dock: 'right'});
        Object.assign(host.state, live);
        const first = portals(host.render()).find(portal => portal.key === 'debug-panel');
        host.setDock('controller');
        assert.equal(host._stagePortalOn(), false, JSON.stringify(live));
        const [panel, ...others] = portals(host.render());
        assert.deepEqual(others, []);
        assert.equal(panel.key, first.key);
        assert.equal(panel.container, first.container);
        applyHostVisibility.call(host);
        assert.equal(host._stageHost.style.display, 'none');
    }
});

test('CP1 controller keeps its keypad without a second CP1 debugger face', () => {
    const {host} = fixture({dock: 'controller', window: {__bwMachineExtracted: {kind: 'cp1'}}});
    host.state.machineBooted = true;
    assert.equal(host._stagePortalOn(), false);
});

test('restoring the original dock refusals or removing stage ownership fails the same pane contracts', () => {
    for (const [name, needle, replacement, oracle] of [
        ['saved device ignored', 'CIRCUIT_DOCKS.has(d) || DEVICE_DOCKS.has(d)',
            'CIRCUIT_DOCKS.has(d)', buildCircuit => {
                assert.equal(fixture({dock: 'controller', buildCircuit}).host.state.debugDock, 'controller');
            }],
        ['device selection ignored', '!CIRCUIT_DOCKS.has(d) && !DEVICE_DOCKS.has(d)',
            '!CIRCUIT_DOCKS.has(d)', buildCircuit => {
                const {host} = fixture({dock: 'right', buildCircuit});
                host.setDock('controller');
                assert.equal(host.state.debugDock, 'controller');
            }],
        ['device column covered', 'if (!CIRCUIT_DOCKS.has(this.state.debugDock)) return false;',
            '', buildCircuit => {
                const {host} = fixture({dock: 'controller', buildCircuit});
                assert.equal(host._stagePortalOn(), false);
            }],
        ['live debugger covers the controller', 'if (!CIRCUIT_DOCKS.has(this.state.debugDock)) return false;',
            "if (!CIRCUIT_DOCKS.has(this.state.debugDock) && !(this.state.debugDock === 'controller' && this.state.machineBooted)) return false;",
            buildCircuit => {
                const {host} = fixture({dock: 'controller', buildCircuit});
                host.state.machineBooted = true;
                assert.equal(host._stagePortalOn(), false);
            }]
    ]) {
        oracle(makeCircuit);
        assert.equal(factoryCode.split(needle).length, 2, `${name}: one actual production site`);
        const mutant = new Function('env', factoryCode.replace(needle, replacement));
        assert.throws(() => oracle(mutant), {name: 'AssertionError'}, name);
    }
});

test('losing either loaded-input guard makes the actual cue falsely claim an empty debugger', () => {
    for (const [needle, input] of [
        ['!this._userFirmware', {firmware: {name: 'image.bin', bytes: Uint8Array.of(0xe9)}}],
        ['!this._bootMedia', {bootMedia: {kind: 'floppy', bytes: Uint8Array.of(1)}}]
    ]) {
        const oracle = render => assert.equal(render.call(cueFixture(input)), null);
        oracle(renderCue);
        assert.equal(cueCode.split(needle).length, 2, 'one actual production guard');
        const mutant = new Function('React', `${cueCode.replace(needle, 'true')}\nreturn renderCue;`)(React);
        assert.throws(() => oracle(mutant), {name: 'AssertionError'}, needle);
    }
});

test('a wired gallery ROM waits for the matching circuit and sees its board before dispatch', () => {
    const runtime = {};
    const snapshots = [];
    const window = {dispatchEvent: event => snapshots.push({
        type: event.type, media: event.detail, board: runtime.circuitBoard
    })};
    const {host} = fixture({window});
    host.props.vm.runtime = runtime;
    const old = {}, selected = {}, board = {};
    const media = {kind: 'eater6502', name: 'rom.bin'};
    host._wiredExample = {data: selected, media};
    host.handleWiredBootReady(old, {}, {ok: true});
    assert.equal(snapshots.length, 0);
    host.handleWiredBootReady(selected, board, {ok: true});
    assert.deepEqual(snapshots.map(item => item.type), ['bw-board-ready', 'bw-machine-media-load']);
    assert.equal(snapshots[1].board, board);
    assert.equal(snapshots[1].media, media);
    host.handleWiredBootReady(selected, board, {ok: true});
    assert.equal(snapshots.length, 2);
});

test('a failed gallery extract exposes its reason and leaves the ROM unbooted', () => {
    const {host} = fixture({window: {dispatchEvent: () => assert.fail('unexpected boot')}});
    const data = {};
    host._wiredExample = {data, media: {kind: 'eater6502'}};
    host.handleWiredBootReady(data, {}, {ok: false, reasons: ['Missing reset vector']});
    assert.equal(host.state.examplesError, 'Missing reset vector');
    assert.equal(host._wiredExample, null);
});

test('the debugger keeps transport, target and status visible while history starts folded', () => {
    const find = attribute => allNodes(panelRender, node => node.type === 'JSXElement' &&
        node.openingElement.attributes.some(item => item.name?.name === attribute));
    for (const marker of ['data-debug-transport', 'data-debug-target-controls', 'data-debug-status']) {
        assert.equal(find(marker).length, 1, marker);
    }
    const [history] = find('data-debug-history');
    assert.equal(history.openingElement.name.name, 'details');
    assert.equal(history.openingElement.attributes.some(item => item.name?.name === 'open'), false);
    const historyMarkers = allNodes(history, node => node.type === 'JSXAttribute').map(node => node.name.name);
    for (const marker of ['data-debug-record', 'data-debug-checkpoint', 'data-debug-timeline-controls']) {
        assert.ok(historyMarkers.includes(marker), marker);
    }
});
