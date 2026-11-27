// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createEngineeringInputRoute} from '../overlay/scratch-gui/src/lib/bw-debug/engineering-input-route.js';
import {createRunnerOwnership} from '../overlay/scratch-gui/src/lib/bw-debug/runner-ownership.js';

const requireGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const requireBabel = createRequire(requireGui.resolve('@babel/core'));
const parser = requireBabel('@babel/parser');
const generate = requireBabel('@babel/generator').default;
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runnerSource = read('overlay/scratch-gui/src/lib/bw-debug/debug-runner.js');
const circuitSource = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
const panelSource = read('overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx');
const parse = source => parser.parse(source, {sourceType: 'module', plugins: ['jsx']});
const runnerAst = parse(runnerSource);
const circuitAst = parse(circuitSource);
const panelAst = parse(panelSource);
const exported = name => {
    const declaration = runnerAst.program.body.find(node =>
        node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name === name)?.declaration;
    assert.ok(declaration, `missing actual runner export ${name}`);
    return generate(declaration).code;
};
const {selectEsp32S040Circuit, isEsp32S040Target} = new Function(
    `${exported('selectEsp32S040Circuit')}\n${exported('isEsp32S040Target')}
     return {selectEsp32S040Circuit, isEsp32S040Target};`)();
const circuitClass = circuitAst.program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'CircuitTab');
const ownerMethods = ['createEsp32S040InputOwner', 'releaseEsp32S040Input'].map(name => {
    const method = circuitClass.body.body.find(node => node.key?.name === name);
    assert.ok(method, `missing actual CircuitTab method ${name}`);
    return generate(method).code;
}).join('\n');
const InputHost = new Function(`return class {${ownerMethods}};`)();
const runnerDeclaration = runnerAst.program.body.find(node => node.declaration?.id?.name === 'createDebugRunner').declaration;
const attachDeclaration = runnerDeclaration.body.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'attachEsp32S040');
assert.ok(attachDeclaration, 'actual runner owns the trusted S040 attach');
const panelClass = panelAst.program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'DebugPanel');
const classMethods = (declaration, names) => names.map(name => {
    const method = declaration.body.body.find(node => node.key?.name === name);
    assert.ok(method, `missing actual method ${name}`);
    return generate(method).code;
}).join('\n');

