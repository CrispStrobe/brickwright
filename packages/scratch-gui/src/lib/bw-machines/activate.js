// Machine Manager — activate (design §8 step 2).
//
// One `activateConfig(config)` that maps a machine config onto the inputs the
// EXISTING boot path already takes — it does NOT rewire debug-runner. For a
// functional machine it produces the `{targetKind, machineConfig, bootMedia}`
// that `createDebugRunner({vm, …})` consumes; for a wired machine it returns a
// descriptor pointing at the circuit (design §3: wired edits/boots in the
// circuit designer, not here).
//
// Images are references fetched only on activation (design §2, §5): each boot
// slot's `{url, sha256}` is resolved through an INJECTABLE fetcher, so a test
// passes a stub and production fetches the url and verifies the sha256.
//
// Framework-free: no React, no bundler globals. `defaultImageFetcher` uses the
// host `fetch` + Web Crypto, both present in the browser and Node ≥ 18.

import {
    normalizeMachineConfig, validateMachineConfig
} from './machine-config.js';
import {remoteMachineImagesAllowed} from '../distribution-policy.js';

/** Machine kind → debug-runner `targetKind`. Same grouping as debug-runner's
 *  `selectDebugTargetKind` (i8086 covers the whole 8086/286 tier; the 386 is
 *  its own kind, not yet a branch in lite's debug-runner — see the note on
 *  activateConfig). */
const TARGET_KIND = Object.freeze({
    cp1: 'cp1',
    i8086: 'i8086', i8088: 'i8086', i80186: 'i8086', i80286: 'i8086',
    i80386: 'i80386',
    z80: 'z80', zx48: 'z80', zx128: 'z80',
    eater6502: 'eater6502', gpascal: 'eater6502',
    riscv32: 'riscv32',
    rp2040js: 'rp2040js'
});

/** Boot slot → the debug-runner `bootMedia.profile` that selects its branch.
 *  A floppy boots the floppy-OS path; a .com/.exe the DOS bench; a ROM has no
 *  profile (it loads as a ROM image). See debug-runner's attachI8086. */
const SLOT_PROFILE = Object.freeze({
    floppy: 'floppy-os', com: 'dos', exe: 'dos', disk: 'dos',
    // A 'cpmsys' slot boots the REAL CP/M 2.2 (CCP+BDOS on our BIOS, an A>
    // prompt) on the Z80 machine — see debug-runner's attachZ80 cpmSystem
    // branch. The slot's file (if any) is placed on drive A: beside BBC BASIC.
    cpmsys: 'cpm-system',
    // A 'kernel' slot boots Linux on the RV32 machine (debug-runner's
    // attachRiscV32Linux); its `initrd` slot rides along as extra media.
    kernel: 'linux',
    // A 'flash' slot boots a pico-sdk .uf2 on the RP2040 (debug-runner's
    // attachRp2040jsBundle, via bw-board's runRp2040Bundle path). The console
    // is UART0 on the debug panel's serial terminal.
    flash: 'uf2'
});

