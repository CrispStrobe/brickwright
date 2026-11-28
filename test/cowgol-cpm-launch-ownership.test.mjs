// The actual editor, media handoff, panel boot, Z80 attach, start, frame, stop
// and destroy methods run here. Lazy imports, ROM fetches and the guest session
// are controlled boundaries; real CP/M execution is qualified separately by
// scripts/verify-cowgol-cpm-system.mjs against the pinned bw-board and ROMs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as compiler from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {createRunnerOwnership} from '../overlay/scratch-gui/src/lib/bw-debug/runner-ownership.js';
import {cpmFileName} from '../overlay/scratch-gui/src/lib/bw-debug/cpm-z80.js';

const read = path => readFileSync(new URL(`../overlay/scratch-gui/src/${path}`, import.meta.url), 'utf8');
const editorSource = read('components/tw-pseudocode/pseudocode-importer.jsx');
const panelSource = read('components/tw-pseudocode/debug-panel.jsx');
const runnerSource = read('lib/bw-debug/debug-runner.js');
const section = (source, begin, end) => {
    const start = source.indexOf(begin), stop = source.indexOf(end, start + begin.length);
    assert.ok(start >= 0 && stop > start, begin);
    return source.slice(start, stop);
};
const editorMethods = section(editorSource, '    async compileCowgolSource (', '    async compile ({')
    .replace("await import('../../lib/bw-lang/cowgol-compile.js')", 'await loadCompiler()') +
    section(editorSource, '    stopCodeRun () {', '    disposeCodeRun () {');
const panelMethods = section(panelSource, '    async _onMediaLoad (e) {', '    _onAsmRomReady (e) {') +
    section(panelSource, '    _teardownRunner () {', '    async onStart () {')
        .replace(/await import\(\s*\/\* webpackChunkName: "bw-debug" \*\/ '..\/..\/lib\/bw-debug\/debug-runner.js'\)/,
            'await loadRunner()');
const launchMethods = section(runnerSource, '    let mediaLaunch =', '    /**\n     * Board time');
const attachMethod = section(runnerSource, '    async function attachZ80() {', '    // The RISC-V RV32IMA')
    .replace(/await import\(\/\* webpackChunkName: "bw-board" \*\/ 'bw-board'\)/g, 'await loadBoard()')
    .replace(/await import\('bw-board\/z80-machine.js'\)/g, 'await loadZ80Config()');
const frameMethod = section(runnerSource, '    function pumpFrame() {', '    function schedule() {');
const startMethod = section(runnerSource, '        async start({paused = false} = {}) {', '        pause() {');
const stopMethod = section(runnerSource, '        stop() {', '        setSpeed(');
const destroyMethod = section(runnerSource, '        destroy({preserveRuntime = false} = {}) {', '\n    };');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

