// Qualify procedure/timing source conversions against the real pinned core.
// Missing artifacts are failures: this is not a source-only smoke test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import SB3Creator from '../../overlay/scratch-gui/src/lib/sb3-creator.js';
import basicToPseudocode from '../../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {createWasmSession} from '../../packages/crisp-basic/browser.mjs';
import {createSimulationHost} from '../../packages/crisp-basic/src/simulation-host.mjs';

const moduleURL = new URL('../../packages/crisp-basic/.build/wasm/crispbasic.mjs', import.meta.url);
const portable = {profile: 'bbc', mode: 'crispbasic'};
const numberOutput = value => `${String(value).padStart(10)}\r\n`;

function generate(source, lineNumbers) {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    const result = creator.generateBASIC(undefined, {...portable, lineNumbers});
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.basic;
}
function regenerate(source, lineNumbers) {
    const read = basicToPseudocode(source, {mode: 'crispbasic'});
    assert.equal(read.ok, true, JSON.stringify(read));
    return generate(read.pseudocode, lineNumbers);
}
async function execute(source, setup = () => {}) {
    let host;
    const session = createWasmSession({moduleURL, timeoutMs: 10000, maxOutputBytes: 8192,
        simulation: {maxRequests: 200, createHost() {
            host = createSimulationHost({pins: [2, 3, 13], maxTimeMs: 2000, maxTraceEvents: 200});
            setup(host);
            return host;
        }}
    });
    try {
        const result = await session.run(source);
        assert.equal(host.state, 'disposed');
        return {status: result.status, output: Buffer.from(result.output), text: result.text,
            error: result.error && {kind: result.error.kind, message: result.error.message}, trace: host.trace};
    } finally { await session.dispose(); }
}
async function equivalent(original, lineNumbers, setup) {
    const before = await execute(original, setup);
    const after = await execute(regenerate(original, lineNumbers), setup);
    assert.deepEqual(after, before, 'raw output, errors and all ordered GPIO events must be preserved');
    return before;
}

const pulseSource = `DEVICE ARDUINO-UNO
PIN led = D13 OUTPUT
GLOBAL count
DEFINE pulse (seconds):
  turn on led
  wait seconds seconds
  turn off led
  change count by 1
DEFINE pair:
  pulse (0.0015)
  pulse (0.0025)
WHEN flag clicked:
  pair
  print count
  print timer`;

