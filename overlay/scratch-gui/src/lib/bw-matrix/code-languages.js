import {cell, deviceById} from './capabilities.js';

const basicProfiles = [
    {id: 'bbc', device: 'z80', dialect: 'bbc'},
    {id: 'ms', device: 'eater6502', dialect: 'ms'},
    {id: 'i8086', device: 'i8086', dialect: 'ms'},
    {id: 'i8086-dos', device: 'i8086', dialect: 'ms'},
    {id: 'i8086-ubasic', device: 'i8086', dialect: 'ms'},
    {id: 'pico-bbcbasic', device: 'pico', dialect: 'bbc'}
];

export const basicProfilesFor = device => basicProfiles.filter(profile => device ? profile.device === device : profile.device !== 'pico');

export const basicProfileFor = (device, preferred) => {
    const profiles = basicProfilesFor(device);
    return profiles.find(profile => profile.id === preferred) || profiles[0];
};

export function codeLanguageAvailable (lang, device, {remoteImages = true, riscvHosted = true} = {}) {
    if (!device || lang === 'pseudocode') return true;
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
