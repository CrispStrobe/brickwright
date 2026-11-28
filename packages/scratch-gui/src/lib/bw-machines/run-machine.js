// Machine Manager — run a machine config in the GUI (design §8 step 2, §4.2).
//
// The "run this machine" action, shared by the manager UI and the quick-picker.
// It adds NO new runner path: it resolves a config's media with activateConfig
// (fetch + sha-verify only on activation) and hands the bytes to the debug
// panel's EXISTING boot path via the `bw-machine-media-load` event — the same
// event the Machine Loader already dispatches. The one thing it adds to that
// event is the config's declared screen `widgets`, so a machine that names a
// `source:'video'` display mirrors its framebuffer into the Widgets pane
// (debug-panel starts the mirror after boot).
//
// Framework-free: the event dispatch and the image fetcher are both injectable,
// so a Node test drives this without a DOM or the network.

import {activateConfig, defaultImageFetcher} from './activate.js';
import {picoBasicCommands} from './pico-basic-source.js';
import {ubasicSource} from './ubasic-source.js';
export function runCpmCom(config, bytes) {
    const url = 'local-media:compiled.com';
    const compiled = {...config, slots: {...config.slots, com: {url}}};
    return runMachineConfig(compiled, {
        fetcher: ref => ref.url === url ? {bytes} : defaultImageFetcher(ref)
    });
}

/**
 * Boot a machine config.
 *
 * @param {object} config a machine config (normalized+validated by activateConfig)
 * @param {object} [opts]
 * @param {(detail: object) => void} [opts.dispatch] emit the media-load event
 *   (default: a `bw-machine-media-load` CustomEvent on the global)
 * @param {(ref: object) => Promise<{bytes: Uint8Array}>} [opts.fetcher] image fetcher
 * @returns {Promise<object>} `{mode:'wired', activated}` for a wired machine
 *   (realized in the circuit designer, not booted here), else
 *   `{mode:'functional', activated, detail}` where `detail` is the event payload.
 */