// Only the external session/board and unrelated debugger instruments are
// substituted. The asynchronous control flow under regression is unmodified.
const makeRunner = new Function('deps', `
    const {bootMedia, vm, pause, events, afterWire, afterPump, cpmFileName, document, window} = deps;
    const targetKind = 'z80', machineConfig = null, userFirmware = null, labwiredChip = null;
    let session = null, target = null, board = null, symbols = null, destroyed = false, cpmAutoRun = null;
    let serialLines = [], phase = 'idle', message = '', rafId = null, imageProvenance = null;
    let reverseCursor = null, unsubscribeBps = null, cardiacInitialSnapshot = null, boardBaseNs = 0n;
    let i8086ExecutionResult = null, activeRunTo = null, runToController = null, runToTarget = null;
    let cp1RunKeyUntil = null, skipRequested = false, terminalFrame = null, disposeTerminal = null;
    let hddSnapshotOwner = {}, unsubscribeDebugEvents = null, debugEventsTarget = null;
    let unsubscribeDebugInputs = null, unsubscribeCp1Lessons = null, cp1LessonBatch = null;
    let releaseEsp32S040Target = null;
    const xtKeyboard = null, pcSerialInput = null, basicStartup = null, SKIP_BUDGET = 1;
    const noop = () => {}, reverseContinue = {reset: noop}, debugFoundation = {clear: noop};
    const i8086Execution = {release: noop}, i8086ExecutionLifetime = new AbortController();
    const forkRecordingStore = {summaries: () => []};
    const cancelCp2Recording = noop, unsubscribeRecordingEvents = noop, clearGlow = noop;
    const resetEventBreakpointRuntime = noop, syncBreakpoints = noop, setValueResolver = noop;
    const publishBasicSerial = noop, emitLive = noop, releaseCp1RunKey = noop;
    const subscribeBreakpoints = () => noop, beginForwardBranch = () => ({accepted: true});
    const projectStc = () => null, selectDebugTargetKind = () => 'z80';
    const runnerCompilesProjectBlocks = () => false, boardTimeBase = () => 0n;
    const S = key => key, setStatus = (next, text = '') => { phase = next; message = text; };
    const designerBoard = () => ({board: null, why: 'test boundary'});
    const resolveMediaImage = async media => ({bytes: media.bytes});
    const loadZ80Config = async () => ({CPM64K: {ports: []}});
    const schedule = () => { events.push('scheduled'); deps.scheduled.resolve(); };
    const unschedule = () => events.push('unscheduled');
    const fetch = async (url, options) => {
        events.push(['fetch', url, options.signal]);
        await pause('rom-fetch');
        if (deps.fetchFailure) throw new Error('late ROM fetch failure');
        return {ok: true, arrayBuffer: async () => Uint8Array.of(0).buffer};
    };
    const loadBoard = async () => {
        await pause('board-import');
        return {createDebugSession: noop, createDebugTarget: async (kind, options) => {
            events.push(['target', kind, options]);
            await pause('target-create');
            return {target: {timeNs: () => 0n, destroy: () => events.push('target-destroy')}};
        }};
    };
    const wireMachineBench = result => {
        events.push('wired');
        target = result.target;
        session = {start: () => events.push('session-start'), stop: () => events.push('session-stop'),
            destroy: () => events.push('session-destroy'),
            pump: () => { events.push('pump'); afterPump?.(); return 'ran'; }};
        afterWire?.();
    };
    ${launchMethods}
    ${attachMethod}
    const attach = attachZ80;
    ${frameMethod}
    const runner = {
        ${startMethod}
        ${stopMethod}
        ${destroyMethod},
        state: () => ({phase, message}),
        sendSerial: value => events.push(['command', value])
    };
    return {runner, frame: line => { serialLines = [line]; pumpFrame(); }, isDestroyed: () => destroyed};
`);

function fixture ({hold = null, afterWire = null, afterPump = null, fetchFailure = false} = {}) {
    const entered = deferred(), release = deferred(), scheduled = deferred();
    let held = false, device = 'z80', images = true, stage = {}, project = {name: 'current'};
    const pause = async phase => {
        if (phase === hold && !held) { held = true; entered.resolve(); await release.promise; }
    };
    const events = [], units = [], details = [], listeners = [];
    const vm = {runtime: {stc: {device: 'z80'}, getTargetForStage: () => stage},
        toJSON: () => JSON.stringify(project)};
    const loadRunner = async () => {
        await pause('runner-import');
        return {createDebugRunner: ({bootMedia}) => {
            const unit = makeRunner({bootMedia, vm, pause, events, scheduled, cpmFileName, fetchFailure,
                afterWire, afterPump, document: {baseURI: 'https://brickwright.invalid/'}, window: undefined});
            units.push(unit);
            return unit.runner;
        }};
    };
    const Panel = new Function('loadRunner', `return class {${panelMethods}}`)(loadRunner);
    const panel = new Panel();
    Object.assign(panel, {props: {vm}, state: {kind: 'z80', runner: null},
        _runnerOwnership: createRunnerOwnership(),
        setState (patch, callback) {
            Object.assign(this.state, patch);
            if (callback) pause('panel-state').then(callback);
        },
        releaseSamdButtons () {}, _invalidateHddDownload () {},
        _mountGuestTerminal () { events.push('terminal'); }});
    const machine = (config, options) => runMachineConfig(config, {...options, awaitBoot: true,
        dispatch: detail => { details.push(detail); listeners.push(panel._onMediaLoad({detail})); }});
    const loadCompiler = async () => ({...compiler, compileCowgol: async () => ({
        bytes: Uint8Array.of(0xc9), toolchain: 'cowgol-cpmz'
    })});
    const Editor = new Function('loadCompiler', 'runMachineConfig', 'remoteMachineImagesAllowed',
        `return class {${editorMethods}}`)(loadCompiler, machine, () => images);
    const editor = new Editor();
    Object.assign(editor, {props: {vm}, state: {lang: 'cowgol', buffers: {cowgol: 'authored source'},
        busy: false, running: false},
        L: {cowgolCompiling: 'compiling', cowgolStale: 'stale', stError: text => `error: ${text}`},
        activeCode () { return this.state.buffers[this.state.lang]; }, codeDevice: () => device,
        setState (patch) { Object.assign(this.state, patch); }});
    return {editor, panel, vm, events, units, details, listeners, entered, release, scheduled,
        start: () => editor.compileCowgolSource('z80-cpm', true, {surface: 'cpm-vdp'}),
        setDevice: value => { device = value; }, setImages: value => { images = value; },
        replaceStage: () => { stage = {}; }, editBlocks: () => { project.name = 'edited'; }};
}

