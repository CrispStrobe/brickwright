// Execute both sides of the explicit portable source round trip with the real
// C/WASM core. Missing build artifacts fail qualification; nothing is skipped.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import SB3Creator from '../../overlay/scratch-gui/src/lib/sb3-creator.js';
import basicToPseudocode from '../../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {
    isCrispBasicPseudocode, validateCrispBasicPseudocode,
    isCrispBasicProject, validateCrispBasicProject
} from '../../overlay/scratch-gui/src/lib/sb3-creator-crispbasic-mode.js';
import {createWasmSession} from '../../packages/crisp-basic/browser.mjs';
import {createSimulationHost} from '../../packages/crisp-basic/src/simulation-host.mjs';

const moduleURL = new URL('../../packages/crisp-basic/.build/wasm/crispbasic.mjs', import.meta.url);
const portable = {profile: 'bbc', mode: 'crispbasic'};
const numberOutput = value => `${String(value).padStart(10)}\r\n`;
const sequenced = events => events.map((event, index) => ({sequence: index + 1, ...event}));

function generate(source, lineNumbers, marked = false) {
    if (marked) {
        assert.equal(isCrispBasicPseudocode(source), true);
        assert.equal(validateCrispBasicPseudocode(source), true);
    }
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, [], 'round-trip source must parse without degradations');
    if (marked) {
        assert.equal(isCrispBasicProject(creator.project), true);
        assert.equal(validateCrispBasicProject(creator.project), true);
    }
    const generated = creator.generateBASIC(undefined, {...portable, lineNumbers});
    assert.equal(generated.ok, true, JSON.stringify(generated));
    return generated.basic;
}

function regenerate(source, lineNumbers) {
    const read = basicToPseudocode(source, {mode: 'crispbasic'});
    assert.equal(read.ok, true, JSON.stringify(read));
    assert.deepEqual(read.reasons, []);
    assert.equal(read.capabilities.requiredRuntime, 'crispbasic');
    assert.equal(read.capabilities.blocks, false);
    return generate(read.pseudocode, lineNumbers, true);
}

async function execute(source, {pressAtMs} = {}) {
    let host;
    const session = createWasmSession({moduleURL, timeoutMs: 10000, maxOutputBytes: 8192,
        simulation: {maxRequests: 200, createHost() {
            host = createSimulationHost({pins: [2, 13], maxTimeMs: 2000, maxTraceEvents: 200});
            if (pressAtMs !== undefined) host.scheduleInput(2, 0, pressAtMs);
            return host;
        }}
    });
    try {
        const result = await session.run(source);
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.exitCode, 0);
        assert.equal(host.state, 'disposed', 'every run releases its fresh simulation host');
        const output = Buffer.from(result.output);
        assert.deepEqual(output, Buffer.from(result.text, 'latin1'), 'text preserves every raw VDU byte');
        return {output, text: result.text, trace: host.trace};
    } finally {
        await session.dispose();
    }
}

async function equivalent(original, lineNumbers, options) {
    const regenerated = regenerate(original, lineNumbers);
    const before = await execute(original, options);
    const after = await execute(regenerated, options);
    assert.deepEqual(after, before, 'raw output, Latin-1 text and the entire ordered pin trace must survive');
    return before;
}

test('portable round-trip qualification requires a real, valid WASM artifact', async () => {
    await readFile(moduleURL);
    assert.equal(WebAssembly.validate(await readFile(new URL('../../packages/crisp-basic/.build/wasm/crispbasic.wasm', import.meta.url))), true);
});

const pinSource = `DEVICE ARDUINO-UNO
PIN led = D13 OUTPUT ACTIVE LOW
PIN button = D2 INPUT ACTIVE LOW
GLOBAL n
WHEN flag clicked:
  set n to 0
  REPEAT UNTIL read button:
    toggle led
    change n by 1
    wait 0.001 seconds
  IF read button THEN:
    print 11
  ELSE:
    print 22
  set led to read button
  print timer
  print n`;