export async function runMachineConfig(config, opts = {}) {
    const dispatch = typeof opts.dispatch === 'function'
        ? opts.dispatch
        : detail => {
            if (typeof globalThis.dispatchEvent !== 'function' ||
                typeof globalThis.CustomEvent !== 'function') {
                throw new Error('no DOM event target to boot the machine on');
            }
            globalThis.dispatchEvent(new globalThis.CustomEvent('bw-machine-media-load', {detail}));
        };

    const activated = await activateConfig(config, {
        fetcher: opts.fetcher || defaultImageFetcher
    });

    // A wired machine is realized on the breadboard/circuit designer, not booted
    // from an image here (design §3). Hand the descriptor back for the caller to
    // route into the designer; nothing to dispatch.
    if (activated.mode === 'wired') {
        return {mode: 'wired', activated};
    }

    const bm = activated.bootMedia;
    const detail = {
        slotId: bm.slot,
        bytes: bm.bytes,
        kind: activated.targetKind,
        profile: activated.targetKind === 'i8086' && bm.slot === 'rom'
            ? opts.i8086RomProfile || bm.profile || null : bm.profile || null,
        name: bm.name || null,
        nativeBlocks: bm.nativeBlocks === true,
        machinePreset: activated.machinePreset || null,
        // The declared screen widget rides here so debug-panel mirrors video
        // into the Widgets pane; an empty array simply means no screen (video
        // stays in the Debug instrument).
        widgets: Array.isArray(activated.widgets) ? activated.widgets : []
    };
    if (bm.cpmLaunch) {
        detail.cpmLaunch = bm.cpmLaunch;
        detail.cpmFiles = bm.cpmFiles;
    }
    if (bm.spectrum) detail.spectrum = bm.spectrum;
    if (bm.picoWakeOnPrompt) detail.picoWakeOnPrompt = true;
    if (bm.picoBasicConsole) detail.picoBasicConsole = bm.picoBasicConsole;
    if (bm.picoFlashStorage) detail.picoFlashStorage = bm.picoFlashStorage;
    if (opts.picoBasicSource != null) {
        if (!bm.picoBasicConsole || detail.kind !== 'rp2040js' || bm.slot !== 'flash') {
            throw new Error('BASIC source needs compatible Pico UART firmware.');
        }
        detail.picoBasicCommands = picoBasicCommands(opts.picoBasicSource, bm.picoBasicConsole);
    }
    if (bm.dosFastStart) detail.dosFastStart = true;
    if (bm.x86Variant) detail.x86Variant = bm.x86Variant;
    if (bm.dosVariant) detail.dosVariant = bm.dosVariant;
    if (bm.dosArgs) detail.dosArgs = bm.dosArgs;
    if (bm.dosFiles) detail.dosFiles = bm.dosFiles;
    if (opts.dosSource) {
        const {name, text} = opts.dosSource;
        if (activated.targetKind !== 'i8086' || bm.slot !== 'exe' || !bm.dosFiles?.has(name)) {
            throw new Error('The DOS image does not declare this program file.');
        }
        detail.dosFiles = new Map(bm.dosFiles).set(name, new TextEncoder().encode(ubasicSource(text)));
    }
    if (typeof bm.romAt === 'number') detail.romAt = bm.romAt;
    if (bm.geometry) detail.geometry = {...bm.geometry};
    // A Linux kernel boots WITH its initramfs: both were fetched and
    // sha256-checked by activateConfig; the kernel is `bytes`, this is the rest.
    if (activated.media && activated.media.initrd && activated.media.initrd.bytes) {
        detail.linuxInitrd = activated.media.initrd.bytes;
    }
    // ...and, with a `snapshot` slot, opens at the shell prompt (bw-board
    // restores the snapshot on top of exactly these kernel + initramfs bytes).
    if (activated.media && activated.media.snapshot && activated.media.snapshot.bytes) {
        detail.linuxSnapshot = activated.media.snapshot.bytes;
    }
    if (activated.targetKind === 'i80386') {
        for (const slot of ['bios', 'vga-rom', 'hdd', 'floppy']) {
            const bytes = activated.media?.[slot]?.bytes;
            if (bytes) (detail.i80386Media ||= {})[slot] = bytes;
        }
    }
    // An inline machineConfig ({regions,chips}) — the Eater 6502 case — carries
    // the program's hardware as `chips`; a string preset (PCXT8086) is built by
    // the boot path itself and needs nothing here.
    if (activated.machineConfig && Array.isArray(activated.machineConfig.chips)) {
        detail.chips = activated.machineConfig.chips;
    }
    if (Array.isArray(activated.machineConfig?.regions)) {
        if (activated.targetKind === 'eater6502') detail.machineConfig6502 = activated.machineConfig;
        if (activated.targetKind === 'i8086') detail.machineConfig8086 = activated.machineConfig;
    }

    // DOM event listeners cannot return a Promise to dispatchEvent(). For the
    // browser machine routes below, wait for the panel's actual attach result so a
    // failed ROM/media load remains visible in Machine Manager. Injected
    // dispatchers keep the old synchronous contract unless a test opts in.
    const serialMachine = ['z80', 'rp2040js', 'eater6502', 'riscv32'].includes(activated.targetKind);
    if (serialMachine) detail.machineView = activated.videoWidget ? 'controller' : 'debugger';
    const awaitBoot = (activated.machinePreset === 'freedos-vga' || serialMachine ||
        (activated.targetKind === 'i80386' && ['bios', 'floppy'].includes(bm.slot)) ||
        (activated.targetKind === 'i8086' && ['rom', 'com', 'exe'].includes(bm.slot))) &&
        (opts.awaitBoot ?? typeof opts.dispatch !== 'function');
    let completion = null;
    let timer = null;
    if (awaitBoot) {
        completion = new Promise((resolve, reject) => {
            const settle = (error) => {
                clearTimeout(timer);
                delete detail.bootCompletion;
                if (error) reject(error);
                else resolve();
            };
            detail.bootCompletion = {resolve: () => settle(null), reject: settle};
            timer = setTimeout(() => settle(new Error('timed out waiting for the machine to attach')), 60000);
        });
    }
    try {
        dispatch(detail);
    } catch (error) {
        if (timer) clearTimeout(timer);
        delete detail.bootCompletion;
        throw error;
    }
    if (completion) await completion;
    return {mode: 'functional', activated, detail};
}
