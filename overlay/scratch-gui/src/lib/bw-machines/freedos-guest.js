// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher, sha256Hex} from './activate.js';
import {writeDosFloppyFiles} from './kim1-xkim-fat.js';
import {localFreedosVgaMachine} from './local-freedos-vga.js';

export const freedosFloppyZipUrl = 'https://download.freedos.org/1.4/FD14-FloppyEdition.zip';
const bootBytes = 1200 * 1024;
const archiveBytes = 23624258;
const archiveHash = '45b1fa7c52dd996c3bfa5e352ffcd410781b952a6ad629f15a4c9ec4bbaefc5a';
const bootMember = '120m/x86BOOT.img';
const bootHash = '03df6088be016e57a6c44275f5bb9ab0244db71de1360957fd76ba83243b6a77';

export const dosText = lines => new TextEncoder().encode([...lines, ''].join('\r\n'));

async function readFreedosFloppy (file) {
    if (file?.size !== bootBytes && file?.size !== archiveBytes) {
        throw new Error(`Choose ${bootMember} or the official FreeDOS 1.4 Floppy Edition ZIP.`);
    }
    let source = new Uint8Array(await file.arrayBuffer());
    if (source.length === archiveBytes) {
        if (await sha256Hex(source) !== archiveHash) throw new Error('The FreeDOS 1.4 ZIP checksum differs.');
        const {default: JSZip} = await import('jszip');
        const archive = await JSZip.loadAsync(source);
        source = await archive.file(bootMember).async('uint8array');
    }
    if (source.length !== bootBytes || await sha256Hex(source) !== bootHash) {
        throw new Error(`The FreeDOS floppy checksum differs. Choose ${bootMember} from the official FreeDOS 1.4 archive.`);
    }
    return source;
}

export async function createFreedosGuest (floppy, {title, readFiles, startup}, signal) {
    signal?.throwIfAborted();
    const source = await readFreedosFloppy(floppy);
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
    const config = localFreedosVgaMachine({floppy: {size: bytes.length, name: title}});
    return {config, fetcher: ref => ref.url === 'local-media:floppy' ? {bytes} : defaultImageFetcher(ref)};
}
