// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import JSZip from 'jszip';
import {createXkimArchive, createXkimMemoryMap, readXkimMedia} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-xkim.js';

test('xKIM maps expansion RAM and ROM while retaining the original KIM reset vectors', () => {
    const rom = new Uint8Array(8192).fill(0xea);
    const map = createXkimMemoryMap(rom);
    const cell = address => Array.from(map.subarray(address * 2, address * 2 + 2));
    assert.deepEqual(cell(0x1700), [0, 1]);
    assert.deepEqual(cell(0x1ea0), [0, 1]);
    assert.deepEqual(cell(0x2000), [0, 2]);
    assert.deepEqual(cell(0xdfff), [0, 2]);
    assert.deepEqual(cell(0xe000), [0xea, 0]);
    assert.deepEqual(cell(0xfff9), [0xea, 0]);
    assert.deepEqual(cell(0xfffc), [0, 1]);
});

test('local xKIM media validates ROM size and case-insensitive 8.3 names', async () => {
    const rom = new Blob([new Uint8Array(8192)]);
    const text = new File(['hello'], 'intro.txt');
    const result = await readXkimMedia(rom, [text]);
    assert.deepEqual(result.files, [{name: 'intro.txt', bytes: new TextEncoder().encode('hello')}]);
    await assert.rejects(readXkimMedia(new Blob(), []), /8 KiB/);
    await assert.rejects(readXkimMedia(rom, [text, new File([], 'INTRO.TXT')]), /unique 8.3/);
    await assert.rejects(readXkimMedia(rom, [new File([], '../secret.txt')]), /unique 8.3/);
});

test('xKIM export preserves empty and binary files byte for byte', async () => {
    const files = [{name: 'EMPTY.TXT', bytes: new Uint8Array()}, {name: 'PROGRAM.BIN', bytes: Uint8Array.of(0, 255, 128)}];
    const blob = await createXkimArchive(files);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    for (const {name, bytes} of files) assert.deepEqual(await archive.file(name).async('uint8array'), bytes);
});
