// SPDX-License-Identifier: BSD-3-Clause
import downloadBlob from '../download-blob.js';
import {createKim1Tty} from './kim1-tty.js';
import {
    readXkimFatImage, XKIM_FAT_IMAGE_LIMIT, XKIM_FILE_COUNT, XKIM_FILE_LIMIT, XKIM_SHORT_NAME, XKIM_TOTAL_LIMIT
} from './kim1-xkim-fat.js';

export const XKIM_SOURCE = 'https://github.com/CorshamTech/xKIM/tree/0ce44974504514563e86cdf84ac8a9848b8bcdb5';

export async function readXkimMedia (romFile, files, diskImage) {
    if (romFile?.size !== 8192) throw new Error('Choose the 8 KiB xKIM ROM for $E000–$FFFF.');
    if (diskImage && files.length) throw new Error('Choose either a single FAT image or loose Corsham files.');
    if (diskImage?.size > XKIM_FAT_IMAGE_LIMIT) throw new Error('Choose a FAT image up to 128 MiB.');
    if (files.length > XKIM_FILE_COUNT || files.reduce((total, file) => total + file.size, 0) > XKIM_TOTAL_LIMIT) {
        throw new Error('Choose up to 64 Corsham files and 2 MiB in total.');
    }
    const names = new Set();
    for (const file of files) {
        const name = file.name.toUpperCase();
        if (!XKIM_SHORT_NAME.test(file.name) || names.has(name) || file.size > XKIM_FILE_LIMIT) {
            throw new Error('Corsham files need unique 8.3 names and at most 64 KiB each.');
        }
        names.add(name);
    }
    const [image, mounted] = await Promise.all([
        romFile.arrayBuffer(),
        diskImage ? diskImage.arrayBuffer().then(buffer => readXkimFatImage(new Uint8Array(buffer))) :
            Promise.all(files.map(async file => ({name: file.name, bytes: new Uint8Array(await file.arrayBuffer())})))
    ]);
    return {rom: new Uint8Array(image), files: mounted};
}

export function createXkimMemoryMap (rom) {
    if (!(rom instanceof Uint8Array) || rom.length !== 8192) throw new Error('xKIM needs an 8 KiB ROM.');
    const map = new Uint8Array(131072);
    for (let index = 1; index < map.length; index += 2) map[index] = 1;
    // Keep base RAM, RIOTs, the onboard ROM and the hardware reset vectors.
    for (let address = 0x2000; address < 0xe000; address++) map[address * 2 + 1] = 2;
    for (let address = 0xe000; address < 0xfffa; address++) {
        map[address * 2] = rom[address - 0xe000];
        map[address * 2 + 1] = 0;
    }
    return map;
}

export async function createXkimArchive (files) {
    const {default: JSZip} = await import('jszip');
    const archive = new JSZip();
    for (const {name, bytes} of files) archive.file(name, bytes);
    return archive.generateAsync({type: 'blob', compression: 'STORE'});
}

export function createXkimTerminal ({rom, files}) {
    return createKim1Tty({
        setup: control => {
            control('setMemoryCard', createXkimMemoryMap(rom));
            control('mountCorshamFiles', files);
        },
        boot: 'E000 G', bootPrompt: /Extended KIM Monitor[\s\S]*>\s*$/,
        // xKIM takes one key at its main prompt and a line at the file prompt.
        encodeInput: (line, transcript) =>
            !line || /(?:filename|display to console|load from console):\s*$/i.test(transcript) ? line + '\r' : line,
        exportFiles: async snapshot => downloadBlob('xkim-files.zip', await createXkimArchive(snapshot)),
        title: 'xKIM · Corsham files',
        inputLabel: 'xKIM command',
        help: 'C shows the clock in UTC. D lists files. T displays a file. S saves a memory range as Intel HEX and L reloads it. Export files downloads the current session files.'
    });
}
