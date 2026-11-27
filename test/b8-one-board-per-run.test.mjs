/**
 * Task B8 of docs/OPEN-TASKS-2026-09-29.md — two runtimes, one display.
 *
 * MEASURED in a real browser on production before the fix (54-motor-driver,
 * three green flags on one page, every consumer's board tagged by identity):
 * every green flag ALSO started the Debug pane's runner, which compiled the
 * same blocks the Scratch VM was running and ran them on a board of its own.
 * Once it had built, the designer displayed that board; it was never handed
 * back, so from the second flag on the VM's blocks wrote the designer's board
 * (frozen at 500 ms of board time, never cleared or clocked again) while the
 * display showed the runner's, which also froze for ~3 s at the start of run 3
 * (its clock restarted at zero under a board that had not).
 *
 * THE RULE NOW: one run, one runtime, one board. The green flag starts the
 * runner only when it runs something the VM does not (a machine bench, boot
 * media, the user's firmware); the runner's board is shown only while that
 * runner's run lives; a board that outlives a run keeps its clock moving
 * forward. The browser gate is scripts/verify-green-flag-first-write.mjs (now
 * several consecutive runs on one page); these are the pieces it rests on,
 * each executed rather than described.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {BoardImpl} from 'bw-board';

import {runnerCompilesProjectBlocks, boardTimeBase} from
    '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js';
import {applyBenchTemperature} from '../overlay/scratch-gui/src/lib/bench-temperature.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUI = path.join(ROOT, 'overlay/scratch-gui/src');
const read = rel => readFileSync(path.join(GUI, rel), 'utf8');

/** A class method's source, `    name (args) {` to its closing brace at the same indent. */
const method = (source, header) => {
    const start = source.indexOf(`    ${header} {`);
    assert.ok(start >= 0, `method ${header} is gone`);
    const end = source.indexOf('\n    }\n', start);
    return source.slice(source.indexOf('{', start) + 1, end);
};

test('the green flag and debugger share the same program ownership rule', () => {
    const runner = read('lib/bw-debug/debug-runner.js');
    assert.match(runner, /const built = runnerCompilesProjectBlocks\(\{selectedKind, bootMedia}\)/);
    for (const kind of ['cardiac', 'cp1', 'z80', 'eater6502', 'riscv32', 'i8086', 'i80286', 'i80386']) {
        assert.equal(runnerCompilesProjectBlocks({selectedKind: kind}), false, kind);
        assert.equal(runnerCompilesProjectBlocks({selectedKind: kind, bootMedia: {name: 'ROM'}}), false, kind);
    }
    for (const kind of ['emulator', 'avr8js', 'atmega2560', 'attiny85', 'attiny88', 'rp2040js',
        'stm32f0', 'stm32g0', 'esp8266', 'labwired', 'serial']) {
        assert.equal(runnerCompilesProjectBlocks({selectedKind: kind}), true, kind);
        assert.equal(runnerCompilesProjectBlocks({selectedKind: kind, userFirmware: {name: 'firmware'}}), false, kind);
    }
    assert.equal(runnerCompilesProjectBlocks({selectedKind: 'rp2040js', bootMedia: {name: 'UF2'}}), false);
});

