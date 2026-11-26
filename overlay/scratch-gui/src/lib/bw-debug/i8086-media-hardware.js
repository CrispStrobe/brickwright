// SPDX-License-Identifier: BSD-3-Clause
import {
    BLINK8086, CGADEMO8086, DESKDEMO8086, EGADEMO8086, HERCDEMO8086,
    KBDDEMO8086, PCXT8086, SERIALSHELL8086, TIMERDEMO8086, VGADEMO8086
} from 'bw-board/i8086-machine.js';

const presets = new Map([
    ['blink', BLINK8086],
    ['cgademo', CGADEMO8086],
    ['deskdemo', DESKDEMO8086],
    ['egademo', EGADEMO8086],
    ['hercdemo', HERCDEMO8086],
    ['kbddemo', KBDDEMO8086],
    ['serialshell', SERIALSHELL8086],
    ['timerdemo', TIMERDEMO8086],
    ['vgademo', VGADEMO8086]
]);

export const i8086VirtualHardware = profile => presets.get(profile) || PCXT8086;

export const isI8086Rom = ({kind, slotId, profile}) =>
    ['i8086', 'i8088', '8086', '8088'].includes(kind) &&
    slotId === 'rom' && profile !== 'dos' && profile !== 'floppy-os';

export function i8086CanUseBreadboard(config, {profile, romAt, bytes, machineConfig8086}) {
    if (!config?.regions?.length || !bytes?.length) return false;
    const covers = (kind, start, end) =>
        config.regions.some(region => region.kind === kind && region.start <= start && region.end >= end);
    const start = romAt ?? (0x100000 - bytes.length);
    if (!covers('rom', start, start + bytes.length - 1) || start + bytes.length <= 0xffff0) return false;
    const expected = machineConfig8086 || presets.get(profile);
    if (!expected) return true;
    return (expected.regions || []).filter(region => region.kind === 'ram')
        .every(region => covers('ram', region.start, region.end)) &&
        (expected.chips || []).every(chip => config.chips?.some(wired =>
            wired.kind === chip.kind && wired.at === chip.at &&
            (chip.irq == null || wired.irq === chip.irq)));
}
