// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher, sha256Hex} from './activate.js';
import {localFreedosVgaMachine} from './local-freedos-vga.js';
import {newMachineConfig} from './machine-config.js';

const xtFloppyGeometry = cylinders => ({cylinders, heads: 2, sectors: 9, bytesPerSector: 512});

export function localFloppyMedia (config, bytes) {
    return {config, fetcher: ref => ref.url === 'local-media:floppy' ? {bytes} : defaultImageFetcher(ref)};
}

export function pcXtFloppy ({title, bytes, cylinders, provenance}) {
    const geometry = xtFloppyGeometry(cylinders);
    const config = newMachineConfig({
        title, machine: 'i8086', executionMode: 'functional', machineConfig: 'PCXT8086',
        slots: {floppy: {url: 'local-media:floppy', geometry}},
        bootOrder: ['floppy'], provenance,
        widgets: [{name: 'PC CGA', type: 'simplevga', source: 'video', config: {width: 720, height: 400}}]
    });
    return localFloppyMedia(config, bytes);
}

export async function readLibraryFloppy (file, {title, machine, localFloppy}, signal) {
    const {cylinders, sha256, name} = localFloppy;
    signal?.throwIfAborted();
    const geometry = xtFloppyGeometry(cylinders);
    const size = geometry.cylinders * geometry.heads * geometry.sectors * geometry.bytesPerSector;
    if (file?.size !== size) throw new Error(`Choose the original ${name} (${size / 1024} KiB).`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal?.throwIfAborted();
    if (bytes.length !== size || await sha256Hex(bytes) !== sha256) {
        throw new Error(`${name} checksum differs. Choose the original disk image.`);
    }
    signal?.throwIfAborted();
    if (machine === 'i80386') {
        return localFloppyMedia(localFreedosVgaMachine({floppy: {size: bytes.length, name: title}}), bytes);
    }
    return pcXtFloppy({title, bytes, cylinders, provenance: {source: 'local-verified-floppy'}});
}
