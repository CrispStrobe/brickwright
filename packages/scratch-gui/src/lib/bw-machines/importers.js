// Machine Manager — importers (design §6, §8 step 1).
//
// Every importer is cheap because a config is not an image (design §6): a
// DOSBox profile, a media-lab manifest, or a whole manifest repo becomes one (or
// many) small JSON configs with image references, not fetched bytes.
//
//   - fromDosboxConf(text)       — a `.conf` → a functional config.
//   - fromMediaManifest(manifest)— a brickwright-media.json → a machine.
//   - fromManifestRepo(entries)  — bulk: a repo of manifests → many machines.
//
// Framework-free: pure functions over text/JSON, no DOM, no fs (callers read
// the bytes; these map shapes).

import {newMachineConfig} from './machine-config.js';

// ── DOSBox .conf ────────────────────────────────────────────────────────────
//
// Reuses the mapping shape bw-board's run-dos.mjs `importDosboxConf` already
// defines — `{program, preset, variant, cycles, machine}` from the [dosbox]
// machine key, [cpu] cycles/cputype, and the [autoexec] mount+program — but
// reads TEXT (run-dos reads a file path; the GUI has the text in hand).

/** A CGA/Hercules/PCjr/Tandy board is the XT-class tier; svga/vga/ega stay on
 *  the AT-class default (same rule as run-dos.mjs). */
const XT_MACHINE_RE = /^(cga|hercules|herc|pcjr|tandy)/;

// Filenames in autoexec commands may contain comment markers inside quotes.
// DOS paths use backslashes literally, so they do not escape a closing quote.
function withoutComment(line) {
    let quote = null;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quote) {
            if (ch === quote) quote = null;
        } else if ((ch === '"' || ch === "'") && (i === 0 || /[\s=]/.test(line[i - 1]))) {
            quote = ch;
        } else if (ch === '#' || ch === ';') {
            return line.slice(0, i);
        }
    }
    return line;
}

/**
 * @param {string} text the contents of a dosbox.conf
 * @param {object} [opts]
 * @param {string} [opts.title] a title override (a .conf carries none)
 * @returns {object} a normalized functional machine config with a minted id
 */
