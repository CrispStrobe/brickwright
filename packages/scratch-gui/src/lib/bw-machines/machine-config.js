// Machine Manager — the config schema (Machine Manager design §2, §8 step 1).
//
// A machine is a CONFIG, not a hardcoded flavor. This module is the ONE place
// that decides whether a config is well-formed and what its canonical shape is,
// so the GUI, the CLI and the Node tests all reject a bad config the same way
// (design §2: "Validation lives in one module … reused by GUI + CLI + a Node
// test"). It carries no image bytes — disk/ROM images are references
// (`{url, sha256, geometry?}`) fetched only on activation (design §2, §5).
//
// Framework-free: plain ES module, no React, no DOM. Safe to import in Node.

/** The three lanes are first-class (design §3). The engine already speaks them
 *  (`bw-i8086-execution.js`'s `['auto','functional','wired']`); the config MUST
 *  carry the choice so nobody tries to boot FreeDOS on a wired breadboard. */
export const EXECUTION_MODES = Object.freeze(['functional', 'wired', 'auto']);

/** Target kinds a config may name. Mirrors bw-board's media/target registry
 *  (machine-media.js `SLOTS`, debug-runner `selectDebugTargetKind`). Kept as a
 *  data list, not a hardcoded switch, so a new kind is one entry. */
export const MACHINE_KINDS = Object.freeze([
    'cp1',
    'i8086', 'i8088', 'i80186', 'i80286', 'i80386',
    'z80', 'zx48', 'zx128', 'eater6502', 'gpascal',
    // The RV32 machine. Its media-lab bundle is a Linux kernel (`kernel` slot)
    // plus an initramfs (`initrd` slot) — debug-runner's attachRiscV32Linux.
    'riscv32',
    // The RP2040 (Cortex-M0+). Its media-lab bundle is a pico-sdk `.uf2` in a
    // `flash` slot (PicoBB — BBC BASIC for the Pico) — booted via bw-board's
    // runRp2040Bundle path in debug-runner's attachRp2040jsBundle, with the
    // UART0 console on the debug panel's serial terminal.
    'rp2040js'
]);

/** The x86 family. A functional x86 machine boots a BIOS; the others do not,
 *  which is why the "a functional machine needs a BIOS" rule is x86-only (see
 *  the note on validate below). */
const X86_KINDS = Object.freeze(['i8086', 'i8088', 'i80186', 'i80286', 'i80386']);

/** Default CPU variant for a kind, when a config does not state one. The
 *  variant strings match run-dos.mjs / the i8086 machine presets. */
const DEFAULT_VARIANT = Object.freeze({
    cp1: '8049',
    i8086: '8086', i8088: '8088', i80186: '80186', i80286: '80286', i80386: '80386',
    z80: 'z80', zx48: 'z80', zx128: 'z80', eater6502: '6502', gpascal: '6502',
    riscv32: 'rv32imac', rp2040js: 'cortex-m0plus'
});

/** Preferred boot order when a config does not state one — a floppy is tried
 *  before a hard disk before a program before a bare ROM (matches the ELKS
 *  manifest's `["floppy","hdd"]`). Only slots that are actually present survive. */
const BOOT_PRIORITY = Object.freeze(['floppy', 'hdd', 'com', 'exe', 'disk', 'rom', 'rom0', 'kernel', 'flash']);

const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** Widget types the panel can render a machine's *output* into — the display
 *  faces of bw-board's ControllerPanel (controller.js WIDGET_TYPES). A widget
 *  whose `source` is `'video'` is fed each frame from the machine's `video()`
 *  via `panel.setVgaFrame(...)`; this is how a machine's screen reaches the user
 *  in the Widgets pane (design §4.2). Kept as data so a new display face is one
 *  entry, and validated leniently — bw-board's `addWidget` is the final arbiter. */
export const DISPLAY_WIDGET_TYPES = Object.freeze([
    'simplevga', 'mono_lcd', 'lcd', 'oled', 'terminal', 'matrix', 'sevenseg', 'bargraph'
]);

