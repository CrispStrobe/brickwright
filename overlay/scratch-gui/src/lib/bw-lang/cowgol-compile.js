import {remoteToolchainsAllowed} from '../distribution-policy.js';

export const COWGOL_COMPILE_ENDPOINT = 'https://stc-compiler.vercel.app/compile';
export const COWGOL_COMPILE_TARGETS = Object.freeze({
    'z80-cpm': {format: 'bin', toolchain: 'cowgol-cpmz', filename: 'program.com', maxBytes: 0xcf00},
    'i8080-cpm': {format: 'bin', toolchain: 'cowgol-cpm', filename: 'program.com', maxBytes: 0xcf00},
    dos: {format: 'bin', toolchain: 'cowgol-msdos', filename: 'program.exe', maxBytes: 1024 * 1024},
    riscv32: {format: 'elf', toolchain: 'cowgol-riscv32', filename: 'program.elf', maxBytes: 4 * 1024 * 1024},
    eater6502: {format: 'bin', toolchain: 'cowgol-eater6502', filename: 'program.bin', maxBytes: 0x8000},
    atmega328p: {format: 'hex', toolchain: 'cowgol-atmega328p', filename: 'program.hex', maxBytes: 128 * 1024},
    'cowgol-cgen': {format: 'c', toolchain: 'cowgol-cgen', filename: 'program.c', maxBytes: 8 * 1024 * 1024}
});

