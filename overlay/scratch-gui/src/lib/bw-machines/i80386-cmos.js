/** Add the enabled AT PS/2 mouse to the guest-visible RTC equipment word. */
export const withI80386MouseCmos = (chips, overrides = []) => chips.map(chip => {
    if (chip.kind !== 'rtc') return chip;
    const cmos = new Uint8Array(0x40);
    for (const [index, value] of chip.initialCmos) cmos[index] = value;
    for (const [index, value] of overrides) cmos[index] = value;
    // Windows checks the BIOS equipment word before using the auxiliary mouse.
    // The 386 config already enables the 8042 mouse hardware; advertise it too.
    // Keep the configured floppy, display and coprocessor equipment flags.
    cmos[0x14] |= 0x04;
    let checksum = 0;
    for (let index = 0x10; index <= 0x2d; index++) checksum = (checksum + cmos[index]) & 0xffff;
    cmos[0x2e] = checksum >>> 8;
    cmos[0x2f] = checksum & 0xff;
    return {...chip, initialCmos: [...cmos.entries()].filter(([, value]) => value !== 0)};
});

/** The AT BIOS uses this drive type to select transfer geometry and data rate. */
export const i80386FloppyCmos = ({cylinders, heads, sectors, bytesPerSector}) => [
    [0x10, cylinders === 80 && heads === 2 && sectors === 18 && bytesPerSector === 512 ? 0x40 : 0x20],
    [0x3d, 0x01]
];
