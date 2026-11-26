import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {BoardImpl} from 'bw-board/board.js';
import {inferNetlist, checkWiring} from 'bw-board/infer-netlist.js';
import {getDevice} from 'bw-board/devices.js';
import {registerAllDevices} from 'bw-board/register-all.js';
import {ControllerPanel} from 'bw-board/controller.js';
import {bindPanelToBoard} from 'bw-board/controller-binding.js';
import {createM6502Adapter} from 'bw-board/m6502-adapter.js';
import {extract6502Machine} from 'bw-board/m6502-extract.js';
import {warningsBadge, warningsView} from '../overlay/scratch-gui/src/lib/circuit-panels-model.js';

import {MS_PROFILE} from 'bw-board/basic-machine-runner.js';
import {createBasicStartup, isBundledMicrosoftBasic} from '../overlay/scratch-gui/src/lib/bw-debug/basic-startup.js';

import {mirrorBasicSerialOnVga} from '../overlay/scratch-gui/src/lib/bw-debug/basic-vga-mirror.js';
import {addCardiacFace, hasCardiacFace} from '../overlay/scratch-gui/src/lib/controller-machine-faces.js';

const require = createRequire(import.meta.url);
const cui = new URL('file://' + require.resolve('bw-circuit-ui'));
const {Circuit} = await import(new URL('./model/circuit.js', cui));
const {setEngine} = await import(new URL('./engine.js', cui));
const {flatWire} = await import(new URL('./model/wire-endpoints.js', cui));
const {find6502LcdWiring, make6502LcdHelloRom} =
    await import(new URL('./model/m6502-lcd-preset.js', cui));
registerAllDevices();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice});

const examples = new URL('../overlay/scratch-gui/examples/', import.meta.url);
const roms = new URL('../overlay/scratch-gui/static/roms/', import.meta.url);
const json = (base, path) => JSON.parse(readFileSync(new URL(path, base)));
const index = json(examples, 'index.json');
function bench(id) {
    const files = index.find(item => item.id === id).files;
    const circuit = Circuit.fromJSON(json(examples, files.circuit));
    assert.equal(circuit.netlistError, null);
    const result = extract6502Machine({
        parts: circuit.parts, wires: circuit.wires.map(flatWire)
    });
    assert.equal(result.ok, true, result.reasons.join(', '));
    const config = {clockHz: 1_000_000, regions: result.regions, chips: result.chips};
    return {files, circuit, config, result};
}

function consoleMachine(config, startup) {
    const rom = readFileSync(new URL('basic.rom', roms));
    const adapter = createM6502Adapter({rom, config});
    adapter.attachBoard({setPin() {}});
    let output = '';
    adapter.onSerial(byte => { output += String.fromCharCode(byte & 0x7f); });
    return {
        adapter,
        line(input) {
            for (const char of input + '\r') assert.equal(adapter.sendSerial(char.charCodeAt(0)), true);
        },
        waitFor(text) {
            for (let step = 0; step < 160 && !output.includes(text); step++) {
                adapter.advanceNs(50_000_000);
                startup?.answer(output.split('\n').at(-1), value => adapter.sendSerial(value.charCodeAt(0)));
            }
            assert.ok(output.includes(text), output);
            output = '';
        }
    };
}

test('the supplied BASIC ROM reproduces startup syntax errors and reaches OK on the extracted Aurora map', () => {
    const {config} = bench('aurora65-workstation');
    const serial = consoleMachine(config);
    serial.waitFor('MEMORY SIZE?');
    serial.line('PRINT 2+2');
    serial.waitFor('?SN ERROR');
    serial.line('');
    serial.waitFor('WIDTH?');
    serial.line('');
    serial.waitFor('OK');
    serial.line('PRINT 2+2');
    serial.waitFor(' 4');
});

