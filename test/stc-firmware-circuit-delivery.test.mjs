// Execute the host's actual loader bodies. A firmware image may reach the
// debugger only after its project and real, persistent circuit are installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {balancedFrom, scopeAfter} from './helpers/js-scope.mjs';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';
import {STC_FIRMWARE_EXAMPLES, STC_FIRMWARE_ASSET_ROOT, loadStcFirmwareExample}
    from '../overlay/scratch-gui/src/lib/bw-asm/stc-firmware-examples.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = file => readFileSync(path.join(ROOT, file), 'utf8');
const importerSource = read('overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx');
const tabSource = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
const {Circuit} = await loadCircuitModel(ROOT);
const CustomEvent = class {
    constructor (type, options = {}) { this.type = type; this.detail = options.detail; }
};
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const nets = value => value.map(net => ({id: net.id,
    terminals: net.terminals.map(end => `${end.part}:${end.terminal}`).sort()}))
    .sort((a, b) => a.id.localeCompare(b.id));

// A complete small electrical bench for lifecycle tests. Actual shipped
// hourglass/clock assets are loaded separately below, without a network fetch.
const bench = () => ({vcc: 5, board: {device: 'STC15W408AS', fosc: 11059200},
    parts: [
        {id: 'MCU', kind: 'mcu', terminals: ['P1.0', 'P3.0'], params: {}},
        {id: 'R', kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 1000}},
        {id: 'LED', kind: 'led', terminals: ['anode', 'cathode'], params: {color: 'red'}}
    ],
    wires: [
        {id: 'w1', netId: 'source', from: {part: 'MCU', terminal: 'P3.0'}, to: {part: 'R', terminal: 'a'}},
        {id: 'w2', netId: 'led', from: {part: 'R', terminal: 'b'}, to: {part: 'LED', terminal: 'anode'}},
        {id: 'w3', netId: 'sink', from: {part: 'LED', terminal: 'cathode'}, to: {part: 'MCU', terminal: 'P1.0'}}
    ]});
const oldCircuit = () => Circuit.fromJSON({vcc: 5, parts: [
    {id: 'PREVIOUS', kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 2200}}
], wires: []});
const hex = ':04000000742A80FEE0\n:00000001FF\n'; // MOV A,#42; SJMP $

function eventWindow (actions = []) {
    const events = [];
    const listeners = new Map();
    return {events, listeners,
        dispatchEvent (event) {
            events.push(event);
            actions.push(event.type);
            listeners.get(event.type)?.(event);
        }};
}

function circuitHost ({window = eventWindow(), runtime = {}, loadGate = null, deferCommit = false} = {}) {
    const commits = [];
    const calls = [];
    const host = {props: {vm: {runtime}}, state: {}, _Circuit: loadGate ? null : Circuit,
        async load (options) {
            calls.push(options);
            if (loadGate) await loadGate.promise;
            this._Circuit = Circuit;
        },
        setState (patch, done) {
            Object.assign(this.state, patch);
            if (done) {
                if (deferCommit) commits.push(done);
                else done();
            }
        }};
    // Use the real in-place replacement too: a mock that assigned a fresh
    // Circuit here would conceal the mounted Designer's identity contract.
    host._applyToLiveCircuit = new Function('window', 'CustomEvent',
        `return function (data) ${scopeAfter(tabSource, 'this._applyToLiveCircuit = data => {')}`)(
        window, CustomEvent).bind(host);
    host.loadFirmwareCircuit = new Function('window', 'CustomEvent',
        `return async function (detail) ${scopeAfter(tabSource, 'async loadFirmwareCircuit (detail) {')}`)(
        window, CustomEvent).bind(host);
    return {host, runtime, window, calls, commit: () => commits.splice(0).forEach(done => done())};
}

