// Qualification of the exact vendored producer against the real C/WASM core.
// These tests require the authenticated build and root integration dependencies;
// unavailable inputs are failures, never skipped or replaced with source stubs.
import assert from 'node:assert/strict';
import test from 'node:test';
import SB3Creator from '../../../overlay/scratch-gui/src/lib/sb3-creator.js';
import basicToPseudocode from '../../../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {createWasmSession} from '../browser.mjs';
import {createSimulationHost, SimulationError} from '../src/simulation-host.mjs';
import {createCrispBasicBoardHost} from '../../../overlay/scratch-gui/src/lib/crispbasic-board-host.js';
import {createCrispBasicCircuitFixture} from '../../../scripts/lib/crispbasic-circuit-fixture.mjs';
import {BoardImpl} from 'bw-board/board.js';

const moduleURL = new URL('../.build/wasm/crispbasic.mjs', import.meta.url);
const portable = {profile: 'bbc', mode: 'crispbasic', lineNumbers: false};
const pinSource = body => `DEVICE UNO
PIN lamp = D13 OUTPUT ACTIVE LOW
PIN button = D2 INPUT ACTIVE LOW
WHEN flag clicked:
${body}
`;

function generate(source, options = portable, editProject = () => {}) {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, [], 'the fixture must reach the producer without parser degradations');
    editProject(creator.project);
    const result = creator.generateBASIC(creator.project, options);
    assert.equal(result.ok, true, JSON.stringify(result));
    return {creator, ...result};
}

function sessionFor(t, options = {}) {
    const session = createWasmSession({moduleURL, ...options});
    t.after(() => session.dispose());
    return session;
}

function referenceSession(t, setup = () => {}, options = {}) {
    let host;
    const session = sessionFor(t, {simulation: {createHost() {
        host = createSimulationHost({pins: [2, 13], ...options});
        setup(host);
        return host;
    }}});
    return {session, get host() { return host; }};
}

function completed(result) {
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
}