for (const lineNumbers of [false, true]) {
    test(`${lineNumbers ? 'numbered' : 'structured'} reusable pulses preserve GPIO and rounded millisecond timing`, async () => {
        const result = await equivalent(generate(pulseSource, lineNumbers), lineNumbers);
        assert.equal(result.status, 'completed');
        assert.equal(result.text, numberOutput(2) + numberOutput(0.005));
        assert.deepEqual(result.trace.map(({sequence, ...event}) => event), [
            {atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
            {atMs: 0, type: 'digital-write', pin: 13, value: 1},
            {atMs: 2, type: 'delay', fromMs: 0, milliseconds: 2},
            {atMs: 2, type: 'digital-write', pin: 13, value: 0},
            {atMs: 2, type: 'digital-write', pin: 13, value: 1},
            {atMs: 5, type: 'delay', fromMs: 2, milliseconds: 3},
            {atMs: 5, type: 'digital-write', pin: 13, value: 0}
        ]);
    });

    test(`${lineNumbers ? 'numbered' : 'structured'} recursion restores each caller's argument`, async () => {
        const source = generate(`DEFINE countdown (remaining):
  print remaining
  IF remaining > 0 THEN:
    countdown (remaining - 1)
  print remaining
WHEN flag clicked:
  countdown (3)`, lineNumbers);
        const result = await equivalent(source, lineNumbers);
        assert.equal(result.status, 'completed');
        assert.equal(result.text, [3, 2, 1, 0, 0, 1, 2, 3].map(numberOutput).join(''));
        assert.deepEqual(result.trace, []);
    });
}

test('procedure call arguments retain electrical read order and numeric BBC truth', async () => {
    const source = `REM @bw device arduino-uno
REM @bw pin a D2 input
REM @bw pin b D3 input
PROCpinMode(2,"input")
PROCpinMode(3,"input")
PROCconsume(FNdigitalRead(2),FNdigitalRead(3)=1)
END
DEF PROCconsume(first,second)
PRINT first
PRINT second
ENDPROC`;
    const result = await equivalent(source, false, host => { host.setInput(2, 0); host.setInput(3, 1); });
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.equal(result.text, numberOutput(0) + numberOutput(-1));
    assert.deepEqual(result.trace.filter(event => event.type === 'digital-read').map(({pin, value}) => ({pin, value})), [
        {pin: 2, value: 0}, {pin: 3, value: 1}
    ]);
});

test('same-spelled parameters in nested procedures preserve independent locals', async () => {
    const result = await equivalent('PROCouter(9)\nEND\nDEF PROCouter(value)\nPROCinner(3)\nPRINT value\nENDPROC\nDEF PROCinner(value)\nPRINT value\nENDPROC', false);
    assert.equal(result.status, 'completed');
    assert.equal(result.text, [3, 9].map(numberOutput).join(''));
});

test('generated parameter aliases cannot change an authored global', async () => {
    const result = await equivalent('arg_task_value=12\nPROCtask(3)\nPRINT arg_task_value\nEND\nDEF PROCtask(value)\nPRINT value\nENDPROC', false);
    assert.equal(result.status, 'completed');
    assert.equal(result.text, [3, 12].map(numberOutput).join(''));
});

for (const duration of [-0.0004, 2147483.648]) {
    test(`computed procedure wait preserves out-of-range error for ${duration}`, async () => {
        const source = `PROCsleep(${duration})\nPRINT 999\nEND\nDEF PROCsleep(seconds)\nIF seconds<0 OR seconds>2147483.647 THEN ERROR 204,"CrispBASIC wait seconds outside 0..2147483.647"\nPROCdelay(INT(seconds*1000+0.5))\nENDPROC`;
        const result = await equivalent(source, false);
        assert.equal(result.status, 'error');
        assert.deepEqual(result.error, {kind: 'basic', message: 'CrispBASIC wait seconds outside 0..2147483.647'});
        assert.equal(result.text, '');
        assert.deepEqual(result.trace, [], 'an invalid duration never advances the host');
    });
}

test('the reusable pulse example is executable and reversible', async () => {
    const source = await readFile(new URL('../../packages/crisp-basic/examples/procedure-pulses.bas', import.meta.url), 'utf8');
    const result = await equivalent(source, false);
    assert.equal(result.status, 'completed');
    assert.equal(result.text, numberOutput(5));
    assert.deepEqual(result.trace.filter(event => event.type === 'delay').map(event => event.milliseconds), [2, 3]);
});

for (const [expression, expected] of [
    ['SQR(9)', 3], ['LN(1)', 0], ['SIN(RAD(30))', 0.5], ['COS(RAD(60))', 0.5],
    ['TAN(RAD(45))', 1], ['DEG(ASN(1))', 90], ['DEG(ACS(1))', 0], ['DEG(ATN(1))', 45],
    ['7 MOD 3', 1], ['-7 MOD 3', -1], ['7 MOD -3', 1], ['LN(100)/LN(10)', 2]
]) {
    test(`portable robot/math expression preserves real BASIC result: ${expression}`, async () => {
        const result = await equivalent(`PRINT ${expression}\nEND`, false);
        assert.equal(result.status, 'completed');
        assert.equal(result.text, numberOutput(expected));
        assert.deepEqual(result.trace, []);
    });
}

test('portable PI preserves the interpreter constant without inserting a decimal approximation', async () => {
    const result = await equivalent('PRINT PI\nEND', false);
    assert.equal(result.status, 'completed');
    assert.equal(result.text, '3.14159265\r\n');
});

for (const expression of ['SQR(-1)', 'LN(0)', 'DEG(ASN(2))', '7 MOD 0']) {
    test(`portable numeric conversion retains BASIC domain error: ${expression}`, async () => {
        const result = await equivalent(`PRINT ${expression}\nEND`, false);
        assert.equal(result.status, 'error');
        assert.equal(result.error.kind, 'basic');
        assert.deepEqual(result.trace, []);
    });
}

test('ceiling is correct for both signs and samples an electrical operand once', async () => {
    const source = generate(`DEVICE ARDUINO-UNO
PIN input = D2 INPUT
WHEN flag clicked:
  print ceiling of ((read input) + 0.2)
  print ceiling of -1.2
  print ceiling of 1.2`, false);
    const result = await equivalent(source, false, host => host.setInput(2, 0));
    assert.equal(result.status, 'completed');
    assert.equal(result.text, [1, -1, 2].map(numberOutput).join(''));
    assert.equal(result.trace.filter(event => event.type === 'digital-read').length, 1);
});
