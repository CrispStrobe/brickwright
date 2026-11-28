// Native source/ABI selection is explicit, including when a cross compiler is
// used. A host architecture must never silently select another target's data.
const targets = {
    'linux-x64': {
        architecture: 'x64', elfClass: 2, elfMachine: 62,
        assemblerSource: 'bbasmb_x86_64', dataSource: 'bbdata_x86_64.nas',
        flags: [], nasm: true
    },
    'linux-arm64': {
        architecture: 'arm64', elfClass: 2, elfMachine: 183,
        assemblerSource: 'bbasmb_arm_64', dataSource: 'bbdata_arm_64.s',
        flags: [], nasm: false
    },
    'linux-armv7': {
        architecture: 'arm', elfClass: 1, elfMachine: 40,
        assemblerSource: 'bbasmb_arm_32', dataSource: 'bbdata_arm_32.s',
        // Matches upstream console/raspi: ARMv7-A, Thumb-2, hard-float ABI.
        // VFPv3-D16 is explicit so a cross compiler cannot choose a newer FPU.
        flags: ['-march=armv7-a', '-mthumb', '-munaligned-access', '-mfloat-abi=hard', '-mfpu=vfpv3-d16'],
        nasm: false
    }
};

export function hostNativeTarget(platform = process.platform, architecture = process.arch) {
    return `${platform}-${architecture === 'arm' ? 'armv7' : architecture}`;
}

export function nativeTarget(name = hostNativeTarget()) {
    const configuration = Object.hasOwn(targets, name) ? targets[name] : undefined;
    if (!configuration) {
        throw new Error(`Unsupported native target ${name}; choose ${Object.keys(targets).join(', ')}. Use WASM on other hosts.`);
    }
    return Object.freeze({...configuration, name, flags: Object.freeze([...configuration.flags])});
}

export function verifyNativeBinary(bytes, target) {
    if (bytes.length < 52 || !Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
        bytes[4] !== target.elfClass || bytes[5] !== 1 || bytes.readUInt16LE(18) !== target.elfMachine) {
        throw new Error(`Compiler produced an incompatible ELF binary for ${target.name}`);
    }
    if (target.name === 'linux-armv7' && !(bytes.readUInt32LE(36) & 0x400)) {
        throw new Error('Linux ARMv7 requires the hard-float ARM EABI');
    }
}