test('the qualified BASIC image boots straight to OK with two ordered startup replies', async () => {
    const rom = readFileSync(new URL('basic.rom', roms));
    assert.equal(await isBundledMicrosoftBasic(rom), true);
    rom[0] ^= 1;
    assert.equal(await isBundledMicrosoftBasic(rom), false);
    const {config} = bench('aurora65-workstation');
    const startup = createBasicStartup(MS_PROFILE.bootPrompts);
    for (let boot = 0; boot < 2; boot++) {
        const serial = consoleMachine(config, startup);
        serial.waitFor('OK');
        serial.line('PRINT 2+2');
        serial.waitFor(' 4');
        startup.reset();
    }
});

test('BASIC leaves the VGA card unlocked and the ACIA preview yields to a real frame', () => {
    const {config} = bench('aurora65-workstation');
    const serial = consoleMachine(config, createBasicStartup(MS_PROFILE.bootPrompts));
    serial.waitFor('OK');
    serial.line('PRINT 2+2');
    serial.waitFor(' 4');
    const card = serial.adapter.machine.chips.vga;
    assert.equal(card.videoFrame().signal, false);

    const hardware = {width: 160, height: 128, signal: false, frame: 0};
    const display = {videoFrame: () => hardware};
    const rendered = [];
    const canvas = {getContext: () => ({
        measureText: () => ({width: 5}), fillRect() {},
        fillText(text) { rendered.push(text); },
        getImageData: () => ({data: new Uint8ClampedArray(160 * 128 * 4)})
    })};
    const lines = ['MICROSOFT BASIC V1.1', 'OK'];
    mirrorBasicSerialOnVga(display, () => lines, () => canvas);
    const first = display.videoFrame();
    assert.deepEqual(rendered, ['ACIA serial mirror', ...lines]);
    assert.equal(first.signal, true);
    assert.equal(hardware.signal, false);
    assert.equal(display.videoFrame(), first);
    lines.push('PRINT 2+2', ' 4', 'OK');
    assert.notEqual(display.videoFrame().frame, first.frame);
    assert.ok(rendered.includes(' 4'));
    hardware.signal = true;
    assert.equal(display.videoFrame(), hardware);
});

test('a CARDIAC face uses the normal widget layout and serialization', () => {
    const panel = new ControllerPanel();
    panel.addWidget('cardiac', 'button', {}, {x: 24, y: 32, h: 64});
    const face = addCardiacFace(panel);
    assert.equal(face.name, 'cardiac1');
    assert.equal(face.layout.y, 112);
    panel.setWidgetLayout(face.name, {x: 96, y: 144});
    const restored = ControllerPanel.fromJSON(panel.toJSON());
    assert.equal(restored.getWidget(face.name).config.face, 'cardiac');
    assert.equal(restored.getWidget(face.name).layout.x, 96);
    assert.equal(addCardiacFace(restored), undefined);
    restored.removeWidget(face.name);
    assert.equal(hasCardiacFace(restored), false);
    assert.equal(restored.getWidget('cardiac').type, 'button');
});

test('BASIC startup ignores other lines, retries refused serial input and stops after width', () => {
    const startup = createBasicStartup(MS_PROFILE.bootPrompts);
    const calls = [];
    const send = accepted => value => { calls.push(value); return accepted; };
    startup.answer('WIDTH?', send(true));
    startup.answer('PRINT "MEMORY SIZE?"', send(true));
    startup.answer('MEMORY SIZE? ', send(false));
    startup.answer('MEMORY SIZE? ', send(true));
    startup.answer('MEMORY SIZE? ', send(true));
    startup.answer('WIDTH? ', send(true));
    startup.answer('WIDTH? ', send(true));
    assert.deepEqual(calls, ['\r', '\r', '\r']);
});

