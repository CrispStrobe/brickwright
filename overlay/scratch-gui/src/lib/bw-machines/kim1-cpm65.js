// SPDX-License-Identifier: BSD-3-Clause
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

export async function createKim1CpmTerminal ({profile, program, disk}) {
    const {createKim1Machine, controlKim1Machine, stepKim1Machine} =
        await import(/* webpackChunkName: "bw-kim1-cpm65" */ 'bw-board/kim1-machine.js');
    const machine = createKim1Machine('; KIM-1 expanded RAM\n0200: EA');
    const control = (verb, value) => {
        if (!controlKim1Machine(machine, verb, value)) throw new Error('KIM-1 rejected ' + verb + '.');
    };
    control('useBrickwrightRom');
    control(profile.mount, profile.id === 'k1013' ? {drive: 0, image: disk} : disk);
    control('loadProgram', program);
    control('setTty', {enabled: true, baud: 300});

    const listeners = new Set();
    let shown = '';
    let phase = 'monitor';
    let begin = '';
    let remaining = 24_000_000;
    let timer = null;
    let closed = false;
    const publish = text => {
        if (shown === text) return;
        shown = text;
        for (const listener of listeners) listener(text);
    };
    const schedule = () => { timer = setTimeout(pump, 0); };
    function pump () {
        timer = null;
        try {
            const until = machine.cpu.cycles + Math.min(remaining, 100_000);
            while (machine.cpu.cycles < until && machine.running && !machine.error) {
                const elapsed = stepKim1Machine(machine);
                if (elapsed <= 0) break;
                remaining -= elapsed;
            }
            const transcript = machine.ttyOutput.replace(/[^\x20-\x7e\r\n\t\b]/g, '');
            publish(transcript);
            if (machine.error || !machine.running || remaining <= 0) {
                throw new Error(machine.error || 'The guest did not reach a prompt within the execution budget.');
            }
            if (phase === 'monitor' && /KIM>/.test(transcript)) {
                control('sendTty', '0200 G');
                phase = 'boot';
            } else if (phase === 'boot' && /CP\/M-65 for the KIM-1[\s\S]*A>\s*$/.test(transcript)) {
                phase = 'ready';
                return;
            } else if (phase === 'command' && transcript !== begin && /[A-P]>\s*$/.test(transcript)) {
                phase = 'ready';
                return;
            }
            schedule();
        } catch (error) {
            phase = 'error';
            publish(shown + '\n' + error.message);
        }
    }
    return {
        title: 'CP/M-65 · ' + profile.label,
        inputLabel: 'CP/M-65 command',
        help: 'Wait for A>, then enter DIR to list drive A. The disk is mounted for this session.',
        start () { if (!closed && timer === null && phase === 'monitor') schedule(); },
        subscribe (listener) {
            listeners.add(listener);
            listener(shown);
            return () => listeners.delete(listener);
        },
        send (line) {
            if (closed || phase !== 'ready' || !/^[\x20-\x7e]{0,126}$/.test(line)) return false;
            control('sendTty', line + '\r');
            begin = shown;
            remaining = 80_000_000;
            phase = 'command';
            schedule();
            return true;
        },
        dispose () {
            closed = true;
            clearTimeout(timer);
            timer = null;
            listeners.clear();
        }
    };
}
