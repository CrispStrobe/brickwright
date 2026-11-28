// Execute the committed examples on the real BBCSDL WASM interpreter.
// These are logical GPIO/clock checks, not CPU firmware or circuit physics.
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import test from 'node:test';
import {createWasmSession, createTargetSimulationHost} from '../browser.mjs';

const moduleURL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const wasmURL = new URL('../.build/wasm/crispbasic.wasm', import.meta.url);
const exampleURL = new URL('../examples/board-targets/', import.meta.url);
const expectedText = '1:1:0\r\n0:0:25\r\n1:1:30\r\n';

// Independent pin/package anchors: never derive these from the target registry
// being tested. Aliases must execute the same committed program and fixture.
const targets = [
    {name: '8051', id: 'mcu', file: '8051', out: 8, input: 9, excluded: 64},
    {name: 'stc15', id: 'stc15_mcu', file: 'stc15', out: 44, input: 45, excluded: 32},
    {name: 'stm32', id: 'stm32f030', file: 'stm32', out: 17, input: 0, excluded: 8},
    {name: 'pico', id: 'pi_pico', file: 'pico', out: 25, input: 2, excluded: 23},
    {name: 'rp2040', id: 'pi_pico', file: 'pico', out: 25, input: 2, excluded: 23},
    {name: 'nano', id: 'arduino_nano', file: 'nano', out: 13, input: 2, excluded: 20},
    {name: 'esp8266', id: 'esp8266', file: 'esp8266', out: 12, input: 0, excluded: 6},
    {name: '8266', id: 'esp8266', file: 'esp8266', out: 12, input: 0, excluded: 6},
    {name: 'microbit', id: 'microbit', file: 'microbit', out: 0, input: 2, excluded: 3},
    {name: 'microbit-breakout', id: 'microbit_breakout', file: 'microbit-breakout', out: 8, input: 16, excluded: 3}
];

function sessionFor(t, simulation) {
    const session = createWasmSession({moduleURL, simulation});
    t.after(() => session.dispose());
    return session;
}

async function example(file) {
    const [source, json] = await Promise.all([
        readFile(new URL(file + '.bas', exampleURL), 'utf8'),
        readFile(new URL(file + '.json', exampleURL), 'utf8')
    ]);
    return {source, fixture: JSON.parse(json)};
}

function expectedTrace(out, input) {
    return [
        {sequence: 1, atMs: 0, type: 'pin-mode', pin: out, mode: 'output'},
        {sequence: 2, atMs: 0, type: 'pin-mode', pin: input, mode: 'input-pullup'},
        {sequence: 3, atMs: 0, type: 'digital-write', pin: out, value: 1},
        {sequence: 4, atMs: 0, type: 'digital-read', pin: out, value: 1},
        {sequence: 5, atMs: 0, type: 'digital-read', pin: input, value: 1},
        {sequence: 6, atMs: 25, type: 'input', pin: input, value: 0},
        {sequence: 7, atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25},
        {sequence: 8, atMs: 25, type: 'digital-toggle', pin: out, value: 0},
        {sequence: 9, atMs: 25, type: 'digital-read', pin: out, value: 0},
        {sequence: 10, atMs: 25, type: 'digital-read', pin: input, value: 0},
        {sequence: 11, atMs: 30, type: 'input', pin: input, value: null},
        {sequence: 12, atMs: 30, type: 'delay', fromMs: 25, milliseconds: 5},
        {sequence: 13, atMs: 30, type: 'digital-toggle', pin: out, value: 1},
        {sequence: 14, atMs: 30, type: 'digital-read', pin: out, value: 1},
        {sequence: 15, atMs: 30, type: 'digital-read', pin: input, value: 1}
    ];
}

test('named board execution requires the actual built WASM engine', async () => {
    await access(moduleURL);
    assert.equal(WebAssembly.validate(await readFile(wasmURL)), true);
});

