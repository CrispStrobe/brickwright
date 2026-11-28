// SPDX-License-Identifier: BSD-3-Clause
import {createFreedosGuest, readFreedosGuestPackage} from './freedos-guest.js';

const archiveDirectory = 'https://raw.githubusercontent.com/fragglet/sdl-sopwith/5f39d553386a1fefa1d5f2fd75c9591826e74fe3/original-files/';
export const sopwithDosUrl = `${archiveDirectory}swauth.zip`;
export const sopwithSourceUrl = `${archiveDirectory}gplsrc.zip`;
const release = {
    title: 'Sopwith Author’s Edition (DOS)', name: 'Sopwith', size: 41262,
    sha256: 'e8a147911e3f0a1ed70e7914a4a48837a4f42ac3ae99d3c0c5d3a49eafcf6035',
    directory: 'swauth',
    files: ['swauth.exe', 'GNU General Public License - GNU Project - Free Software Foundation (FSF).html']
};

export function createSopwithMachine (floppy, signal, gameArchive) {
    return createFreedosGuest(floppy, {
        title: release.title,
        machine: 'i8086',
        floppyFormat: '120m',
        readFiles: async () => {
            const [program, notice] = await readFreedosGuestPackage(gameArchive, release);
            return [program, {name: 'COPYING.HTM', bytes: notice.bytes}];
        },
        startup: ['SWAUTH -n -k']
    }, signal);
}
