// The real generator and GUI adapter run the packaged C/WASM interpreter.
// Requires root npm dependencies and npm run build:wasm; never silently skips.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test, {before, after} from 'node:test';
import SB3Creator from '../../../overlay/scratch-gui/src/lib/sb3-creator.js';
import basicToPseudocode from '../../../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {createCrispBasicRunner} from '../../../overlay/scratch-gui/src/lib/crispbasic-runner.js';
import {VduDecoder} from 'bw-board/vdu-decoder.js';
import {packageCrispBasic} from '../../../scripts/package-crispbasic.mjs';

let directory, assetBaseURL;
before(async () => {
    directory = await mkdtemp(fileURLToPath(new URL('../.build/brickwright-', import.meta.url)));
    await packageCrispBasic({destination: directory});
    assetBaseURL = pathToFileURL(directory + '/').href;
});
after(async () => { if (directory) await rm(directory, {recursive: true, force: true}); });

function runnerFor (t, onEvent) {
    const events = [];
    const runner = createCrispBasicRunner({assetBaseURL, onEvent: event => { events.push(event); onEvent?.(event, runner); }});
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