/** Widget types that can STEER a machine (feed its keyboard). A widget whose
 *  `source` is `'keyIn'` is drained and its keys sent to `runner.keyIn`
 *  (design §4.5, the input counterpart of a `source:'video'` screen). */
export const INPUT_WIDGET_TYPES = Object.freeze(['keyboard', 'keypad']);

/** Coerce one panel-widget declaration to canonical shape. A widget names a
 *  `simplevga` (or other display) face the manifest wants placed, and — when
 *  `source: 'video'` — bound to the machine's framebuffer. `config`/`layout`
 *  pass through verbatim to bw-board's `addWidget(name, type, config, layout)`. */
function normalizeWidget(w) {
    if (!isObj(w)) return null;
    const name = isStr(w.name) ? w.name : null;
    const type = isStr(w.type) ? w.type : null;
    if (!name || !type) return null;
    return {
        name,
        type,
        config: isObj(w.config) ? {...w.config} : {},
        layout: isObj(w.layout) ? {...w.layout} : null,
        // 'video' = mirror runner.video() into this widget (the machine screen);
        // 'keyIn' = drain this input widget's keys into the machine (steering);
        // null/absent = a static or program-driven face the manifest just places.
        source: (w.source === 'video' || w.source === 'keyIn') ? w.source : null
    };
}

/** A stable, cheap id. `crypto.randomUUID` exists in browsers and Node ≥ 16.7;
 *  the fallback keeps this module usable in any host without throwing. */
function mintId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    // Non-cryptographic fallback — only reached where Web Crypto is absent.
    return 'm-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 10);
}

/** Coerce one slot value to the canonical `{url, sha256, geometry}` reference.
 *  A bare string is read as a url (the media-lab manifests carry `{slot:
 *  filename}` — a filename is a relative url), so importers need not pre-shape. */
function normalizeSlot(value) {
    if (isStr(value)) return {url: value, sha256: null, geometry: null};
    if (isObj(value)) {
        return {
            url: isStr(value.url) ? value.url : (isStr(value.href) ? value.href : null),
            sha256: isStr(value.sha256) ? value.sha256.toLowerCase() : null,
            geometry: isObj(value.geometry) ? {...value.geometry} : null,
            // Keep the explicit ROM load address through repeated normalization
            // (activation and the store both normalize). Zero is meaningful;
            // omission leaves the target's existing default placement intact.
            ...(typeof value.romAt === 'number' ? {romAt: value.romAt} : {})
        };
    }
    return {url: null, sha256: null, geometry: null};
}

/**
 * Fill defaults and canonicalize shape WITHOUT judging validity. Idempotent:
 * `normalize(normalize(x))` deep-equals `normalize(x)`, so a store can round-trip
 * a config through export/import unchanged. Never mints an id (that is
 * `newMachineConfig`'s job) — a normalized config with no id keeps `id: null`.
 *
 * @param {object} cfg a partial or full machine config
 * @returns {object} a new object, keys in a stable order
 */
