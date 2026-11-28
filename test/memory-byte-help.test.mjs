import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryByteHelp, memoryByteMarkerStyle}
    from '../overlay/scratch-gui/src/lib/bw-debug/memory-byte-help.js';

const snapshot = {flavor: '8051', regs: {psw: 0x10, sp: 0x30, dptr: 0x120, pc: 0x300}};
const help = (space, address, value = 0x41, extra = {}) =>
    memoryByteHelp({space, address, value, snapshot, ...extra});

test('byte help gives the actual value in three bases and printable ASCII', () => {
    const result = help('iram', 0x40);
    assert.match(result.title, /Hex: 41 · Decimal: 65 · Binary: 01000001/);
    assert.match(result.title, /ASCII: "A"/);
    assert.doesNotMatch(help('iram', 0x40, 0).title, /ASCII/);
});

test('register-bank markers follow PSW and never invent an active bank', () => {
    assert.deepEqual(help('iram', 0x13).markers, ['bank']);
    assert.match(help('iram', 0x13).title, /bank 2, R3 \(active\)/);
    assert.deepEqual(help('iram', 3).markers, []);
    assert.match(help('iram', 3).title, /bank 0, R3 \(inactive\)/);
    const unknown = help('iram', 3, 0, {snapshot: {flavor: '8051', regs: {}}});
    assert.deepEqual(unknown.markers, []);
    assert.doesNotMatch(unknown.title, /\(active\)/);
});

test('upper IRAM is explained separately from SFR and bit-space views', () => {
    assert.match(help('iram', 0x90).title, /indirect addressing/);
    assert.match(help('iram', 0x90).title, /selects SFR P1/);
    assert.match(help('sfr', 0x90).title, /Special function register: P1/);
    assert.match(help('sfr', 0x90).title, /Bit addresses: 90–97/);
    assert.match(help('iram', 0x21).title, /bit addresses: 08–0F/);
    assert.match(help('bit', 0x0b, 1).title, /Bit 3 in IRAM 0x21/);
    assert.match(help('bit', 0x93, 1).title, /Bit 3 in P1 \(0x90\)/);
});

test('pointer markers refer to the correct memory domain', () => {
    assert.deepEqual(help('iram', 0x30).markers, ['sp']);
    assert.deepEqual(help('xram', 0x120).markers, ['dptr']);
    assert.deepEqual(help('code', 0x300).markers, ['pc']);
    assert.deepEqual(help('code', 0x120).markers, []);
    assert.deepEqual(help('sfr', 0x30).markers, []);
    assert.equal(memoryByteMarkerStyle(['bank', 'sp']).borderBottom, '2px solid #f1c40f');
});

test('generic targets keep numeric byte help without 8051 register semantics', () => {
    const result = help('iram', 0x13, 0x41, {snapshot: {flavor: 'generic', regs: snapshot.regs}});
    assert.deepEqual(result.markers, []);
    assert.doesNotMatch(result.title, /bank|Register|SP|DPTR/);
    assert.match(result.title, /Decimal: 65/);
    assert.match(help('mem', 0xffffffff, 0xff, {snapshot: null}).title, /0xFFFFFFFF/);
});

test('German byte explanations and invalid observations remain truthful', () => {
    assert.match(help('iram', 0x90, 0xff, {locale: 'de'}).title, /Oberes internes RAM/);
    assert.match(help('iram', 0x30, 0, {locale: 'de'}).title, /SP zeigt hierher/);
    assert.deepEqual(help('iram', -1), {title: '', markers: []});
    assert.deepEqual(help('iram', 0, 256), {title: '', markers: []});
});
