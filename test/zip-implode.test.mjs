// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeZipImplode} from '../overlay/scratch-gui/src/lib/bw-machines/zip-implode.js';

const table = (symbols, length) => [symbols / 16 - 1, ...Array(symbols / 16).fill(0xf0 | (length - 1))];
const bits = (value, count) => Array.from({length: count}, (_, index) => (value >> index) & 1);
const packed = stream => stream.reduce((bytes, bit, index) => {
    const byte = index >> 3;
    bytes[byte] = (bytes[byte] || 0) | (bit << (index & 7));
    return bytes;
}, []);

test('ZIP implode decodes raw literals and overlapping 4 KiB dictionary matches', () => {
    const codes = table(64, 6);
    const tokens = packed([1, ...bits(65, 8), 0, ...bits(0, 6), ...bits(63, 6), ...bits(63, 6)]);
    const member = Uint8Array.from([...codes, ...codes, ...tokens]);
    assert.deepEqual(decodeZipImplode(member, 3, 0), Uint8Array.of(65, 65, 65));
    assert.throws(() => decodeZipImplode(member, 2, 0), /Invalid imploded/);
    assert.throws(() => decodeZipImplode(member.subarray(0, -1), 3, 0), /Invalid imploded/);
});

test('ZIP implode decodes coded literals with the 8 KiB dictionary flag', () => {
    const codes = table(64, 6);
    // With eight-bit codes of equal length, symbol 66 receives code 255 - 66 (MSB first).
    const tokens = packed([1, ...bits(255 - 66, 8).reverse()]);
    const member = Uint8Array.from([...table(256, 8), ...codes, ...codes, ...tokens]);
    assert.deepEqual(decodeZipImplode(member, 1, 6), Uint8Array.of(66));
    member[0] = 0;
    assert.throws(() => decodeZipImplode(member, 1, 6), /Invalid imploded/);
});
