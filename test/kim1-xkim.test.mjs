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

test('native FAT export streams bounded chunks, then finalizes or discards the staged image', async t => {
    const {saveXkimDiskImage} = await import('../overlay/scratch-gui/src/lib/bw-machines/kim1-xkim-download.js');
    const calls = [];
    const descriptors = Object.fromEntries(['window', 'FileReader'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    t.after(() => {
        for (const [key, descriptor] of Object.entries(descriptors)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    globalThis.window = {__TAURI__: {core: {invoke: async (command, args) => {
        calls.push({command, ...args});
    }}}};
    globalThis.FileReader = class {
        async readAsDataURL (blob) {
            this.result = 'data:application/octet-stream;base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64');
            this.onload();
        }
    };
    const bytes = new Uint8Array(700 * 1024).map((_, index) => index & 255);
    await saveXkimDiskImage('saved.img', bytes, () => true);
    const finish = calls.pop();
    assert.equal(finish.command, 'finish_fat_image_export');
    assert.equal(finish.size, bytes.length);
    assert.equal(finish.filename, 'saved.img');
    let position = 0;
    for (const call of calls) {
        assert.equal(call.command, 'stage_fat_image_chunk');
        assert.equal(call.id, finish.id);
        assert.equal(call.offset, position);
        const chunk = Buffer.from(call.data, 'base64');
        assert.ok(chunk.length <= 192 * 1024);
        assert.deepEqual(new Uint8Array(chunk), bytes.subarray(position, position += chunk.length));
    }
    assert.equal(position, bytes.length);
    calls.length = 0;
    await saveXkimDiskImage('cancelled.img', bytes, () => calls.length === 0);
    assert.deepEqual(calls.map(call => call.command), ['stage_fat_image_chunk', 'discard_fat_image_export']);
    assert.equal(calls[0].id, calls[1].id);
});
