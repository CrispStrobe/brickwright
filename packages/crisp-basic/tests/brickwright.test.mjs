// The real generator and GUI adapter run the packaged C/WASM interpreter.
// Requires root npm dependencies and npm run build:wasm; never silently skips.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test, {before, after} from 'node:test';
import SB3Creator from '../../../overlay/scratch-gui/src/lib/sb3-creator.js';
import basicToPseudocode from '../../../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {createCrispBasicRunner} from '../../../overlay/scratch-gui/src/lib/crispbasic-runner.js';
import {createCrispBasicBoardHost} from '../../../overlay/scratch-gui/src/lib/crispbasic-board-host.js';
import {VduDecoder} from 'bw-board/vdu-decoder.js';
import {packageCrispBasic} from '../../../scripts/package-crispbasic.mjs';
import {createCrispBasicCircuitFixture} from '../../../scripts/lib/crispbasic-circuit-fixture.mjs';

let directory, assetBaseURL;
before(async () => {
    directory = await mkdtemp(fileURLToPath(new URL('../.build/brickwright-', import.meta.url)));
    await packageCrispBasic({destination: directory});
    assetBaseURL = pathToFileURL(directory + '/').href;
});
after(async () => { if (directory) await rm(directory, {recursive: true, force: true}); });

function runnerFor (t, onEvent, options = {}) {
    const events = [];
    const runner = createCrispBasicRunner({...options, assetBaseURL,
        onEvent: event => { events.push(event); onEvent?.(event, runner); }});
    t.after(() => runner.dispose());
    return {runner, events, view: () => events.filter(event => event.type === 'view').at(-1)};
}

for (const fixture of [
    {name: 'structured repeat', source: 'WHEN flag clicked:\n  print "HELLO"\n  print (2 + 2)\n  REPEAT 3:\n    print "X"',
        expected: 'HELLO\r\n         4\r\nX\r\nX\r\nX\r\n'},
    {name: 'generated counter', source: 'WHEN flag clicked:\n  set n to 0\n  REPEAT 4:\n    change n by 1\n    print n',
        expected: '         1\r\n         2\r\n         3\r\n         4\r\n'}
]) {
    test(`blocks -> generated BBC source -> packaged WASM: ${fixture.name}`, async t => {
        const creator = new SB3Creator(); creator.parse(fixture.source);
        const generated = creator.generateBASIC(creator.project, {profile: 'bbc', lineNumbers: false});
        assert.equal(generated.ok, true, JSON.stringify(generated.reasons));
        const f = runnerFor(t);
        const result = await f.runner.run(generated.basic, {filename: 'generated.bas'});
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.text, fixture.expected);
        assert.equal(f.view().output, fixture.expected);
        assert.equal(f.view().rawOutput, fixture.expected);
    });
}

test('real graphics commands reach the existing VDU decoder with fixed expected coordinates', async t => {
    const f = runnerFor(t);
    const result = await f.runner.run('MODE 0\nGCOL 0,1\nMOVE 0,0\nDRAW 320,256\nEND\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual([...result.output], [22, 0, 18, 0, 1, 25, 4, 0, 0, 0, 0, 25, 5, 64, 1, 0, 1]);
    assert.deepEqual(new VduDecoder().pushAll(result.output), [
        {type: 'mode', n: 0}, {type: 'gcol', mode: 0, colour: 1},
        {type: 'move', mode: 4, x: 0, y: 0}, {type: 'draw', mode: 5, x: 320, y: 256}
    ]);
    assert.equal(f.view().output, '');
    assert.equal(f.view().rawOutput, result.text);
});

test('delayed interactive input survives recursive BASIC frames through the app adapter', async t => {
    const f = runnerFor(t, (event, runner) => {
        if (event.type === 'input') setTimeout(() => { runner.writeInput('awake\n'); runner.endInput(); }, 20);
    });
    const result = await f.runner.run(`PROCouter
END
DEF PROCouter
LOCAL answer$
answer$ = FNask(4)
PRINT answer$
ENDPROC
DEF FNask(n%)
LOCAL reply$
IF n% > 0 THEN =FNask(n%-1)
INPUT "" reply$
=reply$
`, {interactive: true});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '\r\nawake\r\n');
    assert.equal(f.view().inputMethod, null);
    assert.equal(f.view().output, result.text);
});

