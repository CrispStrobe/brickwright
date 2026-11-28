import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BOARD_TARGET_PROVENANCE, listBoardTargets, resolveBoardTarget,
    prepareTargetSimulation, createTargetSimulationHost
} from '../src/board-targets.mjs';
import {SimulationHost, SimulationError} from '../src/simulation-host.mjs';

const code = expected => error => error instanceof SimulationError && error.code === expected;
const cases = [
    ['8051', 'mcu', 'P1.0', 8, 'P1.1', 9, 'P8.0'],
    ['stc15', 'stc15_mcu', 'P5.4', 44, 'P5.5', 45, 'P4.0'],
    ['stm32', 'stm32f030', 'PB1', 17, 'PA0', 0, 'PA8'],
    ['pico', 'pi_pico', 'GP25', 25, 'GP2', 2, 'GP23'],
    ['rp2040', 'pi_pico', 'GP25', 25, 'GP2', 2, 'GP29'],
    ['nano', 'arduino_nano', 'D13', 13, 'D2', 2, 'A6'],
    ['8266', 'esp8266', 'GPIO12', 12, 'GPIO0', 0, 'GPIO6'],
    ['micro:bit', 'microbit', 'P0', 0, 'P2', 2, 'P8'],
    ['microbit-breakout', 'microbit_breakout', 'P8', 8, 'P16', 16, 'P3']
];

test('all canonical profiles and explicit aliases resolve to immutable targets', () => {
    const targets = listBoardTargets();
    assert.equal(targets.length, 18);
    assert.equal(new Set(targets.map(target => target.id)).size, 18);
    for (const target of targets) {
        assert.equal(resolveBoardTarget(target.id), target);
        for (const alias of target.aliases) assert.equal(resolveBoardTarget(alias.toUpperCase()), target);
        assert.equal(target.execution, 'host-driven-logical-simulation');
        assert.equal(target.hardware, false);
        assert.equal(target.nativeInterpreter, false);
        assert.equal(target.circuitPhysics, false);
        for (const object of [target, target.aliases, target.pins, ...target.pins, target.provenance]) {
            assert.equal(Object.isFrozen(object), true);
        }
    }
    assert.throws(() => targets.push({}), TypeError);
    assert.throws(() => targets[0].pins[0].pin = 900, TypeError);
    assert.match(BOARD_TARGET_PROVENANCE.commit, /^[0-9a-f]{40}$/);
    assert.match(BOARD_TARGET_PROVENANCE.blobSha, /^[0-9a-f]{40}$/);
    assert.equal(BOARD_TARGET_PROVENANCE.repository, 'CrispStrobe/bw-board');
});

for (const [name, id, output, outputId, input, inputId, excluded] of cases) {
    test(name + ' uses the exact model pins with logical timing and retained latches', () => {
        const host = createTargetSimulationHost(name, {pins: [output, input], inputs: [
            {pin: input, value: 0, atMs: 4}, {pin: inputId, value: 1, atMs: 9}
        ]});
        try {
            assert.ok(host instanceof SimulationHost);
            assert.equal(host.capabilities.target.id, id);
            assert.equal(host.capabilities.hardware, false);
            assert.equal(host.capabilities.nativeInterpreter, false);
            assert.equal(host.capabilities.circuitPhysics, false);
            assert.deepEqual(host.capabilities.pins, [outputId, inputId]);
            assert.equal(host.pendingInputs, 2);
            host.pinMode(input, 'input-pullup');
            assert.equal(host.digitalRead(inputId), 1);
            host.pinMode(output, 'output');
            host.digitalWrite(outputId, 1);
            host.setInput(output, 0); // external stimulus cannot rewrite the output latch
            assert.equal(host.digitalRead(output), 1);
            host.digitalToggle(output.toLowerCase());
            assert.equal(host.digitalRead(outputId), 0);
            host.delay(4);
            assert.equal(host.digitalRead(input), 0);
            host.delay(5);
            assert.equal(host.digitalRead(input), 1);
            assert.equal(host.millis(), 9);
            assert.throws(() => host.pinMode(excluded, 'output'), code('invalid-pin'));
            assert.equal(host.trace.at(-1).type, 'digital-read');
            host.reset();
            assert.equal(host.millis(), 0);
            assert.equal(host.pendingInputs, 0);
            assert.deepEqual(host.trace, []);
            assert.throws(() => host.digitalWrite(outputId, 1), code('pin-not-output'));
            host.pinMode(output, 'output');
            assert.equal(host.digitalRead(output), 0);
        } finally { host.dispose(); }
        assert.equal(host.state, 'disposed');
    });
}

