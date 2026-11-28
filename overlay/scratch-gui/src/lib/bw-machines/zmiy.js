// SPDX-License-Identifier: BSD-3-Clause
import {createFreedosGuest, readFreedosGuestPackage} from './freedos-guest.js';

export const zmiyProjectUrl = 'https://zmiy.sourceforge.net/';
export const zmiyDownloadUrl = 'https://sourceforge.net/projects/zmiy/files/v0.85.2/zmiy.zip/download';
const release = {
    title: 'Zmiy 0.85.2', name: 'Zmiy', size: 32424,
    sha256: '9dea0ccfc540d58e4df0e22182da5a5c5250d3fa51541b0139b8c22fdb345f69',
    directory: 'GAMES/ZMIY', files: ['ZMIY.EXE', 'ZMIY.TXT', 'HISTORY.TXT']
};

export function createZmiyMachine (floppy, signal, gameArchive) {
    return createFreedosGuest(floppy, {
        title: release.title,
        machine: 'i8086',
        readFiles: () => readFreedosGuestPackage(gameArchive, release),
        startup: ['ZMIY /cga /timer=loop']
    }, signal);
}
