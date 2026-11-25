// The hosted SDAS assembler returns Intel HEX, which the 8051 firmware
// runner consumes as text. Keep the selected part with the image: an editor
// DEVICE change need not have compiled a new block project yet.
export const STC_ASM_TARGETS = new Set([
    'stc12c5a60s2', 'stc12c5a16s2', 'stc15f2k60s2', 'stc15w408as',
    'stc89c52', 'stc89c52rc'
]);

export const stcRunFor = target => STC_ASM_TARGETS.has(String(target).toLowerCase());

/** Validate the addressed image before handing it to the native HEX loader. */
export function validate8051Hex (text) {
    let base = 0;
    let dataBytes = 0;
    let ended = false;
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (ended) throw new Error('Intel HEX contains records after EOF');
        if (!/^:(?:[0-9a-fA-F]{2}){5,}$/.test(line)) throw new Error('Invalid Intel HEX record');
        const record = line.slice(1).match(/../g).map(byte => parseInt(byte, 16));
        const [count, hi, lo, type] = record;
        if (record.length !== count + 5) throw new Error('Intel HEX byte count does not match');
        if (record.reduce((sum, byte) => sum + byte, 0) % 256) throw new Error('Intel HEX checksum error');
        const address = hi * 256 + lo;
        if (type === 0) {
            if (base + address + count > 0x10000) throw new Error('8051 code exceeds the 16-bit address space');
            dataBytes += count;
        } else if (type === 1 && count === 0 && address === 0) {
            ended = true;
        } else if ((type === 2 || type === 4) && count === 2 && address === 0) {
            base = (record[4] * 256 + record[5]) * (type === 2 ? 16 : 65536);
            // The native loader ignores extended-address records. Passing a
            // nonzero segment through would silently load at the wrong address.
            if (base !== 0) throw new Error('8051 loader requires a zero extended address');
        } else {
            throw new Error(`Unsupported Intel HEX record type ${type}`);
        }
    }
    if (!ended || !dataBytes) throw new Error('Intel HEX needs program data and EOF');
    return dataBytes;
}

export function stcAssemblyFirmware (out, clockHz = null) {
    if (!stcRunFor(out.target)) throw new Error(`No 8051 runner for ${out.target}`);
    const text = new TextDecoder().decode(out.bytes);
    validate8051Hex(text);
    return {
        format: 'firmware', kind: 'emulator', target: out.target,
        firmware: {name: 'program.hex', text, bytes: null,
            device: String(out.target).toLowerCase(), fCpu: Number(clockHz) || null},
        rom: null, image: null, listing: out.listing || null
    };
}

/** Firmware carries its own part and oscillator; a file without them uses the project. */
export function stcFirmwareConfig (project, built) {
    return {...(project || {}),
        device: built.device || (project && project.device) || 'stc12c5a60s2',
        clock: Number(built.f_cpu) || Number(project && project.clock) || 11059200,
        pins: (project && project.pins) || []};
}