test('portable blocks execute logical polarity and raw normalized digital writes with a fixed trace', async t => {
    const generated = generate(pinSource(`  turn on lamp
  turn off lamp
  set lamp high
  set lamp low
  set lamp to -7
  set lamp to 0
  set lamp to 99
  set lamp to read button
  print read button
  wait 0.025 seconds
  print read button`), portable, project => {
        // The pinned pseudocode value reader refuses comparisons. Connect an
        // actual Scratch Boolean reporter, as the Blocks editor does, instead
        // of claiming that textual "true" tested BBC BASIC's -1 Boolean value.
        const blocks = project.targets[0].blocks;
        const [ownerId, owner] = Object.entries(blocks).find(([, block]) =>
            block.opcode === 'stc12_writepin' && block.inputs.VALUE[1]?.[1] === '99');
        blocks.qualifiedBoolean = {opcode: 'operator_lt', next: null, parent: ownerId,
            inputs: {OPERAND1: [1, [10, '1']], OPERAND2: [1, [10, '2']]}, fields: {},
            shadow: false, topLevel: false};
        owner.inputs.VALUE = [2, 'qualifiedBoolean'];
    });
    const f = referenceSession(t, host => host.scheduleInput(2, 0, 25));
    const result = await f.session.run(generated.basic, {filename: 'digital-generated.bas'});
    completed(result);
    assert.equal(result.text, '         0\r\n         1\r\n');
    assert.deepEqual(f.host.trace.map(({sequence, ...event}) => event), [
        {atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
        {atMs: 0, type: 'pin-mode', pin: 2, mode: 'input-pullup'},
        ...[0, 1, 1, 0, 1, 0, 1].map(value => ({atMs: 0, type: 'digital-write', pin: 13, value})),
        {atMs: 0, type: 'digital-read', pin: 2, value: 1},
        {atMs: 0, type: 'digital-write', pin: 13, value: 0},
        {atMs: 0, type: 'digital-read', pin: 2, value: 1},
        {atMs: 25, type: 'input', pin: 2, value: 0},
        {atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25},
        {atMs: 25, type: 'digital-read', pin: 2, value: 0}
    ]);
    assert.equal(f.host.state, 'disposed');
});

test('portable Boolean operators normalize sensed and numeric truth values before digital writes', async t => {
    const generated = generate(pinSource('  set lamp to 91\n  set lamp to 92\n  set lamp to 93'), portable, project => {
        const blocks = project.targets[0].blocks;
        const add = (id, opcode, parent, inputs = {}, fields = {}) => {
            blocks[id] = {opcode, next: null, parent, inputs, fields, shadow: false, topLevel: false};
        };
        const number = value => [1, [4, String(value)]];
        for (const [ownerId, owner] of Object.entries(blocks)) {
            if (owner.opcode !== 'stc12_writepin') continue;
            const value = owner.inputs.VALUE[1][1];
            const reporter = `qualifiedLogic${value}`;
            owner.inputs.VALUE = [2, reporter];
            if (value === '91') {
                add(reporter, 'operator_not', ownerId, {OPERAND: [2, 'qualifiedSense']});
                add('qualifiedSense', 'stc12_readpin', reporter, {}, {PIN: ['button', null]});
            } else {
                add(reporter, value === '92' ? 'operator_and' : 'operator_or', ownerId,
                    {OPERAND1: [2, `${reporter}sum`], OPERAND2: number(value === '92' ? 1 : 0)});
                add(`${reporter}sum`, 'operator_add', reporter, {NUM1: number(1), NUM2: number(1)});
            }
        }
    });
    const f = referenceSession(t, host => host.setInput(2, 0));
    const result = await f.session.run(generated.basic);
    completed(result);
    assert.deepEqual(f.host.trace.filter(event => event.type === 'digital-write').map(event => event.value), [0, 1, 1]);
    assert.equal(f.host.trace.filter(event => event.type === 'digital-read').length, 1);
});

test('a Boolean nested in arithmetic retains its numeric 0/1 value before a digital write', async t => {
    const generated = generate(pinSource('  set lamp to 99'), portable, project => {
        const blocks = project.targets[0].blocks;
        const [ownerId, owner] = Object.entries(blocks).find(([, block]) => block.opcode === 'stc12_writepin');
        blocks.qualifiedSum = {opcode: 'operator_add', next: null, parent: ownerId,
            inputs: {NUM1: [2, 'qualifiedComparison'], NUM2: [1, [4, '-1']]}, fields: {},
            shadow: false, topLevel: false};
        blocks.qualifiedComparison = {opcode: 'operator_gt', next: null, parent: 'qualifiedSum',
            inputs: {OPERAND1: [1, [10, '2']], OPERAND2: [1, [10, '1']]}, fields: {},
            shadow: false, topLevel: false};
        owner.inputs.VALUE = [2, 'qualifiedSum'];
    });
    const f = referenceSession(t);
    completed(await f.session.run(generated.basic));
    assert.deepEqual(f.host.trace.filter(event => event.type === 'digital-write').map(event => event.value), [0],
        'Scratch true + -1 is zero; BBC BASIC -1 and operator precedence must not change it');
});

test('serialized Stage metadata and numeric scalar state reach actual generated pin and timing execution', async t => {
    const creator = new SB3Creator();
    creator.parse(pinSource('  set lamp to stored\n  wait duration seconds\n  print (timer * 1000)'));
    assert.deepEqual(creator.warnings, []);
    for (const target of creator.project.targets) {
        for (const variable of Object.values(target.variables)) {
            if (variable[0] === 'stored') variable[1] = -7;
            if (variable[0] === 'duration') variable[1] = '0.025';
        }
    }
    SB3Creator.writeStcComment(creator.project);
    const project = JSON.parse(JSON.stringify(creator.project));
    delete project.stc; // Scratch VM serialization retains the Stage persistence comment.
    const before = JSON.stringify(project);
    const generated = creator.generateBASIC(project, portable);
    assert.equal(generated.ok, true, JSON.stringify(generated));
    assert.equal(JSON.stringify(project), before, 'generation must not mutate the serialized project');
    const f = referenceSession(t);
    const result = await f.session.run(generated.basic);
    completed(result);
    assert.equal(result.text, '        25\r\n');
    assert.deepEqual(f.host.trace.map(({sequence, ...event}) => event), [
        {atMs: 0, type: 'pin-mode', pin: 13, mode: 'output'},
        {atMs: 0, type: 'pin-mode', pin: 2, mode: 'input-pullup'},
        {atMs: 0, type: 'digital-write', pin: 13, value: 1},
        {atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25}
    ]);
});

for (const lineNumbers of [false, true]) {
    test(`portable ${lineNumbers ? 'numbered' : 'structured'} delays use integer simulation time and timer reset`, async t => {
        const generated = generate(`WHEN flag clicked:
  print (timer * 1000)
  wait 0.025 seconds
  print (timer * 1000)
  reset timer
  set duration to 0.0004
  wait duration seconds
  wait 0.0015 seconds
  print (timer * 1000)
`, {...portable, lineNumbers});
        const f = referenceSession(t);
        const result = await f.session.run(generated.basic);
        completed(result);
        assert.equal(result.text, '         0\r\n        25\r\n         2\r\n');
        assert.deepEqual(f.host.trace.map(({sequence, ...event}) => event), [
            {atMs: 25, type: 'delay', fromMs: 0, milliseconds: 25},
            {atMs: 25, type: 'delay', fromMs: 25, milliseconds: 0},
            {atMs: 27, type: 'delay', fromMs: 25, milliseconds: 2}
        ]);
    });
}

test('a generated delay evaluates a simulation reporter once before rounding', async t => {
    const generated = generate(pinSource('  wait (read button / 1000) seconds'));
    const f = referenceSession(t, host => host.setInput(2, 0));
    const result = await f.session.run(generated.basic);
    completed(result);
    assert.equal(f.host.trace.filter(event => event.type === 'digital-read').length, 1);
    assert.deepEqual(f.host.trace.at(-1), {sequence: 5, atMs: 1, type: 'delay', fromMs: 0, milliseconds: 1});
});

for (const duration of [-0.0004, 2147483.648]) {
    test(`dynamic invalid seconds ${duration} fail at the wait block before advancing time`, async t => {
        const generated = generate(`WHEN flag clicked:
  set duration to ${duration}
  wait duration seconds
  print "late"
`);
        const waitId = Object.entries(generated.creator.project.targets[0].blocks)
            .find(([, block]) => block.opcode === 'control_wait')[0];
        const f = referenceSession(t);
        const result = await f.session.run(generated.basic, {filename: 'bad-delay.bas'});
        assert.equal(result.status, 'error', JSON.stringify(result));
        assert.equal(result.error.kind, 'basic');
        assert.equal(result.error.filename, 'bad-delay.bas');
        assert.equal(generated.lineMap[result.error.line], waitId, 'the diagnostic must retain the owning wait block');
        assert.equal(result.text, '');
        assert.deepEqual(f.host.trace, [], 'a rejected duration must have no simulation effects');
    });
}

test('generated simulation calls require explicit bridge enablement', async t => {
    const generated = generate('WHEN flag clicked:\n  wait 0.001 seconds\n  print "late"\n');
    const session = sessionFor(t);
    const result = await session.run(generated.basic);
    assert.equal(result.status, 'error');
    assert.equal(result.text, '');
    assert.equal(result.error.message, 'No such FN/PROC');
});

test('generated portable calls are refused by To blocks while legacy hardware comments stay inert', () => {
    const generated = generate(pinSource('  turn on lamp\n  wait 0.001 seconds\n  print read button'));
    const reverse = basicToPseudocode(generated.basic);
    assert.equal(reverse.ok, false);
    assert.equal(reverse.pseudocode, '');
    assert.ok(reverse.diagnostics.length >= 3);
    assert.ok(reverse.diagnostics.every(diagnostic => Number.isInteger(diagnostic.line) && diagnostic.line > 0));
    const legacy = generated.creator.generateBASIC(generated.creator.project, {profile: 'bbc', lineNumbers: false});
    assert.equal(legacy.ok, true);
    assert.doesNotMatch(legacy.basic, /PROCdigitalWrite|PROCpinMode|FNdigitalRead|PROCdelay|FNmillis/);
    const commented = basicToPseudocode('REM PROCdigitalWrite(13,1):PROCdelay(99)\nPRINT 7\nEND\n');
    assert.notEqual(commented.ok, false);
    const rebuilt = new SB3Creator(); rebuilt.parse(commented.pseudocode);
    const opcodes = rebuilt.project.targets.flatMap(target => Object.values(target.blocks).map(block => block.opcode));
    assert.equal(opcodes.includes('procedures_call'), false);
    assert.equal(opcodes.includes('control_wait'), false);
});

test('generated Uno output and delay drive the real LED with fixed electrical and time anchors', async t => {
    const {board} = createCrispBasicCircuitFixture();
    let host, observation;
    const generated = generate(`DEVICE UNO
PIN lamp = D13 OUTPUT
PIN button = D2 INPUT ACTIVE LOW
WHEN flag clicked:
  turn on lamp
  wait 0.025 seconds
  print read button
  turn off lamp
`);
    const session = sessionFor(t, {simulation: {createHost({signal}) {
        host = createCrispBasicBoardHost({board, signal, SimulationError});
        return {
            pinMode: (...args) => host.pinMode(...args),
            digitalWrite: (...args) => host.digitalWrite(...args),
            digitalRead: (...args) => {
                observation = {currentMa: -board.branchCurrent('led', 'anode') * 1000,
                    voltage: board.readAnalog('d13'), timeNs: board.timeNs};
                return host.digitalRead(...args);
            },
            delay: (...args) => host.delay(...args),
            millis: () => host.millis(),
            dispose: () => host.dispose()
        };
    }}});
    const result = await session.run(generated.basic);
    completed(result);
    assert.equal(result.text, '         0\r\n');
    assert.ok(observation.currentMa > 10 && observation.currentMa < 16,
        `the 5 V, 220-ohm red-LED circuit carries ${observation.currentMa} mA`);
    assert.ok(observation.voltage > 4.5 && observation.voltage < 5);
    assert.equal(observation.timeNs, 25000000n);
    assert.equal(host.state, 'disposed');
    assert.ok(board.getPinStates().every(pin => pin.mode === 'input'));
    assert.equal(board._externalClock, null);
});

test('generated output reads the solved clamped net and toggle refuses instead of inverting that read', async t => {
    const board = new BoardImpl(5);
    board.setNetlist([
        {id: 'uno', kind: 'arduino_uno', terminals: ['d13', 'gnd']},
        {id: 'clamp', kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 1}}
    ], [
        {id: 'drive', terminals: [{part: 'uno', terminal: 'd13'}, {part: 'clamp', terminal: 'a'}]},
        {id: 'ground', terminals: [{part: 'uno', terminal: 'gnd'}, {part: 'clamp', terminal: 'b'}]}
    ]);
    const source = 'DEVICE UNO\nPIN lamp = D13 OUTPUT\nWHEN flag clicked:\n  turn on lamp\n  print read lamp\n';
    const generated = generate(source);
    let host;
    const session = sessionFor(t, {simulation: {createHost({signal}) {
        host = createCrispBasicBoardHost({board, signal, SimulationError});
        return host;
    }}});
    const result = await session.run(generated.basic);
    completed(result);
    assert.equal(result.text, '         0\r\n');
    assert.deepEqual(host.trace.filter(event => /digital-/.test(event.type)).map(({type, value}) => ({type, value})), [
        {type: 'digital-write', value: 1}, {type: 'digital-read', value: 0}
    ]);
    const toggled = new SB3Creator(); toggled.parse(source + '  toggle lamp\n');
    const refused = toggled.generateBASIC(toggled.project, portable);
    assert.equal(refused.ok, false);
    assert.match(refused.reasons.join('\n'), /toggle.*latch|latch.*toggle/i);
    assert.equal(refused.basic, undefined);
});
