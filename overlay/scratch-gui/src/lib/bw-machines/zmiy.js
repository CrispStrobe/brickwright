// SPDX-License-Identifier: BSD-3-Clause
import {sha256Hex} from './activate.js';
import {createFreedosGuest} from './freedos-guest.js';

export const zmiyProjectUrl = 'https://zmiy.sourceforge.net/';
export const zmiyDownloadUrl = 'https://sourceforge.net/projects/zmiy/files/v0.85.2/zmiy.zip/download';
const archiveSize = 32424;
const archiveSha256 = '9dea0ccfc540d58e4df0e22182da5a5c5250d3fa51541b0139b8c22fdb345f69';

async function readZmiyFiles (file) {
    if (file?.size !== archiveSize) throw new Error('Choose the official Zmiy 0.85.2 ZIP.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== archiveSize || await sha256Hex(bytes) !== archiveSha256) {
        throw new Error('The Zmiy ZIP checksum differs. Choose the official release archive.');
    }
    const {default: JSZip} = await import('jszip');
    const archive = await JSZip.loadAsync(bytes);
    return Promise.all(['ZMIY.EXE', 'ZMIY.TXT', 'HISTORY.TXT'].map(async name => ({
        name, bytes: await archive.file(`GAMES/ZMIY/${name}`).async('uint8array')
    })));
}

export function createZmiyMachine (floppy, signal, gameArchive) {
    return createFreedosGuest(floppy, {
        title: 'Zmiy 0.85.2',
        machine: 'i8086',
        readFiles: () => readZmiyFiles(gameArchive),
        startup: ['ZMIY /cga /timer=loop']
    }, signal);
}
