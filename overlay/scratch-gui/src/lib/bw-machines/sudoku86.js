// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher} from './activate.js';
import {createFreedosGuest, readFreedosGuestPackage} from './freedos-guest.js';

export const sudoku86ProjectUrl = 'https://sudoku86.sourceforge.net/';
export const sudoku86DownloadUrl = 'https://sourceforge.net/projects/sudoku86/files/v1.0.3/sudoku86.zip/download';
const release = {
    title: 'Sudoku86 1.0.3', name: 'Sudoku86', size: 248034,
    sha256: '949cd3b2a7b8aff75094a5d9af48fe262ff72ded297457dfee38efad3f1b1c91',
    directory: 'games/sudoku86',
    files: ['sudoku86.exe', 'sudoku86.dat', 'sudoku86.lev', 'readme.txt', 'history.txt']
};
const mouseDriver = {
    url: 'https://raw.githubusercontent.com/shanecoughlan/OpenGEM/ac06b1a3fec3f3e8defcaaf7ea0338c38c3cef46/binary/OPENGEM7-RC3/GEMAPPS/GEMSYS/CTMOUSE.EXE',
    sha256: '822cf550c9e19a22785722d2306aa08ede10ff20bfe931d5a81a15f77c5f363e'
};

export function createSudoku86Machine (floppy, signal, gameArchive) {
    return createFreedosGuest(floppy, {
        title: release.title,
        readFiles: async () => {
            const files = await readFreedosGuestPackage(gameArchive, release);
            signal?.throwIfAborted();
            const {bytes} = await defaultImageFetcher(mouseDriver);
            return [...files, {name: 'CTMOUSE.EXE', bytes}];
        },
        startup: ['CTMOUSE /P', 'SUDOKU86']
    }, signal);
}
