// SPDX-License-Identifier: BSD-3-Clause
import {createKim1Tty} from './kim1-tty.js';
const upstream = 'https://github.com/davidgiven/cpm65/releases/download/dev/';
export const kim1CpmProfiles = [
    {id: 'sdcard', label: 'SPI SD', tape: 'bootsd.pap', disk: 'diskimage.raw', mount: 'mountSD',
        size: 33556529, tapeSize: 952, diskSize: 33554432,
        sha256: '156090198dfda6b4edd82320c80fa05a543f057f0f267c451e85bbcf041fad7d'},
    {id: 'sdshield', label: 'Corsham DSK', tape: 'bootsdshield.pap', disk: 'CPM-BOOT.DSK', mount: 'mountCorshamDisk',
        size: 514318, tapeSize: 748, diskSize: 512512,
        sha256: 'cbdba313cc503995d80009b194253cce589cfeed76cc9668a1de2b83a926f0e0'},
    {id: 'k1013', label: 'K-1013', tape: 'boot.pap', disk: 'diskimage.imd', mount: 'mountK1013',
        size: 426488, tapeSize: 552, diskSize: 425412,
        sha256: '9b3fe45a55136d993f8ec8e8b2e7e235df4b864a27dd549b7702eb6e71083534'}
].map(profile => ({...profile, url: upstream + 'kim-1-' + profile.id + '.zip'}));

export async function readKim1CpmArchive (id, file) {
    const profile = kim1CpmProfiles.find(entry => entry.id === id);
    if (!profile || file?.size !== profile.size) {
        throw new Error('Choose the pinned upstream ZIP for the selected CP/M-65 drive.');
    }
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== profile.sha256) throw new Error('CP/M-65 ZIP checksum differs from the reviewed upstream release.');
    const {default: JSZip} = await import('jszip');
    const archive = await JSZip.loadAsync(bytes);
    const [tape, disk] = await Promise.all([archive.file(profile.tape)?.async('uint8array'),
        archive.file(profile.disk)?.async('uint8array')]);
    if (tape?.length !== profile.tapeSize || disk?.length !== profile.diskSize) {
        throw new Error('CP/M-65 boot media have unexpected lengths.');
    }
    return {profile, program: new TextDecoder('utf-8', {fatal: true}).decode(tape), disk};
}

export function createKim1CpmTerminal ({profile, program, disk}) {
    return createKim1Tty({
        setup: control => {
            control(profile.mount, profile.id === 'k1013' ? {drive: 0, image: disk} : disk);
            control('loadProgram', program);
        },
        boot: '0200 G', bootPrompt: /CP\/M-65 for the KIM-1[\s\S]*A>\s*$/,
        commandPrompt: /[A-P]>\s*$/,
        title: 'CP/M-65 · ' + profile.label,
        inputLabel: 'CP/M-65 command',
        help: 'Wait for A>, then enter DIR to list drive A. The disk is mounted for this session.'
    });
}