test('actual circuit loader waits for the designer and render commit before acknowledging a cold load', async () => {
    const gate = deferred();
    const h = circuitHost({loadGate: gate, deferCommit: true});
    let acknowledged = 0;
    const errors = [];
    const data = bench();
    const loading = h.host.loadFirmwareCircuit({data, onLoaded: () => acknowledged++, onError: e => errors.push(e)});
    await turn();
    assert.deepEqual(h.calls, [{explicit: true}]);
    assert.equal(h.runtime.circuitBoard, undefined, 'an unfinished designer load cannot publish a board');
    assert.equal(acknowledged, 0);
    gate.resolve();
    await turn();
    assert.equal(h.runtime.circuitModel.netlistError, null);
    assert.equal(h.runtime.circuitBoard, h.runtime.circuitModel.board);
    assert.equal(h.runtime.circuitBoard.getNets().length, 3);
    assert.equal(h.window.__circuit, h.runtime.circuitModel);
    assert.equal(h.window.__board, h.runtime.circuitBoard);
    assert.equal(h.host.state.circuitData.fileOnly, true);
    assert.equal(h.host.state.machineBooted, true);
    assert.equal(acknowledged, 0, 'React has not committed the circuit yet');
    h.commit();
    await loading;
    assert.equal(acknowledged, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(h.window.events.map(event => event.type), ['bw-board-ready']);
});

test('actual circuit loader preserves a mounted model identity and publishes its replacement board', async () => {
    const model = oldCircuit();
    const previousBoard = model.board;
    const h = circuitHost({runtime: {circuitModel: model, circuitBoard: previousBoard}});
    let acknowledged = false;
    await h.host.loadFirmwareCircuit({data: bench(), onLoaded: () => {
        assert.equal(h.runtime.circuitModel, model);
        assert.equal(h.runtime.circuitBoard, model.board);
        assert.equal(h.window.__board, model.board);
        acknowledged = true;
    }, onError: error => assert.fail(error.message)});
    assert.equal(acknowledged, true);
    assert.notEqual(model.board, previousBoard);
    assert.deepEqual(model.parts.map(part => part.id), ['MCU', 'R', 'LED']);
    assert.equal(model.wires.length, 3);
    assert.equal(model.board.getNets().length, 3);
    assert.equal(model.netlistError, null);
});

test('a solver-rejected circuit reports onError without replacing the live model or board', async t => {
    const warnings = [];
    t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
    const model = oldCircuit();
    const board = model.board;
    const before = model.toJSON();
    const h = circuitHost({runtime: {circuitModel: model, circuitBoard: board}});
    const bad = bench();
    bad.parts[1].kind = 'not-a-device';
    const errors = [];
    let acknowledged = 0;
    await h.host.loadFirmwareCircuit({data: bad, onLoaded: () => acknowledged++, onError: e => errors.push(e)});
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /not-a-device/);
    assert.equal(acknowledged, 0);
    assert.equal(h.runtime.circuitModel, model);
    assert.equal(h.runtime.circuitBoard, board);
    assert.equal(model.board, board);
    assert.deepEqual(model.toJSON(), before);
    assert.equal(h.window.events.length, 0);
    assert.equal(h.host.state.examplesError, errors[0].message);
    assert.ok(warnings.some(message => message.includes('netlist rejected')),
        'the real Circuit parser catches the solver error; the host must inspect netlistError');
});

test('a missing persistent wire list or failed designer import is reported without a board change', async () => {
    for (const reason of ['wires', 'designer']) {
        const model = oldCircuit();
        const h = circuitHost({runtime: {circuitModel: model, circuitBoard: model.board}});
        const previousBoard = model.board;
        const data = bench();
        if (reason === 'wires') delete data.wires;
        else h.host.load = async () => { throw new Error('designer chunk unavailable'); };
        const errors = [];
        await h.host.loadFirmwareCircuit({data, onLoaded: () => assert.fail('must not acknowledge'),
            onError: error => errors.push(error)});
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, reason === 'wires' ? /persistent wires/ : /designer chunk/);
        assert.equal(h.runtime.circuitModel, model);
        assert.equal(h.runtime.circuitBoard, previousBoard);
    }
});