test('numbered text keeps original filename and physical editor line on errors', async t => {
    const f = runnerFor(t);
    const result = await f.runner.run('100 REM before\n\n450 ERROR 100,"mapped"\n', {filename: 'lesson.bas'});
    assert.equal(result.status, 'error');
    assert.deepEqual(result.error, {kind: 'basic', code: 100, message: 'mapped', basicLine: 450, line: 3, filename: 'lesson.bas'});
});

test('reset cancels blocked input and the same adapter starts a clean real instance', async t => {
    let prompt;
    const prompted = new Promise(resolve => { prompt = resolve; });
    const f = runnerFor(t, event => { if (event.type === 'input') prompt(); });
    const pending = f.runner.run('VDU 25,4,1\nINPUT "" a$\nEND\n', {interactive: true});
    await prompted;
    await f.runner.reset();
    assert.equal((await pending).status, 'cancelled');
    assert.equal(f.view().rawOutput, '');
    const next = await f.runner.run('PRINT "fresh"\nEND\n');
    assert.equal(next.status, 'completed', JSON.stringify(next.error));
    assert.equal(f.view().output, 'fresh\r\n');
    assert.equal(f.runner.state, 'idle');
});

test('parent deadline stops tight loops and bounded output remains bounded in the GUI view', async t => {
    const f = runnerFor(t);
    assert.equal((await f.runner.run('REPEAT\nUNTIL FALSE\n', {timeoutMs: 150})).status, 'timeout');
    const result = await f.runner.run('REPEAT\nPRINT "abcdef"\nUNTIL FALSE\n', {maxOutputBytes: 137});
    assert.equal(result.status, 'output-limit');
    assert.equal(result.output.length, 137);
    assert.equal(f.view().rawOutput.length, 137);
    assert.equal(f.runner.state, 'idle');
});

test('unsupported source-to-block conversion remains a warning even when full BASIC runs', async t => {
    const source = 'PRINT FNtwice(21)\nEND\nDEF FNtwice(n%)\n=n%*2\n';
    const converted = basicToPseudocode(source);
    assert.ok(converted.warnings.length, 'the subset reader must not claim a full-language round trip');
    const {runner} = runnerFor(t);
    const result = await runner.run(source);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '        42\r\n');
});

test('the UI adapter retains restricted SYS refusal and reports unavailable graphics queries', async t => {
    const f = runnerFor(t);
    for (const source of ['SYS "system", "ignored"\n', 'PRINT POINT(0,0)\n']) {
        const result = await f.runner.run(source);
        assert.equal(result.status, 'error');
        assert.match(result.error.message, /unavailable|not available|restricted|unsupported/i);
    }
    assert.equal(f.runner.capabilities.circuitPins, false);
    assert.equal(f.runner.capabilities.graphicsQueries, false);
    assert.equal(f.runner.capabilities.sourceDebugger, false);
});

function circuitFor (t) {
    const fixture = createCrispBasicCircuitFixture();
    const eventTarget = new EventTarget();
    const ownership = [];
    const listener = event => {
        ownership.push(event.detail);
        // The Node integration supplies the Designer acknowledgement; the
        // browser suite exercises its real Circuit tab event handler too.
        event.detail.ready?.();
    };
    eventTarget.addEventListener('bw-circuit-clock-owner', listener);
    t.after(() => eventTarget.removeEventListener('bw-circuit-clock-owner', listener));
    return {...fixture, eventTarget, ownership, circuit: {runtime: fixture.runtime, eventTarget}};
}