const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** Hex-encode a SHA-256 of the bytes using Web Crypto. */
async function sha256Hex(bytes) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) throw new Error('Web Crypto (crypto.subtle) is unavailable; cannot verify sha256');
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // Copy into a fresh ArrayBuffer so a Uint8Array view with a non-zero offset
    // (a subarray) hashes only its own bytes.
    const digest = await subtle.digest('SHA-256', view.slice().buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The production image fetcher: fetch the url, verify the sha256, return bytes.
 * Injectable so tests never touch the network (design §5). A fetcher receives
 * the slot reference `{url, sha256, geometry}` and returns `{bytes, sha256}`.
 */
export async function defaultImageFetcher(ref) {
    if (!isStr(ref.url)) throw new Error('image reference has no url');
    if (!remoteMachineImagesAllowed() && /^https?:/i.test(ref.url)) {
        throw new Error('this restricted build does not download executable machine images; import a local image instead');
    }
    const res = await globalThis.fetch(ref.url);
    if (!res.ok) throw new Error(`failed to fetch ${ref.url}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const hash = await sha256Hex(bytes);
    if (isStr(ref.sha256) && ref.sha256.toLowerCase() !== hash) {
        throw new Error(`sha256 mismatch for ${ref.url}: expected ${ref.sha256}, got ${hash}`);
    }
    return {bytes, sha256: hash};
}

/** Resolve one slot ref through the fetcher and (if a sha was fetched AND the
 *  ref declares one) verify it — a stub fetcher that returns no sha is trusted,
 *  which is what tests want. */
async function resolveSlot(ref, fetcher, slotId) {
    let resolved;
    try {
        resolved = await fetcher(ref);
    } catch (e) {
        // NAME THE SLOT. A sha256 refusal that says only a URL leaves the
        // learner to work out which of a machine's images was wrong; the slot
        // id ('kernel', 'initrd', 'bios') is the word the manifest uses.
        if (slotId && e && typeof e.message === 'string' && !e.message.startsWith(`${slotId}: `)) {
            e.message = `${slotId}: ${e.message}`;
        }
        throw e;
    }
    if (!resolved || !(resolved.bytes instanceof Uint8Array)) {
        throw new Error(`fetcher for ${ref.url} returned no bytes`);
    }
    if (isStr(ref.sha256) && isStr(resolved.sha256) &&
        ref.sha256.toLowerCase() !== resolved.sha256.toLowerCase()) {
        throw new Error(`${slotId ? `${slotId}: ` : ''}sha256 mismatch for ${ref.url}`);
    }
    return resolved;
}

/**
 * Turn a config into the boot path's inputs. Fetches only the images a boot
 * needs (design §2: "fetched only on activation").
 *
 * @param {object} config a machine config (any shape; normalized+validated here)
 * @param {object} [opts]
 * @param {(ref: object) => Promise<{bytes: Uint8Array, sha256?: string}>}
 *   [opts.fetcher=defaultImageFetcher] resolves a slot's `{url, sha256}` → bytes
 * @returns {Promise<object>} an activation descriptor:
 *   - wired:      `{mode:'wired', executionMode, machine, circuit}`
 *   - functional: `{mode:'functional', executionMode, machine, targetKind,
 *                   bootMedia, machineConfig, media, debugRunnerOptions, warnings}`
 *     where `debugRunnerOptions` is exactly `{targetKind, machineConfig,
 *     bootMedia}` — the subset of `createDebugRunner`'s options a config decides.
 */
export async function activateConfig(config, opts = {}) {
    const fetcher = opts.fetcher || defaultImageFetcher;
    const cfg = normalizeMachineConfig(config);
    const {ok, errors} = validateMachineConfig(cfg);
    if (!ok) {
        const err = new Error(`cannot activate an invalid config: ${errors.join('; ')}`);
        err.validationErrors = errors;
        throw err;
    }

    // Wired (or an auto config that is wired in effect): no image fetch, just a
    // descriptor pointing at the circuit for the designer board to realize.
    const isWired = cfg.executionMode === 'wired' ||
        (cfg.executionMode === 'auto' && isObj(cfg.circuit) &&
            Object.keys(cfg.slots).length === 0);
    if (isWired) {
        return {
            mode: 'wired',
            executionMode: cfg.executionMode,
            machine: cfg.machine,
            circuit: cfg.circuit
        };
    }

    // Functional: pick the boot slot (first present in bootOrder), fetch it,
    // and shape it as debug-runner's bootMedia.
    const bootSlotId = cfg.bootOrder.find(id => cfg.slots[id]) || Object.keys(cfg.slots)[0];
    if (!bootSlotId) throw new Error('functional config has no boot slot to activate');
    const bootRef = cfg.slots[bootSlotId];

    // machineConfig for createDebugRunner is the wired-extractor {regions,chips}
    // — an INLINE object (the Eater 6502 case) passes straight through; a STRING
    // preset name ('PCXT8086') is bw-board's, resolved inside the boot path (the
    // floppy branch builds PCXT8086 itself), so it is not a machineConfig object
    // and is surfaced separately instead.
    let machineConfig = null;
    let machinePreset = null;
    if (isObj(cfg.machineConfig)) machineConfig = cfg.machineConfig;
    else if (isStr(cfg.machineConfig)) machinePreset = cfg.machineConfig;

    // Additional media a full boot needs beyond the primary image: the 386's
    // BIOS + VGA option ROM (bw-board marks the 386 `bios` slot required). These
    // are resolved here so the caller has every byte a boot needs; the i8086
    // boot path supplies its own XT BIOS and needs none of these.
    // A Linux kernel's initramfs is the same kind of companion: a `kernel`
    // boot needs its `initrd` before the first instruction runs — and its
    // `snapshot`, when the config has one, to open at the shell prompt.
    const extraSlots = ['bios', 'vga-rom', 'initrd', 'snapshot',
        ...(cfg.machine === 'i80386' && machinePreset === 'freedos-vga' ? ['hdd', 'floppy'] : [])]
        .filter(id => id !== bootSlotId && cfg.slots[id]);
    // ALL AT ONCE. The boot image and every companion are fetched in parallel:
    // one after the other, the Linux lesson's three files (9.5 MB) cost the sum
    // of three round trips before the first instruction. They are started in
    // declaration order and judged in that order, so the first failing slot is
    // the one reported (by name), and no rejection is left unhandled.
    const fetches = [bootSlotId, ...extraSlots].map(id => resolveSlot(cfg.slots[id], fetcher, id));
    const settled = await Promise.allSettled(fetches);
    const failed = settled.find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
    const resolved = settled[0].value;
    const media = {};
    extraSlots.forEach((id, i) => { media[id] = settled[i + 1].value; });

    const bootMedia = {
        slot: bootSlotId,
        bytes: resolved.bytes,
        name: cfg.title || bootSlotId,
        profile: SLOT_PROFILE[bootSlotId] || null
    };
    if (cfg.machine === 'i80386') bootMedia.nativeBlocks = cfg.nativeBlocks === true;
    if (bootRef.geometry) bootMedia.geometry = {...bootRef.geometry};
    // A ROM image states its own load address via the config; carry it so the
    // reset vector reads from real bytes (debug-runner's romAt path).
    if (typeof bootRef.romAt === 'number') bootMedia.romAt = bootRef.romAt;

    const warnings = [];

    const targetKind = TARGET_KIND[cfg.machine] || cfg.machine;
    // The i80386 boot path IS wired into lite's debug-runner now (attachI80386:
    // the fully-free 386 on the vendored LGPL Bochs BIOS + VGABios, booting a
    // FreeDOS floppy or hard disk and mirroring VGA video into the Widgets
    // pane). The pin bump landed bw-board's free-386 core, so activateConfig's
    // {targetKind, bootMedia, media} feed a real boot rather than a stub.

    // The panel widgets the manifest declared, and which one is the machine's
    // screen (the `source:'video'` display fed runner.video()). The host creates
    // these on the ControllerPanel and mirrors video into `videoWidget`; a
    // config that declares none has no screen widget (videoWidget: null), which
    // is correct for a serial-only or headless machine.
    const widgets = Array.isArray(cfg.widgets) ? cfg.widgets : [];
    const videoWidgetDecl = widgets.find(w => w && w.source === 'video') || null;

    return {
        mode: 'functional',
        executionMode: cfg.executionMode,
        machine: cfg.machine,
        targetKind,
        bootMedia,
        machineConfig,
        machinePreset,
        quirks: cfg.quirks,
        media,
        widgets,
        videoWidget: videoWidgetDecl ? videoWidgetDecl.name : null,
        warnings,
        // The exact subset of createDebugRunner's options this config decides.
        // A caller merges its own `{vm, onChange}` and calls createDebugRunner.
        debugRunnerOptions: {targetKind, machineConfig, bootMedia}
    };
}