function importerHost ({confirm = true, compileGate = null, compileError = null,
    data = bench(), image = hex, runtime = {stc: {device: 'stc12c5a60s2'}}, window = null} = {}) {
    const actions = [];
    window = window || eventWindow(actions);
    const timers = new Map();
    let timerId = 0;
    const storage = new Map();
    const component = {props: {locale: 'en', vm: {runtime,
        stopAll: () => actions.push('stopAll')}}, state: {busy: false},
        L: {stcFirmwareReplace: name => `Replace with ${name}?`, stcFirmwareLoading: 'loading'},
        setState (patch) { Object.assign(this.state, patch); },
        async compile (options) {
            actions.push('compile:start');
            assert.deepEqual(options, {strict: true, pseudocode: 'DEVICE STC15W408AS\nCLOCK 11059200\n'});
            if (compileGate) await compileGate.promise;
            if (compileError) throw compileError;
            runtime.stc = {device: 'stc15w408as', clock: 11059200};
            actions.push('compile:done');
            const stc = runtime.stc;
            return {applied: true, stc, isCurrent: () => runtime.stc === stc};
        },
        publishAppliedDevice (stc) { actions.push('publish-device'); this.published = stc; }};
    const fetchAsset = async url => {
        actions.push(`fetch:${url}`);
        return {ok: true, json: async () => structuredClone(data), text: async () => image};
    };
    const method = new Function('STC_FIRMWARE_EXAMPLES', 'pickLocale', 'confirmAsync',
        'loadStcFirmwareExample', 'window', 'localStorage', 'CustomEvent', 'setTimeout', 'clearTimeout',
        `return async function (id) ${scopeAfter(importerSource, 'async loadStcFirmwareCircuit (id) {')}`)(
        STC_FIRMWARE_EXAMPLES, locale => locale === 'de' ? 'de' : 'en',
        async () => { actions.push('confirm'); return confirm; },
        id => loadStcFirmwareExample(id, fetchAsset), window,
        {setItem: (key, value) => storage.set(key, value)}, CustomEvent,
        (fn, ms) => { const id = ++timerId; timers.set(id, {fn, ms}); return id; },
        id => timers.delete(id));
    return {component, runtime, window, actions, timers, storage,
        run: () => method.call(component, 'hourglass-stage2')};
}

// Execute the real compile method as well as the loader. Builder/VM edges
// remain controlled so ownership can change at the exact asynchronous seam.
function actualCompile (h, {prepareGate = null, parseError = null} = {}) {
    const {component, runtime, actions} = h;
    const vm = component.props.vm;
    let stage = {id: 'old-stage', isStage: true};
    let preparations = 0;
    runtime.targets = [stage];
    runtime.getTargetForStage = () => stage;
    vm.loadProject = async () => {
        actions.push('actual-project-load');
        stage = {id: 'loaded-stage', isStage: true};
        runtime.targets = [stage];
    };
    vm.setEditingTarget = () => {};
    class Builder {
        constructor () { this.project = {targets: []}; this.warnings = []; }
        parse (source) {
            if (parseError) throw parseError;
            this.project.stc = {device: source.match(/^DEVICE\s+(\S+)/im)[1].toLowerCase(),
                clock: Number(source.match(/^CLOCK\s+(\d+)/im)[1]), pins: []};
        }
        async generateSB3 () {
            preparations++;
            if (prepareGate && preparations === 1) await prepareGate.promise;
            return {arrayBuffer: async () => new ArrayBuffer(0)};
        }
        generatePython () { return ''; }
        generateJavaScript () { return ''; }
        generateC () { return ''; }
        generateBASIC () { return {ok: true, basic: ''}; }
        generateMicroPython () { return {ok: true, py: ''}; }
    }
    Object.assign(component, {
        state: {busy: false, lang: 'asm',
            buffers: {pseudocode: 'DEVICE STC12C5A60S2\nCLOCK 12000000\n# previous program\n',
                asm: '; previous assembly'},
            uploads: [], basicProfile: 'ms', basicLineNumbers: false},
        L: {...component.L, stCompiling: 'compiling', stLoaded: 'loaded',
            stError: message => message, stWarn: message => message},
        setState (update, done) {
            const patch = typeof update === 'function' ? update(this.state) : update;
            if (patch) Object.assign(this.state, patch);
            done?.();
        },
        activeCode () { return this.state.buffers[this.state.lang]; },
        lib: async () => ({default: Builder}), genOpts: () => ({}), canLiftAsm: () => false
    });
    const signature = 'async compile ({strict = false, pseudocode = null} = {}) {';
    const body = balancedFrom(importerSource, importerSource.indexOf(signature) + signature.length - 1, '{', '}');
    component.compile = new Function('TWO_WAY', 'DOS_LANG', 'window', 'codeArtworkMatches',
        'captureCodeArtwork', 'classifyConversionWarnings', 'conversionFailure', 'LANG_LABEL',
        `return async function ({strict = false, pseudocode = null} = {}) ${body}`)(
        new Set(['pseudocode']), {}, h.window, () => false, () => null,
        () => ({changed: [], unsupported: []}), error => ({message: error.message, issues: []}),
        {pseudocode: 'Pseudocode'});
    return {replaceStage () {
        stage = {id: 'newer-stage', isStage: true};
        runtime.targets = [stage];
    }};
}

