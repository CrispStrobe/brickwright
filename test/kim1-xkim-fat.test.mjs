// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readXkimFatImage, writeXkimFatImage, XKIM_FAT_IMAGE_LIMIT} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-xkim-fat.js';
import {readXkimMedia} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-xkim.js';

const encoder = new TextEncoder();
function makeFat (bits, partition = false) {
    const sectorSize = 512;
    const dataClusters = {12: 64, 16: 4100, 32: 65530}[bits];
    const fatSectors = Math.ceil((dataClusters + 2) * bits / 8 / sectorSize);
    const isFat32 = bits === 32;
    const reserved = isFat32 ? 32 : 1;
    const rootEntries = isFat32 ? 0 : 80;
    const rootSectors = rootEntries / 16;
    const fatCopies = isFat32 ? 2 : 1;
    const rootSector = reserved + fatSectors * fatCopies;
    const volumeSectors = rootSector + rootSectors + dataClusters;
    const start = partition ? 4 * sectorSize : 0;
    const bytes = new Uint8Array(start + volumeSectors * sectorSize);
    const view = new DataView(bytes.buffer);
    const word = (offset, value) => view.setUint16(start + offset, value, true);
    const long = (offset, value) => view.setUint32(start + offset, value, true);
    if (partition) {
        const entry = 446;
        bytes[entry + 4] = 6;
        view.setUint32(entry + 8, start / sectorSize, true);
        view.setUint32(entry + 12, volumeSectors, true);
        view.setUint16(510, 0xaa55, true);
    }
    bytes.set([0xeb, 0x3c, 0x90], start);
    word(11, sectorSize);
    bytes[start + 13] = 1;
    word(14, reserved);
    bytes[start + 16] = fatCopies;
    word(17, rootEntries);
    word(19, isFat32 ? 0 : volumeSectors);
    word(22, isFat32 ? 0 : fatSectors);
    word(510, 0xaa55);
    if (isFat32) {
        long(32, volumeSectors);
        long(36, fatSectors);
        word(40, 0x81);
        long(44, 2);
    }
    const clusterOffset = cluster => (rootSector + rootSectors + cluster - 2) * sectorSize;
    const fat = (cluster, value) => {
        const offset = (reserved + (isFat32 ? fatSectors : 0)) * sectorSize;
        if (isFat32) long(offset + cluster * 4, value);
        else if (bits === 16) word(offset + cluster * 2, value);
        else {
            const pair = offset + cluster + (cluster >> 1);
            const prior = view.getUint16(start + pair, true);
            word(pair, cluster & 1 ? (prior & 15) | value << 4 : (prior & 0xf000) | value);
        }
    };
    const eoc = {12: 0xfff, 16: 0xffff, 32: 0x0fffffff}[bits];
    let directory = rootSector * sectorSize;
    if (isFat32) {
        fat(2, 6);
        fat(6, eoc);
        bytes.fill(0xe5, start + directory, start + directory + sectorSize);
        directory = clusterOffset(6);
    }
    const entry = (index, name, attributes, cluster, size) => {
        const offset = directory + 32 * index;
        bytes.set(encoder.encode(name), start + offset);
        bytes[start + offset + 11] = attributes;
        word(offset + 26, cluster);
        long(offset + 28, size);
    };
    const payload = Uint8Array.from({length: 600}, (_, index) => index & 255);
    fat(3, 7);
    fat(7, eoc);
    bytes.set(payload.subarray(0, sectorSize), start + clusterOffset(3));
    bytes.set(payload.subarray(sectorSize), start + clusterOffset(7));
    entry(0, 'VOLUME     ', 0x08, 0, 0);
    fat(8, eoc);
    entry(1, 'SUBDIR     ', 0x10, 8, 0);
    entry(2, 'LONGNAME   ', 0x0f, 0, 0);
    fat(9, eoc);
    entry(3, 'HELLO~1 TXT', 0x20, 9, 1);
    entry(4, 'PROGRAM BIN', 0x20, 3, 600);
    fat(10, eoc);
    entry(5, 'EMPTY      ', 0x20, 10, 0);
    return {bytes, payload, fat, entry, eoc, start, clusterOffset};
}

for (const [bits, partition] of [[12, false], [16, true], [32, false]]) {
    test(`xKIM reads fragmented FAT${bits} root files ${partition ? 'inside an MBR partition' : 'from a volume image'}`, () => {
        const {bytes, payload} = makeFat(bits, partition);
        const files = readXkimFatImage(bytes);
        assert.deepEqual(files, [{name: 'PROGRAM.BIN', bytes: payload}, {name: 'EMPTY', bytes: new Uint8Array()}]);
        files[0].bytes[1] = 0;
        assert.equal(readXkimFatImage(bytes)[0].bytes[1], 1);
    });
}

test('xKIM rejects broken FAT chains, truncated disks, duplicate names and files over the guest limit', () => {
    const {bytes, fat, entry, eoc} = makeFat(12);
    fat(7, 3);
    assert.throws(() => readXkimFatImage(bytes), /invalid cluster chain for PROGRAM/);
    fat(3, eoc);
    assert.throws(() => readXkimFatImage(bytes), /truncated cluster chain for PROGRAM/);
    fat(3, 7);
    fat(7, eoc);
    entry(5, 'PROGRAM BIN', 0x20, 3, 600);
    assert.throws(() => readXkimFatImage(bytes), /duplicate filename PROGRAM/);
    entry(5, 'BIG     BIN', 0x20, 3, 65537);
    assert.throws(() => readXkimFatImage(bytes), /64 KiB file limit/);
    assert.throws(() => readXkimFatImage(bytes.subarray(0, 2048)), /valid FAT12/);
});