const revocations = {
    source: f => { f.editor.state.buffers = {cowgol: 'new source'}; },
    'edit and revert': f => { f.editor.state.buffers = {cowgol: 'authored source'}; },
    language: f => { f.editor.state.lang = 'python'; },
    device: f => f.setDevice('riscv32'),
    stage: f => f.replaceStage(), Blocks: f => f.editBlocks(),
    'device metadata': f => { f.vm.runtime.stc.clock = 123; },
    'image policy': f => f.setImages(false), Stop: f => f.editor.stopCodeRun(),
    unmount: f => { f.editor._unmounted = true; },
    'new request': f => { f.editor._cowgolCompile = new AbortController(); f.editor.state.status = 'new owner'; }
};
const commands = f => f.events.filter(event => Array.isArray(event) && event[0] === 'command');
const promptly = async promise => {
    let timer;
    try {
        await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('cancelled launch did not settle promptly')), 500);
        })]);
    } finally { clearTimeout(timer); }
};

for (const hold of ['panel-state', 'runner-import', 'board-import', 'rom-fetch', 'target-create']) {
    test(`source ownership survives post-dispatch ${hold}`, async () => {
        for (const [reason, revoke] of Object.entries(revocations)) {
            const f = fixture({hold}), pending = f.start();
            await f.entered.promise;
            assert.equal(f.details.length, 1, 'already dispatched before revocation');
            revoke(f);
            f.release.resolve();
            await promptly(pending);
            await Promise.all(f.listeners);
            assert.equal(f.events.includes('session-start'), false, reason);
            assert.deepEqual(commands(f), [], reason);
            assert.equal(f.details[0].bootCompletion, undefined, reason);
            assert.equal(f.details[0].launchControl.cancelled, true, reason);
            if (reason === 'new request') assert.equal(f.editor.state.status, 'new owner');
        }
    });
}

test('source is rechecked after target wiring immediately before session.start', async () => {
    let f;
    f = fixture({afterWire: () => revocations.source(f)});
    await promptly(f.start());
    await Promise.all(f.listeners);
    assert.ok(f.events.includes('wired'));
    assert.equal(f.events.includes('session-start'), false);
    assert.ok(f.events.includes('session-destroy'));
    assert.deepEqual(commands(f), []);
});

test('Stop settles during an outstanding ROM fetch and absorbs a late fetch error', async () => {
    const f = fixture({hold: 'rom-fetch', fetchFailure: true}), pending = f.start();
    await f.entered.promise;
    f.editor.stopCodeRun();
    await promptly(pending);
    assert.equal(f.editor.state.busy, false);
    assert.equal(f.details[0].bootCompletion, undefined);
    f.release.resolve();
    await Promise.all(f.listeners);
    assert.equal(f.events.includes('session-start'), false);
    assert.deepEqual(commands(f), []);
});

test('debugger Stop also settles an outstanding attach before its ROM fetch completes', async () => {
    const f = fixture({hold: 'rom-fetch'}), pending = f.start();
    await f.entered.promise;
    f.units[0].runner.stop();
    await promptly(pending);
    assert.equal(f.editor.state.busy, false);
    f.release.resolve();
    await Promise.all(f.listeners);
    assert.equal(f.events.includes('session-start'), false);
    assert.deepEqual(commands(f), []);
});

test('attachment failure remains visible and retained failed media cannot replay after source changes', async () => {
    const f = fixture({fetchFailure: true});
    await promptly(f.start());
    await Promise.all(f.listeners);
    assert.match(f.editor.state.status, /error: late ROM fetch failure/);
    assert.equal(f.details[0].launchControl.cancelled, true);
    assert.equal(f.details[0].launchControl.isCurrent, null);
    assert.equal(f.details[0].launchControl.onRelease, null);
    revocations.source(f);
    f.panel._lastMediaDetail = null; // the retained event is replayed on a later panel mount
    await f.panel._onMediaLoad({detail: f.details[0]});
    assert.equal(f.units.length, 1);
    assert.equal(f.events.includes('session-start'), false);
});

