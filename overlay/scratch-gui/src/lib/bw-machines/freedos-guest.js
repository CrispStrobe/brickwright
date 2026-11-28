// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher, sha256Hex} from './activate.js';
import {writeDosFloppyFiles} from './kim1-xkim-fat.js';
import {newMachineConfig} from './machine-config.js';
import {localFreedosVgaMachine} from './local-freedos-vga.js';

export const freedosFloppyZipUrl = 'https://download.freedos.org/1.4/FD14-FloppyEdition.zip';
const archiveBytes = 23624258;
const archiveHash = '45b1fa7c52dd996c3bfa5e352ffcd410781b952a6ad629f15a4c9ec4bbaefc5a';
const bootMedia = {
    i80386: {size: 1200 * 1024, member: '120m/x86BOOT.img',
        sha256: '03df6088be016e57a6c44275f5bb9ab0244db71de1360957fd76ba83243b6a77'},
    i8086: {size: 720 * 1024, member: '720k/x86BOOT.img',
        sha256: 'cbca90627b944319f02043bc41f1715ff5366b23e5e8e75aa3ca23bb564e0789'}
};

export const dosText = lines => new TextEncoder().encode([...lines, ''].join('\r\n'));

async function readFreedosFloppy (file, {size, member, sha256}) {
    if (file?.size !== size && file?.size !== archiveBytes) {
        throw new Error(`Choose ${member} or the official FreeDOS 1.4 Floppy Edition ZIP.`);
    }
    let source = new Uint8Array(await file.arrayBuffer());
    if (source.length === archiveBytes) {
        if (await sha256Hex(source) !== archiveHash) throw new Error('The FreeDOS 1.4 ZIP checksum differs.');
        const {default: JSZip} = await import('jszip');
        const archive = await JSZip.loadAsync(source);
        source = await archive.file(member).async('uint8array');
    }
    if (source.length !== size || await sha256Hex(source) !== sha256) {
        throw new Error(`The FreeDOS floppy checksum differs. Choose ${member} from the official FreeDOS 1.4 archive.`);
    }
    return source;
}

export async function readFreedosGuestPackage (file, {title, name, size, sha256, directory, files}) {
    if (file?.size !== size) throw new Error(`Choose the official ${title} ZIP.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== size || await sha256Hex(bytes) !== sha256) {
        throw new Error(`The ${name} ZIP checksum differs. Choose the official release archive.`);
    }
    const {default: JSZip} = await import('jszip');
    const archive = await JSZip.loadAsync(bytes);
    return Promise.all(files.map(async fileName => {
        const entry = archive.file(`${directory}/${fileName}`);
        if (!entry) throw new Error(`The ${name} ZIP is missing ${fileName}.`);
        return {name: fileName.toUpperCase(), bytes: await entry.async('uint8array')};
    }));
}

export async function createFreedosGuest (floppy, {title, machine = 'i80386', readFiles, startup}, signal) {
    signal?.throwIfAborted();
    const source = await readFreedosFloppy(floppy, bootMedia[machine]);
    signal?.throwIfAborted();
    const files = await readFiles();
    signal?.throwIfAborted();
    const bytes = writeDosFloppyFiles(source, [...files,
        {name: 'FDCONFIG.SYS', bytes: dosText([
            'DOS=LOW', 'BUFFERS=20', 'FILES=40',
            'SHELL=\\FREEDOS\\BIN\\COMMAND.COM \\FREEDOS\\BIN /E:2048 /P=\\FDAUTO.BAT'
        ])},
        {name: 'FDAUTO.BAT', bytes: dosText(['@ECHO OFF', ...startup])}
    ]);
    const config = machine === 'i8086' ? newMachineConfig({
        title, machine, executionMode: 'functional', machineConfig: 'PCXT8086',
        slots: {floppy: {url: 'local-media:floppy', geometry: {
            cylinders: 80, heads: 2, sectors: 9, bytesPerSector: 512
        }}},
        bootOrder: ['floppy'],
        widgets: [{name: 'PC CGA', type: 'simplevga', source: 'video', config: {width: 720, height: 400}}],
        provenance: {source: 'local-freedos-guest'}
    }) : localFreedosVgaMachine({floppy: {size: bytes.length, name: title}});
    return {config, fetcher: ref => ref.url === 'local-media:floppy' ? {bytes} : defaultImageFetcher(ref)};
}