test('packaged BASIC drives a real Uno LED and senses its circuit button at explicit simulated time', async t => {
    const c = circuitFor(t);
    let paused;
    const f = runnerFor(t, (event, runner) => {
        if (event.type !== 'input') return;
        paused = {currentMa: -c.board.branchCurrent('led', 'anode') * 1000,
            outputVolts: c.board.readAnalog('d13'), timeNs: c.board.timeNs,
            sense: c.board.readPin('d2'), clockOwned: Boolean(c.board._externalClock)};
        c.board.setControl('button', 1);
        runner.writeInput('continue\n');
    }, {circuit: c.circuit});
    const result = await f.runner.run(`PROCpinMode(13,"output")
PROCdigitalWrite(13,1)
PROCpinMode(2,"input-pullup")
PRINT STR$(FNdigitalRead(2))
PROCdelay(25)
PRINT STR$(FNmillis)
INPUT "" a$
PRINT STR$(FNdigitalRead(2))
PROCdigitalWrite(13,0)
END
`, {filename: 'circuit.bas', interactive: true});
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '1\r\n25\r\n\r\n0\r\n');
    assert.ok(paused.currentMa > 10 && paused.currentMa < 16,
        `5 V through 220 ohms and a red LED produced ${paused.currentMa} mA`);
    assert.ok(paused.outputVolts > 4.5 && paused.outputVolts < 5);
    assert.equal(paused.timeNs, 25000000n);
    assert.equal(paused.sense, 1);
    assert.equal(paused.clockOwned, true);
    assert.equal(c.board.timeNs, 25000000n);
    assert.ok(c.board.getPinStates().every(pin => pin.mode === 'input'));
    assert.equal(c.board.powered, false);
    assert.equal(c.board._externalClock, null);
    assert.equal(c.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(c.ownership[0].board, c.board);
    assert.equal(c.ownership.at(-1).board, null);
});

test('a fresh circuit run restarts FNmillis while retaining the active board clock and button state', async t => {
    const c = circuitFor(t);
    c.board.setControl('button', 1);
    const f = runnerFor(t, undefined, {circuit: c.circuit});
    const source = 'PROCpinMode(2,"input-pullup")\nPRINT STR$(FNmillis)+":"+STR$(FNdigitalRead(2))\nPROCdelay(7)\nPRINT STR$(FNmillis)\nEND\n';
    for (let run = 1; run <= 2; run++) {
        const result = await f.runner.run(source);
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.text, '0:0\r\n7\r\n');
        assert.equal(c.board.timeNs, BigInt(run) * 7000000n);
        assert.equal(c.board._externalClock, null);
        assert.equal(c.runtime.bwCrispBasicSimulation, undefined);
    }
});

test('Stop during a real solver delay abandons deferred work and releases the circuit before resolving', async t => {
    const c = circuitFor(t);
    let progress;
    const progressed = new Promise(resolve => { progress = resolve; });
    const onChange = () => { if (c.board.timeNs > 0n) progress(); };
    c.board.onChange(onChange);
    t.after(() => c.board.offChange(onChange));
    const f = runnerFor(t, undefined, {circuit: c.circuit});
    const pending = f.runner.run('PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nPROCdelay(50000)\nPRINT "late"\nEND\n');
    await Promise.race([progressed, pending.then(result => { throw new Error(`Run stopped before progress: ${JSON.stringify(result)}`); })]);
    f.runner.cancel();
    const result = await pending;
    assert.equal(result.status, 'cancelled', JSON.stringify(result.error));
    assert.equal(result.text, '');
    const stopped = c.board.timeNs;
    assert.ok(stopped > 0n && stopped < 50000000000n);
    assert.equal(c.board._externalClock, null);
    assert.equal(c.runtime.bwCrispBasicSimulation, undefined);
    assert.ok(c.board.getPinStates().every(pin => pin.mode === 'input'));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(c.board.timeNs, stopped, 'a cancelled delay continued to advance the board');
});

test('circuit time ceilings remain parent-owned even with a BASIC error handler', async t => {
    const c = circuitFor(t);
    const f = runnerFor(t, undefined, {circuit: c.circuit});
    const result = await f.runner.run('ON ERROR PRINT "caught":END\nPROCdelay(60001)\nPRINT "late"\nEND\n');
    assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
    assert.equal(result.text, '');
    assert.equal(c.board.timeNs, 0n);
    assert.equal(c.board._externalClock, null);
    assert.equal(c.runtime.bwCrispBasicSimulation, undefined);
});