export function fromDosboxConf(text, opts = {}) {
    if (typeof text !== 'string') throw new Error('fromDosboxConf expects the conf text');

    let section = null;
    const mounts = new Map();           // drive letter -> host dir
    const autoexec = [];
    let machineKey = null, cycles = null, cputype = null, core = null;

    for (const raw of text.split(/\r?\n/)) {
        const line = withoutComment(raw).trim();
        if (!line) continue;
        const sec = line.match(/^\[(\w+)\]$/);
        if (sec) { section = sec[1].toLowerCase(); continue; }
        if (section === 'autoexec') { autoexec.push(line); continue; }
        const kv = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (!kv) continue;
        const key = kv[1].toLowerCase();
        const val = kv[2].trim();
        if (section === 'dosbox' && key === 'machine') machineKey = val.toLowerCase();
        if (section === 'cpu' && key === 'cycles') cycles = val.toLowerCase();
        if (section === 'cpu' && key === 'cputype') cputype = val.toLowerCase();
        if (section === 'cpu' && key === 'core') core = val.toLowerCase();
    }

    // Resolve `mount c <dir>` and the first program the autoexec launches. Host
    // directory mounts are recorded as provenance only — no host command runs
    // (design §6; run-dos likewise refuses host-directory mounts).
    let program = null, programDrive = null;
    let diskImage = null, diskGeometry = null;
    for (const cmd of autoexec) {
        const img = cmd.match(/^imgmount\s+(?:c|2)\s+(?:"([^"]+)"|'([^']+)'|(\S+))(.*)$/i);
        if (img) {
            diskImage = img[1] || img[2] || img[3];
            // Geometry belongs to this mount, never a previous image. Parse
            // only the options: a quoted filename may itself contain -size.
            diskGeometry = null;
            const options = img[4].trim();
            const sizes = [...options.matchAll(/(?:^|\s)-size(?=\s|=|$)/ig)];
            if (sizes.length) {
                const value = options.slice(sizes[0].index + sizes[0][0].length).trim();
                const size = value.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?=\s+-|$)/);
                if (sizes.length !== 1 || !size) {
                    throw new Error('DOSBox imgmount -size requires bytes,sectors,heads,cylinders');
                }
                if (Number(size[1]) !== 512) {
                    throw new Error('DOSBox imgmount -size supports only 512-byte sectors');
                }
                diskGeometry = {sectors: Number(size[2]), heads: Number(size[3]),
                    cylinders: Number(size[4])};
            }
            continue;
        }
        const mount = cmd.match(/^mount\s+([a-z])\s+(.+)$/i);
        if (mount) { mounts.set(mount[1].toLowerCase(), mount[2].replace(/["']/g, '').trim()); continue; }
        const prog = cmd.match(/^(?:([a-z]):[\\/]?)?([\w.\\/-]+\.(?:com|exe))\b/i);
        if (prog && !program) {
            programDrive = (prog[1] || 'c').toLowerCase();
            program = prog[2].replace(/\\/g, '/');
        }
    }

    // CPU tier: a 386/486/pentium cputype (or a program that names one) is the
    // 386 machine; everything else on this tier is the 8086.
    const is386 = /^(386|486|pentium)/.test(cputype || '') || /386|486|pentium/.test(core || '');
    const machine = is386 ? 'i80386' : 'i8086';
    const preset = machineKey && XT_MACHINE_RE.test(machineKey) ? 'xt' : 'at';

    // The launched program becomes the boot slot: .exe → exe, .com → com.
    const slots = {};
    if (diskImage) slots.hdd = {url: diskImage, sha256: null, geometry: diskGeometry};
    if (program) {
        const isExe = /\.exe$/i.test(program);
        slots[isExe ? 'exe' : 'com'] = {url: program, sha256: null, geometry: null};
    }

    return newMachineConfig({
        title: opts.title || (program ? `DOSBox: ${program}` : 'DOSBox profile'),
        executionMode: 'functional',
        machine,
        ...(is386 ? {
            bios: {kind: 'bochs-lgpl'},
            video: {kind: 'vga', optionRom: 'seavgabios-lgpl'},
            widgets: [{name: 'AT VGA', type: 'simplevga', source: 'video',
                config: {width: 640, height: 480}}],
        } : {}),
        cpu: {variant: is386 ? '80386' : '8086'},
        slots,
        provenance: {
            source: 'dosbox-conf',
            dosbox: {
                machine: machineKey, preset, cycles, cputype: cputype || null, core: core || null,
                mounts: Object.fromEntries(mounts), programDrive
            }
        }
    });
}

// ── brickwright-media.json ───────────────────────────────────────────────────
//
// A media-lab manifest becomes a machine (design §6: "each projects/*/brick
// wright-media.json becomes a library entry"; §7: "a media-lab bundle is a
// machine config with software attached"). The real manifest shape differs from
// the design doc's illustration in two load-bearing ways, handled here:
//   1. `slots` are `{slotId: filename}` STRINGS, not `{url,sha256,geometry}`
//      objects — a filename is a relative url, and there is no sha in the
//      manifest, so `sha256` stays null.
//   2. floppy geometry + quirks live in a sibling `floppy: {geometry, quirks}`
//      block, not inside the slot — folded onto the floppy slot / config here.
// Media-lab content is OS/software → a FUNCTIONAL machine (design §3).

/**
 * @param {object} manifest a parsed brickwright-media.json
 * @param {object} [opts]
 * @param {string} [opts.source] a provenance tag (e.g. the project path)
 * @param {string} [opts.baseUrl] prefixed onto each slot's filename to make an
 *   absolute url (the manifest's files sit beside it in the project dir)
 * @returns {object} a normalized functional machine config with a minted id
 */
export function fromMediaManifest(manifest, opts = {}) {
    if (manifest == null || typeof manifest !== 'object') {
        throw new Error('fromMediaManifest expects a parsed manifest object');
    }
    const base = opts.baseUrl ? String(opts.baseUrl).replace(/\/$/, '') + '/' : '';
    // Prefix only relative references; absolute URLs and root-relative paths
    // already select their own location. Apply the same rule to both shapes.
    const resolveUrl = url => typeof url === 'string' && url.length &&
        !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(url) ? base + url : url;

    const slots = {};
    for (const [slotId, filename] of Object.entries(manifest.slots || {})) {
        // A slot may already be an object (a config-shaped manifest) or a bare
        // filename (the media-lab shape). normalizeMachineConfig coerces either,
        // but resolve the url here so baseUrl and per-slot geometry are applied.
        if (filename && typeof filename === 'object') {
            const url = typeof filename.url === 'string' && filename.url.length
                ? filename.url : filename.href;
            slots[slotId] = {...filename, url: resolveUrl(url)};
        } else {
            slots[slotId] = {url: resolveUrl(String(filename)), sha256: null, geometry: null};
        }
    }
    // Fold the sibling floppy block onto the floppy slot + config quirks.
    const floppyBlock = manifest.floppy;
    if (floppyBlock && typeof floppyBlock === 'object' && slots.floppy) {
        if (floppyBlock.geometry) slots.floppy.geometry = {...floppyBlock.geometry};
    }
    const quirks = (floppyBlock && Array.isArray(floppyBlock.quirks))
        ? [...floppyBlock.quirks] : [];

    // License/provenance from the components list or a bare license field.
    const components = Array.isArray(manifest.components) ? manifest.components : [];
    const license = manifest.license ||
        (components.length ? components.map(c => c.license).filter(Boolean).join(' + ') : null);

    return newMachineConfig({
        title: manifest.title || manifest.machine || 'imported machine',
        executionMode: 'functional',
        machine: manifest.machine || null,
        nativeBlocks: manifest.nativeBlocks === undefined ? false : manifest.nativeBlocks,
        // Carry the manifest's own machine preset verbatim — a string preset
        // name ('PCXT8086') or an inline {regions,chips} (the Eater case). The
        // activate/boot path resolves it; the manager does not rewrite it.
        machineConfig: manifest.machineConfig != null ? manifest.machineConfig : null,
        slots,
        quirks,
        // Hardware the manifest states: a BIOS source (an i80386 config requires
        // one — the free-386 boots the LGPL Bochs BIOS, `{kind:'bochs-lgpl'}`),
        // an optional video card, and RAM sizing. Carried so an imported 386
        // config validates and activates, not just the 8086 tier.
        bios: (manifest.bios && typeof manifest.bios === 'object') ? manifest.bios : null,
        video: (manifest.video && typeof manifest.video === 'object') ? manifest.video : null,
        ram: (manifest.ram && typeof manifest.ram === 'object') ? manifest.ram : undefined,
        // The manifest declares its own panel widgets (design §4.2: "manifests
        // must define the vga widget if needed"). A `source:'video'` widget is
        // this machine's screen; normalizeMachineConfig drops any malformed one.
        widgets: Array.isArray(manifest.widgets) ? manifest.widgets : [],
        provenance: {
            source: opts.source || 'media-lab',
            license: license || null,
            notes: manifest.notes || null,
            components: components.length ? components : null,
            // Preserve the run/program hints (F83's `program`, freedoom's `run`)
            // so a later increment can wire a host-run bundle without re-reading
            // the manifest.
            program: manifest.program || null,
            run: manifest.run || null,
            boot: manifest.boot === true
        }
    });
}

/**
 * Bulk import a repo of manifests (design §6: "A manifest repo → bulk import").
 *
 * Accepts, flexibly:
 *   - an array of manifests,
 *   - an array of `{path, manifest}` (path becomes each config's provenance),
 *   - an object map of `path -> manifest`.
 *
 * Resilient: a malformed entry does not sink the batch — it lands in `errors`
 * with its path, and the rest still import.
 *
 * @param {Array|object} entries
 * @param {object} [opts]
 * @param {string} [opts.baseUrl] a base url passed through to each manifest
 * @returns {{configs: object[], errors: {path: string, error: string}[]}}
 */
export function fromManifestRepo(entries, opts = {}) {
    const list = [];
    if (Array.isArray(entries)) {
        for (const e of entries) {
            if (e && typeof e === 'object' && 'manifest' in e) {
                list.push({path: e.path || null, manifest: e.manifest});
            } else {
                list.push({path: (e && e.title) || null, manifest: e});
            }
        }
    } else if (entries && typeof entries === 'object') {
        for (const [path, manifest] of Object.entries(entries)) list.push({path, manifest});
    } else {
        throw new Error('fromManifestRepo expects an array or a path->manifest map');
    }

    const configs = [];
    const errors = [];
    for (const {path, manifest} of list) {
        try {
            const perBase = opts.baseUrl && path
                // derive a per-project base so relative filenames resolve under
                // the project's own directory when a repo baseUrl is given.
                ? `${String(opts.baseUrl).replace(/\/$/, '')}/${dirOf(path)}`
                : opts.baseUrl;
            configs.push(fromMediaManifest(manifest, {source: path || 'media-lab', baseUrl: perBase}));
        } catch (e) {
            errors.push({path: path || '(unknown)', error: e.message});
        }
    }
    return {configs, errors};
}

/** The directory of a `projects/foo/brickwright-media.json`-style path. */
function dirOf(path) {
    const s = String(path);
    const i = s.lastIndexOf('/');
    return i >= 0 ? s.slice(0, i) : '';
}
