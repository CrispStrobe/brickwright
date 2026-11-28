// Complete source → real interpreter → electrical solver qualification for the
// newly connected board surfaces. These are host-driven GPIO profiles, not MCU
// firmware ports; both source forms must preserve physical solved voltages.
import assert from 'node:assert/strict';
import test from 'node:test';
import {BoardImpl} from 'bw-board/board.js';
import {registerBoardKinds} from 'bw-board/devices/board-kinds.js';
import SB3Creator from '../../../overlay/scratch-gui/src/lib/sb3-creator.js';
import basicToPseudocode from '../../../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {createCrispBasicBoardHost} from '../../../overlay/scratch-gui/src/lib/crispbasic-board-host.js';
import {createWasmSession} from '../browser.mjs';
import {SimulationError} from '../src/simulation-host.mjs';

registerBoardKinds();
const moduleURL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const portable = {profile: 'bbc', mode: 'crispbasic'};

function generate(source, lineNumbers) {
    const creator = new SB3Creator(); creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    const result = creator.generateBASIC(undefined, {...portable, lineNumbers});
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.basic;
}

async function execute(profile, source) {
    const board = new BoardImpl(profile.voltage);
    board.setNetlist([
        {id: 'controller', kind: profile.kind, terminals: [...profile.terminals, 'gnd']},
        {id: 'load-a', kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 1000}},
        {id: 'load-b', kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 1000}}
    ], [
        {id: 'first', terminals: [{part: 'controller', terminal: profile.terminals[0]}, {part: 'load-a', terminal: 'a'}]},
        {id: 'second', terminals: [{part: 'controller', terminal: profile.terminals[1]}, {part: 'load-b', terminal: 'a'}]},
        {id: 'ground', terminals: [{part: 'controller', terminal: 'gnd'}, {part: 'load-a', terminal: 'b'}, {part: 'load-b', terminal: 'b'}]}
    ]);
    let host;
    const observations = [];
    const session = createWasmSession({moduleURL, timeoutMs: 10000, simulation: {createHost({signal}) {
        host = createCrispBasicBoardHost({board, signal, SimulationError});
        return {
            pinMode: (...args) => host.pinMode(...args),
            digitalWrite: (...args) => host.digitalWrite(...args),
            digitalToggle: (...args) => host.digitalToggle(...args),
            digitalRead: (...args) => {
                const value = host.digitalRead(...args);
                observations.push({pin: args[0], value, atMs: host.millis(),
                    first: board.readAnalog(profile.terminals[0]), second: board.readAnalog(profile.terminals[1])});
                return value;
            },
            delay: (...args) => host.delay(...args),
            millis: () => host.millis(),
            dispose: () => host.dispose()
        };
    }}});
    try {
        const result = await session.run(source);
        assert.equal(result.status, 'completed', JSON.stringify(result.error));
        assert.equal(host.state, 'disposed');
        assert.equal(board._externalClock, null);
        assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
        assert.equal(board.getTime(), 3000000n);
        return {output: Buffer.from(result.output), text: result.text, trace: host.trace, observations};
    } finally { await session.dispose(); }
}

for (const profile of [
    {device: 'PYBADGE', kind: 'pybadge', voltage: 3.3, sourcePins: ['D13', 'A5'], terminals: ['d13', 'a5'], pins: [13, 19]},
    {device: 'STC15F2K60S2', kind: 'stc15_mcu', voltage: 5, sourcePins: ['P4.5', 'P5.5'], terminals: ['p4.5', 'p5.5'], pins: [37, 45]}
]) {
    test(`${profile.device} original and regenerated programs drive independent real circuit pads`, async () => {
        const source = `DEVICE ${profile.device}
PIN drive = ${profile.sourcePins[0]} OUTPUT
PIN second = ${profile.sourcePins[1]} OUTPUT
WHEN flag clicked:
  set drive high
  set second low
  wait 0.001 seconds
  print read drive
  print read second
  set drive low
  set second high
  wait 0.002 seconds
  print read drive
  print read second`;
        for (const lineNumbers of [false, true]) {
            const original = generate(source, lineNumbers);
            const converted = basicToPseudocode(original, {mode: 'crispbasic'});
            assert.equal(converted.ok, true, JSON.stringify(converted));
            const before = await execute(profile, original);
            const after = await execute(profile, generate(converted.pseudocode, lineNumbers));
            assert.deepEqual(after, before, 'output bytes, ordered pin events, clock and solved voltages must survive conversion');
            assert.equal(before.text, '         1\r\n         0\r\n         0\r\n         1\r\n');
            assert.deepEqual(before.observations.map(({pin, value, atMs}) => ({pin, value, atMs})), [
                {pin: profile.pins[0], value: 1, atMs: 1}, {pin: profile.pins[1], value: 0, atMs: 1},
                {pin: profile.pins[0], value: 0, atMs: 3}, {pin: profile.pins[1], value: 1, atMs: 3}
            ]);
            for (const [index, observation] of before.observations.entries()) {
                const high = index < 2 ? observation.first : observation.second;
                const low = index < 2 ? observation.second : observation.first;
                assert.ok(high > profile.voltage * 0.9 && high <= profile.voltage, `high output is ${high} V on ${profile.voltage} V board`);
                assert.ok(Math.abs(low) < profile.voltage * 0.05, `low output is ${low} V on ${profile.voltage} V board`);
            }
        }
    });
}