/** Exact qualified boards, rather than all boards with a related processor. */
const DEVICE_TARGETS = Object.freeze({
    z80: 'z80-cpm', i8086: 'dos', riscv32: 'riscv32', eater6502: 'eater6502',
    'arduino-uno': 'atmega328p', atmega328p: 'atmega328p'
});
export const cowgolTargetForDevice = device => {
    const key = String(device || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(DEVICE_TARGETS, key) ? DEVICE_TARGETS[key] : null;
};

/** Same arbitrary-firmware path as an AVR sketch; the image fixes chip and clock. */
export const cowgolAvrDetail = bytes => ({
    format: 'firmware', target: 'atmega328p', kind: 'avr8js',
    firmware: {name: 'program.hex', bytes: null, text: new TextDecoder().decode(bytes),
        fCpu: 16_000_000, device: 'atmega328p'},
    rom: null, image: null, listing: null
});

/** Check addressed flash bytes as well as the SRAM facts from the AVR ELF. */
function validateAvrHex (bytes, out) {
    const fail = () => { throw new Error('Cowgol compiler returned an invalid ATmega328P HEX image or memory layout.'); };
    const layout = out.memory_layout;
    const names = ['flash_end', 'flash_limit', 'data_start', 'data_end', 'bss_end',
        'heap_start', 'heap_end', 'stack_start', 'stack_reserve', 'ram_end', 'halted_addr', 'status_addr'];
    if (out.format !== 'hex' || out.artifact_kind !== 'executable' || out.mcu !== 'atmega328p' ||
        out.origin !== 0 || out.entry !== 0 || out.f_cpu !== 16_000_000 || out.uart_baud !== 9600 ||
        !layout || names.some(name => !Number.isSafeInteger(layout[name])) ||
        bytes.some(byte => byte > 127)) return fail();
    const {flash_end: flashEnd, flash_limit: flashLimit, data_start: dataStart, data_end: dataEnd,
        bss_end: bssEnd, heap_start: heapStart, heap_end: heapEnd, stack_start: stackStart,
        stack_reserve: stackReserve, ram_end: ramEnd, halted_addr: halted, status_addr: status} = layout;
    if (flashLimit !== 0x7e00 || flashEnd < 4 || flashEnd > flashLimit || flashEnd % 2 !== 0 ||
        dataStart !== 0x100 || dataEnd < dataStart || bssEnd < dataEnd || bssEnd > 0x700 ||
        out.memory_end !== bssEnd || heapStart < dataEnd || heapEnd - heapStart !== 512 || heapEnd > bssEnd ||
        stackStart !== 0x700 || stackReserve !== 512 || ramEnd !== 0x900 ||
        halted < dataEnd || halted >= bssEnd || status < dataEnd || status >= bssEnd || halted === status ||
        (halted >= heapStart && halted < heapEnd) || (status >= heapStart && status < heapEnd)) return fail();
    const text = new TextDecoder().decode(bytes);
    const lines = text.trimEnd().split(/\r?\n/);
    let next = 0;
    let ended = false;
    const reset = [];
    for (const line of lines) {
        if (ended || !/^:(?:[0-9a-fA-F]{2}){5,}$/.test(line)) return fail();
        const record = [];
        for (let i = 1; i < line.length; i += 2) record.push(parseInt(line.slice(i, i + 2), 16));
        const [count, high, low, type] = record;
        const address = (high << 8) | low;
        if (record.length !== count + 5 || (record.reduce((sum, byte) => sum + byte, 0) & 255)) return fail();
        if (type === 1) {
            if (count !== 0 || address !== 0) return fail();
            ended = true;
        } else if (type === 0) {
            // avr-objcopy emits one contiguous flash image, including .data's
            // ROM initializers. SRAM, EEPROM and bootloader records are refused.
            if (!count || address !== next || address + count > flashLimit) return fail();
            for (let i = 0; i < count && reset.length < 4; i++) reset.push(record[4 + i]);
            next += count;
        } else return fail();
    }
    const resetAddress = ((reset[3] << 8) | reset[2]) * 2;
    const codeEnd = flashEnd - (dataEnd - dataStart);
    if (!ended || next !== flashEnd || reset[0] !== 0x0c || reset[1] !== 0x94 ||
        resetAddress < 104 || resetAddress + 2 > codeEnd) return fail();
}

const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
// The RV32 console has 4 MiB RAM. Keep the upper 32 KiB for its C stack.
const RISCV_LOAD_LIMIT = 0x3f8000;

/** Validate both the downloadable ELF and the exact image the debugger boots. */
export function cowgolRiscvImage (bytes, reported) {
    const fail = () => { throw new Error('Cowgol compiler returned an invalid RISC-V executable image.'); };
    if (!(bytes instanceof Uint8Array) || bytes.length < 52) return fail();
    const elf = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (elf.getUint32(0, false) !== 0x7f454c46 || bytes[4] !== 1 || bytes[5] !== 1 || bytes[6] !== 1 ||
        elf.getUint16(16, true) !== 2 || elf.getUint16(18, true) !== 243 || elf.getUint32(20, true) !== 1 ||
        elf.getUint16(40, true) !== 52 || elf.getUint16(42, true) !== 32) return fail();
    const entry = elf.getUint32(24, true);
    const table = elf.getUint32(28, true);
    const count = elf.getUint16(44, true);
    if (!count || count > 32 || table < 52 || table + count * 32 > bytes.length || (entry & 1)) return fail();
    const segments = [];
    let executableEntry = false;
    for (let i = 0; i < count; i++) {
        const at = table + i * 32;
        if (elf.getUint32(at, true) !== 1) continue;
        const offset = elf.getUint32(at + 4, true);
        const addr = elf.getUint32(at + 8, true);
        const physical = elf.getUint32(at + 12, true);
        const size = elf.getUint32(at + 16, true);
        const memory = elf.getUint32(at + 20, true);
        const flags = elf.getUint32(at + 24, true);
        const align = elf.getUint32(at + 28, true);
        if (!memory) {
            if (size) return fail();
            continue;
        }
        if ((align > 1 && ((align & (align - 1)) !== 0 || addr % align !== offset % align)) ||
            physical !== addr || addr < 0x1000 || memory < size || addr + memory > RISCV_LOAD_LIMIT ||
            offset + size > bytes.length || segments.some(s => addr < s.addr + s.bytes.length && s.addr < addr + memory)) return fail();
        const data = new Uint8Array(memory);
        data.set(bytes.subarray(offset, offset + size));
        segments.push({addr, bytes: data});
        if ((flags & 1) && entry >= addr && entry < addr + size) executableEntry = true;
    }
    if (!executableEntry || !reported || reported.entry !== entry ||
        !Array.isArray(reported.segments) || reported.segments.length !== segments.length) return fail();
    segments.sort((a, b) => a.addr - b.addr);
    for (let i = 0; i < segments.length; i++) {
        const actual = segments[i], supplied = reported.segments[i];
        if (!supplied || supplied.addr !== actual.addr || typeof supplied.bytes !== 'string' ||
            supplied.bytes.length !== Math.ceil(actual.bytes.length / 3) * 4 || !base64Pattern.test(supplied.bytes)) return fail();
        const data = atob(supplied.bytes);
        if (data.length !== actual.bytes.length || actual.bytes.some((byte, n) => byte !== data.charCodeAt(n))) return fail();
    }
    return {entry, segments};
}

/** Same image handoff used by the RISC-V C and assembler actions. */
export const cowgolRiscvDetail = image => ({
    rom: null, image, listing: null, target: 'riscv32',
    slotId: 'riscv', profile: 'riscv', format: 'riscv'
});

/** The ROM and its compiler workspace must fit the canonical Eater board. */
function validateEaterRom (bytes, out) {
    const fail = () => { throw new Error('Cowgol compiler returned an invalid Eater 6502 ROM or memory layout.'); };
    const layout = out.memory_layout;
    const names = ['lomem', 'eater_workspace_end', 'eater_zp_end', 'eater_code_end',
        'eater_data_load', 'eater_data_size', 'eater_reset', 'eater_irq', 'eater_halt'];
    if (bytes.length !== 0x8000 || out.format !== 'bin' || out.artifact_kind !== 'executable' ||
        out.origin !== 0x8000 || out.entry !== 0x8000 || out.mcu !== 'w65c02' || !layout ||
        names.some(name => !Number.isSafeInteger(layout[name]))) return fail();
    const {lomem, eater_workspace_end: workspace, eater_zp_end: zeroPage,
        eater_code_end: end, eater_data_load: data, eater_data_size: size,
        eater_reset: reset, eater_irq: irq, eater_halt: halt} = layout;
    if (workspace < 0x200 || workspace > lomem || lomem > 0x3ff8 || out.memory_end !== lomem ||
        zeroPage < 0 || zeroPage > 0x100 || data <= 0x8000 || data + size !== end ||
        size !== lomem - workspace || end > 0xfffa || reset !== 0x8000 ||
        halt <= 0x8000 || halt >= data || irq <= 0x8000 || irq >= data ||
        bytes[halt - 0x8000] !== 0xdb || bytes[irq - 0x8000] !== 0x40) return fail();
    const word = offset => bytes[offset] | (bytes[offset + 1] << 8);
    if (word(0x7ffa) !== irq || word(0x7ffc) !== reset || word(0x7ffe) !== irq) return fail();
}

/** Use an explicit board map, even if a different 6502 circuit was selected. */
export const cowgolEaterDetail = bytes => ({
    rom: bytes, image: null, listing: null, target: 'eater6502',
    slotId: 'rom', profile: 'eater', format: 'bin',
    machineConfig6502: {
        clockHz: 1_000_000,
        regions: [{kind: 'ram', start: 0x0000, end: 0x3fff}, {kind: 'rom', start: 0x8000, end: 0xffff}],
        chips: [{kind: 'via', name: 'via1', at: 0x6000}, {kind: 'acia', name: 'acia1', at: 0x5000}]
    }
});

/** Full Cowgol compilation, independent of the deliberately smaller Blocks reader. */
export async function compileCowgol (code, target, {fetcher = globalThis.fetch, signal,
    endpoint = COWGOL_COMPILE_ENDPOINT} = {}) {
    if (!remoteToolchainsAllowed()) throw new Error('Hosted Cowgol compilation is unavailable in this build.');
    const spec = Object.prototype.hasOwnProperty.call(COWGOL_COMPILE_TARGETS, target) ? COWGOL_COMPILE_TARGETS[target] : null;
    if (!spec) throw new Error(`Unsupported Cowgol compiler target: ${target}`);
    if (typeof code !== 'string' || !code.trim()) throw new Error('Write a Cowgol program first.');
    if (new TextEncoder().encode(code).byteLength > 256 * 1024) throw new Error('Cowgol source exceeds 256 KiB.');
    const response = await fetcher(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal,
        body: JSON.stringify({language: 'cowgol', code, target, format: spec.format})
    });
    let out;
    try { out = await response.json(); } catch (error) {
        throw new Error(`Cowgol compiler returned an invalid response (HTTP ${response.status}).`);
    }
    if (!response.ok || !out?.success) {
        const error = new Error(out?.error || `Cowgol compiler HTTP ${response.status}`);
        error.log = out?.log || '';
        throw error;
    }
    // The native route must never accept the ordinary C compiler's reply or
    // mistake a generated-C file for a runnable CP/M program.
    if (out.toolchain !== spec.toolchain || out.target !== target || out.language !== 'cowgol' ||
        typeof out.base64 !== 'string' ||
        out.base64.length > Math.ceil(spec.maxBytes / 3) * 4 ||
        !base64Pattern.test(out.base64)) {
        throw new Error('Cowgol compiler returned an invalid artifact.');
    }
    const bytes = Uint8Array.from(atob(out.base64), char => char.charCodeAt(0));
    if (!bytes.length || bytes.length > spec.maxBytes || bytes.length !== out.bytes ||
        (target.endsWith('-cpm') && out.origin !== 0x100) ||
        (target === 'dos' && (bytes[0] !== 0x4d || bytes[1] !== 0x5a))) {
        throw new Error('Cowgol compiler returned an invalid artifact size or load address.');
    }
    if (target === 'riscv32') {
        if (out.format !== 'elf' || out.artifact_kind !== 'executable') {
            throw new Error('Cowgol compiler returned an invalid RISC-V artifact format.');
        }
        const image = cowgolRiscvImage(bytes, out.image);
        if (out.entry !== image.entry) throw new Error('Cowgol compiler returned an invalid RISC-V entry point.');
        return {...out, bytes, image, target, filename: spec.filename};
    }
    if (target === 'eater6502') validateEaterRom(bytes, out);
    if (target === 'atmega328p') validateAvrHex(bytes, out);
    return {...out, bytes, target, filename: spec.filename};
}

/** A CP/M transient program uses the existing Z80 service machine loader. */
export const cowgolCpmConfig = () => ({
    id: 'cowgol-cpm', title: 'Cowgol — CP/M Z80', machine: 'z80',
    executionMode: 'functional', cpu: {variant: 'z80'},
    slots: {}, bootOrder: ['com'], widgets: [],
    provenance: {language: 'cowgol', compilerTarget: 'z80-cpm'}
});

export const cowgolDosConfig = () => ({
    id: 'cowgol-dos', title: 'Cowgol — DOS 8086', machine: 'i8086',
    executionMode: 'functional', cpu: {variant: '8086'},
    slots: {exe: {url: 'local-media:cowgol.exe'}}, bootOrder: ['exe'], widgets: [],
    provenance: {language: 'cowgol', compilerTarget: 'dos'}
});