test('the Debug pane: a green flag starts the runner only when it is the run\'s author, else ends its session', async () => {
    const panel = read('components/tw-pseudocode/debug-panel.jsx');
    const sync = method(panel, 'syncProjectTokens (prevProps, initial)');
    assert.match(sync, /this\.onGreenFlag\(\);/);
    assert.doesNotMatch(sync, /this\.onStart\(\);/, 'the token no longer starts a second copy of the VM\'s program');
    const raw = method(panel, 'async onGreenFlag ()');
    const importAt = raw.indexOf('await import(');
    const importEnd = raw.indexOf("debug-runner.js');", importAt);
    assert.ok(importAt > 0 && importEnd > importAt, 'onGreenFlag no longer imports the runner module');
    const body = raw.slice(0, importAt) + 'await __import();' + raw.slice(importEnd + "debug-runner.js');".length);
    const run = async ({kind, device, bootMedia = null, userFirmware = null}) => {
        const calls = [];
        const self = {
            props: {vm: {runtime: {stc: {device}}}}, state: {kind},
            _bootMedia: bootMedia, _userFirmware: userFirmware,
            onStop: () => calls.push('stop'), onStart: () => calls.push('start')
        };
        const {selectDebugTargetKind} = await import('../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js');
        // eslint-disable-next-line no-new-func
        const fn = new Function('__import', `return (async function () {${body}}).call(this);`);
        await fn.call(self, async () => ({runnerCompilesProjectBlocks, selectDebugTargetKind}));
        return calls;
    };
    assert.deepEqual(await run({kind: 'emulator', device: 'STC12C5A60S2'}), ['stop'], 'STC12 blocks: the VM runs them; any debug session ends');
    assert.deepEqual(await run({kind: 'emulator', device: 'arduino-uno'}), ['stop'], 'AVR blocks: the same');
    assert.deepEqual(await run({kind: 'eater6502', device: 'eater6502'}), ['start'], 'a machine bench still starts on the flag');
    assert.deepEqual(await run({kind: 'i8086', device: 'i8086', bootMedia: {name: 'dos'}}), ['start']);
    assert.deepEqual(await run({kind: 'emulator', device: 'STC12C5A60S2', userFirmware: {name: 'a.hex'}}), ['start'], 'loaded firmware still starts');
});

test('Circuit Sim starts wired blocks and supports a second run after stop', () => {
    const source = read('components/tw-pseudocode/circuit-tab.jsx');
    assert.match(source, /onSimulationStart=\{this\.handleSimulationStart\}/);
    const driving = source.match(/const stcDrives = ([\s\S]*?);/)[1];
    const actions = [];
    const window = {dispatchEvent: event => actions.push(event.type)};
    const run = new Function('window', 'CustomEvent', `const stcDrives = ${driving};
        ${method(source, 'handleSimulationStart ()')}`);
    const vm = {
        runtime: {},
        start: () => actions.push('vm-start'),
        greenFlag: () => actions.push('vm-flag'),
        stopAll: () => actions.push('vm-stop')
    };
    const circuit = {
        props: {vm},
        state: {stc: {device: 'stc12c5a60s2', pins: [{name: 'button'}]}},
        handleProjectStart: () => actions.push('simulation-only')
    };
    const simulate = () => run.call(circuit, window, CustomEvent);
    simulate();
    vm.stopAll();
    simulate();
    assert.deepEqual(actions, [
        'vm-start', 'bw-green-flag', 'vm-flag', 'vm-stop',
        'vm-start', 'bw-green-flag', 'vm-flag'
    ]);

    for (const state of [
        {circuitData: {fileOnly: true}},
        {machineBooted: true},
        {stc: {device: 'microbit', pins: [{name: 'button'}]}},
        {stc: null}
    ]) {
        actions.length = 0;
        run.call({...circuit, state: {...circuit.state, ...state}}, window, CustomEvent);
        assert.deepEqual(actions, ['simulation-only']);
    }
});