test('real compile replaces the canonical source before a firmware example is delivered', async () => {
    const h = importerHost();
    actualCompile(h);
    h.window.listeners.set('bw-load-firmware-circuit', event => event.detail.onLoaded());
    await h.run();
    assert.equal(h.actions.filter(action => action === 'actual-project-load').length, 1);
    assert.equal(h.component.state.buffers.pseudocode, 'DEVICE STC15W408AS\nCLOCK 11059200\n');
    assert.equal(h.component.state.buffers.asm, '', 'the previous assembly is no longer advertised');
    assert.equal(h.runtime.stc.device, 'stc15w408as');
    assert.ok(h.window.events.some(event => event.type === 'bw-asm-rom-ready'));
});

test('real strict compile failures abort even when the previous project has the requested device', async () => {
    const h = importerHost({runtime: {stc: {device: 'stc15w408as', clock: 11059200}}});
    actualCompile(h, {parseError: new Error('actual parser failure')});
    await h.run();
    assert.equal(h.actions.includes('actual-project-load'), false);
    assert.equal(h.component.state.status, 'actual parser failure');
    assert.deepEqual(h.window.events, []);
});

test('superseded real compile cannot admit an old same-device project as the firmware replacement', async () => {
    const gate = deferred();
    const h = importerHost({runtime: {stc: {device: 'stc15w408as', clock: 11059200}}});
    actualCompile(h, {prepareGate: gate});
    const loading = h.run();
    await turn();
    h.component._conversionRequest = {};
    h.component.setState({busy: true, status: 'new conversion is compiling'});
    gate.resolve();
    await loading;
    assert.equal(h.actions.includes('actual-project-load'), false,
        'the superseded compile never loaded a new project');
    assert.deepEqual(h.window.events, []);
    assert.equal(h.window.__bwPendingMedia, undefined);
    assert.equal(h.component.state.status, 'new conversion is compiling');
    assert.equal(h.component.state.busy, true, 'the newer compile still owns busy');
});

for (const change of ['conversion', 'stage']) {
    test(`a newer ${change} revokes the real compile receipt while the circuit loads`, async () => {
        const h = importerHost({runtime: {stc: {device: 'stc15w408as', clock: 11059200}}});
        const compiler = actualCompile(h);
        const loading = h.run();
        await turn();
        const request = h.window.events.find(event => event.type === 'bw-load-firmware-circuit');
        assert.ok(request, 'the original compile completed before the ownership change');
        if (change === 'conversion') {
            h.component._conversionRequest = {};
            h.component.setState({busy: true, status: 'new conversion is compiling'});
        }
        else compiler.replaceStage();
        request.detail.onLoaded();
        await loading;
        assert.equal(h.window.events.some(event => event.type === 'bw-asm-rom-ready'), false);
        assert.equal(h.window.__bwPendingMedia, undefined);
        if (change === 'conversion') {
            assert.equal(h.component.state.status, 'new conversion is compiling');
            assert.equal(h.component.state.busy, true);
        } else {
            assert.match(h.component.state.status, /project changed/i);
            assert.equal(h.component.state.busy, false);
        }
    });
}