for (const target of targets) {
    test(target.name + ': committed BASIC and named-pad fixture produce fixed output and trace', async t => {
        const {source, fixture} = await example(target.file);
        let host;
        const session = sessionFor(t, {maxRequests: fixture.maxRequests, createHost() {
            host = createTargetSimulationHost(target.name, fixture);
            return host;
        }});
        const result = await session.run(source, {filename: target.file + '.bas'});
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.exitCode, 0);
        assert.equal(result.text, expectedText);
        assert.deepEqual([...result.output], [...Buffer.from(expectedText, 'latin1')]);
        assert.equal(host.capabilities.target.id, target.id);
        assert.deepEqual([...host.capabilities.pins].sort((a, b) => a - b),
            [target.out, target.input].sort((a, b) => a - b));
        assert.deepEqual(host.trace, expectedTrace(target.out, target.input));
        assert.equal(host.state, 'disposed', 'host ownership ends before run resolves');
        assert.equal(host.pendingInputs, 0);
        assert.equal(session.state, 'idle');
        assert.equal(host.capabilities.hardware, false);
        assert.equal(host.capabilities.circuitPhysics, false);
        assert.equal(host.capabilities.target.nativeInterpreter, false);
    });

    test(target.name + ': excluded package pin raises authored BASIC ERR201 without a drive', async t => {
        let host;
        const session = sessionFor(t, {createHost() {
            host = createTargetSimulationHost(target.name);
            return host;
        }});
        const result = await session.run(
            '100 REM excluded package pin\n450 PROCpinMode(' + target.excluded + ',"output")\n500 PRINT "unreachable"\n',
            {filename: 'excluded-' + target.file + '.bas'});
        assert.equal(result.status, 'error', JSON.stringify(result.error));
        assert.equal(result.error.kind, 'basic');
        assert.equal(result.error.code, 201);
        assert.equal(result.error.simulationCode, 'invalid-pin');
        assert.equal(result.error.filename, 'excluded-' + target.file + '.bas');
        assert.equal(result.error.line, 2);
        assert.equal(result.error.basicLine, 450);
        assert.equal(result.output.length, 0);
        assert.deepEqual(host.trace, []);
        assert.equal(host.state, 'disposed');
    });
}

test('unknown named target refuses before any BASIC output', async t => {
    assert.throws(() => createTargetSimulationHost('not-a-board'), TypeError);
    const session = sessionFor(t, {createHost() {
        return createTargetSimulationHost('not-a-board');
    }});
    const result = await session.run('PRINT "unreachable"\nEND\n');
    assert.equal(result.status, 'host-error', JSON.stringify(result));
    assert.equal(result.output.length, 0);
    assert.equal(session.state, 'idle');
});

test('target fixtures cannot expand a board profile or turn Nano A6 into digital GPIO', () => {
    for (const [name, pin] of [['pico', 'GP23'], ['nano', 'A6'], ['stm32', 'PA8'],
        ['8266', 'GPIO6'], ['microbit', 'P8'], ['microbit-breakout', 'P3'], ['stc15', 'P4.0']]) {
        assert.throws(() => createTargetSimulationHost(name, {pins: [pin]}),
            error => error.code === 'invalid-pin', name + ' ' + pin);
    }
});

test('a second run receives a fresh target host and repeats the fixture from zero', async t => {
    const {source, fixture} = await example('pico');
    const hosts = [];
    const session = sessionFor(t, {maxRequests: fixture.maxRequests, createHost() {
        const host = createTargetSimulationHost('rp2040', fixture);
        hosts.push(host);
        return host;
    }});
    for (let run = 0; run < 2; run++) {
        const result = await session.run(source, {filename: 'pico.bas'});
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(result.text, expectedText);
        assert.deepEqual(hosts[run].trace, expectedTrace(25, 2));
        assert.equal(hosts[run].state, 'disposed');
    }
    assert.notEqual(hosts[0], hosts[1]);
});

test('a named target preserves parent-owned time limits across interpreter suspension', async t => {
    let host;
    const session = sessionFor(t, {createHost() {
        host = createTargetSimulationHost('nano', {maxTimeMs: 29});
        return host;
    }});
    const result = await session.run(
        'ON ERROR PRINT "caught":END\nPROCpinMode(13,"output")\nPROCdigitalWrite(13,1)\nPROCdelay(25)\nPROCdelay(5)\n');
    assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
    assert.equal(result.error.code, 'time-limit');
    assert.equal(result.output.length, 0, 'BASIC cannot catch and clear a host budget');
    assert.deepEqual(host.trace, [
        {sequence: 1, atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
        {sequence: 2, atMs: 0, type: 'digital-write', pin: 13, value: 1},
        {sequence: 3, atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25}
    ]);
    assert.equal(host.state, 'disposed');
});
