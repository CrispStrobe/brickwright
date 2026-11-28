/** Cowgol MZ programs launched by the real, booted MS-DOS 2.0 kernel.
 * The existing machine supplies BIOS services; IO.SYS, MSDOS.SYS and
 * COMMAND.COM execute from the shipped FAT12 disk and own DOS interrupts.
 */
export const COWGOL_DOS_DISK_VARIANTS = Object.freeze(['8086', '80186', '80286']);
export const COWGOL_DOS_BASE_IMAGE = Object.freeze({
    url: 'static/dos/msdos200-base.img', bytes: 368640,
    sha256: '5fbbe5e86fb845cff120ae8d17a01904c0db9d0b6103ce382b31130bd3eadd39'
});
export const COWGOL_DOS_PROGRAM = 'COWGOL.EXE';
// The pinned image has 313 free 1024-byte clusters. AUTOEXEC.BAT needs one.
export const COWGOL_DOS_MAX_EXE_BYTES = 312 * 1024;
const autoexec = () => new TextEncoder().encode('COWGOL\r\n');
const cancelled = signal => {
    if (signal?.aborted) throw signal.reason || new Error('Cowgol DOS disk preparation was cancelled.');
};

/** Fetch the fixed local base image, check its identity, and inject a copy of
 * the compiled artifact. Neither the executable nor the base is modified.
 * A caller must retain source/project ownership before activating the disk.
 */
export async function prepareCowgolDosDisk (exeBytes, {
    fetcher = globalThis.fetch, signal,
    loadInjector = () => import(/* webpackChunkName: "bw-debug-i8086" */ 'bw-board/dos-fat-inject.js')
} = {}) {
    cancelled(signal);
    if (!(exeBytes instanceof Uint8Array) || exeBytes.length < 28 ||
        exeBytes[0] !== 0x4d || exeBytes[1] !== 0x5a) {
        throw new Error('Cowgol MS-DOS boot requires a compiled DOS MZ executable.');
    }
    if (exeBytes.length > COWGOL_DOS_MAX_EXE_BYTES) {
        throw new Error(`Cowgol DOS executable exceeds the boot disk's ${COWGOL_DOS_MAX_EXE_BYTES}-byte program capacity.`);
    }
    const program = exeBytes.slice();
    const response = await fetcher(COWGOL_DOS_BASE_IMAGE.url, {signal});
    cancelled(signal);
    if (!response.ok) throw new Error(`Cowgol DOS base image HTTP ${response.status}`);
    const base = new Uint8Array(await response.arrayBuffer());
    cancelled(signal);
    if (base.length !== COWGOL_DOS_BASE_IMAGE.bytes) {
        throw new Error('Cowgol DOS base image has an unexpected size.');
    }
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', base));
    cancelled(signal);
    const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== COWGOL_DOS_BASE_IMAGE.sha256) {
        throw new Error('Cowgol DOS base image checksum does not match the qualified MS-DOS 2.0 disk.');
    }
    const {injectFile, readFile} = await loadInjector();
    cancelled(signal);
    const disk = injectFile(injectFile(base, COWGOL_DOS_PROGRAM, program), 'AUTOEXEC.BAT', autoexec());
    const saved = readFile(disk, COWGOL_DOS_PROGRAM);
    const startup = readFile(disk, 'AUTOEXEC.BAT');
    if (disk.length !== base.length || saved?.length !== program.length ||
        program.some((byte, index) => saved[index] !== byte) ||
        startup?.length !== autoexec().length || autoexec().some((byte, index) => startup[index] !== byte)) {
        throw new Error('Cowgol DOS disk did not preserve the compiled program and startup command.');
    }
    return disk;
}

/** The disk and selected CPU pass through the ordinary machine activation
 * route, retaining the same console and Controller display/keyboard surfaces.
 */
export function cowgolDosDiskConfig ({variant = '8086', display = false} = {}) {
    if (!COWGOL_DOS_DISK_VARIANTS.includes(variant) || typeof display !== 'boolean') {
        throw new Error('Cowgol MS-DOS boot needs an explicit 8086, 80186 or 80286 CPU and a Boolean display choice.');
    }
    return {
        id: `cowgol-msdos200-${variant}${display ? '-display' : ''}`,
        title: `Cowgol — MS-DOS 2.0 ${variant}${display ? ' / text display' : ''}`,
        machine: `i${variant}`, executionMode: 'functional', cpu: {variant},
        slots: {disk: {url: 'local-media:cowgol-dos.img'}}, bootOrder: ['disk'],
        widgets: display ? [{name: 'MS-DOS text display', type: 'simplevga', source: 'video',
            config: {width: 720, height: 400}}] : [],
        provenance: {language: 'cowgol', compilerTarget: 'dos', operatingSystem: 'MS-DOS 2.0',
            baseImageSha256: COWGOL_DOS_BASE_IMAGE.sha256}
    };
}
