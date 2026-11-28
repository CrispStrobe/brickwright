// SPDX-License-Identifier: BSD-3-Clause
import {createKim1Tty} from './kim1-tty.js';

export const XKIM_SOURCE = 'https://github.com/CorshamTech/xKIM/tree/0ce44974504514563e86cdf84ac8a9848b8bcdb5';

export async function readXkimMedia (romFile, files) {
    if (romFile?.size !== 8192) throw new Error('Choose the 8 KiB xKIM ROM for $E000–$FFFF.');
    if (files.length > 64 || files.reduce((total, file) => total + file.size, 0) > 2097152) {
        throw new Error('Choose up to 64 Corsham files and 2 MiB in total.');
    }
    const names = new Set();
    for (const file of files) {
        const name = file.name.toUpperCase();
        if (!/^[a-z0-9_-]{1,8}(\.[a-z0-9_-]{1,3})?$/i.test(file.name) || names.has(name) || file.size > 65536) {
            throw new Error('Corsham files need unique 8.3 names and at most 64 KiB each.');
        }
        names.add(name);
    }
    const [image, mounted] = await Promise.all([
        romFile.arrayBuffer(),
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

export function createXkimTerminal ({rom, files}) {
    return createKim1Tty({
        setup: control => {
            control('setMemoryCard', createXkimMemoryMap(rom));
            control('mountCorshamFiles', files);
        },
        boot: 'E000 G', bootPrompt: /Extended KIM Monitor[\s\S]*>\s*$/,
        // xKIM takes one key at its main prompt and a line at the file prompt.
        encodeInput: (line, transcript) => !line || /filename:\s*$/i.test(transcript) ? line + '\r' : line,
        title: 'xKIM · Corsham files',
        inputLabel: 'xKIM command',
        help: 'Enter D to list mounted files. Enter T and then a filename to display it. Imported files are read-only for this session.'
    });
}
