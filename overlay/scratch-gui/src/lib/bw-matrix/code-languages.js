import {cell, deviceById} from './capabilities.js';

const basicProfiles = [
    {id: 'bbc', device: 'z80', dialect: 'bbc'},
    {id: 'ms', device: 'eater6502', dialect: 'ms'},
    {id: 'i8086', device: 'i8086', dialect: 'ms'},
    {id: 'i8086-dos', device: 'i8086', dialect: 'ms'},
    {id: 'i8086-ubasic', device: 'i8086', dialect: 'ms'},
    {id: 'pico-bbcbasic', device: 'pico', dialect: 'bbc', media: 'picobb-rp2040'},
    {id: 'pico-piccolo', device: 'pico', dialect: 'piccolo', media: 'piccolobasic-rp2040', standalone: true},
    {id: 'pico-stefan', device: 'pico', dialect: 'stefan', media: 'stefan-basic-rp2040', standalone: true},
    {id: 'bbc-c99', device: 'pico', dialect: 'bbc', compiled: true},
    {id: 'bbc-c99', device: 'arduino-uno', dialect: 'bbc', compiled: true},
    {id: 'bbc-c99', device: 'atmega328p', dialect: 'bbc', compiled: true}
];

export const basicProfilesFor = device => basicProfiles.filter(profile => device ? profile.device === device : profile.device !== 'pico' && !profile.compiled);

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
    if (lang === 'basic') return basicProfilesFor(device).some(profile => !profile.media || remoteImages);
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