test('real solver work exhaustion terminates packaged WASM outside BASIC error handling', async t => {
    const {board} = createCrispBasicCircuitFixture();
    const runtime = await import(new URL('browser.mjs', assetBaseURL));
    let host;
    const session = runtime.createWasmSession({
        moduleURL: new URL('wasm/crispbasic.mjs', assetBaseURL).href,
        workerURL: new URL('src/wasm-worker.mjs', assetBaseURL).href,
        simulation: {createHost ({signal}) {
            host = createCrispBasicBoardHost({board, signal, SimulationError: runtime.SimulationError,
                maxSolverSteps: 2, maxStepsPerBatch: 1});
            return host;
        }}
    });
    t.after(() => session.dispose());
    const result = await session.run('ON ERROR PRINT "caught":END\nPROCdelay(3)\nPRINT "late"\nEND\n');
    assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
    assert.equal(result.error.kind, 'simulation');
    assert.equal(result.error.code, 'solver-limit');
    assert.equal(result.text, '');
    assert.equal(board.timeNs, 2000000n, 'the parent retains only the two completed solver steps');
    assert.equal(host.solverSteps, 2);
    assert.equal(host.state, 'disposed');
    assert.deepEqual(host.trace, [], 'an incomplete delay is not reported as completed');
    assert.equal(board._externalClock, null);
    assert.equal(board.powered, false);
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
});

test('Stop-all from a solver observer releases a real BASIC write after the clock call unwinds', async t => {
    const c = circuitFor(t);
    let stopped = false;
    const onChange = event => {
        if (!stopped && event.type === 'pin' && event.detail?.mode === 'pushpull' && event.detail.driveHigh) {
            stopped = true;
            c.runtime.emit('PROJECT_STOP_ALL');
        }
    };
    c.board.onChange(onChange);
    t.after(() => c.board.offChange(onChange));
    const f = runnerFor(t, undefined, {circuit: c.circuit});
    const result = await f.runner.run('PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nPRINT "late"\nEND\n');
    assert.equal(stopped, true);
    assert.equal(result.status, 'cancelled', JSON.stringify(result.error));
    assert.equal(result.text, '');
    assert.equal(c.board._externalClock, null);
    assert.equal(c.board.powered, false);
    assert.ok(c.board.getPinStates().every(pin => pin.mode === 'input'));
    assert.equal(c.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.events.filter(event => event.type === 'result').length, 1);
    assert.equal(f.runner.state, 'idle');
});

test('a foreign GPIO write cancels blocked BASIC and releases its other pins without overwriting the foreign pin', {timeout: 5000}, async t => {
    const c = circuitFor(t);
    let prompt;
    const prompted = new Promise(resolve => { prompt = resolve; });
    const f = runnerFor(t, event => { if (event.type === 'input') prompt(); }, {circuit: c.circuit});
    const pending = f.runner.run('PROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nINPUT "" a$\nPRINT "late"\nEND\n',
        {interactive: true});
    await Promise.race([prompted, pending.then(result => { throw new Error(`Run stopped before input: ${JSON.stringify(result)}`); })]);
    c.board.setPin('d2', 'pushpull', true);
    const result = await pending;
    assert.equal(result.status, 'cancelled', JSON.stringify(result.error));
    assert.equal(result.text, '');
    const pins = c.board.getPinStates();
    assert.deepEqual(pins.find(pin => pin.pin === 'd2'), {pin: 'd2', mode: 'pushpull', driveHigh: true});
    assert.deepEqual(pins.find(pin => pin.pin === 'd13'), {pin: 'd13', mode: 'input', driveHigh: false});
    assert.equal(c.board._externalClock, null);
    assert.equal(c.runtime.bwCrispBasicSimulation, undefined);
    assert.equal(f.runner.state, 'idle');
});