test('the circuit tab shows a runner\'s board only while its run lives', () => {
    const tab = read('components/tw-pseudocode/circuit-tab.jsx');
    const body = method(tab, 'handleRunnerChange (runner, ui)');
    // eslint-disable-next-line no-new-func
    const handle = new Function('advanceDebugPhase', 'shouldRefreshDesignerDebugState', 'DEBUG_LIVE_REFRESH_MS',
        'applyBenchTemperature', `return function (runner, ui) {${body}};`)(
        () => ({next: null, dispatch: false}), () => true, 250, applyBenchTemperature);
    const runnerBoard = {id: 'runner'};
    const host = (state) => {
        const self = {state: {...state}, _markReactUpdate () {}, labelForBlock: () => 'x',
            releaseEsp32S040Input () {}, // This fixture owns an ordinary board with no touch input.
            setState (patch) { Object.assign(self.state, typeof patch === 'function' ? patch(self.state) : patch); }};
        return self;
    };
    const runner = {board: () => runnerBoard};
    const shown = host({board: null, debugState: null});
    handle.call(shown, runner, {phase: 'running', session: {halted: false, tasks: []}});
    assert.equal(shown.state.board, runnerBoard, 'a live run lends its board to the display');
    for (const phase of ['idle', 'error']) {
        const self = host({board: runnerBoard, debugState: {halted: false}});
        handle.call(self, runner, {phase});
        assert.equal(self.state.board, null, `${phase}: the display is handed back`);
        assert.equal(self.state.debugState, null);
    }
    // A runner torn down without a stop (new program, reboot, unmount).
    const gone = method(tab, 'handleRunnerGone ()');
    const self = host({board: runnerBoard, debugState: {halted: true}});
    // eslint-disable-next-line no-new-func
    new Function(gone).call(self);
    assert.equal(self.state.board, null);
    const panel = read('components/tw-pseudocode/debug-panel.jsx');
    assert.match(method(panel, '_teardownRunner ()'), /this\.props\.onRunnerGone\(\)/);
    assert.match(tab, /onRunnerGone=\{this\.handleRunnerGone\}/);
});

test('a board that outlives a run keeps its clock moving when the target\'s restarts at zero', () => {
    // The runner's own board after a stop, or the designer's board a machine
    // bench attaches to: both have lived; the restarted target has not.
    const mk = () => {
        const b = new BoardImpl(5.0);
        b.setNetlist([{id: 'R', kind: 'resistor', params: {ohms: 1000}, terminals: ['a', 'b']}],
            [{id: 'n1', terminals: [{part: 'R', terminal: 'a'}]}, {id: 'n2', terminals: [{part: 'R', terminal: 'b'}]}]);
        b.setPower(true);
        return b;
    };
    let targetNs = 0n;
    const target = {timeNs: () => targetNs};
    const board = mk();
    board.advanceTo(1_200_000_000n); // the first run's 1.2 s
    targetNs = 0n;                    // session.start(): target.reset()
    const base = boardTimeBase(board, target);
    assert.equal(base, 1_200_000_000n);
    targetNs = 50_000_000n;           // one pump of the second run
    board.advanceTo(targetNs + base);
    assert.equal(board.timeNs, 1_250_000_000n, 'the board advances with the restarted target');
    // Without the base — the defect — advanceTo ignores a time behind the board.
    const frozen = mk();
    frozen.advanceTo(1_200_000_000n);
    frozen.advanceTo(50_000_000n);
    assert.equal(frozen.timeNs, 1_200_000_000n, 'the frozen display the browser measured');
    // A fresh board and a board behind its target need no base.
    assert.equal(boardTimeBase(mk(), {timeNs: () => 0n}), 0n);
    assert.equal(boardTimeBase({timeNs: 5n}, {timeNs: () => 9n}), 0n);
    assert.equal(boardTimeBase(null, target), 0n);
    // And the runner uses it at every (re)start and on both of its clocks.
    const runner = read('lib/bw-debug/debug-runner.js');
    const startSession = runner.indexOf('session.start();');
    const baseAfterReset = runner.indexOf('boardBaseNs = boardTimeBase(board, target);', startSession);
    const publishRunning = runner.indexOf("setStatus(paused ? 'paused' : 'running');", startSession);
    assert.ok(startSession >= 0 && baseAfterReset > startSession && publishRunning > baseAfterReset,
        'the runner rebases the board after starting the session and before publishing it as running');
    assert.equal((runner.match(/advanceTo\(target\.timeNs\(\) \+ boardBaseNs\)/g) || []).length, 2);
    assert.doesNotMatch(runner, /advanceTo\(target\.timeNs\(\)\)/, 'a pump that advances without the base');
});