test('pending CP/M autorun keeps editor ownership and stops before the next pump after revocation', async () => {
    for (const [reason, revoke] of Object.entries(revocations)) {
        const f = fixture(), pending = f.start();
        await f.scheduled.promise;
        assert.equal(f.editor.state.busy, true, reason);
        assert.ok(f.editor._cowgolCompile, reason);
        assert.ok(f.details[0].bootCompletion, reason);
        const unit = f.units[0];
        revoke(f);
        unit.frame('A>');
        await promptly(pending);
        await Promise.all(f.listeners);
        assert.equal(f.events.includes('pump'), false, reason);
        assert.deepEqual(commands(f), [], reason);
        assert.equal(unit.isDestroyed(), true, reason);
    }
});

test('ownership is rechecked between guest output and the CP/M command queue', async () => {
    let f;
    f = fixture({afterPump: () => revocations.source(f)});
    const pending = f.start();
    await f.scheduled.promise;
    f.units[0].frame('A>');
    await promptly(pending);
    await Promise.all(f.listeners);
    assert.ok(f.events.includes('pump'));
    assert.deepEqual(commands(f), []);
    assert.equal(f.units[0].isDestroyed(), true);
});

test('successful A> launch transfers ownership, clears retained editor closures and queues once', async () => {
    const f = fixture(), pending = f.start();
    await f.scheduled.promise;
    const unit = f.units[0];
    unit.frame('CP/M is booting');
    assert.equal(f.editor.state.busy, true);
    assert.deepEqual(commands(f), []);
    unit.frame('A>');
    await promptly(pending);
    await Promise.all(f.listeners);
    assert.deepEqual(commands(f), [['command', 'COWGOL\r']]);
    assert.equal(f.editor.state.busy, false);
    assert.equal(f.editor._cowgolCompile, null);
    assert.equal(f.details[0].launchControl.isCurrent, null);
    assert.equal(f.details[0].launchControl.signal, null);
    assert.equal(f.details[0].launchControl.cancelled, false);
    revocations.source(f);
    f.editor.stopCodeRun();
    unit.frame('A>');
    assert.equal(unit.isDestroyed(), false, 'source ownership ended after launch');
    assert.equal(commands(f).length, 1);
    unit.runner.destroy();
});

test('a replaced delayed attachment cannot tear down the newer runner or queue its old command', async () => {
    const f = fixture({hold: 'target-create'}), pending = f.start();
    await f.entered.promise;
    const newer = {slotId: 'cpmsys', bytes: Uint8Array.of(0xc9), kind: 'z80',
        profile: 'cpm-system', name: 'NEW.COM', cpmLaunch: 'NEW', widgets: []};
    await f.panel._onMediaLoad({detail: newer});
    const current = f.units.at(-1);
    const owner = f.panel._runnerPromise;
    assert.equal(current.runner.state().phase, 'running');
    f.release.resolve();
    await promptly(pending);
    await Promise.all(f.listeners);
    assert.equal(f.panel._runnerPromise, owner);
    assert.equal(current.isDestroyed(), false);
    current.frame('A>');
    assert.deepEqual(commands(f), [['command', 'NEW\r']]);
    current.runner.destroy();
});

test('a stopped lazy runner cannot acquire and cancel a newer source-owned launch', async () => {
    const f = fixture({hold: 'runner-import'}), first = f.start();
    await f.entered.promise;
    f.editor.stopCodeRun();
    await promptly(first);
    const second = f.start();
    await f.scheduled.promise;
    const newer = f.units[0];
    const owner = f.panel._runnerPromise;
    f.release.resolve();
    await f.listeners[0];
    assert.equal(f.panel._runnerPromise, owner);
    assert.equal(f.details[0].launchControl.cancelled, true);
    assert.equal(f.details[1].launchControl.cancelled, false);
    assert.equal(newer.isDestroyed(), false);
    newer.frame('A>');
    await promptly(second);
    await Promise.all(f.listeners);
    assert.deepEqual(commands(f), [['command', 'COWGOL\r']]);
    assert.equal(newer.isDestroyed(), false);
    newer.runner.destroy();
});