test('actual importer delivers firmware only after compile and the real circuit loader acknowledgement', async () => {
    const compileGate = deferred();
    const designerGate = deferred();
    const h = importerHost({compileGate});
    const circuit = circuitHost({window: h.window, runtime: h.runtime,
        loadGate: designerGate, deferCommit: true});
    h.window.listeners.set('bw-load-firmware-circuit', event => circuit.host.loadFirmwareCircuit(event.detail));
    const running = h.run();
    await turn();
    assert.ok(h.actions.includes('compile:start'));
    assert.equal(h.window.events.length, 0, 'no board request or image delivery while compilation is pending');
    compileGate.resolve();
    await turn();
    assert.deepEqual(h.window.events.map(event => event.type), ['bw-load-firmware-circuit']);
    assert.equal(h.runtime.circuitBoard, undefined);
    assert.equal(h.window.__bwPendingMedia, undefined);
    designerGate.resolve();
    await turn();
    assert.equal(h.runtime.circuitBoard.getNets().length, 3);
    assert.equal(h.window.events.some(event => event.type === 'bw-asm-rom-ready'), false,
        'installing the board is not yet the render acknowledgement');
    circuit.commit();
    await running;
    assert.deepEqual(h.window.events.map(event => event.type), [
        'bw-load-firmware-circuit', 'bw-board-ready', 'bw-settings-change', 'bw-asm-rom-ready'
    ]);
    const delivery = h.window.events.at(-1).detail;
    assert.equal(delivery.firmware.text, hex);
    assert.equal(delivery.firmware.device, 'stc15w408as');
    assert.equal(delivery.firmware.fCpu, 11059200);
    assert.equal(h.window.__bwPendingMedia.detail, delivery, 'lazy debugger replays the exact acknowledged image');
    assert.equal(h.storage.get('bw-right-pane-hidden'), '0');
    assert.deepEqual(h.component.published, {device: 'stc15w408as', clock: 11059200, pins: []});
    assert.equal(h.component.state.busy, false);
    assert.equal(h.timers.size, 0, 'acknowledgement clears the timeout');
});

test('declining replacement fetches nothing and never stops, compiles, loads or delivers', async () => {
    const h = importerHost({confirm: false});
    await h.run();
    assert.deepEqual(h.actions, ['confirm']);
    assert.deepEqual(h.window.events, []);
    assert.equal(h.component.state.busy, false);
    assert.equal(h.window.__bwPendingMedia, undefined);
});

test('asset validation and compilation errors never request a circuit or deliver firmware', async () => {
    for (const options of [
        {image: hex.replace('2A', '2B')},
        {compileError: new Error('project compilation failed')}
    ]) {
        const h = importerHost(options);
        await h.run();
        assert.deepEqual(h.window.events, []);
        assert.equal(h.window.__bwPendingMedia, undefined);
        assert.equal(h.component.state.busy, false);
        assert.match(h.component.state.status, /checksum|project compilation failed/);
        assert.equal(h.component.published, undefined);
        if (options.image) assert.equal(h.actions.includes('stopAll'), false,
            'bad firmware must fail before replacing the current project');
    }
});

test('a real circuit rejection reaches the importer without delivering an image or replacing the previous board', async t => {
    t.mock.method(console, 'warn', () => {});
    const model = oldCircuit();
    const previousBoard = model.board;
    const data = bench();
    data.parts[1].kind = 'not-a-device';
    const h = importerHost({data, runtime: {stc: {device: 'stc12c5a60s2'},
        circuitModel: model, circuitBoard: previousBoard}});
    const circuit = circuitHost({window: h.window, runtime: h.runtime});
    h.window.listeners.set('bw-load-firmware-circuit', event => circuit.host.loadFirmwareCircuit(event.detail));
    await h.run();
    assert.deepEqual(h.window.events.map(event => event.type), ['bw-load-firmware-circuit']);
    assert.equal(h.runtime.circuitModel, model);
    assert.equal(h.runtime.circuitBoard, previousBoard);
    assert.equal(h.window.__bwPendingMedia, undefined);
    assert.equal(h.component.published, undefined);
    assert.equal(h.component.state.busy, false);
    assert.match(h.component.state.status, /not-a-device/);
    assert.equal(h.timers.size, 0, 'onError clears the timeout');
});