const expectedPinTrace = sequenced([
    {atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
    {atMs: 0, type: 'pin-mode', pin: 2, mode: 'input-pullup'},
    {atMs: 0, type: 'digital-read', pin: 2, value: 1},
    {atMs: 0, type: 'digital-toggle', pin: 13, value: 1},
    {atMs: 1, type: 'delay', fromMs: 0, milliseconds: 1},
    {atMs: 1, type: 'digital-read', pin: 2, value: 1},
    {atMs: 1, type: 'digital-toggle', pin: 13, value: 0},
    {atMs: 2, type: 'delay', fromMs: 1, milliseconds: 1},
    {atMs: 2, type: 'digital-read', pin: 2, value: 1},
    {atMs: 2, type: 'digital-toggle', pin: 13, value: 1},
    {atMs: 3, type: 'input', pin: 2, value: 0},
    {atMs: 3, type: 'delay', fromMs: 2, milliseconds: 1},
    {atMs: 3, type: 'digital-read', pin: 2, value: 0},
    {atMs: 3, type: 'digital-read', pin: 2, value: 0},
    {atMs: 3, type: 'digital-read', pin: 2, value: 0},
    {atMs: 3, type: 'digital-write', pin: 13, value: 1}
]);

const canvasSource = `WHEN flag clicked:
  clear
  set pen color to 3
  pen up
  go to x: -10 y: 20
  pen down
  go to x: 100 y: 30
  set x to 12
  set y to -5`;

for (const lineNumbers of [false, true]) {
    const form = lineNumbers ? 'numbered' : 'structured';
    test(`${form} active-low sensing, latches, control flow and virtual time round-trip exactly`, async () => {
        const result = await equivalent(generate(pinSource, lineNumbers), lineNumbers, {pressAtMs: 3});
        assert.equal(result.text, numberOutput(11) + numberOutput(0.003) + numberOutput(3));
        assert.deepEqual(result.trace, expectedPinTrace);
    });

    test(`${form} canvas movement, color and pen state retain exact binary VDU output`, async () => {
        const result = await equivalent(generate(canvasSource, lineNumbers), lineNumbers);
        assert.deepEqual(result.output, Buffer.from([
            16, 18, 0, 4,                       // CLG and GCOL 0,4
            25, 4, 88, 2, 80, 2,              // MOVE 600,592
            25, 5, 16, 4, 120, 2,             // DRAW 1040,632
            25, 5, 176, 2, 120, 2,            // DRAW 688,632
            25, 5, 176, 2, 236, 1             // DRAW 688,492
        ]));
        assert.deepEqual(result.trace, []);
    });
}

test('handwritten BASIC numeric truth and generated temporary-name collisions round-trip exactly', async () => {
    const result = await equivalent(`REM @bw device arduino-uno
REM @bw pin led D13 output
REM @bw pin button D2 input active-low
PROCpinMode(13,"output")
PROCpinMode(2,"input-pullup")
truth_0=8
PRINT FNdigitalRead(2)=1
PRINT ABS(FNdigitalRead(2)=0)
PRINT truth_0
END`, false);
    assert.equal(result.text, numberOutput(-1) + numberOutput(0) + numberOutput(8));
    assert.deepEqual(result.trace, sequenced([
        {atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
        {atMs: 0, type: 'pin-mode', pin: 2, mode: 'input-pullup'},
        {atMs: 0, type: 'digital-read', pin: 2, value: 1},
        {atMs: 0, type: 'digital-read', pin: 2, value: 1}
    ]));
});

test('handwritten BASIC canvas commands retain exact coordinates and bytes through pseudocode', async () => {
    const result = await equivalent('CLG\nGCOL 0,4\nMOVE 640,512\nDRAW 680,552\nEND', false);
    assert.deepEqual(result.output, Buffer.from([16, 18, 0, 4, 25, 4, 128, 2, 0, 2, 25, 5, 168, 2, 40, 2]));
    assert.deepEqual(result.trace, []);
});

const expressionHeader = `REM @bw device arduino-uno
REM @bw pin led D13 output
REM @bw pin button D2 input active-low
PROCpinMode(13,"output")
PROCpinMode(2,"input-pullup")
PROCdelay(1001)
a=3
`;

// Explicit values prevent two identically broken conversions from passing;
// full traces additionally expose duplicated or omitted electrical reads.
const expressions = [
    ['"Aa""BB"', 'Aa"BB\r\n'],
    ['"C:\\tmp\\x"', 'C:\\tmp\\x\r\n'],
    ['-a', -3],
    ['ABS(-a)', 3],
    ['INT(-a/2)', -2],
    ['FNmillis', 1001],
    ['ABS(FNdigitalRead(2)=1)', 1],
    ['NOT (FNdigitalRead(2)=1)', 0],
    ['(FNdigitalRead(2)=1) AND (a>2)', -1],
    ['(FNdigitalRead(2)=1) OR (a>3)', -1],
    ['ABS(FNdigitalRead(2)=1)>0', -1],
    ['ABS(FNdigitalRead(2)=1)<=0', 0],
    ['ABS(FNdigitalRead(2)=1)<>0', -1],
    ['(FNdigitalRead(2)=1)<0', -1],
    ['(FNdigitalRead(2)=1)>=0', 0],
    ['(FNdigitalRead(2)=1)<>0', -1],
    ['(FNdigitalRead(2)=1)=0', 0],
    ['-ABS(FNdigitalRead(2)=1)', -1],
    ['-(FNdigitalRead(2)=1)', 1],
    ['1-FNdigitalRead(2)', 0],
    ['ABS(-1)', 1],
    ['INT(-1)', -1],
    ['FALSE', 0],
    ['TRUE', -1]
];

function expressionTrace(expression) {
    return sequenced([
        {atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
        {atMs: 0, type: 'pin-mode', pin: 2, mode: 'input-pullup'},
        {atMs: 1001, type: 'delay', fromMs: 0, milliseconds: 1001},
        ...(expression.includes('FNdigitalRead') ? [{atMs: 1001, type: 'digital-read', pin: 2, value: 1}] : [])
    ]);
}

for (const [expression, expected] of expressions) {
    test(`portable expression round trip: ${expression}`, async () => {
        const result = await equivalent(`${expressionHeader}PRINT ${expression}\nEND`, false);
        assert.equal(result.text, typeof expected === 'number' ? numberOutput(expected) : expected);
        assert.deepEqual(result.trace, expressionTrace(expression));
    });
}

// These comparisons are constant as predicates, but simplifying them would
// erase a real electrical read. The reader must refuse, not silently drop it.
for (const [expression, expected] of [
    ['ABS(FNdigitalRead(2)=1)<0', 0],
    ['ABS(FNdigitalRead(2)=1)>=0', -1],
    ['(FNdigitalRead(2)=1)>0', 0],
    ['(FNdigitalRead(2)=1)<=0', -1]
]) {
    test(`portable reader explicitly refuses to erase the read in ${expression}`, async () => {
        const source = `${expressionHeader}PRINT ${expression}\nEND`;
        const original = await execute(source);
        assert.equal(original.text, numberOutput(expected));
        assert.deepEqual(original.trace, expressionTrace(expression));
        const read = basicToPseudocode(source, {mode: 'crispbasic'});
        assert.equal(read.ok, false);
        assert.equal(read.pseudocode, '', 'refusal must not expose a partial converted program');
        assert.ok(read.diagnostics.some(item => item.code === 'crispbasic-read-constant-predicate'));
        assert.match(read.reasons.join('\n'), /operand must still be evaluated/);
    });
}
