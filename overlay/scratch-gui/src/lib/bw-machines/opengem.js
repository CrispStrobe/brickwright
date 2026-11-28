// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher} from './activate.js';
import {createFreedosGuest} from './freedos-guest.js';

const archiveUrl = 'https://raw.githubusercontent.com/shanecoughlan/OpenGEM/ac06b1a3fec3f3e8defcaaf7ea0338c38c3cef46/binary/OPENGEM7-RC3.zip';
export const openGemLicenseUrl = archiveUrl.replace('.zip', '/LICENSE.TXT');
export const cuteMouseSourceUrl = 'https://cutemouse.sourceforge.net/';
const archiveSha256 = 'f9c737c2154197a979136bf6857e5af7e61efb0d8436b380ec52427ac46277b1';
const systemFiles = [
    'CTMOUSE.EXE', 'SDPSC9.VGA', 'GEMVDI.EXE', 'GEM.EXE', 'GEM.RSC', 'GEM.CFG', 'GEMSET.RSC',
    'DESKTOP.APP', 'DESKTOP.RSC', 'DESKTOP.INF', 'DESKTOP.DFN', 'DESKTOP.FMT', 'DESKHI.ICN', 'DESKLO.ICN'
];
const noticeFiles = ['LICENSE.TXT', 'SOURCE.TXT', 'README.TXT'];

async function readOpenGemFiles () {
    const [{bytes}, {default: JSZip}] = await Promise.all([
        defaultImageFetcher({url: archiveUrl, sha256: archiveSha256}),
        import('jszip')
    ]);
    const archive = await JSZip.loadAsync(bytes);
    const files = [
        ...systemFiles.map(name => ({name, path: `OPENGEM/GEMAPPS/GEMSYS/${name}`})),
        ...noticeFiles.map(name => ({name, path: `OPENGEM/${name}`}))
    ];
    return Promise.all(files.map(async ({name, path}) => {
        const entry = archive.file(path);
        if (!entry) throw new Error(`OpenGEM archive is missing ${name}.`);
        const data = await entry.async('uint8array');
        // The release opens its help directory on C:. This floppy boots on A:.
        if (name === 'DESKTOP.INF') {
            const config = String.fromCharCode(...data).replace('C:\\GEMAPPS\\HELPZONE\\', 'A:\\');
            return {name, bytes: Uint8Array.from(config, char => char.charCodeAt(0))};
        }
        return {name, bytes: data};
    }));
}

export function createOpenGemMachine (floppy, signal) {
    return createFreedosGuest(floppy, {
        title: 'OpenGEM 7 RC3',
        readFiles: readOpenGemFiles,
        startup: ['CTMOUSE /P', 'GEMVDI']
    }, signal);
}
