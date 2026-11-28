// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher} from './activate.js';
import {createFreedosGuest, dosText} from './freedos-guest.js';

const upstream = 'https://raw.githubusercontent.com/DosWorld/alicepascal/f71afb62f4f41725c157efb8e6c4f1dab8bbbee5/';
export const aliceLicenseUrl = upstream + 'README.MD';
const assets = {
    'alice.exe': 'd272d038643c8f5a52d39722fc998a183a4adbb5ed470f1ea6d47315154c846c',
    'apin.exe': '5bbb217ecd9b3da7d0afe9acf865415e174461c0bbb1f42061628dbf87f599b7',
    'turbolib.ap': '3ba4dd157468ed9a2fccc80c178f232af1f9fa674b542bf653968daa5b37d7ad',
    'ap.ini': '8a1e6f89d0670a549d0b03c272ff0b3eb5559520a16698db06725e43ac971c9a',
    'apbuilt.suf': 'a29a19df2adbefb2672a662dda7809038075bc9abefcb2ec68704ef0c2b34e84',
    'aptempla.suf': 'f5528338640184bb7c6f0ca183bd26575dccdc2a3d5aa52aa9ab723130d326bd',
    'nlbegin.suf': '72b8193a4f28a8f1bc040d5a8eca22bbe2c9bcf7c4ced920f78e1cd4f0c7dc11',
    'showend.suf': '6c46005f755a4b7bfd4cb29aac50a0164074b28a8e0fbd3fa1e1ae1ed3a4a965',
    'helpfile.huf': '113af8abff901068bca1bbf6dd626f1fe2d31abd2b9a0fab9e92bb5b0558c1f6'
};
async function readAliceFiles () {
    return Promise.all(Object.entries(assets).map(async ([name, sha256]) => {
        try {
            const {bytes} = await defaultImageFetcher({url: new URL('alice-binaries/' + name, upstream).href, sha256});
            return {name, bytes};
        } catch (error) {
            throw new Error(`${name}: ${error.message}`);
        }
    }));
}

export async function createAlicePascalMachine (floppy, signal) {
    return createFreedosGuest(floppy, {
        title: 'ALICE Pascal',
        readFiles: async () => [...await readAliceFiles(), {name: 'DEMO.PAS', bytes: dosText([
            'program Demo(output);', 'begin', '    writeln(6 * 7)', 'end.'
        ])}],
        startup: ['IF NOT EXIST DEMO.AP APIN +s DEMO.PAS DEMO.AP', 'ALICE DEMO.AP']
    }, signal);
}
