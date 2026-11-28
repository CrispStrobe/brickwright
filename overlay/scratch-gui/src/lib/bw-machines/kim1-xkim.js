// SPDX-License-Identifier: BSD-3-Clause
import downloadBlob from '../download-blob.js';
import {createKim1Tty} from './kim1-tty.js';
import {kim1T} from './kim1-l10n.js';
import {saveDiskImage} from './disk-image-download.js';
import {
    readXkimFatImage, writeXkimFatImage, XKIM_FAT_IMAGE_LIMIT, XKIM_FILE_COUNT, XKIM_FILE_LIMIT,
    XKIM_SHORT_NAME, XKIM_TOTAL_LIMIT
} from './kim1-xkim-fat.js';

export const XKIM_SOURCE = 'https://github.com/CorshamTech/xKIM/tree/0ce44974504514563e86cdf84ac8a9848b8bcdb5';

export async function readXkimMedia (romFile, files, diskImage, locale = 'en') {
    if (romFile?.size !== 8192) throw new Error(kim1T(locale, 'xkimRomSize'));
    if (diskImage && files.length) throw new Error(kim1T(locale, 'xkimMediaChoice'));
    if (diskImage?.size > XKIM_FAT_IMAGE_LIMIT) throw new Error(kim1T(locale, 'xkimImageLimit'));
    if (files.length > XKIM_FILE_COUNT || files.reduce((total, file) => total + file.size, 0) > XKIM_TOTAL_LIMIT) {
        throw new Error(kim1T(locale, 'xkimFilesLimit'));
    }
    const names = new Set();
    for (const file of files) {
        const name = file.name.toUpperCase();
        if (!XKIM_SHORT_NAME.test(file.name) || names.has(name) || file.size > XKIM_FILE_LIMIT) {
            throw new Error(kim1T(locale, 'xkimFileNames'));
        }
        names.add(name);
    }
    const rom = new Uint8Array(await romFile.arrayBuffer());
    if (diskImage) {
        const source = new Uint8Array(await diskImage.arrayBuffer());
        return {rom, files: readXkimFatImage(source), diskImage: {name: diskImage.name, source}};
    }
    const mounted = await Promise.all(files.map(async file => ({name: file.name, bytes: new Uint8Array(await file.arrayBuffer())})));
    return {rom, files: mounted};
}

export function createXkimMemoryMap (rom, locale = 'en') {
    if (!(rom instanceof Uint8Array) || rom.length !== 8192) throw new Error(kim1T(locale, 'xkimMemoryRom'));
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

export function createXkimTerminal ({rom, files, diskImage, timerLine = 'none', locale = 'en'}) {
    return createKim1Tty({
        locale,
        setup: control => {
            control('setMemoryCard', createXkimMemoryMap(rom, locale));
            control('mountCorshamFiles', files);
            control('setCorshamTimerLine', timerLine);
        },
        boot: 'E000 G', bootPrompt: /Extended KIM Monitor[\s\S]*>\s*$/,
        // xKIM takes one key at its main prompt and a line at the file prompt.
        encodeInput: (line, transcript) =>
            !line || /(?:filename|display to console|load from console):\s*$/i.test(transcript) ? line + '\r' : line,
        exportFiles: async snapshot => downloadBlob('xkim-files.zip', await createXkimArchive(snapshot)),
        exportImage: diskImage && ((snapshot, isOpen) => {
            const updated = writeXkimFatImage(diskImage.source, snapshot);
            const stem = diskImage.name?.replace(/\.[^.]+$/, '') || 'xkim';
            return saveDiskImage(stem + '-updated.img', updated, isOpen);
        }),
        title: kim1T(locale, 'xkimTerminalTitle'),
        inputLabel: kim1T(locale, 'xkimInput'),
        help: kim1T(locale, 'xkimTerminalHelp') + (diskImage ? ' ' + kim1T(locale, 'xkimSaveHelp') : '')
    });
}