export function normalizeMachineConfig(cfg) {
    const c = isObj(cfg) ? cfg : {};
    const machine = isStr(c.machine) ? c.machine : null;

    const executionMode = EXECUTION_MODES.includes(c.executionMode)
        // Default to functional: the whole media-lab corpus is functional
        // software/OS content (design §3), and it is the only mode that boots
        // an OS. A wired machine is authored deliberately and states its mode.
        ? c.executionMode : 'functional';

    const cpu = isObj(c.cpu) ? {...c.cpu} : {};
    if (!isStr(cpu.variant) && machine && DEFAULT_VARIANT[machine]) {
        cpu.variant = DEFAULT_VARIANT[machine];
    }

    const slots = {};
    if (isObj(c.slots)) {
        for (const [id, value] of Object.entries(c.slots)) slots[id] = normalizeSlot(value);
    }

    // Boot order: keep a stated one (filtered to present slots), else derive it
    // from BOOT_PRIORITY, else fall back to slot insertion order.
    const present = Object.keys(slots);
    let bootOrder;
    if (Array.isArray(c.bootOrder) && c.bootOrder.length) {
        bootOrder = c.bootOrder.filter(s => present.includes(s));
    } else {
        bootOrder = BOOT_PRIORITY.filter(s => present.includes(s));
    }
    for (const s of present) if (!bootOrder.includes(s)) bootOrder.push(s);

    const out = {
        id: isStr(c.id) ? c.id : null,
        title: isStr(c.title) ? c.title : '',
        executionMode,
        machine,
        cpu,
        nativeBlocks: c.nativeBlocks === undefined ? false : c.nativeBlocks,
        ram: isObj(c.ram) ? {...c.ram} : {},
        bios: isObj(c.bios) ? {...c.bios} : null,
        video: isObj(c.video) ? {...c.video} : null,
        slots,
        bootOrder,
        quirks: Array.isArray(c.quirks) ? [...c.quirks] : [],
        // `machineConfig` is the manifest's own machine preset: a STRING name
        // ('PCXT8086') the boot path resolves, or an inline `{regions, chips}`
        // (the Eater 6502 case). Carried verbatim — it is bw-board's language,
        // not ours to rewrite (design §2: "One schema, shared by GUI and CLI").
        machineConfig: c.machineConfig != null ? c.machineConfig : null,
        // Panel widgets the manifest declares (design §4.2 "manifests must
        // define the vga widget if needed"). A `source:'video'` widget is the
        // machine's screen: created on activate and fed runner.video() frames.
        // Dropped entries that lack a name+type (a display face is useless
        // without both) so a malformed one never reaches addWidget.
        widgets: Array.isArray(c.widgets)
            ? c.widgets.map(normalizeWidget).filter(Boolean) : [],
        // wired-only (design §3): where the circuit lives.
        circuit: isObj(c.circuit) ? {...c.circuit} : null,
        tags: Array.isArray(c.tags) ? [...c.tags] : [],
        provenance: isObj(c.provenance) ? {...c.provenance} : {}
    };
    return out;
}

