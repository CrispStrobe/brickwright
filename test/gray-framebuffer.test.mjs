// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindGrayFramebufferToCircuit, capturePublishedFramebuffer, createGrayFramebufferVideo, grayFramebufferSpec} from '../overlay/scratch-gui/src/lib/bw-machines/gray-framebuffer.js';

test('65C02 grayscale video uses the chip stride and reuses unchanged frames', () => {
    const at = 0x3000;
    const spec = grayFramebufferSpec([{name: 'screen', kind: 'framebuffer', at, size: 6}],
        {chip: 'screen', at, width: 2, height: 2, stride: 3, format: 'gray8'});
    const data = Uint8Array.of(0, 64, 99, 128, 255, 200);
    const chip = {frame: 1, getFrame: () => data};
    const video = createGrayFramebufferVideo(chip, spec);
    const first = video();
    assert.deepEqual([...first.rgba], [0, 0, 0, 255, 64, 64, 64, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
    assert.equal(video(), first);
    data[0] = 4;
    chip.frame++;
    assert.equal(video().rgba[0], 4);
    assert.equal(first.rgba[0], 0);
});


test('a framebuffer window must fit inside the 65C02 address space', () => {
    const chip = {name: 'screen', kind: 'framebuffer', at: 0xfffe, size: 4};
    const spec = {chip: chip.name, at: chip.at, width: 2, height: 2, stride: 2, format: 'gray8'};
    assert.throws(() => grayFramebufferSpec([chip], spec), /Invalid 65C02 grayscale framebuffer/);
    assert.throws(() => grayFramebufferSpec([{...chip, at: undefined}], {...spec, at: undefined}), /Invalid 65C02/);
});


test('animation publishes only complete frames and follows the guest counter through wrap', () => {
    const mem = new Uint8Array(0x10000);
    const cpu = {write(address, value) { mem[address] = value; }};
    const gray = Uint8Array.of(0, 31, 99, 63, 0, 99);
    const source = {frame: 0, getFrame: () => gray};
    const spec = {width: 2, height: 2, stride: 3, format: 'gray6', publishAt: 0x200};
    const video = capturePublishedFramebuffer({cpu, mem}, source, spec);
    cpu.write(0x200, 0);
    assert.equal(video(), null);
    source.frame++;
    cpu.write(0x200, 1);
    const first = video();
    assert.deepEqual([...first.rgba], [0, 0, 0, 255, 125, 125, 125, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
    gray[0] = 63;
    source.frame++;
    cpu.write(0x201, 2);
    assert.equal(video(), first, 'painting the next frame leaves the last publication unchanged');
    cpu.write(0x200, 0);
    assert.equal(video(), first, 'a zeroing write is not a forward publication');
    mem[0x200] = 255;
    cpu.write(0x200, 0);
    assert.equal(video().rgba[0], 255);
    assert.equal(first.rgba[0], 0);
});

test('circuit video retains decoded devices, remaps ACIA by address and refuses incompatible circuits', () => {
    const regions = [{kind: 'ram', start: 0, end: 0x3fff}, {kind: 'rom', start: 0x8000, end: 0xffff}];
    const acia = {kind: 'acia', name: 'acia', at: 0x5000};
    const via = {kind: 'via', name: 'via', at: 0x6000};
    const framebuffer = {kind: 'framebuffer', name: 'screen', at: 0x3000, size: 2048};
    const media = {regions, chips: [{...acia, name: 'acia1'}, {...via, name: 'via1'}, framebuffer],
        pacedConsole: 'acia1', grayFramebuffer: {chip: 'screen', at: 0x3000, width: 64, height: 32, stride: 64, format: 'gray8'}};
    const circuit = {regions, chips: [acia, via]};
    const bound = bindGrayFramebufferToCircuit(circuit, media);
    assert.equal(bound.chips[0], acia);
    assert.equal(bound.chips[1], via);
    assert.equal(bound.chips[2], framebuffer);
    assert.equal(bound.pacedConsole, 'acia');
    assert.equal(circuit.chips.length, 2);
    assert.throws(() => bindGrayFramebufferToCircuit({...circuit, chips: [via]}, media), /does not match/);
    assert.throws(() => bindGrayFramebufferToCircuit({...circuit, regions: regions.slice(1)}, media), /does not match/);
});
