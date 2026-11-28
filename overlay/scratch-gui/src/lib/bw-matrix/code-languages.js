import {cell, deviceById} from './capabilities.js';

const basicProfiles = [
    {id: 'bbc', device: 'z80', dialect: 'bbc'},
    {id: 'ms', device: 'eater6502', dialect: 'ms'},
    {id: 'i8086', device: 'i8086', dialect: 'ms'},
    {id: 'i8086-dos', device: 'i8086', dialect: 'ms'},
    {id: 'i8086-ubasic', device: 'i8086', dialect: 'ms'},
    {id: 'pico-bbcbasic', device: 'pico', dialect: 'bbc', media: 'picobb-rp2040'},
    {id: 'pico-piccolo', device: 'pico', dialect: 'piccolo', media: 'piccolobasic-rp2040', standalone: true},
    {id: 'pico-stefan', device: 'pico', dialect: 'stefan', media: 'stefan-basic-rp2040', standalone: true}
];

export const basicProfilesFor = device => basicProfiles.filter(profile => device ? profile.device === device : profile.device !== 'pico');

export const basicProfileFor = (device, preferred) => {
    const profiles = basicProfilesFor(device);
    return profiles.find(profile => profile.id === preferred) || profiles[0];
};

export const picoBasicProfileForDialect = dialect => basicProfiles.find(profile => profile.media && profile.dialect === dialect);

export function standaloneBasicDrafts (buffers) {
    return Object.fromEntries(basicProfiles.filter(profile => profile.standalone && buffers[profile.id] != null)
        .map(profile => [profile.id, buffers[profile.id]]));
}

export function codeLanguageAvailable (lang, device, {remoteImages = true, riscvHosted = true} = {}) {
    if (!device || lang === 'pseudocode') return true;
    if (lang === 'cowgol') {
        // The checked subset runs through blocks, independently of a native
        // Cowgol compiler. Keep it available on extension-owned devices too.
        if (device === 'spike') return true;
        // The standalone 386 computer has an explicit real-mode DOS Cowgol
        // loader, independent of the MCU-oriented conversion matrix.
        if (device === 'i80386') return true;
        const capability = cell(lang, device);
        return Boolean(capability && (capability.native?.sim || capability.native?.silicon ||
            capability.lowered.some(route => route.sim || route.silicon))) ||
            (!deviceById(device) && device !== 'i80386');
    }
    if (lang === 'basic') return (device !== 'pico' || remoteImages) && basicProfilesFor(device).length > 0;
    if (['fe', 'forth', 'tcl'].includes(lang)) return device === 'i8086' || (device === 'riscv32' && riscvHosted);
    if (device === 'spike') return lang === 'python';
    // DEVICE headers shared with extensions can predate the capability matrix.
    // Leave their existing editors accessible until those targets are described.
    if (!deviceById(device) && device !== 'i80386') return true;
    const native = cell(lang, device)?.native;
    return Boolean(native?.sim || native?.silicon);
}

// Authored text can coexist with generated views of a project. Keep the
// former when a machine hides its editor or regenerates other languages.
export function hiddenCodeDrafts (authored, buffers, device, active) {
    if (!device || !authored) return {};
    return Object.fromEntries(Object.entries(authored).filter(([lang, source]) =>
        lang !== active && source === buffers[lang] && !codeLanguageAvailable(lang, device)));
}
