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
        bits, clusters, rootEntries, start, sectorSize, reserved, copies, fatSectors, activeFat,
        mirrored: !(flags & 0x80),
        fsInfo: bits === 32 ? u16(48) : 0,
        backupBoot: bits === 32 ? u16(50) : 0,
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

function openFat (bytes) {
    if (bytes.length > XKIM_FAT_IMAGE_LIMIT) fail('choose an image up to 128 MiB.');
    const disk = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const volume = locateVolume(disk);
    if (!volume) fail('choose a valid FAT12, FAT16 or FAT32 volume.');
    const {bits, clusters, rootEntries, rootCluster, rootOffset, dataOffset, clusterSize, fatOffset} = volume;
    const endOfChain = {12: 0xff8, 16: 0xfff8, 32: 0x0ffffff8}[bits];
    const lastCluster = Math.min(clusters + 1, endOfChain - 9);
    const clusterOffset = cluster => dataOffset + (cluster - 2) * clusterSize;

    const nextCluster = cluster => {
        if (bits === 32) return disk.getUint32(fatOffset + cluster * 4, true) & 0x0fffffff;
        if (bits === 16) return disk.getUint16(fatOffset + cluster * 2, true);
        const pair = disk.getUint16(fatOffset + cluster + (cluster >> 1), true);
        return cluster & 1 ? pair >> 4 : pair & 0xfff;
    };
    function* chain (cluster, label) {
        const seen = new Set();
        while (true) {
            if (cluster < 2 || cluster > lastCluster || seen.has(cluster)) fail(`invalid cluster chain for ${label}.`);
            seen.add(cluster);
            yield cluster;
            cluster = nextCluster(cluster);
            if (cluster >= endOfChain) return;
        }
    }
    function* slots (directory, visitedClusters) {
        if (directory === 0 && bits !== 32) {
            for (let index = 0; index < rootEntries; index++) yield rootOffset + index * 32;
        } else {
            for (const cluster of chain(directory || rootCluster, 'a directory')) {
                if (visitedClusters?.has(cluster)) fail('directories share allocated clusters.');
                visitedClusters?.add(cluster);
                const start = clusterOffset(cluster);
                for (let offset = start; offset < start + clusterSize; offset += 32) yield offset;
            }
        }
    }
    const firstCluster = offset => {
        const high = bits === 32 ? (disk.getUint16(offset + 20, true) & 0xfff) : 0;
        return high * 65536 + disk.getUint16(offset + 26, true);
    };
    const fileChain = (entry, name) => {
        const list = [];
        const needed = Math.ceil(entry.size / clusterSize);
        if (entry.cluster || needed) {
            for (const cluster of chain(entry.cluster, name)) {
                if (needed && list.length === needed) fail(`unexpected extra clusters for ${name}.`);
                list.push(cluster);
            }
        }
        if (list.length < needed) fail(`truncated cluster chain for ${name}.`);
        return list;
    };
    const files = new Map();
    const directories = new Set();
    let totalBytes = 0;
    for (const offset of slots(0)) {
        if (bytes[offset] === 0) break;
        const attr = bytes[offset + 11];
        if (bytes[offset] === 0xe5 || (attr & 8)) continue;
        const stem = readShortName(bytes, offset, 8);
        const extension = readShortName(bytes, offset + 8, 3);
        const shortName = extension ? `${stem}.${extension}` : stem;
        if (!XKIM_SHORT_NAME.test(shortName)) continue;
        const name = shortName.toUpperCase();
        if (attr & 16) {
            directories.add(name);
            continue;
        }
        if (files.has(name)) fail(`duplicate filename ${name}.`);
        const size = disk.getUint32(offset + 28, true);
        if (size > XKIM_FILE_LIMIT) fail(`${name} exceeds the 64 KiB file limit.`);
        totalBytes += size;
        if (files.size >= XKIM_FILE_COUNT || totalBytes > XKIM_TOTAL_LIMIT) {
            fail('the root files exceed 64 files or 2 MiB in total.');
        }
        files.set(name, {offset, size, cluster: firstCluster(offset)});
    }
    return {volume, disk, files, directories, nextCluster, chain, slots, firstCluster, fileChain, clusterOffset,
        endOfChain, lastCluster};
}

