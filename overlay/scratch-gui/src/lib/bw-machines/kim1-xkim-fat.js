// SPDX-License-Identifier: BSD-3-Clause
// FAT BPB and directory layout: Microsoft FAT specification, version 1.03.
export const XKIM_FAT_IMAGE_LIMIT = 128 * 1024 * 1024;
export const XKIM_FILE_COUNT = 64;
export const XKIM_FILE_LIMIT = 64 * 1024;
export const XKIM_TOTAL_LIMIT = 2 * 1024 * 1024;
export const XKIM_SHORT_NAME = /^[a-z0-9_-]{1,8}(\.[a-z0-9_-]{1,3})?$/i;

const mbrFatTypes = new Set([0x01, 0x04, 0x06, 0x0b, 0x0c, 0x0e]);
const physicalSectorSize = 512;
const fail = reason => { throw new Error(`xKIM FAT image: ${reason}`); };

function readVolume (disk, start, end) {
    if (end - start < physicalSectorSize || disk.getUint16(start + 510, true) !== 0xaa55) return null;
    const jump = disk.getUint8(start);
    if (jump !== 0xe9 && (jump !== 0xeb || disk.getUint8(start + 2) !== 0x90)) return null;
    const u16 = offset => disk.getUint16(start + offset, true);
    const u32 = offset => disk.getUint32(start + offset, true);
    const sectorSize = u16(11);
    const sectorsPerCluster = disk.getUint8(start + 13);
    const reserved = u16(14);
    const copies = disk.getUint8(start + 16);
    const rootEntries = u16(17);
    const smallFat = u16(22);
    const fatSectors = smallFat || u32(36);
    const sectors = u16(19) || u32(32);
    if (![512, 1024, 2048, 4096].includes(sectorSize) || !sectorsPerCluster ||
        (sectorsPerCluster & (sectorsPerCluster - 1)) || sectorsPerCluster > 128 ||
        !reserved || !copies || !fatSectors || sectors * sectorSize > end - start) return null;

    const rootSector = reserved + copies * fatSectors;
    const dataSector = rootSector + Math.ceil(rootEntries * 32 / sectorSize);
    const clusters = Math.floor((sectors - dataSector) / sectorsPerCluster);
    if (clusters < 1) return null;
    const bits = clusters < 4085 ? 12 : clusters < 65525 ? 16 : 32;
    if (bits === 32 ? (rootEntries || smallFat || u16(42)) : (!rootEntries || !smallFat)) return null;
    const flags = bits === 32 ? u16(40) : 0;
    const activeFat = flags & 0x80 ? flags & 0x0f : 0;
    if (activeFat >= copies || Math.ceil((clusters + 2) * bits / 8) > fatSectors * sectorSize) return null;
    return {
        bits, clusters, rootEntries,
        rootCluster: bits === 32 ? u32(44) & 0x0fffffff : 0,
        rootOffset: start + rootSector * sectorSize,
        dataOffset: start + dataSector * sectorSize,
        clusterSize: sectorSize * sectorsPerCluster,
        fatOffset: start + (reserved + activeFat * fatSectors) * sectorSize
    };
}

function locateVolume (disk) {
    const wholeDisk = readVolume(disk, 0, disk.byteLength);
    if (wholeDisk) return wholeDisk;
    if (disk.byteLength < physicalSectorSize || disk.getUint16(510, true) !== 0xaa55) return null;
    const partitions = [];
    for (let index = 0; index < 4; index++) {
        const entry = 446 + index * 16;
        if (!mbrFatTypes.has(disk.getUint8(entry + 4))) continue;
        const start = disk.getUint32(entry + 8, true) * physicalSectorSize;
        const length = disk.getUint32(entry + 12, true) * physicalSectorSize;
        partitions.push({start, end: start + length});
    }
    if (partitions.length > 1) fail('choose an image with a single primary FAT partition.');
    const [partition] = partitions;
    if (!partition || !partition.start || partition.end > disk.byteLength) return null;
    return readVolume(disk, partition.start, partition.end);
}

const readShortName = (bytes, offset, length) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length)).replace(/ +$/, '');

export function readXkimFatImage (bytes) {
    if (bytes.length > XKIM_FAT_IMAGE_LIMIT) fail('choose an image up to 128 MiB.');
    const disk = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const volume = locateVolume(disk);
    if (!volume) fail('choose a valid FAT12, FAT16 or FAT32 volume.');
    const {bits, clusters, rootEntries, rootCluster, rootOffset, dataOffset, clusterSize, fatOffset} = volume;
    const endOfChain = {12: 0xff8, 16: 0xfff8, 32: 0x0ffffff8}[bits];

    const nextCluster = cluster => {
        if (bits === 32) return disk.getUint32(fatOffset + cluster * 4, true) & 0x0fffffff;
        if (bits === 16) return disk.getUint16(fatOffset + cluster * 2, true);
        const pair = disk.getUint16(fatOffset + cluster + (cluster >> 1), true);
        return cluster & 1 ? pair >> 4 : pair & 0xfff;
    };
    function* chain (cluster, label) {
        const seen = new Set();
        while (true) {
            if (cluster < 2 || cluster > clusters + 1 || cluster >= endOfChain - 8 || seen.has(cluster)) {
                fail(`invalid cluster chain for ${label}.`);
            }
            seen.add(cluster);
            yield dataOffset + (cluster - 2) * clusterSize;
            cluster = nextCluster(cluster);
            if (cluster >= endOfChain) return;
        }
    }

    const files = [];
    const names = new Set();
    let totalBytes = 0;
    const readDirectory = (start, length) => {
        for (let offset = start; offset < start + length; offset += 32) {
            if (bytes[offset] === 0) return false;
            if (bytes[offset] === 0xe5 || (bytes[offset + 11] & 0x18)) continue;
            const stem = readShortName(bytes, offset, 8);
            const extension = readShortName(bytes, offset + 8, 3);
            const name = (extension ? `${stem}.${extension}` : stem).toUpperCase();
            if (!XKIM_SHORT_NAME.test(name)) continue;
            if (names.has(name)) fail(`duplicate filename ${name}.`);
            const size = disk.getUint32(offset + 28, true);
            if (size > XKIM_FILE_LIMIT) fail(`${name} exceeds the 64 KiB file limit.`);
            totalBytes += size;
            if (files.length >= XKIM_FILE_COUNT || totalBytes > XKIM_TOTAL_LIMIT) {
                fail('the root files exceed 64 files or 2 MiB in total.');
            }
            const data = new Uint8Array(size);
            if (size) {
                const high = bits === 32 ? (disk.getUint16(offset + 20, true) & 0xfff) : 0;
                const cluster = high * 65536 + disk.getUint16(offset + 26, true);
                let position = 0;
                for (const source of chain(cluster, name)) {
                    const take = Math.min(clusterSize, size - position);
                    if (!take) fail(`unexpected extra clusters for ${name}.`);
                    data.set(bytes.subarray(source, source + take), position);
                    position += take;
                }
                if (position !== size) fail(`truncated cluster chain for ${name}.`);
            }
            names.add(name);
            files.push({name, bytes: data});
        }
        return true;
    };

    if (bits === 32) {
        for (const offset of chain(rootCluster, 'the root directory')) {
            if (!readDirectory(offset, clusterSize)) break;
        }
    } else {
        readDirectory(rootOffset, rootEntries * 32);
    }
    return files;
}
