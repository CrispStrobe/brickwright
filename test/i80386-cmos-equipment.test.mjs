import {test} from 'node:test';
import assert from 'node:assert/strict';
import {i80386FloppyCmos, withI80386MouseCmos} from '../overlay/scratch-gui/src/lib/bw-machines/i80386-cmos.js';

const image = chip => {
    const bytes = new Uint8Array(0x40);
    for (const [index, value] of chip.initialCmos) bytes[index] = value;
    return bytes;
};
const checksum = bytes => bytes.slice(0x10, 0x2e).reduce((sum, value) => sum + value, 0) & 0xffff;
const rtc = equipment => ({kind: 'rtc', initialCmos: [[0x14, equipment], [0x15, 0x80], [0x16, 0x02]]});

test('mouse advertisement preserves every other equipment bit', () => {
    for (let equipment = 0; equipment <= 0xff; equipment++) {
        const before = rtc(equipment);
        const frozen = structuredClone(before);
        const [after] = withI80386MouseCmos([before]);
        const bytes = image(after);
        assert.equal(bytes[0x14], equipment | 0x04, `equipment 0x${equipment.toString(16)}`);
        assert.equal(bytes[0x2e] << 8 | bytes[0x2f], checksum(bytes));
        assert.deepEqual(before, frozen, 'input CMOS is immutable');
    }
});

test('explicit equipment overrides retain floppy, display and coprocessor flags', () => {
    const input = rtc(0x01);
    const overrides = [[0x14, 0x63], [0x10, 0x44]];
    const frozen = structuredClone(overrides);
    const [after] = withI80386MouseCmos([input], overrides);
    const bytes = image(after);
    assert.equal(bytes[0x14], 0x67);
    assert.equal(bytes[0x10], 0x44);
    assert.equal(bytes[0x2e] << 8 | bytes[0x2f], checksum(bytes));
    assert.deepEqual(overrides, frozen);
    assert.equal(image(input)[0x14], 0x01);
});

test('default VGA profile keeps its floppy flag; empty equipment adds only the mouse', () => {
    assert.equal(image(withI80386MouseCmos([rtc(0x01)])[0])[0x14], 0x05);
    assert.equal(image(withI80386MouseCmos([rtc(0)])[0])[0x14], 0x04);
    assert.equal(image(withI80386MouseCmos([{kind: 'rtc', initialCmos: []}])[0])[0x14], 0x04);
});

test('unrelated chips and RTC settings survive mouse advertisement', () => {
    const vga = {kind: 'vga', name: 'vga1'};
    const input = rtc(0x01);
    input.initialCmos.push([0x3d, 0x21], [0x19, 47]);
    const [sameVga, after] = withI80386MouseCmos([vga, input]);
    assert.equal(sameVga, vga);
    assert.equal(image(after)[0x3d], 0x21);
    assert.equal(image(after)[0x19], 47);
    assert.notEqual(after, input);
});


test('the free AT BIOS boots a 1.44 MB floppy with its matching CMOS drive type', () => {
    const geometry = {cylinders: 80, heads: 2, sectors: 18, bytesPerSector: 512};
    assert.deepEqual(i80386FloppyCmos(geometry), [[0x10, 0x40], [0x3d, 0x01]]);
    assert.deepEqual(i80386FloppyCmos({...geometry, sectors: 15}), [[0x10, 0x20], [0x3d, 0x01]]);
});
