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

const KINDS = ['emulator', 'avr8js', 'atmega2560', 'attiny85', 'attiny88', 'rp2040js', 'stm32f0', 'labwired',
    'z80', 'eater6502', 'riscv32', 'i8086', 'i80386', 'cp1'];

test('the green flag\'s author rule is start()\'s own split, for every kind, media and firmware', () => {
    // start() picks `built`: null for an interpreter or boot-media machine,
    // the user's firmware, else build() — the project's own blocks. Its
    // expression is evaluated here as written, so the two cannot drift.
    const runner = read('lib/bw-debug/debug-runner.js');
    // Delimited by the two fixed texts around the condition (indexOf, not a lazy
    // capture, which a nested parenthesis would cut short).
    const head = 'const built = ';
    const tail = ' ? null';
    const at = runner.indexOf(head);
    const end = runner.indexOf(tail, at);
    assert.ok(at > 0 && end > at, 'start()\'s choice of what to run moved — re-read it before trusting the author rule');
    const condition = runner.slice(at + head.length, end);
    assert.match(runner.slice(end), /^ \? null\s*: userFirmware \? await builtFromUserFirmware\(selectedKind\)\s*: await build\(\);/,
        'start() no longer ends in firmware-else-build — re-read it');
    // eslint-disable-next-line no-new-func
    const startCompiles = new Function('selectedKind', 'bootMedia', 'userFirmware',
        `return (${condition}) ? false : userFirmware ? false : true;`);
    let compared = 0;
    for (const selectedKind of KINDS) {
        for (const bootMedia of [null, {name: 'rom'}]) {
            for (const userFirmware of [null, {name: 'fw.hex'}]) {
                assert.equal(runnerCompilesProjectBlocks({selectedKind, bootMedia, userFirmware}),
                    startCompiles(selectedKind, bootMedia, userFirmware), `${selectedKind} media=${!!bootMedia} fw=${!!userFirmware}`);
                compared++;
            }
        }
    }
    assert.equal(compared, KINDS.length * 4);
    // The cases the browser measured, named.
    assert.equal(runnerCompilesProjectBlocks({selectedKind: 'emulator'}), true, 'an STC12 block program is the VM\'s');
    assert.equal(runnerCompilesProjectBlocks({selectedKind: 'eater6502'}), false, 'a 6502 bench runs its ROM, not the blocks');
    assert.equal(runnerCompilesProjectBlocks({selectedKind: 'avr8js', userFirmware: {}}), false, 'loaded firmware is the runner\'s');
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
    // start({paused:true}) may pause the freshly reset target before rebasing;
    // no other statement may intervene before the board's clock is aligned.
    assert.match(runner,
        /session\.start\(\);\s*(?:if \(paused\) session\.pause\(\);\s*)?boardBaseNs = boardTimeBase\(board, target\);/);
    assert.equal((runner.match(/advanceTo\(target\.timeNs\(\) \+ boardBaseNs\)/g) || []).length, 2);
    assert.doesNotMatch(runner, /advanceTo\(target\.timeNs\(\)\)/, 'a pump that advances without the base');
});
