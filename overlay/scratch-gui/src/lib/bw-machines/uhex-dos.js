// SPDX-License-Identifier: BSD-3-Clause
import {createFreedosGuest, dosText, readFreedosGuestPackage} from './freedos-guest.js';

const repo = 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4';
export const uhexProjectUrl = 'https://uhex.sourceforge.net/';
export const uhexDownloadUrl = `${repo}/edit/uhex.zip`;

const release = {
    title: 'uHex 1.0.4a (DOS)', name: 'uHex', size: 36915,
    sha256: 'd72e39957411d43d9a36974137bd325f64e133b8185e6969218f0b762076dca3',
    directory: 'EDIT/UHEX', files: ['UHEX.COM', 'UHEX.TXT']
};

export function createUhexMachine (floppy, signal, packageFile) {
    return createFreedosGuest(floppy, {
        title: release.title,
        readFiles: async () => [
            ...await readFreedosGuestPackage(packageFile, release),
            {name: 'SAMPLE.BIN', bytes: dosText(['BRICKWRIGHT HEX LAB'])}
        ],
        startup: ['UHEX SAMPLE.BIN']
    }, signal);
}
