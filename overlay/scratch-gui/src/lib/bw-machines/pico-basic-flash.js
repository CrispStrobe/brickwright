const picoFlashBytes = 2 * 1024 * 1024;
const sector = 4096;
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

// A re-run within a project loads a fresh CPU and the reviewed firmware.
// Copy only its declared filesystem partition, never the executable flash.
export function mountPicoFlashStorage (project, flash, imageLength, partition) {
    if (!project || !partition) return null;
    const {offset, length, sha256} = picoFlashStorageFor(partition, partition.sha256);
    if (offset < imageLength || offset + length > flash.length) {
        throw new Error('Pico flash storage overlaps the firmware or lies outside flash.');
    }
    let entries = projectStorage.get(project);
    if (!entries) {
        entries = new Map();
        projectStorage.set(project, entries);
    }
    const key = `${sha256}:${offset}:${length}`;
    const entry = {bytes: entries.get(key)?.bytes};
    if (entry.bytes) flash.set(entry.bytes, offset);
    entries.set(key, entry);
    return () => {
        if (entries.get(key) === entry) entry.bytes = flash.slice(offset, offset + length);
    };
}
