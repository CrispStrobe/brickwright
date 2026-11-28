// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher, sha256Hex} from './activate.js';
import {createFreedosGuest, dosText} from './freedos-guest.js';
import {decodeZipImplode} from './zip-implode.js';

export const berkeleyLogoProjectUrl = 'https://people.eecs.berkeley.edu/~bh/logo.html';
export const berkeleyLogoDosUrl = 'https://people.eecs.berkeley.edu/~bh/downloads/blogo.exe';
const release = {
    url: berkeleyLogoDosUrl,
    sha256: '5016ea9530e9645a67360945c3408083c01970a55ea83f5ee3c4691af70e426d'
};

// Offsets refer to the exact INSTALLU.EXE inside the SHA-256 pinned outer ZIP.
const members = [
    {name: 'BL.EXE', offset: 137845, packed: 107296, size: 229626, flags: 0,
        sha256: '55fc8d1e65019f9147909ca92eba0d795441c8e2eb0a27e57ed1d0894fbaf444'},
    {name: 'GPL', offset: 245182, packed: 7250, size: 18317, flags: 6,
        sha256: '4cba25dfea9f5cf0454c4cfee27091740f8e556196330c010d1fbe35235dc59e'},
    {name: 'README', offset: 252476, packed: 2696, size: 5208, flags: 0,
        sha256: '020f258870dcd87fd58a7cee23ca14370e9d0475c6478a01bc8fe2859fbadef0'}
];

async function readLogoFiles () {
    const [{bytes}, {default: JSZip}] = await Promise.all([defaultImageFetcher(release), import('jszip')]);
    const outer = await JSZip.loadAsync(bytes);
    const installer = await outer.file('INSTALLU.EXE').async('uint8array');
    return Promise.all(members.map(async ({name, offset, packed, size, flags, sha256}) => {
        const contents = decodeZipImplode(installer.subarray(offset, offset + packed), size, flags);
        if (await sha256Hex(contents) !== sha256) throw new Error(`Berkeley Logo ${name} checksum differs.`);
        return {name, bytes: contents};
    }));
}

export function createBerkeleyLogoMachine (floppy, signal) {
    return createFreedosGuest(floppy, {
        title: 'Berkeley Logo 3.6',
        machine: 'i8086',
        floppyFormat: '120m',
        readFiles: async () => [...await readLogoFiles(), {name: 'SQUARE.LGO', bytes: dosText([
            'to square :side',
            '  repeat 4 [fd :side rt 90]',
            'end'
        ])}],
        startup: ['SET FG_DISPLAY=CGAHIRES', 'BL']
    }, signal);
}
