import {newMachineConfig} from './machine-config.js';

const HDD_BYTES = 306 * 4 * 17 * 512;
const FLOPPY_BYTES = new Set([360 * 1024, 1200 * 1024]);

/** One-shot local media for the board's named, type-1 FreeDOS/VGA profile. */
export function localFreedosVgaMachine({hdd = null, floppy = null, bios = null,
    vgaRom = null, nativeBlocks = false} = {}) {
    if (!hdd && !floppy) throw new Error('select a hard disk or floppy image');
    if (hdd && hdd.size !== HDD_BYTES) {
        throw new Error('FreeDOS VGA profile needs a 306×4×17 hard-disk image');
    }
    if (floppy && !FLOPPY_BYTES.has(floppy.size)) {
        throw new Error('FreeDOS VGA profile needs a 360KB or 1.2MB floppy image');
    }
    if (bios && bios.size !== 0x10000) {
        throw new Error('AT BIOS must be a 64KB ROM image');
    }
    if (vgaRom && (!Number.isSafeInteger(vgaRom.size) || vgaRom.size < 1 ||
        vgaRom.size > 0xa000)) {
        throw new Error('VGA option ROM must fit C0000-C9FFF');
    }
    const slots = {};
    if (floppy) slots.floppy = {url: 'local-media:floppy',
        geometry: {cylinders: floppy.size === 1200 * 1024 ? 80 : 40,
            heads: 2, sectors: floppy.size === 1200 * 1024 ? 15 : 9,
            bytesPerSector: 512}};
    if (hdd) slots.hdd = {url: 'local-media:hdd',
        geometry: {cylinders: 306, heads: 4, sectors: 17}};
    if (bios) slots.bios = {url: 'local-media:bios'};
    if (vgaRom) slots['vga-rom'] = {url: 'local-media:vga-rom'};
    return newMachineConfig({
        title: floppy?.name || hdd?.name || 'FreeDOS VGA',
        machine: 'i80386', machineConfig: 'freedos-vga', executionMode: 'functional',
        nativeBlocks,
        bios: {kind: bios ? 'supplied' : 'bochs-lgpl'},
        video: {kind: 'vga', optionRom: vgaRom ? 'supplied' : 'seavgabios-lgpl'},
        slots, bootOrder: [floppy ? 'floppy' : 'hdd',
            ...(hdd && floppy ? ['hdd'] : [])],
        widgets: [{name: 'AT VGA', type: 'simplevga', source: 'video',
            config: {width: 640, height: 480}}],
        provenance: {source: 'local-freedos-vga'},
    });
}

/** Start the virtual AT at POST without a boot disk. */
export function localAtBiosMachine({bios = null, vgaRom = null} = {}) {
    if (bios && bios.size !== 0x10000) throw new Error('AT BIOS must be a 64KB ROM image');
    if (vgaRom && (vgaRom.size < 1 || vgaRom.size > 0xa000)) {
        throw new Error('VGA option ROM must fit C0000-C9FFF');
    }
    return newMachineConfig({
        title: bios?.name || '386 AT BIOS',
        machine: 'i80386', executionMode: 'functional',
        slots: {bios: {url: bios ? 'local-media:bios' : 'static/roms/free-386-bochs-bios.rom'},
            ...(vgaRom ? {'vga-rom': {url: 'local-media:vga-rom'}} : {})},
        bootOrder: ['bios'],
        widgets: [{name: 'AT VGA', type: 'simplevga', source: 'video',
            config: {width: 640, height: 480}}],
    });
}
