const picoFlashBytes = 2 * 1024 * 1024;
const sector = 4096;
const maxSavedBytes = 512 * 1024;
const projectStorage = new WeakMap();

export function picoFlashStorageFor (partition, sha256) {
    if (partition == null) return null;
    const {offset, length} = partition;
    if (!/^[a-f0-9]{64}$/i.test(sha256 || '') || !Number.isInteger(offset) || !Number.isInteger(length) ||
        offset <= 0 || offset % sector || length <= 0 || length % sector || offset + length > picoFlashBytes) {
        throw new Error('Invalid Pico flash storage partition.');
    }
    return {offset, length, sha256: sha256.toLowerCase()};
}

const keyFor = ({sha256, offset, length}) => `${sha256}:${offset}:${length}`;

// A re-run within a project loads a fresh CPU and the reviewed firmware.
// Copy only its declared filesystem partition, never the executable flash.
export function mountPicoFlashStorage (project, flash, imageLength, partition, onChange) {
    if (!project || !partition) return null;
    const layout = picoFlashStorageFor(partition, partition.sha256);
    const {offset, length} = layout;
    if (offset < imageLength || offset + length > flash.length) {
        throw new Error('Pico flash storage overlaps the firmware or lies outside flash.');
    }
    let entries = projectStorage.get(project);
    if (!entries) {
        entries = new Map();
        projectStorage.set(project, entries);
    }
    const key = keyFor(layout);
    const bytes = flash.subarray(offset, offset + length);
    const previous = entries.get(key);
    if (previous) bytes.set(previous.bytes);
    const entry = {layout, bytes};
    entries.set(key, entry);
    let last = bytes.slice();
    let nextCheck = 0;
    const check = () => {
        if (projectStorage.get(project) !== entries || entries.get(key) !== entry) return;
        if (bytes.some((byte, index) => byte !== last[index])) {
            last = bytes.slice();
            onChange?.();
        }
    };
    return {
        tick (now) {
            if (now < nextCheck) return;
            nextCheck = now + 1000;
            check();
        },
        dispose () {
            check();
            entry.bytes = last;
        }
    };
}

/** Serialize a live Stage so Save works while the emulator is still running. */
export function capturePicoFlashProject (project) {
    const partitions = [];
    let total = 0;
    for (const {layout, bytes} of projectStorage.get(project)?.values() || []) {
        if (bytes.every(byte => byte === 0xff)) continue;
        total += bytes.length;
        if (total > maxSavedBytes) throw new Error('Pico flash storage exceeds 512 KiB per project.');
        const chunks = [];
        for (let i = 0; i < bytes.length; i += sector) {
            chunks.push(String.fromCharCode(...bytes.subarray(i, i + sector)));
        }
        partitions.push({...layout, data: btoa(chunks.join(''))});
    }
    return partitions.length ? {partitions} : undefined;
}

/** Validate and decode before any part of an incoming project is installed. */
export function decodePicoFlashProject (record) {
    const entries = new Map();
    let total = 0;
    if (!Array.isArray(record?.partitions)) throw new Error('Pico flash storage must contain partitions.');
    for (const item of record.partitions) {
        const layout = picoFlashStorageFor(item, item?.sha256);
        if (!layout) throw new Error('Invalid Pico flash storage partition.');
        const {length} = layout;
        total += length;
        if (total > maxSavedBytes) throw new Error('Pico flash storage exceeds 512 KiB per project.');
        const key = keyFor(layout);
        if (entries.has(key) || typeof item.data !== 'string' || item.data.length !== 4 * Math.ceil(length / 3)) {
            throw new Error('Invalid Pico flash storage data.');
        }
        const decoded = atob(item.data);
        if (decoded.length !== length || btoa(decoded) !== item.data) throw new Error('Invalid Pico flash storage data.');
        entries.set(key, {layout, bytes: Uint8Array.from(decoded, ch => ch.charCodeAt(0))});
    }
    return entries;
}

export function restorePicoFlashProject (project, partitions) {
    if (!project) return;
    if (partitions?.size) projectStorage.set(project, new Map(partitions));
    else projectStorage.delete(project);
}
