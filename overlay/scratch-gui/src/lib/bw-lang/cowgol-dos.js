/** DOS compiler output is shared; the execution CPU is an explicit choice. */
export const COWGOL_DOS_VARIANTS = Object.freeze(['8086', '80186', '80286', '80386']);

export const cowgolDosVariantForDevice = device => {
    const match = /^(?:i)?(8086|80186|80286|80386)$/.exec(String(device || '').toLowerCase());
    return match ? match[1] : null;
};

/**
 * A DOS service bench, without a BIOS or operating-system disk image. The
 * selected variant is preserved by activation as x86Variant/dosVariant and
 * reaches the actual CPU constructor. The 386 uses its separate AT machine
 * and a deliberately selected real-mode DOS-service preset.
 */
export function cowgolDosConfig ({variant = '8086', display = false} = {}) {
    if (!COWGOL_DOS_VARIANTS.includes(variant) || typeof display !== 'boolean') {
        throw new Error('Cowgol DOS execution needs an explicit 8086, 80186, 80286 or 80386 CPU and a Boolean display choice.');
    }
    return {
        id: `cowgol-dos${variant === '8086' ? '' : `-${variant}`}${display ? '-display' : ''}`,
        title: `Cowgol — DOS ${variant}${display ? ' / text display' : ''}`,
        machine: `i${variant}`, executionMode: 'functional', cpu: {variant},
        ...(variant === '80386' ? {machineConfig: 'dos-service'} : {}),
        slots: {exe: {url: 'local-media:cowgol.exe'}}, bootOrder: ['exe'],
        widgets: display ? [{name: 'DOS text display', type: 'simplevga', source: 'video',
            config: {width: 720, height: 400}}] : [],
        provenance: {language: 'cowgol', compilerTarget: 'dos'}
    };
}