test('the actual display bench selects the four-bit ROM and mirrors physical LCD text into Controller', () => {
    const {files, circuit, config} = bench('eater6502-full-build');
    const lcd = find6502LcdWiring(circuit.parts, circuit.wires, config.chips);
    assert.deepEqual(lcd, {bits: 4, at: 0x6000});
    const {circuit: aurora, config: vgaConfig} = bench('aurora65-workstation');
    assert.equal(find6502LcdWiring(aurora.parts, aurora.wires, vgaConfig.chips), null);
    const panel = ControllerPanel.fromJSON(json(examples, files.controller));
    assert.equal(panel.mode, 'play');
    assert.deepEqual(panel.getWidget('LCD').binding, {target: 'part', partId: 'lcd'});
    const adapter = createM6502Adapter({rom: make6502LcdHelloRom(lcd.at), config});
    adapter.attachBoard(circuit.board);
    const binding = bindPanelToBoard(panel, circuit.board);
    try {
        adapter.advanceNs(41_000_000);
        binding.pumpDisplays();
        assert.match(circuit.board.getDeviceState('lcd').text[0], /HI BRICKWRIGHT/);
        assert.match(panel.getWidget('LCD').state.text, /HI BRICKWRIGHT/);
    } finally {
        binding.dispose();
    }
});

for (const [id, widgetName, partId, width, height] of [
    ['eater6502-vdp-hello', 'Video', 'vdp1', 256, 192],
    ['aurora65-workstation', 'vgaMonitor', 'vga', 160, 128]
]) {
    test(id + ' boots the shipped ROM and paints its part-bound Controller display', () => {
        const {files, circuit, config} = bench(id);
        const panel = ControllerPanel.fromJSON(json(examples, files.controller));
        const widget = panel.getWidget(widgetName);
        assert.deepEqual(widget.binding, {target: 'part', partId});
        assert.equal(panel.mode, 'play');
        const adapter = createM6502Adapter({config, rom: readFileSync(new URL(files.rom, examples))});
        // Both framebuffers live on the machine bus. Retain the real board's
        // video state while leaving the unrelated electrical time advance out.
        const board = circuit.board;
        adapter.attachBoard({getDeviceState: id => board.getDeviceState(id), setPin() {}});
        const binding = bindPanelToBoard(panel, board);
        const hasPicture = () => widget.state.signal && widget.state.rgba?.some((value, i) => i % 4 !== 3 && value > 30);
        try {
            for (let frame = 0; frame < 75 && !hasPicture(); frame++) {
                adapter.advanceNs(20_000_000);
                binding.pumpDisplays();
            }
            assert.ok(hasPicture(), 'the Controller should have live pixels');
            assert.equal(widget.config.width, width);
            assert.equal(widget.config.height, height);
        } finally {
            binding.dispose();
        }
    });
}

test('all five Aurora decode findings survive as notes while real wiring faults earn a warning badge', () => {
    const {result} = bench('aurora65-workstation');
    assert.equal(result.notes.length, 5);
    assert.match(result.notes.join('\n'), /4096 addresses decode to nothing/);
    const warnings = result.notes.map(explanation => ({severity: 'info', explanation}));
    assert.equal(warningsBadge({warnings}), null);
    assert.equal(warningsView('en', {warnings}).warnings.length, 5);
    assert.deepEqual(warningsBadge({warnings: [...warnings, {severity: 'danger'}]}), {count: 1, danger: true});
});

test('the library lists ROM projects and all six CARDIAC programs under their actual targets', async () => {
    const {libraryCircuitPrograms} = await import('../overlay/scratch-gui/src/lib/bw-machines/library-circuits.js');
    const programs = libraryCircuitPrograms(index);
    assert.equal(programs.find(program => program.id === 'eater6502-vdp-hello').machine, 'eater6502');
    assert.equal(programs.find(program => program.id === 'kim1-wired-io').machine, 'kim1');
    assert.equal(programs.filter(program => program.machine === 'cardiac').length, 6);
    assert.equal(programs.find(program => program.id === 'cardiac-echo').codeOnly, true);
    assert.equal(programs.find(program => program.id === 'cardiac-night-light').codeOnly, false);
});
