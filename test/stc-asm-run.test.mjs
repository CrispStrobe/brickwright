import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopeAfter} from './helpers/js-scope.mjs';
import {stcRunFor, stcAssemblyFirmware, validate8051Hex, stcFirmwareConfig}
    from '../overlay/scratch-gui/src/lib/bw-asm/stc-image.js';

// MOV A,#42; SJMP $ — a complete addressed image, not a mocked binary blob.
const hex = ':04000000742A80FE E0'.replace(' ', '') + '\n:00000001FF\n';
const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');

test('STC firmware preserves the exact HEX and selected part/clock', () => {
    for (const target of ['stc12c5a60s2', 'stc12c5a16s2', 'stc15f2k60s2', 'stc15w408as', 'stc89c52rc']) {
        const detail = stcAssemblyFirmware({target, bytes: new TextEncoder().encode(hex)}, 12000000);
        assert.equal(detail.kind, 'emulator');
        assert.equal(detail.format, 'firmware');
        assert.equal(detail.firmware.text, hex);
        assert.deepEqual(stcFirmwareConfig({device: 'stc12c5a60s2', clock: 11059200},
            {device: detail.firmware.device, f_cpu: detail.firmware.fCpu}),
        {device: target, clock: 12000000, pins: []});
    }
    assert.equal(stcRunFor('atmega328p'), false, 'AVR opcodes cannot reach the 8051 runner');
    assert.deepEqual(stcFirmwareConfig(null, {}), {device: 'stc12c5a60s2', clock: 11059200, pins: []});
});

test('invalid HEX cannot boot a plausible but different program', () => {
    assert.equal(validate8051Hex(hex), 4);
    for (const bad of [hex.replace('2A', '2B'), hex.replace(':04', ':05'),
        hex.replace('74', 'GG'), ':00000001FF', hex.split('\n')[0], hex + hex,
        ':020000040001F9\n' + hex, ':020000020001FB\n' + hex]) {
        assert.throws(() => stcAssemblyFirmware({target: 'stc15w408as', bytes: new TextEncoder().encode(bad)}));
    }
});

test('the actual Assemble & Run method publishes loadable STC firmware and opens the debugger', async () => {
    const events = [];
    const window = {dispatchEvent: event => events.push(event)};
    const localStorage = {setItem: (key, value) => events.push({key, value})};
    const CustomEvent = class { constructor (type, options) { this.type = type; this.detail = options.detail; } };
    const component = {
        state: {buffers: {asm: 'mov a,#42'}, asmDialect: 'auto'},
        _asmDevice: () => 'stc15w408as', currentStc: () => ({clock: 12000000}),
        L: {asmRouteHosted: 'hosted', asmAssembling: x => x, asmBuiltArm: () => 'running',
            asmSourceError: (_r, e) => e, asmTransportError: (_r, e) => e},
        setState (patch) { Object.assign(this.state, patch); }
    };
    const method = new Function('requestAssembly', 'asmTargetForDevice', 'asmRouteFor', 'stcRunFor',
        'stcAssemblyFirmware', 'window', 'localStorage', 'CustomEvent',
        `return async function () ${scopeAfter(source, 'async assembleAndRun () {')}`)(
        async () => ({target: 'stc15w408as', bytes: new TextEncoder().encode(hex), warnings: []}),
        d => d, () => 'hosted', stcRunFor, stcAssemblyFirmware, window, localStorage, CustomEvent);
    await method.call(component);
    assert.equal(component.state.busy, false);
    assert.equal(component.state.status, 'running');
    const delivery = events.find(event => event.type === 'bw-asm-rom-ready');
    assert.ok(delivery, 'the former build-only branch never delivered this event');
    assert.equal(delivery.detail.firmware.device, 'stc15w408as');
    assert.equal(delivery.detail.firmware.text, hex);
    assert.equal(window.__bwPendingMedia.detail, delivery.detail, 'a cold debugger replays the same image');
    assert.ok(events.some(event => event.type === 'bw-settings-change' && event.detail.key === 'bw-right-pane-hidden'));
});

test('the debugger consumes firmware identity and oscillator before selecting the native part', () => {
    const runner = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js', import.meta.url), 'utf8');
    assert.match(runner, /device: fw\.device \|\| null/);
    assert.match(runner, /stcFirmwareConfig\(projectStc\(null\), built\)/);
    assert.match(runner, /part: String\(stc\.device \|\| ''\)\.toLowerCase\(\)/);
});