export function readXkimFatImage (bytes) {
    const fat = openFat(bytes);
    const {clusterSize} = fat.volume;
    return Array.from(fat.files, ([name, entry]) => {
        const data = new Uint8Array(entry.size);
        if (!entry.size) return {name, bytes: data};
        let position = 0;
        for (const cluster of fat.fileChain(entry, name)) {
            const source = fat.clusterOffset(cluster);
            const take = Math.min(clusterSize, entry.size - position);
            data.set(bytes.subarray(source, source + take), position);
            position += take;
        }
        return {name, bytes: data};
    });
}

function checkReplacedChains (bytes, fat, changes) {
    const replacedEntries = new Set();
    const predecessors = new Map();
    for (const {entry, chain} of changes) {
        if (!chain.length) continue;
        replacedEntries.add(entry.offset);
        chain.forEach((cluster, index) => {
            if (predecessors.has(cluster)) fail('files share allocated clusters.');
            predecessors.set(cluster, chain[index - 1]);
        });
    }
    if (!predecessors.size) return;
    const pendingDirectories = [0];
    const seenDirectories = new Set();
    const visitedClusters = new Set();
    if (predecessors.has(fat.volume.rootCluster)) fail('a file shares the root directory.');
    for (const directory of pendingDirectories) {
        if (seenDirectories.has(directory)) fail('directories share allocated clusters.');
        seenDirectories.add(directory);
        for (const offset of fat.slots(directory, visitedClusters)) {
            if (bytes[offset] === 0) break;
            const attr = bytes[offset + 11];
            if (bytes[offset] === 0xe5 || bytes[offset] === 0x2e || (attr & 8) || replacedEntries.has(offset)) continue;
            const cluster = fat.firstCluster(offset);
            if (predecessors.has(cluster)) fail('files share allocated clusters.');
            if (attr & 16) {
                if (!cluster) fail('a directory has no first cluster.');
                pendingDirectories.push(cluster);
            }
        }
    }
    for (let cluster = 2; cluster <= fat.lastCluster; cluster++) {
        const next = fat.nextCluster(cluster);
        if (predecessors.has(next) && predecessors.get(next) !== cluster) fail('files share allocated clusters.');
    }
}

function updateFsInfo (fat) {
    const {disk, volume, nextCluster, lastCluster} = fat;
    const {fsInfo, backupBoot, reserved, start, sectorSize} = volume;
    if (!fsInfo) return;
    let freeCount = 0;
    let firstFree = 0xffffffff;
    for (let cluster = 2; cluster <= lastCluster; cluster++) {
        if (nextCluster(cluster)) continue;
        if (!freeCount) firstFree = cluster;
        freeCount++;
    }
    const sectors = backupBoot ? [fsInfo, backupBoot + fsInfo] : [fsInfo];
    for (const sector of sectors) {
        if (sector >= reserved) continue;
        const offset = start + sector * sectorSize;
        if (disk.getUint32(offset, true) !== 0x41615252 ||
            disk.getUint32(offset + 484, true) !== 0x61417272 ||
            disk.getUint32(offset + 508, true) !== 0xaa550000) continue;
        disk.setUint32(offset + 488, freeCount, true);
        disk.setUint32(offset + 492, firstFree, true);
    }
}