test('every catalog profile can construct a host without the Circuit solver', () => {
    for (const target of listBoardTargets()) {
        const host = createTargetSimulationHost(target.id);
        assert.deepEqual(host.capabilities.pins, target.pins.map(entry => entry.pin));
        assert.deepEqual(host.capabilities.pinMap, target.pins);
        assert.equal(Object.isFrozen(host.capabilities), true);
        assert.equal(Object.isFrozen(host.capabilities.pinMap), true);
        host.dispose();
    }
});

test('target pin subsets cannot expand through aliases, stimuli, or runtime calls', () => {
    assert.throws(() => createTargetSimulationHost('nano', {pins: ['D13', 13]}), code('invalid-pins'));
    assert.throws(() => createTargetSimulationHost('nano', {pins: ['A6']}), code('invalid-pin'));
    assert.throws(() => createTargetSimulationHost('nano', {pins: [13], inputs: [
        {pin: 'D2', value: 1, atMs: 0}
    ]}), code('invalid-pin'));
    const host = createTargetSimulationHost('pico', {pins: ['GP25']});
    for (const value of ['GP2', 2, 'GP025', ' GP25', '25', 'GND', 'GPIO25', 40, true, null, NaN, Infinity]) {
        assert.throws(() => host.pinMode(value, 'output'), code('invalid-pin'));
    }
    assert.deepEqual(host.trace, []);
    host.dispose();
});

test('unknown and malformed targets and fixture fields refuse before creating a run', () => {
    for (const target of ['pico-w', 'nano-rp2040', 'stm32f4', '8052', '', '__proto__', 'constructor']) {
        assert.throws(() => resolveBoardTarget(target), /Unknown board target/);
    }
    for (const target of [undefined, null, 1, {}, []]) assert.throws(() => resolveBoardTarget(target), TypeError);
    for (const fixture of [null, [], 'pins']) assert.throws(() => prepareTargetSimulation('pico', fixture), TypeError);
    for (const version of [undefined, null, 0, 2, '1']) {
        assert.throws(() => prepareTargetSimulation('pico', {schemaVersion: version}), /schemaVersion must be 1/);
    }
    for (const fixture of [{target: 'nano'}, {unknown: 1}, {inputs: [{pin: 0, value: 1, atMs: 0, typo: 1}]}]) {
        assert.throws(() => prepareTargetSimulation('pico', fixture), /Unknown/);
    }
    for (const fixture of [{pins: []}, {pins: [1, 1]}, {pins: null}, {inputs: null},
        {inputs: [null]}, {inputs: [{}]}, {inputs: [{pin: 0, value: 2, atMs: 0}]},
        {maxRequests: 0}, {maxTimeMs: -1}, {maxTraceEvents: 0}, {maxScheduledInputs: 0}]) {
        assert.throws(() => prepareTargetSimulation('pico', fixture));
    }
});

test('prepared fixtures copy mutable inputs and create isolated fresh state', () => {
    const fixture = {schemaVersion: 1, pins: ['D13', 'D2'], maxRequests: 50,
        inputs: [{pin: 'D2', value: 1, atMs: 3}]};
    const prepared = prepareTargetSimulation('nano', fixture);
    assert.equal(prepared.maxRequests, 50);
    assert.equal(prepared.target, resolveBoardTarget('arduino-nano'));
    assert.equal(Object.isFrozen(prepared), true);
    fixture.pins[0] = 'A6';
    fixture.inputs[0].value = 0;
    fixture.inputs.push({pin: 'D2', value: 0, atMs: 3});
    const first = prepared.createHost();
    const second = prepared.createHost();
    try {
        first.pinMode(13, 'output');
        first.digitalWrite(13, 1);
        first.delay(3);
        assert.equal(first.digitalRead(2), 1);
        assert.equal(second.millis(), 0);
        assert.equal(second.pendingInputs, 1);
        assert.deepEqual(second.trace, []);
        second.pinMode(13, 'output');
        assert.equal(second.digitalRead(13), 0);
        assert.equal(first.digitalRead(13), 1);
    } finally { first.dispose(); second.dispose(); }
});

test('profile wrapper preserves atomic trace/time budgets and disposal', () => {
    const host = createTargetSimulationHost('pico', {pins: ['GP25'], maxTraceEvents: 2, maxTimeMs: 3});
    host.pinMode('GP25', 'output');
    host.digitalWrite('GP25', 1);
    assert.throws(() => host.digitalToggle('GP25'), code('trace-limit'));
    assert.throws(() => host.delay(4), code('time-limit'));
    assert.equal(host.millis(), 0);
    assert.deepEqual(host.trace.map(event => event.type), ['pin-mode', 'digital-write']);
    host.dispose();
    assert.throws(() => host.digitalWrite('GP25', 0), code('disposed'));
    assert.equal(host.trace[1].value, 1);
});
