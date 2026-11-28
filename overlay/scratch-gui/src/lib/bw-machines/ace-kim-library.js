// SPDX-License-Identifier: BSD-3-Clause
import {defaultImageFetcher} from './activate.js';
import {kim1T} from './kim1-l10n.js';

const directory = 'https://raw.githubusercontent.com/CrispStrobe/brickwright-media-lab/5e54caab98d7ca6f641d7cc3e21f2ebdab937400/projects/ace-kim/';
export const aceKimMedia = {id: 'ace-kim', title: kim1T('en', 'aceTitle'), machine: 'kim1', license: 'MIT', aceKim: true};
const firmware = [
    {slot: 'bios', label: kim1T('en', 'aceBios'), file: 'bios.rom', license: 'LICENSE.bios', size: 32768,
        sha256: '0343d53e8f073cd515e67fbfd344641d1a5a35d5f903bbdd69564e97d4a3aa51'},
    {slot: 'monitor', label: kim1T('en', 'aceMonitor'), file: 'kc-monitor.rom', license: 'LICENSE.kc-monitor', size: 8192,
        sha256: '4defbbea6dca97fde50c69a5bdd9c584c946b0010003fc2aaa66ba78a1d015a0'}
];
export const aceKimLicenses = firmware.map(({label, license}) => ({label, url: new URL(license, directory).href}));

export async function readAceKimFirmware (locale = 'en') {
    const slots = await Promise.all(firmware.map(async ({slot, file, size, sha256}) => {
        const {bytes} = await defaultImageFetcher({url: new URL(file, directory).href, sha256});
        if (bytes.length !== size) throw new Error(kim1T(locale, 'aceRomSize', {slot}));
        return [slot, bytes];
    }));
    return Object.fromEntries(slots);
}

export async function createLibraryAceKim (locale = 'en') {
    const roms = await readAceKimFirmware(locale);
    const {AceKimMachine} = await import(/* webpackChunkName: "bw-ace-kim" */ 'bw-board/ace-kim-machine.js');
    return new AceKimMachine(roms);
}