/**
 * Judge a config. Returns collected reasons rather than throwing, so a UI can
 * show every problem at once and a test can assert on them.
 *
 * Per-mode boot essentials (design §8 step 1):
 *   - functional / auto: a known `machine`, a `cpu.variant`, and at least one
 *     bootable `slot` with a url. For an **i80386** additionally a BIOS source
 *     (a `bios` field or a `bios` slot) — bw-board marks the 386 `bios` slot
 *     `required: true` because no 386 BIOS is vendored (freedoom manifest note:
 *     "user-supplied AT+VGA BIOS ROMs"). Non-x86 and i8086 machines are NOT
 *     required to carry a BIOS: the i8086 boot path fetches the XT BIOS itself
 *     and a 6502/Z80 has none. This narrows the doc's blanket "functional:
 *     machine/cpu/bios/slots" to where a BIOS is actually a boot precondition.
 *   - wired: a `circuit.ref`. No slots/BIOS — a wired machine is realized from
 *     the breadboard, not booted from an image (design §3).
 *
 * @param {object} cfg
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateMachineConfig(cfg) {
    const errors = [];
    if (!isObj(cfg)) return {ok: false, errors: ['config must be an object']};

    if (!EXECUTION_MODES.includes(cfg.executionMode)) {
        errors.push(`executionMode must be one of ${EXECUTION_MODES.join('|')}` +
            ` (got ${JSON.stringify(cfg.executionMode)})`);
    }
    if (cfg.title != null && typeof cfg.title !== 'string') {
        errors.push('title must be a string');
    }
    if (cfg.nativeBlocks !== undefined && typeof cfg.nativeBlocks !== 'boolean') {
        errors.push('nativeBlocks must be a boolean');
    } else if (cfg.nativeBlocks === true && cfg.machine !== 'i80386') {
        errors.push('nativeBlocks is available only for i80386 machines');
    }

    const mode = cfg.executionMode;
    const wired = mode === 'wired' ||
        // an `auto` config with a circuit and no bootable slots is wired in
        // effect (design §3: auto is functional UNLESS the circuit is needed).
        (mode === 'auto' && isObj(cfg.circuit) && !hasBootableSlot(cfg));

    if (wired) {
        if (!isObj(cfg.circuit) || !isStr(cfg.circuit.ref)) {
            errors.push('a wired machine requires circuit.ref');
        }
    } else if (mode === 'functional' || mode === 'auto') {
        if (!isStr(cfg.machine)) {
            errors.push('a functional machine requires a machine kind');
        } else if (!MACHINE_KINDS.includes(cfg.machine)) {
            errors.push(`unknown machine kind ${JSON.stringify(cfg.machine)}`);
        }
        if (!isObj(cfg.cpu) || !isStr(cfg.cpu.variant)) {
            errors.push('a functional machine requires cpu.variant');
        }
        if (!hasBootableSlot(cfg)) {
            errors.push('a functional machine requires at least one slot with a url');
        }
        if (cfg.machine === 'i80386' && !hasBiosSource(cfg)) {
            errors.push('an i80386 machine requires a BIOS source ' +
                '(a bios field or a bios slot; no 386 BIOS is vendored)');
        }
    }

    // Slot shape: whatever mode, a declared slot that carries no url is a
    // silent dead reference — name it.
    if (isObj(cfg.slots)) {
        for (const [id, ref] of Object.entries(cfg.slots)) {
            if (isStr(ref)) continue; // a bare-string url is fine
            if (!isObj(ref) || !isStr(ref.url)) {
                errors.push(`slot ${JSON.stringify(id)} has no url`);
            }
        }
    }

    // Widget declarations: each face needs a name and a type, names must be
    // unique (a panel keys widgets by name — a dup silently overwrites), and a
    // widget the manifest binds to the machine's video (`source:'video'`) must
    // be a display face — a joystick cannot show a framebuffer.
    if (cfg.widgets != null) {
        if (!Array.isArray(cfg.widgets)) {
            errors.push('widgets must be an array');
        } else {
            const seen = new Set();
            cfg.widgets.forEach((w, i) => {
                if (!isObj(w) || !isStr(w.name) || !isStr(w.type)) {
                    errors.push(`widget[${i}] needs a name and a type`);
                    return;
                }
                if (seen.has(w.name)) errors.push(`duplicate widget name ${JSON.stringify(w.name)}`);
                seen.add(w.name);
                if (w.source === 'video' && !DISPLAY_WIDGET_TYPES.includes(w.type)) {
                    errors.push(`widget ${JSON.stringify(w.name)} has source:'video'` +
                        ` but type ${JSON.stringify(w.type)} is not a display face`);
                }
                if (w.source === 'keyIn' && !INPUT_WIDGET_TYPES.includes(w.type)) {
                    errors.push(`widget ${JSON.stringify(w.name)} has source:'keyIn'` +
                        ` but type ${JSON.stringify(w.type)} is not an input face`);
                }
            });
        }
    }

    return {ok: errors.length === 0, errors};
}

function hasBootableSlot(cfg) {
    if (!isObj(cfg.slots)) return false;
    return Object.values(cfg.slots).some(ref =>
        isStr(ref) || (isObj(ref) && isStr(ref.url)));
}

function hasBiosSource(cfg) {
    if (isObj(cfg.bios) && (isStr(cfg.bios.kind) || isStr(cfg.bios.url))) return true;
    if (isObj(cfg.slots) && cfg.slots.bios) {
        const b = cfg.slots.bios;
        return isStr(b) || (isObj(b) && isStr(b.url));
    }
    return false;
}

/**
 * Factory: a normalized config with a freshly minted `id`. The one way to
 * create a machine so every machine has a stable local id (design §2).
 *
 * @param {object} [partial] any subset of the schema
 * @returns {object} a normalized config with `id` set
 */
export function newMachineConfig(partial = {}) {
    const normalized = normalizeMachineConfig(partial);
    if (!isStr(normalized.id)) normalized.id = mintId();
    return normalized;
}