test('xKIM media validates image limits before reading and loads the extracted files', async () => {
    const rom = new Blob([new Uint8Array(8192)]);
    const {bytes, payload} = makeFat(12);
    const media = await readXkimMedia(rom, [], new Blob([bytes]));
    assert.deepEqual(media.files[0].bytes, payload);
    await assert.rejects(readXkimMedia(rom, [new File([], 'HELLO.TXT')], new Blob([bytes])), /either a single FAT image/);
    await assert.rejects(readXkimMedia(rom, [], {size: XKIM_FAT_IMAGE_LIMIT + 1}), /128 MiB/);
    await assert.rejects(readXkimMedia(rom, [], new Blob()), /valid FAT12/);
});

test('xKIM requires an unambiguous primary FAT partition and enforces the file-count quota', () => {
    const {bytes: partitioned} = makeFat(16, true);
    partitioned.set(partitioned.subarray(446, 462), 462);
    assert.throws(() => readXkimFatImage(partitioned), /single primary FAT partition/);

    const {bytes, entry} = makeFat(12);
    for (let index = 0; index < 65; index++) {
        entry(index, `FILE${String(index).padStart(4, '0')}TXT`, 0x20, 0, 0);
    }
    assert.throws(() => readXkimFatImage(bytes), /exceed 64 files/);
});

for (const [bits, partition] of [[12, false], [16, true], [32, false]]) {
    test(`xKIM saves changed and new files into a copy of FAT${bits}`, () => {
        const {bytes, start, clusterOffset, entry} = makeFat(bits, partition);
        entry(6, 'OTHER   TXT', 0x20, 0, 0);
        const before = bytes.slice();
        const files = [
            {name: 'PROGRAM.BIN', bytes: Uint8Array.of(42)},
            {name: 'EMPTY', bytes: Uint8Array.of(43)},
            {name: 'ADDED.HEX', bytes: new Uint8Array(900).fill(0xf3)}
        ];
        const updated = writeXkimFatImage(bytes, files);
        const result = new Map(readXkimFatImage(updated).map(file => [file.name, file.bytes]));
        const expected = new Map(files.map(file => [file.name, file.bytes]));
        expected.set('OTHER.TXT', new Uint8Array());
        assert.deepEqual(result, expected);
        assert.deepEqual(bytes, before);
        assert.deepEqual(updated.subarray(0, start + 512), before.subarray(0, start + 512));
        const directory = start + clusterOffset(8);
        assert.deepEqual(updated.subarray(directory, directory + 1024), before.subarray(directory, directory + 1024));
        assert.deepEqual(writeXkimFatImage(updated, readXkimFatImage(updated)), updated);
    });
}

test('xKIM grows a full FAT32 root across clusters and updates valid FSInfo hints', () => {
    const {bytes, entry} = makeFat(32);
    const disk = new DataView(bytes.buffer);
    disk.setUint16(48, 1, true);
    disk.setUint16(50, 6, true);
    for (const offset of [512, 7 * 512]) {
        disk.setUint32(offset, 0x41615252, true);
        disk.setUint32(offset + 484, 0x61417272, true);
        disk.setUint32(offset + 488, 65500, true);
        disk.setUint32(offset + 492, 2, true);
        disk.setUint32(offset + 508, 0xaa550000, true);
    }
    for (let index = 6; index < 16; index++) entry(index, `FILE000${index % 10}TXT`, 0x20, 0, 0);
    // Fill deleted slots in the previous root cluster with a volume entry, so there are no free slots.
    const firstRootOffset = (32 + 2 * Math.ceil(65532 * 4 / 512)) * 512;
    for (let offset = firstRootOffset; offset < firstRootOffset + 512; offset += 32) {
        bytes[offset] = 65;
        bytes[offset + 11] = 8;
    }
    const added = {name: 'NEW.TXT', bytes: Uint8Array.of(1)};
    const updated = writeXkimFatImage(bytes, [added]);
    const result = new DataView(updated.buffer);
    for (const offset of [512, 7 * 512]) {
        assert.equal(result.getUint32(offset + 488, true), 65521);
        assert.equal(result.getUint32(offset + 492, true), 11);
    }
    assert.deepEqual(readXkimFatImage(updated).at(-1), added);
});

test('xKIM leaves the original untouched if the directory is full or the replacement shares a cluster', () => {
    const {bytes, entry, fat} = makeFat(12);
    const changed = {name: 'PROGRAM.BIN', bytes: new Uint8Array()};
    entry(6, 'CROSSLNKBIN', 0x20, 7, 88);
    const crossed = bytes.slice();
    assert.throws(() => writeXkimFatImage(bytes, [changed]), /share allocated clusters/);
    assert.deepEqual(bytes, crossed);
    entry(6, 'ALLOCATED  ', 0x08, 0, 0);
    for (let index = 7; index < 80; index++) entry(index, 'ALLOCATED  ', 0x08, 0, 0);
    assert.throws(() => writeXkimFatImage(bytes, [{name: 'SAVE.HEX', bytes: Uint8Array.of(1)}]), /root directory is full/);
    for (let cluster = 2; cluster <= 65; cluster++) {
        if (![3, 7, 8, 9].includes(cluster)) fat(cluster, 0xff7);
    }
    assert.throws(() => writeXkimFatImage(bytes, [{...changed, bytes: new Uint8Array(1100)}]), /not enough free space/);
});