export function writeXkimFatImage (source, files) {
    const fat = openFat(source);
    const {bits, clusterSize, copies, fatOffset, fatSectors, sectorSize, activeFat, mirrored, rootCluster} = fat.volume;
    const changes = [];
    const names = new Set();
    let totalBytes = Array.from(fat.files.values()).reduce((total, entry) => total + entry.size, 0);
    let fileCount = fat.files.size;
    for (const file of files) {
        const name = file.name.toUpperCase();
        if (!XKIM_SHORT_NAME.test(file.name) || names.has(name)) fail('session files need unique 8.3 names.');
        names.add(name);
        if (file.bytes.length > XKIM_FILE_LIMIT) fail(`${name} exceeds the 64 KiB file limit.`);
        if (fat.directories.has(name)) fail(`${name} is already a directory.`);
        const entry = fat.files.get(name);
        totalBytes += file.bytes.length - (entry?.size ?? 0);
        if (!entry) fileCount++;
        if (entry?.size === 0 && !file.bytes.length) continue;
        const chain = entry ? fat.fileChain(entry, name) : [];
        if (entry?.size === file.bytes.length && chain.every((cluster, index) => {
            const offset = fat.clusterOffset(cluster);
            return file.bytes.subarray(index * clusterSize, (index + 1) * clusterSize)
                .every((byte, indexInCluster) => source[offset + indexInCluster] === byte);
        })) continue;
        changes.push({name, bytes: file.bytes, entry, chain});
    }
    if (fileCount > XKIM_FILE_COUNT || totalBytes > XKIM_TOTAL_LIMIT) {
        fail('the resulting root files exceed 64 files or 2 MiB in total.');
    }
    checkReplacedChains(source, fat, changes);
    const output = new Uint8Array(source);
    if (!changes.length) return output;
    const disk = new DataView(output.buffer);
    const resultFat = openFat(output);
    const setCluster = (cluster, next) => {
        const count = mirrored ? copies : 1;
        for (let copy = 0; copy < count; copy++) {
            const base = fatOffset + (mirrored ? copy - activeFat : 0) * fatSectors * sectorSize;
            if (bits === 32) {
                const offset = base + cluster * 4;
                disk.setUint32(offset, (disk.getUint32(offset, true) & 0xf0000000) | next, true);
            } else if (bits === 16) {
                disk.setUint16(base + cluster * 2, next, true);
            } else {
                const offset = base + cluster + (cluster >> 1);
                const pair = disk.getUint16(offset, true);
                disk.setUint16(offset, cluster & 1 ? (pair & 15) | (next << 4) : (pair & 0xf000) | next, true);
            }
        }
    };
    // Reclaim only clusters from files replaced in this export. The source stays intact if allocation fails.
    for (const change of changes) {
        for (const cluster of change.chain) setCluster(cluster, 0);
    }
    let free = 2;
    const allocate = () => {
        while (free <= fat.lastCluster && resultFat.nextCluster(free)) free++;
        if (free > fat.lastCluster) fail('there is not enough free space for the session files.');
        setCluster(free, fat.endOfChain);
        return free++;
    };
    function* availableSlots () {
        let pastEnd = false;
        for (const offset of resultFat.slots(0)) {
            if (output[offset] === 0) pastEnd = true;
            if (pastEnd || output[offset] === 0xe5) yield offset;
        }
    }
    const slots = availableSlots();
    const now = new Date();
    const year = Math.min(2107, Math.max(1980, now.getFullYear()));
    const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    let nextSlot = slots.next();
    let rootTail = 0;
    for (const change of changes) {
        let offset = change.entry?.offset;
        if (offset === undefined) {
            if (nextSlot.done) {
                if (bits !== 32) fail('the root directory is full.');
                if (!rootTail) {
                    for (const cluster of resultFat.chain(rootCluster, 'the root directory')) rootTail = cluster;
                }
                const newRoot = allocate();
                setCluster(rootTail, newRoot);
                rootTail = newRoot;
                offset = fat.clusterOffset(newRoot);
                output.fill(0, offset, offset + clusterSize);
                nextSlot = {done: false, value: offset};
            }
            offset = nextSlot.value;
            nextSlot = rootTail && offset + 32 < fat.clusterOffset(rootTail) + clusterSize ?
                {done: false, value: offset + 32} : slots.next();
            if (output[offset] === 0 && !nextSlot.done) output[nextSlot.value] = 0;
            output.fill(0, offset, offset + 32);
            const [stem, ext = ''] = change.name.split('.');
            const encoded = stem.padEnd(8, ' ') + ext.padEnd(3, ' ');
            for (let index = 0; index < 11; index++) output[offset + index] = encoded.charCodeAt(index);
            disk.setUint16(offset + 14, time, true);
            disk.setUint16(offset + 16, date, true);
            disk.setUint16(offset + 18, date, true);
        }
        let first = 0;
        let previous = 0;
        for (let position = 0; position < change.bytes.length; position += clusterSize) {
            const cluster = allocate();
            const dest = fat.clusterOffset(cluster);
            output.fill(0, dest, dest + clusterSize);
            output.set(change.bytes.subarray(position, position + clusterSize), dest);
            if (previous) setCluster(previous, cluster);
            else first = cluster;
            previous = cluster;
        }
        output[offset + 11] |= 0x20;
        if (bits === 32) disk.setUint16(offset + 20, first >>> 16, true);
        disk.setUint16(offset + 22, time, true);
        disk.setUint16(offset + 24, date, true);
        disk.setUint16(offset + 26, first & 0xffff, true);
        disk.setUint32(offset + 28, change.bytes.length, true);
    }
    updateFsInfo(resultFat);
    return output;
}
