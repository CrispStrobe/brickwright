import {sfrName} from './opcodes.js';

// These are explanations of the current snapshot, not a write-history claim.
// Snapshot polling cannot identify every writer or even every intermediate value.
const words = {
    en: {
        hex: 'Hex', decimal: 'Decimal', binary: 'Binary',
        bank: 'Register bank', active: 'active', inactive: 'inactive',
        bits: 'Bit-addressable RAM; bit addresses',
        upper: 'Upper internal RAM: use indirect addressing (@R0 or @R1).',
        direct: 'Direct addressing at this number selects SFR',
        sfr: 'Special function register', sfrBits: 'Bit addresses',
        sp: 'SP points here', dptr: 'DPTR points here', pc: 'PC points here',
        bitIn: 'Bit', in: 'in'
    },
    de: {
        hex: 'Hex', decimal: 'Dezimal', binary: 'Binär',
        bank: 'Registerbank', active: 'aktiv', inactive: 'inaktiv',
        bits: 'Bitadressierbares RAM; Bitadressen',
        upper: 'Oberes internes RAM: indirekt adressieren (@R0 oder @R1).',
        direct: 'Direkte Adressierung dieser Zahl wählt das Spezialregister',
        sfr: 'Spezialregister', sfrBits: 'Bitadressen',
        sp: 'SP zeigt hierher', dptr: 'DPTR zeigt hierher', pc: 'PC zeigt hierher',
        bitIn: 'Bit', in: 'in'
    }
};

const hex = (number, width = 2) => number.toString(16).toUpperCase().padStart(width, '0');

/** Explain one byte without reading memory or changing the selected target. */
export function memoryByteHelp ({space, address, value, snapshot, locale = 'en'}) {
    if (!Number.isSafeInteger(address) || address < 0 || !Number.isInteger(value) || value < 0 || value > 255) {
        return {title: '', markers: []};
    }
    const w = words[locale] || words.en;
    const lines = [
        `${space} 0x${hex(address, address > 0xffff ? 8 : 4)}`,
        `${w.hex}: ${hex(value)} · ${w.decimal}: ${value} · ${w.binary}: ${value.toString(2).padStart(8, '0')}`
    ];
    if (value >= 32 && value <= 126) lines.push(`ASCII: ${JSON.stringify(String.fromCharCode(value))}`);
    const markers = [];
    // Flat memory at a numerically identical address is not 8051 IRAM/SFR.
    if (!snapshot || snapshot.flavor !== '8051') return {title: lines.join('\n'), markers};
    const regs = snapshot.regs || {};
    if (space === 'iram' && address < 32) {
        const bank = address >> 3;
        const active = Number.isInteger(regs.psw) ? bank === ((regs.psw >> 3) & 3) : null;
        lines.push(`${w.bank} ${bank}, R${address & 7}${active === null ? '' : ` (${active ? w.active : w.inactive})`}`);
        if (active) markers.push('bank');
    } else if (space === 'iram' && address >= 0x20 && address <= 0x2f) {
        const first = (address - 0x20) * 8;
        lines.push(`${w.bits}: ${hex(first)}–${hex(first + 7)}`);
    } else if (space === 'iram' && address >= 0x80 && address <= 0xff) {
        lines.push(w.upper, `${w.direct} ${sfrName(address)}.`);
    } else if (space === 'sfr' && address >= 0x80 && address <= 0xff) {
        lines.push(`${w.sfr}: ${sfrName(address)}`);
        if ((address & 7) === 0) lines.push(`${w.sfrBits}: ${hex(address)}–${hex(address + 7)}`);
    } else if (space === 'bit' && address <= 0xff) {
        const byte = address < 0x80 ? 0x20 + (address >> 3) : address & 0xf8;
        const region = address < 0x80 ? `IRAM 0x${hex(byte)}` : `${sfrName(byte)} (0x${hex(byte)})`;
        lines.push(`${w.bitIn} ${address & 7} ${w.in} ${region}`);
    }
    if (space === 'iram' && address === regs.sp) {markers.push('sp'); lines.push(w.sp);}
    if (space === 'xram' && address === regs.dptr) {markers.push('dptr'); lines.push(w.dptr);}
    if (space === 'code' && address === regs.pc) {markers.push('pc'); lines.push(w.pc);}
    return {title: lines.join('\n'), markers};
}

export function memoryByteMarkerStyle (markers) {
    const color = markers.includes('sp') ? '#f1c40f' : markers.includes('dptr') ? '#bb8fce' :
        markers.includes('pc') ? '#58d68d' : markers.includes('bank') ? '#5dade2' : 'transparent';
    return {borderBottom: `2px solid ${color}`};
}
