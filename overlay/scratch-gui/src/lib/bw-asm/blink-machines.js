// SPDX-License-Identifier: BSD-3-Clause
import {asmExamplesFor} from './examples.js';

export const blinkStarter = '; Blink 0\n; Choose a machine when you run this example.';

// A target identifies an instruction set. A machine also needs the peripheral
// at the address the starter writes, and some way to see its output.
export const blinkMachines = [
    {id: 'stc60', family: '8051', device: 'stc12c5a60s2', label: 'STC12C5A60S2 · P1.0',
        circuit: '01-blink/circuit.stc12c5a60s2.json', led: 'LED_led1'},
    {id: 'stc16', family: '8051', device: 'stc12c5a16s2', label: 'STC12C5A16S2 · P1.0',
        circuit: '01-blink/circuit.stc12c5a60s2.json', led: 'LED_led1'},
    {id: '6502-wired', family: '6502', device: 'eater6502', label: '6502 · breadboard PB0',
        circuit: 'eater6502-blink/circuit.json', led: 'led0'},
    {id: '6502-virtual', family: '6502', device: 'eater6502', label: '6502 · virtual PB0'},
    {id: 'z80-virtual', family: 'z80', device: 'z80', label: 'Z80 · virtual port 01h'}
];

const families = {
    '8051': 'stc12c5a60s2',
    '6502': 'eater6502',
    z80: 'z80'
};

export function blinkSource (family) {
    const example = asmExamplesFor(families[family]).find(item => item.id === 'blink');
    return example ? `; BW-BLINK0: ${family}\n${example.source}` : '';
}

export function blinkProgramSource (source, family) {
    // Starter source from older projects was saved without its reset vector.
    if (family === '6502' && !/\.segment\s+"VECTORS"/i.test(source) && /^\s*reset\s*:/im.test(source)) {
        return source.trimEnd() + '\n\n    .segment "VECTORS"\n    .word reset, reset, reset\n';
    }
    return source;
}

export function blinkFamily (source) {
    if (source.trim() === blinkStarter) return 'any';
    const tagged = source.match(/^; BW-BLINK0: (8051|6502|z80)\s*$/m);
    if (tagged) return tagged[1];
    return Object.keys(families).find(family => {
        const sample = asmExamplesFor(families[family]).find(item => item.id === 'blink').source;
        const legacy = family === '6502' ? sample.split('; Point the reset vector')[0] :
            family === 'z80' ? sample.replace('Toggle bit 0', 'Toggle every bit').replace('ld   a, #0x01', 'ld   a, #0xff') : sample;
        return sample.trim() === source.trim() || legacy.trim() === source.trim();
    });
}

export function blinkChoices (family) {
    return blinkMachines.filter(machine => family === 'any' || machine.family === family);
}