// Change only the module loader in the parsed production functions. Deferred
// imports and factories below exercise their actual await/cleanup boundaries.
function withTestImports (node) {
    const copy = structuredClone(node);
    const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (value.type === 'CallExpression' && value.callee?.type === 'Import') {
            value.callee = {type: 'Identifier', name: 'importForTest'};
        }
        for (const child of Object.values(value)) {
            if (Array.isArray(child)) child.forEach(visit);
            else visit(child);
        }
    };
    visit(copy);
    return generate(copy).code;
}
const runnerFunctions = names => names.map(name => {
    const declaration = runnerDeclaration.body.body.find(node =>
        node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(declaration, `missing actual runner function ${name}`);
    return withTestImports(declaration);
}).join('\n');
const runnerObject = runnerDeclaration.body.body.filter(node => node.type === 'VariableDeclaration')
    .flatMap(node => node.declarations).find(node => node.id.name === 'runner').init;
const runnerMethods = names => names.map(name => {
    const method = runnerObject.properties.find(node => node.key?.name === name);
    assert.ok(method, `missing actual runner method ${name}`);
    return withTestImports(method);
}).join(',\n');

const part = id => ({id, kind: 'esp32_4848s040', terminals: ['gnd', 'gnd2', 'gpio40', 'gpio44', 'gpio2', 'gpio43', 'gpio1', '5v']});
const sourceBoard = parts => ({parts, getNets: () => [{id: 'h1', terminals: [{part: parts[0]?.id, terminal: 'gpio1'}]}]});
const down = [{component: 'touch', channel: 'x', value: 123},
    {component: 'touch', channel: 'y', value: 456}, {component: 'touch', channel: 'pressed', value: 1}];
const up = [{component: 'touch', channel: 'pressed', value: 0}];

test('only the two explicit S040 selectors enter the trusted board route', () => {
    for (const selection of ['board:esp32-4848s040', 'firmware:esp32-4848s040-merged-flash']) {
        assert.equal(isEsp32S040Target(selection), true);
    }
    for (const selection of [null, '', 'esp32s3', 'firmware:esp32s3-merged-flash',
        'software:samd51-no-asf-simulation', 'board:esp32-4848s040-copy']) assert.equal(isEsp32S040Target(selection), false);
});

test('a placed owner is exact; absent, ambiguous, stale and wrong-kind selections cannot become a phantom board', () => {
    assert.equal(selectEsp32S040Circuit(null, null), null);
    assert.equal(selectEsp32S040Circuit(sourceBoard([{id: 'other', kind: 'mcu'}]), null), null);
    const one = sourceBoard([part('A')]);
    assert.deepEqual(selectEsp32S040Circuit(one, null), {sourceBoard: one, mcuId: 'A'});
    const two = sourceBoard([part('A'), part('B')]);
    assert.throws(() => selectEsp32S040Circuit(two, null), /select exactly one/);
    assert.deepEqual(selectEsp32S040Circuit(two, null, 'B'), {sourceBoard: two, mcuId: 'B'});
    for (const id of ['missing', '', 7]) assert.throws(() => selectEsp32S040Circuit(one, null, id), /select/);
    assert.throws(() => selectEsp32S040Circuit(null, {parts: [part('A')]}), /not ready/);
    assert.throws(() => selectEsp32S040Circuit(one, {netlistError: 'bad connector\nmore detail'}), /circuit was rejected: bad connector$/);
});

function attachHost (actualBoard = null, mcuId = null) {
    const vm = {runtime: {circuitBoard: actualBoard}};
    const runner = {};
    const boot = {kind: 'esp32s3-merged-flash', irom: Uint8Array.of(1), drom: Uint8Array.of(2), console: 'uart0'};
    let romLoads = 0;
    const completions = [];
    const host = new Function('selectEsp32S040Circuit', 'vm', 'esp32S040McuId', 'runner',
        'esp32S3BootOptions', 'finishLabwiredAttach',
        `let board = null, engineNotes = [], releaseEsp32S040Target = null;
         const destroyed = false; ${generate(attachDeclaration).code}
         return {attach: attachEsp32S040, board: () => board, notes: () => engineNotes};`)(
        selectEsp32S040Circuit, vm, mcuId, runner,
        async () => {romLoads++; return boot;}, (...args) => {completions.push(args); return 'session';});
    const calls = [];
    const factory = async (kind, options) => {
        calls.push({kind, options});
        return {target: {video: () => null}, adapter: {labwiredBoard: {mcuId: options.mcuId ?? null}}, refusals: []};
    };
    class Board {
        constructor(voltage) {this.voltage = voltage;}
        setNetlist(parts, nets) {this.parts = parts; this.nets = nets;}
        setPower(value) {this.powered = value;}
    }
    return {host, vm, runner, boot, calls, completions, romLoads: () => romLoads,
        attach: built => host.attach(built, {wasm: true}, factory, () => {}, Board)};
}

test('addressed S040 attach passes the real H1 netlist and exact selected ID through the public factory', async () => {
    const actual = sourceBoard([part('A')]);
    const h = attachHost(actual);
    const image = Uint8Array.of(0x7f, 0x45, 0x4c, 0x46);
    assert.equal(await h.attach({format: 'elf', image}), 'session');
    assert.equal(h.calls.length, 1);
    const {kind, options} = h.calls[0];
    assert.equal(kind, 'labwired');
    assert.equal(options.labwiredBoardId, 'esp32-4848s040');
    assert.equal(options.mcuId, 'A');
    assert.equal(options.board.parts, actual.parts, 'host must not drop other parts to evade supplier H1 validation');
    assert.deepEqual(options.board.nets, actual.getNets());
    assert.equal(options.board.voltage, 3.3);
    assert.equal(options.board.powered, true);
    assert.equal(options.firmware, image);
    assert.equal('chipYaml' in options, false);
    assert.equal('pins' in options, false);
    assert.equal(h.runner.esp32S040PartId, 'A');
    assert.equal(h.vm.runtime.bwRunBoard, options.board);
    assert.equal(h.romLoads(), 0);
    assert.equal(h.completions[0].at(-1), true, 'keep live video polling before the first DMA frame');
});

test('firmware-only S040 has no circuit owner, and merged flash reuses admitted ROM boot options', async () => {
    const h = attachHost();
    await h.attach({format: 'esp32s3-merged-flash', image: Uint8Array.of(0xe9)});
    const {options} = h.calls[0];
    assert.equal(options.firmwareBoot, h.boot);
    assert.equal(h.romLoads(), 1);
    assert.equal('board' in options, false);
    assert.equal('mcuId' in options, false);
    assert.equal(h.runner.esp32S040PartId, null);
});

test('unsupported firmware and ambiguous circuits are refused before ROM requests or target creation', async () => {
    for (const built of [null, {format: 'uf2', image: new Uint8Array(512)}, {format: 'bin', image: Uint8Array.of(0xe9)}]) {
        const h = attachHost();
        await assert.rejects(h.attach(built), /addressed Xtensa ELF/);
        assert.equal(h.calls.length, 0);
        assert.equal(h.romLoads(), 0);
    }
    const h = attachHost(sourceBoard([part('A'), part('B')]));
    await assert.rejects(h.attach({format: 'esp32s3-merged-flash', image: Uint8Array.of(0xe9)}), /select exactly one/);
    assert.equal(h.calls.length, 0);
    assert.equal(h.romLoads(), 0);
});

test('real host input preserves atomic batches and releases a held contact exactly once to its original runner', () => {
    const calls = [];
    const host = new InputHost();
    let frame = null;
    const runner = {setInputs: changes => {calls.push(changes); return {accepted: true};}, video: () => frame};
    const owner = host.createEsp32S040InputOwner(runner, 'A');
    host._esp32S040InputOwner = owner;
    assert.equal(owner.video(), null);
    frame = {width: 480, height: 480, frame: 1};
    assert.equal(owner.video(), frame, 'first DMA frame appears without changing the callback');
    owner.input(down);
    const move = [{component: 'touch', channel: 'x', value: 321}, {component: 'touch', channel: 'y', value: 47}];
    owner.input(move);
    host.releaseEsp32S040Input();
    host.releaseEsp32S040Input();
    assert.deepEqual(calls, [down, move, up]);
    assert.equal(calls[0], down, 'do not split an atomic touch transaction');
    assert.equal(owner.input(down).accepted, false, 'an old face cannot write to a replacement owner');
    assert.equal(owner.video(), null, 'released video cannot leave a stale frame');
    assert.equal(host._esp32S040InputOwner, null);
});

test('pointer-up and refused downs do not create a second release or a fabricated held contact', () => {
    for (const accepted of [true, false]) {
        const calls = [];
        const owner = new InputHost().createEsp32S040InputOwner({setInputs: changes => {
            calls.push(changes); return {accepted};
        }}, 'A');
        owner.input(down);
        if (accepted) owner.input(up);
        owner.release();
        assert.deepEqual(calls, accepted ? [down, up] : [down]);
    }
});

function deferred () {
    let resolve;
    const promise = new Promise(done => {resolve = done;});
    return {promise, resolve};
}

function runnerLifecycle ({pauseAt, firmware = {name: 'test.bin', bytes: Uint8Array.of(0xe9)},
    selection = 'firmware:esp32-4848s040-merged-flash', destroyInSession = false,
    targetDestroyFailure = false, window} = {}) {
    const reached = deferred(), resume = deferred();
    const stages = [], phases = [];
    const counts = {compiled: 0, targetCreated: 0, targetDestroyed: 0,
        sessionCreated: 0, sessionDestroyed: 0, started: 0, stopped: 0, scheduled: 0,
        wasmCreated: 0, wasmFreed: []};
    const gate = async name => {
        stages.push(name);
        if (name === pauseAt) {reached.resolve(); await resume.promise;}
    };
    const vm = {runtime: {circuitBoard: sourceBoard([part('A')])}};
    let host, adapter, frame = null, bootImports = 0;
    const machine = () => {
        const id = ++counts.wasmCreated;
        return {free: () => {counts.wasmFreed.push(id);}};
    };
    const resetMachine = () => {
        adapter.sim.free(); adapter.sim = machine(); frame = null;
    };
    const target = {video: () => frame, destroy: () => {
        counts.targetDestroyed++;
        if (targetDestroyFailure) throw new Error('target cleanup failed');
    }};
    class Board {
        setNetlist(parts, nets) {this.parts = parts; this.nets = nets;}
        setPower() {}
    }
    const importForTest = async name => {
        if (name === 'bw-board') {
            await gate('board-import');
            return {BoardImpl: Board,
                createDebugTarget: async (_kind, options) => {
                    await gate('factory');
                    counts.targetCreated++;
                    adapter = {labwiredBoard: {mcuId: options.mcuId}, sim: machine()};
                    return {target, adapter, refusals: []};
                },
                createDebugSession: () => {
                    counts.sessionCreated++;
                    if (destroyInSession) host.runner.destroy();
                    let stopped = false;
                    return {start: () => {if (stopped) resetMachine(); stopped = false; counts.started++;},
                        stop: () => {resetMachine(); stopped = true; counts.stopped++;},
                        destroy: () => {counts.sessionDestroyed++;}};
                }};
        }
        if (name === '../labwired-engine.js') {
            await gate('engine-import');
            return {loadLabwired: async () => {await gate('wasm-load'); return {};}};
        }
        if (name === 'bw-board/labwired-firmware-boot.js') {
            await gate(++bootImports === 1 ? 'validator-import' : 'boot-import');
            return {ESP32S3_FLASH_BOOT_KIND: 'esp32s3-merged-flash',
                validateEsp32S3MergedFlash: bytes => assert.equal(bytes[0], 0xe9)};
        }
        if (name === './esp32s3-firmware.js') {
            await gate('rom-import');
            return {loadEsp32S3Roms: async () => {
                await gate('rom-fetch');
                return {irom: Uint8Array.of(1), drom: Uint8Array.of(2)};
            }};
        }
        throw new Error(`unexpected module ${name}`);
    };
    // Unrelated runner services are inert; selection, firmware routing, import
    // awaits, target/session adoption and destruction are production methods.
    host = new Function('deps', 'importForTest', 'selectEsp32S040Circuit', 'isEsp32S040Target', `
        const {vm, counts, phases, window, userFirmware, labwiredChip} = deps;
        const targetKind = 'labwired', bootMedia = null, labwiredBoardVariant = null;
        const esp32S040McuId = null, esp32s3Console = 'uart0';
        let board = null, target = null, session = null, symbols = null, destroyed = false;
        let releaseEsp32S040Target = null;
        let engineNotes = [], serialLines = [], variableTable = [], pinTable = [], status = {};
        let hddSnapshotOwner = {}, serialTerminal, serialEsc, terminalOutput, linuxProgressWatch;
        let imageProvenance, boardBaseNs, reverseCursor, blockOf, yieldOf;
        let unsubscribeBps, unsubscribeDebugEvents, unsubscribeDebugInputs, debugEventsTarget;
        let i8086ExecutionResult, activeRunTo, runToTarget, runToController;
        let cp1LessonBatch = null, unsubscribeCp1Lessons, disposeTerminal, terminalFrame;
        const xtKeyboard = null, pcSerialInput = null, basicStartup = null, cardiacInitialSnapshot = null;
        const noop = () => {}, projectStc = () => null, selectDebugTargetKind = (_device, kind) => kind;
        const cancelCp2Recording = noop;
        const beginForwardBranch = () => ({accepted: true}), reverseContinue = {reset: noop};
        const resetEventBreakpointRuntime = noop, syncBreakpoints = noop, subscribeBreakpoints = () => noop;
        const boardTimeBase = () => 0, schedule = () => {counts.scheduled++;}, unschedule = noop;
        const build = () => {counts.compiled++; throw new Error('unexpected compiler request');};
        const i8086ExecutionLifetime = {abort: noop}, i8086Execution = {release: noop};
        const setValueResolver = noop, unsubscribeRecordingEvents = noop, clearGlow = noop;
        const forkRecordingStore = {summaries: () => []}, debugFoundation = {clear: noop};
        const replayingDebugHistory = false, replayOutputGate = {emit: noop};
        const snapshotEmitter = {immediate: () => phases.push(status.phase)};
        const S = value => value;
        class CustomEvent {constructor(type) {this.type = type;}}
        ${exported('runnerCompilesProjectBlocks')}
        ${runnerFunctions(['attach', 'attachLabwiredTarget', 'attachEsp32S040', 'esp32S3BootOptions',
        'finishLabwiredAttach', 'builtFromUserFirmware', 'setStatus', 'publishCp1Observations',
        'publishBasicSerial', 'emit'])}
        const runner = {${runnerMethods(['start', 'stop', 'destroy'])}, variables: () => []};
        return {runner, board: () => board, state: () => status};
    `)({vm, counts, phases, window, userFirmware: firmware, labwiredChip: selection},
        importForTest, selectEsp32S040Circuit, isEsp32S040Target);
    return {...host, vm, counts, phases, stages, reached: reached.promise, resume: resume.resolve,
        frame: value => {frame = value;}};
}

for (const pauseAt of ['validator-import', 'board-import', 'engine-import', 'wasm-load',
    'boot-import', 'rom-import', 'rom-fetch', 'factory']) {
    test(`detach during ${pauseAt} cannot publish over a replacement or leak a target`, async () => {
        const h = runnerLifecycle({pauseAt});
        const starting = h.runner.start();
        await Promise.race([h.reached, starting.then(() => {throw new Error(`${pauseAt} was never reached`);})]);
        h.runner.destroy();
        const replacementBoard = {}, replacementVariables = () => [];
        h.vm.runtime.bwRunBoard = replacementBoard;
        h.vm.runtime._bwDebugVariables = replacementVariables;
        const phasesAtDetach = [...h.phases], stagesAtDetach = [...h.stages];
        h.resume();
        assert.deepEqual(await starting, {accepted: false, code: 'destroyed'});
        assert.equal(h.vm.runtime.bwRunBoard, replacementBoard);
        assert.equal(h.vm.runtime._bwDebugVariables, replacementVariables);
        assert.equal(h.board(), null);
        assert.equal('esp32S040PartId' in h.runner, false);
        assert.equal('video' in h.runner, false);
        assert.deepEqual(h.phases, phasesAtDetach, 'no status publication after detach');
        assert.deepEqual(h.stages, stagesAtDetach, 'no later import, ROM fetch or factory starts');
        assert.equal(h.counts.targetCreated, pauseAt === 'factory' ? 1 : 0);
        assert.equal(h.counts.targetDestroyed, h.counts.targetCreated, 'dispose a late public factory result once');
        assert.deepEqual(h.counts.wasmFreed, pauseAt === 'factory' ? [1] : [],
            'target disposal also frees the actual WASM allocation');
        assert.equal(h.counts.sessionCreated, 0);
        assert.equal(h.counts.started, 0);
        assert.equal(h.counts.scheduled, 0);
        assert.equal(h.counts.compiled, 0);
    });
}

test('a session returned during synchronous teardown is disposed without starting', async () => {
    const h = runnerLifecycle({destroyInSession: true});
    assert.deepEqual(await h.runner.start(), {accepted: false, code: 'destroyed'});
    assert.equal(h.counts.targetDestroyed, 1);
    assert.deepEqual(h.counts.wasmFreed, [1]);
    assert.equal(h.counts.sessionDestroyed, 1);
    assert.equal(h.counts.started, 0);
    assert.equal(h.counts.scheduled, 0);
    assert.equal('bwRunBoard' in h.vm.runtime, false);
    assert.equal('_bwDebugVariables' in h.vm.runtime, false);
    assert.equal('esp32S040PartId' in h.runner, false);
    assert.equal('video' in h.runner, false);
});

test('a synchronous board-ready teardown disposes the not-yet-adopted target', async () => {
    let h;
    h = runnerLifecycle({window: {dispatchEvent: () => {h.runner.destroy();}}});
    assert.deepEqual(await h.runner.start(), {accepted: false, code: 'destroyed'});
    assert.equal(h.counts.targetDestroyed, 1);
    assert.deepEqual(h.counts.wasmFreed, [1]);
    assert.equal(h.counts.sessionCreated, 0);
    assert.equal(h.counts.started, 0);
    assert.equal('bwRunBoard' in h.vm.runtime, false);
    assert.equal('video' in h.runner, false);
});

test('live attach retains pending video and transfers target/session cleanup to the runner', async () => {
    const h = runnerLifecycle();
    await h.runner.start();
    assert.equal(h.runner.esp32S040PartId, 'A');
    assert.equal(h.vm.runtime.bwRunBoard, h.board());
    assert.equal(h.runner.video(), null);
    const frame = {width: 480, height: 480, frame: 1};
    h.frame(frame);
    assert.equal(h.runner.video(), frame);
    assert.equal(h.counts.started, 1);
    assert.equal(h.counts.scheduled, 1);
    h.runner.destroy();
    assert.equal(h.counts.targetDestroyed, 1);
    assert.deepEqual(h.counts.wasmFreed, [1]);
    assert.equal(h.counts.sessionDestroyed, 1);
    assert.equal('bwRunBoard' in h.vm.runtime, false);
    assert.equal('video' in h.runner, false);
});

test('stop/restart republishes the reused board and cleanup frees the current reset machine once', async () => {
    const h = runnerLifecycle();
    await h.runner.start();
    const board = h.board();
    h.runner.stop();
    assert.equal('bwRunBoard' in h.vm.runtime, false);
    assert.equal(h.board(), board, 'the session retains its board for restart');
    assert.deepEqual(h.counts.wasmFreed, [1], 'supplier stop/reset replaced the first machine');
    await h.runner.start();
    assert.equal(h.vm.runtime.bwRunBoard, board, 'Widgets follow the resumed circuit again');
    assert.equal(h.counts.targetCreated, 1);
    assert.equal(h.counts.sessionCreated, 1);
    assert.equal(h.counts.started, 2);
    assert.deepEqual(h.counts.wasmFreed, [1, 2], 'supplier restart/reset replaced the second machine');
    h.runner.destroy();
    h.runner.destroy();
    assert.deepEqual(h.counts.wasmFreed, [1, 2, 3], 'free the current machine, never an old reset instance twice');
    assert.equal(h.counts.targetDestroyed, 1);
    assert.equal(h.counts.sessionDestroyed, 1);
    assert.equal('bwRunBoard' in h.vm.runtime, false);
});

test('a target cleanup error still frees WASM and clears runner publications', async () => {
    const h = runnerLifecycle({targetDestroyFailure: true});
    await h.runner.start();
    assert.throws(() => h.runner.destroy(), /target cleanup failed/);
    assert.deepEqual(h.counts.wasmFreed, [1]);
    assert.equal('bwRunBoard' in h.vm.runtime, false);
    assert.equal('_bwDebugVariables' in h.vm.runtime, false);
    assert.equal('esp32S040PartId' in h.runner, false);
    assert.equal('video' in h.runner, false);
    h.runner.destroy();
    assert.equal(h.counts.targetDestroyed, 1);
    assert.deepEqual(h.counts.wasmFreed, [1]);
});

test('actual start refuses missing firmware, raw BIN and Cortex-M UF2 without loading or compiling', async () => {
    for (const selection of ['board:esp32-4848s040', 'firmware:esp32-4848s040-merged-flash']) {
        const h = runnerLifecycle({selection, firmware: null});
        await h.runner.start();
        assert.equal(h.state().phase, 'error');
        assert.match(h.state().message, /load firmware before starting/);
        assert.deepEqual(h.stages, []);
        assert.equal(h.counts.compiled, 0);
    }
    for (const bytes of [Uint8Array.of(0xe9), Uint8Array.of(0x55, 0x46, 0x32, 0x0a, 0, 0, 0, 0)]) {
        const h = runnerLifecycle({selection: 'board:esp32-4848s040', firmware: {name: 'wrong', bytes}});
        await h.runner.start();
        assert.equal(h.state().phase, 'error');
        assert.match(h.state().message, /addressed Xtensa .elf/);
        assert.deepEqual(h.stages, []);
        assert.equal(h.counts.compiled, 0);
    }
});

const CircuitHost = new Function('applyBenchTemperature', 'advanceDebugPhase',
    'shouldRefreshDesignerDebugState', 'DEBUG_LIVE_REFRESH_MS', `return class {
    ${classMethods(circuitClass, ['handleRunnerChange', 'handleRunnerGone',
        'createEsp32S040InputOwner', 'releaseEsp32S040Input'])}
}`)(() => {}, (_previous, phase) => ({next: phase, dispatch: false}), () => true, 250);
const PanelHost = new Function(`return class {
    ${classMethods(panelClass, ['_teardownRunner', 'onStart', 'runner'])}
}`)();
function panelHost () {
    const panel = new PanelHost();
    panel.state = {runner: null, ui: {phase: 'idle'}};
    panel.props = {};
    panel._runnerOwnership = createRunnerOwnership();
    panel.releaseSamdButtons = panel._invalidateHddDownload = panel._mouseLeave = () => {};
    return panel;
}

for (const teardown of ['panel', 'host']) {
    test(`${teardown} teardown sends one accepted touch-up without reentrant owner recreation`, async () => {
        const host = new CircuitHost(), panel = panelHost();
        host.state = {board: null, debugState: null, debugDock: 'right'};
        host.setState = update => Object.assign(host.state, update);
        host._markReactUpdate = () => {};
        const board = {}, ui = {phase: 'running', session: null}, events = [];
        let alive = true, publications = 0, runner;
        const claim = panel._runnerOwnership.claim();
        const publish = panel._runnerOwnership.guard(claim, () => {
            publications++;
            host.handleRunnerChange(runner, ui);
        });
        const route = createEngineeringInputRoute({
            getTarget: () => ({setInputs: changes => {
                assert.equal(alive, true, 'the final touch-up reaches its original live target');
                events.push(changes);
                return {accepted: true};
            }}),
            onApplied: publish
        });
        runner = {board: () => board, esp32S040PartId: 'A', video: () => null,
            setInputs: route.setInputs, destroy: () => {alive = false; events.push('destroy');}};
        panel.state.runner = runner;
        panel._runnerPromise = Promise.resolve(runner);
        panel.props.onRunnerGone = () => host.handleRunnerGone();
        publish();
        const owner = host._esp32S040InputOwner;
        owner.input(down);
        const before = publications;
        if (teardown === 'panel') panel._teardownRunner();
        else host.handleRunnerGone();
        await Promise.resolve();
        assert.deepEqual(events, teardown === 'panel' ? [down, up, 'destroy'] : [down, up]);
        assert.equal(publications, before + (teardown === 'host' ? 1 : 0),
            'panel fences notifications; a direct host release also tolerates the synchronous callback');
        assert.equal(host._esp32S040InputOwner, null);
        assert.equal(host.state.debugState, null);
        assert.equal(host.state.board, null);
        assert.equal(host._releasingEsp32S040Input, false);
        assert.equal(owner.input(down).accepted, false);
        assert.equal(owner.video(), null);
    });
}

for (const pauseAt of ['creation', 'start']) {
    test(`panel replacement during runner ${pauseAt} cannot start or mirror the old runner`, async () => {
        const panel = panelHost(), reached = deferred(), resume = deferred();
        const events = [];
        const old = {
            start: async () => {
                events.push('old:start');
                if (pauseAt === 'start') {reached.resolve(); await resume.promise;}
            },
            destroy: () => events.push('old:destroy')
        };
        panel._createRunner = async () => {
            if (pauseAt === 'creation') {reached.resolve(); await resume.promise;}
            return old;
        };
        panel.state.kind = 'labwired';
        panel.mirrorRunnerDisplay = runner => events.push(runner === old ? 'old:mirror' : 'new:mirror');
        const starting = panel.onStart();
        await reached.promise;
        panel._teardownRunner();
        const replacement = {};
        panel.state.runner = replacement;
        panel._runnerOwnership.claim();
        panel._runnerPromise = Promise.resolve(replacement);
        resume.resolve();
        await starting;
        await Promise.resolve();
        assert.deepEqual(events, pauseAt === 'creation' ? ['old:destroy'] : ['old:start', 'old:destroy']);
    });
}

test('the current panel runner still starts and mirrors normally, and paused runs resume', async () => {
    const panel = panelHost(), events = [];
    const running = {phase: 'running'};
    const current = {start: async () => events.push('start'), resume: () => events.push('resume'),
        state: () => running};
    panel.state.kind = 'labwired';
    panel._createRunner = async () => current;
    panel.mirrorRunnerDisplay = runner => {assert.equal(runner, current); events.push('mirror');};
    panel._mountGuestTerminal = (runner, state) => {
        assert.equal(runner, current);
        assert.equal(state, running);
        events.push('terminal');
    };
    await panel.onStart();
    panel.state.ui.phase = 'paused';
    await panel.onStart();
    assert.deepEqual(events, ['start', 'mirror', 'terminal', 'resume']);
});

test('the checked host source connects exact owner, input and live video and releases before runner destruction', () => {
    assert.ok(panelAst.program.body.length, 'the real panel JSX parses');
    assert.match(circuitSource, /esp32S040PartId=\{this\.state\.debugState\?\.esp32S040PartId \|\| null\}/);
    assert.match(circuitSource, /onEsp32S040Input=\{this\.state\.debugState\?\.onEsp32S040Input \|\| null\}/);
    assert.match(circuitSource, /video: s040\?\.video/);
    assert.match(circuitSource, /previousS040\.runner !== runner \|\| previousS040\.partId !== ownerId/);
    assert.match(circuitSource, /handleRunnerGone \(\) \{\s*this\.releaseEsp32S040Input\(\)/);
    const unmount = circuitClass.body.body.find(node => node.key?.name === 'componentWillUnmount');
    const statements = unmount.body.body;
    const releaseIndex = statements.findIndex(node => node.type === 'ExpressionStatement' &&
        node.expression.type === 'CallExpression' && node.expression.callee.type === 'MemberExpression' &&
        node.expression.callee.object.type === 'ThisExpression' &&
        node.expression.callee.property.name === 'releaseEsp32S040Input');
    assert.ok(releaseIndex >= 0, 'unmount unconditionally releases the S040 owner');
    assert.ok(statements.slice(0, releaseIndex).every(node => {
        if (generate(node).code === 'this.galleryArtworkRequest = null;') return true;
        const call = node.expression;
        return call?.type === 'CallExpression' && call.callee.type === 'MemberExpression' &&
            call.callee.object.name === 'window' && call.callee.property.name === 'removeEventListener';
    }), 'only invalidating pending artwork and detaching window listeners may precede input release');
    assert.doesNotMatch(circuitSource, /data-no-code-indicator/);
    assert.match(panelSource, /esp32S040McuId: this\.state\.esp32S040McuId \|\| null/);
    assert.match(panelSource, /data-esp32s040-part/);
});