test('a missing circuit acknowledgement times out and a late acknowledgement cannot deliver firmware', async () => {
    const h = importerHost();
    const running = h.run();
    await turn();
    assert.equal(h.timers.size, 1);
    const [timer] = h.timers.values();
    assert.equal(timer.ms, 15000);
    timer.fn();
    await running;
    assert.equal(h.component.state.status, 'Circuit loading timed out');
    h.window.events[0].detail.onLoaded();
    await turn();
    assert.deepEqual(h.window.events.map(event => event.type), ['bw-load-firmware-circuit']);
    assert.equal(h.window.__bwPendingMedia, undefined);
    assert.equal(h.component.state.busy, false);
});

for (const id of ['hourglass-stage2', 'clock-mod4']) {
    test(`${id}: shipped circuit and HEX load through the real fetch module and preserve their wiring`, async () => {
        const fetched = [];
        const result = await loadStcFirmwareExample(id, async url => {
            fetched.push(url);
            const content = read(`overlay/scratch-gui/${url}`);
            return {ok: true, json: async () => JSON.parse(content), text: async () => content};
        });
        assert.deepEqual(fetched.sort(), [`${STC_FIRMWARE_ASSET_ROOT}${id}.hex`,
            `${STC_FIRMWARE_ASSET_ROOT}${id}.json`].sort());
        assert.equal(result.detail.firmware.text, read(`overlay/scratch-gui/${STC_FIRMWARE_ASSET_ROOT}${id}.hex`));
        assert.equal(result.detail.firmware.device, result.circuit.board.device.toLowerCase());
        assert.equal(result.detail.firmware.fCpu, result.circuit.board.fosc);
        const circuit = Circuit.fromJSON(result.circuit);
        assert.equal(circuit.netlistError, null);
        assert.ok(circuit.wires.length > 0, 'persistent wires are required, not just transient engine nets');
        assert.deepEqual(nets(circuit.resolvedNets), nets(result.circuit.nets));
        const fromWires = nets(circuit.board.getNets());
        circuit.syncWithExternalNets(result.circuit.nets);
        assert.equal(circuit.netlistError, null);
        assert.deepEqual(nets(circuit.board.getNets()), fromWires);
        const restored = Circuit.fromJSON(circuit.toJSON());
        assert.deepEqual(nets(restored.resolvedNets), nets(result.circuit.nets));
        for (const original of result.circuit.parts) {
            const loaded = restored.getPart(original.id);
            assert.deepEqual(loaded.params, original.params);
            assert.deepEqual(loaded.terminals, original.terminals);
        }
    });
}

test('fetch failures and unknown examples are explicit failures', async () => {
    await assert.rejects(loadStcFirmwareExample('hourglass-stage2', async () => ({ok: false, status: 404})), /HTTP 404/);
    await assert.rejects(loadStcFirmwareExample('unknown', () => assert.fail('must not fetch')), /Unknown STC/);
});

test('the visible STC selector and the mounted circuit listener are wired to these tested methods', () => {
    const selector = importerSource.match(/<select\s+data-testid="bw-stc-firmware-examples"[\s\S]*?<\/select>/)?.[0];
    assert.ok(selector, 'the firmware examples need a rendered selector');
    assert.match(selector, /disabled=\{this\.state\.busy\}/);
    assert.match(selector, /onChange=\{e => this\.loadStcFirmwareCircuit\(e\.target\.value\)\}/);
    assert.match(selector, /STC_FIRMWARE_EXAMPLES\.map/);
    assert.match(importerSource,
        /this\.state\.asmMode === 'source' && stcRunFor\(asmTargetForDevice\(this\._asmDevice\(\)\)\)/);
    assert.match(importerSource, /href=\{`\$\{STC_FIRMWARE_ASSET_ROOT\}sources\.tar\.gz`\} download/);
    const mount = scopeAfter(tabSource, 'componentDidMount () {');
    assert.match(mount, /this\._loadFirmwareCircuit = event => this\.loadFirmwareCircuit\(event\.detail\)/);
    assert.match(mount, /addEventListener\('bw-load-firmware-circuit', this\._loadFirmwareCircuit\)/);
    assert.match(scopeAfter(tabSource, 'componentWillUnmount () {'),
        /removeEventListener\('bw-load-firmware-circuit', this\._loadFirmwareCircuit\)/);
    assert.deepEqual(STC_FIRMWARE_EXAMPLES.map(example => example.id), ['hourglass-stage2', 'clock-mod4']);
});
